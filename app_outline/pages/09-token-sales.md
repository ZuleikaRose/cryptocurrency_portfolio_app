# Token sales
**Route:** `/token-sales` (`?status=upcoming|active|past`), launchpad sheet `?launchpad=:slug`  ·  **Nav:** no tab active (reached from Explore, Home, hamburger menu)  ·  **Personas:** Daniel, Maya  ·  **Source stories:** US-5.5

## Purpose
Upcoming, active, and past ICO / IEO / IDO sales with ROI, and launchpad track records, with a clear past-performance disclaimer.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ ‹ Explore                                    │
│ Token sales                                  │
│ (■Upcoming 4■) (Active 2) (Past 86)          │
│ Type: (All)(ICO)(IEO)(IDO)  Launchpad [All ⌄]│
│                                              │
│ ┌──────────────────────────────────────────┐ │  cyan accent tag
│ │ [N] Nimbus AI  NIM        (IDO)          │ │
│ │ Polar Pad · Starts Oct 22, 2026 · in 5d  │ │
│ │ Raise $1.5M · Price $0.045 · FDV $45.0M  │ │
│ │                       [🔔 Remind me]     │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ [O] Orbiter  ORBT         (IEO)          │ │
│ │ OrbX Launch · Nov 2, 2026 · in 16d       │ │
│ │ Raise $3.0M · Price $0.12                │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Past tab row:                                │
│ [D] Driftnet DRF · IDO · Polar Pad           │
│     Sale $0.12 → $0.42  ROI 3.50x · ATH 7.10x│
│                                              │
│ ┌ ⓘ ───────────────────────────────────────┐ │
│ │ Past ROI doesn't predict future results. │ │
│ │ Not financial advice.                    │ │
│ └──────────────────────────────────────────┘ │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘

Launchpad sheet: Polar Pad · 24 past sales · Avg ROI 2.84x · Median 1.60x
                 Best: DRF 3.50x  Worst: KLP 0.22x
```

## Components & content
- Status tabs with counts; type pills; launchpad select.
- Sale card: logo, name, ticker, type tag, launchpad (tap → launchpad sheet), start/end date with relative time, raise, price, FDV, Remind me (upcoming) or progress bar "68% sold" (active).
- Past rows: sale price → current price, current ROI and ATH ROI (x multiples, coloured with ▲/▼).
- Launchpad sheet: count, average and median ROI, best/worst.
- Persistent disclaimer card at the top of Past tab and at the end of the list.

## User stories & acceptance criteria
- **US-5.5 Token sales.** As Daniel, I want upcoming, active, and past sales with ROI so that I can judge launchpad track records.
  - Past sales show current ROI and ATH ROI; launchpad sheet shows average ROI; disclaimer "Past ROI doesn't predict future results." is always visible on Past.
- **US-P09.1 Sale reminder.** Given an upcoming sale, when I tap Remind me, then a reminder alert (1 hour / 24 hours before start) is saved like unlock reminders.

## States
- **Empty:** "No active sales right now." + "See upcoming". **Guest:** Remind me → sign-in sheet.

## Data & persistence
- Sales and launchpads from sample dataset; reminders in user alerts (account localStorage / memory).

## Done when (phase passing conditions)
- [ ] Three status tabs switch content and URL.
- [ ] Past tab shows ROI and ATH ROI and the disclaimer.
- [ ] Launchpad sheet opens from a card.
- [ ] Remind me saves a reminder visible on Alerts.
