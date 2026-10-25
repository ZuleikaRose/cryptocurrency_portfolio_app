// Sample research data for Coin detail, Fundraising, Funds and Unlocks.
// Funding rounds exist only for invented projects, so no real deal is misrepresented.
// Vesting schedules are illustrative; every screen labels them as sample data.

export const TODAY = new Date();

// Stable hash → PRNG, so each coin's generated data is the same on every visit.
function hashString(text) {
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function seeded(text) {
  let seed = hashString(text);
  return function next() {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const date = (text) => new Date(`${text}T12:00:00Z`);
const addMonths = (base, months) => {
  const next = new Date(base);
  next.setUTCMonth(next.getUTCMonth() + months);
  return next;
};

const DAY_MS = 86_400_000;
const daysAgo = (days) => new Date(TODAY.getTime() - days * DAY_MS);

// Funds (Fund profile, Fundraising). All invented.
const coreFunds = [
  { id: "northstar-capital", name: "Northstar Capital", tier: 1, type: "Venture fund", founded: 2017, deals: 142, deals30d: 9, deployed: 1.08e9, sectors: [["AI", 31], ["DeFi", 24], ["Layer 2", 15], ["Infrastructure", 12], ["Gaming", 8]] },
  { id: "hashgrove-ventures", name: "Hashgrove Ventures", tier: 2, type: "Venture fund", founded: 2019, deals: 87, deals30d: 5, deployed: 412e6, sectors: [["DeFi", 34], ["Layer 2", 22], ["AI", 18], ["RWA", 10]] },
  { id: "orbital-partners", name: "Orbital Partners", tier: 2, type: "Venture fund", founded: 2020, deals: 64, deals30d: 3, deployed: 268e6, sectors: [["Layer 2", 30], ["Infrastructure", 28], ["Gaming", 14]] },
  { id: "polar-labs-fund", name: "Polar Labs Fund", tier: 3, type: "Accelerator", founded: 2021, deals: 51, deals30d: 4, deployed: 96e6, sectors: [["AI", 26], ["Gaming", 21], ["DeFi", 19]] },
];
const moreFundNames = [
  ["Meridian Digital", 2, "Venture fund", 2018], ["Lattice Ventures", 2, "Venture fund", 2019], ["Bluefin Capital", 3, "Hedge fund", 2020],
  ["Cinder Labs", 3, "Accelerator", 2022], ["Halo Ridge Partners", 2, "Venture fund", 2018], ["Tundra Ventures", 3, "Venture fund", 2021],
  ["Saltmarsh Capital", 3, "Family office", 2016], ["Keystone Crypto", 1, "Venture fund", 2015], ["Ember Collective", 3, "DAO", 2022],
  ["Quartz Ventures", 2, "Venture fund", 2020], ["Atlas Grid Fund", 2, "Corporate VC", 2019], ["Vantage Node", 3, "Angel syndicate", 2023],
];
const fundSectors = ["AI", "DeFi", "Layer 2", "Infrastructure", "Gaming", "RWA", "Layer 1"];
export const funds = [
  ...coreFunds,
  ...moreFundNames.map(([name, tier, type, founded]) => {
    const random = seeded(`fund:${name}`);
    const picks = [...fundSectors].sort(() => random() - 0.5).slice(0, 4);
    const weights = picks.map(() => 10 + random() * 30);
    return {
      id: name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name,
      tier,
      type,
      founded,
      deals: 12 + Math.floor(random() * 90),
      deals30d: Math.floor(random() * 6),
      deployed: (40 + random() * 600) * 1e6,
      sectors: picks.map((sector, index) => [sector, Math.round(weights[index])]).sort((a, b) => b[1] - a[1]),
    };
  }),
];
export const fundById = (id) => funds.find((fund) => fund.id === id);

// Funding rounds. Curated ones tie into coins; the rest are invented projects without tokens yet.
const curatedRounds = [
  { id: "orb-seed", coinId: "orbit-l2", project: "Orbit L2", sector: "Layer 2", type: "Seed", date: date("2024-01-12"), amount: 6e6, valuation: 40e6, tokenPrice: 0.08, leads: ["northstar-capital"], investors: ["northstar-capital", "polar-labs-fund"] },
  { id: "orb-a", coinId: "orbit-l2", project: "Orbit L2", sector: "Layer 2", type: "Series A", date: date("2025-09-04"), amount: 28.5e6, valuation: 450e6, tokenPrice: 0.18, leads: ["hashgrove-ventures"], investors: ["hashgrove-ventures", "northstar-capital", "orbital-partners"] },
  { id: "orb-strategic", coinId: "orbit-l2", project: "Orbit L2", sector: "Layer 2", type: "Strategic", date: daysAgo(4), amount: 5e6, valuation: null, tokenPrice: null, leads: ["orbital-partners"], investors: ["orbital-partners"] },
  { id: "lum-seed", coinId: "lumen-protocol", project: "Lumen Protocol", sector: "AI", type: "Seed", date: daysAgo(2), amount: 12e6, valuation: 80e6, tokenPrice: 0.12, leads: ["northstar-capital"], investors: ["northstar-capital", "hashgrove-ventures", "polar-labs-fund", "orbital-partners", "meridian-digital"] },
  { id: "drf-seed", coinId: "driftnet", project: "Driftnet", sector: "DeFi", type: "Seed", date: date("2025-02-20"), amount: 4.2e6, valuation: 32e6, tokenPrice: 0.05, leads: ["polar-labs-fund"], investors: ["polar-labs-fund"] },
  { id: "drf-a", coinId: "driftnet", project: "Driftnet", sector: "DeFi", type: "Series A", date: daysAgo(3), amount: 28.5e6, valuation: 210e6, tokenPrice: 0.3, leads: ["northstar-capital"], investors: ["northstar-capital", "orbital-partners"] },
];

const projectStems = ["Arc", "Beacon", "Cobalt", "Delta", "Echo", "Flux", "Glide", "Helix", "Index", "Juno", "Kite", "Loom", "Mosaic", "Nova", "Opal", "Prism", "Quanta", "Relay", "Sable", "Tessera", "Umbra", "Vela", "Wisp", "Xeno", "Yield", "Zephyr"];
const projectSuffixes = ["Labs", "Protocol", "Network", "Finance", "AI", "Chain", "Markets", "Systems"];
const roundTypes = ["Pre-seed", "Seed", "Seed", "Series A", "Series A", "Series B", "Strategic"];

function generatedRounds() {
  const random = seeded("rounds:v1");
  const out = [];
  for (let i = 0; i < 64; i += 1) {
    const type = roundTypes[Math.floor(random() * roundTypes.length)];
    const base = { "Pre-seed": 1.2e6, Seed: 4e6, "Series A": 14e6, "Series B": 32e6, Strategic: 6e6 }[type];
    const amount = Math.round(base * Math.exp((random() - 0.5) * 1.4) / 1e5) * 1e5;
    const investorCount = 1 + Math.floor(random() * 5);
    const investors = [...funds].sort(() => random() - 0.5).slice(0, investorCount).map((fund) => fund.id);
    const name = `${projectStems[Math.floor(random() * projectStems.length)]} ${projectSuffixes[Math.floor(random() * projectSuffixes.length)]}`;
    out.push({
      id: `round-${i}`,
      coinId: null,
      project: name,
      sector: fundSectors[Math.floor(random() * fundSectors.length)],
      type,
      date: daysAgo(1 + Math.floor(random() * 89)),
      amount,
      valuation: random() > 0.3 ? Math.round((amount * (6 + random() * 12)) / 1e6) * 1e6 : null,
      tokenPrice: null,
      leads: investors.slice(0, 1),
      investors,
    });
  }
  return out;
}

export const fundingRounds = [...curatedRounds, ...generatedRounds()];
export const roundSectors = fundSectors;
export const roundTypeList = ["Pre-seed", "Seed", "Series A", "Series B", "Strategic"];

// Scheduled unlocks outside a vesting schedule (08-unlocks.md example): monthly on a fixed day
// and UTC hour, so the date (and the unlock's id) stays put until it has passed. A date that
// moved with each page load would re-key saved reminders on every visit (US-4.2).
const scheduledUnlocks = {
  solana: [{ day: 28, hourUtc: 14, amount: 2.1e6, allocations: ["Staking rewards"] }],
};
function nextMonthly(day, hourUtc) {
  const when = new Date(Date.UTC(TODAY.getUTCFullYear(), TODAY.getUTCMonth(), day, hourUtc));
  if (when <= TODAY) when.setUTCMonth(when.getUTCMonth() + 1);
  return when;
}

// Allocation colours for vesting charts; amber stays reserved for unlock events.
export const allocationColors = {
  Team: "#8b7cf8",
  Investors: "#3d7bff",
  Ecosystem: "#22c55e",
  Community: "#06b6d4",
  Foundation: "#ec4899",
};

// Vesting definitions. `day` is the day of month unlocks land on.
const vestingOverrides = {
  "orbit-l2": {
    total: 2.5e9,
    tge: date("2025-03-29"),
    allocations: [
      { name: "Team", share: 0.2, tge: 0, cliff: 24, months: 36, day: 29 },
      { name: "Investors", share: 0.18, tge: 0, cliff: 12, months: 25, day: 29 },
      { name: "Ecosystem", share: 0.3, tge: 0, cliff: 0, months: 48, day: 12 },
      { name: "Community", share: 0.22, tge: 0.25, cliff: 0, months: 24, day: 12 },
      { name: "Foundation", share: 0.1, tge: 0, cliff: 24, months: 36, day: 5 },
    ],
  },
  arbitrum: {
    total: 10e9,
    tge: date("2023-03-20"),
    allocations: [
      { name: "Team", share: 0.1987, tge: 0, cliff: 12, months: 36, day: 20 },
      { name: "Investors", share: 0.1348, tge: 0, cliff: 12, months: 36, day: 20 },
      { name: "Ecosystem", share: 0.5503, tge: 0.08, cliff: 0, months: 48, day: 28 },
      { name: "Community", share: 0.1162, tge: 1, cliff: 0, months: 1, day: 20 },
    ],
  },
};

const maxSupply = { bitcoin: 21e6, litecoin: 84e6, "bitcoin-cash": 21e6 };

// Addresses used in the page specs (Search copycat example).
const knownContracts = {
  "orbit-l2": "0x9f3c4b2e8d1a7f60c5e2b9a4d3f1e8c7b6a5a71e",
  orbcash: "0x44be7a1c3d9e2f60b8a5c4d1e7f2a3b9c6d809d2",
};

const GENERATED_VESTING = new Set(["chainlink", "uniswap", "polygon", "render", "optimism", "injective", "fetch-ai", "immutable", "aave", "ondo"]);
const NATIVE = new Set(["bitcoin", "ethereum", "bnb", "solana", "xrp", "dogecoin", "toncoin", "cardano", "avalanche", "tron", "polkadot", "bitcoin-cash", "near", "litecoin", "internet-computer", "aptos", "sui", "celestia"]);

function vestingFor(coin) {
  if (vestingOverrides[coin.id]) return vestingOverrides[coin.id];
  // Generated schedules only for a set of established tokens; others have none on record.
  if (!GENERATED_VESTING.has(coin.id)) return null;
  const random = seeded(`vesting:${coin.id}`);
  const day = 1 + Math.floor(random() * 7);
  return {
    total: coin.fdv / coin.price,
    tge: new Date(TODAY.getTime() - coin.listedDaysAgo * 86_400_000),
    allocations: [
      { name: "Team", share: 0.2, tge: 0, cliff: 12, months: 48, day },
      { name: "Investors", share: 0.17, tge: 0, cliff: 12, months: 36, day: day + 7 },
      { name: "Ecosystem", share: 0.33, tge: 0.05, cliff: 0, months: 60, day: day + 14 },
      { name: "Community", share: 0.3, tge: 0.2, cliff: 0, months: 48, day: day + 21 },
    ],
  };
}

// Every unlock event (TGE + monthly tranches) for one coin.
function vestingEvents(vesting) {
  const events = [];
  vesting.allocations.forEach((allocation) => {
    const amount = vesting.total * allocation.share;
    const tgeAmount = amount * allocation.tge;
    if (tgeAmount > 0) events.push({ allocation: allocation.name, date: vesting.tge, amount: tgeAmount });
    const monthly = (amount - tgeAmount) / allocation.months;
    for (let i = 0; i < allocation.months; i += 1) {
      const when = addMonths(vesting.tge, allocation.cliff + i);
      when.setUTCDate(allocation.day);
      events.push({ allocation: allocation.name, date: when, amount: monthly });
    }
  });
  return events.sort((a, b) => a.date - b.date);
}

const researchCache = new Map();

// Everything Coin detail needs for one coin. Prices come from the live coin object.
export function researchFor(coin) {
  if (researchCache.has(coin.id)) return researchCache.get(coin.id);
  const random = seeded(`research:${coin.id}`);
  const vesting = vestingFor(coin);
  const events = vesting ? vestingEvents(vesting) : [];
  const unlockedSoFar = events.filter((event) => event.date <= TODAY).reduce((sum, event) => sum + event.amount, 0);
  const total = vesting?.total ?? maxSupply[coin.id] ?? coin.fdv / coin.price;
  const circulating = Math.min(coin.marketCap / coin.price, vesting ? unlockedSoFar : total);

  // Group same-day tranches into one unlock event.
  const upcoming = [];
  events
    .filter((event) => event.date > TODAY)
    .forEach((event) => {
      const last = upcoming[upcoming.length - 1];
      if (last && last.date.getTime() === event.date.getTime()) {
        last.amount += event.amount;
        last.allocations.push(event.allocation);
      } else {
        upcoming.push({ id: `${coin.id}-${event.date.toISOString().slice(0, 10)}`, coinId: coin.id, symbol: coin.symbol, date: event.date, amount: event.amount, allocations: [event.allocation] });
      }
    });

  (scheduledUnlocks[coin.id] ?? []).forEach((item) => {
    const when = nextMonthly(item.day, item.hourUtc);
    upcoming.push({ id: `${coin.id}-${when.toISOString().slice(0, 10)}`, coinId: coin.id, symbol: coin.symbol, date: when, amount: item.amount, allocations: item.allocations });
  });
  upcoming.sort((a, b) => a.date - b.date);

  const exchanges = ["Binance", "Coinbase", "OKX", "Bybit", "Kraken", "Uniswap v3", "KuCoin", "Gate"];
  const quotes = coin.category === "Stablecoin" ? ["USD", "EUR"] : ["USDT", "USD", "USDC"];
  const weights = exchanges.map(() => random() ** 2 + 0.02);
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
  const markets = exchanges.map((exchange, index) => ({
    exchange,
    pair: `${coin.symbol}/${exchange === "Uniswap v3" ? "WETH" : quotes[index % quotes.length]}`,
    priceOffset: 1 + (random() - 0.5) * 0.004,
    share: weights[index] / weightSum,
  }));

  const generatedContract = `0x${Array.from({ length: 40 }, () => "0123456789abcdef"[Math.floor(random() * 16)]).join("")}`;
  const contract = NATIVE.has(coin.id) ? null : (knownContracts[coin.id] ?? generatedContract);

  const about = {
    "orbit-l2": "Orbit L2 is an Ethereum layer 2 rollup that batches transactions off-chain and posts proofs to Ethereum. It targets AI agents and high-frequency apps that need low, predictable fees.",
    "lumen-protocol": "Lumen Protocol is a lending market that prices loans from on-chain AI risk models instead of fixed collateral ratios.",
    driftnet: "Driftnet is a DeFi routing layer that splits large swaps across exchanges to reduce slippage.",
  }[coin.id] ?? `${coin.name} (${coin.symbol}) is listed in the ${coin.category} category. CPA shows illustrative sample data for it in this demo.`;

  const sentimentBase = 0.45 + random() * 0.3;
  const research = {
    contract,
    verified: coin.rank <= 60 || Boolean(vestingOverrides[coin.id]) || fundingRounds.some((round) => round.coinId === coin.id),
    about,
    supply: { total, circulating, unlocked: Math.max(unlockedSoFar - circulating, 0), locked: vesting ? Math.max(total - unlockedSoFar, 0) : 0 },
    vesting,
    vestingEvents: events,
    upcomingUnlocks: upcoming,
    rounds: fundingRounds.filter((round) => round.coinId === coin.id).sort((a, b) => b.date - a.date),
    markets,
    listedOn: new Date(TODAY.getTime() - coin.listedDaysAgo * 86_400_000),
    sentiment: { bullish: Math.round(sentimentBase * 100), votes: 400 + Math.floor(random() * 3000) },
  };
  researchCache.set(coin.id, research);
  return research;
}

// Price history for the chart. Anchored to today's price and the known 24h / 7d moves.
export const ranges = [
  { id: "1D", label: "1D", days: 1, points: 96 },
  { id: "7D", label: "7D", days: 7, points: 168 },
  { id: "1M", label: "1M", days: 30, points: 120 },
  { id: "3M", label: "3M", days: 90, points: 90 },
  { id: "1Y", label: "1Y", days: 365, points: 183 },
  { id: "ALL", label: "ALL", days: null, points: 200 },
];

// Daily history from listing to today (cached per coin, re-anchored to the live price).
// 1M / 3M / 1Y / ALL are slices of it, so the all-time high and low agree across ranges.
const dailyCache = new Map();

function dailyShape(coin) {
  if (dailyCache.has(coin.id)) return dailyCache.get(coin.id);
  const random = seeded(`daily:${coin.id}`);
  const stable = coin.category === "Stablecoin";
  const days = Math.min(Math.max(coin.listedDaysAgo, 40), 2400);
  const volatility = stable ? 0.0006 : 0.035 + random() * 0.03;
  // Log-price relative to today: a wandering walk that ends at 0 (today's price).
  // Long-run growth scales with age so young coins don't show huge monthly moves.
  const growth = stable ? 0 : Math.log(1.5 + random() * 3) * Math.min(1, days / 730);
  const walk = [0];
  for (let i = 1; i <= days; i += 1) walk.push(walk[i - 1] + (random() - 0.5) * volatility * 2);
  const shape = walk.map((value, i) => {
    const t = i / days;
    return -growth * (1 - t) + value - walk[days] * t;
  });
  dailyCache.set(coin.id, shape);
  return shape;
}

export function priceHistory(coin, rangeId) {
  const range = ranges.find((item) => item.id === rangeId) ?? ranges[2];
  const now = Date.now();
  const dayMs = 86_400_000;

  if (range.id === "1D" || range.id === "7D") {
    // Intraday: bridge from the known 24h / 7d change to today's price.
    const random = seeded(`intraday:${coin.id}:${range.id}`);
    const stable = coin.category === "Stablecoin";
    const change = range.id === "1D" ? coin.change24h : coin.change7d;
    const n = range.points;
    const volatility = stable ? 0.0002 : 0.006;
    const walk = [0];
    for (let i = 1; i < n; i += 1) walk.push(walk[i - 1] + (random() - 0.5) * volatility * 2);
    const logEnd = Math.log(coin.price);
    const logStart = logEnd - Math.log(1 + change / 100);
    const stepMs = (range.days * dayMs) / (n - 1);
    return walk.map((value, i) => {
      const t = i / (n - 1);
      return { time: now - (n - 1 - i) * stepMs, price: Math.exp(logStart + (logEnd - logStart) * t + value - walk[n - 1] * t) };
    });
  }

  const shape = dailyShape(coin);
  const total = shape.length - 1;
  const span = range.days ? Math.min(range.days, total) : total;
  const step = Math.max(1, Math.floor(span / range.points));
  const points = [];
  for (let i = total - span; i <= total; i += step) points.push({ time: now - (total - i) * dayMs, price: coin.price * Math.exp(shape[i]) });
  if (points[points.length - 1].time !== now) points.push({ time: now, price: coin.price });
  return points;
}

export function toCandles(points, count = 30) {
  const size = Math.max(1, Math.floor(points.length / count));
  const candles = [];
  for (let i = 0; i < points.length; i += size) {
    const chunk = points.slice(i, i + size + 1);
    const prices = chunk.map((point) => point.price);
    candles.push({ time: chunk[0].time, open: prices[0], close: prices[prices.length - 1], high: Math.max(...prices), low: Math.min(...prices) });
  }
  return candles;
}

// Every upcoming unlock across coins, with its $ value at today's price (Unlocks, Home).
export function unlockEvents(coins) {
  return coins.flatMap((coin) => {
    const research = researchFor(coin);
    const unlockedPct = research.supply.total ? ((research.supply.total - research.supply.locked) / research.supply.total) * 100 : 0;
    return research.upcomingUnlocks.map((unlock) => ({
      ...unlock,
      coin,
      share: (unlock.amount / research.supply.circulating) * 100,
      usd: unlock.amount * coin.price,
      unlockedPct,
    }));
  });
}
