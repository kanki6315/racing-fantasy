---
target: the dashboard (player hub, feat-dashboard-numbers @ da17457)
total_score: 28
p0_count: 0
p1_count: 3
timestamp: 2026-07-26T16-06-25Z
slug: src-routes-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | pending/error/empty now distinct and visible. Nothing is announced — zero aria-live, zero aria-busy, skeletons aria-hidden. Discover vanishes silently on error. |
| 2 | Match System / Real World | 3 | Error copy plain and reassuring. "Sub all" still reads as substitute; `2x` has sr-only text but no visible legend. |
| 3 | User Control and Freedom | 3 | Retry at row, section and join level. Joining still one irreversible click, no confirm, no leave path. |
| 4 | Consistency and Standards | 4 | Every applicable DESIGN.md named rule measures clean: 1 solid red, 1 italic control, no class-colour theft, pointer-coarse used, shared score vocabulary. |
| 5 | Error Prevention | 2 | Untouched. Create League binds silently to regs[0].seasonId; the modal never names the championship. |
| 6 | Recognition Rather Than Recall | 3 | Class colour on every pick; desktop truncation gone. Both explainers still hidden sm:*, so mobile gets no orientation. |
| 7 | Flexibility and Efficiency | 2 | Untouched. No shortcuts, no collapse. 10 focusables before the first pick action. Scored weekend still above the open one. |
| 8 | Aesthetic and Minimalist Design | 3 | Nested cards 24 -> 8, overflow 2 -> 0, points align to the digit. MY TEAM (26px) still out-sizes the h1 (22px); teal now the most-used accent. |
| 9 | Error Recovery | 3 | assertOk on three hooks + real error branches. DiscoverLeagues still swallows its error; the rail contradicts the one it shows. |
| 10 | Help and Documentation | 2 | Error bodies genuinely good. Nothing explains scoring or bonuses; help vanishes below sm. |
| **Total** | | **28/40** | **Good - solid foundation, address weak areas** |

## Anti-Patterns Verdict

**Deterministic scan.** detect.mjs over the four changed files: 0 findings, exit 0.

**Runtime scan**, same account and viewport as the 64-finding run, directly comparable:

| Rule | 1st | 2nd | Now | Verdict |
|---|---|---|---|---|
| nested-cards | 8 | 24 | 8 | Regression repaid; chip boxes gone. |
| text-overflow | 1 | 2 | 0 | Fixed, as a side effect of the row change. |
| ai-color-palette (teal) | 7 | 26 | 26 | False positive (--color-success), but see below. |
| all-caps-body | 5 | 6 | 6 | Real, pre-existing. |
| tiny-text | 2 | 5 | 5 | Real, minor. |
| repeating-stripes | 1 | 1 | 1 | False positive - detector's own overlay. |
| **Total** | 24 | 64 | 46 | |

26 teal hits is a detector error (documented status token), but it went 7 -> 26 when bonus badges and budget text were added and has not come down. Teal is now the most-painted accent while red is restricted to one instance. The One Red Rule is satisfied on a technicality while another colour took over the screen.

**Contrast**, canvas-resolved so oklab() is handled: one failure, ADMIN at 3.75:1 in GlobalNav.tsx - admin-only, outside this file, pre-existing.

## Overall Impression

The three commits did what they claimed, measurably: 4 solid reds -> 1, nested cards 24 -> 8, overflow 2 -> 0, all 12 points cells on one right edge at both widths, one contrast failure and not in this file.

But a bug was introduced while fixing the red budget, and it is the most serious thing on the page. `urgentRoundId` calls Date.now() inside a useMemo keyed on [picksCards], so the timestamp is frozen. On a tab left open — how someone follows a race weekend — urgency never moves. When the urgent round's quali passes, the row's `locked` flips via useCountdown, `isPrimary` goes false, and the page silently loses its primary call to action entirely, never promoting the next-soonest round.

## What's Working

- **Picks read as rows.** The class slash became the left edge; down a group the slashes form a class column. The points track lets four totals be compared without horizontal eye movement.
- **The three-state distinction is honest.** pending -> skeleton, error -> cause + reassurance + retry, empty -> only after a successful response.
- **Rule compliance is measurable, not asserted.** Every named DESIGN.md rule applying to this page has a number behind it.

## Priority Issues

**[P1] urgentRoundId freezes time; the page can end up with no primary action.** Fix: drive it from the tick the rows already use — take useNow(60_000) into the memo dep so urgency re-derives. -> /impeccable harden

**[P1] DiscoverLeagues discards its query's honesty.** assertOk was added to useDiscoverLeagues, then the component does `discover.data ?? []` -> `if (leagues.length === 0) return null`. On error the section disappears with no trace. -> /impeccable harden

**[P1] The rail contradicts the error the main column shows.** Demonstrated live: main says "Couldn't load your leagues" while the sidebar says "6 series · 0 leagues" and "ALL LEAGUES 0". `const leagues = myLeagues.data ?? []` feeds both. Fix: counts render an em-dash when myLeagues.isError. -> /impeccable harden

**[P2] Every new state is invisible to a screen reader.** aria-live: 0, aria-busy: 0, both skeletons aria-hidden. The standings board already solved this with a polite atomic live region.

**[P2] The leagues grid still is not a table.** tableRoles: 0; the standings board established table/rowgroup/row/cell for this exact shape.

## Persona Red Flags

**Alex (Power User).** 10 focusables before the first pick action, no way to collapse a scored weekend occupying the top ~560px, no shortcut to the round about to lock. Leaves the tab open all Saturday and hits the frozen-urgency bug.

**Sam (Screen reader + keyboard).** Better in one way: bonus badge announces "Bonus applied: 2x double points"; contrast passes AA throughout this file. Worse in proportion to added state: three new visual states, none announced. Join says "Joining..." visually and nothing aloud.

**Deadline-day player.** Best served this round: real budget figures pre-lock, 44px targets on coarse pointers, an outage that says so. Still no explanation of anything on mobile.

## Minor Observations

- League name "ACURA MEYER SHANK RACING" clips at 7% with no title - pick names got tooltips, league names did not.
- MY TEAM at 26px still out-ranks the h1 at 22px. The 24px round totals also exceed it, but that is defensible: data outranking the section label is the brand thesis.
- 11px sans still appears 5x against DESIGN.md's 13px body step.
- Scored weekend still sorts above the open one - the past above the deadline.

## Questions to Consider

- Red is rationed to one instance and teal is painted 26 times. Which colour is carrying this page, and is that the one intended?
- If the tab is open all weekend, what should the page do as each lock passes - promote the next round, or go quiet deliberately?
- The skeleton is a lie told politely to sighted users and nothing at all to everyone else. Should loading say something, or should the section claim nothing until it can?
