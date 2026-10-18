import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import CoinRow, { SkeletonRows } from "../components/CoinRow.jsx";
import Icon from "../components/Icon.jsx";
import InvestorStack from "../components/InvestorStack.jsx";
import Onboarding from "../components/Onboarding.jsx";
import ReminderSheet from "../components/ReminderSheet.jsx";
import SimilarCoins from "../components/SimilarCoins.jsx";
import UnlockCard from "../components/UnlockCard.jsx";
import { initialCoins, marketPulse } from "../data/coins.js";
import { saleStatus, tokenSales } from "../data/directory.js";
import { definitions } from "../data/glossary.js";
import { fundingRounds, unlockEvents } from "../data/research.js";
import { direction, formatCompact, formatDate, formatPercent, relativeTime, rateFor, spokenPercent } from "../lib/format.js";
import { TRENDING, useNow } from "../lib/hooks.js";
import { useApp, useMarket } from "../state/context.js";
import { marketCapChange24h } from "../lib/market.js";

const MOVERS_MIN_VOLUME = 100_000;
const initialCapTotal = initialCoins.reduce((sum, coin) => sum + coin.marketCap, 0);
const tips = [
  { title: "What is FDV?", body: definitions.fdv },
  { title: "What is market cap?", body: definitions.marketCap },
  { title: "What are locked tokens?", body: definitions.locked },
  { title: "What is 24h volume?", body: definitions.volume },
];
let hasLoadedOnce = false;

function greeting(session, date) {
  const hour = date.getHours();
  const part = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  if (session.kind === "guest") return "Welcome to CPA";
  if (session.kind === "user" && session.name) return `${part}, ${session.name.split(" ")[0]}`;
  return part;
}

function SectionHead({ id, title, to, onClick }) {
  return (
    <div className="section-title">
      <h2 id={id}>{title}</h2>
      {(to || onClick) && (
        <Link to={to ?? "#"} className="link-button" onClick={onClick} aria-label={`See all: ${title}`}>
          See all <Icon name="chevron" />
        </Link>
      )}
    </div>
  );
}

