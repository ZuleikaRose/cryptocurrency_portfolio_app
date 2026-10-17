import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonDetail } from "../components/LoadState.jsx";
import SimilarCoins from "../components/SimilarCoins.jsx";
import InfoTip from "../components/InfoTip.jsx";
import PriceChart from "../components/PriceChart.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import ChartSummary from "../components/ChartSummary.jsx";
import { chartSummary } from "../lib/chart.js";
import Sheet from "../components/Sheet.jsx";
import SupplyBar from "../components/SupplyBar.jsx";
import VestingChart from "../components/VestingChart.jsx";
import { fundById, priceHistory, ranges, researchFor, TODAY } from "../data/research.js";
import {
  direction,
  formatCompact,
  formatCountdown,
  formatDate,
  formatPercent,
  formatPrice,
  formatTokens,
  rateFor,
  relativeTime,
} from "../lib/format.js";
import { useFirstLoad, useNow } from "../lib/hooks.js";
import { shareCard } from "../lib/share.js";
import { useApp, useMarket } from "../state/context.js";
import NotFound from "./NotFound.jsx";

const tabs = [
  { id: "overview", label: "Overview" },
  { id: "tokenomics", label: "Tokenomics" },
  { id: "funding", label: "Funding" },
  { id: "markets", label: "Markets" },
];

const shortAddress = (address) => `${address.slice(0, 6)}…${address.slice(-4)}`;


