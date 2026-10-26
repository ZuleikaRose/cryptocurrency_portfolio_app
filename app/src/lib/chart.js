import { formatPrice, spokenPercent } from "./format.js";
import { locale, t } from "./i18n.js";

export function formatChartTime(time, rangeId) {
  const date = new Date(time);
  if (rangeId === "1D") return date.toLocaleTimeString(locale(), { hour: "numeric", minute: "2-digit" });
  if (rangeId === "7D") return date.toLocaleString(locale(), { month: "short", day: "numeric", hour: "numeric" });
  return date.toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" });
}

export function chartSummary(points, rangeLabel, currency, rate) {
  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = ((last - first) / first) * 100;
  const position = t(high === low ? "flat" : (last - low) / (high - low) > 0.66 ? "near the high" : (last - low) / (high - low) < 0.33 ? "near the low" : "mid-range");
  return t("{range} range {low} to {high}, currently {last} ({position}), {change} over the period.", {
    range: rangeLabel,
    low: formatPrice(low, currency, rate),
    high: formatPrice(high, currency, rate),
    last: formatPrice(last, currency, rate),
    position,
    change: spokenPercent(change),
  });
}
