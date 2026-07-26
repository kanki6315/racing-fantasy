---
target: apps/web/src/routes/Pick.tsx
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-26T14-05-45Z
slug: src-routes-pick-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Budget, pills, countdown and Save now never leave the screen — but the page still has **zero** live regions, so save success/failure is silent |
| 2 | Match System / Real World | 4 | Domain voice is fluent and consistent end to end; only "PICKS NOT OPEN" sits outside the calendar/dashboard lifecycle vocabulary |
| 3 | User Control and Freedom | 3 | Remove, toggle-off, filter reset all present; still no unsaved-changes guard and no undo after save |
| 4 | Consistency and Standards | 3 | Pointer-sized chips, line tokens and row hover now match the system; the header wraps to two rows at 1280–1400 but one row at 1440 |
| 5 | Error Prevention | 3 | The block is always named; over-limit and unfilled pills are distinct — the `addPick` race still admits an impossible lineup |
| 6 | Recognition Rather Than Recall | 3 | Excellent at `lg`; on a phone the board's own filters still scroll away and only 2.6 lineup rows fit |
| 7 | Flexibility and Efficiency | 3 | Search, class filter, 3-key sort, empty-slot jump, filter reset; no keyboard accelerators |
| 8 | Aesthetic and Minimalist Design | 3 | Hierarchy and the nested card fixed; chrome is 36% of an iPhone SE and the header doubles at common laptop widths |
| 9 | Error Recovery | 3 | Six rewritten, client-owned messages that each name the next step; no live region, no retry affordance |
| 10 | Help and Documentation | 3 | Bonus hints, "Optional", blocked reason and absolute lock time are real contextual help; nothing explains scoring |
| **Total** | | **31/40** | **Good — solid foundation, address the weak areas** |

## Anti-Patterns Verdict

**Does this look AI-generated? Still no** — and less so than before. The fixes were reasoned from the
project's own named rules rather than applied as generic polish: the nested card became `divide-y`,
the chips took the documented `pointer-coarse` variant, the pill scroller borrowed the standings
filter-row idiom *with* its edge-mask obligation, and the lock time was lifted into a shared module
rather than duplicated. That's a system being applied, not decorated.

**Deterministic scan (CLI):** clean. `[]`, exit 0, across `Pick.tsx`, `RootLayout.tsx`,
`datetime.ts`, `modifierMeta.ts`.

**Deterministic scan (in-browser):** **51 findings, up from 44.** The rise is not drift — it is new
rules firing on code added in the last two passes. Two of them are real:

- **`cramped-padding` ×6 (new, real).** `flex h-9 items-center px-3` with no vertical padding, on
  the class filters, sort chips, bonus targets and the empty-state reset. I introduced this when I
  swapped `py-[6px]` for a fixed height to get `pointer-coarse:h-11`. It looks right at default
  size, but a fixed-height box with zero vertical padding clips instead of growing when text scales
  — WCAG 1.4.4 (200% resize) territory.
- **`layout-transition` ×1 (new, real).** `transition-[width]` on the budget bar — mine. The
  skill's own rule is not to animate layout properties; this triggers layout on every frame of every
  pick. `transform: scaleX()` does the same thing on the compositor.
- **`tiny-text` ×~30 (carried, real).** Still the compact driver-surname list at 11px in the *body*
  face, below DESIGN.md's own 13px body spec. Untouched by either pass.
- **`all-caps-body` ×~8** — brand-justified (DESIGN.md mandates uppercase display for names).
- **`wide-tracking` ×1** — the absolute lock time I added, `tracking-[0.06em]` mono. **False
  positive**; the system's Label spec is tracked mono at +0.08em.
- **`nested-cards` ×2** — down from 3. The real one (bonus panel) is fixed; the two remaining are
  the lock pill and requirement pills inside the header band. **False positives.**
- **`repeating-stripes-gradient` on `body`** — **false positive**, as before.

**Visual overlays:** injection succeeded and the detector ran in the page — 101
`impeccable-overlay` / `impeccable-label` nodes are live in the browser tab. They did not read
clearly in the downscaled screenshot capture, so treat the console/DOM counts above as the reliable
signal rather than anything visible in a screenshot.

