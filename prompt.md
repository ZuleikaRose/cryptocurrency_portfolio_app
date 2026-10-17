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

# Required material from the outline documents

## Personas (user_journey.md §1)

- **Maya, active trader:** spot movers early, track the watchlist, react to unlocks before price impact.
- **Daniel, research investor:** tokenomics, vesting, who funded a project, entry vs. round price.
- **Priya, VC / fund analyst:** funding rounds by sector, competitor funds, saved filters, share cards, follow funds.
- **Leo, newcomer:** plain explanations of every metric, a simple view, a few coins followed safely.

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

P1 and P2 stories (gainers/losers, Simple/Pro density, event markers, saved filters, follow funds, token sales, the manual portfolio, weekly digest, quiet hours, share cards, colour conventions) are built where the browser allows. Widgets, haptics, social sign-in, wallet import, multiple watchlists and an offline cache are not; see `README.md`.

## Non-functional requirements (user_stories.md)

- **Speed:** first data in 2 s or less.
- **Freshness:** prices no more than 30 s old while visible.
- **Accessibility:** WCAG 2.2 AA, with text up to 200%.
- **Privacy and security:** analytics off by default; data export and delete available; no secrets in the app.
- **Disclaimer:** "Not financial advice" on Coin detail, Token sales and Portfolio.

## Style guide essentials (style_guide.md)

- **Principles:** data first, glanceable (the market read in under 3 s), trustworthy, dense but calm, thumb-friendly (targets of at least 44×44).
- **Voice:**
  - Expert and neutral; never hype or advice.
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
  - Coin row with sparkline; change pill.
  - Buttons: one primary per screen, plus secondary, tertiary and destructive.
  - Chart with ranges and event markers.
  - Unlock card with countdown and progress bar.
  - Funding round card.
  - Sortable tables with a sticky first column.
- **States:**
  - Loading: skeleton.
  - Empty: illustration, one sentence, one action.
  - Error: inline banner with retry, cached data kept.
  - Offline: banner.
  - Stale: over 5 minutes.
- **Motion:** 150 / 250 / 350 ms; a 400 ms price flash with no number animation; Reduce Motion honoured.
- **Accessibility checklist:** full spoken values, chart summaries, no announcement spam, focus order that matches the visual order.
