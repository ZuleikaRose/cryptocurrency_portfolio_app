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
import { currencies, formatDate, formatPrice, isoDay } from "../lib/format.js";
import { languages, t, tn } from "../lib/i18n.js";
import { notificationPermission, requestNotifications } from "../lib/notify.js";
import { useInstallPrompt } from "../lib/pwa.js";
import { useApp } from "../state/context.js";
import { usePageTitle } from "../lib/hooks.js";

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

// Install as an app (US-8.1 adapted): the browser's own prompt where it offers one.
function InstallRow({ onResult }) {
  const { canInstall, installed, install } = useInstallPrompt();
  const hint = installed
    ? t("Installed. Open CPA from your home screen or app list.")
    : canInstall
      ? t("Opens on your watchlist, with shortcuts to Unlocks and Alerts")
      : t("Use your browser's Install or Add to Home Screen option");
  return (
    <div className="setting-row">
      <span className="setting-label">
        {t("Install CPA")}
        <small>{hint}</small>
      </span>
      {canInstall && !installed && (
        <button
          className="button-secondary compact"
          onClick={async () => {
            const outcome = await install();
            if (outcome === "accepted") onResult(t("CPA installed"));
            else if (outcome === "unavailable") onResult(t("Couldn't open the install prompt. Use your browser's Install option instead."));
          }}
        >
          {t("Install")}
        </button>
      )}
    </div>
  );
}

