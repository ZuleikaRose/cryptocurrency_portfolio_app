user prompt

# The build prompt (paste into Claude Code from the project root)

I would like you to build a Front-End Single Page Application from the wire frames and user stories I have mapped out.

The tech-stack for this application will be as follows:

- React.js + Vite
- React Router DOM with Browser Router

Skills necessary for this application are as follows:

- Front-End Design
- UI UX Pro Max
- Taste
- Design Motion Principles

There will be no API interactions and all data should be retained only at the browser level, meaning if I refresh/rerender my site all of the data should reset.

I have created a series of documents and images as a reference for what I would like this application to look like and isolated everything by pages. Take a look at this folder @./app_outline and read the `user_journey.md` file to get context for the users journey through the application. Then look at the `/home/zuleikarose/cryptocurrency_portfolio_app/app_outline/figma-wireframe` to visualize the entire application. Finally under pages, you'll find a wire-frame corresponding to each page along with a detailed user story for how a user would interact with this page. Additionally, when it comes to design style, you can read the `style_guide.md` and apply its guidelines as you see fit.

Take a look at the @../user_stories.md. Gather all details.

Use the Context7 MCP to gather all relevant documentation for our tech stack.

Ensure to utilize the `playwright` & `Chrome Dev Tools` MCP servers to supervise the development of this Application. After each page is built, use Playwright to screenshot it and compare against the wireframe before moving on and ensuring it's output matches the desired outcome from the wire-frames and user stories.

Finally the execution of this app should happen in phases, phases should correspond roughly to pages or major feature areas. I'll leave it to you to declare the number of phases and what their independent passing conditions are, but these conditions should be approved by me and allow me to provide you feedback before moving on into the next phase.

Before writing any code, please confirm your understanding of the application by summarizing the user journey and listing the pages you plan to build.

---

# Clarifications agreed during the build

These override the brief and the `app_outline` documents where they differ.

1. Page specs live in `app_outline/pages/` (`00-app-shell.md` to `29-not-found.md`), one per page, each with a wireframe, stories and "Done when" conditions.
2. The app is called **CPA (Cryptocurrency Portfolio App)**, not CryptoRank.
3. The bottom nav has **7 tabs**: Home, Market, Explore, Funding, Unlocks, Watchlist, Portfolio. There's no "More" tab.
4. Text written for a streaming service (autoplay, captions, episodes) is adapted to crypto equivalents.
5. **Only the demo account and guest browsing reset on refresh.** Real accounts persist in the browser's `localStorage`. This replaces "all of the data should reset" above.
6. The stories file is `app_outline/user_stories.md`.
7. `lookup.py` uses the CryptoRank API, returns the rank as an integer, and reads its key from environment variables or `.env`.
8. **Never commit the API key to the repository or share it publicly. Use environment variables to keep it secure.**
9. All the support and info pages are built.
10. The layout is a phone-width app shell that's also usable on desktop.
11. **Accounts moved to Supabase (Oct 17, 2026).** This replaces "Real accounts persist in the browser's `localStorage`" in clarification 5.
    - Sign-in uses Supabase Auth with email and password.
    - Account data is stored in the `cpa` schema through the Supabase REST API, with row-level security on every table.
    - Guest browsing and the demo still live in memory and reset on refresh.
    - Market data was bundled sample data at this point. Clarification 14 adds live CryptoRank prices.
12. **Account decisions.**
    - Sign-up logs straight in ("Confirm email" is off).
    - Simulated billing is stored in `user_state.simulated_billing`, and the real subscription tables stay server-only.
    - Delete account marks the profile deleted. Logging in to a deleted account offers **Remove my data**, which erases it for good.
13. **`schema.sql` and `drawsql.png` are the data model.** They hold every feature and setting in 51 tables (see "Data model" below). The Supabase migrations in `supabase/migrations/` are the live version and win where they differ.
14. **Live prices from CryptoRank (Oct 18, 2026).** This replaces "There will be no API interactions" above, for prices only.
    - The `cryptorank-sync` Supabase Edge Function fetches the top 200 coins from CryptoRank v3 every 10 minutes (pg_cron) and writes price, 24h change, market cap and volume into `cpa.coins`.
    - 34 coins are mapped by `coins.cryptorank_slug`, including Zcash (ZEC, added Oct 18, 2026), Toncoin (listed on CryptoRank as Gram) and Maker. 7d change and FDV come from CryptoRank's per-coin endpoint about every 2 days. The other coins, and 1h change, sparklines, unlocks, rounds and sales, stay sample data.
    - The app reads the prices through the Supabase REST API on load and every 30 s. A failed request keeps the last data on screen with an error banner and Retry. Before the first sync, or without Supabase, the simulated feed stands in.
    - `CRYPTORANK_API_KEY` is an Edge Function secret set from `.env`. It never reaches the browser or the repository.
    - Freshness: the free CryptoRank plan allows 400 credits a day, so prices can be up to about 10 minutes old instead of 30 s. This refresh rate is accepted (Oct 18, 2026). The "Last updated" time and stale marker show the real age.
    - Coin detail names the source of each figure (CryptoRank or CPA sample data).
