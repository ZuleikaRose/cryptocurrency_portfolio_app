// Live market figures over the REST API. The cryptorank-sync Edge Function writes CryptoRank
// prices into cpa.coins every 10 minutes, and 7d change and FDV about every 2 days; the
// price-history-sync Edge Function writes Coinbase 1h change and the 7d sparkline every 15
// minutes (clarification 26). Coins and figures they don't cover keep the bundled sample data.
import { supabase } from "./supabase.js";
import { t } from "./i18n.js";
import { historyProvider } from "./history.js";

// Returns { rows, updatedAt } (rows empty before the first sync), null when Supabase isn't
// configured, or throws when the request fails.
export async function fetchLivePrices() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coins")
    .select("id, price_usd, change_24h, market_cap_usd, volume_24h_usd, price_updated_at, change_7d, fdv_usd, details_updated_at, change_1h, sparkline_7d, history_updated_at")
    .eq("price_source", "cryptorank");
  if (error) throw new Error(error.message);
  const updatedAt = data.reduce((latest, row) => Math.max(latest, Date.parse(row.price_updated_at) || 0), 0);
  return { rows: data, updatedAt };
}

// Merges live rows onto the current coins. Returns the next coins and the price flashes.
export function mergeLivePrices(coins, rows) {
  const byId = new Map(rows.map((row) => [row.id, row]));
  const flashes = {};
  const next = coins.map((coin) => {
    const row = byId.get(coin.id);
    if (!row) return coin;
    const price = Number(row.price_usd);
    if (coin.source === "cryptorank" && price !== coin.price) flashes[coin.id] = price > coin.price ? "up" : "down";
    const details = row.details_updated_at != null;
    // Coinbase history: a real 7d sparkline, so the 7d change is read from it too and always
    // agrees with the line and the chart.
    const history = row.history_updated_at != null && row.sparkline_7d?.length >= 2 ? row.sparkline_7d.map(Number) : null;
    return {
      ...coin,
      source: "cryptorank",
      // Per coin, so a detail screen shows its own data's age (US-9.4); Maker refreshes every ~2 days.
      priceUpdatedAt: Date.parse(row.price_updated_at) || null,
      detailsUpdatedAt: details ? Date.parse(row.details_updated_at) : null,
      ...(details && row.change_7d != null ? { change7d: Number(row.change_7d) } : {}),
      ...(details && row.fdv_usd != null ? { fdv: Number(row.fdv_usd) } : {}),
      historyUpdatedAt: history ? Date.parse(row.history_updated_at) : null,
      ...(history ? { change7d: (price / history[0] - 1) * 100 } : {}),
      ...(history && row.change_1h != null ? { change1h: Number(row.change_1h) } : {}),
      price,
      change24h: Number(row.change_24h),
      marketCap: Number(row.market_cap_usd),
      volume24h: row.volume_24h_usd == null ? coin.volume24h : Number(row.volume_24h_usd),
      spark: history ?? (details && row.change_7d != null ? sparkFacing(coin.spark, Number(row.change_7d)) : coin.spark),
    };
  });
  return { next, flashes };
}

// Without Coinbase history the 7d sparkline is a unitless sample shape (Sparkline scales it to its
// own min and max), so a live price can't be applied to it. Mirror it when it runs against the
// live 7d change instead.
export function sparkFacing(spark, change7d) {
  const rising = spark[spark.length - 1] >= spark[0];
  if (Math.abs(change7d) < 0.1 || rising === change7d > 0) return spark;
  const top = Math.max(...spark) + Math.min(...spark);
  return spark.map((point) => top - point);
}

// Cap-weighted 24h change of the whole list: today's total cap against the total implied by
// each coin's own 24h change. Holds for live and sample figures alike.
export function marketCapChange24h(coins) {
  let now = 0;
  let before = 0;
  for (const coin of coins) {
    now += coin.marketCap;
    before += coin.marketCap / (1 + coin.change24h / 100);
  }
  return before > 0 ? (now / before - 1) * 100 : 0;
}

// Coin detail's source line (journey rule 4: name the source of each figure).
export function coinSource(coin) {
  if (coin.source !== "cryptorank") return t("CPA sample data");
  const history = Boolean(coin.historyUpdatedAt);
  const cryptorank = [
    t("price"),
    t("24h change"),
    ...(coin.detailsUpdatedAt && !history ? [t("7d change")] : []),
    t("market cap"),
    t("volume"),
    ...(coin.detailsUpdatedAt ? ["FDV"] : []),
  ];
  const source = coin.id === "maker" ? "Kraken (SKY × 24,000)" : historyProvider(coin.id);
  const coinbase = history ? t("; {source} (chart, 1h and 7d change, all-time high and low, in USD, UTC)", { source }) : "";
  return t("CryptoRank ({fields}){coinbase}; other figures CPA sample data", { fields: cryptorank.join(", "), coinbase });
}