function SectionHead({ id, title, saved }) {
  return (
    <div className="settings-head">
      <h2 id={`${id}-title`}>{title}</h2>
      <span className="saved-note" aria-live="polite">
        {saved && (
          <>
            <Icon name="check" /> {t("Saved")}
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
    if (form.next && form.next === form.current) found.push(t("Choose a password different from your current one."));
    if (form.confirm !== form.next || !form.confirm) found.push(t("Passwords don't match."));
    if (!form.current) found.unshift(t("Enter your current password."));
    setErrors(found);
    if (found.length) return;
    setBusy(true);
    const result = await changePassword(form.current, form.next);
    setBusy(false);
    if (result.error === "wrong") {
      setErrors([t("Current password is incorrect.")]);
      return;
    }
    if (result.error) {
      const messages = {
        same: t("Choose a password different from your current one."),
        weak: t("Choose a stronger password."),
        limited: t("Too many attempts. Wait a few minutes and try again."),
      };
      setErrors([messages[result.error] ?? t("We couldn't change your password. Check your connection and try again.")]);
      return;
    }
    showToast(t("Password changed"));
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("Change password")} side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        {errors.length > 0 && (
          <ul className="form-alert" role="alert">
            {errors.map((message) => <li key={message}>{message}</li>)}
          </ul>
        )}
        <label className="form-field" htmlFor="cp-current"><span>{t("Current password")}</span></label>
        <PasswordInput id="cp-current" value={form.current} onChange={set("current")} autoComplete="current-password" />
        <label className="form-field" htmlFor="cp-next"><span>{t("New password")}</span></label>
        <PasswordInput id="cp-next" value={form.next} onChange={set("next")} autoComplete="new-password" describedBy="cp-checks" />
        <PasswordChecklist id="cp-checks" checks={checks} />
        <label className="form-field" htmlFor="cp-confirm"><span>{t("Confirm new password")}</span></label>
        <PasswordInput id="cp-confirm" value={form.confirm} onChange={set("confirm")} autoComplete="new-password" />
        <button type="submit" className="button-primary" disabled={busy}>{busy ? t("Saving…") : t("Change password")}</button>
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
      <span>{t(label)}</span>
      <input className="input" value={form[key]} onChange={set(key)} aria-invalid={Boolean(errors[key]) || undefined} {...props} />
      {errors[key] && <small className="field-error">{errors[key]}</small>}
    </label>
  );
  return (
    <Sheet open={open} onClose={onClose} title={t("Add card")} side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <p className="sheet-note">{t("Simulated: only test cards work, for example 4242 4242 4242 4242. CPA keeps the brand, last 4 digits and expiry, never the full number or security code.")}</p>
        {field("name", "Name on card", { autoComplete: "cc-name" })}
        {field("number", "Card number", { inputMode: "numeric", autoComplete: "cc-number" })}
        <div className="custom-range">
          {field("expiry", "Expiry (MM/YY)", { inputMode: "numeric", autoComplete: "cc-exp", placeholder: "08/28" })}
          {field("cvc", "Security code", { inputMode: "numeric", autoComplete: "cc-csc" })}
        </div>
        <button type="submit" className="button-primary">{t("Add card")}</button>
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
        wrong: t("Password is incorrect."),
        limited: t("Too many attempts. Wait a few minutes and try again."),
      };
      setError(messages[result.error] ?? t("We couldn't delete the account. Check your connection and try again. Nothing was changed."));
      return;
    }
    // The deleted page ends the session once Settings is gone (its guest redirect would win otherwise).
    navigate("/account-deleted", { replace: true });
  };

  return (
    <Sheet open={open} onClose={onClose} title={t("Delete your CPA account?")} side="bottom">
      <form className="tx-form" onSubmit={onSubmit} noValidate>
        <p className="sheet-note">{t("This removes your access to CPA. Your data stays until you remove it: log in again afterwards and choose Remove my data.")}</p>
        <label className="form-field">
          <span>{t("Type your email to confirm")}</span>
          <input className="input" value={typed} onChange={(event) => setTyped(event.target.value)} autoComplete="off" placeholder={email} />
        </label>
        <label className="form-field" htmlFor="delete-password"><span>{t("Password")}</span></label>
        <PasswordInput id="delete-password" value={password} onChange={setPassword} autoComplete="current-password" invalid={Boolean(error)} describedBy="delete-error" />
        {error && <p id="delete-error" className="field-error" role="alert">{error}</p>}
        <div className="sheet-actions">
          <button type="button" className="button-secondary" onClick={onClose}>{t("Cancel")}</button>
          <button type="submit" className="button-primary danger-fill" disabled={!matches || busy} aria-disabled={!matches || busy}>
            {busy ? t("Deleting…") : t("Delete account")}
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

  usePageTitle(t("Account settings"));
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
  let planStatus = t("Free plan");
  if (paid && billing.status === "active") planStatus = t("Active · next billing date {date}", { date: formatDate(billing.nextBilling) });
  if (paid && billing.status === "paused") planStatus = t("Paused until {date}", { date: formatDate(billing.pausedUntil) });
  if (paid && billing.status === "cancelled") planStatus = t("Cancels on {date}", { date: formatDate(billing.cancelsOn) });

  const saveProfile = async (event) => {
    event.preventDefault();
    if (!profile.name.trim()) return setProfileError(t("Enter your name."));
    if (!demo && !isEmail(profile.email)) return setProfileError(t("Enter a valid email address."));
    const result = await app.updateProfile(demo ? { name: profile.name, email: session.email ?? "" } : profile);
    if (result.error === "exists") return setProfileError(t("An account with this email already exists."));
    if (result.error) return setProfileError(t("We couldn't save your profile. Check your connection and try again."));
    setProfileError(null);
    if (result.emailPending) showToast(t("Check {email} and open the link to confirm your new email.", { email: profile.email.trim() }));
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
      showToast(t("Add a payment method first."));
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
    showToast(method.type === "card" ? t("{card} added", { card: `${method.brand} •••• ${method.last4}` }) : t("PayPal added"));
    markSaved("payment");
  };
  const removeMethod = (method) => {
    if (paid && billing.status !== "cancelled" && billing.methods.length === 1) {
      showToast(t("Keep one payment method while your Pro plan is active."));
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
    const ok = downloadText(`cpa-export-${isoDay()}.json`, json, "application/json");
    showToast(ok ? t("Export downloaded") : t("Couldn't start the download in this browser."));
  };

  return (
    <div className="settings">
      <h1>{t("Account settings")}</h1>
      <nav className="settings-chips" aria-label={t("Settings sections")}>
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
            {t(section.label)}
          </a>
        ))}
      </nav>

      <section id="profile" aria-labelledby="profile-title" className="settings-section">
        <SectionHead id="profile" title={t("Profile")} saved={saved === "profile"} />
        <form className="tx-form" onSubmit={saveProfile} noValidate>
          {profileError && <p className="form-alert" role="alert">{profileError}</p>}
          <label className="form-field">
            <span>{t("Name")}</span>
            <input className="input" value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} autoComplete="name" />
          </label>
          <label className="form-field">
            <span>{t("Email")}</span>
            <input className="input" type="email" value={demo ? "demo@cpa.app" : profile.email} disabled={demo} onChange={(event) => setProfile({ ...profile, email: event.target.value })} autoComplete="email" />
          </label>
          <div className="button-row">
            {demo ? <span className="muted-inline">{t("The demo has no password.")}</span> : <button type="button" className="button-secondary" onClick={() => setSheet("password")}>{t("Change password")}</button>}
            <button type="submit" className="button-primary inline-primary">{t("Save")}</button>
          </div>
        </form>
      </section>

      <section id="subscription" aria-labelledby="subscription-title" className="settings-section">
        <SectionHead id="subscription" title={t("Subscription & billing")} saved={saved === "subscription"} />
        <div className="card plan-card">
          <p className="plan-name">
            <strong>CPA {paid ? "Pro" : "Free"}</strong>
            {paid && promoPrice == null && <span className="num"> · {formatPrice(plan.price)}/{t(plan.period)}</span>}
            {paid && promoPrice != null && (
              <span className="num">
                {" · "}<s>{formatPrice(plan.price)}</s> {formatPrice(promoPrice)}/{t(plan.period)}
              </span>
            )}
          </p>
          {promo && (
            <p className="promo-applied num">
              {t("{code} applied", { code: promo.code })}
              {promoPrice == null && (promo.plan ? ` · ${t("takes effect on {plan}", { plan: t(planById(promo.plan).label) })}` : ` · ${t("takes effect on a Pro plan")}`)}
            </p>
          )}
          <p className="muted-line num">{planStatus}</p>
          {paid && (
            <div className="button-row wrap">
              {billing.status === "active" && (
                <>
                  <button className="button-secondary compact" onClick={() => setSheet("day")}>{t("Change billing date")}</button>
                  <button className="button-secondary compact" onClick={() => setSheet("pause")}>{t("Pause")}</button>
                  <button className="button-secondary compact danger-text" onClick={() => setSheet("cancel")}>{t("Cancel")}</button>
                </>
              )}
              {billing.status !== "active" && (
                <button
                  className="button-secondary compact"
                  onClick={() => {
                    setBilling((current) => resume(current));
                    showToast(t("Subscription resumed"));
                    markSaved("subscription");
                  }}
                >
                  {t("Resume")}
                </button>
              )}
            </div>
          )}
          <Segmented
            label={t("Switch plan")}
            value={billing.status === "cancelled" ? "free" : billing.plan}
            options={plans.map((item) => [item.id, item.price ? `${t(item.label)} ${formatPrice(item.price)}` : t(item.label)])}
            onChange={choosePlan}
          />
          <p className="muted-line">{t("Simulated billing: no money is charged.")}</p>
          <form
            className="input-row"
            onSubmit={(event) => {
              event.preventDefault();
              if (!promoCode.trim()) return;
              const result = app.applyPromo(promoCode);
              setPromoError(result.ok ? null : result.error === "new-only" ? t("This code is for accounts created in the last 30 days.") : t("This code isn't valid or has ended."));
              if (result.ok) {
                setPromoCode("");
                markSaved("subscription");
              }
            }}
          >
            <label className="visually-hidden" htmlFor="settings-promo">{t("Promo code")}</label>
            <input id="settings-promo" className="input mono" value={promoCode} onChange={(event) => setPromoCode(event.target.value)} placeholder={t("Promo code")} aria-invalid={Boolean(promoError) || undefined} aria-describedby={promoError ? "settings-promo-error" : undefined} />
            <button type="submit" className="button-secondary compact">{t("Apply")}</button>
          </form>
          {promoError && <p id="settings-promo-error" className="field-error" role="alert">{promoError}</p>}
          <Link to="/promotions" className="link-button">{t("See promotions")} <Icon name="chevron" /></Link>
        </div>
        <h3 className="subsection-title">{t("Billing history")}</h3>
        {billing.history.length ? (
          <table className="history-table">
            <thead>
              <tr><th scope="col">{t("Date")}</th><th scope="col">{t("Item")}</th><th scope="col">{t("Amount")}</th><th scope="col">{t("Status")}</th></tr>
            </thead>
            <tbody>
              {billing.history.map((entry) => (
                <tr key={entry.date + entry.description}>
                  <td className="num">{formatDate(entry.date)}</td>
                  <td>{entry.description.split(" · ").map((part, index) => (index ? part : t(part))).join(" · ")}</td>
                  <td className="num">{formatPrice(entry.amount)}</td>
                  <td>{t(entry.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="empty-line">{t("No payments yet.")}</p>
        )}
      </section>

      <section id="payment" aria-labelledby="payment-title" className="settings-section">
        <SectionHead id="payment" title={t("Payment options")} saved={saved === "payment"} />
        {billing.methods.length ? (
          <ul className="alert-list">
            {billing.methods.map((method) => (
              <li key={method.id} className="alert-row">
                <span className="square-logo" aria-hidden="true">{method.type === "card" ? "▭" : "P"}</span>
                <span className="alert-main">
                  <strong className="num">{method.type === "card" ? `${method.brand} •••• ${method.last4}` : `PayPal · ${method.email}`}</strong>
                  <span className="num">{method.type === "card" ? t("Expires {date}", { date: method.exp }) : t("Simulated")}{method.id === defaultMethod?.id ? ` · ${t("Default")}` : ""}</span>
                </span>
                {method.id !== defaultMethod?.id && (
                  <button
                    className="button-tertiary"
                    onClick={() => {
                      setBilling((current) => ({ ...current, methods: current.methods.map((item) => ({ ...item, default: item.id === method.id })) }));
                      markSaved("payment");
                    }}
                  >
                    {t("Make default")}
                  </button>
                )}
                <button className="icon-button small danger-text" onClick={() => removeMethod(method)} aria-label={method.type === "card" ? t("Remove {brand} ending {last4}", { brand: method.brand, last4: method.last4 }) : t("Remove PayPal")}>
                  <Icon name="trash" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="empty-line">{t("No payment methods yet.")}</p>
        )}
        <div className="button-row wrap">
          <button className="button-secondary compact" onClick={() => setSheet("card")}><Icon name="plus" /> {t("Add card")}</button>
          <button className="button-secondary compact" onClick={() => setSheet("paypal")}><Icon name="plus" /> {t("Add PayPal (simulated)")}</button>
        </div>
      </section>

      <section id="preferences" aria-labelledby="preferences-title" className="settings-section">
        <SectionHead id="preferences" title={t("Preferences")} saved={saved === "preferences"} />
        <label className="setting-row">
          <span className="setting-label">{t("Language")}</span>
          <select className="select" value={settings.language} onChange={(event) => setting("preferences", { language: event.target.value })}>
            {languages.map((language) => <option key={language.id} value={language.id} lang={language.id}>{language.label}</option>)}
          </select>
        </label>
        <Segmented label={t("Theme")} value={settings.theme} options={[["dark", t("Dark")], ["light", t("Light")], ["system", t("System")]]} onChange={(theme) => setting("preferences", { theme })} />
        <label className="setting-row">
          <span className="setting-label">{t("Currency")}</span>
          <select className="select" value={settings.currency} onChange={(event) => setting("preferences", { currency: event.target.value })}>
            {Object.keys(currencies).map((code) => <option key={code} value={code}>{code}</option>)}
          </select>
        </label>
        <Segmented
          label={t("Up/down colours")}
          value={settings.colors}
          options={[["standard", t("Green up")], ["swapped", t("Red up")], ["cb-safe", t("Blue/orange (colour-blind)")]]}
          onChange={(colors) => setting("preferences", { colors })}
        />
        <Segmented
          label={t("Density")}
          value={settings.market.density}
          options={[["simple", t("Simple")], ["pro", t("Pro")]]}
          onChange={(density) => {
            updateMarketSettings({ density });
            markSaved("preferences");
          }}
        />
        <Toggle label={t("Auto-refresh live prices")} hint={t("Every 30 s while CPA is open")} checked={settings.autoRefresh} onChange={(autoRefresh) => setting("preferences", { autoRefresh })} />
        <Toggle label={t("Animations")} hint={t("Price flashes and sliding sheets")} checked={!settings.stopAnimations} onChange={(on) => setting("preferences", { stopAnimations: !on })} />
        <Toggle label={t("Auto-advance onboarding cards")} hint={t("Every 6 s, never with reduced motion")} checked={settings.autoAdvance} onChange={(autoAdvance) => setting("preferences", { autoAdvance })} />
        <label className="setting-row">
          <span className="setting-label">{t("Default chart range")}</span>
          <select className="select" value={settings.chartRange} onChange={(event) => setting("preferences", { chartRange: event.target.value })}>
            {ranges.map((range) => <option key={range.id} value={range.id}>{range.id}</option>)}
          </select>
        </label>
        <InstallRow onResult={showToast} />
      </section>

      <section id="notifications" aria-labelledby="notifications-title" className="settings-section">
        <SectionHead id="notifications" title={t("Notifications")} saved={saved === "notifications"} />
        <Toggle label={t("Weekly digest")} hint={t("Mondays 08:00, shown in Alerts")} checked={settings.weeklyDigest} onChange={(weeklyDigest) => setting("notifications", { weeklyDigest })} />
        <Toggle
          label={t("Quiet hours")}
          hint={t("Only alerts set to bypass quiet hours make a sound or banner")}
          checked={settings.quietHours.enabled}
          onChange={(enabled) => setting("notifications", { quietHours: { enabled } })}
        />
        {settings.quietHours.enabled && (
          <div className="custom-range">
            {["start", "end"].map((key) => (
              <label key={key} className="form-field">
                <span>{key === "start" ? t("From") : t("To")}</span>
                <input type="time" className="input" value={settings.quietHours[key]} onChange={(event) => setting("notifications", { quietHours: { [key]: event.target.value } })} />
              </label>
            ))}
          </div>
        )}
        <div className="setting-row">
          <span className="setting-label">
            {t("Browser notifications")}
            <small>{t({ granted: "On", denied: "Blocked in your browser settings", default: "Off", unsupported: "Not supported in this browser" }[permission])}</small>
          </span>
          {permission === "default" && (
            <button
              className="button-secondary compact"
              onClick={async () => {
                setPermission(await requestNotifications());
                app.markAsked();
              }}
            >
              {t("Turn on")}
            </button>
          )}
        </div>
        <Link to="/alerts?tab=my-alerts" className="link-button">{t("Manage alerts")} <Icon name="chevron" /></Link>
      </section>

      <section id="privacy" aria-labelledby="privacy-title" className="settings-section">
        <SectionHead id="privacy" title={t("Privacy")} saved={saved === "privacy"} />
        <div className="setting-row">
          <span className="setting-label">{t("Recently viewed coins")}<small className="num">{t("{count} saved", { count: app.recentCoins.length })}</small></span>
          <button className="button-secondary compact" disabled={!app.recentCoins.length} onClick={() => { app.clearRecentCoins(); markSaved("privacy"); }}>{t("Clear history")}</button>
        </div>
        <div className="setting-row">
          <span className="setting-label">{t("Recent searches")}<small className="num">{t("{count} saved", { count: app.recentSearches.length })}</small></span>
          <button className="button-secondary compact" disabled={!app.recentSearches.length} onClick={() => { app.clearRecentSearches(); markSaved("privacy"); }}>{t("Clear")}</button>
        </div>
        <Toggle label={t("Usage analytics")} hint={t("Local only, never sent anywhere")} checked={settings.analytics} onChange={(analytics) => setting("privacy", { analytics })} />
        <button className="button-secondary compact" onClick={exportData}>{t("Export my data (.json)")}</button>
      </section>

      <section id="accessibility" aria-labelledby="accessibility-title" className="settings-section">
        <SectionHead id="accessibility" title={t("Accessibility")} saved={saved === "accessibility"} />
        <button className="menu-link" onClick={() => app.setAccessibilityOpen(true)}>
          {t("Open accessibility menu")} <Icon name="chevron" />
        </button>
        <details className="shortcuts">
          <summary className="menu-link">{t("Keyboard shortcuts")} <Icon name="chevronDown" /></summary>
          <dl>
            {shortcuts.map((item) => (
              <div key={item.keys}><dt><kbd>{item.keys}</kbd></dt><dd>{t(item.action)}</dd></div>
            ))}
          </dl>
        </details>
        <Toggle label={t("Chart text summaries")} hint={t("Show the text summary under every chart")} checked={settings.chartSummaries} onChange={(chartSummaries) => setting("accessibility", { chartSummaries })} />
      </section>

      <section id="danger-zone" aria-labelledby="danger-zone-title" className="settings-section danger-zone">
        <SectionHead id="danger-zone" title={t("Danger zone")} />
        <h3 className="subsection-title">{t("Delete account")}</h3>
        {demo ? (
          <p className="muted-line">{t("Not available in the demo.")}</p>
        ) : (
          <>
            <p className="muted-line">{t("Cancel your subscription first. Deleting removes your access to CPA. To remove your data too, contact support.")}</p>
            {blocksDeletion(billing) && (
              <p className="warning-text" id="delete-blocked">
                {t("Cancel your subscription first. Delete won't work until it is cancelled.")}{" "}
                <button className="link-button inline" onClick={() => setSheet("cancel")}>{t("Cancel subscription")}</button>
              </p>
            )}
            <button
              className="button-primary danger-fill inline-primary"
              disabled={blocksDeletion(billing)}
              aria-describedby={blocksDeletion(billing) ? "delete-blocked" : undefined}
              onClick={() => setSheet("delete")}
            >
              {t("Delete account")}
            </button>
          </>
        )}
      </section>

      <ChangePasswordSheet key={sheet === "password" ? "pw-open" : "pw"} open={sheet === "password"} onClose={closeSheet} />
      <AddCardSheet key={sheet === "card" ? "card-open" : "card"} open={sheet === "card"} onClose={closeSheet} onAdd={addMethod} />
      {!demo && <DeleteAccountSheet key={sheet === "delete" ? "del-open" : "del"} open={sheet === "delete"} onClose={closeSheet} email={session.email} />}

      <Sheet open={sheet === "paypal"} onClose={closeSheet} title={t("Add PayPal (simulated)")} side="bottom">
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
          <p className="sheet-note">{t("No PayPal account is contacted. CPA stores only the email you enter.")}</p>
          <label className="form-field">
            <span>{t("PayPal email")}</span>
            <input className="input" type="email" value={paypal} onChange={(event) => setPaypal(event.target.value)} />
          </label>
          <button type="submit" className="button-primary" disabled={!isEmail(paypal)}>{t("Add PayPal")}</button>
        </form>
      </Sheet>

      <Sheet open={sheet === "day"} onClose={closeSheet} title={t("Change billing date")} side="bottom">
        <label className="form-field">
          <span>{t("Bill me on day")}</span>
          <select className="input" value={billingDay} onChange={(event) => setBillingDay(Number(event.target.value))}>
            {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => <option key={day} value={day}>{day}</option>)}
          </select>
        </label>
        <p className="sheet-note num">{t("Next billing date: {date}", { date: formatDate(changeBillingDay(billing, billingDay).nextBilling) })}</p>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => changeBillingDay(current, billingDay));
            showToast(t("Billing date changed"));
            markSaved("subscription");
            closeSheet();
          }}
        >
          {t("Save billing date")}
        </button>
      </Sheet>

      <Sheet open={sheet === "pause"} onClose={closeSheet} title={t("Pause subscription")} side="bottom">
        <fieldset className="field-group">
          <legend>{t("Pause for")}</legend>
          {[1, 2, 3].map((months) => (
            <label key={months} className="check-row">
              <input type="radio" name="pause" checked={pauseMonths === months} onChange={() => setPauseMonths(months)} />
              {tn(months, "{count} month · until {date}", "{count} months · until {date}", { date: formatDate(pause(billing, months).pausedUntil) })}
            </label>
          ))}
        </fieldset>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => pause(current, pauseMonths));
            showToast(t("Subscription paused"));
            markSaved("subscription");
            closeSheet();
          }}
        >
          {t("Pause subscription")}
        </button>
      </Sheet>

      <Sheet open={sheet === "cancel"} onClose={closeSheet} title={t("Cancel subscription?")} side="bottom">
        <p className="sheet-note num">{t("You keep Pro until {date}, then move to Free. You can resume before then.", { date: formatDate(billing.nextBilling ?? billing.pausedUntil) })}</p>
        <div className="sheet-actions">
          <button className="button-secondary" onClick={closeSheet}>{t("Keep Pro")}</button>
          <button
            className="button-primary danger-fill"
            onClick={() => {
              setBilling((current) => cancel(current));
              showToast(t("Subscription cancelled"));
              markSaved("subscription");
              closeSheet();
            }}
          >
            {t("Cancel subscription")}
          </button>
        </div>
      </Sheet>

      <Sheet open={sheet === "plan"} onClose={closeSheet} title={t("Switch to {plan}?", { plan: t(planById(planTarget).label) })} side="bottom">
        <p className="sheet-note num">
          {t("{amount} charged today to {method} (simulated), then every {period}.", {
            amount: formatPrice(discountedPrice(promo, planById(planTarget)) ?? planById(planTarget).price),
            method: defaultMethod?.type === "card" ? `${defaultMethod.brand} •••• ${defaultMethod.last4}` : "PayPal",
            period: t(planById(planTarget).period ?? "month"),
          })}
        </p>
        <button
          className="button-primary"
          onClick={() => {
            setBilling((current) => subscribe(current, planTarget, new Date(), discountedPrice(promo, planById(planTarget))));
            setBillingDay(Math.min(new Date().getDate(), 28));
            showToast(t("You're on {plan}", { plan: t(planById(planTarget).label) }));
            markSaved("subscription");
            closeSheet();
          }}
        >
          {t("Confirm")}
        </button>
      </Sheet>
    </div>
  );
}
