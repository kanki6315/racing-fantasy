---
target: the dashboard (player hub, feat-dashboard-numbers @ bb7e7e0, images enabled)
total_score: 29
p0_count: 0
p1_count: 2
timestamp: 2026-07-26T17-16-57Z
slug: src-routes-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Sidebar contradiction and vanishing Discover both fixed. Still zero aria-live/aria-busy, and image slots show an empty well while loading with no indication they are loading. |
| 2 | Match System / Real World | 3 | "Sub all" still reads as substitute; `2x` has sr-only text but no visible legend. |
| 3 | User Control and Freedom | 3 | Retry at row, section, discover and join level. Joining still one irreversible click, no confirm, no leave path. |
| 4 | Consistency and Standards | 4 | Every applicable DESIGN.md named rule measures clean. |
| 5 | Error Prevention | 2 | Untouched. Create League binds silently to regs[0].seasonId. |
| 6 | Recognition Rather Than Recall | 3 | `title` is the only tooltip mechanism - unreachable by keyboard and touch, and mobile is exactly where truncation still bites. |
| 7 | Flexibility and Efficiency | 2 | Untouched. 10 focusables before the first pick action; scored weekend still above the open one. |
| 8 | Aesthetic and Minimalist Design | 3 | Unchanged markup; detector identical at 46. |
| 9 | Error Recovery | 4 | Every data source: assertOk -> error branch -> retry, with copy naming the cause and promising saved work is intact. Images degrade gracefully to a tinted placeholder. |
| 10 | Help and Documentation | 2 | Nothing explains scoring or bonuses; help vanishes below sm. |
| **Total** | | **29/40** | **Good** |

Only +1 on the previous run. The three P1s fixed were real but narrow - two consumers discarding an error, plus a self-inflicted regression - while this run surfaced a P1 invisible for three runs.

## The finding that matters: the wrong page was being critiqued

The worktree has no `.env`. It is gitignored, so a fresh `git worktree` never receives one, and VITE_IMAGE_BASE_URL was unset for every run on this branch. Unset, EntityThumb and DriverAvatar return their class-tinted placeholder immediately - the good-looking path. Every screenshot taken on this branch, including the A/B comparison the user chose from, showed a page with no image layer.

With the env restored the page renders 40 `<img>` elements and the pick rows are materially barer during load: empty dark wells where liveries go, empty circles where driver initials go, and the 3px class slash left as the only class signal.

**The bug this exposes:** both components fall back to the placeholder on `url === null` and on `onError`, but NOT while pending.

    if (url && !broken) return <img src={url} ... />   // pending renders a bare bg-surface-3 box
    return <TintedPlaceholder />                        // only for null / errored

The class-tinted fallback - the thing carrying wayfinding, which PRODUCT.md calls load-bearing - is the one state that never shows when most needed. `loading="lazy"` makes it recur on every scroll into new rows.

Severity, measured: the fallback does take over once the request fails (verified - 40 imgs became 16 placeholders + 24 initials circles after ~10s). On a fast CDN this is a flash; on a slow link or during a CDN incident it is a sustained empty well.

This also means the earlier variant A/B recommendation rested on incomplete evidence. B still measures better on nesting and alignment; with real liveries the image becomes the row's anchor, which argues FOR B (the box was redundant beside a photo).

## Anti-Patterns Verdict

**Deterministic scan.** detect.mjs over Dashboard, EntityThumb, DriverLineup, index.css: 0 findings, exit 0.

**Runtime scan**, 46 findings, breakdown identical to the previous run (the P1 fixes were logic, not markup):

| Rule | Count | Verdict |
|---|---|---|
| ai-color-palette (teal) | 26 | False positive (--color-success). Teal remains the page's most-painted accent against 1 red. |
| nested-cards | 8 | Baseline, unchanged. |
| all-caps-body | 6 | Real, pre-existing. |
| tiny-text | 5 | Real, minor. |
| repeating-stripes | 1 | False positive - the detector's own overlay. |

## What's Working

- **Error handling is now complete.** Four data sources, four honest failure paths, each naming the cause and reassuring about saved work.
- **The sidebar can no longer contradict the main column** - verified by forcing the query into error: "6 series · — leagues", "ALL LEAGUES — PUBLIC — PRIVATE —".
- **Images degrade gracefully when they fail**, the harder half of the problem; only the pending window is unhandled.

## Priority Issues

**[P1] The class-tinted placeholder does not cover the loading state.** EntityThumb and DriverAvatar both render a bare box until the image resolves. Shared by Dashboard, Pick, TeamPicks, Stats. Fix: render the placeholder BEHIND the img - tinted gradient + icon as the wrapper background, image paints over it on load. -> /impeccable harden

**[P1] Every state built this session is silent to a screen reader.** aria-live: 0, aria-busy: 0; both skeletons aria-hidden. The standings board already solved this with a polite atomic live region. -> /impeccable harden

**[P2] `title` is the only tooltip and does not work where needed.** 40 visible title attributes; unreachable by keyboard and touch - and at 375px, where names still truncate 39%, touch is the only input.

**[P2] The picks have no heading structure.** Championship names inside cards are spans; the outline is h1 -> h2 -> h2 with nothing for the eight pick rows. With the leagues grid still lacking table roles, the page has no navigable structure below section level.

**[P3] State changes have no motion.** 27 elements carry a 150ms colour transition; zero elements animate. Skeleton -> content is a hard swap. A 150ms crossfade is the whole fix; prefers-reduced-motion is already handled globally.

## Persona Red Flags

**Deadline-day player.** Hit hardest by the new finding: on a paddock connection every pick row is an empty well with no class colour, on the screen where class identity is the navigation. Lazy loading re-runs it on every scroll.

**Sam (Screen reader).** No live regions, no aria-busy, no headings below section level, no table roles. Four rounds of work has all been visual.

**Alex (Power User).** Unchanged: 10 focusables before the first pick action, no collapse, scored weekend above the live one.

## Minor Observations

- League name "ACURA MEYER SHANK RACING" clips at 7% with no title.
- MY TEAM at 26px still out-ranks the h1 at 22px.
- 11px sans still appears 5x against the 13px body step.
- useNow(60_000) re-renders the Dashboard subtree each minute - negligible beside the per-second countdowns, but it exists.

## Questions to Consider

- If the image layer is the row's real anchor, is the 3px class slash still doing a job beside a livery?
- Four rounds have improved what the page looks like and none have improved what it announces. Is the next round an accessibility round?
- `.env` being gitignored means any fresh worktree renders a different page. Should the repo ship a `.env.example` pointing at the real CDN so this cannot silently recur?
