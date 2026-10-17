# Watchlist
**Route:** `/watchlist`  ·  **Nav:** Watchlist tab  ·  **Personas:** Maya, Leo, Daniel  ·  **Source stories:** US-6.1, US-6.2, US-1.3, US-8.1 (adapted)

> **Decision: Favorites is merged into Watchlist.** Section 15 lists a separate "Favorites" page. In CPA, favorites = starred coins, and the star on every coin row is the single "favorite" action. There is no `/favorites` route; `/favorites` redirects to `/watchlist`. Named lists (US-6.2) cover grouping needs.

## Purpose
All starred coins in one place, in the user's own order, with quick access to alerts and coin detail.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Watchlist                       [✎ Edit]     │
│ 4 coins · ▲ +1.25% avg 24h · Updated 2s ago  │
│ (■Main■) (L2 bets) (+ New list)              │  named lists (P2)
│ Sort: [My order ⌄]   View: (Simple)(Pro)     │
│ ──────────────────────────────────────────── │
│ ★ (B) Bitcoin   BTC  ╱╲╱‾  $67,682.43        │
│                              +2.18%   [🔔]   │
│ ★ (E) Ethereum  ETH  _╱╲‾  $3,825.12         │
│                              +1.06%   [🔔•]  │  dot = active alert
│ ★ (S) Solana    SOL  _╱‾‾  $172.45           │
│                              +4.87%   [🔔]   │
│ ★ (A) Arbitrum  ARB  ‾╲_╲  $0.8462           │
│                              −3.12%   [🔔•]  │
│      ⚠ Unlock in 3d 04h · 3.21% of supply    │
│ ──────────────────────────────────────────── │
│ [ + Add coins ]                              │
│ <footer>                                     │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks [Watch] Port│
└──────────────────────────────────────────────┘

Edit mode:                          Empty state:
≡ (B) Bitcoin   [↑][↓]  [Remove]    [☆ line art]
≡ (E) Ethereum  [↑][↓]  [Remove]    Add coins to your watchlist
drag handle + keyboard buttons      to see them here.
[ Done ]                            [ Browse market ]
```

## Components & content
- Header: count, average 24h change, last updated, Edit.
- List chips: "Main" (default) plus named lists; "+ New list" creates one (max 10 lists, name ≤ 30 chars).
- Sort: My order (default), Price, 24h %, Market cap. Density Simple/Pro as Market.
- Coin rows (Market row + alert bell with dot if an alert exists); unlock warning line when an unlock > 2% is within 7 days.
- Edit mode: drag handle reorder, ↑/↓ buttons for keyboard and screen-reader users, Remove (with 5 s "Undo" toast).
- "+ Add coins" opens the search overlay filtered to coins.

## User stories & acceptance criteria
- **US-6.1 Watchlist.** As a user, I want to star coins into a watchlist so that I can follow them in one place.
  - Add from Market rows, Coin detail, search results, Home, and the interest picker. Reorder by drag or ↑/↓.
  - Given I starred coins as a guest, when I sign in or sign up, then they merge into my account watchlist (no duplicates) and a toast says "3 coins added to your watchlist".
- **US-6.2 Multiple watchlists.** Given I create "L2 bets", when I star from Coin detail, then a menu lets me pick the list(s); the star fills if the coin is in any list.
- **US-P10.1 Alert from row.** Tapping 🔔 opens the alert sheet prefilled with the coin (12-alerts.md).
- **US-P10.2 Remove with undo.** Given I remove ARB, then a toast "Arbitrum removed. Undo" restores it within 5 s.

## States
- **Empty:** illustration + "Add coins to your watchlist to see them here." + "Browse market".
- **Guest:** list works in memory with a banner "Sign in to keep your watchlist after you close the tab." **Demo:** BTC, ETH, SOL, ARB seeded.
- **Loading/Error:** as Market.

## Data & persistence
- Accounts: `cpa:v1:user:<id>.watchlists` = `[{ id, name, coinIds[] }]`, saved on every change.
- Guest and demo: memory only; guest list merges on sign-in.

## Done when (phase passing conditions)
- [ ] Stars from Market, Coin detail, and Search all appear here.
- [ ] Drag and ↑/↓ reorder; order survives refresh for accounts.
- [ ] Remove + Undo works.
- [ ] `/favorites` redirects here.
- [ ] Guest stars merge after sign-up.
