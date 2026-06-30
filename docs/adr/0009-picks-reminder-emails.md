# ADR-0009: Picks-Reminder Emails (one email per race weekend)

**Status:** Proposed
**Date:** 2026-06-29
**Related:** [ADR-0002](0002-lock-model.md) (`quali_start` lock boundary), [ADR-0004](0004-authentication-and-data-minimization.md) (email is private, stored from the id_token), [ADR-0007](0007-shared-events.md) (`event` above `round`), [ADR-0008](0008-multi-championship-and-picks-open.md) (`event.picks_open`)

## Context

Players register per championship-season and pick a roster **each round**, but picks lock at
qualifying ([ADR-0002](0002-lock-model.md)) and a player who forgets to set a roster simply
scores nothing that weekend. The single highest-leverage re-engagement we can build is a
**reminder email per race weekend**: "picks are open / closing — go set your roster."

We already hold what this needs:

- **Each user's `email`** (private, captured at first login — [ADR-0004](0004-authentication-and-data-minimization.md)).
- **A pick-release signal**, `event.picks_open` (the admin toggle — [ADR-0008](0008-multi-championship-and-picks-open.md)).
- **A close time**, `round.quali_start` (the lock boundary — [ADR-0002](0002-lock-model.md)), already per-round.
- **A background-worker pattern**, `LockSweepService` (`PeriodicTimer` + scoped `FantasyDbContext`
  + an idempotent SQL write that is safe to miss or double-fire).
- **AWS SDK + a config pattern** (`AWSSDK.S3`, the `Aws:` options section with optional creds
  falling back to the default credential chain, an `IsConfigured` guard so the app boots before
  secrets land — `ImageStorage`).

Two timing variants are plausible and we **do not want to commit to one yet**:

- **At open** — fire when `event.picks_open` flips true.
- **24h before close** — fire 24h before the weekend's pick deadline.

The key observation that shapes this ADR: **both variants are computable from data we already
have** — `picks_open` for "at open", and `quali_start` for "24h before close" (close = lock =
`quali_start`). Neither needs a scheduled "picks open at" timestamp. So the open-vs-close choice
is **not a schema decision** — it can be a config string flipped at deploy time.

The unit is the **weekend, not the round**: one email per `event`, even though an event may have
several rounds across championships ([ADR-0007](0007-shared-events.md)) with different
`quali_start`s.

## Decision

Build a single in-process background worker that sends **one reminder email per `event` per
opted-in user**, via Amazon SES, rendered from an MJML-compiled HTML template, with the
open-vs-close firing rule selected by **config**.

### D1 — One in-process polling worker, mirroring `LockSweepService`

A new `PicksReminderService : BackgroundService` polls on a `PeriodicTimer` (~5 min). Each tick:

1. Compute the set of **due** events (the only mode-dependent step — D2).
2. For each due event, select **opted-in registrants not yet sent** for that event.
3. **Claim then send** each recipient (D3).

In-process (not an external cron, not inline in the toggle handler) because the pattern already
exists in this codebase, it survives restarts, retries are automatic on the next tick, and it
keeps the logic in one testable place. Railway runs a single API instance today; if that ever
changes, the claim row (D3) makes concurrent workers safe without further work.

### D2 — Firing rule is config-driven and derives from existing data (no new timestamp column)

```
Reminders:Mode             = AtOpen | HoursBeforeClose   // default: TBD — decided at deploy
Reminders:HoursBeforeClose = 24
```

- **`AtOpen`** — due when `event.picks_open = true`.
- **`HoursBeforeClose`** — due when `now() >= (MIN(round.quali_start) over the event's rounds) - HoursBeforeClose`.

