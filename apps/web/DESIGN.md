---
name: Endurance Fantasy
description: A broadcast-grade fantasy app for sportscar endurance racing.
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
  success: "#2dd4bf"
  warn: "#ff9e2c"
  danger: "#ff5d5d"
typography:
  display:
    fontFamily: "Saira Semi Condensed, sans-serif"
    fontSize: "34px"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "0.0em"
  headline:
    fontFamily: "Saira Semi Condensed, sans-serif"
    fontSize: "22px"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "0.0em"
  title:
    fontFamily: "Saira Semi Condensed, sans-serif"
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
    height: "50px"
  chip:
    backgroundColor: "{colors.surface-3}"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
---

# Design System: Endurance Fantasy

## 1. Overview

**Creative North Star: "The Timing Screen"**

Endurance Fantasy looks like a live broadcast timing-and-scoring graphics package, executed with the
restraint of a premium motorsport marque. The surface is a near-black void (`#0a0b0d`) the way a
broadcast bug sits over dark footage; content rides on it as crisp, slightly-elevated panels. The
numbers — positions, prices, points, deltas — are the heroes, set in a tabular monospace so they
align and scan like a timing screen. Endurance red is the single brand voice, spent sparingly on the
things that matter: the live state, the primary action, the bar under the wordmark.

It is broadcast-fluent but never cluttered. Where real timing software drowns the viewer in
density, this system breathes: generous gutters, clear hierarchy, one accent at a time. The
condensed display face (Saira Semi Condensed) carries the trackside, engineered character; the humanist
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
- One accent (Endurance red) spent deliberately; racing-class colors reserved strictly for wayfinding.
- Tight, engineered corners (2–8px) and hairline borders over heavy shadow.
- Premium restraint: breathing room and hierarchy carry weight, not noise.

## 2. Colors

A near-black broadcast palette: a cool-dark surface ramp, a single hot red brand voice, and four
load-bearing racing-class hues that function as wayfinding.

### Primary
- **Endurance Red** (`#e10600`): the one brand voice. Primary buttons, the 2px bar under the wordmark/nav,
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
Status hues are deliberately offset from the class hues (teal ≠ GTD green, orange ≠ GTD PRO amber)
so a status signal can never be mistaken for class wayfinding.
- **Success Teal** (`#2dd4bf`): positive deltas, confirmed states.
- **Warn Orange** (`#ff9e2c`): caution — not-registered, lock-approaching, attention-needed.
- **Danger Red** (`#ff5d5d`): errors, destructive actions, lockouts.
- **Flag White** (ink on `ink/10`, or solid `ink` fill with dark text): results posted — the SCORED
  lifecycle pill; the checkered-flag moment, distinct from FINAL's dim neutral.

### Neutral
- **Void** (`#0a0b0d`): the page background; the broadcast black everything sits on.
- **Surface ramp** (`#101317` / `#16181c` / `#0e0f12`): elevated panels, raised rows, and recessed
  wells respectively. Depth is tonal, not shadowed.
- **Lines** (`#1f242a` / `#2a2d33` / `#3a3f47`): hairline borders and dividers, lightening as
  elements come forward or gain focus.
- **Ink** (`#ffffff`): primary text and key numerals. **Ink-2** (`#c8ccd2`): secondary text.
  **Muted** (`#8a8f98`): labels, micro-copy, and de-emphasized data — the darkest ink that still
  carries text. **Muted-2** (`#5c626b`): non-text only — disabled fills, inert dots, decorative
  strokes. It lands near 3.2:1 on `surface-3` and must never carry a word a player has to read.

### Named Rules
**The Confirmed-Is-Teal Rule.** A state the player has already achieved — a pick in the lineup, a
series joined, a budget still inside the cap — is `success` teal, never brand red. Red marks the
thing still to do (SAVE ROSTER) and the thing happening now (the live lock). A board where every
selected row glowed red left the actual action with nowhere to stand out.

**The One Red Rule.** Endurance red is the only brand accent and appears on ≤10% of any screen. A view
gets **two solid-red spends: the primary action and the live state** (plus the nav's 2px edge, which
is chrome, not content). Anything else that wants red takes a tinted wash instead (`brand/15` fill,
`brand/40` border, `brand-3` label) or takes red only on hover. If you can count three solid reds in
a screenshot, one of them is wrong.

**The Class-Color Reserve.** GTP/LMP2/GTD PRO/GTD hues signify racing class and nothing else. Never
borrow a class color for a button, a status, or decoration. Class is wayfinding; spending it
elsewhere breaks the map.

