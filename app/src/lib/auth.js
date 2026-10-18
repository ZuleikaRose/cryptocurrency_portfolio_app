// Accounts (13–16 specs) on Supabase Auth: passwords, sessions, reset links and rate limits
// are handled by the server. This file keeps the client-side rules and maps Auth errors.
import { leakedPasswords } from "../data/leakedPasswords.js";
import { supabase } from "./supabase.js";

export const LOCK_AFTER = 5;
export const LOCK_MS = 60_000;

// Only same-app paths are allowed as ?next targets (no "//host" or "/\\host").
export const safeNext = (value) => (typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/");
export const normalizeEmail = (email) => email.trim().toLowerCase();
export const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

// Password rules (13-login-signup.md); `differentFrom` adds "different from current password".
export function passwordChecks(password, { differentFrom } = {}) {
  const checks = [
    { id: "length", label: "At least 13 characters", ok: password.length >= 13 },
    { id: "lower", label: "A lowercase letter", ok: /[a-z]/.test(password) },
    { id: "upper", label: "An uppercase letter", ok: /[A-Z]/.test(password) },
    { id: "digit", label: "A number", ok: /\d/.test(password) },
    { id: "symbol", label: "A symbol", ok: /[^A-Za-z0-9]/.test(password) },
    { id: "leak", label: "Not found in known data leaks", ok: password.length > 0 && !leakedPasswords.has(password.toLowerCase()) },
  ];
  if (differentFrom !== undefined) checks.push({ id: "different", label: "Different from current password", ok: differentFrom });
  return checks;
}

export function passwordErrors(checks) {
  const failing = checks.filter((check) => !check.ok);
  if (failing.some((check) => check.id === "leak") && failing.length === 1) return ["This password has appeared in a data leak. Choose a different one."];
  return failing.map((check) => (check.id === "leak" ? "This password has appeared in a data leak. Choose a different one." : `Password needs: ${check.label.toLowerCase()}.`));
}

// Supabase Auth error -> the app's error kinds. Unknown errors count as "network" so the
// message tells the user to check their connection and retry.
export function authErrorKind(error) {
  if (!error) return null;
  const code = error.code ?? "";
  if (code === "invalid_credentials") return "invalid";
  if (code === "user_already_exists" || code === "email_exists" || code === "identity_already_exists") return "exists";
  if (code === "weak_password") return "weak";
  if (code === "same_password") return "same";
  if (code === "email_not_confirmed") return "unconfirmed";
  if (code === "email_address_invalid") return "email";
  if (code.startsWith("over_") || error.status === 429) return "limited";
  return "network";
}

// --- Login lockout: 5 failures lock the form for 60 s (kept for this tab session) ---
// Supabase Auth rate-limits on the server too; this keeps the spec's visible countdown.
const failures = { count: 0, lockedUntil: 0 };
export const lockState = () => ({ ...failures });
export function recordFailure(now = Date.now()) {
  failures.count += 1;
  if (failures.count >= LOCK_AFTER) {
    failures.lockedUntil = now + LOCK_MS;
    failures.count = 0;
  }
  return lockState();
}
export const clearFailures = () => {
  failures.count = 0;
  failures.lockedUntil = 0;
};

// --- Password reset (14-forgot-reset-password.md) ---
// Returns { status: "sent" } whether or not the account exists (Auth doesn't say), or
// { status: "limited" } | { status: "network" } | { status: "unavailable" }.
export async function requestReset(email) {
  if (!supabase) return { status: "unavailable" };
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(normalizeEmail(email), {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (!error) return { status: "sent" };
    return { status: authErrorKind(error) === "limited" ? "limited" : "network" };
  } catch {
    return { status: "network" };
  }
}

// Sets the new password for the recovery session the reset link opened.
// Returns "ok" | "same" | "weak" | "invalid" (session gone: request a new link) | "failed".
export async function completeReset(password) {
  if (!supabase) return "failed";
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) return "ok";
    const kind = authErrorKind(error);
    if (kind === "same" || kind === "weak") return kind;
    return error.status === 401 || error.code === "session_not_found" ? "invalid" : "failed";
  } catch {
    return "failed";
  }
}
