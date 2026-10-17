import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import CoinRow from "../components/CoinRow.jsx";
import Icon from "../components/Icon.jsx";
import { ResultLabel } from "../components/SearchOverlay.jsx";
import { resultPath, searchAll } from "../data/directory.js";
import { formatCompact, rateFor } from "../lib/format.js";
import { TRENDING, useDebounced } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";

const types = [
  { id: "all", label: "All" },
  { id: "coins", label: "Coins" },
  { id: "funds", label: "Funds" },
  { id: "exchanges", label: "Exchanges" },
  { id: "sales", label: "Sales" },
];
const sorts = [
  { id: "marketCap", label: "Market cap" },
  { id: "volume", label: "Volume" },
  { id: "popularity", label: "Popularity" },
];
const groupTitles = { coins: "Coins", funds: "Funds", exchanges: "Exchanges", sales: "Token sales" };
const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;

const sortValue = (hit, sort) => {
  if (sort === "popularity") return hit.views;
  if (hit.kind === "coin") return sort === "volume" ? hit.coin.volume24h : hit.coin.marketCap;
  if (hit.kind === "exchange") return hit.exchange.volume24h;
  if (hit.kind === "fund") return hit.fund.deployed;
  return hit.sale.raise;
};

// Results page (04-search.md): type pills with counts, sort, URL-driven.
export default function Search() {
  const [params, setParams] = useSearchParams();
  const { coins } = useMarket();
  const { settings, watchlist, toggleWatch, addRecentSearch, recentSearches, clearRecentSearches } = useApp();
  const [input, setInput] = useState(params.get("q") ?? "");
  const query = useDebounced(input);

  // A new ?q= from outside (e.g. the ⌘K overlay) replaces the box text.
  const urlQuery = params.get("q") ?? "";
  const [syncedQuery, setSyncedQuery] = useState(urlQuery);
  if (urlQuery !== syncedQuery) {
    setSyncedQuery(urlQuery);
    if (urlQuery !== query.trim()) setInput(urlQuery);
  }
  const type = types.some((item) => item.id === params.get("type")) ? params.get("type") : "all";
  const sort = sorts.some((item) => item.id === params.get("sort")) ? params.get("sort") : "marketCap";
  const rate = rateFor(settings.currency, coins);

  useEffect(() => {
    document.title = query ? `“${query}” · Search · CPA` : "Search · CPA";
  }, [query]);

  // Keep ?q= in step with the debounced input.
  useEffect(() => {
    const current = params.get("q") ?? "";
    if (current === query.trim()) return;
    const next = new URLSearchParams(params);
    if (query.trim()) next.set("q", query.trim());
    else next.delete("q");
    setParams(next, { replace: true });
  }, [query, params, setParams]);

  const results = useMemo(() => searchAll(query, coins), [query, coins]);
  const total = Object.values(results).reduce((sum, hits) => sum + hits.length, 0);

  const setParam = (key, value, fallback) => {
    const next = new URLSearchParams(params);
    if (value === fallback) next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  const groups = Object.entries(results)
    .filter(([key, hits]) => hits.length && (type === "all" || type === key))
    .map(([key, hits]) => ({ key, hits: [...hits].sort((a, b) => sortValue(b, sort) - sortValue(a, sort)) }));

  // Save the query when a result is opened (US-P04.2), not when a star is tapped.
  const remember = (event) => {
    if (event.target.closest("a")) addRecentSearch(query);
  };

  return (
    <div className="search-page">
      <h1 className="visually-hidden">Search</h1>
      <div className="search-box page">
        <Icon name="search" />
        <input
          type="search"
          aria-label="Search coins, funds, exchanges and token sales"
          placeholder="Search coins, funds, exchanges…"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          autoFocus
        />
        {input && (
          <button className="icon-button small" onClick={() => setInput("")} aria-label="Clear search">
            <Icon name="close" />
          </button>
        )}
      </div>

      {query.trim().length < 2 ? (
        <div className="search-empty">
          {recentSearches.length > 0 && (
            <section>
              <div className="search-group-head">
                <h2 className="subsection-title">Recent searches</h2>
                <button className="link-button" onClick={clearRecentSearches}>Clear</button>
              </div>
              <div className="chip-row">
                {recentSearches.map((item) => (
                  <button key={item} className="chip" onClick={() => setInput(item)}>
                    <Icon name="clock" /> {item}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2 className="subsection-title">Trending</h2>
            <div className="chip-row">
              {TRENDING.map((ticker) => (
                <button key={ticker} className="chip" onClick={() => setInput(ticker)}>{ticker}</button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <>
          <p className="result-count" role="status">
            {total} {total === 1 ? "result" : "results"} for “{query.trim()}”
          </p>
          <div className="filters" role="group" aria-label="Result type">
            {types.map((item) => {
              const count = item.id === "all" ? total : results[item.id].length;
              return (
                <button
                  key={item.id}
                  className={type === item.id ? "filter active" : "filter"}
                  aria-pressed={type === item.id}
                  onClick={() => setParam("type", item.id, "all")}
                  disabled={item.id !== "all" && count === 0}
                >
                  {item.label} {item.id !== "all" && <span className="num">{count}</span>}
                </button>
              );
            })}
          </div>
          <label className="inline-select">
            Sort
            <select className="select" value={sort} onChange={(event) => setParam("sort", event.target.value, "marketCap")}>
              {sorts.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>

          {total === 0 && (
            <div className="empty-state">
              <p>No matches for “{query.trim()}”. Check the spelling or try a ticker.</p>
              <div className="chip-row">
                {TRENDING.map((ticker) => (
                  <button key={ticker} className="chip" onClick={() => setInput(ticker)}>{ticker}</button>
                ))}
              </div>
            </div>
          )}

          {groups.map((group) => (
            <section key={group.key} aria-labelledby={`results-${group.key}`} className="result-group" onClickCapture={remember}>
              <h2 id={`results-${group.key}`} className="subsection-title">{groupTitles[group.key]}</h2>
              {group.key === "coins" ? (
                <div className="coin-list">
                  {group.hits.map((hit) => (
                    <CoinRow
                      key={hit.id}
                      coin={hit.coin}
                      starred={watchlist.includes(hit.id)}
                      onStar={toggleWatch}
                      currency={settings.currency}
                      rate={rate}
                      footer={
                        <span className="num">
                          {hit.verified ? <span className="verified-text">✓ Verified</span> : <span className="unverified">⚠ Unverified</span>} · MCap{" "}
                          {formatCompact(hit.coin.marketCap, settings.currency, rate)}
                          {hit.contract && <> · <span className="mono">{shortAddress(hit.contract)}</span></>}
                        </span>
                      }
                    />
                  ))}
                </div>
              ) : (
                <ul className="result-list">
                  {group.hits.map((hit) => (
                    <li key={hit.id}>
                      <Link to={resultPath(hit)} className="search-option">
                        <ResultLabel hit={hit} />
                        <Icon name="chevron" />
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </>
      )}
    </div>
  );
}
