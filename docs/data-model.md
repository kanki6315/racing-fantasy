# Data Model / ERD — IMSA Fantasy League

**Status:** Accepted
**Date:** 2026-06-16
**Related:** [ADR-0001](adr/0001-core-architecture.md), [ADR-0002](adr/0002-lock-model.md), [ADR-0003](adr/0003-scoring-rules-engine.md)

This is the authoritative relational schema. PostgreSQL is the source of truth
(ADR-0001 D9); leaderboards live in Redis and are **not** in this diagram — they
are derived from `round_total` and rebuildable from it (see [Derived state](#derived-state-not-in-the-relational-model)).

## Legend & conventions

- `||--o{` = one-to-many (crow's foot). `||--||` = one-to-one. `}o--o{` = many-to-many.
- **PK** = primary key (all `bigint generated always as identity` unless noted).
- **FK** = foreign key with a real DB constraint. **poly** = polymorphic
  reference (`entity_type` + `entity_id`), **no DB FK** — enforced in app + a
  periodic integrity job (ADR-0001 D3).
- Enumerated columns use `CHECK` constraints (or PG enums): `slot_type ∈ {MAIN, IMPACT}`,
  `entity_type ∈ {CAR, DRIVER}`, `session.type ∈ {QUALIFYING, RACE}`.
- Money/points are `numeric`; lap times are `bigint` milliseconds; timestamps are `timestamptz`.

## Domain map (high level)

```
  CATALOG / STRUCTURE          PICKABLE ENTITIES           USER / PICKS
  ┌───────────────┐            ┌──────────────┐            ┌──────────────┐
  │ championship  │            │ car_entry    │            │ app_user     │
  │  └ season     │            │ driver       │            │  └registration│
  │     └ round   │            │ entry_driver │            │     └roster   │
  │        └session│           │ entity_price │            │        └pick  │
  │ class         │            └──────────────┘            │ roster_rule  │
  └───────────────┘                                        └──────────────┘
          │                                                       │
          ▼                          RESULTS  ───────────────► SCORING
                                   ┌──────────────┐        ┌──────────────────┐
                                   │ quali_result │        │ scoring_ruleset  │
                                   │ race_fastest │        │  position_points │
                                   │   _lap       │        │  scoring_bonus   │
                                   └──────────────┘        │ score / score_audit│
                                                           │ round_total      │
                                                           └──────────────────┘
```

## ER diagram (Mermaid)

```mermaid
erDiagram
    CHAMPIONSHIP ||--o{ SEASON : "has"
    CHAMPIONSHIP ||--o{ CLASS : "defines"
    SEASON ||--o{ ROUND : "has"
    EVENT  ||--o{ ROUND : "shared weekend (opt-in)"
    SEASON ||--o{ CAR_ENTRY : "fields"
    SEASON ||--o{ REGISTRATION : "enrolls"
    SEASON ||--o{ ROSTER_RULE : "constrains"
    SEASON ||--o{ SCORING_RULESET : "scores under"
    CLASS  ||--o{ SESSION : "categorizes"
    CLASS  ||--o{ CAR_ENTRY : "groups"
    CLASS  ||--o{ ROSTER_RULE : "scopes"
    ROUND  ||--o{ SESSION : "runs"
    ROUND  ||--o{ ENTITY_PRICE : "prices"
    ROUND  ||--o{ ROSTER : "collects"
    ROUND  ||--o{ ROUND_TOTAL : "totals"
    SESSION ||--o{ QUALI_RESULT : "produces"
    SESSION ||--o{ RACE_FASTEST_LAP : "produces"
    CAR_ENTRY ||--o{ ENTRY_DRIVER : "lineup"
    DRIVER    ||--o{ ENTRY_DRIVER : "drives"
    CAR_ENTRY ||--o{ QUALI_RESULT : "grid pos (resolved)"
    DRIVER    ||--o{ RACE_FASTEST_LAP : "sets"
    APP_USER ||--o{ REGISTRATION : "registers"
    REGISTRATION ||--o{ ROSTER : "submits"
    REGISTRATION ||--o{ ROUND_TOTAL : "accumulates"
    ROSTER ||--o{ PICK : "contains"
    PICK ||--o{ SCORE : "earns"
    ROSTER ||--o{ SCORE : "aggregates"
    SCORE ||--o{ SCORE_AUDIT : "revises"
    SCORING_RULESET ||--o{ POSITION_POINTS : "maps rank"
    SCORING_RULESET ||--o{ SCORING_BONUS : "adds"

    %% poly (no FK): ENTITY_PRICE.entity_id and PICK.entity_id reference
    %% CAR_ENTRY or DRIVER per entity_type. QUALI_RESULT.car_entry_id is a real FK.
```

---

## Tables

### Catalog / structure

**`app_user`**
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| email | text | UNIQUE |
| display_name | text | |
| created_at | timestamptz | |

**`championship`** — WeatherTech, Pilot Challenge, MX-5 Cup, …
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| name | text | |
| slug | text | UNIQUE |
| sort_order | int NOT NULL DEFAULT 0 | constant sort key (lower first); exposed to clients as `order`. `GET /championships` orders by it then name — used everywhere championships are listed (ADR-0008) |

**`season`** — a championship's running of a year
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| championship_id | bigint FK → championship | |
| year | int | UNIQUE(championship_id, year) |

**`class`** — GTP / LMP2 / GTD PRO / GTD; GS / TCR; MX-5
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| championship_id | bigint FK → championship | UNIQUE(championship_id, name) |
| name | text | |
| color | text NULL | admin-set identity color, `#RRGGBB` (validated). NULL = fall back to the client name-keyed palette. |

> Classes are modeled per championship (stable across its seasons). If a
> championship restructures classes between years, version via a new `class` row.
> `color` is optional — the frontend (`classMeta`) derives a palette from the class
> name when it's null, so legacy rows render unchanged.

**`event`** — a physical race weekend shared across championships (ADR-0007)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| name | text | e.g. "Rolex 24 At Daytona" |
| circuit | text | |
| starts_at / ends_at | timestamptz | the weekend bounds |
| picks_open | boolean NOT NULL DEFAULT false | admin **pick-release gate** — opens the board for every series this weekend at once (ADR-0008). Gates COMING SOON → PICKS OPEN; per-round `quali_start` still locks. Enforced on the roster PUT (`409 not_open`) and surfaced on the roster GET. |

> A top-level calendar entity (not under championship/season): it spans them. Championships
> **opt in** by attaching a `round` (`round.event_id`), each with its own `quali_start`. Backs the
> cross-championship calendar with no client-side dedup. `name`/`circuit`/dates are **also kept on
> `round`** as a display cache so `RoundDto` stays flat for existing consumers (ADR-0007 D3).

**`round`** — a race weekend/event
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| season_id | bigint FK → season | |
| **event_id** | bigint FK → event | **nullable** — the shared weekend this round opts into (ADR-0007); NULL = standalone |
| name | text | e.g. "Rolex 24 At Daytona" |
| circuit | text | |
| sequence | int | UNIQUE(season_id, sequence) — order in season |
| **quali_start** | timestamptz | **THE lock boundary** (ADR-0002) |
| starts_at | timestamptz | |
| ends_at | timestamptz | |

**`session`** — a per-class session within a round
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| round_id | bigint FK → round | |
| class_id | bigint FK → class | |
| type | text | CHECK ∈ {QUALIFYING, RACE}; UNIQUE(round_id, class_id, type) |
| scheduled_start | timestamptz | |
| actual_start | timestamptz | nullable (set on ingest) |
| status | text | SCHEDULED / LIVE / COMPLETE / PUBLISHED |

> `session` carries class-level results; it is **not** the lock source — lock is
> the single `round.quali_start` (ADR-0002). Composition rules are enforced only
> for classes that have a `session` in the round (ADR-0001 D5).

### Pickable entities & economy

**`car_entry`** — a car (number + team) in a class for a season
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| season_id | bigint FK → season | |
| class_id | bigint FK → class | |
| number | text | UNIQUE(season_id, class_id, number) |
| team_name | text | |

**`driver`**
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| full_name | text | |
| country | text | |

**`entry_driver`** — lineup (co-drivers share a car); resolves driver → car
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| car_entry_id | bigint FK → car_entry | |
| driver_id | bigint FK → driver | |
| season_id | bigint FK → season | UNIQUE(car_entry_id, driver_id) |

**`entity_price`** — per-round price for a pickable entity (prices change each round)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| round_id | bigint FK → round | |
| entity_type | text | CHECK ∈ {CAR, DRIVER} |
| entity_id | bigint **poly** | → car_entry or driver (no FK) |
| class_id | bigint FK → class | |
| price | numeric | UNIQUE(round_id, entity_type, entity_id) |

### Registration, rules & picks

**`registration`** — a user's enrollment in one season (per-championship opt-in)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| user_id | bigint FK → app_user | |
| season_id | bigint FK → season | UNIQUE(user_id, season_id) |
| salary_cap | numeric | per-round cap (ADR-0001 D2) |

**`roster_rule`** — legal roster shape per class & slot (ADR-0001 D5)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| season_id | bigint FK → season | |
| round_id | bigint FK → round | **nullable** — NULL = season default (every round); set = a per-round override of this class's count for that round |
| class_id | bigint FK → class | **nullable** — NULL = "any class" (used for IMPACT) |
| slot_type | text | CHECK ∈ {MAIN, IMPACT} |
| min_picks | int | |
| max_picks | int | UNIQUE(season_id, round_id, class_id, slot_type), nulls-not-distinct |

> **Per-round overrides:** the resolver (`RosterRulesResolver`) loads the season defaults
> (`round_id` NULL) plus the target round's overrides and, per class, prefers the override over
> the default. Counts vary across a season because the entry list (cars per class) shifts round to
> round. "Which classes run a round" is still controlled separately by `session` rows.

**`roster`** — a user's picks for one round (one per registration per round)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| registration_id | bigint FK → registration | |
| round_id | bigint FK → round | UNIQUE(registration_id, round_id) |
| locked_at | timestamptz | nullable; set by lock-sweep (ADR-0002) |
| created_at / updated_at | timestamptz | |

**`pick`** — one selected entity in a roster
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| roster_id | bigint FK → roster | |
| slot_type | text | CHECK ∈ {MAIN, IMPACT}; IMPACT ⇒ entity_type=DRIVER |
| entity_type | text | CHECK ∈ {CAR, DRIVER} |
| entity_id | bigint **poly** | → car_entry or driver (no FK) |
| class_id | bigint FK → class | denormalized for the composition `GROUP BY` |
| price_at_lock | numeric | snapshot at lock (ADR-0001 D4) |
|  |  | UNIQUE(roster_id, slot_type, entity_type, entity_id) — no dup picks |

### Results (ingested, admin-approved — ADR-0001 D8)

**`quali_result`** — qualifying grid, per car, per class
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| session_id | bigint FK → session | (QUALIFYING session) |
| car_entry_id | bigint FK → car_entry | grid is a **car** concept |
| class_id | bigint FK → class | |
| position | int | within-class grid position |
| best_lap_ms | bigint | UNIQUE(session_id, car_entry_id) |

> **Driver MAIN picks resolve through the lineup**: a driver pick scores from its
> car's `quali_result`, via `entry_driver` (driver → car_entry) for that season.
> MX-5 (single driver/car) collapses this 1:1.

**`race_result`** — race finishing result, per car, per class (second MAIN source — race position)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| session_id | bigint FK → session | (RACE session) |
| car_entry_id | bigint FK → car_entry | finish is a **car** concept |
| class_id | bigint FK → class | |
| position | int | within-class finishing position |
| status | text | Classified / DNF / DNS … |
| laps | int | nullable; UNIQUE(session_id, car_entry_id) |

> Added 2026-06-17. MAIN picks score **both** qualifying position (`quali_result`)
> and race finishing position (`race_result`), each class-relative; driver MAIN
> picks resolve to their car's result via the lineup, same as qualifying.

**`race_fastest_lap`** — per-driver fastest race lap (IMPACT source)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| session_id | bigint FK → session | (RACE session) |
| driver_id | bigint FK → driver | a lap is a **driver** concept |
| class_id | bigint FK → class | |
| fastest_lap_ms | bigint | UNIQUE(session_id, driver_id) |

### Scoring (ADR-0003)

**`scoring_ruleset`** — versioned rules per season & scoring source
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| season_id | bigint FK → season | |
| source | text | CHECK ∈ {QUALIFYING_POSITION, RACE_POSITION, RACE_FASTEST_LAP} |
| version | int | UNIQUE(season_id, source, version) |
| status | text | CHECK ∈ {DRAFT, ACTIVE, ARCHIVED} |
| effective_from | timestamptz | |

> **Source replaces slot_type (2026-06-17).** MAIN picks are scored by two sources
> — `QUALIFYING_POSITION` and `RACE_POSITION`; IMPACT by `RACE_FASTEST_LAP`. The
> source implies which slot's picks it scores.

**`position_points`** — rank → points (class-relative ranking, class-agnostic points)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| ruleset_id | bigint FK → scoring_ruleset | |
| rank | int | UNIQUE(ruleset_id, rank) |
| points | numeric | |

**`scoring_bonus`** — extra rules (pole, beat-teammate, …)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| ruleset_id | bigint FK → scoring_ruleset | |
| kind | text | POLE / BEAT_TEAMMATE / … |
| params | jsonb | |

**`score`** — points for one pick from one scoring source (current value)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| roster_id | bigint FK → roster | denormalized for fast roster rollups |
| pick_id | bigint FK → pick | |
| source | text | which source produced these points |
| points | numeric | |
| rule_version | int | stamped for reproducibility |
| computed_at | timestamptz | UNIQUE(pick_id, source) — idempotent recompute (ADR-0003) |

> A MAIN pick has up to two `score` rows (QUALIFYING_POSITION + RACE_POSITION); an
> IMPACT pick has one (RACE_FASTEST_LAP). `round_total` sums them all.

**`score_audit`** — one row per recompute (explains overnight changes, ADR-0003)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| pick_id | bigint FK → pick | |
| source | text | |
| rule_version | int | |
| old_points | numeric | |
| new_points | numeric | |
| reason | text | e.g. "DSQ #57", "post-quali penalty" |
| computed_at | timestamptz | |

**`round_total`** — running sum of scored points for a user in a round (ADR-0003 two-phase)
| col | type | notes |
|---|---|---|
| id | bigint PK | |
| registration_id | bigint FK → registration | |
| round_id | bigint FK → round | UNIQUE(registration_id, round_id) |
| points | numeric | MAIN + IMPACT as each phase lands |
| updated_at | timestamptz | |

---

## Key indexes (hot paths)

| index | serves |
|---|---|
| `entity_price(round_id)` | `GET /rounds/{rid}/prices` (cached, spike read) |
| `roster(registration_id, round_id)` UNIQUE | load/upsert my roster |
| `pick(roster_id)` | composition `GROUP BY class_id, slot_type` in the lock txn |
| `quali_result(session_id)`, `race_fastest_lap(session_id)` | scoring fan-out per session |
| `score(pick_id)`, `score(roster_id)` | recompute + roster rollup |
| `round_total(registration_id)` | season standings; leaderboard rebuild |

## Integrity rules not expressible as FKs

- **Polymorphic refs** (`entity_price.entity_id`, `pick.entity_id`): app validates
  that the target exists in `car_entry`/`driver` and matches `entity_type`; a nightly
  integrity job flags orphans (ADR-0001 D3).
- **IMPACT ⇒ DRIVER**: a `pick`/`entity_price` with `slot_type=IMPACT` must have
  `entity_type=DRIVER`. Enforce via app + a `CHECK` on `pick`.
- **Class scope**: `pick.class_id` must belong to a class that has a `session` in
  the round (composition is scoped to running classes — ADR-0001 D5).
- **Lock immutability**: once `roster.locked_at` is set, no child `pick` rows may
  change (enforced in app; backstopped by the sweep — ADR-0002).
- **Cap**: `Σ pick.price_at_lock ≤ registration.salary_cap`, checked in the lock
  transaction.

## Derived state (not in the relational model)

> **MVP infrastructure note (2026-06-16):** Redis is **deferred** for the MVP. At
> the target scale (10k–50k niche users) Postgres covers the derived state below
> directly. Redis (Upstash serverless, suited to the bursty between-races profile)
> is reintroduced only when multi-instance shared caching or leaderboard
> performance demands it. Postgres remains the authoritative source either way
> (ADR-0001 D9).

- **Leaderboards** — **MVP:** computed from `round_total` with an index +
  `ORDER BY` (a materialized view if needed). **Later:** Redis sorted sets
  `leaderboard:{championship}:{season}` (+ per-round), `ZADD`'d from `round_total`
  each scoring phase, with a reconciliation job rebuilding them from Postgres after
  any recompute (ADR-0003). `round_total` is authoritative in both cases.
- **Hot-read cache** (e.g. `/prices`) — **MVP:** in-process cache (`IMemoryCache`).
  **Later:** Redis, once multiple API instances need a shared cache.
- **Lock countdown** — computed **client-side** from `round.quali_start` returned
  by the API; UX only. The authoritative boundary is `quali_start` checked
  server-side (ADR-0002). No Redis dependency.
- **Background job state** — Hangfire on **Postgres** storage (no Redis needed).
```
