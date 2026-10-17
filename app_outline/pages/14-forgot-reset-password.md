# Forgot password / Reset password
**Route:** `/forgot-password`, `/reset-password?token=…`  ·  **Nav:** no tab active; from "Forgot password?" on Log in  ·  **Personas:** all signed-up users  ·  **Source stories:** US-P14.x (new)

## Purpose
Let a user who forgot their password request a reset link and choose a new password. There is no backend, so the "email" is shown in an in-app simulated inbox.

## Wireframe (phone, ~430px)
```
Forgot password                              Simulated inbox (after submit)
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ [C] CPA              [♿] [🔔] [≡]    │     │ ✓ Check your email                   │
├──────────────────────────────────────┤     │ If an account exists for             │
│ ‹ Log in                             │     │ maya@example.com, we sent a link.    │
│ Reset your password                  │     │ It expires in 30 minutes.            │
│ Enter your account email and we'll   │     │ ┌ Simulated email (demo only) ─────┐ │
│ send you a reset link.               │     │ │ From: CPA <no-reply@cpa.app>     │ │
│ Email                                │     │ │ To: maya@example.com             │ │
│ [ maya@example.com              ]    │     │ │ Subject: Reset your CPA password │ │
│ [ Send reset link ]                  │     │ │ Use this link within 30 minutes: │ │
│                                      │     │ │ [ Reset password ]               │ │
│                                      │     │ │ Sent Oct 17, 2026 14:10          │ │
│                                      │     │ └──────────────────────────────────┘ │
│                                      │     │ Simulate expired link (testing)      │
│                                      │     │ Resend link                          │
└──────────────────────────────────────┘     └──────────────────────────────────────┘

Reset password (valid token)                 Expired or used link
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ Choose a new password                │     │ ⚠ This link has expired              │
│ for maya@example.com                 │     │ Reset links last 30 minutes and work │
│ New password   [ ••••••••••   [👁] ] │     │ once. Request a new one.             │
│  ✓ 13+ chars ✓ lower ✓ upper         │     │ Email [ maya@example.com        ]    │
│  ✓ number ✓ symbol ✓ not leaked      │     │ [ Send new link ]                    │
│  ✗ Different from current password   │     └──────────────────────────────────────┘
│ Confirm        [ ••••••••••        ] │
│ [ Save new password ]                │
└──────────────────────────────────────┘
```

## Components & content
- Forgot form: email, Send reset link. Same confirmation message whether or not the account exists (no account enumeration); the simulated email only shows when it does exist.
- Simulated inbox card labelled "Simulated email (demo only)" with a Reset password button linking to `/reset-password?token=…`. Testing link "Simulate expired link" sets the token expiry to the past.
- Reset form: same password rules and checklist as 13-login-signup.md, plus "must differ from the current password".
- Expired/invalid/used token view with the email prefilled and "Send new link".

## User stories & acceptance criteria
- **US-P14.1 Request link.** Given I enter my email, when I tap Send reset link, then a token (random, 32 bytes, expires in 30 min) is stored and the simulated email appears. Resend invalidates the previous token.
- **US-P14.2 Choose new password.** Given a valid token, when I save a password that passes all rules, then the hash is updated, the token is marked used, I'm signed out of any session, and I land on `/login` with toast "Password updated. Log in with your new password."
- **US-P14.3 Expired link.** Given the token is expired, used, or unknown, when I open the link, then I see "This link has expired" and can request a new one.
- **US-P14.4 Demo.** The demo account has no password; entering its name/email shows the generic confirmation and no email.

## States
- Submitting: "Sending…". Rate limit: max 3 requests per email per 10 minutes ("Try again in 6 minutes.").

## Data & persistence
- `cpa:v1:resetTokens`: `[{ tokenHash, accountId, expiresAt, usedAt }]` in localStorage (so the link works after refresh). Expired entries are cleaned on load.

## Done when (phase passing conditions)
- [ ] Request → simulated email → Reset password → new password works on Log in; old one doesn't.
- [ ] "Simulate expired link" then opening the link shows the expired view.
- [ ] Reusing a used link shows the expired view.
- [ ] Unknown email shows the same confirmation without an email card.
