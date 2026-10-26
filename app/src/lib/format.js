// Number formatting per style guide §2: abbreviations, signed % to 2 decimals
// with a true minus sign (U+2212), and spoken forms for screen readers.
// Spanish and Portuguese use a decimal comma and their own large-number words (styles below).
import { getLanguage, locale, t } from "./i18n.js";

const MINUS = "−";

export const currencies = {
  USD: { code: "USD", symbol: "$", fiat: true },
  EUR: { code: "EUR", symbol: "€", fiat: true },
  GBP: { code: "GBP", symbol: "£", fiat: true },
  BTC: { code: "BTC", symbol: "₿", fiat: false },
  ETH: { code: "ETH", symbol: "Ξ", fiat: false },
};

const EUR_PER_USD = 0.92;
const GBP_PER_USD = 0.79;

// Units of `currency` per 1 USD; crypto rates follow the live BTC/ETH prices.
export function rateFor(currency, coins) {
  if (currency === "EUR") return EUR_PER_USD;
  if (currency === "GBP") return GBP_PER_USD;
  if (currency === "BTC") return 1 / (coins.find((coin) => coin.symbol === "BTC")?.price ?? 1);
  if (currency === "ETH") return 1 / (coins.find((coin) => coin.symbol === "ETH")?.price ?? 1);
  return 1;
}

// Per language: compact suffixes for 1e12 / 1e9 / 1e6 / 1e3, and where the currency symbol goes.
// es: "2,88 B $" (billón), "842,5 M $"; pt-BR: "US$ 2,88 tri", "US$ 842,5 mi".
const styles = {
  en: { suffixes: ["T", "B", "M", "K"], fiat: (text, symbol) => `${symbol}${text}` },
  es: { suffixes: [" B", " mil M", " M", " mil"], fiat: (text, symbol) => `${text} ${symbol}` },
  pt: { suffixes: [" tri", " bi", " mi", " mil"], fiat: (text, symbol) => `${symbol === "$" ? "US$" : symbol} ${text}` },
};
const style = () => styles[getLanguage()] ?? styles.en;
const decimal = (value, digits) =>
  value.toLocaleString(locale(), { minimumFractionDigits: digits, maximumFractionDigits: digits, useGrouping: false });

function withUnit(text, currency) {
  const { symbol, fiat } = currencies[currency] ?? currencies.USD;
  if (!fiat) return `${text} ${currency}`;
  return style().fiat(text, symbol);
}

// Full price: 2 decimals at ≥ 1, otherwise 4 significant digits (e.g. $0.00002371).
export function formatPrice(usd, currency = "USD", rate = 1) {
  if (usd == null || Number.isNaN(usd)) return "—";
  const value = usd * rate;
  const abs = Math.abs(value);
  const text =
    abs >= 1 || abs === 0
      ? value.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value.toLocaleString(locale(), { maximumSignificantDigits: 4 });
  return withUnit(text, currency);
}

// Abbreviated: $1.24B, $842.5M, $12.3K, $2.67T.
export function formatCompact(usd, currency = "USD", rate = 1) {
  if (usd == null || Number.isNaN(usd)) return "—";
  const value = usd * rate;
  const abs = Math.abs(value);
  const [trillions, billions, millions, thousands] = style().suffixes;
  const units = [[1e12, trillions, 2], [1e9, billions, 2], [1e6, millions, 1], [1e3, thousands, 1]];
  const [divisor, suffix, digits] = units.find(([size]) => abs >= size) ?? [1, "", 2];
  const text = `${decimal(value / divisor, digits)}${suffix}`;
  return withUnit(text, currency);
}

export function formatPercent(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `${decimal(0, digits)}%`;
  return `${rounded > 0 ? "+" : MINUS}${decimal(Math.abs(rounded), digits)}%`;
}

export function direction(value) {
  const rounded = Number((value ?? 0).toFixed(2));
  if (rounded > 0) return "up";
  if (rounded < 0) return "down";
  return "flat";
}

// "up 2.41 percent" — read in full words (US-9.3).
export function spokenPercent(value) {
  const dir = direction(value);
  if (dir === "flat") return t("unchanged");
  return t(dir === "up" ? "up {value} percent" : "down {value} percent", { value: decimal(Math.abs(value), 2) });
}

export function spokenPrice(usd, currency = "USD", rate = 1) {
  const value = usd * rate;
  const names = { USD: "dollars", EUR: "euros", GBP: "pounds", BTC: "bitcoin", ETH: "ether" };
  const amount = Math.abs(value) >= 1 ? value.toFixed(2) : value.toPrecision(4);
  return `${Number(amount).toLocaleString(locale(), { maximumFractionDigits: 8 })} ${names[currency] ? t(names[currency]) : currency}`;
}

export function relativeTime(timestamp, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return t("just now");
  if (seconds < 60) return t("{n}s ago", { n: seconds });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return t("{n}m ago", { n: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("{n}h ago", { n: hours });
  return t("{n}d ago", { n: Math.round(hours / 24) });
}

// Plain numbers and multiples in the current language: 1.8 → "1,8", ROI 2.5 → "2,50x".
export const formatNumber = (value, digits = 2) => decimal(value, digits);
export const formatMultiple = (value) => `${decimal(value, 2)}x`;

// Token amounts: 92.65M, 2.50B, 18.0K.
export function formatTokens(value) {
  const abs = Math.abs(value);
  const [, billions, millions, thousands] = style().suffixes;
  if (abs >= 1e9) return `${decimal(value / 1e9, 2)}${billions}`;
  if (abs >= 1e6) return `${decimal(value / 1e6, 2)}${millions}`;
  if (abs >= 1e3) return `${decimal(value / 1e3, 1)}${thousands}`;
  return decimal(value, 0);
}

// Live countdown: "in 12d 06h", "in 3h 20m", "in 45m 10s"; `withMinutes` adds "05m" to day-long countdowns.
export function formatCountdown(target, now = Date.now(), withMinutes = false) {
  const ms = target - now;
  if (ms <= 0) return t("now");
  const days = Math.floor(ms / 86_400_000);
  const hours = Math.floor((ms % 86_400_000) / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  const pad = (n) => String(n).padStart(2, "0");
  const inTime = (text) => t("in {time}", { time: text });
  if (days > 0) return inTime(withMinutes ? `${days}d ${pad(hours)}h ${pad(minutes)}m` : `${days}d ${pad(hours)}h`);
  if (hours > 0) return inTime(`${hours}h ${pad(minutes)}m`);
  return inTime(`${minutes}m ${pad(Math.floor((ms % 60_000) / 1000))}s`);
}

export const formatDate = (value) =>
  new Date(value).toLocaleDateString(locale(), { month: "short", day: "numeric", year: "numeric" });
