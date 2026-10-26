import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonDetail } from "../components/LoadState.jsx";
import Sheet from "../components/Sheet.jsx";
import { fundById, fundingRounds } from "../data/research.js";
import { arrow, direction, formatCompact, formatDate, formatPercent, formatPrice, rateFor } from "../lib/format.js";
import { useFirstLoad, usePageTitle } from "../lib/hooks.js";
import { t, tn } from "../lib/i18n.js";
import { shareCard } from "../lib/share.js";
import { useApp, useMarket } from "../state/context.js";
import NotFound from "./NotFound.jsx";

const frequencies = [
  { id: "instant", label: "Instant", short: "Instant" },
  { id: "daily", label: "Daily digest", short: "Daily" },
  { id: "weekly", label: "Weekly digest", short: "Weekly" },
];

// Fund profile (07-fund-profile.md): stats, sectors, deals, portfolio, co-investors, follow.
export default function FundProfile() {
  const { slug } = useParams();
  const { settings, follows, setFollow, requireAuth, showToast } = useApp();
  const { coins } = useMarket();
  const [menuOpen, setMenuOpen] = useState(false);
  const fund = fundById(slug);
  const loading = useFirstLoad(`fund:${slug}`);

  usePageTitle(fund?.name);

  if (!fund) return <NotFound />;
  if (loading) {
    return (
      <div className="fund-profile">
        <h1 className="visually-hidden">{fund.name}</h1>
        <SkeletonDetail label={fund.name} />
      </div>
    );
  }

  const rate = rateFor(settings.currency, coins);
  const deals = fundingRounds.filter((round) => round.investors.includes(fund.id)).sort((a, b) => b.date - a.date);
  const portfolio = [...new Set(deals.map((round) => round.coinId).filter(Boolean))].map((id) => coins.find((coin) => coin.id === id)).filter(Boolean);
  const coInvestors = Object.entries(
    deals.flatMap((round) => round.investors.filter((id) => id !== fund.id)).reduce((map, id) => ({ ...map, [id]: (map[id] ?? 0) + 1 }), {}),
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const following = follows[fund.id];
  const followLabel = t(frequencies.find((item) => item.id === following)?.short ?? "");

  const onShare = async () => {
    const result = await shareCard({
      fileName: `cpa-${fund.id}`,
      title: `${fund.name} · ${t("Tier {tier}", { tier: fund.tier })}`,
      headline: tn(fund.deals, "{count} deal", "{count} deals"),
      detail: t("{amount} deployed · {count} deals in 30 days", { amount: formatCompact(fund.deployed), count: fund.deals30d }),
    });
    if (result === "downloaded") showToast(t("Share card for {name} downloaded", { name: fund.name }));
    if (result === "failed") showToast(t("Couldn't create the share card in this browser."));
  };

  return (
    <div className="fund-profile">
      <div className="detail-toolbar">
        <Link to="/fundraising?view=funds" className="link-button back">
          <Icon name="chevron" className="icon flip" /> {t("Fundraising")}
        </Link>
        <button className="button-secondary compact" onClick={onShare}>
          <Icon name="share" /> {t("Share")}
        </button>
      </div>

      <header className="detail-header">
        <span className="square-logo large" aria-hidden="true">{fund.name[0]}</span>
        <div className="detail-title">
          <h1>{fund.name}</h1>
          <p className="detail-meta">
            {t("Tier {tier}", { tier: fund.tier })} · {t(fund.type)} · {t("Est. {year}", { year: fund.founded })}
          </p>
        </div>
      </header>

      <button
        className={following ? "button-primary in-watchlist" : "button-primary"}
        aria-haspopup="dialog"
        onClick={() => requireAuth(t("Sign in to follow {name}", { name: fund.name }), () => setMenuOpen(true))}
      >
        {following ? `✓ ${t("Following")} · ${followLabel}` : t("Follow")}
      </button>

      <dl className="stat-tiles">
        <div><dd className="num">{fund.deals}</dd><dt>{t("deals")}</dt></div>
        <div><dd className="num">{fund.deals30d}</dd><dt>{t("last 30d")}</dt></div>
        <div><dd className="num">{formatCompact(fund.deployed, settings.currency, rate)}</dd><dt>{t("deployed")}</dt></div>
      </dl>

      <section aria-labelledby="sectors-title">
        <h2 id="sectors-title" className="subsection-title">{t("Top sectors")}</h2>
        <ul className="bar-list">
          {fund.sectors.map(([sector, pct]) => (
            <li key={sector}>
              <span>{t(sector)}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="num">{pct}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deals-title">
        <h2 id="deals-title" className="subsection-title">{t("Recent deals")}</h2>
        {deals.length ? (
          <ul className="deal-list">
            {deals.slice(0, 8).map((round) => (
              <li key={round.id}>
                <span className="square-logo small" aria-hidden="true">{round.project[0]}</span>
                <span className="deal-main">
                  {round.coinId ? <Link to={`/coins/${round.coinId}?tab=funding`}>{round.project}</Link> : <strong>{round.project}</strong>}
                  <span className="muted-inline num">
                    {t(round.type)} · {formatDate(round.date)}
                  </span>
                </span>
                <span className="deal-side">
                  <span className="num">{formatCompact(round.amount, settings.currency, rate)}</span>
                  {round.leads.includes(fund.id) && <span className="tag lead-tag">{t("Lead")}</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">{t("No deals on record in the sample data.")}</p>
        )}
      </section>

      <section aria-labelledby="portfolio-title">
        <h2 id="portfolio-title" className="subsection-title">{t("Portfolio tokens")}</h2>
        {portfolio.length ? (
          <ul className="token-chips">
            {portfolio.map((coin) => (
              <li key={coin.id}>
                <Link to={`/coins/${coin.id}`} className="token-chip">
                  <CoinLogo coin={coin} />
                  <strong>{coin.symbol}</strong>
                  <span className="num">{formatPrice(coin.price, settings.currency, rate)}</span>
                  <span className={`num ${direction(coin.change24h)}`}>
                    {arrow(coin.change24h)} {formatPercent(coin.change24h)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">{t("None of this fund's deals have a listed token yet.")}</p>
        )}
      </section>

      <section aria-labelledby="co-title">
        <h2 id="co-title" className="subsection-title">{t("Frequent co-investors")}</h2>
        {coInvestors.length ? (
          <ul className="result-list">
            {coInvestors.map(([id, count]) => (
              <li key={id}>
                <Link to={`/funds/${id}`} className="search-option">
                  <span className="square-logo" aria-hidden="true">{fundById(id)?.name[0]}</span>
                  <span className="result-main">
                    <strong>{fundById(id)?.name}</strong>
                    <span className="num">{tn(count, "{count} shared deal", "{count} shared deals")}</span>
                  </span>
                  <Icon name="chevron" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">{t("No shared deals in the sample data.")}</p>
        )}
      </section>

      <p className="disclaimer">{t("Not financial advice. Data provided for informational purposes.")} {t("Fund data is CPA sample data.")}</p>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={t("Follow {name}", { name: fund.name })} side="bottom">
        <fieldset className="field-group">
          <legend>{t("How often should CPA tell you about new deals?")}</legend>
          {frequencies.map((item) => (
            <label key={item.id} className="check-row">
              <input
                type="radio"
                name="frequency"
                checked={following === item.id}
                onChange={() => {
                  setFollow(fund, item.id);
                  setMenuOpen(false);
                }}
              />
              {t(item.label)}
            </label>
          ))}
        </fieldset>
        {following && (
          <button
            className="button-secondary button-block danger-text"
            onClick={() => {
              setFollow(fund, null);
              setMenuOpen(false);
            }}
          >
            {t("Unfollow")}
          </button>
        )}
      </Sheet>
    </div>
  );
}
