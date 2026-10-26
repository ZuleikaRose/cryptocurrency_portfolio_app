import { Link } from "react-router-dom";
import CoinLogo from "./CoinLogo.jsx";
import Icon from "./Icon.jsx";
import { formatCompact, formatCountdown, formatDate, formatTokens } from "../lib/format.js";
import { locale, t } from "../lib/i18n.js";

// Unlock card (08-unlocks.md): warning border above 2% of circulating supply, countdown, Remind me.
export default function UnlockCard({ event, now, currency, rate, reminded, onRemind }) {
  const large = event.share > 2;
  return (
    <li className={large ? "card unlock-card warning" : "card unlock-card"}>
      <div className="unlock-card-head">
        <CoinLogo coin={event.coin} />
        <Link to={`/coins/${event.coin.id}?tab=tokenomics`} className="unlock-title">
          <strong>{event.symbol}</strong> · {event.coin.name}
        </Link>
        <span className="countdown num">{formatCountdown(event.date.getTime(), now, true)}</span>
      </div>
      {large && <p className="large-unlock">⚠ {t("Large unlock")}</p>}
      <p className="num">
        {formatTokens(event.amount)} {event.symbol} · {formatCompact(event.usd, currency, rate)} · {t("{percent}% of circ. supply", { percent: event.share.toLocaleString(locale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}
      </p>
      <div
        className="progress"
        role="progressbar"
        aria-valuenow={Math.round(event.unlockedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={t("{name} supply unlocked", { name: event.coin.name })}
      >
        <span style={{ width: `${event.unlockedPct}%` }} />
      </div>
      <p className="muted-line num">
        {t("{percent}% unlocked", { percent: Math.round(event.unlockedPct) })} · {formatDate(event.date)} · {event.allocations.map((name) => t(name)).join(", ")}
      </p>
      <button className={reminded ? "button-secondary compact reminder-set" : "button-secondary compact"} onClick={() => onRemind(event)}>
        <Icon name={reminded ? "check" : "bell"} /> {reminded ? t("Reminder set") : t("Remind me")}
      </button>
    </li>
  );
}
