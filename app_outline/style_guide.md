# CryptoRank Mobile App: Style Guide

> **Scope:** the visual and interaction language for the CryptoRank (cryptorank.io) iOS and Android apps.
> **Status:** proposed draft. Color values and type choices are working tokens for design and build. Check them against CryptoRank's official brand assets before release.

---

## 1. Design Principles

| Principle | What it means on mobile |
|---|---|
| **Data first** | Numbers are the product. Prices, % changes, market caps, and unlock dates get the most visual weight. Decoration never competes with data. |
| **Glanceable** | A user should read the market in under 3 seconds: the top movers, their watchlist, and the next unlock. |
| **Trustworthy** | Every metric shows its source and when it was last updated. Labels are neutral. No hype language or "moon" emoji. |
| **Dense but calm** | Show plenty of information, using whitespace, alignment, and muted surfaces to avoid noise. |
| **Thumb-friendly** | Primary actions sit in the bottom half of the screen. Touch targets are at least 44×44 pt. |

---

## 2. Brand Voice & Tone

- **Voice:** expert, precise, neutral. Like a research analyst, not a trader on social media.
- **Tone shifts:**
  - *Market data:* factual. ("BTC +2.4% in 24h")
  - *Onboarding / empty states:* friendly and brief. ("Add coins to your watchlist to see them here.")
  - *Errors:* plain, blame-free, and actionable. ("We couldn't load prices. Pull down to retry.")
  - *Alerts:* urgent only when something is time-sensitive. ("ARB unlock in 1 hour: 92.6M tokens (3.2% of supply)")
- **Never:** give financial advice, use "guaranteed", "to the moon", or "don't miss out", or use urgency purely to drive engagement.
- **Disclaimer:** "Not financial advice. Data provided for informational purposes." appears in the footer of the Coin Detail, Fundraising, and Portfolio screens.

### Writing rules
- Sentence case for all UI text ("Token unlocks", not "Token Unlocks").
- Tickers in uppercase (BTC, ETH). Project names in their official casing (dYdX, LayerZero).
- Numbers: abbreviate large values: `$1.24B`, `$842.5M`, `$12.3K`. Show full precision on the detail screen.
- Percentages: always signed and to 2 decimals: `+3.21%`, `−0.48%` (true minus sign U+2212).
- Dates: `Oct 17, 2026` for display. Relative time for anything under 7 days ("in 3d 4h", "2h ago").

---

## 3. Color

Dark theme is the **default** (most crypto users trade at night and on OLED screens). Light theme is fully supported.

### 3.1 Core tokens

| Token | Dark | Light | Usage |
|---|---|---|---|
| `bg/base` | `#0B0F19` | `#FFFFFF` | App background |
| `bg/surface` | `#131A2A` | `#F5F7FA` | Cards, sheets |
| `bg/elevated` | `#1B2438` | `#FFFFFF` (+ shadow) | Modals, menus |
| `border/subtle` | `#232D44` | `#E3E8EF` | Dividers, card outlines |
| `text/primary` | `#F2F5FA` | `#0B0F19` | Headlines, values |
| `text/secondary` | `#8A96AD` | `#5B6779` | Labels, captions |
| `text/tertiary` | `#5B6779` | `#8A96AD` | Timestamps, disabled |
| `brand/primary` | `#3D7BFF` | `#2563EB` | Primary buttons, active tab, links |
| `brand/primary-pressed` | `#2F63D6` | `#1D4FC0` | Pressed state |

### 3.2 Semantic / market colors

| Token | Dark | Light | Usage |
|---|---|---|---|
| `market/up` | `#16C784` | `#0E9F6E` | Price up, positive ROI |
| `market/down` | `#EA3943` | `#D92D20` | Price down, negative ROI |
| `market/neutral` | `#8A96AD` | `#5B6779` | 0.00% change |
| `status/warning` | `#F5A524` | `#B7791F` | Upcoming large unlock, high dilution |
| `status/info` | `#3D7BFF` | `#2563EB` | Tips, informational banners |

### 3.3 Category accents (charts, tags)

| Category | Hex | Used for |
|---|---|---|
| Fundraising | `#8B5CF6` | Funding rounds, investor tags |
| Token unlocks | `#F5A524` | Vesting / unlock events |
| Token sales (ICO/IDO) | `#06B6D4` | Sale rounds, launchpads |
| DeFi | `#22C55E` | Category tag |
| AI | `#EC4899` | Category tag |
| Layer 1 / Layer 2 | `#3D7BFF` | Category tag |

### 3.4 Accessibility rules
- Text contrast: at least **4.5:1** for body, **3:1** for large text (18pt+ / 14pt bold) and icons.
- **Never use color alone** to show direction. Always pair green/red with `▲`/`▼` or a `+`/`−` sign.
- Provide a **"Swap up/down colors"** setting (red = up, used in some East Asian markets) and a **color-blind safe** mode (blue up / orange down).

---

## 4. Typography

| Role | Font | Size / Line height | Weight |
|---|---|---|---|
| Display (portfolio total) | Inter | 34 / 40 | 700 |
| H1 (screen title) | Inter | 24 / 32 | 700 |
| H2 (section) | Inter | 18 / 24 | 600 |
| Body | Inter | 15 / 22 | 400 |
| Body strong | Inter | 15 / 22 | 600 |
| Caption | Inter | 12 / 16 | 500 |
| Overline / tag | Inter | 11 / 14, +0.4 tracking, uppercase | 600 |
| **Numeric** | Inter with `tnum` (tabular figures) | inherits | inherits |
| Code / contract address | JetBrains Mono | 13 / 18 | 400 |

