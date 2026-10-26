// Neutral risk indicators for Coin detail (user_journey.md, Leo: "high unlock pressure, low
// liquidity, with explanations, never advice"; clarification 27). Each one states the fixed
// threshold it uses and the coin's own figures, and none of them says what to do.
import { formatTokens } from "./format.js";

const DAY_MS = 86_400_000;
export const RISK_RULES = {
  unlockWindowDays: 30,
  unlockPressurePct: 2, // of circulating supply, unlocking within the window
  lowTurnoverPct: 0.1, // 24h volume as a share of market cap (large caps trade 0.3–2% a day)
  lowVolumeUsd: 5_000_000,
  lowFloatPct: 30, // circulating as a share of the maximum supply
};

// Returns [{ id, label, detail }] for the indicators that apply. `money` formats a USD amount
// in the user's currency.
export function riskIndicators(coin, research, { now = Date.now(), money }) {
  const items = [];
  const { supply } = research;

  const horizon = now + RISK_RULES.unlockWindowDays * DAY_MS;
  const unlocking = research.upcomingUnlocks
    .filter((unlock) => unlock.date.getTime() > now && unlock.date.getTime() <= horizon)
    .reduce((sum, unlock) => sum + unlock.amount, 0);
  const unlockPct = supply.circulating ? (unlocking / supply.circulating) * 100 : 0;
  if (unlockPct >= RISK_RULES.unlockPressurePct) {
    items.push({
      id: "unlock",
      label: "High unlock pressure",
      detail: `${formatTokens(unlocking)} ${coin.symbol} (${unlockPct.toFixed(2)}% of circulating supply, ${money(unlocking * coin.price)}) unlock in the next ${RISK_RULES.unlockWindowDays} days. CPA flags ${RISK_RULES.unlockPressurePct}% or more. New supply can add selling pressure.`,
    });
  }

  const turnover = coin.marketCap ? (coin.volume24h / coin.marketCap) * 100 : 0;
  if (coin.volume24h < RISK_RULES.lowVolumeUsd || turnover < RISK_RULES.lowTurnoverPct) {
    items.push({
      id: "liquidity",
      label: "Low liquidity",
      detail: `${money(coin.volume24h)} traded in 24h, ${turnover.toFixed(2)}% of market cap. CPA flags under ${RISK_RULES.lowTurnoverPct}% or under ${money(RISK_RULES.lowVolumeUsd)}. Thin trading can mean wider spreads and bigger price moves on large orders.`,
    });
  }

  const floatPct = supply.total ? (supply.circulating / supply.total) * 100 : 100;
  if (floatPct < RISK_RULES.lowFloatPct) {
    items.push({
      id: "float",
      label: "Low float",
      detail: `${floatPct.toFixed(1)}% of the maximum supply circulates today. CPA flags under ${RISK_RULES.lowFloatPct}%. The rest can reach the market as it unlocks.`,
    });
  }
  return items;
}
