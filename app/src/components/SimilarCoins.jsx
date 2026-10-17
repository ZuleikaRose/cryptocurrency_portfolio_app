import { Link } from "react-router-dom";
import CoinLogo from "./CoinLogo.jsx";
import { direction, formatPercent } from "../lib/format.js";
import { similarCoins, similarReason } from "../lib/similar.js";
import { useApp, useMarket } from "../state/context.js";

// Similar coins (25-ai-integration.md); hidden when the AI switch is off.
export default function SimilarCoins({ coin, title = "Similar coins" }) {
  const { settings, recentCoins } = useApp();
  const { coins } = useMarket();
  const list = similarCoins(coin, coins, recentCoins);
  if (!settings.ai.similarCoins || !list.length) return null;
  return (
    <section aria-labelledby="similar-title" className="similar">
      <h2 id="similar-title" className="subsection-title">{title}</h2>
      <p className="muted-line"><span className="generated-label">✦ Generated</span> {similarReason(coin)}</p>
      <ul className="recent-chips">
        {list.map((item) => (
          <li key={item.id}>
            <Link to={`/coins/${item.id}`} className="chip" aria-label={`${item.name}, ${formatPercent(item.change24h)} in 24 hours`}>
              <CoinLogo coin={item} /> {item.symbol}
              <span className={`num ${direction(item.change24h)}`} aria-hidden="true">{formatPercent(item.change24h)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
