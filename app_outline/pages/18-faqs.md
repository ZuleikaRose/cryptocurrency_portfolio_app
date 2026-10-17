# FAQs
**Route:** `/faqs` (`#earn`, `#funds`, `#api-plans`, `#general`)  ·  **Nav:** no tab active; from Support, hamburger  ·  **Personas:** Leo, Priya, developers  ·  **Source stories:** section 15 FAQs

## Purpose
Answer common questions in three themed groups (Earn & rewards, Funds, API & plans) plus general app questions, in one searchable page.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Frequently asked questions                   │
│ [ 🔍 Search FAQs                       ]     │
│ (■General■)(Earn & rewards)(Funds)(API & plans)│
│                                              │
│ General                                      │
│ ▸ Is CPA's data real-time?                   │
│ ▾ Where is my data stored?                   │
│   Accounts are stored in this browser's      │
│   local storage. Clearing site data removes  │
│   them. The demo isn't stored at all.        │
│ ▸ Why didn't my alert fire?                  │
│                                              │
│ Earn & rewards                               │
│ ▸ What are CPA points?                       │
│ ▸ How do quests work?                        │
│ ▸ How do raffles work?                       │
│ ▸ Where do I see claimed rewards?            │
│                                              │
│ Funds                                        │
│ ▸ How are funds tiered?                      │
│ ▸ Which investor types are covered?          │
│ ...                                          │
│ Still stuck? [ Contact support ]             │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
Accordion items (`button` with `aria-expanded`), search filters questions and answers, jump pills scroll to sections.

- **General:** Is data real-time? (No: CPA uses a sample dataset refreshed every 30 s in the browser.) Where is my data stored? Why didn't my alert fire? (The app must be open.) Is this financial advice? (No.) How do I reset the demo? (Refresh.)
- **Earn & rewards:** CPA points (internal loyalty points earned for completing profile, first watchlist, weekly check-ins; spendable on Pro discount codes; no cash value, not a token); community quests; promotional raffles (free entry, odds stated, terms on Promotions); tracking claimed rewards (Settings → Subscription & billing → Rewards history).
- **Funds:** how funds are tiered (Tier 1–5 by deal count, deal size, and portfolio performance over 24 months); tracking who a fund follows on social media (profile "Social" links; follow lists not tracked in the sample data); investor types covered (VC funds, angels, corporates, DAOs, launchpads, accelerators); analysing sectors (Top sectors bar on fund profile).
- **API & plans:** CPA is front-end only today and has no public API; planned plans: Free (rate-limited, 1-year history), Pro (higher credit limits, full history, alerts without caps), Team. Credit limits, endpoints, and data history depth are listed as "Planned" with a table; pricing differences between plans.

## User stories & acceptance criteria
- **US-P18.1 Find an answer.** Given I type "unlock", then only matching items show with the term highlighted; no matches shows "No answers found. Contact support."
- **US-P18.2 Deep link.** `/faqs#funds` opens with the Funds section in view.
- Answers use sentence case, plain language, and never promise returns.

## States
- Static content; no loading state beyond the shell.

## Data & persistence
- Static content bundled with the app; nothing stored.

## Done when (phase passing conditions)
- [ ] Four sections present with at least 4 questions each.
- [ ] Accordions work with keyboard (Enter/Space) and announce expanded state.
- [ ] Search filters items; hash links scroll to sections.
