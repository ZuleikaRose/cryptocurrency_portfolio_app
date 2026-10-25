// Installable app (US-8.1 adapted: a web app can't add a home-screen widget, so CPA installs
// with shortcuts to Watchlist, Unlocks and Alerts) and the offline app shell (US-9.5).
// public/sw.js does the caching; this registers it and keeps the browser's install prompt.
import { useSyncExternalStore } from "react";

let deferredPrompt = null;
let swStatus = "pending"; // "pending" | "ready" | "failed" | "unsupported" | "dev"
const listeners = new Set();
const notify = () => listeners.forEach((listener) => listener());

// Production only: in dev a service worker would cache Vite's modules and fight HMR.
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    swStatus = "unsupported";
    return;
  }
  if (!import.meta.env.PROD) {
    swStatus = "dev";
    return;
  }
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(() => {
        swStatus = "ready";
        notify();
      })
      .catch((error) => {
        // Not fatal: CPA works online without it. Technical requirements reports it.
        console.warn(`Couldn't register the offline service worker: ${error.message}`);
        swStatus = "failed";
        notify();
      });
  });
}

export function watchInstallPrompt() {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

export const isInstalled = () => window.matchMedia?.("(display-mode: standalone)").matches === true || navigator.standalone === true;
export const offlineStatus = () => swStatus;

const subscribe = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

// { canInstall, installed, install() -> "accepted" | "dismissed" | "unavailable" }
export function useInstallPrompt() {
  const prompt = useSyncExternalStore(subscribe, () => deferredPrompt);
  return {
    canInstall: Boolean(prompt),
    installed: isInstalled(),
    install: async () => {
      if (!deferredPrompt) return "unavailable";
      const event = deferredPrompt;
      deferredPrompt = null;
      notify();
      try {
        await event.prompt();
        const { outcome } = await event.userChoice;
        return outcome;
      } catch {
        return "unavailable";
      }
    },
  };
}
