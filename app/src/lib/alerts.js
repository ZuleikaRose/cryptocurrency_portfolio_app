import { formatPercent, formatPrice } from "./format.js";
import { t } from "./i18n.js";

// Price alerts (12-alerts.md, US-7.1). Values are stored in USD; % alerts store a percentage.
// Labels stay English here and are translated where they're shown (t(type.label)).
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
  if (alert.type === "above") return t("Price above {price}", { price: formatPrice(alert.value, currency, rate) });
  if (alert.type === "below") return t("Price below {price}", { price: formatPrice(alert.value, currency, rate) });
  return t("Moves ±{value}% in {window}", { value: alert.value, window: alert.type === "pct1h" ? "1h" : "24h" });
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
    ? t("{symbol} moved {change} in {window}", {
      symbol: coin.symbol,
      change: formatPercent(alert.type === "pct1h" ? coin.change1h : coin.change24h),
      window: alert.type === "pct1h" ? "1h" : "24h",
    })
    : t(alert.type === "above" ? "{symbol} above {price}" : "{symbol} below {price}", { symbol: coin.symbol, price: formatPrice(alert.value) });
  return {
    kind: "price",
    coinId: coin.id,
    title,
    detail: t("Now {price} · {arrow} {change} 24h", { price: formatPrice(coin.price), arrow, change: formatPercent(coin.change24h) }),
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

// A missing unlock is matched to the same coin's nearest upcoming unlock within 14 days; monthly
// vesting tranches are ~30 days apart, so a cancelled unlock never borrows next month's.
const MATCH_WINDOW_MS = 14 * 24 * 60 * 60_000;

// US-4.2: when an unlock or sale date changes, its reminder follows. `candidates(id, reminder)`
// returns the events the reminder could now belong to ({ id, date }): the same id if it still
// exists, otherwise that coin's upcoming unlocks. Timings that haven't come due at the new
// date fire again. Returns { reminders, moves: [{ from, to, previous, reminder }] }.
export function rescheduleReminders(reminders, candidates, now) {
  const next = { ...reminders };
  const moves = [];
  const taken = new Set(Object.keys(reminders));
  Object.entries(reminders).forEach(([id, reminder]) => {
    const previous = new Date(reminder.date).getTime();
    if (!(previous > now)) return; // Already happened: nothing left to follow.
    const events = candidates(id, reminder);
    const target =
      events.find((event) => event.id === id) ??
      events
        .filter((event) => !taken.has(event.id) && event.date.getTime() > now && Math.abs(event.date.getTime() - previous) <= MATCH_WINDOW_MS)
        .sort((a, b) => Math.abs(a.date.getTime() - previous) - Math.abs(b.date.getTime() - previous))[0];
    if (!target) return;
    const to = target.date.getTime();
    if (target.id === id && Math.abs(to - previous) < 60_000) return;
    const fired = (reminder.fired ?? []).filter((timing) => now >= to - (reminderOffsets[timing] ?? 0));
    delete next[id];
    next[target.id] = { ...reminder, date: new Date(to).toISOString(), fired };
    taken.add(target.id);
    moves.push({ from: id, to: target.id, previous, reminder: next[target.id] });
  });
  return { reminders: next, moves };
}
