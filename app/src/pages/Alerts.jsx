import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AlertSheet from "../components/AlertSheet.jsx";
import CoinLogo from "../components/CoinLogo.jsx";
import Icon from "../components/Icon.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import Sheet from "../components/Sheet.jsx";
import { fundById } from "../data/research.js";
import { describeAlert } from "../lib/alerts.js";
import { formatDate, rateFor } from "../lib/format.js";
import { useNow, usePageTitle } from "../lib/hooks.js";
import { notificationPermission, requestNotifications } from "../lib/notify.js";
import { useApp, useMarket } from "../state/context.js";
import { locale, t } from "../lib/i18n.js";

// Labels are translated where they're shown.
const tabs = [
  { id: "notifications", label: "Notifications" },
  { id: "my-alerts", label: "My alerts" },
  { id: "following", label: "Following" },
];
const frequencies = [
  ["instant", "Instant"],
  ["daily", "Daily digest"],
  ["weekly", "Weekly digest"],
];

const DAY_MS = 86_400_000;
function dayLabel(at, now) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  if (at >= start.getTime()) return t("Today");
  if (at >= start.getTime() - DAY_MS) return t("Yesterday");
  return formatDate(at);
}
const timeOf = (at) => new Date(at).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hour12: false });

function PermissionBanner({ onAsked }) {
  const [permission, setPermission] = useState(notificationPermission);
  if (permission === "granted" || permission === "unsupported") return null;
  return (
    <div className="card banner-info info-card" role="note">
      <Icon name="info" />
      {permission === "denied" ? (
        <span>{t("Browser notifications are blocked. Alerts still show here. To get them in the background, allow notifications for this site in your browser settings.")}</span>
      ) : (
        <span>
          {t("Browser notifications are off. Alerts still show here.")}{" "}
          <button
            className="link-button inline"
            onClick={async () => {
              setPermission(await requestNotifications());
              onAsked();
            }}
          >
            {t("Turn on")}
          </button>
        </span>
      )}
    </div>
  );
}

function Switch({ checked, onChange, label }) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={onChange} aria-label={label} />
      <span className="switch-track" aria-hidden="true" />
      <span aria-hidden="true">{checked ? t("On") : t("Paused")}</span>
    </label>
  );
}

