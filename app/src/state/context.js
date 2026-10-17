import { createContext, useContext } from "react";

export const defaultSettings = {
  currency: "USD",
  theme: "dark",
  colors: "standard",
  autoRefresh: true,
  stopAnimations: false,
  market: { view: "coins", sort: "rank", dir: "asc", category: "All", density: "simple", gainersWindow: "24h" },
};

export const AppContext = createContext(null);
export const MarketContext = createContext(null);

export function useApp() {
  return useContext(AppContext);
}

export function useMarket() {
  return useContext(MarketContext);
}
