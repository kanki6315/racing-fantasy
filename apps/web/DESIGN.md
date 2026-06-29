---
name: IMSA Fantasy
description: A broadcast-grade fantasy app for the IMSA sportscar championship.
colors:
  brand: "#e10600"
  brand-2: "#ff2d2d"
  brand-3: "#ff5d5d"
  bg: "#0a0b0d"
  surface: "#101317"
  surface-2: "#16181c"
  surface-3: "#0e0f12"
  line: "#1f242a"
  line-2: "#2a2d33"
  line-3: "#3a3f47"
  ink: "#ffffff"
  ink-2: "#c8ccd2"
  muted: "#8a8f98"
  muted-2: "#5c626b"
  class-gtp: "#ff2d2d"
  class-lmp2: "#2e7dff"
  class-gtdpro: "#ffb400"
  class-gtd: "#4ade80"
  success: "#4ade80"
  warn: "#ffc23d"
  danger: "#ff5d5d"
typography:
  display:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 700
    lineHeight: 1.0
    letterSpacing: "0.0em"
  headline:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "0.0em"
  title:
    fontFamily: "Saira Condensed, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
  body:
    fontFamily: "Saira, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Spline Sans Mono, monospace"
    fontSize: "0.625rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.08em"
rounded:
  xs: "2px"
  sm: "3px"
  md: "4px"
  lg: "6px"
  xl: "8px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "26px"
  xl: "48px"
components:
  button-primary:
    backgroundColor: "{colors.brand}"
    textColor: "{colors.ink}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.brand-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    typography: "{typography.title}"
    rounded: "{rounded.sm}"
    padding: "0 20px"
    height: "44px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.lg}"
    padding: "16px"
  input:
    backgroundColor: "#070809"
    textColor: "{colors.ink}"
    typography: "{typography.label}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "48px"
  chip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: IMSA Fantasy

## 1. Overview

**Creative North Star: "The Timing Screen"**

IMSA Fantasy looks like a live broadcast timing-and-scoring graphics package, executed with the
restraint of a premium motorsport marque. The surface is a near-black void (`#0a0b0d`) the way a
broadcast bug sits over dark footage; content rides on it as crisp, slightly-elevated panels. The
numbers — positions, prices, points, deltas — are the heroes, set in a tabular monospace so they
align and scan like a timing screen. IMSA red is the single brand voice, spent sparingly on the
things that matter: the live state, the primary action, the bar under the wordmark.

It is broadcast-fluent but never cluttered. Where real timing software drowns the viewer in
density, this system breathes: generous gutters, clear hierarchy, one accent at a time. The
condensed display face (Saira Condensed) carries the trackside, engineered character; the humanist
body face (Saira) keeps prose calm and readable; the mono (Spline Sans Mono) is reserved for data
and micro-labels. The result reads as *precise, fast, premium* — the focus of the grid before
lights-out, not the noise of a casino floor.

This system explicitly rejects the generic SaaS dashboard (no cream surfaces, no identical
icon-heading-text card grids, no hero-metric template), the DraftKings betting aesthetic (no
loud green-on-black, no odds-board clutter, no manufactured urgency), and cluttered real-world
timing software (density only where it earns its keep).

**Key Characteristics:**
- Near-black broadcast canvas; content as crisp elevated panels, not floating cards.
- Monospace numerals treated as first-class typography — the data IS the interface.
- One accent (IMSA red) spent deliberately; racing-class colors reserved strictly for wayfinding.
- Tight, engineered corners (2–8px) and hairline borders over heavy shadow.
- Premium restraint: breathing room and hierarchy carry weight, not noise.

## 2. Colors

A near-black broadcast palette: a cool-dark surface ramp, a single hot red brand voice, and four
load-bearing racing-class hues that function as wayfinding.

### Primary
- **IMSA Red** (`#e10600`): the one brand voice. Primary buttons, the 2px bar under the wordmark/nav,
  live-state indicators, the skewed broadcast slash motif. Spent sparingly — its rarity is the point.
- **Red Glow** (`#ff5d5d`, with `#ff2d2d` mid): hover/active states and the focus-visible ring; the
  lighter tints carry red into text and tinted-badge contexts where the full brand would vibrate.

### Secondary — Racing-class identity (load-bearing, never decorative)
- **GTP Red** (`#ff2d2d`): the top prototype class.
- **LMP2 Blue** (`#2e7dff`, lighter `#6ba4ff`): the LMP2 class.
- **GTD PRO Amber** (`#ffb400`, lighter `#ffc23d`): the GTD PRO class.
- **GTD Green** (`#4ade80`): the GTD class.
  These orient the user the way class identity does trackside. They are admin-overridable per class
  (`class.color`) and must only ever signify class — never reused as generic accent or status.

