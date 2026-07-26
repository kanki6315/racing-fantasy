---
target: apps/web/src/routes/Pick.tsx
total_score: 24
p0_count: 1
p1_count: 5
timestamp: 2026-07-26T01-34-32Z
slug: src-routes-pick-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Budget bar, requirement pills and Save all scroll out of view while picking; no aria-live anywhere |
| 2 | Match System / Real World | 3 | Strong domain voice ("Pit Lane", class rails, LOCKS) — but "$-3.0M left" and a BONUS pill that mimics a requirement |
| 3 | User Control and Freedom | 3 | Remove/toggle-off everywhere; no unsaved-changes guard, no reset |
| 4 | Consistency and Standards | 2 | 32px filter chips break DESIGN.md's own `pointer-coarse:h-11` rule; `border-surface-2` as a border; no row hover |
| 5 | Error Prevention | 2 | Save disabled with no stated reason; over-limit and unfilled pills render identically |
| 6 | Recognition Rather Than Recall | 2 | The whole recognition apparatus leaves the screen exactly when the player is choosing |
| 7 | Flexibility and Efficiency | 3 | Search + class filter + 3-key sort + empty-slot→filter jump; no keyboard accelerators |
| 8 | Aesthetic and Minimalist Design | 3 | Confident, on-brand — but the header carries 5 info groups and 61% of desktop width goes dead below the fold |
| 9 | Error Recovery | 2 | The two likeliest errors (cap, composition) are unreachable — client disables first, so the copy never shows |
| 10 | Help and Documentation | 2 | Bonus hints are good; nothing explains scoring, the cap, or why Save is off |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Does this look AI-generated? No.** This is committed, specific work with a real point of view. The
broadcast-timing register is executed, not gestured at: mono numerals, class-color wayfinding, the
skewed slash, tight corners, one red. Code comments show prior fixes reasoning from named rules
(the side-stripe removed, the permanent red cap bar replaced, teal-for-confirmed). None of the
absolute bans are present.

The failure mode here is the *product* one — not genericness, but **omission under load**. The
screen is beautiful at scroll 0 and abandons the player at scroll 1500.

**Deterministic scan (CLI):** clean. `detect.mjs` on `src/routes/Pick.tsx`, the supporting
components, `index.css`, and the whole `src/routes` tree all returned `[]`, exit 0.

**Deterministic scan (in-browser, injected on the live board):** 44 findings.
- **~30 × `tiny-text`** — all the same node: `span.truncate.font-sans.text-[11px].text-muted`, the
  compact driver-surname list on every board row. **Real.** 11px in the *body* face sits below
  DESIGN.md's own body spec (13px); the system sanctions 10px only for the mono micro-label.
- **~8 × `all-caps-body`** — board row team names, uppercase at 32–46 chars. **Brand-justified**
  (DESIGN.md mandates uppercase display for names), but it compounds the truncation issue below:
  uppercase runs ~10% wider, in the narrowest box on the screen.
- **3 × `nested-cards`** — two are false positives (pills inside the header band). The third is
  **real**: the per-bonus block `rounded-[4px] border border-line-2 bg-surface-2 p-3` sits inside
  the Bonuses panel `rounded-[4px] border border-line bg-surface-3 p-4`. Bordered box in a bordered
  box.
- **1 × `ai-color-palette`** ("cyan neon on dark", `span.text-success`) — **false positive**.
  That's `#2dd4bf`, DESIGN.md's Success Teal, deliberately offset from GTD green.
- **1 × `repeating-stripes-gradient`** on `body` — **false positive**; no such gradient exists.

**Visual overlays:** injection succeeded and the detector ran in the page, but the Browser pane was
hidden for the run, so screenshot capture returned blank frames and **no user-visible overlay is
available**. All findings below were instead verified by direct DOM measurement in the live page.

## Overall Impression

The pit-lane metaphor is the best idea in this app. A class rail with your car slotted into it,
empty slots that ask to be filled and then take you to exactly the right filtered board — that's a
genuinely good interaction model, and it's better than what most fantasy products ship.

Then you scroll, and it falls apart. **The board's `overflow-y-auto` creates no scroll container**
— `flex-1 overflow-y-auto` inside an unbounded flex parent means `scrollHeight === clientHeight`,
and the page has zero scrollers. So the two panels that were designed as independently-scrolling
columns are actually one 3,783px document. Everything that tells a player what's happening — the
cap bar, the requirement pills, the lock countdown, the Save button, and their own lineup — leaves
the screen the moment they start picking. On a phone, the end of the board is **2,982px below the
Save button**.

That single CSS fact is the biggest opportunity on the screen. Fix the scroll containment and half
the heuristic scores move.

## What's Working

1. **The empty slot is a real control.** "Add a GTP pick" sets the board's class filter *and* flips
   the mobile tab. Verified: clicking it left `aria-pressed=true` on both "Add Picks" and "GTP",
   with 11 rows showing. That's the pit lane and the board understanding they're one tool.
