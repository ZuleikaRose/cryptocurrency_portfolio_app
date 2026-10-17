import { formatPercent, formatPrice } from "./format.js";

// Price alerts (12-alerts.md, US-7.1). Values are stored in USD; % alerts store a percentage.
export const alertTypes = [
  { id: "above", label: "Price above", short: "Price above" },
  { id: "below", label: "Price below", short: "Price below" },
  { id: "pct1h", label: "% change 1h", short: "Moves" },
  { id: "pct24h", label: "% change 24h", short: "Moves" },
];

export const COOLDOWN_MS = 60 * 60_000;
export const MAX_NOTIFICATIONS = 200;

export const isPercentAlert = (type) => type === "pct1h" || type === "pct24h";

export function describeAlert(alert, currency = "USD", rate = 1) {
  if (alert.type === "above") return `Price above ${formatPrice(alert.value, currency, rate)}`;
  if (alert.type === "below") return `Price below ${formatPrice(alert.value, currency, rate)}`;
  return `Moves ±${alert.value}% in ${alert.type === "pct1h" ? "1h" : "24h"}`;
}

// Condition-based (not crossing-based), so an alert set on the wrong side of the
// price fires on the next tick; recurring alerts then wait out the cool-down.
export function alertTriggered(alert, coin, now) {
  if (!alert.active || !coin) return false;
  if (alert.repeat === "recurring" && alert.lastFired && now - alert.lastFired < COOLDOWN_MS) return false;
  if (alert.type === "above") return coin.price >= alert.value;
  if (alert.type === "below") return coin.price <= alert.value;
  const change = alert.type === "pct1h" ? coin.change1h : coin.change24h;
  return Math.abs(change) >= alert.value;
}

export function alertNotification(alert, coin) {
  const arrow = coin.change24h >= 0 ? "▲" : "▼";
  const title = isPercentAlert(alert.type)
    ? `${coin.symbol} moved ${formatPercent(alert.type === "pct1h" ? coin.change1h : coin.change24h)} in ${alert.type === "pct1h" ? "1h" : "24h"}`
    : `${coin.symbol} ${alert.type} ${formatPrice(alert.value)}`;
  return {
    kind: "price",
    coinId: coin.id,
    title,
    detail: `Now ${formatPrice(coin.price)} · ${arrow} ${formatPercent(coin.change24h)} 24h`,
    path: `/coins/${coin.id}`,
  };
}

// A sensible starting value: about 3% away from the current price, rounded to 3 significant digits.
export function suggestedValue(type, price) {
  if (isPercentAlert(type)) return 5;
  const target = price * (type === "below" ? 0.97 : 1.03);
  const magnitude = 10 ** (Math.floor(Math.log10(target)) - 2);
  return Math.round(target / magnitude) * magnitude;
}

export const reminderOffsets = { "1h": 60 * 60_000, "24h": 24 * 60 * 60_000 };

// Monday 08:00 local of the week containing `date` (US-7.3 weekly digest).
export function digestTime(date = new Date()) {
  const monday = new Date(date);
  monday.setHours(8, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return monday.getTime();
}
