# Production deploy runbook

**Created:** 2026-06-18 · **Status:** ready to execute (first deploy)

How IMSA Fantasy goes to production. The image bucket (S3 + CloudFront) is already live — see
[s3-cloudfront-setup.md](s3-cloudfront-setup.md). This covers the **API**, the **database**, and the
**web SPA**.

## Decisions

| Piece | Choice |
| --- | --- |
| API + Postgres | **Railway** — Hobby plan ($5/mo + metered usage; realistic bill ~$8–14/mo). Upgrade to Pro in-place only if 30-day log retention / flat billing / priority support is wanted (instant, lossless). |
| Web SPA | **S3 + CloudFront**, in the **same AWS account as the image bucket** (consolidated billing). |
| Images | S3 `race-fantasy-images` behind CloudFront `d3pjy1wdjw3iy0.cloudfront.net` — already live. |
| DB migrations | **Applied on startup** (`db.Database.Migrate()` at boot). |
| API domain | `fantasyapi.arjunakankipati.com` |
| Web domain | `fantasy.arjunakankipati.com` |

Both domains share the registrable domain `arjunakankipati.com` → **same-site**, so the existing
`SameSite=Lax` session cookie works. Only **CORS-with-credentials** is needed (no `SameSite=None`).

## Topology

```
fantasy.arjunakankipati.com    ──CloudFront ──▶ S3 (web SPA, pnpm build → dist/)   ┐
        │ fetch (credentials:'include', CORS)                                       │ same AWS
        ▼                                                                           │ account
fantasyapi.arjunakankipati.com ──Railway (.NET 10, /health) ─▶ Railway Postgres     │
        │ presigned PUT (admin uploads)              OIDC ⇄ Google                  │
        ▼                                                                           │
race-fantasy-images (S3) ◀──reads── d3pjy1wdjw3iy0.cloudfront.net ──────────────────┘
```

---

## Phase 1 — Code/config changes (land before deploy)

All in `apps/api/src/Api/Program.cs` + config. These are gaps in the current codebase.

1. **Forwarded headers (FIRST in the pipeline).** Railway terminates TLS, so the app sees HTTP.
   Without this, HTTPS redirect, secure-cookie detection, and the OIDC `redirect_uri` all break.
   ```csharp
   app.UseForwardedHeaders(new ForwardedHeadersOptions {
       ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto });
   ```
   Clear `KnownNetworks`/`KnownProxies` (Railway's proxy IP isn't fixed).

2. **CORS** — none today. Allow the web origin with credentials:
   ```csharp
   builder.Services.AddCors(o => o.AddPolicy("web", p => p
       .WithOrigins(builder.Configuration["Web:Origin"]!)   // https://fantasy.arjunakankipati.com
       .AllowAnyHeader().AllowAnyMethod().AllowCredentials()));
   app.UseCors("web");   // after UseHttpsRedirection, before UseAuthentication
   ```

3. **Cookie hardening** — in `AuthSetup.cs` cookie options set
   `o.Cookie.SecurePolicy = CookieSecurePolicy.Always` (keep `SameSite=Lax`).

4. **Migrate on startup** — after `app.Build()`, before `app.Run()`, resolve `FantasyDbContext` from
   a scope and call `db.Database.Migrate()`. ⚠️ A bad migration now **crashes boot → API down**, so
   always test the migration against a local/throwaway DB copy first. Single instance at MVP scale,
   so no concurrent-migration race.

5. **Dockerfile** (`apps/api/Dockerfile`) — multi-stage: .NET 10 SDK build → ASP.NET 10 runtime.
   Build `src/Api`. Bind `ASPNETCORE_URLS=http://+:${PORT}` (Railway injects `$PORT`).

6. **returnUrl allowlist (hardening, low priority).** `/auth/login` redirects to any absolute
   `returnUrl`. Validate it starts with `Web:Origin` to close the open-redirect.

---

## Phase 2 — Provision infrastructure

### API (Railway)
1. New Railway project → add the **Postgres** plugin.
2. Add a service from the repo: root `apps/api`, Dockerfile build.
3. **Custom domain** → `fantasyapi.arjunakankipati.com`. Railway returns a CNAME target and
   provisions TLS.
