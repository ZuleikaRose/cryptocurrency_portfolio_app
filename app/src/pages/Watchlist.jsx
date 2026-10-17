import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import CoinRow, { ProTable, SkeletonRows } from "../components/CoinRow.jsx";
import Icon from "../components/Icon.jsx";
import { researchFor } from "../data/research.js";
import { direction, formatCountdown, formatPercent, rateFor, relativeTime } from "../lib/format.js";
import { useFirstLoad, useNow, useSimulatedError } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";

const sorts = [
  { id: "mine", label: "My order" },
  { id: "price", label: "Price" },
  { id: "change24h", label: "24h %" },
  { id: "marketCap", label: "Market cap" },
];
const WEEK_MS = 7 * 86_400_000;

// Unlock > 2% of circulating supply within 7 days gets a warning line (10-watchlist.md).
function unlockWarning(coin, now) {
  const research = researchFor(coin);
  const next = research.upcomingUnlocks[0];
  if (!next) return null;
  const share = (next.amount / research.supply.circulating) * 100;
  if (share <= 2 || next.date.getTime() - now > WEEK_MS) return null;
  return `⚠ Unlock ${formatCountdown(next.date.getTime(), now)} · ${share.toFixed(2)}% of supply`;
}

function EditList({ coins, onMove, onRemove }) {
  const [dragId, setDragId] = useState(null);
  return (
    <ol className="edit-list" aria-label="Reorder watchlist">
      {coins.map((coin, index) => (
        <li
          key={coin.id}
          className={dragId === coin.id ? "edit-row dragging" : "edit-row"}
          draggable
          onDragStart={(event) => {
            setDragId(coin.id);
            if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
          }}
          onDragOver={(event) => event.preventDefault()}
          onDrop={(event) => {
            event.preventDefault();
            if (dragId && dragId !== coin.id) onMove(dragId, index);
            setDragId(null);
          }}
          onDragEnd={() => setDragId(null)}
        >
          <span className="drag-handle" aria-hidden="true">≡</span>
          <CoinLogo coin={coin} />
          <span className="edit-name">
            <strong>{coin.name}</strong>
            <span>{coin.symbol}</span>
          </span>
          <button className="icon-button small" onClick={() => onMove(coin.id, index - 1)} disabled={index === 0} aria-label={`Move ${coin.name} up`}>
            ↑
          </button>
          <button className="icon-button small" onClick={() => onMove(coin.id, index + 1)} disabled={index === coins.length - 1} aria-label={`Move ${coin.name} down`}>
            ↓
          </button>
          <button className="button-tertiary danger" onClick={() => onRemove(coin)}>
            Remove
          </button>
        </li>
      ))}
    </ol>
  );
}

