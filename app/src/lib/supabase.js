// Supabase client for signed-up accounts (tables in the `cpa` schema). Uses the publishable
// key only; row-level security limits every request to the signed-in user's own rows.
import { createClient } from "@supabase/supabase-js";
import { keys } from "./storage.js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// Read before the client consumes the URL hash: a password reset link lands with
// #…&type=recovery, or #error=…&error_code=otp_expired when the link has expired (14-forgot-reset-password.md).
function readRecoveryHash() {
  try {
    const params = new URLSearchParams(window.location.hash.slice(1));
    if (params.get("type") === "recovery") return { status: "valid" };
    if (params.get("error_code") || params.get("error")) return { status: "invalid" };
  } catch {
    // No usable hash.
  }
  return { status: "none" };
}
export const recoveryLink = readRecoveryHash();

export const supabase = url && key
  ? createClient(url, key, {
    db: { schema: "cpa" },
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: keys.auth },
  })
  : null;
