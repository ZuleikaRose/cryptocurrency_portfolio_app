import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useApp } from "../state/context.js";

const features = [
  { key: "chartSummaries", app: true, title: "Chart summaries", body: "Plain-text descriptions under charts, for example “1M range $1.02 to $1.31, currently $1.24, up 12.70 percent over the period.” Also an accessibility feature." },
  { key: "explainMetric", title: "Explain this metric", body: "The ⓘ definitions add a sentence with the coin's own numbers filled in." },
  { key: "similarCoins", title: "Similar coins", body: "Suggestions on Coin detail and Home, based on category and coins you viewed." },
  { key: "digestSummary", title: "Weekly digest summary", body: "A one-paragraph recap of your watchlist in the Monday digest notification." },
];

// AI features (25-ai-integration.md). Everything here runs locally from templates and rules;
// no data is sent to an AI service.
export default function AiFeatures() {
  const { settings, updateSettings } = useApp();

  useEffect(() => {
    document.title = "AI features · CPA";
  }, []);

  const value = (feature) => (feature.app ? settings[feature.key] : settings.ai[feature.key]);
  const toggle = (feature, on) => (feature.app ? updateSettings({ [feature.key]: on }) : updateSettings({ ai: { ...settings.ai, [feature.key]: on } }));

  return (
    <div className="info-page">
      <h1>AI features</h1>
      <p className="page-sub">How CPA uses automation to explain data. In this version every summary is built in your browser from templates and rules on the sample data. Nothing leaves your browser.</p>
      {features.map((feature) => (
        <article key={feature.key} className="card ai-card">
          <label className="setting-row switch-row">
            <span className="setting-label">
              <strong>✦ {feature.title}</strong>
            </span>
            <span className="switch">
              <input type="checkbox" checked={value(feature)} onChange={(event) => toggle(feature, event.target.checked)} />
              <span className="switch-track" aria-hidden="true" />
            </span>
          </label>
          <p>{feature.body}</p>
        </article>
      ))}
      <section aria-labelledby="limits-title" className="info-section">
        <h2 id="limits-title">Limits</h2>
        <ul className="plain-list bullets">
          <li>Summaries describe data; they never recommend buying or selling.</li>
          <li>They can be wrong if the data is wrong. CPA's prices are sample data.</li>
          <li>Generated text is labelled “✦ Generated summary” wherever it appears.</li>
          <li>Nothing leaves your browser.</li>
        </ul>
      </section>
      <p className="disclaimer">Not financial advice. <Link to="/privacy">Privacy policy</Link></p>
    </div>
  );
}
