// Fetches live market figures from CryptoRank v3 and writes them into cpa.coins, where the app
// reads them over the REST API. Called by pg_cron every 10 minutes (cryptorank_live_prices migration).
//
// The function is public: pg_cron calls it without a secret. cpa.claim_market_sync() lets a run
// start at most once every 9 minutes, so extra calls can't spend CryptoRank credits.
// CRYPTORANK_API_KEY comes from the Edge Function secrets (set from the repo's .env with
// `supabase secrets set --env-file`); it is never logged or returned.
import { createClient } from "@supabase/supabase-js";

const API_URL = "https://api.cryptorank.io/v3";
// Pages of 100 coins sorted by rank, 1 credit each. Every mapped coin is in the top 200.
const PAGES = 2;

type Currency = {
  slug?: string;
  price?: string | number | null;
  priceChangePercent24h?: number | null;
  marketCap?: string | number | null;
  volume24h?: string | number | null;
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

function toNumber(value: unknown): number | null {
  const number = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(number) ? number : null;
}

async function fetchPage(apiKey: string, page: number): Promise<Currency[]> {
  const response = await fetch(`${API_URL}/currencies/list?sortBy=rank&page=${page}`, {
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
  if (!Array.isArray(body?.data)) throw new Error("CryptoRank returned an unexpected response format.");
  return body.data as Currency[];
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  const apiKey = Deno.env.get("CRYPTORANK_API_KEY");
  if (!apiKey) return json({ error: "CRYPTORANK_API_KEY is not set." }, 500);
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    db: { schema: "cpa" },
    auth: { persistSession: false },
  });

  const { data: claimed, error: claimError } = await db.rpc("claim_market_sync");
  if (claimError) return json({ error: `Couldn't claim the run: ${claimError.message}` }, 500);
  if (!claimed) return json({ status: "skipped", reason: "A sync ran in the last 9 minutes." });

  let credits = 0;
  try {
    const { data: mapped, error: mapError } = await db.from("coins").select("cryptorank_slug").not("cryptorank_slug", "is", null);
    if (mapError) throw new Error(`Couldn't read mapped coins: ${mapError.message}`);
    const wanted = new Set(mapped.map((row) => row.cryptorank_slug as string));

    const found = new Map<string, Currency>();
    for (let page = 1; page <= PAGES; page += 1) {
      const currencies = await fetchPage(apiKey, page);
      credits += 1;
      for (const currency of currencies) {
        if (currency?.slug && wanted.has(currency.slug) && !found.has(currency.slug)) found.set(currency.slug, currency);
      }
    }

    const prices = [...found.entries()].map(([slug, c]) => ({
      slug,
      price: toNumber(c.price),
      change24h: toNumber(c.priceChangePercent24h),
      marketCap: toNumber(c.marketCap),
      volume24h: toNumber(c.volume24h),
    })).filter((row) => row.price !== null);
    const missing = [...wanted].filter((slug) => !found.has(slug)).sort();

    const { data: updated, error: applyError } = await db.rpc("apply_market_prices", { prices, credits, missing });
    if (applyError) throw new Error(`Couldn't save prices: ${applyError.message}`);
    return json({ status: "ok", updated, credits, missing });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.rpc("fail_market_sync", { message, credits });
    console.error(`cryptorank-sync failed: ${message}`);
    return json({ status: "error", error: message, credits }, 502);
  }
});
