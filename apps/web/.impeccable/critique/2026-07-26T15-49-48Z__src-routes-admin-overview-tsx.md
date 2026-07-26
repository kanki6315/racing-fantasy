---
target: main admin dashboard view (/admin Overview)
total_score: 31
p0_count: 0
p1_count: 2
timestamp: 2026-07-26T15-49-48Z
slug: src-routes-admin-overview-tsx
---
Target: `/admin` -> `src/routes/admin/Overview.tsx` + `src/admin/ChampionshipBand.tsx`. Inspected live at 1440x900 as an admin, against the real local API.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | The band adds a layer of true cross-series status that didn't exist. Gap: if its data fails it returns null and vanishes without a word. |
| 2 | Match System / Real World | 3 | Copy and tense right. But 33-char championship names render ALL CAPS, and band rows announce as run-on nonsense ("Road Americano classes set"). |
| 3 | User Control and Freedom | 3 | Sign-out labelled and 44px; wordmark links home; one click moves between championships. No undo, no way back after a band jump. |
| 4 | Consistency and Standards | 3 | danger/brand-3 collision resolved, helpers shared. But the band reproduces two defects already fixed elsewhere on this same screen. |
| 5 | Error Prevention | 3 | Lock-aware pipeline and ruleset check hold. Band surfaces cross-series risk a week early. |
| 6 | Recognition Rather Than Recall | 4 | Six series, six real counts, instance named, no memory bridge. Band rows imply destination via status text rather than naming it. |
| 7 | Flexibility and Efficiency | 3 | MOVED at last. Cross-championship question answerable on one screen; a row switches context AND navigates in one click. No keyboard shortcuts. |
| 8 | Aesthetic and Minimalist Design | 3 | Empty viewport finally used (381px -> 663px content). But three stacked bands push the primary action to 446px. |
| 9 | Error Recovery | 3 | Main error band names the failed call and retries. The band has no recovery path at all. |
| 10 | Help and Documentation | 2 | Unchanged. Consequence sentences are real inline help; no glossary, no docs. |
| **Total** | | **31/40** | **Good - the capability is right; the new component needs the pass the rest of the screen already had** |

## Anti-Patterns Verdict

**LLM assessment.** Not AI-shaped. The band is a specific answer to this product's operator problem and reuses the project's own row idiom. What's wrong is craft debt, not generation debt.

**Deterministic scan.** detect.mjs over seven source files: clean, exit 0, [].

**In-page detector: 8 findings** (was 5); the increase is self-inflicted.
- all-caps-body x2 - NEW, GENUINE, A REPEAT. Band championship names are uppercase at 33-34 chars. Exact defect the detector caught last run on the context selects, fixed, then reintroduced in the component built the same day. Confirmed by computed style.
- ai-color-palette x5 (was 3) - band adds three teal "ready" labels. Still #2dd4bf, a committed token; partial false positive, but density keeps climbing.
- repeating-stripes-gradient x1 - false positive for the fourth consecutive run.

## Overall Impression

Flexibility finally moved. For three critiques the console answered "how is this round" while the operator's week is six series wide; now the first thing on screen is six rows sorted by who needs work soonest, and clicking one lands on that series' blocking screen with context switched. Right feature, built cheap - 9 requests, no new endpoint, pricing routed through the shared helper so it can't drift.

And the component shipped with four defects the rest of this screen doesn't have. Rail cells carry hand-written accessible names; band rows don't. Selects had all-caps fixed; the band reintroduced it. The Overview distinguishes "couldn't load" from "empty"; the band returns null and disappears. The new code hasn't had the passes the old code has.

## What's Working

- The band earns its place in one glance. "Michelin - RD 07 - 0/44 cars priced - locks 5d 8h" is the whole question answered in a row. One click switched context to Michelin and opened the Price Board - verified.
- It cost almost nothing. Every list endpoint returns unfiltered, so five shared calls cover six series; only three prices requests fired, because two championships are blocked at Catalog and the selected one shares its cache entry with the pipeline below.
- The shared-helper discipline caught a real bug during the build: the band initially reported "0/17 cars priced" for a driver-priced series - the original defect of this screen reappearing. Routing through pricingProgress fixed it and makes recurrence structurally hard.