- **Tabular figures are mandatory** for prices, % changes, and table columns so digits line up and don't jitter during live updates.
- Respect OS Dynamic Type / font scaling up to 200%. Tables switch to stacked card layout above 130%.
- Fallbacks: SF Pro (iOS), Roboto (Android).

---

## 5. Spacing, Grid & Layout

- **Base unit:** 4 pt. Common steps: 4, 8, 12, 16, 24, 32, 48.
- **Screen gutters:** 16 pt (phones), 24 pt (tablets).
- **Card padding:** 16 pt. **Card radius:** 12 pt. **Sheet radius:** 20 pt (top corners).
- **List row height:** 64 pt (coin rows), 56 pt (settings rows).
- **Safe areas:** respect notch, Dynamic Island, and the gesture bar. No interactive elements in the bottom 8 pt above the home indicator.

### Navigation structure
Bottom tab bar (5 items max):

| Tab | Icon | Content |
|---|---|---|
| Markets | chart-line | Coin rankings, categories, top gainers/losers |
| Fundraising | coins-stack | Funding rounds, funds/investors |
| Unlocks | calendar-lock | Token unlock calendar & vesting |
| Watchlist | star | Saved coins, portfolio |
| More | menu | Token sales, exchanges, news, settings |

A persistent **search** button sits in the top app bar on every root screen.

---

## 6. Iconography & Imagery

- **Icon set:** outlined, 1.5 pt stroke, 24 pt grid. Filled variant for the active tab only.
- **Coin logos:** circular, 24 pt in lists and 40 pt in headers, with a 1 pt `border/subtle` ring so dark logos stay visible on dark backgrounds. Fallback is the ticker's first letter on a `bg/elevated` circle.
- **Fund/investor logos:** rounded square (8 pt radius).
- **Illustrations:** used only in empty states and onboarding. Simple line art in `brand/primary` and `text/tertiary`.

---

## 7. Components

### 7.1 Coin list row
```
[logo] Bitcoin  BTC            $67,412.18
       #1 · MCap $1.33T        ▲ +2.41%   [sparkline 7d]
```
- Rank, name, and ticker on the left. Price and 24h change right-aligned with tabular numbers.
- 7-day sparkline (56×24 pt), colored by 7-day direction.
- Swipe left reveals **★ Watchlist** and **🔔 Alert**.

### 7.2 Change pill
- Rounded 6 pt pill, 10% opacity fill of `market/up` or `market/down`, text in the full color, arrow glyph included.

### 7.3 Buttons
| Variant | Style | Use |
|---|---|---|
| Primary | `brand/primary` fill, white text, 48 pt height | One per screen: "Add to watchlist", "Set alert" |
| Secondary | 1 pt `border/subtle` outline, `text/primary` | "Share", "View on explorer" |
| Tertiary | Text only, `brand/primary` | "See all", inline links |
| Destructive | `market/down` text or fill | "Remove from portfolio" |

### 7.4 Charts
- Line chart default, candlestick toggle. Time ranges: **1D · 7D · 1M · 3M · 1Y · ALL** as a segmented control.
- Touch and drag shows a crosshair with a value and timestamp tooltip, plus haptic feedback on each data point snap.
- Unlock and funding events can be overlaid as small markers on the price chart.

### 7.5 Unlock card
```
ARB · Arbitrum                       in 3d 04h
92.65M ARB  ·  $78.4M  ·  3.21% of circ. supply
[███████████░░░░░░░] 61% unlocked
```
- Countdown updates live. A `status/warning` border appears when the unlock is over 2% of circulating supply.

### 7.6 Funding round card
- Project logo and name, round type tag (Seed / Series A / Strategic), amount raised, valuation, date, and up to 3 lead investor logos plus "+N".

### 7.7 Tables
- Sticky first column (asset name) for horizontal scroll.
- Sortable headers with a ▲/▼ indicator. The current sort is shown in `brand/primary`.

### 7.8 States
| State | Pattern |
|---|---|
| Loading | Skeleton shimmer matching final layout (no spinners for lists) |
| Empty | Illustration + one sentence + one primary action |
| Error | Inline banner with retry. Cached data stays visible, marked "Last updated 12m ago" |
| Offline | Top banner "You're offline: showing saved data" |
| Stale data | Values over 5 min old are shown in `text/secondary` with a clock icon |

---

## 8. Motion & Haptics

- **Durations:** 150 ms (micro), 250 ms (screen transitions), 350 ms (sheets).
- **Easing:** standard ease-out for entrances, ease-in for exits.
- **Price ticks:** a brief 400 ms background flash in the `market/up` or `market/down` color at 15% opacity. No number animation (it hurts readability).
- **Haptics:** light impact on toggles and adding to the watchlist, selection tick on chart scrubbing, success notification when an alert is created.
- Honor **Reduce Motion**: disable flashes and parallax, and use crossfades.

---

## 9. Accessibility Checklist

- [ ] All interactive targets ≥ 44×44 pt
- [ ] VoiceOver/TalkBack labels read values in full: "Bitcoin, price 67 thousand 412 dollars, up 2.41 percent"
- [ ] Charts have an accessible summary ("7-day range $63,100 to $68,900, currently near the high")
- [ ] Color never the only signal for direction or status
- [ ] Dynamic Type up to 200% without truncating prices
- [ ] Focus order follows visual order
- [ ] Live price updates are **not** announced continuously (no announcement spam)

---

## 10. Platform Notes

| Topic | iOS | Android |
|---|---|---|
| Navigation | Large titles collapse on scroll | Top app bar, Material 3 |
| Back | Swipe from edge | System back gesture |
| Widgets | Home & Lock Screen widgets (watchlist, next unlock) | Glance widgets |
| Notifications | Time-sensitive for price alerts the user set | High-priority channel for user alerts only |
| Sharing | Native share sheet with generated chart image | Same |
