import { t } from "./i18n.js";

// "Similar coins" (25-ai-integration.md): rule-based, from category and size, nudged by
// coins the user viewed. Returns up to `count` coins, never the coin itself.
export function similarCoins(coin, coins, recentCoins = [], count = 4) {
  if (!coin) return [];
  const viewed = new Set(recentCoins);
  return coins
    .filter((item) => item.id !== coin.id && item.category === coin.category && item.category !== "Stablecoin")
    .map((item) => ({
      item,
      score: Math.abs(Math.log10(item.marketCap / coin.marketCap)) - (viewed.has(item.id) ? 0.5 : 0),
    }))
    .sort((a, b) => a.score - b.score)
    .slice(0, count)
    .map(({ item }) => item);
}

// Description of why they're similar, with no advice words.
export const similarReason = (coin) =>
  t("Same category ({category}) and a similar market cap to {symbol}.", { category: t(coin.category), symbol: coin.symbol });
