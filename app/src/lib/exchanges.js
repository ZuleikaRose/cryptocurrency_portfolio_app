// Exchange CSV exports (clarification 29): Coinbase transaction history, Kraken trades and
// Binance spot trade history, read in the browser into CPA transaction records. Files only:
// CPA never asks for an exchange API key. Prices must be in US dollars; USD stablecoin prices
// (USDT, USDC…) count 1:1 and the preview says so. Notes stored on rows ("Coinbase import") stay English.
import { t } from "./i18n.js";

const USD_LIKE = new Set(["USDT", "USDC", "BUSD", "FDUSD", "TUSD", "USDP", "DAI", "PYUSD"]);
// Quote currencies, longest first, for pairs written without a separator (BTCUSDT, XXBTZUSD).
const QUOTES = ["FDUSD", "ZUSD", "ZEUR", "ZGBP", "ZCAD", "ZJPY", "USDT", "USDC", "BUSD", "TUSD", "USDP", "PYUSD", "DAI", "USD", "EUR", "GBP", "CAD", "JPY", "AUD", "TRY", "BRL", "BTC", "ETH", "BNB"];
// Kraken's asset codes that aren't plain tickers.
const KRAKEN_ASSETS = { XBT: "BTC", XXBT: "BTC", XDG: "DOGE", XXDG: "DOGE", ZUSD: "USD", ZEUR: "EUR", ZGBP: "GBP", ZCAD: "CAD", ZJPY: "JPY" };

