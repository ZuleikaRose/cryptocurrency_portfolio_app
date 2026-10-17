// Exchanges and token sales (sample data, invented names), plus the in-memory search index.
import { funds, researchFor, seeded } from "./research.js";

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

const day = (text) => new Date(`${text}T14:00:00Z`);

// Token sales (09-token-sales.md). Status is derived from today's date.
export const tokenSales = [
  { id: "nimbus-ai", name: "Nimbus AI", symbol: "NIM", type: "IDO", launchpad: "Polar Pad", start: day("2026-10-22"), end: day("2026-10-24"), raise: 1.5e6, price: 0.045, fdv: 45e6 },
  { id: "orbiter", name: "Orbiter", symbol: "ORBT", type: "IEO", launchpad: "OrbX Launch", start: day("2026-11-02"), end: day("2026-11-04"), raise: 3e6, price: 0.12, fdv: 120e6 },
  { id: "tessel", name: "Tessel", symbol: "TSL", type: "ICO", launchpad: "Direct", start: day("2026-11-10"), end: day("2026-11-30"), raise: 8e6, price: 0.3, fdv: 300e6 },
  { id: "quill-rwa", name: "Quill RWA", symbol: "QRW", type: "IDO", launchpad: "Polar Pad", start: day("2026-11-18"), end: day("2026-11-19"), raise: 2.2e6, price: 0.08, fdv: 80e6 },
  { id: "verdant", name: "Verdant", symbol: "VRD", type: "IDO", launchpad: "Polar Pad", start: day("2026-10-15"), end: day("2026-10-19"), raise: 1.8e6, price: 0.06, fdv: 60e6 },
  { id: "halcyon", name: "Halcyon", symbol: "HLC", type: "IEO", launchpad: "OrbX Launch", start: day("2026-10-16"), end: day("2026-10-20"), raise: 4e6, price: 0.2, fdv: 200e6 },
  { id: "driftnet-ido", name: "Driftnet", symbol: "DRF", coinId: "driftnet", type: "IDO", launchpad: "Polar Pad", start: day("2026-10-08"), end: day("2026-10-10"), raise: 1.2e6, price: 0.12, fdv: 48e6, athRoi: 7.1 },
  { id: "kelp", name: "Kelp", symbol: "KLP", type: "IDO", launchpad: "Polar Pad", start: day("2026-03-02"), end: day("2026-03-04"), raise: 0.9e6, price: 0.5, fdv: 50e6, currentPrice: 0.11, athRoi: 1.8 },
];

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
    .filter((exchange) => score(exchange.name) > 0)
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
