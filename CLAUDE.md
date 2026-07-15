# IMSA Fantasy League

A motorsports fantasy app for the IMSA series. Users register per championship-season,
pick teams/drivers under a salary cap each round (picks lock at qualifying), and score on
**qualifying position + race position (MAIN)**, plus free per-round **roster modifiers** that
add **bonus** points (first: Double Points Team — one pick scores double; see [ADR-0006](docs/adr/0006-roster-modifiers.md)).
Standings run as a season-wide pool plus user-created public/private **leagues**.

## Status (2026-07-14)

- **Deployed + post-MVP increments merged to `main`:** the app is live (S3/CloudFront web, Railway API+DB);
  since the MVP, these shipped — **DB-backed admin-editable class colors** (`class.color`); an
  **editable Roster Rules admin tab** (per-round composition overrides via `roster_rule.round_id` + a
  curated bonus-format manager); **shared events** (ADR-0007, `event` parent above `round`); and
  **multi-championship support** (ADR-0008): the player UI is decoupled from a single "active"
  championship — event-driven Landing calendar, a `championship.sort_order` constant sort key, leaderboard
  **Championship → Year → Round** filters, and an event-level **`event.picks_open`** pick-release gate
  (admin toggle → calendar status → roster GET/PUT enforcement). All reflected in the API surface +
  known-gaps below. **Local dev DB is now PostgreSQL 18** (`docker-compose.yml`; volume mounts at
  `/var/lib/postgresql`) to match Railway.
- **Multi-race rounds (ADR-0013, merged 2026-07-14 — prod migration + API/web deploys pending):**
  a round can score N races (MX-5 two-race weekends) with one pick set and one lock —
  `session.race_number` + per-race `score.session_id` rows; race imports take `?raceNumber=`;
  the same Active RacePosition table prices each race; UI shows Q/R1/R2 chips. The scoring
  recompute also now **deletes stale scores** whose backing result disappeared (audited
  "removed"). ⚠️ Deploy the `AddMultiRaceRounds` migration and the new API **together** (the
  cleanup pass covers backfill leftovers).
- **Backend: MVP-complete and tested on real IMSA data** — Phases 0–5 of [docs/roadmap.md](docs/roadmap.md):
  schema, catalog CRUD + bulk import, economy/picks/lock, results ingestion, scoring engine,
  leaderboards. Plus **auth + data minimization** (ADR-0004), **authorization** (ownership + admin),
  and **leagues** (ADR-0005). **P6 (hardening) is the only deferred backend stage.**
- **Frontend: F0–F4 complete; F5 (polish/ship) — player UI shippable.** Player core (landing,
  registration, roster builder, scores/standings) and the **full admin console** (all 9 screens) are
  built and browser-verified. F5 is **done for every player page**: image display (liveries + driver
  lineups via shared `EntityThumb`/`DriverLineup`), **mobile/responsive** (table card-reflow), and
  **loading/empty/error + a11y** (global `:focus-visible` ring + `prefers-reduced-motion`, aria-labels,
  semantic headings). F5 remaining: **admin responsive** (deferred — desktop-only) and **production
  deploy**. (Image *upload* + display both done — see Images below.)
- **Auth is live:** Google OAuth is configured and working; admin allowlist resolves real Google
  subjects. Dev-login remains the local shortcut.

## Images (S3 + CloudFront)

Per-round car **liveries** and driver **headshots**, added 2026-06-18. Admin uploads via the console;
the player UI reads by convention. **Convention keys, no DB column:** `liveries/{roundId}/{entryId}.webp`
(entryId = globally-unique `CarEntry.Id`, so the player UI builds the URL straight from the price board's
`entityId`) and `drivers/{driverId}.webp`. Upload flow: API issues a **presigned S3 PUT** (`POST /admin/images/...`),
the browser converts the image to **WebP** and PUTs it straight to S3 (`Cache-Control: max-age=300, s-maxage=86400`);
bytes never touch the API. Display base URL is a frontend env var **`VITE_IMAGE_BASE_URL`** (CloudFront).
S3 config via user-secrets (`Aws:BucketName`/`Aws:Region` + optional `Aws:AccessKeyId`/`Aws:SecretAccessKey`).
Bucket is CloudFront-only (OAC); re-uploads use manual `aws cloudfront create-invalidation`. **Image
display has begun (F5):** the **Pick page** shows liveries/headshots via the shared `EntityThumb`
component (class-tinted placeholder fallback). Remaining display surfaces (Dashboard, standings,
admin) still pending.

