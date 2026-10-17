import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PasswordChecklist, PasswordInput } from "../components/PasswordFields.jsx";
import { isEmail, passwordChecks, passwordErrors, safeNext } from "../lib/auth.js";
import { useNow } from "../lib/hooks.js";
import { useApp } from "../state/context.js";

function LogInForm({ next }) {
  const { logIn } = useApp();
  const navigate = useNavigate();
  const now = useNow(1000);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(0);
  const [busy, setBusy] = useState(false);
  const emailRef = useRef(null);
  const locked = lockedUntil > now;

  const onSubmit = async (event) => {
    event.preventDefault();
    if (locked || busy) return;
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
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
    invalid: "Email or password is incorrect.",
    deleted: "This account was deleted. Contact support to restore access or remove your data.",
    crypto: "This browser can't do secure password checks here (Web Crypto is unavailable). Open CPA over HTTPS or on localhost.",
    locked: null,
  };
  const message = locked ? `Too many attempts. Try again in ${Math.ceil((lockedUntil - now) / 1000)} s.` : messages[error] ?? error;

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {message && (
        <p className="form-alert" role="alert">
          {message}
          {error === "deleted" && (
            <>
              {" "}
              <Link to="/support?topic=data-removal">Contact support</Link>
            </>
          )}
        </p>
      )}
      <label className="form-field">
        <span>Email</span>
        <input ref={emailRef} className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} disabled={locked} />
      </label>
      <label className="form-field" htmlFor="login-password">
        <span>Password</span>
      </label>
      <PasswordInput id="login-password" value={password} onChange={setPassword} autoComplete="current-password" />
      <Link to="/forgot-password" className="link-button forgot-link">Forgot password?</Link>
      <button type="submit" className="button-primary" disabled={locked || busy} aria-disabled={locked || busy}>
        {busy ? "Logging in…" : "Log in"}
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
    if (!form.name.trim()) found.push(["name", "Enter your name."]);
    if (!isEmail(form.email)) found.push(["email", "Enter a valid email address."]);
    passwordErrors(checks).forEach((message) => found.push(["password", message]));
    if (form.confirm !== form.password || !form.confirm) found.push(["confirm", "Passwords don't match."]);
    if (!form.terms) found.push(["terms", "Agree to the Terms of service and Privacy policy to continue."]);
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
    } else if (result.error === "crypto") {
      setErrors([["password", "This browser can't do secure password checks here (Web Crypto is unavailable). Open CPA over HTTPS or on localhost."]]);
    } else {
      setErrors([["email", "Couldn't save the account in this browser. Storage may be full or blocked."]]);
    }
  };
  const invalid = (field) => errors.some(([key]) => key === field);

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {(errors.length > 0 || exists) && (
        <div className="form-alert" role="alert">
          {exists ? (
            <p>
              An account with this email already exists. <Link to={`/login${next !== "/" ? `?next=${encodeURIComponent(next)}` : ""}`}>Log in instead?</Link>
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
        <span>Name</span>
        <input ref={nameRef} className="input" autoComplete="name" value={form.name} onChange={(event) => set("name")(event.target.value)} aria-invalid={invalid("name") || undefined} />
      </label>
      <label className="form-field">
        <span>Email</span>
        <input ref={emailRef} className="input" type="email" autoComplete="email" value={form.email} onChange={(event) => set("email")(event.target.value)} aria-invalid={invalid("email") || exists || undefined} />
      </label>
      <label className="form-field" htmlFor="signup-password">
        <span>Password</span>
      </label>
      <PasswordInput id="signup-password" inputRef={passwordRef} value={form.password} onChange={set("password")} autoComplete="new-password" invalid={invalid("password")} describedBy="signup-checks" />
      <PasswordChecklist id="signup-checks" checks={checks} />
      <label className="form-field" htmlFor="signup-confirm">
        <span>Confirm password</span>
      </label>
      <PasswordInput id="signup-confirm" inputRef={confirmRef} value={form.confirm} onChange={set("confirm")} autoComplete="new-password" invalid={invalid("confirm")} />
      <label className="check-row">
        <input ref={termsRef} type="checkbox" checked={form.terms} onChange={(event) => set("terms")(event.target.checked)} aria-invalid={invalid("terms") || undefined} />
        <span>
          I agree to the <Link to="/terms">Terms of service</Link> and <Link to="/privacy">Privacy policy</Link>
        </span>
      </label>
      <button type="submit" className="button-primary">{busy ? "Creating account…" : "Create account"}</button>
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

  useEffect(() => {
    document.title = `${mode === "signup" ? "Create account" : "Log in"} · CPA`;
  }, [mode]);

  // Already signed in when the page opened: nothing to do here.
  if (arrivedSignedIn) return <Navigate to="/" replace />;

  const query = location.search;
  const tabs = [
    { id: "login", label: "Log in", to: `/login${query}` },
    { id: "signup", label: "Create account", to: `/signup${query}` },
  ];

  return (
    <div className="auth-page">
      <h1>Welcome to CPA</h1>
      <p className="page-sub">Track coins, unlocks, and funding in one place.</p>
      <div className="filters" role="tablist" aria-label="Account">
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
            {tab.label}
          </Link>
        ))}
      </div>

      <section id="auth-panel" role="tabpanel" aria-labelledby={`auth-tab-${mode}`}>
        {mode === "login" ? <LogInForm key="login" next={next} /> : <SignUpForm key="signup" next={next} />}
      </section>

      <div className="or-divider" aria-hidden="true"><span>or</span></div>
      <button
        className="button-secondary button-block"
        onClick={() => {
          startDemo();
          navigate(next, { replace: true });
        }}
      >
        Try a private demo
      </button>
      <p className="muted-line">The demo uses sample data, isn't saved, and resets when you refresh.</p>
      <p className="info-card">
        <Icon name="info" />
        <span>Accounts are stored in this browser only. Browser storage isn't a secure server, so CPA is for demonstration; don't reuse a password you use elsewhere.</span>
      </p>
    </div>
  );
}
