# Deploy runbook (routine)

**Status:** steady-state · For the **first** deploy (provisioning Railway, the web bucket +
CloudFront distribution, DNS, OAuth console) see [first-deploy.md](first-deploy.md). This doc covers
**redeploying** once that infrastructure exists.

## TL;DR

```bash
cd apps/web
pnpm deploy:web      # build → S3 sync → CloudFront invalidation
```

That's the whole web deploy. The API redeploys on its own — see [API](#api) below.

---

## What gets deployed where

| Piece | How it ships | Trigger |
| --- | --- | --- |
| **Web SPA** | `apps/web/scripts/deploy.sh` → S3 + CloudFront | manual, when you run it |
| **API** | Railway builds the `apps/api` Dockerfile | **auto on push** to the deploy branch |
| **DB migrations** | `db.Database.Migrate()` at API boot | rides the API deploy |
| **Images** | admin console upload (presigned PUT) | per-asset, not part of a deploy |

---

## Web SPA

### One-time setup (do once per machine)

1. **AWS CLI** installed and a scoped deploy profile configured — see
   [Deploy IAM user](#deploy-iam-user-console) below.
2. **`apps/web/.env.deploy`** filled in (gitignored; the script scaffolds a template on first run):
   ```
   WEB_S3_BUCKET=<web SPA bucket>
   WEB_CF_DISTRIBUTION_ID=<distribution serving fantasy.arjunakankipati.com>
   AWS_PROFILE=imsa-deploy
   ```
3. **`apps/web/.env.production`** present (committed-by-convention public URLs Vite inlines at build):
   ```
   VITE_API_BASE_URL=https://fantasyapi.arjunakankipati.com
   VITE_IMAGE_BASE_URL=https://d3pjy1wdjw3iy0.cloudfront.net
   ```

### Deploy

```bash
cd apps/web
pnpm deploy:web              # = bash scripts/deploy.sh
# or:  ./scripts/deploy.sh --skip-build   # re-ship the existing dist/ without rebuilding
```

The script ([scripts/deploy.sh](../../apps/web/scripts/deploy.sh)):

1. **Preflight** — verifies `aws`/`pnpm`, the config values, `.env.production`, and that the AWS
   profile authenticates (`sts get-caller-identity`) before changing anything.
2. **Build** — `pnpm install --frozen-lockfile` + `pnpm build` (Vite loads `.env.production` in
   production mode).
3. **Upload (two passes)**:
   - hashed assets → `Cache-Control: public,max-age=31536000,immutable` (content-addressed by
     Vite's filename hash, so they're safe to cache forever and never need invalidating);
   - HTML → `Cache-Control: no-cache` so browsers always revalidate the SPA shell and pick up a
     new build immediately.
4. **Invalidate** — `cloudfront create-invalidation --paths "/*"` so the edge flips to the new
   build at once instead of waiting out its TTL. Prints the invalidation id.

### Cache model (why two passes + an invalidation)

Two caches sit in front of S3: the **browser** and the **CloudFront edge**. The `Cache-Control`
headers govern mainly the browser; the invalidation governs the edge.

- `immutable` assets: browser and edge keep them forever — fine, because a new build emits new
  filenames (new URLs), so old ones are simply never requested again.
- `no-cache` HTML: the browser revalidates `index.html` every load (a cheap conditional request,
  usually a `304`), so no user clings to a stale shell between deploys.
- Invalidation: CloudFront's edge TTL (set by the distribution's cache policy) can otherwise keep
  serving the old `index.html` after S3 is updated. `/*` forces a fresh origin fetch immediately.
  At your deploy cadence this is one path/deploy, well within the free tier.

---

## Deploy IAM user (Console)

A dedicated **programmatic-only** IAM user (`imsa-web-deployer`) whose keys can *only* push the web
bucket and invalidate the one distribution — nothing else. Mirrors the `my-app-writer` pattern in
[s3-cloudfront-setup.md](s3-cloudfront-setup.md). Created via the AWS Console so root credentials
never go into the CLI.

### Identifiers to gather first (Console)