2. **The named color rules held under pressure.** Every muted text sample measured 5.4–6.2:1 — the
   Contrast Floor Rule is real here, not aspirational. Confirmed-is-teal survived: picked rows are
   `success`, and Save keeps the screen's one solid red.
3. **Series-aware defaults.** Sort defaults to race number for a team series and price-descending
   for a driver series; the "Number" key disappears entirely when drivers have no numbers, and the
   name sort strips the `#31` prefix so it orders by actual team name. That's someone thinking
   about two different products sharing one screen.

## Priority Issues

### [P0] The board doesn't scroll — the page does, and it takes every status signal with it
**Why it matters:** This is the deadline screen. PRODUCT.md's design principle is "broadcast clarity
under deadline: state must be unmistakable at a glance." Measured on a 1440px desktop viewport at
`scrollY 1500`: `elementFromPoint(400,300)` and `(700,500)` both return the bare wrapper — the left
**880px (61% of the width) is empty void**, while the only actionable content is squeezed into
560px on the right. The cap bar, the 5 requirement pills, the countdown and Save are all gone. A
player adds a $12M car and gets no feedback that they just went over the cap. On mobile it's worse:
scrolled to the end of the board, Save's `getBoundingClientRect().top` is **-2982.5**.
**Fix:** Give the two columns real height containment (`h-[calc(100vh-var(--header))] overflow-hidden`
on the row, `overflow-y-auto` on each column) so the board scrolls inside its panel and the header
stays put. Make the header band `sticky top-0` as the belt-and-braces version. On mobile, pull Save
plus the remaining-budget figure into a sticky bottom bar — that's the thumb zone, and it's where a
deadline action belongs.
**Suggested command:** `/impeccable layout`

### [P1] Save goes dead and never says why
**Why it matters:** `canSave` already knows the exact reason — `locked`, `compositionOk`,
`remaining >= 0`. It tells the player none of them. Verified state: composition valid at 1/1 across
all four classes, spent $38.0M against a $35.0M cap, button disabled, and the only cue is a 12px
"$-3.0M left" hundreds of pixels away in a header that may be off-screen. Worse, the six typed
error messages (`cap_exceeded`, `composition`, …) are **unreachable in practice** — the client
disables the button before any request can fail, so that carefully-written copy never renders.
**Fix:** Put one line next to the button stating the blocking condition: "$3.0M over the cap" /
"Add a GTD pick" / "Picks locked". Reuse the existing error strings so there's one vocabulary.
Move that copy from unreachable server-error branches into a live `blockedReason` derivation.
**Suggested command:** `/impeccable clarify`

### [P1] "$-11.0M left"
**Why it matters:** `${remaining.toFixed(1)}M left` puts the minus sign inside the currency and
keeps the word "left". Nobody has negative eleven million dollars left. DESIGN.md's voice is
"confident and economical, like broadcast lower-thirds" — this is a raw float through a template,
and it appears at the exact moment the player most needs to understand their position.
**Fix:** Branch the copy: `remaining >= 0 ? "$X left" : "$X over"`, with the absolute value.
**Suggested command:** `/impeccable clarify`