function Overview({ coin, research, currency, rate, onMarker, onRemind, reminders, vote, onVote, now }) {
  const { settings } = useApp();
  const [rangeId, setRangeId] = useState(() => (ranges.some((item) => item.id === settings.chartRange) ? settings.chartRange : "1M"));
  const [mode, setMode] = useState("line");
  const [showMarkers, setShowMarkers] = useState(true);
  const range = ranges.find((item) => item.id === rangeId);
  // Recomputed when the live price ticks, so the chart ends at today's price.
  const points = useMemo(() => priceHistory(coin, rangeId), [coin, rangeId]);
  const allPoints = useMemo(() => priceHistory(coin, "ALL"), [coin]);
  const athPoint = allPoints.reduce((best, point) => (point.price > best.price ? point : best), allPoints[0]);
  const atlPoint = allPoints.reduce((best, point) => (point.price < best.price ? point : best), allPoints[0]);

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
      <section className="card chart-card" aria-label="Price chart">
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
        <div className="chart-controls">
          <div className="segmented" role="group" aria-label="Chart range">
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
          <div className="segmented" role="group" aria-label="Chart type">
            {[
              ["line", "Line"],
              ["candle", "Candle"],
            ].map(([id, label]) => (
              <button key={id} className={mode === id ? "segment active" : "segment"} aria-pressed={mode === id} onClick={() => setMode(id)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="chart-toggles">
          <label className="switch">
            <input type="checkbox" checked={showMarkers} onChange={(event) => setShowMarkers(event.target.checked)} />
            <span className="switch-track" aria-hidden="true" />
            Event markers
          </label>
        </div>
        {showMarkers && (
          <p className="marker-legend">
            <span className="marker-key marker-unlock">U</span> Unlock <span className="marker-key marker-funding">F</span> Funding{" "}
            <span className="marker-key marker-listing">L</span> Listing
          </p>
        )}
        <ChartSummary text={chartSummary(points, range.label, currency, rate)} />
      </section>

      <dl className="stats">
        <div>
          <dt>Market cap <InfoTip term="marketCap" label="market cap" detail={`${coin.symbol}: ${formatPrice(coin.price, currency, rate)} × ${formatTokens(coin.marketCap / coin.price)} tokens circulating ≈ ${formatCompact(coin.marketCap, currency, rate)}.`} /></dt>
          <dd className="num">{formatCompact(coin.marketCap, currency, rate)}</dd>
        </div>
        <div>
          <dt>FDV <InfoTip term="fdv" label="FDV" detail={`${coin.symbol}'s FDV is ${(coin.fdv / coin.marketCap).toFixed(1)}× its market cap: ${Math.round((coin.marketCap / coin.fdv) * 100)}% of all tokens are circulating today.`} /></dt>
          <dd className="num">{formatCompact(coin.fdv, currency, rate)}</dd>
        </div>
        <div>
          <dt>24h volume <InfoTip term="volume" label="24h volume" detail={`${formatCompact(coin.volume24h, currency, rate)} traded in 24h, ${((coin.volume24h / coin.marketCap) * 100).toFixed(1)}% of ${coin.symbol}'s market cap.`} /></dt>
          <dd className="num">{formatCompact(coin.volume24h, currency, rate)}</dd>
        </div>
        <div>
          <dt>Circulating</dt>
          <dd className="num">{formatTokens(supply.circulating)} {coin.symbol}</dd>
        </div>
        <div>
          <dt>All-time high <InfoTip term="ath" label="all-time high and low" /></dt>
          <dd className="num">
            {formatPrice(athPoint.price, currency, rate)} <small>{formatDate(athPoint.time)}</small>
          </dd>
        </div>
        <div>
          <dt>All-time low</dt>
          <dd className="num">
            {formatPrice(atlPoint.price, currency, rate)} <small>{formatDate(atlPoint.time)}</small>
          </dd>
        </div>
      </dl>

      <SupplyBar supply={supply} symbol={coin.symbol} />

      {nextUnlock ? (
        <section className={`card unlock-card ${(nextUnlock.amount / supply.circulating) * 100 > 2 ? "warning" : ""}`} aria-label="Next unlock">
          <div className="unlock-head">
            <h2 className="subsection-title">Next unlock</h2>
            <span className="num countdown">{formatCountdown(nextUnlock.date.getTime(), now)}</span>
          </div>
          <p className="num">
            {formatTokens(nextUnlock.amount)} {coin.symbol} · {formatCompact(nextUnlock.amount * coin.price, currency, rate)} ·{" "}
            {((nextUnlock.amount / supply.circulating) * 100).toFixed(2)}% of circ. supply
          </p>
          <p className="muted-line">
            {formatDate(nextUnlock.date)} · {nextUnlock.allocations.join(", ")}
          </p>
          <button className={reminders[nextUnlock.id] ? "button-secondary reminder-set" : "button-secondary"} onClick={() => onRemind(nextUnlock)}>
            <Icon name={reminders[nextUnlock.id] ? "check" : "bell"} />
            {reminders[nextUnlock.id] ? "Reminder set" : "Remind me"}
          </button>
        </section>
      ) : (
        <p className="empty-line">No scheduled unlocks.</p>
      )}

      <section className="card sentiment" aria-labelledby="sentiment-title">
        <h2 id="sentiment-title" className="subsection-title">Community sentiment <span className="muted-inline">(not advice)</span></h2>
        <div className="sentiment-bar" role="img" aria-label={`${bullish} percent bullish, ${100 - bullish} percent bearish`}>
          <span className="sentiment-bull" style={{ width: `${bullish}%` }} />
        </div>
        <div className="sentiment-labels num">
          <span className="up">Bullish {bullish}%</span>
          <span className="down">Bearish {100 - bullish}%</span>
        </div>
        <div className="sentiment-actions">
          {["bullish", "bearish"].map((choice) => (
            <button key={choice} className={vote === choice ? "button-secondary selected" : "button-secondary"} aria-pressed={vote === choice} onClick={() => onVote(choice)} disabled={Boolean(vote)}>
              {choice === "bullish" ? "▲ Bullish" : "▼ Bearish"}
            </button>
          ))}
          <span className="muted-line num">{(sentiment.votes + (vote ? 1 : 0)).toLocaleString("en-US")} votes today</span>
        </div>
        {vote && <p className="muted-line">You voted {vote} today. You can vote again tomorrow.</p>}
      </section>

      <section aria-labelledby="about-title">
        <h2 id="about-title" className="subsection-title">About {coin.name}</h2>
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
        <h2 id="vesting-title" className="subsection-title">Vesting schedule</h2>
        {research.vesting ? (
          <VestingChart vesting={research.vesting} events={research.vestingEvents} symbol={coin.symbol} />
        ) : (
          <p className="empty-line">No vesting schedule on record for {coin.name}.</p>
        )}
      </section>
      <section aria-labelledby="next-unlocks-title">
        <h2 id="next-unlocks-title" className="subsection-title">Next {upcoming.length || ""} unlocks</h2>
        {upcoming.length ? (
          <ol className="unlock-list">
            {upcoming.map((unlock) => {
              const share = (unlock.amount / research.supply.circulating) * 100;
              return (
                <li key={unlock.id} className={share > 2 ? "warning" : undefined}>
                  <div>
                    <strong>{formatDate(unlock.date)}</strong>
                    <span>{unlock.allocations.join(", ")}</span>
                  </div>
                  <div className="num">
                    <strong>{formatTokens(unlock.amount)} {coin.symbol}</strong>
                    <span>
                      {formatCompact(unlock.amount * coin.price, currency, rate)} · {share.toFixed(2)}%
                    </span>
                  </div>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="empty-line">No scheduled unlocks.</p>
        )}
      </section>
    </>
  );
}

function Funding({ coin, research, currency, rate }) {
  const rounds = research.rounds;
  if (!rounds.length) return <p className="empty-line">No funding rounds on record for {coin.name}.</p>;
  const total = rounds.reduce((sum, round) => sum + round.amount, 0);
  return (
    <section aria-labelledby="funding-title">
      <h2 id="funding-title" className="subsection-title">
        Total raised <span className="num">{formatCompact(total, currency, rate)}</span> · {rounds.length} rounds
      </h2>
      <ol className="round-list">
        {rounds.map((round) => {
          const roi = round.tokenPrice ? coin.price / round.tokenPrice : null;
          return (
            <li key={round.id} className="card round">
              <div className="round-head">
                <span className="tag tag-fundraising">{round.type}</span>
                <span className="muted-line">{formatDate(round.date)}</span>
                <strong className="num">{formatCompact(round.amount, currency, rate)}</strong>
              </div>
              <p className="num muted-line">Valuation {round.valuation ? formatCompact(round.valuation, currency, rate) : "undisclosed"}</p>
              {roi && (
                <p className="num">
                  Token price {formatPrice(round.tokenPrice, currency, rate)} → {formatPrice(coin.price, currency, rate)}{" "}
                  <span className={direction(roi - 1)}>ROI {roi.toFixed(1)}x</span> <InfoTip term="roi" label="ROI" />
                </p>
              )}
              <p className="investors">
                Lead:{" "}
                {round.leads.map((id) => (
                  <Link key={id} to={`/funds/${id}`} className="inline-link">
                    {fundById(id)?.name}
                  </Link>
                ))}
                {round.investors.length > round.leads.length && <span className="muted-inline"> +{round.investors.length - round.leads.length} more</span>}
              </p>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Markets({ coin, research, currency, rate }) {
  const [sort, setSort] = useState({ key: "volume", dir: "desc" });
  const rows = research.markets
    .map((market) => ({ ...market, price: coin.price * market.priceOffset, volume: coin.volume24h * market.share }))
    .sort((a, b) => {
      const sign = sort.dir === "desc" ? -1 : 1;
      if (sort.key === "exchange") return sign * a.exchange.localeCompare(b.exchange);
      return sign * (a[sort.key] - b[sort.key]);
    });
  const columns = [
    ["exchange", "Exchange"],
    ["price", "Price"],
    ["volume", "24h volume"],
    ["share", "Share"],
  ];
  const onSort = (key) => setSort((current) => ({ key, dir: current.key === key && current.dir === "desc" ? "asc" : "desc" }));

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={`Markets for ${coin.name}`}>
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
              <td className="num">{(row.share * 100).toFixed(1)}%</td>
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
  const { settings, watchlist, toggleWatch, addRecentCoin, requireAuth, voteFor, castVote, reminders, showToast } = app;
  const [eventSheet, setEventSheet] = useState(null);
  const [reminderSheet, setReminderSheet] = useState(null);
  const [copied, setCopied] = useState(false);
  const now = useNow(1000);
  const loading = useFirstLoad(`coin:${slug}`);

  const coin = coins.find((item) => item.id === slug);
  const research = coin ? researchFor(coin) : null;
  const tab = tabs.some((item) => item.id === params.get("tab")) ? params.get("tab") : "overview";

  useEffect(() => {
    if (!coin) return;
    document.title = `${coin.name} (${coin.symbol}) · CPA`;
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
  const starred = watchlist.includes(coin.id);
  const dir = direction(coin.change24h);

  const setTab = (id) => {
    const next = new URLSearchParams(params);
    if (id === "overview") next.delete("tab");
    else next.set("tab", id);
    setParams(next, { replace: true });
  };

  const copyContract = async () => {
    try {
      await navigator.clipboard.writeText(research.contract);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast("Couldn't copy. Select the address and copy it manually.");
    }
  };

  const onShare = async () => {
    const result = await shareCard({
      fileName: `cpa-${coin.symbol.toLowerCase()}`,
      title: `${coin.name} · ${coin.symbol}`,
      headline: formatPrice(coin.price, currency, rate),
      detail: `${formatPercent(coin.change24h)} in 24h`,
      detailTone: coin.change24h >= 0 ? "up" : "down",
    });
    if (result === "downloaded") showToast(`Share card for ${coin.symbol} downloaded`);
    if (result === "failed") showToast("Couldn't create the share card in this browser. Copy the page link instead.");
  };

  const panel = { coin, research, currency, rate };

  return (
    <article className="coin-detail">
      <div className="detail-toolbar">
        <button className="link-button back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/market"))}>
          <Icon name="chevron" className="icon flip" /> Back
        </button>
        <button className="button-secondary compact" onClick={onShare}>
          <Icon name="share" /> Share
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
                <Icon name="check" /> Verified
              </span>
            )}
            <span className="num">#{coin.rank}</span>
          </p>
        </div>
      </header>

      <p className="detail-price num">
        <strong>{formatPrice(coin.price, currency, rate)}</strong>
        <span className={`change-pill ${dir}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : ""} {formatPercent(coin.change24h)} <span className="visually-hidden">in</span>24h
        </span>
      </p>

      <div className="detail-tags">
        {research.contract ? (
          <span className="contract">
            <span className="mono" title={research.contract}>{shortAddress(research.contract)}</span>
            <button className="link-button" onClick={copyContract} aria-label="Copy contract address">
              {copied ? "Copied" : "Copy"}
            </button>
          </span>
        ) : (
          <span className="muted-inline">Native coin</span>
        )}
        <span className="tag">{coin.category}</span>
      </div>

      <div className="detail-actions">
        <button className={starred ? "button-primary in-watchlist" : "button-primary"} aria-pressed={starred} onClick={() => toggleWatch(coin)}>
          <Icon name="star" filled={starred} /> {starred ? "In watchlist" : "Add to watchlist"}
        </button>
        <button
          className="button-secondary"
          onClick={() => requireAuth(`Sign in to set a price alert for ${coin.name}`, () => navigate(`/alerts?new=${coin.id}`))}
        >
          <Icon name="bell" /> Alert
        </button>
      </div>

      <div className="detail-tabs filters" role="tablist" aria-label={`${coin.name} sections`}>
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
            {item.label}
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
              requireAuth(`Sign in to set a reminder for the ${coin.symbol} unlock`, () => setReminderSheet({ ...unlock, kind: "unlock", name: coin.name }))
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
        Not financial advice. Data provided for informational purposes. Source: CPA sample data · Last updated {relativeTime(lastUpdated, now)}
      </p>

      <Sheet open={Boolean(eventSheet)} onClose={() => setEventSheet(null)} title={eventSheet ? `${{ unlock: "Unlock", funding: "Funding round", listing: "Listing" }[eventSheet.kind]}` : "Event"} side="bottom">
        {eventSheet?.kind === "unlock" && (
          <p className="sheet-note num">
            Unlock · {formatDate(eventSheet.time)} · {formatTokens(eventSheet.amount)} {coin.symbol} · {formatCompact(eventSheet.amount * coin.price, currency, rate)} at today's price ·{" "}
            {((eventSheet.amount / research.supply.circulating) * 100).toFixed(2)}% of circ. supply
          </p>
        )}
        {eventSheet?.kind === "funding" && (
          <p className="sheet-note num">
            {eventSheet.round.type} · {formatDate(eventSheet.time)} · {formatCompact(eventSheet.round.amount, currency, rate)} raised · lead{" "}
            {eventSheet.round.leads.map((id) => fundById(id)?.name).join(", ")}
          </p>
        )}
        {eventSheet?.kind === "listing" && <p className="sheet-note">{coin.name} listed on {formatDate(eventSheet.time)}.</p>}
      </Sheet>

      <ReminderSheet key={reminderSheet?.id ?? "none"} item={reminderSheet} onClose={() => setReminderSheet(null)} />
    </article>
  );
}