15. **Named watchlists (Oct 25, 2026).** Main plus up to 9 named lists (US-6.2), stored in `watchlists` and `watchlist_list_coins`.
16. **Moved reminders (Oct 25, 2026).** When an unlock or sale moves by up to 14 days, its reminder moves with it and the user is told the old and new dates (US-4.2).
17. **Installable app (Oct 25, 2026).** A web app manifest and service worker replace home-screen widgets (US-8.1) and cache the app shell and last prices across reloads (US-9.5).
18. **CSV export and import (Oct 25, 2026)** of portfolio transactions for signed-in users (11-portfolio.md).
19. **MATIC finds Polygon (Oct 25, 2026).** Polygon is listed as POL; searching, CSV import and the watchlist picker also accept its former ticker MATIC, and Coin detail shows "Formerly MATIC". DOT was already listed.
20. **Supabase hardening (Oct 25, 2026).** Guests can insert only fixed columns of `support_tickets` and `feedback`, with length and format checks. Edge Functions answer only `ALLOWED_ORIGINS`, cap the body size and return generic errors.
21. **Read-only wallet import (Oct 25, 2026).** Bitcoin and Ethereum public addresses only (US-6.4), through the `wallet-lookup` Edge Function, so explorer keys stay server-side. Sign-in required, rate-limited per user and IP, address never stored. The app never asks for seed phrases, private keys or exchange keys.

# Required material from the outline documents

## Personas (user_journey.md §1)

- **Maya, active trader:** spot movers early, track the watchlist, react to unlocks before price impact.
- **Daniel, research investor:** tokenomics, vesting, who funded a project, entry vs. round price.
- **Priya, VC / fund analyst:** funding rounds by sector, competitor funds, saved filters, share cards, follow funds.
- **Leo, newcomer:** plain explanations of every metric, a simple view, a few coins followed safely.

## Journey opportunities (user_journey.md §2–5)

The journey maps name a pain point at each stage and the fix they propose. All of these are built, unless marked otherwise:
- **Maya:**
  - Ask for notifications only at her first alert.
  - Sort unlocks by % of circulating supply, with a "1% or more only" toggle.
  - A one-tap **Remind me** on every unlock card.
  - Alerts that state the amount, $ value and % of supply.
- **Daniel:**
  - A verified badge, contract address and market cap in search results, to tell copycats apart.
  - A "supply at a glance" bar.
  - "Your entry vs. seed / private / public price".
  - Price moves tied to unlocks, listings and funding events.
- **Priya:**
  - Saved filters pinned to the top of Fundraising.
  - "Frequent co-investors" on fund profiles.
  - Clean share cards that show the source and date.
  - Follow frequency per fund: instant, daily or weekly.
- **Leo:**
  - A Simple view with fewer columns.
  - Tap-to-explain ⓘ on every metric.
  - A watchlist pre-filled from his chosen interests.
  - Neutral risk indicators, such as high unlock pressure or low liquidity, with explanations and never advice (not built yet).

## Moments that matter (user_journey.md §7)

| Moment | Why it matters | Measured by |
|---|---|---|
| First data on screen | Earns trust, reduces drop-off | 2 s or less from a cold start |
| First watchlist add | Strongest early sign of retention | Share of new users adding a coin in session 1 |
| First alert on time | Proves the app's value | Delivered within 30 s of the trigger |
| A shared card gets opened | Organic growth | Shares that become new users |
| Day-7 return | Habit formed | 7-day retention |

## Core flows (user_journey.md §6)

- **First launch:**
  1. A 3-card onboarding (Markets, Unlocks, Fundraising) and a skippable interest picker.
  2. A watchlist pre-filled from those interests.
  3. Browsing as a guest.
  4. Sign-in only when the user stars a coin, sets an alert or saves a portfolio. The action then completes.
  5. The notification permission asked in context.
