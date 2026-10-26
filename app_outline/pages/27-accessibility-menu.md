# Accessibility menu
**Route:** overlay on every page (no route; opened by the ♿ header icon or `Alt+A`)  ·  **Nav:** unchanged  ·  **Personas:** low-vision, dyslexic, motion-sensitive, keyboard and screen-reader users; Leo  ·  **Source stories:** US-9.2, US-9.3, NFR Accessibility, section 15 Accessibility menu

## Purpose
A OneTap-style panel with one-tap profiles and individual adjustments that change the whole app instantly, including crypto-specific controls (chart text summaries, auto-refresh live prices).

## Wireframe (phone, ~430px)
```
┌──────────────────────────────────────────────┐
│ Accessibility                  [Reset] [✕]   │  right sheet / full-height on phone
├──────────────────────────────────────────────┤
│ Profiles                                     │
│ ┌──────────┐┌──────────┐┌──────────┐         │
│ │ 👁 Low    ││ 🧠 Focus  ││ ⏸ Motion │         │
│ │ vision   ││ (ADHD)   ││ safe     │         │
│ └──────────┘└──────────┘└──────────┘         │
│ ┌──────────┐┌──────────┐┌──────────┐         │
│ │ Aa       ││ ⌨ Keyboard││ 🔊 Screen │         │
│ │ Dyslexia ││ nav      ││ reader   │         │
│ └──────────┘└──────────┘└──────────┘         │
│                                              │
│ Text                                         │
│ Text size        [−]  120%  [+]              │
│ Font             (Default)(Readable)(Dyslexic)│
│ Line height      [−]  1.5   [+]              │
│ Letter spacing   [−]  +0.05em [+]            │
│ Alignment        (Default)(Left)(Center)     │
│ Colour                                       │
│ Contrast         (Default)(High)(Dark)(Light)│
│ Saturation       (Default)(Low)(High)(Mono)  │
│ Navigation                                   │
│ Highlight links                 [□]          │
│ Highlight headings              [□]          │
│ Strong focus outline            [■]          │
│ Big cursor                      [□]          │
│ Reading guide                   [□]          │
│ Content                                      │
│ Hide images                     [□]          │
│ Stop animations                 [■]          │
│ Chart text summaries            [■]          │
│ Summary text size  (S)(■M■)(L)(XL)           │
│ Auto-refresh live prices        [□]          │
│   Prices update when you tap "Refresh"       │
│ ──────────────────────────────────────────── │
│ Accessibility policy ›   Keyboard shortcuts ›│
└──────────────────────────────────────────────┘
```

## Components & content
- **Language (Oct 26, 2026, clarification 30):** English, Español or Português at the top of the menu, each named in its own language. It's the same setting as the main menu and Settings › Preferences; Reset leaves it unchanged.
- **Profiles (one tap, can combine; each sets a bundle and the switches show what changed):**
  - Low vision: text 150%, high contrast, strong focus outline, big cursor.
  - Focus (ADHD): reading guide, stop animations, auto-refresh off.
  - Motion safe: stop animations, auto-play chart animations off, auto-advance onboarding off, no price flash.
  - Dyslexia: dyslexia-friendly font, line height 1.8, letter spacing +0.12em, left align.
  - Keyboard nav: strong focus outline, highlight links, shortcuts help hint.
  - Screen reader: chart text summaries on, auto-refresh off (prevents announcement noise), hide decorative images.
- **Text:** size 80–200% in 10% steps (layout reflows; tables switch to stacked cards above 130%), font, line height 1.0–2.0, letter spacing 0–0.2em, alignment.
- **Colour:** contrast modes; saturation filter.
- **Navigation:** highlight links (underline + outline), highlight headings, strong focus outline (3px accent + 2px offset), big cursor (48px SVG cursor), reading guide (horizontal bar following the pointer; on touch, a draggable bar).
- **Content:** hide images (logos fall back to letter circles; text alternatives shown), stop animations (sparkline draw-in, price flash, skeleton shimmer, carousel), chart text summaries on/off and summary text size, auto-refresh live prices on/off (when off, a "Refresh" button appears with "Last updated").
- Reset restores defaults. Changes apply live; `prefers-reduced-motion` and `prefers-contrast` seed defaults.

## User stories & acceptance criteria
- **US-P27.1 One-tap profile.** As a low-vision user, when I tap "Low vision", then text becomes 150%, contrast high, focus outline strong, and the profile tile shows as pressed (`aria-pressed="true"`).
- **US-P27.2 Granular control.** Every control changes the app immediately with no reload; an `aria-live` status says e.g. "Text size 120%".
- **US-P27.3 Stop live updates.** Given auto-refresh is off, then prices don't tick and no live announcements occur; Refresh updates once.
- **US-P27.4 Chart summaries.** Given summaries are on at size L, then every chart (coin, portfolio, BTC dominance) shows its text summary below it at 18px.
- **US-P27.5 Keyboard.** The panel opens with `Alt+A`, traps focus, closes with Esc and returns focus to the ♿ icon.

## States
- Default (nothing on), profile active, custom. Reset confirmation toast "Accessibility settings reset."

## Data & persistence
- Accounts: `cpa:v1:user:<id>.settings.a11y` (applied immediately on login).
- Guest and demo: memory only (per decision 4); a note in the panel says "Sign in to keep these settings."

## Done when (phase passing conditions)
- [ ] Every listed control exists and visibly changes the Market page in a screenshot.
- [ ] Each profile toggles its bundle on and off.
- [ ] Turning off auto-refresh stops price ticks; Refresh updates once.
- [ ] Settings survive refresh for a signed-up account and reset for guests.
- [ ] Keyboard-only open, operate, and close works.
