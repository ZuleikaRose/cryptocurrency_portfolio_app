import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import Sheet from "../components/Sheet.jsx";
import { saleCurrentPrice, saleStatus, tokenSales } from "../data/directory.js";
import { formatCompact, formatDate, formatMultiple, formatPrice, rateFor } from "../lib/format.js";
import { useNow, usePageTitle } from "../lib/hooks.js";
import { t, tc } from "../lib/i18n.js";
import { useApp, useMarket } from "../state/context.js";

const statuses = [
  { id: "upcoming", label: "Upcoming" },
  { id: "active", label: "Active" },
  { id: "past", label: "Past" },
];
const types = ["All", "ICO", "IEO", "IDO"];
const DAY_MS = 86_400_000;

function relativeDays(target, now) {
  const days = Math.round((target - now) / DAY_MS);
  if (days === 0) return t("today");
  return days > 0 ? t("in {time}", { time: `${days}d` }) : t("{n}d ago", { n: -days });
}

const roiText = (value) => `${value >= 1 ? "▲" : "▼"} ${formatMultiple(value)}`;

function Disclaimer() {
  return (
    <p className="card info-card" role="note">
      <Icon name="info" /> {t("Past ROI doesn't predict future results. Not financial advice.")}
    </p>
  );
}

// Launchpad track record (US-5.5): count, average and median ROI, best and worst.
function launchpadStats(name, coins) {
  const rows = tokenSales
    .filter((sale) => sale.launchpad === name && saleStatus(sale) === "past")
    .map((sale) => ({ sale, roi: (saleCurrentPrice(sale, coins) ?? sale.price) / sale.price }))
    .sort((a, b) => a.roi - b.roi);
  if (!rows.length) return null;
  return {
    count: rows.length,
    average: rows.reduce((sum, row) => sum + row.roi, 0) / rows.length,
    median: rows[Math.floor(rows.length / 2)].roi,
    best: rows[rows.length - 1],
    worst: rows[0],
  };
}