- **Unlock reminder:** Unlocks, This week, then **Remind me**. Sign in if needed, pick 1h / 24h / both, see an explanation before the browser prompt, and get a confirmation toast.
- **Research:** search results with verified badges lead to Coin detail (Overview, Tokenomics and vesting, Funding and investors, Markets), then on to a fund profile or the watchlist and portfolio.

## Cross-journey rules (user_journey.md §8)

1. Ask for notifications only when the user sets an alert.
2. Remember filters, sort orders and chart ranges for each tab.
3. Tie price moves to unlocks, funding and listings on the chart.
4. Show the data source, last-updated time and verified contract on key screens.
5. Offer a Simple vs Pro density setting.
6. Allow full browsing as a guest; require sign-in only for saving, alerts and portfolio.

## MVP stories (user_stories.md, P0)

| Area | Stories | Key acceptance points |
|---|---|---|
| Onboarding and account | 1.1, 1.2, 1.4 | Guest browsing; plain sign-in errors with retry; no permission prompt on launch |
| Markets | 2.1, 2.2, 2.5 | Rank, logo, name, ticker, price, signed 24h % with ▲/▼, 7d sparkline; refresh at least every 30 s; skeleton loading; sort and filters that persist, with removable chips; search grouped by type from the 2nd character, debounced 250 ms, with verified badge, market cap and short contract address; clearable recent searches |
| Coin detail | 3.1, 3.3, 3.4, 3.5 | 1D/7D/1M/3M/1Y/ALL, line and candle, crosshair, text summary; supply bar with ⓘ definitions; vesting area chart with a Today line and the next 5 unlocks; rounds with lead investors and seed/private ROI |
| Token unlocks | 4.1, 4.2 | Today / This week / This month / Custom, Watchlist only, default sort by % of circulating supply, live countdown, warning style over 2%; one-tap reminder (1h / 24h / both, defaulting to the last choice) |
| Fundraising | 5.1, 5.3 | Filters for sector, round type, amount, date and investor; cards with up to 3 investors plus "+N"; fund profile with tier, number of investments, recent rounds and top sectors |
| Watchlist | 6.1 | Star from a list row, Coin detail or search; drag to reorder, with up/down buttons as the keyboard alternative; guest watchlist merges into the account on sign-in |
| Alerts | 7.1, 7.2 | Price above or below, % change in 1h / 24h; one-time or recurring with a 1-hour cool-down; pause, edit and delete in one place |
| Platform | 8.3 | Deep links to coin, unlock, round, fund and token-sale screens |
| Settings and trust | 9.1, 9.3, 9.4, 9.6 | Dark/light/system theme and display currency; screen readers read values in full; "Last updated" on every data screen, stale after 5 minutes; account deletion inside the app |

P1 and P2 stories (gainers/losers, Simple/Pro density, event markers, saved filters, follow funds, token sales, the manual portfolio, weekly digest, quiet hours, share cards, colour conventions) are built where the browser allows. Multiple watchlists, CSV import and export, read-only Bitcoin and Ethereum wallet import, and an installable app with a cache across reloads were added on Oct 25, 2026 (clarifications 15–21). Widgets, haptics and social sign-in are not built. See `README.md`.

## Non-functional requirements (user_stories.md)

- **Speed:** first data in 2 s or less; smooth list scrolling.
- **Freshness:** prices no more than 30 s old while visible. CPA's live prices sync every 10 minutes on the free CryptoRank plan (clarification 14), so the stale marker shows when they're older than 5 minutes.
- **Reliability:** at least 99.5% of sessions without a crash.
- **Accessibility:** WCAG 2.2 AA, with text up to 200%.
- **Privacy and security:** analytics off by default; no sale of personal data; data export and delete available; no secrets in the app; read-only integrations only.
- **Disclaimer:** "Not financial advice" on Coin detail, Token sales and Portfolio. The style guide adds Fundraising.
- **Localization:** English at launch, with strings kept separate from logic so other languages can follow.

## Data and permissions (user_journey.md §16–17)

- **Collected, and only where a feature needs it:**
  - account name and email
  - plan and simulated payment details (card brand, last 4 digits and expiry only)
  - watchlists, portfolio transactions, alerts and follows (a wallet address is used for one lookup and never stored)
  - search queries and filter settings
  - feedback, tickets and bug reports
  - promo and points use
  - device details only when the user includes them in a report
