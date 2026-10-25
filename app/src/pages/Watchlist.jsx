import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import CoinRow, { ProTable, SkeletonRows } from "../components/CoinRow.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
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

function EditList({ coins, listName, onMove, onRemove }) {
  const [dragId, setDragId] = useState(null);
  return (
    <ol className="edit-list" aria-label={`Reorder ${listName}`}>
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

// Add coins to a named list: every coin, filtered by name or ticker (US-6.2).
function AddCoinsSheet({ open, onClose, list, coins, onToggle }) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const shown = q ? coins.filter((coin) => [coin.name, coin.symbol, ...(coin.formerSymbols ?? [])].some((text) => text.toLowerCase().includes(q))) : coins;
  return (
    <Sheet open={open} onClose={onClose} title={list ? `Add coins to ${list.name}` : "Add coins"} side="bottom">
      {list && (
        <>
          <label className="form-field">
            <span>Search coins</span>
            <input className="input" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or ticker" />
          </label>
          {shown.length === 0 ? (
            <p className="hint">No coins match “{query.trim()}”.</p>
          ) : (
            <ul className="pick-list" aria-label="Coins">
              {shown.map((coin) => (
                <li key={coin.id}>
                  <label className="pick-row">
                    <input type="checkbox" checked={list.coinIds.includes(coin.id)} onChange={(event) => onToggle(coin, event.target.checked)} />
                    <CoinLogo coin={coin} />
                    <span className="edit-name">
                      <strong>{coin.name}</strong>
                      <span>{coin.symbol}</span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          <button className="button-primary" onClick={onClose}>Done</button>
        </>
      )}
    </Sheet>
  );
}

export default function Watchlist() {
  const {
    session, settings, watchlist, lists, toggleWatch, moveWatch, removeWatch, createList, renameList, deleteList, setListMembership,
    updateSettings, updateMarketSettings, requireAuth, openSearch,
  } = useApp();
  const { coins, lastUpdated, flashes, tick, refresh, loadError } = useMarket();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [newOpen, setNewOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState("");
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
  // The open list is remembered per tab (journey rule 2); a deleted list falls back to Main.
  const active = lists.find((list) => list.id === settings.watchlistList) ?? null;
  const listId = active ? active.id : "main";
  const listName = active ? active.name : "Main";
  const ids = active ? active.coinIds : watchlist;
  const byId = useMemo(() => new Map(coins.map((coin) => [coin.id, coin])), [coins]);
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean);
  const openList = (id) => {
    setEditing(false);
    updateSettings({ watchlistList: id });
  };
  const onStar = active ? (coin) => removeWatch(coin, active.id) : toggleWatch;
  const addCoins = () => (active ? setAddOpen(true) : openSearch("coins"));
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

      {(session.kind !== "guest" || lists.length > 0) && (
        <div className="saved-row list-chips" role="group" aria-label="Watchlists">
          {[{ id: "main", name: "Main" }, ...lists].map((list) => (
            <span key={list.id} className="saved-chip">
              <button className={list.id === listId ? "chip on" : "chip"} aria-pressed={list.id === listId} onClick={() => openList(list.id)}>
                {list.name}
              </button>
              {list.id !== "main" && list.id === listId && (
                <button
                  className="icon-button small"
                  onClick={() => {
                    setName(list.name);
                    setManageOpen(true);
                  }}
                  aria-label={`Rename or delete ${list.name}`}
                >
                  ⋯
                </button>
              )}
            </span>
          ))}
          <button
            className="chip add-chip"
            onClick={() =>
              requireAuth("Sign in to create a watchlist", () => {
                setName("");
                setNewOpen(true);
              })
            }
          >
            + New list
          </button>
        </div>
      )}

      {session.kind === "guest" && (
        <div className="banner banner-info" role="note">
          <span>Sign in to build a watchlist that's saved to your account.</span>
          <button className="button-tertiary" onClick={() => navigate("/login?next=/watchlist")}>Log in</button>
        </div>
      )}

      {(failed || loadError) && (
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
          {active ? (
            <>
              <p>Add coins to {active.name} to see them here.</p>
              <button className="button-secondary" onClick={addCoins}>Add coins</button>
            </>
          ) : (
            <>
              <p>Add coins to your watchlist to see them here.</p>
              <button className="button-secondary" onClick={() => navigate("/market")}>Browse market</button>
            </>
          )}
        </div>
      ) : editing ? (
        <>
          <p className="hint">Drag rows, or use the arrow buttons, to change the order.</p>
          <EditList coins={ordered} listName={listName} onMove={(coinId, index) => moveWatch(coinId, index, listId)} onRemove={(coin) => removeWatch(coin, listId)} />
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
              watchlist={ids}
              onStar={onStar}
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
                    onStar={onStar}
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

      {!editing && !(active && ordered.length === 0) && (
        <button className="load-more" onClick={addCoins}>
          + Add coins
        </button>
      )}

      <AddCoinsSheet
        key={addOpen ? listId : "closed"}
        open={addOpen && Boolean(active)}
        onClose={() => setAddOpen(false)}
        list={active}
        coins={coins}
        onToggle={(coin, member) => setListMembership(coin, listId, member)}
      />

      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="New watchlist" side="bottom">
        <form
          className="tx-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            const id = createList(name);
            if (id) {
              setNewOpen(false);
              openList(id);
            }
          }}
        >
          <label className="form-field">
            <span>Name (up to 30 characters)</span>
            <input className="input" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} placeholder="L2 bets" autoFocus />
          </label>
          <button type="submit" className="button-primary" disabled={!name.trim()}>Create list</button>
        </form>
      </Sheet>

      <Sheet open={manageOpen && Boolean(active)} onClose={() => setManageOpen(false)} title="Watchlist" side="bottom">
        {active && (
          <form
            className="tx-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (!name.trim()) return;
              renameList(active.id, name);
              setManageOpen(false);
            }}
          >
            <label className="form-field">
              <span>Name</span>
              <input className="input" value={name} maxLength={30} onChange={(event) => setName(event.target.value)} />
            </label>
            <button type="submit" className="button-primary" disabled={!name.trim()}>Rename</button>
            <button
              type="button"
              className="button-secondary button-block danger-text"
              onClick={() => {
                setManageOpen(false);
                deleteList(active.id);
              }}
            >
              Delete list
            </button>
          </form>
        )}
      </Sheet>
    </div>
  );
}
