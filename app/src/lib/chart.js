import { formatPrice, spokenPercent } from "./format.js";

export function formatChartTime(time, rangeId) {
  const date = new Date(time);
  if (rangeId === "1D") return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  if (rangeId === "7D") return date.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric" });
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function chartSummary(points, rangeLabel, currency, rate) {
  const prices = points.map((point) => point.price);
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  const first = prices[0];
  const last = prices[prices.length - 1];
  const change = ((last - first) / first) * 100;
  const position = high === low ? "flat" : (last - low) / (high - low) > 0.66 ? "near the high" : (last - low) / (high - low) < 0.33 ? "near the low" : "mid-range";
  return `${rangeLabel} range ${formatPrice(low, currency, rate)} to ${formatPrice(high, currency, rate)}, currently ${formatPrice(last, currency, rate)} (${position}), ${spokenPercent(change)} over the period.`;
}