// Home (01-home.md): market snapshot, watchlist, movers, unlocks, rounds, sales, recently viewed, a tip.
export default function Home() {
  const app = useApp();
  const { session, settings, watchlist, toggleWatch, reminders, recentCoins, interests, requireAuth, updateMarketSettings, openSearch } = app;
  const { coins, lastUpdated, tick, flashes } = useMarket();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [movers, setMovers] = useState("gainers");
  const [tip, setTip] = useState(() => new Date().getDate() % tips.length);
  const [reminderItem, setReminderItem] = useState(null);
  const [loading, setLoading] = useState(!hasLoadedOnce);
  const now = useNow(1000);
  const rate = rateFor(settings.currency, coins);
  const currency = settings.currency;
  const unlocksFailed = params.get("simulate") === "error";
  // After the 5th visit, at most once per 30 days, accounts only (20-feedback.md).
  const feedbackDue = session.kind === "user" && app.visits >= 5 && now - app.feedbackPromptDismissed > 30 * 86_400_000;

  useEffect(() => {
    document.title = "CPA · Cryptocurrency Portfolio App";
    if (hasLoadedOnce) return undefined;
    const id = window.setTimeout(() => {
      hasLoadedOnce = true;
      setLoading(false);
    }, 500);
    return () => window.clearTimeout(id);
  }, []);

  const totalCap = marketPulse.totalMarketCap * (coins.reduce((sum, coin) => sum + coin.marketCap, 0) / initialCapTotal);
  const totalChange = marketCapChange24h(coins);
  const capDir = direction(totalChange);

  // Guests see Trending until they pick coins in onboarding (US-1.3).
  const showTrending = session.kind === "guest" && !interests.coins.length;
  const listCoins = showTrending
    ? TRENDING.map((symbol) => coins.find((coin) => coin.symbol === symbol)).filter(Boolean)
    : watchlist.map((id) => coins.find((coin) => coin.id === id)).filter(Boolean).slice(0, 5);

  const moverList = coins
    .filter((coin) => coin.volume24h >= MOVERS_MIN_VOLUME && (movers === "gainers" ? coin.change24h > 0 : coin.change24h < 0))
    .sort((a, b) => (movers === "gainers" ? b.change24h - a.change24h : a.change24h - b.change24h))
    .slice(0, 6);

  const allUnlocks = useMemo(() => unlockEvents(coins), [coins]);
  const nextUnlocks = allUnlocks.filter((event) => event.date.getTime() > now).sort((a, b) => a.date - b.date).slice(0, 3);

  const sorted = [...fundingRounds].sort((a, b) => b.date - a.date);
  const sectorRounds = interests.sectors.length ? sorted.filter((round) => interests.sectors.includes(round.sector)) : [];
  const rounds = (sectorRounds.length ? sectorRounds : sorted).slice(0, 3);
  const sales = tokenSales.filter((sale) => saleStatus(sale, now) === "upcoming").sort((a, b) => a.start - b.start).slice(0, 2);
  const recent = session.kind === "guest" ? [] : recentCoins.map((id) => coins.find((coin) => coin.id === id)).filter(Boolean);

  const remind = (event) =>
    requireAuth(`Sign in to set a reminder for the ${event.symbol} unlock`, () =>
      setReminderItem({ id: event.id, kind: "unlock", symbol: event.symbol, name: event.coin.name, date: event.date, amount: event.amount }),
    );
  const seeLosers = (event) => {
    event.preventDefault();
    updateMarketSettings({ view: "coins", sort: "change24h", dir: "asc", category: "All" });
    navigate("/market?view=coins");
  };

  return (
    <div className="home">
      {feedbackDue && (
        <aside className="card feedback-prompt" aria-label="Feedback">
          <span>How's CPA working for you?</span>
          <Link to="/feedback" className="button-secondary compact">Share feedback</Link>
          <button className="icon-button small" onClick={app.dismissFeedbackPrompt} aria-label="Dismiss for 30 days">
            <Icon name="close" />
          </button>
        </aside>
      )}

      <header className="home-head">
        <h1>{greeting(session, new Date(now))}</h1>
        <p className="page-sub num">
          {formatDate(now)} · Updated {relativeTime(lastUpdated, now)}
        </p>
      </header>

      <button className="search-field" onClick={() => openSearch()}>
        <Icon name="search" />
        <span>Search coins, exchanges, IDO…</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>

      {loading ? (
        <div className="pulse-grid" aria-hidden="true">
          <div className="pulse-card skeleton" />
          <div className="pulse-card skeleton" />
        </div>
      ) : (
        <div className="pulse-grid">
          <Link to="/market" className="pulse-card home-pulse" aria-label={`Total market cap ${formatCompact(totalCap, currency, rate)}, ${spokenPercent(totalChange)} in 24 hours. 24 hour volume ${formatCompact(marketPulse.totalVolume24h, currency, rate)}. Open market.`}>
            <span className="pulse-label">Market cap</span>
            <strong className="home-figure num">{formatCompact(totalCap, currency, rate)}</strong>
            <span className={`num ${capDir}`}>
              {capDir === "up" ? "▲" : capDir === "down" ? "▼" : ""} {formatPercent(totalChange)}
            </span>
            <small className="num">24h vol {formatCompact(marketPulse.totalVolume24h, currency, rate)}</small>
          </Link>
          <Link to="/explore#market-pulse" className="pulse-card home-pulse" aria-label={`Fear and Greed index ${marketPulse.fearGreed}, Greed. Yesterday ${marketPulse.fearGreedYesterday}. Open market pulse.`}>
            <span className="pulse-label">Fear & Greed</span>
            <div className="gauge-row">
              <div className="gauge" style={{ "--value": `${marketPulse.fearGreed}%` }} aria-hidden="true">
                <span className="num">{marketPulse.fearGreed}</span>
              </div>
              <div>
                <strong>Greed</strong>
                <small className="num">Yesterday: {marketPulse.fearGreedYesterday}</small>
              </div>
            </div>
          </Link>
        </div>
      )}

      <section aria-labelledby="home-watchlist">
        <SectionHead id="home-watchlist" title={showTrending ? "Trending" : "Your watchlist"} to={showTrending ? "/market" : "/watchlist"} />
        {showTrending && <p className="muted-line">Star coins to build your watchlist.</p>}
        {loading ? (
          <SkeletonRows count={4} />
        ) : listCoins.length === 0 ? (
          <div className="empty-state">
            <Icon name="star" className="empty-icon" />
            <p>Add coins to your watchlist to see them here.</p>
            <Link to="/market" className="button-secondary">Browse market</Link>
          </div>
        ) : (
          <div className="coin-list">
            {listCoins.map((coin) => (
              <CoinRow key={coin.id} coin={coin} starred={watchlist.includes(coin.id)} onStar={toggleWatch} currency={currency} rate={rate} flash={flashes[coin.id]} tick={tick} />
            ))}
          </div>
        )}
      </section>

      <section aria-labelledby="home-movers">
        <SectionHead id="home-movers" title="Top movers 24h" to={movers === "gainers" ? "/market?view=gainers" : "/market?view=coins"} onClick={movers === "losers" ? seeLosers : undefined} />
        <div className="segmented segmented-inline" role="group" aria-label="Movers">
          {[
            ["gainers", "Gainers"],
            ["losers", "Losers"],
          ].map(([id, label]) => (
            <button key={id} className={movers === id ? "segment active" : "segment"} aria-pressed={movers === id} onClick={() => setMovers(id)}>
              {label}
            </button>
          ))}
        </div>
        <ul className="mover-carousel" tabIndex={0} aria-label={`Top ${movers} (scrolls sideways)`}>
          {moverList.map((coin) => (
            <li key={coin.id}>
              <Link to={`/coins/${coin.id}`} className="mover-card" aria-label={`${coin.name}, ${spokenPercent(coin.change24h)} in 24 hours`}>
                <CoinLogo coin={coin} />
                <strong>{coin.symbol}</strong>
                <span className={`num ${direction(coin.change24h)}`}>
                  {direction(coin.change24h) === "up" ? "▲" : "▼"} {formatPercent(coin.change24h)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-unlocks">
        <SectionHead id="home-unlocks" title="Next unlocks" to="/unlocks" />
        {unlocksFailed ? (
          <div className="card banner-error" role="alert">
            <span>We couldn't load unlocks.</span>
            <button
              className="link-button"
              onClick={() => {
                const next = new URLSearchParams(params);
                next.delete("simulate");
                setParams(next, { replace: true });
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <ul className="unlock-cards">
            {nextUnlocks.map((event) => (
              <UnlockCard key={event.id} event={event} now={now} currency={currency} rate={rate} reminded={Boolean(reminders[event.id])} onRemind={remind} />
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="home-rounds">
        <SectionHead id="home-rounds" title="Recent funding rounds" to="/fundraising" />
        {sectorRounds.length > 0 && <p className="muted-line">Showing your sectors: {interests.sectors.join(", ")}</p>}
        <ul className="home-rounds">
          {rounds.map((round) => (
            <li key={round.id}>
              <span className="square-logo" aria-hidden="true">{round.project[0]}</span>
              <span className="home-round-main">
                <span className="home-round-line">
                  {round.coinId ? <Link to={`/coins/${round.coinId}?tab=funding`}><strong>{round.project}</strong></Link> : <strong>{round.project}</strong>}
                  <span className="tag tag-fundraising">{round.type}</span>
                </span>
                <span className="home-round-line">
                  <InvestorStack round={round} />
                  <span className="tag">{round.sector}</span>
                </span>
              </span>
              <span className="home-round-side num">
                <strong>{formatCompact(round.amount, currency, rate)}</strong>
                <span>{round.date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="home-sales">
        <SectionHead id="home-sales" title="Upcoming token sales" to="/token-sales" />
        <ul className="result-list">
          {sales.map((sale) => (
            <li key={sale.id}>
              <Link to="/token-sales" className="search-option">
                <span className="square-logo" aria-hidden="true">{sale.name[0]}</span>
                <span className="result-main">
                  <strong>{sale.name}</strong>
                  <span className="num">
                    {sale.type} · {sale.launchpad} · {sale.start.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {recent.length > 0 && (
        <section aria-labelledby="home-recent">
          <h2 id="home-recent" className="subsection-title home-subtitle">Recently viewed</h2>
          <ul className="recent-chips">
            {recent.map((coin) => (
              <li key={coin.id}>
                <Link to={`/coins/${coin.id}`} className="chip">
                  <CoinLogo coin={coin} /> {coin.symbol}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {(recent[0] ?? (session.kind !== "guest" ? listCoins[0] : null)) && (
        <SimilarCoins coin={recent[0] ?? listCoins[0]} title={`Similar to ${(recent[0] ?? listCoins[0]).symbol}`} />
      )}

      <section className="card learn-card" aria-labelledby="home-learn">
        <div className="section-row">
          <h2 id="home-learn" className="subsection-title">
            <Icon name="info" /> {tips[tip].title}
          </h2>
          <button className="link-button" onClick={() => setTip((tip + 1) % tips.length)}>Next tip</button>
        </div>
        <p aria-live="polite">{tips[tip].body}</p>
      </section>

      <p className="disclaimer">Not financial advice. Data provided for informational purposes. Prices, unlocks and rounds are CPA sample data.</p>

      <Onboarding />
      <ReminderSheet key={reminderItem?.id ?? "none"} item={reminderItem} onClose={() => setReminderItem(null)} />
    </div>
  );
}