## Priority Issues

### [P1] Band rows announce as one run-on string
Rows are buttons with four unlabelled spans, so the accessible name concatenates without separators: "Porsche Carrera Cup North AmericaRD 05 - Road Americano classes setlocks 5d 0h". "Road America" + "no classes set" becomes "Road Americano classes set".
Why it matters: DESIGN.md documents this exact failure for the leaderboard ("1TG-Racing1,7951") and solves it there. The rail cells 300px below carry proper names. The band is the same pattern with the fix missing.
Fix: aria-label per row composed from the same four values with separators, as StepRail does.
Suggested command: /impeccable audit

### [P1] The band disappears silently when its data fails
`if (failed) return null`. Five shared queries; if any errors the entire band unmounts with no message, no retry, no trace it was meant to be there.
Why it matters: the precise failure this engagement began with - showing nothing rather than saying it couldn't ask. The Overview beneath it has a proper error band with working Retry. The band should reuse it.
Suggested command: /impeccable harden

### [P2] 33-character names in all caps - the same defect, twice
"PORSCHE CARRERA CUP NORTH AMERICA" at 13px. Fixed on the selects last run for exactly this reason. Not just the repeat - the fix and the reintroduction happened in the same session, meaning the rule lives in my head rather than anywhere enforceable.
Suggested command: /impeccable typeset

### [P2] The sort runs before the state it sorts on is known
sortByUrgency executes in ChampionshipBand on buildBoardRows output, but `ready` is only resolved later inside each BandRow once prices land. Rows are ordered by unresolved blocker.
Visible now: rows 1-4 are the "outstanding and live" rank, and row 4 reads "ready". With different data a ready championship locking sooner would outrank one that needs work, breaking the band's one promise.
Fix: resolve prices at band level (queries already deduplicated) so sorting sees final state.
Suggested command: /impeccable harden

### [P2] Four columns, no headers, no destination named
No header row, no table semantics - "locks 5d 0h" and "no classes set" are unlabelled columns. Unlike the rail, rows never state where they go. The leaderboard solved both with ARIA table roles and a destination label.
Suggested command: /impeccable audit

## Persona Red Flags

**Alex (Impatient Power User)**
- His main complaint is finally answered: six series, one screen, one click to the work. First movement in three critiques.
- Still no keyboard shortcuts, and no way back to where he was after a band jump changes global context.

**Sam (Accessibility-Dependent)**
- The screen's own controls are good: 13 focusables, focus ring confirmed, headings h1 + three h2, contrast floor 4.23:1 (only the 21px wordmark under 4.5, passes as large text).
- Both P1s are his: six new buttons announcing as run-on strings, and a region that can vanish without announcement.

**The League Operator**
- The band is the screen they needed. "Which of my six needs me" now has an answer above the fold.
- The order it presents them in can be wrong, and they have no way to know when it is.

## Minor Observations

- The hero's primary action now starts 446px down; three stacked bands precede it.
- useAllSessions() is called in the band and in every row - deduplicated to one request, but seven subscriptions where one prop would do.
- resolveAfterPrices uses a non-null assertion on row.round!.
- Teal "ready" labels push the detector's palette count 3 -> 5; the state palette keeps getting denser as more states become accurate.
- .impeccable/design.json is stale against DESIGN.md since the token change.

## Questions to Consider

- Every new component this session shipped with defects the older code had already fixed. More passes, or should the rules with teeth - accessible names, uppercase scope, error states - become lint rules rather than review findings?
- The band sorts by urgency but can't know urgency until prices resolve. Is per-row lazy resolution worth an order that's sometimes wrong, or should the band block on one batch?
- Three bands now stack above the hero. At what point does "answer the broader question first" start burying the action?
