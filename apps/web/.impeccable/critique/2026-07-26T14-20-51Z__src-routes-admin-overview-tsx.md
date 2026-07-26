---
target: main admin dashboard view (/admin Overview)
total_score: 25
p0_count: 1
p1_count: 2
timestamp: 2026-07-26T14-20-51Z
slug: src-routes-admin-overview-tsx
---
Target: `/admin` -> `src/routes/admin/Overview.tsx` inside `src/admin/AdminLayout.tsx`. Inspected live at `localhost:5199/admin` as `dev-admin`, at 1440x900, against the real local API, across four rounds in three championships.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Counts derived from real data, skeletons, naming error band, live health probe. But Catalog/Entries/Sessions have no denominator, so teal "done" only means "> 0". |
| 2 | Match System / Real World | 3 | Fluent operator language, round named once. But post-lock copy is present-tense about a past failure, and 41-char round names render ALL CAPS. |
| 3 | User Control and Freedom | 1 | Unchanged. No sign-out, no route back to the player app, wordmark still a div. Weakest heuristic. |
| 4 | Consistency and Standards | 3 | Rail borrows nav active language; shared button class; Catalog tabs joined URL-state convention. But 10 red marks breaks One Red Rule; CTA 36px vs documented 44px. |
| 5 | Error Prevention | 2 | Prevents the two errors it used to cause and surfaces the silent ruleset failure - then manufactures a new one by directing work on a round locked 15 days ago. |
| 6 | Recognition Rather Than Recall | 3 | Six true counts, destinations named, state in accessible names. But names the count not the instance: "22 cars" - which 22? |
| 7 | Flexibility and Efficiency | 2 | Seven interactive elements (was zero), deep links to every step. No keyboard shortcuts, no cross-championship view. |
| 8 | Aesthetic and Minimalist Design | 3 | Real composition and hierarchy. But 58% of viewport empty; palette runs hot at 10 red marks + 5 saturated teal rings. |
| 9 | Error Recovery | 3 | Was zero. Band names failed call, Retry verified against a real 403. Gap: hung request shows neither skeleton nor error. |
| 10 | Help and Documentation | 2 | Consequence sentences are genuine inline help. No glossary for "ruleset", no docs, no tooltips. |
| **Total** | | **25/40** | **Acceptable - accurate and navigable; one severe framing bug and three untouched heuristics** |

## Anti-Patterns Verdict

**LLM assessment.** No longer reads as a mockup. Counts are real, the sequence is a sequence, the hero commits to one sentence and one action. Remaining tells are tuning-shaped, not slop-shaped: the state palette was designed when only one step could be non-done; now that states are accurate, three steps are legitimately active at once and the screen speckles red.

**Deterministic scan.** detect.mjs over five admin source files: clean, exit 0, [].

