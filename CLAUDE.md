# CLAUDE.md

Working rules for Claude Code in this repo. CPA (Cryptocurrency Portfolio App) is a React SPA built from the brief in `prompt.md` and the documents in `app_outline/`. Prices for 34 coins come live from CryptoRank through a Supabase Edge Function, and price history for 31 of them from Coinbase through another; other market data is bundled sample data; accounts run on Supabase. Read `README.md` for the overview.

## Commands

Run these from `app/`:
- `npm run dev`: Vite on http://localhost:5173. Use `npx vite --port 5173 --strictPort` if you need the port fixed for browser tests.
- `npm run lint`: oxlint. It must pass with no output before you commit.
- `npm run build`: production build. Run it to catch broken imports, because oxlint doesn't resolve modules.
- Hosting: Vercel project `cpa` (root directory `app`) is connected to GitHub. Merging to `main` deploys https://cpa-black.vercel.app; branches and PRs get previews and a "Vercel" check. Headers and the SPA rewrite are in `app/vercel.json`. Lint and build before pushing. Vercel holds only the two `VITE_` variables; never add a server key there.

From the repo root:
- `supabase functions deploy cryptorank-sync --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api`: deploys the live price sync. Type-check and lint it with Deno first (`deno check`, `deno lint`); the deploy hook expects that dry run in the same command.
- `supabase functions deploy wallet-lookup --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api`: deploys the read-only wallet lookup (US-6.4). Same Deno dry run first. It checks the caller's Supabase session itself, so the gateway's JWT check is off.
- `supabase functions deploy price-history-sync --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api`: deploys the Coinbase price history sync (clarification 26). Same Deno dry run first. pg_cron calls it without a JWT, and `claim_price_history_sync()` throttles it.
- `supabase functions deploy cryptorank-lookup --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api`: deploys the lookup `lookup.py` calls. Same Deno dry run first. The script sends the publishable key (not a JWT), so the gateway's JWT check is off; a daily credit budget limits use.

## Sources of truth, in order

1. **The user's clarifications** (listed in `prompt.md`). These override the documents.
2. **`app_outline/pages/NN-*.md`**: one spec per page, with its wireframe, components, stories, states and "Done when" conditions. Each page's spec is named in `src/routes.js` (`doc`).
3. **`app_outline/figma-wireframe/`**: the layout and visual reference. The violet accent comes from here.
4. **`app_outline/style_guide.md`**: tokens, type, voice, components, states, motion, accessibility.
5. **`app_outline/user_stories.md`** (US-x.y, priorities P0/P1/P2) and **`app_outline/user_journey.md`** (personas Maya, Daniel, Priya and Leo, journey maps, cross-journey rules, moments that matter).
6. **Data model:**
   - `supabase/migrations/` is what the live database runs.
   - `schema.sql` (53 tables) and its diagram `drawsql.png` are the portable model of every feature. They're grouped as Reference, Market, Research, Watchlist & portfolio, Accounts, Alerts & billing, Settings and Support.
   - Where the two differ (Supabase Auth instead of password and session tables, RLS, `simulated_billing`), the migrations win.

Before changing a page, read its spec and the stories it cites. Before storing anything new for a user, find its table in `schema.sql` / `drawsql.png`.

## Fixed decisions

