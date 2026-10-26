// Portfolio transactions as CSV (11-portfolio.md): export for spreadsheets and tax tools,
// import from a CPA export or any CSV with the same columns.
import { readExchangeRows } from "./exchanges.js";
import { amountHeld } from "./portfolio.js";
import { locale, t } from "./i18n.js";

export const CSV_COLUMNS = ["date", "coin_id", "symbol", "type", "amount", "price_usd", "fee_usd", "note"];
export const MAX_IMPORT_BYTES = 1024 * 1024;
export const MAX_IMPORT_ROWS = 2000;
const MAX_NOTE = 280;
const MAX_AMOUNT = 1e17; // cpa.transactions.amount is numeric(30,12)
const MAX_FEE = 1e15; // fee_usd is numeric(18,2)

// Spreadsheet apps run a cell that starts with = + - @ (or a tab/CR) as a formula, so text
// cells get a leading apostrophe. Numbers are written plainly.
export function textCell(value) {
  const text = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
export const numberCell = (value) => (Number.isFinite(value) ? String(Number(value.toFixed(12))) : "");

export function transactionsToCsv(transactions, coins) {
  const byId = new Map(coins.map((coin) => [coin.id, coin]));
  const rows = [...transactions]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .map((tx) => [
      textCell(new Date(tx.date).toISOString()),
      textCell(tx.coinId),
      textCell(byId.get(tx.coinId)?.symbol ?? ""),
      textCell(tx.type),
      numberCell(tx.amount),
      numberCell(tx.price),
      numberCell(tx.fee ?? 0),
      textCell(tx.note ?? ""),
    ].join(","));
  return `${[CSV_COLUMNS.join(","), ...rows].join("\r\n")}\r\n`;
}

// RFC 4180: quoted fields, doubled quotes, CRLF or LF line ends, and a UTF-8 BOM.
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, "");
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quoted) {
      if (ch === '"' && input[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        quoted = false;
      } else {
        field += ch;
      }
    } else if (ch === '"' && field === "") {
      quoted = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && input[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

// Header names other tools use, mapped to CPA's columns.
const ALIASES = {
  date: ["date", "time", "timestamp", "datetime", "date_utc", "occurred_at"],
  coin_id: ["coin_id", "coin", "coinid", "id"],
  symbol: ["symbol", "ticker", "asset", "currency"],
  type: ["type", "side", "action", "kind"],
  amount: ["amount", "quantity", "qty", "units"],
  price_usd: ["price_usd", "price", "unit_price", "price_per_coin"],
  fee_usd: ["fee_usd", "fee", "fees"],
  note: ["note", "notes", "memo", "description"],
};
const TYPES = {
  buy: "buy", purchase: "buy", sell: "sell", sale: "sell",
  "transfer-in": "transfer-in", "transfer in": "transfer-in", transfer_in: "transfer-in", deposit: "transfer-in", receive: "transfer-in",
  "transfer-out": "transfer-out", "transfer out": "transfer-out", transfer_out: "transfer-out", withdrawal: "transfer-out", send: "transfer-out",
};

const unquote = (value) => value.trim().replace(/^'(?=[=+\-@])/, "");
// "1,234.50", "$12", " 3 " -> numbers; blank -> null.
function toNumber(value) {
  const text = unquote(value ?? "").replace(/[$,\s]/g, "");
  if (text === "") return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : NaN;
}

// Reads a CSV into transactions ready to save: a CPA export, another tool's columns, or an
// exchange export (lib/exchanges.js, clarification 29). Rows that can't be imported are reported
// with their line number and a plain reason instead of being guessed at.
// Returns { transactions, skipped: [{ line, reason }], format, notes, error }.
export function readTransactionsCsv(text, coins, existing = [], now = Date.now()) {
  const rows = parseCsv(text);
  const fail = (error) => ({ transactions: [], skipped: [], format: null, notes: [], error });
  if (rows.length < 2) return fail(t("The file has no transaction rows."));

  const exchange = readExchangeRows(rows);
  let records;
  if (exchange) {
    records = exchange.records;
    if (!records.length) return fail(t("The file has no transaction rows."));
  } else {
    const header = rows[0].map((cell) => cell.trim().toLowerCase().replace(/\s+/g, "_"));
    const column = Object.fromEntries(Object.entries(ALIASES).map(([key, names]) => [key, header.findIndex((name) => names.includes(name))]));
    if (column.date < 0 || column.type < 0 || column.amount < 0 || (column.coin_id < 0 && column.symbol < 0)) {
      return fail(t("The file needs date, type, amount and coin_id (or symbol) columns, or an export from Coinbase, Kraken or Binance."));
    }
    const cell = (cells, key) => (column[key] >= 0 ? unquote(cells[column[key]] ?? "") : "");
    records = rows.slice(1).map((cells, index) => ({
      line: index + 2,
      coinId: cell(cells, "coin_id").toLowerCase(),
      symbol: cell(cells, "symbol").toUpperCase(),
      type: TYPES[cell(cells, "type").toLowerCase()] ?? null,
      typeText: cell(cells, "type"),
      amount: toNumber(cell(cells, "amount")),
      price: toNumber(cell(cells, "price_usd")),
      fee: toNumber(cell(cells, "fee_usd")),
      date: new Date(cell(cells, "date")).getTime(),
      dateText: cell(cells, "date"),
      note: cell(cells, "note"),
    }));
  }
  if (records.length > MAX_IMPORT_ROWS) {
    return fail(t("The file has {count} rows. Import up to {max} at a time.", { count: records.length, max: MAX_IMPORT_ROWS.toLocaleString(locale()) }));
  }

  const byId = new Map(coins.map((coin) => [coin.id, coin]));
  const bySymbol = new Map();
  coins.forEach((coin) => [coin.symbol, ...(coin.formerSymbols ?? [])].forEach((symbol) => {
    const key = symbol.toUpperCase();
    bySymbol.set(key, [...(bySymbol.get(key) ?? []), coin]);
  }));
  // Rounded like the export, so re-importing an export finds every row already there.
  const round = (value) => Number(Number(value).toFixed(12));
  const fingerprint = (tx) => `${tx.coinId}|${tx.type}|${round(tx.amount)}|${round(tx.price)}|${new Date(tx.date).getTime()}`;
  const seen = new Set(existing.map(fingerprint));
  // Exchanges list partial fills as separate identical rows, so only CPA files are deduplicated
  // within the file.
  const inFile = exchange ? null : seen;

  const parsed = [];
  const skipped = [];
  records.forEach((record) => {
    const { line } = record;
    const skip = (reason) => skipped.push({ line, reason });
    if (record.skip) return skip(record.skip);

    const id = record.coinId ?? "";
    const symbol = record.symbol ?? "";
    let coin = id ? byId.get(id) : null;
    if (!coin && symbol) {
      const matches = bySymbol.get(symbol) ?? [];
      if (matches.length > 1) return skip(t("{symbol} matches more than one coin. Add its coin_id.", { symbol }));
      coin = matches[0];
    }
    if (!coin) return skip(t("Unknown coin {coin}.", { coin: id || symbol || t("(blank)") }));

    const { type } = record;
    if (!type) return skip(t("Type must be buy, sell, transfer-in or transfer-out, not \"{type}\".", { type: record.typeText ?? "" }));
    const { amount } = record;
    if (!(amount > 0) || amount >= MAX_AMOUNT) return skip(t("Amount must be a number greater than 0."));
    const price = record.price ?? 0;
    if (!(price >= 0) || price >= MAX_AMOUNT) return skip(t("Price must be 0 or more."));
    const fee = record.fee ?? 0;
    if (!(fee >= 0) || fee >= MAX_FEE) return skip(t("Fee can't be negative."));
    const time = record.date;
    if (Number.isNaN(time)) return skip(t("Date \"{date}\" isn't a date. Use a format like 2026-10-17T14:30:00Z.", { date: record.dateText }));
    if (time > now + 60_000) return skip(t("The date is in the future."));

    const tx = { coinId: coin.id, type, amount, price, fee: Math.round(fee * 100) / 100, date: new Date(time).toISOString(), note: String(record.note ?? "").slice(0, MAX_NOTE) };
    const key = fingerprint(tx);
    if (seen.has(key)) return skip(t("Already in your portfolio."));
    inFile?.add(key);
    parsed.push({ line, tx });
  });

  // Sells and transfers out can't exceed what's held at that point, counting earlier rows.
  const accepted = [];
  const ledger = [...existing];
  parsed.sort((a, b) => new Date(a.tx.date) - new Date(b.tx.date)).forEach(({ line, tx }) => {
    if (tx.type === "sell" || tx.type === "transfer-out") {
      // null, not undefined: amountHeld skips rows whose id equals excludeId, and new rows have none.
      const held = amountHeld(ledger.filter((item) => new Date(item.date) <= new Date(tx.date)), tx.coinId, null);
      if (tx.amount > held + 1e-12) {
        skipped.push({ line, reason: t("More {symbol} than held on that date.", { symbol: byId.get(tx.coinId).symbol }) });
        return;
      }
    }
    ledger.push(tx);
    accepted.push(tx);
  });
  skipped.sort((a, b) => a.line - b.line);
  return { transactions: accepted, skipped, format: exchange?.format ?? null, notes: exchange?.notes ?? [], error: null };
}
