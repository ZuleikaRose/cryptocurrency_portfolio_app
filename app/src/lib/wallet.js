// Read-only wallet import (US-6.4, 11-portfolio.md). Public Bitcoin and Ethereum addresses are
// looked up by the wallet-lookup Edge Function, which holds the explorer key and rate-limits calls.
// The browser never sends anything that looks like a recovery phrase or a private key.
import { amountHeld } from "./portfolio.js";
import { supabase } from "./supabase.js";

export const WALLET_CHAINS = [
  { id: "bitcoin", label: "Bitcoin", coinId: "bitcoin" },
  { id: "ethereum", label: "Ethereum", coinId: "ethereum" },
];

const BTC_BASE58 = /^[13][1-9A-HJ-NP-Za-km-z]{25,34}$/;
const BTC_BECH32 = /^bc1[qp][02-9ac-hj-np-z]{38,58}$/i;
const ETH_ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const DUST = 1e-12; // smallest amount cpa.transactions stores (numeric(30,12))

// Returns a reason when the input looks like a secret rather than an address, else null.
export function secretWarning(input) {
  const text = input.trim();
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length >= 12 && words.every((word) => /^[a-z]{3,8}$/.test(word))) {
    return "That looks like a recovery phrase. Never share it, with CPA or anyone. Clear it and paste the wallet's public address.";
  }
  if (/^(0x)?[0-9a-fA-F]{64}$/.test(text)) {
    return "That looks like a private key. Never share it. An Ethereum address is 0x followed by 40 characters.";
  }
  if (/^[5KLc9][1-9A-HJ-NP-Za-km-z]{50,51}$/.test(text)) {
    return "That looks like a Bitcoin private key. Never share it. Paste the public address that starts with 1, 3 or bc1.";
  }
  if (/^[xyztuv]prv[1-9A-HJ-NP-Za-km-z]{100,}$/.test(text)) {
    return "That's an extended private key. Never share it. Paste one public address instead.";
  }
  return null;
}

// "bitcoin", "ethereum" or null, from the address's format.
export function chainFor(input) {
  const text = input.trim();
  if (ETH_ADDRESS.test(text)) return "ethereum";
  if (BTC_BASE58.test(text)) return "bitcoin";
  if (BTC_BECH32.test(text) && (text === text.toLowerCase() || text === text.toUpperCase())) return "bitcoin";
  return null;
}

// One spelling per address, so a re-import finds the earlier one: Ethereum and bech32 Bitcoin
// addresses are case-insensitive and stored lowercase; base58 Bitcoin addresses are case-sensitive.
export function normaliseAddress(input) {
  const text = input.trim();
  return chainFor(text) && !BTC_BASE58.test(text) ? text.toLowerCase() : text;
}

// bc1qar0s…zwf5mdq: enough to tell addresses apart in a note or list.
export const shortAddress = (address) => (address.length > 16 ? `${address.slice(0, 8)}…${address.slice(-6)}` : address);
export const walletNote = (address) => `Wallet import ${shortAddress(address)}`;

// Fixed balances for the demo account, which has no Supabase session to call the function with.
const DEMO_BALANCES = {
  bitcoin: [{ coinId: "bitcoin", amount: 0.25 }],
  ethereum: [{ coinId: "ethereum", amount: 1.5 }, { coinId: "chainlink", amount: 120 }, { coinId: "arbitrum", amount: 800 }],
};

// Calls the Edge Function. Resolves { balances, asOf, demo } or throws an Error with a plain message.
export async function lookupWallet(chain, address, { demo = false } = {}) {
  if (demo) return { balances: DEMO_BALANCES[chain], asOf: new Date().toISOString(), demo: true };
  if (!supabase) throw new Error("Wallet import needs CPA's Supabase connection, which isn't set up in this build.");
  let response;
  try {
    response = await supabase.functions.invoke("wallet-lookup", { body: { chain, address: normaliseAddress(address) } });
  } catch {
    throw new Error("Wallet import is unavailable right now. Try again later.");
  }
  const { data, error } = response;
  if (error) {
    // The function's own message (bad address, rate limit) is in the response body.
    let message = null;
    try {
      message = (await error.context?.json?.())?.error ?? null;
    } catch {
      // Not JSON: fall back below.
    }
    // A fetch error is offline, or the service refusing the request (e.g. not deployed yet).
    if (!message && error.name === "FunctionsFetchError") {
      message = navigator.onLine === false
        ? "You're offline. Connect and try again."
        : "Wallet import is unavailable right now. Try again later.";
    }
    if (!message && error.context?.status === 404) message = "Wallet import isn't available yet. The wallet service hasn't been deployed.";
    throw new Error(message ?? "We couldn't read that wallet. Try again in a minute.");
  }
  if (!data || !Array.isArray(data.balances)) throw new Error("We couldn't read that wallet. Try again in a minute.");
  return { balances: data.balances, asOf: data.asOf, demo: false };
}

// What importing these balances would change. Earlier imports of the same address are
// recognised by their note, so only the difference is recorded: a transfer in when the wallet
// holds more, a transfer out when it holds less. New rows use today's price as cost basis.
export function walletImportPlan(balances, address, transactions, coins, now = Date.now()) {
  const note = walletNote(normaliseAddress(address));
  const byId = new Map(coins.map((coin) => [coin.id, coin]));
  const imported = new Map();
  transactions.filter((tx) => tx.note === note).forEach((tx) => {
    const sign = tx.type === "transfer-in" || tx.type === "buy" ? 1 : -1;
    imported.set(tx.coinId, (imported.get(tx.coinId) ?? 0) + sign * tx.amount);
  });
  const wallet = new Map();
  balances.forEach(({ coinId, amount }) => {
    if (byId.has(coinId) && Number.isFinite(amount) && amount >= 0) wallet.set(coinId, (wallet.get(coinId) ?? 0) + amount);
  });

  const date = new Date(now).toISOString();
  const rows = [];
  new Set([...wallet.keys(), ...imported.keys()]).forEach((coinId) => {
    const coin = byId.get(coinId);
    if (!coin) return;
    const balance = wallet.get(coinId) ?? 0;
    const before = imported.get(coinId) ?? 0;
    const delta = Number((balance - before).toFixed(12));
    const row = { coin, balance, before, delta, tx: null, reason: null };
    if (Math.abs(delta) < DUST) {
      row.reason = before ? "Already up to date." : "No balance.";
    } else if (delta > 0) {
      row.tx = { coinId, type: "transfer-in", amount: delta, price: coin.price, fee: 0, date, note };
    } else if (amountHeld(transactions, coinId, null) + DUST < -delta) {
      row.reason = `The wallet holds ${coin.symbol} less than before, but your portfolio holds less than that. Check your transactions.`;
    } else {
      row.tx = { coinId, type: "transfer-out", amount: -delta, price: coin.price, fee: 0, date, note };
    }
    rows.push(row);
  });
  rows.sort((a, b) => b.balance * b.coin.price - a.balance * a.coin.price || a.coin.name.localeCompare(b.coin.name));
  return { rows, transactions: rows.map((row) => row.tx).filter(Boolean) };
}
