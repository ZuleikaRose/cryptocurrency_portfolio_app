// Explorer lookups for the wallet-lookup Edge Function (US-6.4): address checks, unit
// conversion, and balance and transfer-history reads from mempool.space (Bitcoin) and
// Etherscan (Ethereum).

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
const TXID = /^[0-9a-f]{64}$/;

export type Balance = { coinId: string; amount: number };

// Transfer history for cost basis: the net change per coin per UTC day, oldest first. "complete"
// is false when older history wasn't read; the earliest balance then counts as an opening one.
export type HistoryEntry = { coinId: string; day: string; amount: number; price: number | null };
export type History = { entries: HistoryEntry[]; complete: boolean };
export type Wallet = { balances: Balance[]; history: History };

const MAX_HISTORY_ENTRIES = 300;
const BTC_HISTORY_PAGES = 8; // mempool.space returns 25 confirmed transactions a page
const BTC_PAGE = 25;
const ETH_PAGE = 1000;

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
  if (raw < 0n) return -fromUnits(-raw, decimals);
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

export const utcDay = (seconds: number) => new Date(seconds * 1000).toISOString().slice(0, 10);

// Signed base units per coin and UTC day.
export class DayTotals {
  private totals = new Map<string, { coinId: string; day: string; decimals: number; raw: bigint }>();

  add(coinId: string, decimals: number, seconds: number, raw: bigint) {
    if (!Number.isFinite(seconds) || seconds <= 0 || raw === 0n) return;
    const day = utcDay(seconds);
    const key = `${coinId} ${day}`;
    const entry = this.totals.get(key) ?? { coinId, day, decimals, raw: 0n };
    entry.raw += raw;
    this.totals.set(key, entry);
  }

  // Days on or before cutoffDay may be missing transfers, so they're left to the opening balance.
  history(cutoffDay: string | null): History {
    let entries: HistoryEntry[] = [...this.totals.values()]
      .filter((entry) => entry.raw !== 0n && (!cutoffDay || entry.day > cutoffDay))
      .sort((a, b) => a.day.localeCompare(b.day) || a.coinId.localeCompare(b.coinId))
      .map(({ coinId, day, decimals, raw }) => ({ coinId, day, amount: fromUnits(raw, decimals), price: null }));
    let complete = !cutoffDay;
    if (entries.length > MAX_HISTORY_ENTRIES) {
      // Keep whole days, newest first, so no day is split.
      const cut = entries[entries.length - MAX_HISTORY_ENTRIES].day;
      entries = entries.filter((entry) => entry.day > cut);
      complete = false;
    }
    return { entries, complete };
  }
}

