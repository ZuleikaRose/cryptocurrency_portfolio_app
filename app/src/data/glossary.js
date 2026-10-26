// Plain-language definitions for metrics (style guide §3: tap-to-explain ⓘ).
export const definitions = {
  marketCap: "Price × circulating supply. The value of all tokens that can trade today.",
  fdv: "Fully diluted valuation: price × maximum supply. Shows the value if every token were circulating.",
  volume: "The value of this coin traded across all tracked markets in the last 24 hours.",
  circulating: "Tokens that are unlocked and trading today.",
  unlocked: "Tokens already released from vesting that are not yet circulating, for example held in treasury.",
  locked: "Tokens still vesting. They are released on a schedule and can add selling pressure when they unlock.",
  supply: "How the maximum supply splits between circulating, unlocked but not circulating, and still locked.",
  ath: "All-time high and low: the highest and lowest daily closing prices on record. Coins with a Coinbase or Kraken chart use its history; the rest use sample data.",
  risk: "Facts that can make a price move more: large unlocks soon, thin trading, or a small share of supply circulating. Each uses a fixed threshold. They aren't a rating or advice.",
  roi: "Return on investment: current price divided by the round's token price.",
};
