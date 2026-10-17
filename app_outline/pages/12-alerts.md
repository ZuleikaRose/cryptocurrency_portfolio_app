# Alerts
**Route:** `/alerts` (tabs `?tab=notifications|my-alerts|following`)  ·  **Nav:** no tab active; reached from the top-bar bell and hamburger menu  ·  **Personas:** Maya, Priya  ·  **Source stories:** US-7.1, US-7.2, US-7.3, US-7.4, US-4.2, US-5.4, US-1.4

## Purpose
One place for triggered notifications and for creating, pausing, editing, and deleting price alerts, unlock and sale reminders, and fund follows.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔•2] [≡]  │
├──────────────────────────────────────────────┤
│ Alerts                         [ + New ]     │
│ (■Notifications 2■) (My alerts 3) (Following)│
│ ┌ ⓘ Browser notifications are off. ────────┐ │
│ │ Alerts still show here. [Turn on]        │ │
│ └──────────────────────────────────────────┘ │
│ Today                       Mark all read    │
│ ● (B) BTC above $67,500                      │
│   Now $67,682.43 · ▲ +2.18% 24h · 14:02      │
│ ● (A) ARB unlock in 1 hour                   │
│   92.65M ARB (3.21% of supply) · $78.4M      │
│ Yesterday                                    │
│ ○ [N] Northstar Capital led Driftnet $28.5M  │
│                                              │
│ My alerts tab:                               │
│ (B) BTC · Price above $70,000                │
│     Recurring · [■ On]          [Edit] [🗑]  │
│ (E) ETH · Price below $3,500                 │
│     One-time · [□ Paused]       [Edit] [🗑]  │
│ (A) ARB · Unlock Oct 20 · 1h before          │
│                     [■ On]      [Edit] [🗑]  │
│                                              │
│ Following tab:                               │
│ [N] Northstar Capital · Daily digest   [⌄]   │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘

New alert sheet
┌──────────────────────────────────────────────┐
│ New price alert                         [✕]  │
│ Coin   [ (B) Bitcoin BTC  $67,682.43   ⌄ ]   │
│ When   (■Price above■)(Price below)          │
│        (% change 1h)(% change 24h)           │
│ Value  [ $70,000.00 ]  +3.42% from now       │
│ Repeat (■One-time■)(Recurring · 1h cool-down)│
│ ☐ Bypass quiet hours                         │
│ [ Set alert ]                                │
└──────────────────────────────────────────────┘
```

## Components & content
- Tabs: Notifications (triggered, grouped by day, unread dot, Mark all read), My alerts (price, unlock, sale reminders with on/off switch, edit, delete), Following (funds + frequency).
- New alert sheet: coin, type (above, below, % change 1h/24h), value with distance from current price, one-time or recurring (1 h cool-down), bypass quiet hours.
- Digest settings link → Settings → Notifications (weekly digest Monday 08:00 local; quiet hours).
- Notification permission banner when browser permission is denied or not yet asked.

## User stories & acceptance criteria
- **US-7.1 Price alerts.** Given BTC alert "above $67,500", when a simulated tick crosses it, then a notification is added (bell badge +1, toast, and a browser notification if allowed) showing coin, trigger, current price, and change; tapping it opens `/coins/bitcoin`. One-time alerts switch off after firing; recurring wait 1 h.
- **US-7.2 Management.** Pause/resume via switch, edit opens the sheet prefilled, delete asks "Delete this alert?" with Cancel / Delete (destructive).
- **US-1.4 Contextual permission.** No permission prompt until the first alert is set; an explainer precedes the browser prompt.
- **US-7.3 Weekly digest.** Shown as an in-app notification every Monday 08:00 local when the app is open (front-end only; email not sent).
- **US-7.4 Quiet hours.** During quiet hours only alerts with "Bypass quiet hours" create toasts/browser notifications; others are listed silently.

## States
- **Empty notifications:** "No alerts yet. Set one from any coin." **Empty my alerts:** primary "New alert".
- **Guest:** page shows sign-in prompt; bell opens the sign-in sheet. **Demo:** 3 seeded alerts.

## Data & persistence
- Accounts: `cpa:v1:user:<id>.alerts[]` and `.notifications[]` (max 200, oldest dropped); follows in `.follows`.
- Alert checks run in the browser on each simulated tick while the app is open; nothing fires when the tab is closed (stated in the FAQ).

## Done when (phase passing conditions)
- [ ] Creating an alert just below the current price fires within one tick and shows in Notifications.
- [ ] Bell badge count matches unread notifications.
- [ ] Pause, edit, delete all work and persist for accounts.
- [ ] Permission explainer appears before the first browser prompt.
