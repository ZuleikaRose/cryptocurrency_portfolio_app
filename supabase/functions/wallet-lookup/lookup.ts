// Explorer lookups for the wallet-lookup Edge Function (US-6.4): address checks, unit
// conversion, and balance reads from mempool.space (Bitcoin) and Etherscan (Ethereum).

const MEMPOOL_URL = "https://mempool.space/api";
const ETHERSCAN_URL = "https://api.etherscan.io/v2/api";
// Etherscan's free plan allows 3 requests a second; calls are spaced to stay under it.
const ETHERSCAN_GAP_MS = 400;
const FETCH_TIMEOUT_MS = 10_000;

// ERC-20 tokens CPA lists, on Ethereum mainnet (checked against the Uniswap default token list,
// Oct 25, 2026). MATIC and POL both count toward Polygon, since MATIC converts 1:1.
const TOKENS: { coinId: string; contract: string; decimals: number }[] = [
  { coinId: "tether", contract: "0xdac17f958d2ee523a2206206994597c13d831ec7", decimals: 6 },
  { coinId: "usd-coin", contract: "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48", decimals: 6 },
  { coinId: "shiba-inu", contract: "0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce", decimals: 18 },
  { coinId: "chainlink", contract: "0x514910771af9ca656af840dff83e8264ecf986ca", decimals: 18 },
  { coinId: "uniswap", contract: "0x1f9840a85d5af5bf1d1762f925bdaddc4201f984", decimals: 18 },
  { coinId: "polygon", contract: "0x455e53cbb86018ac2b8092fdcd39d8444affc3f6", decimals: 18 },
  { coinId: "polygon", contract: "0x7d1afa7b718fb893db30a3abc0cfc608aacfebb0", decimals: 18 },
  { coinId: "render", contract: "0x6de037ef9ad2725eb40118bb1702ebb27e4aeb24", decimals: 18 },
  { coinId: "fetch-ai", contract: "0xaea46a60368a7bd060eec7df8cba43b7ef41ad85", decimals: 18 },
  { coinId: "immutable", contract: "0xf57e7e7c23978c3caec3c3548e3d615c346e79ff", decimals: 18 },
  { coinId: "arbitrum", contract: "0xb50721bcf8d664c30412cfbc6cf7a15145234ad1", decimals: 18 },
  { coinId: "injective", contract: "0xe28b3b32b6c345a34ff64674606124dd5aceca30", decimals: 18 },
  { coinId: "maker", contract: "0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2", decimals: 18 },
  { coinId: "ondo", contract: "0xfaba6f8e4a5e8ab82f62fe7c39859fa577269be3", decimals: 18 },
  { coinId: "aave", contract: "0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9", decimals: 18 },
];

// Legacy (P2PKH, P2SH) base58 addresses, and bech32 SegWit v0 / Taproot v1 addresses.
const BTC_BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const BTC_BECH32 = /^bc1[qp][02-9ac-hj-np-z]{38,58}$/;
const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export type Balance = { coinId: string; amount: number };

export class LookupError extends Error {
  constructor(readonly status: number, readonly publicMessage: string, detail: string) {
    super(detail);
  }
}

// Returns the normalised address, or null when it isn't a public address on that chain.
export function normaliseAddress(chain: string, input: string): string | null {
  const address = input.trim();
  if (chain === "bitcoin") {
    if (BTC_BASE58.test(address)) return address;
    // bech32 is case-insensitive but must not mix cases.
    if (address !== address.toLowerCase() && address !== address.toUpperCase()) return null;
    const lower = address.toLowerCase();
    return BTC_BECH32.test(lower) ? lower : null;
  }
  if (chain === "ethereum") return ETH_ADDRESS.test(address) ? address.toLowerCase() : null;
  return null;
}

