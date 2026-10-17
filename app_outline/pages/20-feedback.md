# Feedback
**Route:** `/feedback`  ·  **Nav:** no tab active; from Support, hamburger  ·  **Personas:** all  ·  **Source stories:** section 15 Feedback, US-P20.x (new)

## Purpose
Collect quick satisfaction ratings about the app and ideas for improvements, separate from bug reports.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ ‹ Support                                    │
│ Share your feedback                          │
│ How easy is CPA to use?                      │
│ (1) (2) (3) (4) (5)                          │
│ Very hard              Very easy             │
│ What's it about?                             │
│ [ Market ⌄ ]  (Market, Coin detail, Unlocks, │
│   Fundraising, Portfolio, Alerts, Other)     │
│ Tell us more                                 │
│ [ I'd like a "> 5% only" unlock filter  ]    │
│ ☐ You can contact me about this              │
│ [ Send feedback ]                            │
│                                              │
│ Found a bug instead? Report an issue ›       │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
Success: "Thanks for your feedback." + "Back to Home"
```

## Components & content
- 1–5 ease rating as a radio group (required), area select, free text (≤ 1,000 chars, counter), contact opt-in, Send.
- Contextual mini prompt: after the 5th session (accounts only), a dismissible card on Home "How's CPA working for you?" linking here; never shown more than once per 30 days.

## User stories & acceptance criteria
- **US-P20.1 Give feedback.** Given I pick a rating, when I send, then a thank-you state shows and the entry is saved.
- **US-P20.2 Not nagging.** Dismissing the Home prompt hides it for 30 days.

## States
- Validation: "Choose a rating." Success state as above.

## Data & persistence
- `cpa:v1:user:<id>.feedback[]` and prompt-dismissed date for accounts; memory for guest/demo.

## Done when (phase passing conditions)
- [ ] Rating is keyboard-operable with arrow keys.
- [ ] Sending without a rating shows the error; with a rating shows success.
