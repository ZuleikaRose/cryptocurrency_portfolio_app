import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AppContext, MarketContext, defaultSettings, normalizeFundraisingFilters, normalizeUnlockPrefs, useMarket } from "./context.js";
import { initialCoins } from "../data/coins.js";
import { researchFor } from "../data/research.js";
import { MAX_NOTIFICATIONS, alertNotification, alertTriggered, alertTypes, digestTime, reminderOffsets } from "../lib/alerts.js";
import { formatDate } from "../lib/format.js";
import { inQuietHours, showBrowserNotification } from "../lib/notify.js";
import { keys, readJson, writeJson } from "../lib/storage.js";

// Session kinds: "guest" and "demo" live in memory only (reset on refresh);
// "user" is a signed-up account whose data is saved to localStorage.

const emptyData = {
  watchlist: [],
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
};
const guestData = () => ({ ...emptyData, watchlist: ["bitcoin"] });
// Demo portfolio from 11-portfolio.md: totals $36,058.99, +28.26% all-time at sample prices.
const demoTransactions = [
  { id: "demo-btc", coinId: "bitcoin", type: "buy", amount: 0.25, price: 52300, fee: 0, date: "2025-03-10T15:00:00.000Z", note: "" },
  { id: "demo-eth", coinId: "ethereum", type: "buy", amount: 3.2, price: 2950, fee: 0, date: "2025-06-02T15:00:00.000Z", note: "" },
  { id: "demo-sol", coinId: "solana", type: "buy", amount: 40, price: 140, fee: 0, date: "2025-08-19T15:00:00.000Z", note: "" },
];
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
  transactions: demoTransactions,
  onboarded: true,
  ...demoAlertData(),
});
let idCounter = 0;
const newId = (prefix) => `${prefix}-${Date.now().toString(36)}-${(idCounter += 1)}`;

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

function loadInitial() {
  // Saved data may be missing or hand-edited; fall back to a guest session rather than crash.
  const saved = readJson(keys.session);
  const accounts = readJson(keys.accounts, []);
  const account = saved?.userId && Array.isArray(accounts) ? accounts.find((item) => item?.id === saved.userId) : null;
  if (!account) return { session: { kind: "guest" }, data: guestData() };
  const rawStored = readJson(keys.user(account.id), {});
  const stored = rawStored && typeof rawStored === "object" && !Array.isArray(rawStored) ? rawStored : {};
  ["watchlist", "recentCoins", "recentSearches", "transactions", "followedProjects", "savedFilters", "alerts", "notifications"].forEach((key) => {
    if (!Array.isArray(stored[key])) delete stored[key];
  });
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
    session: { kind: "user", userId: account.id, name: account.name, email: account.email },
    data: {
      ...emptyData,
      ...stored,
      settings: {
        ...defaultSettings,
        ...stored.settings,
        market: { ...defaultSettings.market, ...stored.settings?.market },
        unlocks: normalizeUnlockPrefs(stored.settings?.unlocks),
        fundraising: normalizeFundraisingFilters(stored.settings?.fundraising),
        quietHours: { ...defaultSettings.quietHours, ...(stored.settings?.quietHours && typeof stored.settings.quietHours === "object" ? stored.settings.quietHours : {}) },
      },
      reminders: Object.fromEntries(
        Object.entries(stored.reminders ?? {})
          .filter(([, item]) => item && Array.isArray(item.timings) && typeof item.symbol === "string" && !Number.isNaN(new Date(item.date).getTime()))
          .map(([id, item]) => [id, { ...item, fired: Array.isArray(item.fired) ? item.fired : [], paused: item.paused === true }]),
      ),
      follows: Object.fromEntries(Object.entries(stored.follows ?? {}).filter(([, frequency]) => ["instant", "daily", "weekly"].includes(frequency))),
    },
  };
}

const TICK_MS = 30_000;