export default function TokenSales() {
  const [params, setParams] = useSearchParams();
  const { settings, reminders, requireAuth } = useApp();
  const { coins } = useMarket();
  const [type, setType] = useState("All");
  const [launchpad, setLaunchpad] = useState("All");
  const [padSheet, setPadSheet] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const now = useNow(60_000);
  const rate = rateFor(settings.currency, coins);
  const status = statuses.some((item) => item.id === params.get("status")) ? params.get("status") : "upcoming";

  usePageTitle(t("Token sales"));

  const counts = Object.fromEntries(statuses.map((item) => [item.id, tokenSales.filter((sale) => saleStatus(sale, now) === item.id).length]));
  const launchpads = ["All", ...new Set(tokenSales.map((sale) => sale.launchpad))];
  const sales = tokenSales
    .filter((sale) => saleStatus(sale, now) === status)
    .filter((sale) => type === "All" || sale.type === type)
    .filter((sale) => launchpad === "All" || sale.launchpad === launchpad)
    .sort((a, b) => (status === "past" ? b.end - a.end : a.start - b.start));
  const stats = padSheet ? launchpadStats(padSheet, coins) : null;

  const setStatus = (id) => {
    const next = new URLSearchParams(params);
    next.set("status", id);
    setParams(next, { replace: true });
  };

  return (
    <div className="token-sales">
      <Link to="/explore" className="link-button back">
        <Icon name="chevron" className="icon flip" /> {t("Explore")}
      </Link>
      <h1>{t("Token sales")}</h1>

      <div className="filters" role="tablist" aria-label={t("Sale status")}>
        {statuses.map((item) => (
          <button
            key={item.id}
            role="tab"
            aria-selected={status === item.id}
            aria-controls="sales-panel"
            className={status === item.id ? "filter active" : "filter"}
            onClick={() => setStatus(item.id)}
          >
            {tc("sales", item.label)} <span className="num">{counts[item.id]}</span>
          </button>
        ))}
      </div>

      <div className="list-controls">
        <div className="segmented" role="group" aria-label={t("Sale type")}>
          {types.map((item) => (
            <button key={item} className={type === item ? "segment active" : "segment"} aria-pressed={type === item} onClick={() => setType(item)}>
              {item === "All" ? t("All") : item}
            </button>
          ))}
        </div>
        <label className="inline-select">
          <span className="visually-hidden">{t("Launchpad")}</span>
          <select className="select" value={launchpad} onChange={(event) => setLaunchpad(event.target.value)}>
            {launchpads.map((item) => (
              <option key={item} value={item}>{item === "All" ? t("All launchpads") : item}</option>
            ))}
          </select>
        </label>
      </div>

      <section id="sales-panel" role="tabpanel" className="sale-list">
        {status === "past" && <Disclaimer />}
        {sales.length === 0 ? (
          <div className="empty-state">
            <p>{status === "active" ? t("No active sales right now.") : t("No sales match these filters.")}</p>
            <button
              className="button-secondary"
              onClick={() => {
                setType("All");
                setLaunchpad("All");
                setStatus("upcoming");
              }}
            >
              {t("See upcoming")}
            </button>
          </div>
        ) : (
          sales.map((sale) => {
            const current = saleCurrentPrice(sale, coins);
            const roi = current ? current / sale.price : null;
            const reminded = Boolean(reminders[sale.id]);
            return (
              <article key={sale.id} className="card sale-card">
                <div className="sale-head">
                  <span className="square-logo" aria-hidden="true">{sale.name[0]}</span>
                  <h2 className="sale-name">
                    {sale.coinId ? <Link to={`/coins/${sale.coinId}`}>{sale.name}</Link> : sale.name} <span className="ticker">{sale.symbol}</span>
                  </h2>
                  <span className="tag tag-sales">{sale.type}</span>
                </div>
                <p className="muted-line num">
                  {sale.launchpad === "Direct" ? (
                    t("Direct sale")
                  ) : (
                    <button className="link-button inline" onClick={() => setPadSheet(sale.launchpad)}>{sale.launchpad}</button>
                  )}{" "}
                  · {status === "past" ? t("Ended {date}", { date: formatDate(sale.end) }) : status === "active" ? `${t("Ends {date}", { date: formatDate(sale.end) })} · ${relativeDays(sale.end, now)}` : `${t("Starts {date}", { date: formatDate(sale.start) })} · ${relativeDays(sale.start, now)}`}
                </p>

                {status === "past" ? (
                  <p className="num">
                    {t("Sale")} {formatPrice(sale.price, settings.currency, rate)} → {current ? formatPrice(current, settings.currency, rate) : "—"}{" "}
                    {roi && <span className={roi >= 1 ? "up" : "down"}>{t("ROI")} {roiText(roi)}</span>}
                    {sale.athRoi && <span className="muted-inline"> · ATH {formatMultiple(sale.athRoi)}</span>}
                  </p>
                ) : (
                  <p className="num">
                    {t("Raise")} {formatCompact(sale.raise, settings.currency, rate)} · {t("Price")} {formatPrice(sale.price, settings.currency, rate)} · FDV {formatCompact(sale.fdv, settings.currency, rate)}
                  </p>
                )}

                {status === "active" && (
                  <>
                    <div className="progress sales-progress" role="progressbar" aria-valuenow={Math.round((sale.sold ?? 0) * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={t("{name} sale progress", { name: sale.name })}>
                      <span style={{ width: `${(sale.sold ?? 0) * 100}%` }} />
                    </div>
                    <p className="muted-line num">{t("{percent}% sold", { percent: Math.round((sale.sold ?? 0) * 100) })}</p>
                  </>
                )}

                {status === "upcoming" && (
                  <button
                    className={reminded ? "button-secondary compact reminder-set" : "button-secondary compact"}
                    onClick={() =>
                      requireAuth(t("Sign in to set a reminder for the {symbol} sale", { symbol: sale.symbol }), () =>
                        setReminderItem({ id: sale.id, kind: "sale", symbol: sale.symbol, name: sale.name, date: sale.start }),
                      )
                    }
                  >
                    <Icon name={reminded ? "check" : "bell"} /> {reminded ? t("Reminder set") : t("Remind me")}
                  </button>
                )}
              </article>
            );
          })
        )}
        {status === "past" ? <Disclaimer /> : <p className="disclaimer">{t("Not financial advice. Token sales are CPA sample data; check every sale's terms yourself.")}</p>}
      </section>

      <Sheet open={Boolean(padSheet)} onClose={() => setPadSheet(null)} title={padSheet ?? t("Launchpad")} side="bottom">
        {stats ? (
          <>
            <dl className="stats">
              <div><dt>{t("Past sales")}</dt><dd className="num">{stats.count}</dd></div>
              <div><dt>{t("Average ROI")}</dt><dd className={`num ${stats.average >= 1 ? "up" : "down"}`}>{formatMultiple(stats.average)}</dd></div>
              <div><dt>{t("Median ROI")}</dt><dd className={`num ${stats.median >= 1 ? "up" : "down"}`}>{formatMultiple(stats.median)}</dd></div>
              <div><dt>{t("Best · worst")}</dt><dd className="num">{stats.best.sale.symbol} {formatMultiple(stats.best.roi)} · {stats.worst.sale.symbol} {formatMultiple(stats.worst.roi)}</dd></div>
            </dl>
            <p className="sheet-note">{t("Past ROI doesn't predict future results. Not financial advice.")}</p>
          </>
        ) : (
          <p className="sheet-note">{t("No completed sales on record for {launchpad}.", { launchpad: padSheet })}</p>
        )}
      </Sheet>
      <ReminderSheet key={reminderItem?.id ?? "none"} item={reminderItem} onClose={() => setReminderItem(null)} />
    </div>
  );
}
