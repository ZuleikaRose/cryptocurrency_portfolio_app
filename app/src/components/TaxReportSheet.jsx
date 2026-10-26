import { useId, useMemo, useState } from "react";
import Sheet from "./Sheet.jsx";
import { direction, formatDate, formatPrice } from "../lib/format.js";
import { downloadText } from "../lib/clipboard.js";
import { rowsInYear, TAX_METHODS, taxLotReport, taxLotsToCsv, taxTotals, taxYears } from "../lib/taxlots.js";

const MASK = "••••";
const PREVIEW_ROWS = 10;
const fileName = (method, year) => `cpa-tax-lots-${method}-${year}-${new Date().toISOString().slice(0, 10)}.csv`;
const formatAmount = (value) => Number(value.toFixed(8)).toLocaleString("en-US", { maximumFractionDigits: 8 });

// Tax-lot report (clarification 28): realized gains by FIFO or average cost, as CSV. Amounts are
// in USD, like the transactions they come from.
export default function TaxReportSheet({ open, onClose, transactions, coins, hide, onToast }) {
  const yearId = useId();
  const [method, setMethod] = useState("fifo");
  const [year, setYear] = useState("all");
  const report = useMemo(() => taxLotReport(transactions, coins, method), [transactions, coins, method]);
  const years = taxYears(report.rows);
  const shownYear = year === "all" || years.includes(Number(year)) ? year : "all";
  const rows = rowsInYear(report.rows, shownYear);
  const totals = taxTotals(rows);
  const fifo = method === "fifo";
  const usd = (value) => (hide ? MASK : formatPrice(value));
  const signed = (value) => (hide ? MASK : `${value >= 0 ? "+" : "−"}${formatPrice(Math.abs(value))}`);
  const arrow = (value) => (direction(value) === "up" ? "▲ " : direction(value) === "down" ? "▼ " : "");

  const download = () => {
    const ok = downloadText(fileName(method, shownYear), taxLotsToCsv(rows, method), "text/csv");
    onToast(ok ? `Downloaded ${rows.length} ${rows.length === 1 ? "row" : "rows"}` : "Couldn't start the download in this browser.");
  };

  return (
    <Sheet open={open} onClose={onClose} title="Tax-lot report" side="bottom">
      <div className="tx-form">
        <p className="sheet-note">
          Each sell's gain or loss, matched to the buys and transfers in it came from. Buy fees add to cost and sell fees reduce proceeds. Not tax advice: rules
          differ by country, so check them with a tax professional.
        </p>
        <div className="segmented" role="group" aria-label="Cost basis method">
          {TAX_METHODS.map((item) => (
            <button key={item.id} type="button" className={method === item.id ? "segment active" : "segment"} aria-pressed={method === item.id} onClick={() => setMethod(item.id)}>
              {item.label}
            </button>
          ))}
        </div>
        <label className="form-field" htmlFor={yearId}>
          <span>Year sold</span>
          <select id={yearId} className="select" value={shownYear} onChange={(event) => setYear(event.target.value)}>
            <option value="all">All years</option>
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        {rows.length === 0 ? (
          <p className="empty-line">No sells yet. Gains appear here once you log a sell.</p>
        ) : (
          <>
            <dl className="stats tax-totals">
              <div><dt>Sells</dt><dd className="num">{totals.sales}</dd></div>
              <div><dt>Proceeds</dt><dd className="num">{usd(totals.proceeds)}</dd></div>
              <div><dt>Cost basis</dt><dd className="num">{usd(totals.cost)}</dd></div>
              <div>
                <dt>Gain or loss</dt>
                <dd className={`num ${direction(totals.gain)}`}>{arrow(totals.gain)}{signed(totals.gain)}</dd>
              </div>
              {fifo && (
                <>
                  <div><dt>Short-term (a year or less)</dt><dd className="num">{signed(totals.shortTerm)}</dd></div>
                  <div><dt>Long-term (over a year)</dt><dd className="num">{signed(totals.longTerm)}</dd></div>
                </>
              )}
            </dl>
            <ul className="tax-rows">
              {rows.slice(0, PREVIEW_ROWS).map((row) => (
                <li key={row.id} className="num">
                  <strong>{formatDate(row.sold)} · {hide ? MASK : formatAmount(row.amount)} {row.symbol}</strong>
                  <small>
                    {row.acquired == null ? "Acquired on several dates" : `Acquired ${formatDate(row.acquired)}`}
                    {row.term ? ` · ${row.term}-term` : ""} · cost {usd(row.cost)} ·{" "}
                    <span className={direction(row.gain)}>{arrow(row.gain)}{signed(row.gain)}</span>
                  </small>
                </li>
              ))}
              {rows.length > PREVIEW_ROWS && <li>…and {rows.length - PREVIEW_ROWS} more in the CSV.</li>}
            </ul>
          </>
        )}
        {(report.transfersOut > 0 || report.uncovered > 0) && (
          <p className="sheet-note">
            {report.transfersOut > 0 && `${report.transfersOut} ${report.transfersOut === 1 ? "transfer" : "transfers"} out removed lots without a gain. `}
            {report.uncovered > 0 && `${report.uncovered} ${report.uncovered === 1 ? "sell is" : "sells are"} larger than the amount held then; only the held part is reported.`}
          </p>
        )}
        <p className="sheet-note">
          {fifo ? "FIFO matches each sell to the oldest coins first." : "Average cost uses the average price of all the coins held at the time of each sell."} Amounts in USD.
        </p>
        <button type="button" className="button-primary" disabled={!rows.length} onClick={download}>
          Download CSV
        </button>
      </div>
    </Sheet>
  );
}
