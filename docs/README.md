# IMSA Fantasy League — Design Documentation

Design docs for a motorsports fantasy league focused on the IMSA series:
multi-championship (WeatherTech, Pilot Challenge, MX-5 Cup, …), opt-in per
championship, per-round salary-cap picks that lock at qualifying, and scoring on
**qualifying + race position** plus free per-round **roster-modifier** bonuses
([ADR-0006](adr/0006-roster-modifiers.md)).

## Index

| Doc | What it covers |
|---|---|
| [adr/0001-core-architecture.md](adr/0001-core-architecture.md) | Core architecture (monolith + worker + isolated ingestion) and the **decisions ledger** (D1–D9) for every domain choice |
| [adr/0002-lock-model.md](adr/0002-lock-model.md) | Pick lock model — single round-level `quali_start`, enforced transactionally + sweep worker |
| [adr/0003-scoring-rules-engine.md](adr/0003-scoring-rules-engine.md) | Versioned, two-phase, idempotent scoring engine |
| [adr/0004-authentication-and-data-minimization.md](adr/0004-authentication-and-data-minimization.md) | OIDC auth, minimal data, `team_name` pseudonym, anonymize-on-erasure |
| [adr/0005-leagues.md](adr/0005-leagues.md) | Shared-roster leagues (public/private) as ranking groups over a season |
| [adr/0006-roster-modifiers.md](adr/0006-roster-modifiers.md) | Removes IMPACT/bonus drivers; adds free per-round **roster modifiers** (Double Points Team) scored as a `BONUS` source |
| [roster-modifiers-plan.md](roster-modifiers-plan.md) | Step-by-step implementation plan for ADR-0006 |
| [frontend-roadmap.md](frontend-roadmap.md) | React/TS frontend build phases |
| [data-model.md](data-model.md) | Full ERD — every table, key, constraint, index, and the polymorphic/resolution nuances |
| [roadmap.md](roadmap.md) | Build-order / milestone plan sequencing all ADR action items |

## The model in one paragraph

A **modular monolith API + background worker**, with **results ingestion isolated**
so its dirty-data failure modes never touch the pick path. **PostgreSQL** is the
source of truth and, at MVP scale, also backs the leaderboard and background-job
state; an in-process cache covers hot reads and the lock countdown is computed
client-side, so **Redis is deferred** until load needs it.
Users register **per championship/season**, each with a per-round salary cap and
class-based roster-composition rules. Picks freeze at a single **round-level
`quali_start`**, enforced server-side in the same transaction that checks cap and
composition. Scoring is a **versioned, data-driven, class-relative** engine that
scores **MAIN picks on qualifying + race position** (plus free per-round
**roster-modifier** bonuses — [ADR-0006](adr/0006-roster-modifiers.md)) and
**recomputes idempotently** from the constant stream of post-race corrections.

## Stack & hosting

Chosen 2026-06-16 (no separate ADR):

- **Backend:** .NET / C# — ASP.NET Core (API), EF Core + Npgsql (data; raw SQL for
  the lock transaction), Hangfire on **Postgres** storage (worker). Solution split
  into `Api` / `Domain` / `Infrastructure` / `Worker` / `Ingestion` / `Tests`.
- **Frontend:** React + TypeScript SPA (Vite), typed client generated from the
  API's OpenAPI spec.
- **Data:** PostgreSQL. **Redis deferred** for the MVP (see the
  [data-model MVP note](data-model.md#derived-state-not-in-the-relational-model));
  reintroduce via **Upstash** serverless only if load requires it.
- **Hosting:** **Railway** (Hobby) for the API + Postgres; **S3 + CloudFront** for the static React
  build (same AWS account as the image bucket). ~$8–14/mo at MVP scale, scaling with usage rather
  than paying for idle capacity between race weekends. Full runbook: [infra/deploy.md](infra/deploy.md).

## Status

All documents are **Accepted**. As of 2026-06-18: **backend P0–P5 complete** (P6 hardening deferred —
[roadmap.md](roadmap.md)); **frontend F0–F4 complete; F5 (polish/ship) done for all player pages** —
image display, mobile/responsive, and loading/empty/error + a11y — [frontend-roadmap.md](frontend-roadmap.md).
Remaining for a shippable MVP: **admin responsive** (deferred) and **production deploy**. See
[CLAUDE.md](../CLAUDE.md) for the live status + known gaps.
