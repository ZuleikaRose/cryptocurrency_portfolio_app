import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import Icon from "../components/Icon.jsx";
import { accountById } from "../lib/auth.js";
import { useApp } from "../state/context.js";

// Log out (15-logout.md): confirm, then a done view. Guests are sent home.
export default function Logout() {
  const { session, logOut, endDemo } = useApp();
  const navigate = useNavigate();
  const [done, setDone] = useState(null);

  useEffect(() => {
    document.title = "Log out · CPA";
  }, []);

  if (done === "demo") return <Navigate to="/" replace />;
  if (done === "user") {
    return (
      <div className="auth-page">
        <div className="confirm-head">
          <Icon name="check" className="icon confirm-icon" />
          <h1>You're logged out</h1>
        </div>
        <p className="page-sub">Your watchlist, portfolio, and alerts are saved in this browser for next time.</p>
        <Link to="/login" className="button-primary">Log in</Link>
        <Link to="/" className="button-tertiary centered">Continue browsing as guest</Link>
        <p className="info-card">
          <Icon name="info" />
          <span>On a shared computer? Delete your account data from Settings first.</span>
        </p>
      </div>
    );
  }
  if (session.kind === "guest") return <Navigate to="/" replace />;

  const demo = session.kind === "demo";
  return (
    <div className="auth-page">
      <h1>{demo ? "End the demo?" : "Log out of CPA?"}</h1>
      {demo ? (
        <p className="page-sub">Everything you changed in the demo will be discarded.</p>
      ) : (
        <>
          <p className="page-sub">Signed in as {session.email}</p>
          <p>Your watchlist, portfolio, alerts, and settings stay saved in this browser. Alerts won't fire while you're logged out.</p>
        </>
      )}
      <button
        className="button-primary"
        onClick={() => {
          setDone(demo ? "demo" : "user");
          if (demo) endDemo();
          else logOut();
        }}
      >
        {demo ? "End demo" : "Log out"}
      </button>
      <button className="button-tertiary centered" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/"))}>
        Cancel
      </button>
    </div>
  );
}

export function AccountDeleted() {
  const { session, logOut } = useApp();
  useEffect(() => {
    document.title = "Account deleted · CPA";
  }, []);
  // Arriving here from Settings: end the session of the account that was just deleted.
  useEffect(() => {
    if (session.kind === "user" && accountById(session.userId)?.status === "deleted") logOut();
  }, [session, logOut]);
  return (
    <div className="auth-page">
      <h1>Your account is deleted</h1>
      <p>You no longer have access. Your data is kept until you ask us to remove it.</p>
      <p>Contact support to submit a data-removal ticket.</p>
      <Link to="/support?topic=data-removal" className="button-primary">Contact support</Link>
      <Link to="/" className="button-tertiary centered">Continue browsing as guest</Link>
    </div>
  );
}
