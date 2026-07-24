---
target: the landing page
total_score: 30
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T18-10-11Z
slug: src-routes-landing-tsx
---
# Critique — Landing page (`src/routes/Landing.tsx`) — third run

Register: product. Assessed live (real seeded data), logged-out + signed-in-unregistered, 1280/768/375. Prior runs: 24 → 27.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 4 | Lifecycle pills + live countdown + absolute wall-clock time; PICKS OPEN state honest |
| 2 | Match System / Real World | 4 | Racing vocabulary lands (FINAL, R08, quali lock); AWAITING RESULTS is honest |
| 3 | User Control and Freedom | 3 | Calendar rows are mystery-meat links — no affordance, destination varies by status |
| 4 | Consistency and Standards | 3 | Two register CTAs in unregistered state; two status-pill vocabularies (solid vs tinted) maintained by hand |
| 5 | Error Prevention | 3 | Modal validates live; lock shown two ways; dead-end FINAL rows still clickable |
| 6 | Recognition Rather Than Recall | 4 | Everything on-screen; no timezone math needed |
| 7 | Flexibility and Efficiency | 3 | Open rows deep-link to /pick/:id; non-open rows all land on generic /standings (no round-level destination) |
| 8 | Aesthetic and Minimalist Design | 3 | Strong; unregistered state stacks 3 solid reds + red avatar; "—" countdown cells are dead ink |
| 9 | Error Recovery | 2 | ErrorBox still has no retry action |
| 10 | Help and Documentation | 1 | One sentence remains the entire game explanation; no how-it-works/scoring primer |
| **Total** | | **30/40** | **Good — solid foundation, address weak areas** |

## Anti-Patterns Verdict

**"NO — this reads as designed, not generated."** Ban checks all pass (no stripes, no gradient text, no hero-metric tiles — the countdown box "earns it" as a live clock, eyebrow not templated). **One real overflow violation found:** at 768px signed-in, the "STATS" nav link is overlapped by the NOT REGISTERED pill/identity cluster (numerically verified — GlobalNav doesn't reserve space at md).

**Deterministic scan:** CLI clean; in-page detector down to **4 findings** (from 41 → 24): 2 tiny-text on the deliberate 11px label tier, 1 nested-cards FP (leaderboard table header), 1 intentional brand texture. Effectively silent.

## Overall Impression

Crossed into the "Good" band (28+). Status visibility, real-world match, and recognition all hit 4s; the hero-as-promoted-calendar-entry architecture and the countdown/absolute-time pairing were called out as disciplined. The remaining work is a short punch list — one real bug (nav collision), one content gap (onboarding), and two second-order effects of the last fix round: rows became doors but unlabeled ones, and dimming retired rows via opacity re-broke contrast on their 11px track names.

## What's Working

1. **Hero-as-promoted-calendar-entry**: pill from the same `deriveEventStatus()` lifecycle, rows start after it — "disciplined IA," single source of truth.
2. **Countdown + absolute lock time**: "the deadline-clarity the product principles demand," correct tabular mono.
3. **One-Red-Rule demotion logic**: "someone thought about red budget per view — rare."

## Priority Issues

- **[P1] Nav collision at md (768–~900px, signed in).** "STATS" is overlapped by the NOT REGISTERED pill + identity block (Stats right edge 373.9 vs cluster left 346.2). A tablet user loses a nav destination. **Fix:** let the identity block collapse earlier (hide email below lg / move the pill to the second-row nav at md). GlobalNav.tsx:57–90.
- **[P1] Zero onboarding beyond one sentence.** The CTA demands Google sign-in on faith; even fantasy-fluent visitors need cap, scoring basis, cadence. **Fix:** one compact three-beat strip under the hero (PICK under cap → LOCK at quali → SCORE Q+R) in the existing chip/mono vocabulary.
- **[P2] Calendar rows are mystery-meat links.** No affordance; identical rows navigate differently (OPEN → pick, everything else → generic /standings — a SCORED row dumps you on season standings, not that round's results). **Fix:** right-aligned action label/chevron per row ("SET LINEUP" / "VIEW STANDINGS"); round-level links when a destination exists.
- **[P2] Red budget breaks in the signed-in-unregistered state.** Four red voices: solid banner pill, red CTA, PICKS OPEN pill, red avatar disc. **Fix:** banner pill → tinted wash per chip spec; avatar → neutral with red on hover.
- **[P3] Contrast regressions in the dim/de-emphasis layer.** `opacity-70` on FINAL rows drops 11px muted track names to ≈3.4:1; modal char counter uses `muted-2` (≈3.2:1); input placeholder `text-line-3` ≈1.9:1. **Fix:** floor de-emphasized text at `muted`; dim rows via non-text elements, not row opacity; placeholder → muted.

## Persona Red Flags

**Jordan:** still can't learn the game without signing in; R06→R07→R09 sequence looks like a bug (the hero says R08 but nothing connects it to the gap below); ROUNDS column all-1s opaque.

**Casey:** R07's four stacked series pills consume ~40% of the mobile viewport; "—" footers are dead ink; tapping FINAL/AWAITING cards teleports to standings with no signposting. Tap targets and CTA reach are good.

**Race-weekend regular:** lock time is "best-in-class"; but their own rank still isn't on the landing board (top-8 only, no pinned row), "AWAITING RESULTS" two weeks on sets no expectation, and "how did my picks do at the Glen?" is 3+ clicks.

## Minor Observations

- Leaderboard P1 red is red-as-decoration (soft One-Red-Rule spend) — the ink ramp alone would carry the podium.
- RegisterModal has two display italics in one view (title + CTA).
- Two hand-maintained status label vocabularies (Landing's uppercase vs EVENT_STATUS_META).
- "Road America · Jul 30" vs lock "JUL 31" is correct but double-take-able.
- Per-row `useCountdown` intervals tick every second — invisible, perf-only nit.
- Empty/error copy is calm and on-voice throughout.

## Questions to Consider

1. Should the landing hero serve the *player* once signed in — "your rank, your last-round points, your next lock" — instead of serving visitor and veteran identically?
2. Is the calendar earning its slot above the leaderboard when two of its three rows are the past? Would a compact strip give the standings the prime slot?
3. Under 24h to lock, should the page escalate at all? The brand forbids manufactured urgency — but this deadline is real.
