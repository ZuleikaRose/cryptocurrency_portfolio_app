import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";

export const TRENDING = ["SOL", "ORB", "ARB"];

// Debounced value: updates 250 ms after the input stops changing (US-2.5).
export function useDebounced(value, delay = 250) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Browser connection state, updated on the online/offline events (US-9.5).
export function useOnline() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

// Current time, refreshed every `intervalMs` (countdowns, "Updated 2m ago"); null pauses it.
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (intervalMs == null) return undefined;
    // Catch up straight away when a paused clock starts.
    const first = window.setTimeout(() => setNow(Date.now()), 0);
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(id);
    };
  }, [intervalMs]);
  return now;
}

// Page title: "<label> · CPA" (or the label alone with suffix false). AppShell listens, and
// announces the label when it arrives for a new path (route changes are otherwise silent).
let titleListener = null;
export const listenForPageTitles = (listener) => {
  titleListener = listener;
  return () => {
    if (titleListener === listener) titleListener = null;
  };
};
export function usePageTitle(label, suffix = true) {
  useEffect(() => {
    if (!label) return;
    document.title = suffix ? `${label} · CPA` : label;
    titleListener?.(label);
  }, [label, suffix]);
}

// Sample data is in memory, so each page shows its loading state once per visit,
// for `ms`, so the skeletons in the specs are real states rather than dead code.
const loadedPages = new Set();
export function useFirstLoad(key, ms = 450) {
  const [loading, setLoading] = useState(() => !loadedPages.has(key));
  useEffect(() => {
    if (loadedPages.has(key)) return undefined;
    const id = window.setTimeout(() => {
      loadedPages.add(key);
      setLoading(false);
    }, ms);
    return () => window.clearTimeout(id);
  }, [key, ms]);
  return loading;
}

// Error banner with Retry. In this sample-data build an error is simulated with ?simulate=error
// (the same switch Market and Home use), and Retry clears it.
export function useSimulatedError() {
  const [params, setParams] = useSearchParams();
  const failed = params.get("simulate") === "error";
  const retry = () => {
    const next = new URLSearchParams(params);
    next.delete("simulate");
    setParams(next, { replace: true });
  };
  return [failed, retry];
}
