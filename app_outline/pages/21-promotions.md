# Promotions
**Route:** `/promotions`  ·  **Nav:** no tab active; from Explore, hamburger  ·  **Personas:** Leo, Maya  ·  **Source stories:** section 15 Promotions/Discounts, US-P21.x (new)

## Purpose
Show current discounts on CPA subscription plans and let users apply a promo code. No hype, no false urgency.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Promotions                                   │
│ ┌──────────────────────────────────────────┐ │
│ │ (Active)                                 │ │
│ │ 20% off CPA Pro yearly                   │ │
│ │ $95.88 → $76.70 for the first year       │ │
│ │ Ends Oct 31, 2026                        │ │
│ │ Code  AUTUMN20   [Copy]                  │ │
│ │ [ Apply to my plan ]                     │ │
│ │ Terms ›                                  │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ (Active) First month of Pro for $1.00    │ │
│ │ New accounts only · Ends Dec 31, 2026    │ │
│ └──────────────────────────────────────────┘ │
│                                              │
│ Have a code?                                 │
│ [ Enter promo code        ] [ Apply ]        │
│                                              │
│ Past promotions                              │
│ Summer 15% off · Ended Aug 31, 2026          │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- Promotion cards: status tag, title, before/after price, end date, code with copy, Apply, terms link (expands inline: eligibility, one use per account, can't combine).
- Promo code field; Past promotions list.
- Points redemption (from Earn FAQ) shown as "Redeem 500 points for 10% off" card for signed-in users.

## User stories & acceptance criteria
- **US-P21.1 Apply a promo.** Given I'm signed in, when I apply AUTUMN20, then the plan card in Settings shows the discounted price and "AUTUMN20 applied"; applying an expired or unknown code shows "This code isn't valid or has ended."
- **US-P21.2 Guest.** Apply opens the sign-in sheet; after sign-in the code is applied.
- Copy never says "don't miss out" or uses countdown timers.

## States
- Empty: "No promotions right now. Check back soon."

## Data & persistence
- Promotions from bundled data; applied code in `cpa:v1:user:<id>.billing.promo` (account) or memory (demo).

## Done when (phase passing conditions)
- [ ] Applying AUTUMN20 updates the Settings plan card.
- [ ] Invalid code shows the error.
- [ ] Copy button copies the code and announces "Copied".
