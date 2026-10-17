# Report an issue
**Route:** `/report-issue` (`?type=bug|data|accessibility|other&from=/path`)  ·  **Nav:** no tab active; from Support, hamburger, error cards  ·  **Personas:** all  ·  **Source stories:** section 15 Error/Issue reporting, US-P19.x (new)

## Purpose
Let users report bugs, wrong data, or accessibility barriers with enough context (page, browser, steps) to reproduce them.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ ‹ Support                                    │
│ Report an issue                              │
│ What went wrong?                             │
│ (■Bug■)(Wrong data)(Accessibility)(Other)    │
│ Page      [ /coins/orbit-l2           ]      │
│ Summary   [ Chart range 3M is empty    ]     │
│ Steps to reproduce                           │
│ [ 1. Open ORB  2. Tap 3M ...           ]     │
│ Expected  [                            ]     │
│ Actual    [                            ]     │
│ Severity  (Blocks me)(Annoying)(Minor)       │
│ ☑ Include technical details                  │
│   Chrome 141 · Windows · 1440×900 · dark ·   │
│   app v1.0.0 · last error: none              │
│ Screenshot [ Attach image ] (≤ 2 MB)         │
│ Email     [ maya@example.com          ]      │
│ [ Send report ]                              │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
Success: "Thanks. Report #BUG-0217 saved. We'll look into it." [Back to page]
```

## Components & content
- Type pills, page (prefilled from `from`), summary (required, ≤ 120), steps, expected, actual, severity, technical details toggle (preview shown; collected from `navigator` and app state, no personal data), optional screenshot (PNG/JPEG ≤ 2 MB, previewed), email.
- Accessibility type adds "Assistive technology used" field (e.g. NVDA 2026.1, VoiceOver).

## User stories & acceptance criteria
- **US-P19.1 Report a bug.** Given a summary and type, when I send, then a report id is shown and the report is listed under Support → Your tickets.
- **US-P19.2 Context.** Given I came from an error card on `/coins/orbit-l2`, then Page is prefilled and the last error message is included in technical details.
- **US-P19.3 Validation.** Missing summary: "Add a short summary." Oversized image: "Choose an image under 2 MB."

## States
- Submitting, success, and validation states as above.

## Data & persistence
- Reports saved with tickets (`cpa:v1:user:<id>.tickets`, type `issue`); screenshot stored as a data URL only if ≤ 2 MB. Guest/demo: memory.

## Done when (phase passing conditions)
- [ ] Prefill from `?from=` works.
- [ ] Technical details preview is visible before sending.
- [ ] Success message shows an id and Back to page returns to `from`.