**The Contrast Floor Rule.** `muted` (`#8a8f98`) is the floor for any text a player reads. Below it
the ramp is decoration only. Two corollaries, both learned the hard way: a placeholder is text
(`muted`, not `muted-2` — that reads 1.9:1), and **opacity is not a de-emphasis tool** — an
`opacity-70` row stacks on already-muted 11px labels and drops them under AA. Recede an element by
changing its tokens (title to `ink-2`, pills unfilled), never by fading the whole row. The single
exemption is a genuinely **disabled control** — WCAG exempts inactive elements, and the drop to
`muted-2` (or the desaturated-red fill at 60%) is itself the signal. Nothing else is exempt.

## 3. Typography

**Display Font:** Saira Semi Condensed (with `sans-serif` fallback)
**Body Font:** Saira (with `sans-serif` fallback)
**Label/Mono Font:** Spline Sans Mono (with `monospace` fallback)

**Character:** A single condensed/regular sans family pairing (Saira Semi Condensed + Saira) keeps the
voice unified and engineered — the condensed cut does the trackside shouting, the regular cut keeps
prose humane. Spline Sans Mono is the timing-screen numeral: tabular, exact, used for every figure
and micro-label so numbers align and scan.

### Hierarchy
- **Display** (Saira Semi Condensed, 800, 34px → 40px at `sm`, lh 0.98): page and hero titles,
  scoreboard headers. Uppercase, `text-wrap: balance`. Reserve true italic for the primary CTA.
- **Headline** (Saira Semi Condensed, 800, 22px, lh 1.05): section and panel titles. Panel
  sub-headers step down to 15–17px at weight 700.
- **Title** (Saira Semi Condensed, 600, ~0.875rem, +0.08em, uppercase): nav links, button labels, table
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

**The Fixed-Step Rule.** Type sizes are fixed px with breakpoint steps (`text-[34px] sm:text-[40px]`),
never `clamp()` or viewport units. A player reads this on a phone at the lock deadline and on a
desktop between rounds; both deserve a size chosen for them, not interpolated between them.

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
The one in-page exception is *pinned* sticky chrome — the standings Position Bug takes the Popover
shadow only while stuck to the viewport, and drops it the moment it returns to normal flow. It is
genuinely floating over scrolling content at that point, which is exactly what the rule reserves
shadow for.

## 5. Components

The component voice is engineered and decisive, eased toward premium restraint: tight corners and
hairline borders, but generous internal breathing room. Italic and full-red are spent sparingly so
the primary action always wins the eye.

### Buttons
- **Shape:** sharp, engineered corners — 3px (`rounded.sm`) for actions, never pill-rounded.
- **Primary:** solid Endurance red (`#e10600`) fill, white ink, Saira Semi Condensed uppercase title type,
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
- **Filter / selection chips.** 3px corners, sized off the **pointer, not the viewport**: `h-9` for a
  fine pointer, `h-11` under `@media (pointer: coarse)` at any width. A filter is a touch target
  before it is a label, and the `sm:h-9` this replaces called every touch tablet a desktop and handed
  it 36px controls. Tailwind v4 ships no pointer variant — `pointer-coarse:` / `pointer-fine:` are
  registered via `@custom-variant` in `index.css`, and silently generate *nothing* without it.
  Idle: `line-2` border, `muted` label. Selected: `line-3`
  border + `surface-2` fill + `ink` label + a 2px brand underline as an *inset* shadow — the nav's
  active-link language, borrowed so selection reads the same everywhere. Always carries
  `aria-pressed`. **Never fill a filter with solid brand red:** selection is neither the primary
  action nor the live state, and three filter rows can be active at once.
- **Filter rows scroll, they never wrap.** Six championship names and eleven event names wrapped to
  four stacked rows — ~330px of chrome on desktop and about 1000px on a phone, two and a half screens
  before a single standing. Each row is now one line that scrolls sideways, borrowing the nav's own
  idiom (`overflow-x-auto`, scrollbar hidden, children `shrink-0`). The row label sits *outside* the
  scroller so the legend doesn't scroll away from its own content. Three obligations come with it:
  the overflow must be visible as overflow (a mask fades whichever edge still has content behind it);
  the active pill must be scrolled into view, or a `?round=` deep link selects something off-screen
  with no cue; and a mouse — which has no horizontal wheel — needs edge nudge buttons, rendered under
  `pointer-fine` only, since touch swipes and Tab already reach the far end on their own.
- **A filter offering one choice is not a filter.** The Year row renders only when a series has more
  than one season; otherwise it was a labelled row containing the word "2026" and nothing to do, and
  the subtitle already states the year.
