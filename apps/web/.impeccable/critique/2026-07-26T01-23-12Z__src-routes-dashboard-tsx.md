---
target: apps/web/src/routes/Dashboard.tsx (player hub)
total_score: 21
p0_count: 1
p1_count: 4
timestamp: 2026-07-26T01-23-12Z
slug: src-routes-dashboard-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | A `SCORED` weekend shows a lineup and **no points**. League Position/Trend render `—` with no explanation. `Join` gives no success, error, or per-button pending feedback. |
| 2 | Match System / Real World | 3 | Racing vocabulary is fluent. But "Sub all" reads as *substitute* in a fantasy-sports context, and `2×`/`C` bonus badges explain themselves only through a `title` tooltip. |
| 3 | User Control and Freedom | 3 | Radix modals give Esc/Cancel/focus-trap. Joining a public league is one irreversible click with no confirm and no leave path from this page. |
| 4 | Consistency and Standards | 2 | Three solid-red italic CTAs (One Red Rule allows two, Italic-Restraint allows one). `#ffc23d` — GTD PRO amber — hardcoded on the bonus badge, breaking the Class-Color Reserve. Zero use of the project's own `pointer-coarse:` touch-target convention. |
| 5 | Error Prevention | 2 | `Create League` silently binds to `regs[0].seasonId`; the modal never names the championship. Discover is scoped to the same season with no label. |
| 6 | Recognition Rather Than Recall | 2 | Car names clipped at 150px (`#3 Corvette Racing by Pr…`, 42% hidden) with no tooltip. No class color on any pick, though `classId` is in the payload already fetched. Both explainer lines are `hidden sm:*` — absent on mobile. |
| 7 | Flexibility and Efficiency | 2 | No shortcuts, no collapse, no dismiss. Yesterday's scored weekend sits above today's deadline. Keyboard order runs 8 sidebar controls before the first pick action. |
| 8 | Aesthetic and Minimalist Design | 2 | The Broadcast Slash fires ~14× on one screen. `MY TEAM` (26px) out-sizes the page `h1` (22px). The rail carries 6 championship pills, a stat block duplicating the table below, and full email settings. |
| 9 | Error Recovery | 2 | `events.data ?? []` and `myLeagues.data ?? []` mean a failed request renders as a **successful empty state**. Roster errors offer no retry. `join.mutate` has no `onError` at all. |
| 10 | Help and Documentation | 1 | The only two explanatory strings are hidden below `sm`. Nothing explains scoring, bonuses, or what `—` in Position means. |
| **Total** | | **21/40** | **Acceptable — significant improvements needed** |

## Anti-Patterns Verdict

**Does this look AI-generated?** No. This is clearly hand-built against a real design system, and it shows: OKLCH-free token discipline, tight 3px corners, tabular mono numerals, a genuine motorsport voice. There is no gradient text, no glassmorphism, no hero-metric template, no eyebrow kickers, no cream SaaS surfaces. The product-register slop test — *would a user fluent in the category's best tools trust this?* — passes on look. It fails on **completeness**: this is a scoreboard hub that never shows a score.

**LLM assessment.** The failure mode here isn't generic-ness, it's **drift from the project's own written rules**. DESIGN.md is unusually specific, and the Dashboard breaks five named rules that other screens honour:

- *The One Red Rule* ("two solid-red spends per view; three means one is wrong"): `+ CREATE LEAGUE`, `MAKE PICKS →`, `MAKE PICKS →` = three, and the count scales with open weekends × registered series.
- *The Italic-Restraint Rule* ("italic only on the primary CTA"): all three are italic.
- *The Class-Color Reserve* ("never borrow a class color for a status or decoration"): the bonus badge is `style={{ background: '#ffc23d' }}` — that is `--color-gtdpro-2`, hardcoded past the token layer.
- *The Broadcast Slash* ("deliberate punctuation, not on every heading"): every sidebar pill, every championship row, every email toggle. ~14 instances.
- *Filter/pointer sizing* (`pointer-coarse:h-11`, the pattern DESIGN.md documents at length): unused. On mobile **every single control is under 44px** — `Make Picks` 38px, `Standings` 27px, `Join` 32×48px.

**Deterministic scan.** `detect.mjs` over `src/routes`, `src/components`, and `src/index.css`: **0 findings, exit 0.** The static source is clean.

The **runtime scan** (detector injected into the live page) found **24**:

