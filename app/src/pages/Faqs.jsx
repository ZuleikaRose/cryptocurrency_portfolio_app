import { useEffect, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import Disclosure, { Highlight } from "../components/Disclosure.jsx";
import Icon from "../components/Icon.jsx";
import { faqSections, matchesHelp, planTable } from "../data/help.js";
import { t, tn } from "../lib/i18n.js";
import { usePageTitle } from "../lib/hooks.js";

// FAQs (18-faqs.md): four themed sections, search with highlighting, deep links.
export default function Faqs() {
  const location = useLocation();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get("q") ?? "");
  const term = query.trim().toLowerCase();
  const searching = term.length >= 2;

  usePageTitle(t("FAQs"));
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  const sections = faqSections
    .map((section) => ({ ...section, items: searching ? section.items.filter((item) => matchesHelp(item, term)) : section.items }))
    .filter((section) => section.items.length);
  const matches = sections.reduce((sum, section) => sum + section.items.length, 0);

  return (
    <div className="info-page">
      <h1>{t("Frequently asked questions")}</h1>
      <label className="search-box page">
        <Icon name="search" />
        <span className="visually-hidden">{t("Search FAQs")}</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("Search FAQs")} />
      </label>
      <p className="visually-hidden" role="status" aria-live="polite">{searching ? tn(matches, "{count} answer found", "{count} answers found") : ""}</p>
      <nav className="filters" aria-label={t("FAQ sections")}>
        {faqSections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="filter"
            onClick={(event) => {
              event.preventDefault();
              const heading = document.getElementById(section.id);
              heading?.scrollIntoView({ block: "start" });
              heading?.focus({ preventScroll: true });
              window.history.replaceState(null, "", `#${section.id}`);
            }}
          >
            {t(section.title)}
          </a>
        ))}
      </nav>

      {sections.length === 0 ? (
        <div className="empty-state">
          <p>{t("No answers found.")} <Link to="/support">{t("Contact support")}</Link>.</p>
        </div>
      ) : (
        sections.map((section) => (
          <section key={section.id} aria-labelledby={section.id} className="info-section">
            <h2 id={section.id} tabIndex={-1}>{t(section.title)}</h2>
            {section.items.map((item) => (
              <Disclosure key={item.q} title={<Highlight text={t(item.q)} term={query} />} forceOpen={searching}>
                <p><Highlight text={t(item.a)} term={query} /></p>
              </Disclosure>
            ))}
            {section.id === "api-plans" && !searching && (
              <table className="data-table">
                <caption className="visually-hidden">{t("Planned plan limits")}</caption>
                <thead>
                  <tr><th scope="col">{t("Feature")}</th><th scope="col">{t("Free")}</th><th scope="col">{t("Pro")}</th><th scope="col">{t("Team")}</th></tr>
                </thead>
                <tbody>
                  {planTable.map((row) => (
                    <tr key={row.feature}><th scope="row">{t(row.feature)}</th><td>{t(row.free)}</td><td>{t(row.pro)}</td><td>{t(row.team)}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))
      )}

      <div className="card still-stuck">
        <span>{t("Still stuck?")}</span>
        <Link to="/support" className="button-secondary compact">{t("Contact support")}</Link>
      </div>
    </div>
  );
}