## Email (SES): picks reminders + bounce handling

**Shipped + deployed 2026-07-03** ([ADR-0009](docs/adr/0009-picks-reminder-emails.md) reminders + its
amendment, [ADR-0010](docs/adr/0010-ses-bounce-complaint-handling.md) bounce/complaint handling).
**Two independently opt-in** picks-reminder emails per race weekend, both from the `PicksReminderService`
worker (clones `LockSweepService`; polls ~5 min): **PicksOpen** — sent when an admin opens the board
(`event.picks_open`), but only within `Reminders:PicksOpenWindowHours` (24h) of `event.picks_opened_at`
so it's never sent stale — and **PicksClosing** — ~24h before pick lock (`Reminders:HoursBeforeClose`,
before the event's earliest `round.quali_start`). The `event_reminder` claim table (unique
`(event_id, user_id, kind)`) guarantees single-send **per kind**. Rendered from an **MJML** template
compiled to an embedded `picks-reminder.html` (recompile with `npx -y mjml@4 …`), Gmail-safe. Sent via
**Amazon SES** (`SesEmailSender`, AWSSDK.SimpleEmailV2) from a **pure no-reply**
`Endurance Fantasy <no-reply@arjunakankipati.com>` (no Reply-To). **Kind-aware** one-click **unsubscribe**
(`GET/POST /email/unsubscribe`, HMAC token encoding `(user, kind)`) disables just that email +
`List-Unsubscribe` headers.

**Deliverability:** SES identity is the **root** `arjunakankipati.com` (DKIM + custom MAIL FROM on
`mail.` for SPF alignment + DMARC `p=none`); **shared IPs** (dedicated would hurt at this volume);
warm via consistent opt-in sends + Google Postmaster Tools. **Bounce/complaint** events flow via an
SES **configuration set → SNS → `POST /email/ses-events`** (SNS signature + topic verified), recorded
in `email_event` and (permanent bounce / any complaint) stamping `app_user.email_suppressed_at` — a
**system-level** suppression separate from the per-kind opt-in, excluded from the recipient query.
`event_reminder.ses_message_id` correlates an event back to its send.

