---
target: main admin dashboard view (/admin Overview)
total_score: 30
p0_count: 0
p1_count: 1
timestamp: 2026-07-26T15-16-14Z
slug: src-routes-admin-overview-tsx
---
Target: `/admin` -> `src/routes/admin/Overview.tsx` inside `src/admin/AdminLayout.tsx`. Inspected live at `localhost:5199/admin` as `dev-admin`, at 1440x900 and 390x844, against the real local API.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Lock-aware split reports a truth nothing else surfaces - that a round shipped incomplete - as distinct from work pending. Counts, skeletons, error band, health probe all real. |
| 2 | Match System / Real World | 3 | Tense correct post-lock. But "1 of 55 cars unpriced... so those were unpickable" is a plural mismatch, and one accessible name reads "4 classes set, set". |
| 3 | User Control and Freedom | 3 | Exit exists and works (verified 401 + redirect). Not higher: the session-ending control is a 27x18px target announced as "Sign". |
| 4 | Consistency and Standards | 3 | Red budget respected on a clean round (6 marks, all sanctioned). But `danger` and `brand-3` are the same hex; CTA still 36px vs documented 44px. |
| 5 | Error Prevention | 3 | No longer manufactures wasted work. Gap: the 24h lock band and the incompleteness are separate signals. |
| 6 | Recognition Rather Than Recall | 4 | Memory bridge gone: "#68 Car Blanche still needs a price" names the instance. Driver-mode shortfalls stay counted (documented limit). |
| 7 | Flexibility and Efficiency | 2 | Unchanged. No keyboard shortcuts, no cross-championship view. |
| 8 | Aesthetic and Minimalist Design | 3 | Palette retuned. But postmortem strip runs 130ch, 48% viewport empty, red climbs to 9 marks on a locked-incomplete round. |
| 9 | Error Recovery | 3 | Unchanged: band names failed call, Retry works. Hung request still shows neither. |
| 10 | Help and Documentation | 2 | Unchanged. Consequence sentences are real inline help; no glossary, no docs. |
| **Total** | | **30/40** | **Good - structural problems resolved; what's left is small, and most of it is mine** |

## Anti-Patterns Verdict

**LLM assessment.** No AI-slop tells. Composition is specific to the product's job, the sequence is a real sequence, palette is disciplined. What remains reads as unfinished detail work, not generated output.

**Deterministic scan.** detect.mjs over six source files: clean, exit 0, [].

**In-page detector: 5 findings** (was 18), and it caught a real one missed by review for the second run running.
- line-length x1 - GENUINE, NEW. The postmortem strip has max-width: none and runs 130ch; the hero below is capped at 68ch. Measured.
- ai-color-palette x3 (was 5) - teal step markers at #2dd4bf, a committed DESIGN.md token. Partial false positive; count fell because fewer steps are teal.
- repeating-stripes-gradient x1 - false positive for the third run running. body has background-image: none.

**Visual overlays.** Injection succeeded, overlays rendered; live server on 8400 stopped and port confirmed free.

## Overall Impression

Both structural failures are gone. The screen no longer misstates state, and no longer misstates urgency - a round that locked incomplete gets a past-tense report and a closed-out hero instead of a red button that does nothing. The composite case works: postmortem for what shipped broken AND a live hero for outstanding results, each in the right register.

What's left is a different category. Every P-item is a detail defect, four of five introduced by the last two passes, none blocking. The biggest remaining opportunity is not on the list: Flexibility has sat at 2/4 across all three critiques because the console answers "how is this round" when the operator asks "which of my six championships needs me".

## What's Working

- The lock-aware split is the right abstraction. One boolean reframes four steps from queue to history; copy, marker, hero and CTA all follow.
- Naming the instance changed the screen's usefulness. "#68 Car Blanche still needs a price" ends the task here instead of starting a hunt on the next screen. The ids were already in pricingProgress, just discarded.
- The exit is real. Sign-out destroys the session (401) and lands on the player site; wordmark has a proper accessible name. The lowest score for three runs is now a 3.

## Priority Issues

### [P1] The control that ends your session is announced as "Sign"
Below `sm` the second word is display:none, excluded from accessible name computation. textContent still reads "Sign out" (why a naive check passes) but the computed name is "Sign". Target measures 27x18px.
Why it matters: ambiguous in the direction that matters - a screen-reader user could take it for sign IN and activate the one control that logs them out of a governance console. pointer-coarse:py-2 only reaches ~34px.
Fix: persistent aria-label="Sign out" so visible text can abbreviate; pad hit area to 44px via inset pseudo-element.
Suggested command: /impeccable audit

### [P2] The postmortem strip has no measure
ShippedWithout's li renders at 130ch with max-width: none, directly above a hero paragraph capped at 68ch. Detector-confirmed ~174 chars/line.
Why it matters: the one paragraph carrying bad news is the hardest to read. The cap exists two elements away.
Suggested command: /impeccable typeset

### [P2] "4 classes set, set"
Polish changed the state word for denominator-less steps from "done" to "set", but Catalog's detail already ends in "set", so its accessible name reads "Catalog - 4 classes set, set".
Why it matters: invisible to sighted review, audible to exactly the user who can't cross-check visually. A fix aimed at honesty produced a stutter.
Suggested command: /impeccable clarify

### [P2] Singular data in plural copy
"locked with 1 of 55 cars unpriced (#68 Car Blanche), so those were unpickable." The plural() helper is already in the file and isn't applied to this string.
Suggested command: /impeccable clarify

### [P2] `danger` and `brand-3` are the same colour
Both #ff5d5d in DESIGN.md. The postmortem's error-red is pixel-identical to the brand's light tint - also why a locked-incomplete round measures 9 red marks vs a clean round's 6. Predates this work; this screen is the first place both tokens appear together.
Suggested command: /impeccable colorize

## Persona Red Flags

**Alex (Impatient Power User)**
- The P0 that wasted his time is gone; a finished round reads as finished in one glance.
- Still no keyboard shortcuts, still six manual championship switches. Third critique logging it.

**Sam (Accessibility-Dependent)**
- Strong now: 7 focusables in main, focus-visible confirmed, every rail link named with state, headings h1 + two h2, contrast floor 4.23:1 (only the 21px wordmark below 4.5, passes as large text).
- The two remaining defects are both his: the "Sign" button and "4 classes set, set". Both sighted-invisible.

**The League Operator**
- The screen finally distinguishes "you have work" from "this round shipped broken" - the distinction the job turns on.
- Still single-round. No way to see that RD 07 in one series locked with 22 unpriced cars while another series is fine.

## Minor Observations

- 48% of a 900px viewport still empty below the rail.
- The 24h lock band and pipeline incompleteness don't talk to each other; nothing escalates "locks in 2 hours, 22 cars unpriced".
- CTA remains 36px vs DESIGN.md's 44px (deliberate, matches other admin buttons, still a deviation).
- RoundReady always points at Scoring, even when Scoring is the blocked step.
- Console still renders admin chrome for a session that lost admin mid-visit (cached isAdmin); server 403s correctly, so honesty not security.

## Questions to Consider

- Three critiques have logged the cross-championship gap. Is the single-round Overview the right screen, or a round-detail view missing its parent?
- The postmortem is the only place the product records that a round shipped degraded. Should that be durable - an incident the operator acknowledges - rather than recomputed from prices every page load?
- If `danger` and `brand-3` must be one colour, which should move?
