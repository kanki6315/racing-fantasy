---
target: main admin dashboard view (/admin Overview)
total_score: 14
p0_count: 2
p1_count: 3
timestamp: 2026-07-26T00-44-26Z
slug: src-routes-admin-overview-tsx
---
Target: the admin console's first screen — `/admin` → `src/routes/admin/Overview.tsx`, inside `src/admin/AdminLayout.tsx` (topbar + sidebar). Inspected live at `localhost:5173/admin` signed in as `dev-admin`, at 1440×900 and 1280×820, against the real local API.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | The screen's entire job. Steps 5–7 are hardcoded strings; Prices compares cars against driver prices and reports "all priced" when zero cars are priced; no loading state, no error state; the sidebar's "API · all systems go" dot is a literal. |
| 2 | Match System / Real World | 3 | Operator language is fluent ("Player Lock · Qualifying Start", RD 08, circuit names). But the same round is named two different things 100px apart, and "Publish · gated" names a concept that exists nowhere else in the console. |
| 3 | User Control and Freedom | 1 | No sign-out, no link back to the player app, wordmark is a `<div>`. 13 focusable elements, all of them in-console. Browser Back is the only exit. |
| 4 | Consistency and Standards | 2 | Visually very consistent with DESIGN.md. But the seven cards are named after the seven nav destinations and are inert — breaking the project's own "every row is a door, and says where it goes" rule. |
| 5 | Error Prevention | 1 | Nothing destructive lives here, but the screen *manufactures* operator error: "Scoring: not run" on a scored round invites a re-run; "Prices: all priced" invites shipping a round with no car prices. |
| 6 | Recognition Rather Than Recall | 2 | Named steps, counts, persisted context selection are good. But three of seven counts are fiction, so the operator has to visit each screen to learn true state anyway. |
| 7 | Flexibility and Efficiency | 1 | Zero interactive elements in `<main>`. No shortcuts, no quick actions, no jump-to-blocker. Every task is: read a card, move to the sidebar, click the identically-named link. |
| 8 | Aesthetic and Minimalist Design | 2 | Restrained, on-brand, contrast all ≥5.7:1. But 490px of a 900px viewport is empty, the loudest element is the least actionable, and it's a uniform 7-card grid — the project's own anti-reference. |
| 9 | Error Recovery | 0 | No error state exists. Forced 500s on the classes/entries/prices/sessions calls produced no user-visible signal at all; the fallbacks render as "no classes / none imported / not set". No retry. |
| 10 | Help and Documentation | 1 | No tooltips, no explanation of "gated", no docs link. Nothing surfaces the documented silent-failure mode (scoring no-ops without an Active ruleset). |
| **Total** | | **14/40** | **Poor — the visual layer is strong; the screen underneath it is hollow and misinforming** |

## Anti-Patterns Verdict

**LLM assessment.** This does not look AI-generated. The palette discipline is real, the mono-numeral treatment is specific to this product, the skewed broadcast slash is a genuine signature, and the type is committed. Nobody would say "AI made that."

They would say **"that's a mockup."** The tell isn't the aesthetic, it's the content: seven identically-sized cards, each icon-marker + heading + one line of micro-copy, three of which contain hardcoded placeholder strings (`'awaiting ingest'`, `'not run'`, `'gated'`) that never change under any data. That's the "identical card grids" ban from the shared rules and the "no identical icon-heading-text card grids" clause of your own PRODUCT.md anti-references, and it's the shape a screen takes when it was designed as a comp and shipped as a route.

**Deterministic scan.** `detect.mjs` on `Overview.tsx`, `AdminLayout.tsx`, `AdminPageHeader.tsx`, `ui.tsx` returned `[]` — clean, exit 0. No gradient text, no side-stripes, no clamp type, no eyebrow scaffolding. Contrast measured in-page across all 25 lowest-ratio text nodes: minimum 5.73:1 (`muted` 10px on `surface`). The detector and I agree the *surface* is clean; every finding below is behavioural, which is exactly what a static scanner can't see.

