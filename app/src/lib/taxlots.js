// Tax-lot report (clarification 28): each sell's realized gain, matched to the buys and transfers
// in it came from, by FIFO or average cost. Derived from transactions, never stored, and not tax
// advice: rules differ by country.
import { numberCell, textCell } from "./csv.js";

export const TAX_METHODS = [
  { id: "fifo", label: "FIFO" },
  { id: "average", label: "Average cost" },
];
export const TAX_CSV_COLUMNS = [
  "date_sold", "date_acquired", "coin_id", "symbol", "amount", "proceeds_usd", "cost_basis_usd", "gain_usd", "holding_days", "term", "method",
];

const DAY_MS = 86_400_000;
const EPSILON = 1e-12;
const INCREASES = new Set(["buy", "transfer-in"]);
const byDate = (a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id));

// Held for more than a year, by calendar date (the US long-term rule; other countries differ).
function isLongTerm(acquired, sold) {
  const anniversary = new Date(acquired);
  anniversary.setUTCFullYear(anniversary.getUTCFullYear() + 1);
  return sold > anniversary.getTime();
}

// Removes `amount` from the oldest lots first and returns the pieces taken, with their cost.
function takeOldest(lots, amount) {
  const taken = [];
  let left = amount;
  while (left > EPSILON && lots.length) {
    const lot = lots[0];
    const part = Math.min(lot.amount, left);
    const cost = lot.amount ? (lot.cost * part) / lot.amount : 0;
    taken.push({ time: lot.time, amount: part, cost });
    lot.amount -= part;
    lot.cost -= cost;
    left -= part;
    if (lot.amount <= EPSILON) lots.shift();
  }
  return taken;
}

// Average cost: every unit costs the pool's average; the oldest lots still give the dates.
function takeAverage(lots, amount) {
  const held = lots.reduce((sum, lot) => sum + lot.amount, 0);
  const cost = lots.reduce((sum, lot) => sum + lot.cost, 0);
  const average = held ? cost / held : 0;
  lots.forEach((lot) => {
    lot.cost = lot.amount * average;
  });
  const taken = takeOldest(lots, amount);
  return [{ time: taken.length === 1 ? taken[0].time : null, amount, cost: amount * average }];
}

// Returns { rows, transfersOut, uncovered }. Each row is one sell (average cost) or one lot of a
// sell (FIFO): { id, coinId, symbol, sold, acquired (ms, or null for several lots), amount,
// proceeds, cost, gain, days, term ("short" | "long" | null) }. Buy fees add to cost; sell fees
// reduce proceeds. Transfers out remove lots without a gain; sells beyond the amount held count
// in `uncovered` and only the held part is reported.
export function taxLotReport(transactions, coins, method = "fifo") {
  const symbols = new Map(coins.map((coin) => [coin.id, coin.symbol]));
  const lotsByCoin = new Map();
  const rows = [];
  let transfersOut = 0;
  let uncovered = 0;

  [...transactions].sort(byDate).forEach((tx) => {
    const lots = lotsByCoin.get(tx.coinId) ?? [];
    lotsByCoin.set(tx.coinId, lots);
    const time = new Date(tx.date).getTime();
    if (INCREASES.has(tx.type)) {
      lots.push({ time, amount: tx.amount, cost: tx.amount * tx.price + (tx.fee || 0) });
      return;
    }
    const held = lots.reduce((sum, lot) => sum + lot.amount, 0);
    if (tx.amount - held > EPSILON) uncovered += 1;
    const amount = Math.min(tx.amount, held);
    if (amount <= EPSILON) return;
    const taken = method === "average" ? takeAverage(lots, amount) : takeOldest(lots, amount);
    if (tx.type !== "sell") {
      transfersOut += 1;
      return;
    }
    const proceeds = amount * tx.price - (tx.fee || 0);
    taken.forEach((part, index) => {
      const share = (proceeds * part.amount) / amount;
      const fifo = method !== "average";
      rows.push({
        id: `${tx.id}:${index}`,
        coinId: tx.coinId,
        symbol: symbols.get(tx.coinId) ?? tx.coinId.toUpperCase(),
        sold: time,
        acquired: part.time,
        amount: part.amount,
        proceeds: share,
        cost: part.cost,
        gain: share - part.cost,
        days: fifo ? Math.floor((time - part.time) / DAY_MS) : null,
        term: fifo ? (isLongTerm(part.time, time) ? "long" : "short") : null,
      });
    });
  });
  return { rows, transfersOut, uncovered };
}

// Years with at least one sell, newest first (local time, like the dates the user entered).
export const taxYears = (rows) => [...new Set(rows.map((row) => new Date(row.sold).getFullYear()))].sort((a, b) => b - a);

export const rowsInYear = (rows, year) => (year === "all" ? rows : rows.filter((row) => new Date(row.sold).getFullYear() === Number(year)));

export function taxTotals(rows) {
  const sum = (pick) => rows.reduce((total, row) => total + pick(row), 0);
  return {
    sales: new Set(rows.map((row) => row.id.split(":")[0])).size,
    proceeds: sum((row) => row.proceeds),
    cost: sum((row) => row.cost),
    gain: sum((row) => row.gain),
    shortTerm: sum((row) => (row.term === "short" ? row.gain : 0)),
    longTerm: sum((row) => (row.term === "long" ? row.gain : 0)),
  };
}

const isoDay = (time) => new Date(time).toISOString().slice(0, 10);

export function taxLotsToCsv(rows, method) {
  const lines = rows.map((row) => [
    textCell(isoDay(row.sold)),
    textCell(row.acquired == null ? "various" : isoDay(row.acquired)),
    textCell(row.coinId),
    textCell(row.symbol),
    numberCell(row.amount),
    numberCell(Number(row.proceeds.toFixed(2))),
    numberCell(Number(row.cost.toFixed(2))),
    numberCell(Number(row.gain.toFixed(2))),
    row.days == null ? "" : String(row.days),
    textCell(row.term ?? ""),
    textCell(method),
  ].join(","));
  return `${[TAX_CSV_COLUMNS.join(","), ...lines].join("\r\n")}\r\n`;
}
