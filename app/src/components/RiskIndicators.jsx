import { useMemo } from "react";
import InfoTip from "./InfoTip.jsx";
import { formatCompact } from "../lib/format.js";
import { t } from "../lib/i18n.js";
import { riskIndicators } from "../lib/risk.js";

// Neutral risk indicators on Coin detail (clarification 27). Facts and fixed thresholds only:
// never a rating, a score or a suggestion to buy or sell.
export default function RiskIndicators({ coin, research, currency, rate, now }) {
  const items = useMemo(
    () => riskIndicators(coin, research, { now, money: (usd) => formatCompact(usd, currency, rate) }),
    [coin, research, currency, rate, now],
  );
  return (
    <section className="card risk-card" aria-labelledby="risk-title">
      <h2 id="risk-title" className="subsection-title">
        {t("Risk indicators")} <span className="muted-inline">{t("(not advice)")}</span> <InfoTip term="risk" label={t("risk indicators")} />
      </h2>
      {items.length ? (
        <ul className="risk-list">
          {items.map((item) => (
            <li key={item.id}>
              <span className="risk-chip">
                <span aria-hidden="true">!</span> {item.label}
              </span>
              <p>{item.detail}</p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted-line">{t("None of CPA's indicators apply to {symbol} today.", { symbol: coin.symbol })}</p>
      )}
    </section>
  );
}