### [P1] Board names truncate at the character that distinguishes them
**Why it matters:** All 8 sampled names clip on mobile. "#3 Corvette Racing by Pratt Miller
Motorsports" needs 351px and gets **119px — 34% visible**. On the board it renders as "#3 CORVETTE
RACING BY PRATT MILLER MOT…", and the row above it is "#4 CORVETTE RACING BY PRATT MILLER MOT…".
Two different cars, two different prices, and the only distinguishing glyph is the race number.
The name is what the player is scanning for. The pit lane **already fixed exactly this** — it uses
`line-clamp-2` + `overflow-wrap:anywhere` and carries a code comment naming this very entrant — but
the board, where the choice is actually made, still hard-truncates.
**Fix:** Apply the pit lane's two-line treatment to board rows. Reclaim the width: the 56px
thumbnail is decorative here (it's a placeholder whenever `VITE_IMAGE_BASE_URL` is unset), and the
uppercase display face costs ~10% more width than sentence case in the tightest box on the screen.
**Suggested command:** `/impeccable adapt`

### [P1] Touch targets are below minimum on the app's primary mobile surface
**Why it matters:** PRODUCT.md names race-weekend players as "often mobile, often time-pressured"
and calls touch targets "accessibility, not just polish." Measured at 375×812: the `+`/`−` add
button is **28×28** and there are **54 of them** — the single most-repeated action on the screen.
Every class filter, sort chip, and bonus target button is **32px**. Save is 40px against a 44px
system spec. DESIGN.md already legislates this ("`h-9` for a fine pointer, `h-11` under
`@media (pointer: coarse)`") and `index.css` already registers the `pointer-coarse` variant — the
standings filters use it. This screen just doesn't.
**Fix:** `pointer-coarse:h-11` on every chip; grow the add button to 44px on coarse pointers, or
make the whole row the tap target with the button as its visual affordance.
**Suggested command:** `/impeccable adapt`

### [P1] Nothing is announced — no live regions, no headings
**Why it matters:** The page has **zero** `aria-live` / `role="status"` / `role="alert"` nodes. The
"Lineup saved." banner is a plain div, so a screen-reader user presses Save and hears nothing at
all — on the one screen where "did it save before the lock?" is the entire question. Every budget
and composition change is likewise silent. And the page has exactly **one heading** (the `h1`,
which is the round name set at 11px muted); "Your Pit Lane", "Teams" and "Bonuses" are all `div`s,
so heading navigation offers no way through a two-panel task screen. DESIGN.md requires the
*standings* board to name itself out loud via a polite live region; the higher-stakes screen has
nothing. The success banner also inserts a row and shifts the layout.
**Fix:** Wrap the save-feedback slot in a permanently-mounted `role="status" aria-live="polite"`
(mounted across all states, per the standings precedent). Add a second polite region for
budget/composition. Promote the three panel titles to real `h2`s.
**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Casey (Distracted Mobile User)** — the primary persona for this screen, per PRODUCT.md.
The header band eats **225px of an 812px viewport (28%)** before any content; the board's search
field doesn't appear until y=500. Every team name is truncated. The 54 add buttons are 28px. Having
scrolled 3,264px to pick a last car, Save is 2,982px back up the page with no sticky bar. Switching
from the board tab back to "Your Lineup" dumps them at y=767 in the middle of the lineup with no
context. Casey is doing this in a paddock queue with three minutes to the lock.

**Sam (Accessibility-Dependent)** — no live regions, so save success/failure is silent. One heading
on the whole page. Filter chips at 32px against a 44px target guideline. Save's disabled state
communicates its reason through a color-and-position cue (a small red figure elsewhere in the
header) with no programmatic association to the button. Positives, credited: contrast passes
everywhere measured, `:focus-visible` is global, `prefers-reduced-motion` is handled, and the add
buttons carry real `aria-label`s that change with state.

**Riley (Deliberate Stress Tester)** — clicked five add buttons in one tick and put **two picks in
a max-1 class** (GTD PRO 2/1). `addPick` checks capacity against `selected`, a `useMemo` over
`main`, which is stale across clicks batched into a single React commit. Save correctly stays
disabled so nothing invalid reaches the server, but the UI sits in an impossible state until the
user removes one. Riley also finds "$-11.0M left", and finds that navigating away from a
half-built lineup discards it with no warning.

## Minor Observations

- **The header inverts its own hierarchy.** The round name is the `h1` at 11px muted; the salary
  cap — a constant that never changes all weekend — is 20px bold mono directly beneath it. The cap
  is then printed three times in one band ($35.0M, "Spent $34.5M", "$0.5M left").
- **BONUS 0/1 wears the requirements' uniform.** It sits in the same pill row, same chrome, as four
  genuinely required class slots. A lineup saved cleanly at BONUS 0/1 — it's optional, and it's
  free upside (Double Points Team). Players will either read their lineup as incomplete or leave
  free points on the table. Distinguish optional from required.
- **Over-limit and unfilled pills are indistinguishable.** Both take the `#3a3f47` neutral border;
  only the numerals differ (2/1 vs 0/1). "You have too many" and "you have none yet" are opposite
  problems wearing the same chrome.
- **The countdown re-renders everything every second.** `useNow(1000)` sits at the `Pick` root, so
  all 54 board rows and their thumbnails re-render once a second for the life of the page.
- **Off-system details:** board rows separate with `border-b border-surface-2` — a *surface* token
  used as a border. Board rows have no hover state, though DESIGN.md specifies data rows lift to
  `surface-2`. The empty-slot jump lands the user at `scrollY 0`, ~500px above the rows it just
  filtered for them.
- **`class.color` has no collision guard.** The dev DB has GTP set to `#ffffff` and GTD PRO to
  `#ff0000`, which renders an "ADD A GTD PRO PICK" prompt in brand red competing with Save, and a
  GTP rail indistinguishable from `ink`. That's dev data, not the design — but nothing in the admin
  color field prevents an operator doing it in production, and DESIGN.md's Class-Color Reserve is
  written as a one-way rule (don't spend class colors elsewhere) without the converse.

## Questions to Consider

- If the pit lane and the board are one tool, why are they two scrolling regions in a single
  document? What would this feel like as a fixed two-pane workspace that never moves?
- The cap bar is the most important number on the screen and it's the first thing to leave it.
  What if the budget *were* the header — a thin persistent strip that's always true?
- Four required picks and one free bonus. Why does the free upside look like a fifth requirement,
  and why is it at the bottom of a column the player has to scroll past the board to reach?
- A player who has just built a lineup under a deadline has done the emotional work of the round.
  Right now the reward is a small green line that says "Lineup saved." What would the peak-end
  version of that moment look like?