function MarketProvider({ autoRefresh, children }) {
  const [coins, setCoins] = useState(initialCoins);
  const [lastUpdated, setLastUpdated] = useState(() => Date.now());
  const [tick, setTick] = useState(0);
  const [flashes, setFlashes] = useState({});

  const coinsRef = useRef(coins);

  // Simulated feed: nudge every price a little; stablecoins barely move.
  const refresh = useCallback(() => {
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

  useEffect(() => {
    if (!autoRefresh) return undefined;
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [autoRefresh, refresh]);

  const value = useMemo(() => ({ coins, lastUpdated, tick, flashes, refresh }), [coins, lastUpdated, tick, flashes, refresh]);
  return <MarketContext.Provider value={value}>{children}</MarketContext.Provider>;
}

// Runs alert checks while the app is open (12-alerts.md): price alerts on every
// price tick, reminders and the weekly digest on a 30 s clock.
const CLOCK_MS = 30_000;
function AlertWatcher({ onPrices, onClock }) {
  const { coins } = useMarket();
  useEffect(() => {
    onPrices(coins);
  }, [coins, onPrices]);
  useEffect(() => {
    onClock(Date.now());
    const id = window.setInterval(() => onClock(Date.now()), CLOCK_MS);
    return () => window.clearInterval(id);
  }, [onClock]);
  return null;
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
    const action = pendingAction.current;
    pendingAction.current = null;
    action();
  }, [session.kind]);

  // Persist signed-up accounts only. If the browser refuses (storage full or blocked),
  // say so once instead of failing silently.
  const notifyRef = useRef(null);
  const saveWarned = useRef(false);
  useEffect(() => {
    if (session.kind !== "user") return;
    const stored = readJson(keys.user(session.userId), {}) ?? {};
    const saved = writeJson(keys.user(session.userId), { ...stored, ...data });
    if (!saved && !saveWarned.current) {
      saveWarned.current = true;
      notifyRef.current?.("Couldn't save your changes on this device. They'll be lost when you close the tab.");
    }
  }, [session, data]);

  // Reflect display settings on <html> so CSS tokens can respond.
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = data.settings.theme === "system"
      ? (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark")
      : data.settings.theme;
    root.dataset.colors = data.settings.colors;
    root.dataset.motion = data.settings.stopAnimations ? "off" : "on";
  }, [data.settings.theme, data.settings.colors, data.settings.stopAnimations]);

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
        pendingAction.current = action;
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
    setData(guestData());
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

  // Watchlist order (US-6.1): move up/down or drop at a new index.
  const moveWatch = useCallback((coinId, toIndex) => {
    setData((current) => {
      const list = current.watchlist.filter((id) => id !== coinId);
      list.splice(Math.max(0, Math.min(toIndex, list.length)), 0, coinId);
      return { ...current, watchlist: list };
    });
  }, []);

  // Remove with a 5 s Undo that restores the coin to its old position (US-P10.2).
  const removeWatch = useCallback(
    (coin) => {
      const index = dataRef.current.watchlist.indexOf(coin.id);
      if (index < 0) return;
      setData((current) => ({ ...current, watchlist: current.watchlist.filter((id) => id !== coin.id) }));
      showToast(`${coin.name} removed`, { label: "Undo", run: () => moveWatch(coin.id, index) });
    },
    [moveWatch, showToast],
  );

  // Search overlay and recent searches (US-2.5, US-P04.2).
  const openSearch = useCallback((scope = "all") => setSearch({ open: true, scope }), []);
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
    (now) => {
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
        if (lastDigest > 0) {
          notes.push({
            id: newId("note"), kind: "digest", title: "Your weekly digest",
            detail: `${current.watchlist.length} coins on your watchlist · ${Object.keys(current.follows).length} funds followed`,
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
      dismissAuthPrompt: () => {
        pendingAction.current = null;
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
    }),
    [session, data, authPrompt, search, requireAuth, startDemo, endDemo, toggleWatch, moveWatch, removeWatch, addRecentCoin, castVote, voteFor, setReminder, setFollow, toggleFollowProject, saveFilter, renameFilter, deleteFilter, openSearch, closeSearch, addRecentSearch, removeRecentSearch, clearRecentSearches, saveTransaction, deleteTransaction, updateSettings, updateMarketSettings, toasts, showToast, dismissToast, saveAlert, toggleAlert, deleteAlert, toggleReminder, deleteReminder, markRead, markAllRead, markAsked, completeOnboarding],
  );

  return (
    <AppContext.Provider value={value}>
      <MarketProvider autoRefresh={data.settings.autoRefresh}>
        <AlertWatcher onPrices={checkPrices} onClock={checkClock} />
        {children}
      </MarketProvider>
    </AppContext.Provider>
  );
}
