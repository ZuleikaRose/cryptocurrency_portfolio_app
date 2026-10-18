import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import Disclosure, { Highlight } from "../components/Disclosure.jsx";
import Icon from "../components/Icon.jsx";
import { searchHelp } from "../data/help.js";
import { isEmail } from "../lib/auth.js";
import { formatDate } from "../lib/format.js";
import { useApp } from "../state/context.js";

const topics = [
  ["account", "Account"],
  ["billing", "Billing"],
  ["data", "Data and prices"],
  ["alerts", "Alerts"],
  ["accessibility", "Accessibility"],
  ["data-removal", "Data removal"],
  ["other", "Other"],
];
const tiles = [
  { to: "/faqs", icon: "info", label: "FAQs" },
  { to: "/report-issue", icon: "close", label: "Report an issue" },
  { to: "/feedback", icon: "star", label: "Feedback" },
  { to: "/accessibility-policy", icon: "accessibility", label: "Accessibility" },
];

// Customer support (17-customer-support.md): help search, tiles, tickets. Data removal for a
// deleted account happens when the user logs in to it (Login → Remove my data, US-P17.2).
export default function Support() {
  const { session, tickets, addTicket } = useApp();
  const [params] = useSearchParams();
  const initialTopic = topics.some(([id]) => id === params.get("topic")) ? params.get("topic") : "account";
  const [query, setQuery] = useState("");
  const [form, setForm] = useState({ topic: initialTopic, email: session.email ?? "", subject: "", message: "" });
  const [errors, setErrors] = useState({});
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const removal = form.topic === "data-removal";
  const results = searchHelp(query);

  useEffect(() => {
    document.title = "Customer support · CPA";
  }, []);

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const validate = () => {
    const found = {};
    if (!isEmail(form.email)) found.email = "Enter a valid email address.";
    if (!form.subject.trim()) found.subject = "Add a subject.";
    else if (form.subject.length > 120) found.subject = "Keep the subject under 120 characters.";
    if (form.message.trim().length < 20) found.message = "Write at least 20 characters so we can help.";
    else if (form.message.length > 2000) found.message = "Keep the message under 2,000 characters.";
    setErrors(found);
    return found;
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setResult(null);
    const found = validate();
    if (Object.keys(found).length) {
      document.getElementById(`support-${Object.keys(found)[0]}`)?.focus();
      return;
    }
    setBusy(true);
    const ticket = await addTicket({ kind: "ticket", topic: form.topic, email: form.email.trim(), subject: form.subject.trim(), message: form.message.trim() });
    setBusy(false);
    if (!ticket) {
      setResult({ ok: false, text: "We couldn't send your ticket. Check your connection and try again." });
      return;
    }
    setResult({ ok: true, text: `Ticket #${ticket.id} received. We usually reply within 2 business days.` });
    setForm((current) => ({ ...current, subject: "", message: "" }));
  };

  const fieldError = (key) =>
    errors[key] && (
      <small id={`support-${key}-error`} className="field-error">
        {errors[key]}
      </small>
    );

  return (
    <div className="info-page support">
      <h1>How can we help?</h1>
      <label className="search-box page">
        <Icon name="search" />
        <span className="visually-hidden">Search help articles</span>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search help articles" />
      </label>
      {query.trim().length >= 2 && (
        <section aria-label="Help results" className="help-results">
          <p className="muted-line" role="status">{results.length ? `${results.length} ${results.length === 1 ? "article" : "articles"}` : "No articles found. Send us a ticket below."}</p>
          {results.slice(0, 6).map((item) => (
            <Disclosure key={item.q} title={<Highlight text={item.q} term={query} />}>
              <p><Highlight text={item.a} term={query} /></p>
              <Link to={item.to} className="link-button">Open in {item.section} <Icon name="chevron" /></Link>
            </Disclosure>
          ))}
        </section>
      )}

      <nav className="discover-grid" aria-label="Help topics">
        {tiles.map((tile) => (
          <Link key={tile.to} to={tile.to} className="card discover-tile">
            <Icon name={tile.icon} />
            <strong>{tile.label}</strong>
          </Link>
        ))}
      </nav>

      <section aria-labelledby="contact-title" className="info-section">
        <h2 id="contact-title">Contact support</h2>
        <form className="tx-form" onSubmit={onSubmit} noValidate>
          {result && (
            <p className={result.ok ? "form-success" : "form-alert"} role={result.ok ? "status" : "alert"}>
              {result.text}
            </p>
          )}
          <label className="form-field">
            <span>Topic</span>
            <select className="input" value={form.topic} onChange={set("topic")}>
              {topics.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
            </select>
          </label>
          {removal && (
            <p className="card info-card">
              <Icon name="info" />
              <span>
                To remove a deleted account's data yourself, <Link to="/login">log in to it</Link> and choose Remove my data. It works for deleted accounts only; delete your account in Settings first. Or send us a ticket below.
              </span>
            </p>
          )}
          <label className="form-field">
            <span>Email</span>
            <input id="support-email" className="input" type="email" autoComplete="email" value={form.email} onChange={set("email")} aria-invalid={Boolean(errors.email) || undefined} aria-describedby={errors.email ? "support-email-error" : undefined} />
            {fieldError("email")}
          </label>
          <label className="form-field">
            <span>Subject</span>
            <input id="support-subject" className="input" maxLength={140} value={form.subject} onChange={set("subject")} aria-invalid={Boolean(errors.subject) || undefined} aria-describedby={errors.subject ? "support-subject-error" : undefined} />
            {fieldError("subject")}
          </label>
          <label className="form-field">
            <span>Message</span>
            <textarea id="support-message" className="input textarea" rows={5} value={form.message} onChange={set("message")} aria-invalid={Boolean(errors.message) || undefined} aria-describedby="support-message-count" />
            <small id="support-message-count" className="num">{form.message.length} / 2,000</small>
            {fieldError("message")}
          </label>
          <button type="submit" className="button-primary" disabled={busy}>{busy ? "Sending…" : "Submit ticket"}</button>
        </form>
      </section>

      <section aria-labelledby="tickets-title" className="info-section">
        <h2 id="tickets-title">Your tickets</h2>
        {tickets.length ? (
          <ul className="ticket-list">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <span className="num">#{ticket.id}</span>
                <span className="ticket-subject">{ticket.subject}</span>
                <span className={ticket.status === "Completed" ? "tag ticket-status done" : "tag ticket-status"}>{ticket.status}</span>
                <small className="num">{formatDate(ticket.date)}</small>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">No tickets yet.</p>
        )}
        {session.kind !== "user" && <p className="muted-line">Tickets you send without an account are listed here for this visit only. We reply by email.</p>}
      </section>

      <p className="status-line">
        <span className="live-dot" aria-hidden="true" /> Status: All systems normal · Sample data feed
      </p>
    </div>
  );
}
