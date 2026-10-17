# Terms of service
**Route:** `/terms`  ·  **Nav:** no tab active; from footer, hamburger, sign-up checkbox  ·  **Personas:** all  ·  **Source stories:** section 15 Legal pages

## Purpose
State the rules for using CPA, user responsibilities, and limits of liability, in readable sections.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Terms of service                             │
│ Last updated Oct 17, 2026                    │
│ Contents ▾                                   │
│  1. Who we are   2. Using CPA   3. Accounts  │
│  4. Subscriptions  5. Not financial advice   │
│  6. Data accuracy  7. Acceptable use  …      │
│ ──────────────────────────────────────────── │
│ 1. Who we are                                │
│ CPA (Cryptocurrency Portfolio App) is …      │
│ 5. Not financial advice                      │
│ CPA shows information only. Nothing in the   │
│ app is a recommendation to buy or sell.      │
│ …                                            │
│ [↑ Back to top]                              │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
Sections: who we are; eligibility (18+); using CPA; accounts and security (stored in your browser, you're responsible for your device); subscriptions, billing changes, pauses, cancellation, refunds; promotions and points (no cash value); affiliate program reference; not financial advice; data accuracy (sample data, may be delayed or wrong); acceptable use; intellectual property; account deletion and data removal (via support); limitation of liability; changes to terms; contact.
- Table of contents with anchor links; headings H2; "Back to top" link.
- Placeholder legal text is marked "Draft: to be reviewed by counsel" in a visible note until replaced.

## User stories & acceptance criteria
- **US-P23.1 Read terms.** Given I tap a contents link, then the page scrolls to that heading and focus moves to it.
- Sign-up checkbox link opens `/terms` in the same tab and returning keeps form contents.

## States
- Static.

## Data & persistence
- None.

## Done when (phase passing conditions)
- [ ] All sections listed above exist with anchors.
- [ ] "Last updated" date displays as Oct 17, 2026 format.
