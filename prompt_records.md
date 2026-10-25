# Prompt records

The prompts given to Claude Code while building CPA, in order, with the decisions made and the commits that answered them. Prompts are quoted as typed. The decisions they led to are summarised as clarifications in `prompt.md`.

## Oct 25, 2026: new features (branch `watchlists-reminders-pwa`)

| # | Prompt | Decision or outcome | Commits |
|---|---|---|---|
| 1 | "is there any new features I can add?" | Six features proposed: (1) multiple watchlists, (2) reminders that follow a moved unlock, (3) read-only wallet import, (4) installable app, (5) not chosen, (6) CSV export and import. | none |
| 2 | "Do 1, 2, and 4 first. commit and push after each phase. Then do number 4. then commit and push" | Built in phases, with a commit and push after each. | `931877b`, `ae84997`, `5bc465c` |
| 3 | "and do number 6" | CSV export and import of portfolio transactions. | `00d9221` |
| 4 | "yes I meant and do number 3 last" | Wallet import last. | see 9 |
| 5 | "on supabase please ensure CORS, Indexing,Row Level Security, taking anynonomous user input as your edge function is always used for the whole app. For example, drawsql.png, schema.sql, supabase edge functions, and supabase. commit and push" | Guest inserts limited to fixed columns with length and format checks; ticket IDs checked against those issued; `cryptorank-sync` gets an origin allowlist, a 1 KB body cap and generic errors. RLS and foreign-key indexes checked on every table. | `2307a25` |
| 6 | "please continue" (twice) | Work resumed after context limits. | none |
| 7 | "Please add cryptocurrency DOT and MATIC" | DOT was already listed. Polygon is listed as POL, so the user chose "Make MATIC find Polygon": search, CSV import and the watchlist picker accept MATIC. | `cea6ea5` |
| 8 | (found during phase 2) | Re-running the seed overwrote live CryptoRank prices; the seed now leaves live coins' price columns alone. | `7cb163e` |
| 9 | Wallet import questions | Chains: "Bitcoin + Ethereum (Recommended)". Where it runs: "New Edge Function (Recommended)": `wallet-lookup`, with the explorer key server-side, strict address checks, a CORS allowlist and a per-IP rate limit. The user runs the deploy. | `446ae41`, `59afd45`, and the wallet import commit |
| 10 | "Please update and edit new table and columns on the drawsql.png and update the schema.sql file too. Then commit and push. please update the user_journey.md, user_stories.md, style_guide.md, CLAUDE.md, prompt.md. Then commit and update. Then update supabase with the drawsql.png & schema.sql file changes. Then commit and push. Then update the README.md. Update, add, commit, and push prompt records to github. Finally commit and push to github." | Done in that order: schema and diagram, outline docs, Supabase migration, README, this file, then the wallet import code. | `446ae41`, `7969bd1`, `59afd45`, `ac94789`, `cd7b373`, `10895ce` |
| 11 | "CRYPTORANK_API_KEY, API_V3_URL, MANUAL_MCP_URL, RESTFUL_API_URL, ALLOWED_ORIGINS, and ETHERSCAN_API_KEY are added to supabase CPA database as edge funnction secrets. Please Deploy the wallet function and Deploy the hardened price sync" | Both deployed after a separate Deno dry run. Live checks: CORS allowlist, 401 without a session, 405, 413; the 17:00 price sync ran on the new version (33 coins, 2 credits). | `77f66f6` |
| 12 | "I imported 2 ETH public wallets in the CPA app demo" | The demo uses fixed sample balances and makes no lookup, so a real wallet import needs a signed-in account. | none |
| 13 | "UPDATE THE lookup.py script to ready from the supabase edge function called CRYPTORANK_API_KEY" | Supabase never returns a secret's value, so `lookup.py` now calls a new `cryptorank-lookup` Edge Function that uses the key, with a 60-credit daily budget. | `981f934`, `5dc1869` |
| 14 | "i confirm the Import from wallet (read-only) works with a real account. I imported ETH tranactions" | Wallet import confirmed by the user on a signed-in account, after a signed-in smoke test (BTC, ETH with ERC-20 tokens, bad address refused). | this commit |
