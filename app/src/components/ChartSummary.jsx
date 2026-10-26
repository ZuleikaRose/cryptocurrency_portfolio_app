import { useState } from "react";
import Icon from "./Icon.jsx";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";

// Chart text summary (27 US-P27.4, 25 AI features). With "Chart text summaries" on it shows
// under the chart at the chosen size; otherwise it's one tap away.
export default function ChartSummary({ text }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  if (!text) return null;
  const body = (
    <p className="chart-summary">
      <span className="generated-label">✦ {t("Generated summary")}</span> {text}
    </p>
  );
  if (settings.chartSummaries) return body;
  return (
    <>
      <button type="button" className="link-button" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {t("Chart summary")} <Icon name="chevronDown" />
      </button>
      {open && body}
    </>
  );
}
