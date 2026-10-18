// Bundled sample market data (no API). Values are illustrative, not live.
// The first four rows reproduce the Figma wireframe exactly.

export const categories = ["Layer 1", "Layer 2", "DeFi", "AI", "Stablecoin", "Meme", "Exchange", "Infrastructure", "Gaming", "RWA"];

// Deterministic PRNG so every refresh starts from the same sample data.
function mulberry32(seed) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const random = mulberry32(20261017);
const between = (min, max) => min + random() * (max - min);
const betweenWith = (rand, min, max) => min + rand() * (max - min);

// 7-day sparkline: 24 points ending at today's price, shaped by the 7d change.
function makeSpark(change7d, volatility, rand = random) {
  const points = [];
  let value = 100;
  const drift = change7d / 23;
  for (let i = 0; i < 24; i += 1) {
    points.push(value);
    value += drift + (rand() - 0.5) * volatility * 2.5;
  }
  return points;
}

// Sparkline shapes and 7d changes copied from the wireframe for the first four rows.
const wireframe = {
  bitcoin: { change7d: 6.42, spark: "4,28 13,20 22,23 31,13 40,17 49,8 58,11 67,4" },
  ethereum: { change7d: 4.18, spark: "4,24 13,25 22,17 31,19 40,10 49,14 58,7 67,9" },
  tether: { change7d: 0.02, spark: "4,17 13,15 22,16 31,14 40,15 49,13 58,14 67,12" },
  bnb: { change7d: -3.27, spark: "4,7 13,10 22,8 31,17 40,14 49,22 58,19 67,27" },
};
const wireframeSpark = (points) => points.split(" ").map((pair) => 32 - Number(pair.split(",")[1]));

// [slug, name, symbol, priceUsd, change24h, marketCap, category, logoTint, listedDaysAgo]
const known = [
  ["bitcoin", "Bitcoin", "BTC", 67682.43, 2.18, 1.33e12, "Layer 1", "orange"],
  ["ethereum", "Ethereum", "ETH", 3825.12, 1.06, 459.6e9, "Layer 1", "violet"],
  ["tether", "Tether", "USDT", 1.0, 0.01, 112.4e9, "Stablecoin", "teal"],
  ["bnb", "BNB", "BNB", 602.84, -0.52, 88.9e9, "Exchange", "yellow"],
  ["solana", "Solana", "SOL", 172.45, 4.87, 79.6e9, "Layer 1", "violet"],
  ["usd-coin", "USDC", "USDC", 1.0, -0.01, 33.8e9, "Stablecoin", "blue"],
  ["xrp", "XRP", "XRP", 0.5321, -1.2, 29.4e9, "Layer 1", "slate"],
  ["dogecoin", "Dogecoin", "DOGE", 0.1584, 3.42, 22.9e9, "Meme", "yellow"],
  ["toncoin", "Toncoin", "TON", 6.84, -2.05, 16.8e9, "Layer 1", "blue"],
  ["cardano", "Cardano", "ADA", 0.4582, 0.74, 16.2e9, "Layer 1", "blue"],
  ["avalanche", "Avalanche", "AVAX", 35.62, 1.93, 13.9e9, "Layer 1", "red"],
  ["shiba-inu", "Shiba Inu", "SHIB", 0.00002371, -0.88, 13.9e9, "Meme", "orange"],
  ["tron", "TRON", "TRX", 0.1213, 0.36, 10.6e9, "Layer 1", "red"],
  ["chainlink", "Chainlink", "LINK", 16.84, 2.61, 9.9e9, "Infrastructure", "blue"],
  ["polkadot", "Polkadot", "DOT", 7.12, -1.47, 9.6e9, "Layer 1", "pink"],
  ["bitcoin-cash", "Bitcoin Cash", "BCH", 462.3, 0.92, 9.1e9, "Layer 1", "teal"],
  ["near", "NEAR Protocol", "NEAR", 6.94, 5.36, 7.4e9, "AI", "slate"],
  ["litecoin", "Litecoin", "LTC", 84.21, -0.31, 6.3e9, "Layer 1", "slate"],
  ["uniswap", "Uniswap", "UNI", 9.87, 3.04, 5.9e9, "DeFi", "pink"],
  ["internet-computer", "Internet Computer", "ICP", 11.62, -2.73, 5.4e9, "Infrastructure", "violet"],
  ["polygon", "Polygon", "POL", 0.6841, 1.18, 5.1e9, "Layer 2", "violet"],
  ["aptos", "Aptos", "APT", 8.93, 6.12, 4.1e9, "Layer 1", "teal"],
  ["render", "Render", "RNDR", 9.48, 7.85, 3.7e9, "AI", "red"],
  ["arbitrum", "Arbitrum", "ARB", 0.8462, -3.18, 2.442e9, "Layer 2", "blue"],
  ["optimism", "Optimism", "OP", 2.31, -1.92, 2.7e9, "Layer 2", "red"],
  ["sui", "Sui", "SUI", 1.08, 9.24, 2.8e9, "Layer 1", "blue"],
  ["injective", "Injective", "INJ", 24.36, 4.11, 2.3e9, "DeFi", "blue"],
  ["celestia", "Celestia", "TIA", 9.72, -4.36, 1.9e9, "Infrastructure", "violet"],
  ["fetch-ai", "Artificial Superintelligence Alliance", "FET", 1.42, 6.58, 3.6e9, "AI", "violet"],
  ["immutable", "Immutable", "IMX", 1.86, -0.64, 2.8e9, "Gaming", "slate"],
  ["aave", "Aave", "AAVE", 98.4, 2.27, 1.46e9, "DeFi", "violet"],
  ["maker", "Maker", "MKR", 2412.5, -1.05, 2.2e9, "DeFi", "teal"],
  ["ondo", "Ondo", "ONDO", 1.12, 8.43, 1.6e9, "RWA", "blue"],
];

