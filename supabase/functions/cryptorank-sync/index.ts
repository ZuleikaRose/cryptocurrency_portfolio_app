// Fetches live market figures from CryptoRank v3 and writes them into cpa.coins, where the app
// reads them over the REST API. Called by pg_cron every 10 minutes (cryptorank_live_prices migration).
//
// The function is public: pg_cron calls it without a secret. cpa.claim_market_sync() lets a run
// start at most once every 9 minutes, so extra calls can't spend CryptoRank credits. Anyone can
// reach it, so it reads nothing from the request, rejects bodies over 1 KB, answers browsers only
// from the origins in ALLOWED_ORIGINS (CORS), and never returns CryptoRank's or the database's
// error text: details go to the function logs and the server-only cpa.market_sync row.
// CRYPTORANK_API_KEY comes from the Edge Function secrets (set from the repo's .env with
// `supabase secrets set --env-file`); it is never logged or returned.
import { createClient } from "@supabase/supabase-js";

const API_URL = "https://api.cryptorank.io/v3";
// Pages of 100 coins sorted by rank, 1 credit each. Every ranked mapped coin is in the top 200.
const PAGES = 2;
// Per-coin details (7d change, FDV; price for coins outside the pages), 1 credit each. Six a run
// keeps every run at 8 requests, under the free plan's 10 a minute, and refreshes each coin about
// every 2 days: roughly 17 credits a day on top of the pages' 288 (cryptorank_more_live_data).
const DETAILS_PER_RUN = 6;
const DETAILS_MAX_AGE_MS = 48 * 60 * 60 * 1000;
// Maker is unranked since it became Sky at a fixed 24,000 SKY per MKR, so its price and 24h
// change come from Sky's ranked row (matched by ticker, best rank first) at no extra credit,
// as its chart does (clarification 39). CryptoRank gives no Maker market cap, so none is stored.
const DERIVED: Record<string, { symbol: string; scale: number }> = { maker: { symbol: "SKY", scale: 24_000 } };

type Currency = {
  id?: number;
  slug?: string;
  symbol?: string;
  price?: string | number | null;
  priceChangePercent24h?: number | null;
  marketCap?: string | number | null;
  volume24h?: string | number | null;
};

type Details = {
  price?: string | number | null;
  marketCap?: string | number | null;
  volume24h?: string | number | null;
  fullyDilutedValuation?: string | number | null;
  pricePercentChange?: { h24?: number | null; d7?: number | null } | null;
};

type MappedCoin = { cryptorank_slug: string; cryptorank_id: number | null; details_updated_at: string | null };

const MAX_BODY_BYTES = 1024;

// Comma-separated list of web origins that may call the function from a browser. pg_cron sends
// no Origin header, so it isn't affected. Defaults to the local dev server.
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

function toNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
}

// GET {API_URL}/{path} and return its "data" field; throws with CryptoRank's message on failure.
async function apiGet(apiKey: string, path: string): Promise<unknown> {
  const response = await fetch(`${API_URL}/${path}`, {
    headers: { "X-Api-Key": apiKey, Accept: "application/json" },
  });
  let body: { data?: unknown; error?: { message?: string } } | null = null;
  try {
    body = await response.json();
  } catch {
    // Not JSON (e.g. a proxy error page); reported below.
  }
  if (!response.ok) {
    throw new Error(`CryptoRank returned ${response.status}: ${body?.error?.message ?? response.statusText}`);
  }
  if (body?.data == null) throw new Error("CryptoRank returned an unexpected response format.");
  return body.data;
}

