import { useEffect, useId, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PasswordChecklist, PasswordInput } from "../components/PasswordFields.jsx";
import Sheet from "../components/Sheet.jsx";
import { discountedPrice, findPromo } from "../data/promotions.js";
import { ranges } from "../data/research.js";
import { shortcuts } from "../data/shortcuts.js";
import { isEmail, passwordChecks, passwordErrors } from "../lib/auth.js";
import { blocksDeletion, cancel, changeBillingDay, isPaid, pause, planById, plans, resume, subscribe, validateCard } from "../lib/billing.js";
import { downloadText } from "../lib/clipboard.js";
import { currencies, formatDate } from "../lib/format.js";
import { notificationPermission, requestNotifications } from "../lib/notify.js";
import { useApp } from "../state/context.js";

const sections = [
  { id: "profile", label: "Profile" },
  { id: "subscription", label: "Plan" },
  { id: "payment", label: "Payment" },
  { id: "preferences", label: "Preferences" },
  { id: "notifications", label: "Notifications" },
  { id: "privacy", label: "Privacy" },
  { id: "accessibility", label: "Accessibility" },
  { id: "danger-zone", label: "Danger zone" },
];

function Segmented({ label, value, options, onChange }) {
  const id = useId();
  return (
    <div className="setting-row">
      <span className="setting-label" id={id}>{label}</span>
      <div className="segmented wrap" role="group" aria-labelledby={id}>
        {options.map(([id, text]) => (
          <button key={id} type="button" className={value === id ? "segment active" : "segment"} aria-pressed={value === id} onClick={() => onChange(id)}>
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

function Toggle({ label, hint, checked, onChange }) {
  return (
    <label className="setting-row switch-row">
      <span className="setting-label">
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <span className="switch">
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
        <span className="switch-track" aria-hidden="true" />
      </span>
    </label>
  );
}

function SectionHead({ id, title, saved }) {
  return (
    <div className="settings-head">
      <h2 id={`${id}-title`}>{title}</h2>
      <span className="saved-note" aria-live="polite">
        {saved && (
          <>
            <Icon name="check" /> Saved
          </>
        )}
      </span>
    </div>
  );
}

function ChangePasswordSheet({ open, onClose }) {
  const { changePassword, showToast } = useApp();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const checks = passwordChecks(form.next, { differentFrom: form.next.length > 0 && form.next !== form.current });
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  const onSubmit = async (event) => {
    event.preventDefault();
    const found = passwordErrors(passwordChecks(form.next));
    if (form.next && form.next === form.current) found.push("Choose a password different from your current one.");
    if (form.confirm !== form.next || !form.confirm) found.push("Passwords don't match.");
    if (!form.current) found.unshift("Enter your current password.");
    setErrors(found);
    if (found.length) return;
    setBusy(true);
    const result = await changePassword(form.current, form.next);
    setBusy(false);
    if (result.error === "wrong") {
      setErrors(["Current password is incorrect."]);
      return;
    }
    if (result.error) {
      const messages = {
        same: "Choose a password different from your current one.",
        weak: "Choose a stronger password.",
        limited: "Too many attempts. Wait a few minutes and try again.",
      };
      setErrors([messages[result.error] ?? "We couldn't change your password. Check your connection and try again."]);
      return;
    }
    showToast("Password changed");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="Change password" side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        {errors.length > 0 && (
          <ul className="form-alert" role="alert">
            {errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
        <label className="form-field" htmlFor="cp-current"><span>Current password</span></label>
        <PasswordInput id="cp-current" value={form.current} onChange={set("current")} autoComplete="current-password" />
        <label className="form-field" htmlFor="cp-next"><span>New password</span></label>
        <PasswordInput id="cp-next" value={form.next} onChange={set("next")} autoComplete="new-password" describedBy="cp-checks" />
        <PasswordChecklist id="cp-checks" checks={checks} />
        <label className="form-field" htmlFor="cp-confirm"><span>Confirm new password</span></label>
        <PasswordInput id="cp-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
        <button type="submit" className="button-primary" disabled={busy}>{busy ? "Saving…" : "Change password"}</button>
      </form>
    </Sheet>
  );
}

function AddCardSheet({ open, onClose, onAdd }) {
  const [form, setForm] = useState({ name: "", number: "", expiry: "", cvc: "" });
  const [errors, setErrors] = useState({});
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));
  const onSubmit = (event) => {
    event.preventDefault();
    const result = validateCard(form);
    setErrors(result.errors);
    if (result.method) {
      onAdd(result.method);
      onClose();
    }
  };
  const field = (key, label, props) => (
    <label className="form-field">
      <span>{label}</span>
      <input className="input" value={form[key]} onChange={set(key)} aria-invalid={Boolean(errors[key]) || undefined} {...props} />
      {errors[key] && <small className="field-error">{errors[key]}</small>}
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title="Add card" side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <p className="sheet-note">Simulated: only test cards work, for example 4242 4242 4242 4242. CPA keeps the brand, last 4 digits and expiry, never the full number or security code.</p>
        {field("name", "Name on card", { autoComplete: "cc-name" })}
        {field("number", "Card number", { inputMode: "numeric", autoComplete: "cc-number" })}
        <div className="custom-range">
          {field("expiry", "Expiry (MM/YY)", { inputMode: "numeric", autoComplete: "cc-exp", placeholder: "08/28" })}
          {field("cvc", "Security code", { inputMode: "numeric", autoComplete: "cc-csc" })}
        </div>
        <button type="submit" className="button-primary">Add card</button>
      </form>
    </Sheet>
  );
}

function DeleteAccountSheet({ open, onClose, email }) {
  const { deleteAccount } = useApp();
  const navigate = useNavigate();
  const [typed, setTyped] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const matches = typed.trim().toLowerCase() === email;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (!matches || busy) return;
    setBusy(true);
    const result = await deleteAccount(password);
    setBusy(false);
    if (result.error) {
      const messages = {
        wrong: "Password is incorrect.",
        limited: "Too many attempts. Wait a few minutes and try again.",
      };
      setError(messages[result.error] ?? "We couldn't delete the account. Check your connection and try again. Nothing was changed.");
      return;
    }
    // The deleted page ends the session once Settings is gone (its guest redirect would win otherwise).
    navigate("/account-deleted", { replace: true });
  };

  return (
    <Sheet open={open} onClose={onClose} title="Delete your CPA account?" side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <p className="sheet-note">This removes your access to CPA. Your data stays until you remove it: log in again afterwards and choose Remove my data.</p>
        <label className="form-field">
          <span>Type your email to confirm</span>
          <input className="input" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" placeholder={email} />
        </label>
        <label className="form-field" htmlFor="delete-password"><span>Password</span></label>
        <PasswordInput id="delete-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} describedBy="delete-error" />
        {error && <p id="delete-error" className="field-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="button" className="button-secondary" onClick={onClose}>Cancel</button>
          <button type="submit" className="button-primary danger-fill" disabled={!matches || busy} aria-disabled={!matches || busy}>
            {busy ? "Deleting…" : "Delete account"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

// Account settings (16-account-settings.md).
export default function Settings() {
  const app = useApp();
  const { session, settings, updateSettings, updateMarketSettings, billing, setBilling, showToast } = app;
  const location = useLocation();
  const [saved, setSaved] = useState(null);
  const [profile, setProfile] = useState({ name: session.name ?? "", email: session.email ?? "" });
  const [profileError, setProfileError] = useState(null);
  const [sheet, setSheet] = useState(null);
  const [billingDay, setBillingDay] = useState(billing.billingDay ?? 1);
  const [pauseMonths, setPauseMonths] = useState(1);
  const [planTarget, setPlanTarget] = useState(null);
  const [paypal, setPaypal] = useState("");
  const [permission, setPermission] = useState(notificationPermission);
  const [promoCode, setPromoCode] = useState("");
  const [promoError, setPromoError] = useState(null);
  const savedTimer = useRef(null);

  useEffect(() => {
    document.title = "Account settings · CPA";
  }, []);
  useEffect(() => () => window.clearTimeout(savedTimer.current), []);
  // Deep links like /settings#danger-zone.
  useEffect(() => {
    if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView({ block: "start" });
  }, [location.hash]);

  if (session.kind === "guest") return <Navigate to="/login?next=%2Fsettings" replace />;
  const demo = session.kind === "demo";

  // Inline "Saved" next to the section that changed (2 s).
  const markSaved = (section) => {
    setSaved(section);
    window.clearTimeout(savedTimer.current);
    savedTimer.current = window.setTimeout(() => setSaved(null), 2000);
  };
  const setting = (section, patch) => {
    updateSettings(patch);
    markSaved(section);
  };
  const closeSheet = () => setSheet(null);
  const jump = (id) => {
    document.getElementById(id)?.scrollIntoView({ block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  };

  const plan = planById(billing.plan);
  const promo = billing.promo ? findPromo(billing.promo.code) : null;
  const promoPrice = discountedPrice(promo, plan);
  const paid = isPaid(billing);
  const defaultMethod = billing.methods.find((method) => method.default) ?? billing.methods[0];
  let planStatus = "Free plan";
  if (paid && billing.status === "active") planStatus = `Active · next billing date ${formatDate(billing.nextBilling)}`;
  if (paid && billing.status === "paused") planStatus = `Paused until ${formatDate(billing.pausedUntil)}`;
  if (paid && billing.status === "cancelled") planStatus = `Cancels on ${formatDate(billing.cancelsOn)}`;

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) return setProfileError("Enter your name.");
    if (!demo && !isEmail(profile.email)) return setProfileError("Enter a valid email address.");
    const result = await app.updateProfile(demo ? { name: profile.name, email: session.email ?? "" } : profile);
    if (result.error === "exists") return setProfileError("An account with this email already exists.");
    if (result.error) return setProfileError("We couldn't save your profile. Check your connection and try again.");
    setProfileError(null);
    if (result.emailPending) showToast(`Check ${profile.email.trim()} and open the link to confirm your new email.`);
    markSaved("profile");
    return undefined;
  };

  const choosePlan = (planId) => {
    if (planId === billing.plan && billing.status !== "cancelled") return;
    if (planId === "free") {
      if (paid) setSheet("cancel");
      return;
    }
    if (!billing.methods.length) {
      showToast("Add a payment method first.");
      jump("payment");
      return;
    }
    setPlanTarget(planId);
    setSheet("plan");
  };

  const addMethod = (method) => {
    setBilling((current) => ({
      ...current,
      methods: [...current.methods.map((item) => ({ ...item, default: current.methods.length ? item.default : false })), { ...method, id: `pm-${Date.now().toString(36)}`, default: current.methods.length === 0 }],
    }));
    showToast(method.type === "card" ? `${method.brand} •••• ${method.last4} added` : "PayPal added");
    markSaved("payment");
  };
  const removeMethod = (method) => {
    if (paid && billing.status !== "cancelled" && billing.methods.length === 1) {
      showToast("Keep one payment method while your Pro plan is active.");
      return;
    }
    setBilling((current) => {
      const methods = current.methods.filter((item) => item.id !== method.id);
      if (methods.length && !methods.some((item) => item.default)) methods[0] = { ...methods[0], default: true };
      return { ...current, methods };
    });
    markSaved("payment");
  };

  const exportData = () => {
    const profileOut = session.kind === "user"
      ? { name: session.name, email: session.email, createdAt: session.createdAt, plan: billing.plan }
      : { name: session.name };
    const json = JSON.stringify({ exportedAt: new Date().toISOString(), profile: profileOut, data: app.exportData() }, null, 2);
    const ok = downloadText(`cpa-export-${new Date().toISOString().slice(0, 10)}.json`, json, "application/json");
    showToast(ok ? "Export downloaded" : "Couldn't start the download in this browser.");
  };

  return (
    <div className="settings">
      <h1>Account settings</h1>
      <nav className="settings-chips" aria-label="Settings sections">
        {sections.map((section) => (
          <a
            key={section.id}
            href={`#${section.id}`}
            className="chip"
            onClick={(event) => {
              event.preventDefault();
              jump(section.id);
            }}
          >
            {section.label}
          </a>
        ))}
      </nav>

      <section id="profile" aria-labelledby="profile-title" className="settings-section">
        <SectionHead id="profile" title="Profile" saved={saved === "profile"} />
        <form className="tx-form" onSubmit={saveProfile} noValidate>
          {profileError && <p className="form-alert" role="alert">{profileError}</p>}
          <label className="form-field">
            <span>Name</span>
            <input className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" />
          </label>
          <label className="form-field">
            <span>Email</span>
            <input className="input" type="email" value={demo ? "demo@cpa.app" : profile.email} disabled={demo} onChange={(event) => setProfile({ ...profile, email: event.target.value })} autoComplete="email" />
          </label>
          <div className="button-row">
            {demo ? <span className="muted-inline">The demo has no password.</span> : <button type="button" className="button-secondary" onClick={() => setSheet("password")}>Change password</button>}
            <button type="submit" className="button-primary inline-primary">Save</button>
          </div>
        </form>
      </section>

      <section id="subscription" aria-labelledby="subscription-title" className="settings-section">
        <SectionHead id="subscription" title="Subscription & billing" saved={saved === "subscription"} />
        <div className="card plan-card">
          <p className="plan-name">
            <strong>CPA {paid ? "Pro" : "Free"}</strong>
            {paid && promoPrice == null && <span className="num"> · ${plan.price.toFixed(2)}/{plan.period}</span>}
            {paid && promoPrice != null && (
              <span className="num">
                {" · "}<s>${plan.price.toFixed(2)}</s> ${promoPrice.toFixed(2)}/{plan.period}
              </span>
            )}
          </p>
          {promo && (
            <p className="promo-applied num">
              {promo.code} applied
              {promoPrice == null && (promo.plan ? ` · takes effect on ${planById(promo.plan).label}` : " · takes effect on a Pro plan")}
            </p>
          )}
          <p className="muted-line num">{planStatus}</p>
          {paid && (
            <div className="button-row wrap">
              {billing.status === "active" && (
                <>
                  <button className="button-secondary compact" onClick={() => setSheet("day")}>Change billing date</button>
                  <button className="button-secondary compact" onClick={() => setSheet("pause")}>Pause</button>
                  <button className="button-secondary compact danger-text" onClick={() => setSheet("cancel")}>Cancel</button>
                </>
              )}
              {billing.status !== "active" && (
                <button
                  className="button-secondary compact"
                  onClick={() => {
                    setBilling((current) => resume(current));
                    showToast("Subscription resumed");
                    markSaved("subscription");
                  }}
                >
                  Resume
                </button>
              )}
            </div>
          )}
          <Segmented
            label="Switch plan"
            value={billing.status === "cancelled" ? "free" : billing.plan}
            options={plans.map((item) => [item.id, item.price ? `${item.label} $${item.price.toFixed(2)}` : item.label])}
            onChange={choosePlan}
          />
          <p className="muted-line">Simulated billing: no money is charged.</p>
          <form
            className="input-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!promoCode.trim()) return;
              const result = app.applyPromo(promoCode);
              setPromoError(result.ok ? null : result.error === "new-only" ? "This code is for accounts created in the last 30 days." : "This code isn't valid or has ended.");
              if (result.ok) {
                setPromoCode("");
                markSaved("subscription");
              }
            }}
          >
            <label className="visually-hidden" htmlFor="settings-promo">Promo code</label>
            <input id="settings-promo" className="input mono" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder="Promo code" aria-invalid={Boolean(promoError) || undefined} aria-describedby={promoError ? "settings-promo-error" : undefined} />
            <button type="submit" className="button-secondary compact">Apply</button>
          </form>
          {promoError && <p id="settings-promo-error" className="field-error" role="alert">{promoError}</p>}
          <Link to="/promotions" className="link-button">See promotions <Icon name="chevron" /></Link>
        </div>
        <h3 className="subsection-title">Billing history</h3>
        {billing.history.length ? (
          <table className="history-table">
            <thead>
              <tr><th scope="col">Date</th><th scope="col">Item</th><th scope="col">Amount</th><th scope="col">Status</th></tr>
            </thead>
            <tbody>
              {billing.history.map((entry) => (
                <tr key={entry.date + entry.description}>
                  <td className="num">{formatDate(entry.date)}</td>
                  <td>{entry.description}</td>
                  <td className="num">${entry.amount.toFixed(2)}</td>
                  <td>{entry.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-line">No payments yet.</p>
        )}
      </section>

      <section id="payment" aria-labelledby="payment-title" className="settings-section">
        <SectionHead id="payment" title="Payment options" saved={saved === "payment"} />
        {billing.methods.length ? (
          <ul className="alert-list">
            {billing.methods.map((method) => (
              <li key={method.id} className="alert-row">
                <span className="square-logo" aria-hidden="true">{method.type === "card" ? "▭" : "P"}</span>
                <span className="alert-main">
                  <strong className="num">{method.type === "card" ? `${method.brand} •••• ${method.last4}` : `PayPal · ${method.email}`}</strong>
                  <span className="num">{method.type === "card" ? `Expires ${method.exp}` : "Simulated"}{method.id === defaultMethod?.id ? " · Default" : ""}</span>
                </span>
                {method.id !== defaultMethod?.id && (
                  <button
                    className="button-tertiary"
                    onClick={() => {
                      setBilling((current) => ({ ...current, methods: current.methods.map((item) => ({ ...item, default: item.id === method.id })) }));
                      markSaved("payment");
                    }}
                  >
                    Make default
                  </button>
                )}
                <button className="icon-button small danger-text" onClick={() => removeMethod(method)} aria-label={`Remove ${method.type === "card" ? `${method.brand} ending ${method.last4}` : "PayPal"}`}>
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">No payment methods yet.</p>
        )}
        <div className="button-row wrap">
          <button className="button-secondary compact" onClick={() => setSheet("card")}><Icon name="plus" /> Add card</button>
          <button className="button-secondary compact" onClick={() => setSheet("paypal")}><Icon name="plus" /> Add PayPal (simulated)</button>
        </div>
      </section>

      <section id="preferences" aria-labelledby="preferences-title" className="settings-section">
        <SectionHead id="preferences" title="Preferences" saved={saved === "preferences"} />
        <Segmented label="Theme" value={settings.theme} options={[["dark", "Dark"], ["light", "Light"], ["system", "System"]]} onChange={(theme) => setting("preferences", { theme })} />
        <label className="setting-row">
          <span className="setting-label">Currency</span>
          <select className="select" value={settings.currency} onChange={(event) => setting("preferences", { currency: event.target.value })}>
            {Object.keys(currencies).map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <Segmented
          label="Up/down colours"
          value={settings.colors}
          options={[["standard", "Green up"], ["swapped", "Red up"], ["cb-safe", "Blue/orange (colour-blind)"]]}
          onChange={(colors) => setting("preferences", { colors })}
        />
        <Segmented
          label="Density"
          value={settings.market.density}
          options={[["simple", "Simple"], ["pro", "Pro"]]}
          onChange={(density) => {
            updateMarketSettings({ density });
            markSaved("preferences");
          }}
        />
        <Toggle label="Auto-refresh live prices" hint="Every 30 s while CPA is open" checked={settings.autoRefresh} onChange={(autoRefresh) => setting("preferences", { autoRefresh })} />
        <Toggle label="Animations" hint="Price flashes and sliding sheets" checked={!settings.stopAnimations} onChange={(on) => setting("preferences", { stopAnimations: !on })} />
        <Toggle label="Auto-advance onboarding cards" hint="Every 6 s, never with reduced motion" checked={settings.autoAdvance} onChange={(autoAdvance) => setting("preferences", { autoAdvance })} />
        <label className="setting-row">
          <span className="setting-label">Default chart range</span>
          <select className="select" value={settings.chartRange} onChange={(event) => setting("preferences", { chartRange: event.target.value })}>
            {ranges.map((range) => <option key={range.id} value={range.id}>{range.id}</option>)}
          </select>
        </label>
      </section>

      <section id="notifications" aria-labelledby="notifications-title" className="settings-section">
        <SectionHead id="notifications" title="Notifications" saved={saved === "notifications"} />
        <Toggle label="Weekly digest" hint="Mondays 08:00, shown in Alerts" checked={settings.weeklyDigest} onChange={(weeklyDigest) => setting("notifications", { weeklyDigest })} />
        <Toggle
          label="Quiet hours"
          hint="Only alerts set to bypass quiet hours make a sound or banner"
          checked={settings.quietHours.enabled}
          onChange={(enabled) => setting("notifications", { quietHours: { ...settings.quietHours, enabled } })}
        />
        {settings.quietHours.enabled && (
          <div className="custom-range">
            {["start", "end"].map((key) => (
              <label key={key} className="form-field">
                <span>{key === "start" ? "From" : "To"}</span>
                <input type="time" className="input" value={settings.quietHours[key]} onChange={(event) => setting("notifications", { quietHours: { ...settings.quietHours, [key]: event.target.value } })} />
              </label>
            ))}
          </div>
        )}
        <div className="setting-row">
          <span className="setting-label">
            Browser notifications
            <small>{{ granted: "On", denied: "Blocked in your browser settings", default: "Off", unsupported: "Not supported in this browser" }[permission]}</small>
          </span>
          {permission === "default" && (
            <button
              className="button-secondary compact"
              onClick={async () => {
                setPermission(await requestNotifications());
                app.markAsked();
              }}
            >
              Turn on
            </button>
          )}
        </div>
        <Link to="/alerts?tab=my-alerts" className="link-button">Manage alerts <Icon name="chevron" /></Link>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="settings-section">
        <SectionHead id="privacy" title="Privacy" saved={saved === "privacy"} />
        <div className="setting-row">
          <span className="setting-label">Recently viewed coins<small className="num">{app.recentCoins.length} saved</small></span>
          <button className="button-secondary compact" disabled={!app.recentCoins.length} onClick={() => { app.clearRecentCoins(); markSaved("privacy"); }}>Clear history</button>
        </div>
        <div className="setting-row">
          <span className="setting-label">Recent searches<small className="num">{app.recentSearches.length} saved</small></span>
          <button className="button-secondary compact" disabled={!app.recentSearches.length} onClick={() => { app.clearRecentSearches(); markSaved("privacy"); }}>Clear</button>
        </div>
        <Toggle label="Usage analytics" hint="Local only, never sent anywhere" checked={settings.analytics} onChange={(analytics) => setting("privacy", { analytics })} />
        <button className="button-secondary compact" onClick={exportData}>Export my data (.json)</button>
      </section>

      <section id="accessibility" aria-labelledby="accessibility-title" className="settings-section">
        <SectionHead id="accessibility" title="Accessibility" saved={saved === "accessibility"} />
        <button className="menu-link" onClick={() => app.setAccessibilityOpen(true)}>
          Open accessibility menu <Icon name="chevron" />
        </button>
        <details className="shortcuts">
          <summary className="menu-link">Keyboard shortcuts <Icon name="chevronDown" /></summary>
          <dl>
            {shortcuts.map((item) => (
              <div key={item.keys}><dt><kbd>{item.keys}</kbd></dt><dd>{item.action}</dd></div>
            ))}
          </dl>
        </details>
        <Toggle label="Chart text summaries" hint="Show the text summary under every chart" checked={settings.chartSummaries} onChange={(chartSummaries) => setting("accessibility", { chartSummaries })} />
      </section>

      <section id="danger-zone" aria-labelledby="danger-zone-title" className="settings-section danger-zone">
        <SectionHead id="danger-zone" title="Danger zone" />
        <h3 className="subsection-title">Delete account</h3>
        {demo ? (
          <p className="muted-line">Not available in the demo.</p>
        ) : (
          <>
            <p className="muted-line">Cancel your subscription first. Deleting removes your access to CPA. To remove your data too, contact support.</p>
            {blocksDeletion(billing) && (
              <p className="warning-text" id="delete-blocked">
                Cancel your subscription first. Delete won't work until it is cancelled.{" "}
                <button className="link-button inline" onClick={() => setSheet("cancel")}>Cancel subscription</button>
              </p>
            )}
            <button
              className="button-primary danger-fill inline-primary"
              disabled={blocksDeletion(billing)}
              aria-describedby={blocksDeletion(billing) ? "delete-blocked" : undefined}
              onClick={() => setSheet("delete")}
            >
              Delete account
            </button>
          </>
        )}
      </section>

      <ChangePasswordSheet key={sheet === "password" ? "pw-open" : "pw"} open={sheet === "password"} onClose={closeSheet} />
      <AddCardSheet key={sheet === "card" ? "card-open" : "card"} open={sheet === "card"} onClose={closeSheet} onAdd={addMethod} />
      {!demo && <DeleteAccountSheet key={sheet === "delete" ? "del-open" : "del"} open={sheet === "delete"} onClose={closeSheet} email={session.email} />}

      <Sheet open={sheet === "paypal"} onClose={closeSheet} title="Add PayPal (simulated)" side="bottom">
        <form
          className="tx-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!isEmail(paypal)) return;
            addMethod({ type: "paypal", email: paypal.trim() });
            setPaypal("");
            closeSheet();
          }}
        >
          <p className="sheet-note">No PayPal account is contacted. CPA stores only the email you enter.</p>
          <label className="form-field">
            <span>PayPal email</span>
            <input className="input" type="email" value={paypal} onChange={(event) => setPaypal(event.target.value)} />
          </label>
          <button type="submit" className="button-primary" disabled={!isEmail(paypal)}>Add PayPal</button>
        </form>
      </Sheet>

      <Sheet open={sheet === "day"} onClose={closeSheet} title="Change billing date" side="bottom">
        <label className="form-field">
          <span>Bill me on day</span>
          <select className="input" value={billingDay} onChange={(event) => setBillingDay(Number(event.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <p className="sheet-note num">Next billing date: {formatDate(changeBillingDay(billing, billingDay).nextBilling)}</p>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => changeBillingDay(current, billingDay));
            showToast("Billing date changed");
            markSaved("subscription");
            closeSheet();
          }}
        >
          Save billing date
        </button>
      </Sheet>

      <Sheet open={sheet === "pause"} onClose={closeSheet} title="Pause subscription" side="bottom">
        <fieldset className="field-group">
          <legend>Pause for</legend>
          {[1, 2, 3].map((months) => (
            <label key={months} className="check-row">
              <input type="radio" name="pause" checked={pauseMonths === months} onChange={() => setPauseMonths(months)} />
              {months} {months === 1 ? "month" : "months"} · until {formatDate(pause(billing, months).pausedUntil)}
            </label>
          ))}
        </fieldset>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => pause(current, pauseMonths));
            showToast("Subscription paused");
            markSaved("subscription");
            closeSheet();
          }}
        >
          Pause subscription
        </button>
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={closeSheet} title="Cancel subscription?" side="bottom">
        <p className="sheet-note num">You keep Pro until {formatDate(billing.nextBilling ?? billing.pausedUntil)}, then move to Free. You can resume before then.</p>
        <div className="sheet-actions">
          <button className="button-secondary" onClick={closeSheet}>Keep Pro</button>
          <button
            className="button-primary danger-fill"
            onClick={() => {
              setBilling((current) => cancel(current));
              showToast("Subscription cancelled");
              markSaved("subscription");
              closeSheet();
            }}
          >
            Cancel subscription
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "plan"} onClose={closeSheet} title={`Switch to ${planById(planTarget).label}?`} side="bottom">
        <p className="sheet-note num">
          ${(discountedPrice(promo, planById(planTarget)) ?? planById(planTarget).price).toFixed(2)} charged today to {defaultMethod?.type === "card" ? `${defaultMethod.brand} •••• ${defaultMethod.last4}` : "PayPal"} (simulated), then every {planById(planTarget).period}.
        </p>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => subscribe(current, planTarget, new Date(), discountedPrice(promo, planById(planTarget))));
            setBillingDay(Math.min(new Date().getDate(), 28));
            showToast(`You're on ${planById(planTarget).label}`);
            markSaved("subscription");
            closeSheet();
          }}
        >
          Confirm
        </button>
      </Sheet>
    </div>
  );
}