## Overall Impression

The P0 is genuinely gone. The page is 900px tall in a 900px viewport with exactly one scroll
container, and dragging the board to its last row leaves the cap, the class pills, the countdown and
Save all still on screen. On a phone Save sits in the thumb zone instead of 2,982px above it. That
was the whole ballgame and it landed.

What's left splits cleanly in two. **One old debt:** the screen still cannot speak — zero live
regions, so the moment of commitment is silent to a screen reader, and the `addPick` race still
admits a lineup that can't exist. **One new bill:** compacting the header bought density that a
short or mid-width viewport now pays for. At 1280 the band doubles to 128px and the primary action
drops to a second row; on an iPhone SE the pinned chrome is 36% of the screen.

The single biggest opportunity is no longer structural. It's that a deadline screen which now shows
everything still *announces* nothing.

## What's Working

1. **The workspace holds under load.** Measured: `documentElement.scrollHeight` 900 against a 900px
   viewport, one scroller (3323/560), and with that scroller at its end the budget, pills, countdown
   and Save all still measured on-screen. The `min-h-0` that makes it work is the non-obvious part
   and it's commented as such.
2. **The screen now names its own obstacle.** `blockedReason` turns a dead button into
   "$7.0M over the cap — drop or swap a pick" or "Add a GTP pick", in the same words as the empty
   slot prompts and the save errors. One vocabulary, three surfaces.
3. **Copy stopped leaking implementation.** "composition is invalid" named a database table;
   "$-3.0M left" was a raw float; two of six errors spoke the API's voice. All gone, and the success
   message now answers the question players actually have ("can I still change this?").

## Priority Issues

### [P1] The screen still can't speak — zero live regions
**Why it matters:** `[aria-live]`, `[role=status]`, `[role=alert]`: **0 matches on the page.** A
screen-reader user presses Save on a deadline screen and hears nothing at all — not success, not
failure, not the lock landing mid-save. Every budget and composition change is likewise silent. The
irony is sharp now: the copy pass wrote six precise error messages and gave the pills full
descriptive labels, and none of it is announced when it changes. DESIGN.md already requires this of
the *standings* board ("Every board names itself out loud"); the higher-stakes screen has nothing.
**Fix:** One permanently-mounted `role="status" aria-live="polite"` wrapping the save-feedback slot
(mounted across all states — a region inserted at the same moment its text appears is unreliably
announced). A second polite region for budget/composition changes, debounced.
**Suggested command:** `/impeccable harden`

### [P1] `addPick` still admits an impossible lineup
**Why it matters:** Reproduced this run: three clicks in one tick on a max-1 class →
**"GTP: 3 picked of 1, 2 too many"**, $33.5M over a $35M cap. `addPick` checks capacity against
`selected`, a `useMemo` over `main`, which is stale across clicks batched into a single React
commit. Save correctly stays disabled so nothing invalid reaches the server, but the UI sits in a
state the rules forbid until the user manually unpicks. The clarify pass made this *legible*
("2 too many") without making it impossible — arguably worse, since the screen now confidently
describes a state that shouldn't exist.
**Fix:** Do the capacity check inside the `setMain` updater, where `prev` is authoritative, instead
of against the derived `selected`.
**Suggested command:** `/impeccable harden`

### [P2] The header doubles at the widths most laptops use
**Why it matters:** Measured at 1280×620: the budget+pills row is greedy (`lg:flex-1`, 946px wide),
so the 490px lock+save group cannot fit and wraps. The band goes **70px → 128px (21% of a short
viewport)** and the primary action lands on a second row, right-aligned and visually detached from
the title it belongs to. At 1440 everything fits on one line — so the layout I verified is the
lucky width, and 1280–1400 (the most common laptop band) is the one that pays.
**Fix:** Drop `lg:flex-1` from the budget row so it sizes to content, or give the blocked-reason
text a narrower cap and let the lock+save group shrink. Verify at 1280, 1366 and 1440, not just one.
**Suggested command:** `/impeccable adapt`

