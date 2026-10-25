import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext, MarketContext, defaultSettings, normalizeA11y, normalizeAi, normalizeFundraisingFilters, normalizeUnlockPrefs, useMarket } from "./context.js";
import { prefersMoreContrast, prefersReducedMotion, summarySizes } from "../lib/a11y.js";
import { initialCoins } from "../data/coins.js";
import { researchFor } from "../data/research.js";
import { MAX_NOTIFICATIONS, alertNotification, alertTriggered, alertTypes, digestTime, reminderOffsets } from "../lib/alerts.js";
import { formatDate } from "../lib/format.js";
import { inQuietHours, showBrowserNotification } from "../lib/notify.js";
import { authErrorKind, clearFailures, lockState, normalizeEmail, recordFailure } from "../lib/auth.js";
import { emptyBilling, normalizeBilling, settleBilling } from "../lib/billing.js";
import { loadAccountData, saveAccountData, sendFeedback, sendTicket, snapshot } from "../lib/cloud.js";
import { supabase } from "../lib/supabase.js";
import { fetchLivePrices, mergeLivePrices } from "../lib/market.js";
import { POINTS_PROMO, findPromo, pointsFor, promoStatus } from "../data/promotions.js";

// Session kinds: "guest" and "demo" live in memory only (reset on refresh);
// "user" is a signed-up account on Supabase Auth whose data is saved to the cpa tables.

const emptyData = {
  watchlist: [],
  lists: [],
  settings: defaultSettings,
  recentCoins: [],
  recentSearches: [],
  votes: {},
  reminders: {},
  reminderTimings: ["1h"],
  notificationsAsked: false,
  transactions: [],
  follows: {},
  followedProjects: [],
  savedFilters: [],
  alerts: [],
  notifications: [],
  lastDigest: 0,
  onboarded: false,
  interests: { coins: [], sectors: [] },
  billing: emptyBilling,
  tickets: [],
  feedback: [],
  feedbackPromptDismissed: 0,
  affiliate: null,
  visits: 0,
  pointsSpent: 0,
};
// prefers-reduced-motion and prefers-contrast seed a guest's defaults (27-accessibility-menu.md).
const guestData = () => ({
  ...emptyData,
  watchlist: ["bitcoin"],
  settings: {
    ...defaultSettings,
    stopAnimations: prefersReducedMotion(),
    a11y: { ...defaultSettings.a11y, contrast: prefersMoreContrast() ? "high" : "default" },
  },
});
// Demo portfolio from 11-portfolio.md: totals $36,058.99, +28.26% all-time at sample prices.
const demoTransactions = [
  { id: "demo-btc", coinId: "bitcoin", type: "buy", amount: 0.25, price: 52300, fee: 0, date: "2025-03-10T15:00:00.000Z", note: "" },
  { id: "demo-eth", coinId: "ethereum", type: "buy", amount: 3.2, price: 2950, fee: 0, date: "2025-06-02T15:00:00.000Z", note: "" },
  { id: "demo-sol", coinId: "solana", type: "buy", amount: 40, price: 140, fee: 0, date: "2025-08-19T15:00:00.000Z", note: "" },
];
// Demo plan from 16-account-settings.md: Pro monthly, billed on the 3rd, Visa test card.
function demoBilling() {
  const now = new Date();
  const last = new Date(now.getFullYear(), now.getMonth() - (now.getDate() >= 3 ? 0 : 1), 3, 12);
  const next = new Date(last.getFullYear(), last.getMonth() + 1, 3, 12);
  return {
    ...emptyBilling,
    plan: "pro-monthly",
    billingDay: 3,
    nextBilling: next.toISOString(),
    history: [{ date: last.toISOString(), amount: 9.99, description: "Pro monthly", status: "Paid" }],
    methods: [{ id: "demo-card", type: "card", brand: "Visa", last4: "4242", exp: "08/28", default: true }],
  };
}

