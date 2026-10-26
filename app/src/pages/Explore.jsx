import { useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { ErrorBanner } from "../components/LoadState.jsx";
import { categories, marketPulse } from "../data/coins.js";
import { exchanges, saleStatus, tokenSales } from "../data/directory.js";
import { promoStatus, promotions } from "../data/promotions.js";
import { funds } from "../data/research.js";
import { arrow, direction, formatCompact, formatPercent, rateFor } from "../lib/format.js";
import { useFirstLoad, usePageTitle, useSimulatedError } from "../lib/hooks.js";
import { t } from "../lib/i18n.js";
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
  const loading = useFirstLoad("explore");
  const [failed, retry] = useSimulatedError();

  usePageTitle(t("Explore"));

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
      title: t("What is a token unlock?"),
      body: t("Many projects release tokens to their team, investors and community on a schedule. On an unlock date, new tokens can start trading, which adds supply. CPA highlights unlocks above 2% of circulating supply because they're the ones most likely to matter."),
    },
    {
      title: t("Market cap vs FDV"),
      body: t("Market cap is price × the tokens trading today; FDV is price × every token that will ever exist. For example, Orbit L2's market cap is {cap} but its FDV is {fdv}, because most of its supply is still locked.", {
        cap: formatCompact(mcapVsFdv?.marketCap, settings.currency, rate),
        fdv: formatCompact(mcapVsFdv?.fdv, settings.currency, rate),
      }),
    },
    {
      title: t("How to read a vesting chart"),
      body: t("Each coloured band is a group (team, investors, ecosystem) and how many of its tokens have unlocked over time. Steep steps mean large unlocks; the dashed Today line shows where the schedule stands now."),
    },
    {
      title: t("Why prices are signed with ▲ and ▼"),
      body: t("Colour alone can't be relied on, so every change in CPA also carries an arrow and a + or − sign. You can swap the up/down colours, or use a colour-blind safe pair, in Settings."),
    },
  ];

  const more = [
    { to: "/promotions", icon: "star", label: t("Promotions"), meta: t("{count} active", { count: activePromos }) },
    { to: "/affiliate", icon: "user", label: t("Affiliate program") },
    { to: "/ai", icon: "compass", label: t("AI features") },
    { to: "/support", icon: "info", label: `${t("Customer support")} · ${t("FAQs")}` },
    { to: "/settings", icon: "menu", label: t("Account settings"), needsAccount: true },
  ];

  return (
    <div className="explore">
      <h1>{t("Explore")}</h1>
      <button className="search-field" onClick={() => openSearch()}>
        <Icon name="search" />
        <span>{t("Search coins, exchanges, IDO…")}</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>

      <section aria-labelledby="categories-title">
        <div className="section-title">
          <h2 id="categories-title">{t("Categories")}</h2>
          <Link to="/market" className="link-button">
            {t("See all")} <Icon name="chevron" />
          </Link>
        </div>
        {failed ? (
          <ErrorBanner what={t("categories")} onRetry={retry} />
        ) : loading ? (
          <>
            <p className="visually-hidden" role="status">{t("Loading categories…")}</p>
            <ul className="category-carousel" aria-hidden="true">
              {[0, 1, 2, 3].map((index) => <li key={index}><span className="category-tile skeleton" /></li>)}
            </ul>
          </>
        ) : (
          <ul className="category-carousel" tabIndex={0} aria-label={t("Categories (scrolls sideways)")}>
            {tiles.map((tile) => (
              <li key={tile.category}>
                <Link to={`/market?category=${encodeURIComponent(tile.category)}`} className="category-tile" style={{ "--cat": categoryColors[tile.category] ?? "var(--accent)" }}>
                  <strong>{t(tile.category)}</strong>
                  <span className="num">{formatCompact(tile.cap, settings.currency, rate)}</span>
                  <span className={`num ${direction(tile.change)}`}>
                    {arrow(tile.change)} {formatPercent(tile.change)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section id="market-pulse" aria-labelledby="pulse-title" className="pulse-detail">
        <h2 id="pulse-title" className="subsection-title">{t("Market pulse")}</h2>
        <div className="card">
          <div className="pulse-row">
            <span>{t("Fear & Greed")}</span>
            <strong className="num">{marketPulse.fearGreed} · {t("Greed")}</strong>
          </div>
          <div className="mini-bars" role="img" aria-label={t("Fear and Greed over the last 7 days: {values}", { values: fearGreedWeek.join(", ") })}>
            {fearGreedWeek.map((value, index) => (
              <span key={index} style={{ height: `${value}%` }} title={`${value}`} />
            ))}
          </div>
          <div className="pulse-row">
            <span>{t("BTC dominance")}</span>
            <strong className="num">{marketPulse.btcDominance}%</strong>
          </div>
          <div className="pulse-row">
            <span>{t("ETH gas")}</span>
            <strong className="num">14 gwei</strong>
          </div>
          <div className="pulse-row">
            <span>{t("Altcoin season index")}</span>
            <strong className="num">41 / 100</strong>
          </div>
          <p className="muted-line num">
            {t("BTC {btc} · ETH {eth} in 24h. Sample data.", { btc: formatPercent(btc?.change24h), eth: formatPercent(eth?.change24h) })}
          </p>
        </div>
      </section>

      <section aria-labelledby="discover-title">
        <h2 id="discover-title" className="subsection-title">{t("Discover")}</h2>
        <div className="discover-grid">
          <Link to="/token-sales" className="card discover-tile">
            <Icon name="calendarLock" />
            <strong>{t("Token sales")}</strong>
            <span className="num">{t("{count} upcoming", { count: upcomingSales })}</span>
          </Link>
          <Link to="/fundraising?view=funds" className="card discover-tile">
            <Icon name="coins" />
            <strong>{t("Funds & investors")}</strong>
            <span className="num">{t("{count} tracked", { count: funds.length })}</span>
          </Link>
          <Link to="/search?q=exchange&type=exchanges" className="card discover-tile">
            <Icon name="swap" />
            <strong>{t("Exchanges")}</strong>
            <span className="num">{t("{count} tracked", { count: exchanges.length })}</span>
          </Link>
          <Link to="/market?view=gainers" className="card discover-tile">
            <Icon name="star" />
            <strong>{t("Top gainers")}</strong>
            <span className="num">
              {topGainer?.symbol} {formatPercent(topGainer?.change24h)}
            </span>
          </Link>
        </div>
      </section>

      <section aria-labelledby="learn-title">
        <h2 id="learn-title" className="subsection-title">{t("Learn")}</h2>
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
        <h2 id="more-title" className="subsection-title">{t("More from CPA")}</h2>
        <ul className="result-list">
          {more.map((item) => (
            <li key={item.to}>
              <Link
                to={item.to}
                className="search-option"
                onClick={(event) => {
                  if (!item.needsAccount) return;
                  event.preventDefault();
                  requireAuth(t("Sign in to manage your account"), () => navigate(item.to));
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
