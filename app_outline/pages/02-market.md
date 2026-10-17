# Market
**Route:** `/market` (filters: `/market?view=coins|watchlist|gainers|new`)  ·  **Nav:** Market tab  ·  **Personas:** Maya, Leo, Daniel  ·  **Source stories:** US-2.1, US-2.2, US-2.3, US-2.4, US-2.5, US-6.1, US-9.4

## Purpose
The ranked coin list. This is the only screen with a real wireframe (`figma-wireframe/src/App.tsx`, image `12b73f5a…png`); the first screen must match it exactly, except that the brand reads **CPA** (not CryptoRank), the accessibility icon is added to the top bar, the bottom nav has 7 tabs, and negative changes use the true minus sign.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Global crypto market cap          ┌───────┐  │
│ $2.67T  +1.34%                    │ USD ⌄ │  │
│                                   └───────┘  │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search coins, exchanges, IDO…   ⌘ K   │ │
│ └──────────────────────────────────────────┘ │
│ (■Coins■) ( Watchlist ) ( Gainers ) ( New )  │  active pill = white fill
│                                              │
│ Market pulse                                 │
│ Updated just now                 View all ›  │
│ ┌────────────────────┐┌────────────────────┐ │
│ │ Fear & Greed   ••• ││ BTC Dominance    ● │ │
│ │  (72)  Greed       ││ 52.8% +0.4%        │ │
│ │        Yesterday:69││        __╱‾╲╱‾     │ │
│ └────────────────────┘└────────────────────┘ │
│                                              │
│ Top cryptocurrencies             ┌────────┐  │
│ By market capitalization         │ ⇅ Rank │  │
│                                  └────────┘  │
│   #  Name                       Price / 24h  │
│ ──────────────────────────────────────────── │
│ ★ 1 (B) Bitcoin    ╱╲╱‾╱‾   $67,682.43       │
│         BTC                      +2.18%      │
│ ☆ 2 (E) Ethereum   _╱╲╱‾    $3,825.12        │
│         ETH                      +1.06%      │
│ ☆ 3 (U) Tether     ‾‾‾‾‾    $1.00            │
│         USDT                     +0.01%      │
│ ☆ 4 (B) BNB        ‾╲_╲_    $602.84          │  red sparkline + text
│         BNB                      −0.52%      │
│ ┌──────────────────────────────────────────┐ │
│ │            View all assets  ›            │ │
│ └──────────────────────────────────────────┘ │
│ <footer>                                     │
├──────────────────────────────────────────────┤
│ Home [Market] Explore Fund. Unlocks Watch Port│
└──────────────────────────────────────────────┘

"View all assets" expands to the full list (100 rows per page):
│ ☆ 5 (S) Solana     _╱‾‾    $172.45   +4.87%  │
│ ☆ 6 (X) XRP        ...     $0.5321   −1.20%  │
│ …   skeleton rows while loading next page    │

Sort sheet (from "⇅ Rank")          Pro density adds columns:
┌──────────────────────────────┐    # Name  Price  24h  7d  MCap  Vol  FDV
│ Sort by                      │    (horizontal scroll, sticky Name column)
│ ◉ Rank   ○ Price  ○ 24h %    │
│ ○ Volume ○ Market cap        │
│ Category: [All ⌄]  ▲ Asc ▼   │
│ View: (Simple) (Pro)         │
│ [ Apply ]                    │
└──────────────────────────────┘
```

## Components & content
- **Heading:** "Global crypto market cap", value `$2.67T`, change `+1.34%` in positive colour; currency button (USD, EUR, BTC, ETH) opens a menu and converts every price (US-9.1).
- **Search field:** placeholder "Search coins, exchanges, IDO…" with `⌘ K` kbd; opens the search overlay.
- **Filter pills** (`role="tablist"`): Coins (default), Watchlist (starred coins only), Gainers (24h, ≥ $100K volume), New (listed in the last 30 days).
- **Market pulse:** Fear & Greed card (gauge 72, "Greed", "Yesterday: 69"), BTC Dominance card (52.8%, +0.4%, live dot, sparkline). "View all" → `/explore#market-pulse`.
- **Top cryptocurrencies:** heading, "By market capitalization" subtitle (changes with sort), "⇅ Rank" sort button, table head "# Name / Price / 24h".
- **Coin row:** star toggle (filled accent when starred), rank, letter logo in a tinted circle, name and ticker, 7d sparkline (green up / red down), price and 24h change right-aligned, tabular numbers. Whole row links to `/coins/:slug`. Star has `aria-label` "Add Bitcoin to watchlist" / "Remove Bitcoin from watchlist".
- **View all assets:** outline button; loads the remaining rows with infinite scroll.
- **Density:** Simple (name, price, 24h) default; Pro adds 7d %, MCap, volume, FDV with a sticky first column (US-2.4).

## User stories & acceptance criteria
- **US-2.1 Ranked coin list.** As Maya, I want coins ranked by market cap with price, 24h change, and a 7d sparkline so that I can scan quickly.
  - Rows show rank, logo, name, ticker, price, signed 24h change with ▲/▼ for screen readers, and sparkline. Prices refresh every 30 s while visible (simulated tick, 400 ms flash unless motion is stopped). 100 rows per page, skeleton rows while loading.
- **US-2.2 Sort & filter.** Sort by rank, price, 24h %, volume, or market cap, plus a category filter. Active filters show as chips with ✕. For signed-up accounts sort and filters persist across sessions.
- **US-2.3 Gainers.** Given I tap Gainers, then coins are ordered by 24h % descending and coins under $100K 24h volume are excluded; a 1h/24h/7d segment appears.
- **US-2.4 Simple / Pro density.** Toggle in the sort sheet and in Settings → Preferences.
- **US-6.1 Star from list.** Given I'm signed in, when I tap ☆ on Ethereum, then it fills, a light toast says "Ethereum added to watchlist", and it appears in the Watchlist pill and tab. Guests see the sign-in sheet.
- **US-P02.1 Wireframe fidelity.** Given the default view at 430px, then the screen matches the wireframe order: heading → search → pills → Market pulse → Top cryptocurrencies → 4 rows → View all assets.

## States
- **Loading:** skeleton pulse cards and 8 skeleton rows.
- **Empty (Watchlist pill):** "Star coins to see them here." with star illustration.
- **Error:** inline banner "We couldn't load prices. Retry." Cached rows stay with "Last updated 12m ago".
- **Stale:** after 5 minutes without a tick, prices turn muted with a clock icon.
- **Guest:** BTC is pre-starred in memory (matches the wireframe); tapping any star opens the sign-in sheet. **Demo:** BTC, ETH, SOL, ARB starred.

## Data & persistence
- Coins from sample dataset (≥ 120 coins so pagination is testable).
- Sort, filter, density, currency: `cpa:v1:user:<id>.settings.market` for accounts; memory for guest/demo.
- Stars write to the shared watchlist store (see 10-watchlist.md).

## Done when (phase passing conditions)
- [ ] Screenshot at 430px matches the wireframe image apart from the CPA logo, ♿ icon, 7-tab nav, and "−0.52%".
- [ ] Each pill changes the list; Watchlist pill shows only starred coins.
- [ ] Sort sheet re-orders rows and the subtitle reflects the sort.
- [ ] Currency switch to EUR changes all prices and the market cap symbol.
- [ ] "View all assets" loads 100 rows, then more on scroll.
- [ ] Starring persists after refresh for a signed-up account and does not for demo.
