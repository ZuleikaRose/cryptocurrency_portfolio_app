import { Link } from "react-router-dom";
import CoinLogo from "./CoinLogo.jsx";
import { direction, formatPercent } from "../lib/format.js";
import { t } from "../lib/i18n.js";
import { similarCoins, similarReason } from "../lib/similar.js";
import { useApp, useMarket } from "../state/context.js";

// Similar coins (25-ai-integration.md); hidden when the AI switch is off.
export default function SimilarCoins({ coin, title }) {
  const { settings, recentCoins } = useApp();
  const { coins } = useMarket();
  const list = similarCoins(coin, coins, recentCoins);
  if (!settings.ai.similarCoins || !list.length) return null;
  return (
    <section aria-labelledby="similar-title" className="similar">
      <h2 id="similar-title" className="subsection-title">{title ?? t("Similar coins")}</h2>
      <p className="muted-line"><span className="generated-label">{t("✦ Generated")}</span> {similarReason(coin)}</p>
      <ul className="recent-chips">
        {list.map((item) => (
          <li key={item.id}>
            <Link to={`/coins/${item.id}`} className="chip" aria-label={t("{name}, {change} in 24 hours", { name: item.name, change: formatPercent(item.change24h) })}>
              <CoinLogo coin={item} /> {item.symbol}
              <span className={`num ${direction(item.change24h)}`} aria-hidden="true">{formatPercent(item.change24h)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
