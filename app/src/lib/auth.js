// Browser-only accounts (13–16 specs). Browser storage is not a secure server: this is
// for demonstration. Passwords are never stored; only a salted PBKDF2-SHA-256 hash.
import { leakedPasswords } from "../data/leakedPasswords.js";
import { keys, readJson, writeJson } from "./storage.js";

export const PBKDF2_ITERATIONS = 310_000;
const RESET_TTL_MS = 30 * 60_000;
const RESET_WINDOW_MS = 10 * 60_000;
const RESET_LIMIT = 3;
export const LOCK_AFTER = 5;
export const LOCK_MS = 60_000;

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const toHex = (bytes) => [...new Uint8Array(bytes)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
const randomBytes = (length) => crypto.getRandomValues(new Uint8Array(length));
// Only same-app paths are allowed as ?next targets (no "//host" or "/\\host").
export const safeNext = (value) => (typeof value === "string" && /^\/(?![/\\])/.test(value) ? value : "/");
export const normalizeEmail = (email) => email.trim().toLowerCase();
export const isEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

export async function hashPassword(password, salt, iterations = PBKDF2_ITERATIONS) {
  const material = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const saltBytes = Uint8Array.from(atob(salt), (char) => char.charCodeAt(0));
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: saltBytes, iterations }, material, 256);
  return toBase64(bits);
}

// Length-independent comparison so timing doesn't hint at how much of a hash matched.
function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Web Crypto is missing on insecure (non-HTTPS, non-localhost) origins and can throw;
// callers turn this into a clear "can't do that in this browser" message.
export class CryptoUnavailableError extends Error {}
async function withCrypto(task) {
  if (!globalThis.crypto?.subtle) throw new CryptoUnavailableError("Web Crypto is unavailable");
  try {
    return await task();
  } catch (error) {
    throw new CryptoUnavailableError(error?.message ?? "Web Crypto failed");
  }
}

export async function verifyPassword(account, password) {
  if (!account?.salt || !account?.passwordHash) return false;
  const hash = await withCrypto(() => hashPassword(password, account.salt, account.iterations ?? PBKDF2_ITERATIONS));
  return safeEqual(hash, account.passwordHash);
}

export async function newPasswordRecord(password) {
  return withCrypto(async () => {
    const salt = toBase64(randomBytes(16));
    return { salt, iterations: PBKDF2_ITERATIONS, passwordHash: await hashPassword(password, salt) };
  });
}

// Password rules (13-login-signup.md); `current` adds "different from current password" (reset).
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

// --- Account records (cpa:v1:accounts) ---
export function getAccounts() {
  const list = readJson(keys.accounts, []);
  return Array.isArray(list) ? list.filter((item) => item && typeof item.id === "string" && typeof item.email === "string") : [];
}
export const saveAccounts = (list) => writeJson(keys.accounts, list);
export const findAccount = (email) => getAccounts().find((item) => item.email === normalizeEmail(email));
export const accountById = (id) => getAccounts().find((item) => item.id === id);

export function updateAccount(id, patch) {
  const list = getAccounts();
  const next = list.map((item) => (item.id === id ? { ...item, ...patch } : item));
  return saveAccounts(next) ? next.find((item) => item.id === id) : null;
}

export async function createAccount({ name, email, password }) {
  const record = await newPasswordRecord(password);
  const account = {
    id: `user-${toHex(randomBytes(8))}`,
    name: name.trim(),
    email: normalizeEmail(email),
    ...record,
    createdAt: new Date().toISOString(),
    plan: "free",
    status: "active",
  };
  return saveAccounts([...getAccounts(), account]) ? account : null;
}

// --- Login lockout: 5 failures lock the form for 60 s (kept for this tab session) ---
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

// --- Reset tokens (cpa:v1:resetTokens): only a SHA-256 hash of each token is stored ---
async function sha256(text) {
  return withCrypto(async () => toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))));
}
function getTokens(now = Date.now()) {
  const list = readJson(keys.resetTokens, []);
  // Drop malformed entries and anything expired more than a day ago.
  return Array.isArray(list) ? list.filter((item) => item && typeof item.tokenHash === "string" && item.expiresAt > now - 86_400_000) : [];
}
const requestLog = new Map(); // email -> request times, per tab session (rate limit applies to unknown emails too)

// Returns { status: "sent", token, sentAt, email } | { status: "no-account" } | { status: "limited", minutes }
// | { status: "storage" } when the browser refused to save the token (the link would never work)
// | { status: "crypto" } when Web Crypto is unavailable.
export async function requestReset(email, now = Date.now()) {
  try {
    return await requestResetUnsafe(email, now);
  } catch (error) {
    if (error instanceof CryptoUnavailableError) return { status: "crypto" };
    throw error;
  }
}
async function requestResetUnsafe(email, now) {
  const address = normalizeEmail(email);
  const recent = (requestLog.get(address) ?? []).filter((time) => now - time < RESET_WINDOW_MS);
  if (recent.length >= RESET_LIMIT) return { status: "limited", minutes: Math.ceil((RESET_WINDOW_MS - (now - recent[0])) / 60_000) };
  requestLog.set(address, [...recent, now]);
  const account = findAccount(address);
  if (!account || account.status === "deleted") return { status: "no-account" };
  const token = toHex(randomBytes(32));
  // A new link invalidates earlier ones for this account.
  const others = getTokens(now).filter((item) => item.accountId !== account.id);
  const saved = writeJson(keys.resetTokens, [...others, { tokenHash: await sha256(token), accountId: account.id, expiresAt: now + RESET_TTL_MS, usedAt: null }]);
  if (!saved) return { status: "storage" };
  return { status: "sent", token, sentAt: now, email: account.email };
}

export async function lookupReset(token, now = Date.now()) {
  if (!/^[0-9a-f]{64}$/.test(token ?? "")) return null;
  let hash;
  try {
    hash = await sha256(token);
  } catch {
    return null; // Treated as an invalid link; the page offers a new one.
  }
  const entry = getTokens(now).find((item) => item.tokenHash === hash);
  if (!entry || entry.usedAt || entry.expiresAt <= now) return { valid: false, account: entry ? accountById(entry.accountId) : null };
  const account = accountById(entry.accountId);
  return account && account.status !== "deleted" ? { valid: true, account } : { valid: false, account: null };
}

// Returns false if the browser refused the write (or Web Crypto failed).
export async function expireReset(token) {
  let hash;
  try {
    hash = await sha256(token);
  } catch {
    return false;
  }
  return writeJson(keys.resetTokens, getTokens().map((item) => (item.tokenHash === hash ? { ...item, expiresAt: Date.now() - 1000 } : item)));
}

// Returns "ok" | "invalid" (expired, used or unknown link) | "failed" (nothing changed, link still usable)
// | "failed-link-used" (nothing changed, but the link couldn't be restored: request a new one).
export async function completeReset(token, password) {
  try {
    const result = await lookupReset(token);
    if (!result?.valid) return "invalid";
    const hash = await sha256(token);
    // Burn the token first: if that write fails, stop before the password changes, so a
    // link that couldn't be marked used never resets anything.
    const tokens = getTokens();
    if (!writeJson(keys.resetTokens, tokens.map((item) => (item.tokenHash === hash ? { ...item, usedAt: Date.now() } : item)))) return "failed";
    const record = await newPasswordRecord(password).catch(() => null);
    if (record && updateAccount(result.account.id, record)) return "ok";
    // Put the unused token back so the same link can be retried.
    return writeJson(keys.resetTokens, tokens) ? "failed" : "failed-link-used";
  } catch {
    return "failed";
  }
}
