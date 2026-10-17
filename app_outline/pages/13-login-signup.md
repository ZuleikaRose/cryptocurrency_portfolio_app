# Log in / Sign up
**Route:** `/login`, `/signup` (same page, two tabs; `?next=/path` returns after success)  ·  **Nav:** no tab active; reached from the hamburger menu, guest sign-in sheet, and Logout page  ·  **Personas:** all  ·  **Source stories:** US-1.1, US-1.2 (adapted), US-6.1

## Purpose
Create an account, log in, or try a private demo. Signed-up accounts persist in this browser's localStorage; the demo lives only in memory and resets on refresh.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Welcome to CPA                               │
│ Track coins, unlocks, and funding in one     │
│ place.                                       │
│ (■Log in■) (Create account)                  │
│                                              │
│ Email                                        │
│ [ maya@example.com                      ]    │
│ Password                                     │
│ [ ••••••••••••••                   [👁] ]    │
│                        Forgot password?      │
│ ┌──────────────────────────────────────────┐ │
│ │                 Log in                   │ │
│ └──────────────────────────────────────────┘ │
│ ─────────────── or ───────────────           │
│ ┌──────────────────────────────────────────┐ │
│ │          Try a private demo              │ │  secondary
│ └──────────────────────────────────────────┘ │
│ The demo uses sample data, isn't saved, and  │
│ resets when you refresh.                     │
│ ⓘ Accounts are stored in this browser only.  │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘

Create account tab
│ Name             [ Maya Chen               ] │
│ Email            [ maya@example.com        ] │
│ Password         [ ••••••••••••••     [👁] ] │
│  ✓ At least 13 characters                    │
│  ✓ A lowercase letter   ✓ An uppercase letter│
│  ✓ A number             ✗ A symbol           │
│  ✓ Not found in known data leaks             │
│ Confirm password [ ••••••••••••••          ] │
│ ☐ I agree to the Terms of service and        │
│   Privacy policy                             │
│ [ Create account ]                           │
```

## Components & content
- Tabs Log in / Create account (`role="tablist"`), URL switches `/login` ↔ `/signup`.
- Log in: email, password with show/hide, "Forgot password?" → `/forgot-password`, primary Log in.
- Create account: name, email, password with live checklist (`aria-live="polite"`, each item ✓/✗ plus text), confirm password, Terms/Privacy checkbox with links.
- "Try a private demo" (secondary): starts the demo session and goes to `?next` or `/`.
- No social or magic-link sign-in (no backend); email + password only.

## Password rules (new passwords, also used on reset and change password)
1. At least 13 characters.
2. At least one lowercase letter, one uppercase letter, one digit, and one symbol (any non-letter, non-digit character).
3. Not in the bundled leaked-password list (a local list of commonly breached passwords, compared case-insensitively). Error: "This password has appeared in a data leak. Choose a different one." Test fixture: `Password1234!` must be refused even though it meets rules 1–2.
4. Confirm must match: "Passwords don't match."

## User stories & acceptance criteria
- **US-P13.1 Sign up.** As Leo, I want to create an account so that my watchlist and portfolio are kept.
  - Given valid fields, when I tap Create account, then an account is saved to localStorage, I'm signed in, guest data merges, and I land on `?next` or Home with toast "Account created".
  - Given the email already exists, then "An account with this email already exists. Log in instead?" with a link.
  - The Create account button stays enabled; on submit, every failing rule is listed and focus moves to the first invalid field.
- **US-P13.2 Log in.** Given a registered email and correct password, then I'm signed in and the session persists across refreshes until Log out.
  - Wrong email or password: "Email or password is incorrect." (never says which). After 5 failures, the form locks for 60 s with a countdown.
  - Deleted accounts: "This account was deleted. Contact support to restore access or remove your data."
- **US-P13.3 Private demo.** As a visitor, I want a demo account so that I can try personal features without signing up.
  - Given I tap "Try a private demo", then I'm "Demo user" with seeded watchlist, portfolio, and alerts, a demo banner shows, nothing is written to localStorage, and refresh returns me to guest.
- **US-1.1 Pending action.** Given I came from the sign-in sheet to set an alert, then after success the alert is created.

## States
- Submitting: button shows "Logging in…" and is disabled. Already signed in: visiting `/login` redirects to `/`.

## Data & persistence
- `cpa:v1:accounts`: `{ id, name, email (lowercased), passwordHash, salt, createdAt, plan, status }`. Password hashed with PBKDF2-SHA-256 via Web Crypto (salted); plain text never stored.
- `cpa:v1:session`: `{ userId, createdAt }`.
- Demo user and guest: memory only. A notice says browser storage is not a secure server and is for demonstration.

## Done when (phase passing conditions)
- [ ] `Password1234!` is refused with the data-leak message; a 12-character password is refused for length.
- [ ] Checklist items tick live as I type.
- [ ] Sign up, refresh → still signed in; Log out → Log in works with the same password.
- [ ] Wrong password shows the generic error; 5 failures lock the form.
- [ ] Demo starts with seeded data and is gone after refresh; localStorage has no demo keys.
