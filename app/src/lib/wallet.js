// Read-only wallet import (US-6.4, 11-portfolio.md). Public Bitcoin and Ethereum addresses are
// looked up by the wallet-lookup Edge Function, which holds the explorer key and rate-limits calls.
// The browser never sends anything that looks like a recovery phrase or a private key.
import { amountHeld, priceAt } from "./portfolio.js";
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

// Fixed wallets for the demo account, which has no Supabase session to call the function with:
// transfers as [coinId, days ago, amount]. Their prices come from the sample price history.
const DEMO_TRANSFERS = {
  bitcoin: [["bitcoin", 320, 0.1], ["bitcoin", 190, 0.2], ["bitcoin", 45, -0.05]],
  ethereum: [["ethereum", 410, 2], ["chainlink", 260, 120], ["arbitrum", 150, 800], ["ethereum", 30, -0.5]],
};

function demoWallet(chain, now) {
  const entries = DEMO_TRANSFERS[chain].map(([coinId, daysAgo, amount]) => ({
    coinId,
    day: new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10),
    amount,
    price: null,
  }));
  const totals = new Map();
  entries.forEach(({ coinId, amount }) => totals.set(coinId, (totals.get(coinId) ?? 0) + amount));
  const balances = [...totals].map(([coinId, amount]) => ({ coinId, amount: Number(amount.toFixed(12)) }));
  return { balances, history: { entries, complete: true }, asOf: new Date(now).toISOString(), demo: true };
}

// Calls the Edge Function. Resolves { balances, history, asOf, demo } or throws an Error with a
// plain message.
export async function lookupWallet(chain, address, { demo = false } = {}) {
  if (demo) return demoWallet(chain, Date.now());
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
  // An older deploy returns balances only; the plan then falls back to today's price.
  const entries = Array.isArray(data.history?.entries) ? data.history.entries : [];
  return { balances: data.balances, history: { entries, complete: data.history?.complete === true }, asOf: data.asOf, demo: false };
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const round = (value) => Number(value.toFixed(12));
const signed = (tx) => (tx.type === "transfer-in" || tx.type === "buy" ? tx.amount : -tx.amount);

// What importing this wallet would change (US-6.4). Earlier imports of the same address are
// recognised by their note.
// - First import of a coin: each day's net transfer, dated that day at that day's closing price.
//   When older history wasn't read, the balance before it is an opening transfer in at the
//   earliest day read.
// - Re-import: only days after the last imported one.
// - Anything the history doesn't explain (a staking payout, an unlisted contract) is an adjustment
//   at today's price, so the holding always matches the wallet.
// Days without a closing price use today's price; `unpriced` counts them.
export function walletImportPlan(wallet, address, transactions, coins, now = Date.now()) {
  const { balances = [], history = { entries: [], complete: true }, demo = false } = wallet;
  const note = walletNote(normaliseAddress(address));
  const byId = new Map(coins.map((coin) => [coin.id, coin]));

  const imported = new Map();
  transactions.filter((tx) => tx.note === note).forEach((tx) => {
    const entry = imported.get(tx.coinId) ?? { amount: 0, lastDay: "" };
    entry.amount += signed(tx);
    const day = new Date(tx.date).toISOString().slice(0, 10);
    if (day > entry.lastDay) entry.lastDay = day;
    imported.set(tx.coinId, entry);
  });
  const held = new Map();
  balances.forEach(({ coinId, amount }) => {
    if (byId.has(coinId) && Number.isFinite(amount) && amount >= 0) held.set(coinId, (held.get(coinId) ?? 0) + amount);
  });
  const days = new Map();
  history.entries.forEach((entry) => {
    if (!byId.has(entry.coinId) || !DAY.test(entry.day) || !Number.isFinite(entry.amount) || Math.abs(entry.amount) < DUST) return;
    days.set(entry.coinId, [...(days.get(entry.coinId) ?? []), entry]);
  });

  const today = new Date(now).toISOString();
  const rows = [];
  new Set([...held.keys(), ...imported.keys(), ...days.keys()]).forEach((coinId) => {
    const coin = byId.get(coinId);
    // An earlier import can hold a coin CPA no longer lists.
    if (!coin) return;
    const balance = held.get(coinId) ?? 0;
    const earlier = imported.get(coinId);
    const before = earlier?.amount ?? 0;
    const transfers = (days.get(coinId) ?? [])
      .filter((entry) => !earlier || entry.day > earlier.lastDay)
      .sort((a, b) => a.day.localeCompare(b.day));
    const row = { coin, balance, before, txs: [], transfers: transfers.length, firstDay: transfers[0]?.day ?? null, openingDay: null, adjustment: 0, unpriced: 0, reason: null };
    const add = (type, amount, price, date) => row.txs.push({ coinId, type, amount: round(amount), price, fee: 0, date, note });
    const priceOn = (entry) => {
      if (entry.price > 0) return entry.price;
      if (demo) return priceAt(coin, Date.parse(`${entry.day}T12:00:00Z`));
      row.unpriced += 1;
      return coin.price;
    };

    const net = transfers.reduce((sum, entry) => sum + entry.amount, 0);
    const opening = round(balance - net);
    if (!earlier && !history.complete && transfers.length && opening >= DUST) {
      row.openingDay = transfers[0].day;
      add("transfer-in", opening, priceOn(transfers[0]), `${transfers[0].day}T00:00:00.000Z`);
    }
    transfers.forEach((entry) => {
      add(entry.amount > 0 ? "transfer-in" : "transfer-out", Math.abs(entry.amount), priceOn(entry), `${entry.day}T12:00:00.000Z`);
    });

    const recorded = row.txs.reduce((sum, tx) => sum + signed(tx), 0);
    const rest = round(balance - before - recorded);
    if (rest >= DUST) {
      row.adjustment = rest;
      add("transfer-in", rest, coin.price, today);
    } else if (rest <= -DUST) {
      if (amountHeld(transactions, coinId, null) + recorded + DUST < -rest) {
        row.reason = `The wallet holds ${coin.symbol} less than before, but your portfolio holds less than that. Check your transactions.`;
      } else {
        row.adjustment = rest;
        add("transfer-out", -rest, coin.price, today);
      }
    }
    if (!row.txs.length && !row.reason) row.reason = before ? "Already up to date." : "No balance.";
    rows.push(row);
  });
  rows.sort((a, b) => b.balance * b.coin.price - a.balance * a.coin.price || a.coin.name.localeCompare(b.coin.name));
  return { rows, transactions: rows.flatMap((row) => row.txs) };
}
