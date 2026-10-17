# App shell
**Route:** wraps every route  ·  **Nav:** always present  ·  **Personas:** Maya, Daniel, Priya, Leo  ·  **Source stories:** US-1.1, US-1.4, US-2.5, US-8.3, US-9.1, US-9.3, US-9.4, US-9.5

## Purpose
The frame every CPA (Cryptocurrency Portfolio App) page renders inside: top bar, scrollable content, footer, and a 7-tab bottom navigation. It also owns the global overlays (⌘K search, hamburger menu, accessibility menu, guest sign-in sheet, toasts) and the global trust and "Not financial advice" rules.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐  ← centered column, max-width 430px
│ [C] CPA                      [♿] [🔔•2] [≡]  │  top bar, 72px, sticky, blurred bg
├──────────────────────────────────────────────┤
│ ┌──────────────────────────────────────────┐ │  demo banner (demo mode only)
│ │ Demo mode · changes reset on refresh  [✕]│ │
│ └──────────────────────────────────────────┘ │
│                                              │
│   <page content>                             │
│                                              │
│ ──────────────────────────────────────────── │
│ Not financial advice. Data provided for      │  footer (end of scroll)
│ informational purposes.                      │
│ Sample data · Last updated 2s ago            │
│ Terms · Privacy · Accessibility policy       │
│ Support · Technical requirements             │
│ © 2026 CPA                                   │
├──────────────────────────────────────────────┤
│  ⌂     ılı     ◎      ⛁      ▦      ☆     ◯  │  bottom nav, 7 tabs, sticky
│ Home Market Explore Fund.. Unlocks Watch Port│  labels 10px, active = accent + filled
└──────────────────────────────────────────────┘

Hamburger menu (right drawer, 320px)        ⌘K search overlay
┌──────────────────────────────┐            ┌──────────────────────────────┐
│ Maya Chen · Pro         [✕]  │            │ 🔍 Search coins, funds…  Esc │
│ maya@example.com             │            │ Recent        Clear          │
│ ──────────────────────────── │            │  ⏱ arbitrum                  │
│ Account settings          ›  │            │ Coins                        │
│ Alerts                 2  ›  │            │  [O] Orbit L2 ORB ✓ $842.5M  │
│ Token sales               ›  │            │ Funds                        │
│ Promotions                ›  │            │  [N] Northstar Capital       │
│ Affiliate program         ›  │            │ ↑↓ to move · ↵ to open       │
│ AI features               ›  │            └──────────────────────────────┘
│ ──────────────────────────── │
│ Customer support          ›  │            Guest sign-in sheet (bottom, 20px radius)
│ FAQs                      ›  │            ┌──────────────────────────────┐
│ Report an issue           ›  │            │ ───                          │
│ Feedback                  ›  │            │ Sign in to save alerts       │
│ Technical requirements    ›  │            │ Your alert will be created   │
│ ──────────────────────────── │            │ after you sign in.           │
│ Terms · Privacy · Access.    │            │ [      Log in             ]  │
│ [ Log out ]                  │            │ [ Create account ]           │
└──────────────────────────────┘            │ Try a private demo →         │
                                            │ Not now                      │
                                            └──────────────────────────────┘
```

## Components & content
- **Layout:** centered column `max-width: 430px`, full height, 1px side borders on desktop, radial dark background outside the column (same as the Market wireframe). Gutters 16–20px. Works from 320px up; on desktop the column stays centered.
- **Tokens:** use the wireframe palette for the shell (bg `#0B0C10`, surface `#111318`, raised `#17191F`, line `#272A32`, text `#F4F5F8`, muted `#858B98`, accent `#8B7CF8`, positive `#55D6A7`, negative `#F1727F`). Style guide tokens apply for warning `#F5A524` and category accents. Light theme mirrors the style guide light tokens.
- **Top bar:** CPA logo (white rounded "C" mark + "CPA", links to `/`), accessibility-menu icon (opens 27), alerts bell with unread count badge (opens `/alerts`), hamburger (opens menu drawer).
- **Hamburger menu:** account header (name, plan, email) or "Log in / Create account" for guests and "Demo user · Demo" in demo; links listed in the wireframe; "Log out" goes to `/logout`. Things the style guide put under "More" live here and in Explore.
- **Bottom nav (7 tabs, no "More"):** Home `/` · Market `/market` · Explore `/explore` · Fundraising `/fundraising` · Unlocks `/unlocks` · Watchlist `/watchlist` · Portfolio `/portfolio`. Icons: home, chart, compass, coins-stack, calendar-lock, star, user. Each tab ≥ 44px tall; labels may truncate to fit but have full `aria-label`. Pages outside the tabs show no active tab.
- **⌘K search overlay:** opened by the Market/Home search field, `⌘K` / `Ctrl+K`, or `/`. Behaviour defined in 04-search.md. `Enter` opens `/search?q=…`.
- **Footer:** disclaimer, data source line ("Sample data", last updated), links: Terms, Privacy, Accessibility policy, Support, Technical requirements.
- **Toasts:** bottom, above the nav, 4 s, `role="status"`; never stack more than 2.
- **Global keyboard shortcuts:** `⌘K`/`Ctrl+K` search, `/` search, `Esc` close overlay, `Alt+A` accessibility menu, `?` shortcuts help dialog, `1`–`6` chart ranges on Coin detail.

