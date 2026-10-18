// localStorage keys and guarded access. Account data lives in Supabase (lib/cloud.js); the
// browser keeps only the Auth session. Every access is guarded: storage can be unavailable
// (private mode, blocked site data) and the app must still work.

const PREFIX = "cpa:v1:";

export const keys = {
  auth: `${PREFIX}auth`, // Supabase Auth session (lib/supabase.js)
  probe: `${PREFIX}probe`,
};

export function readJson(key, fallback = null) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// Returns false when the browser refused (the key may still be there).
export function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}
