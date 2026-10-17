import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import CoinLogo from "./CoinLogo.jsx";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";
import { fundById } from "../data/research.js";
import { resultPath, searchAll } from "../data/directory.js";
import { formatCompact, formatDate } from "../lib/format.js";
import { TRENDING, useDebounced } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";

const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;
const groupTitles = { coins: "Coins", funds: "Funds", exchanges: "Exchanges", sales: "Token sales" };

export function ResultLabel({ hit }) {
  if (hit.kind === "coin") {
    return (
      <>
        <CoinLogo coin={hit.coin} />
        <span className="result-main">
          <strong>
            {hit.coin.name} <span className="ticker">{hit.coin.symbol}</span>{" "}
            {hit.verified ? (
              <span className="verified-mark" title="Verified">
                <Icon name="check" />
                <span className="visually-hidden">Verified</span>
              </span>
            ) : (
              <span className="unverified">⚠ Unverified</span>
            )}
          </strong>
          <span className="num">
            MCap {formatCompact(hit.coin.marketCap)}
            {hit.contract ? ` · ${shortAddress(hit.contract)}` : ""}
          </span>
        </span>
      </>
    );
  }
  const [initial, name, meta] =
    hit.kind === "fund"
      ? [hit.fund.name[0], hit.fund.name, `${fundById(hit.id)?.deals ?? 0} deals`]
      : hit.kind === "exchange"
        ? [hit.exchange.name[0], hit.exchange.name, `Vol ${formatCompact(hit.exchange.volume24h)}`]
        : [hit.sale.name[0], `${hit.sale.name} · ${hit.sale.type}`, formatDate(hit.sale.start)];
  return (
    <>
      <span className="square-logo" aria-hidden="true">{initial}</span>
      <span className="result-main">
        <strong>{name}</strong>
        <span className="num">{meta}</span>
      </span>
    </>
  );
}

// ⌘K overlay (04-search.md): grouped results, max 3 per group, keyboard listbox.
export default function SearchOverlay() {
  const { search, closeSearch, recentSearches, addRecentSearch, removeRecentSearch, clearRecentSearches } = useApp();
  const { coins } = useMarket();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const debounced = useDebounced(query);

  const groups = useMemo(() => {
    const results = searchAll(debounced, coins);
    const scoped = search.scope === "coins" ? { coins: results.coins } : results;
    return Object.entries(scoped)
      .map(([key, hits]) => ({ key, hits: hits.slice(0, 3) }))
      .filter((group) => group.hits.length);
  }, [debounced, coins, search.scope]);
  const flat = groups.flatMap((group) => group.hits);
  const activeIndex = Math.min(active, Math.max(flat.length - 1, 0));

  const close = () => {
    setQuery("");
    setActive(0);
    closeSearch();
  };

  const open = (hit) => {
    addRecentSearch(query);
    close();
    navigate(resultPath(hit));
  };

  const seeAll = () => {
    if (query.trim().length < 2) return;
    addRecentSearch(query);
    close();
    navigate(`/search?q=${encodeURIComponent(query.trim())}${search.scope === "coins" ? "&type=coins" : ""}`);
  };

  const onKeyDown = (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (event.shiftKey || !flat.length) seeAll();
      else open(flat[activeIndex]);
    }
  };

  const showResults = debounced.trim().length >= 2;
  const optionId = (hit) => `search-opt-${hit.kind}-${hit.id}`;

  return (
    <Sheet open={search.open} onClose={close} title="Search" side="top" initialFocus="#search-input" hideHeader>
      <div className="search-box">
        <Icon name="search" />
        <input
          id="search-input"
          type="search"
          role="combobox"
          aria-expanded={showResults && flat.length > 0}
          aria-controls="search-listbox"
          aria-activedescendant={showResults && flat[activeIndex] ? optionId(flat[activeIndex]) : undefined}
          aria-autocomplete="list"
          aria-label={search.scope === "coins" ? "Search coins" : "Search coins, funds, exchanges and token sales"}
          placeholder={search.scope === "coins" ? "Search coins…" : "Search coins, funds…"}
          autoComplete="off"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
        />
        <button className="kbd-button" onClick={close} aria-label="Close search">Esc</button>
      </div>

      {!showResults && (
        <div className="search-empty">
          {recentSearches.length > 0 && (
            <section aria-labelledby="recent-title">
              <div className="search-group-head">
                <h3 id="recent-title">Recent</h3>
                <button className="link-button" onClick={clearRecentSearches}>Clear</button>
              </div>
              <ul className="recent-list">
                {recentSearches.map((item) => (
                  <li key={item}>
                    <button className="recent-item" onClick={() => setQuery(item)}>
                      <Icon name="clock" /> {item}
                    </button>
                    <button className="icon-button small" onClick={() => removeRecentSearch(item)} aria-label={`Remove ${item} from recent searches`}>
                      <Icon name="close" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section aria-labelledby="trending-title">
            <h3 id="trending-title">Trending</h3>
            <div className="chip-row">
              {TRENDING.map((ticker) => (
                <button key={ticker} className="chip" onClick={() => setQuery(ticker)}>{ticker}</button>
              ))}
            </div>
          </section>
          <p className="hint">Type at least 2 characters.</p>
        </div>
      )}

      {showResults && (
        <>
          {flat.length ? (
            <div id="search-listbox" role="listbox" aria-label="Search results" className="search-results">
              {groups.map((group) => (
                <div key={group.key} role="group" aria-labelledby={`group-${group.key}`}>
                  <h3 id={`group-${group.key}`} className="search-group-title" role="presentation">{groupTitles[group.key]}</h3>
                  {group.hits.map((hit) => {
                    const index = flat.indexOf(hit);
                    return (
                      <div
                        key={optionId(hit)}
                        id={optionId(hit)}
                        role="option"
                        aria-selected={index === activeIndex}
                        className={index === activeIndex ? "search-option active" : "search-option"}
                        onMouseMove={() => setActive(index)}
                        onClick={() => open(hit)}
                      >
                        <ResultLabel hit={hit} />
                        <Icon name="chevron" />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
          ) : (
            <p className="search-none">No matches for “{debounced}”. Check the spelling or try a ticker.</p>
          )}
          <div className="search-footer">
            <span className="hint">↑↓ move · ↵ open · ⇧↵ all results</span>
            <button className="link-button" onClick={seeAll}>See all results</button>
          </div>
        </>
      )}
    </Sheet>
  );
}