// Integer base units (satoshis, wei) to a number of coins, without float error in the division.
export function fromUnits(raw: bigint, decimals: number): number {
  const scale = 10n ** BigInt(decimals);
  const whole = raw / scale;
  const fraction = (raw % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return Number(fraction ? `${whole}.${fraction}` : `${whole}`);
}

function toBigInt(value: unknown): bigint {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return BigInt(value);
  if (typeof value === "string" && /^[0-9]{1,80}$/.test(value)) return BigInt(value);
  throw new LookupError(502, "We couldn't read that wallet's balances. Try again in a minute.", `Unexpected amount: ${String(value).slice(0, 40)}`);
}

// GET a JSON document; error bodies are drained so the connection is released.
async function getJson(url: string, explorer: string): Promise<{ status: number; body: unknown }> {
  let response: Response;
  try {
    response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  } catch (error) {
    throw new LookupError(504, `We couldn't reach the ${explorer} explorer. Try again in a minute.`, `${explorer}: ${error instanceof Error ? error.name : "fetch failed"}`);
  }
  if (!response.ok) {
    await response.body?.cancel();
    return { status: response.status, body: null };
  }
  try {
    return { status: response.status, body: await response.json() };
  } catch {
    throw new LookupError(502, `We couldn't read the ${explorer} explorer's reply. Try again in a minute.`, `${explorer}: reply wasn't JSON`);
  }
}

export async function bitcoinBalances(address: string): Promise<Balance[]> {
  const { status, body: reply } = await getJson(`${MEMPOOL_URL}/address/${address}`, "Bitcoin");
  if (status === 400) throw new LookupError(400, "That isn't a valid Bitcoin address.", "mempool.space rejected the address");
  if (status !== 200) throw new LookupError(502, "We couldn't reach the Bitcoin explorer. Try again in a minute.", `mempool.space ${status}`);
  const body = (reply ?? {}) as { chain_stats?: { funded_txo_sum?: unknown; spent_txo_sum?: unknown } };
  // Confirmed balance only; unconfirmed transactions can still change.
  const funded = toBigInt(body.chain_stats?.funded_txo_sum ?? 0);
  const spent = toBigInt(body.chain_stats?.spent_txo_sum ?? 0);
  const sats = funded > spent ? funded - spent : 0n;
  return sats > 0n ? [{ coinId: "bitcoin", amount: fromUnits(sats, 8) }] : [];
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function etherscan(apiKey: string, params: Record<string, string>): Promise<unknown> {
  const query = new URLSearchParams({ chainid: "1", ...params, apikey: apiKey });
  const { status, body: reply } = await getJson(`${ETHERSCAN_URL}?${query}`, "Ethereum");
  if (status !== 200) throw new LookupError(502, "We couldn't reach the Ethereum explorer. Try again in a minute.", `Etherscan ${status}`);
  const body = (reply ?? {}) as { status?: string; message?: string; result?: unknown };
  if (body.status === "1") return body.result;
  // "No transactions found" is an empty result, not an error.
  if (typeof body.message === "string" && body.message.startsWith("No transactions found")) return [];
  const detail = `Etherscan ${params.action}: ${String(body.message ?? "")} ${String(body.result ?? "").slice(0, 120)}`;
  if (/rate limit/i.test(detail)) throw new LookupError(503, "The Ethereum explorer is busy. Try again in a minute.", detail);
  throw new LookupError(502, "We couldn't read that wallet's balances. Try again in a minute.", detail);
}

export async function ethereumBalances(apiKey: string, address: string): Promise<Balance[]> {
  const totals = new Map<string, number>();
  const add = (coinId: string, amount: number) => {
    if (amount > 0) totals.set(coinId, (totals.get(coinId) ?? 0) + amount);
  };

  add("ethereum", fromUnits(toBigInt(await etherscan(apiKey, { module: "account", action: "balance", address, tag: "latest" })), 18));

  // Only tokens the address has moved need a balance call. The newest 1,000 transfers usually
  // cover them; an address with more history gets every listed token checked.
  await sleep(ETHERSCAN_GAP_MS);
  const transfers = await etherscan(apiKey, {
    module: "account", action: "tokentx", address, page: "1", offset: "1000", sort: "desc",
  });
  const list = Array.isArray(transfers) ? transfers as { contractAddress?: string }[] : [];
  const touched = new Set(list.map((item) => String(item.contractAddress ?? "").toLowerCase()));
  const tokens = list.length >= 1000 ? TOKENS : TOKENS.filter((token) => touched.has(token.contract));

  for (const token of tokens) {
    await sleep(ETHERSCAN_GAP_MS);
    const raw = await etherscan(apiKey, {
      module: "account", action: "tokenbalance", contractaddress: token.contract, address, tag: "latest",
    });
    add(token.coinId, fromUnits(toBigInt(raw), token.decimals));
  }
  return [...totals].map(([coinId, amount]) => ({ coinId, amount }));
}
