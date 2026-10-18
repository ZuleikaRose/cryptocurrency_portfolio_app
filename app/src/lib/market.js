// Live market figures over the REST API. The cryptorank-sync Edge Function writes CryptoRank
// prices into cpa.coins every 10 minutes; coins it doesn't cover keep the bundled sample data.
import { supabase } from "./supabase.js";

// Returns { rows, updatedAt } (rows empty before the first sync), null when Supabase isn't
// configured, or throws when the request fails.
export async function fetchLivePrices() {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from("coins")
    .select("id, price_usd, change_24h, market_cap_usd, volume_24h_usd, price_updated_at")
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
    return {
      ...coin,
      source: "cryptorank",
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
