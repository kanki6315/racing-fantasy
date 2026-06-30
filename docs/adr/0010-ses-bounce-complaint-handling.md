# ADR-0010: SES Bounce & Complaint Handling

**Status:** Proposed
**Date:** 2026-06-30
**Related:** [ADR-0009](0009-picks-reminder-emails.md) (the emails this protects), [ADR-0004](0004-authentication-and-data-minimization.md) (erasure / data minimization)

## Context

The picks-reminder emails ([ADR-0009](0009-picks-reminder-emails.md)) now send real mail via SES from
a brand-new sending domain. The biggest risk to deliverability — especially while the domain is still
warming — is continuing to mail addresses that **hard-bounce** or **mark us as spam**. Mailbox
providers weight bounce rate and complaint rate heavily; a few per send can sink domain reputation
and land everything in spam.

SES reports these as **Bounce** and **Complaint** events. We need to (1) **record every instance**
for an audit trail and future visibility, and (2) **suppress** the affected address so it's never
mailed again. SES publishes these events via a **configuration set event destination**, which can
target SNS, EventBridge, Firehose, or CloudWatch — SES does not POST to an arbitrary URL directly.

A constraint from the product owner: **avoid standing up (and paying for) SQS** — record events
directly in the app.

## Decision

Attach a **configuration set** to every send; route **Bounce + Complaint** events to an **SNS topic**
that delivers over **HTTPS** to a new endpoint, which verifies the signature, **records an
`email_event`**, and **suppresses** the recipient — all in-process, no queue.

```
SesEmailSender ──ConfigurationSetName──▶ SES ──bounce/complaint──▶ config-set event destination
                                                                          │
                                                                    SNS topic
                                                                          │ HTTPS
                                                                          ▼
                                          POST /email/ses-events → verify sig → record + suppress
```

### D1 — SNS → HTTPS, no SQS

