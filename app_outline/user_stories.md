# CryptoRank Mobile App: User Stories

> **Scope:** product backlog for the CryptoRank (cryptorank.io) iOS and Android apps, grouped by epic.
> **Format:** *As a [persona], I want [capability] so that [benefit].* Acceptance criteria are in Given / When / Then form.
> **Priority:** **P0** = MVP launch · **P1** = fast follow · **P2** = later.
> **Estimates:** story points (Fibonacci), to be refined by the team.
> **Personas:** see `user_journey.md` (Maya: trader, Daniel: researcher, Priya: VC analyst, Leo: newcomer).

---

## Epic 1: Onboarding & Account

### US-1.1 Browse as guest · P0 · 3 pts
**As a** new user, **I want** to browse market data without creating an account **so that** I can judge the app's value first.

- **Given** I open the app for the first time, **when** I skip onboarding, **then** I land on the Markets tab with live data.
- **Given** I'm a guest, **when** I try to set an alert or add to my portfolio, **then** a sign-in sheet appears and my action finishes after I sign in.

### US-1.2 Social & email sign-in · P0 · 5 pts
**As a** user, **I want** to sign in with Apple, Google, or email magic link **so that** I don't need to manage another password.

- Sign in with Apple is offered on iOS (App Store requirement).
- **Given** I already have a cryptorank.io web account, **when** I sign in with the same email, **then** my watchlist and portfolio sync.
- Sign-in errors show a plain-language message and a retry option.

### US-1.3 Interest picker · P1 · 3 pts
**As** Leo, **I want** to choose coins and sectors I care about **so that** the app feels personal right away.

- Shows the top 20 coins and 10 categories as selectable chips. The step can be skipped.
- My selected coins pre-fill my watchlist.

### US-1.4 Contextual notification permission · P0 · 2 pts
**As a** user, **I want** to be asked for notifications only when I set an alert **so that** I understand why the app needs them.

- No OS permission prompt on first launch.
- A short explanation screen appears before the OS prompt. If I decline, the alert is saved and a banner offers to enable notifications in Settings.

---

## Epic 2: Markets & Coin Rankings

### US-2.1 Ranked coin list · P0 · 5 pts
**As** Maya, **I want** to see coins ranked by market cap with price, 24h change, and a 7d sparkline **so that** I can scan the market quickly.

- Rows show rank, logo, name, ticker, price, 24h % change (signed with ▲/▼), and the sparkline.
- Prices refresh at least every 30 s while the screen is visible.
- Infinite scroll loads 100 rows per page, with skeleton loading states.

### US-2.2 Sort & filter · P0 · 3 pts
**As a** trader, **I want** to sort by price, change, volume, or market cap and filter by category **so that** I can find the coins that matter to me.

- Sort and filters persist between sessions.
- A filter chip row shows active filters, each with an ✕ to remove it.

### US-2.3 Top gainers & losers · P1 · 2 pts
**As** Maya, **I want** a gainers/losers view for 1h / 24h / 7d **so that** I can spot momentum.

- Excludes coins below a configurable volume threshold (default $100K 24h) to reduce illiquid noise.

### US-2.4 Simple / Pro density · P1 · 3 pts
**As** Leo, **I want** a simple view with fewer columns **so that** I'm not overwhelmed.

- Simple: name, price, 24h %. Pro: adds market cap, volume, FDV, and 7d %.
- The setting is in More → Display and on the list header menu.

### US-2.5 Global search · P0 · 5 pts
**As** Daniel, **I want** to search coins, funds, and exchanges in one place **so that** I can jump straight to what I need.

- Results are grouped by type and appear after the 2nd character (debounced at 250 ms).
- Coins show a verified badge, market cap, and a shortened contract address to tell copycats apart.
- Recent searches are stored on the device and can be cleared.

---

## Epic 3: Coin Detail

### US-3.1 Price chart · P0 · 5 pts
**As a** user, **I want** an interactive price chart with time ranges **so that** I can see the price history.

- Ranges: 1D, 7D, 1M, 3M, 1Y, ALL. Line by default, with a candlestick toggle.
- Scrubbing shows a crosshair, price, and timestamp, with a selection haptic.
- An accessible text summary is available to screen readers.

### US-3.2 Event markers on chart · P1 · 5 pts
**As** Daniel, **I want** unlocks, funding rounds, and listings marked on the chart **so that** I can understand why the price moved.

- Markers can be toggled on and off. Tapping a marker opens a sheet with event details.

### US-3.3 Tokenomics & supply at a glance · P0 · 3 pts
**As** Daniel, **I want** to see circulating, locked, and total supply plus FDV **so that** I can judge dilution risk.

- A stacked bar shows circulating, unlocked-not-circulating, and locked supply.
- Each metric has an ⓘ tooltip with a plain-language definition.

