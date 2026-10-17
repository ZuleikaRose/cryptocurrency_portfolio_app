import { useState } from "react";
import Sheet from "./Sheet.jsx";
import { formatDate, formatTokens } from "../lib/format.js";
import { notificationPermission, requestNotifications } from "../lib/notify.js";
import { useApp } from "../state/context.js";

const timingOptions = [
  ["1h", "1 hour before"],
  ["24h", "24 hours before"],
];

// "Remind me" sheet (US-4.2, US-P09.1). `item` = { id, kind, symbol, name, date, amount? }.
// Mount with key={item.id} so the timings reset per item.
export default function ReminderSheet({ item, onClose }) {
  const { reminders, reminderTimings, notificationsAsked, setReminder } = useApp();
  const existing = item ? reminders[item.id]?.timings : null;
  const [timings, setTimings] = useState(existing ?? reminderTimings);
  const [step, setStep] = useState("timings");

  const toggle = (value) => setTimings((current) => (current.includes(value) ? current.filter((entry) => entry !== value) : [...current, value]));

  const save = () => {
    setReminder(item, timings);
    onClose();
  };

  // First reminder ever: explain before the browser prompt (US-1.4). Declining still saves.
  const onSet = () => {
    const needsAsk = timings.length && !notificationsAsked && notificationPermission() === "default";
    if (needsAsk) setStep("explain");
    else save();
  };

  const title = item?.kind === "sale" ? `${item.symbol} token sale` : `${item?.symbol} unlock`;

  return (
    <Sheet open={Boolean(item)} onClose={onClose} title="Remind me" side="bottom">
      {item && step === "timings" && (
        <>
          <h3 className="sheet-heading">Remind me about the {title}</h3>
          <p className="sheet-note num">
            {item.kind === "sale" ? "Starts " : ""}
            {formatDate(item.date)}
            {item.amount ? ` · ${formatTokens(item.amount)} ${item.symbol}` : ""}
          </p>
          {timingOptions.map(([value, label]) => (
            <label key={value} className="check-row">
              <input type="checkbox" checked={timings.includes(value)} onChange={() => toggle(value)} />
              {label}
            </label>
          ))}
          <button className="button-primary" onClick={onSet} disabled={!timings.length && !existing}>
            {timings.length ? "Set reminder" : "Remove reminder"}
          </button>
        </>
      )}
      {item && step === "explain" && (
        <>
          <h3 className="sheet-heading">Turn on notifications?</h3>
          <p className="sheet-note">Allow notifications so CPA can remind you even when this tab is in the background. Your reminder is saved either way.</p>
          <button
            className="button-primary"
            onClick={async () => {
              await requestNotifications();
              save();
            }}
          >
            Allow notifications
          </button>
          <button className="button-secondary button-block" onClick={save}>Not now</button>
        </>
      )}
    </Sheet>
  );
}
