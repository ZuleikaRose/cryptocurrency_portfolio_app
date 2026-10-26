// Real price history (clarification 26): Coinbase Exchange closes that the price-history-sync
// Edge Function writes into cpa.coin_prices, read one chart range at a time through
// cpa.price_history(). Coins without it (history_updated_at null) keep the sample chart.
import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase.js";

// The sync runs every 15 minutes, so a range is re-read at most every 5.
const TTL_MS = 5 * 60_000;
const cache = new Map();

const toPoint = (pair) => (pair ? { time: Number(pair[0]), price: Number(pair[1]) } : null);

// Returns { points: [{time, price}], high, low, since } with prices in USD; throws when the
// request fails. high and low are the highest and lowest daily close on record.
export async function fetchPriceHistory(coinId, rangeId) {
  const key = `${coinId}:${rangeId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  if (!supabase) throw new Error("Supabase isn't configured.");
  const { data, error } = await supabase.rpc("price_history", { coin_id: coinId, range_id: rangeId });
  if (error) throw new Error(error.message);
  const value = {
    points: (data?.points ?? []).map(toPoint),
    high: toPoint(data?.high),
    low: toPoint(data?.low),
    since: data?.since == null ? null : Number(data.since),
  };
  cache.set(key, { at: Date.now(), value });
  return value;
}

// The last value read for a range, however old (kept on screen when a refresh fails).
export const cachedHistory = (coinId, rangeId) => cache.get(`${coinId}:${rangeId}`)?.value ?? null;

// Closes end at the last completed candle; the chart ends at the live price, like the sample one.
export function withLivePrice(points, price, now = Date.now()) {
  return [...points.filter((point) => point.time < now), { time: now, price }];
}

// A daily close is stamped at the next midnight UTC; noon UTC of its own day labels it in any
// time zone within ±12 hours.
export const closeDay = (time) => time - 12 * 3_600_000;

// One range for a coin. { live } is false for coins on sample history; otherwise { data } is
// null until the first read, and { error } is set when the last read failed.
export function usePriceHistory(coin, rangeId) {
  const live = Boolean(coin.historyUpdatedAt && supabase);
  const key = `${coin.id}:${rangeId}`;
  const [state, setState] = useState({ key: null, data: null, error: false });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!live) return undefined;
    let cancelled = false;
    fetchPriceHistory(coin.id, rangeId)
      .then((data) => !cancelled && setState({ key, data, error: false }))
      .catch((error) => {
        console.error(`Price history for ${key} failed: ${error.message}`);
        if (!cancelled) setState({ key, data: cachedHistory(coin.id, rangeId), error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [live, key, coin.id, rangeId, attempt]);

  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  const current = state.key === key;
  return {
    live,
    data: current ? state.data : cachedHistory(coin.id, rangeId),
    error: current && state.error,
    retry,
  };
}
