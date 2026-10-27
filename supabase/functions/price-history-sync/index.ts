// Fetches Coinbase Exchange candles for the live coins (Kraken for the three Coinbase lacks) and
// writes their closes into cpa.coin_prices, and 1h change and the 7d sparkline into cpa.coins
// (price_history migration).
// Called by pg_cron every 15 minutes. The app reads chart ranges through cpa.price_history().
//
// The function is public: pg_cron calls it without a secret. cpa.claim_price_history_sync() lets a
// run start at most once every 10 minutes, so extra calls can't multiply requests to Coinbase.
// It reads nothing from the request, rejects bodies over 1 KB, answers browsers only from the
// origins in ALLOWED_ORIGINS (CORS), and never returns error details: those go to the function
// logs and the server-only cpa.price_history_sync row. Coinbase's and Kraken's candles need no key.
import { createClient } from "@supabase/supabase-js";

const CANDLES_URL = "https://api.exchange.coinbase.com/products";
// Coinbase products per CPA coin. The later ones cover days before a ticker change (POL and
// RENDER replaced MATIC and RNDR), so only backfill reads them. TRON, USDC and Maker come from
// KRAKEN below.
const PRODUCTS: Record<string, string[]> = {
  bitcoin: ["BTC-USD"], ethereum: ["ETH-USD"], tether: ["USDT-USD"], bnb: ["BNB-USD"],
  solana: ["SOL-USD"], xrp: ["XRP-USD"], dogecoin: ["DOGE-USD"], zcash: ["ZEC-USD"],
  toncoin: ["TON-USD"], cardano: ["ADA-USD"], avalanche: ["AVAX-USD"], "shiba-inu": ["SHIB-USD"],
  chainlink: ["LINK-USD"], polkadot: ["DOT-USD"], "bitcoin-cash": ["BCH-USD"], near: ["NEAR-USD"],
  litecoin: ["LTC-USD"], uniswap: ["UNI-USD"], "internet-computer": ["ICP-USD"],
  polygon: ["POL-USD", "MATIC-USD"], aptos: ["APT-USD"], render: ["RENDER-USD", "RNDR-USD"],
  "fetch-ai": ["FET-USD"], sui: ["SUI-USD"], immutable: ["IMX-USD"], optimism: ["OP-USD"],
  arbitrum: ["ARB-USD"], injective: ["INJ-USD"], celestia: ["TIA-USD"], ondo: ["ONDO-USD"],
  aave: ["AAVE-USD"],
};
// Kraken pairs for the coins Coinbase lacks (clarification 36). Maker became SKY at a fixed
// 24,000 SKY per MKR, so Maker's closes are SKY's times 24,000; the app names this under its chart.
// Keep in step with KRAKEN_COINS in app/src/lib/history.js.
const KRAKEN: Record<string, { pair: string; scale: number }> = {
  tron: { pair: "TRXUSD", scale: 1 },
  "usd-coin": { pair: "USDCUSD", scale: 1 },
  maker: { pair: "SKYUSD", scale: 24_000 },
};
const KRAKEN_URL = "https://api.kraken.com/0/public/OHLC";
// Kraken has no 6-hour candles: the 6-hour slot reads hourly ones and keeps every sixth.
const KRAKEN_MINUTES: Record<number, number> = { 900: 15, 3600: 60, 21600: 60, 86400: 1440 };

// Candle sizes in seconds and how long their closes are useful (the migration prunes the rest).
const GRANULARITIES = [
  { seconds: 900, keepMs: 26 * 3_600_000 },
  { seconds: 3600, keepMs: 8 * 86_400_000 },
  { seconds: 21600, keepMs: 32 * 86_400_000 },
  { seconds: 86400, keepMs: Infinity },
];
const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
// Coinbase allows 10 public requests a second and returns at most 300 candles a request.
const REQUEST_GAP_MS = 125;
// Kraken's public limit is about one request a second; it returns the latest 720 candles.
const KRAKEN_GAP_MS = 1100;
const REQUEST_TIMEOUT_MS = 10_000;
const BACKFILL_PER_RUN = 31;
const BACKFILL_DAYS = 299;
// A product whose price is this far from CryptoRank's isn't the same asset; its chart stays sample.
const MAX_PRICE_GAP = 0.1;
const MAX_BODY_BYTES = 1024;

type Claim = {
  fetched: Record<string, string>;
  backfilled: string[];
  coins: { id: string; price: number | string; oldest: number | null }[];
};
type Point = { coin: string; at: number; price: number };

