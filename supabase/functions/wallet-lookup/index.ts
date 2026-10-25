// Read-only wallet import (US-6.4, 11-portfolio.md): returns the balances held by one public
// Bitcoin or Ethereum address, for the coins CPA lists. The browser calls this function instead
// of the block explorers, so ETHERSCAN_API_KEY stays a function setting and never ships.
//
// Request: POST {"chain": "bitcoin" | "ethereum", "address": "<public address>"} with the caller's
// Supabase session as the Bearer token. Response: {"chain", "address", "balances": [{coinId, amount}],
// "asOf"}. Nothing else is read from the request, and the address is never stored.
//
// Anyone can reach the URL, so the function needs a signed-in user, answers browsers only from
// ALLOWED_ORIGINS (CORS), rejects bodies over 1 KB, accepts only well-formed public addresses, and
// allows 10 lookups an hour per user and 30 per caller IP (cpa.claim_wallet_lookup, migration
// wallet_lookup_quota). Explorer and database error text goes to the logs, never to the caller.
import { createClient } from "@supabase/supabase-js";
import { type Balance, bitcoinBalances, ethereumBalances, LookupError, normaliseAddress } from "./lookup.ts";

const MAX_BODY_BYTES = 1024;
const LIMIT_PER_USER = 10;
const LIMIT_PER_IP = 30;

// Comma-separated list of web origins that may call the function from a browser. Defaults to the
// local dev server.
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
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });

// Keyed hash of the caller's IP, so the stored value can't be reversed by hashing every address.
async function ipBucket(req: Request, key: string): Promise<string | null> {
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  if (!ip) return null;
  const hmacKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", hmacKey, new TextEncoder().encode(ip)));
  return `ip:${Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  if (origin && !allowedOrigins.has(origin)) return json(req, { error: "Origin not allowed." }, 403);
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Use POST." }, 405);
  const length = Number(req.headers.get("Content-Length") ?? "0");
  if (!Number.isFinite(length) || length > MAX_BODY_BYTES) return json(req, { error: "Request body too large." }, 413);

  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  if (!serviceKey || !url) {
    console.error("wallet-lookup: Supabase settings are missing.");
    return json(req, { error: "Wallet import isn't configured." }, 500);
  }
  const db = createClient(url, serviceKey, { db: { schema: "cpa" }, auth: { persistSession: false } });

  // Signed-in users only: the token must be a live Supabase session.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  let userId: string | null = null;
  try {
    const { data: auth, error: authError } = token ? await db.auth.getUser(token) : { data: null, error: null };
    if (!authError) userId = auth?.user?.id ?? null;
  } catch (error) {
    console.error(`wallet-lookup couldn't check the session: ${error instanceof Error ? error.message : String(error)}`);
    return json(req, { error: "Wallet import is unavailable. Try again later." }, 503);
  }
  if (!userId) return json(req, { error: "Sign in to import a wallet." }, 401);

  let body: unknown;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY_BYTES) return json(req, { error: "Request body too large." }, 413);
    body = JSON.parse(text);
  } catch {
    return json(req, { error: "Send JSON with chain and address." }, 400);
  }
  const { chain, address: input } = (body ?? {}) as { chain?: unknown; address?: unknown };
  if (chain !== "bitcoin" && chain !== "ethereum") return json(req, { error: "Chain must be bitcoin or ethereum." }, 400);
  if (typeof input !== "string" || input.length > 100) return json(req, { error: "Enter a public address." }, 400);
  const address = normaliseAddress(chain, input);
  if (!address) {
    return json(req, { error: chain === "bitcoin" ? "That isn't a Bitcoin address." : "That isn't an Ethereum address (0x followed by 40 characters)." }, 400);
  }

  const buckets = [`user:${userId}`];
  const limits = [LIMIT_PER_USER];
  let allowed: unknown;
  try {
    const ip = await ipBucket(req, serviceKey);
    if (ip) {
      buckets.push(ip);
      limits.push(LIMIT_PER_IP);
    }
    const { data, error: quotaError } = await db.rpc("claim_wallet_lookup", { buckets, limits });
    if (quotaError) throw new Error(quotaError.message);
    allowed = data;
  } catch (error) {
    console.error(`wallet-lookup couldn't check the rate limit: ${error instanceof Error ? error.message : String(error)}`);
    return json(req, { error: "Wallet import is unavailable. Try again later." }, 500);
  }
  if (!allowed) return json(req, { error: `You can look up ${LIMIT_PER_USER} wallets an hour. Try again later.` }, 429);

  try {
    let balances: Balance[];
    if (chain === "bitcoin") {
      balances = await bitcoinBalances(address);
    } else {
      const apiKey = Deno.env.get("ETHERSCAN_API_KEY");
      if (!apiKey) {
        console.error("wallet-lookup: ETHERSCAN_API_KEY is not set.");
        return json(req, { error: "Ethereum import isn't configured yet." }, 503);
      }
      balances = await ethereumBalances(apiKey, address);
    }
    return json(req, { chain, address, balances, asOf: new Date().toISOString() });
  } catch (error) {
    if (error instanceof LookupError) {
      console.error(`wallet-lookup ${chain}: ${error.message}`);
      return json(req, { error: error.publicMessage }, error.status);
    }
    console.error(`wallet-lookup ${chain}: ${error instanceof Error ? error.message : String(error)}`);
    return json(req, { error: "We couldn't read that wallet. Try again in a minute." }, 502);
  }
});
