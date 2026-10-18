---
name: cpa-ui
description: Build, change or review a CPA (Cryptocurrency Portfolio App) screen so it follows the project's style guide, user stories and user journeys. Use when adding or editing a page or component in app/src, writing UI copy, or checking a page against its spec before a phase is approved.
---

# CPA UI

Use this skill for any page or component in `app/src`. It condenses what `app_outline/style_guide.md`, `user_stories.md` and `user_journey.md` require, and where screen data lives in the model (`schema.sql`, `drawsql.png`, `supabase/migrations/`). `CLAUDE.md` has the repo rules and fixed decisions, and those win if anything here conflicts.

## 1. Before you write code

1. Find the route in `app/src/routes.js` and open its spec, `app_outline/pages/<doc>`.
2. List the spec's **Source stories** (US-x.y) and read them in `user_stories.md`. P0 stories are mandatory; build P1 where a browser allows.
3. Note which persona the screen serves (Maya, Daniel, Priya or Leo) and the "Thinking" and "Pain points" for that stage in `user_journey.md`. Design for that question.
4. Look at the wireframe in the spec and in `app_outline/figma-wireframe/`.
5. If the screen stores anything for a signed-in user, find its table in `schema.sql` and `drawsql.png`. Check its live form in `supabase/migrations/`, which wins where they differ. A new field needs, in order:
   - a migration with RLS
   - a mapping in `lib/cloud.js`, both load and save
   - the same change mirrored in `schema.sql` and `drawsql.png`

   See CLAUDE.md, "Data model rules".
6. Reuse what's there before adding anything:
   - **Components:** `CoinRow` / `SkeletonRows`, `Sheet`, `PriceChart`, `ChartSummary`, `InfoTip`, `UnlockCard`, `InvestorStack`, `Disclosure`, `DocPage`, `LoadState` (`SkeletonCards`, `SkeletonDetail`, `ErrorBanner`).
   - **Hooks:** `useNow`, `useDebounced`, `useFirstLoad`, `useSimulatedError`.
   - **Formatting:** helpers in `lib/format.js`.

## 2. Content and copy

- **Voice:** a neutral research analyst. Never give advice or write "moon", "guaranteed", "don't miss out", or urgency used only to drive engagement.
- **Tone by context:**
  - Market data is factual ("BTC +2.41% in 24h").
  - Onboarding and empty states are friendly and brief.
  - Errors are plain and actionable.
  - Alerts sound urgent only when time-sensitive, and state the facts ("ARB unlock in 1 hour: 92.6M tokens (3.2% of supply)").
- **Case:** sentence case for all UI text. Uppercase tickers. Official project casing.
- **Number formats:** use `lib/format.js`, never hand-format:
  - Large values: `$1.24B` / `$842.5M` / `$12.3K`; full precision on detail screens.
  - Percentages: always signed, 2 decimals, true minus `−` (U+2212).
  - Dates: `Oct 17, 2026`; relative time under 7 days ("in 3d 4h", "2h ago").
- **Action names:** a button says exactly what it does, and the toast repeats the same verb ("Set alert" → "Alert set").
- **Errors:** what happened plus what to do, with no blame or apology. "We couldn't load prices." plus **Retry**.
- **Empty states:** one friendly sentence and one action ("Add coins to your watchlist to see them here." + **Browse market**).
- **Disclaimer:** "Not financial advice. Data provided for informational purposes." on Coin detail, Fundraising, Token sales and Portfolio.
- **Name:** the app is **CPA**. Rewrite any "CryptoRank" or streaming wording from the source docs.

## 3. Visual rules

| Topic | Rule |
|---|---|
| Hierarchy | Data first: prices, % changes, market caps and unlock dates get the most weight. Decoration never competes with data. |
| Colour | Use only the variables in `styles/tokens.css`. Dark is the default. Use `--up` / `--down` for direction, never raw green or red. |
| Category accents | Fundraising `--cat-fundraising`, unlocks `--cat-unlocks`, sales `--cat-sales`, DeFi, AI and L1/L2 tokens for tags and charts. In light theme, darken tag text until it reaches 4.5:1. |
| Direction | Always show ▲ ▼ or + − with the colour, and respect `data-colors` (swapped and cb-safe). |
| Type | Inter. Add `.num` (tabular figures) to every price, percentage, count and table column. JetBrains Mono (`.mono`) for contract addresses. Scale: display 34/40, H1 24/32, H2 18/24, body 15/22, caption 12/16. |
| Spacing | 4px scale. 16px gutters and card padding, 12px card radius, 20px sheet top radius. |
| Rows and targets | Coin rows 64px, settings rows 56px. Every target at least 44×44px. |
| Logos | Coins are circular (24px in lists, 40px in headers) with a 1px ring, falling back to the ticker initial. Funds use an 8px-radius square. |
| Buttons | One primary per screen, 48px tall. Secondary is outlined, tertiary is text in the accent colour, destructive uses `--down`. |
| Change pill | 6px radius, 10% fill of `--up` / `--down`, full-colour text and arrow. |
| Icons | Outlined, on a 24px grid; the filled variant only for the active tab. Illustrations only in empty states and onboarding. |
| Coin rows | Rank, name and ticker left; price and 24h change right, in `.num`; a 7d sparkline coloured by 7d direction. Watchlist and alert are visible buttons, not swipe-only actions. |
| Charts | Line by default with a candle toggle. Ranges 1D · 7D · 1M · 3M · 1Y · ALL as a segmented control. Crosshair readout. Event markers for unlocks, funding and listings. Always a `ChartSummary`. |
| Unlock card | Live countdown; amount · $ value · % of circulating supply; progress bar; a warning border over 2% of supply. |
| Round card | Project, round tag, amount, valuation, date, up to 3 investor logos plus "+N". |
| Tables | Sortable headers with ▲/▼; the current sort in the accent colour; a sticky first column when the table scrolls sideways. |

