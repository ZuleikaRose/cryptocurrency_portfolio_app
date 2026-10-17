# CPA: Cryptocurrency Portfolio App

CPA is a phone-width single-page app for following the crypto market: coin rankings, token unlocks, funding rounds, token sales, a watchlist, a manual portfolio and alerts. It's a front-end build of the CryptoRank-style product described in `app_outline/`, using sample data in the browser. There are no API calls from the app.

It also works on desktop, where the phone-width shell sits in a centred frame.

> Not financial advice. Data provided for informational purposes. All prices, unlocks and rounds in the app are sample data.

## Quick start

```bash
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
| Account | `localStorage`, keys starting `cpa:v1:` | Yes |

Accounts are simulated in the browser:
- Passwords are hashed with PBKDF2-SHA-256 and must be 13+ characters with a lowercase letter, an uppercase letter, a digit and a symbol. Known leaked passwords are refused.
- Reset links are single-use, expire after 30 minutes, and only their hash is stored.
- Billing is simulated and accepts only test cards.

Browser storage isn't a secure server, so don't reuse a real password. The Privacy policy page lists every storage key.

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

## Project layout

```
app/                  React 19 + Vite 8 + React Router 7 (BrowserRouter)
  src/routes.js       every route, title and spec file
  src/pages/          one file per page (or page group)
  src/components/     shell, sheets, charts, rows, menus
  src/state/          AppStore (app state + persistence) and context
  src/data/           sample coins, funds, rounds, help and promotions
  src/lib/            formatting, auth, billing, alerts, hooks
  src/styles/         tokens.css first, a11y.css last
app_outline/          style guide, user journeys, user stories, page specs, wireframe
lookup.py             CryptoRank v3 lookup (needs CRYPTORANK_API_KEY)
prompt.md             the original build brief and its clarifications
CLAUDE.md             working rules for Claude Code in this repo
.claude/skills/cpa-ui/SKILL.md   checklist for building or reviewing CPA screens
```

## Build status

Phases 0 to 8 are complete: shell and Market, Coin detail, Search/Watchlist/Portfolio, research pages, Home and Alerts, accounts, support and legal pages, then polish and QA.

These parts of the source documents aren't built, because they need native platforms or a server:
- Sign in with Apple or Google, and magic links (CPA uses email and password, plus the demo).
- Home-screen widgets, haptics, and push or email delivery (CPA uses in-app and browser notifications).
- Wallet and exchange import (US-6.4) and multiple watchlists (US-6.2).
- An offline banner with cached data (US-9.5). The Technical requirements page does detect going offline.
