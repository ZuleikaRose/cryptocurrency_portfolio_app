import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { useApp } from "../state/context.js";

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
  const [sent, setSent] = useState(false);

  useEffect(() => {
    document.title = "Send feedback · CPA";
  }, []);

  const onSubmit = (event) => {
    event.preventDefault();
    if (!rating) {
      setError("Choose a rating.");
      document.querySelector('input[name="ease"]')?.focus();
      return;
    }
    addFeedback({ rating, area, text: text.trim(), contact });
    setSent(true);
  };

  if (sent) {
    return (
      <div className="info-page">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h1>Thanks for your feedback.</h1>
        </div>
        <Link to="/" className="button-primary">Back to Home</Link>
      </div>
    );
  }

  return (
    <div className="info-page">
      <Link to="/support" className="link-button back">
        <Icon name="chevron" className="icon flip" /> Support
      </Link>
      <h1>Share your feedback</h1>
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <fieldset className="field-group rating-group" aria-describedby={error ? "rating-error" : "rating-scale"}>
          <legend>How easy is CPA to use?</legend>
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
                  aria-label={`${value}${value === 1 ? ", very hard" : value === 5 ? ", very easy" : ""}`}
                />
                <span aria-hidden="true">{value}</span>
              </label>
            ))}
          </div>
          <p id="rating-scale" className="rating-scale" aria-hidden="true"><span>Very hard</span><span>Very easy</span></p>
          {error && <p id="rating-error" className="field-error" role="alert">{error}</p>}
        </fieldset>
        <label className="form-field">
          <span>What's it about?</span>
          <select className="input" value={area} onChange={(event) => setArea(event.target.value)}>
            {areas.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="form-field">
          <span>Tell us more</span>
          <textarea className="input textarea" rows={4} maxLength={MAX} value={text} onChange={(event) => setText(event.target.value)} aria-describedby="feedback-count" />
          <small id="feedback-count" className="num">{text.length} / {MAX.toLocaleString("en-US")}</small>
        </label>
        <label className="check-row">
          <input type="checkbox" checked={contact} onChange={(event) => setContact(event.target.checked)} />
          You can contact me about this
        </label>
        <button type="submit" className="button-primary">Send feedback</button>
      </form>
      <Link to="/report-issue" className="link-button">Found a bug instead? Report an issue <Icon name="chevron" /></Link>
    </div>
  );
}