**Visual overlays.** Not injected. The dev server on :5173 belongs to another session and I reused it read-only rather than mutating a page another chat is driving; findings below are from direct DOM measurement and live API calls instead.

## Overall Impression

The chrome is the best thing here and the content is the worst. The topbar/sidebar shell is a genuinely good admin frame — the champ/season/round selectors as persistent global context is the right primitive, the Console/Governance split is a real IA decision, the broadcast styling survives the translation from player UI to ops tool without becoming decoration.

Then the page it frames tells the operator seven things about the round, and I can demonstrate that three of them are wrong. On VP Racing round 7 (Chevrolet GP, locked two weeks ago), the dashboard says **"Results: awaiting ingest"** and **"Scoring: not run"** — while `GET /rounds/6/scores` returns 4.4KB of scored picks with registration totals of 1300 points. On the same round it says **"Prices: all priced"** with a teal done-ring, while `GET /rounds/6/prices` returns 17 **Driver** prices and zero **Car** prices against 17 imported cars.

The single biggest opportunity: this screen already knows the operator's whole job and names all seven steps of it. Make the seven cards true, and make them doors. That's the difference between a status board and a wall poster of one.

## What's Working

- **Global context selection is the right architecture.** Champ → Season → Round in the topbar, persisted to localStorage, self-healing to the next-to-qualify round when a stored id goes stale (`AdminContext.tsx:44-89`). Every screen reads it. That's the hard part of a multi-championship console and it's done well.
- **The palette holds under pressure.** Teal for done, brand-3 for active, `line-2`/`muted` for todo — status hues deliberately offset from the class hues so a done-step can't be mistaken for GTD green. Every text node measures ≥5.73:1. The "One Red Rule" survives: solid red appears twice (header slash, active nav bar), everything else is a wash.
- **The lock band says the right sentence.** "lineups lock for all players when qualifying begins" is exactly the register PRODUCT.md asks for — it explains a consequence, not a mechanism, in one line, with the absolute timestamp beside the countdown.

## Priority Issues

### [P0] Three of the seven pipeline steps report state they never read

`Overview.tsx:90-92` hardcodes Results, Scoring, and Publish as `state: 'todo'` with fixed detail strings. They are `'awaiting ingest'`, `'not run'`, and `'gated'` on every round, forever — a round that finished, ingested, and scored two weeks ago renders identically to one that hasn't been created yet.

**Why it matters:** an operations console that misreports operational state is worse than one that reports nothing, because the operator acts on it. "Scoring: not run" on an already-scored round is an instruction to re-run scoring. In a console where the sidebar footer also claims "API · all systems go" from a hardcoded `bg-success` dot (`AdminLayout.tsx:146`), the operator learns the whole screen is decorative — which poisons the four steps that *are* real.

**Fix:** `useScores(round.id)` already exists in `adminQueries.ts:551` and returns exactly what steps 5 and 6 need — presence of results, presence of scores, count of scored registrations. Wire both. Delete step 7 or build the thing it names; there is no Publish screen in either nav group, so it is currently a step pointing at nothing. Delete the hardcoded health dot or wire it to a real `/health` probe. **`/impeccable harden`**

### [P0] "Prices: all priced" is computed from the wrong two numbers

`Overview.tsx:61-63` computes `unpriced = cars.length - prices.length`. `prices` is every priced *entity* for the round — cars and drivers both. On VP Racing round 7 that's 17 drivers and 0 cars against 17 imported cars, so the arithmetic lands on 0 and the step renders "all priced" with a done ring. Every car in the round is unpriced. The in-code comment (`// cars priced; drivers add to this once lineups exist`) shows the failure was anticipated and left in.

**Why it matters:** this is the one number on the dashboard that gates whether players can build a roster, and it fails in the direction that says "you're finished." It only reads correctly when nothing at all is priced, which is why it looks right on the WeatherTech round ("55 unpriced").

