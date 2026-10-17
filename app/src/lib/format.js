// Number formatting per style guide §2: abbreviations, signed % to 2 decimals
// with a true minus sign (U+2212), and spoken forms for screen readers.

const MINUS = "−";

export const currencies = {
  USD: { code: "USD", symbol: "$", fiat: true },
  EUR: { code: "EUR", symbol: "€", fiat: true },
  BTC: { code: "BTC", symbol: "₿", fiat: false },
  ETH: { code: "ETH", symbol: "Ξ", fiat: false },
};

const EUR_PER_USD = 0.92;

// Units of `currency` per 1 USD; crypto rates follow the live BTC/ETH prices.
export function rateFor(currency, coins) {
  if (currency === "EUR") return EUR_PER_USD;
  if (currency === "BTC") return 1 / (coins.find((coin) => coin.symbol === "BTC")?.price ?? 1);
  if (currency === "ETH") return 1 / (coins.find((coin) => coin.symbol === "ETH")?.price ?? 1);
  return 1;
}

function withUnit(text, currency) {
  const { symbol, fiat } = currencies[currency] ?? currencies.USD;
  return fiat ? `${symbol}${text}` : `${text} ${currency}`;
}

// Full price: 2 decimals at ≥ 1, otherwise 4 significant digits (e.g. $0.00002371).
export function formatPrice(usd, currency = "USD", rate = 1) {
  if (usd == null || Number.isNaN(usd)) return "—";
  const value = usd * rate;
  const abs = Math.abs(value);
  const text =
    abs >= 1
      ? value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : value.toLocaleString("en-US", { maximumSignificantDigits: 4 });
  return withUnit(text, currency);
}

// Abbreviated: $1.24B, $842.5M, $12.3K, $2.67T.
export function formatCompact(usd, currency = "USD", rate = 1) {
  if (usd == null || Number.isNaN(usd)) return "—";
  const value = usd * rate;
  const abs = Math.abs(value);
  const units = [
    [1e12, "T", 2],
    [1e9, "B", 2],
    [1e6, "M", 1],
    [1e3, "K", 1],
  ];
  const [divisor, suffix, digits] = units.find(([size]) => abs >= size) ?? [1, "", 2];
  const text = `${(value / divisor).toFixed(digits)}${suffix}`;
  return withUnit(text, currency);
}

export function formatPercent(value, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  if (rounded === 0) return `${(0).toFixed(digits)}%`;
  return `${rounded > 0 ? "+" : MINUS}${Math.abs(rounded).toFixed(digits)}%`;
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
  if (dir === "flat") return "unchanged";
  return `${dir} ${Math.abs(value).toFixed(2)} percent`;
}

export function spokenPrice(usd, currency = "USD", rate = 1) {
  const value = usd * rate;
  const names = { USD: "dollars", EUR: "euros", BTC: "bitcoin", ETH: "ether" };
  const amount = Math.abs(value) >= 1 ? value.toFixed(2) : value.toPrecision(4);
  return `${Number(amount).toLocaleString("en-US", { maximumFractionDigits: 8 })} ${names[currency] ?? currency}`;
}

export function relativeTime(timestamp, now = Date.now()) {
  const seconds = Math.max(0, Math.round((now - timestamp) / 1000));
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}