const key = (cell) => String(cell ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "");
const unquote = (value) => String(value ?? "").trim().replace(/^'(?=[=+\-@])/, "");

// "$1,234.50", "-$12", "0.5" -> 1234.5, 12, 0.5 (sign dropped: the type gives the direction);
// blank -> null; anything else -> NaN.
function amountOf(value) {
  const text = unquote(value).replace(/[$,\s]/g, "").replace(/^[-−]/, "");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

// "0.00100000BTC" -> { value: 0.001, unit: "BTC" } (Binance's older trade history).
function withUnit(value) {
  const match = unquote(value).replace(/,/g, "").match(/^([0-9.]+)\s*([A-Za-z0-9]+)$/);
  return match ? { value: Number(match[1]), unit: match[2].toUpperCase() } : { value: NaN, unit: "" };
}

const krakenAsset = (code) => {
  const upper = String(code ?? "").toUpperCase();
  if (KRAKEN_ASSETS[upper]) return KRAKEN_ASSETS[upper];
  return upper.length === 4 && /^[XZ]/.test(upper) ? upper.slice(1) : upper;
};

// "BTC-USD", "XBT/USD", "XXBTZUSD", "ETHUSDT" -> { base, quote }.
function splitPair(pair, assets = (code) => code) {
  const text = String(pair ?? "").trim().toUpperCase();
  const parts = text.split(/[-/_]/);
  if (parts.length === 2 && parts[0] && parts[1]) return { base: assets(parts[0]), quote: assets(parts[1]) };
  const quote = QUOTES.find((item) => text.length > item.length && text.endsWith(item));
  return quote ? { base: assets(text.slice(0, -quote.length)), quote: assets(quote) } : { base: "", quote: "" };
}

// UTC dates without a zone ("2024-01-05 13:22:11") are read as UTC.
function utcTime(value) {
  const text = unquote(value);
  const iso = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(text) ? `${text.replace(" ", "T")}Z` : text;
  return new Date(iso).getTime();
}

const usdQuote = (quote) => quote === "USD" || USD_LIKE.has(quote);

// The first row (of the first 12) whose cells include every name, as a column lookup.
function findHeader(rows, names) {
  for (let index = 0; index < Math.min(rows.length, 12); index += 1) {
    const keys = rows[index].map(key);
    if (names.every((name) => keys.includes(name))) {
      return { index, col: (name) => keys.indexOf(key(name)) };
    }
  }
  return null;
}

// --- Coinbase: Reports > Transaction history (CSV) -------------------------------------------

const COINBASE_TYPES = {
  buy: "buy", advancedtradebuy: "buy", sell: "sell", advancedtradesell: "sell",
  receive: "transfer-in", send: "transfer-out",
  rewardsincome: "income", rewardincome: "income", stakingincome: "income", learningreward: "income",
  coinbaseearn: "income", inflationreward: "income", incentivesrewardspayout: "income",
};

function coinbase(rows, header) {
  const cell = (cells, ...names) => {
    for (const name of names) {
      const index = header.col(name);
      if (index >= 0) return unquote(cells[index]);
    }
    return "";
  };
  const records = [];
  const notes = new Set();
  rows.slice(header.index + 1).forEach((cells, offset) => {
    const line = header.index + offset + 2;
    const typeText = cell(cells, "Transaction Type");
    const kind = key(typeText);
    const asset = cell(cells, "Asset").toUpperCase();
    const currency = (cell(cells, "Price Currency", "Spot Price Currency") || "USD").toUpperCase();
    const amount = amountOf(cell(cells, "Quantity Transacted"));
    const price = amountOf(cell(cells, "Price at Transaction", "Spot Price at Transaction"));
    const fee = amountOf(cell(cells, "Fees and/or Spread", "Fees")) ?? 0;
    const date = utcTime(cell(cells, "Timestamp"));
    const notesText = cell(cells, "Notes");
    const base = { line, date, dateText: cell(cells, "Timestamp"), symbol: asset, amount, price, fee };

    if (kind === "deposit" || kind === "withdrawal" || asset === "USD" || asset === currency) {
      records.push({ line, skip: t("{type} of {asset} isn't a coin transaction.", { type: typeText, asset: asset || t("cash") }) });
      return;
    }
    if (currency !== "USD") {
      records.push({ line, skip: t("Prices are in {currency}; CPA needs US dollars. Export with USD as your currency.", { currency }) });
      return;
    }
    if (kind === "convert") {
      // "Converted 0.00123 BTC to 0.0345 ETH": a sell of one coin and a buy of the other.
      const match = notesText.replace(/,/g, "").match(/converted\s+([0-9.]+)\s+(\S+)\s+to\s+([0-9.]+)\s+(\S+)/i);
      const subtotal = amountOf(cell(cells, "Subtotal"));
      if (!match || !(subtotal > 0)) {
        records.push({ line, skip: t("Couldn't read the conversion in Notes.") });
        return;
      }
      const received = Number(match[3]);
      records.push({ ...base, type: "sell", note: "Coinbase convert" });
      records.push({ line, date, dateText: base.dateText, symbol: match[4].toUpperCase(), type: "buy", amount: received, price: received ? subtotal / received : NaN, fee: 0, note: "Coinbase convert" });
      return;
    }
    const type = COINBASE_TYPES[kind];
    if (!type) {
      records.push({ line, skip: t("\"{type}\" rows aren't imported (moves inside Coinbase, or a type CPA doesn't track).", { type: typeText }) });
      return;
    }
    if (type === "income") {
      notes.add(t("Rewards and staking income are recorded as transfers in at that day's price."));
      records.push({ ...base, type: "transfer-in", fee: 0, note: `${typeText} (Coinbase)` });
      return;
    }
    records.push({ ...base, type, note: "Coinbase import" });
  });
  return { format: t("Coinbase transaction history"), records, notes: [...notes] };
}

// --- Kraken: History > Export > Trades -------------------------------------------------------

function kraken(rows, header) {
  const cell = (cells, name) => unquote(cells[header.col(name)]);
  const records = [];
  const notes = new Set();
  rows.slice(header.index + 1).forEach((cells, offset) => {
    const line = header.index + offset + 2;
    const { base, quote } = splitPair(cell(cells, "pair"), krakenAsset);
    if (!base) {
      records.push({ line, skip: t("Couldn't read the pair \"{pair}\".", { pair: cell(cells, "pair") }) });
      return;
    }
    if (!usdQuote(quote)) {
      records.push({ line, skip: t("{base}/{quote} is priced in {quote}; CPA needs US dollars.", { base, quote }) });
      return;
    }
    if (quote !== "USD") notes.add(t("{quote} prices are counted as US dollars.", { quote }));
    const typeText = cell(cells, "type").toLowerCase();
    records.push({
      line,
      date: utcTime(cell(cells, "time")),
      dateText: cell(cells, "time"),
      symbol: base,
      type: typeText === "buy" || typeText === "sell" ? typeText : null,
      typeText,
      amount: amountOf(cell(cells, "vol")),
      price: amountOf(cell(cells, "price")),
      fee: amountOf(cell(cells, "fee")) ?? 0,
      note: "Kraken import",
    });
  });
  return { format: t("Kraken trades"), records, notes: [...notes] };
}

// --- Binance: Orders > Spot order > Trade history (both layouts) ------------------------------

function binance(rows, header, layout) {
  const cell = (cells, name) => unquote(cells[header.col(name)]);
  const records = [];
  const notes = new Set();
  rows.slice(header.index + 1).forEach((cells, offset) => {
    const line = header.index + offset + 2;
    const { base, quote } = splitPair(cell(cells, layout === "units" ? "Pair" : "Market"));
    if (!base) {
      records.push({ line, skip: t("Couldn't read the pair \"{pair}\".", { pair: cell(cells, layout === "units" ? "Pair" : "Market") }) });
      return;
    }
    if (!usdQuote(quote)) {
      records.push({ line, skip: t("{base}/{quote} is priced in {quote}; CPA needs US dollars.", { base, quote }) });
      return;
    }
    if (quote !== "USD") notes.add(t("{quote} prices are counted as US dollars.", { quote }));
    const typeText = cell(cells, layout === "units" ? "Side" : "Type").toLowerCase();
    const type = typeText === "buy" || typeText === "sell" ? typeText : null;
    const amount = layout === "units" ? withUnit(cell(cells, "Executed")).value : amountOf(cell(cells, "Amount"));
    const fee = layout === "units" ? withUnit(cell(cells, "Fee")) : { value: amountOf(cell(cells, "Fee")) ?? 0, unit: cell(cells, "Fee Coin").toUpperCase() };
    let net = amount;
    let feeUsd = 0;
    if (fee.value > 0 && fee.unit === base && type === "buy") net = amount - fee.value; // the fee came out of the coins received
    else if (fee.value > 0 && (fee.unit === quote || usdQuote(fee.unit))) feeUsd = fee.value;
    else if (fee.value > 0) notes.add(t("Fees paid in {unit} aren't counted; add them to a transaction's fee if you need them.", { unit: fee.unit }));
    records.push({
      line,
      date: utcTime(cell(cells, "Date(UTC)")),
      dateText: cell(cells, "Date(UTC)"),
      symbol: base,
      type,
      typeText,
      amount: net,
      price: amountOf(cell(cells, "Price")),
      fee: feeUsd,
      note: "Binance import",
    });
  });
  return { format: t("Binance trade history"), records, notes: [...notes] };
}

// Recognises an exchange export from its header and returns { format, records, notes }, or null
// for any other CSV (read as CPA's own columns). Each record is { line, date (ms), dateText,
// symbol, type, typeText, amount, price, fee, note } or { line, skip }.
export function readExchangeRows(rows) {
  const coinbaseHeader = findHeader(rows, ["timestamp", "transactiontype", "asset", "quantitytransacted"]);
  if (coinbaseHeader) return coinbase(rows, coinbaseHeader);
  const krakenHeader = findHeader(rows, ["txid", "pair", "time", "type", "price", "vol"]);
  if (krakenHeader) return kraken(rows, krakenHeader);
  const unitsHeader = findHeader(rows, ["dateutc", "pair", "side", "price", "executed"]);
  if (unitsHeader) return binance(rows, unitsHeader, "units");
  const marketHeader = findHeader(rows, ["dateutc", "market", "type", "price", "amount"]);
  if (marketHeader) return binance(rows, marketHeader, "columns");
  return null;
}