// GET a JSON document; error bodies are drained so the connection is released.
export async function getJson(url: string, explorer: string): Promise<{ status: number; body: unknown }> {
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

type MempoolTx = {
  txid?: unknown;
  status?: { block_time?: unknown };
  vin?: { prevout?: { scriptpubkey_address?: unknown; value?: unknown } | null }[];
  vout?: { scriptpubkey_address?: unknown; value?: unknown }[];
};

export async function bitcoinWallet(address: string): Promise<Wallet> {
  const { status, body: reply } = await getJson(`${MEMPOOL_URL}/address/${address}`, "Bitcoin");
  if (status === 400) throw new LookupError(400, "That isn't a valid Bitcoin address.", "mempool.space rejected the address");
  if (status !== 200) throw new LookupError(502, "We couldn't reach the Bitcoin explorer. Try again in a minute.", `mempool.space ${status}`);
  const body = (reply ?? {}) as { chain_stats?: { funded_txo_sum?: unknown; spent_txo_sum?: unknown; tx_count?: unknown } };
  // Confirmed balance only; unconfirmed transactions can still change.
  const funded = toBigInt(body.chain_stats?.funded_txo_sum ?? 0);
  const spent = toBigInt(body.chain_stats?.spent_txo_sum ?? 0);
  const sats = funded > spent ? funded - spent : 0n;
  const balances = sats > 0n ? [{ coinId: "bitcoin", amount: fromUnits(sats, 8) }] : [];

  // Net change per confirmed transaction: outputs paid to the address less inputs it spent (so
  // fees are included), newest first, 25 a page.
  const totals = new DayTotals();
  let after = "";
  let oldest = Infinity;
  let complete = false;
  for (let page = 0; page < BTC_HISTORY_PAGES; page += 1) {
    const { status: pageStatus, body: pageBody } = await getJson(`${MEMPOOL_URL}/address/${address}/txs/chain${after}`, "Bitcoin");
    if (pageStatus !== 200) throw new LookupError(502, "We couldn't read that wallet's history. Try again in a minute.", `mempool.space txs ${pageStatus}`);
    const txs = Array.isArray(pageBody) ? pageBody as MempoolTx[] : [];
    for (const tx of txs) {
      const time = Number(tx.status?.block_time);
      let raw = 0n;
      for (const output of tx.vout ?? []) if (output?.scriptpubkey_address === address) raw += toBigInt(output.value);
      for (const input of tx.vin ?? []) if (input?.prevout?.scriptpubkey_address === address) raw -= toBigInt(input.prevout.value);
      totals.add("bitcoin", 8, time, raw);
      if (Number.isFinite(time)) oldest = Math.min(oldest, time);
    }
    const last = txs.length ? String(txs[txs.length - 1].txid) : "";
    if (txs.length < BTC_PAGE || !TXID.test(last)) {
      complete = true;
      break;
    }
    after = `/${last}`;
  }
  return { balances, history: totals.history(complete || !Number.isFinite(oldest) ? null : utcDay(oldest)) };
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

type EtherscanTransfer = {
  timeStamp?: unknown;
  from?: unknown;
  to?: unknown;
  value?: unknown;
  isError?: unknown;
  gasUsed?: unknown;
  gasPrice?: unknown;
  contractAddress?: unknown;
};

// The newest 1,000 of each list; returns the list and, when it was cut short, its oldest time.
async function transferList(apiKey: string, action: string, address: string): Promise<{ list: EtherscanTransfer[]; cutoff: number | null }> {
  await sleep(ETHERSCAN_GAP_MS);
  const result = await etherscan(apiKey, { module: "account", action, address, page: "1", offset: String(ETH_PAGE), sort: "desc" });
  const list = Array.isArray(result) ? result as EtherscanTransfer[] : [];
  const cutoff = list.length >= ETH_PAGE ? Number(list[list.length - 1].timeStamp) : null;
  return { list, cutoff: Number.isFinite(cutoff) ? cutoff : null };
}

const lower = (value: unknown) => String(value ?? "").toLowerCase();

export async function ethereumWallet(apiKey: string, address: string): Promise<Wallet> {
  const balanceTotals = new Map<string, number>();
  const addBalance = (coinId: string, amount: number) => {
    if (amount > 0) balanceTotals.set(coinId, (balanceTotals.get(coinId) ?? 0) + amount);
  };
  addBalance("ethereum", fromUnits(toBigInt(await etherscan(apiKey, { module: "account", action: "balance", address, tag: "latest" })), 18));

  const normal = await transferList(apiKey, "txlist", address);
  const internal = await transferList(apiKey, "txlistinternal", address);
  const tokens = await transferList(apiKey, "tokentx", address);

  // Only tokens the address has moved need a balance call. An address with more than 1,000
  // token transfers gets every listed token checked.
  const touched = new Set(tokens.list.map((item) => lower(item.contractAddress)));
  const checked = tokens.list.length >= ETH_PAGE ? TOKENS : TOKENS.filter((token) => touched.has(token.contract));
  for (const token of checked) {
    await sleep(ETHERSCAN_GAP_MS);
    const raw = await etherscan(apiKey, {
      module: "account", action: "tokenbalance", contractaddress: token.contract, address, tag: "latest",
    });
    addBalance(token.coinId, fromUnits(toBigInt(raw), token.decimals));
  }

  const totals = new DayTotals();
  // Normal transactions: value in and out, and gas on every transaction the address sent (a
  // failed one still pays gas but moves no value).
  for (const tx of normal.list) {
    const time = Number(tx.timeStamp);
    const ok = String(tx.isError ?? "0") !== "1";
    let raw = 0n;
    if (ok && lower(tx.to) === address) raw += toBigInt(tx.value);
    if (lower(tx.from) === address) {
      if (ok) raw -= toBigInt(tx.value);
      raw -= toBigInt(tx.gasUsed ?? 0) * toBigInt(tx.gasPrice ?? 0);
    }
    totals.add("ethereum", 18, time, raw);
  }
  // Internal transactions: ETH moved by contracts (withdrawals, swaps paid out in ETH).
  for (const tx of internal.list) {
    if (String(tx.isError ?? "0") === "1") continue;
    const time = Number(tx.timeStamp);
    let raw = 0n;
    if (lower(tx.to) === address) raw += toBigInt(tx.value);
    if (lower(tx.from) === address) raw -= toBigInt(tx.value);
    totals.add("ethereum", 18, time, raw);
  }
  // Token transfers, for the listed contracts only.
  const byContract = new Map(TOKENS.map((token) => [token.contract, token]));
  for (const tx of tokens.list) {
    const token = byContract.get(lower(tx.contractAddress));
    if (!token) continue;
    let raw = 0n;
    if (lower(tx.to) === address) raw += toBigInt(tx.value);
    if (lower(tx.from) === address) raw -= toBigInt(tx.value);
    totals.add(token.coinId, token.decimals, Number(tx.timeStamp), raw);
  }

  // Any list cut short leaves the days up to its oldest transfer incomplete.
  const cutoffs = [normal.cutoff, internal.cutoff, tokens.cutoff].filter((value): value is number => value !== null);
  const history = totals.history(cutoffs.length ? utcDay(Math.max(...cutoffs)) : null);
  return { balances: [...balanceTotals].map(([coinId, amount]) => ({ coinId, amount })), history };
}
