# Accessibility policy
**Route:** `/accessibility-policy`  ·  **Nav:** no tab active; linked in the footer of every page, the accessibility menu, and Support  ·  **Personas:** all, especially screen-reader, keyboard, low-vision users  ·  **Source stories:** US-9.2, US-9.3, NFR Accessibility, section 15 Accessibility policy

## Purpose
State CPA's commitment to WCAG 2.2 level AA, list accessibility features and keyboard shortcuts, be honest about known limitations, and explain how to report a barrier.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Accessibility policy                         │
│ Last reviewed Oct 17, 2026                   │
│ Our commitment                               │
│ CPA aims to meet WCAG 2.2 level AA …         │
│                                              │
│ Accessibility features                       │
│ • Accessibility menu (♿ in the header)       │
│ • Chart text summaries, adjustable size      │
│ • Full keyboard access, visible focus        │
│ • Control of auto-refresh and animations     │
│ • Colour never the only signal (▲▼ + − )     │
│ • Up/down colour options                     │
│                                              │
│ Keyboard shortcuts                           │
│ ┌────────────────┬─────────────────────────┐ │
│ │ ⌘K / Ctrl+K, / │ Open search             │ │
│ │ Esc            │ Close dialog or menu    │ │
│ │ Alt+A          │ Accessibility menu      │ │
│ │ 1–6            │ Chart range 1D…ALL      │ │
│ │ ← →            │ Move chart crosshair    │ │
│ │ ?              │ Shortcuts help          │ │
│ └────────────────┴─────────────────────────┘ │
│ Known limitations                            │
│ Report a barrier  [ Report an accessibility  │
│                     issue ]                  │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- **Commitment:** WCAG 2.2 AA target; tested with NVDA, JAWS, VoiceOver, TalkBack and keyboard only; text contrast ≥ 4.5:1 (3:1 large text and icons); targets ≥ 44×44px (exceeds 2.5.8); focus not obscured by sticky header/nav (2.4.11); no drag-only actions (2.5.7: reorder has ↑/↓ buttons); consistent help location (3.2.6: Support in menu and footer); accessible authentication (3.3.8: paste allowed, show-password, no cognitive tests); redundant entry avoided (3.3.7).
- **Features:** accessibility menu (27), chart text summaries and summary text size, keyboard shortcuts, auto-refresh live prices control, stop animations / reduced motion, colour conventions, text up to 200% without loss.
- **Keyboard shortcuts** table as in the wireframe.
- **Known limitations:** charts' visual crosshair is pointer-first (text summary and data table provided); generated share images have alt text but text inside the image isn't selectable.
- **Report a barrier:** button → `/report-issue?type=accessibility`; target reply in 5 business days.

## User stories & acceptance criteria
- **US-P26.1 Find the policy.** Given any page, the footer link "Accessibility policy" opens this page.
- **US-P26.2 Report a barrier.** The report button prefills type Accessibility.

## States
- Static.

## Data & persistence
- None.

## Done when (phase passing conditions)
- [ ] Footer link present on every page.
- [ ] Shortcuts table matches implemented shortcuts.
- [ ] Report button opens the prefilled form.
