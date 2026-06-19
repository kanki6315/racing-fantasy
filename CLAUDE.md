# IMSA Fantasy League

A motorsports fantasy app for the IMSA series. Users register per championship-season,
pick teams/drivers under a salary cap each round (picks lock at qualifying), and score on
**qualifying position + race position (MAIN)**, plus free per-round **roster modifiers** that
add **bonus** points (first: Double Points Team — one pick scores double; see [ADR-0006](docs/adr/0006-roster-modifiers.md)).
Standings run as a season-wide pool plus user-created public/private **leagues**.

## Status (2026-06-18)

- **Backend: MVP-complete and tested on real IMSA data** — Phases 0–5 of [docs/roadmap.md](docs/roadmap.md):
  schema, catalog CRUD + bulk import, economy/picks/lock, results ingestion, scoring engine,
  leaderboards. Plus **auth + data minimization** (ADR-0004), **authorization** (ownership + admin),
  and **leagues** (ADR-0005). **P6 (hardening) is the only deferred backend stage.**
- **Frontend: F0–F4 complete; F5 (polish/ship) in progress.** Player core (landing, registration,
  roster builder, scores/standings) and the **full admin console** (all 9 screens) are built and
  browser-verified. F5 remaining: **image display** on player/admin surfaces, **mobile/responsive**,
  loading/empty/error + a11y, and **production deploy**. (Image *upload* is done — see Images below.)
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
  `apps/api/scripts/{seed,price}_dev_board.py`. Hosting target: Cloudflare Pages; API on Railway/Hetzner;
  images on S3 + CloudFront.

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
- **Mocked stats** (pick %, trend, tiles, counts) live only in `src/lib/demoStats.ts` and render via `<Demo>`.
- **End-to-end types:** the API annotates response schemas (`.Produces<T>()`), so request *and* response
  DTOs flow from `schema.d.ts` (`components['schemas']`). Re-run `pnpm gen:api` after API contract changes.
  (Catalog, entries, prices, users, ingestion, and scoring are annotated as of the F4/A4 passes; the
  **entry-list import** endpoint is the remaining un-annotated admin endpoint.)

## Auth (read this before building the UI)

- **Cookie session** (`imsa.session`), set after Google OIDC sign-in. Google requests
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
- **Selection board:** `GET /rounds/{roundId}/prices` (public; cars + drivers + prices + display names).
  Each **car** item also carries its **driver lineup** (`drivers: [{ id, fullName }]`, co-drivers ordered
  by entry-driver id) and its race **`number`** (null for drivers). The pick board shows the lineup +
  headshots, **orders cars by number** (numeric-aware), and renders a **per-row class badge** for
  multi-class series (color from `classMeta`).
- **Roster rules:** `GET /rounds/{roundId}/roster-rules` (public) → `{ salaryCap, classes:[{classId,name,slot,min,max}], modifiers:[{kind,maxCount,appliesTo}] }`,
  the resolved cap + composition + available **bonus modifiers** (season rules ∩ classes running this
  round; ADR-0006). Drives the cap bar + live pills; the **same resolver** backs the PUT validation.
- **Roster (the pick page):** `GET/PUT /registrations/{registrationId}/rounds/{roundId}/roster`
  body `{ main:[{entityType,entityId}], modifiers:[{kind,target:{entityType,entityId},params}] }`.
  PUT validates lock (409) + cap (422, from the round) + class composition + modifier selection
  (422, violations named) in one transaction. Modifiers are **free** (no salary).
- **Scores/standings:** `GET /rounds/{id}/scores` (admin), `GET /seasons/{id}/leaderboard` (global, public),
  `GET /rounds/{id}/leaderboard`.
- **Leagues:** `POST /leagues`, `GET /leagues?seasonId=&mine=`, `GET /leagues/{id}`,
  `POST /leagues/{id}/join?joinCode=`, `POST /leagues/{id}/leave`, `DELETE /leagues/{id}`,
  `GET /leagues/{id}/leaderboard` (private = members-only).
- **Images (admin):** `POST /admin/images/liveries/{roundId}/{entryId}` and
  `POST /admin/images/drivers/{driverId}` → `{ key, uploadUrl }` (presigned S3 PUT; browser converts to
  WebP and PUTs directly). Player UI builds display URLs by convention from `VITE_IMAGE_BASE_URL` (see
  Images section above) — no read endpoint.

## Conventions

- Minimal-API endpoints grouped per resource in `src/Api/Endpoints/*Endpoints.cs`, mapped in `Program.cs`.
- JSON enums are **strings** (e.g. `"Qualifying"`, `"Private"`).
- DB constraint violations surface as clean 409/422 via `ProblemExceptionHandler`.
- Tests so far are ad-hoc Python scripts against the running API (`/tmp/*.py`); no automated test suite yet.

## Known gaps / next steps

- **Catalog read access (done):** `GET` on championships / seasons / rounds / classes is **public**;
  their writes — and all of sessions / car-entries / drivers / entry-list / ingestion — remain Admin.
  The pick board reads the public `GET /rounds/{id}/prices` (carries display names + class).
- **F5 in progress** — the **Pick page** image-display + responsive pass is **done** (shared
  `EntityThumb` for liveries/headshots; mobile Lineup/Add-Picks toggle; `GlobalNav`/`ChampionshipStrip`
  made responsive). Remaining for a shippable MVP: **image display + responsive** on the other player
  screens (Dashboard, standings, Landing) and admin surfaces, loading/empty/error + a11y, and
  **production deploy**.
- **Admin richer affordances (deferred):** ingestion has an *issues-list* preview (no interactive
  per-row match resolution); scoring has no *publish gate* (standings are live once scored). Both
  need new backend — see the F4 build note in [docs/frontend-roadmap.md](docs/frontend-roadmap.md).
- **Registrations admin table** shows team + user id only; league/pick-status/joined columns + the
  summary tiles are **demo** until a small enrichment endpoint lands. **Roster Rules** tab is
  read-only (per-class min/max editing over the existing `/roster-rules` CRUD is a later pass).
- **Ruleset-level scoring bonuses** (pole, beat-teammate via `scoring_bonus`) are modeled but **not
  implemented** — position/rank points only. (Distinct from per-player **roster modifiers**, which
  *are* implemented and score as a `Bonus` source — ADR-0006.)
- **IMPACT / bonus drivers removed (ADR-0006):** replaced by free per-round roster modifiers. The
  `RaceFastestLap` scoring source + `race_fastest_lap` table are retained **dormant**; per-driver
  fastest lap still comes from the Al Kamel "Time Cards" race JSON, not the standard results CSV.
- **Class identity colors are frontend-only.** `ClassDto` (and the `class` table) carry no color
  column — the GTP/LMP2/GTD PRO/GTD palette is derived client-side from the class *name* in
  `apps/web/src/lib/classMeta.ts`. So the admin Catalog shows a class color as a read-only swatch;
  there's no color to edit/store. Add a `color` column first if classes ever need bespoke colors.
- **Phase 6** (observability/hardening) is intentionally **deferred** — see roadmap.

## Design docs to read for depth

Start with [docs/README.md](docs/README.md). For frontend work: [docs/frontend-roadmap.md](docs/frontend-roadmap.md)
(phases F0–F5, MVP cut, auth dependency) and [ADR-0004](docs/adr/0004-authentication-and-data-minimization.md)
(/ -0005 leagues) for the auth + team-name + league model the UI must reflect.