// Demo alerts from 12-alerts.md: two price alerts, the ARB unlock reminder, and a few notifications.
function demoAlertData() {
  const now = Date.now();
  const arbitrum = initialCoins.find((coin) => coin.id === "arbitrum");
  const unlock = arbitrum && researchFor(arbitrum).upcomingUnlocks[0];
  const reminders = unlock
    ? { [unlock.id]: { timings: ["1h"], kind: "unlock", symbol: "ARB", name: "Arbitrum", date: unlock.date.toISOString(), label: "ARB unlock", fired: [] } }
    : {};
  return {
    alerts: [
      { id: "demo-alert-btc", coinId: "bitcoin", type: "above", value: 70000, repeat: "recurring", bypassQuiet: false, active: true, lastFired: 0, created: now },
      { id: "demo-alert-eth", coinId: "ethereum", type: "below", value: 3500, repeat: "once", bypassQuiet: false, active: false, lastFired: 0, created: now },
    ],
    reminders,
    follows: { "northstar-capital": "daily" },
    notifications: [
      { id: "demo-note-btc", kind: "price", coinId: "bitcoin", title: "BTC above $67,500.00", detail: "Now $67,682.43 · ▲ +2.18% 24h", path: "/coins/bitcoin", at: now - 25 * 60_000, read: false },
      { id: "demo-note-arb", kind: "unlock", coinId: "arbitrum", title: "ARB unlock coming up", detail: unlock ? `92.65M ARB (3.21% of supply) · ${formatDate(unlock.date)}` : "92.65M ARB (3.21% of supply)", path: "/coins/arbitrum?tab=tokenomics", at: now - 70 * 60_000, read: false },
      { id: "demo-note-fund", kind: "fund", title: "Northstar Capital led Driftnet $28.5M", detail: "Series A · DeFi", path: "/funds/northstar-capital", at: now - 26 * 60 * 60_000, read: true },
    ],
  };
}
const demoData = () => ({
  ...emptyData,
  watchlist: ["bitcoin", "ethereum", "solana", "arbitrum"],
  lists: [{ id: "demo-list-l2", name: "L2 bets", coinIds: ["arbitrum", "optimism", "polygon"] }],
  transactions: demoTransactions,
  onboarded: true,
  billing: demoBilling(),
  ...demoAlertData(),
});
let idCounter = 0;
// UUIDs, because transactions, alerts, notifications and saved filters are uuid rows in the
// database. Without Web Crypto (insecure origins) the fallback id works for this tab only.
const newId = (prefix) => globalThis.crypto?.randomUUID?.() ?? `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;

const today = () => new Date().toISOString().slice(0, 10);

const TRANSACTION_TYPES = new Set(["buy", "sell", "transfer-in", "transfer-out"]);
function isValidTransaction(tx) {
  return (
    tx && typeof tx === "object" &&
    typeof tx.id === "string" && typeof tx.coinId === "string" && TRANSACTION_TYPES.has(tx.type) &&
    Number.isFinite(tx.amount) && tx.amount > 0 && Number.isFinite(tx.price) && tx.price >= 0 &&
    !Number.isNaN(new Date(tx.date).getTime())
  );
}

const ALERT_TYPES = new Set(alertTypes.map((type) => type.id));
function isValidAlert(alert) {
  return (
    alert && typeof alert === "object" &&
    typeof alert.id === "string" && typeof alert.coinId === "string" && ALERT_TYPES.has(alert.type) &&
    Number.isFinite(alert.value) && alert.value > 0
  );
}
const normalizeAlert = (alert) => ({
  ...alert,
  repeat: alert.repeat === "recurring" ? "recurring" : "once",
  bypassQuiet: alert.bypassQuiet === true,
  active: alert.active !== false,
  lastFired: Number.isFinite(alert.lastFired) ? alert.lastFired : 0,
});
const isValidNotification = (note) =>
  note && typeof note === "object" && typeof note.id === "string" && typeof note.title === "string" && Number.isFinite(note.at);

// Every load starts as a guest; a saved Supabase session is restored after mount.
const loadInitial = () => ({ session: { kind: "guest" }, data: guestData() });

const isTicket = (item) => item && typeof item.id === "string" && typeof item.subject === "string" && typeof item.date === "string";

const accountSession = (profile, user) => ({ kind: "user", userId: profile.id, name: profile.name, email: user.email, createdAt: profile.created_at });

// The signed-in user's profile and data from Supabase, validated and normalised.
// Returns { status: "ok", session, data, snapshot } | { status: "deleted" } | { status: "error", error }.
async function loadAccount(user) {
  try {
    const { profile, stored, snapshot: baseline } = await loadAccountData();
    if (profile.status === "deleted") return { status: "deleted" };
    const data = normalizeStored(stored);
    return { status: "ok", session: accountSession(profile, user), data, snapshot: snapshot(data, baseline) };
  } catch (error) {
    return { status: "error", error };
  }
}

// Stored data may be partial or malformed; anything that doesn't fit falls back to the default.
function normalizeStored(rawStored) {
  const stored = Object.fromEntries(
    Object.entries(rawStored && typeof rawStored === "object" && !Array.isArray(rawStored) ? rawStored : {}).filter(([, value]) => value !== undefined && value !== null),
  );
  ["watchlist", "lists", "recentCoins", "recentSearches", "transactions", "followedProjects", "savedFilters", "alerts", "notifications", "tickets", "feedback"].forEach((key) => {
    if (!Array.isArray(stored[key])) delete stored[key];
  });
  if (stored.tickets) stored.tickets = stored.tickets.filter(isTicket);
  if (stored.feedback) stored.feedback = stored.feedback.filter((item) => item && Number.isInteger(item.rating));
  ["feedbackPromptDismissed", "visits", "pointsSpent"].forEach((key) => {
    if (!Number.isFinite(stored[key])) delete stored[key];
  });
  if (!(stored.affiliate && typeof stored.affiliate.code === "string")) stored.affiliate = null;
  // Drop malformed entries rather than let one bad record break a page.
  ["watchlist", "recentCoins", "recentSearches", "followedProjects"].forEach((key) => {
    if (stored[key]) stored[key] = stored[key].filter((item) => typeof item === "string");
  });
  if (stored.transactions) stored.transactions = stored.transactions.filter(isValidTransaction);
  if (stored.alerts) stored.alerts = stored.alerts.filter(isValidAlert).map(normalizeAlert);
  if (stored.notifications) {
    stored.notifications = stored.notifications
      .filter(isValidNotification)
      .map((note) => ({ ...note, read: note.read === true, path: typeof note.path === "string" && note.path.startsWith("/") ? note.path : "/alerts" }))
      .slice(0, MAX_NOTIFICATIONS);
  }
  if (!Number.isFinite(stored.lastDigest)) delete stored.lastDigest;
  if (typeof stored.onboarded !== "boolean") delete stored.onboarded;
  const interests = stored.interests && typeof stored.interests === "object" ? stored.interests : {};
  stored.interests = {
    coins: Array.isArray(interests.coins) ? interests.coins.filter((item) => typeof item === "string") : [],
    sectors: Array.isArray(interests.sectors) ? interests.sectors.filter((item) => typeof item === "string") : [],
  };
  if (stored.lists) {
    stored.lists = stored.lists
      .filter((list) => list && typeof list.id === "string" && typeof list.name === "string" && list.name.trim() && Array.isArray(list.coinIds))
      .slice(0, MAX_LISTS - 1)
      .map((list) => ({ id: list.id, name: list.name.slice(0, 30), coinIds: [...new Set(list.coinIds.filter((id) => typeof id === "string"))] }));
  }
  if (stored.savedFilters) stored.savedFilters = stored.savedFilters.filter((item) => item && typeof item.name === "string" && item.filters && typeof item.filters === "object");
  if (stored.savedFilters) {
    stored.savedFilters = stored.savedFilters.slice(0, 10).map((item) => ({
      id: typeof item.id === "string" ? item.id : newId("filter"),
      name: item.name.slice(0, 30),
      filters: normalizeFundraisingFilters(item.filters),
    }));
  }
  ["votes", "reminders", "follows"].forEach((key) => {
    if (stored[key] && (typeof stored[key] !== "object" || Array.isArray(stored[key]))) delete stored[key];
  });
  return {
    ...emptyData,
    ...stored,
    settings: {
      ...defaultSettings,
      ...stored.settings,
      market: { ...defaultSettings.market, ...stored.settings?.market },
      unlocks: normalizeUnlockPrefs(stored.settings?.unlocks),
      fundraising: normalizeFundraisingFilters(stored.settings?.fundraising),
      a11y: normalizeA11y(stored.settings?.a11y),
      ai: normalizeAi(stored.settings?.ai),
      quietHours: { ...defaultSettings.quietHours, ...(stored.settings?.quietHours && typeof stored.settings.quietHours === "object" ? stored.settings.quietHours : {}) },
    },
    reminders: Object.fromEntries(
      Object.entries(stored.reminders ?? {})
        .filter(([, item]) => item && Array.isArray(item.timings) && typeof item.symbol === "string" && !Number.isNaN(new Date(item.date).getTime()))
        .map(([id, item]) => [id, { ...item, fired: Array.isArray(item.fired) ? item.fired : [], paused: item.paused === true }]),
    ),
    billing: settleBilling(normalizeBilling(stored.billing)),
    follows: Object.fromEntries(Object.entries(stored.follows ?? {}).filter(([, frequency]) => ["instant", "daily", "weekly"].includes(frequency))),
  };
}

// 10 watchlists in all: "Main" plus up to 9 named lists (10-watchlist.md).
const MAX_LISTS = 10;

const TICK_MS = 30_000;
const SAVE_DELAY_MS = 600;
const RETRY_MS = 15_000;
const RESTORE_TIMEOUT_MS = 8000;
const PENDING_TTL_MS = 15 * 60_000;

function MarketProvider({ autoRefresh, children }) {
  const [coins, setCoins] = useState(initialCoins);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [flashes, setFlashes] = useState({});
  const [loadError, setLoadError] = useState(false);

  const coinsRef = useRef(coins);
  const liveRef = useRef(false);

  // Simulated feed: nudge every price a little; stablecoins barely move.
  const simulate = useCallback(() => {
    const nextFlashes = {};
    const next = coinsRef.current.map((coin) => {
      const stable = coin.category === "Stablecoin";
      const move = stable ? (Math.random() - 0.5) * 0.0004 : (Math.random() - 0.5) * 0.008;
      if (Math.abs(move) < 0.00005) return coin;
      nextFlashes[coin.id] = move > 0 ? "up" : "down";
      const price = coin.price * (1 + move);
      const change24h = ((1 + coin.change24h / 100) * (1 + move) - 1) * 100;
      const spark = [...coin.spark.slice(0, -1), coin.spark[coin.spark.length - 1] * (1 + move)];
      return { ...coin, price, change24h, change1h: coin.change1h + move * 100, marketCap: coin.marketCap * (1 + move), spark };
    });
    coinsRef.current = next;
    setCoins(next);
    setFlashes(nextFlashes);
    setTick((value) => value + 1);
    setLastUpdated(Date.now());
  }, []);

  // Live feed: read CryptoRank prices from cpa.coins over REST. Until the first sync has run (or
  // without Supabase) the simulated feed stands in. A failed request keeps the last data visible.
  const apply = useCallback((live, simulateWhenEmpty) => {
    setLoadError(false);
    if (!live?.rows.length) {
      if (!liveRef.current && simulateWhenEmpty) simulate();
      return;
    }
    liveRef.current = true;
    const { next, flashes: nextFlashes } = mergeLivePrices(coinsRef.current, live.rows);
    coinsRef.current = next;
    setCoins(next);
    setFlashes(nextFlashes);
    setTick((value) => value + 1);
    setLastUpdated(live.updatedAt || Date.now());
  }, [simulate]);
  // Offline (US-9.5): keep the last data on screen and skip the request, so the offline banner
  // shows instead of the load error; the feed refreshes when the connection returns.
  const refresh = useCallback(() => {
    if (!navigator.onLine) return Promise.resolve();
    return fetchLivePrices().then((live) => apply(live, true), () => setLoadError(true));
  }, [apply]);

  useEffect(() => {
    window.addEventListener("online", refresh);
    return () => window.removeEventListener("online", refresh);
  }, [refresh]);

  // First load: no simulated nudge, so the sample figures show as bundled until a sync has run.
  useEffect(() => {
    let active = true;
    fetchLivePrices().then(
      (live) => active && apply(live, false),
      () => active && setLoadError(true),
    );
    return () => {
      active = false;
    };
  }, [apply]);

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const value = useMemo(
    () => ({ coins, lastUpdated, tick, flashes, refresh, loadError }),
    [coins, lastUpdated, tick, flashes, refresh, loadError],
  );
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

// Runs alert checks while the app is open (12-alerts.md): price alerts on every
// price tick, reminders and the weekly digest on a 30 s clock.
const CLOCK_MS = 30_000;
function AlertWatcher({ onPrices, onClock }) {
  const { coins } = useMarket();
  const coinsRef = useRef(coins);
  useEffect(() => {
    coinsRef.current = coins;
    onPrices(coins);
  }, [coins, onPrices]);
  useEffect(() => {
    onClock(Date.now(), coinsRef.current);
    const id = window.setInterval(() => onClock(Date.now(), coinsRef.current), CLOCK_MS);
    return () => window.clearInterval(id);
  }, [onClock]);
  return null;
}

// "Weekly digest summary" (25-ai-integration.md): a factual recap, no advice words.
function digestRecap(watchlist, coins) {
  const held = watchlist.map((id) => coins.find((coin) => coin.id === id)).filter(Boolean);
  if (!held.length) return "Your watchlist is empty this week.";
  const sorted = [...held].sort((a, b) => b.change24h - a.change24h);
  const up = held.filter((coin) => coin.change24h > 0).length;
  const fmt = (value) => `${value > 0 ? "+" : "−"}${Math.abs(value).toFixed(2)}%`;
  return `${up} of ${held.length} watchlist coins are up in 24h. Biggest move: ${sorted[0].symbol} ${fmt(sorted[0].change24h)}; weakest: ${sorted.at(-1).symbol} ${fmt(sorted.at(-1).change24h)}.`;
}

export function AppProvider({ children }) {
  const [initial] = useState(loadInitial);
  const [session, setSession] = useState(initial.session);
  const [data, setData] = useState(initial.data);
  const [authPrompt, setAuthPrompt] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [search, setSearch] = useState({ open: false, scope: "all" });
  const toastId = useRef(0);
  const dataRef = useRef(data);
  const pendingAction = useRef(null);

  const navigate = useNavigate();

  // Keep a ref to the latest data so deferred actions (run after sign-in) see current state.
  // A layout effect runs before any child's passive effect (the alert checks read it).
  useLayoutEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Complete the action a guest started once they have a session (US-1.1).
  useEffect(() => {
    if (session.kind === "guest" || !pendingAction.current) return;
    const { action, at } = pendingAction.current;
    pendingAction.current = null;
    // A sign-in abandoned long ago shouldn't replay an old tap.
    if (Date.now() - at < PENDING_TTL_MS) action();
  }, [session.kind]);

  // Save signed-up accounts to Supabase: after a short pause, one save at a time, changed rows
  // only. A failed save says so once, keeps the changes in memory and retries.
  const notifyRef = useRef(null);
  const sync = useRef({ userId: null, snapshot: null, running: null, again: false, warned: false, retry: 0 });
  const flush = useCallback(function flushNow() {
    const state = sync.current;
    if (!state.userId || !state.snapshot) return Promise.resolve();
    if (state.running) {
      state.again = true;
      return state.running;
    }
    window.clearTimeout(state.retry);
    state.running = (async () => {
      do {
        state.again = false;
        if (sync.current !== state) return { ok: false, stale: true };
        const target = dataRef.current;
        const result = await saveAccountData(state.userId, state.snapshot, target).catch((error) => ({ ok: false, error, snapshot: state.snapshot }));
        if (sync.current !== state) return { ok: false, stale: true };
        state.snapshot = result.snapshot;
        if (!result.ok) {
          if (!state.warned) notifyRef.current?.("We couldn't save your changes. Check your connection; we'll keep trying.");
          state.warned = true;
          if (sync.current === state) state.retry = window.setTimeout(flushNow, RETRY_MS);
          return { ok: false, error: result.error };
        }
        if (state.warned) notifyRef.current?.("Your changes are saved.");
        state.warned = false;
      } while (state.again);
      return { ok: true };
    })().finally(() => {
      state.running = null;
    });
    return state.running;
  }, []);
  useEffect(() => {
    if (session.kind !== "user") return undefined;
    const id = window.setTimeout(flush, SAVE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [session, data, flush]);
  // Save straight away when the tab is hidden or closing.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [flush]);

  // Reflect display and accessibility settings on <html> so CSS can respond (27-accessibility-menu.md).
  const { a11y } = data.settings;
  useEffect(() => {
    const root = document.documentElement;
    const theme = data.settings.theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : data.settings.theme;
    // Contrast "dark" / "light" force that theme; "high" raises contrast within it.
    root.dataset.theme = a11y.contrast === "dark" || a11y.contrast === "light" ? a11y.contrast : theme;
    root.dataset.contrast = a11y.contrast === "high" ? "high" : "default";
    root.dataset.colors = data.settings.colors;
    root.dataset.motion = data.settings.stopAnimations ? "off" : "on";
    root.dataset.font = a11y.font;
    root.dataset.align = a11y.align;
    root.dataset.saturation = a11y.saturation;
    ["highlightLinks", "highlightHeadings", "strongFocus", "bigCursor", "hideImages"].forEach((key) => {
      root.dataset[key] = a11y[key] ? "on" : "off";
    });
    root.dataset.lineHeight = a11y.lineHeight ? "custom" : "default";
    root.dataset.textLarge = a11y.textSize > 130 ? "on" : "off"; // tables become stacked cards
    root.dataset.letterSpacing = a11y.letterSpacing ? "custom" : "default";
    root.style.setProperty("--a11y-zoom", String(a11y.textSize / 100));
    root.style.setProperty("--a11y-line-height", String(a11y.lineHeight || 1.5));
    root.style.setProperty("--a11y-letter-spacing", `${a11y.letterSpacing}em`);
    root.style.setProperty("--summary-size", `${summarySizes[a11y.summarySize]}px`);
  }, [data.settings.theme, data.settings.colors, data.settings.stopAnimations, a11y]);

  // Toasts last 4 s (5 s when they offer Undo); at most two at once.
  const showToast = useCallback((message, action) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-1), { id, message, action }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), action ? 5000 : 4000);
  }, []);

  useEffect(() => {
    notifyRef.current = showToast;
  }, [showToast]);

  const dismissToast = useCallback((id) => setToasts((current) => current.filter((toast) => toast.id !== id)), []);

  // Guests are asked to sign in; the action then completes (US-1.1).
  const requireAuth = useCallback(
    (reason, action) => {
      if (session.kind === "guest") {
        pendingAction.current = { action, at: Date.now() };
        setAuthPrompt({ reason });
      } else {
        action();
      }
    },
    [session.kind],
  );

  const startDemo = useCallback(() => {
    setSession({ kind: "demo", name: "Demo user" });
    setData(demoData());
    setAuthPrompt(null);
  }, []);

  const endDemo = useCallback(() => {
    setSession({ kind: "guest" });
    setData({ ...guestData(), onboarded: true });
  }, []);

  // The intent (add or remove) is fixed when the user taps, so an action finished
  // after sign-in still does what they asked even if their saved list differs.
  const toggleWatch = useCallback(
    (coin) => {
      const add = !dataRef.current.watchlist.includes(coin.id);
      requireAuth(`Sign in to ${add ? "add" : "remove"} ${coin.name} ${add ? "to" : "from"} your watchlist`, () => {
        setData((current) => ({
          ...current,
          watchlist: add
            ? [...new Set([...current.watchlist, coin.id])]
            : current.watchlist.filter((id) => id !== coin.id),
        }));
        showToast(add ? `${coin.name} added to watchlist` : `${coin.name} removed from watchlist`);
      });
    },
    [requireAuth, showToast],
  );

  // Recently viewed coins: newest first, de-duplicated, max 10 (US-P03.1).
  const addRecentCoin = useCallback((coinId) => {
    setData((current) =>
      current.recentCoins[0] === coinId
        ? current
        : { ...current, recentCoins: [coinId, ...current.recentCoins.filter((id) => id !== coinId)].slice(0, 10) },
    );
  }, []);

  // One sentiment vote per coin per day (US-P03.2); guests see results only.
  const castVote = useCallback(
    (coin, vote) =>
      requireAuth(`Sign in to vote on ${coin.name}`, () => {
        setData((current) => ({ ...current, votes: { ...current.votes, [coin.id]: { vote, day: today() } } }));
        showToast(`Vote recorded: ${vote === "bullish" ? "Bullish" : "Bearish"} on ${coin.symbol}`);
      }),
    [requireAuth, showToast],
  );

  const voteFor = useCallback((coinId) => {
    const entry = data.votes[coinId];
    return entry?.day === today() ? entry.vote : null;
  }, [data.votes]);

  // Reminders for unlocks (US-4.2) and token sales (US-P09.1); timings default to the last choice.
  // `item` = { id, kind: "unlock" | "sale", symbol, name, date }.
  const setReminder = useCallback(
    (item, timings) =>
      requireAuth(`Sign in to set a reminder for ${item.symbol}`, () => {
        const label = item.kind === "sale" ? `${item.symbol} token sale` : `${item.symbol} unlock`;
        setData((current) => {
          const reminders = { ...current.reminders };
          if (timings.length) {
            reminders[item.id] = { timings, kind: item.kind ?? "unlock", symbol: item.symbol, name: item.name ?? item.symbol, date: new Date(item.date).toISOString(), label, fired: [], paused: false };
          } else {
            delete reminders[item.id];
          }
          return { ...current, reminders, reminderTimings: timings.length ? timings : current.reminderTimings, notificationsAsked: true };
        });
        showToast(timings.length ? `Reminder set for the ${label}` : `Reminder removed for the ${label}`);
      }),
    [requireAuth, showToast],
  );

  // Watchlist order (US-6.1): move up/down or drop at a new index. `listId` is "main" or a named list.
  const moveWatch = useCallback((coinId, toIndex, listId = "main") => {
    setData((current) => {
      const place = (ids) => {
        const list = ids.filter((id) => id !== coinId);
        list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, coinId);
        return list;
      };
      if (listId === "main") return { ...current, watchlist: place(current.watchlist) };
      return { ...current, lists: current.lists.map((list) => (list.id === listId ? { ...list, coinIds: place(list.coinIds) } : list)) };
    });
  }, []);

  // Remove with a 5 s Undo that restores the coin to its old position (US-P10.2).
  const removeWatch = useCallback(
    (coin, listId = "main") => {
      const ids = listId === "main" ? dataRef.current.watchlist : dataRef.current.lists.find((list) => list.id === listId)?.coinIds ?? [];
      const index = ids.indexOf(coin.id);
      if (index < 0) return;
      setData((current) =>
        listId === "main"
          ? { ...current, watchlist: current.watchlist.filter((id) => id !== coin.id) }
          : { ...current, lists: current.lists.map((list) => (list.id === listId ? { ...list, coinIds: list.coinIds.filter((id) => id !== coin.id) } : list)) },
      );
      showToast(`${coin.name} removed`, { label: "Undo", run: () => moveWatch(coin.id, index, listId) });
    },
    [moveWatch, showToast],
  );

  // Named watchlists (US-6.2): up to 9 besides Main, names up to 30 characters.
  const createList = useCallback(
    (name, coinIds = []) => {
      if (dataRef.current.lists.length >= MAX_LISTS - 1) {
        showToast(`You can have up to ${MAX_LISTS} watchlists. Delete one to add another.`);
        return null;
      }
      const list = { id: newId("list"), name: name.trim().slice(0, 30), coinIds };
      setData((current) => ({ ...current, lists: [...current.lists, list] }));
      showToast(`Created “${list.name}”`);
      return list.id;
    },
    [showToast],
  );
  const renameList = useCallback((id, name) => {
    setData((current) => ({ ...current, lists: current.lists.map((list) => (list.id === id ? { ...list, name: name.trim().slice(0, 30) } : list)) }));
  }, []);
  const deleteList = useCallback(
    (id) => {
      const index = dataRef.current.lists.findIndex((list) => list.id === id);
      if (index < 0) return;
      const removed = dataRef.current.lists[index];
      setData((current) => ({
        ...current,
        lists: current.lists.filter((list) => list.id !== id),
        settings: current.settings.watchlistList === id ? { ...current.settings, watchlistList: "main" } : current.settings,
      }));
      showToast(`Deleted “${removed.name}”`, {
        label: "Undo",
        run: () =>
          setData((current) => {
            if (current.lists.some((list) => list.id === id)) return current;
            const lists = [...current.lists];
            lists.splice(index, 0, removed);
            return { ...current, lists };
          }),
      });
    },
    [showToast],
  );
  // Add or remove one coin in one list; "main" is the classic watchlist.
  const setListMembership = useCallback(
    (coin, listId, member) => {
      requireAuth(`Sign in to save ${coin.name} to a watchlist`, () => {
        setData((current) => {
          const apply = (ids) => (member ? [...new Set([...ids, coin.id])] : ids.filter((id) => id !== coin.id));
          if (listId === "main") return { ...current, watchlist: apply(current.watchlist) };
          return { ...current, lists: current.lists.map((list) => (list.id === listId ? { ...list, coinIds: apply(list.coinIds) } : list)) };
        });
        const name = listId === "main" ? "Main" : dataRef.current.lists.find((list) => list.id === listId)?.name ?? "watchlist";
        showToast(member ? `${coin.name} added to ${name}` : `${coin.name} removed from ${name}`);
      });
    },
    [requireAuth, showToast],
  );

  // Search overlay and recent searches (US-2.5, US-P04.2).
  // `query` prefills the box (Not found opens search with the last path segment).
  const openSearch = useCallback((scope = "all", query = "") => setSearch((current) => ({ open: true, scope, query, opened: (current.opened ?? 0) + 1 })), []);
  const closeSearch = useCallback(() => setSearch((current) => ({ ...current, open: false })), []);
  const addRecentSearch = useCallback((query) => {
    const text = query.trim();
    if (text.length < 2) return;
    setData((current) => ({
      ...current,
      recentSearches: [text, ...current.recentSearches.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, 10),
    }));
  }, []);
  const removeRecentSearch = useCallback((query) => {
    setData((current) => ({ ...current, recentSearches: current.recentSearches.filter((item) => item !== query) }));
  }, []);
  const clearRecentSearches = useCallback(() => setData((current) => ({ ...current, recentSearches: [] })), []);

  // Portfolio transactions (US-6.3). Holdings are derived, never stored.
  const saveTransaction = useCallback(
    (transaction) => {
      const isNew = !transaction.id;
      setData((current) => ({
        ...current,
        transactions: isNew
          ? [...current.transactions, { ...transaction, id: newId("tx") }]
          : current.transactions.map((item) => (item.id === transaction.id ? transaction : item)),
      }));
      showToast(isNew ? "Transaction added" : "Transaction updated");
    },
    [showToast],
  );
  const deleteTransaction = useCallback(
    (id) => {
      setData((current) => ({ ...current, transactions: current.transactions.filter((item) => item.id !== id) }));
      showToast("Transaction deleted");
    },
    [showToast],
  );

  // Follow a fund with a digest frequency (US-5.4); null unfollows.
  const setFollow = useCallback(
    (fund, frequency) =>
      requireAuth(`Sign in to follow ${fund.name}`, () => {
        setData((current) => {
          const follows = { ...current.follows };
          if (frequency) follows[fund.id] = frequency;
          else delete follows[fund.id];
          return { ...current, follows };
        });
        const names = { instant: "Instant", daily: "Daily digest", weekly: "Weekly digest" };
        showToast(frequency ? `Following ${fund.name} · ${names[frequency]}` : `Unfollowed ${fund.name}`);
      }),
    [requireAuth, showToast],
  );

  const toggleFollowProject = useCallback(
    (project) => {
      const following = dataRef.current.followedProjects.includes(project);
      requireAuth(`Sign in to follow ${project}`, () => {
        setData((current) => ({
          ...current,
          followedProjects: following ? current.followedProjects.filter((name) => name !== project) : [...new Set([...current.followedProjects, project])],
        }));
        showToast(following ? `Unfollowed ${project}` : `Following ${project}`);
      });
    },
    [requireAuth, showToast],
  );

  // Saved Fundraising filters (US-5.2): max 10, renamable, deletable.
  const saveFilter = useCallback(
    (name, filters) => {
      if (dataRef.current.savedFilters.length >= 10) {
        showToast("You can save up to 10 filters.");
        return false;
      }
      setData((current) => ({ ...current, savedFilters: [{ id: newId("filter"), name, filters }, ...current.savedFilters] }));
      showToast(`Saved filter “${name}”`);
      return true;
    },
    [showToast],
  );
  const renameFilter = useCallback((id, name) => {
    setData((current) => ({ ...current, savedFilters: current.savedFilters.map((item) => (item.id === id ? { ...item, name } : item)) }));
  }, []);
  const deleteFilter = useCallback(
    (id) => {
      setData((current) => ({ ...current, savedFilters: current.savedFilters.filter((item) => item.id !== id) }));
      showToast("Saved filter deleted");
    },
    [showToast],
  );

  // --- Alerts and notifications (12-alerts.md) ---

  // Toast + browser notification, unless quiet hours are on and the alert doesn't bypass them (US-7.4).
  const deliver = useCallback(
    (notes) => {
      const quiet = inQuietHours(dataRef.current.settings.quietHours);
      notes.forEach((note) => {
        if (quiet && !note.bypassQuiet) return;
        showToast(note.title, { label: "View", run: () => navigate(note.path) });
        showBrowserNotification(note.title, note.detail);
      });
    },
    [navigate, showToast],
  );

  const addNotifications = useCallback((notes) => {
    setData((current) => ({ ...current, notifications: [...notes, ...current.notifications].slice(0, MAX_NOTIFICATIONS) }));
  }, []);

  // dataRef is updated synchronously so a second check before the next render can't fire the same alert twice.
  const checkPrices = useCallback(
    (coins) => {
      if (session.kind === "guest") return;
      const now = Date.now();
      const current = dataRef.current;
      const fired = [];
      const alerts = current.alerts.map((alert) => {
        const coin = coins.find((item) => item.id === alert.coinId);
        if (!alertTriggered(alert, coin, now)) return alert;
        fired.push({ ...alertNotification(alert, coin), id: newId("note"), at: now, read: false, bypassQuiet: alert.bypassQuiet });
        return { ...alert, lastFired: now, active: alert.repeat === "recurring" };
      });
      if (!fired.length) return;
      const byId = new Map(alerts.map((alert) => [alert.id, alert]));
      dataRef.current = { ...current, alerts };
      setData((latest) => ({ ...latest, alerts: latest.alerts.map((alert) => byId.get(alert.id) ?? alert) }));
      addNotifications(fired);
      deliver(fired);
    },
    [session.kind, addNotifications, deliver],
  );

  const checkClock = useCallback(
    (now, coins = []) => {
      if (session.kind === "guest") return;
      const current = dataRef.current;
      const notes = [];
      const reminders = { ...current.reminders };
      let changed = false;
      Object.entries(current.reminders).forEach(([id, reminder]) => {
        if (reminder.paused) return;
        const date = new Date(reminder.date).getTime();
        const due = reminder.timings.filter((timing) => !(reminder.fired ?? []).includes(timing) && now >= date - (reminderOffsets[timing] ?? 0));
        if (!due.length) return;
        changed = true;
        reminders[id] = { ...reminder, fired: [...(reminder.fired ?? []), ...due] };
        if (now >= date) return; // Missed while the app was closed: mark done without a stale alert.
        const what = reminder.kind === "sale" ? `${reminder.symbol} token sale starts` : `${reminder.symbol} unlock`;
        const timing = due.includes("1h") ? "in 1 hour" : "in 24 hours";
        notes.push({
          id: newId("note"), kind: reminder.kind, title: `${what} ${timing}`, detail: `${reminder.name} · ${formatDate(date)}`,
          path: reminder.kind === "sale" ? "/token-sales" : "/unlocks", at: now, read: false, bypassQuiet: false,
        });
      });

      // Weekly digest every Monday 08:00 local (US-7.3). A new account starts the clock instead of getting one at once.
      let { lastDigest } = current;
      const digestAt = digestTime(new Date(now));
      if (now >= digestAt && lastDigest < digestAt) {
        if (lastDigest > 0 && current.settings.weeklyDigest) {
          notes.push({
            id: newId("note"), kind: "digest", title: "Your weekly digest",
            detail: current.settings.ai.digestSummary
              ? `✦ Generated summary: ${digestRecap(current.watchlist, coins)}`
              : `${current.watchlist.length} coins on your watchlist · ${Object.keys(current.follows).length} funds followed`,
            path: "/watchlist", at: now, read: false, bypassQuiet: false,
          });
        }
        lastDigest = digestAt;
        changed = true;
      }

      if (!changed) return;
      dataRef.current = { ...current, reminders, lastDigest };
      setData((latest) => ({
        ...latest,
        lastDigest,
        reminders: Object.fromEntries(Object.entries(latest.reminders).map(([id, item]) => [id, reminders[id] ? { ...item, fired: reminders[id].fired } : item])),
      }));
      if (notes.length) {
        addNotifications(notes);
        deliver(notes);
      }
    },
    [session.kind, addNotifications, deliver],
  );

  const saveAlert = useCallback(
    (alert) => {
      const isNew = !alert.id;
      setData((current) => ({
        ...current,
        notificationsAsked: true,
        alerts: isNew
          ? [{ ...alert, id: newId("alert"), active: true, lastFired: 0, created: Date.now() }, ...current.alerts]
          : current.alerts.map((item) => (item.id === alert.id ? { ...item, ...alert, active: true, lastFired: 0 } : item)),
      }));
      showToast(isNew ? "Alert set" : "Alert updated");
    },
    [showToast],
  );
  const toggleAlert = useCallback((id) => {
    setData((current) => ({ ...current, alerts: current.alerts.map((item) => (item.id === id ? { ...item, active: !item.active, lastFired: 0 } : item)) }));
  }, []);
  const deleteAlert = useCallback(
    (id) => {
      setData((current) => ({ ...current, alerts: current.alerts.filter((item) => item.id !== id) }));
      showToast("Alert deleted");
    },
    [showToast],
  );
  const toggleReminder = useCallback((id) => {
    setData((current) => {
      const reminder = current.reminders[id];
      return reminder ? { ...current, reminders: { ...current.reminders, [id]: { ...reminder, paused: !reminder.paused } } } : current;
    });
  }, []);
  const deleteReminder = useCallback(
    (id) => {
      setData((current) => {
        const reminders = { ...current.reminders };
        delete reminders[id];
        return { ...current, reminders };
      });
      showToast("Reminder deleted");
    },
    [showToast],
  );
  const markRead = useCallback((id) => {
    setData((current) => ({ ...current, notifications: current.notifications.map((note) => (note.id === id && !note.read ? { ...note, read: true } : note)) }));
  }, []);
  const markAllRead = useCallback(() => {
    setData((current) => ({ ...current, notifications: current.notifications.map((note) => (note.read ? note : { ...note, read: true })) }));
  }, []);
  const markAsked = useCallback(() => setData((current) => ({ ...current, notificationsAsked: true })), []);

  // Onboarding (US-1.3): picked coins join the watchlist; picked sectors steer Home's funding and sales.
  const completeOnboarding = useCallback((picks) => {
    setData((current) => ({
      ...current,
      onboarded: true,
      interests: picks ?? current.interests,
      watchlist: picks?.coins.length ? [...new Set([...picks.coins, ...current.watchlist])] : current.watchlist,
    }));
  }, []);

  // --- Accounts (13–16 specs) ---

  const [accessibilityOpen, setAccessibilityOpen] = useState(false);

  const enterAccount = useCallback((loaded) => {
    window.clearTimeout(sync.current.retry);
    sync.current = { userId: loaded.session.userId, snapshot: loaded.snapshot, running: null, again: false, warned: false, retry: 0 };
    dataRef.current = loaded.data;
    setData(loaded.data);
    setSession(loaded.session);
    setAuthPrompt(null);
  }, []);

  const resetToGuest = useCallback(() => {
    window.clearTimeout(sync.current.retry);
    sync.current = { userId: null, snapshot: null, running: null, again: false, warned: false, retry: 0 };
    pendingAction.current = null;
    setAuthPrompt(null);
    setSearch({ open: false, scope: "all" });
    setAccessibilityOpen(false);
    const guest = { ...guestData(), onboarded: true };
    dataRef.current = guest;
    setData(guest);
    setSession({ kind: "guest" });
  }, []);

  // Restore a saved Supabase session. Pages wait for this so a signed-in refresh doesn't
  // flash the guest view; a slow network falls back to guest after RESTORE_TIMEOUT_MS.
  const [ready, setReady] = useState(!supabase);
  useEffect(() => {
    if (!supabase) return undefined;
    let live = true;
    const timer = window.setTimeout(() => {
      live = false;
      setReady(true);
    }, RESTORE_TIMEOUT_MS);
    (async () => {
      const { data: { session: auth } } = await supabase.auth.getSession();
      if (!auth || !live) return;
      const loaded = await loadAccount(auth.user);
      if (!live) return;
      if (loaded.status === "deleted") {
        await supabase.auth.signOut({ scope: "local" });
        return;
      }
      if (loaded.status !== "ok") {
        notifyRef.current?.("We couldn't load your account. Check your connection and refresh to try again.");
        return;
      }
      // Each app load counts as a visit (feedback prompt after the 5th, 20-feedback.md).
      enterAccount({ ...loaded, data: { ...loaded.data, visits: loaded.data.visits + 1 } });
    })()
      .catch(() => notifyRef.current?.("We couldn't load your account. Check your connection and refresh to try again."))
      .finally(() => {
        window.clearTimeout(timer);
        if (live) setReady(true);
      });
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [enterAccount]);

  // Logging out in another tab signs this one out too (US-P15.4); a confirmed email change
  // updates the address shown. Supabase calls must not be awaited inside this callback.
  const sessionRef = useRef(session);
  useLayoutEffect(() => {
    sessionRef.current = session;
  }, [session]);
  useEffect(() => {
    if (!supabase) return undefined;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, auth) => {
      if (event === "SIGNED_OUT" && sessionRef.current.kind === "user") window.setTimeout(resetToGuest, 0);
      if (event === "USER_UPDATED" && auth?.user?.email) {
        setSession((current) => (current.kind === "user" && current.email !== auth.user.email ? { ...current, email: auth.user.email } : current));
      }
    });
    return () => subscription.unsubscribe();
  }, [resetToGuest]);

  // Guest stars, history and picks carry over into the new account (US-P13.1); demo data never does.
  const signUp = useCallback(
    async ({ name, email, password }) => {
      if (!supabase) return { error: "unavailable" };
      try {
        const { data: result, error } = await supabase.auth.signUp({
          email: normalizeEmail(email),
          password,
          options: { data: { name: name.trim() } },
        });
        if (error) return { error: authErrorKind(error) };
        // With "Confirm email" switched on in Supabase there's no session until the link is opened.
        if (!result.session) return { error: "confirm" };
        // The sign-up trigger has created the profile, default settings and Free plan.
        const loaded = await loadAccount(result.user);
        if (loaded.status !== "ok") return { error: "network" };
        const guest = session.kind === "guest" ? dataRef.current : guestData();
        enterAccount({
          ...loaded,
          data: {
            ...loaded.data,
            settings: guest.settings,
            watchlist: guest.watchlist,
            recentCoins: guest.recentCoins,
            recentSearches: guest.recentSearches,
            interests: guest.interests,
            onboarded: guest.onboarded,
          },
        });
        showToast("Account created");
        return { ok: true };
      } catch {
        return { error: "network" };
      }
    },
    [session.kind, enterAccount, showToast],
  );

  // Never says whether the email or the password was wrong; a deleted account is only
  // revealed after the correct password. Its Auth session is kept so the user can choose
  // Remove my data (removeDeletedAccountData) or leave (leaveDeletedAccount).
  const logIn = useCallback(
    async (email, password) => {
      if (!supabase) return { error: "unavailable" };
      const lock = lockState();
      if (lock.lockedUntil > Date.now()) return { error: "locked", until: lock.lockedUntil };
      try {
        const { data: result, error } = await supabase.auth.signInWithPassword({ email: normalizeEmail(email), password });
        if (error) {
          const kind = authErrorKind(error);
          if (kind !== "invalid") return { error: kind };
          const next = recordFailure();
          return next.lockedUntil > Date.now() ? { error: "locked", until: next.lockedUntil } : { error: "invalid" };
        }
        clearFailures();
        const loaded = await loadAccount(result.user);
        if (loaded.status === "deleted") return { error: "deleted" };
        if (loaded.status !== "ok") {
          await supabase.auth.signOut({ scope: "local" });
          return { error: "network" };
        }
        enterAccount(loaded);
        showToast(`Welcome back, ${loaded.session.name.split(" ")[0]}`);
        return { ok: true };
      } catch {
        return { error: "network" };
      }
    },
    [enterAccount, showToast],
  );

  // Data removal (US-P17.2) for the deleted account just logged in to. Returns { ok, ticketId } | { error }.
  const removeDeletedAccountData = useCallback(async () => {
    try {
      const { data: ticketId, error } = await supabase.rpc("erase_my_data");
      if (error) return { error: "network" };
      await supabase.auth.signOut({ scope: "local" }).catch(() => {});
      return { ok: true, ticketId };
    } catch {
      return { error: "network" };
    }
  }, []);
  const leaveDeletedAccount = useCallback(() => {
    supabase?.auth.signOut({ scope: "local" }).catch(() => {});
  }, []);

  // Pending changes are saved first, then this browser's session ends (other devices stay signed in).
  // A second call (StrictMode re-running an effect, two tabs) finds no account and does nothing.
  const logOut = useCallback(async ({ discard = false } = {}) => {
    const state = sync.current;
    if (!state.userId) return { ok: true };
    if (!discard) {
      const result = await flush();
      if (!result.ok || sync.current !== state) return { ok: false, error: result.error };
    }
    if (sync.current !== state) return { ok: false, stale: true };
    resetToGuest();
    try {
      const result = await supabase?.auth.signOut({ scope: "local" });
      if (result?.error) throw result.error;
      return { ok: true };
    } catch (error) {
      notifyRef.current?.("Couldn't finish signing out. Refresh the page to make sure you're signed out.");
      return { ok: false, error };
    }
  }, [flush, resetToGuest]);

  // Checks the current password by signing in again. Returns null when it's right, or an error kind.
  const confirmPassword = useCallback(
    async (password) => {
      const { error } = await supabase.auth.signInWithPassword({ email: session.email, password });
      if (!error) return null;
      return authErrorKind(error) === "invalid" ? "wrong" : authErrorKind(error);
    },
    [session.email],
  );

  // Returns { ok, emailPending } | { error: "exists" | "network" | … }. An email change waits for
  // the confirmation link when Supabase's "Secure email change" is on.
  const updateProfile = useCallback(
    async ({ name, email }) => {
      if (session.kind !== "user") {
        setSession((current) => ({ ...current, name: name.trim() }));
        return { ok: true };
      }
      try {
        const nextName = name.trim();
        if (nextName !== session.name) {
          const { error } = await supabase.from("users").update({ name: nextName }).eq("id", session.userId);
          if (error) return { error: "network" };
        }
        const nextEmail = normalizeEmail(email);
        let emailPending = false;
        if (nextEmail !== session.email) {
          const { data: result, error } = await supabase.auth.updateUser({ email: nextEmail });
          if (error) return { error: authErrorKind(error) };
          emailPending = result.user?.email !== nextEmail;
        }
        setSession((current) => ({ ...current, name: nextName, email: emailPending ? current.email : nextEmail }));
        return { ok: true, emailPending };
      } catch {
        return { error: "network" };
      }
    },
    [session],
  );

  const changePassword = useCallback(
    async (currentPassword, nextPassword) => {
      try {
        const wrong = await confirmPassword(currentPassword);
        if (wrong) return { error: wrong };
        const { error } = await supabase.auth.updateUser({ password: nextPassword });
        return error ? { error: authErrorKind(error) } : { ok: true };
      } catch {
        return { error: "network" };
      }
    },
    [confirmPassword],
  );

  const setBilling = useCallback(
    (update) => {
      setData((current) => ({ ...current, billing: typeof update === "function" ? update(current.billing) : update }));
    },
    [],
  );

  // Deleting removes access only; data stays until the user removes it (US-9.6, US-P17.2).
  const deleteAccount = useCallback(
    async (password) => {
      try {
        const wrong = await confirmPassword(password);
        if (wrong) return { error: wrong };
        const { error } = await supabase.rpc("delete_my_account");
        if (error) return { error: "network" };
        // /account-deleted ends the session after Settings unmounts.
        setSession((current) => ({ ...current, deleted: true }));
        return { ok: true };
      } catch {
        return { error: "network" };
      }
    },
    [confirmPassword],
  );

  const clearRecentCoins = useCallback(() => setData((current) => ({ ...current, recentCoins: [] })), []);

  // --- Support, feedback, promotions, affiliate (17–28 specs) ---

  // Last uncaught error, for "technical details" in bug reports (19-report-issue.md).
  const lastError = useRef(null);
  useEffect(() => {
    const onError = (event) => {
      lastError.current = String(event.message ?? event.reason?.message ?? event.reason ?? "Unknown error").slice(0, 200);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onError);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onError);
    };
  }, []);
  const getLastError = useCallback(() => lastError.current, []);

  // Ticket ids: #CPA-1042… for tickets, #BUG-0217… for issue reports. Guests and users get
  // theirs from the database sequence; the demo numbers its own in memory.
  const demoTicketId = useCallback((kind) => {
    const issue = kind === "issue";
    const count = dataRef.current.tickets.filter((item) => (item.kind === "issue") === issue).length;
    return issue ? `BUG-${String(217 + count).padStart(4, "0")}` : `CPA-${1042 + count}`;
  }, []);
  // Returns the saved ticket, or null if it couldn't be sent.
  const addTicket = useCallback(
    async (ticket) => {
      if (session.kind !== "demo" && !supabase) return null;
      let saved;
      if (session.kind === "demo") {
        saved = { status: "Received", ...ticket, id: demoTicketId(ticket.kind), date: new Date().toISOString() };
      } else {
        try {
          saved = await sendTicket(session.kind === "user" ? session.userId : null, ticket);
        } catch {
          return null;
        }
      }
      dataRef.current = { ...dataRef.current, tickets: [saved, ...dataRef.current.tickets] };
      setData((latest) => ({ ...latest, tickets: [saved, ...latest.tickets] }));
      return saved;
    },
    [session, demoTicketId],
  );

  // Returns false if it couldn't be sent.
  const addFeedback = useCallback(
    async (entry) => {
      if (session.kind !== "demo" && !supabase) return false;
      if (session.kind !== "demo" && supabase) {
        try {
          await sendFeedback(session.kind === "user" ? session.userId : null, entry);
        } catch {
          return false;
        }
      }
      setData((current) => ({ ...current, feedback: [{ ...entry, date: new Date().toISOString() }, ...current.feedback], feedbackPromptDismissed: Date.now() }));
      return true;
    },
    [session],
  );
  const dismissFeedbackPrompt = useCallback(() => setData((current) => ({ ...current, feedbackPromptDismissed: Date.now() })), []);

  // Promo codes (21-promotions.md): returns { ok, promo } or { error: "invalid" | "new-only" | "points" }.
  const applyPromo = useCallback((code) => {
    const current = dataRef.current;
    const promo = findPromo(code);
    if (!promo || promo === POINTS_PROMO || promoStatus(promo) !== "active") return { error: "invalid" };
    if (promo.newAccountsOnly && session.kind === "user") {
      const created = new Date(session.createdAt ?? 0).getTime();
      if (Date.now() - created > 30 * 86_400_000) return { error: "new-only" };
    }
    setData((latest) => ({ ...latest, billing: { ...latest.billing, promo: { code: promo.code, appliedAt: new Date().toISOString() } } }));
    showToast(`${promo.code} applied`);
    return { ok: true, promo, previous: current.billing.promo?.code ?? null };
  }, [session, showToast]);
  const redeemPoints = useCallback(() => {
    const current = dataRef.current;
    if (pointsFor(current, session) < POINTS_PROMO.cost) return { error: "points" };
    setData((latest) => ({
      ...latest,
      pointsSpent: latest.pointsSpent + POINTS_PROMO.cost,
      billing: { ...latest.billing, promo: { code: POINTS_PROMO.code, appliedAt: new Date().toISOString() } },
    }));
    showToast(`${POINTS_PROMO.code} applied · ${POINTS_PROMO.cost} points used`);
    return { ok: true };
  }, [session, showToast]);

  const joinAffiliate = useCallback((payoutMethod) => {
    const base = (session.name ?? "cpa").toLowerCase().replace(/[^a-z]/g, "").slice(0, 8) || "cpa";
    const code = `${base}-${Math.random().toString(36).slice(2, 6)}`;
    setData((current) => ({ ...current, affiliate: { joinedAt: new Date().toISOString(), code, payoutMethod } }));
    showToast("You've joined the affiliate program");
  }, [session.name, showToast]);
  const setAffiliatePayout = useCallback((payoutMethod) => {
    setData((current) => (current.affiliate ? { ...current, affiliate: { ...current.affiliate, payoutMethod } } : current));
  }, []);

  const updateSettings = useCallback((patch) => {
    setData((current) => ({ ...current, settings: { ...current.settings, ...patch } }));
  }, []);

  const updateMarketSettings = useCallback((patch) => {
    setData((current) => ({
      ...current,
      settings: { ...current.settings, market: { ...current.settings.market, ...patch } },
    }));
  }, []);

  const value = useMemo(
    () => ({
      session,
      watchlist: data.watchlist,
      settings: data.settings,
      recentCoins: data.recentCoins,
      recentSearches: data.recentSearches,
      transactions: data.transactions,
      search,
      openSearch,
      closeSearch,
      addRecentSearch,
      removeRecentSearch,
      clearRecentSearches,
      moveWatch,
      removeWatch,
      lists: data.lists,
      createList,
      renameList,
      deleteList,
      setListMembership,
      saveTransaction,
      deleteTransaction,
      dismissToast,
      reminders: data.reminders,
      reminderTimings: data.reminderTimings,
      notificationsAsked: data.notificationsAsked,
      follows: data.follows,
      followedProjects: data.followedProjects,
      savedFilters: data.savedFilters,
      setFollow,
      toggleFollowProject,
      saveFilter,
      renameFilter,
      deleteFilter,
      addRecentCoin,
      castVote,
      voteFor,
      setReminder,
      authPrompt,
      // keepPending: the guest went to Log in / Create account; finish their action after.
      dismissAuthPrompt: (keepPending = false) => {
        if (!keepPending) pendingAction.current = null;
        setAuthPrompt(null);
      },
      requireAuth,
      startDemo,
      endDemo,
      toggleWatch,
      updateSettings,
      updateMarketSettings,
      toasts,
      showToast,
      alerts: data.alerts,
      notifications: data.notifications,
      unreadCount: data.notifications.filter((note) => !note.read).length,
      saveAlert,
      toggleAlert,
      deleteAlert,
      toggleReminder,
      deleteReminder,
      markRead,
      markAllRead,
      markAsked,
      onboarded: data.onboarded,
      interests: data.interests,
      completeOnboarding,
      billing: data.billing,
      setBilling,
      signUp,
      logIn,
      removeDeletedAccountData,
      leaveDeletedAccount,
      logOut,
      updateProfile,
      changePassword,
      deleteAccount,
      clearRecentCoins,
      accessibilityOpen,
      setAccessibilityOpen,
      exportData: () => data,
      tickets: data.tickets,
      visits: data.visits,
      feedbackPromptDismissed: data.feedbackPromptDismissed,
      affiliate: data.affiliate,
      points: pointsFor(data, session),
      getLastError,
      addTicket,
      addFeedback,
      dismissFeedbackPrompt,
      applyPromo,
      redeemPoints,
      joinAffiliate,
      setAffiliatePayout,
    }),
    [session, data, authPrompt, search, requireAuth, startDemo, endDemo, toggleWatch, moveWatch, removeWatch, createList, renameList, deleteList, setListMembership, addRecentCoin, castVote, voteFor, setReminder, setFollow, toggleFollowProject, saveFilter, renameFilter, deleteFilter, openSearch, closeSearch, addRecentSearch, removeRecentSearch, clearRecentSearches, saveTransaction, deleteTransaction, updateSettings, updateMarketSettings, toasts, showToast, dismissToast, saveAlert, toggleAlert, deleteAlert, toggleReminder, deleteReminder, markRead, markAllRead, markAsked, completeOnboarding, setBilling, signUp, logIn, removeDeletedAccountData, leaveDeletedAccount, logOut, updateProfile, changePassword, deleteAccount, clearRecentCoins, accessibilityOpen, getLastError, addTicket, addFeedback, dismissFeedbackPrompt, applyPromo, redeemPoints, joinAffiliate, setAffiliatePayout],
  );

  return (
    <AppContext.Provider value={value}>
      <MarketProvider autoRefresh={data.settings.autoRefresh}>
        <AlertWatcher onPrices={checkPrices} onClock={checkClock} />
        {ready ? children : <div className="app-restoring" aria-busy="true" aria-label="Loading your account" />}
      </MarketProvider>
    </AppContext.Provider>
  );
}