// Invented projects (shared with Fundraising / Unlocks specs) plus filler, to reach 140 rows.
const invented = [
  ["orbit-l2", "Orbit L2", "ORB", "Layer 2", 567],
  ["lumen-protocol", "Lumen Protocol", "LUM", "DeFi", 12],
  ["driftnet", "Driftnet", "DRF", "DeFi", 4],
  ["kestrel-chain", "Kestrel Chain", "KST", "Layer 1", 21],
  ["tidepool", "Tidepool", "TIDE", "DeFi", 27],
  ["quarry-ai", "Quarry AI", "QRY", "AI", 9],
  ["hearth-rwa", "Hearth RWA", "HRTH", "RWA", 15],
  ["pixelforge", "PixelForge", "PXF", "Gaming", 2],
  ["orbcash", "OrbCash", "ORB", "Meme", 19],
];
const syllables = ["al", "ver", "zen", "kor", "lux", "nim", "tes", "dra", "vio", "rax", "mo", "qui", "sol", "tar", "ely", "fen", "gra", "hal", "ion", "jet"];
const tints = ["orange", "violet", "teal", "yellow", "blue", "pink", "red", "slate"];

function fillerName() {
  const word = syllables[Math.floor(random() * syllables.length)] + syllables[Math.floor(random() * syllables.length)];
  return word.charAt(0).toUpperCase() + word.slice(1);
}

// `rand` defaults to the shared sample PRNG; coins added later pass their own so the
// earlier coins' generated figures stay the same.
function buildCoin({ slug, name, symbol, price, change24h, marketCap, category, tint, listedDaysAgo, fdv, volume24h }, rank, rand = random) {
  const between = (min, max) => betweenWith(rand, min, max);
  const stable = category === "Stablecoin";
  const volatility = stable ? 0.02 : between(0.6, 2.2);
  const fixed = wireframe[slug];
  const change7d = fixed?.change7d ?? (stable ? between(-0.05, 0.05) : change24h * between(1.2, 3.2) + between(-4, 4));
  const circulatingShare = stable ? 1 : between(0.35, 0.98);
  return {
    id: slug,
    rank,
    name,
    symbol,
    category,
    tint,
    price,
    change1h: stable ? between(-0.02, 0.02) : change24h / between(6, 14) + between(-0.4, 0.4),
    change24h,
    change7d,
    marketCap,
    fdv: fdv ?? marketCap / circulatingShare,
    volume24h: volume24h ?? marketCap * (stable ? between(0.25, 0.6) : between(0.015, 0.12)),
    listedDaysAgo: listedDaysAgo ?? Math.round(between(200, 4000)),
    spark: fixed ? wireframeSpark(fixed.spark) : makeSpark(change7d, volatility, rand),
  };
}