### [P2] Fixed-height chips clip instead of growing
**Why it matters:** Six controls — class filters, sort chips, bonus targets, the empty-state reset
— are `h-9` with `px-3` and **zero vertical padding**, which the detector flagged independently. I
introduced this converting `py-[6px]` to a fixed height to get `pointer-coarse:h-11`. At default
type it looks correct; at 200% text zoom or a raised base font size the label clips against a box
that can't grow. That's the accessibility guarantee (WCAG 1.4.4) traded away for the touch-target
fix, which is a poor swap since both were achievable.
**Fix:** `min-h-9` + real vertical padding instead of `h-9`, keeping `pointer-coarse:min-h-11`.
**Suggested command:** `/impeccable adapt`

### [P2] The lineup tab can't show the lineup
**Why it matters:** Pit lane rows measure **142–168px** on a phone. On an iPhone SE the content
window between the pinned chrome is 430px, so **2.6 rows fit**; a four-pick lineup is 1,061px of
scrolling. "Your Lineup" exists to answer "what have I got?" at a glance and on the smallest common
phone it can't. Chrome is 36% of that viewport (147 top + 91 bottom of 667) — the bottom bar grows
whenever a blocked reason is present.
**Fix:** A denser mobile variant of the pick row — the board's compact driver treatment (avatar
stack + surname list on one line) instead of the full stacked chips, and the thumbnail sized down or
dropped below `sm`. Target ~96px per row, which fits four.
**Suggested command:** `/impeccable adapt`

## Persona Red Flags

**Casey (Distracted Mobile User)** — the round-1 blocker is gone: Save is pinned in the thumb zone
and reachable from the board's last row. What's left is density. On an SE, 36% of the screen is
chrome and Casey sees 2.6 of their own four picks. The board's search and class filters still scroll
away, so re-filtering means scrolling back up past the whole list.

**Sam (Accessibility-Dependent)** — headings went 1 → 4, every control has a real label, hit areas
are 44px, contrast measured 5.7–10 everywhere. Then Sam presses Save and the app says nothing. The
empty-state "Show all teams" button also unmounts itself on click and drops focus to `<body>`,
dumping a keyboard user at the top of the document. And the fixed-height chips clip Sam's enlarged
text.

**Riley (Deliberate Stress Tester)** — three fast clicks still produce "3 picked of 1". Navigating
away from a half-built lineup still discards it silently. Riley will also notice that the requirement
pill carries both `title` and `aria-label` with near-identical text, which some screen readers
announce twice, and that `title` never fires on touch anyway.

## Minor Observations

- **Duplicate accessible text on the pills.** `title` and `aria-label` say nearly the same thing;
  drop the `title`.
- **Focus is lost after the empty-state reset** — the button removes itself. Move focus to the
  search input.
- **The countdown re-renders 1,296 nodes every second.** `useNow(1000)` sits at the `Pick` root, so
  all 54 board rows re-render once a second for the life of the page. Isolate the countdown into its
  own component so the tick only re-renders the pill.
- **`transition-[width]` on the budget bar** animates a layout property. `scaleX` is free.
- **"PICKS NOT OPEN" is a third vocabulary** for a stage the calendar calls "COMING SOON" and the
  dashboard calls "Picks Open". DESIGN.md's rule is that the two dialects must never disagree about
  a stage's name; this is a third dialect on a third surface.
- **`class.color` still has no collision guard** — dev data renders GTP as `#ffffff` and GTD PRO as
  `#ff0000`, and nothing stops an operator doing that in production.

## Questions to Consider

- The screen now shows everything and announces nothing. What would it feel like if the budget spoke
  the way the standings board does — one polite region that says "GTD PRO added, $5.5M left"?
- Two passes made the header denser and a third viewport paid for it each time. What if the band
  were designed at 1280 first, where most players actually are, instead of at 1440?
- The pit lane row was designed for a 560px desktop column and reused verbatim on a 375px phone.
  What does a pick row look like if the phone is the primary case?
- `addPick` has now survived two passes because it's never the thing being worked on. What's the
  cost of it finally being wrong in front of a player at the lock?
