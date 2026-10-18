# CPA: Cryptocurrency Portfolio App

CPA is a phone-width single-page app for following the crypto market: coin rankings, token unlocks, funding rounds, token sales, a watchlist, a manual portfolio and alerts. It's a build of the CryptoRank-style product described in `app_outline/`. Market data is bundled sample data; accounts use Supabase (Auth plus Postgres in the `cpa` schema).

It also works on desktop, where the phone-width shell sits in a centred frame.

> Not financial advice. Data provided for informational purposes. All prices, unlocks and rounds in the app are sample data.

## Quick start

```bash
cp .env.example .env   # then fill in the Supabase values (Dashboard → Project Settings → API)
cd app
npm install
npm run dev        # http://localhost:5173
npm run lint       # oxlint
npm run build      # production build in app/dist
```

To try it without an account, open **Log in** and choose **Try a private demo**. The demo has a populated watchlist, portfolio, alerts and notifications, and resets when you refresh.

## Who it's for

The personas come from `app_outline/user_journey.md`:

| Persona | Wants | CPA answers with |
|---|---|---|
| **Maya**, active trader | Spot movers early, react to unlocks before price impact | Gainers/losers, unlock calendar sorted by % of supply, one-tap **Remind me**, price alerts |
| **Daniel**, research investor | Tokenomics, vesting, who funded a project | Coin detail tabs (Overview, Tokenomics, Funding, Markets), supply bar, vesting chart, portfolio with entry vs. round price |
| **Priya**, VC / fund analyst | Monitor rounds and competitor deals | Fundraising feed with saved filters, fund profiles, follow a fund, share cards |
| **Leo**, newcomer | Understand the numbers, follow a few coins safely | Onboarding with interest picker, Simple view, ⓘ explanations on every metric, Learn cards |

## What's in the app

| Area | Pages |
|---|---|
| Bottom nav (7 tabs) | Home, Market, Explore, Fundraising, Unlocks, Watchlist, Portfolio |
| Research | Coin detail, Search (and the ⌘K overlay), Fund profile, Token sales |
| Account | Alerts, Log in / Sign up, Forgot / Reset password, Log out, Account settings |
| Help and info | Customer support, FAQs, Report an issue, Feedback, Promotions, Affiliate program, Technical requirements, AI features |
| Legal | Terms of service, Privacy policy, Accessibility policy (linked in every footer) |
| Everywhere | Accessibility menu (♿ button or Alt+A), keyboard shortcuts (?), Not found page with "Did you mean" |

Each page has a spec with its wireframe, stories and "done when" conditions in `app_outline/pages/` (`00-app-shell.md` to `29-not-found.md`).

## How data is kept

| Who | Where | Survives a refresh? |
|---|---|---|
| Guest | Memory only | No |
| Private demo | Memory only | No, resets on refresh |
| Account | Supabase: Auth for sign-in, Postgres tables in the `cpa` schema for everything else | Yes, on any device |

Accounts run on Supabase:
- **Sign-in:** Supabase Auth handles passwords, sessions, reset emails and rate limits. The app still requires 13+ characters with a lowercase letter, an uppercase letter, a digit and a symbol, and refuses known leaked passwords. The browser keeps only the Auth session (`cpa:v1:auth`).
- **Data:** `app/src/lib/cloud.js` maps the app's data to the `cpa` tables and saves only what changed, about 0.6 s after each change. Row-level security limits every request to the signed-in user's own rows.
- **Billing:** simulated, test cards only. It's stored in `user_state.simulated_billing`; the real `subscriptions` table stays server-only.
- **Deleting:** Delete account marks the profile deleted. Logging in to a deleted account offers **Remove my data**, which erases it for good (`cpa.erase_my_data()`).

The schema, migrations and the sample-data seed are in `supabase/` (see below).

## Design

The design follows `app_outline/style_guide.md`, with the Figma wireframe (`app_outline/figma-wireframe/`) taking precedence where they differ.

- **Principles:** data first, glanceable, trustworthy, dense but calm, thumb-friendly.
- **Theme:** dark by default, with light and system options. The accent is violet, from the wireframe, rather than the guide's blue.
- **Type:** Inter with tabular figures for every number; JetBrains Mono for contract addresses.
- **Numbers:**
  - Abbreviated large values (`$1.24B`).
  - Signed percentages to 2 decimals with a true minus (`−0.48%`).
  - Direction is never shown by colour alone: values carry ▲ ▼ or + −.
