# CLAUDE.md

Working rules for Claude Code in this repo. CPA (Cryptocurrency Portfolio App) is a front-end SPA built from the brief in `prompt.md` and the documents in `app_outline/`. Read `README.md` for the overview.

## Commands

Run these from `app/`:
- `npm run dev`: Vite on http://localhost:5173. Use `npx vite --port 5173 --strictPort` if you need the port fixed for browser tests.
- `npm run lint`: oxlint. It must pass with no output before you commit.
- `npm run build`: production build. Run it to catch broken imports, because oxlint doesn't resolve modules.

## Sources of truth, in order

1. **The user's clarifications** (listed in `prompt.md`). These override the documents.
2. **`app_outline/pages/NN-*.md`**: one spec per page, with its wireframe, components, stories, states and "Done when" conditions. Each page's spec is named in `src/routes.js` (`doc`).
3. **`app_outline/figma-wireframe/`**: the layout and visual reference. The violet accent comes from here.
4. **`app_outline/style_guide.md`**: tokens, type, voice, components, states, motion, accessibility.
5. **`app_outline/user_stories.md`** (US-x.y, priorities P0/P1/P2) and **`app_outline/user_journey.md`** (personas Maya, Daniel, Priya and Leo, journey maps, cross-journey rules).

Before changing a page, read its spec and the stories it cites.

## Fixed decisions

- **Name:** "CPA", not CryptoRank. The style guide and stories say CryptoRank; adapt that text to CPA.
- **Bottom nav:** 7 tabs: Home, Market, Explore, Funding, Unlocks, Watchlist, Portfolio. No "More" tab. (The style guide's 5-tab bar is superseded.)
- **Data:**
  - The app makes no API calls; all data is sample data in `src/data/`.
  - **Guest** and **demo** state live in memory and reset on refresh.
  - **Accounts** persist in `localStorage` under `cpa:v1:*`. Go through `lib/storage.js` (`readJson`, `writeJson`, `removeKey`) and check the boolean result of every write.
- **Streaming wording:** some source text talks about streaming (autoplay, captions, "episodes"). Adapt it to crypto equivalents such as auto-refresh and chart summaries.
- **Layout:** a phone-width shell (`--shell-width: 440px`) that's also usable on desktop, where it sits in a centred frame.
- **Stack:** React 19, Vite 8, react-router-dom 7 with `BrowserRouter`. Navigations run in `startTransition`.

## Security

- `lookup.py` reads `CRYPTORANK_API_KEY` from the environment or `.env`. **Never commit `.env`, never print the key, and never paste it into code, docs, logs or commit messages.** `.env.example` holds names only.
- Before every commit, check the staged diff for the key and confirm `git check-ignore .env`.
- Wrap browser I/O in try/catch or a failure check: storage, clipboard, downloads, `FileReader`, Web Crypto and notifications. Tell the user plainly when it fails; never fail silently.

## Writing rules (style guide §2)

- **Voice:** expert, precise and neutral, like a research analyst. No hype, no "moon", "guaranteed" or "don't miss out", and no financial advice.
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
- **States (§7.8):**
  - Loading: skeleton matching the layout, never a spinner on lists. Use `useFirstLoad` and `SkeletonCards` / `SkeletonDetail`.
  - Empty: illustration, one sentence, one action.
  - Error: `ErrorBanner` with Retry, with cached data kept visible where it exists.
  - Stale: over 5 minutes old, show "Last updated".
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