| Finding | Count | Verdict |
|---|---|---|
| "Card inside card" | 8 | **Real.** Page → picks card → row → pick chip is three levels of bordered container. The shared bans call nested cards always wrong, and DESIGN.md calls the *row* "this product's real workhorse". This is the one player screen that went card-heavy. |
| "Cyan neon text on dark" | 7 | **False positive.** That is `--color-success` `#2dd4bf`, deliberately chosen and documented as offset from GTD green. |
| "uppercase on 33–36 chars of body text" | 5 | **Real.** `WEATHERTECH SPORTSCAR CHAMPIONSHIP` set uppercase wraps to three lines in a 268px rail. All-caps destroys word-shape recognition; it is why the sidebar costs ~430px. |
| "11px body text" | 2 | **Real, minor.** DESIGN.md's body step is 13px; 11px sans is below the scale. |
| "overflows its box by 111px" | 1 | **Real.** `#3 Corvette Racing by Pratt Mi…` — `scrollWidth` 261 vs `clientWidth` 150. |
| "repeating-gradient stripes on BODY" | 1 | **False positive.** `getComputedStyle(document.body).backgroundImage` is `none`; this is the detector's own overlay. |

**Independent contrast pass.** I walked every text node computing WCAG ratios against resolved backgrounds: **zero AA failures**. The Contrast Floor Rule is being kept. Credit where it is due.

**Visual overlays.** The detector was injected successfully into the live page (`http://localhost:5173/dashboard`) via `live-server.mjs` on :8400, which reported `24 anti-patterns found` to the console and mounted 47 overlay nodes. The live server has since been stopped, so the overlays are gone; the table above is the record.

## Overall Impression

The craft is real and the restraint is real. What's missing is the **point of the page**.

PRODUCT.md's first design principle is "Numbers are the interface." Its success criterion is players "coming back to watch their picks score and their league position move." On the populated dashboard I captured, there is **not one score, one point total, one rank, or one price** anywhere on screen. The scored Chevrolet Grand Prix card shows three cars and says `LOCKED` three times. The leagues table prints `—` in Position and `—` in Trend. The only numerals on the page are member counts.

And the page already has the data. `usePrices` returns `{ classId, price, displayName, drivers }` — 6.5KB per round, fetched five times — and the component uses `displayName` and `drivers`, discarding `classId` and `price`. The cost is paid; the design just doesn't spend it.

The second structural problem: **the page leads with the past.** Cards sort by `startsAt` ascending, so a finished, scored weekend renders above the one open weekend with a live lock. On mobile that's 1,400px of scroll before the primary action. The one thing a race-weekend player opens this page to do is the last thing they reach.

Biggest opportunity: make the SCORED card answer "how did I do?" and the OPEN card answer "how long have I got?", then order them so the deadline wins.

## What's Working

**The lifecycle derivation is genuinely well engineered.** `deriveEventStatus` as a single shared source of truth, the card ticking `useCountdown` so the badge flips from *Picks Open* to *In Progress* at the exact quali moment without a refresh, and the honest `AWAITING` decay so a stale admin flag can't lie — that's a level of state care most fantasy apps skip entirely. The dashboard's quiet pill dialect (tinted wash + hairline, sentence case) correctly stays distinct from the calendar's loud one.

**Contrast and dark-palette discipline.** Zero AA failures across the whole page, no `opacity` used as de-emphasis, `muted` respected as the text floor. The near-black broadcast canvas reads as premium rather than merely dark, and the surface ramp does the elevation work without a single resting shadow.

**The modals are the best-executed thing here.** `CreateLeagueModal` and `JoinByCodeModal` have the brand crown rule, desaturated-red disabled confirm instead of gray, real error copy ("try another name" / "that code didn't match a league"), a post-create success state that surfaces the invite code in 22px mono, and — notably — a proactive privacy notice that private-league members will see your real name. That last one is a genuine ethical detail nobody asked for.

## Priority Issues

### [P0] A failed request is indistinguishable from an empty season

`picksCards` iterates `events.data ?? []` and `leagues` is `myLeagues.data ?? []`. Neither branch checks `isError`. When `/events` fails, the player sees the empty state — "NO PICKS TO BE MADE" — and when `/leagues?mine=true` fails they see "You haven't joined any leagues yet."

**Why it matters:** the app confidently tells a player the season is quiet when in fact it has no idea. Under a lock deadline that is the worst possible failure: they close the tab, miss quali, and lose the round. It is also unfalsifiable from the user's side — nothing distinguishes it from the truth.

**Fix:** branch on `isError` before the empty state in both places, with a retry affordance (`refetch()`). The per-row roster error already models this correctly (`roster.isError` → "Couldn't load this lineup.") — extend that same treatment up to the page level, and give it a retry the row version also lacks.

