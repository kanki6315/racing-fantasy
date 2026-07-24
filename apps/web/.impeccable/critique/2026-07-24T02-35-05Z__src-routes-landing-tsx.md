---
target: the landing page
total_score: 24
p0_count: 1
p1_count: 2
timestamp: 2026-07-24T02-35-05Z
slug: src-routes-landing-tsx
---
# Critique — Landing page (`src/routes/Landing.tsx`)

Register: product. North Star: "The Timing Screen" (DESIGN.md). Assessed live at http://localhost:5173 (real seeded data), logged-out + signed-in-unregistered variants, desktop 1280×800 and mobile 375×812.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Live countdowns + lifecycle pills are excellent; but no absolute lock time exists anywhere, and 3 countdowns tick at once |
| 2 | Match System / Real World | 3 | Race vocabulary lands (R08, quali); "COMPLETE" vs "SCORED" and the "·" seq marker unexplained |
| 3 | User Control and Freedom | 2 | Logged-out "SET YOUR LINEUP →" silently redirects to Google OAuth; calendar rows are dead-ends (0 clickable elements) |
| 4 | Consistency and Standards | 2 | Two status-pill vocabularies (Landing solid fills vs tinted elsewhere); hero CTA lacks the hover state its twin banner CTA has |
| 5 | Error Prevention | 3 | RegisterModal disables confirm until a name; little else to prevent here |
| 6 | Recognition Rather Than Recall | 3 | Statuses labeled (good); R-numbering + countdown-only lock time force mental math |
| 7 | Flexibility and Efficiency | 2 | No path from any calendar row to anything; registered users routed to /dashboard, not the open pick board |
| 8 | Aesthetic and Minimalist Design | 3 | Strong committed look; red over-spend, hero/R08 duplication, stretched empty stat tiles |
| 9 | Error Recovery | 2 | Per-zone ErrorBox messages exist but no retry affordance |
| 10 | Help and Documentation | 1 | Nothing explains the game, scoring, or "lineup" to a visitor; only post-sign-in copy explains anything |
| **Total** | | **24/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Not AI slop.** A category-fluent user would recognize and trust the committed broadcast-timing-screen identity. The failures are *drift from its own DESIGN.md constitution*, not genericism.

**LLM assessment:** four named violations of the project's own rules — (1) banned side-stripe accents: `border-l-[3px] border-l-brand` at Landing.tsx:255 (countdown box), :449 (stat tiles), Leaderboard.tsx:79/:110 (my-row); (2) the banned big-number hero-metric template: `Tile` (Landing.tsx:447–454), aggravated by `flex-1` stretching them into huge near-empty boxes on tall windows; (3) Italic-Restraint Rule: display italic on hero h1, two section headings, banner headline, and two simultaneous red italic CTAs in the unregistered state; (4) `// SNAKE_CASE` mono kickers (`// NEXT_EVENT`, `// SEASON_PULSE`, `// JOIN_2026`) — a dev-terminal tell, arguably off the broadcast register.

