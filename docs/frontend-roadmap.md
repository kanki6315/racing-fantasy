# Frontend Build Roadmap — React / TypeScript

**Status:** Accepted — F0–F4 done; **F5 player UI complete (images + responsive + a11y); admin-responsive + deploy remaining** (updated 2026-06-18)
**Date:** 2026-06-17
**Related:** [README](README.md) (stack), [roadmap.md](roadmap.md) (backend),
[ADR-0004](adr/0004-authentication-and-data-minimization.md) (auth + the name/email amendment),
[ADR-0006](adr/0006-roster-modifiers.md) (roster modifiers)

> **Superseding note (2026-06-18).** This doc predates [ADR-0006](adr/0006-roster-modifiers.md):
> wherever it says **IMPACT** / bonus-driver / roster `{main, impact}` (Design mapping, F2), that slot
> was removed and replaced by free per-round **roster modifiers** (MAIN picks + a Bonuses panel;
> Double Points Team is the first). The phase *goals/sequencing* still hold — only the IMPACT naming is
> historical. **F0–F4 are complete; F5 status is in the F5 section below.**

> **Revision note (2026-06-17).** Reconciled against the bespoke designs (handoff
> bundle: Landing, Dashboard, Pick) and the *actual* API contract. Three things
> changed since the first draft: (1) **auth is already built** in the backend
> (cookie session + Google OIDC + dev-login), so F1 is no longer gated on backend
> work; (2) several design numbers aren't backed by the API and will be **mocked
> behind a swappable seam**; (3) two small **backend-prep** changes (identity,
> roster-rules) land just-in-time before the phases that need them. See
> [Design mapping](#design-mapping), [Backend prep](#backend-prep-just-in-time), and
> [Resolved decisions](#resolved-decisions).

The backend MVP (Phases 0–5) is feature-complete and exercised on real IMSA data.
This roadmap builds the React/TS frontend on top of that API. Same sequencing
philosophy as the backend: integrity-critical, highest-value surfaces first;
utilitarian surfaces can lag behind scripts/Swagger.

## What we're building on

- **A typed API.** ASP.NET Core emits OpenAPI → we generate a typed client, so the
  frontend gets the backend's DTOs and enums for free (no hand-written types).
- **Two audiences.** **Player** (register, pick, view standings) and **Admin**
  (catalog, prices, ingestion, scoring). Different surfaces, possibly different
  builds later; one app with role-gating to start.
- **The roster builder is the soul of the product** — cap math, per-class
  composition, the lock countdown. It's the screen worth the most design care.

## Auth: already built (no longer a blocker)

The first draft assumed the backend had no authentication. **It does now** — per
[ADR-0004](adr/0004-authentication-and-data-minimization.md): cookie session
(`imsa.session`), Google OIDC, and a Development-only `dev-login`. So F1 shrinks
from "may require backend auth work" to **wiring the existing cookie session into a
thin `AuthContext`** (Google button → `GET /auth/login`, plus a dev-login affordance
for local play). The only backend auth change we *are* making is additive — storing
name/email — see [Backend prep](#backend-prep-just-in-time).

## Design mapping

The handoff bundle gives three bespoke screens in one racing-broadcast design
language (Saira / Saira Condensed / Spline Sans Mono; near-black surfaces; the
**class-color palette** — GTP red, LMP2 blue, GTD PRO amber, GTD green — as a
load-bearing token; skew/stripe/pit-lane motifs).

| Design | Maps to | Notes |
|---|---|---|
| **Landing** (public) | F0/F2 entry | championship strip, next-round countdown, season calendar, global leaderboard + stat tiles *(tiles mocked)* |
| **Dashboard / "My Team"** | F3 | your-picks-per-series cards, leagues table, discover-public-leagues |
| **Pick Screen** | **F2 (the soul)** | top-down pit-lane MAIN (1 car/class) + IMPACT bonus drivers, cost-cap bar, class pills, lock countdown, selection panel |

Design ↔ API alignment is clean for the integrity-critical parts (roster
`{main, impact}`, cap, composition, lock). The gaps are decorative stats — see below.

## Backend prep (just-in-time)

Two small backend changes land right before the frontend phase that needs them;
each ends with an **OpenAPI regen** so the typed client stays in sync.

- **B1 — Identity (unblocks F1).** Add nullable `Name`/`Email` to `app_user`
  (keep `(provider, subject)` as the key); request `email`+`profile` scopes and
  populate from the id_token on first login; `dev-login` accepts optional
  name/email; `/auth/me` returns name/email to the holder; the **league**
  leaderboard gains a `name` field shown **only to members of private leagues**
  (public/global stay teamName-only; email always private); extend erasure/export
  to the new PII. Recorded as an [amendment to ADR-0004](adr/0004-authentication-and-data-minimization.md).
- **B2 — Roster rules (unblocks F2).** Extract composition validation into a
  **shared resolver** (season `RosterRule` ∩ classes running at the round, already
  derived from `Session` rows); add `GET /rounds/{id}/roster-rules` →
  `{ salaryCap, classes:[{classId,name,slot,min,max}], impact:{min,max} }` via that
  resolver (so the live pills can never disagree with submit-time validation); add
  `Round.SalaryCap` (migration + backfill), read the cap from the round in roster
  GET/PUT, and drop `salaryCap` from `POST /registrations`. This aligns the code
  with the already-documented "per-round salary cap" model.

## Resolved decisions

1. **Auth** — wire the existing cookie session; thin `AuthContext`; Google button +
   dev-login. (Backend auth already exists; no managed-auth provider needed.)
2. **Designs** — bespoke designs exist (handoff bundle). Build with **Tailwind +
   hand-rolled** components on a design-token layer; pull in Radix primitives only
   for accessible behaviors (dialog, tabs, combobox).
3. **Unbacked stats** (pick %, avg points, leaderboard trend, landing stat tiles) —
   **mocked client-side** behind a single typed `DemoStats` seam, visually marked as
   not-yet-real, swappable to real endpoints later.
4. **API client** — `openapi-typescript` + `openapi-fetch` with hand-written
   TanStack Query hooks (own the query-key layer rather than fight a generator).

## Tech foundation

| Concern | Choice | Why |
|---|---|---|
| Build/tooling | **Vite + React + TypeScript** | Decided in stack; fast, static output for an S3 + CloudFront origin |
| Server state | **TanStack Query** | Caching, mutations, invalidation — fits a read-heavy API with a few critical writes |
| Routing | **React Router** | Standard; supports role-gated routes |
| API client | **Generated from OpenAPI** (orval → typed React Query hooks, or openapi-typescript + openapi-fetch) | End-to-end types from the .NET DTOs; no drift |
| Forms/validation | **react-hook-form + zod** | The roster builder and admin forms need real validation; mirror server rules for UX |
| Styling/components | **Tailwind + a headless component lib** (shadcn/ui / Radix) *unless designs dictate otherwise* | Clean accessible defaults fast; easy to restyle to a design |
| Hosting | **S3 + CloudFront** (static) | Same AWS account as the image bucket; see [infra/deploy.md](infra/deploy.md) |

## Phases

### F0 — Foundation & scaffolding
**Goal:** the app builds, is typed against the API, and renders live data.
- Scaffold `apps/web/` (Vite React TS) alongside `apps/api/` in the monorepo.
- Wire Router, TanStack Query, the generated API client, env config (API base URL), base layout/nav.
- Styling baseline + CI + static hosting deploy (S3 + CloudFront).
- **Exit:** deployed shell that lists championships from the live API.

### F1 — Identity / auth *(gated on the auth decision)*
**Goal:** the app knows who you are and your role.
- `AuthContext`, login flow, session persistence, role-gated routes (player vs admin).
- **Exit:** a user can sign in; protected routes enforce role.
- ⚠️ May require backend auth work depending on the chosen approach.

### F2 — Player core: the roster builder *(highest value)*
**Goal:** a registered user builds, validates, and submits a legal roster before lock.
- Championship browse + season registration (`POST /registrations {seasonId, teamName}` — cap is per-round now, not chosen at signup).
- Round view with the **prices board** (pickable cars/drivers per class) and the
  resolved **roster-rules** (`GET /rounds/{id}/roster-rules` → cap + per-class min/max).
- **Roster builder:** select MAIN + IMPACT picks; **live cap math**; **live
  composition validation** driven by the roster-rules spec (same resolver the server
  validates with — server stays source of truth); submit `PUT roster` with real error
  handling (409 locked, 422 cap/composition with the named violations we return).
- **Lock countdown** (client-side from `quali_start`); read-only after lock.
- **Exit:** legal roster submitted before lock; blocked at/after lock with clear messaging.

### F3 — Player results: scores & standings
**Goal:** a user sees their points and rank.
- Round scores breakdown (my picks, per-source points: quali / race / fastest-lap).
- Round leaderboard + season standings.
- **Exit:** scores and ranking visible and correct against the API.

### F4 — Admin console *(can lag; scripts/Swagger bridge it)*
**Goal:** run a full race weekend from the UI.
- Catalog CRUD (championship → season → class → round → session, entries, drivers, lineups, roster rules).
- Per-round **price setting** (bulk).
- **Imports with the stage→preview→commit flow** we built — the preview screen
  (matched/unmatched, computed positions, fastest-lap leaders) is a strong UI moment.
- **Scoring:** ruleset authoring, trigger score per round, review before relying on standings.
- **Exit:** an admin loads entries, sets prices, ingests results, and scores a round from the UI.

> **F4 build note (2026-06-18).** Shipped the "ready screens" batch: admin shell (`/admin/*`,
> `RequireAdmin` gated on the new `isAdmin` from `/auth/me`), **Overview**, **Catalog**
> (Championships/Seasons, Classes, Rounds, Sessions = full CRUD; Roster Rules read-only **at F4 — now a
> full editor, see the post-F4 note below**), **Entries**
> (Car Entries, Drivers, Lineups), **Price Board** (per-round bulk price upsert; last-round Δ is real,
> pick-% is the only mock), **Registrations** (real directory + CSV export; summary tiles are demo),
> **Users & Data** (directory + visibility tiers + real PII export download + type-to-confirm
> erasure), and a **read-only Results + Score Review** cut (CSV stage→preview→commit rendering the
> existing ingest payload; Score-Round trigger + per-registration breakdown). Backend prep: `isAdmin`
> on `/auth/me`; `.Produces<>` annotations across catalog/entries/users reads+writes; the ingestion
> preview/commit reshaped into a typed `IngestResponse`, and `/score` + `/scores` typed
> (`ScoreRoundResult`, `ScoresResponse`) — so the whole admin surface reaches the typed client.
>
> **Shipped post-F4 (2026-06-19), once deferred:**
> - **Roster Rules editing — DONE.** The Catalog "Roster Rules" tab is now a full editor: per-class
>   composition with a **This-round / Season-default** toggle (per-round overrides via the new nullable
>   `roster_rule.round_id`, layered on the season default, with reset-to-default) plus a season-scoped
>   **bonus-format** manager (curated dropdown: Double Points Team, Captain). `/roster-rules` +
>   `/roster-modifier-rules` got `.Produces<>` response typing + admin hooks.
> - **Class colors — DONE.** `class.color` (admin-set `#RRGGBB`, nullable) is editable in the Catalog
>   class form and threaded through `GET /rounds/{id}/roster-rules`; `classMeta(name, color?)` prefers it
>   and falls back to the name palette. Painted on the pick board + admin badges.
>
> **Still deferred within F4** (intentional, not gaps to discover later):
> - **Results / Score Review richer affordances.** A read-only cut shipped (stage→preview→commit,
>   issues-list, Score-Round trigger + breakdown). Still deferred — they need real backend work: the
>   per-row **interactive match-resolution** modal (backend model is fix-upstream-and-re-stage, not
>   in-UI resolve) and the **publish gate** (scoring is immediate; no hidden-until-published state).
> - **Registrations enrichment.** The admin Registrations table shows team + user id only (`RegistrationDto`
>   carries no league / per-round pick-status / joined date / status). Those columns + the Picks-Set and
>   Private-Leagues summary tiles are **demo** until a small admin-registrations enrichment endpoint lands.

### F5 — Polish & ship *(player UI done, 2026-06-18)*
**Goal:** shippable.
- **Images (S3 + CloudFront).** ✅ **Upload + display done.** Admin uploads driver headshots + per-round
  car liveries via a **presigned S3 PUT** (browser converts to **WebP**, uploads straight to S3;
  convention keys `liveries/{roundId}/{entryId}.webp` + `drivers/{driverId}.webp`, no DB; display base =
  `VITE_IMAGE_BASE_URL`). Player UI shows them via the shared **`EntityThumb`** (livery/headshot +
  class-tinted placeholder fallback) and **`DriverLineup`** (per-car co-driver list — names *and*
  headshots, the "driver lineup" the design had + pictures it didn't). Live on the Pick board (pit-lane
  cards + selection rows) and the Dashboard "Your Picks" cards. The selection board also orders cars by
  number and shows a per-row **class badge** for multi-class series.
- ✅ **Mobile/responsive** — every player page (Pick, Dashboard, Standings, LeagueStandings, Landing,
  ComingSoon) + shared chrome (`GlobalNav` two-row nav, `ChampionshipStrip`, `Leaderboard`). Tables use
  **card reflow** below `sm` (desktop keeps the grid); two-column layouts stack below `lg`.
- ✅ **Loading / empty / error + a11y** — global `:focus-visible` keyboard ring +
  `prefers-reduced-motion` reset (index.css); loading skeletons + error UI on Pick / Dashboard / Landing
  (Standings/LeagueStandings already had them); aria-labels (search, modal close, trend) + semantic
  headings. Modals use Radix Dialog (focus-trap/escape/aria).
- ⬜ **Admin responsive** — deferred; the admin console is desktop-only for now (admins aren't on phones).
- ⬜ **Production deploy** + API wiring + smoke test (web on S3 + CloudFront; API + Postgres on
  Railway). Runbook + prerequisites done: [infra/deploy.md](infra/deploy.md).
- **Exit:** a real user can play a round end-to-end on a phone. *(Met for the player loop; deploy is the
  last gate.)*

## Suggested MVP cut

**Player-first, admin-by-script.** Ship **F0 → F1 (minimal auth) → F2 → F3** and
keep admin (catalog/prices/ingestion/scoring) on the **API scripts + Swagger** we've
been using. That puts a *playable* product in front of users fastest; F4 (the
admin console) follows once the player loop is validated. Mirrors the backend's
"one championship, player loop first" cut.

Dependency note: F2 consumes data an admin produces (entries, prices, results).
During development that data is **seeded via the API scripts** we already use, so
F2 and F4 can proceed in parallel after F1 — F4 just replaces the scripts with UI.

## Open decisions

All open decisions from the first draft are now **resolved** — see
[Resolved decisions](#resolved-decisions) above (auth approach, designs/styling,
unbacked-stats handling, API client). No open decisions remain for the MVP cut;
new questions get appended here as they arise.
