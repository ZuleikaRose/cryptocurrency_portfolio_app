import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";

// Phase 0 stand-in for every route; replaced page by page in later phases.
export default function Placeholder({ page }) {
  const params = useParams();
  const detail = Object.values(params)[0];

  useEffect(() => {
    document.title = `${page.title} · CPA`;
  }, [page.title]);

  return (
    <section className="placeholder" aria-labelledby="page-title">
      <h1 id="page-title">{page.title}</h1>
      {detail && <p className="placeholder-detail mono">{detail}</p>}
      <p className="placeholder-copy">This page is built in phase {page.phase}.</p>
      <p className="placeholder-meta">
        Spec: <code>app_outline/pages/{page.doc}</code>
      </p>
    </section>
  );
}

export function NotFound() {
  useEffect(() => {
    document.title = "Page not found · CPA";
  }, []);

  return (
    <section className="placeholder" aria-labelledby="page-title">
      <h1 id="page-title">Page not found</h1>
      <p className="placeholder-copy">This address doesn't match any page in CPA.</p>
      <Link to="/market" className="button-secondary">Go to the market</Link>
    </section>
  );
}