**In-page detector: 18 findings**, a real divergence from the source scan.
- all-caps-body x12 - GENUINE. `uppercase` on the select cascades to every option; round names render as 35-41 chars of all-caps. Confirmed via computed style.
- ai-color-palette x5 - HALF FALSE POSITIVE. Flags "cyan neon on dark" on teal step markers (#2dd4bf), a committed DESIGN.md token. But five at once is a real density signal.
- repeating-stripes-gradient x1 - FALSE POSITIVE. Verified background-image: none on body.

**Visual overlays.** Injection succeeded, 35 overlay nodes rendered; live server on 8400 stopped and port confirmed free.

## Overall Impression

The screen is honest and it works: one sentence for "what next", every number derived, shell no longer overflows from 390 to 1440.

Then WeatherTech RD 07 - locked 15 days ago, 6/6 results imported, 41/41 rosters scored - renders: "NEXT UP - STEP 3 OF 6 - PRICES / 22 CARS STILL NEED A PRICE / Players can't build a roster until every car in the round has a price / [SET PRICES]". The round is over. The action does nothing. The biggest opportunity: false state was replaced with false urgency. The sequence design assumes the deadline is always ahead.

## What's Working

- Counts are load-bearing and true. Session status as the results signal needed no new endpoint and turns two hardcoded strings into "6/6 sessions". Prices universe matches the board exactly (board header 54/55, Overview 54/55).
- The blocked state earns its place. "Scoring would post zeroes - no active race ruleset" is the only surface that can see the documented silent-failure mode, and only fires for sources the round can score (race-only MX-5 correctly not flagged).
- The shell reflow is structural, not scaled. 314px overflow at 1024 -> zero, via selectors-to-own-row and rail-to-strip, both borrowed from the player nav. Edge fades track scroll; active link centres on deep-link.

## Priority Issues

### [P0] A finished round is presented as urgent unfinished work
`nextUp` is `steps.find(s => s.state !== 'done')` - pure sequence order, no reference to the lock. On WeatherTech RD 07 it surfaces Prices as hero 15 days post-deadline, present tense, with a no-op primary action, while Results 6/6 and Scoring 41/41 sit quietly below.
Why it matters: the original P0 in new clothes. The screen again directs the operator to do something pointless, and the contradiction is visible in one glance. Fix: the pipeline changes meaning at the lock. Post-lock, setup steps are history - an incomplete one becomes a postmortem ("locked with 22 of 55 cars unpriced"), not a CTA, and the hero belongs to what is still live. Gate nextUp on actionability; switch copy to past tense once locked.
Suggested command: /impeccable harden

### [P1] Red stopped meaning "the one thing"
10 brand-red marks measured on one 1440 screen: header slash, CTA fill, rail inset rule, eyebrow text, topbar LOCKED, and three red step rings (03, 05, 06). Cause is structural: `active` maps to brand red, and before harden only one step could be non-done.
Fix: `active` takes a neutral or warn tone; brand reserved for the current step and the primary action.
Suggested command: /impeccable colorize

### [P1] There is still no way out of the console
No sign-out, no link back to the player app, wordmark is a div. Unchanged across three passes because each was scoped to the page, not the chrome. Governance screens (GDPR export/delete) are two clicks away. Lowest score on the board.
Suggested command: /impeccable craft

### [P2] Round names render as 41 characters of all-caps
Detector catch, confirmed by computed style: uppercase on the select cascades into every option. Twelve instances across three selectors. All-caps costs word-shape recognition on the longest strings in the console.
Suggested command: /impeccable typeset

### [P2] It names the count but never the instance
"22 cars still need a price." Which 22? The operator carries a number to the Prices board and hunts 55 rows. The one Memory Bridge left in an otherwise low-load screen.
Suggested command: /impeccable craft

## Persona Red Flags

**Alex (Impatient Power User)** - target persona.
- No keyboard shortcuts. Round switching is mouse -> select -> scroll long all-caps names.
- Cross-championship question still unanswerable: six manual champ switches. The screen titled Overview overviews one round.
- On a finished round he is told to set prices, sees nothing change, stops reading the hero.

**Sam (Accessibility-Dependent)**
- Improved: 7 focusables in main (was 0), focus-visible ring confirmed 2px #ff5d5d, every rail link named with state ("Prices - 0 of 44 cars priced, not started"). Headings h1 + two h2. Contrast floor 4.23:1, only item under 4.5 is the 21px wordmark (passes as large text).
- Remaining: hero swaps content on data change with no live region. Current step marked by aria-current plus colour only.

**The League Operator** (project-specific)
- The P0 targets them: six championships, most rounds opened are historical. The screen is most wrong where they spend most time.
- A round that locked with 22 cars unpriced is a real incident; the console cannot say "this went wrong" as distinct from "this is pending".
- Session degradation: when the dev cookie flipped to a non-admin mid-visit, the console kept rendering chrome because RequireAdmin reads cached auth state. Server correctly 403'd; honesty issue, not security.

## Minor Observations

- "-" as a tally tells the operator nothing; the real string exists only in the aria-label.
- "LOCKED" appears twice ~70px apart (topbar and page header). The duplicated countdown was fixed; the duplicated word was not.
- 58% of a 900px viewport is empty below the rail.
- Three of six steps show teal "done" when they only mean "> 0".
- CTA is 36px vs DESIGN.md's 44px spec - deliberate (matches other admin buttons) but a documented deviation.
- "STEP 3 OF 6" restates what a 6-cell rail 40px below already shows.

## Questions to Consider

- If most rounds an operator opens are finished, is "what's next" the right hero - or is the default state a result, with the to-do hero appearing only pre-lock?
- What would this look like if the Overview were genuinely an overview: six championships, one row each, blocking step named per row?
- Should the pipeline be drawn against the lock - steps before the line, steps after - rather than as a flat sequence?
