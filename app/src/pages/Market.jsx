import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CoinRow, { ProTable, SkeletonRows } from "../components/CoinRow.jsx";
import ChartSummary from "../components/ChartSummary.jsx";
import Icon from "../components/Icon.jsx";
import Sheet from "../components/Sheet.jsx";
import Sparkline from "../components/Sparkline.jsx";
import { categories, initialCoins, marketPulse } from "../data/coins.js";
import {
  currencies,
  direction,
  formatCompact,
  formatPercent,
  rateFor,
  relativeTime,
  spokenPercent,
} from "../lib/format.js";
import { useNow, useOnline } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";
import { marketCapChange24h } from "../lib/market.js";

const views = [
  { id: "coins", label: "Coins", title: "Top cryptocurrencies" },
  { id: "watchlist", label: "Watchlist", title: "Your watchlist" },
  { id: "gainers", label: "Gainers", title: "Top gainers" },
  { id: "new", label: "New", title: "New listings" },
];

const sortOptions = [
  { id: "rank", label: "Rank", phrase: "market capitalization", field: (coin) => coin.rank },
  { id: "price", label: "Price", phrase: "price", field: (coin) => coin.price },
  { id: "change24h", label: "24h %", phrase: "24h change", field: (coin) => coin.change24h },
  { id: "volume", label: "Volume", phrase: "24h volume", field: (coin) => coin.volume24h },
  { id: "marketCap", label: "Market cap", phrase: "market cap", field: (coin) => coin.marketCap },
];

const windows = { "1h": "change1h", "24h": "change24h", "7d": "change7d" };
const GAINERS_MIN_VOLUME = 100_000;
const NEW_WITHIN_DAYS = 30;
const PREVIEW_ROWS = 4;
const PAGE_SIZE = 100;
const STALE_AFTER_MS = 5 * 60_000;
const initialCapTotal = initialCoins.reduce((sum, coin) => sum + coin.marketCap, 0);

let hasLoadedOnce = false;


function subtitleFor(view, market) {
  if (view === "gainers") return `Biggest ${market.gainersWindow} gains · volume over $100K`;
  if (view === "new") return `Listed in the last ${NEW_WITHIN_DAYS} days`;
  if (view === "watchlist" && market.sort === "rank") return "Your starred coins, by rank";
  const option = sortOptions.find((item) => item.id === market.sort) ?? sortOptions[0];
  if (option.id === "rank") return "By market capitalization";
  return `By ${option.phrase}, ${market.dir === "desc" ? "high to low" : "low to high"}`;
}

function selectRows(coins, view, market, watchlist) {
  let rows = market.category === "All" ? coins : coins.filter((coin) => coin.category === market.category);
  if (view === "watchlist") rows = rows.filter((coin) => watchlist.includes(coin.id));
  if (view === "gainers") {
    const key = windows[market.gainersWindow];
    return rows.filter((coin) => coin.volume24h >= GAINERS_MIN_VOLUME && coin[key] > 0).sort((a, b) => b[key] - a[key]);
  }
  if (view === "new") return rows.filter((coin) => coin.listedDaysAgo <= NEW_WITHIN_DAYS).sort((a, b) => a.listedDaysAgo - b.listedDaysAgo);
  const option = sortOptions.find((item) => item.id === market.sort) ?? sortOptions[0];
  const sign = market.dir === "desc" ? -1 : 1;
  return [...rows].sort((a, b) => sign * (option.field(a) - option.field(b)));
}