- **The URL is the filter state.** Every standings level lives in `?champ=&season=&round=` and writes
  back to it, so a board is linkable and Back undoes a filter instead of leaving the page. Two rules
  keep the history stack honest: values the *app* resolved (defaults, healing) use `replace`, values
  the *user* picked use `push` — so Back walks through the boards someone chose, not through every
  default the page settled on. And picking a level clears the levels below it, because a round id
  belongs to exactly one season. Invalid params are validated, never trusted: an unknown round falls
  back to the season pool without ever issuing a doomed request, and is then dropped from the URL so
  the address bar can't describe a view nobody is looking at.
- **Lifecycle pills — two vocabularies, one state machine.** A race weekend has six derived stages
  (Waiting → Picks Open → In Progress → Awaiting Results → Scored → Final). The **calendar** speaks
  the loud broadcast dialect: solid fills, condensed caps, terse copy ("COMING SOON", "PICKS OPEN",
  "AWAITING RESULTS", "FINAL"). The **dashboard** speaks the quiet dialect: tinted wash + hairline
  border in the same hue, sentence case ("Picks Open", "Awaiting Results", "Final"). Never mix them
  on one surface, and never let the two disagree about a stage's name.
- **Flag White for SCORED.** Results-posted is the only stage that fills with `ink` (dark text) or
  washes `ink/10` — the checkered-flag moment. It must stay visually distinct from FINAL's dim
  neutral: "your points are up, go look" reads differently from "this weekend is archived."

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
- **Style:** pure-black top bar with a 2px Endurance-red bottom border — the broadcast lower-third edge.
  Links are Saira Semi Condensed uppercase, tracked. Active link carries a `brand` underline (the border
  is present-but-transparent when idle, so labels never shift). Idle `muted` → hover `ink-2`.
- **Below `lg`:** the inline section nav drops to a horizontally scrollable second row beneath the
  bar (scrollbar hidden, links `shrink-0`). The inline nav returns only at `lg` — the bar cannot hold
  wordmark + links + status pill + identity + sign-out any earlier, and a nav link that overlaps the
  identity block silently swallows a destination.
- **Identity block:** the initials avatar is the constant; the name/email text beside it appears only
  where there's room — below `sm` (no avatar rendered) and again at `xl`. The avatar sits neutral at
  rest (`line-2` border, `surface-2` fill, `ink-2` initials) and takes red only on hover, so a
  signed-in-unregistered view doesn't spend a third red (The One Red Rule).

### Modals / Dialogs
- **Shell:** recessed `surface-3` (`#0e0f12`) panel, `line-2` hairline, 6px radius, 480px max width,
  capped at `calc(100vw - 32px)`. The only surface allowed a drop shadow (Overlay, see Elevation).
- **Crown:** a 4px `brand → brand-3` gradient rule across the top edge — the modal's one red spend,
  which is why the confirm button is the *only* other red in the dialog.
- **Backdrop:** near-opaque void (`rgba(4,5,6,0.78)`) with a 3px blur. The blur is functional
  (dismissing the board behind a deadline-critical decision), not decorative glassmorphism.
- **Footer:** actions sit on a darker plinth (`#0b0c0f`) above a `line` divider — cancel as a ghost
  button, confirm filling the remaining width. Disabled confirm goes desaturated red (`#3a1614`) at
  60% opacity, never gray: the action stays recognizable while it's unavailable.

### Data Rows (calendar + leaderboard)
The row is this product's real workhorse — more screens are rows than are cards.
- **Structure:** a fixed-column grid at `sm`+ (rank / name / metrics), reflowing to a stacked card
  below it. Rows separate with a `line` bottom border, never with gaps or shadows.
- **Hover:** background lifts to `surface-2` (or `brand/[0.12]` on a live row); no transform, no
  scale — the row is a target, not a toy.
- **Every row is a door, and says where it goes.** A row-level link carries a quiet destination
  label ("Set lineup →", "View results →", "View standings →") in `muted`, brightening to `ink-2`
  with the row. Mystery-meat rows — clickable with no stated destination — are forbidden.
- **Receding a row:** archived/finalized rows step the title to `ink-2` and drop the pill *fill*
  (border-only). Never `opacity` (The Contrast Floor Rule).
- **The "you" row:** the Broadcast Slash goes red, a solid `YOU` chip follows the team name, and the
  row takes a `brand/14` fill plus a full `brand/40` hairline drawn as an *inset* ring (so it gains an
  edge without shifting a pixel). Position and mark, never color alone. The two washes are the forms
  the One Red Rule sanctions, so the row still spends no solid red. Hover on a linked "you" row goes
  to `brand/20` — never to `surface-2`, which would erase the identity on the way to clicking it.
  The earlier `brand/7` wash measured 1.02:1 against the surface and was invisible in practice; 14%
  is the floor for a mark a player is meant to find in a 65-row board.

