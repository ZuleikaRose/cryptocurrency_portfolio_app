import { priceHistory } from "../data/research.js";

const INCREASES = new Set(["buy", "transfer-in"]);

export const transactionTypes = [
  { id: "buy", label: "Buy" },
  { id: "sell", label: "Sell" },
  { id: "transfer-in", label: "Transfer in" },
  { id: "transfer-out", label: "Transfer out" },
];

const byDate = (a, b) => new Date(a.date) - new Date(b.date) || String(a.id).localeCompare(String(b.id));

// Average-cost holdings (fees count toward cost on buys and reduce proceeds on sells).
export function computeHoldings(transactions, coins) {
  const map = new Map();
  [...transactions].sort(byDate).forEach((tx) => {
    const entry = map.get(tx.coinId) ?? { coinId: tx.coinId, amount: 0, cost: 0, invested: 0, realized: 0, transactions: [] };
    entry.transactions.push(tx);
    if (INCREASES.has(tx.type)) {
      const cost = tx.amount * tx.price + (tx.fee || 0);
      entry.amount += tx.amount;
      entry.cost += cost;
      entry.invested += cost;
    } else {
      const avg = entry.amount ? entry.cost / entry.amount : 0;
      const sold = Math.min(tx.amount, entry.amount);
      if (tx.type === "sell") entry.realized += sold * tx.price - (tx.fee || 0) - sold * avg;
      entry.amount -= sold;
      entry.cost -= sold * avg;
    }
    map.set(tx.coinId, entry);
  });

  return [...map.values()]
    .map((entry) => {
      const coin = coins.find((item) => item.id === entry.coinId);
      if (!coin) return null;
      const value = entry.amount * coin.price;
      const unrealized = value - entry.cost;
      return {
        ...entry,
        coin,
        value,
        avgPrice: entry.amount ? entry.cost / entry.amount : 0,
        pnl: unrealized + entry.realized,
        pnlPct: entry.invested ? ((unrealized + entry.realized) / entry.invested) * 100 : 0,
        change24h: value - value / (1 + coin.change24h / 100),
      };
    })
    .filter(Boolean);
}

export function summarize(holdings) {
  const value = holdings.reduce((sum, item) => sum + item.value, 0);
  const change24h = holdings.reduce((sum, item) => sum + item.change24h, 0);
  const pnl = holdings.reduce((sum, item) => sum + item.pnl, 0);
  const invested = holdings.reduce((sum, item) => sum + item.invested, 0);
  return {
    value,
    change24h,
    change24hPct: value - change24h ? (change24h / (value - change24h)) * 100 : 0,
    pnl,
    pnlPct: invested ? (pnl / invested) * 100 : 0,
  };
}

export function amountHeld(transactions, coinId, excludeId) {
  return transactions
    .filter((tx) => tx.coinId === coinId && tx.id !== excludeId)
    .reduce((sum, tx) => sum + (INCREASES.has(tx.type) ? tx.amount : -tx.amount), 0);
}

// Nearest sample price at a moment, from the coin's chart history.
export function priceAt(coin, time) {
  const days = (Date.now() - time) / 86_400_000;
  const range = days <= 1 ? "1D" : days <= 7 ? "7D" : days <= 30 ? "1M" : days <= 90 ? "3M" : days <= 365 ? "1Y" : "ALL";
  const points = priceHistory(coin, range);
  if (!points.length) return coin.price;
  let best = points[points.length - 1];
  for (const point of points) {
    if (Math.abs(point.time - time) < Math.abs(best.time - time)) best = point;
  }
  return best.price;
}

const rangeDays = { "24h": 1, "7D": 7, "1M": 30, "3M": 90, "1Y": 365 };
const chartRange = { "24h": "1D", "7D": "7D", "1M": "1M", "3M": "3M", "1Y": "1Y", ALL: "ALL" };

// Portfolio value over time: amount held at each moment × that moment's sample price.
export function valueHistory(transactions, coins, rangeId) {
  if (!transactions.length) return [];
  const now = Date.now();
  const firstTx = Math.min(...transactions.map((tx) => new Date(tx.date).getTime()));
  const start = rangeId === "ALL" ? firstTx : now - rangeDays[rangeId] * 86_400_000;
  const steps = 72;
  const sorted = [...transactions].sort(byDate);
  const coinIds = [...new Set(sorted.map((tx) => tx.coinId))];
  const series = Object.fromEntries(
    coinIds.map((id) => {
      const coin = coins.find((item) => item.id === id);
      return [id, coin ? priceHistory(coin, chartRange[rangeId]) : []];
    }),
  );
  const lookup = (id, time) => {
    const points = series[id];
    if (!points.length) return 0;
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (points[mid].time < time) low = mid + 1;
      else high = mid;
    }
    return points[low].price;
  };

  const out = [];
  for (let i = 0; i <= steps; i += 1) {
    const time = start + ((now - start) * i) / steps;
    let value = 0;
    coinIds.forEach((id) => {
      const held = sorted
        .filter((tx) => tx.coinId === id && new Date(tx.date).getTime() <= time)
        .reduce((sum, tx) => sum + (INCREASES.has(tx.type) ? tx.amount : -tx.amount), 0);
      if (held > 0) value += held * (i === steps ? coins.find((coin) => coin.id === id)?.price ?? 0 : lookup(id, time));
    });
    out.push({ time, price: value });
  }
  return out;
}