function buildCoins() {
  const rows = known.map(([slug, name, symbol, price, change24h, marketCap, category, tint]) => ({
    slug, name, symbol, price, change24h, marketCap, category, tint,
  }));

  // Fixed figures used across the page specs (Coin detail, Fundraising, Fund profile).
  const specFigures = {
    "orbit-l2": { price: 1.24, change24h: 3.4, marketCap: 842.5e6, fdv: 3.1e9, volume24h: 64.2e6, tint: "violet" },
    driftnet: { price: 0.42, change24h: -2.1, marketCap: 126e6, tint: "teal" },
    "lumen-protocol": { price: 0.86, change24h: 5.12, marketCap: 64e6, tint: "yellow" },
    // Copycat ticker for search (US-2.5): same "ORB" symbol, tiny cap, unverified.
    orbcash: { price: 0.0031, change24h: -8.2, marketCap: 1.2e6, tint: "orange" },
  };

  invented.forEach(([slug, name, symbol, category, listedDaysAgo]) => {
    rows.push({
      slug, name, symbol, category, listedDaysAgo,
      price: between(0.05, 12),
      change24h: between(-9, 14),
      marketCap: between(4e7, 9e8),
      tint: tints[Math.floor(random() * tints.length)],
      ...specFigures[slug],
    });
  });

  const used = new Set(rows.map((row) => row.symbol));
  while (rows.length < 140) {
    const name = fillerName();
    const symbol = name.slice(0, 4).toUpperCase();
    if (used.has(symbol)) continue;
    used.add(symbol);
    rows.push({
      slug: name.toLowerCase(),
      name: `${name} ${random() > 0.5 ? "Network" : "Protocol"}`,
      symbol,
      category: categories[Math.floor(random() * categories.length)],
      price: Math.exp(between(Math.log(0.002), Math.log(40))),
      change24h: between(-8, 8),
      marketCap: Math.exp(between(Math.log(2e6), Math.log(1.2e9))),
      tint: tints[Math.floor(random() * tints.length)],
      listedDaysAgo: random() < 0.08 ? Math.round(between(1, 30)) : undefined,
    });
  }

  // Rank by market cap, but keep the wireframe's first four in place.
  const head = rows.slice(0, 4);
  const tail = rows.slice(4).sort((a, b) => b.marketCap - a.marketCap);
  return [...head, ...tail].map((row, index) => buildCoin(row, index + 1));
}

// Coins added after the first build, each with its own PRNG (see buildCoin). Zcash was added
// on Oct 18, 2026 with live CryptoRank prices; its sample figures are CryptoRank's that day.
const added = [
  { slug: "zcash", name: "Zcash", symbol: "ZEC", price: 1081.81, change24h: -4.56, marketCap: 18.21e9, category: "Layer 1", tint: "yellow", listedDaysAgo: 3640, seed: 20261018 },
];

// Rank by market cap, keeping the wireframe's first four in place.
function rerank(coins) {
  const head = coins.slice(0, 4);
  const tail = coins.slice(4).sort((a, b) => b.marketCap - a.marketCap);
  return [...head, ...tail].map((coin, index) => ({ ...coin, rank: index + 1 }));
}

export const initialCoins = rerank([...buildCoins(), ...added.map(({ seed, ...row }) => buildCoin(row, 0, mulberry32(seed)))]);

export const marketPulse = {
  totalMarketCap: 2.67e12,
  totalChange24h: 1.34,
  totalVolume24h: 98.4e9,
  fearGreed: 72,
  fearGreedYesterday: 69,
  btcDominance: 52.8,
  btcDominanceChange: 0.4,
  btcDominanceSpark: [26, 22, 24, 16, 17, 9, 12, 4].map((y) => 30 - y),
};
