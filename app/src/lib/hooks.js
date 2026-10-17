import { useEffect, useState } from "react";

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