### US-3.4 Vesting schedule · P0 · 5 pts
**As** Daniel, **I want** the vesting schedule broken down by allocation (team, investors, ecosystem) **so that** I know who can sell and when.

- Area chart over time, with a "Today" line.
- A list of the next 5 unlock events, each with amount, $ value, and % of circulating supply.

### US-3.5 Funding & investors tab · P0 · 3 pts
**As** Priya, **I want** to see a project's funding rounds and investors **so that** I can assess who backs it.

- Shows round type, date, amount, valuation (if known), and lead investors. Tapping an investor opens their profile.
- Shows the token price in private/seed rounds compared with the current price (ROI) when available.

### US-3.6 Markets & exchanges tab · P1 · 3 pts
**As** Maya, **I want** to see where a coin trades and at what volume **so that** I can pick a liquid venue.

- Lists exchange, pair, price, 24h volume, and volume share. Sortable.

---

## Epic 4: Token Unlocks

### US-4.1 Unlock calendar · P0 · 5 pts
**As** Maya, **I want** a list of upcoming token unlocks **so that** I can prepare for supply shocks.

- Filters: Today / This week / This month / Custom. "Watchlist only" toggle.
- Default sort: % of circulating supply, descending.
- Each card shows a live countdown, token amount, $ value, and % of supply. Cards over 2% get a warning style.

### US-4.2 One-tap unlock reminder · P0 · 3 pts
**As** Maya, **I want** to tap "Remind me" on an unlock **so that** I get notified before it happens.

- Timing options: 1 hour, 24 hours, or both. The default comes from the last choice.
- **Given** the unlock date changes, **when** the data updates, **then** my reminder reschedules and I'm told about the change.

### US-4.3 Calendar view · P2 · 5 pts
**As a** user, **I want** a month calendar with unlock dots **so that** I can see busy weeks at a glance.

---

## Epic 5: Fundraising & Investors

### US-5.1 Funding rounds feed · P0 · 5 pts
**As** Priya, **I want** a feed of the latest funding rounds **so that** I can track where money flows.

- Filters: sector, round type, amount range, date range, investor.
- Each card shows project, round, amount, date, and up to 3 investor logos plus "+N".

### US-5.2 Saved filters · P1 · 3 pts
**As** Priya, **I want** to save filter sets **so that** I don't rebuild them every week.

- Up to 10 saved filters, pinned as chips at the top of the tab. Rename and delete are supported.

### US-5.3 Fund profile · P0 · 5 pts
**As** Priya, **I want** a fund's portfolio, recent deals, and stats **so that** I can benchmark competitors.

- Shows tier/rating (if available), number of investments, recent rounds, and top sectors.
- **P1:** "Frequent co-investors" section.

### US-5.4 Follow funds · P1 · 3 pts
**As** Priya, **I want** to follow a fund **so that** I'm alerted when it announces a new deal.

- Frequency per fund: instant, daily digest, or weekly digest.

### US-5.5 Token sales (ICO / IDO / launchpads) · P1 · 5 pts
**As** Daniel, **I want** to see upcoming, active, and past token sales with ROI **so that** I can find opportunities and judge launchpad track records.

- Tabs: Upcoming / Active / Past. Past sales show current ROI and ATH ROI.
- Launchpad pages show the average ROI of past sales.
- A visible disclaimer: past ROI doesn't predict future results.

---

## Epic 6: Watchlist & Portfolio

### US-6.1 Watchlist · P0 · 3 pts
**As a** user, **I want** to star coins into a watchlist **so that** I can follow them in one place.

- Add from a list-row swipe, Coin Detail, or search results.
- Reorder by drag. Syncs across devices and with the web when signed in.
- Guests' watchlists are stored locally and merge into the account on sign-in.

### US-6.2 Multiple watchlists · P2 · 3 pts
**As** Maya, **I want** several named watchlists **so that** I can group coins by strategy.

### US-6.3 Manual portfolio tracker · P1 · 8 pts
**As** Daniel, **I want** to log buys and sells **so that** I can track my P&L.

- Fields: coin, type (buy/sell/transfer), amount, price (defaults to market price at the chosen time), date, fee, and note.
- Shows total value, 24h change, all-time P&L ($ and %), and allocation donut.
- Hide-balances toggle (eye icon) masks values as `••••`.

### US-6.4 Read-only wallet / exchange import · P2 · 13 pts
**As a** user, **I want** to import holdings from a public wallet address or a read-only exchange API **so that** I don't have to enter trades by hand.

- Public addresses only, or read-only API keys. The app never asks for seed phrases or private keys.
- API keys are stored encrypted in the OS keychain/keystore and are never shown again after saving.

---

## Epic 7: Alerts & Notifications

