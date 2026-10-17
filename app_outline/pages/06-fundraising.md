# Fundraising
**Route:** `/fundraising` (`?view=rounds|funds`, filter params)  ·  **Nav:** Fundraising tab  ·  **Personas:** Priya, Daniel  ·  **Source stories:** US-5.1, US-5.2, US-5.4, US-8.2

## Purpose
A feed of funding rounds with filters and saved filter sets, plus a list of funds and investors. Priya's Monday scan happens here.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Fundraising                                  │
│ $412.6M raised in the last 7 days ▲ +18.40%  │
│ (■Rounds■) ( Funds )                         │
│ Saved: (AI + DeFi ≥$5M) (L2 seed) (+ Save)   │  saved filter chips
│ [⚙ Filters 3]  Sort: [Newest ⌄]              │
│ (AI ✕) (DeFi ✕) (Last 7 days ✕) (≥ $5M ✕)    │  active filter chips
│                                              │
│ ┌──────────────────────────────────────────┐ │
│ │ [L] Lumen Protocol        (Seed)   AI    │ │  violet accent tag
│ │ $12.0M raised · Val. $80.0M              │ │
│ │ Oct 15, 2026 · 2d ago                    │ │
│ │ [N][H][P] +2               [↗] [Follow]  │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ [D] Driftnet            (Series A)  DeFi │ │
│ │ $28.5M raised · Val. $210.0M             │ │
│ │ Oct 14, 2026 · 3d ago                    │ │
│ │ [N][O] Lead: Northstar Capital           │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ [O] Orbit L2           (Strategic)  L2   │ │
│ │ $5.0M raised · Val. undisclosed          │ │
│ │ Oct 13, 2026 · 4d ago                    │ │
│ └──────────────────────────────────────────┘ │
│ Not financial advice. Data provided for      │
│ informational purposes.                      │
├──────────────────────────────────────────────┤
│ Home Market Explore [Fund.] Unlocks Watch Port│
└──────────────────────────────────────────────┘

Funds view                          Filter sheet
[N] Northstar Capital  Tier 1  ›    Sector  [AI][DeFi][L2][RWA]…
    142 deals · 9 in 30d            Round   [Pre-seed][Seed][Series A]…
[H] Hashgrove Ventures Tier 2  ›    Amount  [$5M]──●────●──[$100M+]
[O] Orbital Partners   Tier 2  ›    Date    (7d)(30d)(90d)(Custom)
                                    Investor [search…]
                                    [Reset]          [Show 18 rounds]
```

## Components & content
- Header stat: total raised in range and signed change vs previous period.
- Segmented Rounds / Funds.
- Saved filter chips (max 10), "+ Save" saves current filters with a name; long-press/⋯ to rename or delete.
- Filters sheet: sector, round type, amount range, date range, investor. Active chips with ✕.
- Round card (style guide 7.6): logo, name, round tag, amount, valuation, date (absolute + relative), up to 3 investor logos + "+N", share, Follow (project). Tap → project's Coin detail Funding tab if the project has a token, otherwise a round detail sheet.
- Funds view: name, tier, deal counts; tap → `/funds/:slug`.
- Share: generated card image with CPA branding, source, date (US-8.2).

## User stories & acceptance criteria
- **US-5.1 Rounds feed.** Filters by sector, round type, amount, date, investor; cards show project, round, amount, date, ≤ 3 investors + "+N".
- **US-5.2 Saved filters.** As Priya, I want to save filter sets so that I don't rebuild them each week.
  - Given I'm signed in with active filters, when I tap "+ Save" and name it "AI + DeFi ≥$5M", then a chip appears first; tapping it applies the filters. An 11th save shows "You can save up to 10 filters."
- **US-P06.1 Filters remembered.** For accounts, the last used filters restore on return (cross-journey recommendation 2).
- **US-8.2 Share card.** Given I tap ↗ on a round, then a PNG with CPA logo, round data, "Source: CPA sample data", and date is shared or downloaded.

## States
- **Loading:** 4 skeleton cards. **Empty:** "No rounds match these filters." + "Reset filters".
- **Error:** banner with Retry. **Guest:** Save and Follow open sign-in sheet.

## Data & persistence
- Rounds and funds from sample dataset (≥ 60 rounds over 90 days).
- Saved filters, last filters, follows: `cpa:v1:user:<id>` for accounts; memory for guest/demo.

## Done when (phase passing conditions)
- [ ] Filters sheet narrows results and chips reflect them; ✕ removes one.
- [ ] Saved filter persists after refresh (account) and is gone after refresh (demo).
- [ ] Funds view lists funds and opens a fund profile.
- [ ] Disclaimer visible at the end of the feed.
