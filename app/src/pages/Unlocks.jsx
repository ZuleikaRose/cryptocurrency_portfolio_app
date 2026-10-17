import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "../components/Icon.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import UnlockCard from "../components/UnlockCard.jsx";
import { unlockEvents } from "../data/research.js";
import { formatCompact, formatDate, rateFor } from "../lib/format.js";
import { useNow } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";

const DAY_MS = 86_400_000;
const ranges = [
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "custom", label: "Custom" },
];
const sorts = [
  { id: "share", label: "% of circ. supply" },
  { id: "usd", label: "$ value" },
  { id: "date", label: "Date" },
];

const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
const toDateInput = (date) => new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);

function rangeBounds(range, custom, now) {
  const start = new Date(now);
  if (range === "custom") {
    const from = custom.from ? new Date(`${custom.from}T00:00:00`) : start;
    const to = custom.to ? new Date(`${custom.to}T23:59:59`) : new Date(now + 31 * DAY_MS);
    return [Math.max(from.getTime(), now), to.getTime()];
  }
  if (range === "today") {
    const end = new Date(now);
    end.setHours(23, 59, 59, 999);
    return [now, end.getTime()];
  }
  return [now, now + (range === "week" ? 7 : 31) * DAY_MS];
}

// Month grid with unlock dots (US-4.3). Arrow keys move between days; Enter selects.
function CalendarView({ events, selected, onSelect }) {
  const [month, setMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [focusDay, setFocusDay] = useState(() => new Date().getDate());
  const gridRef = useRef(null);
  const counts = useMemo(() => {
    const map = new Map();
    events.forEach((event) => map.set(dayKey(event.date), (map.get(dayKey(event.date)) ?? 0) + 1));
    return map;
  }, [events]);

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const leading = (month.getDay() + 6) % 7; // Monday-first
  const cells = [...Array(leading).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const day = Math.min(focusDay, daysInMonth);

  const moveFocus = (next) => {
    if (next < 1 || next > daysInMonth) {
      const shifted = new Date(month.getFullYear(), month.getMonth() + (next < 1 ? -1 : 1), 1);
      const length = new Date(shifted.getFullYear(), shifted.getMonth() + 1, 0).getDate();
      setMonth(shifted);
      setFocusDay(next < 1 ? length + next : next - daysInMonth);
    } else {
      setFocusDay(next);
    }
  };

  useEffect(() => {
    if (gridRef.current?.contains(document.activeElement)) gridRef.current.querySelector(`[data-day="${day}"]`)?.focus();
  }, [day, month]);

  const onKeyDown = (event) => {
    const deltas = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (deltas[event.key]) {
      event.preventDefault();
      moveFocus(day + deltas[event.key]);
    }
  };

  const monthLabel = month.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  return (
    <div className="calendar">
      <div className="calendar-head">
        <button className="icon-button small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} aria-label="Previous month">
          <Icon name="chevron" className="icon flip" />
        </button>
        <h2 className="subsection-title" aria-live="polite">{monthLabel}</h2>
        <button className="icon-button small" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} aria-label="Next month">
          <Icon name="chevron" />
        </button>
      </div>
      <div className="calendar-grid" role="grid" aria-label={`Unlocks in ${monthLabel}`} ref={gridRef} onKeyDown={onKeyDown}>
        <div role="row" className="calendar-row">
          {["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"].map((name) => (
            <span key={name} role="columnheader" className="calendar-dow">{name}</span>
          ))}
        </div>
        {Array.from({ length: Math.ceil(cells.length / 7) }, (_, row) => (
          <div role="row" className="calendar-row" key={row}>
            {cells.slice(row * 7, row * 7 + 7).map((value, index) => {
              if (!value) return <span key={`blank-${index}`} role="gridcell" className="calendar-blank" />;
              const date = new Date(month.getFullYear(), month.getMonth(), value);
              const count = counts.get(dayKey(date)) ?? 0;
              const isSelected = selected && dayKey(selected) === dayKey(date);
              return (
                <span key={value} role="gridcell" aria-selected={isSelected}>
                  <button
                    data-day={value}
                    tabIndex={value === day ? 0 : -1}
                    className={`calendar-day${isSelected ? " selected" : ""}${dayKey(date) === dayKey(new Date()) ? " today" : ""}`}
                    onClick={() => {
                      setFocusDay(value);
                      onSelect(isSelected ? null : date);
                    }}
                    aria-label={`${formatDate(date)}, ${count ? `${count} unlock${count > 1 ? "s" : ""}` : "no unlocks"}`}
                  >
                    {value}
                    {count > 0 && <span className="calendar-dot" aria-hidden="true" />}
                  </button>
                </span>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Unlocks() {
  const { settings, updateSettings, watchlist, reminders, requireAuth } = useApp();
  const { coins } = useMarket();
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [selectedDay, setSelectedDay] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const prefs = settings.unlocks;
  const update = (patch) => updateSettings({ unlocks: { ...prefs, ...patch } });

  useEffect(() => {
    document.title = "Token unlocks · CPA";
  }, []);

  const allEvents = useMemo(() => unlockEvents(coins), [coins]);

  // One-second clock: countdowns show seconds inside the last hour (08-unlocks.md).
  const now = useNow(1000);
  const [from, to] = rangeBounds(prefs.range, custom, now);
  const rate = rateFor(settings.currency, coins);

  const inRange = allEvents.filter((event) => {
    const time = event.date.getTime();
    if (selectedDay) return dayKey(event.date) === dayKey(selectedDay);
    return time >= from && time <= to;
  });
  const events = inRange
    .filter((event) => !prefs.watchlistOnly || watchlist.includes(event.coin.id))
    .filter((event) => !prefs.minOne || event.share > 1)
    .sort((a, b) => (prefs.sort === "date" ? a.date - b.date : b[prefs.sort] - a[prefs.sort]));
  const totalUsd = events.reduce((sum, event) => sum + event.usd, 0);
  const rangeLabel = selectedDay ? `on ${formatDate(selectedDay)}` : { today: "today", week: "this week", month: "this month", custom: "in this range" }[prefs.range];

  const remind = (event) =>
    requireAuth(`Sign in to set a reminder for the ${event.symbol} unlock`, () =>
      setReminderItem({ id: event.id, kind: "unlock", symbol: event.symbol, name: event.coin.name, date: event.date, amount: event.amount }),
    );

  return (
    <div className="unlocks">
      <div className="page-head">
        <h1>Token unlocks</h1>
        <div className="segmented" role="group" aria-label="View">
          {[
            ["list", "List"],
            ["calendar", "Calendar"],
          ].map(([id, label]) => (
            <button key={id} className={prefs.view === id ? "segment active" : "segment"} aria-pressed={prefs.view === id} onClick={() => update({ view: id })}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="page-sub num">
        {formatCompact(totalUsd, settings.currency, rate)} unlocking {rangeLabel} · {events.length} {events.length === 1 ? "event" : "events"}
      </p>

      <div className="filters" role="group" aria-label="Date range">
        {ranges.map((item) => (
          <button
            key={item.id}
            className={prefs.range === item.id && !selectedDay ? "filter active" : "filter"}
            aria-pressed={prefs.range === item.id && !selectedDay}
            onClick={() => {
              setSelectedDay(null);
              update({ range: item.id });
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {prefs.range === "custom" && !selectedDay && (
        <div className="custom-range">
          <label className="form-field">
            <span>From</span>
            <input type="date" className="input" min={toDateInput(new Date(now))} value={custom.from} onChange={(event) => setCustom({ ...custom, from: event.target.value })} />
          </label>
          <label className="form-field">
            <span>To</span>
            <input type="date" className="input" min={custom.from || toDateInput(new Date(now))} value={custom.to} onChange={(event) => setCustom({ ...custom, to: event.target.value })} />
          </label>
        </div>
      )}

      <div className="toggle-row">
        <label className="switch">
          <input type="checkbox" checked={prefs.watchlistOnly} onChange={(event) => update({ watchlistOnly: event.target.checked })} />
          <span className="switch-track" aria-hidden="true" />
          Watchlist only
        </label>
        <label className="switch">
          <input type="checkbox" checked={prefs.minOne} onChange={(event) => update({ minOne: event.target.checked })} />
          <span className="switch-track" aria-hidden="true" />
          &gt; 1% only
        </label>
      </div>
      <label className="inline-select">
        Sort
        <select className="select" value={prefs.sort} onChange={(event) => update({ sort: event.target.value })}>
          {sorts.map((item) => (
            <option key={item.id} value={item.id}>{item.label}</option>
          ))}
        </select>
      </label>

      {prefs.view === "calendar" && (
        <CalendarView key="calendar" events={allEvents.filter((event) => (!prefs.watchlistOnly || watchlist.includes(event.coin.id)) && (!prefs.minOne || event.share > 1))} selected={selectedDay} onSelect={setSelectedDay} />
      )}
      {selectedDay && (
        <button className="chip selected-day" onClick={() => setSelectedDay(null)} aria-label={`Clear day filter: ${formatDate(selectedDay)}`}>
          {formatDate(selectedDay)} <Icon name="close" />
        </button>
      )}

      {events.length === 0 ? (
        <div className="empty-state">
          <Icon name="calendarLock" className="empty-icon" />
          <p>No unlocks in this range.</p>
          <button
            className="button-secondary"
            onClick={() => {
              setSelectedDay(null);
              update({ range: "month", watchlistOnly: false, minOne: false });
            }}
          >
            Show this month
          </button>
        </div>
      ) : (
        <ul className="unlock-cards">
          {events.map((event) => (
            <UnlockCard key={event.id} event={event} now={now} currency={settings.currency} rate={rate} reminded={Boolean(reminders[event.id])} onRemind={remind} />
          ))}
        </ul>
      )}

      <p className="disclaimer">Not financial advice. Unlock schedules are CPA sample data; $ values use today's price.</p>
      <ReminderSheet key={reminderItem?.id ?? "none"} item={reminderItem} onClose={() => setReminderItem(null)} />
    </div>
  );
}
