# CLAUDE.md

Working rules for Claude Code in this repo. CPA (Cryptocurrency Portfolio App) is a React SPA built from the brief in `prompt.md` and the documents in `app_outline/`. Prices for 34 coins come live from CryptoRank through a Supabase Edge Function; other market data is bundled sample data; accounts run on Supabase. Read `README.md` for the overview.

## Commands

Run these from `app/`:
- `npm run dev`: Vite on http://localhost:5173. Use `npx vite --port 5173 --strictPort` if you need the port fixed for browser tests.
- `npm run lint`: oxlint. It must pass with no output before you commit.
- `npm run build`: production build. Run it to catch broken imports, because oxlint doesn't resolve modules.

From the repo root:
- `supabase functions deploy cryptorank-sync --project-ref hxckrfjrmhdloqpctemy --no-verify-jwt --use-api`: deploys the live price sync. Type-check and lint it with Deno first (`deno check`, `deno lint`); the deploy hook expects that dry run in the same command.

## Sources of truth, in order

1. **The user's clarifications** (listed in `prompt.md`). These override the documents.
2. **`app_outline/pages/NN-*.md`**: one spec per page, with its wireframe, components, stories, states and "Done when" conditions. Each page's spec is named in `src/routes.js` (`doc`).
3. **`app_outline/figma-wireframe/`**: the layout and visual reference. The violet accent comes from here.
4. **`app_outline/style_guide.md`**: tokens, type, voice, components, states, motion, accessibility.
5. **`app_outline/user_stories.md`** (US-x.y, priorities P0/P1/P2) and **`app_outline/user_journey.md`** (personas Maya, Daniel, Priya and Leo, journey maps, cross-journey rules, moments that matter).
6. **Data model:**
   - `supabase/migrations/` is what the live database runs.
   - `schema.sql` (48 tables) and its diagram `drawsql.png` are the portable model of every feature. They're grouped as Reference, Market, Research, Watchlist & portfolio, Accounts, Alerts & billing, Settings and Support.
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
    - The free CryptoRank plan allows 400 credits a day and 10 requests a minute. Pages cost 2 credits a run and details about 17 a day: about 305 a day in all. Don't raise the schedule, the page count or `DETAILS_PER_RUN` without a paid plan.
    - To add a coin, append it to `added` in `src/data/coins.js` (its own PRNG keeps the other coins' sample figures unchanged), run `npm run seed`, then map its `cryptorank_slug` in a migration.
    - Name the source wherever prices show: "CryptoRank" for synced figures, "CPA sample data" for the rest.
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
- `lookup.py` reads `CRYPTORANK_API_KEY` from the environment or `.env`. The Edge Function reads it from its secrets, set from `.env` with `supabase secrets set --env-file <(grep '^CRYPTORANK_API_KEY=' .env)`; `supabase secrets list` shows only its SHA-256 digest. **Never commit `.env`, never print the key, and never paste it into code, docs, logs or commit messages.** `.env.example` holds names only.
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
- **Disclaimer:** "Not financial advice. Data provided for informational purposes." on Coin detail, Fundraising, Token sales and Portfolio.

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