**Deterministic scan:** CLI detect.mjs over the four source files: clean (TSX parsing limits). The in-page detector found **41 findings**: 3× side-tab (confirming the stripes that rendered), 10× low-contrast (measured 3.0:1 — #5c626b on #101317, incl. 8 9px mono captions), 25× tiny-text (10–11px), 1× footer text-overflow (37px past its box — missed by the human pass), 1× cramped-padding, 1× repeating-stripes gradient. False positives: the repeating-stripe texture and uppercase display headings are deliberate brand system; cramped-padding is a layout-container artifact.

## Overall Impression

The page delivers "grid before lights-out" on first paint — near-black void, big mono countdown, honest lifecycle pills driven by `deriveEventStatus()`. It is the strongest kind of foundation: a real identity, executed. But it leaks credibility in three ways: core state signals fail contrast (white-on-amber ≈1.6:1), the brand's own named rules are violated in visible places, and the page tells a first-time visitor nothing about the game before bouncing them to Google OAuth. Biggest single opportunity: make the landing legible — in both senses — to the two people it serves: the curious visitor and the returning player checking their lock.

## What's Working

1. **Broadcast-fluent calendar:** solid-fill status pills, mono uppercase dates, the highlighted active-round row with live per-row countdown read as a genuine timing screen; the shared lifecycle helper keeps badges honest.
2. **The Tabular-Numeral Rule is fully honored** — every comparable figure (points, countdowns, ranks, dates) is Spline Sans Mono and aligns to the digit.
3. **RegisterModal is a model high-stakes moment:** privacy reassurance ("only your team name is shared"), live leaderboard preview of your name, char counter, plain-language email opt-ins.

## Priority Issues

- **[P0] Contrast failures on core state signals.** IN PROGRESS pill is white-on-amber ≈1.6:1 (Landing.tsx:34); SCORED white-on-blue ≈3.8:1 (:35); `text-muted-2` (#5c626b) ≈3.0:1 (detector-measured) on 9–12px track names, countdowns, tile labels, leaderboard captions; small red text (#e10600 on black) ≈3.9:1. **Why:** these are the exact signals players scan under deadline; PRODUCT.md names this trap. **Fix:** dark ink on amber (≈12:1), tinted treatment for scored, promote `muted-2`→`muted` below 13px, `brand-3` for small red text. → `/impeccable polish`
- **[P1] The page explains nothing and the CTA hijacks to OAuth.** Zero value proposition; "SET YOUR LINEUP →" triggers `loginWithGoogle()` unannounced (Landing.tsx:139–143). **Why:** kills conversion trust at the exact moment of curiosity; Jordan bounces at a Google consent screen. **Fix:** one sentence of game framing in the hero + honest logged-out CTA label ("SIGN IN TO PLAY" or sub-caption). → `/impeccable clarify`
- **[P1] Class-Color Reserve broken.** SCORED spends LMP2 blue (eventStatus.ts:52); rank-3 podium spends GTD PRO amber (Leaderboard.tsx:9); `warn`≡`gtdpro-2` and `success`≡`gtd` at token level; meanwhile no class color appears on the landing for its actual purpose. **Why:** class color is the brand's declared wayfinding system; spending it on status breaks the map. **Fix:** neutral/status hues for lifecycle, plain ink or dedicated podium tokens for ranks. → `/impeccable colorize`
- **[P2] One Red Rule over-spend + banned stripes.** Red = brand + action + state + "your championship" pill (repeated on 5 rows) + rank-1 + 4 side stripes + a red-tinted banner with a second red italic CTA. Well past 10%; red-as-wayfinding vs red-as-action is ambiguous. **Fix:** neutralize repeated championship pills, remove stripes, demote hero CTA to secondary when the banner shows. → `/impeccable quieter`
- **[P2] No absolute lock time.** Countdown-only everywhere; a player planning their week must convert "7d 15h 41m" by hand. **Fix:** one mono line under the countdown: "SAT JUL 30 · 11:05 AM CT". → `/impeccable clarify`

## Persona Red Flags

**Jordan (first-timer):** no explanation of fantasy motorsport anywhere logged-out; "PICKS LOCK IN", "R08", "2127.0 PTS" unexplained; giant CTA bounces to Google consent mid-curiosity; can't click any event to learn more.

**Casey (one-handed mobile):** nav + registration banner consume the entire first screen — countdown and calendar are 2+ screens down; two identical red register CTAs back-to-back; per-row countdown at ≈3.0:1 hard to read outdoors. Touch targets fine (44–48px).

**Race-weekend regular (project persona):** the two things they came for are compromised — lock time is relative-only, and the top-8 board never shows *their* rank unless they're in it (myRegistrationId only highlights a visible row). ROUNDS column reading "1" everywhere is noise; movement arrows absent after one scored round.

## Minor Observations

- Hero CTA has no hover state; its twin banner CTA does — and uses magic hex `#ff140d` instead of the `brand-2` token.
- Hero and calendar's highlighted row duplicate the same event/status/countdown in one viewport.
- Footer text overflows its box by 37px (detector-caught).
- After full lock the hero box reads "PICKS LOCK IN / LOCKED" — heading doesn't update.
- Blinking dot on "2026 REGISTRATION OPEN" brushes "no manufactured urgency" (reduced-motion is correctly handled globally).
- Empty accessible names reported on the two CTA buttons in the a11y snapshot — likely tooling artifact; verify with a screen reader once.
- "Rounds" leaderboard column spends space on near-zero information early-season.

## Questions to Consider

1. If class colors are load-bearing wayfinding, why is the landing the one place none appear as class identity — while two of them get spent on a status pill and a bronze rank?
2. The hero and the calendar's top row present the same event twice in one viewport — is the 420px hero earning its column, or should the calendar's top row *be* the hero?
3. Who is this page for in week 10? Should the signed-in landing pivot to "your rank, your delta, your next lock" instead of eight strangers' points?
