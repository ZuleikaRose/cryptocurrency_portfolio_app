import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Icon from "../components/Icon.jsx";
import { ErrorBanner, SkeletonDetail } from "../components/LoadState.jsx";
import SimilarCoins from "../components/SimilarCoins.jsx";
import InfoTip from "../components/InfoTip.jsx";
import PriceChart from "../components/PriceChart.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import RiskIndicators from "../components/RiskIndicators.jsx";
import ChartSummary from "../components/ChartSummary.jsx";
import { chartSummary } from "../lib/chart.js";
import Sheet from "../components/Sheet.jsx";
import SupplyBar from "../components/SupplyBar.jsx";
import VestingChart from "../components/VestingChart.jsx";
import { fundById, priceHistory, ranges, researchFor, TODAY } from "../data/research.js";
import { arrow, direction, formatCompact, formatCountdown, formatDate, formatNumber, formatPercent, formatPrice, formatTokens, rateFor, relativeTime, shortContract } from "../lib/format.js";
import { useFirstLoad, useNow, usePageTitle } from "../lib/hooks.js";
import { shareCard } from "../lib/share.js";
import { useApp, useMarket } from "../state/context.js";
import NotFound from "./NotFound.jsx";
import { coinSource } from "../lib/market.js";
import { closeDay, historyLabel, historyProvider, usePriceHistory, withLivePrice } from "../lib/history.js";
import { locale, t, tn } from "../lib/i18n.js";
import { copyText } from "../lib/clipboard.js";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "funding", label: "Funding" },
  { id: "markets", label: "Markets" },
];



