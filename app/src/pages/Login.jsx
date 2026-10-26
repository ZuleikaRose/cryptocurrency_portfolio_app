import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PasswordChecklist, PasswordInput } from "../components/PasswordFields.jsx";
import { isEmail, passwordChecks, passwordErrors, safeNext } from "../lib/auth.js";
import { useNow, usePageTitle } from "../lib/hooks.js";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";

const authUnavailable = () => t("Accounts aren't available right now. You can keep browsing as a guest or try the private demo.");

// A deleted account after the correct password (US-9.6, US-P17.2): remove its data for good,
// or leave it as it is. Leaving ends the Auth session; if the user navigates away instead,
// the next app load finds the deleted profile and signs it out.
function DeletedAccount({ onLeave }) {
  const { removeDeletedAccountData, leaveDeletedAccount } = useApp();
  const [step, setStep] = useState("choose");
  const [error, setError] = useState(null);
  const [ticketId, setTicketId] = useState(null);
  const headingRef = useRef(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, [step]);

  const remove = async () => {
    setStep("removing");
    const result = await removeDeletedAccountData();
    if (result.error) {
      setError(t("We couldn't remove the data. Check your connection and try again. Nothing was removed."));
      setStep("confirm");
      return;
    }
    setTicketId(result.ticketId);
    setStep("done");
  };

  if (step === "done") {
    return (
      <div className="auth-form" aria-live="polite">
        <h2 ref={headingRef} tabIndex={-1}>{t("Your data has been removed")}</h2>
        <p>{t("Ticket #{id} completed. All CPA data for this account is gone, and the account can't be used again.", { id: ticketId })}</p>
        <Link to="/" className="button-primary">{t("Continue browsing as guest")}</Link>
      </div>
    );
  }

  return (
    <div className="auth-form">
      <h2 ref={headingRef} tabIndex={-1}>{step === "choose" ? t("This account was deleted") : t("Remove all data?")}</h2>
      {error && <p className="form-alert" role="alert">{error}</p>}
      {step === "choose" ? (
        <>
          <p>{t("You no longer have access. Your data is kept until you remove it.")}</p>
          <button className="button-primary danger-fill" onClick={() => setStep("confirm")}>{t("Remove my data")}</button>
          <button
            className="button-tertiary centered"
            onClick={() => {
              leaveDeletedAccount();
              onLeave();
            }}
          >
            {t("Keep it and go back")}
          </button>
        </>
      ) : (
        <>
          <p>{t("This permanently removes your watchlist, portfolio, alerts, settings and profile. It can't be undone.")}</p>
          <div className="sheet-actions">
            <button className="button-secondary" onClick={() => setStep("choose")} disabled={step === "removing"}>{t("Cancel")}</button>
            <button className="button-primary danger-fill" onClick={remove} disabled={step === "removing"}>
              {step === "removing" ? t("Removing…") : t("Remove data")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function LogInForm({ next }) {
  const { logIn } = useApp();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  // Ticks only after a lockout has started (the countdown).
  const now = useNow(lockedUntil ? 1000 : null);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const locked = lockedUntil > now;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (locked || busy) return;
    if (!email.trim() || !password) {
      setError(t("Enter your email and password."));
      emailRef.current?.focus();
      return;
    }
    setBusy(true);
    const result = await logIn(email, password);
    setBusy(false);
    if (result.ok) {
      navigate(next, { replace: true });
      return;
    }
    if (result.error === "locked") setLockedUntil(result.until);
    setError(result.error);
    setPassword("");
  };

  const messages = {
    invalid: t("Email or password is incorrect."),
    unconfirmed: t("Confirm your email first: open the link we sent you, then log in."),
    limited: t("Too many attempts. Wait a few minutes and try again."),
    network: t("We couldn't reach CPA. Check your connection and try again."),
    unavailable: authUnavailable(),
    locked: null,
  };
  const message = locked ? t("Too many attempts. Try again in {seconds} s.", { seconds: Math.ceil((lockedUntil - now) / 1000) }) : messages[error] ?? error;

  if (error === "deleted") return <DeletedAccount onLeave={() => setError(null)} />;

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {message && (
        <p className="form-alert" role="alert">
          {message}
        </p>
      )}
      <label className="form-field">
        <span>{t("Email")}</span>
        <input ref={emailRef} className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={locked} />
      </label>
      <label className="form-field" htmlFor="login-password">
        <span>{t("Password")}</span>
      </label>
      <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
      <Link to="/forgot-password" className="link-button forgot-link">{t("Forgot password?")}</Link>
      <button type="submit" className="button-primary" disabled={locked || busy} aria-disabled={locked || busy}>
        {busy ? t("Logging in…") : t("Log in")}
      </button>
    </form>
  );
}

function SignUpForm({ next }) {
  const { signUp } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: "", email: "", password: "", confirm: "", terms: false });
  const [errors, setErrors] = useState([]);
  const [exists, setExists] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmRef = useRef(null);
  const termsRef = useRef(null);
  const checks = passwordChecks(form.password);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  // Keeps Create account enabled; on submit lists every failing rule and focuses the first bad field.
  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = [];
    if (!form.name.trim()) found.push(["name", t("Enter your name.")]);
    if (!isEmail(form.email)) found.push(["email", t("Enter a valid email address.")]);
    passwordErrors(checks).forEach((message) => found.push(["password", message]));
    if (form.confirm !== form.password || !form.confirm) found.push(["confirm", t("Passwords don't match.")]);
    if (!form.terms) found.push(["terms", t("Agree to the Terms of service and Privacy policy to continue.")]);
    setErrors(found);
    setExists(false);
    if (found.length) {
      const refs = { name: nameRef, email: emailRef, password: passwordRef, confirm: confirmRef, terms: termsRef };
      refs[found[0][0]].current?.focus();
      return;
    }
    setBusy(true);
    const result = await signUp(form);
    setBusy(false);
    if (result.ok) {
      navigate(next, { replace: true });
      return;
    }
    if (result.error === "exists") {
      setExists(true);
      emailRef.current?.focus();
    } else {
      const messages = {
        weak: ["password", t("Choose a stronger password.")],
        email: ["email", t("We can't send email to that address. Check it, or use a different one.")],
        confirm: ["email", t("Check your email and open the link to confirm your account, then log in.")],
        limited: ["email", t("Too many attempts. Wait a few minutes and try again.")],
        unavailable: ["email", authUnavailable()],
      };
      setErrors([messages[result.error] ?? ["email", t("We couldn't create your account. Check your connection and try again.")]]);
    }
  };
  const invalid = (field) => errors.some(([key]) => key === field);

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {(errors.length > 0 || exists) && (
        <div className="form-alert" role="alert">
          {exists ? (
            <p>
              {t("An account with this email already exists.")} <Link to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>{t("Log in instead?")}</Link>
            </p>
          ) : (
            <ul>
              {errors.map(([field, message]) => (
                <li key={field + message}>{message}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      <label className="form-field">
        <span>{t("Name")}</span>
        <input ref={nameRef} className="input" autoComplete="name" value={form.name} onChange={(event) => set("name")(event.target.value)} aria-invalid={invalid("name") || undefined} />
      </label>
      <label className="form-field">
        <span>{t("Email")}</span>
        <input ref={emailRef} className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => set("email")(event.target.value)} aria-invalid={invalid("email") || exists || undefined} />
      </label>
      <label className="form-field" htmlFor="signup-password">
        <span>{t("Password")}</span>
      </label>
      <PasswordInput id="signup-password" inputRef={passwordRef} value={form.password} onChange={set("password")} autoComplete="new-password" invalid={invalid("password")} describedBy="signup-checks" />
      <PasswordChecklist id="signup-checks" checks={checks} />
      <label className="form-field" htmlFor="signup-confirm">
        <span>{t("Confirm password")}</span>
      </label>
      <PasswordInput id="signup-confirm" inputRef={confirmRef} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" invalid={invalid("confirm")} />
      <label className="check-row">
        <input ref={termsRef} type="checkbox" checked={form.terms} onChange={(event) => set("terms")(event.target.checked)} aria-invalid={invalid("terms") || undefined} />
        <span>
          {t("I agree to the")} <Link to="/terms">{t("Terms of service")}</Link> {t("and the")} <Link to="/privacy">{t("Privacy policy")}</Link>
        </span>
      </label>
      <button type="submit" className="button-primary">{busy ? t("Creating account…") : t("Create account")}</button>
    </form>
  );
}

// Log in / Create account (13-login-signup.md). /login and /signup are the two tabs.
export default function Login() {
  const { session, startDemo } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const next = safeNext(params.get("next"));
  const mode = location.pathname === "/signup" ? "signup" : "login";
  const [arrivedSignedIn] = useState(session.kind === "user");

  usePageTitle(mode === "signup" ? t("Create account") : t("Log in"));

  // Already signed in when the page opened: nothing to do here.
  if (arrivedSignedIn) return <Navigate to="/" replace />;

  const query = location.search;
  // Labels are translated where they're shown.
  const tabs = [
    { id: "login", label: "Log in", to: `/login${query}` },
    { id: "signup", label: "Create account", to: `/signup${query}` },
  ];

  return (
    <div className="auth-page">
      <h1>{t("Welcome to CPA")}</h1>
      <p className="page-sub">{t("Track coins, unlocks, and funding in one place.")}</p>
      <div className="filters" role="tablist" aria-label={t("Account")}>
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            id={`auth-tab-${tab.id}`}
            to={tab.to}
            replace
            role="tab"
            aria-selected={mode === tab.id}
            aria-controls="auth-panel"
            tabIndex={mode === tab.id ? 0 : -1}
            className={mode === tab.id ? "filter active" : "filter"}
            onKeyDown={(event) => {
              if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
              const other = tabs.find((item) => item.id !== mode);
              navigate(other.to, { replace: true });
              window.setTimeout(() => document.getElementById(`auth-tab-${other.id}`)?.focus(), 0);
            }}
          >
            {t(tab.label)}
          </Link>
        ))}
      </div>

      <section id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
        {mode === "login" ? <LogInForm key="login" next={next} /> : <SignUpForm key="signup" next={next} />}
      </section>

      <div className="or-divider" aria-hidden="true"><span>{t("or")}</span></div>
      <button
        className="button-secondary button-block"
        onClick={() => {
          startDemo();
          navigate(next, { replace: true });
        }}
      >
        {t("Try a private demo")}
      </button>
      <p className="muted-line">{t("The demo uses sample data, isn't saved, and resets when you refresh.")}</p>
      <p className="info-card">
        <Icon name="info" />
        <span>{t("Your account and data are saved on CPA's servers, so you can sign in on any device. Use a password you don't use anywhere else.")}</span>
      </p>
    </div>
  );
}
