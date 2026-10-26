import { useState } from "react";
import CoinLogo from "./CoinLogo.jsx";
import Sheet from "./Sheet.jsx";
import { alertTypes, isPercentAlert, suggestedValue } from "../lib/alerts.js";
import { formatPercent, formatPrice, rateFor } from "../lib/format.js";
import { t } from "../lib/i18n.js";
import { notificationPermission, requestNotifications } from "../lib/notify.js";
import { useApp, useMarket } from "../state/context.js";

// New / edit price alert sheet (12-alerts.md). `draft` = an existing alert, or { coinId } for a new one.
// Mount with a key per draft so the form resets. Price values are typed in the display currency, stored in USD.
export default function AlertSheet({ draft, onClose }) {
  const { settings, notificationsAsked, saveAlert, markAsked } = useApp();
  const { coins } = useMarket();
  const rate = rateFor(settings.currency, coins);
  const editing = Boolean(draft?.id);
  const startCoin = coins.find((coin) => coin.id === draft?.coinId) ?? coins[0];
  const startType = draft?.type ?? "above";
  const toInput = (type, usd) => {
    if (isPercentAlert(type)) return String(usd);
    const value = usd * rate;
    return String(Number(value.toPrecision(value >= 1 ? 8 : 4)));
  };

  const [coinId, setCoinId] = useState(startCoin.id);
  const [type, setType] = useState(startType);
  const [valueText, setValueText] = useState(() => toInput(startType, draft?.value ?? suggestedValue(startType, startCoin.price)));
  const [repeat, setRepeat] = useState(draft?.repeat ?? "once");
  const [bypassQuiet, setBypassQuiet] = useState(draft?.bypassQuiet ?? false);
  const [step, setStep] = useState("form");
  const [touched, setTouched] = useState(false);

  const coin = coins.find((item) => item.id === coinId) ?? startCoin;
  const percent = isPercentAlert(type);
  const parsed = Number(valueText.replace(/[,\s$€₿Ξ%]/g, ""));
  const valid = Number.isFinite(parsed) && parsed > 0 && (!percent || parsed <= 100);
  const valueUsd = percent ? parsed : parsed / rate;
  const distance = valid && !percent ? (valueUsd / coin.price - 1) * 100 : null;
  const sorted = [...coins].sort((a, b) => a.rank - b.rank);

  const changeType = (next) => {
    setType(next);
    setValueText(toInput(next, suggestedValue(next, coin.price)));
  };
  const changeCoin = (id) => {
    const next = coins.find((item) => item.id === id);
    setCoinId(id);
    if (next) setValueText(toInput(type, suggestedValue(type, next.price)));
  };

  const save = () => {
    saveAlert({ ...(editing ? { id: draft.id } : {}), coinId, type, value: percent ? parsed : Number(valueUsd.toPrecision(10)), repeat, bypassQuiet });
    onClose();
  };

  const onSubmit = (event) => {
    event.preventDefault();
    setTouched(true);
    if (!valid) return;
    // First alert: explain before the browser's permission prompt (US-1.4).
    if (!notificationsAsked && notificationPermission() === "default") setStep("explain");
    else save();
  };

  let hint = null;
  if (valid && percent) hint = t("Now {change} in {window}", { change: formatPercent(type === "pct1h" ? coin.change1h : coin.change24h), window: type === "pct1h" ? "1h" : "24h" });
  if (valid && distance != null) {
    hint = t("{change} from now", { change: formatPercent(distance) });
    if (type === "above" && distance <= 0) hint += ` · ${t("already above, so it triggers on the next price update")}`;
    if (type === "below" && distance >= 0) hint += ` · ${t("already below, so it triggers on the next price update")}`;
  }

  return (
    <Sheet open={Boolean(draft)} onClose={onClose} title={editing ? t("Edit price alert") : t("New price alert")} side="bottom">
      {step === "form" && (
        <form className="tx-form" onSubmit={onSubmit} noValidate>
          <label className="form-field">
            <span>{t("Coin")}</span>
            <span className="input-row">
              <CoinLogo coin={coin} />
              <select className="input" value={coinId} onChange={(event) => changeCoin(event.target.value)}>
                {sorted.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.symbol}) · {formatPrice(item.price, settings.currency, rate)}
                  </option>
                ))}
              </select>
            </span>
          </label>

          <fieldset className="field-group">
            <legend>{t("When")}</legend>
            <div className="alert-types">
              {alertTypes.map((item) => (
                <button key={item.id} type="button" className={type === item.id ? "chip toggle on" : "chip toggle"} aria-pressed={type === item.id} onClick={() => changeType(item.id)}>
                  {t(item.label)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="form-field">
            <span>{percent ? t("Move of at least (%)") : t("Price ({currency})", { currency: settings.currency })}</span>
            <input
              className="input num"
              inputMode="decimal"
              value={valueText}
              onChange={(event) => setValueText(event.target.value)}
              onBlur={() => setTouched(true)}
              aria-invalid={touched && !valid}
              aria-describedby="alert-value-hint"
            />
            <small id="alert-value-hint" className={touched && !valid ? "field-error" : "num"}>
              {touched && !valid ? (percent ? t("Enter a percentage between 0 and 100.") : t("Enter a price above 0.")) : hint ?? " "}
            </small>
          </label>

          <fieldset className="field-group">
            <legend>{t("Repeat")}</legend>
            <div className="segmented" role="group" aria-label={t("Repeat")}>
              {[
                ["once", "One-time"],
                ["recurring", "Recurring · 1h cool-down"],
              ].map(([id, label]) => (
                <button key={id} type="button" className={repeat === id ? "segment active" : "segment"} aria-pressed={repeat === id} onClick={() => setRepeat(id)}>
                  {t(label)}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="check-row">
            <input type="checkbox" checked={bypassQuiet} onChange={(event) => setBypassQuiet(event.target.checked)} />
            {t("Bypass quiet hours")}
          </label>

          <button type="submit" className="button-primary">{editing ? t("Save changes") : t("Set alert")}</button>
        </form>
      )}
      {step === "explain" && (
        <>
          <h3 className="sheet-heading">{t("Turn on notifications?")}</h3>
          <p className="sheet-note">
            {t("Allow notifications so CPA can tell you when {symbol} hits your price, even when this tab is in the background. Alerts only run while CPA is open, and your alert is saved either way.", { symbol: coin.symbol })}
          </p>
          <button
            className="button-primary"
            onClick={async () => {
              await requestNotifications();
              save();
            }}
          >
            {t("Allow notifications")}
          </button>
          <button
            className="button-secondary button-block"
            onClick={() => {
              markAsked();
              save();
            }}
          >
            {t("Not now")}
          </button>
        </>
      )}
    </Sheet>
  );
}
