import { createContext, useContext } from "react";

export const defaultSettings = {
  language: "en", // lib/i18n.js
  currency: "USD",
  theme: "dark",
  colors: "standard",
  autoRefresh: true,
  stopAnimations: false,
  hideBalances: false,
  watchlistSort: "mine",
  watchlistList: "main",
  quietHours: { enabled: false, start: "22:00", end: "07:00" },
  weeklyDigest: true,
  autoAdvance: false,
  chartRange: "1M",
  chartSummaries: false,
  analytics: false,
  ai: { explainMetric: true, similarCoins: true, digestSummary: false },
  a11y: {
    profiles: [],
    textSize: 100,
    font: "default",
    lineHeight: 0,
    letterSpacing: 0,
    align: "default",
    contrast: "default",
    saturation: "default",
    highlightLinks: false,
    highlightHeadings: false,
    strongFocus: false,
    bigCursor: false,
    readingGuide: false,
    hideImages: false,
    summarySize: "M",
  },
  market: { view: "coins", sort: "rank", dir: "asc", category: "All", density: "simple", gainersWindow: "24h" },
  unlocks: { range: "week", watchlistOnly: false, minOne: false, sort: "share", view: "list" },
  fundraising: { sectors: [], types: [], minAmount: 0, maxAmount: null, days: 90, investor: "", sort: "newest" },
  portfolio: { range: "1M", sort: "value", taxMethod: "fifo" }, // clarification 35
  coinMarkets: { sort: "volume", dir: "desc" }, // Coin detail › Markets (clarification 37)
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

// Portfolio chart range, holdings sort and tax-lot method (clarification 35, journey rule 2).
export function normalizePortfolioPrefs(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    range: ["24h", "7D", "1M", "3M", "1Y", "ALL"].includes(v.range) ? v.range : "1M",
    sort: ["value", "pnl", "pnlPct", "name"].includes(v.sort) ? v.sort : "value",
    taxMethod: v.taxMethod === "average" ? "average" : "fifo",
  };
}

// Coin detail Markets table sort (clarification 37, journey rule 2).
export function normalizeCoinMarketsPrefs(value) {
  const v = value && typeof value === "object" ? value : {};
  return {
    sort: ["exchange", "price", "volume", "share"].includes(v.sort) ? v.sort : "volume",
    dir: v.dir === "asc" ? "asc" : "desc",
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

const pick = (value, options, fallback) => (options.includes(value) ? value : fallback);
const clamp = (value, min, max, fallback) => (Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback);

// Accessibility menu settings (27-accessibility-menu.md); lineHeight 0 means "app default".
export function normalizeA11y(value) {
  const base = defaultSettings.a11y;
  const v = value && typeof value === "object" ? value : {};
  const flag = (key) => (typeof v[key] === "boolean" ? v[key] : base[key]);
  return {
    profiles: strings(v.profiles),
    textSize: clamp(v.textSize, 80, 200, base.textSize),
    font: pick(v.font, ["default", "readable", "dyslexic"], base.font),
    lineHeight: v.lineHeight === 0 ? 0 : clamp(v.lineHeight, 1, 2, base.lineHeight),
    letterSpacing: clamp(v.letterSpacing, 0, 0.2, base.letterSpacing),
    align: pick(v.align, ["default", "left", "center"], base.align),
    contrast: pick(v.contrast, ["default", "high", "dark", "light"], base.contrast),
    saturation: pick(v.saturation, ["default", "low", "high", "mono"], base.saturation),
    highlightLinks: flag("highlightLinks"),
    highlightHeadings: flag("highlightHeadings"),
    strongFocus: flag("strongFocus"),
    bigCursor: flag("bigCursor"),
    readingGuide: flag("readingGuide"),
    hideImages: flag("hideImages"),
    summarySize: pick(v.summarySize, ["S", "M", "L", "XL"], base.summarySize),
  };
}

export function normalizeAi(value) {
  const base = defaultSettings.ai;
  const v = value && typeof value === "object" ? value : {};
  return Object.fromEntries(Object.keys(base).map((key) => [key, typeof v[key] === "boolean" ? v[key] : base[key]]));
}
