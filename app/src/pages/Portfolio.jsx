import { useEffect, useId, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Donut from "../components/Donut.jsx";
import Icon from "../components/Icon.jsx";
import PriceChart from "../components/PriceChart.jsx";
import Sheet from "../components/Sheet.jsx";
import { researchFor } from "../data/research.js";
import { direction, formatDate, formatPercent, formatPrice, rateFor } from "../lib/format.js";
import { amountHeld, computeHoldings, priceAt, summarize, transactionTypes, valueHistory } from "../lib/portfolio.js";
import { useNow } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";
import { NotFound } from "./Placeholder.jsx";

const ranges = ["24h", "7D", "1M", "3M", "1Y", "ALL"];
const MASK = "••••";
const arrow = (value) => (direction(value) === "up" ? "▲" : direction(value) === "down" ? "▼" : "");
const formatAmount = (value) => Number(value.toFixed(8)).toLocaleString("en-US", { maximumFractionDigits: 8 });
// Signed money: +$809.71 / −$12.00 (true minus sign).
const signedMoney = (value, currency, rate) => `${value >= 0 ? "+" : "−"}${formatPrice(Math.abs(value), currency, rate)}`;

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
  const now = useNow(30_000);

  const coin = coins.find((item) => item.id === form.coinId);
  const amount = Number(form.amount);
  const price = Number(form.price);
  const fee = Number(form.fee || 0);
  const held = amountHeld(transactions, form.coinId, initial?.id);
  const reduces = form.type === "sell" || form.type === "transfer-out";

  const errors = {};
  if (!(amount > 0)) errors.amount = "Enter an amount greater than 0.";
  else if (reduces && amount > held + 1e-12) errors.amount = `You can't ${form.type === "sell" ? "sell" : "transfer out"} more than you hold (${formatAmount(Math.max(held, 0))} ${coin?.symbol}).`;
  if (!(price >= 0) || form.price === "") errors.price = "Enter a price of 0 or more.";
  if (!(fee >= 0)) errors.fee = "Fee can't be negative.";
  if (!form.date || Number.isNaN(new Date(form.date).getTime())) errors.date = "Choose a date and time.";
  else if (new Date(form.date).getTime() > now + 60_000) errors.date = "The date can't be in the future.";
  const valid = Object.keys(errors).length === 0;

  const set = (patch) => setForm((current) => ({ ...current, ...patch }));
  const applyMarketPrice = () => {
    if (!coin || errors.date) return;
    const value = priceAt(coin, new Date(form.date).getTime());
    set({ price: value.toFixed(value >= 1 ? 2 : 6) });
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
    <Sheet open={open} onClose={onClose} title={initial?.id ? "Edit transaction" : "Add transaction"} side="bottom">
      <form className="tx-form" onSubmit={submit} noValidate>
        <div className="segmented tx-types" role="group" aria-label="Transaction type">
          {transactionTypes.map((type) => (
            <button key={type.id} type="button" className={form.type === type.id ? "segment active" : "segment"} aria-pressed={form.type === type.id} onClick={() => set({ type: type.id })}>
              {type.label}
            </button>
          ))}
        </div>

        <label className="form-field" htmlFor={`${formId}-coin`}>
          <span>Coin</span>
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
          <span>Amount{reduces && <small className="num"> · You hold {formatAmount(Math.max(held, 0))} {coin?.symbol}</small>}</span>
          <input {...field("amount")} className="input num" inputMode="decimal" value={form.amount} onChange={(event) => set({ amount: event.target.value })} placeholder="0.00" />
          {showError("amount") && <span id={`${formId}-amount-error`} className="field-error">{errors.amount}</span>}
        </label>

        <div className="form-field">
          <label htmlFor={`${formId}-price`}>Price per coin (USD)</label>
          <div className="input-row">
            <input {...field("price")} className="input num" inputMode="decimal" value={form.price} onChange={(event) => set({ price: event.target.value })} />
            <button type="button" className="button-tertiary" onClick={applyMarketPrice}>↺ Use market price</button>
          </div>
          {showError("price") && <span id={`${formId}-price-error`} className="field-error">{errors.price}</span>}
        </div>

        <label className="form-field" htmlFor={`${formId}-date`}>
          <span>Date</span>
          <input {...field("date")} type="datetime-local" className="input" value={form.date} max={toLocalInput(new Date(now))} onChange={(event) => set({ date: event.target.value })} />
          {showError("date") && <span id={`${formId}-date-error`} className="field-error">{errors.date}</span>}
        </label>

        <label className="form-field" htmlFor={`${formId}-fee`}>
          <span>Fee (USD)</span>
          <input {...field("fee")} className="input num" inputMode="decimal" value={form.fee} onChange={(event) => set({ fee: event.target.value })} placeholder="0.00" />
          {showError("fee") && <span id={`${formId}-fee-error`} className="field-error">{errors.fee}</span>}
        </label>

        <label className="form-field" htmlFor={`${formId}-note`}>
          <span>Note</span>
          <input id={`${formId}-note`} className="input" value={form.note} maxLength={140} onChange={(event) => set({ note: event.target.value })} placeholder="Optional" />
        </label>

        <p className="tx-total num">
          {form.type === "buy" ? "Total spent" : form.type === "sell" ? "Total received" : "Value"}{" "}
          <strong>{Number.isFinite(total) && amount > 0 ? formatPrice(Math.max(total, 0)) : "—"}</strong>
        </p>
        <button type="submit" className="button-primary">{initial?.id ? "Save changes" : "Add transaction"}</button>
      </form>
    </Sheet>
  );
}

