import { useId, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Donut from "../components/Donut.jsx";
import Icon from "../components/Icon.jsx";
import ChartSummary from "../components/ChartSummary.jsx";
import PriceChart from "../components/PriceChart.jsx";
import Sheet from "../components/Sheet.jsx";
import TaxReportSheet from "../components/TaxReportSheet.jsx";
import { ErrorBanner } from "../components/LoadState.jsx";
import { researchFor } from "../data/research.js";
import { arrow, direction, formatAmount, formatDate, formatPercent, formatPrice, formatSignedPrice, isoDay, MASK, rateFor } from "../lib/format.js";
import { amountHeld, chartRange, computeHoldings, priceAt, rangePerformance, summarize, transactionTypes, valueHistory } from "../lib/portfolio.js";
import { closeDay, fetchPriceAt, usePriceHistories } from "../lib/history.js";
import { chartSummary } from "../lib/chart.js";
import { downloadText } from "../lib/clipboard.js";
import { CSV_COLUMNS, MAX_IMPORT_BYTES, MAX_IMPORT_ROWS, readTransactionsCsv, transactionsToCsv } from "../lib/csv.js";
import { useNow, usePageTitle } from "../lib/hooks.js";
import { chainFor, lookupWallet, normaliseAddress, secretWarning, shortAddress, WALLET_CHAINS, walletImportPlan, walletNote } from "../lib/wallet.js";
import { useApp, useMarket } from "../state/context.js";
import NotFound from "./NotFound.jsx";
import { locale, t, tn } from "../lib/i18n.js";

const ranges = ["24h", "7D", "1M", "3M", "1Y", "ALL"];
// Import tags stay English in stored rows (wallet re-imports match on them); show them translated.
const IMPORT_NOTES = new Set(["Coinbase import", "Coinbase convert", "Kraken import", "Binance import"]);
const noteText = (note) => {
  if (note.startsWith("Wallet import ")) return t("Wallet import {address}", { address: note.slice("Wallet import ".length) });
  return IMPORT_NOTES.has(note) ? t(note) : note;
};
// Signed money: +$809.71 / −$12.00 (true minus sign).

// `<input type="datetime-local">` wants local time without seconds.
const toLocalInput = (date) => {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
};

function TransactionSheet({ open, onClose, initial, coins, transactions, onSave }) {
  const formId = useId();
  const [form, setForm] = useState(() => {
    const coin = coins.find((item) => item.id === (initial?.coinId ?? "ethereum")) ?? coins[0];
    return initial?.id
      ? { ...initial, date: toLocalInput(new Date(initial.date)), amount: String(initial.amount), price: String(initial.price), fee: String(initial.fee ?? "") }
      : { type: "buy", coinId: coin.id, amount: "", price: coin.price.toFixed(coin.price >= 1 ? 2 : 6), date: toLocalInput(new Date()), fee: "", note: "", ...initial };
  });
  const [touched, setTouched] = useState(false);
  const [priceNote, setPriceNote] = useState(null);
  const now = useNow(30_000);

  const coin = coins.find((item) => item.id === form.coinId);
  const amount = Number(form.amount);
  const price = Number(form.price);
  const fee = Number(form.fee || 0);
  const held = amountHeld(transactions, form.coinId, initial?.id);
  const reduces = form.type === "sell" || form.type === "transfer-out";

  const errors = {};
  if (!(amount > 0)) errors.amount = t("Enter an amount greater than 0.");
  else if (reduces && amount > held + 1e-12) {
    errors.amount = t(form.type === "sell" ? "You can't sell more than you hold ({amount} {symbol})." : "You can't transfer out more than you hold ({amount} {symbol}).", { amount: formatAmount(Math.max(held, 0)), symbol: coin?.symbol });
  }
  if (!(price >= 0) || form.price === "") errors.price = t("Enter a price of 0 or more.");
  if (!(fee >= 0)) errors.fee = t("Fee can't be negative.");
  if (!form.date || Number.isNaN(new Date(form.date).getTime())) errors.date = t("Choose a date and time.");
  else if (new Date(form.date).getTime() > now + 60_000) errors.date = t("The date can't be in the future.");
  const valid = Object.keys(errors).length === 0;

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const setPrice = (value) => set({ price: value.toFixed(value >= 1 ? 2 : 6) });
  // The nearest Coinbase close for coins with history (clarification 28), sample history otherwise.
  const applyMarketPrice = async () => {
    if (!coin || errors.date) return;
    const time = new Date(form.date).getTime();
    if (!coin.historyUpdatedAt) {
      setPrice(priceAt(coin, time));
      setPriceNote(t("CPA sample data."));
      return;
    }
    setPriceNote(t("Looking up the price…"));
    try {
      const close = await fetchPriceAt(coin.id, time);
      if (close) {
        setPrice(close.price);
        // A close stamped at midnight UTC is that day's daily close.
        const stamp = new Date(close.time).toISOString();
        setPriceNote(stamp.slice(11, 16) === "00:00"
          ? t("Coinbase daily close for {date} (UTC).", { date: formatDate(closeDay(close.time)) })
          : t("Coinbase close at {time} UTC.", { time: stamp.slice(0, 16).replace("T", " ") }));
      } else {
        setPrice(priceAt(coin, time));
        setPriceNote(t("No Coinbase close for that date, so this is CPA sample data."));
      }
    } catch (error) {
      console.error(`Market price lookup failed: ${error.message}`);
      setPriceNote(t("We couldn't load the market price. Enter it yourself or try again."));
    }
  };

  const submit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    onSave({
      ...(initial?.id ? { id: initial.id } : {}),
      coinId: form.coinId,
      type: form.type,
      amount,
      price,
      fee,
      date: new Date(form.date).toISOString(),
      note: form.note.trim(),
    });
    onClose();
  };

  const showError = (field) => touched && errors[field];
  const field = (name) => ({
    id: `${formId}-${name}`,
    "aria-invalid": Boolean(showError(name)),
    "aria-describedby": showError(name) ? `${formId}-${name}-error` : undefined,
  });
  const total = amount * price + (reduces ? -fee : fee);

  return (
    <Sheet open={open} onClose={onClose} title={initial?.id ? t("Edit transaction") : t("Add transaction")} side="bottom">
      <form className="tx-form" onSubmit={submit} noValidate>
        <div className="segmented tx-types" role="group" aria-label={t("Transaction type")}>
          {transactionTypes.map((type) => (
            <button key={type.id} type="button" className={form.type === type.id ? "segment active" : "segment"} aria-pressed={form.type === type.id} onClick={() => set({ type: type.id })}>
              {t(type.label)}
            </button>
          ))}
        </div>

        <label className="form-field" htmlFor={`${formId}-coin`}>
          <span>{t("Coin")}</span>
          <select id={`${formId}-coin`} className="select" value={form.coinId} onChange={(event) => {
            const next = coins.find((item) => item.id === event.target.value);
            set({ coinId: next.id, price: next.price.toFixed(next.price >= 1 ? 2 : 6) });
          }}>
            {coins.map((item) => (
              <option key={item.id} value={item.id}>{item.name} ({item.symbol})</option>
            ))}
          </select>
        </label>

        <label className="form-field" htmlFor={`${formId}-amount`}>
          <span>{t("Amount")}{reduces && <small className="num"> · {t("You hold {amount} {symbol}", { amount: formatAmount(Math.max(held, 0)), symbol: coin?.symbol })}</small>}</span>
          <input {...field("amount")} className="input num" inputMode="decimal" value={form.amount} onChange={(event) => set({ amount: event.target.value })} placeholder="0.00" />
          {showError("amount") && <span id={`${formId}-amount-error`} className="field-error">{errors.amount}</span>}
        </label>

        <div className="form-field">
          <label htmlFor={`${formId}-price`}>{t("Price per coin (USD)")}</label>
          <div className="input-row">
            <input {...field("price")} className="input num" inputMode="decimal" value={form.price} onChange={(event) => {
              set({ price: event.target.value });
              setPriceNote(null);
            }} />
            <button type="button" className="button-tertiary" onClick={applyMarketPrice}>↺ {t("Use market price")}</button>
          </div>
          <small className="field-hint" role="status">{priceNote}</small>
          {showError("price") && <span id={`${formId}-price-error`} className="field-error">{errors.price}</span>}
        </div>

        <label className="form-field" htmlFor={`${formId}-date`}>
          <span>{t("Date")}</span>
          <input {...field("date")} type="datetime-local" className="input" value={form.date} max={toLocalInput(new Date(now))} onChange={(event) => set({ date: event.target.value })} />
          {showError("date") && <span id={`${formId}-date-error`} className="field-error">{errors.date}</span>}
        </label>

        <label className="form-field" htmlFor={`${formId}-fee`}>
          <span>{t("Fee (USD)")}</span>
          <input {...field("fee")} className="input num" inputMode="decimal" value={form.fee} onChange={(event) => set({ fee: event.target.value })} placeholder="0.00" />
          {showError("fee") && <span id={`${formId}-fee-error`} className="field-error">{errors.fee}</span>}
        </label>

        <label className="form-field" htmlFor={`${formId}-note`}>
          <span>{t("Note")}</span>
          <input id={`${formId}-note`} className="input" value={form.note} maxLength={140} onChange={(event) => set({ note: event.target.value })} placeholder={t("Optional")} />
        </label>

        <p className="tx-total num">
          {form.type === "buy" ? t("Total spent") : form.type === "sell" ? t("Total received") : t("Value")}{" "}
          <strong>{Number.isFinite(total) && amount > 0 ? formatPrice(Math.max(total, 0)) : "—"}</strong>
        </p>
        <button type="submit" className="button-primary">{initial?.id ? t("Save changes") : t("Add transaction")}</button>
      </form>
    </Sheet>
  );
}