async function fetchPage(apiKey: string, page: number): Promise<Currency[]> {
  const data = await apiGet(apiKey, `currencies/list?sortBy=rank&page=${page}`);
  if (!Array.isArray(data)) throw new Error("CryptoRank returned an unexpected response format.");
  return data as Currency[];
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST." }, 405);
  // The request body is never read; a large one is refused rather than buffered.
  const length = Number(req.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return json(req, { error: "Request body too large." }, 413);

  const apiKey = Deno.env.get("CRYPTORANK_API_KEY");
  if (!apiKey) {
    console.error("cryptorank-sync: CRYPTORANK_API_KEY is not set.");
    return json(req, { status: "error", error: "The sync isn't configured." }, 500);
  }
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: "cpa" },
    auth: { persistSession: false },
  });

  const { data: claimed, error: claimError } = await db.rpc("claim_market_sync");
  if (claimError) {
    console.error(`cryptorank-sync couldn't claim the run: ${claimError.message}`);
    return json(req, { status: "error", error: "The sync couldn't start." }, 500);
  }
  if (!claimed) return json(req, { status: "skipped", reason: "A sync ran in the last 9 minutes." });

  let credits = 0;
  try {
    const { data, error: mapError } = await db.from("coins")
      .select("cryptorank_slug, cryptorank_id, details_updated_at")
      .not("cryptorank_slug", "is", null);
    if (mapError) throw new Error(`Couldn't read mapped coins: ${mapError.message}`);
    const mapped = data as MappedCoin[];
    const wanted = new Set(mapped.map((row) => row.cryptorank_slug));

    const found = new Map<string, Currency>();
    const sources = new Map<string, Currency>();
    const sourceSymbols = new Set(Object.values(DERIVED).map((derived) => derived.symbol));
    for (let page = 1; page <= PAGES; page += 1) {
      const currencies = await fetchPage(apiKey, page);
      credits += 1;
      for (const currency of currencies) {
        if (currency?.slug && wanted.has(currency.slug) && !found.has(currency.slug)) found.set(currency.slug, currency);
        const symbol = currency?.symbol?.toUpperCase();
        if (symbol && sourceSymbols.has(symbol) && !sources.has(symbol)) sources.set(symbol, currency);
      }
    }

    // One row per coin: price figures from the pages, then details for the coins most overdue.
    const rows = new Map<string, Record<string, unknown>>();
    for (const [slug, c] of found) {
      const price = toNumber(c.price);
      if (price === null) continue;
      rows.set(slug, {
        slug,
        id: c.id ?? null,
        price,
        change24h: toNumber(c.priceChangePercent24h),
        marketCap: toNumber(c.marketCap),
        volume24h: toNumber(c.volume24h),
      });
    }
    for (const [slug, derived] of Object.entries(DERIVED)) {
      const source = sources.get(derived.symbol);
      const price = toNumber(source?.price);
      if (!wanted.has(slug) || found.has(slug) || price === null) continue;
      rows.set(slug, { slug, price: price * derived.scale, change24h: toNumber(source?.priceChangePercent24h) });
    }

    const now = Date.now();
    // Coins without a price from the pages get it from the details, so they go first; then the
    // oldest details.
    const due = mapped
      .map((coin) => ({ slug: coin.cryptorank_slug, id: found.get(coin.cryptorank_slug)?.id ?? coin.cryptorank_id, at: Date.parse(coin.details_updated_at ?? "") || 0, paged: rows.has(coin.cryptorank_slug) }))
      .filter((coin) => coin.id != null && now - coin.at > DETAILS_MAX_AGE_MS)
      .sort((a, b) => Number(a.paged) - Number(b.paged) || a.at - b.at)
      .slice(0, DETAILS_PER_RUN);
    const detailErrors: string[] = [];
    for (const coin of due) {
      try {
        const d = await apiGet(apiKey, `currencies/${coin.id}`) as Details;
        credits += 1;
        const row = rows.get(coin.slug) ?? { slug: coin.slug, id: coin.id };
        row.details = true;
        row.change7d = toNumber(d.pricePercentChange?.d7);
        row.fdv = toNumber(d.fullyDilutedValuation);
        // Coins outside the pages take their volume from the details, and their price figures
        // too when Sky's row didn't give Maker one.
        if (!found.has(coin.slug)) {
          row.volume24h = toNumber(d.volume24h);
          if (row.price == null && toNumber(d.price) !== null) {
            row.price = toNumber(d.price);
            row.change24h = toNumber(d.pricePercentChange?.h24);
            if (!DERIVED[coin.slug]) row.marketCap = toNumber(d.marketCap);
          }
        }
        rows.set(coin.slug, row);
      } catch (error) {
        // A failed detail lookup keeps this run's prices; the coin stays due for the next run.
        credits += 1;
        const message = error instanceof Error ? error.message : String(error);
        detailErrors.push(`${coin.slug}: ${message}`);
        console.error(`cryptorank-sync details for ${coin.slug} failed: ${message}`);
      }
    }

    const prices = [...rows.values()];
    const missing = [...wanted].filter((slug) => !found.has(slug) && rows.get(slug)?.price == null).sort();

    const { data: updated, error: applyError } = await db.rpc("apply_market_prices", { prices, credits, missing });
    if (applyError) throw new Error(`Couldn't save prices: ${applyError.message}`);
    if (missing.length) console.error(`cryptorank-sync: no price for ${missing.join(", ")}`);
    // Counts only: the messages are in the logs.
    return json(req, { status: "ok", updated, credits, details: due.length - detailErrors.length, detailErrors: detailErrors.length, missing: missing.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`cryptorank-sync failed: ${message}`);
    const { error: logError } = await db.rpc("fail_market_sync", { message, credits });
    if (logError) console.error(`cryptorank-sync couldn't record the failure: ${logError.message}`);
    return json(req, { status: "error", error: "The sync failed. Details are in the function logs.", credits, recorded: !logError }, 502);
  }
});