function CurrencyMenu({ currency, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (event) => {
      if (!ref.current?.contains(event.target)) setOpen(false);
    };
    const onKey = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="currency-menu" ref={ref}>
      <button className="currency" aria-haspopup="true" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        <span className="visually-hidden">Display currency: </span>
        {currency}
        <Icon name="chevronDown" />
      </button>
      {open && (
        <ul className="popover" aria-label="Display currency">
          {Object.keys(currencies).map((code) => (
            <li key={code}>
              <button
                className={code === currency ? "popover-item selected" : "popover-item"}
                aria-pressed={code === currency}
                onClick={() => {
                  onChange(code);
                  setOpen(false);
                }}
              >
                {code}
                {code === currency && <Icon name="check" />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SortSheet({ open, onClose, market, onApply }) {
  const [draft, setDraft] = useState(market);

  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Sort and filter" side="bottom">
      <fieldset className="field-group">
        <legend>Sort by</legend>
        <div className="choice-grid">
          {sortOptions.map((option) => (
            <label key={option.id} className="choice">
              <input
                type="radio"
                name="sort"
                checked={draft.sort === option.id}
                onChange={() => setDraft({ ...draft, sort: option.id, dir: option.id === "rank" ? "asc" : "desc" })}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset className="field-group">
        <legend>Order</legend>
        <div className="segmented" role="group">
          {[
            ["desc", draft.sort === "rank" ? "Last first" : "High to low"],
            ["asc", draft.sort === "rank" ? "#1 first" : "Low to high"],
          ].map(([dir, label]) => (
            <button key={dir} className={draft.dir === dir ? "segment active" : "segment"} aria-pressed={draft.dir === dir} onClick={() => setDraft({ ...draft, dir })}>
              {label}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="field-group">
        <span className="legend">Category</span>
        <select className="select" value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })}>
          <option value="All">All categories</option>
          {categories.map((category) => (
            <option key={category}>{category}</option>
          ))}
        </select>
      </label>

      <fieldset className="field-group">
        <legend>View</legend>
        <div className="segmented" role="group">
          {[
            ["simple", "Simple"],
            ["pro", "Pro"],
          ].map(([density, label]) => (
            <button key={density} className={draft.density === density ? "segment active" : "segment"} aria-pressed={draft.density === density} onClick={() => setDraft({ ...draft, density })}>
              {label}
            </button>
          ))}
        </div>
        <p className="hint">Simple shows name, price and 24h change. Pro adds 7d change, market cap, volume and FDV.</p>
      </fieldset>

      <button className="button-primary" onClick={apply}>Apply</button>
    </Sheet>
  );
}

// Keyed by view + filters so "View all" resets whenever the list changes.
function CoinList({ rows, view, emptyAction, ...rowProps }) {
  const preview = view !== "watchlist";
  const [expanded, setExpanded] = useState(!preview);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinel = useRef(null);

  const shown = expanded ? rows.slice(0, visible) : rows.slice(0, PREVIEW_ROWS);
  const hasMore = expanded && visible < rows.length;

  // Infinite scroll: load the next 100 rows when the sentinel appears (US-2.1).
  useEffect(() => {
    if (!hasMore || loadingMore || !sentinel.current) return undefined;
    const observer = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      setLoadingMore(true);
      window.setTimeout(() => {
        setVisible((count) => count + PAGE_SIZE);
        setLoadingMore(false);
      }, 450);
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [hasMore, loadingMore]);

  if (!rows.length) {
    return (
      <div className="empty-state">
        <Icon name="star" className="empty-icon" />
        <p>{view === "watchlist" ? "Star coins to see them here." : "No coins match these filters."}</p>
        {emptyAction}
      </div>
    );
  }

  const { density, ...rest } = rowProps;
  return (
    <>
      {density === "pro" ? (
        <ProTable rows={shown} {...rest} />
      ) : (
        <>
          <div className="table-head" aria-hidden="true">
            <span># &nbsp; Name</span>
            <span>Price / {rest.changeKey === "change1h" ? "1h" : rest.changeKey === "change7d" ? "7d" : "24h"}</span>
          </div>
          <div className="coin-list">
            {shown.map((coin) => (
              <CoinRow
                key={coin.id}
                coin={coin}
                starred={rest.watchlist.includes(coin.id)}
                onStar={rest.onStar}
                currency={rest.currency}
                rate={rest.rate}
                changeKey={rest.changeKey}
                flash={rest.flashes[coin.id]}
                tick={rest.tick}
                stale={rest.stale}
              />
            ))}
          </div>
        </>
      )}

      {loadingMore && <SkeletonRows count={8} />}
      {hasMore && <div ref={sentinel} className="sentinel" aria-hidden="true" />}
      {!expanded && rows.length > PREVIEW_ROWS && (
        <button className="load-more" onClick={() => setExpanded(true)}>
          View all assets <Icon name="chevron" />
        </button>
      )}
      {expanded && preview && (
        <p className="list-count num" role="status">
          Showing {shown.length} of {rows.length}
        </p>
      )}
    </>
  );
}

export default function Market() {
  const { settings, updateSettings, updateMarketSettings, watchlist, toggleWatch, openSearch } = useApp();
  const { coins, lastUpdated, tick, flashes, refresh, loadError } = useMarket();
  const [params, setParams] = useSearchParams();
  const [sortOpen, setSortOpen] = useState(false);
  const [aboutFearGreed, setAboutFearGreed] = useState(false);
  const [loading, setLoading] = useState(!hasLoadedOnce);
  const now = useNow(15_000);

  const market = settings.market;
  const currency = settings.currency;
  const view = views.some((item) => item.id === params.get("view")) ? params.get("view") : market.view;
  const viewMeta = views.find((item) => item.id === view);
  const rate = rateFor(currency, coins);
  const stale = now - lastUpdated > STALE_AFTER_MS;
  const simulatedError = params.get("simulate") === "error";
  const online = useOnline();

  useEffect(() => {
    document.title = "Market · CPA";
    if (hasLoadedOnce) return undefined;
    const id = window.setTimeout(() => {
      hasLoadedOnce = true;
      setLoading(false);
    }, 500);
    return () => window.clearTimeout(id);
  }, []);

  // Explore's category tiles link here with ?category=…; apply it once, then tidy the URL.
  const categoryParam = params.get("category");
  useEffect(() => {
    if (!categoryParam) return;
    const match = categories.find((item) => item.toLowerCase() === categoryParam.toLowerCase());
    if (match) updateMarketSettings({ category: match, view: "coins" });
    const next = new URLSearchParams(params);
    next.delete("category");
    next.set("view", "coins");
    setParams(next, { replace: true });
  }, [categoryParam, params, setParams, updateMarketSettings]);

  const rows = useMemo(() => selectRows(coins, view, market, watchlist), [coins, view, market, watchlist]);
  const totalCap = marketPulse.totalMarketCap * (coins.reduce((sum, coin) => sum + coin.marketCap, 0) / initialCapTotal);
  const totalChange = marketCapChange24h(coins);

  const setView = (id) => {
    const next = new URLSearchParams(params);
    next.set("view", id);
    setParams(next, { replace: true });
    updateMarketSettings({ view: id });
  };

  const onHeaderSort = (sortId) => {
    if (market.sort === sortId) updateMarketSettings({ dir: market.dir === "desc" ? "asc" : "desc" });
    else updateMarketSettings({ sort: sortId, dir: sortId === "rank" ? "asc" : "desc" });
  };

  const sortOption = sortOptions.find((item) => item.id === market.sort) ?? sortOptions[0];
  const chips = [];
  if (market.category !== "All") chips.push({ id: "category", label: market.category, clear: () => updateMarketSettings({ category: "All" }) });
  if ((view === "coins" || view === "watchlist") && market.sort !== "rank") {
    chips.push({ id: "sort", label: `${sortOption.label} ${market.dir === "desc" ? "▼" : "▲"}`, clear: () => updateMarketSettings({ sort: "rank", dir: "asc" }) });
  }
  if (market.density === "pro") chips.push({ id: "density", label: "Pro view", clear: () => updateMarketSettings({ density: "simple" }) });

  const changeKey = view === "gainers" ? windows[market.gainersWindow] : "change24h";
  const listKey = [view, market.category, market.sort, market.dir, market.gainersWindow, market.density].join("|");

  return (
    <div className="market">
      <h1 className="visually-hidden">Market</h1>

      <div className="market-heading">
        <div>
          <p className="eyebrow">Global crypto market cap</p>
          <p className="market-value num">
            {formatCompact(totalCap, currency, rate)}
            <span className={direction(totalChange)}>{formatPercent(totalChange)}</span>
          </p>
        </div>
        <CurrencyMenu currency={currency} onChange={(code) => updateSettings({ currency: code })} />
      </div>

      <button className="search-field" onClick={() => openSearch()}>
        <Icon name="search" />
        <span>Search coins, exchanges, IDO…</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>

      <div className="filters" role="tablist" aria-label="Market filters">
        {views.map((item) => (
          <button
            key={item.id}
            role="tab"
            id={`tab-${item.id}`}
            aria-selected={view === item.id}
            aria-controls="market-list"
            tabIndex={view === item.id ? 0 : -1}
            className={view === item.id ? "filter active" : "filter"}
            onClick={() => setView(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const index = views.findIndex((entry) => entry.id === view);
              const next = views[(index + (event.key === "ArrowRight" ? 1 : views.length - 1)) % views.length];
              setView(next.id);
              document.getElementById(`tab-${next.id}`)?.focus();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>

      {(simulatedError || loadError) && (
        <div className="banner banner-error" role="alert">
          <span>We couldn't load prices. Showing data from {relativeTime(lastUpdated, now)}.</span>
          <button
            className="button-tertiary"
            onClick={() => {
              const next = new URLSearchParams(params);
              next.delete("simulate");
              setParams(next, { replace: true });
              refresh();
            }}
          >
            Retry
          </button>
          <Link to="/report-issue?type=data&from=%2Fmarket" className="button-tertiary">Report an issue</Link>
        </div>
      )}

      <div className="section-title">
        <div>
          <h2>Market pulse</h2>
          <span className={stale ? "stale" : undefined}>
            {stale && <Icon name="clock" className="icon-inline" />}
            {settings.autoRefresh ? "Updated" : "Last updated"} {relativeTime(lastUpdated, now)}
          </span>
        </div>
        {settings.autoRefresh ? (
          <Link to="/explore#market-pulse" className="link-button">
            View all <Icon name="chevron" />
          </Link>
        ) : (
          // Auto-refresh off (US-P27.3): prices only change when asked.
          // Offline (US-9.5): the feed can't refresh, so the button is disabled until the connection returns.
          <button className="button-secondary compact" onClick={refresh} disabled={!online}>
            Refresh
          </button>
        )}
      </div>

      {loading ? (
        <div className="pulse-grid" aria-hidden="true">
          <div className="pulse-card skeleton" />
          <div className="pulse-card skeleton" />
        </div>
      ) : (
        <div className="pulse-grid">
          <article className="pulse-card" aria-label={`Fear and Greed index ${marketPulse.fearGreed}, Greed. Yesterday ${marketPulse.fearGreedYesterday}.`}>
            <div className="pulse-label">
              <span>Fear & Greed</span>
              <button className="dots" onClick={() => setAboutFearGreed(true)} aria-label="What is Fear and Greed?">
                •••
              </button>
            </div>
            <div className="gauge-row" aria-hidden="true">
              <div className="gauge" style={{ "--value": `${marketPulse.fearGreed}%` }}>
                <span className="num">{marketPulse.fearGreed}</span>
              </div>
              <div>
                <strong>Greed</strong>
                <small>Yesterday: {marketPulse.fearGreedYesterday}</small>
              </div>
            </div>
          </article>
          <article className="pulse-card" aria-label={`Bitcoin dominance ${marketPulse.btcDominance} percent, ${spokenPercent(marketPulse.btcDominanceChange)}.`}>
            <div className="pulse-label">
              <span>BTC Dominance</span>
              <span className="live-dot" title="Live" />
            </div>
            <p className="dominance num" aria-hidden="true">
              {marketPulse.btcDominance}%<span className={direction(marketPulse.btcDominanceChange)}>{formatPercent(marketPulse.btcDominanceChange)}</span>
            </p>
            <Sparkline points={marketPulse.btcDominanceSpark} />
            <ChartSummary
              text={`BTC dominance is ${marketPulse.btcDominance}%, ${formatPercent(marketPulse.btcDominanceChange)} in 24h. The trend line ${marketPulse.btcDominanceSpark.at(-1) > marketPulse.btcDominanceSpark[0] ? "rises" : "falls"} overall.`}
            />
          </article>
        </div>
      )}

      <div className="section-title market-list-title">
        <div>
          <h2>{viewMeta.title}</h2>
          <span>{subtitleFor(view, market)}</span>
        </div>
        <button className="sort-button" onClick={() => setSortOpen(true)} aria-label={`Sort and filter. Sorted by ${sortOption.label}.`}>
          <Icon name="swap" /> {view === "gainers" ? market.gainersWindow : view === "new" ? "Newest" : sortOption.label}
        </button>
      </div>

      {view === "gainers" && (
        <div className="segmented segmented-inline" role="group" aria-label="Gainers time window">
          {Object.keys(windows).map((key) => (
            <button key={key} className={market.gainersWindow === key ? "segment active" : "segment"} aria-pressed={market.gainersWindow === key} onClick={() => updateMarketSettings({ gainersWindow: key })}>
              {key}
            </button>
          ))}
        </div>
      )}

      {chips.length > 0 && (
        <ul className="chip-row" aria-label="Active filters">
          {chips.map((chip) => (
            <li key={chip.id}>
              <button className="chip" onClick={chip.clear} aria-label={`Remove filter: ${chip.label}`}>
                {chip.label}
                <Icon name="close" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <section id="market-list" role="tabpanel" aria-labelledby={`tab-${view}`}>
        {loading ? (
          <SkeletonRows count={8} />
        ) : (
          <CoinList
            key={listKey}
            rows={rows}
            view={view}
            density={market.density}
            watchlist={watchlist}
            onStar={toggleWatch}
            currency={currency}
            rate={rate}
            market={market}
            onSort={onHeaderSort}
            changeKey={changeKey}
            flashes={flashes}
            tick={tick}
            stale={stale}
            emptyAction={
              view === "watchlist" ? (
                <button className="button-secondary" onClick={() => setView("coins")}>Browse coins</button>
              ) : (
                <button className="button-secondary" onClick={() => updateMarketSettings({ category: "All" })}>Clear filters</button>
              )
            }
          />
        )}
      </section>

      <SortSheet key={sortOpen ? "open" : "closed"} open={sortOpen} onClose={() => setSortOpen(false)} market={market} onApply={updateMarketSettings} />

      <Sheet open={aboutFearGreed} onClose={() => setAboutFearGreed(false)} title="Fear & Greed" side="bottom">
        <p className="sheet-note">
          A 0–100 score of market sentiment built from volatility, volume, momentum and social activity. Below 25 is extreme fear; above 75 is
          extreme greed. It describes mood, not where prices will go.
        </p>
      </Sheet>
    </div>
  );
}