Both modes additionally require `picks_open = true` (never tell a player to pick when they
can't) and that the deadline has not already passed. The weekend's deadline is the **earliest**
`quali_start` among the event's rounds, so the reminder beats the first lock. Because both rules
read columns that already exist, **the open-vs-close decision is deferred to a config value** and
can be changed without a migration or redeploy of schema.

> Note: "24h before close" — i.e. before picks **lock at qualifying** — not "24h before open".
> "Before open" would require a scheduled open time we deliberately do not model (IMSA entry
> lists are never published weeks ahead, so `AtOpen` firing immediately on the toggle is correct).

### D3 — Single-send guaranteed by a claim table

```sql
event_reminder(event_id bigint, user_id bigint, sent_at timestamptz, UNIQUE(event_id, user_id))
```

One row per (event, recipient). The worker **inserts the claim row before sending**; the unique
constraint makes a second attempt — across ticks, restarts, or concurrent instances — a no-op.
Per-recipient rows (vs a single per-event flag) let partial-failure retries and per-user opt-out
work cleanly. This is the same "idempotent, safe to double-fire" posture as `LockSweepService`.

### D4 — Opt-in (default off), prompted at registration

```sql
app_user.email_reminders_enabled bool NOT NULL DEFAULT false
```

Reminders are **opt-in**. The flag is **user-level** (one preference across all the user's
seasons), default `false`.

Sign-up is Google OAuth — a redirect with no form — so the opt-in is surfaced at the **first
form a player fills: the registration flow** (`POST /registrations`, the `/register` route).
Registering for a season is effectively "signing up to play." An **unchecked** checkbox there
("Email me when picks open for each race weekend — at most one per weekend, unsubscribe anytime")
sets the user flag; `POST /registrations` gains an optional `emailReminders` bool. Because the
flag is user-level, the checkbox **re-prompts on every registration until the user opts in, then
is hidden entirely** once enabled. A small account/dashboard toggle plus the one-click unsubscribe
(D7) let users change it later.

### D5 — Send via Amazon SES, reusing the AWS config pattern

A `SesEmailSender` using `AWSSDK.SimpleEmailV2`, configured by an options class mirroring
`ImageStorageOptions` (`Aws:Ses:{FromAddress,ReplyTo,Region}`; optional creds → default
credential chain; `IsConfigured` so the app and worker run before SES secrets exist — the worker
logs-and-skips, matching how the image endpoint 503s cleanly). SES is chosen because the AWS
integration, IAM, and config convention are already in place and per-email cost is negligible at
this volume.

### D6 — Render with MJML compiled to an HTML template, substituted in .NET

Gmail is the rendering constraint: table-based layout, **fully inlined CSS**, no external
stylesheets, total HTML **< 102 KB** (or Gmail clips it), no flexbox/grid, web fonts unreliable
(design for an Arial/sans fallback), and Gmail dark-mode color inversion to account for. The pick
deadline renders in **US Eastern (EST/EDT)** to match IMSA's schedule, not UTC.

Author `picks-reminder.mjml`; **compile to `picks-reminder.html` at build time** (MJML emits
bulletproof, inlined, table-based HTML) with `{{tokens}}` (`raceName`, `deadline`, `pickUrl`,
`unsubscribeUrl`). Ship the compiled HTML as an **embedded resource**; .NET does string
substitution at send time. This keeps **no Node dependency at runtime** — only a build step.

### D7 — Unsubscribe + bulk-sender compliance

- `GET /email/unsubscribe?token=<signed>` flips `email_reminders_enabled = false`; the signed
  token needs no auth (one-click).
- Every send includes `List-Unsubscribe` + `List-Unsubscribe-Post` headers (Gmail/Yahoo
  one-click requirement), an accurate From/Subject, and a physical address in the footer
  (CAN-SPAM). SPF + DKIM + DMARC on the sending subdomain are set up as a one-time op.

## Options Considered

### Firing mechanism

| Option | Complexity | Robustness | Verdict |
|--------|-----------|-----------|---------|
| **In-process `BackgroundService`** (chosen) | Low — clones `LockSweepService` | Survives restarts; retries next tick; claim-row-safe under concurrency | **Chosen** |
| External cron hitting an admin endpoint | Low backend, new infra | Another moving part to deploy/monitor on Railway | Rejected — no benefit over a worker that already has a pattern here |
| Inline send in the `picks_open` toggle handler | Lowest | Fires only on toggle (can't do "before close"); no retry; lost on failure | Rejected — can't express both timing modes; not durable |

### Consent

| Option | Reach | Posture | Verdict |
|--------|-------|---------|---------|
| **Opt-in, default false, prompted at registration** (chosen) | Lower | Affirmative, visible consent — fits this app's data-minimization ethos ([ADR-0004](0004-authentication-and-data-minimization.md)) | **Chosen** (user decision) |
| Opt-out, default true + unsubscribe | Highest | Legal for a service email under CAN-SPAM, but consent is implicit | Considered; rejected in favour of explicit opt-in |

### Email provider

| Option | Fit | Verdict |
|--------|-----|---------|
| **Amazon SES** (chosen) | AWS creds/config/SDK already wired; negligible cost | **Chosen** |
| Resend | Best DX, pairs with React Email | Rejected — new vendor + a JS toolchain |
| Postmark | Top transactional deliverability | Rejected — monthly floor, another vendor |

### Rendering

| Option | Runtime dep | Gmail safety | Verdict |
|--------|------------|-------------|---------|
| **MJML → compiled template + .NET substitution** (chosen) | None (build step only) | High (MJML emits bulletproof tables) | **Chosen** |
| Hand HTML + PreMailer.Net | None | Manual, error-prone as it grows | Considered — fine if it stays one email |
| React Email | Node renderer | High | Rejected — Node in a .NET backend |

## Trade-off Analysis

The decision hinges on **not prematurely committing to the timing rule**. Because close
(`quali_start`) and open (`picks_open`) already exist as data, the open-vs-close choice reduces
to a config string (D2) rather than a schema or code fork — which is exactly the "decide as late
as possible" the requirement asked for. Everything else is shared: the worker, the claim table,
the sender, the template, and consent are identical regardless of when it fires. The remaining
choices (SES, MJML, opt-in) each pick the option that **reuses an existing pattern** (AWS config,
a background worker, the registration form) over introducing a new vendor, toolchain, or
delivery mechanism, keeping the feature additive and inside the current .NET deploy.

## Consequences

**Easier:**
- Players get a timely nudge; missed-roster weekends drop — the core re-engagement win.
- The open-vs-close timing can be tuned (or A/B'd) by flipping one config value, no redeploy of schema.
- A durable, idempotent send pipeline reusable for future transactional emails (results posted, league invites).

**Harder:**
- A one-time SES setup (domain DKIM verify, SPF/DMARC DNS, production-access request — sandbox blocks non-verified recipients until granted).
- A build step to recompile the MJML template when the design changes.
- Email rendering must stay within Gmail's constraints (< 102 KB, tables, inline CSS) — verified per template change.

**To revisit:**
- **The default `Reminders:Mode`** — chosen at first deploy; revisit after observing open vs. completion rates.
- **Already-picked suppression** — unnecessary now (nobody has picked when either rule fires), but if a "nudge the un-picked closer to lock" follow-up is added, filter recipients by missing roster.
- **Per-round vs per-event emails** — settled as one per event at the earliest `quali_start`; revisit only if a single weekend's championships diverge enough to warrant separate emails.
- **Broader notification preferences** — a single boolean now; generalize to a preferences table if more email types appear.

## Action Items

1. [ ] Schema: `event_reminder(event_id, user_id, sent_at)` unique `(event_id, user_id)`; `app_user.email_reminders_enabled bool not null default false`. Migration `AddPicksReminderEmails`.
2. [ ] Domain/EF: `EventReminder` entity + config in `FantasyDbContext` (snake_case, FKs, unique index); `AppUser.EmailRemindersEnabled`.
3. [ ] Config: `Reminders:{Mode,HoursBeforeClose}` and `Aws:Ses:{FromAddress,ReplyTo,Region}` options classes (mirror `ImageStorageOptions`, `IsConfigured` guard).
4. [ ] `SesEmailSender` (`AWSSDK.SimpleEmailV2`) — send with `List-Unsubscribe`/`List-Unsubscribe-Post` headers; no-op-and-log when not configured.
5. [ ] Template: `picks-reminder.mjml` + a build step compiling to `picks-reminder.html` (embedded resource); .NET token substitution. Gmail-verified (< 102 KB, tables, Arial fallback, dark-mode aware).
6. [ ] `PicksReminderService : BackgroundService` (clone `LockSweepService`): due-event query per `Reminders:Mode` (gate on `picks_open` + earliest `quali_start`); claim-then-send per recipient.
7. [ ] Registration opt-in: `emailReminders` on the `POST /registrations` body → sets the user flag; unchecked checkbox + copy on the `/register` form; render checked if already enabled.
8. [ ] Unsubscribe: `GET /email/unsubscribe?token=<signed>` → `enabled = false`; small account/dashboard re-enable toggle.
9. [ ] API contracts: regenerate the frontend client (`pnpm gen:api`) for the registration body change.
10. [ ] One-time ops: SES domain DKIM verify, SPF/DMARC DNS, request SES production access; set `Aws:Ses:*` + `Reminders:Mode` in Railway config.
11. [ ] Docs: add `event_reminder` + `app_user.email_reminders_enabled` to [data-model.md](../data-model.md); index this ADR in [docs/README.md](../README.md).