### US-7.1 Price alerts · P0 · 5 pts
**As** Maya, **I want** alerts when a coin crosses a price or moves by a set % **so that** I can react without watching the screen.

- Types: price above, price below, % change in 1h / 24h.
- Choose one-time or recurring (with a 1-hour cool-down).
- The notification shows the coin, trigger, current price, and change. Tapping it opens Coin Detail.

### US-7.2 Alert management · P0 · 2 pts
**As a** user, **I want** to see, pause, edit, and delete my alerts in one place **so that** I stay in control.

### US-7.3 Weekly digest · P1 · 3 pts
**As** Priya, **I want** a weekly summary of funding, unlocks, and my watchlist **so that** I can catch up quickly.

- Delivered Monday 08:00 in the user's local time, by push and/or email (user's choice).

### US-7.4 Quiet hours · P1 · 2 pts
**As a** user, **I want** quiet hours **so that** non-urgent notifications don't wake me.

- My own price alerts can be set to bypass quiet hours. Digests never bypass them.

---

## Epic 8: Widgets, Sharing & Platform

### US-8.1 Home-screen widget · P1 · 5 pts
**As** Leo, **I want** a widget showing my watchlist **so that** I can check prices without opening the app.

- Sizes: small (1 coin), medium (4 coins), large (8 coins + next unlock).
- Refreshes as often as the OS allows and shows a "last updated" time.

### US-8.2 Share cards · P1 · 3 pts
**As** Priya, **I want** to share a clean image of a coin, round, or unlock **so that** my team sees it in context.

- The generated image includes CryptoRank branding, the data source, a timestamp, and a deep link.

### US-8.3 Deep links · P0 · 3 pts
**As a** user who taps a cryptorank.io link, **I want** it to open the matching screen in the app **so that** I'm not sent to the website.

- Universal Links / App Links for coin, unlock, round, fund, and token-sale URLs. Falls back to the web if the content isn't supported in the app.

---

## Epic 9: Settings, Accessibility & Trust

### US-9.1 Theme & currency · P0 · 2 pts
**As a** user, **I want** to choose dark/light/system theme and display currency (USD, EUR, BTC, ETH, etc.) **so that** the app fits my preferences.

### US-9.2 Color conventions · P1 · 2 pts
**As a** user in a market that uses red for "up", or with color-vision deficiency, **I want** to swap or change up/down colors **so that** I read changes correctly.

### US-9.3 Screen-reader support · P0 · 5 pts
**As a** blind user, **I want** VoiceOver/TalkBack to read prices and changes clearly **so that** I can use the app independently.

- Values are read in full words. Charts have text summaries. Live updates don't flood announcements.

### US-9.4 Data source & freshness · P0 · 2 pts
**As** Daniel, **I want** to see where data comes from and when it was last updated **so that** I can trust it.

- "Last updated" is shown on every data screen. Data more than 5 minutes old is visibly marked as stale.

### US-9.5 Offline mode · P1 · 3 pts
**As a** commuter, **I want** to see my last-loaded data offline **so that** the app still works on the subway.

- Shows an offline banner and cached watchlist, portfolio, and unlocks. Actions are queued and sync when back online.

### US-9.6 Account deletion · P0 · 2 pts
**As a** user, **I want** to delete my account and data from inside the app **so that** I control my privacy (App Store and Google Play requirement).

---

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Cold start to first data ≤ 2 s (p75) on mid-range devices; list scroll at 60 fps |
| Data freshness | Visible prices ≤ 30 s old while the app is in the foreground |
| Reliability | Crash-free sessions ≥ 99.5% |
| Security | TLS 1.2+; tokens in Keychain/Keystore; no secrets in the app binary; read-only integrations only |
| Privacy | Analytics opt-out; no sale of personal data; GDPR/CCPA-compliant data export and delete |
| Accessibility | WCAG 2.2 AA equivalent; Dynamic Type up to 200% |
| Compliance | "Not financial advice" disclaimer on Coin Detail, Token Sales, and Portfolio |
| Localization | String externalization from day 1; launch in EN, with RU/UK/ES/ZH/KO/TR as follow-ups |

---

## MVP (P0) Summary

| Epic | P0 stories |
|---|---|
| Onboarding & Account | 1.1, 1.2, 1.4 |
| Markets | 2.1, 2.2, 2.5 |
| Coin Detail | 3.1, 3.3, 3.4, 3.5 |
| Token Unlocks | 4.1, 4.2 |
| Fundraising | 5.1, 5.3 |
| Watchlist & Portfolio | 6.1 |
| Alerts | 7.1, 7.2 |
| Platform | 8.3 |
| Settings & Trust | 9.1, 9.3, 9.4, 9.6 |

**Total P0:** 22 stories · 81 story points
