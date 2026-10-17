# Affiliate program
**Route:** `/affiliate`  ·  **Nav:** no tab active; from Explore, hamburger  ·  **Personas:** creators, analysts, communities (e.g. Priya sharing with her network)  ·  **Source stories:** section 15 Affiliate program (adapted to promote CPA subscriptions)

## Purpose
Explain how to earn commission by referring new CPA Pro subscribers, show the terms, and give signed-in affiliates a referral link, simulated stats, and marketing materials.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Affiliate program                            │
│ Earn 20% of the first year of CPA Pro        │
│ subscriptions you refer.                     │
│ ┌──────────────────────────────────────────┐ │
│ │            [ Join the program ]          │ │
│ └──────────────────────────────────────────┘ │
│ How it works                                 │
│ 1 Join  ›  2 Share your link  ›  3 Earn      │
│                                              │
│ Your dashboard (after joining)               │
│ Link  cpa.app/r/maya-7f3k  [Copy]            │
│ ┌──────────┐┌──────────┐┌──────────┐         │
│ │ 128      ││ 9        ││ $172.58  │         │
│ │ clicks   ││ sign-ups ││ earned   │         │
│ └──────────┘└──────────┘└──────────┘         │
│ Payout method  [ PayPal (simulated) ⌄ ]      │
│ Next payout Nov 15, 2026 · min $50.00        │
│                                              │
│ Marketing materials                          │
│ [Logo pack] [Banner 1200×630] [Copy blocks]  │
│ Tips                                         │
│ ▸ Driving traffic  ▸ Tracking referrals      │
│ Terms                                        │
│ ▸ Eligibility ▸ Commission ▸ Payments        │
│ ▸ Restrictions                               │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- Hero with commission summary; Join (signed-in, 18+ checkbox, accept affiliate terms).
- How it works 3 steps.
- Dashboard: referral link with copy, simulated clicks/sign-ups/earnings, payout method (PayPal or bank, simulated), next payout date, minimum payout.
- Marketing materials: downloadable CPA logo pack, banner, approved copy blocks (no hype words, must include "Not financial advice").
- Tips accordion; Terms accordion: eligibility, commission (20% of first-year subscription revenue, 30-day cookie window simulated as 30-day link attribution), payment methods and schedule, restrictions (no paid search on "CPA" brand terms, no promising returns, no spam, no misleading claims; violations void commission).

## User stories & acceptance criteria
- **US-P28.1 Join.** Given I'm signed in and accept the terms, when I tap Join, then a referral link is generated and the dashboard appears.
- **US-P28.2 Share.** Copy puts the link on the clipboard and announces "Link copied".
- **US-P28.3 Guest.** Join opens the sign-in sheet.

## States
- Not joined (hero + terms), joined (dashboard). Demo: shows sample dashboard, resets on refresh.

## Data & persistence
- `cpa:v1:user:<id>.affiliate` = `{ joinedAt, code, payoutMethod }`; stats are simulated from the code (deterministic).

## Done when (phase passing conditions)
- [ ] Join → dashboard with link; persists for accounts.
- [ ] Terms sections expand; copy blocks contain the disclaimer.
- [ ] No mention of streaming or video anywhere on the page.