- **Account ID** — top-right account menu.
- **Web bucket name** — S3 console (the SPA bucket, *not* `race-fantasy-images`).
- **Distribution ID** — CloudFront console, the distribution aliased to `fantasy.arjunakankipati.com`.

### 1. Create the user

**IAM → Users → Create user** → name `imsa-web-deployer` → **leave console access unchecked**
(programmatic only) → choose "Attach policies directly", attach nothing → **Create user**.

### 2. Attach the least-privilege inline policy

Open the user → **Permissions → Add permissions → Create inline policy → JSON**, paste this with the
three placeholders replaced, name it `web-deploy`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "ListWebBucket",
      "Effect": "Allow",
      "Action": "s3:ListBucket",
      "Resource": "arn:aws:s3:::WEB_BUCKET"
    },
    {
      "Sid": "WriteWebObjects",
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject"],
      "Resource": "arn:aws:s3:::WEB_BUCKET/*"
    },
    {
      "Sid": "InvalidateCdn",
      "Effect": "Allow",
      "Action": "cloudfront:CreateInvalidation",
      "Resource": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DIST_ID"
    }
  ]
}
```

This is exactly what `deploy.sh` exercises — list + write/delete in the web bucket, invalidate the
one distribution. No `s3:GetObject` (`s3 sync` uploads don't read), no image-bucket access, no other
CloudFront actions.

### 3. Issue keys

User → **Security credentials → Create access key → "Application running outside AWS"** → download
the .csv (secret shown once).

### 4. Store as a named profile

Uses the **deploy user's** keys, not root:

```bash
aws configure --profile imsa-deploy
# paste the Access key + Secret from the .csv; region us-east-1; output json
```

Then set `AWS_PROFILE=imsa-deploy` in `apps/web/.env.deploy`.

### 5. Verify the scoping

```bash
AWS_PROFILE=imsa-deploy aws sts get-caller-identity         # -> .../imsa-web-deployer
AWS_PROFILE=imsa-deploy aws s3 ls s3://<web bucket>         # works
AWS_PROFILE=imsa-deploy aws s3 ls s3://race-fantasy-images  # AccessDenied (proves it's boxed in)
```

The `AccessDenied` on the image bucket is the proof the user can only do web deploys.

---

## API

The API redeploys **automatically** when you push to the branch Railway watches — Railway rebuilds
the `apps/api` Dockerfile and restarts the service. Migrations apply on boot (`db.Database.Migrate()`).

- Confirm health after a deploy: `curl https://fantasyapi.arjunakankipati.com/health` → `{status:"ok"}`.
- ⚠️ A bad migration **crashes boot → API down**. Test migrations against a throwaway DB copy before
  pushing. See rollback below.
- Config changes (env vars, admin allowlist) are made in the **Railway dashboard**, not in a deploy.

---

## Post-deploy smoke test

After a web deploy (and any API deploy):

- Landing lists championships (CORS read path + API up).
- Hard-reload a deep link, e.g. `https://fantasy.arjunakankipati.com/pick/1` → app, not a 404
  (CloudFront SPA error mapping intact).
- Google sign-in → `/auth/me` returns your user (cookie + same-site + CORS-credentials).
- Confirm the new build actually shipped (a changed string is visible; hard-refresh if your own
  browser cached the shell — others get it via the `no-cache` revalidation).

---

## Rollback

### Web
Re-deploy a known-good commit:

```bash
git checkout <good-commit> -- apps/web      # or check out the commit/tag
cd apps/web && pnpm deploy:web
```

The build + invalidation reverts the edge to the prior bundle. The web bucket has **versioning off**,
so git is the source of truth for rollback — there are no prior object versions to restore.

### API / DB
Railway keeps prior deploys for one-click **app** rollback — but that does **not** touch the DB.
Because migrations apply on startup, unwind a bad migration **first**, then roll the app back:

1. `dotnet ef database update <PreviousMigration>` against prod (or hand-written reverse SQL).
2. *Then* roll the Railway deploy back to the matching app version.

Roll-back triggers: API fails to boot (migration error in logs), `/auth/me` 401s after sign-in, or
5xx on `/health`.
