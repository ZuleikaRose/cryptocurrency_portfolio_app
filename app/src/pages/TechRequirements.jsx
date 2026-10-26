import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { notificationPermission } from "../lib/notify.js";
import { prefersReducedMotion } from "../lib/a11y.js";
import { keys } from "../lib/storage.js";
import { isInstalled, offlineStatus } from "../lib/pwa.js";
import { t } from "../lib/i18n.js";

const SUPPORTED = { Chrome: 120, Edge: 120, Firefox: 120, Safari: 17 };

function detectBrowser() {
  const ua = navigator.userAgent;
  const match =
    ua.match(/(Edg)\/(\d+)/) ?? ua.match(/(Firefox)\/(\d+)/) ?? ua.match(/(Chrome)\/(\d+)/) ?? (ua.includes("Safari") ? ua.match(/Version\/(\d+)/)?.slice(0, 2) : null);
  if (!match) return { name: t("Unknown browser"), version: 0 };
  if (match.length === 2) return { name: "Safari", version: Number(match[1]) };
  return { name: match[1] === "Edg" ? "Edge" : match[1], version: Number(match[2]) };
}

// Writes and deletes cpa:v1:probe (22-technical-requirements.md).
function storageWorks() {
  try {
    window.localStorage.setItem(keys.probe, "1");
    const ok = window.localStorage.getItem(keys.probe) === "1";
    window.localStorage.removeItem(keys.probe);
    return ok;
  } catch {
    return false;
  }
}

function runChecks() {
  const browser = detectBrowser();
  const minimum = SUPPORTED[browser.name];
  const permission = notificationPermission();
  return [
    minimum && browser.version >= minimum
      ? { ok: true, text: t("Browser: {name} {version} (supported)", { name: browser.name, version: browser.version }) }
      : { ok: false, warn: true, text: t("Browser: {name} {version} isn't tested. CPA should still work; update if something looks wrong.", { name: browser.name, version: browser.version || "" }) },
    storageWorks()
      ? { ok: true, text: t("Local storage available") }
      : { ok: false, text: t("Local storage blocked. You can browse and use the demo, but accounts can't be saved."), link: { to: "/faqs#general", label: t("Where is my data stored?") } },
    { ok: true, text: t("JavaScript enabled") },
    {
      ok: permission === "granted",
      info: permission !== "granted",
      text: t({ granted: "Notifications: allowed", denied: "Notifications: blocked (alerts still show in the app)", default: "Notifications: not yet allowed", unsupported: "Notifications: not supported in this browser" }[permission]),
    },
    navigator.onLine ? { ok: true, text: t("Connection: online") } : { ok: false, warn: true, text: t("Connection: offline. Bundled sample data keeps working.") },
    { ok: true, info: true, text: prefersReducedMotion() ? t("Reduced motion: on (animations are off)") : t("Reduced motion: off") },
    isInstalled()
      ? { ok: true, text: t("Installed as an app") }
      : { ok: true, info: true, text: t("Installable: use your browser's Install or Add to Home Screen option"), link: { to: "/settings#preferences", label: t("Install from Settings") } },
    {
      ok: offlineStatus() === "ready",
      info: offlineStatus() !== "ready",
      text: t({
        ready: "Offline app: ready (opens without a connection, with your last prices)",
        pending: "Offline app: setting up",
        failed: "Offline app: couldn't set up. CPA still works online.",
        unsupported: "Offline app: not supported in this browser",
        dev: "Offline app: off in development builds",
      }[offlineStatus()]),
    },
  ];
}

// Technical requirements (22-technical-requirements.md).
export default function TechRequirements() {
  const [checks, setChecks] = useState(null);
  const [checking, setChecking] = useState(false);

  const rerun = useCallback(() => {
    setChecking(true);
    window.setTimeout(() => {
      setChecks(runChecks());
      setChecking(false);
    }, 300);
  }, []);

  useEffect(() => {
    document.title = `${t("Technical requirements")} · CPA`;
    const id = window.setTimeout(() => setChecks(runChecks()), 0);
    window.addEventListener("online", rerun);
    window.addEventListener("offline", rerun);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("online", rerun);
      window.removeEventListener("offline", rerun);
    };
  }, [rerun]);

  return (
    <div className="info-page">
      <h1>{t("Technical requirements")}</h1>
      <section className="card setup-card" aria-labelledby="setup-title" aria-busy={checking || !checks}>
        <h2 id="setup-title">{t("Your setup")}</h2>
        {/* One live region that stays mounted, so the result is announced when it replaces "Checking…". */}
        <div role="status">
          {checking || !checks ? (
            <p>{t("Checking…")}</p>
          ) : (
            <ul className="setup-list">
              {checks.map((check) => (
                <li key={check.text} className={check.ok ? "ok" : check.info ? "info" : check.warn ? "warn" : "bad"}>
                  <span aria-hidden="true">{check.ok ? "✓" : check.info ? "ⓘ" : check.warn ? "⚠" : "✗"}</span>
                  <span>
                    <span className="visually-hidden">{check.ok ? t("Passed: ") : check.info ? t("Note: ") : t("Problem: ")}</span>
                    {check.text}
                    {check.link && <> <Link to={check.link.to}>{check.link.label}</Link></>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button className="button-secondary compact" onClick={rerun} disabled={checking}>{t("Run check again")}</button>
      </section>

      {[
        ["Supported browsers", "Chrome, Edge, Firefox and Safari: the latest 2 versions. iOS Safari 17+ and Android Chrome."],
        ["Screen sizes", "320px wide and up: phones, tablets, notebooks and desktops, in portrait or landscape. From 1024px the tabs become a sidebar."],
        ["Internet", "Needed only to load the app (about 1 MB). Prices come from bundled sample data, so CPA keeps working offline once loaded."],
        ["Storage", "Allow site data (local storage) to stay signed in. Private windows sign you out when closed; your account data is kept."],
        ["Assistive technology", "Tested with NVDA, JAWS, VoiceOver and TalkBack, and keyboard only."],
        ["Performance", "First data on screen in 2 seconds or less on a mid-range phone."],
      ].map(([title, body]) => (
        <section key={title} className="info-section">
          <h2>{t(title)}</h2>
          <p>{t(body)}</p>
        </section>
      ))}
    </div>
  );
}