**Preferences** are per-kind in the `email_preference(user_id, kind, enabled)` table (replaced the old
`app_user.email_reminders_enabled`). The UI (registration + dashboard) shows a client-side **all-emails
master** button + two DB-backed toggles (`EmailPreferenceControls`), always visible; the dashboard
toggle PUTs `/auth/me/email-preferences` (rate-limited 5/min → a `RateLimitModal` on 429), and the
registration modal seeds from current prefs (so joining a new series can't reset them).

**Config** (Railway, `__` separator): `Aws:Ses:{FromAddress,Region,ConfigurationSetName,EventsTopicArn}`,
`Reminders:{Enabled=true,ApiBaseUrl,UnsubscribeSecret}` (+ optional `HoursBeforeClose` /
`PicksOpenWindowHours`; `WebBaseUrl` falls back to `Web:Origin`). The worker idles and logs missing keys
until all are set.

## Repo layout

```
imsa-fantasy/                 ← monorepo root
├── CLAUDE.md                 ← you are here
├── docs/                     ← design docs (read these for depth)
│   ├── README.md             ← index + one-paragraph overview
│   ├── adr/0001..0005        ← architecture decisions (all Accepted)
│   ├── data-model.md         ← full ERD
│   ├── roadmap.md            ← backend build plan (Phase 6 = DEFERRED)
│   └── frontend-roadmap.md   ← React/TS build plan (F0..F5)
└── apps/
    ├── api/                  ← .NET backend (solution root)
    │   ├── ImsaFantasy.slnx
    │   ├── docker-compose.yml    ← local Postgres
    │   └── src/{Api,Domain,Infrastructure}/
    └── web/                  ← React + TS frontend (Vite); F0–F4 done, F5 in progress
        └── src/{api,app,admin,auth,components,routes,lib}/
```

## Stack

- **Backend:** .NET 10 modular monolith (ASP.NET Core minimal APIs), EF Core 10 + Npgsql.
  Requires the **.NET 10 SDK** (`net10.0`).
- **DB:** PostgreSQL (Docker for local). Tables/columns are **snake_case** (auto-convention in
  `FantasyDbContext`); enums stored as **text**.
- **Redis:** deferred — leaderboards are Postgres queries; hot reads use in-process `IMemoryCache`.
- **Frontend:** React + TypeScript (Vite) in `apps/web` — **F0–F4 done, F5 in progress** (typed client,
  Tailwind v4 tokens, Router, TanStack Query, live Landing; cookie-session `AuthContext` + Google/dev-login
  + gated routes incl. `RequireAdmin`; registration flow; roster builder at `/pick/:roundId` — MAIN-only
  picks plus a **Bonuses** panel (Double Points Team wired); full Dashboard with leagues; standings/
  leaderboards; and the **admin console** at `/admin/*` — Overview, Catalog, Entries, Prices,
  Registrations, Users & Data, plus read-only Results/Score-review). Dev board seeded via
  `apps/api/scripts/{seed,price}_dev_board.py`. Hosting: web on S3 + CloudFront; API + Postgres on
  Railway (Hobby); images on S3 + CloudFront. See [docs/infra/first-deploy.md](docs/infra/first-deploy.md)
  for the initial-provisioning runbook and [docs/infra/deploy.md](docs/infra/deploy.md) for routine
  redeploys (`pnpm deploy:web` — build → S3 sync → CloudFront invalidation).

## Run the backend locally

```bash
cd apps/api
docker compose up -d                                   # Postgres on :5432
dotnet ef database update --project src/Infrastructure --startup-project src/Api   # apply migrations
ASPNETCORE_ENVIRONMENT=Development dotnet run --project src/Api
# API listens on http://localhost:5239 (launchSettings). Health: GET /health
```
- **OpenAPI doc (Development):** `http://localhost:5239/openapi/v1.json` — the typed frontend client is generated from this.
- New migration: `dotnet ef migrations add <Name> --project src/Infrastructure --startup-project src/Api`.
- Reset dev data (it has accumulated test rows): `docker compose down -v && docker compose up -d` then re-run `database update`.

## Run the frontend locally

```bash
cd apps/web
pnpm install
pnpm dev            # Vite on http://localhost:5173; proxies /api → http://localhost:5239 (API must be running)
pnpm gen:api        # regenerate src/api/schema.d.ts from the live OpenAPI doc (API must be running)
pnpm build          # tsc typecheck + production build
```
- **Stack:** Vite + React + TS, Tailwind v4 (design tokens in `src/index.css` `@theme`), TanStack Query,
  React Router, `openapi-fetch` client (`src/api/client.ts`) typed off `src/api/schema.d.ts`.
- **Dev proxy** (`vite.config.ts`) makes the browser same-origin so the session cookie works without CORS.
- **Image display** needs `VITE_IMAGE_BASE_URL` in `apps/web/.env` (the CloudFront base URL); without it
  the upload helpers return null and slots fall back to a placeholder. Admin console is at `/admin/*`
  (needs an admin — Google sign-in as an allowlisted subject, or `POST /auth/dev-login?subject=dev-admin`).
- **Public stats are mostly API-backed now.** The dedicated **Stats page** (`/stats` → `routes/Stats.tsx`)
  reads `GET /rounds/{id}/stats` (public, lock-gated → `409 not_locked` until quali, cached 5 min) and shows,
  for a Champ → Year → Round selection, three **top-10** breakdowns — **Most Picked / Top Scorers / Best
  Value** — each filterable by **class**, plus a field-score + bonus-usage strip. The endpoint returns the
  **full per-entity breakdown** (`entities[]`: ownership %, points, price per picked car/driver) + all bonus
  kinds (`modifiers[]`); the client derives the top-10s and class filter. **Leaderboard movement (▲▼)** is
  real: `LeaderboardEntry.movement` (round-over-round cumulative rank delta, computed in
  `Standings.ComputeMovement`) drives the season + league season boards and the Dashboard league trend.
  **Still mocked** (in `src/lib/demoStats.ts`, via `<Demo>`): the admin price board's per-row pick %
  (`mockPickPct` — a pre-lock screen, where real ownership is deliberately hidden) and the
  registration/landing tiles.
- **End-to-end types:** the API annotates response schemas (`.Produces<T>()`), so request *and* response
  DTOs flow from `schema.d.ts` (`components['schemas']`). Re-run `pnpm gen:api` after API contract changes.
  (Catalog, entries, prices, users, ingestion, and scoring are annotated as of the F4/A4 passes; the
  **manual** entry-list endpoint (`POST /seasons/{id}/entry-list`) is the remaining un-annotated admin
  endpoint — the JSON import below is annotated.)

## Auth (read this before building the UI)

- **Cookie session** (`endurance.session`), set after Google OIDC sign-in. Google requests
  `openid email profile`; first login creates an `app_user` and stores `name`/`email` from the
  id_token (ADR-0004 **amendment 2026-06-17** — both private: name shows only to private-league
  members, email only to the holder; `team_name` is still the only public leaderboard identifier).
- **Google is configured and working** (`Authentication:Google:ClientId/ClientSecret` in user-secrets);
  real Google sign-in works. `/auth/me` returns `isAdmin` so the SPA can gate `/admin/*` (server still
  enforces the `Admin` policy).
- **Admin allowlist** is `Authentication:AdminSubjects` — `["dev-admin"]` **plus the real Google
  `sub`** for the live admin — in `appsettings.Development.json` (NOT user-secrets; `appsettings.json`
  base is empty). Both `/auth/me.isAdmin` and the `Admin` policy check the `sub` claim against it at
  request time. For production, set `AdminSubjects` via host config/secrets.
- **Dev-login (Development only):** `POST /auth/dev-login?subject=<any-string>` issues the session
  cookie without Google (optional `&name=&email=` mirror the Google claims; defaults synthesized).
  `subject=dev-admin` is an admin. ⚠️ Running dev-login with a *real* Google account's subject (no
  name/email) overwrites that user's profile with synthesized defaults — don't.
