import { useId, useMemo, useState } from "react";
import Sheet from "./Sheet.jsx";
import { arrow, direction, formatAmount, formatDate, formatPrice, formatSignedPrice, isoDay, MASK } from "../lib/format.js";
import { downloadText } from "../lib/clipboard.js";
import { rowsInYear, TAX_METHODS, taxLotReport, taxLotsToCsv, taxTotals, taxYears } from "../lib/taxlots.js";
import { t, tn } from "../lib/i18n.js";

const PREVIEW_ROWS = 10;
const fileName = (method, year) => `cpa-tax-lots-${method}-${year}-${isoDay()}.csv`;

// Tax-lot report (clarification 28): realized gains by FIFO or average cost, as CSV. Amounts are
// in USD, like the transactions they come from.
export default function TaxReportSheet({ open, onClose, transactions, coins, hide, onToast, method, onMethod }) {
  const yearId = useId();
  const [year, setYear] = useState("all");
  const report = useMemo(() => taxLotReport(transactions, coins, method), [transactions, coins, method]);
  const years = taxYears(report.rows);
  const shownYear = year === "all" || years.includes(Number(year)) ? year : "all";
  const rows = rowsInYear(report.rows, shownYear);
  const totals = taxTotals(rows);
  const fifo = method === "fifo";
  const usd = (value) => (hide ? MASK : formatPrice(value));
  const signed = (value) => (hide ? MASK : formatSignedPrice(value));
  const marker = (value) => (arrow(value) ? `${marker(value)} ` : "");

  const download = () => {
    const ok = downloadText(fileName(method, shownYear), taxLotsToCsv(rows, method), "text/csv");
    onToast(ok ? tn(rows.length, "Downloaded {count} row", "Downloaded {count} rows") : t("Couldn't start the download in this browser."));
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("Tax-lot report")} side="bottom">
      <div className="tx-form">
        <p className="sheet-note">
          {t("Each sell's gain or loss, matched to the buys and transfers in it came from. Buy fees add to cost and sell fees reduce proceeds. Not tax advice: rules differ by country, so check them with a tax professional.")}
        </p>
        <div className="segmented" role="group" aria-label={t("Cost basis method")}>
          {TAX_METHODS.map((item) => (
            <button key={item.id} type="button" className={method === item.id ? "segment active" : "segment"} aria-pressed={method === item.id} onClick={() => onMethod(item.id)}>
              {t(item.label)}
            </button>
          ))}
        </div>
        <label className="form-field" htmlFor={yearId}>
          <span>{t("Year sold")}</span>
          <select id={yearId} className="select" value={shownYear} onChange={(event) => setYear(event.target.value)}>
            <option value="all">{t("All years")}</option>
            {years.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </label>

        {rows.length === 0 ? (
          <p className="empty-line">{t("No sells yet. Gains appear here once you log a sell.")}</p>
        ) : (
          <>
            <dl className="stats tax-totals">
              <div><dt>{t("Sells")}</dt><dd className="num">{totals.sales}</dd></div>
              <div><dt>{t("Proceeds")}</dt><dd className="num">{usd(totals.proceeds)}</dd></div>
              <div><dt>{t("Cost basis")}</dt><dd className="num">{usd(totals.cost)}</dd></div>
              <div>
                <dt>{t("Gain or loss")}</dt>
                <dd className={`num ${direction(totals.gain)}`}>{marker(totals.gain)}{signed(totals.gain)}</dd>
              </div>
              {fifo && (
                <>
                  <div><dt>{t("Short-term (a year or less)")}</dt><dd className="num">{signed(totals.shortTerm)}</dd></div>
                  <div><dt>{t("Long-term (over a year)")}</dt><dd className="num">{signed(totals.longTerm)}</dd></div>
                </>
              )}
            </dl>
            <ul className="tax-rows">
              {rows.slice(0, PREVIEW_ROWS).map((row) => (
                <li key={row.id} className="num">
                  <strong>{formatDate(row.sold)} · {hide ? MASK : formatAmount(row.amount)} {row.symbol}</strong>
                  <small>
                    {row.acquired == null ? t("Acquired on several dates") : t("Acquired {date}", { date: formatDate(row.acquired) })}
                    {row.term ? ` · ${row.term === "long" ? t("long-term") : t("short-term")}` : ""} · {t("cost {amount}", { amount: usd(row.cost) })} ·{" "}
                    <span className={direction(row.gain)}>{marker(row.gain)}{signed(row.gain)}</span>
                  </small>
                </li>
              ))}
              {rows.length > PREVIEW_ROWS && <li>{t("…and {count} more in the CSV.", { count: rows.length - PREVIEW_ROWS })}</li>}
            </ul>
          </>
        )}
        {(report.transfersOut > 0 || report.uncovered > 0) && (
          <p className="sheet-note">
            {report.transfersOut > 0 && `${tn(report.transfersOut, "{count} transfer out removed lots without a gain.", "{count} transfers out removed lots without a gain.")} `}
            {report.uncovered > 0 && tn(report.uncovered, "{count} sell is larger than the amount held then; only the held part is reported.", "{count} sells are larger than the amount held then; only the held part is reported.")}
          </p>
        )}
        <p className="sheet-note">
          {fifo ? t("FIFO matches each sell to the oldest coins first.") : t("Average cost uses the average price of all the coins held at the time of each sell.")} {t("Amounts in USD.")}
        </p>
        <button type="button" className="button-primary" disabled={!rows.length} onClick={download}>
          {t("Download CSV")}
        </button>
      </div>
    </Sheet>
  );
}
