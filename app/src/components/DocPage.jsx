import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Disclosure from "./Disclosure.jsx";

// Long-form document layout (legal and policy pages): date line, optional draft note,
// contents with anchors that move focus to the heading, sections, Back to top.
export default function DocPage({ title, dateLabel = "Last updated", date = "Oct 17, 2026", draft = false, intro, sections }) {
  const location = useLocation();

  useEffect(() => {
    document.title = `${title} · CPA`;
  }, [title]);
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
      <h1 id="doc-top" tabIndex={-1}>{title}</h1>
      <p className="page-sub">{dateLabel} {date}</p>
      {draft && <p className="card draft-note" role="note">Draft: to be reviewed by counsel. This text is a placeholder until a lawyer approves it.</p>}
      {intro}
      <nav aria-label="Contents" className="doc-toc">
        <Disclosure title="Contents" defaultOpen>
          <ol>
            {sections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} onClick={(event) => jump(event, section.id)}>{section.title}</a>
              </li>
            ))}
          </ol>
        </Disclosure>
      </nav>
      {sections.map((section, index) => (
        <section key={section.id} aria-labelledby={section.id} className="info-section">
          <h2 id={section.id} tabIndex={-1}>{index + 1}. {section.title}</h2>
          {section.body}
        </section>
      ))}
      <a href="#doc-top" className="link-button back-to-top" onClick={(event) => jump(event, "doc-top")}>↑ Back to top</a>
    </article>
  );
}
