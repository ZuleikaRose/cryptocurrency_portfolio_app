# Log out
**Route:** `/logout`  ·  **Nav:** no tab active; from the hamburger menu and Settings  ·  **Personas:** all signed-in and demo users  ·  **Source stories:** US-P15.x (new)

## Purpose
End the session securely with a confirmation, and make clear what happens to data (account data stays in this browser; demo data is discarded).

## Wireframe (phone, ~430px)
```
Confirm                                      Done
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ [C] CPA              [♿] [🔔] [≡]    │     │ [C] CPA              [♿] [🔔] [≡]    │
├──────────────────────────────────────┤     ├──────────────────────────────────────┤
│ Log out of CPA?                      │     │ ✓ You're logged out                  │
│ Signed in as maya@example.com        │     │ Your watchlist, portfolio, and       │
│ Your watchlist, portfolio, alerts,   │     │ alerts are saved in this browser for │
│ and settings stay saved in this      │     │ next time.                           │
│ browser. Alerts won't fire while     │     │ ┌──────────────────────────────────┐ │
│ you're logged out.                   │     │ │            Log in                │ │
│ ┌──────────────────────────────────┐ │     │ └──────────────────────────────────┘ │
│ │            Log out               │ │     │ Continue browsing as guest           │
│ └──────────────────────────────────┘ │     │ ⓘ On a shared computer? Delete your  │
│ Cancel                               │     │ account data from Settings first.    │
└──────────────────────────────────────┘     └──────────────────────────────────────┘

Demo variant: "End the demo? Everything you changed in the demo will be discarded." [End demo]
```

## Components & content
- Confirmation view with account email, explanation, primary Log out (or "End demo"), Cancel (returns to previous page).
- Done view with Log in and "Continue browsing as guest" (→ `/`).

## User stories & acceptance criteria
- **US-P15.1 Log out.** Given I'm signed in, when I confirm, then `cpa:v1:session` is removed, in-memory user state is cleared, overlays close, and the Done view shows; the back button can't reopen account pages (they redirect to `/login`).
- **US-P15.2 End demo.** Given demo mode, when I confirm, then all demo state is discarded and I'm a guest.
- **US-P15.3 Not signed in.** Given a guest opens `/logout`, then they're redirected to `/` with no message.
- **US-P15.4 Other tabs.** Given the app is open in two tabs, when I log out in one, then the other switches to guest on its next `storage` event.

## States
- Guest: redirect. Signed in / demo: copy as above.

## Data & persistence
- Removes only `cpa:v1:session`. Account and user data remain in localStorage.

## Done when (phase passing conditions)
- [ ] Log out → refresh → still guest; Log in restores the same watchlist.
- [ ] End demo returns to guest with no demo data.
- [ ] `/portfolio` after logout shows the guest view.
