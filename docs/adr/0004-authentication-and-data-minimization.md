# ADR-0004: Authentication & Data Minimization

**Status:** Accepted — **amended 2026-06-17** (see [Amendment](#amendment-2026-06-17--collect-name--email))
**Date:** 2026-06-17
**Related:** [ADR-0001](0001-core-architecture.md) (D3 polymorphic refs, app_user/registration), [ADR-0005](0005-leagues.md) (leagues — the amendment's name visibility is scoped to these), [frontend-roadmap.md](../frontend-roadmap.md) (F1)

> **This ADR was amended on 2026-06-17.** The original decision below collected
> **no email and no name** (`openid`-only). The amendment at the end of this
> document reverses that specific point — we now collect **name + email** — while
> **keeping** the pseudonymous-leaderboard and anonymize-on-erasure model intact.
> Read the [Amendment](#amendment-2026-06-17--collect-name--email) alongside the
> original Decision; where they conflict, the amendment wins.

> Engineering and data-protection *design* reasoning, not legal advice. The
> anonymization bar, retention, and the privacy notice should get a compliance
> review before public launch.

## Context

The frontend MVP needs authentication — every player flow must know "who am I"
and "am I an admin." The backend currently has **none** (users are managed
directly via `app_user`). Two forces shape the choice:

- **Minimize personal data (GDPR Art. 5(1)(c)).** We want to hold as little
  identifying information as possible, and to keep leaderboard history intact even
  when a user exercises their **right to erasure (Art. 17)**.
- **Keep the build small.** .NET speaks OAuth2/OIDC natively, so a connector is a
  drop-in; we don't want to take on a heavy auth stack or extra data processors.

The product also wants a **fantasy team name** per championship — which turns out
to be the lever that lets standings survive erasure (a team name is a pseudonym;
sever its link to the person and the leaderboard row becomes anonymous, and
**anonymous data is outside GDPR scope, Recital 26**).

## Decision

1. **Authenticate via ASP.NET Core's OIDC handler directly against Google**
   (no managed auth service, no local passwords). Google chosen for widest reach.
2. **Collect the minimum:** request only the `openid` scope (a pseudonymous `sub`),
   **do not collect email** (the `email` scope is never requested), don't hit
   userinfo, don't map provider claims we don't need, and **don't persist provider
   tokens**. The human-facing name is **user-provided**, not pulled from Google.
3. **`team_name` lives on `registration`** (per championship/season) and is the
   **only** identifier shown on leaderboards — never the account identity or email.
   Standings are therefore pseudonymous by default.
4. **Right to erasure = anonymize, replacing `team_name` with a neutral token.**
   We delete the account identity, sever the registration→user link, and replace
   each `team_name` with a neutral token (e.g. `Retired Team #1742`). Game data
   (rosters, picks, scores, round totals) is retained as anonymous records, so
   leaderboard history is preserved. We replace rather than keep the name because
   **we cannot guarantee a user-entered team name is free of personal data.**

## Options Considered

### Auth integration

| Option | Complexity | Data-processor footprint | Notes |
|---|---|---|---|
| **ASP.NET Core OIDC, direct to provider** (chosen) | Low | None added — the IdP is a separate *controller*, not our processor | Native to .NET; full control over scopes/claims |
| Managed auth (Clerk / Auth0 / Cognito) | Low | **Adds a processor** — needs a DPA; often collects more | Faster features, but more GDPR surface |
| Local accounts + passwords | High | None added | We become responsible for password storage, reset, breach exposure — strictly worse |

### Provider

| Option | Minimization posture | Reach | Decision |
|---|---|---|---|
| **Google** | Good — `openid`-only returns just `sub`, no email collected | Widest | **Chosen** (reach) |
| Sign in with Apple | Strongest — private email relay, minimal claims | Apple users | Deferred — add later if desired |
| Both | Good | Widest + privacy option | Not now |

### Erasure strategy

| Option | Leaderboard integrity | Residual PII risk | Decision |
|---|---|---|---|
| Hard-delete user + game data | **Lost** (standings gaps) | None | Rejected — destroys history |
| Anonymize, **keep** team name | Preserved | Name might contain PII | Rejected — can't guarantee names are clean |
| **Anonymize, replace team name with neutral token** | Preserved | None | **Chosen** |

## Trade-off Analysis

The central trade is **leaderboard integrity vs. residual identifiability** on
erasure. Hard delete is the simplest but destroys the historical standings that
make a league meaningful. Keeping the team name preserves history but only works
if names are guaranteed non-identifying — which we can't enforce on free text.
Replacing with a neutral token gives us **both**: the row stays (rank/score/round
history intact) and carries no personal data, so it falls out of GDPR scope as
anonymous data. The small cost — a slightly less readable "Retired Team #1742" on
old boards — is well worth removing all re-identification risk.

On integration, going direct via ASP.NET Core OIDC keeps our processor list short
(only the IdP, which is a separate controller) and gives us precise control over
scopes and claims — the exact knobs data minimization needs. A managed service
would be marginally faster to feature-complete but adds a DPA and typically
collects more than we want.

## Data model impact (to implement when auth is wired)

- **`app_user`**: add `external_provider` + `external_subject` with a unique
  `(external_provider, external_subject)`. **Drop the `email` column** — email is
  not collected (re-add only if a future need arises). The account-level
  `display_name` is **superseded by per-registration `team_name`** as the display
  identifier (drop or make optional). The manual user-CRUD endpoints are replaced by
  the Google first-login flow.
- **`registration`**: add **`team_name`** (required at signup; length-limited,
  best-effort profanity/PII input filter). Not required to be unique. Make
  **`registration.user_id` nullable** so it can be severed on erasure (the existing
  unique `(user_id, season_id)` tolerates multiple NULLs — Postgres NULLs distinct).
- **Leaderboards**: switch the displayed name from the user's `display_name` to the
  registration's `team_name` ([LeaderboardEndpoints](../../apps/api/src/Api/Endpoints/LeaderboardEndpoints.cs)).
- **Erasure flow** (new admin/self-service action): delete `app_user`; for each of
  the user's registrations set `user_id = NULL` and `team_name = '<neutral token>'`;
  retain rosters/picks/scores/round_totals. Propagate to backups on their normal cycle.

## GDPR posture (summary)

- **What we hold:** a pseudonymous `sub`, a self-chosen `team_name`, and game data.
  No email by default; no provider tokens; no passwords.
- **Lawful basis:** performance of a contract (account + gameplay). Any marketing
  would need separate consent.
- **Data subject rights:** access (export a user's registrations/picks/scores),
  erasure (the anonymize-with-token flow above). Account recovery is re-auth with
  the provider — we hold nothing to recover.
- **Anonymization caveat:** must be irreversible (no surviving link in tables,
  logs, or backups) for the leaderboard row to be out of scope. Singling-out via
  unique pick history is low-risk here but acknowledged.

## Consequences

**Easier:**
- Minimal data to secure; no password/reset/breach-exposure burden.
- Leaderboard history survives erasure with zero residual PII.
- Standings are pseudonymous by default (team name only).

**Harder:**
- `registration.user_id` becomes nullable — "a user's registrations" queries and
  the erasure path need care; FK delete behavior revisited.
- Need a best-effort input filter on `team_name` and a neutral-token generator.
- Backups must be in scope for erasure propagation.

**To revisit:**
- Add `email` (and its scope) only if/when notifications or recovery require it.
- Second provider, or a managed service, if reach/feature needs grow.

## Action Items

1. [x] **Provider: Google** — chosen for widest reach; `openid` scope only.
2. [x] **Email: not collected** — never request the `email` scope; drop the column.
3. [x] Schema migration: `app_user` (external id, email removed), `registration` (`team_name`, nullable `user_id`).
4. [x] ASP.NET Core OIDC handler for Google wired — `openid`-only scope, cleared claim actions, `SaveTokens = false`, no userinfo. **Still needs a Google Cloud OAuth client** (id/secret in `Authentication:Google:*`); a Development-only `dev-login` stands in for testing meanwhile.
5. [x] First-login flow creates `app_user` from `sub`; `team_name` captured at registration.
6. [x] Leaderboards display `team_name` (no user identity exposed).
7. [x] Erasure action (sever link + neutral token, retain game data) and access/export action.
8. [x] `team_name` guard (length + email-like reject) and neutral-token generator.

**Authorization model (implemented):** three tiers —
- **Public:** leaderboards, the price/selection board read, health, the `/auth/*` endpoints.
- **Player** (any authenticated user): register; read/write **only their own** roster
  (ownership checked via `registration.UserId == uid`, 403 otherwise).
- **Admin** (a config allowlist of Google subjects → `"Admin"` policy): all league
  management — catalog CRUD, prices write, ingestion, scoring, ruleset authoring,
  registration cap/list, user erasure/export. Empty allowlist ⇒ no admins (all 403).
  A Development-only `dev-login` mints either tier for testing.

**Remaining:** create the Google OAuth client and supply the credentials
(`Authentication:Google:*`) plus your own Google subject in `Authentication:AdminSubjects`.

---

## Amendment (2026-06-17) — Collect name + email

**Status:** Accepted. **Supersedes Decision #2** of the original (the `openid`-only,
no-email/no-name posture). Everything else in this ADR — Decisions #1, #3, #4, the
erasure model, and the authorization tiers — **still stands**.

### Why we changed our mind

The original ADR deferred email "until notifications or recovery require it" (see
*To revisit*). Standing up the player UI surfaced two concrete needs the `openid`-only
posture couldn't serve:

- **A human identity for the player.** The Google sign-in flow and the account nav
  read more naturally with a real name, and private leagues are social spaces where
  members want to recognize each other by name, not only by a team pseudonym.
- **A reachable address.** Email is the prerequisite for round-open / lock-soon
  notifications and for account continuity — exactly the "future need" the original
  ADR flagged as the trigger to re-add it.

We judged the added data-protection surface acceptable because the **public** posture
is unchanged: standings remain pseudonymous, and erasure still removes all PII.

### Decision (amendment)

1. **Request `email` and `profile`** from Google (added to the existing `openid`).
   On first login, populate the account from the id_token claims.
2. **`app_user` stores `name` and `email`** (both nullable; back-filled from the
   provider). `(external_provider, external_subject)` **remains the identity key** —
   name and email are *profile attributes*, not keys, and email is **not** required
   to be unique (a Google account's email can change; `sub` is the stable anchor).
3. **Name visibility is scoped to private leagues.** `team_name` is **still the only
   identifier on public surfaces** — the global/season leaderboard and *public*
   leagues show `team_name` only. A member's **real name is shown only to fellow
   members of a _private_ league** (alongside the team name). **Email is never shown
   to anyone but the account holder** (returned by `GET /auth/me` only).
4. **Erasure absorbs the new PII with no model change.** The erasure flow already
   deletes `app_user` and severs `registration.user_id`; `name`/`email` are deleted
   with the account, and because private-league name display is derived through the
   (now-severed) user link, the name **disappears from private leagues automatically**.
   The neutral-token rewrite of `team_name` is unchanged.

### Data model impact (amendment)

- **`app_user`**: **re-add** `name` and `email` (nullable). This reverses the original
  "drop the `email` column" instruction.
- **OIDC config** (`AuthSetup.cs`): add `email` + `profile` scopes; map the `name`
  and `email` claims; first-login flow writes them to `app_user`. `SaveTokens`
  stays `false`.
- **`dev-login`**: accept optional `name`/`email` query params (synthesize defaults
  otherwise) so local play mirrors the real claim shape.
- **`GET /auth/me`**: return `name` and `email` to the authenticated holder.
- **League leaderboard** ([LeagueEndpoints](../../apps/api/src/Api/Endpoints/LeagueEndpoints.cs)):
  project a `name` onto entries **only when the league is `Private` and the requester
  is a member**; never on public/global leaderboards.
- **Export**: add `name`/`email` to the access/export payload.

### GDPR posture (revised)

- **What we hold now:** the pseudonymous `sub`, **`name` and `email`**, a self-chosen
  `team_name`, and game data. (Previously: no name, no email.)
- **Lawful basis:** still performance of a contract for account + gameplay. **Email
  used for transactional notices** (round-open / lock reminders) rides the same
  basis; any *marketing* email needs separate consent.
- **Exposure surface:** name is visible only to private-league co-members; email only
  to the holder. Public standings stay pseudonymous, so the central trade-off
  analysis above (leaderboard integrity vs. residual identifiability on erasure) is
  unaffected.
- **Cookie consent:** the `endurance.session` cookie needs **no consent banner**. It's set only
  after the user actively signs in, is used solely for authentication/session, and is first-party
  with no tracking — i.e. "strictly necessary," which is exempt under the ePrivacy Directive
  (consent governs *storage on the device*, separately from GDPR's lawful basis for the data).
  Transparency is still owed: the privacy notice must disclose it. This changes **only** if we
  later add non-essential cookies (analytics, advertising) — those would require a consent banner,
  separate from the exempt auth cookie.
- **Compliance review:** the privacy notice must now disclose name + email collection, the
  notification use, and the session cookie; fold into the pre-launch review the original already calls for.

### Action items (amendment)

1. [x] `app_user` migration: add nullable `name`, `email`.
2. [x] OIDC: add `email`+`profile` scopes; map + persist claims on first login.
3. [x] `dev-login`: optional `name`/`email` params with defaults.
4. [x] `GET /auth/me`: return `name`/`email` to the holder.
5. [x] League leaderboard: member-gated `name`, **private leagues only**.
6. [x] Export: include `name`/`email`; confirm erasure removes them (delete-with-account).
7. [ ] Privacy notice: disclose name/email + notification use **+ the strictly-necessary session cookie** (pre-launch).
