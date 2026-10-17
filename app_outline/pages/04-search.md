# Search
**Route:** overlay (any page, `⌘K`) and results page `/search?q=…&type=all|coins|funds|exchanges|sales`  ·  **Nav:** no tab active  ·  **Personas:** Daniel, Maya, Priya  ·  **Source stories:** US-2.5, US-6.1

## Purpose
Find coins, funds, exchanges, and token sales from one box. The overlay is for jumping; the results page is for filtering and comparing matches (copycat tickers).

## Wireframe (phone, ~430px)
```
Overlay (⌘K)                                 Results page /search?q=orb
┌──────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ ┌──────────────────────────────────┐ │     │ [C] CPA                [♿] [🔔] [≡]  │
│ │ 🔍 orb█                     Esc  │ │     ├──────────────────────────────────────┤
│ └──────────────────────────────────┘ │     │ ┌──────────────────────────────────┐ │
│ Coins                                │     │ │ 🔍 orb                         ✕ │ │
│ (O) Orbit L2  ORB ✓   MCap $842.5M › │     │ └──────────────────────────────────┘ │
│     0x9f3c…a71e                      │     │ 7 results for "orb"                  │
│ (O) OrbCash   ORB     MCap $1.2M   › │     │ (■All■)(Coins 2)(Funds 1)(Exch. 1)   │
│     0x44be…09d2  ⚠ Unverified        │     │ (Sales 1)  Sort: [Market cap ⌄]      │
│ Funds                                │     │                                      │
│ [O] Orbital Partners             ›   │     │ Coins                                │
│ Exchanges                            │     │ ☆ (O) Orbit L2 ORB ✓  $1.24 ▲ +3.40% │
│ [O] OrbX Exchange  Vol $210.4M   ›   │     │       MCap $842.5M · 0x9f3c…a71e     │
│ Token sales                          │     │ ☆ (O) OrbCash ORB ⚠  $0.0031 ▼ −8.20%│
│ [O] Orbiter · IDO · Nov 2, 2026  ›   │     │       MCap $1.2M · 0x44be…09d2       │
│ ─────────────────────────────────    │     │ Funds                                │
│ ↑↓ move · ↵ open · ⇧↵ all results    │     │ [O] Orbital Partners · 41 deals    › │
└──────────────────────────────────────┘     │ Exchanges / Token sales …            │
                                             └──────────────────────────────────────┘
Empty query:  Recent searches   Clear
              ⏱ arbitrum  ✕   ⏱ northstar ✕
              Trending: SOL · ORB · ARB
```

## Components & content
- Input with debounce 250 ms; results appear from the 2nd character.
- Groups: Coins (verified badge, market cap, shortened contract), Funds, Exchanges, Token sales. Max 3 per group in the overlay.
- Keyboard: `↑`/`↓` move (`aria-activedescendant`), `Enter` opens item, `Shift+Enter` or "See all results" opens the results page, `Esc` closes.
- Results page: type pills with counts, sort (market cap, volume, popularity = views in sample data), star toggles on coin rows.
- Recent searches (max 10) with per-item ✕ and Clear; Trending chips.

## User stories & acceptance criteria
- **US-2.5 Global search.** As Daniel, I want to search coins, funds, and exchanges in one place so that I can jump straight to what I need.
  - Given I type "o", nothing shows; given "or", grouped results appear within 250 ms of typing pause.
  - Coins show verified badge, MCap, and contract so OrbCash (unverified, ⚠) is distinguishable from Orbit L2.
- **US-P04.1 Filter results.** Given the results page, when I pick "Coins" and sort by volume, then only coins show, sorted, and the URL updates.
- **US-P04.2 Recent searches.** Given I opened a result, then the query is saved to recents; Clear removes all.
- **US-6.1** Starring from results behaves as on Market.

## States
- **No results:** "No matches for "xyz". Check the spelling or try a ticker." plus Trending.
- **Loading:** 3 skeleton rows per group.
- **Guest:** recents in memory only.

## Data & persistence
- Index built in memory from the sample dataset.
- Recent searches: `cpa:v1:user:<id>.recentSearches` for accounts; memory for guest/demo. Clearable in Settings → Privacy.

## Done when (phase passing conditions)
- [ ] `⌘K` and `Ctrl+K` open the overlay on every page; focus is in the input.
- [ ] Typing "orb" shows 4 groups; arrow keys move the highlight; Enter navigates.
- [ ] Results page pills filter and URL reflects `type`.
- [ ] Recent searches appear when the input is empty and can be cleared.
