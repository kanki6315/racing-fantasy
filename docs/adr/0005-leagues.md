# ADR-0005: Leagues (shared-roster)

**Status:** Accepted
**Date:** 2026-06-17
**Related:** [ADR-0001](0001-core-architecture.md) (registration/leaderboard), [ADR-0004](0004-authentication-and-data-minimization.md) (team_name, erasure)

## Context

Today the only competition is the season-wide pool: `GET /seasons/{id}/leaderboard`
ranks every registration together. There's no way to run **multiple leagues**
(public or private) over the same season — e.g. an office league and a public
league both playing WeatherTech 2026, each with its own standings.

## Decision

Add **shared-roster leagues** (the Fantasy Premier League model): a user has **one
roster per season**, and leagues are **ranking groups** over the same picks/scores.
This is purely additive — scoring, rosters, picks, cap, and lock are untouched.

- **`league`** — `season_id`, `name`, `visibility` (Public/Private),
  `owner_registration_id`, `join_code` (private only), `created_at`.
- **`league_membership`** — `league_id` + `registration_id`, unique together; a
  registration joins many leagues.
- **Leaderboards become a filter:** a league's standings are the same `round_total`
  numbers restricted to its members and ranked. The existing **season-wide
  leaderboard stays as the implicit "Global" pool**; leagues are opt-in subsets.
- **Join:** public leagues are discoverable and joinable by any registrant of the
  season; private leagues require the `join_code`. The owner auto-joins on creation.

## Options Considered

| Dimension | **Shared roster (chosen)** | Per-league rosters |
|---|---|---|
| Roster model | One per season; leagues are groupings | One per (league, season) |
| Change footprint | Additive — new tables + filtered leaderboard | Registration/roster move under league; lock/cap/composition run per league |
| Familiarity | FPL-standard | Unusual |
| Complexity | Low | High |

Per-league rosters were rejected: they multiply rosters per user per season and push
the integrity-critical lock/cap/composition logic into a per-league dimension for
little product gain. The season-wide board is kept as Global rather than modeling
Global as an auto-joined league, to stay additive (no change to the registration flow).

## Authorization (per ADR-0004 tiers)

- **Player** (authenticated, registered in the season): create a league, join/leave,
  view leagues they may see.
- **Owner:** delete their league.
- **Visibility:** public league leaderboards are viewable by any authenticated user;
  **private league leaderboards are members-only** (403 otherwise). `join_code` is
  returned only to the owner.

## Consequences

- **Easier:** multiple concurrent public/private leagues per season; the season board
  remains the global standings; no change to scoring/roster/lock.
- **Erasure interplay (ADR-0004):** memberships and owned leagues persist after a
  user is erased — the registration row survives (anonymized to a neutral team name),
  so league history is preserved like the global board. An erased owner can no longer
  manage the league (admin cleanup if needed).
- **To revisit:** auto-created Global league, league size caps, owner transfer,
  invite links vs codes — all post-MVP.

## Action Items

1. [x] `league` + `league_membership` entities, `LeagueVisibility` enum, migration.
2. [x] League endpoints: create, join, leave, delete (owner), discover, detail, per-league leaderboard.
3. [x] Share the ranking logic between the season and league leaderboards.
4. [ ] Frontend: league create/join/switch UI (frontend-roadmap F3).
