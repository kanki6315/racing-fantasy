---
target: the landing page
total_score: 27
p0_count: 0
p1_count: 2
timestamp: 2026-07-24T17-43-06Z
slug: src-routes-landing-tsx
---
# Critique — Landing page (`src/routes/Landing.tsx`) — re-run after fix cycle

Register: product. Assessed live at http://localhost:5173 (real seeded data), logged-out + signed-in-unregistered, desktop 1280 + mobile 375. Prior run: 24/40 (2026-07-24T02:35Z).

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Countdown + absolute lock time excellent; but "IN PROGRESS" persists 14 days after a Jul 10 event (manual `scored` flag never set) |
| 2 | Match System / Real World | 3 | Racing vocabulary (FINAL, R07, lock) fits; `// NEXT_EVENT` is developer idiom, not broadcast idiom |
| 3 | User Control and Freedom | 2 | Calendar rows still completely inert — the page's largest region has zero affordances |
| 4 | Consistency and Standards | 3 | Tokens rigorously applied; two status-pill vocabularies remain (Landing solid "COMING SOON/FINAL" vs Dashboard tinted "Waiting to Open/Final"); visible R06→R07→R09 numbering gap |
| 5 | Error Prevention | 3 | Modal disables confirm until valid name; lock enforced server-side |
| 6 | Recognition Rather Than Recall | 3 | Statuses always text+color; hero shows no round number so the R08 gap must be inferred |
| 7 | Flexibility and Efficiency | 2 | "SET YOUR LINEUP →" routes to /dashboard, not the pick page, despite `activeRoundId` being available |
| 8 | Aesthetic and Minimalist Design | 4 | Genuinely excellent restraint; brand fit is the page's best quality |
| 9 | Error Recovery | 2 | ErrorBox is message-only — no retry action |
| 10 | Help and Documentation | 2 | One 14px sentence is the whole game explanation; no scoring explainer |
| **Total** | | **27/40** | **Acceptable, high end — up from 24** |

## Anti-Patterns Verdict

**Not slop — a fluent user would trust this.** Every previously-confirmed ban violation is cleared and verified from both directions:
- **Side-stripes: zero** (was 4) — the slash-badge replacements are the exact alternative DESIGN.md prescribes.
- **Low-contrast: zero detector hits** (was 10 at 3.0:1) — reviewer-computed ratios: muted 5.6–6.0:1, WAITING pill 9.6:1, dark-on-warn 9.5:1. The only failing token pair left (`muted-2` on surface) appears solely on the dev-only sign-in button.
- **Footer overflow: proven false positive** — the original "37px" reproduced only when the detector ran at a 0-width collapsed viewport; at 1280px overflow is exactly 0.
- Remaining detector output (24): 22 tiny-text hits on the deliberate 11px chip/caption tier (all AA-passing), 1 wide-tracking on the same mono date line, 1 nested-cards FP (a table header row, not a card), 1 intentional 4%-opacity brand stripe texture.
- **Hero-metric tiles**: reduced (2 tiles, recessed, no stretch, neutral slash) but the big-number/small-label pattern still exists — the last brush with a named ban.
- Kicker count is down to 2 mono eyebrows styled as a telemetry motif; not systematic.

## Overall Impression

The page has crossed from "committed identity with credibility leaks" to "designed system that keeps its own rules." Aesthetic/minimalist earns a 4; contrast discipline is now a strength; the CTA is honest; the lock is reassuring (countdown + wall-clock time). What holds the score in the 20s is interaction depth, not surface: the calendar is a beautiful dead end, statuses depend on manual flags that go stale, and the primary CTA lands one hop short of the lineup.

## What's Working

1. **Design-system fidelity enforced in code** — the One-Red-Rule CTA demotion, text+color pills, slash marks, tabular mono numerals. Near-clean token audit.
2. **The RegisterModal** — privacy promise, live leaderboard preview, char counter, default-off email toggles.
3. **Deadline design** — countdown + absolute time + PICKS-LOCK vs WEEKEND-LOCKS distinction; calm, no manufactured urgency.

## Priority Issues

- **[P1] "Upcoming Events" leads with past events wearing stale statuses.** Jun 26 (FINAL) and Jul 10 (still "IN PROGRESS" 14 days on — waits on the manual `scored` flag). The first scannable block contradicts its own heading and the "honest badges" promise. **Fix:** rename the section ("Race Calendar"), dim retired rows, and time-decay IN_PROGRESS → neutral "AWAITING RESULTS" after `latestQuali` + grace window. → layout/harden work
- **[P1] The calendar is dead UI.** Zero interactive elements between the hero CTA and "Full standings" (a11y-tree confirmed). Scored events can't reach results; open events can't reach picks; mobile taps give no feedback. **Fix:** rows become links (scored → round standings, open+registered → pick page, else dashboard) using the existing hover-border vocabulary. → /impeccable craft
- **[P2] "SET YOUR LINEUP →" doesn't go to the lineup.** Registered users land on /dashboard though `nextEvent.activeRoundId` is available. An extra hop at the highest-pressure moment. **Fix:** `navigate(/pick/${activeRoundId})` with dashboard fallback. → /impeccable clarify (small)
- **[P2] Round-sequence gap (R06 → R07 → R09).** The hero IS R08 but carries no round label. **Fix:** add an R08 chip beside `// NEXT_EVENT`. → /impeccable polish
- **[P3] Stat-tile pattern + numeral noise.** The 2-tile big-number pattern still brushes the named ban; "2127.0" trailing .0 on every row. **Fix:** fold counts into a one-line mono strip ("66 PLAYERS · 6 LEAGUES"); integer points unless fractional. → /impeccable distill

## Persona Red Flags

**Jordan (first-timer):** one sentence is the whole explanation; scoring is unexplained (2127.0 has no anchor); the countdown counts toward something Jordan can't do yet; most likely action is bouncing to Standings (which works logged-out — good).

**Casey (one-handed mobile):** layout holds at 375 with honest reflow; but register CTAs scroll away with no sticky affordance, the R07 card is dominated by a 4-pill stack, and tapping any event card does nothing — feels broken on touch.

**Race-weekend regular:** lock time + standings both work logged-out (genuinely good); but "IN PROGRESS" two weeks on hides whether scores posted, own rank invisible unless top-8, and the CTA detours through the dashboard.

## Minor Observations

- No `<main>` landmark in RootLayout.
- RegisterModal internally violates the Italic-Restraint Rule (italic on both title and CTA).
- CLAUDE.md still documents the CLOSED pill as "COMPLETE" (now "FINAL") — docs drift.
- The signed-in-unregistered view remains the reddest screen (banner chip + banner CTA + pill + nav) — within budget but the closest call.
- Leaderboard ROUNDS column is all-1s early-season noise; `useCountdown` ticks every second even at d/h/m granularity.
- Buttons rely on inner-span text for accessible names (correct per accname, but bare in shallow a11y tools); countdown value has no SR label beyond the adjacent heading.

## Questions to Consider

1. The calendar is the heart of the landing — why can't you touch it? What would "every row is a door" unlock for the "continuous campaign" brand promise?
2. Is a manually-flagged status ever honest enough for a timing-screen brand? Should time win after a grace window?
3. For the logged-out visitor, should social proof (66 players, live movement) outrank a deadline they can't act on yet?
