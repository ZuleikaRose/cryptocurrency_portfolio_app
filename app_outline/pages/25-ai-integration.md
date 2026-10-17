# AI features
**Route:** `/ai`  ·  **Nav:** no tab active; from Explore, hamburger  ·  **Personas:** Leo, Daniel, Priya  ·  **Source stories:** section 15 AI integration, US-P25.x (new)

## Purpose
Explain which CPA features are "smart" (generated summaries and recommendations), how they work, their limits, and how to turn them off. In this front-end build these features run locally from templates and rules on the sample data; no data is sent to an AI service.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ AI features                                  │
│ How CPA uses automation to explain data.     │
│ ┌──────────────────────────────────────────┐ │
│ │ ✦ Chart summaries               [■ On]   │ │
│ │ "1-month range $1.02 to $1.31, currently │ │
│ │  $1.24, up 12.7%."                       │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ ✦ Explain this metric           [■ On]   │ │
│ │ Plain-language ⓘ definitions with your   │ │
│ │ coin's numbers filled in.                │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ ✦ Similar coins                 [■ On]   │ │
│ │ Based on category and coins you viewed.  │ │
│ └──────────────────────────────────────────┘ │
│ ┌──────────────────────────────────────────┐ │
│ │ ✦ Weekly digest summary         [□ Off]  │ │
│ └──────────────────────────────────────────┘ │
│ Limits                                       │
│ • Summaries describe data; they never        │
│   recommend buying or selling.               │
│ • They can be wrong if the data is wrong.    │
│ • Nothing leaves your browser.               │
│ Not financial advice.                        │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- Feature cards with on/off switches: chart summaries (also an accessibility feature), explain this metric, similar coins (on Coin detail and Home), weekly digest summary.
- Every generated text is labelled "✦ Generated summary" where it appears in the app.
- Limits and data-use section; disclaimer.

## User stories & acceptance criteria
- **US-P25.1 Know what's generated.** As Daniel, I want generated text labelled so that I can tell it from source data.
- **US-P25.2 Turn it off.** Given I switch off "Similar coins", then that section disappears from Coin detail and Home.
- Generated text never contains advice words ("buy", "sell", "should", "guaranteed").

## States
- Guest: switches work in memory.

## Data & persistence
- Switches in `cpa:v1:user:<id>.settings.ai` (accounts); memory otherwise.

## Done when (phase passing conditions)
- [ ] Four switches present and effective in the app.
- [ ] "Generated summary" label visible where generated text appears.
