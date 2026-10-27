import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Disclosure from "./Disclosure.jsx";
import { formatDate } from "../lib/format.js";
import { t } from "../lib/i18n.js";
import { usePageTitle } from "../lib/hooks.js";

// Long-form document layout (legal and policy pages): date line, optional draft note,
// contents with anchors that move focus to the heading, sections, Back to top.
// Callers pass English titles; they are translated here.
export default function DocPage({ title, dateLabel = "Last updated", date = formatDate("2026-10-17T12:00:00"), draft = false, intro, sections }) {
  const location = useLocation();

  usePageTitle(t(title));
  useEffect(() => {
    if (!location.hash) return;
    const heading = document.getElementById(location.hash.slice(1));
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
  }, [location.hash]);

  const jump = (event, id) => {
    event.preventDefault();
    const heading = document.getElementById(id);
    heading?.scrollIntoView({ block: "start" });
    heading?.focus({ preventScroll: true });
    window.history.replaceState(null, "", `#${id}`);
  };

  return (
    <article className="info-page doc-page">
      <h1 id="doc-top" tabIndex={-1}>{t(title)}</h1>
      <p className="page-sub">{t(dateLabel)} {date}</p>
      {draft && <p className="card draft-note" role="note">{t("Draft: to be reviewed by counsel. This text is a placeholder until a lawyer approves it.")}</p>}
      {intro}
      <nav aria-label={t("Contents")} className="doc-toc">
        <Disclosure title={t("Contents")} defaultOpen>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} onClick={(event) => jump(event, section.id)}>{t(section.title)}</a>
              </li>
            ))}
          </ol>
        </Disclosure>
      </nav>
      {sections.map((section, index) => (
        <section key={section.id} aria-labelledby={section.id} className="info-section">
          <h2 id={section.id} tabIndex={-1}>{index + 1}. {t(section.title)}</h2>
          {section.body}
        </section>
      ))}
      <a href="#doc-top" className="link-button back-to-top" onClick={(event) => jump(event, "doc-top")}>↑ {t("Back to top")}</a>
    </article>
  );
}
