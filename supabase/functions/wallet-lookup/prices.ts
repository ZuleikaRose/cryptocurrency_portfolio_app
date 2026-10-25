// Daily closing prices for wallet-import cost basis: each history day gets that UTC day's close
// in USD from Coinbase Exchange's public candles (no key needed). A day without a candle keeps a
// null price, and the app uses today's price for it and says so.
import { getJson, type HistoryEntry, utcDay } from "./lookup.ts";

const CANDLES_URL = "https://api.exchange.coinbase.com/products";
// Coinbase returns at most 300 candles a request; it allows 10 public requests a second.
const WINDOW_DAYS = 299;
const REQUEST_GAP_MS = 150;
const MAX_REQUESTS = 12;
const DAY_MS = 86_400_000;

// Coinbase products per CPA coin, tried in order for the days still unpriced (POL and RENDER
// replaced MATIC and RNDR; the older tickers cover the earlier days).
const PRODUCTS: Record<string, string[]> = {
  bitcoin: ["BTC-USD"],
  ethereum: ["ETH-USD"],
  tether: ["USDT-USD"],
  "shiba-inu": ["SHIB-USD"],
  chainlink: ["LINK-USD"],
  uniswap: ["UNI-USD"],
  polygon: ["POL-USD", "MATIC-USD"],
  render: ["RENDER-USD", "RNDR-USD"],
  "fetch-ai": ["FET-USD"],
  immutable: ["IMX-USD"],
  arbitrum: ["ARB-USD"],
  injective: ["INJ-USD"],
  maker: ["MKR-USD"],
  ondo: ["ONDO-USD"],
  aave: ["AAVE-USD"],
};
// Coinbase quotes in USDC, so it has no USDC-USD product; USDC is redeemable 1:1.
const FIXED: Record<string, number> = { "usd-coin": 1 };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Groups sorted days into request windows of at most WINDOW_DAYS + 1 days.
function windows(days: string[]): { start: string; end: string }[] {
  const result: { start: string; end: string }[] = [];
  for (const day of days) {
    const last = result[result.length - 1];
    if (last && Date.parse(day) - Date.parse(last.start) <= WINDOW_DAYS * DAY_MS) last.end = day;
    else result.push({ start: day, end: day });
  }
  return result;
}

// Fills entry.price in place. Never throws: a failed request leaves its days unpriced.
export async function priceHistory(entries: HistoryEntry[]): Promise<void> {
  const byCoin = new Map<string, HistoryEntry[]>();
  for (const entry of entries) {
    if (FIXED[entry.coinId]) entry.price = FIXED[entry.coinId];
    else byCoin.set(entry.coinId, [...(byCoin.get(entry.coinId) ?? []), entry]);
  }

  let requests = 0;
  for (const [coinId, coinEntries] of byCoin) {
    for (const product of PRODUCTS[coinId] ?? []) {
      const missing = [...new Set(coinEntries.filter((entry) => entry.price === null).map((entry) => entry.day))].sort();
      if (!missing.length) break;
      const closes = new Map<string, number>();
      for (const { start, end } of windows(missing)) {
        if (requests >= MAX_REQUESTS) break;
        requests += 1;
        if (requests > 1) await sleep(REQUEST_GAP_MS);
        const query = new URLSearchParams({ granularity: "86400", start: `${start}T00:00:00Z`, end: `${end}T23:59:59Z` });
        try {
          const { status, body } = await getJson(`${CANDLES_URL}/${product}/candles?${query}`, "price");
          if (status !== 200 || !Array.isArray(body)) {
            console.error(`wallet-lookup prices: ${product} ${status}`);
            continue;
          }
          // Each candle is [time, low, high, open, close, volume].
          for (const candle of body) {
            if (!Array.isArray(candle)) continue;
            const time = Number(candle[0]);
            const close = Number(candle[4]);
            if (Number.isFinite(time) && Number.isFinite(close) && close > 0) closes.set(utcDay(time), close);
          }
        } catch (error) {
          console.error(`wallet-lookup prices: ${product} ${error instanceof Error ? error.message : String(error)}`);
        }
      }
      for (const entry of coinEntries) {
        if (entry.price === null && closes.has(entry.day)) entry.price = closes.get(entry.day)!;
      }
    }
  }
}
