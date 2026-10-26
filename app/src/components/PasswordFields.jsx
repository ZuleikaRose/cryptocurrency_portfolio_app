import { useState } from "react";
import Icon from "./Icon.jsx";
import { t } from "../lib/i18n.js";

// Password input with a show/hide toggle (13-login-signup.md).
export function PasswordInput({ id, value, onChange, autoComplete, invalid, describedBy, inputRef }) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="input-row password-row">
      <input
        id={id}
        ref={inputRef}
        className="input"
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        spellCheck={false}
      />
      <button type="button" className="icon-button small" onClick={() => setVisible(!visible)} aria-label={visible ? t("Hide password") : t("Show password")} aria-pressed={visible}>
        <Icon name={visible ? "eyeOff" : "eye"} />
      </button>
    </span>
  );
}

// Live rule checklist: each item says met / not met in text, not just with ✓ / ✗.
export function PasswordChecklist({ id, checks }) {
  return (
    <ul id={id} className="password-checks" aria-live="polite">
      {checks.map((check) => (
        <li key={check.id} className={check.ok ? "ok" : undefined}>
          <span aria-hidden="true">{check.ok ? "✓" : "✗"}</span> {check.label}
          <span className="visually-hidden">{check.ok ? t(": met") : t(": not met")}</span>
        </li>
      ))}
    </ul>
  );
}