### Signature — The Position Bug

The standings answer to "where do I place?", named for the broadcast bug it behaves like. A 52px strip
above the board carrying the viewer's rank · team · points · movement, `sticky top-0` (`z-30`; overlays
stay at `z-50`) so it follows the player down a long table.

- **It rides the board's own grid.** Same columns (`64px 1fr 110px 90px`, or the 5-column private-league
  variant), same 18px gutters, same rank and points type as a row — so its figures align to the digit
  with the table beneath it and it reads as *your row lifted out*, not a separate widget. The board's
  Rounds column becomes the destination label ("JUMP →"), which is how it satisfies the every-row-says-
  where-it-goes rule. If the table's columns ever change, the bug's change with them or it is broken.
- **It retires when the real row is on screen.** An IntersectionObserver on the row fades it out (200ms,
  `opacity` + `translate`, `inert` while hidden); a 1px sentinel supplies the pinned signal, because
  retiring while still in normal flow would leave a 52px hole. A proxy for something already visible is
  clutter. Default state is *visible* — the observer only ever hides it, so a headless or backgrounded
  renderer fails safe rather than shipping a blank strip.
- **It is not red.** The bug is neither the primary action nor the live state: `surface-2` fill,
  `brand/40` hairline, ink numerals, red slash and `YOU` chip carried over from the row. It takes the
  Popover shadow only while pinned — the one case where in-page chrome genuinely floats (see Elevation).
- **Only the positional shape is sticky.** The two notice shapes — registered-but-unscored, and signed-in-
  but-unregistered — are static: a strip earns the right to follow you by having a position to track, and
  a permanently pinned notice is a nag. Signed-out visitors and empty boards get nothing at all.
- **Jumping moves focus, not just the viewport.** `scrollIntoView({block:'center'})` plus `focus()` on the
  row, so keyboard and screen-reader users land there too; the row flashes from `brand/42` back to its
  resting `brand/14`. Under reduced motion the scroll is instant and the flash collapses — the row's
  persistent focus outline is what marks the arrival instead.

### Signature — The Broadcast Slash
A skewed red bar (`background: brand; transform: skewX(-14deg)`) used as a section/leading accent and
as the leading mark on every leaderboard row (`line-3` normally, `brand` for the signed-in player) —
the angular motion mark of broadcast motorsport graphics. Use it as deliberate punctuation, not on
every heading.

### Signature — The Wordmark
`ENDURANCE` in `ink` + `FANTASY` in `brand`, set solid (no space) in Saira Semi Condensed 800 at
21px, tight tracking. The color break *is* the logotype — there is no mark, no icon, no lockup
variant. Never re-color the halves, never letterspace it, never set it in the body face.

## 6. Do's and Don'ts

### Do:
- **Do** set every comparable number (position, price, points, delta) in Spline Sans Mono, tabular —
  columns align to the digit (The Tabular-Numeral Rule).
- **Do** keep Endurance red to ≤10% of any screen: the primary action, the live state, the nav edge
  (The One Red Rule).
- **Do** reserve GTP/LMP2/GTD PRO/GTD colors strictly for racing-class wayfinding, and always pair
  class/status color with text, icon, or position so it survives color-blindness.
- **Do** convey depth with the tonal surface ramp + lightening hairline borders; keep in-page
  surfaces flat (The Flat-Void Rule).
- **Do** lead with breathing room — the premium register comes from generous gutters and clear
  hierarchy, not added ornament.
- **Do** name the destination of every clickable row ("Set lineup →"), quiet at rest and brightening
  with the row. A player under a lock deadline should never have to guess where a row goes.
- **Do** floor de-emphasised text at `muted` (`#8a8f98`) — including placeholders, counters, and
  footnotes (The Contrast Floor Rule).
- **Do** size type in fixed px with breakpoint steps (The Fixed-Step Rule).

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
- **Don't** fade an element with `opacity` to push it back — it stacks on already-muted micro-copy
  and breaks AA. Recede with tokens (`ink-2` title, unfilled pills).
- **Don't** put `muted-2` (`#5c626b`) on anything a player has to read — it is a fill and stroke
  color, not an ink.
- **Don't** use `clamp()` or viewport-scaled type. Fixed sizes, stepped at breakpoints.
- **Don't** ship a row that's clickable but silent about its destination.
