// Exchanges and token sales (sample data, invented names), plus the in-memory search index.
import { funds, researchFor, seeded, TODAY } from "./research.js";

export const exchanges = [
  { id: "binance", name: "Binance", type: "Centralized", volume24h: 14.2e9 },
  { id: "coinbase", name: "Coinbase", type: "Centralized", volume24h: 3.1e9 },
  { id: "okx", name: "OKX", type: "Centralized", volume24h: 2.8e9 },
  { id: "bybit", name: "Bybit", type: "Centralized", volume24h: 2.4e9 },
  { id: "kraken", name: "Kraken", type: "Centralized", volume24h: 1.1e9 },
  { id: "uniswap-v3", name: "Uniswap v3", type: "Decentralized", volume24h: 1.6e9 },
  { id: "kucoin", name: "KuCoin", type: "Centralized", volume24h: 840e6 },
  { id: "gate", name: "Gate", type: "Centralized", volume24h: 760e6 },
  { id: "orbx", name: "OrbX Exchange", type: "Centralized", volume24h: 210.4e6 },
];

// Token sales (09-token-sales.md). Dates are relative to today so every tab has content.
const DAY_MS = 86_400_000;
const fromToday = (days) => new Date(TODAY.getTime() + days * DAY_MS);
const sale = (id, name, symbol, type, launchpad, startDays, lengthDays, raise, price, fdv, extra = {}) => ({
  id, name, symbol, type, launchpad, start: fromToday(startDays), end: fromToday(startDays + lengthDays), raise, price, fdv, ...extra,
});

const listedSales = [
  sale("nimbus-ai", "Nimbus AI", "NIM", "IDO", "Polar Pad", 5, 2, 1.5e6, 0.045, 45e6),
  sale("orbiter", "Orbiter", "ORBT", "IEO", "OrbX Launch", 16, 2, 3e6, 0.12, 120e6),
  sale("tessel", "Tessel", "TSL", "ICO", "Direct", 24, 20, 8e6, 0.3, 300e6),
  sale("quill-rwa", "Quill RWA", "QRW", "IDO", "Polar Pad", 32, 1, 2.2e6, 0.08, 80e6),
  sale("verdant", "Verdant", "VRD", "IDO", "Polar Pad", -2, 4, 1.8e6, 0.06, 60e6, { sold: 0.68 }),
  sale("halcyon", "Halcyon", "HLC", "IEO", "OrbX Launch", -1, 4, 4e6, 0.2, 200e6, { sold: 0.41 }),
  sale("driftnet-ido", "Driftnet", "DRF", "IDO", "Polar Pad", -9, 2, 1.2e6, 0.12, 48e6, { coinId: "driftnet", athRoi: 7.1 }),
  sale("kelp", "Kelp", "KLP", "IDO", "Polar Pad", -229, 2, 0.9e6, 0.5, 50e6, { currentPrice: 0.11, athRoi: 1.8 }),
];

// Older completed sales give launchpads a track record (average / median ROI).
const pastStems = ["Aster", "Brook", "Cairn", "Dune", "Ember", "Fable", "Garnet", "Harbor", "Iris", "Jasper", "Kernel", "Lumen", "Maple", "Nectar", "Onyx", "Pylon", "Quarry", "Rill", "Spire", "Thorn"];
const launchpadNames = ["Polar Pad", "OrbX Launch", "Direct"];
function pastSales() {
  const random = seeded("sales:past");
  return pastStems.flatMap((stem, index) =>
    launchpadNames.slice(0, index % 3 === 2 ? 1 : 2).map((launchpad, j) => {
      const price = 0.02 + random() * 0.5;
      const roi = Math.exp((random() - 0.45) * 2.4);
      const symbol = `${stem.slice(0, 3).toUpperCase()}${j ? "X" : ""}`;
      return sale(`${stem.toLowerCase()}-${j}`, `${stem}${j ? " X" : ""}`, symbol, ["IDO", "IEO", "ICO"][Math.floor(random() * 3)], launchpad,
        -(40 + Math.floor(random() * 600)), 2, (0.5 + random() * 4) * 1e6, price, price * (6e8 + random() * 6e8),
        { currentPrice: price * roi, athRoi: roi * (1.2 + random() * 3) });
    }),
  );
}

export const tokenSales = [...listedSales, ...pastSales()];

// Current price of a past sale's token: the live coin when it has one, else the sample figure.
export function saleCurrentPrice(item, coins) {
  if (item.coinId) return coins.find((coin) => coin.id === item.coinId)?.price ?? item.currentPrice ?? null;
  return item.currentPrice ?? null;
}

export function saleStatus(sale, now = Date.now()) {
  if (now < sale.start.getTime()) return "upcoming";
  if (now <= sale.end.getTime()) return "active";
  return "past";
}

const popularity = (id) => Math.floor(seeded(`views:${id}`)() * 10_000);

// Grouped search over coins, funds, exchanges and token sales (US-2.5).
export function searchAll(query, coins) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return { coins: [], funds: [], exchanges: [], sales: [] };
  const score = (text) => {
    const value = text.toLowerCase();
    if (value === q) return 3;
    if (value.startsWith(q)) return 2;
    return value.includes(q) ? 1 : 0;
  };

  const coinHits = coins
    // An exact or prefix ticker match ranks just above the same name match.
    .map((coin) => ({ coin, score: Math.max(score(coin.name), score(coin.symbol) && score(coin.symbol) + 0.5, score(coin.id)) }))
    .filter((hit) => hit.score > 0)
    .sort((a, b) => b.score - a.score || b.coin.marketCap - a.coin.marketCap)
    .map(({ coin }) => {
      const research = researchFor(coin);
      return { kind: "coin", id: coin.id, coin, verified: research.verified, contract: research.contract, views: popularity(coin.id) };
    });

  const fundHits = funds
    .filter((fund) => score(fund.name) > 0)
    .map((fund) => ({ kind: "fund", id: fund.id, fund, views: popularity(fund.id) }));
  const exchangeHits = exchanges
    .filter((exchange) => score(exchange.name) > 0 || "exchanges".startsWith(q))
    .map((exchange) => ({ kind: "exchange", id: exchange.id, exchange, views: popularity(exchange.id) }));
  const saleHits = tokenSales
    .filter((sale) => score(sale.name) > 0 || score(sale.symbol) > 0)
    .map((sale) => ({ kind: "sale", id: sale.id, sale, views: popularity(sale.id) }));

  return { coins: coinHits, funds: fundHits, exchanges: exchangeHits, sales: saleHits };
}

// Where each result type opens.
export function resultPath(hit) {
  if (hit.kind === "coin") return `/coins/${hit.id}`;
  if (hit.kind === "fund") return `/funds/${hit.id}`;
  if (hit.kind === "exchange") return `/search?q=${encodeURIComponent(hit.exchange.name)}&type=exchanges`;
  return `/token-sales?status=${saleStatus(hit.sale)}`;
}