## User stories & acceptance criteria
- **US-1.1 Browse as guest.** As a new user, I want to browse without an account so that I can judge the app first.
  - Given I'm a guest, when I star a coin, set an alert, add a transaction, or follow a fund, then the sign-in sheet opens naming the action, and after I log in, sign up, or start the demo, the action completes and a toast confirms it.
  - Given the sheet is open, when I tap "Not now" or press Esc, then it closes and nothing is saved.
- **US-P00.1 Seven-tab navigation.** As any user, I want every main area one tap away so that I don't hunt through a "More" tab.
  - Given any page, when I tap a tab, then that route loads and the tab shows the accent colour, filled icon, and `aria-current="page"`.
- **US-P00.2 Not financial advice.** As CPA, I want a consistent disclaimer so that no screen reads as advice.
  - The footer disclaimer appears on every page; Coin detail, Fundraising, Token sales, Portfolio, and AI features also show it inline near the data. No UI copy uses "guaranteed", "to the moon", or "don't miss out".
- **US-9.4 Data freshness.** Given market data is shown, then "Last updated" is visible; when the simulated feed hasn't ticked for 5 minutes, values turn `text/secondary` with a clock icon.
- **US-9.5 Offline.** Given the browser goes offline, then a top banner says "You're offline: showing saved data" and actions that need the feed are disabled.
- **US-P00.3 Accessible shell.** A "Skip to content" link is the first focusable element; overlays trap focus and return it on close; landmarks `header`, `main`, `nav`, `footer` exist.

## States
- **Guest:** menu header shows "Log in" and "Create account"; bell shows no badge and opens a sign-in prompt.
- **Signed in:** name and plan in menu; bell badge counts unread triggered alerts.
- **Demo:** persistent demo banner; menu header "Demo user · Demo"; "Log out" ends the demo.
- **Loading:** skeleton shimmer for page content; shell renders instantly.
- **Error:** an uncaught render error shows an inline "Something went wrong" card with "Reload" and "Report an issue".

## Data & persistence
- No API. Market, funding, unlock, and sale data come from a bundled sample dataset; prices drift with a simulated tick every 30 s while the tab is visible ("auto-refresh live prices", can be paused in the accessibility menu and settings).
- localStorage keys (signed-up accounts only): `cpa:v1:accounts` (account records), `cpa:v1:session` (current user id), `cpa:v1:user:<id>` (watchlist, portfolio, alerts, settings, accessibility settings, recent searches, recently viewed coins, saved filters, follows, sentiment votes, tickets), `cpa:v1:resetTokens`.
- Guest and demo state live in memory (React state/context) only and are gone on refresh. Guest state merges into the account on sign-in (US-6.1).

## Done when (phase passing conditions)
- [ ] At 390px and 1440px widths the column is centered, ≤ 430px wide, with no horizontal scroll.
- [ ] Top bar shows CPA logo, accessibility icon, bell, and hamburger; each opens the right thing.
- [ ] Bottom nav shows exactly 7 tabs in the order Home, Market, Explore, Fundraising, Unlocks, Watchlist, Portfolio; no "More".
- [ ] `⌘K`/`Ctrl+K` opens search from any page; `Esc` closes it.
- [ ] As a guest, starring a coin opens the sign-in sheet; after demo start, the star is set.
- [ ] Footer shows the disclaimer and the Accessibility policy link on every page.
- [ ] Refresh during demo returns to guest; refresh while signed in keeps the session.
