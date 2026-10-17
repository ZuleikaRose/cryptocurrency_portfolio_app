# Unlocks
**Route:** `/unlocks` (`?range=today|week|month|custom&watchlist=1&min=1&view=list|calendar`)  ·  **Nav:** Unlocks tab  ·  **Personas:** Maya, Daniel  ·  **Source stories:** US-4.1, US-4.2, US-4.3, US-1.4

## Purpose
Upcoming token unlocks sorted by supply impact, with one-tap reminders, so Maya can prepare for supply shocks.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Token unlocks                   [☰ List|▦]   │
│ $1.42B unlocking this week · 23 events       │
│ (Today)(■This week■)(This month)(Custom)     │
│ [◯ Watchlist only]  [● > 1% only]            │
│ Sort: [% of circ. supply ⌄]                  │
│                                              │
│ ┌──────────────────────────────────────────┐ │  amber border (>2%)
│ │ (A) ARB · Arbitrum            in 3d 04h  │ │
│ │ 92.65M ARB · $78.4M · 3.21% of circ.     │ │
│ │ [███████████░░░░░░] 61% unlocked         │ │
│ │ Oct 20, 2026 · Investors, Team           │ │
│ │                        [🔔 Remind me]    │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (O) ORB · Orbit L2           in 12d 06h  │ │
│ │ 18.0M ORB · $22.3M · 2.65% of circ.      │ │
│ │ [████░░░░░░░░░░░░░] 36% unlocked         │ │
│ │                       [✓ Reminder set]   │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (S) SOL · Solana              in 5d 11h  │ │
│ │ 2.10M SOL · $362.1M · 0.45% of circ.     │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. [Unlocks] Watch Port│
└──────────────────────────────────────────────┘

Remind me sheet                     Calendar view (P2)
┌──────────────────────────────┐    October 2026
│ Remind me about ARB unlock   │    Mo Tu We Th Fr Sa Su
│ Oct 20, 2026 · 92.65M ARB    │          1  2  3  4  5
│ ☑ 1 hour before              │    …  17 18 19 20• 21 22
│ ☐ 24 hours before            │    dots = unlocks; tap day → list
│ [ Set reminder ]             │
└──────────────────────────────┘
```

## Components & content
- Header: total $ unlocking in range, event count, list/calendar toggle.
- Range pills; Custom opens a date-range picker. Toggles "Watchlist only" and "> 1% only".
- Sort: % of circulating supply (default, descending), $ value, date.
- Unlock card (style guide 7.5): logo, ticker, name, live countdown (updates each minute; each second inside the last hour), amount, $ value, % of circ. supply, progress bar with % unlocked, date, allocation, Remind me. Warning border and "⚠ Large unlock" text when > 2%.
- Remind me sheet: 1 hour / 24 hours / both; default = last choice.
- Calendar view: month grid with dots; selecting a day filters the list.

## User stories & acceptance criteria
- **US-4.1 Unlock calendar.** Filters Today / This week / This month / Custom and Watchlist only; default sort % of circulating supply descending; cards > 2% have the warning style (border + text, not colour alone).
- **US-4.2 One-tap reminder.** Given I'm signed in, when I tap Remind me and Set reminder, then the button reads "✓ Reminder set", a success toast shows, and the reminder appears on `/alerts`.
  - Given it's my first alert, then before the browser notification prompt an explainer says "Allow notifications so CPA can remind you even when this tab is in the background." Declining still saves the reminder (in-app only) and Alerts shows a banner to enable notifications.
  - Given the sample data changes the unlock date, then the reminder reschedules and an in-app notice says so.
- **US-4.3 Calendar view.** Month grid with unlock dots; arrow keys move between days.

## States
- **Loading:** skeleton cards. **Empty:** "No unlocks in this range." + "Show this month".
- **Guest:** Remind me → sign-in sheet; after sign-in the sheet reopens for that unlock.

## Data & persistence
- Unlock events from sample dataset (dates relative to today so the list is never empty).
- Reminders stored with alerts (`cpa:v1:user:<id>.alerts`, type `unlock`); range/toggles in settings for accounts; memory for guest/demo.

## Done when (phase passing conditions)
- [ ] Default view is "This week" sorted by % of supply; ARB first with amber border.
- [ ] Countdown visibly decreases after one minute.
- [ ] "> 1% only" hides SOL; "Watchlist only" shows only starred coins.
- [ ] Setting a reminder updates the card and appears on Alerts.
- [ ] Calendar toggle shows dots on unlock days.
