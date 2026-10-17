import { createContext, useContext } from "react";

export const defaultSettings = {
  currency: "USD",
  theme: "dark",
  colors: "standard",
  autoRefresh: true,
  stopAnimations: false,
  hideBalances: false,
  watchlistSort: "mine",
  market: { view: "coins", sort: "rank", dir: "asc", category: "All", density: "simple", gainersWindow: "24h" },
  unlocks: { range: "week", watchlistOnly: false, minOne: false, sort: "share", view: "list" },
  fundraising: { sectors: [], types: [], minAmount: 0, maxAmount: null, days: 90, investor: "", sort: "newest" },
};

export const AppContext = createContext(null);
export const MarketContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export function useMarket() {
  return useContext(MarketContext);
}

// Shape guards for records read back from storage (or applied from a saved filter):
// anything malformed falls back to the default instead of breaking a page.
const strings = (value) => (Array.isArray(value) ? value.filter((item) => typeof item === "string") : []);
const number = (value, fallback) => (Number.isFinite(value) ? value : fallback);

export function normalizeFundraisingFilters(value) {
  const base = defaultSettings.fundraising;
  const v = value && typeof value === "object" ? value : {};
  return {
    sectors: strings(v.sectors),
    types: strings(v.types),
    minAmount: Math.max(0, number(v.minAmount, base.minAmount)),
    maxAmount: Number.isFinite(v.maxAmount) && v.maxAmount > 0 ? v.maxAmount : null,
    days: [0, 7, 30, 90].includes(v.days) ? v.days : base.days,
    investor: typeof v.investor === "string" ? v.investor : "",
    sort: v.sort === "amount" ? "amount" : "newest",
  };
}

export function normalizeUnlockPrefs(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    range: ["today", "week", "month", "custom"].includes(v.range) ? v.range : "week",
    watchlistOnly: v.watchlistOnly === true,
    minOne: v.minOne === true,
    sort: ["share", "usd", "date"].includes(v.sort) ? v.sort : "share",
    view: v.view === "calendar" ? "calendar" : "list",
  };
}