- **Auth endpoints:** `GET /auth/login` (Google challenge), `GET /auth/me`, `POST /auth/logout`.
- **Authorization tiers** (ADR-0004/0005):
  - *Public:* leaderboards, `GET /rounds/{id}/prices`, **catalog reads** (`GET` on championships /
    seasons / rounds / classes — browse before login), health, `/auth/*`.
  - *Player* (any authenticated user): register, **own** roster (ownership-checked → 403 otherwise),
    league create/join/leave/view.
  - *Admin* (`Admin` policy): all catalog CRUD, price writes, ingestion, scoring, ruleset authoring,
    registration cap/list, user erasure/export.

## API surface the frontend will use

- **Identity:** `/auth/me`, `/auth/login`, `/auth/logout`.
- **Register:** `POST /registrations { seasonId, teamName }` (player; user from cookie). `teamName`
  is the **only public identifier** shown on leaderboards. (Cap is per round now — not chosen here.)
- **Championships & calendar (ADR-0008):** `GET /championships` returns each series with `order` (the
  `sort_order` constant key; the list is ordered by it then name — used everywhere championships are
  listed). The unified Landing calendar reads `GET /events` (public; ADR-0007), now decoupled from any
  single "active" championship; each event carries **`picksOpen`** (the admin pick-release gate) and its
  rounds with `championshipOrder`. `POST/PUT /events` accept `picksOpen`; the admin Events screen toggles it.
  Events also carry two manual, display-only lifecycle flags **`scored`** + **`finalized`** (ADR-0008
  amendment): the player Dashboard **and** the Landing calendar derive a **five-stage status** (Waiting →
  Picks Open → In Progress at first-round quali → Scored → Closed) via the shared `deriveEventStatus()`
  helper (`apps/web/src/lib/eventStatus.ts`) — on the Dashboard Waiting/Closed are hidden and the card badge
  is live (not hardcoded); the Landing calendar keeps its bold pill vocabulary (WAITING="COMING SOON",
  CLOSED="COMPLETE"), collapses the past to one most-recent-finalized anchor, and is height-bounded to fit
  ~4 events. `finalized` retires a weekend from the Dashboard; `scored` shows a Scored badge so players can
  review locked picks. Neither gates standings.
- **Selection board:** `GET /rounds/{roundId}/prices` (public; cars + drivers + prices + display names).
  Each **car** item also carries its **driver lineup** (`drivers: [{ id, fullName }]`, co-drivers ordered
  by entry-driver id) and its race **`number`** (null for drivers). The pick board shows the lineup +
  headshots, **orders cars by number** (numeric-aware), and renders a **per-row class badge** for
  multi-class series (color from `classMeta`).
