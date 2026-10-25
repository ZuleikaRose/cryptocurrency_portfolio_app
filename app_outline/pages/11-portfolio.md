# Portfolio
**Route:** `/portfolio` (`/portfolio/:coinSlug` for one holding)  ·  **Nav:** Portfolio tab  ·  **Personas:** Daniel, Maya, Leo  ·  **Source stories:** US-6.3, US-6.4, US-1.1

## Purpose
A manual portfolio tracker: log buys, sells, and transfers, and see total value, 24h change, all-time P&L, and allocation. Read-only wallet import is a later phase and never asks for keys.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Portfolio                          [👁]      │  hide balances
│ Total value                                  │
│ $36,058.99                                   │  display 34/40 bold
│ ▲ +$809.71 (+2.30%) 24h                      │
│ All-time P&L  ▲ +$7,943.99 (+28.26%)         │
│ (24h)(7D)(■1M■)(3M)(1Y)(ALL)                 │
│ ┌──────────────────────────────────────────┐ │
│ │      value chart, line, 1M         ╱‾    │ │
│ └──────────────────────────────────────────┘ │
│ Allocation                                   │
│   ◐ donut   ● BTC 46.9%                      │
│             ● ETH 33.9%                      │
│             ● SOL 19.1%                      │
│                                              │
│ Holdings                Sort: [Value ⌄]      │
│ (B) BTC  0.25         $16,920.61             │
│     Avg $52,300.00    ▲ +$3,845.61 (+29.41%) │
│ (E) ETH  3.2          $12,240.38             │
│     Avg $2,950.00     ▲ +$2,800.38 (+29.66%) │
│ (S) SOL  40           $6,898.00              │
│     Avg $140.00       ▲ +$1,298.00 (+23.18%) │
│ ┌──────────────────────────────────────────┐ │
│ │          [ + Add transaction ]           │ │
│ └──────────────────────────────────────────┘ │
│ Import from wallet (read-only) · Coming soon │
│ Not financial advice. Data provided for      │
│ informational purposes.                      │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch [Port]│
└──────────────────────────────────────────────┘

Add transaction sheet
┌──────────────────────────────────────────────┐
│ Add transaction                         [✕]  │
│ (■Buy■) (Sell) (Transfer in) (Transfer out)  │
│ Coin      [ (E) Ethereum ETH          ⌄ ]    │
│ Amount    [ 1.5                         ]    │
│ Price     [ $3,825.12 ] ↺ Use market price   │
│ Date      [ Oct 17, 2026 14:05          ]    │
│ Fee       [ $4.20                       ]    │
│ Note      [ optional                    ]    │
│ Total spent  $5,741.88                       │
│ [ Add transaction ]                          │
└──────────────────────────────────────────────┘
```

## Components & content
- Summary: total value, 24h $ and % change, all-time P&L $ and %, range chart.
- Eye toggle masks all values as `••••` (also in the chart tooltip and holding rows).
- Allocation donut with legend (colour + label + %), a text summary for screen readers.
- Holdings: amount, avg buy price, value, P&L; tap → `/portfolio/:coinSlug` with transaction history (edit, delete with confirm).
- Add transaction sheet: type, coin (search select), amount, price (defaults to sample market price at chosen time), date/time, fee, note; validation: amount > 0, sell/transfer-out can't exceed holding ("You hold 3.2 ETH").
- Transactions as CSV (user's request, Oct 25, 2026): Export downloads `cpa-transactions-<date>.csv` (date, coin_id, symbol, type, amount, price_usd, fee_usd, note; text cells starting with = + − @ get a leading apostrophe). Import reads a CPA export or other tools' headers (Timestamp, Asset, Side, Quantity…), matches coins by id or ticker (former tickers too, e.g. MATIC), shows "N ready, M skipped" with a reason per skipped row (unknown or ambiguous coin, bad type/number/date, future date, already in the portfolio, sells more than held), and saves only after "Import N transactions". Max 1 MB and 2,000 rows.
- Wallet import (US-6.4, P2): disabled row "Coming soon". Copy states the app will only ever accept public addresses and never asks for seed phrases or private keys.

## User stories & acceptance criteria
- **US-6.3 Manual tracker.** As Daniel, I want to log buys and sells so that I can track my P&L.
  - Given I add "Buy 1.5 ETH at $3,825.12, fee $4.20", then ETH holding becomes 4.7, avg price recalculates (cost basis incl. fee), and totals update immediately.
  - Given I try to sell 5 ETH holding 3.2, then the field shows "You can't sell more than you hold (3.2 ETH)."
- **US-P11.1 Hide balances.** Given I tap 👁, then every $ value and amount shows `••••`, % stays visible, and the setting persists for accounts.
- **US-P11.2 Entry vs round price.** On a holding page with funding data, show "Your entry $X vs seed $0.08 / private $Y" (Daniel's journey).
- **US-1.1 Guest.** Given I'm a guest, when I tap "+ Add transaction", then the sign-in sheet opens; after sign-in, the sheet opens.

## States
- **Empty:** "Log your first transaction to see your portfolio." + primary "Add transaction".
- **Guest:** preview card with blurred sample + "Sign in or try the demo to track a portfolio."
- **Demo:** seeded BTC 0.25 @ $52,300, ETH 3.2 @ $2,950, SOL 40 @ $140 (values above); edits reset on refresh.

## Data & persistence
- Accounts: `cpa:v1:user:<id>.portfolio.transactions[]` (`id, coinId, type, amount, price, date, fee, note`); holdings derived, never stored.
- Hide-balances flag in user settings. Guest: nothing stored. Demo: memory.

## Done when (phase passing conditions)
- [ ] Demo shows $36,058.99 total, +28.26% all-time, donut with 3 slices.
- [ ] Adding a transaction updates totals and survives refresh (account only).
- [ ] Oversell is blocked with the message above.
- [ ] Eye toggle masks values.
- [ ] Disclaimer is visible.
