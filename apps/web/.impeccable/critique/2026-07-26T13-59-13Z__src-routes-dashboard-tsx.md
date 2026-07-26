---
target: the dashboard (player hub, feat-dashboard-numbers branch)
total_score: 25
p0_count: 0
p1_count: 4
timestamp: 2026-07-26T13-59-13Z
slug: src-routes-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Points, budget, league totals now render. `join` still gives no pending/success/error; an API outage renders as a *successful* empty state. |
| 2 | Match System / Real World | 3 | Q/R1/R2 and `PTS PENDING` are racing-fluent. "Sub all" still reads as *substitute*; `2x` has an sr-only expansion but no visible legend. |
| 3 | User Control and Freedom | 3 | Row-level Retry added. Joining a public league is still one irreversible click, no confirm, no leave path. |
| 4 | Consistency and Standards | 3 | Class-Color Reserve breach removed on all three surfaces + recorded in DESIGN.md; score vocabulary unified in `scoreFormat.ts`. But 4 solid reds, all italic (rules allow 2 and 1). `pointer-coarse:` still unused. |
| 5 | Error Prevention | 2 | Untouched. `Create League` silently binds to `regs[0].seasonId`; the modal never names the championship. |
| 6 | Recognition Rather Than Recall | 3 | Class color now on every pick; `title` on car names. Names still clip 117px (44%); both explainers absent on mobile. |
| 7 | Flexibility and Efficiency | 2 | Untouched. No shortcuts, no collapse. Yesterday's scored weekend sits above today's deadline. 10 focusables precede the first pick action. |
| 8 | Aesthetic and Minimalist Design | 2 | Regressed. Nested cards 8 -> 24; pick chips added a bordered level. `MY TEAM` (26px) out-sizes the `h1` (22px). |
| 9 | Error Recovery | 2 | Retry is real, but `events` / `myLeagues` / `discover` all fail open, and `join.mutate` has no `onError`. |
| 10 | Help and Documentation | 2 | `PTS PENDING` and `Round missed` are good microcopy. Nothing explains scoring or bonuses. |
| **Total** | | **25/40** | **Acceptable - significant improvements needed** |

## Anti-Patterns Verdict

The P0 from the previous run is closed: a scored weekend now reports `1245.0 PTS` with `incl. bonus +330.0`, each pick carries its own total and `Q +30.0 R +300.0` breakdown, and the leagues table reads `1/2 . 2,737 pts` instead of `-`. Class color is on every chip. The `#ffc23d` Class-Color Reserve breach is gone from Dashboard, TeamPicks and Pick, and DESIGN.md records why.

Not improved, and one regression:
- **The One Red Rule** - `+ CREATE LEAGUE` (46px) plus three `MAKE PICKS ->` (38px), all italic. Rules allow two solid reds, italic on one. Count scales with open weekends x registered series.
- **Nested cards 8 -> 24** - pick chips added a fourth bordered level (page -> card -> row -> chip).
- **Touch targets** - 23 of 26 under 44px at 375px. `STANDINGS` 27px, `JOIN` 32px, `SIGN OUT` 18px. Untouched.

**Deterministic scan.** `detect.mjs` over the four changed source files: 0 findings, exit 0.

**Runtime scan** (injected at :8400, desktop 1440x1000, 64 findings):

| Finding | Count | Was | Verdict |
|---|---|---|---|
| nested-cards | 24 | 8 | Real regression from this branch. |
| ai-color-palette "cyan neon on dark" | 26 | 7 | False positive - `--color-success` `#2dd4bf`, documented as offset from GTD green. The 4x rise is real teal density though. |
| all-caps-body | 6 | 5 | Real. 34-char uppercase championship names. |
| tiny-text (11px) | 5 | 2 | Real, minor. DESIGN.md body step is 13px. |
| text-overflow | 2 | 1 | Real. `#18 Bryan Herta Autosport with Curb Agajanian` overflows by 117px. |
| repeating-stripes-gradient | 1 | 1 | False positive - the detector's own overlay. |

