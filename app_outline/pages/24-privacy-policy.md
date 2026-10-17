# Privacy policy
**Route:** `/privacy`  ·  **Nav:** no tab active; from footer, hamburger, sign-up checkbox, Settings → Privacy  ·  **Personas:** all  ·  **Source stories:** section 15–17 (data, permissions), NFR Privacy

## Purpose
Explain what CPA collects, where it is stored (this browser only), how it is used, and how users control or remove it.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Privacy policy                               │
│ Last updated Oct 17, 2026                    │
│ ┌ In short ────────────────────────────────┐ │
│ │ • Your data stays in this browser.       │ │
│ │ • We don't sell personal data.           │ │
│ │ • The demo stores nothing.               │ │
│ │ • Delete or export anytime in Settings.  │ │
│ └──────────────────────────────────────────┘ │
│ What we collect                              │
│ ┌──────────────┬─────────────┬────────────┐  │
│ │ Data         │ Why         │ Where      │  │
│ │ Name, email  │ Account     │ This browser│ │
│ │ Watchlists   │ Tracking    │ This browser│ │
│ │ ...                                     │  │
│ └──────────────┴─────────────┴────────────┘  │
│ Your choices · Cookies and storage · …       │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- "In short" summary card.
- **What we collect** table (crypto-adapted from section 16): account info (name, email, salted password hash); subscription plan and simulated billing details (card brand, last 4, expiry only); watchlists and starred coins; portfolio transactions; alerts, reminders, follows; browsing history of coins viewed; coin sentiment votes; search queries and saved filters; settings and accessibility preferences; device info for the setup check (not stored); feedback, tickets, and bug reports; promo and points usage; optional local usage analytics (off by default).
- **Permissions:** notifications (asked only when you set an alert), local storage, clipboard (copy actions only).
- **Your choices:** clear history, clear searches, export JSON, delete account, data-removal ticket, analytics opt-in.
- **Cookies and storage:** list of `cpa:v1:*` keys and purpose; no third-party trackers.
- Retention, children (18+), changes, contact.

## User stories & acceptance criteria
- **US-P24.1 Understand my data.** As Leo, I want a plain summary so that I know what's kept and where.
- **US-P24.2 Act on it.** Each "Your choices" item links to the matching Settings section anchor.

## States
- Static.

## Data & persistence
- None (describes the persistence model in 00-app-shell.md).

## Done when (phase passing conditions)
- [ ] Table lists every data type stored by the app (matches localStorage keys in use).
- [ ] Links to Settings anchors work.