- **Colour options:** up/down colours can be swapped, or switched to a colour-blind safe blue/orange pair.
- **States:**
  - Loading: skeleton shimmer.
  - Empty: one sentence and one action.
  - Error: inline banner with Retry.
  - Stale: data over 5 minutes old is marked with "Last updated".
- **Motion:**
  - Durations: 150 ms micro, 250 ms screens, 350 ms sheets.
  - Prices flash for 400 ms when they change.
  - The system Reduce Motion setting and the in-app "Stop animations" switch both turn all of this off.

## Accessibility

The target is WCAG 2.2 AA:
- **Contrast:** text meets 4.5:1 in both themes.
- **Touch targets:** at least 44×44 px.
- **Focus:** focus is visible and never hidden under the sticky bars.
- **Navigation:** a skip link, and route changes are announced to screen readers.
- **Charts:** each chart has a text summary.
- **Text size:** up to 200%; tables become stacked cards above 130%.
- **Accessibility menu:** profiles plus settings for text, fonts, spacing, contrast, saturation, link and heading highlights, a reading guide, a big cursor, hiding images and stopping animations.

To simulate an error banner on Home, Market, Explore, Fundraising or Watchlist, add `?simulate=error` to the address.

## CryptoRank lookup script

`lookup.py` is a separate command-line tool that looks up live CryptoRank ranks and prices for ticker symbols you type in.

```bash
cp .env.example .env     # then add CRYPTORANK_API_KEY
python3 lookup.py
```

The key is read from the environment or `.env`, and both are git-ignored. Never commit `.env` or paste the key anywhere public.

## Supabase

```bash
cd supabase
npm install
npm run seed       # loads app/src/data/*.js into the cpa reference tables (safe to re-run)
```

- `migrations/`: the `cpa` schema, RLS policies, and the account functions. The migrations are already applied to the linked project.
- `seed/seed-sample-data.mjs`: uses `SUPABASE_SECRET_KEY` from `.env`. That key is server-only: never give it a `VITE_` prefix.
- The app reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` from the root `.env` (`envDir: '..'` in `vite.config.js`).
- Auth settings to check in the Dashboard: turn off **Confirm email**, so sign-up logs straight in; set the minimum password length to 13 and password requirements to lowercase, uppercase, digits and symbols; add `http://localhost:5173/reset-password` (and your deployed URL) under **Authentication → URL configuration → Redirect URLs**.

## Project layout

```
app/                  React 19 + Vite 8 + React Router 7 (BrowserRouter)
  src/routes.js       every route, title and spec file
  src/pages/          one file per page (or page group)
  src/components/     shell, sheets, charts, rows, menus
  src/state/          AppStore (app state, sign-in, cloud sync) and context
  src/data/           sample coins, funds, rounds, help and promotions
  src/lib/            formatting, auth, Supabase client and sync (cloud.js), billing, alerts, hooks
  src/styles/         tokens.css first, a11y.css last
app_outline/          style guide, user journeys, user stories, page specs, wireframe
supabase/             migrations, seed script, CLI config (config.toml)
lookup.py             CryptoRank v3 lookup (needs CRYPTORANK_API_KEY)
prompt.md             the original build brief and its clarifications
CLAUDE.md             working rules for Claude Code in this repo
.claude/skills/cpa-ui/SKILL.md   checklist for building or reviewing CPA screens
```

## Build status

Phases 0 to 8 are complete: shell and Market, Coin detail, Search/Watchlist/Portfolio, research pages, Home and Alerts, accounts, support and legal pages, then polish and QA. After that, accounts moved from the browser to Supabase, and the sample data was loaded into the database.

These parts of the source documents aren't built, because they need native platforms or more server work:
- Sign in with Apple or Google, and magic links (CPA uses email and password, plus the demo).
- Home-screen widgets, haptics, and push or email delivery (CPA uses in-app and browser notifications).
- Wallet and exchange import (US-6.4) and multiple watchlists (US-6.2).
- An offline banner with cached data (US-9.5). The Technical requirements page does detect going offline.