export default function Watchlist() {
  const { session, settings, watchlist, toggleWatch, moveWatch, removeWatch, updateSettings, updateMarketSettings, requireAuth, openSearch } = useApp();
  const { coins, lastUpdated, flashes, tick, refresh } = useMarket();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const now = useNow(15_000);
  const loading = useFirstLoad("watchlist");
  const [failed, clearFailure] = useSimulatedError();

  useEffect(() => {
    document.title = "Watchlist · CPA";
  }, []);

  const currency = settings.currency;
  const rate = rateFor(currency, coins);
  const sort = settings.watchlistSort ?? "mine";
  const density = settings.market.density;
  const ordered = watchlist.map((id) => coins.find((coin) => coin.id === id)).filter(Boolean);
  const rows = sort === "mine" ? ordered : [...ordered].sort((a, b) => b[sort] - a[sort]);
  const average = ordered.length ? ordered.reduce((sum, coin) => sum + coin.change24h, 0) / ordered.length : 0;
  const stale = now - lastUpdated > 5 * 60_000;

  const alertButton = (coin) => (
    <button
      className="icon-button small row-action"
      onClick={() => requireAuth(`Sign in to set a price alert for ${coin.name}`, () => navigate(`/alerts?new=${coin.id}`))}
      aria-label={`Set a price alert for ${coin.name}`}
    >
      <Icon name="bell" />
    </button>
  );

  return (
    <div className="watchlist">
      <div className="page-head">
        <h1>Watchlist</h1>
        {ordered.length > 0 && (
          <button className="button-secondary compact" onClick={() => setEditing((value) => !value)} aria-pressed={editing}>
            {editing ? "Done" : "Edit"}
          </button>
        )}
      </div>

      {ordered.length > 0 && (
        <p className="page-sub num">
          {ordered.length} {ordered.length === 1 ? "coin" : "coins"} ·{" "}
          <span className={direction(average)}>
            {direction(average) === "up" ? "▲" : direction(average) === "down" ? "▼" : ""} {formatPercent(average)}
          </span>{" "}
          avg 24h · Updated {relativeTime(lastUpdated, now)}
        </p>
      )}

      {session.kind === "guest" && (
        <div className="banner banner-info" role="note">
          <span>Sign in to build a watchlist that's saved to your account.</span>
          <button className="button-tertiary" onClick={() => navigate("/login?next=/watchlist")}>Log in</button>
        </div>
      )}

      {failed && (
        <div className="banner banner-error" role="alert">
          <span>We couldn't load prices. Showing data from {relativeTime(lastUpdated, now)}.</span>
          <button
            className="button-tertiary"
            onClick={() => {
              clearFailure();
              refresh();
            }}
          >
            Retry
          </button>
        </div>
      )}

      {loading && ordered.length > 0 ? (
        <>
          <p className="visually-hidden" role="status">Loading your watchlist…</p>
          <div className="coin-list" aria-hidden="true"><SkeletonRows count={Math.min(ordered.length, 6)} /></div>
        </>
      ) : ordered.length === 0 ? (
        <div className="empty-state">
          <Icon name="star" className="empty-icon" />
          <p>Add coins to your watchlist to see them here.</p>
          <button className="button-secondary" onClick={() => navigate("/market")}>Browse market</button>
        </div>
      ) : editing ? (
        <>
          <p className="hint">Drag rows, or use the arrow buttons, to change the order.</p>
          <EditList coins={ordered} onMove={moveWatch} onRemove={removeWatch} />
          <button className="button-primary" onClick={() => setEditing(false)}>Done</button>
        </>
      ) : (
        <>
          <div className="list-controls">
            <label className="inline-select">
              Sort
              <select className="select" value={sort} onChange={(event) => updateSettings({ watchlistSort: event.target.value })}>
                {sorts.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </label>
            <div className="segmented" role="group" aria-label="View">
              {[
                ["simple", "Simple"],
                ["pro", "Pro"],
              ].map(([id, label]) => (
                <button key={id} className={density === id ? "segment active" : "segment"} aria-pressed={density === id} onClick={() => updateMarketSettings({ density: id })}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          {density === "pro" ? (
            <ProTable
              rows={rows}
              watchlist={watchlist}
              onStar={toggleWatch}
              currency={currency}
              rate={rate}
              market={{ sort: sort === "mine" ? "none" : sort, dir: "desc" }}
              onSort={(id) => updateSettings({ watchlistSort: sorts.some((item) => item.id === id) ? id : "mine" })}
              flashes={flashes}
              tick={tick}
              stale={stale}
            />
          ) : (
            <div className="coin-list">
              {rows.map((coin) => {
                const warning = unlockWarning(coin, now);
                return (
                  <CoinRow
                    key={coin.id}
                    coin={coin}
                    starred
                    onStar={toggleWatch}
                    currency={currency}
                    rate={rate}
                    flash={flashes[coin.id]}
                    tick={tick}
                    stale={stale}
                    actions={alertButton(coin)}
                    footer={warning && <span className="warning-text">{warning}</span>}
                  />
                );
              })}
            </div>
          )}
        </>
      )}

      {!editing && (
        <button className="load-more" onClick={() => openSearch("coins")}>
          + Add coins
        </button>
      )}
    </div>
  );
}
