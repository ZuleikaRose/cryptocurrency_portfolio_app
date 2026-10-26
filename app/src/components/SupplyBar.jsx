import InfoTip from "./InfoTip.jsx";
import { formatNumber, formatTokens } from "../lib/format.js";
import { t } from "../lib/i18n.js";



// Supply at a glance (US-3.3): circulating / unlocked-not-circulating / locked.
export default function SupplyBar({ supply, symbol }) {
  const pct = (value) => (supply.total ? (value / supply.total) * 100 : 0);
  const other = Math.max(supply.total - supply.circulating - supply.unlocked - supply.locked, 0);
  const segments = [
    { id: "circulating", label: "Circulating", value: supply.circulating },
    { id: "unlocked", label: "Unlocked, not circulating", value: supply.unlocked },
    { id: "locked", label: "Locked", value: supply.locked },
    { id: "other", label: "Not yet issued", value: other },
  ].filter((segment) => pct(segment.value) >= 0.05);

  return (
    <section className="supply" aria-labelledby="supply-title">
      <h2 id="supply-title" className="subsection-title">
        {t("Supply at a glance")} <InfoTip term="supply" label={t("supply at a glance")} />
      </h2>
      <div className="supply-bar" role="img" aria-label={segments.map((segment) => t("{label} {value} percent", { label: t(segment.label), value: formatNumber(pct(segment.value), 1) })).join(", ")}>
        {segments.map((segment) => (
          <span key={segment.id} className={`supply-seg seg-${segment.id}`} style={{ flexGrow: segment.value }} />
        ))}
      </div>
      <ul className="supply-legend">
        {segments.map((segment) => (
          <li key={segment.id}>
            <span className={`legend-swatch seg-${segment.id}`} aria-hidden="true" />
            <span>{t(segment.label)}</span>
            {segment.id !== "other" && <InfoTip term={segment.id} label={t(segment.label).toLowerCase()} />}
            <span className="num legend-value">
              {formatNumber(pct(segment.value), 1)}% · {formatTokens(segment.value)} {symbol}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
