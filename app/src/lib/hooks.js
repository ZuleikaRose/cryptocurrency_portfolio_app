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

// Current time, refreshed every `intervalMs` (countdowns, "Updated 2m ago").
export function useNow(intervalMs) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
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