**Suggested command:** `/impeccable harden`

---

### [P1] The scoreboard hub shows no score

The `SCORED` card renders the lineup you set and stops. No round points, no per-pick points, no season total, no league movement. Meanwhile `Position` shows `—/36` and `Trend` shows `—`, with nothing saying when those fill in.

**Why it matters:** this is the return-visit page for a product whose whole loop is "watch your picks score." PRODUCT.md: *"Numbers are the interface... let the figures carry the screen."* The page currently inverts that — the only numbers are the dimmest text on it (`font-mono text-[12px] text-muted` in the league stat rows). The endpoint that answers this already exists: `GET /registrations/{id}/rounds/{id}/picks` returns `total` plus per-pick `points`, and `TeamPicks.tsx` already renders it.

**Fix:** on a `SCORED` card, replace each row's `LOCKED` with the round total in mono, put per-pick points on the chips, and change the CTA from `View Lineup` to `View Results →`. In the leagues table, replace bare `—` with an explanatory state ("After round 1") rather than a dash that reads as a bug.

**Suggested command:** `/impeccable craft` (scored-state for the picks card)

---

### [P1] Three solid-red italic CTAs, and the loudest one is the least important

`+ CREATE LEAGUE` (46px, solid `brand`, italic, top-left in the rail) plus one `MAKE PICKS →` per open row — three on the captured page, and it grows with `open weekends × registered series`. DESIGN.md is explicit: two solid-red spends per view, italic on the primary CTA only, "if you can count three solid reds in a screenshot, one of them is wrong."

**Why it matters:** the eye lands on *Create League* — a rare, administrative action — while the actual deadline action sits below it and repeats. This is the same failure the standings page already fixed when five identical red CTAs got demoted to one muted annotation. Beyond the rule, it's a hierarchy inversion: the page shouts the thing that doesn't matter today.

**Fix:** demote `+ Create League` to the secondary/ghost treatment already used by `Join with Code` (they are peers). Keep solid red + italic for `Make Picks` — but only on the *soonest-locking* row; the rest take the secondary shape. That lands the page at exactly two red spends: the one primary action and the live-state pill.

**Suggested command:** `/impeccable quieter`

---

### [P1] Every touch target on mobile is undersized, in an app whose own system solved this

Measured at 375×812: `Make Picks →` 38px, sign-up pills 42px, email toggles 42px, `Standings` 27px, `Join` 32×48px. DESIGN.md documents the fix at length — `pointer-coarse:h-11`, registered via `@custom-variant` in `index.css`, with the reasoning that "a filter is a touch target before it is a label." The Dashboard uses none of it.

**Why it matters:** PRODUCT.md names the primary context as "race-weekend players... often mobile, often time-pressured." A 27px `Standings` target and a 32px `Join` target are misses waiting to happen, and `Join` is irreversible when it lands.

**Fix:** `h-[38px]` → `h-[38px] pointer-coarse:h-11` on the row CTA; give `Standings` and `Join` real boxes under `pointer-coarse`. The variant already exists; this is application, not invention.

**Suggested command:** `/impeccable adapt`

---

### [P1] On mobile, keyboard/screen-reader order is the reverse of visual order

The `<aside>` is the first DOM child and takes `order-last ... lg:order-first`. Below `lg` it renders visually last but is still read and tabbed **first** — 8 sidebar controls (My Team, six championship pills, Create League, Join with Code, three email toggles) before the first pick action.

**Why it matters:** WCAG 1.3.2 Meaningful Sequence and 2.4.3 Focus Order. A screen-reader user on a phone hears the entire settings rail before learning there is a weekend open. The visual choice — content first on mobile — is the right one; the implementation achieves it in CSS only.

**Fix:** render the two regions in content order and use `lg:order-first`-style ordering only where DOM and visual order already agree — or split the rail so the DOM sequence matches what the eye sees at every breakpoint.

**Suggested command:** `/impeccable audit`

---

### [P2] Dead-end CTAs and a status vocabulary that contradicts itself

Two rows on the scored card read "No picks yet for Canadian Tire Motorsport Park 120." and then offer a button labelled **`VIEW LINEUP`**. There is no lineup. Separately, the card badge says `SCORED` while all three rows inside say `LOCKED` — DESIGN.md warns never to let the two dialects disagree about a stage.

**Why it matters:** the button makes a promise the destination can't keep, and `LOCKED` under a `SCORED` header tells a player their picks are frozen when what they want to know is that results are in.