// CSV import: pick a file, see what will and won't be imported, then confirm.
function ImportSheet({ open, onClose, coins, transactions, onImport }) {
  const inputId = useId();
  const [result, setResult] = useState(null);
  const [fileError, setFileError] = useState(null);

  const onFile = (event) => {
    const file = event.target.files?.[0];
    setResult(null);
    setFileError(null);
    if (!file) return;
    if (file.size > MAX_IMPORT_BYTES) {
      setFileError(t("Choose a file under 1 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const read = readTransactionsCsv(String(reader.result), coins, transactions);
      if (read.error) setFileError(read.error);
      else setResult({ ...read, name: file.name });
    };
    reader.onerror = () => setFileError(t("Couldn't read that file. Try saving it again as CSV."));
    reader.readAsText(file);
  };

  const count = result?.transactions.length ?? 0;
  return (
    <Sheet open={open} onClose={onClose} title={t("Import transactions")} side="bottom">
      <div className="tx-form">
        <p className="sheet-note">
          {t("A CPA export, an exchange export (Coinbase transaction history, Kraken trades or Binance spot trade history), or a CSV with the columns")}{" "}
          <span className="mono">{CSV_COLUMNS.join(", ")}</span>.{" "}
          {t("Up to {max} rows; rows already in your portfolio are skipped. The file is read on this device, and CPA never asks for exchange API keys.", { max: MAX_IMPORT_ROWS.toLocaleString(locale()) })}
        </p>
        <label className="form-field" htmlFor={inputId}>
          <span>{t("CSV file")}</span>
          <input
            id={inputId}
            className="input file-input"
            type="file"
            accept=".csv,text/csv"
            onChange={onFile}
            aria-invalid={Boolean(fileError) || undefined}
            aria-describedby={fileError ? `${inputId}-error` : undefined}
          />
          {fileError && <small id={`${inputId}-error`} className="field-error">{fileError}</small>}
        </label>
        {result && (
          <div role="status">
            <p className="num">
              {result.name}: {tn(count, "{count} transaction ready", "{count} transactions ready")}
              {result.skipped.length > 0 && t(", {count} skipped", { count: result.skipped.length })}.
              {result.format && ` ${t("Read as {format}.", { format: result.format })}`}
            </p>
            {result.notes.length > 0 && <p className="sheet-note">{result.notes.join(" ")}</p>}
            {result.skipped.length > 0 && (
              <ul className="import-skipped">
                {result.skipped.slice(0, 20).map((item) => (
                  <li key={item.line} className="num">{t("Row {line}: {reason}", { line: item.line, reason: item.reason })}</li>
                ))}
                {result.skipped.length > 20 && <li>{t("…and {count} more.", { count: result.skipped.length - 20 })}</li>}
              </ul>
            )}
          </div>
        )}
        <button
          className="button-primary"
          disabled={!count}
          onClick={() => {
            onImport(result.transactions);
            onClose();
          }}
        >
          {count ? tn(count, "Import {count} transaction", "Import {count} transactions") : t("Import")}
        </button>
      </div>
    </Sheet>
  );
}

// One wallet preview line: what the import records for a coin, or why it records nothing.
function walletRowText(row, currency, rate) {
  if (!row.txs.length) return row.reason;
  const day = (value) => formatDate(`${value}T12:00:00Z`);
  const parts = [];
  if (row.openingDay) parts.push(t("{amount} held before {date}", { amount: formatAmount(row.txs[0].amount), date: day(row.openingDay) }));
  if (row.transfers) parts.push(tn(row.transfers, "transfers on {count} day from {date}", "transfers on {count} days from {date}", { date: day(row.firstDay) }));
  if (row.adjustment) parts.push(t("{amount} adjustment at {price}", { amount: `${row.adjustment > 0 ? "+" : "−"}${formatAmount(Math.abs(row.adjustment))}`, price: formatPrice(row.coin.price, currency, rate) }));
  if (row.unpriced) parts.push(tn(row.unpriced, "{count} day without a closing price uses today's", "{count} days without a closing price use today's"));
  return parts.join(" · ");
}

// Read-only wallet import (US-6.4): paste a public address, preview, then record dated transfers.
function WalletSheet({ open, onClose, coins, transactions, demo, onImport, currency, rate }) {
  const inputId = useId();
  const [address, setAddress] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const warning = secretWarning(address);
  const chain = warning ? null : chainFor(address);
  const chainLabel = WALLET_CHAINS.find((item) => item.id === chain)?.label;
  // Earlier imports of this address; with history, they can be rebuilt (e.g. ones recorded at the
  // import day's price before transfer history was read).
  const [rebuild, setRebuild] = useState(false);
  const earlier = useMemo(
    () => (state.status === "done" ? transactions.filter((tx) => tx.note === walletNote(state.address)) : []),
    [state, transactions],
  );
  const canRebuild = earlier.length > 0 && state.status === "done" && state.history.entries.length > 0;
  const replacing = canRebuild && rebuild;
  const plan = useMemo(() => {
    if (state.status !== "done") return null;
    const kept = replacing ? transactions.filter((tx) => tx.note !== walletNote(state.address)) : transactions;
    return walletImportPlan(state, state.address, kept, coins);
  }, [state, transactions, coins, replacing]);

  const lookUp = async (event) => {
    event.preventDefault();
    if (!chain || state.status === "loading") return;
    const lookedUp = address.trim();
    setState({ status: "loading" });
    try {
      const result = await lookupWallet(chain, lookedUp, { demo });
      setState({ status: "done", address: normaliseAddress(lookedUp), ...result });
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  };

  const fieldError = warning ?? (address.trim() && !chain ? t("Enter a Bitcoin address (1…, 3… or bc1…) or an Ethereum address (0x…).") : null);
  const count = plan?.transactions.length ?? 0;
  return (
    <Sheet open={open} onClose={onClose} title={t("Import from wallet")} side="bottom">
      <form className="tx-form" onSubmit={lookUp} noValidate>
        <p className="sheet-note wallet-safety">
          <Icon name="info" /> {t("Never enter a recovery phrase or private key. CPA only needs a public address, and it's read, never stored.")}
        </p>
        <label className="form-field" htmlFor={inputId}>
          <span>{t("Bitcoin or Ethereum address")}</span>
          <input
            id={inputId}
            className="input mono"
            value={address}
            onChange={(event) => {
              setAddress(event.target.value);
              setRebuild(false);
              if (state.status !== "loading") setState({ status: "idle" });
            }}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            maxLength={120}
            placeholder={t("bc1q… or 0x…")}
            aria-invalid={Boolean(fieldError) || undefined}
            aria-describedby={`${inputId}-hint`}
          />
          {fieldError ? (
            <small id={`${inputId}-hint`} className="field-error">{fieldError}</small>
          ) : (
            <small id={`${inputId}-hint`} className="field-hint">
              {chainLabel ? t("{chain} address.", { chain: chainLabel }) : t("ETH also brings in the ERC-20 tokens CPA lists, such as USDT, LINK and UNI.")}
            </small>
          )}
        </label>
        <button type="submit" className="button-secondary" disabled={!chain || state.status === "loading"}>
          {state.status === "loading" ? t("Looking up…") : t("Look up balances")}
        </button>

        <div role="status" aria-live="polite">
          {state.status === "error" && <p className="field-error">{state.message}</p>}
          {plan && (
            <>
              <p className="num">
                {shortAddress(state.address)}
                {state.demo ? ` · ${t("demo balances, no lookup made")}` : ` · ${t("as of {date}", { date: formatDate(state.asOf) })}`}
              </p>
              {plan.rows.length === 0 ? (
                <p>{t("This address holds none of the coins CPA lists.")}</p>
              ) : (
                <ul className="wallet-preview">
                  {plan.rows.map((row) => (
                    <li key={row.coin.id}>
                      <CoinLogo coin={row.coin} />
                      <span>
                        <strong className="num">{formatAmount(row.balance)} {row.coin.symbol}</strong>
                        <small className="num">{walletRowText(row, currency, rate)}</small>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {count > 0 && (
                <p className="sheet-note">
                  {plan.rows.some((row) => row.transfers)
                    ? t("Cost basis: each transfer at that day's closing price ({source}); adjustments at today's price.", { source: state.demo ? t("CPA sample data") : "Coinbase, UTC" })
                    : t("Cost basis is today's price.")}
                  {!state.history.complete && ` ${t("Only recent history was read; the balance before it is priced at the earliest day read.")}`}
                  {" "}{t("Edit a transaction to change it.")}
                </p>
              )}
            </>
          )}
        </div>
        {canRebuild && (
          <label className="check-row">
            <input type="checkbox" checked={rebuild} onChange={(event) => setRebuild(event.target.checked)} />
            {tn(earlier.length, "Rebuild from history: replace the {count} earlier transaction from this address", "Rebuild from history: replace the {count} earlier transactions from this address")}
          </label>
        )}
        {plan && (
          <button
            type="button"
            className="button-primary"
            disabled={!count}
            onClick={() => {
              onImport(plan.transactions, replacing ? { replace: earlier.map((tx) => tx.id) } : undefined);
              onClose();
            }}
          >
            {count ? tn(count, "Import {count} transaction", "Import {count} transactions") : t("Nothing to import")}
          </button>
        )}
      </form>
    </Sheet>
  );
}

function GuestPreview({ onDemo, onLogin }) {
  return (
    <div className="guest-preview">
      <div className="guest-blur" aria-hidden="true">
        <p className="display-value">$24,580.12</p>
        <p className="up">▲ +$412.30 (+1.71%) {t("24h")}</p>
        <div className="guest-bars">
          <span style={{ width: "62%" }} />
          <span style={{ width: "38%" }} />
          <span style={{ width: "21%" }} />
        </div>
      </div>
      <div className="guest-cta card">
        <h2 className="subsection-title">{t("Track your portfolio")}</h2>
        <p className="muted-line">{t("Sign in or try the demo to log buys and sells and see your P&L.")}</p>
        <button className="button-primary" onClick={onLogin}>{t("Log in")}</button>
        <button className="button-tertiary" onClick={onDemo}>{t("Try a private demo")}</button>
      </div>
    </div>
  );
}

function Disclaimer() {
  return (
    <p className="disclaimer">
      {t("Not financial advice. Data provided for informational purposes.")}{" "}
      {t("Prices: CryptoRank (live) and Coinbase closes (history) where available, CPA sample data otherwise.")}
    </p>
  );
}

// Names the price source under the value chart (clarification 28).
function chartSource(ids, series, coins) {
  const sample = ids.filter((id) => !series.has(id)).map((id) => coins.find((coin) => coin.id === id)?.symbol ?? id);
  if (!sample.length) return t("Coinbase closes, USD, UTC");
  if (sample.length === ids.length) return t("CPA sample data");
  return t("Coinbase closes, USD, UTC; CPA sample data for {coins}", { coins: sample.join(", ") });
}

export default function Portfolio() {
  const { session, settings, transactions, saveTransaction, importTransactions, updateSettings, requireAuth, startDemo, showToast } = useApp();
  const { coins } = useMarket();
  const navigate = useNavigate();
  // Remembered per account (clarification 35, journey rule 2).
  const { range, sort, taxMethod } = settings.portfolio;
  const updatePortfolio = (patch) => updateSettings({ portfolio: patch });
  const [sheet, setSheet] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [taxOpen, setTaxOpen] = useState(false);

  usePageTitle(t("Portfolio"));

  const currency = settings.currency;
  const rate = rateFor(currency, coins);
  const hide = settings.hideBalances;
  const money = (value) => (hide ? MASK : formatPrice(value, currency, rate));
  const holdings = useMemo(() => computeHoldings(transactions, coins).filter((item) => item.amount > 1e-12), [transactions, coins]);
  const summary = summarize(holdings);
  const tradedIds = useMemo(() => [...new Set(transactions.map((tx) => tx.coinId))].sort().join(","), [transactions]);
  const traded = useMemo(() => coins.filter((coin) => tradedIds.split(",").includes(coin.id)), [coins, tradedIds]);
  const live = usePriceHistories(traded, chartRange[range]);
  // live.version changes when a range has been read; the series come from the history cache.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const history = useMemo(() => (live.loading ? [] : valueHistory(transactions, coins, range, live.series)), [transactions, coins, range, live.loading, live.version]);
  const performance = range === "ALL" ? null : rangePerformance(transactions, history);
  const sorted = [...holdings].sort((a, b) => (sort === "name" ? a.coin.name.localeCompare(b.coin.name) : b[sort] - a[sort]));
  const slices = [...holdings].sort((a, b) => b.value - a.value).map((item) => ({ label: item.coin.symbol, value: item.value }));

  const openAdd = () => requireAuth(t("Sign in to track a portfolio"), () => setSheet({}));
  const exportCsv = () => {
    const ok = downloadText(`cpa-transactions-${isoDay()}.csv`, transactionsToCsv(transactions, coins), "text/csv");
    showToast(ok ? tn(transactions.length, "Exported {count} transaction", "Exported {count} transactions") : t("Couldn't start the download in this browser."));
  };

  return (
    <div className="portfolio">
      <div className="page-head">
        <h1>{t("Portfolio")}</h1>
        {session.kind !== "guest" && (
          <button className="icon-button" onClick={() => updateSettings({ hideBalances: !hide })} aria-pressed={hide} aria-label={hide ? t("Show balances") : t("Hide balances")}>
            <Icon name={hide ? "eyeOff" : "eye"} />
          </button>
        )}
      </div>

      {session.kind === "guest" ? (
        <GuestPreview onDemo={startDemo} onLogin={() => navigate("/login?next=/portfolio")} />
      ) : holdings.length === 0 ? (
        <div className="empty-state">
          <Icon name="chart" className="empty-icon" />
          <p>{t("Log your first transaction to see your portfolio.")}</p>
          <button className="button-primary" onClick={openAdd}>{t("Add transaction")}</button>
        </div>
      ) : (
        <>
          <section className="portfolio-summary" aria-label={t("Summary")}>
            <p className="muted-line">{t("Total value")}</p>
            <p className="display-value num">{money(summary.value)}</p>
            <p className={`num ${direction(summary.change24h)}`}>
              {arrow(summary.change24h)} {hide ? MASK : formatSignedPrice(summary.change24h, currency, rate)} ({formatPercent(summary.change24hPct)}) {t("24h")}
            </p>
            <p className="num muted-line">
              {t("All-time P&L")}{" "}
              <span className={direction(summary.pnl)}>
                {arrow(summary.pnl)} {hide ? MASK : formatSignedPrice(summary.pnl, currency, rate)} ({formatPercent(summary.pnlPct)})
              </span>
            </p>
            <p className="num muted-line">
              {t("Unrealized")}{" "}
              <span className={direction(summary.unrealized)}>{arrow(summary.unrealized)} {hide ? MASK : formatSignedPrice(summary.unrealized, currency, rate)}</span>
              {" · "}{t("Realized")}{" "}
              <span className={direction(summary.realized)}>{arrow(summary.realized)} {hide ? MASK : formatSignedPrice(summary.realized, currency, rate)}</span>
            </p>
          </section>

          <section className="card chart-card" aria-label={t("Portfolio value chart")}>
            {live.error && <ErrorBanner what="price history" onRetry={live.retry} />}
            {live.loading && (
              <>
                <p className="visually-hidden" role="status">{t("Loading the value chart…")}</p>
                <div className="skeleton skeleton-chart" aria-hidden="true" />
              </>
            )}
            {performance && (
              <p className="num muted-line">
                {t("P&L over {range}", { range })}{" "}
                <span className={direction(performance.pnl)}>
                  {arrow(performance.pnl)} {hide ? MASK : formatSignedPrice(performance.pnl, currency, rate)} ({formatPercent(performance.pct)})
                </span>
              </p>
            )}
            {history.length > 1 && (
              <PriceChart points={history} rangeId={range === "24h" ? "1D" : range} currency={currency} rate={rate} label={range} mask={hide} name={t("Portfolio value")} />
            )}
            {history.length > 1 && !hide && <ChartSummary text={t("Portfolio value: {summary}", { summary: chartSummary(history, range, currency, rate) })} />}
            {!live.loading && <p className="muted-line chart-source">{t("Chart: {source}", { source: chartSource(tradedIds.split(","), live.series, coins) })}</p>}
            <div className="segmented" role="group" aria-label={t("Chart range")}>
              {ranges.map((item) => (
                <button key={item} className={range === item ? "segment active" : "segment"} aria-pressed={range === item} onClick={() => updatePortfolio({ range: item })}>
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="allocation-title">
            <h2 id="allocation-title" className="subsection-title">{t("Allocation")}</h2>
            <Donut slices={slices} />
          </section>

          <section aria-labelledby="holdings-title">
            <div className="section-row">
              <h2 id="holdings-title" className="subsection-title">{t("Holdings")}</h2>
              <label className="inline-select">
                {t("Sort")}
                <select className="select" value={sort} onChange={(event) => updatePortfolio({ sort: event.target.value })}>
                  <option value="value">{t("Value")}</option>
                  <option value="pnl">{t("P&L")}</option>
                  <option value="pnlPct">{t("P&L %")}</option>
                  <option value="name">{t("Name")}</option>
                </select>
              </label>
            </div>
            <ul className="holding-list">
              {sorted.map((item) => (
                <li key={item.coinId}>
                  <Link to={`/portfolio/${item.coinId}`} className="holding-row">
                    <CoinLogo coin={item.coin} />
                    <span className="holding-main">
                      <strong>
                        {item.coin.symbol} <span className="num">{hide ? MASK : formatAmount(item.amount)}</span>
                      </strong>
                      <span className="num">{t("Avg {price}", { price: money(item.avgPrice) })}</span>
                    </span>
                    <span className="holding-value num">
                      <strong>{money(item.value)}</strong>
                      <span className={direction(item.pnl)}>
                        {arrow(item.pnl)} {hide ? MASK : formatSignedPrice(item.pnl, currency, rate)} ({formatPercent(item.pnlPct)})
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <button className="button-primary" onClick={openAdd}>{t("+ Add transaction")}</button>
        </>
      )}

      {session.kind !== "guest" && (
        <div className="import-row csv-row">
          <span>
            <strong>{t("Transactions as CSV")}</strong>
            <small>{t("For spreadsheets and tax tools, or to bring trades in from Coinbase, Kraken, Binance and other tools.")}</small>
          </span>
          <span className="csv-actions">
            <button className="button-secondary compact" onClick={exportCsv} disabled={!transactions.length}>{t("Export")}</button>
            <button className="button-secondary compact" onClick={() => setImportOpen(true)}>{t("Import")}</button>
          </span>
        </div>
      )}

      {session.kind !== "guest" && (
        <div className="import-row csv-row">
          <span>
            <strong>{t("Import from wallet (read-only)")}</strong>
            <small>{t("Bitcoin and Ethereum public addresses. CPA never asks for recovery phrases or private keys.")}</small>
          </span>
          <span className="csv-actions">
            <button className="button-secondary compact" onClick={() => setWalletOpen(true)}>{t("Import")}</button>
          </span>
        </div>
      )}

      {session.kind !== "guest" && (
        <div className="import-row csv-row">
          <span>
            <strong>{t("Tax-lot report")}</strong>
            <small>{t("Realized gains by FIFO or average cost, as CSV. Not tax advice.")}</small>
          </span>
          <span className="csv-actions">
            <button className="button-secondary compact" onClick={() => setTaxOpen(true)} disabled={!transactions.length}>{t("Open report")}</button>
          </span>
        </div>
      )}

      <Disclaimer />

      {taxOpen && <TaxReportSheet open onClose={() => setTaxOpen(false)} transactions={transactions} coins={coins} hide={hide} onToast={showToast} method={taxMethod} onMethod={(value) => updatePortfolio({ taxMethod: value })} />}
      {sheet && (
        <TransactionSheet open onClose={() => setSheet(null)} initial={sheet} coins={coins} transactions={transactions} onSave={saveTransaction} />
      )}
      {importOpen && <ImportSheet open onClose={() => setImportOpen(false)} coins={coins} transactions={transactions} onImport={importTransactions} />}
      {walletOpen && (
        <WalletSheet
          open
          onClose={() => setWalletOpen(false)}
          coins={coins}
          transactions={transactions}
          demo={session.kind === "demo"}
          onImport={importTransactions}
          currency={currency}
          rate={rate}
        />
      )}
    </div>
  );
}

// One holding with its transaction history (/portfolio/:slug).
export function Holding() {
  const { slug } = useParams();
  const { session, settings, transactions, saveTransaction, deleteTransaction } = useApp();
  const { coins } = useMarket();
  const [sheet, setSheet] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const coin = coins.find((item) => item.id === slug);

  usePageTitle(coin ? t("{symbol} holding", { symbol: coin.symbol }) : null);

  if (!coin) return <NotFound />;
  if (session.kind === "guest") {
    return (
      <div className="portfolio">
        <h1>{coin.name}</h1>
        <p className="muted-line">{t("Sign in or try the demo to see holdings.")}</p>
        <Link to="/portfolio" className="button-secondary">{t("Back to portfolio")}</Link>
      </div>
    );
  }

  const currency = settings.currency;
  const rate = rateFor(currency, coins);
  const hide = settings.hideBalances;
  const money = (value) => (hide ? MASK : formatPrice(value, currency, rate));
  const holding = computeHoldings(transactions, coins).find((item) => item.coinId === coin.id);
  const history = transactions.filter((tx) => tx.coinId === coin.id).sort((a, b) => new Date(b.date) - new Date(a.date));
  const rounds = researchFor(coin).rounds.filter((round) => round.tokenPrice);

  return (
    <div className="portfolio">
      <Link to="/portfolio" className="link-button back">
        <Icon name="chevron" className="icon flip" /> {t("Portfolio")}
      </Link>
      <header className="detail-header">
        <CoinLogo coin={coin} size="lg" />
        <div className="detail-title">
          <h1>
            {coin.name} <span className="ticker">{coin.symbol}</span>
          </h1>
          <Link to={`/coins/${coin.id}`} className="inline-link">{t("View coin details")}</Link>
        </div>
      </header>

      {holding && holding.amount > 1e-12 ? (
        <dl className="stats">
          <div><dt>{t("Holding")}</dt><dd className="num">{hide ? MASK : formatAmount(holding.amount)} {coin.symbol}</dd></div>
          <div><dt>{t("Value")}</dt><dd className="num">{money(holding.value)}</dd></div>
          <div><dt>{t("Average buy price")}</dt><dd className="num">{money(holding.avgPrice)}</dd></div>
          <div>
            <dt>{t("Unrealized P&L")}</dt>
            <dd className={`num ${direction(holding.unrealized)}`}>{hide ? MASK : formatSignedPrice(holding.unrealized, currency, rate)}</dd>
          </div>
          <div>
            <dt>{t("Realized P&L")}</dt>
            <dd className={`num ${direction(holding.realized)}`}>{hide ? MASK : formatSignedPrice(holding.realized, currency, rate)}</dd>
          </div>
          <div>
            <dt>{t("All-time P&L")}</dt>
            <dd className={`num ${direction(holding.pnl)}`}>
              {hide ? MASK : formatSignedPrice(holding.pnl, currency, rate)} ({formatPercent(holding.pnlPct)})
            </dd>
          </div>
        </dl>
      ) : (
        <p className="empty-line">{t("You don't hold any {symbol} right now.", { symbol: coin.symbol })}</p>
      )}

      {holding && rounds.length > 0 && (
        <p className="card entry-compare num">
          {t("Your entry {price} vs", { price: money(holding.avgPrice) })} {rounds.map((round) => `${round.type.toLowerCase()} ${formatPrice(round.tokenPrice, currency, rate)}`).join(" / ")}
        </p>
      )}

      <section aria-labelledby="tx-title">
        <div className="section-row">
          <h2 id="tx-title" className="subsection-title">{t("Transactions")}</h2>
          <button className="button-secondary compact" onClick={() => setSheet({ coinId: coin.id })}>{t("+ Add")}</button>
        </div>
        {history.length ? (
          <ul className="tx-list">
            {history.map((tx) => (
              <li key={tx.id} className="tx-row">
                <span>
                  <strong>{t(transactionTypes.find((type) => type.id === tx.type)?.label ?? "")}</strong>{" "}
                  <span className="num">{hide ? MASK : formatAmount(tx.amount)} {coin.symbol} @ {money(tx.price)}</span>
                  <small className="num">
                    {formatDate(tx.date)}
                    {tx.fee ? ` · ${t("fee {amount}", { amount: money(tx.fee) })}` : ""}
                    {tx.note ? ` · ${noteText(tx.note)}` : ""}
                  </small>
                </span>
                <span className="tx-actions">
                  <button className="button-tertiary" onClick={() => setSheet(tx)}>{t("Edit")}</button>
                  <button className="button-tertiary danger" onClick={() => setConfirm(tx)}>{t("Delete")}</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">{t("No transactions for {symbol} yet.", { symbol: coin.symbol })}</p>
        )}
      </section>

      <Disclaimer />

      {sheet && <TransactionSheet open onClose={() => setSheet(null)} initial={sheet} coins={coins} transactions={transactions} onSave={saveTransaction} />}

      <Sheet open={Boolean(confirm)} onClose={() => setConfirm(null)} title={t("Delete transaction")} side="bottom">
        {confirm && (
          <>
            <p className="sheet-note num">
              {t("Delete this {type} of {amount} {symbol} on {date}? Your totals will be recalculated.", {
                type: t(transactionTypes.find((type) => type.id === confirm.type)?.label ?? "").toLowerCase(),
                amount: formatAmount(confirm.amount),
                symbol: coin.symbol,
                date: formatDate(confirm.date),
              })}
            </p>
            <button
              className="button-primary danger-fill"
              onClick={() => {
                deleteTransaction(confirm.id);
                setConfirm(null);
              }}
            >
              {t("Delete transaction")}
            </button>
            <button className="button-secondary button-block" onClick={() => setConfirm(null)}>{t("Keep it")}</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
