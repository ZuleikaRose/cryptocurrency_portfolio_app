import { useId, useState } from "react";
import Icon from "./Icon.jsx";
import { definitions } from "../data/glossary.js";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";

// ⓘ definition. With "Explain this metric" on (25-ai-integration.md), `detail` adds a
// generated sentence with this coin's own numbers, labelled as generated.
export default function InfoTip({ term, label, detail }) {
  const { settings } = useApp();
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="infotip">
      <button className="infotip-button" aria-expanded={open} aria-controls={id} aria-label={t("What is {label}?", { label })} onClick={() => setOpen((value) => !value)}>
        <Icon name="info" />
      </button>
      {open && (
        <span id={id} className="infotip-body" role="note">
          {definitions[term] && t(definitions[term])}
          {detail && settings.ai.explainMetric && (
            <span className="infotip-detail">
              <span className="generated-label">{t("✦ Generated summary")}</span> {detail}
            </span>
          )}
        </span>
      )}
    </span>
  );
}
