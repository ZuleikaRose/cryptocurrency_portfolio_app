# Not found
**Route:** `*` (any unknown route, unknown coin/fund slug)  ·  **Nav:** no tab active  ·  **Personas:** all  ·  **Source stories:** US-8.3 (fallback), US-P29.x (new)

## Purpose
A friendly dead-end recovery: explain the page doesn't exist and offer search and key destinations.

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ [C] CPA                      [♿] [🔔] [≡]    │
├──────────────────────────────────────────────┤
│                                              │
│            [line art: empty chart]           │
│                                              │
│ We couldn't find that page                   │
│ The link may be old or mistyped.             │
│ /coins/orbitl2                               │
│ ┌──────────────────────────────────────────┐ │
│ │ 🔍 Search coins, exchanges, IDO…   ⌘ K   │ │
│ └──────────────────────────────────────────┘ │
│ Did you mean: Orbit L2 (ORB) ›               │
│ ┌──────────────────────────────────────────┐ │
│ │              Go to Home                  │ │
│ └──────────────────────────────────────────┘ │
│ Market · Unlocks · Support                   │
│ Report a broken link ›                       │
├──────────────────────────────────────────────┤
│ Home Market Explore Fund. Unlocks Watch Port │
└──────────────────────────────────────────────┘
```

## Components & content
- Illustration, H1, explanation, the requested path, search field (opens overlay prefilled with the last path segment), "Did you mean" suggestion for coin/fund slugs (closest match by name), Go to Home, quick links, Report a broken link → `/report-issue?type=bug&from=<path>`.
- Document title "Page not found · CPA"; focus moves to the H1 on load.

## User stories & acceptance criteria
- **US-P29.1 Recover.** Given I open `/coins/orbitl2`, then I see this page with "Did you mean: Orbit L2 (ORB)" linking to `/coins/orbit-l2`.
- **US-P29.2 Report.** Report a broken link opens the issue form with the path prefilled.

## States
- No suggestion found: hide "Did you mean".

## Data & persistence
- None.

## Done when (phase passing conditions)
- [ ] `/nope` and `/funds/unknown` show this page with shell and nav.
- [ ] Suggestion appears for a near-miss coin slug.
- [ ] Go to Home and Report links work.