function GuestPreview({ onDemo, onLogin }) {
  return (
    <div className="guest-preview">
      <div className="guest-blur" aria-hidden="true">
        <p className="display-value">$24,580.12</p>
        <p className="up">▲ +$412.30 (+1.71%) 24h</p>
        <div className="guest-bars">
          <span style={{ width: "62%" }} />
          <span style={{ width: "38%" }} />
          <span style={{ width: "21%" }} />
        </div>
      </div>
      <div className="guest-cta card">
        <h2 className="subsection-title">Track your portfolio</h2>
        <p className="muted-line">Sign in or try the demo to log buys and sells and see your P&L.</p>
        <button className="button-primary" onClick={onLogin}>Log in</button>
        <button className="button-tertiary" onClick={onDemo}>Try a private demo</button>
      </div>
    </div>
  );
}

function Disclaimer() {
  return <p className="disclaimer">Not financial advice. Data provided for informational purposes. Prices are CPA sample data.</p>;
}

export default function Portfolio() {
  const { session, settings, transactions, saveTransaction, updateSettings, requireAuth, startDemo } = useApp();
  const { coins } = useMarket();
  const navigate = useNavigate();
  const [range, setRange] = useState("1M");
  const [sort, setSort] = useState("value");
  const [sheet, setSheet] = useState(null);

  useEffect(() => {
    document.title = "Portfolio · CPA";
  }, []);

  const currency = settings.currency;
  const rate = rateFor(currency, coins);
  const hide = settings.hideBalances;
  const money = (value) => (hide ? MASK : formatPrice(value, currency, rate));
  const holdings = useMemo(() => computeHoldings(transactions, coins).filter((item) => item.amount > 1e-12), [transactions, coins]);
  const summary = summarize(holdings);
  const history = useMemo(() => valueHistory(transactions, coins, range), [transactions, coins, range]);
  const sorted = [...holdings].sort((a, b) => (sort === "name" ? a.coin.name.localeCompare(b.coin.name) : b[sort] - a[sort]));
  const slices = [...holdings].sort((a, b) => b.value - a.value).map((item) => ({ label: item.coin.symbol, value: item.value }));

  const openAdd = () => requireAuth("Sign in to track a portfolio", () => setSheet({}));

  return (
    <div className="portfolio">
      <div className="page-head">
        <h1>Portfolio</h1>
        {session.kind !== "guest" && (
          <button className="icon-button" onClick={() => updateSettings({ hideBalances: !hide })} aria-pressed={hide} aria-label={hide ? "Show balances" : "Hide balances"}>
            <Icon name={hide ? "eyeOff" : "eye"} />
          </button>
        )}
      </div>

      {session.kind === "guest" ? (
        <GuestPreview onDemo={startDemo} onLogin={() => navigate("/login?next=/portfolio")} />
      ) : holdings.length === 0 ? (
        <div className="empty-state">
          <Icon name="chart" className="empty-icon" />
          <p>Log your first transaction to see your portfolio.</p>
          <button className="button-primary" onClick={openAdd}>Add transaction</button>
        </div>
      ) : (
        <>
          <section className="portfolio-summary" aria-label="Summary">
            <p className="muted-line">Total value</p>
            <p className="display-value num">{money(summary.value)}</p>
            <p className={`num ${direction(summary.change24h)}`}>
              {arrow(summary.change24h)} {hide ? MASK : signedMoney(summary.change24h, currency, rate)} ({formatPercent(summary.change24hPct)}) 24h
            </p>
            <p className="num muted-line">
              All-time P&L{" "}
              <span className={direction(summary.pnl)}>
                {arrow(summary.pnl)} {hide ? MASK : signedMoney(summary.pnl, currency, rate)} ({formatPercent(summary.pnlPct)})
              </span>
            </p>
          </section>

          <section className="card chart-card" aria-label="Portfolio value chart">
            {history.length > 1 && (
              <PriceChart points={history} rangeId={range === "24h" ? "1D" : range} currency={currency} rate={rate} label={range} mask={hide} name="Portfolio value" />
            )}
            <div className="segmented" role="group" aria-label="Chart range">
              {ranges.map((item) => (
                <button key={item} className={range === item ? "segment active" : "segment"} aria-pressed={range === item} onClick={() => setRange(item)}>
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section aria-labelledby="allocation-title">
            <h2 id="allocation-title" className="subsection-title">Allocation</h2>
            <Donut slices={slices} />
          </section>

          <section aria-labelledby="holdings-title">
            <div className="section-row">
              <h2 id="holdings-title" className="subsection-title">Holdings</h2>
              <label className="inline-select">
                Sort
                <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
                  <option value="value">Value</option>
                  <option value="pnl">P&L</option>
                  <option value="pnlPct">P&L %</option>
                  <option value="name">Name</option>
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
                      <span className="num">Avg {money(item.avgPrice)}</span>
                    </span>
                    <span className="holding-value num">
                      <strong>{money(item.value)}</strong>
                      <span className={direction(item.pnl)}>
                        {arrow(item.pnl)} {hide ? MASK : signedMoney(item.pnl, currency, rate)} ({formatPercent(item.pnlPct)})
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <button className="button-primary" onClick={openAdd}>+ Add transaction</button>
        </>
      )}

      <div className="import-row" aria-disabled="true">
        <span>
          <strong>Import from wallet (read-only)</strong>
          <small>Coming soon. CPA will only ever accept public addresses and never asks for seed phrases or private keys.</small>
        </span>
        <span className="tag">Soon</span>
      </div>

      <Disclaimer />

      {sheet && (
        <TransactionSheet open onClose={() => setSheet(null)} initial={sheet} coins={coins} transactions={transactions} onSave={saveTransaction} />
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

  useEffect(() => {
    if (coin) document.title = `${coin.symbol} holding · CPA`;
  }, [coin]);

  if (!coin) return <NotFound />;
  if (session.kind === "guest") {
    return (
      <div className="portfolio">
        <h1>{coin.name}</h1>
        <p className="muted-line">Sign in or try the demo to see holdings.</p>
        <Link to="/portfolio" className="button-secondary">Back to portfolio</Link>
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
        <Icon name="chevron" className="icon flip" /> Portfolio
      </Link>
      <header className="detail-header">
        <CoinLogo coin={coin} size="lg" />
        <div className="detail-title">
          <h1>
            {coin.name} <span className="ticker">{coin.symbol}</span>
          </h1>
          <Link to={`/coins/${coin.id}`} className="inline-link">View coin details</Link>
        </div>
      </header>

      {holding && holding.amount > 1e-12 ? (
        <dl className="stats">
          <div><dt>Holding</dt><dd className="num">{hide ? MASK : formatAmount(holding.amount)} {coin.symbol}</dd></div>
          <div><dt>Value</dt><dd className="num">{money(holding.value)}</dd></div>
          <div><dt>Average buy price</dt><dd className="num">{money(holding.avgPrice)}</dd></div>
          <div>
            <dt>All-time P&L</dt>
            <dd className={`num ${direction(holding.pnl)}`}>
              {hide ? MASK : signedMoney(holding.pnl, currency, rate)} ({formatPercent(holding.pnlPct)})
            </dd>
          </div>
        </dl>
      ) : (
        <p className="empty-line">You don't hold any {coin.symbol} right now.</p>
      )}

      {holding && rounds.length > 0 && (
        <p className="card entry-compare num">
          Your entry {money(holding.avgPrice)} vs {rounds.map((round) => `${round.type.toLowerCase()} ${formatPrice(round.tokenPrice, currency, rate)}`).join(" / ")}
        </p>
      )}

      <section aria-labelledby="tx-title">
        <div className="section-row">
          <h2 id="tx-title" className="subsection-title">Transactions</h2>
          <button className="button-secondary compact" onClick={() => setSheet({ coinId: coin.id })}>+ Add</button>
        </div>
        {history.length ? (
          <ul className="tx-list">
            {history.map((tx) => (
              <li key={tx.id} className="tx-row">
                <span>
                  <strong>{transactionTypes.find((type) => type.id === tx.type)?.label}</strong>{" "}
                  <span className="num">{hide ? MASK : formatAmount(tx.amount)} {coin.symbol} @ {money(tx.price)}</span>
                  <small className="num">
                    {formatDate(tx.date)}
                    {tx.fee ? ` · fee ${money(tx.fee)}` : ""}
                    {tx.note ? ` · ${tx.note}` : ""}
                  </small>
                </span>
                <span className="tx-actions">
                  <button className="button-tertiary" onClick={() => setSheet(tx)}>Edit</button>
                  <button className="button-tertiary danger" onClick={() => setConfirm(tx)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">No transactions for {coin.symbol} yet.</p>
        )}
      </section>

      <Disclaimer />

      {sheet && <TransactionSheet open onClose={() => setSheet(null)} initial={sheet} coins={coins} transactions={transactions} onSave={saveTransaction} />}

      <Sheet open={Boolean(confirm)} onClose={() => setConfirm(null)} title="Delete transaction" side="bottom">
        {confirm && (
          <>
            <p className="sheet-note num">
              Delete this {transactionTypes.find((type) => type.id === confirm.type)?.label.toLowerCase()} of {formatAmount(confirm.amount)} {coin.symbol} on {formatDate(confirm.date)}? Your
              totals will be recalculated.
            </p>
            <button
              className="button-primary danger-fill"
              onClick={() => {
                deleteTransaction(confirm.id);
                setConfirm(null);
              }}
            >
              Delete transaction
            </button>
            <button className="button-secondary button-block" onClick={() => setConfirm(null)}>Keep it</button>
          </>
        )}
      </Sheet>
    </div>
  );
}
