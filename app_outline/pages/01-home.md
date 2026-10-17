# Home
**Route:** `/`  ·  **Nav:** Home tab  ·  **Personas:** Leo, Maya, Priya, Daniel  ·  **Source stories:** US-1.1, US-1.3, US-2.3, US-4.1, US-5.1, US-5.5, US-8.1 (adapted)

## Purpose
A glanceable overview: the market in under 3 seconds, the user's watchlist, the next unlocks, recent funding rounds, and upcoming token sales. First-time visitors get a short onboarding and an optional interest picker.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Good evening, Maya                           │
│ Oct 17, 2026 · Updated just now              │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search coins, exchanges, IDO…    ⌘ K  │ │
│ └──────────────────────────────────────────┘ │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ Market cap         ││ Fear & Greed       │ │
│ │ $2.67T  +1.34%     ││ (72) Greed         │ │
│ │ 24h vol $98.4B     ││ Yesterday: 69      │ │
│ └────────────────────┘└────────────────────┘ │
│                                              │
│ Your watchlist                   See all  ›  │
│ ☆ [B] BTC   ╱╲╱‾  $67,682.43   ▲ +2.18%      │
│ ☆ [E] ETH   ╱‾╲╱  $3,825.12    ▲ +1.06%      │
│ ☆ [S] SOL   _╱‾‾  $172.45      ▲ +4.87%      │
│ ☆ [A] ARB   ‾╲_╲  $0.8462      ▼ −3.12%      │
│                                              │
│ Top movers 24h   (Gainers)(Losers)  See all ›│
│ [S] SOL  +4.87%   [O] ORB +3.40%  [E] ETH …  │  horizontal cards
│                                              │
│ Next unlocks                     See all  ›  │
│ ┌──────────────────────────────────────────┐ │
│ │ ARB · Arbitrum               in 3d 04h   │ │  warning border (>2%)
│ │ 92.65M ARB · $78.4M · 3.21% of supply    │ │
│ │ [███████████░░░░░] 61% unlocked [Remind] │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Recent funding rounds            See all  ›  │
│ [L] Lumen Protocol  (Seed)  $12.0M  Oct 15   │
│     [N][H] +2                         AI     │
│ [D] Driftnet  (Series A)  $28.5M  Oct 14     │
│                                              │
│ Upcoming token sales             See all  ›  │
│ [N] Nimbus AI · IDO · Polar Pad · Oct 22     │
│                                              │
│ Recently viewed                              │
│ (ORB) (ARB) (ETH)                            │
│                                              │
│ ┌ Learn ───────────────────────────────────┐ │
│ │ ⓘ What is FDV?  Fully diluted value is…  │ │
│ └──────────────────────────────────────────┘ │
│ <footer>                                     │
├──────────────────────────────────────────────┤
│ [Home] Market Explore Fund. Unlocks Watch Port│
└──────────────────────────────────────────────┘

First visit (guest): onboarding overlay
┌──────────────────────────────────────────────┐
│               Skip                           │
│     [line art: chart]                        │
│  Markets: rank coins by market cap,          │
│  price, and momentum.                        │
│        ● ○ ○             [ Next ]            │
└──────────────────────────────────────────────┘
→ cards: Markets · Unlocks · Fundraising → Interest picker:
  "Pick coins and sectors you care about" chips (top 20 coins, 10 sectors) [Continue] [Skip]
```

## Components & content
- Greeting with date (guests: "Welcome to CPA"), search field opening ⌘K overlay.
- Market snapshot cards: total market cap, 24h change, 24h volume, Fear & Greed gauge. Tapping goes to `/market`.
- Your watchlist: up to 5 rows (coin row component). Guests with no stars see "Trending" instead with a "Star coins to build your watchlist" hint.
- Top movers: segmented Gainers / Losers, 24h, excludes coins under $100K 24h volume (US-2.3).
- Next unlocks: next 3 unlock cards with "Remind me".
- Recent funding rounds: 3 round cards; Upcoming token sales: 2 rows.
- Recently viewed: chips from the browsing history of coins viewed (signed-in only, max 10).
- Learn card: rotating glossary tip for Leo (MCap, FDV, unlocks, vesting). Static unless "auto-play animations" is on.
- Onboarding (first visit only): 3 cards (Markets, Unlocks, Fundraising), Skip, Next; auto-advance every 6 s only if auto-advance is enabled and reduced motion is off.

## User stories & acceptance criteria
- **US-1.3 Interest picker.** As Leo, I want to choose coins and sectors so that the app feels personal right away.
  - Given onboarding ends, when I select chips and tap Continue, then those coins pre-fill my watchlist and the sectors set Home's funding and token-sale sections. Skip leaves defaults.
- **US-P01.1 Glanceable home.** As Maya, I want my watchlist and the next unlock on one screen so that I can check in under 3 seconds.
  - Given I have starred coins, when Home loads, then they appear first under "Your watchlist" in my saved order.
- **US-P01.2 Remind me from Home.** Given an unlock card, when I tap "Remind me", then the reminder sheet from 08-unlocks.md opens (guests get the sign-in sheet).
- **US-P01.3 Recently viewed.** Given I opened Coin detail for ORB, when I return Home, then ORB is the first "Recently viewed" chip; clearing history in Settings empties it.
- **US-P01.4 Onboarding once.** Given I completed or skipped onboarding, when I come back in the same session (guest) or any session (signed in), then it doesn't show again.

## States
- **Loading:** skeleton cards for each section.
- **Empty:** watchlist empty → "Add coins to your watchlist to see them here." with "Browse market" button.
- **Error:** section-level banner "We couldn't load unlocks. Retry."
- **Guest:** Trending replaces watchlist; Recently viewed hidden. **Demo:** seeded watchlist BTC, ETH, SOL, ARB.

## Data & persistence
- Section data from sample dataset; watchlist from current user state.
- Onboarding-done flag and interest picks: localStorage `cpa:v1:user:<id>.settings` for accounts; memory for guests and demo (so guests see onboarding again after refresh).

## Done when (phase passing conditions)
- [ ] Fresh load as guest shows onboarding; Skip lands on Home with Trending.
- [ ] Interest picker selections appear in the watchlist section.
- [ ] Demo shows BTC, ETH, SOL, ARB with prices and signed changes using "−".
- [ ] Unlock card for ARB shows a warning border and "Remind me".
- [ ] Every "See all" goes to the matching tab.
