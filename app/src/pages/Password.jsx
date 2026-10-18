import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { PasswordChecklist, PasswordInput } from "../components/PasswordFields.jsx";
import { completeReset, isEmail, passwordChecks, passwordErrors, requestReset } from "../lib/auth.js";
import { recoveryLink } from "../lib/supabase.js";
import { useApp } from "../state/context.js";

// Request form + confirmation (14-forgot-reset-password.md). Supabase Auth emails the link;
// the confirmation is the same whether or not the account exists.
function ResetRequest({ initialEmail = "", buttonLabel = "Send reset link" }) {
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState(null);

  const send = async (address) => {
    setBusy(true);
    const outcome = await requestReset(address);
    setBusy(false);
    const messages = {
      limited: "Too many requests. Wait a few minutes and try again.",
      network: "We couldn't send the link. Check your connection and try again.",
      unavailable: "Password reset isn't available right now. Try again later.",
    };
    if (outcome.status !== "sent") {
      setError(messages[outcome.status]);
      return;
    }
    setError(null);
    setSentTo(address.trim());
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (!isEmail(email)) {
      setError("Enter a valid email address.");
      return;
    }
    send(email);
  };

  if (sentTo) {
    return (
      <div className="auth-form" aria-live="polite">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h2>Check your email</h2>
        </div>
        <p>
          If an account exists for <strong>{sentTo}</strong>, we sent a link to reset your password. It works once; open it in this browser.
        </p>
        {error && <p className="form-alert" role="alert">{error}</p>}
        <button className="link-button" disabled={busy} onClick={() => send(sentTo)}>
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

// The reset link opens a Supabase recovery session; the new password is set on it.
function NewPasswordForm() {
  const { session, logOut, showToast } = useApp();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState([]);
  const [logoutFailed, setLogoutFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const checks = passwordChecks(password);

  const onSubmit = async (event) => {
    event.preventDefault();
    if (busy) return;
    setLogoutFailed(false);
    const found = passwordErrors(checks);
    if (confirm !== password || !confirm) found.push("Passwords don't match.");
    setErrors(found);
    if (found.length) return;
    setBusy(true);
    const outcome = await completeReset(password);
    const failures = {
      same: "Choose a password different from your current one.",
      weak: "Choose a stronger password.",
      invalid: "This link has expired. Request a new one.",
      failed: "We couldn't save the new password. Check your connection and try again. Nothing was changed.",
    };
    if (outcome !== "ok") {
      setBusy(false);
      setErrors([failures[outcome] ?? failures.failed]);
      return;
    }
    const loggedOut = await logOut();
    setBusy(false);
    if (!loggedOut.ok) {
      setErrors(["Your password was updated, but pending account changes couldn't be saved."]);
      setLogoutFailed(true);
      return;
    }
    showToast("Password updated. Log in with your new password.");
    navigate("/login", { replace: true });
  };

  return (
    <form className="auth-form" onSubmit={onSubmit} noValidate>
      <p className="page-sub">for {session.email}</p>
      {errors.length > 0 && (
        <ul className="form-alert" role="alert">
          {errors.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      {logoutFailed && <p className="page-sub">Go to <Link to="/logout">Log out</Link> to retry saving or discard the pending changes.</p>}
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

// Valid only when this page load came from a reset link and its recovery session signed in.
export function ResetPassword() {
  const { session } = useApp();
  const valid = recoveryLink.status === "valid" && session.kind === "user";

  useEffect(() => {
    document.title = "Choose a new password · CPA";
  }, []);

  return (
    <div className="auth-page">
      {valid ? (
        <>
          <h1>Choose a new password</h1>
          <NewPasswordForm />
        </>
      ) : (
        <>
          <div className="confirm-head warning-text">
            <Icon name="info" className="icon confirm-icon" />
            <h1>This link has expired</h1>
          </div>
          <p className="page-sub">Reset links work once and expire after a short time. Request a new one.</p>
          <ResetRequest buttonLabel="Send new link" />
        </>
      )}
    </div>
  );
}
