# Coin detail
**Route:** `/coins/:slug` (tabs: `?tab=overview|tokenomics|funding|markets`)  ·  **Nav:** no tab active (reached from Market, Search, Watchlist, Home, Unlocks)  ·  **Personas:** Daniel, Maya, Priya, Leo  ·  **Source stories:** US-3.1 – US-3.6, US-6.1, US-7.1, US-8.2, US-9.3, US-9.4

## Purpose
Everything about one coin in one view: price chart with event markers, supply at a glance, vesting, funding rounds, and markets. Main research destination for Daniel.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ ‹ Back                         [↗ Share]     │
│ (O) Orbit L2  ORB  ✓ Verified   #48          │
│ $1.24   ▲ +3.40% 24h                         │
│ 0x9f3c…a71e  [Copy]          Layer 2  AI     │
│ ┌──────────────────────────────────────────┐ │
│ │ [★ Add to watchlist]        [🔔 Alert]   │ │
│ └──────────────────────────────────────────┘ │
│ (Overview) Tokenomics  Funding  Markets      │  tabs
│ ┌──────────────────────────────────────────┐ │
│ │  $1.31 ┤        ╱‾╲    ◆U        ╱‾      │ │  ◆U unlock, ◆F funding marker
│ │        ┤  ╱‾╲__╱   ╲__╱  ╲◆F__╱          │ │
│ │  $1.02 ┤_╱                               │ │
│ │ (1D)(7D)[1M](3M)(1Y)(ALL)   Line|Candle  │ │
│ │ Markers ◉ on   Chart summary ▾           │ │
│ └──────────────────────────────────────────┘ │
│ Chart summary: 1-month range $1.02 to $1.31, │
│ currently $1.24, up 12.7% over the period.   │
│                                              │
│ Market cap ⓘ   $842.5M   FDV ⓘ   $3.10B      │
│ 24h volume     $64.2M    Circ.   679.4M ORB  │
│ ATH $1.88 (Mar 3, 2026)  ATL $0.41           │
│                                              │
│ Supply at a glance ⓘ                         │
│ [██████████▒▒▒▒░░░░░░░░░░] Circ 27% · Unl 9% │
│                            Locked 64%        │
│ Next unlock  in 12d 06h · 18.0M ORB · $22.3M │
│              2.65% of circ. supply [Remind]  │
│                                              │
│ Community sentiment (not advice)             │
│ Bullish 64% ▬▬▬▬▬▬░░░ Bearish 36%            │
│ [ Bullish ] [ Bearish ]   2,418 votes today  │
│                                              │
│ About Orbit L2                               │
│ An Ethereum layer 2 rollup… Read more        │
│ Not financial advice. Data provided for      │
│ informational purposes. Source: CPA sample   │
│ data · Last updated 2s ago                   │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘

Tokenomics tab                      Funding tab
Vesting schedule (area chart,       Total raised $46.5M · 3 rounds
 Team / Investors / Ecosystem,      (Seed) Jan 12, 2024 · $6.0M
 "Today" line)                        Price $0.08 → $1.24 ROI 15.5x
Next 5 unlocks                         Lead [N] Northstar Capital ›
 Oct 29, 2026 Investors 18.0M $22.3M (Series A) Sep 4, 2025 · $28.5M
 2.65%                                 Valuation $450.0M
                                     Markets tab: Exchange · Pair · Price
                                      · 24h vol · Share (sortable)
```

## Components & content
- Header: back, share, logo (40px), name, ticker, verified badge, rank, price, 24h change pill, shortened contract address with copy, category tags.
- Primary action "Add to watchlist" (toggles to "In watchlist ★"); secondary "Alert" opens the alert sheet from 12-alerts.md prefilled with this coin.
- Tabs (`role="tablist"`): Overview, Tokenomics, Funding, Markets. Tab persists in URL.
- **Chart:** ranges 1D 7D 1M 3M 1Y ALL (keys `1`–`6`), line/candle toggle, crosshair on pointer/touch drag and `←`/`→` keys, event markers (unlock amber, funding violet, listing cyan) toggle, tapping a marker opens an event sheet. Chart summary text toggle below the chart (size follows accessibility menu "summary text size").
- **Risk indicators (not advice)** under the stats (clarification 27): "High unlock pressure" (2% or more of circulating supply unlocking in 30 days), "Low liquidity" (24h volume under $5M or under 0.1% of market cap) and "Low float" (under 30% of maximum supply circulating). Each shows the coin's figures and the threshold; with none, "None of CPA's indicators apply to BTC today."
- Key stats with ⓘ tooltips (plain-language definitions, e.g. FDV: "Price × maximum supply. Shows value if every token were circulating.").
- Supply at a glance stacked bar; next unlock card.
- Community sentiment: one vote per coin per day for signed-up users; demo votes reset; guests see results only. Replaces "ratings and reviews".
- Funding tab: rounds with type, date, amount, valuation, token price vs current price (ROI), lead investors linking to `/funds/:slug`.
- Markets tab: exchange, pair, price, 24h volume, volume share; sortable headers with ▲/▼.
- Share: generates a PNG card with CPA logo, coin, price, change, timestamp, "Source: CPA sample data", and the page URL (US-8.2); uses Web Share API or downloads.

## User stories & acceptance criteria
- **US-3.1 Price chart.** Ranges switch the chart and summary; scrubbing shows price and timestamp; screen readers get the text summary.
- **US-3.2 Event markers.** Given markers are on, when I select ◆U, then a sheet shows "Unlock · Oct 29, 2026 · 18.0M ORB · $22.3M · 2.65% of circ. supply".
- **US-3.3 Supply at a glance.** Bar shows circulating, unlocked-not-circulating, locked; each ⓘ opens a definition.
- **US-3.4 Vesting.** Area chart by allocation with "Today" line; list of next 5 unlocks with amount, $ value, %.
- **US-3.5 Funding.** Rounds listed newest first; investor taps open the fund profile.
- **US-3.6 Markets.** Sortable exchange table.
- **US-P03.1 Browsing history.** Given I'm signed in, when I open a coin, then it is added to the front of "Recently viewed" (max 10, de-duplicated).
- **US-P03.2 Sentiment vote.** Given I'm signed in, when I tap Bullish, then my vote is recorded, the bar updates, and the buttons show my choice until tomorrow.

## States
- **Loading:** skeleton header, chart placeholder.
- **Not found:** unknown slug → 404 page (29) with "Search coins" action.
- **No funding:** "No funding rounds on record for Bitcoin." **No unlocks:** "No scheduled unlocks."
- **Guest:** watchlist/alert/vote open the sign-in sheet.

## Data & persistence
- Coin, events, rounds, markets from sample dataset; live coins take price figures from CryptoRank.
- Chart series: Coinbase closes through `cpa.price_history()` for the 31 coins Coinbase lists, sample history for the rest (clarification 26). A line under the chart names the source; a live coin shows a chart skeleton while its range loads and the error banner with Retry if it fails.
- Watchlist, alerts, recently viewed, sentiment votes: localStorage under the user for accounts; memory for guest/demo.

## Done when (phase passing conditions)
- [ ] `/coins/orbit-l2` shows header, chart, stats, supply bar, next unlock, sentiment, disclaimer.
- [ ] Each of the 4 tabs renders its content and updates the URL.
- [ ] Pressing `1`–`6` changes the range; summary text changes with it.
- [ ] Marker click opens the event sheet.
- [ ] Add to watchlist toggles and shows on Watchlist tab.
- [ ] `/coins/does-not-exist` shows the 404 page.
