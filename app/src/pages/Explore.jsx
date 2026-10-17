import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { categories, marketPulse } from "../data/coins.js";
import { exchanges, saleStatus, tokenSales } from "../data/directory.js";
import { promoStatus, promotions } from "../data/promotions.js";
import { funds } from "../data/research.js";
import { direction, formatCompact, formatPercent, rateFor } from "../lib/format.js";
import { useApp, useMarket } from "../state/context.js";

// Category accents (style guide §3.3); others fall back to the brand accent.
const categoryColors = { AI: "var(--cat-ai)", DeFi: "var(--cat-defi)", "Layer 1": "var(--cat-layer)", "Layer 2": "var(--cat-layer)", RWA: "var(--cat-sales)", Gaming: "var(--cat-fundraising)" };
const fearGreedWeek = [61, 64, 58, 66, 69, 69, 72];

export default function Explore() {
  const { settings, openSearch, requireAuth } = useApp();
  const { coins } = useMarket();
  const navigate = useNavigate();
  const location = useLocation();
  const rate = rateFor(settings.currency, coins);

  useEffect(() => {
    document.title = "Explore · CPA";
  }, []);

  // Land on #market-pulse when coming from Market's "View all".
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const tiles = categories
    .map((category) => {
      const members = coins.filter((coin) => coin.category === category);
      const cap = members.reduce((sum, coin) => sum + coin.marketCap, 0);
      const change = cap ? members.reduce((sum, coin) => sum + coin.change24h * coin.marketCap, 0) / cap : 0;
      return { category, cap, change, count: members.length };
    })
    .sort((a, b) => b.cap - a.cap);
  const topGainer = [...coins].filter((coin) => coin.volume24h >= 100_000).sort((a, b) => b.change24h - a.change24h)[0];
  const upcomingSales = tokenSales.filter((sale) => saleStatus(sale) === "upcoming").length;
  const eth = coins.find((coin) => coin.id === "ethereum");
  const btc = coins.find((coin) => coin.id === "bitcoin");
  const mcapVsFdv = coins.find((coin) => coin.id === "orbit-l2");

  const activePromos = promotions.filter((promo) => promoStatus(promo) === "active").length;
  const learn = [
    {
      title: "What is a token unlock?",
      body: "Many projects release tokens to their team, investors and community on a schedule. On an unlock date, new tokens can start trading, which adds supply. CPA highlights unlocks above 2% of circulating supply because they're the ones most likely to matter.",
    },
    {
      title: "Market cap vs FDV",
      body: `Market cap is price × the tokens trading today; FDV is price × every token that will ever exist. For example, Orbit L2's market cap is ${formatCompact(mcapVsFdv?.marketCap, settings.currency, rate)} but its FDV is ${formatCompact(mcapVsFdv?.fdv, settings.currency, rate)}, because most of its supply is still locked.`,
    },
    {
      title: "How to read a vesting chart",
      body: "Each coloured band is a group (team, investors, ecosystem) and how many of its tokens have unlocked over time. Steep steps mean large unlocks; the dashed Today line shows where the schedule stands now.",
    },
    {
      title: "Why prices are signed with ▲ and ▼",
      body: "Colour alone can't be relied on, so every change in CPA also carries an arrow and a + or − sign. You can swap the up/down colours, or use a colour-blind safe pair, in Settings.",
    },
  ];

  const more = [
    { to: "/promotions", icon: "star", label: "Promotions", meta: `${activePromos} active` },
    { to: "/affiliate", icon: "user", label: "Affiliate program" },
    { to: "/ai", icon: "compass", label: "AI features" },
    { to: "/support", icon: "info", label: "Customer support · FAQs" },
    { to: "/settings", icon: "menu", label: "Account settings", needsAccount: true },
  ];

  return (
    <div className="explore">
      <h1>Explore</h1>
      <button className="search-field" onClick={() => openSearch()}>
        <Icon name="search" />
        <span>Search coins, exchanges, IDO…</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>

      <section aria-labelledby="categories-title">
        <div className="section-title">
          <h2 id="categories-title">Categories</h2>
          <Link to="/market" className="link-button">
            See all <Icon name="chevron" />
          </Link>
        </div>
        <ul className="category-carousel" tabIndex={0} aria-label="Categories (scrolls sideways)">
          {tiles.map((tile) => (
            <li key={tile.category}>
              <Link to={`/market?category=${encodeURIComponent(tile.category)}`} className="category-tile" style={{ "--cat": categoryColors[tile.category] ?? "var(--accent)" }}>
                <strong>{tile.category}</strong>
                <span className="num">{formatCompact(tile.cap, settings.currency, rate)}</span>
                <span className={`num ${direction(tile.change)}`}>
                  {direction(tile.change) === "up" ? "▲" : "▼"} {formatPercent(tile.change)}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section id="market-pulse" aria-labelledby="pulse-title" className="pulse-detail">
        <h2 id="pulse-title" className="subsection-title">Market pulse</h2>
        <div className="card">
          <div className="pulse-row">
            <span>Fear & Greed</span>
            <strong className="num">{marketPulse.fearGreed} · Greed</strong>
          </div>
          <div className="mini-bars" role="img" aria-label={`Fear and Greed over the last 7 days: ${fearGreedWeek.join(", ")}`}>
            {fearGreedWeek.map((value, index) => (
              <span key={index} style={{ height: `${value}%` }} title={`${value}`} />
            ))}
          </div>
          <div className="pulse-row">
            <span>BTC dominance</span>
            <strong className="num">{marketPulse.btcDominance}%</strong>
          </div>
          <div className="pulse-row">
            <span>ETH gas</span>
            <strong className="num">14 gwei</strong>
          </div>
          <div className="pulse-row">
            <span>Altcoin season index</span>
            <strong className="num">41 / 100</strong>
          </div>
          <p className="muted-line num">
            BTC {formatPercent(btc?.change24h)} · ETH {formatPercent(eth?.change24h)} in 24h. Sample data.
          </p>
        </div>
      </section>

      <section aria-labelledby="discover-title">
        <h2 id="discover-title" className="subsection-title">Discover</h2>
        <div className="discover-grid">
          <Link to="/token-sales" className="card discover-tile">
            <Icon name="calendarLock" />
            <strong>Token sales</strong>
            <span className="num">{upcomingSales} upcoming</span>
          </Link>
          <Link to="/fundraising?view=funds" className="card discover-tile">
            <Icon name="coins" />
            <strong>Funds & investors</strong>
            <span className="num">{funds.length} tracked</span>
          </Link>
          <Link to="/search?q=exchange&type=exchanges" className="card discover-tile">
            <Icon name="swap" />
            <strong>Exchanges</strong>
            <span className="num">{exchanges.length} tracked</span>
          </Link>
          <Link to="/market?view=gainers" className="card discover-tile">
            <Icon name="star" />
            <strong>Top gainers</strong>
            <span className="num">
              {topGainer?.symbol} {formatPercent(topGainer?.change24h)}
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="learn-title">
        <h2 id="learn-title" className="subsection-title">Learn</h2>
        <div className="accordion">
          {learn.map((item) => (
            <details key={item.title}>
              <summary>
                <Icon name="info" /> {item.title}
              </summary>
              <p>{item.body}</p>
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="more-title">
        <h2 id="more-title" className="subsection-title">More from CPA</h2>
        <ul className="result-list">
          {more.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="search-option"
                onClick={(event) => {
                  if (!item.needsAccount) return;
                  event.preventDefault();
                  requireAuth("Sign in to manage your account", () => navigate(item.to));
                }}
              >
                <Icon name={item.icon} />
                <span className="result-main">
                  <strong>{item.label}</strong>
                  {item.meta && <span>{item.meta}</span>}
                </span>
                <Icon name="chevron" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