**Fix:** partition by `entityType` and report both tracks — `12/55 cars · 40/98 drivers priced` — or count distinct priced car ids against `cars.length`. While you're there: a step whose count is *partial* isn't `active` in the same sense as one that's `not started`; those want different marks. **`/impeccable harden`**

### [P1] Zero interactive elements in the entire page body

Measured: `main` contains 0 links, buttons, or controls. The whole console has 13 focusables — three selects and ten nav links. The seven cards are named `Catalog`, `Entries`, `Prices`, `Sessions`, `Results`, `Scoring` — six of them exactly matching a sidebar destination — and none of them navigates.

**Why it matters:** this is the screen's reason to exist. An operator arrives, learns "55 unpriced", and then has to move their eyes twenty degrees left and click a word they just read. Your own DESIGN.md makes this a named rule for the player UI ("Every row is a door, and says where it goes... Mystery-meat rows are forbidden") — the admin console has the inverse problem, doors that don't open.

**Fix:** make each step a link to its screen, and let the blocking one earn a real action. `55 unpriced → SET PRICES` as the page's one primary button is a better use of this screen than seven equal cards. The steps aren't equal — one of them is what the operator should do next, and the design currently refuses to say which. **`/impeccable craft`**

### [P1] The topbar overflows the viewport at 1280px

At 1280×820, `document.scrollWidth` is 1316 — 36px of horizontal page scroll. The avatar's right edge sits at x=1316, entirely off-screen; "League Operator" is clipped mid-word; the countdown wraps to three lines ("6d / 22h / 47m"). At 1440 it's not yet clipped but "Player Lock" and the countdown both already wrap to two lines inside a 56px bar.

**Why it matters:** 1280 is a MacBook Air's default scaled width. Admin-responsive being deferred is a reasonable call for phones; a horizontal scrollbar on a laptop is not the same decision. The identity block — the only place the console confirms *which account you're operating as*, on a screen with destructive governance actions one click away — is the part that falls off.

**Fix:** the round select is 309px of a 1280px bar rendering "08 · Motul SportsCar Endurance Grand Prix". Truncate it, drop the topbar countdown (the page repeats it 60px below, larger — see below), and give the bar a `min-w-0` + `truncate` discipline. **`/impeccable adapt`**

### [P1] No loading state and no error state anywhere in the console shell

`Overview.tsx:55-58` and `AdminContext.tsx:59-61` destructure only `data` with `= []` defaults from seven queries; `isLoading` and `isError` are never read. On a cold load the first paint is a fully-populated *wrong* pipeline — "no classes / none imported / not set" — before data lands. I confirmed the error path by forcing 500s on the classes, entries, prices, and sessions calls: the page produced no visible signal of any kind.

**Why it matters:** "the API is down" and "this round has nothing set up yet" render as the identical screen. For a console whose only job is reporting state, those must never be confusable. The product register asks for skeletons over spinners and this has neither.

**Fix:** skeleton the seven step cards at their real height, and give the page an error band that says which call failed with a retry. Note `AdminPageHeader` also renders "Select a round from the topbar to begin" during the pre-load window, which reads as a user instruction when it's actually a loading state. **`/impeccable harden`**

### [P2] The lock band is the loudest element on the page and stays loudest forever

A full-width brand-tinted band with the page's only icon, sitting directly under the h1, permanently. Post-lock it reads "PLAYER LOCK · QUALIFYING START / FRI, JUL 10, 19:45 / **LOCKED**" — on a round from two weeks ago, still the visual hero, while the actual work (results, scoring) sits below in identical grey cards.

**Why it matters:** it's informational, not actionable, and its urgency is inverted relative to its prominence. The topbar already carries the same countdown 60px above it, so the screen's most emphasized element is also its only duplicated one. "Calm under stakes" is a stated design principle; a permanent red band about an expired deadline isn't calm, it's noise the operator learns to skip.