4. **Spend cap** (Workspace → Usage): **soft alert ~$15**, **hard limit ~$30**.
   ⚠️ On Railway, **Postgres is also a workload** — if the hard limit trips, the database goes offline
   too and the whole app is down (data is safe on the volume, but it's a hard outage). Keep the hard
   limit comfortably above realistic peak (~$8–14) so a normal qualifying-lock/scoring spike can't
   black out the site.

### Web (S3 + CloudFront — same AWS account as the image bucket)
Mirror the image-bucket runbook ([s3-cloudfront-setup.md](s3-cloudfront-setup.md)):
1. Private S3 bucket (e.g. `fantasy-web`), Block Public Access fully ON.
2. CloudFront distribution with **OAC** (use the recommended-origin path), origin = the web bucket.
3. **ACM cert in `us-east-1`** for `fantasy.arjunakankipati.com`; set it as the distribution's
   Alternate Domain Name (CNAME).
4. **Default root object** = `index.html`.
5. **SPA routing:** add CloudFront custom error responses mapping **403 → `/index.html` (200)** and
   **404 → `/index.html` (200)**, so React Router deep links (`/pick/:id`, `/admin/*`) resolve.
6. Bucket policy: CloudFront-read (locked to this distribution's ARN) + writer principal — same
   two-statement pattern as the image bucket.

### DNS (arjunakankipati.com)
- CNAME `fantasyapi` → Railway target.
- CNAME `fantasy` → web CloudFront domain.

### Google OAuth console
- Authorized redirect URI: `https://fantasyapi.arjunakankipati.com/auth/google/callback`
- Authorized JS origin: `https://fantasy.arjunakankipati.com`

### Image bucket S3 CORS
Add `https://fantasy.arjunakankipati.com` to the `race-fantasy-images` bucket CORS `AllowedOrigins`
(method `PUT`) — required for admin browser presigned uploads (flagged as not-yet-done in the image
setup doc).

---

## Phase 3 — Configuration

### Railway env vars (.NET reads `__` as nesting)
| Var | Value |
| --- | --- |
| `ConnectionStrings__Postgres` | from Railway Postgres → Npgsql form `Host=…;Database=…;Username=…;Password=…;SSL Mode=Require` |
| `Authentication__Google__ClientId` / `__ClientSecret` | from Google console |
| `Authentication__AdminSubjects__0` | your real Google `sub` |
| `Aws__BucketName` | `race-fantasy-images` |
| `Aws__Region` | `us-east-1` |
| `Aws__AccessKeyId` / `Aws__SecretAccessKey` | `my-app-writer` keys |
| `Web__Origin` | `https://fantasy.arjunakankipati.com` |
| `ASPNETCORE_ENVIRONMENT` | `Production` (disables dev-login + OpenAPI) |

### Web build-time env (Vite inlines at `pnpm build` — set in the build shell, not runtime)
| Var | Value |
| --- | --- |
| `VITE_API_BASE_URL` | `https://fantasyapi.arjunakankipati.com` |
| `VITE_IMAGE_BASE_URL` | `https://d3pjy1wdjw3iy0.cloudfront.net` |

---

## Phase 4 — Deploy sequence

1. Land Phase-1 changes on a branch → merge.
2. Deploy API on Railway → it migrates on boot → confirm `GET https://fantasyapi.arjunakankipati.com/health`
   returns `{status:"ok"}`.
3. Build + ship web:
   ```bash
   cd apps/web
   VITE_API_BASE_URL=https://fantasyapi.arjunakankipati.com \
   VITE_IMAGE_BASE_URL=https://d3pjy1wdjw3iy0.cloudfront.net \
   pnpm build
   aws s3 sync dist/ s3://fantasy-web --delete
   aws cloudfront create-invalidation --distribution-id <web-dist-id> --paths "/*"
   ```
4. Seed minimal catalog data — run the `apps/api/scripts/` seeders against prod with an admin cookie,
   or import via the admin console.

---

## Phase 5 — Smoke test (prod)

- `GET /health` → OK.
- Landing lists championships from the live API (proves CORS read path).
- Google sign-in → redirected back to `fantasy.*`; `/auth/me` returns your user with `isAdmin:true`
  (proves cookie + same-site + CORS-credentials).
- Deep-link reload, e.g. `https://fantasy.arjunakankipati.com/pick/1`, returns the app not a 404
  (proves CloudFront SPA error-response mapping).
- Admin uploads a livery → renders via CloudFront (proves image S3 CORS + presigned PUT).
- Register a team → save a roster (player write path + ownership).
- **Re-test sign-in on Safari** — ITP is the usual cross-subdomain cookie failure.

---

## Phase 6 — Rollback / safety

- Railway keeps prior deploys for one-click **app** rollback — but that does **not** touch the database.
- Because migrations apply on startup, a prior deploy runs against the already-migrated schema. So a
  bad migration must be **unwound manually first**, then the app rolled back — order matters:
  1. `dotnet ef database update <PreviousMigration>` against prod (or hand-written reverse SQL).
  2. *Then* roll the Railway deploy back to the matching app version.
- DB snapshots are **not** required for this rollback path.
- Roll-back triggers: API fails to boot (migration error in logs), `/auth/me` 401s after sign-in,
  or 5xx on `/health`.

---

## Appendix — AWS-hosted alternative (not chosen)

If consolidating the API + DB into the same AWS account ever becomes preferable over Railway:
- **App Runner + RDS `db.t4g.micro`** ≈ $21–26/mo — closest managed analog (built-in HTTPS + custom
  domain; deploy a container image via ECR; needs a VPC connector to reach RDS). No scale-to-zero, so
  structurally pricier than Railway's idle metering.
- **Lightsail** (container Small $15 + managed Postgres $15) ≈ $30/mo flat.
- **Single EC2 `t4g.small`** (API container + Postgres on-box) ≈ $14/mo but full DIY ops (TLS,
  Postgres, backups, patching).

Railway Hobby (~$8–14/mo, git-push deploy, metered-to-idle) wins on cost + simplicity for this
bursty, niche-scale workload; AWS wins only if single-account billing/IAM consolidation outweighs
~2× the cost.
