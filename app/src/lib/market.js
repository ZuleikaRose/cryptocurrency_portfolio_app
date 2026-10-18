// Live market figures over the REST API. The cryptorank-sync Edge Function writes CryptoRank
// prices into cpa.coins every 10 minutes, and 7d change and FDV about every 2 days; coins and
// figures it doesn't cover keep the bundled sample data.
import { supabase } from "./supabase.js";

// Returns { rows, updatedAt } (rows empty before the first sync), null when Supabase isn't
// configured, or throws when the request fails.
export async function fetchLivePrices() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coins")
    .select("id, price_usd, change_24h, market_cap_usd, volume_24h_usd, price_updated_at, change_7d, fdv_usd, details_updated_at")
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
    const ratio = coin.price > 0 ? price / coin.price : 1;
    const details = row.details_updated_at != null;
    return {
      ...coin,
      source: "cryptorank",
      // Per coin, so a detail screen shows its own data's age (US-9.4); Maker refreshes every ~2 days.
      priceUpdatedAt: Date.parse(row.price_updated_at) || null,
      detailsUpdatedAt: details ? Date.parse(row.details_updated_at) : null,
      ...(details && row.change_7d != null ? { change7d: Number(row.change_7d) } : {}),
      ...(details && row.fdv_usd != null ? { fdv: Number(row.fdv_usd) } : {}),
      price,
      change24h: Number(row.change_24h),
      marketCap: Number(row.market_cap_usd),
      volume24h: row.volume_24h_usd == null ? coin.volume24h : Number(row.volume_24h_usd),
      // The 7d sparkline is still sample data; keep its last point on the live price.
      spark: [...coin.spark.slice(0, -1), coin.spark[coin.spark.length - 1] * ratio],
    };
  });
  return { next, flashes };
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
  if (coin.source !== "cryptorank") return "CPA sample data";
  return coin.detailsUpdatedAt
    ? "CryptoRank (price, 24h and 7d change, market cap, volume, FDV); other figures CPA sample data"
    : "CryptoRank (price, 24h change, market cap, volume); other figures CPA sample data";
}
