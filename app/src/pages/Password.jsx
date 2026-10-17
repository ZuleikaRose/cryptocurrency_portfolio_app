import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PasswordChecklist, PasswordInput } from "../components/PasswordFields.jsx";
import { completeReset, expireReset, isEmail, lookupReset, passwordChecks, passwordErrors, requestReset, verifyPassword } from "../lib/auth.js";
import { useDebounced } from "../lib/hooks.js";
import { useApp } from "../state/context.js";

const sentAtText = (time) =>
  new Date(time).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });

// Request form + confirmation + simulated inbox (14-forgot-reset-password.md). The confirmation
// is the same whether or not the account exists; only a real account gets the simulated email.
function ResetRequest({ initialEmail = "", buttonLabel = "Send reset link" }) {
  const { showToast } = useApp();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const send = async (address) => {
    setBusy(true);
    const outcome = await requestReset(address);
    setBusy(false);
    if (outcome.status === "limited") {
      setError(`Too many requests. Try again in ${outcome.minutes} ${outcome.minutes === 1 ? "minute" : "minutes"}.`);
      return;
    }
    if (outcome.status === "crypto") {
      setError("This browser can't create secure reset links here (Web Crypto is unavailable). Open CPA over HTTPS or on localhost.");
      return;
    }
    if (outcome.status === "storage") {
      setError("Couldn't save the reset link in this browser. Storage may be full or blocked, so the link wouldn't work.");
      return;
    }
    setError(null);
    setResult({ ...outcome, requested: address.trim() });
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    send(email);
  };

  if (result) {
    return (
      <div className="auth-form" aria-live="polite">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h2>Check your email</h2>
        </div>
        <p>
          If an account exists for <strong>{result.requested}</strong>, we sent a link. It expires in 30 minutes.
        </p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        {result.status === "sent" && (
          <article className="card mail-card" aria-label="Simulated email (demo only)">
            <p className="mail-label">Simulated email (demo only)</p>
            <dl className="mail-meta">
              <div><dt>From</dt><dd>CPA &lt;no-reply@cpa.app&gt;</dd></div>
              <div><dt>To</dt><dd>{result.email}</dd></div>
              <div><dt>Subject</dt><dd>Reset your CPA password</dd></div>
            </dl>
            <p>Use this link within 30 minutes:</p>
            <Link to={`/reset-password?token=${result.token}`} className="button-primary mail-button">Reset password</Link>
            <p className="muted-line num">Sent {sentAtText(result.sentAt)}</p>
          </article>
        )}
        {result.status === "sent" && (
          <button
            className="link-button"
            onClick={async () => {
              showToast((await expireReset(result.token)) ? "Link expired (testing)" : "Couldn't update the link in this browser's storage.");
            }}
          >
            Simulate expired link (testing)
          </button>
        )}
        <button className="link-button" disabled={busy} onClick={() => send(result.requested)}>
          {busy ? "Sending…" : "Resend link"}
        </button>
      </div>
    );
  }

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      {error && <p className="form-alert" role="alert">{error}</p>}
      <label className="form-field">
        <span>Email</span>
        <input className="input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} aria-invalid={Boolean(error) || undefined} />
      </label>
      <button type="submit" className="button-primary" disabled={busy}>{busy ? "Sending…" : buttonLabel}</button>
    </form>
  );
}

export default function ForgotPassword() {
  useEffect(() => {
    document.title = "Reset your password · CPA";
  }, []);
  return (
    <div className="auth-page">
      <Link to="/login" className="link-button back">
        <Icon name="chevron" className="icon flip" /> Log in
      </Link>
      <h1>Reset your password</h1>
      <p className="page-sub">Enter your account email and we'll send you a reset link.</p>
      <ResetRequest />
    </div>
  );
}

function NewPasswordForm({ token, account }) {
  const { session, logOut, showToast } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState([]);
  const [busy, setBusy] = useState(false);
  const [sameAsCurrent, setSameAsCurrent] = useState({ value: "", same: false });
  const debounced = useDebounced(password, 400);

  // "Different from current password" needs the slow hash, so check it after typing pauses.
  useEffect(() => {
    let live = true;
    if (!debounced) return undefined;
    verifyPassword(account, debounced)
      .then((same) => {
        if (live) setSameAsCurrent({ value: debounced, same });
      })
      .catch(() => {}); // Web Crypto unavailable: the submit step reports it.
    return () => {
      live = false;
    };
  }, [debounced, account]);

  const different = password.length > 0 && !(sameAsCurrent.value === password && sameAsCurrent.same);
  const checks = passwordChecks(password, { differentFrom: different });

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    const found = passwordErrors(passwordChecks(password));
    if (password && (await verifyPassword(account, password).catch(() => false))) found.push("Choose a password different from your current one.");
    if (confirm !== password || !confirm) found.push("Passwords don't match.");
    setErrors(found);
    if (found.length) return;
    setBusy(true);
    const outcome = await completeReset(token, password);
    setBusy(false);
    const failures = {
      invalid: "This link has expired. Request a new one.",
      failed: "Couldn't save the new password: this browser's storage is full or blocked. Nothing was changed; try again.",
      "failed-link-used": "Couldn't save the new password, and this link can't be reused. Nothing was changed; request a new link.",
    };
    if (outcome !== "ok") {
      setErrors([failures[outcome] ?? failures.failed]);
      return;
    }
    if (session.kind !== "guest") logOut();
    showToast("Password updated. Log in with your new password.");
    navigate("/login", { replace: true });
  };

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <p className="page-sub">for {account.email}</p>
      {errors.length > 0 && (
        <ul className="form-alert" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <label className="form-field" htmlFor="reset-password">
        <span>New password</span>
      </label>
      <PasswordInput id="reset-password" value={password} onChange={setPassword} autoComplete="new-password" describedBy="reset-checks" />
      <PasswordChecklist id="reset-checks" checks={checks} />
      <label className="form-field" htmlFor="reset-confirm">
        <span>Confirm</span>
      </label>
      <PasswordInput id="reset-confirm" value={confirm} onChange={setConfirm} autoComplete="new-password" />
      <button type="submit" className="button-primary" disabled={busy}>{busy ? "Saving…" : "Save new password"}</button>
    </form>
  );
}

export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, setState] = useState({ token: null, valid: false, account: null });

  useEffect(() => {
    document.title = "Choose a new password · CPA";
    let live = true;
    lookupReset(token).then((result) => {
      if (live) setState({ token, valid: Boolean(result?.valid), account: result?.account ?? null });
    });
    return () => {
      live = false;
    };
  }, [token]);

  if (state.token !== token) return <div className="auth-page" aria-busy="true" />;

  return (
    <div className="auth-page">
      {state.valid ? (
        <>
          <h1>Choose a new password</h1>
          <NewPasswordForm token={token} account={state.account} />
        </>
      ) : (
        <>
          <div className="confirm-head warning-text">
            <Icon name="info" className="icon confirm-icon" />
            <h1>This link has expired</h1>
          </div>
          <p className="page-sub">Reset links last 30 minutes and work once. Request a new one.</p>
          <ResetRequest initialEmail={state.account?.email ?? ""} buttonLabel="Send new link" />
        </>
      )}
    </div>
  );
}
