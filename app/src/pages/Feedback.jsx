import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/context.js";
import { locale, t } from "../lib/i18n.js";

const areas = ["Market", "Coin detail", "Unlocks", "Fundraising", "Portfolio", "Alerts", "Other"];
const MAX = 1000;

// Feedback (20-feedback.md): 1–5 ease rating (native radios, so arrow keys work), area, text.
export default function Feedback() {
  const { addFeedback } = useApp();
  const [rating, setRating] = useState(null);
  const [area, setArea] = useState("Market");
  const [text, setText] = useState("");
  const [contact, setContact] = useState(false);
  const [error, setError] = useState(null);
  const [sendError, setSendError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = `${t("Send feedback")} · CPA`;
  }, []);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    if (!rating) {
      setError(t("Choose a rating."));
      document.querySelector('input[name="ease"]')?.focus();
      return;
    }
    setBusy(true);
    const ok = await addFeedback({ rating, area, text: text.trim(), contact });
    setBusy(false);
    if (!ok) {
      setSendError(t("We couldn't send your feedback. Check your connection and try again."));
      return;
    }
    setSent(true);
  };

  if (sent) {
    return (
      <div className="info-page">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h1>{t("Thanks for your feedback.")}</h1>
        </div>
        <Link to="/" className="button-primary">{t("Back to Home")}</Link>
      </div>
    );
  }

  return (
    <div className="info-page">
      <Link to="/support" className="link-button back">
        <Icon name="chevron" className="icon flip" /> {t("Support")}
      </Link>
      <h1>{t("Share your feedback")}</h1>
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <fieldset className="field-group rating-group" aria-describedby={error ? "rating-error" : "rating-scale"}>
          <legend>{t("How easy is CPA to use?")}</legend>
          <div className="rating-options">
            {[1, 2, 3, 4, 5].map((value) => (
              <label key={value} className={rating === value ? "rating-option active" : "rating-option"}>
                <input
                  type="radio"
                  name="ease"
                  value={value}
                  checked={rating === value}
                  onChange={() => {
                    setRating(value);
                    setError(null);
                  }}
                  aria-label={`${value}${value === 1 ? t(", very hard") : value === 5 ? t(", very easy") : ""}`}
                />
                <span aria-hidden="true">{value}</span>
              </label>
            ))}
          </div>
          <p id="rating-scale" className="rating-scale" aria-hidden="true"><span>{t("Very hard")}</span><span>{t("Very easy")}</span></p>
          {error && <p id="rating-error" className="field-error" role="alert">{error}</p>}
        </fieldset>
        <label className="form-field">
          <span>{t("What's it about?")}</span>
          <select className="input" value={area} onChange={(event) => setArea(event.target.value)}>
            {areas.map((item) => <option key={item} value={item}>{t(item)}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>{t("Tell us more")}</span>
          <textarea className="input textarea" rows={4} maxLength={MAX} value={text} onChange={(event) => setText(event.target.value)} aria-describedby="feedback-count" />
          <small id="feedback-count" className="num">{text.length} / {MAX.toLocaleString(locale())}</small>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={contact} onChange={(event) => setContact(event.target.checked)} />
          {t("You can contact me about this")}
        </label>
        {sendError && <p className="form-alert" role="alert">{sendError}</p>}
        <button type="submit" className="button-primary" disabled={busy}>{busy ? t("Sending…") : t("Send feedback")}</button>
      </form>
      <Link to="/report-issue" className="link-button">{t("Found a bug instead? Report an issue")} <Icon name="chevron" /></Link>
    </div>
  );
}
