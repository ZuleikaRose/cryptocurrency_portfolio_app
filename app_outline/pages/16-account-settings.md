# Account settings
**Route:** `/settings` with sections `#profile`, `#subscription`, `#payment`, `#preferences`, `#notifications`, `#privacy`, `#accessibility`, `#danger-zone`  ·  **Nav:** no tab active; from the hamburger menu and Explore  ·  **Personas:** all  ·  **Source stories:** US-9.1, US-9.2, US-9.3, US-9.6, US-2.4, US-7.3, US-7.4

## Purpose
Manage profile, subscription and billing, payment options, preferences, notifications, privacy, accessibility, and account deletion.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Account settings                             │
│ Profile · Plan · Payment · Preferences · …   │  sticky section chips
│                                              │
│ Profile                                      │
│ Name   [ Maya Chen                 ]         │
│ Email  [ maya@example.com          ]         │
│ [Change password]          [ Save ]          │
│                                              │
│ Subscription & billing                       │
│ ┌──────────────────────────────────────────┐ │
│ │ CPA Pro · $9.99/month · Active           │ │
│ │ Next billing date: Nov 3, 2026           │ │
│ │ [Change billing date] [Pause] [Cancel]   │ │
│ │ Switch plan: (Free)(■Pro monthly■)       │ │
│ │              (Pro yearly $95.88)         │ │
│ └──────────────────────────────────────────┘ │
│ Billing history: Oct 3, 2026 $9.99 Paid      │
│                                              │
│ Payment options                              │
│ 💳 Visa •••• 4242 · exp 08/28  Default  [⋯]  │
│ [+ Add card]  [+ Add PayPal (simulated)]     │
│                                              │
│ Preferences                                  │
│ Theme          (Dark)(Light)(System)         │
│ Currency       [ USD ⌄ ]                     │
│ Up/down colours (Green up)(Red up)           │
│                (Blue/orange, colour-blind)   │
│ Density        (Simple)(Pro)                 │
│ Auto-refresh live prices        [■ On]       │
│ Auto-play chart animations      [■ On]       │
│ Auto-advance onboarding cards   [□ Off]      │
│ Default chart range  [ 1M ⌄ ]                │
│                                              │
│ Notifications                                │
│ Weekly digest (Mon 08:00)       [■ On]       │
│ Quiet hours  22:00 – 07:00      [■ On]       │
│                                              │
│ Privacy                                      │
│ Recently viewed coins   [Clear history]      │
│ Recent searches         [Clear]              │
│ Usage analytics (local only)    [□ Off]      │
│ [Export my data (.json)]                     │
│                                              │
│ Accessibility                                │
│ Open accessibility menu ›   Keyboard         │
│ shortcuts ›   Chart text summaries [■ On]    │
│                                              │
│ ┌ Danger zone ─────────────────────────────┐ │  red outline
│ │ Delete account                           │ │
│ │ Cancel your subscription first. Deleting │ │
│ │ removes your access to CPA. To remove    │ │
│ │ your data too, contact support.          │ │
│ │ [ Delete account ] (red, disabled while  │ │
│ │   subscription is active)                │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘

Delete account dialog
┌──────────────────────────────────────────────┐
│ Delete your CPA account?                     │
│ This removes your access to CPA. Your data   │
│ stays until you ask support to remove it.    │
│ Type your email to confirm                   │
│ [ maya@example.com                    ]      │
│ Password [ ••••••••••••••             ]      │
│ [Cancel]              [ Delete account ]     │
│ Want your data removed too? Contact support ›│
└──────────────────────────────────────────────┘
```

## Components & content
- **Profile:** name, email (unique), Change password (current + new with the rules from 13), Save.
- **Subscription & billing (simulated, no charges):** plans Free, Pro monthly $9.99, Pro yearly $95.88. Actions: Change billing date (pick day 1–28; next date recalculates), Pause (1, 2, or 3 months; status "Paused until Jan 17, 2027", resume anytime), Cancel (confirm; access continues to end of period, status "Cancels on Nov 3, 2026"), Resume. Billing history table. Promo code field (see 21).
- **Payment options:** cards (test numbers only, e.g. 4242 4242 4242 4242; only brand, last 4, expiry stored), PayPal (simulated), set default, remove. Full card numbers and CVC are never stored.
- **Preferences (replace section 15's autoplay settings):** theme, currency (USD, EUR, GBP, BTC, ETH), up/down colour convention (US-9.2), density, auto-refresh live prices, auto-play chart animations, auto-advance onboarding cards, default chart range.
- **Notifications:** weekly digest, quiet hours, browser notification status.
- **Privacy:** clear browsing history of coins viewed, clear recent searches, local analytics opt-in, export data as JSON.
- **Accessibility:** opens the accessibility menu (27), keyboard shortcuts list, chart text summaries toggle.
- **Danger zone:** red Delete account button.

## User stories & acceptance criteria
- **US-9.1 Theme & currency.** Changes apply instantly app-wide and persist.
- **US-9.2 Colour conventions.** "Red up" swaps colours; colour-blind mode uses blue up / orange down; ▲/▼ and signs stay.
- **US-P16.1 Billing controls.** As a subscriber, I want to change my billing date, pause, or cancel so that I control what I pay. Each action shows a confirmation and updates the plan card text.
- **US-9.6 Delete account (exact rules from section 15).**
  - Given my subscription is Active or Paused, then Delete account is disabled with "Cancel your subscription first. Delete won't work until it is cancelled." and a link to Cancel. (Free plan, or a cancelled plan, counts as cancelled.)
  - Given it is cancelled, when I open the dialog, then I must type my exact email and enter my password; Delete stays disabled until the email matches; a wrong password shows "Password is incorrect."
  - Given both are correct, then the account status becomes `deleted`, I'm logged out, and a page says "Your account is deleted. You no longer have access. Your data is kept until you ask us to remove it. Contact support to submit a data-removal ticket." with a link to `/support?topic=data-removal`.
  - Deleting only removes access; data removal happens only through a support ticket (17).
- **US-P16.2 Export data.** Export downloads `cpa-export-<date>.json` with the user's localStorage data (no password hash).

## States
- **Guest:** page shows sign-in prompt. **Demo:** all controls work in memory; Danger zone shows "Not available in the demo."
- Saving: inline "Saved" confirmation next to each changed control.

## Data & persistence
- All settings in `cpa:v1:user:<id>.settings`; plan/billing/payment in `.billing`; account status in `cpa:v1:accounts`.
- Demo: memory only.

## Done when (phase passing conditions)
- [ ] Theme and currency changes apply immediately and survive refresh.
- [ ] Change billing date, pause, resume, cancel all update the plan card.
- [ ] Delete is disabled while Pro is active; after cancel, wrong email keeps it disabled; correct email + password deletes and logs out.
- [ ] Logging in to a deleted account shows the deleted message.
- [ ] Export downloads JSON without the password hash.