## 4. Every state the spec lists

| State | Pattern |
|---|---|
| Loading | Skeleton shaped like the final layout, never a spinner on a list. `useFirstLoad("<page>")` + `SkeletonCards` / `SkeletonDetail` / `SkeletonRows`, with a hidden `role="status"` line. |
| Empty | Illustration, one sentence, one primary action. Filters that empty a list also offer a reset ("Reset filters", "Show this month"). |
| Error | `ErrorBanner` (or the Market-style banner when cached data stays visible) with Retry. Trigger it with `?simulate=error`. |
| Stale | Data over 5 minutes old shows "Last updated …" in secondary text with a clock icon. |
| Offline | A top banner, "You're offline: showing saved data" (US-9.5; not built yet). |
| Signed in | Changes save to Supabase through `lib/cloud.js`. Network writes can fail: show the sync warning and keep the change in memory. Never assume a save succeeded. |
| Guest | Saving actions call `requireAuth(reason, action)`; the action completes after sign-in. |
| Not found | An unknown slug renders `NotFound` (default export of `pages/NotFound.jsx`). |

## 5. Motion

- **Durations:** `--dur-micro` 150ms, `--dur-screen` 250ms, `--dur-sheet` 350ms.
- **Easing:** ease-out for entrances, ease-in for exits.
- **Price change:** a 400ms background flash at 15%. Never animate the digits.
- **What animates:** only motion that answers a user action (opening, confirming). Nothing on frequent or keyboard-driven actions.
- **Reduce Motion:** the global rule for `prefers-reduced-motion` and `data-motion="off"` must cover any new animation. Auto-advancing content must also check `settings.stopAnimations`.

## 6. Accessibility (WCAG 2.2 AA)

- **Page basics:** `document.title = "<Page> · CPA"` and exactly one `h1`.
- **Spoken values:** labels read in full, e.g. `aria-label="Bitcoin, BTC, rank 1, price 67,412 dollars, up 2.41 percent"`. Decorative glyphs get `aria-hidden`.
- **Live updates:** never inside a live region; announce only user-triggered results (`role="status"`).
- **Focus:**
  - A visible focus style on every control. Visually hidden inputs show focus on their sibling.
  - Sheets: focus moves in, Tab is trapped, Escape closes, focus returns.
  - Order follows the visual order.
- **Help text:** every metric that could be jargon gets an ⓘ `InfoTip` with a plain definition.
- **Text size:**
  - Works at 200% (accessibility menu) with no sideways scroll and no price broken mid-number.
  - Add new grids to the `data-text-large` rules in `a11y.css` if they need to stack.
- **Drag:** no drag-only actions; offer buttons as an alternative.

## 7. Journey rules to keep

- Ask for notification permission only when the first alert or reminder is set, after an explanation.
- Remember each tab's filters, sort and chart range in `settings`, and persist them for accounts.
- Show the data source, "Last updated" and the verified contract where the user judges trust.
- Offer one-tap shortcuts where the journey found friction: **Remind me** on unlock cards, saved filters on Fundraising, share cards for rounds and coins.
- Serve Leo and Maya together: Simple vs Pro density, and explanations that never become advice.
- Protect the moments that matter (journey §7):
  - First data on screen in 2 s or less.
  - The first watchlist add and the first alert one tap away.
  - Alerts that fire within 30 s.
  - Share cards worth opening, with source and date.

## 8. Verify before calling it done

Run each item and report the results:
1. `npm run lint` passes, and `npm run build` succeeds.
2. With Playwright at 390×844 and 1280×800, screenshot the page and compare it with the wireframe and the spec's "Done when" checklist.
3. No console errors, and `document.documentElement.scrollWidth` equals its `clientWidth`, also at 200% text.
4. axe-core (tags wcag2a, wcag2aa, wcag21aa, wcag22aa) passes in dark and light themes.
5. In a keyboard pass, each Tab stop has a ring and a name, isn't hidden under the header or bottom nav, and Escape closes sheets.
6. Reduce Motion: with `reducedMotion: "reduce"`, `document.getAnimations()` shows nothing longer than 1ms.
7. Loading, empty, error (`?simulate=error`) and guest states all render.
8. Storage:
   - Account data goes only through `lib/cloud.js`, and other browser storage only through `lib/storage.js`.
   - Any new table or column has a migration with RLS, and `schema.sql` / `drawsql.png` are updated to match.
   - No secret appears in the diff, and `SUPABASE_SECRET_KEY` never appears in `app/`.
