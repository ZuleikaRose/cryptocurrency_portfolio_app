import { useState, type ReactNode } from "react";

type IconName =
  | "bell"
  | "chart"
  | "chevron"
  | "compass"
  | "home"
  | "menu"
  | "search"
  | "star"
  | "swap"
  | "user";

const paths: Record<IconName, ReactNode> = {
  bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
  chart: <><path d="M4 19V9" /><path d="M10 19V5" /><path d="M16 19v-7" /><path d="M22 19H2" /></>,
  chevron: <path d="m9 18 6-6-6-6" />,
  compass: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.1 4.9-4.9 2.1 2.1-4.9 4.9-2.1Z" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
  menu: <><path d="M4 7h16M4 12h16M4 17h16" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
  star: <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />,
  swap: <><path d="m7 7 3-3 3 3M10 4v12" /><path d="m17 17-3 3-3-3M14 20V8" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
};

function Icon({ name, filled = false }: { name: IconName; filled?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className="icon"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

const markets = [
  { symbol: "BTC", name: "Bitcoin", price: "$67,682.43", change: "+2.18%", color: "orange", spark: "4,28 13,20 22,23 31,13 40,17 49,8 58,11 67,4" },
  { symbol: "ETH", name: "Ethereum", price: "$3,825.12", change: "+1.06%", color: "violet", spark: "4,24 13,25 22,17 31,19 40,10 49,14 58,7 67,9" },
  { symbol: "USDT", name: "Tether", price: "$1.00", change: "+0.01%", color: "teal", spark: "4,17 13,15 22,16 31,14 40,15 49,13 58,14 67,12" },
  { symbol: "BNB", name: "BNB", price: "$602.84", change: "-0.52%", color: "yellow", spark: "4,7 13,10 22,8 31,17 40,14 49,22 58,19 67,27" },
];

function Sparkline({ points, down = false }: { points: string; down?: boolean }) {
  return (
    <svg className={down ? "spark spark-down" : "spark"} viewBox="0 0 72 32">
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function App() {
  const [activeFilter, setActiveFilter] = useState("Coins");
  const [activeNav, setActiveNav] = useState("Market");
  const [favorites, setFavorites] = useState<string[]>(["BTC"]);

  const toggleFavorite = (symbol: string) => {
    setFavorites((current) =>
      current.includes(symbol) ? current.filter((item) => item !== symbol) : [...current, symbol],
    );
  };

  return (
    <main className="app-shell">
      <section className="phone">
        <header className="topbar">
          <div className="brand" title="Cryptocurrency Portfolio App">
            <span className="brand-mark">C</span><span>CPA</span>
          </div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Notifications"><Icon name="bell" /></button>
            <button className="icon-button" aria-label="Open menu"><Icon name="menu" /></button>
          </div>
        </header>

        <div className="content">
          <div className="market-heading">
            <div>
              <p className="eyebrow">Global crypto market cap</p>
              <div className="market-value">$2.67T <span>+1.34%</span></div>
            </div>
            <button className="currency">USD <Icon name="chevron" /></button>
          </div>

          <button className="search-field">
            <Icon name="search" /><span>Search coins, exchanges, IDO...</span><kbd>⌘ K</kbd>
          </button>

          <div className="filters" role="tablist" aria-label="Market filters">
            {["Coins", "Watchlist", "Gainers", "New"].map((filter) => (
              <button
                key={filter}
                className={activeFilter === filter ? "filter active" : "filter"}
                onClick={() => setActiveFilter(filter)}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="section-title">
            <div>
              <p>Market pulse</p>
              <span>Updated just now</span>
            </div>
            <button>View all <Icon name="chevron" /></button>
          </div>

          <div className="pulse-grid">
            <article className="pulse-card">
              <div className="pulse-label"><span>Fear & Greed</span><span className="dots">•••</span></div>
              <div className="gauge-row">
                <div className="gauge"><span>72</span></div>
                <div><strong>Greed</strong><small>Yesterday: 69</small></div>
              </div>
            </article>
            <article className="pulse-card">
              <div className="pulse-label"><span>BTC Dominance</span><span className="live-dot" /></div>
              <div className="dominance">52.8% <span>+0.4%</span></div>
              <Sparkline points="2,26 12,22 22,24 32,16 42,17 52,9 62,12 70,4" />
            </article>
          </div>

          <div className="section-title market-list-title">
            <div><p>Top cryptocurrencies</p><span>By market capitalization</span></div>
            <button className="sort-button"><Icon name="swap" /> Rank</button>
          </div>

          <div className="table-head"><span># &nbsp; Name</span><span>Price / 24h</span></div>
          <div className="coin-list">
            {markets.map((coin, index) => {
              const favorite = favorites.includes(coin.symbol);
              const down = coin.change.startsWith("-");
              return (
                <article className="coin-row" key={coin.symbol}>
                  <button
                    aria-label={`${favorite ? "Remove" : "Add"} ${coin.name} ${favorite ? "from" : "to"} watchlist`}
                    className={favorite ? "star-button starred" : "star-button"}
                    onClick={() => toggleFavorite(coin.symbol)}
                  >
                    <Icon name="star" filled={favorite} />
                  </button>
                  <span className="rank">{index + 1}</span>
                  <span className={`coin-logo ${coin.color}`}>{coin.symbol[0]}</span>
                  <div className="coin-name"><strong>{coin.name}</strong><span>{coin.symbol}</span></div>
                  <Sparkline points={coin.spark} down={down} />
                  <div className="coin-price"><strong>{coin.price}</strong><span className={down ? "negative" : ""}>{coin.change}</span></div>
                </article>
              );
            })}
          </div>
          <button className="load-more">View all assets <Icon name="chevron" /></button>
        </div>

        <nav className="bottom-nav" aria-label="Primary navigation">
          {[
            ["Home", "home"],
            ["Market", "chart"],
            ["Explore", "compass"],
            ["Portfolio", "user"],
          ].map(([label, icon]) => (
            <button
              key={label}
              className={activeNav === label ? "nav-item active" : "nav-item"}
              onClick={() => setActiveNav(label)}
            >
              <Icon name={icon as IconName} /><span>{label}</span>
            </button>
          ))}
        </nav>
      </section>
    </main>
  );
}