function Overview({ coin, research, currency, rate, onMarker, onRemind, reminders, vote, onVote, now }) {
  const { settings } = useApp();
  const [rangeId, setRangeId] = useState(() => (ranges.some((item) => item.id === settings.chartRange) ? settings.chartRange : "1M"));
  const [mode, setMode] = useState("line");
  const [showMarkers, setShowMarkers] = useState(true);
  const range = ranges.find((item) => item.id === rangeId);
  // Coinbase closes for live coins (clarification 26), sample history for the rest. Recomputed
  // when the live price ticks, so the chart ends at today's price.
  const history = usePriceHistory(coin, rangeId);
  const allHistory = usePriceHistory(coin, "ALL");
  const real = history.data?.points.length >= 2 ? history.data.points : null;
  const waiting = history.live && !history.data;
  const points = useMemo(() => (real ? withLivePrice(real, coin.price) : waiting ? null : priceHistory(coin, rangeId)), [real, waiting, coin, rangeId]);
  const { athPoint, atlPoint } = useMemo(() => {
    if (allHistory.data?.high) return { athPoint: { ...allHistory.data.high, time: closeDay(allHistory.data.high.time) }, atlPoint: { ...allHistory.data.low, time: closeDay(allHistory.data.low.time) } };
    if (allHistory.live && !allHistory.data) return { athPoint: null, atlPoint: null };
    const all = priceHistory(coin, "ALL");
    return {
      athPoint: all.reduce((best, point) => (point.price > best.price ? point : best), all[0]),
      atlPoint: all.reduce((best, point) => (point.price < best.price ? point : best), all[0]),
    };
  }, [allHistory.data, allHistory.live, coin]);

  // Keys 1–6 switch range (00-app-shell.md shortcuts); ignored while typing.
  useEffect(() => {
    const onKey = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(event.target.tagName)) return;
      const index = Number(event.key) - 1;
      if (index >= 0 && index < ranges.length) setRangeId(ranges[index].id);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  // Past unlocks, funding rounds and the listing date as chart markers (US-3.2).
  const markers = useMemo(() => {
    const items = [];
    const seenDays = new Set();
    research.vestingEvents
      .filter((event) => event.date <= TODAY)
      .forEach((event) => {
        const day = event.date.toISOString().slice(0, 10);
        if (seenDays.has(day)) return;
        seenDays.add(day);
        const amount = research.vestingEvents.filter((item) => item.date.toISOString().slice(0, 10) === day).reduce((sum, item) => sum + item.amount, 0);
        items.push({ id: `u-${day}`, kind: "unlock", time: event.date.getTime(), amount });
      });
    research.rounds.forEach((round) => items.push({ id: `f-${round.id}`, kind: "funding", time: round.date.getTime(), round }));
    items.push({ id: "listing", kind: "listing", time: research.listedOn.getTime() });
    return items;
  }, [research]);

  const nextUnlock = research.upcomingUnlocks[0];
  const sentiment = research.sentiment;
  const bullish = vote ? Math.round(((sentiment.bullish / 100) * sentiment.votes + (vote === "bullish" ? 1 : 0)) / (sentiment.votes + 1) * 100) : sentiment.bullish;
  const supply = research.supply;

  return (
    <>
      <section className="card chart-card" aria-label={t("Price chart")}>
        {history.error && <ErrorBanner what={t("the price chart")} onRetry={history.retry} />}
        {points ? (
          <PriceChart
            points={points}
            rangeId={rangeId}
            mode={mode}
            markers={markers}
            showMarkers={showMarkers}
            onMarker={onMarker}
            currency={currency}
            rate={rate}
            label={range.label}
          />
        ) : (
          !history.error && (
            <>
              <p className="visually-hidden" role="status">{t("Loading the price chart…")}</p>
              <div className="skeleton skeleton-chart" aria-hidden="true" />
            </>
          )
        )}
        <div className="chart-controls">
          <div className="segmented" role="group" aria-label={t("Chart range")}>
            {ranges.map((item, index) => (
              <button
                key={item.id}
                className={rangeId === item.id ? "segment active" : "segment"}
                aria-pressed={rangeId === item.id}
                aria-keyshortcuts={String(index + 1)}
                onClick={() => setRangeId(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="segmented" role="group" aria-label={t("Chart type")}>
            {[
              ["line", "Line"],
              ["candle", "Candle"],
            ].map(([id, label]) => (
              <button key={id} className={mode === id ? "segment active" : "segment"} aria-pressed={mode === id} onClick={() => setMode(id)}>
                {t(label)}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-toggles">
          <label className="switch">
            <input type="checkbox" checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            {t("Event markers")}
          </label>
        </div>
        {showMarkers && (
          <p className="marker-legend">
            {/* Each key stays with its label when the legend wraps at large text sizes. */}
            <span className="marker-item"><span className="marker-key marker-unlock">U</span> {t("Unlock")}</span>
            <span className="marker-item"><span className="marker-key marker-funding">F</span> {t("Funding")}</span>
            <span className="marker-item"><span className="marker-key marker-listing">L</span> {t("Listing")}</span>
          </p>
        )}
        {points && <ChartSummary text={chartSummary(points, range.label, currency, rate)} />}
        <p className="muted-line chart-source">{t("Chart: {source}", { source: real ? historyLabel(coin.id) : waiting ? historyProvider(coin.id) : t("CPA sample data") })}</p>
      </section>

      <dl className="stats">
        <div>
          <dt>
            {t("Market cap")}{" "}
            <InfoTip
              term="marketCap"
              label={t("market cap")}
              // No market cap from CryptoRank (Maker, clarification 39): no worked example.
              detail={coin.marketCap != null && t("{symbol}: {price} × {tokens} tokens circulating ≈ {cap}.", {
                symbol: coin.symbol,
                price: formatPrice(coin.price, currency, rate),
                tokens: formatTokens(coin.marketCap / coin.price),
                cap: formatCompact(coin.marketCap, currency, rate),
              })}
            />
          </dt>
          <dd className="num">{formatCompact(coin.marketCap, currency, rate)}</dd>
        </div>
        <div>
          <dt>
            FDV{" "}
            <InfoTip
              term="fdv"
              label="FDV"
              detail={coin.marketCap != null && t("{symbol}'s FDV is {multiple}× its market cap: {pct}% of all tokens are circulating today.", {
                symbol: coin.symbol,
                multiple: formatNumber(coin.fdv / coin.marketCap, 1),
                pct: Math.round((coin.marketCap / coin.fdv) * 100),
              })}
            />
          </dt>
          <dd className="num">{formatCompact(coin.fdv, currency, rate)}</dd>
        </div>
        <div>
          <dt>
            {t("24h volume")}{" "}
            <InfoTip
              term="volume"
              label={t("24h volume")}
              detail={coin.marketCap != null && t("{volume} traded in 24h, {pct}% of {symbol}'s market cap.", {
                volume: formatCompact(coin.volume24h, currency, rate),
                pct: formatNumber((coin.volume24h / coin.marketCap) * 100, 1),
                symbol: coin.symbol,
              })}
            />
          </dt>
          <dd className="num">{formatCompact(coin.volume24h, currency, rate)}</dd>
        </div>
        <div>
          <dt>{t("Circulating")}</dt>
          <dd className="num">{formatTokens(supply.circulating)} {coin.symbol}</dd>
        </div>
        <div>
          <dt>{t("All-time high")} <InfoTip term="ath" label={t("all-time high and low")} /></dt>
          <dd className="num">
            {athPoint ? <>{formatPrice(athPoint.price, currency, rate)} <small>{formatDate(athPoint.time)}</small></> : "—"}
          </dd>
        </div>
        <div>
          <dt>{t("All-time low")}</dt>
          <dd className="num">
            {atlPoint ? <>{formatPrice(atlPoint.price, currency, rate)} <small>{formatDate(atlPoint.time)}</small></> : "—"}
          </dd>
        </div>
      </dl>

      <RiskIndicators coin={coin} research={research} currency={currency} rate={rate} now={Math.floor(now / 60_000) * 60_000} />

      <SupplyBar supply={supply} symbol={coin.symbol} />

      {nextUnlock ? (
        <section className={`card unlock-card ${(nextUnlock.amount / supply.circulating) * 100 > 2 ? "warning" : ""}`} aria-label={t("Next unlock")}>
          <div className="unlock-head">
            <h2 className="subsection-title">{t("Next unlock")}</h2>
            <span className="num countdown">{formatCountdown(nextUnlock.date.getTime(), now)}</span>
          </div>
          <p className="num">
            {formatTokens(nextUnlock.amount)} {coin.symbol} · {formatCompact(nextUnlock.amount * coin.price, currency, rate)} ·{" "}
            {t("{pct}% of circ. supply", { pct: formatNumber((nextUnlock.amount / supply.circulating) * 100, 2) })}
          </p>
          <p className="muted-line">
            {formatDate(nextUnlock.date)} · {nextUnlock.allocations.map((name) => t(name)).join(", ")}
          </p>
          <button className={reminders[nextUnlock.id] ? "button-secondary reminder-set" : "button-secondary"} onClick={() => onRemind(nextUnlock)}>
            <Icon name={reminders[nextUnlock.id] ? "check" : "bell"} />
            {reminders[nextUnlock.id] ? t("Reminder set") : t("Remind me")}
          </button>
        </section>
      ) : (
        <p className="empty-line">{t("No scheduled unlocks.")}</p>
      )}

      <section className="card sentiment" aria-labelledby="sentiment-title">
        <h2 id="sentiment-title" className="subsection-title">{t("Community sentiment")} <span className="muted-inline">{t("(not advice)")}</span></h2>
        <div className="sentiment-bar" role="img" aria-label={t("{bullish} percent bullish, {bearish} percent bearish", { bullish, bearish: 100 - bullish })}>
          <span className="sentiment-bull" style={{ width: `${bullish}%` }} />
        </div>
        <div className="sentiment-labels num">
          <span className="up">{t("Bullish {pct}%", { pct: bullish })}</span>
          <span className="down">{t("Bearish {pct}%", { pct: 100 - bullish })}</span>
        </div>
        <div className="sentiment-actions">
          {["bullish", "bearish"].map((choice) => (
            <button key={choice} className={vote === choice ? "button-secondary selected" : "button-secondary"} aria-pressed={vote === choice} onClick={() => onVote(choice)} disabled={Boolean(vote)}>
              {choice === "bullish" ? t("▲ Bullish") : t("▼ Bearish")}
            </button>
          ))}
          <span className="muted-line num">{t("{count} votes today", { count: (sentiment.votes + (vote ? 1 : 0)).toLocaleString(locale()) })}</span>
        </div>
        {vote && <p className="muted-line">{vote === "bullish" ? t("You voted bullish today. You can vote again tomorrow.") : t("You voted bearish today. You can vote again tomorrow.")}</p>}
      </section>

      <section aria-labelledby="about-title">
        <h2 id="about-title" className="subsection-title">{t("About {name}", { name: coin.name })}</h2>
        <p className="about">{research.about}</p>
      </section>

      <SimilarCoins coin={coin} />
    </>
  );
}

function Tokenomics({ coin, research, currency, rate }) {
  const upcoming = research.upcomingUnlocks.slice(0, 5);
  return (
    <>
      <SupplyBar supply={research.supply} symbol={coin.symbol} />
      <section aria-labelledby="vesting-title">
        <h2 id="vesting-title" className="subsection-title">{t("Vesting schedule")}</h2>
        {research.vesting ? (
          <VestingChart vesting={research.vesting} events={research.vestingEvents} symbol={coin.symbol} />
        ) : (
          <p className="empty-line">{t("No vesting schedule on record for {name}.", { name: coin.name })}</p>
        )}
      </section>
      <section aria-labelledby="next-unlocks-title">
        <h2 id="next-unlocks-title" className="subsection-title">{upcoming.length ? t("Next {count} unlocks", { count: upcoming.length }) : t("Next unlocks")}</h2>
        {upcoming.length ? (
          <ol className="unlock-list">
            {upcoming.map((unlock) => {
              const share = (unlock.amount / research.supply.circulating) * 100;
              return (
                <li key={unlock.id} className={share > 2 ? "warning" : undefined}>
                  <div>
                    <strong>{formatDate(unlock.date)}</strong>
                    <span>{unlock.allocations.map((name) => t(name)).join(", ")}</span>
                  </div>
                  <div className="num">
                    <strong>{formatTokens(unlock.amount)} {coin.symbol}</strong>
                    <span>
                      {formatCompact(unlock.amount * coin.price, currency, rate)} · {formatNumber(share, 2)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-line">{t("No scheduled unlocks.")}</p>
        )}
      </section>
    </>
  );
}

function Funding({ coin, research, currency, rate }) {
  const rounds = research.rounds;
  if (!rounds.length) return <p className="empty-line">{t("No funding rounds on record for {name}.", { name: coin.name })}</p>;
  const total = rounds.reduce((sum, round) => sum + round.amount, 0);
  return (
    <section aria-labelledby="funding-title">
      <h2 id="funding-title" className="subsection-title">
        {t("Total raised")} <span className="num">{formatCompact(total, currency, rate)}</span> · {tn(rounds.length, "{count} round", "{count} rounds")}
      </h2>
      <ol className="round-list">
        {rounds.map((round) => {
          const roi = round.tokenPrice ? coin.price / round.tokenPrice : null;
          return (
            <li key={round.id} className="card round">
              <div className="round-head">
                <span className="tag tag-fundraising">{t(round.type)}</span>
                <span className="muted-line">{formatDate(round.date)}</span>
                <strong className="num">{formatCompact(round.amount, currency, rate)}</strong>
              </div>
              <p className="num muted-line">{t("Valuation {value}", { value: round.valuation ? formatCompact(round.valuation, currency, rate) : t("undisclosed") })}</p>
              {roi && (
                <p className="num">
                  {t("Token price {then} → {now}", { then: formatPrice(round.tokenPrice, currency, rate), now: formatPrice(coin.price, currency, rate) })}{" "}
                  <span className={direction(roi - 1)}>ROI {formatNumber(roi, 1)}x</span> <InfoTip term="roi" label="ROI" />
                </p>
              )}
              <p className="investors">
                {t("Lead:")}{" "}
                {round.leads.map((id) => (
                  <Link key={id} to={`/funds/${id}`} className="inline-link">
                    {fundById(id)?.name}
                  </Link>
                ))}
                {round.investors.length > round.leads.length && <span className="muted-inline"> {t("+{count} more", { count: round.investors.length - round.leads.length })}</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Markets({ coin, research, currency, rate }) {
  // Remembered per account (clarification 37, journey rule 2).
  const { settings, updateSettings } = useApp();
  const sort = { key: settings.coinMarkets.sort, dir: settings.coinMarkets.dir };
  const rows = research.markets
    .map((market) => ({ ...market, price: coin.price * market.priceOffset, volume: coin.volume24h * market.share }))
    .sort((a, b) => {
      const sign = sort.dir === "desc" ? -1 : 1;
      if (sort.key === "exchange") return sign * a.exchange.localeCompare(b.exchange);
      return sign * (a[sort.key] - b[sort.key]);
    });
  const columns = [
    ["exchange", t("Exchange")],
    ["price", t("Price")],
    ["volume", t("24h volume")],
    ["share", t("Share")],
  ];
  const onSort = (key) => updateSettings({ coinMarkets: { sort: key, dir: sort.key === key && sort.dir === "desc" ? "asc" : "desc" } });

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={t("Markets for {name}", { name: coin.name })}>
      <table className="pro-table markets-table">
        <thead>
          <tr>
            {columns.map(([key, label]) => (
              <th key={key} scope="col" className={key === "exchange" ? "sticky-col" : undefined} aria-sort={sort.key === key ? (sort.dir === "desc" ? "descending" : "ascending") : undefined}>
                <button className={sort.key === key ? "th-sort active" : "th-sort"} onClick={() => onSort(key)}>
                  {label}
                  {sort.key === key && <span aria-hidden="true">{sort.dir === "desc" ? "▼" : "▲"}</span>}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.exchange}>
              <th scope="row" className="sticky-col">
                <strong>{row.exchange}</strong>
                <span className="pair">{row.pair}</span>
              </th>
              <td className="num">{formatPrice(row.price, currency, rate)}</td>
              <td className="num">{formatCompact(row.volume, currency, rate)}</td>
              <td className="num">{formatNumber(row.share * 100, 1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function CoinDetail() {
  const { slug } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { coins, lastUpdated } = useMarket();
  const app = useApp();
  const { settings, watchlist, lists, toggleWatch, setListMembership, addRecentCoin, requireAuth, voteFor, castVote, reminders, showToast } = app;
  const [eventSheet, setEventSheet] = useState(null);
  const [listsOpen, setListsOpen] = useState(false);
  const [reminderSheet, setReminderSheet] = useState(null);
  const [copied, setCopied] = useState(false);
  const now = useNow(1000);
  const loading = useFirstLoad(`coin:${slug}`);

  const coin = coins.find((item) => item.id === slug);
  const research = coin ? researchFor(coin) : null;
  const tab = tabs.some((item) => item.id === params.get("tab")) ? params.get("tab") : "overview";

  usePageTitle(coin ? `${coin.name} (${coin.symbol})` : null);
  useEffect(() => {
    if (!coin) return;
    addRecentCoin(coin.id);
    // Only when the coin changes, not on every price tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [coin?.id, addRecentCoin]);

  if (!coin) return <NotFound />;
  if (loading) {
    return (
      <article className="coin-detail">
        <h1 className="visually-hidden">{coin.name}</h1>
        <SkeletonDetail label={coin.name} />
      </article>
    );
  }

  const currency = settings.currency;
  const rate = rateFor(currency, coins);
  // The star fills if the coin is in any list; with named lists it opens a picker (US-6.2).
  const starred = watchlist.includes(coin.id) || lists.some((list) => list.coinIds.includes(coin.id));
  const onStar = () => (lists.length ? requireAuth(t("Sign in to save {name} to a watchlist", { name: coin.name }), () => setListsOpen(true)) : toggleWatch(coin));
  const dir = direction(coin.change24h);

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const copyContract = async () => {
    if (!(await copyText(research.contract))) {
      showToast(t("Couldn't copy. Select the address and copy it manually."));
      return;
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const onShare = async () => {
    const result = await shareCard({
      fileName: `cpa-${coin.symbol.toLowerCase()}`,
      title: `${coin.name} · ${coin.symbol}`,
      headline: formatPrice(coin.price, currency, rate),
      detail: t("{change} in 24h", { change: formatPercent(coin.change24h) }),
      detailTone: coin.change24h >= 0 ? "up" : "down",
    });
    if (result === "downloaded") showToast(t("Share card for {symbol} downloaded", { symbol: coin.symbol }));
    if (result === "failed") showToast(t("Couldn't create the share card in this browser. Copy the page link instead."));
  };

  const panel = { coin, research, currency, rate };

  return (
    <article className="coin-detail">
      <div className="detail-toolbar">
        <button className="link-button back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/market"))}>
          <Icon name="chevron" className="icon flip" /> {t("Back")}
        </button>
        <button className="button-secondary compact" onClick={onShare}>
          <Icon name="share" /> {t("Share")}
        </button>
      </div>

      <header className="detail-header">
        <CoinLogo coin={coin} size="lg" />
        <div className="detail-title">
          <h1>
            {coin.name} <span className="ticker">{coin.symbol}</span>
          </h1>
          <p className="detail-meta">
            {research.verified && (
              <span className="verified">
                <Icon name="check" /> {t("Verified")}
              </span>
            )}
            <span className="num">#{coin.rank}</span>
            {coin.formerSymbols?.length > 0 && <span>{t("Formerly {symbols}", { symbols: coin.formerSymbols.join(", ") })}</span>}
          </p>
        </div>
      </header>

      <p className="detail-price num">
        <strong>{formatPrice(coin.price, currency, rate)}</strong>
        <span className={`change-pill ${dir}`}>
          {arrow(coin.change24h)} {formatPercent(coin.change24h)} <span className="visually-hidden">{t("in")}</span>24h
        </span>
      </p>

      <div className="detail-tags">
        {research.contract ? (
          <span className="contract">
            <span className="mono" title={research.contract}>{shortContract(research.contract)}</span>
            <button className="link-button" onClick={copyContract} aria-label={t("Copy contract address")}>
              {copied ? t("Copied") : t("Copy")}
            </button>
          </span>
        ) : (
          <span className="muted-inline">{t("Native coin")}</span>
        )}
        <span className="tag">{t(coin.category)}</span>
      </div>

      <div className="detail-actions">
        <button className={starred ? "button-primary in-watchlist" : "button-primary"} aria-pressed={lists.length ? undefined : starred} aria-haspopup={lists.length ? "dialog" : undefined} onClick={onStar}>
          <Icon name="star" filled={starred} /> {starred ? t("In watchlist") : t("Add to watchlist")}
        </button>
        <button
          className="button-secondary"
          onClick={() => requireAuth(t("Sign in to set a price alert for {name}", { name: coin.name }), () => navigate(`/alerts?new=${coin.id}`))}
        >
          <Icon name="bell" /> {t("Alert")}
        </button>
      </div>

      <div className="detail-tabs filters" role="tablist" aria-label={t("{name} sections", { name: coin.name })}>
        {tabs.map((item) => (
          <button
            key={item.id}
            id={`coin-tab-${item.id}`}
            role="tab"
            aria-selected={tab === item.id}
            aria-controls="coin-panel"
            tabIndex={tab === item.id ? 0 : -1}
            className={tab === item.id ? "filter active" : "filter"}
            onClick={() => setTab(item.id)}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const index = tabs.findIndex((entry) => entry.id === tab);
              const next = tabs[(index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length];
              setTab(next.id);
              document.getElementById(`coin-tab-${next.id}`)?.focus();
            }}
          >
            {t(item.label)}
          </button>
        ))}
      </div>

      <section id="coin-panel" role="tabpanel" aria-labelledby={`coin-tab-${tab}`} className="coin-panel">
        {tab === "overview" && (
          <Overview
            {...panel}
            now={now}
            onMarker={setEventSheet}
            reminders={reminders}
            onRemind={(unlock) =>
              requireAuth(t("Sign in to set a reminder for the {symbol} unlock", { symbol: coin.symbol }), () => setReminderSheet({ ...unlock, kind: "unlock", name: coin.name }))
            }
            vote={voteFor(coin.id)}
            onVote={(choice) => castVote(coin, choice)}
          />
        )}
        {tab === "tokenomics" && <Tokenomics {...panel} />}
        {tab === "funding" && <Funding {...panel} />}
        {tab === "markets" && <Markets {...panel} />}
      </section>

      <p className="disclaimer">
        {t("Not financial advice. Data provided for informational purposes.")}{" "}
        {t("Source: {source} · Last updated {time}", { source: coinSource(coin), time: relativeTime(coin.priceUpdatedAt ?? lastUpdated, now) })}
      </p>

      <Sheet open={Boolean(eventSheet)} onClose={() => setEventSheet(null)} title={eventSheet ? t({ unlock: "Unlock", funding: "Funding round", listing: "Listing" }[eventSheet.kind]) : t("Event")} side="bottom">
        {eventSheet?.kind === "unlock" && (
          <p className="sheet-note num">
            {t("Unlock")} · {formatDate(eventSheet.time)} · {formatTokens(eventSheet.amount)} {coin.symbol} ·{" "}
            {t("{value} at today's price", { value: formatCompact(eventSheet.amount * coin.price, currency, rate) })} ·{" "}
            {t("{pct}% of circ. supply", { pct: formatNumber((eventSheet.amount / research.supply.circulating) * 100, 2) })}
          </p>
        )}
        {eventSheet?.kind === "funding" && (
          <p className="sheet-note num">
            {t(eventSheet.round.type)} · {formatDate(eventSheet.time)} ·{" "}
            {t("{amount} raised · lead {names}", {
              amount: formatCompact(eventSheet.round.amount, currency, rate),
              names: eventSheet.round.leads.map((id) => fundById(id)?.name).join(", "),
            })}
          </p>
        )}
        {eventSheet?.kind === "listing" && <p className="sheet-note">{t("{name} listed on {date}.", { name: coin.name, date: formatDate(eventSheet.time) })}</p>}
      </Sheet>

      <ReminderSheet key={reminderSheet?.id ?? "none"} item={reminderSheet} onClose={() => setReminderSheet(null)} />

      <Sheet open={listsOpen} onClose={() => setListsOpen(false)} title={t("Save to watchlists")} side="bottom">
        <ul className="pick-list" aria-label={t("Watchlists for {name}", { name: coin.name })}>
          {[{ id: "main", name: t("Main"), coinIds: watchlist }, ...lists].map((list) => (
            <li key={list.id}>
              <label className="pick-row">
                <input type="checkbox" checked={list.coinIds.includes(coin.id)} onChange={(event) => setListMembership(coin, list.id, event.target.checked)} />
                <span className="edit-name">
                  <strong>{list.name}</strong>
                  <span className="num">{tn(list.coinIds.length, "{count} coin", "{count} coins")}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        <button className="button-primary" onClick={() => setListsOpen(false)}>{t("Done")}</button>
      </Sheet>
    </article>
  );
}