Events flow SES → SNS → an HTTPS subscription to `POST /email/ses-events`, which writes to Postgres
synchronously. **No SQS, no queue to pay for.** SNS is still required (SES can't webhook directly),
but SNS HTTPS delivery is free for the first 1M/month and negligible after — this is *not* SQS.

The trade-off vs a queue/DLQ: if the API is down for SNS's entire retry window, an event is lost. We
accept this because (a) SNS retries on its own for a while, and (b) SES keeps an **account-level
suppression list** that auto-blocks permanent bounces + complaints regardless — so a missed event
still protects reputation; we'd only lose *our* record of that one instance. A DLQ (an SQS queue) is
the documented upgrade if guaranteed capture is ever needed.

### D2 — Record every instance: `email_event`

```sql
email_event(id, type, subtype, email, user_id?, ses_message_id?, sns_message_id?, raw jsonb, received_at)
```

- `type` = `Bounce` | `Complaint`; `subtype` = bounce type/subtype (`Permanent`/`Transient` + detail)
  or complaint feedback type (`abuse`, …).
- `email` = the affected recipient; `user_id` resolved by matching it to an `app_user`.
- `raw` keeps the full notification (jsonb) for audit; `ses_message_id` / `sns_message_id` for
  correlation + idempotency (D6).

### D3 — Suppression is separate from the opt-in flag

```sql
app_user.email_suppressed_at  timestamptz NULL
```

A hard bounce or complaint sets `email_suppressed_at`. The reminder recipient query gains
`AND email_suppressed_at IS NULL`. This is deliberately **separate from `email_reminders_enabled`**
(the user's opt-in): suppression is a system-level block the user can't undo by toggling the setting
back on — so we never re-mail a known-bad or complained address. (Surfacing this in the account UI is
a later nicety; not required now.)

### D4 — Reaction rules

- **Complaint** → suppress immediately (they marked spam — highest reputation risk). Record.
- **Permanent bounce** → suppress. Record.
- **Transient (soft) bounce** → **record only.** Reminders are one-shot per weekend, so a soft bounce
  just means that send missed; we don't suppress on it. (Suppress-after-N-soft-bounces is a possible
  later refinement.)

### D5 — Security: verify SNS, don't trust the POST

The endpoint is public and unauthenticated, so every message is **signature-verified** (validate
against `SigningCertURL`, confirm it's an `*.amazonaws.com` host) and checked against an expected
**Topic ARN allowlist** (`Aws:Ses:EventsTopicArn`) before any action — otherwise anyone could POST
fake complaints to suppress users. The one-time **SubscriptionConfirmation** message is handled
(confirm the subscription); `Notification` messages carry the SES event JSON. Uses
`AWSSDK.SimpleNotificationService`'s message parser/verifier.

### D6 — Idempotency

SNS can redeliver. Dedupe on a unique **`(sns_message_id, email)`** index (retries reuse the SNS
MessageId; a multi-recipient notification yields distinct emails). All reactions are idempotent
anyway (setting a flag, inserting-or-skipping a record).

### D7 — Correlate to the send: `ses_message_id` on `event_reminder`

```sql
event_reminder.ses_message_id  text NULL
```

`SesEmailSender` now returns the SES `messageId`; the worker stores it on the `event_reminder` claim
row at send time. A later bounce/complaint (which carries `mail.messageId`) can then be linked back
to the exact event + user that triggered it.

## Options Considered

| Transport | Cost / infra | Durability | Verdict |
|-----------|-------------|-----------|---------|
| **SNS → HTTPS** (chosen) | No queue; SNS HTTPS ~free | SNS retries; SES account-suppression backstop | **Chosen** — matches the "no SQS" constraint, fits the existing API |
| SNS → SQS → poller | Free at this scale but a new queue + SQS SDK + worker | Durable buffer + DLQ | Rejected — explicitly avoiding a queue; durability not worth it here |
| EventBridge → API destination | Heavier setup (connection + API destination) | Good | Rejected — more moving parts for no benefit at this scale |
| Legacy identity SNS notifications | Similar | Similar | Rejected — configuration-set events are the modern, more flexible path (per-message, richer event types) |

## Consequences

**Easier:**
- Domain reputation is protected automatically: complained/hard-bounced addresses stop getting mail.
- A full audit trail of every bounce/complaint, queryable and linkable to the originating send.
- No new paid infrastructure — one endpoint + an SNS topic.

**Harder:**
- A new public, signature-verified webhook to maintain; SNS subscription is a one-time AWS setup step.
- Without a DLQ, an event delivered while the API is down for the whole retry window is not recorded
  (mitigated by SES's own account suppression).
- Suppression is now a second gate on sending (alongside the opt-in flag) — slightly more logic in the
  recipient query and, eventually, the account UI.

**To revisit:**
- **Suppress-after-N transient bounces**, and surfacing suppression state in the account UI.
- A **DLQ** (the one place SQS would return) if guaranteed event capture is ever required.
- Whether to also enable SES's per-configuration-set suppression options as defense-in-depth.

## Action Items

1. [ ] Schema: `email_event` table; `app_user.email_suppressed_at`; `event_reminder.ses_message_id`. Migration `AddEmailEventsAndSuppression`. EF: `raw` jsonb, unique `(sns_message_id, email)`, FKs cascade with the user (erasure, ADR-0004).
2. [ ] `Aws:Ses:ConfigurationSetName` (+ `EventsTopicArn`) options; set `ConfigurationSetName` on `SendEmail`.
3. [ ] `IEmailSender.SendAsync` returns the SES `messageId`; worker stores it on `event_reminder`; recipient query excludes `email_suppressed_at IS NOT NULL`.
4. [ ] `POST /email/ses-events` (AllowAnonymous): SNS signature verify + topic allowlist + subscription confirm + parse Bounce/Complaint + record + suppress (idempotent). Add `AWSSDK.SimpleNotificationService`; map in `Program.cs`.
5. [ ] AWS one-time: create configuration set + SNS topic + event destination (Bounce, Complaint); subscribe the topic to `https://<api>/email/ses-events`; set `Aws:Ses:ConfigurationSetName` + `EventsTopicArn` in Railway.
6. [ ] Docs: add `email_event` + the new columns to [data-model.md](../data-model.md); index this ADR in [docs/README.md](../README.md).
