// Rank and price lookup for lookup.py, the repo's command-line tool. It uses the
// CRYPTORANK_API_KEY Edge Function secret, so the key stays in Supabase and never has to be
// copied to a laptop's .env.
//
// Request: POST {"symbols": ["BTC", "ETH"]} (1 to 5 tickers). Response: {"results": [{symbol,
// status: "found" | "not_found" | "not_checked", name?, rank?, price?}], "creditsUsed"}.
//
// Anyone can reach the URL, so the function spends CryptoRank credits only from a daily budget
// (cpa.spend_lookup_credit, migration cryptorank_lookup_usage) that leaves the price sync its
// ~305 credits a day of the free plan's 400, makes at most 6 CryptoRank requests a call (under
// the plan's 10 a minute alongside the sync), sends no CORS headers (it isn't for browsers), caps
// the body at 1 KB, and returns generic errors; details go to the function logs.
import { createClient } from "@supabase/supabase-js";

const API_URL = (Deno.env.get("API_V3_URL") || "https://api.cryptorank.io/v3").replace(/\/+$/, "");
const MAX_BODY_BYTES = 1024;
const MAX_SYMBOLS = 5;
const DAILY_CREDITS = 60; // 305 for the sync + 60 here stays under the free plan's 400
const MAX_REQUESTS = 6; // CryptoRank requests per call
const RANKED_PAGES = 3; // rank-sorted pages of 100 to scan before the symbol map
const MAX_CANDIDATES = 3; // same-ticker coins looked up one by one in the fallback
const SYMBOL = /^[A-Z0-9]{1,15}$/;

type Coin = { id?: number; symbol?: string; name?: string; rank?: number | string | null; price?: number | string | null };
type Result = { symbol: string; status: "found" | "not_found" | "not_checked"; name?: string; rank?: number | null; price?: number | null };

class StopLookup extends Error {
  constructor(readonly reason: "budget" | "requests" | "busy") {
    super(reason);
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

const toNumber = (value: unknown): number | null => {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
};
const rankOf = (coin: Coin) => toNumber(coin.rank) ?? Number.POSITIVE_INFINITY;
const matches = (coin: Coin, symbol: string) => String(coin.symbol ?? "").toUpperCase() === symbol;

Deno.serve(async (req) => {
  if (req.headers.get("Origin")) return json({ error: "This endpoint isn't for browsers." }, 403);
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);
  const length = Number(req.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return json({ error: "Request body too large." }, 413);

  let symbols: string[];
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json({ error: "Request body too large." }, 413);
    const body = JSON.parse(text) as { symbols?: unknown };
    if (!Array.isArray(body.symbols)) throw new Error("no symbols");
    symbols = [...new Set(body.symbols.map((item) => String(item ?? "").trim().toUpperCase()))];
  } catch {
    return json({ error: 'Send JSON like {"symbols": ["BTC"]}.' }, 400);
  }
  if (!symbols.length || symbols.length > MAX_SYMBOLS) return json({ error: `Send 1 to ${MAX_SYMBOLS} symbols.` }, 400);
  const bad = symbols.find((symbol) => !SYMBOL.test(symbol));
  if (bad !== undefined) return json({ error: "Symbols are 1 to 15 letters or digits, like BTC." }, 400);

  const apiKey = Deno.env.get("CRYPTORANK_API_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!apiKey || !url || !serviceKey) {
    console.error("cryptorank-lookup: CRYPTORANK_API_KEY or the Supabase settings are missing.");
    return json({ error: "The lookup isn't configured." }, 500);
  }
  const db = createClient(url, serviceKey, { db: { schema: "cpa" }, auth: { persistSession: false } });

  let requests = 0;
  let credits = 0;
  // One CryptoRank GET, paid for from today's budget first.
  const apiGet = async (path: string): Promise<unknown> => {
    if (requests >= MAX_REQUESTS) throw new StopLookup("requests");
    const { data: allowed, error } = await db.rpc("spend_lookup_credit", { daily_limit: DAILY_CREDITS });
    if (error) throw new Error(`budget check failed: ${error.message}`);
    if (!allowed) throw new StopLookup("budget");
    requests += 1;
    credits += 1;
    const response = await fetch(`${API_URL}/${path}`, {
      headers: { "X-Api-Key": apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(15_000),
    });
    if (response.status === 429) {
      await response.body?.cancel();
      throw new StopLookup("busy");
    }
    let body: { data?: unknown; error?: { message?: string } } | null = null;
    try {
      body = await response.json();
    } catch {
      // Not JSON; reported below.
    }
    if (!response.ok || body?.data == null) {
      throw new Error(`CryptoRank ${path.split("?")[0]} returned ${response.status}: ${body?.error?.message ?? "unexpected body"}`);
    }
    return body.data;
  };

  const found = new Map<string, Coin>();
  let stopped: StopLookup["reason"] | null = null;
  try {
    // The rank-sorted list first: the first coin with a ticker is the best-ranked one.
    for (let page = 1; page <= RANKED_PAGES && found.size < symbols.length; page += 1) {
      const coins = await apiGet(`currencies/list?sortBy=rank&page=${page}`);
      for (const coin of Array.isArray(coins) ? coins as Coin[] : []) {
        const symbol = symbols.find((item) => !found.has(item) && matches(coin, item));
        if (symbol) found.set(symbol, coin);
      }
    }
    // Outside the top ranks: every coin with the ticker, keeping the best-ranked one.
    const rest = symbols.filter((symbol) => !found.has(symbol));
    if (rest.length) {
      const map = await apiGet("currencies/map");
      const entries = Array.isArray(map) ? map as Coin[] : [];
      for (const symbol of rest) {
        const ids = entries.filter((entry) => matches(entry, symbol) && entry.id != null).map((entry) => entry.id).slice(0, MAX_CANDIDATES);
        const candidates: Coin[] = [];
        for (const id of ids) {
          const coin = await apiGet(`currencies/${encodeURIComponent(String(id))}`);
          if (coin && typeof coin === "object") candidates.push(coin as Coin);
        }
        if (candidates.length) found.set(symbol, candidates.sort((a, b) => rankOf(a) - rankOf(b))[0]);
        else found.set(symbol, {}); // checked, nothing listed
      }
    }
  } catch (error) {
    if (error instanceof StopLookup) {
      stopped = error.reason;
    } else {
      console.error(`cryptorank-lookup: ${error instanceof Error ? error.message : String(error)}`);
      return json({ error: "The CryptoRank lookup failed. Try again in a minute." }, 502);
    }
  }

  if (stopped && found.size === 0) {
    if (stopped === "budget") return json({ error: "Today's lookup budget is used up. It resets at 00:00 UTC." }, 429);
    if (stopped === "busy") return json({ error: "CryptoRank is busy. Try again in a minute." }, 503);
  }
  const results: Result[] = symbols.map((symbol) => {
    const coin = found.get(symbol);
    if (!coin) return { symbol, status: "not_checked" };
    if (!coin.symbol) return { symbol, status: "not_found" };
    return { symbol, status: "found", name: coin.name ?? symbol, rank: toNumber(coin.rank), price: toNumber(coin.price) };
  });
  return json({ results, creditsUsed: credits, ...(stopped ? { note: stopped === "budget" ? "Daily budget reached." : "Request limit reached; look the rest up separately." } : {}) });
});
