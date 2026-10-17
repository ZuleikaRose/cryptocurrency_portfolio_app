import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import CoinLogo from "../components/CoinLogo.jsx";
import Icon from "../components/Icon.jsx";
import { SkeletonDetail } from "../components/LoadState.jsx";
import Sheet from "../components/Sheet.jsx";
import { fundById, fundingRounds } from "../data/research.js";
import { direction, formatCompact, formatDate, formatPercent, formatPrice, rateFor } from "../lib/format.js";
import { useFirstLoad } from "../lib/hooks.js";
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

  useEffect(() => {
    if (fund) document.title = `${fund.name} · CPA`;
  }, [fund]);

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
  const followLabel = frequencies.find((item) => item.id === following)?.short;

  const onShare = async () => {
    const result = await shareCard({
      fileName: `cpa-${fund.id}`,
      title: `${fund.name} · Tier ${fund.tier}`,
      headline: `${fund.deals} deals`,
      detail: `${formatCompact(fund.deployed)} deployed · ${fund.deals30d} deals in 30 days`,
    });
    if (result === "downloaded") showToast(`Share card for ${fund.name} downloaded`);
    if (result === "failed") showToast("Couldn't create the share card in this browser.");
  };

  return (
    <div className="fund-profile">
      <div className="detail-toolbar">
        <Link to="/fundraising?view=funds" className="link-button back">
          <Icon name="chevron" className="icon flip" /> Fundraising
        </Link>
        <button className="button-secondary compact" onClick={onShare}>
          <Icon name="share" /> Share
        </button>
      </div>

      <header className="detail-header">
        <span className="square-logo large" aria-hidden="true">{fund.name[0]}</span>
        <div className="detail-title">
          <h1>{fund.name}</h1>
          <p className="detail-meta">
            Tier {fund.tier} · {fund.type} · Est. {fund.founded}
          </p>
        </div>
      </header>

      <button
        className={following ? "button-primary in-watchlist" : "button-primary"}
        aria-haspopup="dialog"
        onClick={() => requireAuth(`Sign in to follow ${fund.name}`, () => setMenuOpen(true))}
      >
        {following ? `✓ Following · ${followLabel}` : "Follow"}
      </button>

      <dl className="stat-tiles">
        <div><dd className="num">{fund.deals}</dd><dt>deals</dt></div>
        <div><dd className="num">{fund.deals30d}</dd><dt>last 30d</dt></div>
        <div><dd className="num">{formatCompact(fund.deployed, settings.currency, rate)}</dd><dt>deployed</dt></div>
      </dl>

      <section aria-labelledby="sectors-title">
        <h2 id="sectors-title" className="subsection-title">Top sectors</h2>
        <ul className="bar-list">
          {fund.sectors.map(([sector, pct]) => (
            <li key={sector}>
              <span>{sector}</span>
              <span className="bar" aria-hidden="true">
                <span style={{ width: `${pct}%` }} />
              </span>
              <span className="num">{pct}%</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="deals-title">
        <h2 id="deals-title" className="subsection-title">Recent deals</h2>
        {deals.length ? (
          <ul className="deal-list">
            {deals.slice(0, 8).map((round) => (
              <li key={round.id}>
                <span className="square-logo small" aria-hidden="true">{round.project[0]}</span>
                <span className="deal-main">
                  {round.coinId ? <Link to={`/coins/${round.coinId}?tab=funding`}>{round.project}</Link> : <strong>{round.project}</strong>}
                  <span className="muted-inline num">
                    {round.type} · {formatDate(round.date)}
                  </span>
                </span>
                <span className="deal-side">
                  <span className="num">{formatCompact(round.amount, settings.currency, rate)}</span>
                  {round.leads.includes(fund.id) && <span className="tag lead-tag">Lead</span>}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">No deals on record in the sample data.</p>
        )}
      </section>

      <section aria-labelledby="portfolio-title">
        <h2 id="portfolio-title" className="subsection-title">Portfolio tokens</h2>
        {portfolio.length ? (
          <ul className="token-chips">
            {portfolio.map((coin) => (
              <li key={coin.id}>
                <Link to={`/coins/${coin.id}`} className="token-chip">
                  <CoinLogo coin={coin} />
                  <strong>{coin.symbol}</strong>
                  <span className="num">{formatPrice(coin.price, settings.currency, rate)}</span>
                  <span className={`num ${direction(coin.change24h)}`}>
                    {direction(coin.change24h) === "up" ? "▲" : "▼"} {formatPercent(coin.change24h)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">None of this fund's deals have a listed token yet.</p>
        )}
      </section>

      <section aria-labelledby="co-title">
        <h2 id="co-title" className="subsection-title">Frequent co-investors</h2>
        {coInvestors.length ? (
          <ul className="result-list">
            {coInvestors.map(([id, count]) => (
              <li key={id}>
                <Link to={`/funds/${id}`} className="search-option">
                  <span className="square-logo" aria-hidden="true">{fundById(id)?.name[0]}</span>
                  <span className="result-main">
                    <strong>{fundById(id)?.name}</strong>
                    <span className="num">{count} shared {count === 1 ? "deal" : "deals"}</span>
                  </span>
                  <Icon name="chevron" />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">No shared deals in the sample data.</p>
        )}
      </section>

      <p className="disclaimer">Not financial advice. Data provided for informational purposes. Fund data is CPA sample data.</p>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={`Follow ${fund.name}`} side="bottom">
        <fieldset className="field-group">
          <legend>How often should CPA tell you about new deals?</legend>
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
              {item.label}
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
            Unfollow
          </button>
        )}
      </Sheet>
    </div>
  );
}