// Alerts (12-alerts.md): triggered notifications, price alerts and reminders, fund follows.
export default function Alerts() {
  const app = useApp();
  const { session, settings, alerts, reminders, notifications, unreadCount, follows, followedProjects, watchlist } = app;
  const { coins } = useMarket();
  const [params, setParams] = useSearchParams();
  const [editing, setEditing] = useState(null);
  const [reminderItem, setReminderItem] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const rate = rateFor(settings.currency, coins);
  const now = useNow(60_000);

  const tab = tabs.some((item) => item.id === params.get("tab")) ? params.get("tab") : "notifications";
  const newCoin = params.get("new");
  const draft = editing ?? (newCoin && coins.some((coin) => coin.id === newCoin) ? { coinId: newCoin } : null);

  usePageTitle(unreadCount ? `(${unreadCount}) ${t("Alerts")}` : t("Alerts"));

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    next.set("tab", id);
    setParams(next, { replace: true });
  };
  const closeSheet = () => {
    setEditing(null);
    if (newCoin) {
      const next = new URLSearchParams(params);
      next.delete("new");
      next.set("tab", "my-alerts");
      setParams(next, { replace: true });
    }
  };

  if (session.kind === "guest") {
    return (
      <div className="alerts">
        <h1>{t("Alerts")}</h1>
        <div className="card empty-state">
          <Icon name="bell" className="empty-icon" />
          <p>{t("Sign in to set price alerts, unlock reminders and fund follows. Alerts run while CPA is open.")}</p>
          <button className="button-primary" onClick={() => app.requireAuth(t("Sign in to use alerts"), () => {})}>{t("Sign in")}</button>
          <button className="button-tertiary" onClick={app.startDemo}>{t("Try a private demo")}</button>
        </div>
      </div>
    );
  }

  const reminderList = Object.entries(reminders).map(([id, item]) => ({ id, ...item })).sort((a, b) => new Date(a.date) - new Date(b.date));
  const myCount = alerts.length + reminderList.length;
  const fundList = Object.entries(follows).map(([id, frequency]) => ({ fund: fundById(id), frequency })).filter((item) => item.fund);
  const counts = { notifications: unreadCount, "my-alerts": myCount, following: fundList.length + followedProjects.length };

  const groups = [];
  notifications.forEach((note) => {
    const label = dayLabel(note.at, now);
    const group = groups[groups.length - 1];
    if (group?.label === label) group.items.push(note);
    else groups.push({ label, items: [note] });
  });

  const newAlert = () => setEditing({ coinId: watchlist[0] ?? "bitcoin" });

  return (
    <div className="alerts">
      <div className="page-head">
        <h1>{t("Alerts")}</h1>
        <button className="button-secondary compact" onClick={newAlert}>
          <Icon name="plus" /> {t("New")}
        </button>
      </div>

      <div className="filters" role="tablist" aria-label={t("Alerts sections")}>
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`alerts-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="alerts-panel"
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? "filter active" : "filter"}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const index = tabs.findIndex((entry) => entry.id === tab);
              const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              setTab(next.id);
              document.getElementById(`alerts-tab-${next.id}`)?.focus();
            }}
          >
            {t(item.label)}
            {counts[item.id] > 0 && <span className="num"> {counts[item.id]}</span>}
            {item.id === "notifications" && counts.notifications > 0 && <span className="visually-hidden"> {t("unread")}</span>}
          </button>
        ))}
      </div>

      <PermissionBanner onAsked={app.markAsked} />

      <section id="alerts-panel" role="tabpanel" aria-labelledby={`alerts-tab-${tab}`} className="alerts-panel">
        {tab === "notifications" &&
          (notifications.length === 0 ? (
            <div className="empty-state">
              <Icon name="bell" className="empty-icon" />
              <p>{t("No alerts yet. Set one from any coin.")}</p>
              <Link to="/market" className="button-secondary">{t("Browse market")}</Link>
            </div>
          ) : (
            groups.map((group, index) => (
              <section key={group.label} aria-label={group.label} className="note-group">
                <div className="section-row">
                  <h2 className="subsection-title">{group.label}</h2>
                  {index === 0 && unreadCount > 0 && (
                    <button className="link-button" onClick={app.markAllRead}>{t("Mark all read")}</button>
                  )}
                </div>
                <ul className="note-list">
                  {group.items.map((note) => {
                    const coin = coins.find((item) => item.id === note.coinId);
                    return (
                      <li key={note.id}>
                        <Link to={note.path} className={note.read ? "note-item" : "note-item unread"} onClick={() => app.markRead(note.id)}>
                          <span className="note-dot" aria-hidden="true" />
                          {coin ? <CoinLogo coin={coin} /> : <span className="square-logo" aria-hidden="true">{note.title[0]}</span>}
                          <span className="note-main">
                            <strong>
                              {!note.read && <span className="visually-hidden">{t("Unread:")} </span>}
                              {note.title}
                            </strong>
                            <span className="num">
                              {note.detail} · {timeOf(note.at)}
                            </span>
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))
          ))}

        {tab === "my-alerts" &&
          (myCount === 0 ? (
            <div className="empty-state">
              <Icon name="bell" className="empty-icon" />
              <p>{t("No alerts or reminders yet.")}</p>
              <button className="button-primary" onClick={newAlert}>{t("New alert")}</button>
            </div>
          ) : (
            <ul className="alert-list">
              {alerts.map((alert) => {
                const coin = coins.find((item) => item.id === alert.coinId);
                if (!coin) return null;
                const text = `${coin.symbol} · ${describeAlert(alert, settings.currency, rate)}`;
                return (
                  <li key={alert.id} className={alert.active ? "alert-row" : "alert-row paused"}>
                    <CoinLogo coin={coin} />
                    <span className="alert-main">
                      <Link to={`/coins/${coin.id}`}><strong className="num">{text}</strong></Link>
                      <span>
                        {alert.repeat === "recurring" ? t("Recurring") : t("One-time")}
                        {alert.lastFired ? ` · ${t("last triggered {time}", { time: timeOf(alert.lastFired) })}` : ""}
                      </span>
                    </span>
                    <Switch checked={alert.active} onChange={() => app.toggleAlert(alert.id)} label={`${text}, ${alert.active ? t("on") : t("paused")}`} />
                    <button className="icon-button small" onClick={() => setEditing(alert)} aria-label={t("Edit {item}", { item: text })}>
                      <Icon name="pencil" />
                    </button>
                    <button className="icon-button small danger-text" onClick={() => setConfirm({ kind: "alert", id: alert.id, text })} aria-label={t("Delete {item}", { item: text })}>
                      <Icon name="trash" />
                    </button>
                  </li>
                );
              })}
              {reminderList.map((reminder) => {
                const coin = coins.find((item) => item.symbol === reminder.symbol);
                const what = reminder.kind === "sale" ? t("Token sale") : t("Unlock");
                const text = `${reminder.symbol} · ${what} ${formatDate(reminder.date)}`;
                return (
                  <li key={reminder.id} className={reminder.paused ? "alert-row paused" : "alert-row"}>
                    {coin && reminder.kind !== "sale" ? <CoinLogo coin={coin} /> : <span className="square-logo" aria-hidden="true">{reminder.symbol[0]}</span>}
                    <span className="alert-main">
                      <strong className="num">{text}</strong>
                      <span>{reminder.timings.map((timing) => t("{timing} before", { timing })).join(` ${t("and")} `)}</span>
                    </span>
                    <Switch checked={!reminder.paused} onChange={() => app.toggleReminder(reminder.id)} label={t("{item} reminder, {state}", { item: text, state: reminder.paused ? t("paused") : t("on") })} />
                    <button
                      className="icon-button small"
                      onClick={() => setReminderItem({ id: reminder.id, kind: reminder.kind, symbol: reminder.symbol, name: reminder.name, date: reminder.date })}
                      aria-label={t("Edit {item} reminder", { item: text })}
                    >
                      <Icon name="pencil" />
                    </button>
                    <button className="icon-button small danger-text" onClick={() => setConfirm({ kind: "reminder", id: reminder.id, text })} aria-label={t("Delete {item} reminder", { item: text })}>
                      <Icon name="trash" />
                    </button>
                  </li>
                );
              })}
            </ul>
          ))}

        {tab === "following" && (
          <>
            {fundList.length === 0 && followedProjects.length === 0 ? (
              <div className="empty-state">
                <Icon name="coins" className="empty-icon" />
                <p>{t("You're not following any funds or projects yet.")}</p>
                <Link to="/fundraising?view=funds" className="button-secondary">{t("Browse funds")}</Link>
              </div>
            ) : (
              <ul className="alert-list">
                {fundList.map(({ fund, frequency }) => (
                  <li key={fund.id} className="alert-row">
                    <span className="square-logo" aria-hidden="true">{fund.name[0]}</span>
                    <span className="alert-main">
                      <Link to={`/funds/${fund.id}`}><strong>{fund.name}</strong></Link>
                      <span>{t("Tier {tier}", { tier: fund.tier })} · {t(fund.type)}</span>
                    </span>
                    <select className="select" value={frequency} onChange={(event) => app.setFollow(fund, event.target.value)} aria-label={t("How often to hear about {name}", { name: fund.name })}>
                      {frequencies.map(([id, label]) => (
                        <option key={id} value={id}>{t(label)}</option>
                      ))}
                    </select>
                    <button className="icon-button small danger-text" onClick={() => app.setFollow(fund, null)} aria-label={t("Unfollow {name}", { name: fund.name })}>
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
                {followedProjects.map((project) => (
                  <li key={project} className="alert-row">
                    <span className="square-logo" aria-hidden="true">{project[0]}</span>
                    <span className="alert-main">
                      <strong>{project}</strong>
                      <span>{t("Project · new funding rounds")}</span>
                    </span>
                    <button className="icon-button small danger-text" onClick={() => app.toggleFollowProject(project)} aria-label={t("Unfollow {name}", { name: project })}>
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <p className="muted-line">
        {t("Alerts are checked while CPA is open; nothing fires when the tab is closed.")}{" "}
        <Link to="/settings" className="link-button inline">{t("Digest and quiet hours")}</Link>
      </p>

      <AlertSheet key={draft ? draft.id ?? `new-${draft.coinId}` : "closed"} draft={draft} onClose={closeSheet} />
      <ReminderSheet key={reminderItem?.id ?? "none"} item={reminderItem} onClose={() => setReminderItem(null)} />
      <Sheet open={Boolean(confirm)} onClose={() => setConfirm(null)} title={confirm?.kind === "reminder" ? t("Delete this reminder?") : t("Delete this alert?")} side="bottom">
        <p className="sheet-note num">{confirm?.text}</p>
        <div className="sheet-actions">
          <button className="button-secondary" onClick={() => setConfirm(null)}>{t("Cancel")}</button>
          <button
            className="button-primary danger-fill"
            onClick={() => {
              if (confirm.kind === "reminder") app.deleteReminder(confirm.id);
              else app.deleteAlert(confirm.id);
              setConfirm(null);
            }}
          >
            {t("Delete")}
          </button>
        </div>
      </Sheet>
    </div>
  );
}
