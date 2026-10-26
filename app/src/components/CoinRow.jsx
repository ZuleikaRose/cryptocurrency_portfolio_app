import { Link } from "react-router-dom";
import CoinLogo from "./CoinLogo.jsx";
import Icon from "./Icon.jsx";
import Sparkline from "./Sparkline.jsx";
import { direction, formatCompact, formatPercent, formatPrice, spokenPercent, spokenPrice } from "../lib/format.js";
import { t } from "../lib/i18n.js";

// Coin rows shared by Market, Watchlist and Search (wireframe row, style guide §7.1).
export function SkeletonRows({ count }) {
  return Array.from({ length: count }, (_, index) => (
    <div key={index} className="coin-row skeleton-row" aria-hidden="true">
      <span className="skeleton skeleton-dot" />
      <span className="skeleton skeleton-logo" />
      <span className="skeleton skeleton-text" />
      <span className="skeleton skeleton-price" />
    </div>
  ));
}

export default function CoinRow({ coin, starred, onStar, currency, rate, changeKey = "change24h", flash, tick = 0, stale, actions, footer }) {
  const change = coin[changeKey];
  const dir = direction(change);
  const down = coin.change7d < 0;
  const changeLabel = t(changeKey === "change24h" ? "24 hours" : changeKey === "change1h" ? "1 hour" : "7 days");

  return (
    <article className={flash ? `coin-row flash-${flash}-${tick % 2}` : "coin-row"}>
      <button
        className={starred ? "star-button starred" : "star-button"}
        aria-pressed={starred}
        aria-label={t(starred ? "Remove {name} from watchlist" : "Add {name} to watchlist", { name: coin.name })}
        onClick={() => onStar(coin)}
      >
        <Icon name="star" filled={starred} />
      </button>
      <span className="rank num" aria-hidden="true">{coin.rank}</span>
      <CoinLogo coin={coin} />
      <Link
        to={`/coins/${coin.id}`}
        className="coin-name row-link"
        aria-label={t("{name} {symbol}, rank {rank}, price {price}, {change} in {period}", { name: coin.name, symbol: coin.symbol, rank: coin.rank, price: spokenPrice(coin.price, currency, rate), change: spokenPercent(change), period: changeLabel })}
      >
        <strong>{coin.name}</strong>
        <span>{coin.symbol}</span>
      </Link>
      <Sparkline points={coin.spark} down={down} />
      <div className={stale ? "coin-price stale" : "coin-price"} aria-hidden="true">
        <strong className="num">
          {stale && <Icon name="clock" className="icon-inline" />}
          {formatPrice(coin.price, currency, rate)}
        </strong>
        <span className={`num ${dir}`}>{formatPercent(change)}</span>
      </div>
      {actions}
      {footer && <div className="coin-row-footer">{footer}</div>}
    </article>
  );
}

export function ProTable({ rows, watchlist, onStar, currency, rate, market, onSort, flashes, tick, stale }) {
  const columns = [
    { id: "price", label: "Price", sort: "price" },
    { id: "change24h", label: "24h", sort: "change24h" },
    { id: "change7d", label: "7d" },
    { id: "marketCap", label: "MCap", sort: "marketCap" },
    { id: "volume", label: "Volume", sort: "volume" },
    { id: "fdv", label: "FDV" },
  ];

  const header = (label, sortId) => {
    if (!sortId) return t(label);
    const active = market.sort === sortId;
    return (
      <button className={active ? "th-sort active" : "th-sort"} onClick={() => onSort(sortId)}>
        {t(label)}
        {active && <span aria-hidden="true">{market.dir === "desc" ? "▼" : "▲"}</span>}
      </button>
    );
  };

  const ariaSort = (sortId) => (market.sort === sortId ? (market.dir === "desc" ? "descending" : "ascending") : undefined);

  return (
    <div className="table-scroll" tabIndex={0} role="region" aria-label={t("Coins, Pro view (scrolls sideways)")}>
      <table className="pro-table">
        <thead>
          <tr>
            <th scope="col" className="sticky-col" aria-sort={ariaSort("rank")}>{header("# Name", "rank")}</th>
            {columns.map((column) => (
              <th key={column.id} scope="col" aria-sort={ariaSort(column.sort)}>{header(column.label, column.sort)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((coin) => {
            const starred = watchlist.includes(coin.id);
            const flash = flashes[coin.id];
            return (
              <tr key={coin.id} className={flash ? `flash-${flash}-${tick % 2}` : undefined}>
                <th scope="row" className="sticky-col">
                  <div className="pro-name">
                    <button
                      className={starred ? "star-button starred" : "star-button"}
                      aria-pressed={starred}
                      aria-label={t(starred ? "Remove {name} from watchlist" : "Add {name} to watchlist", { name: coin.name })}
                      onClick={() => onStar(coin)}
                    >
                      <Icon name="star" filled={starred} />
                    </button>
                    <span className="rank num">{coin.rank}</span>
                    <Link to={`/coins/${coin.id}`} className="pro-coin">
                      <strong>{coin.symbol}</strong>
                      <span>{coin.name}</span>
                    </Link>
                  </div>
                </th>
                <td data-label={t("Price")} className={stale ? "num stale" : "num"}>{formatPrice(coin.price, currency, rate)}</td>
                <td data-label="24h" className={`num ${direction(coin.change24h)}`}>{formatPercent(coin.change24h)}</td>
                <td data-label="7d" className={`num ${direction(coin.change7d)}`}>{formatPercent(coin.change7d)}</td>
                <td data-label={t("MCap")} className="num">{formatCompact(coin.marketCap, currency, rate)}</td>
                <td data-label={t("Volume")} className="num">{formatCompact(coin.volume24h, currency, rate)}</td>
                <td data-label="FDV" className="num">{formatCompact(coin.fdv, currency, rate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
