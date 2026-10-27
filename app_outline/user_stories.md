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

> **CPA build (Oct 18, 2026):** the list polls the Supabase REST API every 30 s. Prices for 34 coins come from CryptoRank, synced every 10 minutes by the `cryptorank-sync` Edge Function (the free API plan's limit, accepted as the refresh rate); the other coins use sample data.

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

> **CPA build (Oct 26, 2026):** the 31 live coins Coinbase lists chart Coinbase Exchange closes (15-minute for 1D, hourly for 7D, 6-hourly for 1M, daily for 3M, 1Y and ALL), ending at the live CryptoRank price. All-time high and low are the highest and lowest daily close. The other coins keep sample charts, and a line under each chart names its source.

### US-3.2 Event markers on chart · P1 · 5 pts
**As** Daniel, **I want** unlocks, funding rounds, and listings marked on the chart **so that** I can understand why the price moved.

- Markers can be toggled on and off. Tapping a marker opens a sheet with event details.

### US-3.3 Tokenomics & supply at a glance · P0 · 3 pts
**As** Daniel, **I want** to see circulating, locked, and total supply plus FDV **so that** I can judge dilution risk.

- A stacked bar shows circulating, unlocked-not-circulating, and locked supply.
- Each metric has an ⓘ tooltip with a plain-language definition.

> **CPA build (Oct 26, 2026; clarification 27):** below the stats, a "Risk indicators (not advice)" card flags high unlock pressure, low liquidity and low float against fixed thresholds, stating the coin's figures and the threshold, never a score or advice.

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

> **CPA build (Oct 25, 2026):** when an unlock or token sale moves by up to 14 days, the reminder moves with it, timings that haven't fired yet re-arm, and a notification says "ARB unlock moved to Nov 3, 2026" with the old date. `?simulate=reschedule` shows it in the demo.

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

> **CPA build (Oct 25, 2026):** Main plus up to 9 named lists, shown as chips on Watchlist. Lists can be created, renamed and deleted (with Undo), and coins added from a search sheet. On Coin detail the star opens "Save to watchlists" once a named list exists. Signed-in lists are stored in `watchlists` and `watchlist_list_coins`.

### US-6.3 Manual portfolio tracker · P1 · 8 pts
**As** Daniel, **I want** to log buys and sells **so that** I can track my P&L.

- Fields: coin, type (buy/sell/transfer), amount, price (defaults to market price at the chosen time), date, fee, and note.
- Shows total value, 24h change, all-time P&L ($ and %), and allocation donut.
- Hide-balances toggle (eye icon) masks values as `••••`.

> **CPA build (Oct 25, 2026):** signed-in users can export transactions as CSV and import a CSV (up to 1 MB and 2,000 rows). The import previews what will be added, skips duplicates, unknown coins, future dates and sells larger than the holding, and says why for each skipped row. Cells that start with = + − @ are escaped on export so spreadsheets don't run them.
>
> **CPA build (Oct 26, 2026; clarification 28):** the value chart uses Coinbase closes where available, the summary splits P&L into unrealized and realized, the chart shows P&L over the chosen range, "Use market price" fills the nearest Coinbase close, and a tax-lot report (FIFO or average cost, by year sold) downloads as CSV. Not tax advice.
>
> **CPA build (Oct 26, 2026; clarification 35):** the chart range, holdings sort and tax-lot method are remembered between visits and saved with the account (cross-journey rule 2).

### US-6.4 Read-only wallet / exchange import · P2 · 13 pts
**As a** user, **I want** to import holdings from a public wallet address or a read-only exchange API **so that** I don't have to enter trades by hand.

- Public addresses only, or read-only API keys. The app never asks for seed phrases or private keys.
- API keys are stored encrypted in the OS keychain/keystore and are never shown again after saving.

> **CPA build (Oct 26, 2026; clarification 29):** exchanges come in as exported CSV files instead of API keys: Coinbase transaction history, Kraken trades and Binance spot trade history are read in the browser by the transactions import, with a preview, a reason for every skipped row and no keys of any kind.

> **CPA build (Oct 25, 2026):** public **Bitcoin** and **Ethereum** addresses only. Bitcoin balances come from mempool.space; ETH and the ERC-20 tokens CPA lists come from Etherscan. The browser never calls the explorers: the `wallet-lookup` Supabase Edge Function does, so the Etherscan key stays a server-side function setting. The function needs a signed-in user, checks the address format strictly, answers only the origins in `ALLOWED_ORIGINS`, and allows 10 lookups an hour per user and 30 per IP (`wallet_lookup_quota`, server-only). Addresses are never stored on the server. Before anything is sent, the app refuses input that looks like a recovery phrase or a private key and says why. The import shows a preview, then records the difference from earlier imports of the same address, so importing twice doesn't double-count. Exchange API keys aren't supported: a browser app has no OS keychain to hold them.
>
> **Cost basis (Oct 25, 2026):** the function also returns the address's transfers, netted per coin per UTC day and priced at that day's close from Coinbase Exchange. A first import records each day as a dated transfer at that day's price. When older history wasn't read, the balance before it is an opening transfer at the earliest day read. A re-import adds only later days. Anything the history doesn't explain becomes an adjustment at today's price, so holdings always match the wallet. "Rebuild from history" replaces an address's earlier rows.
> - Done when: a wallet's realized and unrealized P&L reflect the prices on the days the coins arrived, the preview names the price source, and days without a price say they use today's.

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

> **CPA build (Oct 25, 2026):** browsers can't add home-screen widgets, so CPA is an installable app instead (web app manifest and service worker). Installing it adds an icon that opens Watchlist, with shortcuts to Watchlist, Unlocks and Alerts. Settings → Preferences has the Install row.

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

> **CPA build (Oct 18, 2026):** "Last updated" uses the time CryptoRank reported the figures (`coins.price_updated_at`), not the time of the last poll. Coin detail names the source of each figure: CryptoRank for price, 24h change, market cap and volume on synced coins, CPA sample data for the rest.

> **CPA build (Oct 26, 2026):** price charts name their source underneath ("Coinbase closes, USD, UTC" or "CPA sample data"); Portfolio names any coins on sample data; "Use market price" says which close it used; and the Portfolio disclaimer names CryptoRank, Coinbase and sample data.
>
> **CPA build (Oct 26, 2026; clarification 36):** TRON, USDC and Maker now have real charts from Kraken (Maker as SKY × 24,000), named as such, so all 34 live coins have price history.
>
> **CPA build (Oct 27, 2026; clarification 39):** Maker's price and 24h change come from Sky's CryptoRank row × 24,000 every 10 minutes, and its source line says so ("price and 24h change as SKY × 24,000"). CryptoRank gives no Maker market cap, so Market cap shows "—" and the source line leaves it out instead of showing a stale sample figure.

### US-9.5 Offline mode · P1 · 3 pts
**As a** commuter, **I want** to see my last-loaded data offline **so that** the app still works on the subway.

- Shows an offline banner and cached watchlist, portfolio, and unlocks. Actions are queued and sync when back online.

> **CPA build (Oct 18, 2026):** the banner "You're offline: showing saved data" appears at the top while the browser is offline. The last loaded prices and the bundled data stay on screen, the price feed pauses and refreshes on reconnect, and Refresh is disabled. Unsaved account changes are retried every 15 s until they save. Data isn't cached across reloads.

> **CPA build (Oct 25, 2026):** a service worker now caches the app shell and the last coin prices, so CPA reloads offline in production builds and shows the last synced prices under the offline banner.

### US-9.6 Account deletion · P0 · 2 pts
**As a** user, **I want** to delete my account and data from inside the app **so that** I control my privacy (App Store and Google Play requirement).

### US-9.7 Spanish (and Portuguese) interface · P1 · 5 pts
**As a** Spanish speaker, **I want** to use the whole app in Spanish **so that** I understand every figure, warning and setting.

- Every screen, message, alert and screen-reader label is available in Spanish; prices, percentages and dates use Spanish formats.
- The language follows the browser on first visit, can be changed at any time, and is saved to the account.
- Each language is named in its own language ("English", "Español"), so a user can find theirs whichever language is showing.

> **CPA build (Oct 26, 2026):** English and Spanish (clarification 30). Language is in the main menu, the Accessibility menu and Settings › Preferences, and is saved in `user_settings.language`. Spanish shows `80.156,48 $`, `2,88 B $` and `26 oct 2026`. Exported CSV formats and saved transaction notes stay in English so imports keep working, and the legal pages say the English version prevails.

> **CPA build (Oct 26, 2026):** Portuguese (Brazil) added the same way (clarification 34): `US$ 80.156,48`, `US$ 2,88 tri`, `26 de out. de 2026`.

### US-9.8 Any screen size · P1 · 5 pts
**As** Priya at her desk or Leo on a tablet, **I want** CPA to use the whole screen **so that** I can read more at once without a phone-sized column.

- Phones keep the bottom nav; tablets fill the width; notebooks and desktops show the tabs as a sidebar.
- Nothing scrolls sideways at any width or at 200% text, in portrait or landscape.
- Works in current Chrome, Edge, Firefox and Safari on Windows, macOS, Linux, ChromeOS, iOS and Android.

> **CPA build (Oct 26, 2026):** phone layout below 700px, full width from 700px, and a sidebar from 1024px with pages up to 1,120px (clarification 31). Checked at 390, 768, 1024, 1366, 1440 and 1920px and in landscape at 844×390, in Chrome and Firefox. Safari is still to be checked.

---

## Non-Functional Requirements

| Area | Requirement |
|---|---|
| Performance | Cold start to first data ≤ 2 s (p75) on mid-range devices; list scroll at 60 fps |
| Data freshness | Visible prices ≤ 30 s old while the app is in the foreground. CPA build: synced CryptoRank prices are up to 10 min old on the free plan, and the stale marker says so |
| Reliability | Crash-free sessions ≥ 99.5% |
| Security | TLS 1.2+; tokens in Keychain/Keystore; no secrets in the app binary; read-only integrations only |
| Privacy | Analytics opt-out; no sale of personal data; GDPR/CCPA-compliant data export and delete |
| Accessibility | WCAG 2.2 AA equivalent; Dynamic Type up to 200% |
| Compliance | "Not financial advice" disclaimer on Coin Detail, Token Sales, and Portfolio |
| Localization | String externalization from day 1; launch in EN, with RU/UK/ES/ZH/KO/TR as follow-ups. CPA build: EN, ES and PT-BR (US-9.7) |
| Devices | Phones, tablets, notebooks and desktops in current browsers (US-9.8) |

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
