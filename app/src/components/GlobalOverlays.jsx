import { useLocation, useNavigate } from "react-router-dom";
import Icon from "./Icon.jsx";
import Sheet from "./Sheet.jsx";
import { useApp } from "../state/context.js";
import { useOnline } from "../lib/hooks.js";

// Toasts sit above the bottom nav; at most two, each for 4 s (00-app-shell.md).
export function Toasts() {
  const { toasts, dismissToast } = useApp();
  return (
    <div className="toast-region" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <p key={toast.id} className="toast">
          <Icon name="check" />
          <span className="toast-text">{toast.message}</span>
          {toast.action && (
            <button
              className="button-tertiary"
              onClick={() => {
                toast.action.run();
                dismissToast(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </p>
      ))}
    </div>
  );
}

// Guest sign-in sheet (US-1.1): names the action, then completes it after sign-in or demo start.
export function SignInSheet() {
  const { authPrompt, dismissAuthPrompt, startDemo } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const next = encodeURIComponent(location.pathname + location.search);

  const goTo = (path) => {
    dismissAuthPrompt(true);
    navigate(`${path}?next=${next}`);
  };

  return (
    <Sheet open={Boolean(authPrompt)} onClose={dismissAuthPrompt} title="Sign in" side="bottom">
      <div className="signin-sheet">
        <h3>{authPrompt?.reason}</h3>
        <p>Your change is saved after you sign in. You can also try a private demo; it resets when you refresh.</p>
        <button className="button-primary" onClick={() => goTo("/login")}>Log in</button>
        <button className="button-secondary button-block" onClick={() => goTo("/signup")}>Create account</button>
        <button className="button-tertiary" onClick={startDemo}>Try a private demo</button>
        <button className="button-tertiary muted" onClick={dismissAuthPrompt}>Not now</button>
      </div>
    </Sheet>
  );
}

// Offline (US-9.5, 00-app-shell.md): the last loaded prices and the bundled data stay on screen.
export function OfflineBanner() {
  const online = useOnline();
  if (online) return null;
  return (
    <div className="offline-banner" role="status">
      <Icon name="clock" />
      <span>You're offline: showing saved data</span>
    </div>
  );
}

export function DemoBanner() {
  const { session, endDemo } = useApp();
  if (session.kind !== "demo") return null;
  return (
    <div className="demo-banner" role="note">
      <span>Demo mode · changes reset on refresh</span>
      <button className="icon-button small" onClick={endDemo} aria-label="End demo">
        <Icon name="close" />
      </button>
    </div>
  );
}