- **Name:** "CPA", not CryptoRank. The style guide and stories say CryptoRank; adapt that text to CPA.
- **Bottom nav:** 7 tabs: Home, Market, Explore, Funding, Unlocks, Watchlist, Portfolio. No "More" tab. (The style guide's 5-tab bar is superseded.)
- **Data:**
  - Market data (coins, funds, rounds, unlocks, sales) is sample data in `src/data/`. `supabase/seed` loads the same data into the `cpa` reference tables.
  - **Live prices** (user's decision, Oct 18, 2026; `prompt.md` clarification 14):
    - The `cryptorank-sync` Edge Function (`supabase/functions/`) writes CryptoRank price, 24h change, market cap and volume into `cpa.coins` every 10 minutes (pg_cron) for coins with a `cryptorank_slug`, and 7d change and FDV from the per-coin endpoint about every 2 days (6 coins a run). Each run is recorded in the server-only `cpa.market_sync`.
    - The 10-minute refresh rate is accepted (user's decision, Oct 18, 2026). Toncoin's live entry is CryptoRank's Gram (GRAM); Maker comes only through the per-coin endpoint.
    - The app reads them over REST through `lib/market.js` only, on load and every 30 s, and merges them onto the sample coins. Keep the fallbacks: last data plus `ErrorBanner` when a request fails, and the simulated feed before the first sync.
    - The free CryptoRank plan allows 400 credits a day and 10 requests a minute. Pages cost 2 credits a run and details about 17 a day: about 305 a day in all. `lookup.py` gets up to 60 more through `cryptorank-lookup` (`DAILY_CREDITS`), 365 in all. Don't raise the schedule, the page count, `DETAILS_PER_RUN` or `DAILY_CREDITS` without a paid plan.
    - To add a coin, append it to `added` in `src/data/coins.js` (its own PRNG keeps the other coins' sample figures unchanged), run `npm run seed`, then map its `cryptorank_slug` in a migration.
    - Name the source wherever prices show: "CryptoRank" for synced figures, "CPA sample data" for the rest.
  - **Wallet import** (user's decision, Oct 25, 2026; `prompt.md` clarification 21): public Bitcoin and Ethereum addresses only, looked up by the `wallet-lookup` Edge Function (mempool.space for BTC, Etherscan for ETH and listed ERC-20 tokens). It needs a signed-in user, is rate-limited in the server-only `cpa.wallet_lookup_quota`, and never stores the address. Never ask for, accept or send a recovery phrase, private key or exchange key.
    - Cost basis (`prompt.md` clarification 24): transfers are netted per coin per UTC day and priced at Coinbase Exchange's daily close (`wallet-lookup/prices.ts`, at most 12 requests a lookup). `walletImportPlan()` in `lib/wallet.js` turns them into dated `transactions` rows tagged "Wallet import <short address>"; keep the opening balance, the today's-price adjustment and the "Coinbase, UTC" source note, so holdings always match the wallet and the price source is named.
  - **Price history** (user's decision, Oct 26, 2026; `prompt.md` clarification 26): the `price-history-sync` Edge Function writes Coinbase Exchange closes into `cpa.coin_prices` every 15 minutes, and `change_1h`, `sparkline_7d` and `history_updated_at` into `cpa.coins`. Charts read one range through `cpa.price_history()` via `lib/history.js` (`usePriceHistory`), never by selecting `coin_prices` directly (PostgREST caps rows at 1,000). Coins with `historyUpdatedAt` take their 7d change from the sparkline so the two always agree. Name the source under every chart ("Coinbase closes, USD, UTC" or "CPA sample data"), and show a skeleton, not sample data, while a live coin's range loads.
    - Without Coinbase history the 7-day sparkline is a unitless sample shape: never scale it by a price. `sparkFacing()` in `lib/market.js` keeps its direction on the live 7d change (clarification 25).
  - **Portfolio performance and tax lots** (clarification 28): `valueHistory()` takes Coinbase series from `usePriceHistories` and falls back to sample history per coin; the chart names its source per coin. "Use market price" calls `cpa.price_at` via `fetchPriceAt`. `lib/taxlots.js` derives the FIFO / average-cost report from transactions (nothing stored); average-cost gains must equal `computeHoldings`' realized P&L. Keep "Not tax advice" on the report and its row.
  - **Exchange CSV import** (clarification 29): `lib/exchanges.js` turns Coinbase, Kraken and Binance exports into records that `readTransactionsCsv` validates like CPA rows. Add a format there (detected by header), never an API key flow. Prices must be USD; USD stablecoins count 1:1 and the preview says so; skip anything else with a reason.
  - **Risk indicators** (clarification 27): `lib/risk.js` flags unlock pressure, low liquidity and low float against the fixed thresholds in `RISK_RULES`. Each indicator states the coin's figures and the threshold; never add a score, a rating or wording that suggests an action.
  - **Guest** and **demo** state live in memory and reset on refresh.
  - **Accounts** use Supabase (user's decision, Oct 17, 2026): Supabase Auth for sign-in, and the `cpa` schema for account data. All of it goes through `lib/supabase.js` (publishable key only) and `lib/cloud.js`, which saves only the rows that changed. Every new per-user field needs a column, a mapping in `cloud.js`, and RLS in a new migration under `supabase/migrations/`.
  - Simulated billing lives in `user_state.simulated_billing`. `subscriptions` and `billing_history` stay server-only. Account deletion and data removal go through `cpa.delete_my_account()` and `cpa.erase_my_data()`.
  - The browser keeps only the Auth session (`cpa:v1:auth`). Other `localStorage` access goes through `lib/storage.js` (`readJson`, `writeJson`, `removeKey`); check the boolean result of every write.
- **Streaming wording:** some source text talks about streaming (autoplay, captions, "episodes"). Adapt it to crypto equivalents such as auto-refresh and chart summaries.
- **Layout:** a phone-width shell (`--shell-width: 440px`) that's also usable on desktop, where it sits in a centred frame.
- **Stack:** React 19, Vite 8, react-router-dom 7 with `BrowserRouter`. Navigations run in `startTransition`.

## Data model rules

- **Schema changes:** add a new file to `supabase/migrations/` (apply it with the Supabase MCP `apply_migration`, then save the file under the version it records). Never edit an applied migration.
- **Keep the references in step:** mirror the change in `schema.sql` and regenerate `drawsql.png` (`npm run diagram` in `tools/diagram/`; add new tables to a group in `erd.py`), so both still describe every table. Keep the README's table count and group list correct.
- **Every user table:** RLS on, policies scoped to `(select auth.uid()) = user_id`, a covering index on every foreign key, and a mapping in `lib/cloud.js` (with load and save) when the app stores it.
- **Reference tables:** read-only to `anon` and `authenticated`; only the seed script or server code (the `cryptorank-sync` Edge Function) writes them. Re-run `npm run seed` in `supabase/` after changing `app/src/data/`.
- **After DDL:** run the security and performance advisors (`get_advisors`) and fix or explain every warning.
- **Personal data:** collect only what a feature needs (journey §16–17). Analytics stay off by default, and export and delete must keep working.

## Security

- `SUPABASE_SECRET_KEY` (in `.env`) bypasses RLS: use it only in server-side scripts such as `supabase/seed`. Never give it a `VITE_` prefix or import it in `app/`. After a build, check `app/dist` doesn't contain it.
- `CRYPTORANK_API_KEY` lives only in the Edge Function secrets (user's decision, Oct 25, 2026). `lookup.py` doesn't read it: it calls the `cryptorank-lookup` Edge Function with the publishable key. The Edge Functions read it from their secrets, set from `.env` with `supabase secrets set --env-file <(grep '^CRYPTORANK_API_KEY=' .env)`; `supabase secrets list` shows only its SHA-256 digest. **Never commit `.env`, never print the key, and never paste it into code, docs, logs or commit messages.** `.env.example` holds names only.
- `ETHERSCAN_API_KEY` follows the same rules: it's a `wallet-lookup` function setting (`supabase secrets set --env-file <(grep '^ETHERSCAN_API_KEY=' .env)`), never a `VITE_` variable.
- Edge Functions are public endpoints. Each one answers only the origins in `ALLOWED_ORIGINS`, caps the request body, validates every input field, and returns generic error text (details go to the function logs).
- Before every commit, check the staged diff for the key and confirm `git check-ignore .env`.
- Wrap browser I/O in try/catch or a failure check: storage, clipboard, downloads, `FileReader`, Web Crypto and notifications. Tell the user plainly when it fails; never fail silently.

## Writing rules (style guide §2)

- **Voice:** expert, precise and neutral, like a research analyst. No hype, no "moon", "guaranteed" or "don't miss out", and no financial advice.
- **Tone by context:**
  - Market data is factual ("BTC +2.41% in 24h").
  - Onboarding and empty states are friendly and brief.
  - Alerts sound urgent only when something is time-sensitive ("ARB unlock in 1 hour: 92.6M tokens (3.2% of supply)").
  - Never use urgency just to drive engagement.
- **Case:** sentence case everywhere. Tickers in uppercase (BTC). Project names in their official casing (dYdX).
- **Numbers:**
  - Abbreviate large values (`$1.24B`, `$842.5M`, `$12.3K`) and show full precision on detail screens.
  - Percentages are signed to 2 decimals with a true minus U+2212 (`+3.21%`, `−0.48%`).
  - Dates look like `Oct 17, 2026`; under 7 days, use relative time ("in 3d 4h", "2h ago").
- **Errors:** plain, blame-free, and they say what to do next ("We couldn't load prices." plus Retry).
- **Empty states:** one friendly sentence and one action.
- **Disclaimer:** "Not financial advice. Data provided for informational purposes." on Coin detail, Fundraising, Token sales and Portfolio. The tax-lot report and its row also say "Not tax advice".

## Design rules

- **Tokens:** use only the variables in `src/styles/tokens.css`, never raw hex in components.
- **Spacing and shape:** 4px scale; 16px card padding; 12px card radius; 20px sheet radius.
- **Row heights:** coin rows 64px, settings rows 56px. Touch targets at least 44×44px.
- **Type:** Inter, using the `.num` class (tabular figures) for every price, percentage and table column. JetBrains Mono for addresses.
- **Direction:** never shown by colour alone; always pair it with ▲ ▼ or + −. Respect `data-colors` (swapped and cb-safe).
- **Components (style guide §6–7):**
  - Change pill: 6px radius, 10% fill of the up or down colour, full-colour text and arrow.
  - Primary button: 48px tall, one per screen.
  - Coin logos: circular, 24px in lists and 40px in headers, with a 1px ring and the ticker initial as fallback. Fund logos: 8px-radius squares.
  - Icons are outlined; only the active tab uses the filled variant.
  - The style guide's row swipe actions are visible buttons in CPA. If a swipe is ever added, keep the button too.
- **States (§7.8):**
  - Loading: skeleton matching the layout, never a spinner on lists. Use `useFirstLoad` and `SkeletonCards` / `SkeletonDetail`.
  - Empty: illustration, one sentence, one action.
  - Error: `ErrorBanner` with Retry, with cached data kept visible where it exists.
  - Stale: over 5 minutes old, show "Last updated" in secondary text with a clock icon.
  - Offline: `OfflineBanner` at the top, "You're offline: showing saved data" (US-9.5). The last prices stay on screen, the feed pauses and refreshes on reconnect, and feed actions (Refresh) are disabled. Use `useOnline()`.
  - `?simulate=error` triggers the error state.
- **Motion (§8):**
  - Durations: `--dur-micro` 150ms, `--dur-screen` 250ms, `--dur-sheet` 350ms.
  - Easing: ease-out for entrances, ease-in for exits.
  - Price flash: 400ms at 15% opacity, with no number animation.
  - `prefers-reduced-motion` and `settings.stopAnimations` (`data-motion="off"`) must disable all of it; the global rule in `index.css` does this.
- **Stylesheets:** `a11y.css` loads last and overrides. Watch selector specificity: `index.css` defines `:focus-visible` after the imports.

## Accessibility rules (WCAG 2.2 AA, style guide §3.4 and §9, US-9.3)

- **Contrast:** at least 4.5:1 for body text and 3:1 for large text and icons, in both themes. Check new colours before using them.
- **Screen readers:**
  - Rows read in full ("Bitcoin, price 67 thousand 412 dollars, up 2.41 percent"). Use `aria-label`s that spell out values.
  - Charts have a text summary (`ChartSummary`).
  - Live price ticks are never announced continuously.
- **Focus:**
  - Visible on every control, and never hidden under the sticky header or bottom nav (`scroll-padding` on `html`).
  - Order follows the visual order.
  - Sheets trap focus, close on Escape and return focus to the trigger.
  - Route changes announce the title and move focus to `<main>` (AppShell).
- **Text size:** works to 200% without truncating prices. Above 130%, `data-text-large="on"` stacks tables and grids, and nothing scrolls sideways.
- **Pages:** each page sets `document.title` to `"<Page> · CPA"` and has exactly one `h1`.

## Journey rules (user_journey.md §8)

1. **Notification permission:** ask only when the user sets their first alert or reminder, after an explanation. Never on launch.
2. **Remember choices:** keep filters, sorts and chart ranges per tab, in `settings`.
3. **Event context:** unlock, funding and listing markers on price charts.
4. **Trust signals:** data source, last-updated time and verified contract on key screens.
5. **Density:** a Simple vs Pro setting.
6. **Guest mode:** full browsing without an account.
   - Sign-in is required only for alerts, a saved portfolio and the like. Use `requireAuth(reason, action)`.
   - The pending action completes after sign-in, and guest data merges into the new account.
7. **Safe imports:** wallet import takes a public address only. Refuse anything that looks like a recovery phrase or private key before it leaves the device (US-6.4). Exchanges come in as exported CSV files read on the device, never as API keys (clarification 29).

## Targets (user_journey.md §7, user_stories.md non-functional requirements)

- **Speed:** first data on screen in 2 s or less; lists scroll smoothly.
- **Freshness:** visible prices no more than 30 s old; alerts fire within 30 s of their trigger. On the free CryptoRank plan synced prices can be up to 10 minutes old, so the stale state must show their real age (`price_updated_at`), never the time of the last REST poll.
- **Retention signals:** the first watchlist add and the first alert are the moments to make easy; keep both one tap away.
- **Security and privacy:** no secrets in the bundle; read-only integrations only; analytics opt-in; data export and delete available.
- **Localization:** keep UI strings out of logic where practical; English only for now.

## Workflow

- **Phases:** work in phases. Each phase has its own pass conditions, and the user approves it before you start the next. Commit and push only when asked.
- **Browser checks:** after building or changing a page, check it in the browser with Playwright or Chrome DevTools:
  - Screenshots at 390px and 1280px, compared against the wireframe and spec.
  - Console errors.
  - Horizontal overflow, including at 200% text.
  - axe-core (WCAG 2.2 AA) in dark and light themes.
  - A keyboard Tab pass.
- **Docs:** use Context7 for library documentation.
- **Code style:** match the surrounding code: short comments that cite the spec or story (`// US-4.2`, `(08-unlocks.md)`), named exports for helpers, and components under `components/`.