**Fix:** when `locked && picks === 0`, the row is a missed round — say so ("Missed this round") and make the control inert or point it at the results. When the card is `SCORED`, rows report points, not lock state.

**Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Alex (Impatient Power User)** — Opens the hub mid-week to set a lineup. Meets a finished weekend first and scrolls past ~950px of history to find `MAKE PICKS`. No keyboard shortcut, no collapse, no dismiss on the scored card. Tab from the top costs 8 keystrokes through the settings rail before reaching a pick action. Registered in three series, wants to set all three — there is no batch path and no "next lock" ordering. Will bookmark `/pick/:roundId` directly and stop opening the dashboard, which is exactly the retention loop the product depends on.

**Sam (Accessibility-Dependent)** — On mobile, hears the whole sidebar before "Your Picks" (DOM/visual order mismatch, above). The `2×` badge announces as "2×" with the meaning locked inside a `title` attribute that VoiceOver treats inconsistently and touch never surfaces. The registered-series rows carry a bare `<svg aria-label="Signed up">` with no `role="img"` — an accessible name on an element with an implicit `graphics-document` role, unreliably exposed. No `aria-live` anywhere, so league positions and lock statuses resolve in silence (the standings board does this properly — the pattern exists in-repo). Six `<div>` rows and three `<button>` rows in the same visual list means identical-looking items announce as different things.

**Casey (Distracted Mobile User)** — 3,477px document on an 812px viewport: 4.3 screens. `MAKE PICKS` sits at y≈1,470. `+ Create League` is at y≈3,050 — below every league and every discover card. Thirteen API round-trips to paint the body (5× roster, 5× prices at 6.5KB each, 3× leaderboard), all firing on mount with no skeleton — on a paddock 3G connection the page is a stack of "Loading lineup…" strings that shift as they resolve. Both explanatory sentences that would tell her what a lineup even *is* are `hidden sm:*` and never render on her phone.

**Marcus, the multi-series regular** *(project persona — PRODUCT.md's "season-long competitor", registered across several IMSA-adjacent series)* — Registered in three championships and browsing all six. The rail gives him six pills, three of them permanent amber sign-up prompts he has already declined, with no dismiss. He taps `+ Create League` and gets a modal that never names a championship; it silently binds to `regs[0].seasonId` (WeatherTech). `Discover Public Leagues` shows only that same season's leagues, also unlabelled — so his MX-5 friends' leagues are invisible and nothing tells him why. ADR-0008 decoupled the whole player UI from a single active championship; this page is where that decoupling stops.

## Minor Observations

- **"1 players · Public"** in the Discover cards — unguarded pluralization.
- **`disabled={join.isPending}` is shared across every Join button.** Clicking one greys out all three, and none of them change label or show a spinner. `join.mutate({ id })` has no `onError` — a failed join is completely silent.
- **`useCountdown(card.firstQuali)` ticks at 1000ms to drive a badge that changes once.** The helper's own doc comment names this case: *"a lock badge that only has to flip within the minute should say 60000 rather than re-rendering sixty times to change nothing."* Seven one-second timers on the captured page, each re-render rebuilding `bonusByPick` and the `itemOf` closure.
- **The `AWAITING` decay diverges between filter and badge.** `PicksCard` re-derives status from `rounds: [{ qualiStart: firstQuali }]`, so its `lastQuali` equals its `firstQuali`. For a weekend whose series qualify more than 72h apart, the badge can read *Awaiting Results* while the page-level filter computed `IN_PROGRESS`. The code comment claims the two "agree" — true for the open→locked flip, not for the decay.
- **`2026` in the rail subtitle comes from `regs[0]` alone.** A player registered across two years silently sees one.
- **No `tintHex` passed to `EntityThumb`,** so every placeholder renders neutral `#3a3f47` — the class-tinted fallback the component was built for never fires here.
- **11px `font-sans` in two places** ("One email each…", the header chip) sits below DESIGN.md's 13px body step.
- **The leagues stat block** (All 3 / Public 2 / Private 1) restates what the table two sections below already shows per-row.

## Questions to Consider

- If a player could see only one thing on this page, is it their lineup, or their **points**? The page currently shows the first and none of the second.
- What if the card order were **time-to-lock ascending** instead of `startsAt` ascending — so the thing with a deadline is always first and the archive always last?
- Does the left rail earn 268px of permanent desktop width? Registered series could be a strip above the picks; email preferences arguably belong on an account page, not the hub.
- The `SCORED` card and the `PICKS OPEN` card are the same component with a different badge. Should they be the same shape at all, when one is a receipt and the other is a deadline?
- What would a version of this page look like that a player checks **during** a race?
