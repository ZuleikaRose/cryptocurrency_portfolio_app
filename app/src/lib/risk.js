// Neutral risk indicators for Coin detail (user_journey.md, Leo: "high unlock pressure, low
// liquidity, with explanations, never advice"; clarification 27). Each one states the fixed
// threshold it uses and the coin's own figures, and none of them says what to do.
import { formatNumber, formatTokens } from "./format.js";
import { t } from "./i18n.js";


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
      label: t("High unlock pressure"),
      detail: t(
        "{amount} {symbol} ({pct}% of circulating supply, {value}) unlock in the next {days} days. CPA flags {threshold}% or more. New supply can add selling pressure.",
        { amount: formatTokens(unlocking), symbol: coin.symbol, pct: formatNumber(unlockPct, 2), value: money(unlocking * coin.price), days: RISK_RULES.unlockWindowDays, threshold: RISK_RULES.unlockPressurePct },
      ),
    });
  }

  // Without a market cap (Maker, clarification 39) only the volume floor applies.
  const turnover = coin.marketCap ? (coin.volume24h / coin.marketCap) * 100 : null;
  if (coin.volume24h < RISK_RULES.lowVolumeUsd || (turnover != null && turnover < RISK_RULES.lowTurnoverPct)) {
    items.push({
      id: "liquidity",
      label: t("Low liquidity"),
      detail: turnover == null
        ? t("{volume} traded in 24h. CPA flags under {minimum}. Thin trading can mean wider spreads and bigger price moves on large orders.", {
          volume: money(coin.volume24h),
          minimum: money(RISK_RULES.lowVolumeUsd),
        })
        : t(
          "{volume} traded in 24h, {pct}% of market cap. CPA flags under {threshold}% or under {minimum}. Thin trading can mean wider spreads and bigger price moves on large orders.",
          { volume: money(coin.volume24h), pct: formatNumber(turnover, 2), threshold: formatNumber(RISK_RULES.lowTurnoverPct, 1), minimum: money(RISK_RULES.lowVolumeUsd) },
        ),
    });
  }

  const floatPct = supply.total ? (supply.circulating / supply.total) * 100 : 100;
  if (floatPct < RISK_RULES.lowFloatPct) {
    items.push({
      id: "float",
      label: t("Low float"),
      detail: t("{pct}% of the maximum supply circulates today. CPA flags under {threshold}%. The rest can reach the market as it unlocks.", {
        pct: formatNumber(floatPct, 1),
        threshold: RISK_RULES.lowFloatPct,
      }),
    });
  }
  return items;
}
