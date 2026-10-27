import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { safeNext } from "../lib/auth.js";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";
import { usePageTitle } from "../lib/hooks.js";

const types = [
  ["bug", "Bug"],
  ["data", "Wrong data"],
  ["accessibility", "Accessibility"],
  ["other", "Other"],
];
const severities = [
  ["blocking", "Blocks me"],
  ["annoying", "Annoying"],
  ["minor", "Minor"],
];
const MAX_IMAGE = 2 * 1024 * 1024;
const APP_VERSION = "1.0.0";

// Browser + OS from the user agent, for the technical details preview (no personal data).
function describeBrowser() {
  const ua = navigator.userAgent;
  const browser =
    ua.match(/Edg\/(\d+)/) ? `Edge ${ua.match(/Edg\/(\d+)/)[1]}` :
    ua.match(/Firefox\/(\d+)/) ? `Firefox ${ua.match(/Firefox\/(\d+)/)[1]}` :
    ua.match(/Chrome\/(\d+)/) ? `Chrome ${ua.match(/Chrome\/(\d+)/)[1]}` :
    ua.match(/Version\/(\d+).*Safari/) ? `Safari ${ua.match(/Version\/(\d+)/)[1]}` : "Unknown browser";
  const os = /Windows/.test(ua) ? "Windows" : /Android/.test(ua) ? "Android" : /iPhone|iPad/.test(ua) ? "iOS" : /Mac OS X/.test(ua) ? "macOS" : /Linux/.test(ua) ? "Linux" : "Unknown OS";
  return { browser, os };
}

