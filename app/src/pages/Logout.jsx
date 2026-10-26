import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { t } from "../lib/i18n.js";
import { useApp } from "../state/context.js";

// Log out (15-logout.md): confirm, then a done view. Guests are sent home.
export default function Logout() {
  const { session, logOut, endDemo } = useApp();
  const navigate = useNavigate();
  const [done, setDone] = useState(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  useEffect(() => {
    document.title = `${t("Log out")} · CPA`;
  }, []);

  if (done === "demo") return <Navigate to="/" replace />;
  if (done === "user") {
    return (
      <div className="auth-page">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h1>{t("You're logged out")}</h1>
        </div>
        <p className="page-sub">{t("Your watchlist, portfolio, and alerts are saved to your account for next time.")}</p>
        <Link to="/login" className="button-primary">{t("Log in")}</Link>
        <Link to="/" className="button-tertiary centered">{t("Continue browsing as guest")}</Link>
        <p className="info-card">
          <Icon name="info" />
          <span>{t("This browser no longer holds your session. Your data stays in your account, not on this device.")}</span>
        </p>
      </div>
    );
  }
  if (session.kind === "guest") {
    if (!saving) return <Navigate to="/" replace />;
    return (
      <div className="auth-page">
        <h1>{t("Logging out")}</h1>
        <p className="page-sub" role="status">
          {discarding ? t("Discarding unsaved changes and ending this session.") : t("Your changes are saved. Ending this session.")}
        </p>
      </div>
    );
  }

  const demo = session.kind === "demo";
  const finishLogOut = async (discard = false) => {
    setDiscarding(discard);
    setSaving(true);
    const result = await logOut({ discard });
    setSaving(false);
    if (result.ok) setDone("user");
    else setSaveFailed(true);
  };
  return (
    <div className="auth-page">
      <h1>{demo ? t("End the demo?") : t("Log out of CPA?")}</h1>
      {demo ? (
        <p className="page-sub">{t("Everything you changed in the demo will be discarded.")}</p>
      ) : (
        <>
          <p className="page-sub">{t("Signed in as {email}", { email: session.email })}</p>
          <p>{t("Your watchlist, portfolio, alerts, and settings stay saved to your account. Alerts won't fire while you're logged out.")}</p>
        </>
      )}
      {saveFailed && (
        <>
          <p className="form-alert" role="alert">{t("We couldn't save your changes. Retry, or discard unsaved changes before logging out.")}</p>
          <button className="button-secondary" disabled={saving} onClick={() => finishLogOut(true)}>
            {t("Discard unsaved changes and log out")}
          </button>
        </>
      )}
      <button
        className="button-primary"
        disabled={saving}
        onClick={() => {
          if (demo) {
            endDemo();
            setDone("demo");
          } else {
            finishLogOut();
          }
        }}
      >
        {saving ? t("Saving…") : saveFailed && !demo ? t("Retry and log out") : demo ? t("End demo") : t("Log out")}
      </button>
      <button className="button-tertiary centered" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
        {t("Cancel")}
      </button>
    </div>
  );
}

export function AccountDeleted() {
  const { session, logOut } = useApp();
  useEffect(() => {
    document.title = `${t("Account deleted")} · CPA`;
  }, []);
  // Arriving here from Settings: end the session of the account that was just deleted.
  useEffect(() => {
    if (session.kind === "user" && session.deleted) logOut({ discard: true });
  }, [session, logOut]);
  return (
    <div className="auth-page">
      <h1>{t("Your account is deleted")}</h1>
      <p>{t("You no longer have access. Your data is kept until you remove it.")}</p>
      <p>{t("To remove it, log in with this account's email and password, then choose Remove my data.")}</p>
      <Link to="/login" className="button-primary">{t("Log in to remove data")}</Link>
      <Link to="/" className="button-tertiary centered">{t("Continue browsing as guest")}</Link>
    </div>
  );
}