- **Roster rules:** `GET /rounds/{roundId}/roster-rules` (public) → `{ salaryCap, classes:[{classId,name,color,slot,min,max}], modifiers:[{kind,maxCount,appliesTo}] }`,
  the resolved cap + composition + available **bonus modifiers** (season rules ∩ classes running this
  round; ADR-0006). Drives the cap bar + live pills; the **same resolver** backs the PUT validation.
  Composition resolves **per-round overrides over season defaults**: `roster_rule.round_id` is nullable
  (NULL = season default; set = a per-round override of that class's count), and the resolver prefers a
  round override over the default per class. `class.color` (admin-set `#RRGGBB`, nullable) rides along so
  the player UI can paint badges from the stored color (fallback: name palette in `classMeta`).
- **Roster (the pick page):** `GET/PUT /registrations/{registrationId}/rounds/{roundId}/roster`
  body `{ main:[{entityType,entityId}], modifiers:[{kind,target:{entityType,entityId},params}] }`.
  PUT validates lock (409) + **event pick-release** (`409 not_open` when the round's `event.picks_open`
  is false; ADR-0008) + cap (422, from the round) + class composition + modifier selection (422,
  violations named) in one transaction. Modifiers are **free** (no salary). GET returns `picksOpen` so
  the pick page disables upfront (neutral "PICKS NOT OPEN" state, distinct from the quali "LOCKED").
- **Scores/standings:** `GET /rounds/{id}/scores` (admin), `GET /seasons/{id}/leaderboard` (global, public),
  `GET /rounds/{id}/leaderboard`. The Standings page composes these behind a **Championship → Year → Round**
  filter (ADR-0008); the Total | round sub-filter (`RoundFilter`) is shared with league boards.
- **Multi-race rounds (ADR-0013):** a round may carry several Race sessions per class, distinguished by
  `SessionDto.raceNumber` (admin session CRUD validates Qualifying ⇒ 1). Race-results and race-fastest-laps
  imports take **`?raceNumber=`** (default 1; wrong target → per-row "no race #N session" issues). Score
  DTOs carry `raceNumber` per RacePosition row, and the scores/picks responses carry a server-derived
  **`raceCount`** so clients label R (single-race) vs R1/R2 without inferring from sparse data. Scoring
  (`POST /rounds/{id}/score`) emits one RacePosition row per race session and **deletes stale rows**
  whose backing result disappeared (`scoresDeleted` in the response; audited "removed").
- **View another player's picks (standings drill-in):** `GET /registrations/{registrationId}/rounds/{roundId}/picks`
  (any signed-in user — **no ownership check**, unlike the roster GET; gated on lock → `409 not_locked` until
  quali starts so lineups can't be copied early). Returns `{ teamName, total, raceCount, main:[{entityType,entityId,
  classId,price,points,scores:[{source,points,ruleVersion,raceNumber}]}], modifiers:[{kind,target,points}] }` —
  reuses the same `Score`/`RoundTotal` data as the admin scores endpoint. On the player UI, **round-board**
  leaderboard rows link to the read-only `/standings/team/:registrationId/round/:roundId` page (Total-view rows
  don't); it reuses the pick page's pit-lane look (`EntityThumb`/`DriverLineup`) with points + Q/R1/R2 breakdown.
- **Leagues:** `POST /leagues`, `GET /leagues?seasonId=&mine=`, `GET /leagues/{id}`,
  `POST /leagues/{id}/join?joinCode=`, `POST /leagues/{id}/leave`, `DELETE /leagues/{id}`,
  `GET /leagues/{id}/leaderboard[?roundId=]` (private = members-only; `roundId` narrows to a single round).
- **Entry-list JSON import (admin — ADR-0011):** `POST /rounds/{roundId}/entry-list/import` takes the
  broadcast-prep parser's JSON (one file per series per event) verbatim; `?dryRun=true` previews
  (counts, new-driver list, warnings — series/year mismatch, unknown rating/marker), then the commit
  re-sends the identical payload; `?createMissingClasses=true` creates unknown classes from
  `class_code`/`class_order`. Writes **per-round lineup rows** (`entry_driver.round_id` +
  rating/slot_order/rookie/coach; NULL = season-wide, round rows preferred by the price board and
  scoring) and `car_entry.car_model`/`bronze_cup`. Admin UI: Entries → Car Entries → **Import JSON**
  (targets the topbar-selected round). TBD seats are skipped; re-import converges.
- **Images (admin):** `POST /admin/images/liveries/{roundId}/{entryId}` and
  `POST /admin/images/drivers/{driverId}` → `{ key, uploadUrl }` (presigned S3 PUT; browser converts to
  WebP and PUTs directly). Player UI builds display URLs by convention from `VITE_IMAGE_BASE_URL` (see
  Images section above) — no read endpoint.
- **Email (ADR-0009/0010):** per-kind opt-in — `POST /registrations` carries `emailPreferences[]`;
  `/auth/me` returns `emailPreferences` (`[{kind,enabled}]` for both kinds); `PUT /auth/me/email-preferences`
  `{kind,enabled}` (rate-limited) upserts one. `GET/POST /email/unsubscribe?token=` (public, HMAC token
  encoding `(user,kind)`) disables just that kind. `POST /email/ses-events` (public) ingests SNS-delivered
  SES bounce/complaint events (signature-verified). See the Email (SES) section above.

## Conventions

- Minimal-API endpoints grouped per resource in `src/Api/Endpoints/*Endpoints.cs`, mapped in `Program.cs`.
- JSON enums are **strings** (e.g. `"Qualifying"`, `"Private"`).
- DB constraint violations surface as clean 409/422 via `ProblemExceptionHandler`.
- Tests so far are ad-hoc Python scripts against the running API (`/tmp/*.py`); no automated test suite yet.

## Known gaps / next steps

- **Multi-race rounds (merged, NOT deployed — ADR-0013):** prod needs the `AddMultiRaceRounds`
  migration (`dotnet ef database update`) **in the same Railway deploy as the new API** — the
  scoring recompute's stale-score cleanup covers any backfill leftovers — then `pnpm deploy:web`.
  Player note worth sending: Double Points Team / Captain now double the full Q+R1+R2 total on
  multi-race weekends. Deferred: per-race quali (R2 grids are set by R1 results, not a second
  quali — fine for MX-5); per-race columns in admin Score Review (it keeps one summed Race column;
  the response already carries `raceNumber` when a drill-down is wanted).
- **Email reminders + bounce handling (done, deployed — ADR-0009/0010):** see the Email (SES) section.
  Follow-ups: the **opt-in UI** (RegisterModal/Dashboard) ships via `pnpm deploy:web` (S3/CloudFront),
  **separate** from the API's Railway deploy — deploy web for it to be live. Domain is **warming** (first
  sends may hit spam though SPF/DKIM/DMARC pass — monitor Google Postmaster Tools). Deferred: suppress-after-N
  transient bounces + surfacing suppression in the account UI; a DLQ if guaranteed event capture is needed.
- **Catalog read access (done):** `GET` on championships / seasons / rounds / classes is **public**;
  their writes — and all of sessions / car-entries / drivers / entry-list / ingestion — remain Admin.
  The pick board reads the public `GET /rounds/{id}/prices` (carries display names + class).
- **F5 in progress** — **all player pages are responsive** (Pick, Dashboard, Standings,
  LeagueStandings, Landing, ComingSoon; shared `GlobalNav`/`ChampionshipStrip`/`Leaderboard`). Tables
  use **card reflow** on mobile; Dashboard "Your Picks" reuses `EntityThumb` + `DriverLineup`. The
  **loading/empty/error + a11y pass is done** for player screens (global `:focus-visible` ring +
  `prefers-reduced-motion` in index.css; loading/error states on Pick/Dashboard/Landing; aria-labels +
  semantic headings). Remaining for a shippable MVP: **admin responsive** (untouched — desktop-only for
  now) and **production deploy**.
- **Multi-championship support (done — ADR-0008):** player UI decoupled from a single "active"
  championship; `championship.sort_order`, event-driven calendar, `event.picks_open` gate, leaderboard
  Championship → Year → Round filters. **Event lifecycle (done — ADR-0008 amendment):** both the Dashboard
  and the Landing calendar derive a five-stage status (Waiting/Picks Open/In Progress/Scored/Closed) from
  `picks_open` + first-round quali + the manual `event.scored`/`event.finalized` flags via the shared
  `deriveEventStatus()` helper (`apps/web/src/lib/eventStatus.ts`), so past weekends retire and badges are
  honest instead of hardcoded. The Landing calendar ("Upcoming Events") also **collapses the past** to a
  single most-recent-finalized anchor and is **height-bounded** to fit up to 4 events (measured, via
  `useElementSize`; the "Closed" pill reads "COMPLETE"). **Follow-ups (deferred):** series-specific
  registration call-outs (registration still defaults to the order-first season); the event-driven calendar
  omits standalone (no-event) rounds by design; a "still closed near first quali" admin warning. See
  ADR-0008 *To revisit*.
- **Admin richer affordances (deferred):** ingestion has an *issues-list* preview (no interactive
  per-row match resolution); scoring has no *publish gate* (standings are live once scored). Both
  need new backend — see the F4 build note in [docs/frontend-roadmap.md](docs/frontend-roadmap.md).
- **Registrations admin table** shows team + user id only; league/pick-status/joined columns + the
  summary tiles are **demo** until a small enrichment endpoint lands.
- **Roster Rules admin tab is a full editor (done):** per-class composition with a **This-round /
  Season-default** toggle — round overrides layer on the season default (`roster_rule.round_id`), with
  reset-to-default — plus a season-scoped **bonus-format** manager (curated dropdown: Double Points Team,
  Captain). Adding a bonus *kind* beyond those needs a scorer first (`ModifierScoring.cs`).
- **Ruleset-level scoring bonuses** (pole, beat-teammate via `scoring_bonus`) are modeled but **not
  implemented** — position/rank points only. (Distinct from per-player **roster modifiers**, which
  *are* implemented and score as a `Bonus` source — ADR-0006.)
- **IMPACT / bonus drivers removed (ADR-0006):** replaced by free per-round roster modifiers. The
  `RaceFastestLap` scoring source + `race_fastest_lap` table are retained **dormant**; per-driver
  fastest lap still comes from the Al Kamel "Time Cards" race JSON, not the standard results CSV.
- **Class identity colors are DB-backed and admin-editable (done).** `class.color` (nullable `#RRGGBB`,
  validated server-side) is editable in the admin Catalog class form. `ClassDto` and the public
  roster-rules class entries carry it; `classMeta(name, color?)` (`apps/web/src/lib/classMeta.ts`) prefers
  the stored color and falls back to the name-keyed GTP/LMP2/GTD PRO/GTD palette when null. Honored on the
  player pick board and admin Catalog/Entries/Prices badges (the ingestion preview stays on the fallback).
- **Class sort order is DB-backed and admin-editable (done).** `class.sort_order` (int, default 0;
  mirrors `championship.sort_order`) sets class display order. `GET /classes` and the roster-rules
  resolver order by it then name, so the pick board, the standings **picks view**, and admin all show
  the racing order (GTP, LMP2, GTD PRO, GTD) instead of alphabetical. Editable via the admin Catalog
  class form (Order field). ⚠️ Existing rows default to 0 (alphabetical) until an admin sets values;
  prod needs `dotnet ef database update` (migration `AddClassSortOrder`).
- **Phase 6** (observability/hardening) is intentionally **deferred** — see roadmap.

## Design docs to read for depth

Start with [docs/README.md](docs/README.md). For frontend work: [docs/frontend-roadmap.md](docs/frontend-roadmap.md)
(phases F0–F5, MVP cut, auth dependency) and [ADR-0004](docs/adr/0004-authentication-and-data-minimization.md)
(/ -0005 leagues) for the auth + team-name + league model the UI must reflect.

## Design Context (Impeccable)

Frontend design is governed by two root files in `apps/web/` (read before UI work):
- **[PRODUCT.md](apps/web/PRODUCT.md)** — strategic: register (**product**), users, purpose, brand
  personality (*precise, fast, premium* — between broadcast/telemetry and premium motorsport),
  anti-references (generic SaaS, DraftKings/betting, cluttered timing software, toy/cartoonish),
  and design principles.
- **[DESIGN.md](apps/web/DESIGN.md)** — visual system (Stitch format): North Star **"The Timing
  Screen"**, the near-black broadcast palette + class colors, Saira/Saira Condensed/Spline Sans Mono
  typography, flat-void elevation, and component specs. Machine-readable tokens mirror `src/index.css`.

The `/impeccable` skill (and its sub-commands) reads these. Visual variants run via `/impeccable live`
(configured in `apps/web/.impeccable/`).
