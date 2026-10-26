import { useEffect, useRef } from "react";
import { Link, useLocation } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { funds } from "../data/research.js";
import { t } from "../lib/i18n.js";
import { useApp, useMarket } from "../state/context.js";
import { usePageTitle } from "../lib/hooks.js";

const squash = (text) => text.toLowerCase().replace(/[^a-z0-9]/g, "");

// Edit distance, for "Did you mean" on a mistyped coin or fund slug.
function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, diagonal + (a[i - 1] === b[j - 1] ? 0 : 1));
      diagonal = above;
    }
  }
  return row[b.length];
}

// Closest coin or fund to the slug in /coins/:slug or /funds/:slug, if it's near enough.
function suggestionFor(pathname, coins) {
  const [, section, slug] = pathname.split("/");
  if (!slug) return null;
  const target = squash(decodeURIComponent(slug));
  const candidates =
    section === "coins"
      ? coins.map((coin) => ({ to: `/coins/${coin.id}`, label: `${coin.name} (${coin.symbol})`, keys: [coin.id, coin.name, coin.symbol] }))
      : section === "funds"
        ? funds.map((fund) => ({ to: `/funds/${fund.id}`, label: fund.name, keys: [fund.id, fund.name] }))
        : [];
  let best = null;
  for (const candidate of candidates) {
    // A shortened slug ("northstar" for "northstar-capital") counts as a near match.
    const score = Math.min(...candidate.keys.map((key) => (target.length >= 4 && squash(key).startsWith(target) ? 1 : distance(target, squash(key)))));
    if (!best || score < best.score) best = { ...candidate, score };
  }
  return best && best.score <= Math.max(2, Math.floor(target.length / 3)) ? best : null;
}

// Not found (29-not-found.md): unknown route or unknown coin/fund slug.
export default function NotFound() {
  const location = useLocation();
  const { openSearch } = useApp();
  const { coins } = useMarket();
  const heading = useRef(null);
  const suggestion = suggestionFor(location.pathname, coins);
  const lastSegment = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() ?? "").replace(/[-_]+/g, " ");

  usePageTitle(t("Page not found"));
  useEffect(() => {
    heading.current?.focus();
  }, [location.pathname]);

  return (
    <section className="not-found" aria-labelledby="not-found-title">
      <svg className="not-found-art" viewBox="0 0 64 48" aria-hidden="true">
        <path d="M6 42h52M6 42V6" />
        <path d="M10 34l10-8 8 5 9-12" />
        <path d="M41 15l4-3M49 9l5-4" strokeDasharray="2 4" />
      </svg>
      <h1 id="not-found-title" ref={heading} tabIndex={-1}>{t("We couldn't find that page")}</h1>
      <p className="page-sub">{t("The link may be old or mistyped.")}</p>
      <p className="not-found-path mono">{location.pathname}</p>

      <button className="search-field" onClick={() => openSearch("all", lastSegment)}>
        <Icon name="search" />
        <span>{t("Search coins, exchanges, IDO…")}</span>
        <kbd aria-hidden="true">⌘ K</kbd>
      </button>

      {suggestion && (
        <p className="did-you-mean">
          {t("Did you mean:")}{" "}
          <Link to={suggestion.to} className="link-button inline">
            {suggestion.label} <Icon name="chevron" />
          </Link>
        </p>
      )}

      <Link to="/" className="button-primary">{t("Go to Home")}</Link>
      <nav aria-label={t("Popular pages")} className="not-found-links">
        <Link to="/market">{t("Market")}</Link>
        <Link to="/unlocks">{t("Unlocks")}</Link>
        <Link to="/support">{t("Support")}</Link>
      </nav>
      <Link to={`/report-issue?type=bug&from=${encodeURIComponent(location.pathname)}`} className="link-button">
        {t("Report a broken link")} <Icon name="chevron" />
      </Link>
    </section>
  );
}
