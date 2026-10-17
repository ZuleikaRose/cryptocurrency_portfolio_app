# Technical requirements
**Route:** `/technical-requirements`  ·  **Nav:** no tab active; from footer, hamburger, Support  ·  **Personas:** all  ·  **Source stories:** section 15 Technical requirements, NFRs

## Purpose
Tell users what they need to run CPA well, and run a quick in-browser check of their setup.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│ Technical requirements                       │
│ ┌ Your setup ──────────────────────────────┐ │
│ │ ✓ Browser: Chrome 141 (supported)        │ │
│ │ ✓ Local storage available                │ │
│ │ ✓ JavaScript enabled                     │ │
│ │ ⓘ Notifications: not yet allowed         │ │
│ │ ✓ Connection: online                     │ │
│ │ [ Run check again ]                      │ │
│ └──────────────────────────────────────────┘ │
│ Supported browsers                           │
│ Chrome, Edge, Firefox, Safari: latest 2      │
│ versions. iOS Safari 17+, Android Chrome.    │
│ Screen sizes                                 │
│ 320px wide and up. Best at 360–430px or on   │
│ desktop (centered phone layout).             │
│ Internet                                     │
│ Needed only to load the app (~1 MB). Prices  │
│ come from bundled sample data.               │
│ Storage                                      │
│ Allow site data (cookies and local storage)  │
│ to keep a signed-up account. Private windows │
│ forget it when closed.                       │
│ Assistive technology                         │
│ Tested with NVDA, JAWS, VoiceOver, TalkBack. │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- "Your setup" live check: browser + version (from user agent), localStorage write/read test, notification permission, online status, reduced-motion preference.
- Static sections: browsers, screen sizes, internet, storage, assistive tech, performance target (first data in ≤ 2 s on a mid-range phone).

## User stories & acceptance criteria
- **US-P22.1 Check my setup.** Given localStorage is blocked, then the check shows "✗ Local storage blocked. You can browse and use the demo, but accounts can't be saved." with a link to FAQ.
- Unsupported browser shows a warning but doesn't block use.

## States
- Check running: "Checking…" (under 1 s).

## Data & persistence
- Nothing stored; the localStorage test writes and deletes `cpa:v1:probe`.

## Done when (phase passing conditions)
- [ ] Setup card shows 5 checks with icon + text.
- [ ] "Run check again" re-runs and updates online status.
