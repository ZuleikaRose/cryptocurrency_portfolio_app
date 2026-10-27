# CLAUDE.md

Working rules for Claude Code in this repo. CPA (Cryptocurrency Portfolio App) is a React SPA built from `prompt.md` and `app_outline/`. Prices for 34 coins come live from CryptoRank, and price history from Coinbase (Kraken for TRON, USDC and Maker), through Supabase Edge Functions; other market data is bundled sample data; accounts run on Supabase. Read `README.md` for the overview.

## Commands

- **Node:** 26.12.1 locally (`.nvmrc`, `nvm use`). Vercel offers only 22.x and 24.x, so `engines` is `>=24` and production builds on 24.x: no APIs newer than Node 24 in build scripts.
- **From `app/`:** `npm run dev` (Vite on :5173; `npx vite --port 5173 --strictPort` for browser tests), `npm run lint` (oxlint, must print nothing before a commit), `npm run build` (catches broken imports oxlint misses), `npm run i18n:check` (must report 0 missing).
- **Hosting:** Vercel project `cpa` (root `app`) is connected to GitHub. Merging to `main` deploys https://cpa-black.vercel.app; branches and PRs get previews and a "Vercel" check. Headers and the SPA rewrite are in `app/vercel.json`. Vercel holds only the two `VITE_` variables; never add a server key there.
- **Edge Functions** (from the repo root): `supabase functions deploy <name> --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api` for `cryptorank-sync` (live prices), `wallet-lookup` (US-6.4; checks the session itself), `price-history-sync` (clarification 26; pg_cron calls it without a JWT, `claim_price_history_sync()` throttles it) and `cryptorank-lookup` (called by `lookup.py` with the publishable key, limited by a daily credit budget). Run `deno check` and `deno lint` first, in the same command: the deploy hook expects that dry run. `config.toml` already sets `verify_jwt = false` for all four; if the hook blocks a CLI deploy, the Supabase MCP `deploy_edge_function` (with the user's approval) uploads the same files.

## Sources of truth, in order

1. **The user's clarifications** in `prompt.md`; they override the documents.
2. **`app_outline/pages/NN-*.md`**: one spec per page (wireframe, components, stories, states, "Done when"), named in `src/routes.js` (`doc`).
3. **`app_outline/figma-wireframe/`**: layout and visual reference (the violet accent comes from here).
4. **`app_outline/style_guide.md`**: tokens, type, voice, components, states, motion, accessibility.
5. **`app_outline/user_stories.md`** (US-x.y, P0/P1/P2) and **`user_journey.md`** (personas Maya, Daniel, Priya, Leo; journeys; cross-journey rules; moments that matter).
6. **Data model:** `supabase/migrations/` is what the live database runs. `schema.sql` (53 tables, grouped Reference, Market, Research, Watchlist & portfolio, Accounts, Alerts & billing, Settings, Support) and `drawsql.png` are the portable model. Where they differ (Supabase Auth instead of password and session tables, RLS, `simulated_billing`), the migrations win.

Before changing a page, read its spec and the stories it cites. Before storing anything new for a user, find its table in `schema.sql` / `drawsql.png`.

## Fixed decisions

- **Name** "CPA", not CryptoRank (adapt the style guide's and stories' CryptoRank text). **Nav:** 7 tabs (Home, Market, Explore, Funding, Unlocks, Watchlist, Portfolio), no "More"; a bottom bar on phones and a sidebar from 1024px. **Stack:** React 19, Vite 8, react-router-dom 7 (`BrowserRouter`), navigations in `startTransition`.
- **Layout** (clarification 31): phone below 700px (`--shell-width: 440px`), full width from 700px with pages up to `--page-width`, sidebar from 1024px; breakpoints in `styles/responsive.css`.
- **Sample data:** coins, funds, rounds, unlocks and sales live in `src/data/`; `supabase/seed` loads the same into the `cpa` reference tables. To add a coin, append it to `added` in `src/data/coins.js` (its own PRNG), run `npm run seed`, then map its `cryptorank_slug` in a migration.
- **Live prices** (clarification 14): `cryptorank-sync` writes price, 24h change, market cap and volume into `cpa.coins` every 10 minutes (pg_cron, accepted), plus 7d change and FDV about every 2 days (6 coins a run), logged in server-only `cpa.market_sync`. Toncoin's live entry is CryptoRank's Gram; Maker is priced from Sky's ranked row × 24,000 (clarification 39; `DERIVED` in the sync), with no market cap (`market_cap_usd` null, shown "—"), and its volume and FDV from the per-coin endpoint. The app reads them only through `lib/market.js` (on load and every 30 s), keeping the fallbacks (last data plus `ErrorBanner`; the simulated feed before the first sync). The free plan allows 400 credits a day and 10 requests a minute: about 305 used by the sync plus 60 for `lookup.py` (`DAILY_CREDITS`). Don't raise the schedule, page count, `DETAILS_PER_RUN` or `DAILY_CREDITS` without a paid plan. Name the source wherever prices show: "CryptoRank" or "CPA sample data".
- **Price history** (clarifications 25, 26 and 36): `price-history-sync` writes Coinbase closes (Kraken's for TRON, USDC and Maker, which is SKY × 24,000; `KRAKEN` there and `KRAKEN_COINS` in `lib/history.js` must match) into `cpa.coin_prices` every 15 minutes and `change_1h`, `sparkline_7d`, `history_updated_at` into `cpa.coins`. Charts read one range through `cpa.price_history()` via `usePriceHistory` in `lib/history.js`, never `coin_prices` directly (PostgREST caps rows at 1,000). Coins with history take 7d change from the sparkline. Name the source under every chart (`historyLabel()`, or "CPA sample data") and show a skeleton, not sample data, while a live range loads. Without history the sparkline is a unitless shape: never scale it by a price; `sparkFacing()` keeps its direction on the live 7d change.
- **Wallet import** (clarifications 21 and 24): public Bitcoin and Ethereum addresses only, through `wallet-lookup` (mempool.space; Etherscan for ETH and listed ERC-20s); signed in, rate-limited in server-only `cpa.wallet_lookup_quota`, address never stored. Never ask for, accept or send a recovery phrase, private key or exchange key. Transfers are netted per coin per UTC day at Coinbase's daily close (at most 12 requests a lookup); `walletImportPlan()` in `lib/wallet.js` writes dated rows tagged "Wallet import <short address>" with the opening balance, today's-price adjustment and "Coinbase, UTC" note.
- **Portfolio** (clarifications 27 to 29, 35): range, sort and tax method live in `settings.portfolio` (`user_settings.portfolio_*`). `valueHistory()` uses Coinbase series from `usePriceHistories`, falling back per coin and naming the source; "Use market price" calls `cpa.price_at` via `fetchPriceAt`. `lib/taxlots.js` derives FIFO / average-cost reports from transactions (nothing stored; average-cost gains equal `computeHoldings`' realized P&L; keep "Not tax advice"). `lib/exchanges.js` reads Coinbase, Kraken and Binance CSV exports (add a format by header, never an API key flow; USD only, USD stablecoins 1:1 with a note, skip the rest with a reason). `lib/risk.js` flags unlock pressure, low liquidity and low float against `RISK_RULES`, stating figures and thresholds, never a score, rating or advice.
- **Loading** (clarification 38): pages are `lazy` in `App.jsx` (Home and NotFound eager), titles go through `usePageTitle()` (it also drives the route announcement), and the es and pt dictionaries load through `loadDictionary()`. The build's `precache.json` lets the service worker cache every chunk. Coin detail's Markets sort lives in `settings.coinMarkets` (clarification 37).
- **Data plans** (clarification 38): CryptoRank's free plan only, no paid data APIs; funding, unlocks and sales stay sample data.
- **Accounts** (Oct 17, 2026): Supabase Auth plus the `cpa` schema, only through `lib/supabase.js` (publishable key) and `lib/cloud.js` (saves only changed rows). A new per-user field needs a column, a `cloud.js` mapping and RLS in a new migration. Guest and demo state live in memory and reset on refresh. Simulated billing lives in `user_state.simulated_billing`; `subscriptions` and `billing_history` stay server-only; deletion goes through `cpa.delete_my_account()` and `cpa.erase_my_data()`. The browser keeps only the Auth session (`cpa:v1:auth`); other `localStorage` goes through `lib/storage.js`, checking every write's result.
- **Streaming wording** in the source text (autoplay, captions, "episodes") becomes crypto equivalents (auto-refresh, chart summaries).

## Data model rules

- **Schema changes:** a new file in `supabase/migrations/` (apply with the Supabase MCP `apply_migration`, save it under the recorded version); never edit an applied migration. Mirror it in `schema.sql`, regenerate `drawsql.png` (`npm run diagram` in `tools/diagram/`; new tables need a group in `erd.py`) and keep the README's table count and groups right.
- **User tables:** RLS on, policies on `(select auth.uid()) = user_id`, an index on every foreign key, and a load and save mapping in `lib/cloud.js`. **Reference tables:** read-only to `anon` and `authenticated`; only the seed or server code writes them (re-run `npm run seed` in `supabase/` after changing `app/src/data/`).
- **After DDL**, run `get_advisors` (security and performance) and fix or explain every warning. **Personal data:** collect only what a feature needs (journey §16–17); analytics off by default; export and delete keep working.

## Security

- `SUPABASE_SECRET_KEY` (in `.env`) bypasses RLS: server-side scripts only (`supabase/seed`), never `VITE_`-prefixed or imported in `app/`; check `app/dist` doesn't contain it after a build.
- `CRYPTORANK_API_KEY` and `ETHERSCAN_API_KEY` live only in Edge Function secrets (`supabase secrets set --env-file <(grep '^NAME=' .env)`; `secrets list` shows only digests). `lookup.py` calls `cryptorank-lookup` instead of reading the key. **Never commit `.env` or print, paste or log a key**; `.env.example` holds names only. Before every commit, check the staged diff for keys and confirm `git check-ignore .env`.
- Edge Functions are public: each answers only `ALLOWED_ORIGINS`, caps the body, validates every field and returns generic errors (details go to the logs).
- Wrap browser I/O (storage, clipboard, downloads, `FileReader`, Web Crypto, notifications) in try/catch or a result check, and tell the user plainly when it fails.

## Writing rules (style guide §2)

- **Voice:** an expert, neutral research analyst. No hype ("moon", "guaranteed", "don't miss out") and no financial advice. Market data is factual ("BTC +2.41% in 24h"); onboarding and empty states friendly and brief; alerts urgent only when time-sensitive ("ARB unlock in 1 hour: 92.6M tokens (3.2% of supply)"), never to drive engagement.
- **Case and numbers:** sentence case; tickers uppercase; official project casing (dYdX). `$1.24B` / `$842.5M` / `$12.3K`, full precision on detail screens; signed 2-decimal percentages with a true minus (`−0.48%`); dates `Oct 17, 2026`, relative under 7 days ("in 3d 4h", "2h ago").
- **Errors** are plain, blame-free and say what to do next ("We couldn't load prices." plus Retry). **Empty states:** one sentence, one action.
- **Disclaimer** "Not financial advice. Data provided for informational purposes." on Coin detail, Fundraising, Token sales and Portfolio; the tax-lot report and row also say "Not tax advice".
- **Localization** (clarifications 30, 32 and 34): English, Spanish and Portuguese (Brazil). Wrap every visible string in `t()` / `tn()` / `tc()` from `lib/i18n.js` (English text is the key) and add it to the area file in both `src/locales/es/` and `src/locales/pt/`; `npm run i18n:check` checks both, plus placeholders. Per-language number styles are in `lib/format.js` (`styles`). Format numbers and dates with `lib/format.js` or `locale()`, never `"en-US"` or `toFixed` for display. Keep stored data (CSV formats, transaction notes) in English. Name each language in its own language with its own `lang`.

## Design rules

- **Tokens** only from `src/styles/tokens.css`, never raw hex. 4px scale; 16px card padding; 12px card and 20px sheet radius; coin rows 64px, settings rows 56px; touch targets ≥ 44×44px.
- **Type:** Inter with `.num` (tabular figures) for every price, percentage and table column; JetBrains Mono for addresses. **Direction** never by colour alone (▲ ▼ or + −); respect `data-colors`.
- **Components** (style guide §6–7): change pill 6px radius, 10% fill, full-colour text; one 48px primary button per screen; coin logos circular, 24px in lists and 40px in headers, 1px ring, ticker-initial fallback; fund logos 8px-radius squares; outlined icons, filled only on the active tab; swipe actions are visible buttons.
- **States** (§7.8): skeletons matching the layout (`useFirstLoad`, `SkeletonCards`, `SkeletonDetail`), never a list spinner; empty states with illustration, sentence and action; `ErrorBanner` with Retry, keeping cached data; "Last updated" with a clock icon when over 5 minutes old; `OfflineBanner` "You're offline: showing saved data" (US-9.5) with prices kept, the feed paused and Refresh disabled (`useOnline()`); `?simulate=error` for the error state.
- **Motion** (§8): 150 / 250 / 350ms (`--dur-micro`, `--dur-screen`, `--dur-sheet`), ease-out in, ease-in out; price flash 400ms at 15%, no number animation. `prefers-reduced-motion` and `data-motion="off"` disable it all (global rule in `index.css`). `a11y.css` loads last; `index.css` defines `:focus-visible` after the imports.

## Accessibility (WCAG 2.2 AA, style guide §3.4 and §9, US-9.3)

- Contrast ≥ 4.5:1 for text and 3:1 for large text and icons in both themes. Rows read in full ("Bitcoin, price 67 thousand 412 dollars, up 2.41 percent"); charts have `ChartSummary`; live ticks are never announced continuously; a control's accessible name starts with its visible text (2.5.3).
- Focus is visible, never under the sticky bars (`scroll-padding`), and follows visual order; sheets trap focus, close on Escape and return focus; route changes announce the title and focus `<main>`.
- Text works to 200% without truncating prices (above 130% `data-text-large="on"` stacks tables), with no sideways scrolling at any width. Each page sets a translated `document.title` ("<Page> · CPA") and has one `h1`.

## Journey rules (user_journey.md §8)

1. Ask for notification permission only at the first alert or reminder, after an explanation. 2. Remember filters, sorts and chart ranges per tab in `settings`. 3. Unlock, funding and listing markers on price charts. 4. Source, last-updated time and verified contract on key screens. 5. Simple vs Pro density. 6. Full guest browsing; `requireAuth(reason, action)` only for alerts, saved portfolios and the like, finishing the action after sign-in and merging guest data. 7. Public addresses and exported CSV files only: refuse anything like a recovery phrase or private key before it leaves the device, never API keys. 8. English, Spanish or Portuguese from the menu, Accessibility menu or Settings, guests included (US-9.7). 9. Phone, tablet and desktop layouts (US-9.8).

## Targets

First data in ≤ 2 s; smooth lists. Visible prices ≤ 30 s old and alerts within 30 s; synced CryptoRank prices can be 10 minutes old, so stale states show the real `price_updated_at`, never the last poll. Keep the first watchlist add and first alert one tap away. No secrets in the bundle; read-only integrations; analytics opt-in; export and delete available.

## Workflow

- Work in phases with pass conditions; the user approves each before the next. Commit and push only when asked; merging to `main` deploys, so merge only with explicit approval.
- After changing a page, check it in the browser (Playwright or Chrome DevTools): screenshots at 390px and 1280px (and 768 / 1024 / 1440px and 844×390 landscape for layout work) against the spec, console errors, overflow including 200% text, axe-core in dark and light (Lighthouse's accessibility audit if the axe CDN is blocked), and a keyboard Tab pass.
- Use Context7 for library docs. Match the surrounding code: short comments citing the spec or story (`// US-4.2`), named exports for helpers, components under `components/`.
