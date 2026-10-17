# Fund profile
**Route:** `/funds/:slug`  ·  **Nav:** Fundraising tab stays active (child page)  ·  **Personas:** Priya, Daniel  ·  **Source stories:** US-5.3, US-5.4, US-3.5

## Purpose
One fund's portfolio, recent deals, top sectors, and co-investors, with a Follow control so Priya hears about new deals.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ ‹ Fundraising                       [↗]      │
│ [N] Northstar Capital                        │
│     Tier 1 · Venture fund · Est. 2017        │
│ ┌──────────────────────────────────────────┐ │
│ │        [ ✓ Following · Daily ⌄ ]         │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────┐┌──────────┐┌──────────┐         │
│ │ 142      ││ 9        ││ $1.08B   │         │
│ │ deals    ││ last 30d ││ deployed │         │
│ └──────────┘└──────────┘└──────────┘         │
│                                              │
│ Top sectors                                  │
│ AI ▬▬▬▬▬▬▬ 31% · DeFi ▬▬▬▬▬ 24% · L2 ▬▬▬ 15% │
│                                              │
│ Recent deals                     See all  ›  │
│ [L] Lumen Protocol  Seed  $12.0M  Oct 15     │
│ [D] Driftnet  Series A  $28.5M  Oct 14 Lead  │
│ [O] Orbit L2  Seed  $6.0M  Jan 12, 2024 Lead │
│                                              │
│ Portfolio (38)                   See all  ›  │
│ (O) ORB $1.24 ▲ +3.40%  (D) DRF $0.42 ▼ −2.10%│
│                                              │
│ Frequent co-investors                        │
│ [H] Hashgrove Ventures   11 shared deals  ›  │
│ [P] Polar Labs Fund       7 shared deals  ›  │
│ Not financial advice. Data provided for      │
│ informational purposes.                      │
├──────────────────────────────────────────────┤
│ Home Market Explore [Fund.] Unlocks Watch Port│
└──────────────────────────────────────────────┘

Follow frequency menu: ◉ Instant  ○ Daily digest  ○ Weekly digest  [Unfollow]
```

## Components & content
- Header: logo (rounded square, 8px radius), name, tier, type, founded year, share.
- Follow button (primary) with frequency menu: Instant, Daily digest, Weekly digest, Unfollow.
- Stat tiles: total deals, last 30 days, total deployed (sample).
- Top sectors bar list; recent deals list with "Lead" tag; portfolio tokens with price and change; frequent co-investors.

## User stories & acceptance criteria
- **US-5.3 Fund profile.** Shows tier, deal count, recent rounds, top sectors, co-investors.
- **US-5.4 Follow funds.** As Priya, I want to follow a fund so that I'm alerted to new deals.
  - Given I'm signed in, when I tap Follow and choose "Daily digest", then the button reads "✓ Following · Daily" and the fund appears in `/alerts` under "Followed funds".
  - Given a new round for a followed fund appears in the simulated feed, then an in-app notification is added to the bell (Instant) or the next digest (Daily/Weekly).
- **US-P07.1 Co-investor link.** Tapping a co-investor opens their fund profile.

## States
- **Loading:** skeleton header and tiles. **Not found:** 404 page.
- **Guest:** Follow opens sign-in sheet. **Demo:** follow works until refresh.

## Data & persistence
- Fund data from sample dataset; follows in `cpa:v1:user:<id>.follows` (accounts) or memory.

## Done when (phase passing conditions)
- [ ] `/funds/northstar-capital` shows all sections and the disclaimer.
- [ ] Follow + frequency persists for accounts and is listed on Alerts.
- [ ] Co-investor rows navigate to other fund profiles.