### Tertiary — Status
- **Success Green** (`#4ade80`): positive deltas, confirmed/scored states.
- **Warn Amber** (`#ffc23d`): caution — not-registered, lock-approaching, attention-needed.
- **Danger Red** (`#ff5d5d`): errors, destructive actions, lockouts.

### Neutral
- **Void** (`#0a0b0d`): the page background; the broadcast black everything sits on.
- **Surface ramp** (`#101317` / `#16181c` / `#0e0f12`): elevated panels, raised rows, and recessed
  wells respectively. Depth is tonal, not shadowed.
- **Lines** (`#1f242a` / `#2a2d33` / `#3a3f47`): hairline borders and dividers, lightening as
  elements come forward or gain focus.
- **Ink** (`#ffffff`): primary text and key numerals. **Ink-2** (`#c8ccd2`): secondary text.
  **Muted** (`#8a8f98`) / **Muted-2** (`#5c626b`): labels and de-emphasized data.

### Named Rules
**The One Red Rule.** IMSA red is the only brand accent and appears on ≤10% of any screen — the
primary action, the live state, the nav bar. If two reds compete on a screen, one of them is wrong.

**The Class-Color Reserve.** GTP/LMP2/GTD PRO/GTD hues signify racing class and nothing else. Never
borrow a class color for a button, a status, or decoration. Class is wayfinding; spending it
elsewhere breaks the map.

## 3. Typography

**Display Font:** Saira Condensed (with `sans-serif` fallback)
**Body Font:** Saira (with `sans-serif` fallback)
**Label/Mono Font:** Spline Sans Mono (with `monospace` fallback)

**Character:** A single condensed/regular sans family pairing (Saira Condensed + Saira) keeps the
voice unified and engineered — the condensed cut does the trackside shouting, the regular cut keeps
prose humane. Spline Sans Mono is the timing-screen numeral: tabular, exact, used for every figure
and micro-label so numbers align and scan.

### Hierarchy
- **Display** (Saira Condensed, 700, clamp(2rem→3.25rem), lh 1.0): page and hero titles, scoreboard
  headers. Uppercase. Reserve true italic for the single primary CTA.
- **Headline** (Saira Condensed, 600, ~1.5rem, lh 1.1): section and panel titles.
- **Title** (Saira Condensed, 600, ~0.875rem, +0.08em, uppercase): nav links, button labels, table
  headers — the engineered all-caps voice.
- **Body** (Saira, 400, ~0.8125rem, lh 1.5): prose, descriptions, helper text. Cap measure at 65–75ch.
- **Label** (Spline Sans Mono, 500, ~0.625rem, +0.08em): micro-labels, status pills, and all numeric
  data. Tabular by nature; this is where the timing-screen character lives.

### Named Rules
**The Tabular-Numeral Rule.** Every number a player compares — position, price, points, delta — is
set in Spline Sans Mono so columns align to the digit. Proportional numerals in a standings table
are forbidden.