- **Permissions:**
  - Notifications are asked for in context.
  - Analytics is opt-in.
  - The user manages every preference in Settings, can export their data, and can delete their account and then their data.
  - The Privacy policy page lists what's stored and where.

## Data model (schema.sql, drawsql.png)

`schema.sql` models every feature and setting as 51 PostgreSQL tables (55 foreign keys, 3 views) in the `cpa` schema. `drawsql.png` draws them in eight groups:

| Group | Tables |
|---|---|
| Reference | categories, plans, promotions, faq_sections, faq_items, learn_articles, glossary_terms |
| Market | coins, coin_prices, exchanges, coin_markets, market_sync |
| Research | vesting_schedules, vesting_allocations, unlock_events, funds, fund_sectors, funding_rounds, round_investors, token_sales |
| Watchlist & portfolio | watchlist_items, watchlists, watchlist_list_coins, recent_coins, recent_searches, sentiment_votes, transactions, wallet_lookup_quota, user_interest_coins, user_interest_sectors, fund_follows, project_follows |
| Accounts | users, sessions, login_attempts, password_reset_tokens, password_reset_requests, user_state, affiliates |
| Alerts & billing | price_alerts, reminders, notifications, saved_filters, subscriptions, promo_redemptions, billing_history, payment_methods |
| Settings | user_settings (one row per user: display, notifications, AI, accessibility menu, each tab's filters) |
| Support | support_tickets, support_log, feedback |

The Supabase migrations run a 47-table version of this model:
- Supabase Auth replaces the password and session tables.
- Row-level security is on every table.
- `coin_sentiment` became the `coin_sentiment_today()` function.
- `user_state` gains `simulated_billing`.
- `coins` gains `cryptorank_slug`, `price_source` and `price_updated_at`, and `market_sync` records each live price sync.
- `wallet_lookup_quota` rate-limits the `wallet-lookup` Edge Function; like `market_sync`, it's server-only.

## Style guide essentials (style_guide.md)

- **Principles:** data first, glanceable (the market read in under 3 s), trustworthy, dense but calm, thumb-friendly (targets of at least 44×44).
- **Voice:**
  - Expert and neutral; never hype or advice.
  - Tone by context: factual for market data, friendly and brief for onboarding and empty states, plain and actionable for errors, urgent only for time-sensitive alerts.
  - Sentence case; uppercase tickers.
  - Numbers: `$1.24B`, signed 2-decimal percentages with a true minus, `Oct 17, 2026`, relative time under 7 days.
- **Colour:**
  - Dark theme by default.
  - Market up/down colours with an option to swap them and a colour-blind safe pair.
  - Category accents: fundraising violet, unlocks amber, sales cyan, DeFi green, AI pink, L1/L2 blue.
  - Text contrast at least 4.5:1; never colour alone.
- **Type:** Inter (display 34/40, H1 24/32, H2 18/24, body 15/22, caption 12/16), tabular figures for all numbers, JetBrains Mono for addresses.
- **Layout:** 4 pt base, 16 pt gutters and card padding, 12 pt card radius, 20 pt sheet radius, 64 pt coin rows.
- **Components:**
  - Coin row with a 7-day sparkline. The guide's swipe actions (watchlist, alert) are visible buttons in CPA, since swipe-only actions fail keyboard users.
  - Change pill: 6 pt radius, 10% fill of the up or down colour, full-colour text and arrow.
  - Buttons: one 48 pt primary per screen, plus secondary (outlined), tertiary (text) and destructive.
  - Logos: coins circular (24 pt in lists, 40 pt in headers) with a 1 pt ring; funds as 8 pt rounded squares. Outlined icons, filled only on the active tab.
  - Chart with ranges and event markers.
  - Unlock card with countdown and progress bar.
  - Funding round card.
  - Sortable tables with a sticky first column.
- **States:**
  - Loading: skeleton.
  - Empty: illustration, one sentence, one action.
  - Error: inline banner with retry, cached data kept.
  - Offline: a top banner, "You're offline: showing saved data".
  - Stale: over 5 minutes, shown in secondary text with a clock icon.
- **Motion:** 150 / 250 / 350 ms; a 400 ms price flash with no number animation; Reduce Motion honoured.
- **Accessibility checklist:** full spoken values, chart summaries, no announcement spam, focus order that matches the visual order.
