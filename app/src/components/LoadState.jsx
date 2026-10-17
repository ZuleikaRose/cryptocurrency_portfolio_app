import { Link, useLocation } from "react-router-dom";

// Loading and error states shared by the list and detail pages (spec "Loading" / "Error" lines).

// Placeholder blocks while a page "loads". Hidden from screen readers; a status line says what's loading.
export function SkeletonCards({ count = 3, label, className = "" }) {
  return (
    <div className={`skeleton-stack ${className}`}>
      <p className="visually-hidden" role="status">Loading {label}…</p>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="skeleton skeleton-card" aria-hidden="true" />
      ))}
    </div>
  );
}

// Skeleton header and chart/tiles block for Coin detail and Fund profile.
export function SkeletonDetail({ label }) {
  return (
    <div className="skeleton-stack">
      <p className="visually-hidden" role="status">Loading {label}…</p>
      <div className="skeleton-detail-head" aria-hidden="true">
        <span className="skeleton skeleton-logo" />
        <span className="skeleton skeleton-text" />
      </div>
      <div className="skeleton skeleton-chart" aria-hidden="true" />
      <div className="skeleton-tiles" aria-hidden="true">
        <span className="skeleton skeleton-tile" />
        <span className="skeleton skeleton-tile" />
        <span className="skeleton skeleton-tile" />
        <span className="skeleton skeleton-tile" />
      </div>
    </div>
  );
}

// Error banner with Retry (pair with useSimulatedError).
export function ErrorBanner({ what, onRetry }) {
  const location = useLocation();
  const from = encodeURIComponent(location.pathname);
  return (
    <div className="banner banner-error" role="alert">
      <span>We couldn't load {what}. Check your connection and try again.</span>
      <span className="banner-actions">
        <button className="button-tertiary" onClick={onRetry}>Retry</button>
        <Link to={`/report-issue?type=data&from=${from}`} className="button-tertiary">Report an issue</Link>
      </span>
    </div>
  );
}