**Fix:** let the band's weight follow the lock's proximity — loud inside the last 24 hours, a quiet line once it's history. Once locked, the hero slot belongs to whatever step is now blocking. **`/impeccable layout`**

## Persona Red Flags

**Alex (Impatient Power User)** — the target persona; this console *is* a power-user surface.
- Lands on `/admin` and the first screen has nothing to click. Learns within two visits to bookmark `/admin/prices` directly and never come back.
- No keyboard shortcuts. Switching round means mouse → select → scroll a 309px dropdown of long circuit names.
- No bulk view: "which of my six championships has an unpriced round this weekend?" is the actual question, and answering it means six manual champ-switches through the topbar. The console is single-round when the operator's job is cross-championship.
- Reads "Scoring: not run", re-runs scoring on an already-scored round, and now has to work out whether he double-scored it.

**Sam (Accessibility-Dependent)**
- Tab order is 3 selects → 10 nav links → end. No skip link, and none needed, because there is nothing in the body to skip to.
- One heading on the page (`h1`). "Round Setup Pipeline" is a `div` (`Overview.tsx:135`), so the page's only section is invisible to heading navigation. No `<header>` landmark — the topbar is a plain `div`.
- The lock countdown re-renders every second with no `aria-live` (correct — it would be intolerable) but also no static text alternative, so a screen-reader user gets the timestamp and never the remaining time.
- Positive: `:focus-visible` ring is global and applies, the selects are wrapped in real `<label>`s, decorative SVGs carry `aria-hidden`.

**The League Operator** (project-specific, from PRODUCT.md — runs catalog, prices, ingestion, and scoring for six championships on a desktop console)
- The system's one documented silent-failure mode — scoring no-ops without an Active ruleset for a source — is invisible here. `useScoringRulesets` exists and this screen already fetches four other things; the pipeline step called "Scoring" is the exact place that check belongs.
- No cross-championship view on the screen literally titled Overview. It's a Round Overview and the topbar even says so; the operator's week is six championships wide.
- There's no way out. No sign-out, no "back to the player site", wordmark isn't a link. After governance work on Users & Data, the only exit from an admin session is Back or editing the URL.
- Same round, two names, 100px apart: the selector says "07 · Chevrolet Grand Prix" (`round.name`), the subtitle says "RD 07 · Canadian Tire Motorsport Park" (`round.circuit ?? round.name`). Under time pressure that reads as a mis-selection.

## Minor Observations

- 490px of a 900px viewport is empty below the content — the screen is 46% used at the height it was designed for.
- Two `useCountdown` instances run two independent 1s intervals, re-rendering the whole topbar and page every second to update a display that changes by the minute for 99.9% of its life. `useNow`'s own doc comment says to pass 60000 for exactly this case.
- The seven-step grid is `grid-cols-2 lg:grid-cols-4`, so seven items land as 4+3 with a hole. A 7-step linear process rendered as a ragged grid loses the sequence the numbering is asserting.
- Step 4 (Sessions) is `'todo'` when empty while steps 1–3 are `'active'` when empty — same condition, different mark, no reason.
- `EmptyState` exists in `admin/ui.tsx:128` with a dashed border; the "No round selected" state hand-rolls a different solid-bordered box instead.
- "Publish · gated" is the only step with no screen, no data source, and no definition anywhere in the console.

## Questions to Consider

- What does an operator actually open this at 8am on a race Saturday to find out? If the answer is "which round needs work and what's blocking it", this screen is scoped to the wrong noun — it's round-scoped, and the question is season-scoped.
- Should the seven steps be a grid at all? They're a sequence with a current position and one blocker. A grid says "seven peers"; the truth is "four done, one blocking, two waiting."
- What's the honest version of "API · all systems go"? Either it's a real probe worth building — an ops console is the one place a health indicator earns its keep — or it shouldn't be on screen.
- If this screen had exactly one button, what would it be? The answer changes hour by hour, and a dashboard that can name it is worth ten that can't.