const allowedOrigins = new Set(
  (Deno.env.get("ALLOWED_ORIGINS") ?? "http://localhost:5173").split(",").map((origin) => origin.trim()).filter(Boolean),
);

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  if (!origin || !allowedOrigins.has(origin)) return { Vary: "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), "Content-Type": "application/json" } });

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Closes of completed candles, stamped at each candle's close: [{at, price}] oldest first.
// Throws on a failed request; an empty array means Coinbase has no candles in that window.
async function candles(product: string, seconds: number, window?: { start: number; end: number }): Promise<{ at: number; price: number }[]> {
  const query = new URLSearchParams({ granularity: String(seconds) });
  if (window) {
    query.set("start", new Date(window.start).toISOString());
    query.set("end", new Date(window.end).toISOString());
  }
  const response = await fetch(`${CANDLES_URL}/${product}/candles?${query}`, {
    headers: { Accept: "application/json", "User-Agent": "cpa-price-history" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${product} ${seconds}s returned ${response.status}`);
  const body = await response.json();
  if (!Array.isArray(body)) throw new Error(`${product} ${seconds}s returned an unexpected format`);
  const now = Date.now();
  const closes: { at: number; price: number }[] = [];
  // Each candle is [time, low, high, open, close, volume], newest first.
  for (const candle of body) {
    if (!Array.isArray(candle)) continue;
    const at = (Number(candle[0]) + seconds) * 1000;
    const price = Number(candle[4]);
    if (Number.isFinite(at) && at <= now && Number.isFinite(price) && price > 0) closes.push({ at, price });
  }
  return closes.sort((a, b) => a.at - b.at);
}

// Kraken closes for a coin in KRAKEN, scaled, stamped at each candle's close, oldest first.
// Kraken returns only its latest 720 candles, so there is no earlier page to backfill.
async function krakenCandles(coin: string, seconds: number): Promise<{ at: number; price: number }[]> {
  const { pair, scale } = KRAKEN[coin];
  const minutes = KRAKEN_MINUTES[seconds];
  const response = await fetch(`${KRAKEN_URL}?${new URLSearchParams({ pair, interval: String(minutes) })}`, {
    headers: { Accept: "application/json", "User-Agent": "cpa-price-history" },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`${pair} ${seconds}s returned ${response.status}`);
  const body = await response.json();
  const rows = body?.result?.[pair];
  if (!Array.isArray(rows) || (Array.isArray(body.error) && body.error.length)) throw new Error(`${pair} ${seconds}s returned an unexpected format`);
  const now = Date.now();
  const closes: { at: number; price: number }[] = [];
  // Each candle is [time, open, high, low, close, vwap, volume, count], oldest first; the last is still open.
  for (const candle of rows) {
    if (!Array.isArray(candle)) continue;
    const at = (Number(candle[0]) + minutes * 60) * 1000;
    const price = Number(candle[4]) * scale;
    if (!Number.isFinite(at) || at > now || !Number.isFinite(price) || price <= 0) continue;
    if (seconds === 21600 && at % (seconds * 1000) !== 0) continue;
    closes.push({ at, price });
  }
  return closes;
}

// Runs each task after its delay, concurrently. Each result is the closes or an Error.
async function throttled<T>(tasks: { delay: number; run: () => Promise<T> }[]): Promise<(T | Error)[]> {
  return await Promise.all(tasks.map(async ({ delay, run }) => {
    await sleep(delay);
    try {
      return await run();
    } catch (error) {
      return error instanceof Error ? error : new Error(String(error));
    }
  }));
}

// 24 evenly spaced closes from the last 7 days, for the list sparkline (style guide §7.1).
function sparkline(hourly: { at: number; price: number }[], now: number): number[] | null {
  const week = hourly.filter((point) => point.at > now - 7 * DAY_MS);
  if (week.length < 24) return null;
  return Array.from({ length: 24 }, (_, i) => week[Math.round((i * (week.length - 1)) / 23)].price);
}

// % change between the latest 15-minute close and the close an hour before it.
function changeOneHour(quarter: { at: number; price: number }[]): number | null {
  const last = quarter[quarter.length - 1];
  const before = last && quarter.find((point) => point.at === last.at - HOUR_MS);
  if (!before) return null;
  return Math.round(((last.price / before.price - 1) * 100) * 10_000) / 10_000;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST." }, 405);
  // The request body is never read; a large one is refused rather than buffered.
  const length = Number(req.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return json(req, { error: "Request body too large." }, 413);

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: "cpa" },
    auth: { persistSession: false },
  });

  const { data: claimed, error: claimError } = await db.rpc("claim_price_history_sync");
  if (claimError) {
    console.error(`price-history-sync couldn't claim the run: ${claimError.message}`);
    return json(req, { status: "error", error: "The sync couldn't start." }, 500);
  }
  if (!claimed) return json(req, { status: "skipped", reason: "A sync ran in the last 10 minutes." });

  let requests = 0;
  try {
    const claim = claimed as Claim;
    const now = Date.now();
    const sourced = (id: string) => Boolean(PRODUCTS[id] || KRAKEN[id]);
    const coins = claim.coins.filter((coin) => sourced(coin.id));
    const skipped = new Set(claim.coins.filter((coin) => !sourced(coin.id)).map((coin) => coin.id));
    // Kraken's daily request already returns all it has.
    const backfilled = new Set([...claim.backfilled, ...coins.filter((coin) => KRAKEN[coin.id]).map((coin) => coin.id)]);

    // A size is due when its last fetch is older than its candle (hourly at most).
    const due = GRANULARITIES.filter(({ seconds }) => {
      const last = Date.parse(claim.fetched[String(seconds)] ?? "") || 0;
      return now - last >= Math.min(seconds * 1000, HOUR_MS) - 5 * 60_000;
    });

    type Job = { coin: string; seconds: number; backfill?: { products: string[]; end: number } };
    const jobs: Job[] = [];
    for (const { seconds } of due) for (const coin of coins) jobs.push({ coin: coin.id, seconds });
    // Older daily closes, one page a coin, until Coinbase has no earlier candles for any product.
    for (const coin of coins) {
      if (backfilled.has(coin.id) || coin.oldest == null) continue;
      if (jobs.filter((job) => job.backfill).length >= BACKFILL_PER_RUN) break;
      jobs.push({ coin: coin.id, seconds: 86400, backfill: { products: PRODUCTS[coin.id], end: coin.oldest - DAY_MS } });
    }

    const run = async (job: Job) => {
      if (KRAKEN[job.coin]) {
        requests += 1;
        return await krakenCandles(job.coin, job.seconds);
      }
      if (!job.backfill) {
        requests += 1;
        return await candles(PRODUCTS[job.coin][0], job.seconds);
      }
      const window = { start: job.backfill.end - BACKFILL_DAYS * DAY_MS, end: job.backfill.end };
      for (const product of job.backfill.products) {
        requests += 1;
        const closes = await candles(product, 86400, window);
        if (closes.length) return closes;
      }
      backfilled.add(job.coin);
      return [];
    };
    // Coinbase and Kraken requests are paced separately and run side by side.
    let coinbaseIndex = 0;
    let krakenIndex = 0;
    const results = await throttled(jobs.map((job) => {
      const kraken = Boolean(KRAKEN[job.coin]);
      return { delay: kraken ? krakenIndex++ * KRAKEN_GAP_MS : coinbaseIndex++ * REQUEST_GAP_MS, run: () => run(job) };
    }));

    // Closes per coin and size; a size counts as fetched only when every coin's request worked.
    const byCoin = new Map<string, Map<number, { at: number; price: number }[]>>();
    const failed = new Set<number>();
    const errors: string[] = [];
    results.forEach((result, index) => {
      const job = jobs[index];
      if (result instanceof Error) {
        errors.push(result.message);
        if (!job.backfill) failed.add(job.seconds);
        return;
      }
      const sizes = byCoin.get(job.coin) ?? new Map();
      sizes.set(job.backfill ? -1 : job.seconds, result);
      byCoin.set(job.coin, sizes);
    });

    const points = new Map<string, Point>();
    const figures: { id: string; change1h: number | null; spark: number[] | null }[] = [];
    for (const coin of coins) {
      const sizes = byCoin.get(coin.id);
      if (!sizes) continue;
      // Check the product is the same asset CryptoRank prices (e.g. a rebranded ticker, or SKY's scale).
      const latest = [900, 3600, 21600, 86400].map((seconds) => sizes.get(seconds)?.at(-1)).find(Boolean);
      const live = Number(coin.price);
      if (latest && live > 0 && Math.abs(latest.price / live - 1) > MAX_PRICE_GAP) {
        skipped.add(coin.id);
        console.error(`price-history-sync: ${coin.id} history ${latest.price} vs CryptoRank ${live}; skipped`);
        continue;
      }
      for (const [seconds, closes] of sizes) {
        const keep = seconds === -1 ? Infinity : GRANULARITIES.find((size) => size.seconds === seconds)!.keepMs;
        for (const close of closes) {
          if (now - close.at <= keep) points.set(`${coin.id}|${close.at}`, { coin: coin.id, at: close.at, price: close.price });
        }
      }
      figures.push({ id: coin.id, change1h: sizes.has(900) ? changeOneHour(sizes.get(900)!) : null, spark: sizes.has(3600) ? sparkline(sizes.get(3600)!, now) : null });
    }

    const fetched = Object.fromEntries(due.filter(({ seconds }) => !failed.has(seconds)).map(({ seconds }) => [String(seconds), new Date(now).toISOString()]));
    const { data: updated, error: applyError } = await db.rpc("apply_price_history", {
      points: [...points.values()],
      coins: figures,
      fetched,
      backfilled: [...backfilled].sort(),
      skipped: [...skipped].sort(),
      requests,
    });
    if (applyError) throw new Error(`Couldn't save history: ${applyError.message}`);
    if (errors.length) console.error(`price-history-sync: ${errors.length} requests failed: ${errors.slice(0, 5).join("; ")}`);
    // Counts only: the messages are in the logs.
    return json(req, { status: "ok", updated, points: points.size, requests, failed: errors.length, skipped: skipped.size });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`price-history-sync failed: ${message}`);
    const { error: logError } = await db.rpc("fail_price_history_sync", { message, requests });
    if (logError) console.error(`price-history-sync couldn't record the failure: ${logError.message}`);
    return json(req, { status: "error", error: "The sync failed. Details are in the function logs.", requests, recorded: !logError }, 502);
  }
});