// Report an issue (19-report-issue.md).
export default function ReportIssue() {
  const { session, settings, addTicket, getLastError } = useApp();
  const [params] = useSearchParams();
  const from = params.get("from") ? safeNext(params.get("from")) : "";
  const [form, setForm] = useState({
    type: types.some(([id]) => id === params.get("type")) ? params.get("type") : "bug",
    page: from,
    summary: "",
    steps: "",
    expected: "",
    actual: "",
    assistive: "",
    severity: "annoying",
    technical: true,
    email: session.email ?? "",
  });
  const [image, setImage] = useState(null);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  usePageTitle(t("Report an issue"));

  const { browser, os } = describeBrowser();
  const technical = `${browser} · ${os} · ${window.innerWidth}×${window.innerHeight} · ${document.documentElement.dataset.theme} · app v${APP_VERSION} · text ${settings.a11y.textSize}% · last error: ${getLastError() ?? "none"}`;

  // Screenshot: PNG/JPEG up to 2 MB, read as a data URL for the preview and the saved report.
  const onImage = (event) => {
    const file = event.target.files?.[0];
    setErrors((current) => ({ ...current, image: undefined }));
    if (!file) return setImage(null);
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      setErrors((current) => ({ ...current, image: t("Choose a PNG or JPEG image.") }));
      event.target.value = "";
      return setImage(null);
    }
    if (file.size > MAX_IMAGE) {
      setErrors((current) => ({ ...current, image: t("Choose an image under 2 MB.") }));
      event.target.value = "";
      return setImage(null);
    }
    const reader = new FileReader();
    reader.onload = () => setImage({ name: file.name, url: reader.result });
    reader.onerror = () => setErrors((current) => ({ ...current, image: t("Couldn't read that image. Try another file.") }));
    reader.readAsDataURL(file);
    return undefined;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = {};
    if (!form.summary.trim()) found.summary = t("Add a short summary.");
    else if (form.summary.length > 120) found.summary = t("Keep the summary under 120 characters.");
    if (errors.image) found.image = errors.image;
    setErrors(found);
    if (Object.keys(found).length) {
      document.getElementById(`report-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    setSendError(null);
    const ticket = await addTicket({
      kind: "issue",
      topic: form.type,
      subject: form.summary.trim(),
      page: form.page,
      steps: form.steps,
      expected: form.expected,
      actual: form.actual,
      assistive: form.type === "accessibility" ? form.assistive : undefined,
      severity: form.severity,
      technical: form.technical ? technical.slice(0, 1000) : undefined,
      screenshot: image?.url,
      email: form.email.trim() || undefined,
    });
    setBusy(false);
    if (!ticket) {
      setSendError(t("We couldn't send your report. Check your connection and try again."));
      return;
    }
    setSaved(ticket);
  };

  if (saved) {
    return (
      <div className="info-page">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h1>{t("Thanks. Report #{id} saved.", { id: saved.id })}</h1>
        </div>
        <p className="page-sub">{t("We'll look into it. You can follow it under Support → Your tickets.")}</p>
        {from ? <Link to={from} className="button-primary">{t("Back to page")}</Link> : <Link to="/support" className="button-primary">{t("Back to support")}</Link>}
      </div>
    );
  }

  return (
    <div className="info-page">
      <Link to="/support" className="link-button back">
        <Icon name="chevron" className="icon flip" /> {t("Support")}
      </Link>
      <h1>{t("Report an issue")}</h1>
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <fieldset className="field-group">
          <legend>{t("What went wrong?")}</legend>
          <div className="segmented wrap" role="group" aria-label={t("Issue type")}>
            {types.map(([id, label]) => (
              <button key={id} type="button" className={form.type === id ? "segment active" : "segment"} aria-pressed={form.type === id} onClick={() => setForm({ ...form, type: id })}>
                {t(label)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="form-field">
          <span>{t("Page")}</span>
          <input className="input mono" maxLength={200} value={form.page} onChange={set("page")} placeholder="/coins/bitcoin" />
        </label>
        <label className="form-field">
          <span>{t("Summary")}</span>
          <input id="report-summary" className="input" maxLength={140} value={form.summary} onChange={set("summary")} aria-invalid={Boolean(errors.summary) || undefined} aria-describedby={errors.summary ? "report-summary-error" : undefined} />
          {errors.summary && <small id="report-summary-error" className="field-error">{errors.summary}</small>}
        </label>
        <label className="form-field">
          <span>{t("Steps to reproduce")}</span>
          <textarea className="input textarea" rows={3} maxLength={2000} value={form.steps} onChange={set("steps")} />
        </label>
        <label className="form-field">
          <span>{t("Expected")}</span>
          <input className="input" maxLength={1000} value={form.expected} onChange={set("expected")} />
        </label>
        <label className="form-field">
          <span>{t("Actual")}</span>
          <input className="input" maxLength={1000} value={form.actual} onChange={set("actual")} />
        </label>
        {form.type === "accessibility" && (
          <label className="form-field">
            <span>{t("Assistive technology used")}</span>
            <input className="input" maxLength={200} value={form.assistive} onChange={set("assistive")} placeholder={t("For example NVDA 2026.1, VoiceOver")} />
          </label>
        )}
        <fieldset className="field-group">
          <legend>{t("Severity")}</legend>
          <div className="segmented wrap" role="group" aria-label={t("Severity")}>
            {severities.map(([id, label]) => (
              <button key={id} type="button" className={form.severity === id ? "segment active" : "segment"} aria-pressed={form.severity === id} onClick={() => setForm({ ...form, severity: id })}>
                {t(label)}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="check-row">
          <input type="checkbox" checked={form.technical} onChange={(event) => setForm({ ...form, technical: event.target.checked })} />
          {t("Include technical details")}
        </label>
        {form.technical && <p className="tech-preview mono">{technical}</p>}
        <label className="form-field">
          <span>{t("Screenshot (PNG or JPEG, up to 2 MB)")}</span>
          <input id="report-image" className="input file-input" type="file" accept="image/png,image/jpeg" onChange={onImage} aria-invalid={Boolean(errors.image) || undefined} aria-describedby={errors.image ? "report-image-error" : undefined} />
          {errors.image && <small id="report-image-error" className="field-error">{errors.image}</small>}
        </label>
        {image && <img className="screenshot-preview" src={image.url} alt={t("Screenshot preview: {name}", { name: image.name })} />}
        <label className="form-field">
          <span>{t("Email (optional)")}</span>
          <input className="input" type="email" maxLength={254} value={form.email} onChange={set("email")} autoComplete="email" />
        </label>
        {sendError && <p className="form-alert" role="alert">{sendError}</p>}
        <button type="submit" className="button-primary" disabled={busy}>{busy ? t("Sending…") : t("Send report")}</button>
      </form>
    </div>
  );
}
