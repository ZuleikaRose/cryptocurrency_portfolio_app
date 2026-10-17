import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Disclosure from "../components/Disclosure.jsx";
import Icon from "../components/Icon.jsx";
import { POINTS_PROMO, promoStatus, promotions } from "../data/promotions.js";
import { copyText } from "../lib/clipboard.js";
import { formatDate } from "../lib/format.js";
import { useApp } from "../state/context.js";

const promoErrors = {
  invalid: "This code isn't valid or has ended.",
  "new-only": "This code is for accounts created in the last 30 days.",
};

// Promotions (21-promotions.md). Plain copy: no countdowns, no "don't miss out".
export default function Promotions() {
  const { session, billing, points, requireAuth, applyPromo, redeemPoints } = useApp();
  const [code, setCode] = useState("");
  const [message, setMessage] = useState(null);
  const [copied, setCopied] = useState(null);
  const active = promotions.filter((promo) => promoStatus(promo) === "active");
  const past = promotions.filter((promo) => promoStatus(promo) === "ended");

  useEffect(() => {
    document.title = "Promotions · CPA";
  }, []);

  // Guests sign in first; the code is applied once they're in (US-P21.2).
  const apply = (value) =>
    requireAuth(`Sign in to apply ${value.trim().toUpperCase()}`, () => {
      const result = applyPromo(value);
      setMessage(result.ok ? { ok: true, text: `${result.promo.code} applied. Your plan in Settings shows the new price.` } : { ok: false, text: promoErrors[result.error] });
    });

  const copy = async (value) => {
    const ok = await copyText(value);
    setCopied(ok ? value : null);
    setMessage(ok ? null : { ok: false, text: `Couldn't copy. The code is ${value}.` });
  };

  return (
    <div className="info-page">
      <h1>Promotions</h1>
      <p className="visually-hidden" role="status" aria-live="polite">{copied ? "Copied" : ""}</p>
      {message && <p className={message.ok ? "form-success" : "form-alert"} role={message.ok ? "status" : "alert"}>{message.text}</p>}
      {billing.promo && <p className="muted-line">Applied to your account: <strong>{billing.promo.code}</strong></p>}

      {active.length === 0 ? (
        <p className="empty-line">No promotions right now. Check back soon.</p>
      ) : (
        active.map((promo) => (
          <article key={promo.code} className="card promo-card">
            <span className="tag tag-active">Active</span>
            <h2>{promo.title}</h2>
            <p className="num">{promo.detail}</p>
            <p className="muted-line num">Ends {formatDate(promo.ends)}</p>
            <div className="promo-code-row">
              <span>Code</span>
              <code className="mono">{promo.code}</code>
              <button className="button-secondary compact" onClick={() => copy(promo.code)}>{copied === promo.code ? "Copied" : "Copy"}</button>
            </div>
            <button className="button-primary" onClick={() => apply(promo.code)}>Apply to my plan</button>
            <Disclosure title="Terms">
              <p>{promo.terms}</p>
            </Disclosure>
          </article>
        ))
      )}

      {session.kind !== "guest" && (
        <article className="card promo-card">
          <h2>{POINTS_PROMO.title}</h2>
          <p className="num">You have {points} points (sample loyalty points). Points have no cash value.</p>
          <button className="button-secondary" disabled={points < POINTS_PROMO.cost} onClick={() => {
            const result = redeemPoints();
            if (result.error) setMessage({ ok: false, text: `You need ${POINTS_PROMO.cost} points.` });
          }}>
            Redeem {POINTS_PROMO.cost} points
          </button>
          <Link to="/faqs#earn" className="link-button">How points work <Icon name="chevron" /></Link>
        </article>
      )}

      <section aria-labelledby="code-title" className="info-section">
        <h2 id="code-title">Have a code?</h2>
        <form
          className="input-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (code.trim()) apply(code);
          }}
        >
          <label className="visually-hidden" htmlFor="promo-code">Promo code</label>
          <input id="promo-code" className="input mono" value={code} onChange={(event) => setCode(event.target.value)} placeholder="Enter promo code" autoCapitalize="characters" />
          <button type="submit" className="button-secondary">Apply</button>
        </form>
      </section>

      <section aria-labelledby="past-title" className="info-section">
        <h2 id="past-title">Past promotions</h2>
        <ul className="plain-list">
          {past.map((promo) => (
            <li key={promo.code} className="num">{promo.title} · Ended {formatDate(promo.ends)}</li>
          ))}
        </ul>
      </section>
    </div>
  );
}