**Independent contrast pass.** Every visible text node against its resolved background: zero AA failures at 1440px and 375px, including the new teal badge, budget line, and `muted` "Round missed".

## Overall Impression

The scoreboard now shows scores, and cheaply - request count rose by exactly one (`/classes`, 648 bytes, cached), because most numbers were already in discarded payloads. Verified: 4 `picks` calls for 4 scored rows, 4 `roster` calls for 4 open rows, never both for one row.

The biggest remaining problem is not visual. `events.data ?? []` means an API outage renders as "No picks to be made." `queries.ts` already has `assertOk` written for this failure and these three hooks don't call it.

## What's Working

- **The scored state earns its screen.** Three levels of detail (round total, per-chip total, per-source breakdown) without a click.
- **Honest empty branches.** `Round missed` refuses to show a button pointing at a lineup that never existed; `PTS PENDING` distinguishes not-yet-scored from a real zero.
- **Token discipline under change.** ~100 lines of new UI, zero contrast regressions, zero new hardcoded hex; the one hue question resolved into DESIGN.md rather than a fifth accent.

## Priority Issues

**[P1] Three data hooks fail open.** `useEvents`, `useMyLeagues`, `useDiscoverLeagues` do `if (error) throw error` then `return data ?? []`. A 502 with empty body sets neither, so the query succeeds with `[]`. Fix: call the existing `assertOk(response, error)`, then add error branches with retry. -> `/impeccable harden`

**[P1] Four solid italic reds, count grows with data.** Fix: one solid red for the soonest-locking unset row; all others ghost. Drop italic except that one. -> `/impeccable quieter`

**[P1] Mobile unusable one-handed.** 23 of 26 targets under 44px. `index.css` already registers `pointer-coarse:` for this. -> `/impeccable adapt`

**[P1] Joining a league is silent.** `join.mutate` has no `onError`, no success confirmation, and `disabled={join.isPending}` disables every Join button at once. -> `/impeccable harden`

**[P2] Card nesting deepened.** 24 hits, up from 8. Fix: drop the chip's border + `bg-surface-2`, let the class slash and spacing separate picks. Structural - needs sign-off. -> `/impeccable distill`

## Persona Red Flags

**Alex (Power User).** Tabs through 10 controls before the first pick action. No shortcut to the soonest-locking round. Can't collapse the scored weekend occupying the top ~800px every visit.

**Sam (Screen reader + keyboard).** Better: bonus badge announces "Bonus applied: 2x double points"; contrast passes AA at both widths. Still broken: the leagues grid is `div`s with no table semantics, so a row announces as one run-on string - the standings board solved this with ARIA table roles and it was never carried here. Null trend gives `-` / "Trend unavailable" with no explanation of what would make it available.

**Deadline-day player** (project persona from PRODUCT.md). On a phone in a paddock with one bar. Every button under 44px. If the API stutters she is told there are no picks to make, 40 minutes before qualifying, with no retry and no way to distinguish that from a genuine off-season.

## Minor Observations

- `Filippi . Yoluc . Eastwood` clips at 12% with no `title` - tooltips were added to car names but not `DriverLineup`.
- `MY TEAM` at 26px out-ranks the page `h1` at 22px.
- Both explainer lines remain `hidden sm:*`; mobile gets no explanation of the page.
- 11px sans appears 5x against DESIGN.md's 13px body step.
- MX-5 `ND2` class has `color: null`, so its slash falls back to grey - admin data, not code.

## Questions to Consider

- If only one row can wear the page's one red, which is it - the soonest lock, or the one never opened?
- The scored weekend is the past. Should it be above the open one at all, or collapsed to a one-line summary?
- Four bordered levels exist because a pick is drawn as an object. What if picks were rows in the row, as the standings board treats teams?