**The Italic-Restraint Rule.** Display italic is loud. Use it only on the primary CTA (e.g. "SAVE
ROSTER"). Everywhere else, weight and case carry emphasis — not slant.

## 4. Elevation

Flat by default, with depth conveyed tonally, not by shadow. Panels separate from the void through
the surface ramp (`surface` over `bg`, `surface-2` for raised rows, `surface-3` for recessed wells)
and hairline borders that lighten (`line` → `line-2` → `line-3`) as an element comes forward, hovers,
or gains focus. Drop shadows are reserved exclusively for elements that genuinely float above the
page — modals, dropdowns, tooltips.

### Shadow Vocabulary
- **Overlay** (`box-shadow: 0 30px 80px rgba(0,0,0,0.6)`): modals/dialogs lifting off the void.
- **Popover** (`box-shadow: 0 8px 24px rgba(0,0,0,0.5)`): dropdowns and tooltips.

### Named Rules
**The Flat-Void Rule.** In-page surfaces never cast shadows. Depth at rest is tonal layering plus a
lightening border. A shadow on a card is a 2014 tell; if a panel looks like it's floating, flatten it.

## 5. Components

The component voice is engineered and decisive, eased toward premium restraint: tight corners and
hairline borders, but generous internal breathing room. Italic and full-red are spent sparingly so
the primary action always wins the eye.

### Buttons
- **Shape:** sharp, engineered corners — 3px (`rounded.sm`) for actions, never pill-rounded.
- **Primary:** solid IMSA red (`#e10600`) fill, white ink, Saira Condensed uppercase title type,
  ~44px tall. The one true action per view; italic permitted here only.
- **Hover / Focus:** brighten to `#ff2d2d`; keyboard focus shows the global 2px `#ff5d5d` ring at
  2px offset. Transitions are color-only and fast (~150ms).
- **Secondary / Ghost:** transparent or `surface` fill with a `line-2` hairline border, `ink-2`
  label. Same height and type as primary so rows stay aligned. Border lightens on hover.

### Chips / Pills
- **Style:** mono micro-label (Spline Sans Mono, ~9–10px, tracked), 2–3px radius, set on a tinted
  wash of its own semantic hue (`warn/10` + `warn/35` border, `brand/15`, `surface-3` neutral).
- **State:** a leading dot or icon plus text always accompanies color — pills read "NOT REGISTERED"
  with an amber dot, never amber alone. Selected vs. idle shifts border + fill, not just hue.

### Cards / Containers
- **Corner Style:** 6px (`rounded.lg`) for primary panels; 4px for nested/inset blocks.
- **Background:** `surface` (`#101317`) on the void; `surface-3` for recessed wells.
- **Shadow Strategy:** none at rest (see Elevation — The Flat-Void Rule). Separation is the border.
- **Border:** hairline `line` (`#1f242a`), lightening to `line-2` on hover/active.
- **Internal Padding:** 16px standard; 20–32px for hero/empty-state panels. Lean generous — the
  premium register is carried by breathing room.

### Inputs / Fields
- **Style:** recessed near-black well (`#070809`), `line-2` hairline border, 4px radius, Spline Sans
  Mono value text — inputs read like a data field, not a form box.
- **Focus:** border shifts toward `line-3`/brand and the global focus ring applies; no glow.
- **Error / Disabled:** error border + helper text in `danger` (`#ff5d5d`); disabled drops to `muted-2`.

### Navigation
- **Style:** pure-black top bar with a 2px IMSA-red bottom border — the broadcast lower-third edge.
  Links are Saira Condensed uppercase, tracked. Active link carries a `brand` underline (the border
  is present-but-transparent when idle, so labels never shift). Idle `muted` → hover `ink-2`.
- **Mobile:** the inline nav collapses to a horizontally scrollable section row beneath the bar;
  the identity block replaces the initials avatar with name/email.

### Signature — The Broadcast Slash
A skewed red bar (`background: brand; transform: skewX(-14deg)`) used as a section/leading accent —
the angular motion mark of broadcast motorsport graphics. Use it as a deliberate punctuation, not on
every heading.

## 6. Do's and Don'ts

### Do:
- **Do** set every comparable number (position, price, points, delta) in Spline Sans Mono, tabular —
  columns align to the digit (The Tabular-Numeral Rule).
- **Do** keep IMSA red to ≤10% of any screen: the primary action, the live state, the nav edge
  (The One Red Rule).
- **Do** reserve GTP/LMP2/GTD PRO/GTD colors strictly for racing-class wayfinding, and always pair
  class/status color with text, icon, or position so it survives color-blindness.
- **Do** convey depth with the tonal surface ramp + lightening hairline borders; keep in-page
  surfaces flat (The Flat-Void Rule).
- **Do** lead with breathing room — the premium register comes from generous gutters and clear
  hierarchy, not added ornament.

### Don't:
- **Don't** build a generic SaaS dashboard — no cream/light surfaces, no identical
  icon-heading-text card grids, no big-number hero-metric template.
- **Don't** drift toward the DraftKings betting aesthetic — no loud green-on-black, no odds-board
  clutter, no flashing CTAs or manufactured urgency. The qualifying lock is the only deadline.
- **Don't** replicate cluttered timing software — density only where it earns its keep; never
  data-dump for its own sake.
- **Don't** go toy or cartoonish — no mascots, no bubbly pill-rounded everything, no childish
  gamification. Corners stay tight (2–8px).
- **Don't** use a `border-left`/`border-right` greater than 1px as a colored accent stripe on cards
  or rows — use a full hairline border, a tinted wash, or a leading badge instead.
- **Don't** spend display italic or full-red beyond the single primary action per view
  (The Italic-Restraint Rule).
- **Don't** drop shadows on resting in-page surfaces — shadow is reserved for true overlays
  (modals, dropdowns, tooltips).
