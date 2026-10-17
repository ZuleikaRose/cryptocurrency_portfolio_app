# Explore
**Route:** `/explore`  ·  **Nav:** Explore tab  ·  **Personas:** Leo, Daniel, Priya  ·  **Source stories:** US-2.3, US-5.5, US-1.3 (sectors); replaces the style guide's "More" tab

## Purpose
A discovery hub: categories, market pulse details, token sales, exchanges, learning, and links to every secondary page (promotions, affiliate, AI features, support). Everything the style guide put under "More" is reachable from here.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Explore                                      │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search coins, exchanges, IDO…   ⌘ K   │ │
│ └──────────────────────────────────────────┘ │
│ Categories                       See all  ›  │
│ ┌──────────┐┌──────────┐┌──────────┐         │
│ │ AI       ││ DeFi     ││ Layer 2  │  →      │  accent left border per category
│ │ $48.2B   ││ $92.7B   ││ $31.5B   │         │
│ │ ▲ +5.12% ││ ▼ −1.04% ││ ▲ +2.66% │         │
│ └──────────┘└──────────┘└──────────┘         │
│                                              │
│ Market pulse  (id="market-pulse")            │
│ Fear & Greed 72 Greed · BTC dom. 52.8%       │
│ ETH gas 14 gwei · Altcoin season 41/100      │
│                                              │
│ Discover                                     │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ ◇ Token sales      ││ ⛁ Funds & investors│ │
│ │ 4 upcoming         ││ 1,240 tracked      │ │
│ └────────────────────┘└────────────────────┘ │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ ⇄ Exchanges        ││ ★ Top gainers      │ │
│ │ 38 tracked         ││ SOL +4.87%         │ │
│ └────────────────────┘└────────────────────┘ │
│                                              │
│ Learn                                        │
│ ⓘ What is a token unlock?                 ›  │
│ ⓘ Market cap vs FDV                       ›  │
│ ⓘ How to read a vesting chart             ›  │
│                                              │
│ More from CPA                                │
│ 🏷  Promotions                 1 active   ›  │
│ 🤝 Affiliate program                      ›  │
│ ✦  AI features                            ›  │
│ ?  Customer support · FAQs               ›  │
│ ⚙  Account settings                       ›  │
│ <footer>                                     │
├──────────────────────────────────────────────┤
│ Home Market [Explore] Fund. Unlocks Watch Port│
└──────────────────────────────────────────────┘
```

## Components & content
- Category carousel (AI, DeFi, Layer 1, Layer 2, RWA, Gaming, Memes, Stablecoins, Oracles, Infrastructure): market cap, signed 24h change; tap → `/market?category=ai`.
- Market pulse block (anchor `#market-pulse`, target of Market "View all"): Fear & Greed with 7-day history, BTC dominance, ETH gas, altcoin season index.
- Discover tiles: Token sales `/token-sales`, Funds & investors `/fundraising?view=funds`, Exchanges (`/search?type=exchanges`), Top gainers `/market?view=gainers`.
- Learn: glossary articles in an expandable list (accordion, no separate route).
- More from CPA: links to Promotions, Affiliate program, AI features, Support/FAQs, Account settings.

## User stories & acceptance criteria
- **US-P05.1 Browse categories.** As Leo, I want to explore sectors so that I learn what exists beyond BTC and ETH.
  - Given I tap "AI", then Market opens filtered to AI with an "AI ✕" chip.
- **US-P05.2 Reach secondary pages.** As any user, I want token sales, support, and settings reachable without a "More" tab.
  - Every link in "Discover" and "More from CPA" navigates to its route.
- **US-P05.3 Learn inline.** Given I expand "Market cap vs FDV", then a 2–3 sentence plain-language explanation shows with an example from sample data.

## States
- **Loading:** skeleton tiles. **Error:** category carousel banner with Retry.
- **Guest/demo/signed-in:** identical except "Account settings" opens the sign-in sheet for guests.

## Data & persistence
- Static sample dataset; no user data written on this page.

## Done when (phase passing conditions)
- [ ] Explore tab active; categories scroll horizontally with keyboard and touch.
- [ ] Market "View all" lands on `#market-pulse`.
- [ ] All Discover and More links resolve (no 404).
