import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppContext, MarketContext, defaultSettings } from "./context.js";
import { initialCoins } from "../data/coins.js";
import { keys, readJson, writeJson } from "../lib/storage.js";

// Session kinds: "guest" and "demo" live in memory only (reset on refresh);
// "user" is a signed-up account whose data is saved to localStorage.

const guestData = () => ({ watchlist: ["bitcoin"], settings: defaultSettings });
const demoData = () => ({ watchlist: ["bitcoin", "ethereum", "solana", "arbitrum"], settings: defaultSettings });

function loadInitial() {
  const saved = readJson(keys.session);
  const account = saved?.userId && (readJson(keys.accounts, []) ?? []).find((item) => item.id === saved.userId);
  if (!account) return { session: { kind: "guest" }, data: guestData() };
  const stored = readJson(keys.user(account.id), {}) ?? {};
  return {
    session: { kind: "user", userId: account.id, name: account.name, email: account.email },
    data: {
      watchlist: stored.watchlist ?? [],
      settings: { ...defaultSettings, ...stored.settings, market: { ...defaultSettings.market, ...stored.settings?.market } },
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

export function AppProvider({ children }) {
  const [initial] = useState(loadInitial);
  const [session, setSession] = useState(initial.session);
  const [data, setData] = useState(initial.data);
  const [authPrompt, setAuthPrompt] = useState(null);
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);
  const dataRef = useRef(data);
  const pendingAction = useRef(null);

  // Keep a ref to the latest data so deferred actions (run after sign-in) see current state.
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Complete the action a guest started once they have a session (US-1.1).
  useEffect(() => {
    if (session.kind === "guest" || !pendingAction.current) return;
    const action = pendingAction.current;
    pendingAction.current = null;
    action();
  }, [session.kind]);

  // Persist signed-up accounts only.
  useEffect(() => {
    if (session.kind !== "user") return;
    const stored = readJson(keys.user(session.userId), {}) ?? {};
    writeJson(keys.user(session.userId), { ...stored, watchlist: data.watchlist, settings: data.settings });
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

  const showToast = useCallback((message) => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((current) => [...current.slice(-1), { id, message }]);
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4000);
  }, []);

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
    }),
    [session, data, authPrompt, requireAuth, startDemo, endDemo, toggleWatch, updateSettings, updateMarketSettings, toasts, showToast],
  );

  return (
    <AppContext.Provider value={value}>
      <MarketProvider autoRefresh={data.settings.autoRefresh}>{children}</MarketProvider>
    </AppContext.Provider>
  );
}
