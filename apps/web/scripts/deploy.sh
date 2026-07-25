#!/usr/bin/env bash
#
# Deploy the web SPA to S3 + CloudFront.
#
# Mirrors Phase 4, step 3 of docs/infra/deploy.md:
#   pnpm build  ->  aws s3 sync  ->  cloudfront invalidation
#
# Build-time Vite vars (VITE_API_BASE_URL / VITE_IMAGE_BASE_URL) come from
# apps/web/.env.production automatically (Vite loads it in production mode).
#
# Account-specific targets (bucket + distribution id) are read from a gitignored
# apps/web/.env.deploy file. On first run this script writes a template there and
# exits so you can fill it in.
#
# Usage:
#   ./scripts/deploy.sh              # build + deploy
#   ./scripts/deploy.sh --skip-build # deploy the existing dist/ as-is
#
set -euo pipefail

# --- locate the web app root (this script lives in apps/web/scripts) ----------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WEB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
cd "$WEB_DIR"

CONFIG_FILE="$WEB_DIR/.env.deploy"

SKIP_BUILD=0
for arg in "$@"; do
  case "$arg" in
    --skip-build) SKIP_BUILD=1 ;;
    -h|--help) sed -n '2,20p' "$0"; exit 0 ;;
    *) echo "Unknown argument: $arg" >&2; exit 2 ;;
  esac
done

# --- first-run: scaffold the config template ----------------------------------
if [[ ! -f "$CONFIG_FILE" ]]; then
  cat > "$CONFIG_FILE" <<'EOF'
# Deploy targets for the web SPA (gitignored via .env.*).
# Fill these in from the AWS console, then re-run ./scripts/deploy.sh.

# S3 bucket that backs the CloudFront web distribution (NOT the image bucket).
WEB_S3_BUCKET=

# CloudFront distribution id serving fantasy.arjunakankipati.com (e.g. E1ABCD2EFGH3IJ).
WEB_CF_DISTRIBUTION_ID=

# Optional: aws CLI profile / region to use for this deploy.
# AWS_PROFILE=
# AWS_REGION=us-east-1
EOF
  echo "Created $CONFIG_FILE — fill in WEB_S3_BUCKET and WEB_CF_DISTRIBUTION_ID, then re-run." >&2
  exit 1
fi

# shellcheck disable=SC1090
set -a; source "$CONFIG_FILE"; set +a

# --- preflight checks ---------------------------------------------------------
fail() { echo "ERROR: $*" >&2; exit 1; }

command -v aws >/dev/null 2>&1 || fail "aws CLI not found. Install it: https://aws.amazon.com/cli/"
command -v pnpm >/dev/null 2>&1 || fail "pnpm not found. Install it: https://pnpm.io/installation"

[[ -n "${WEB_S3_BUCKET:-}" ]]          || fail "WEB_S3_BUCKET is empty in $CONFIG_FILE"
[[ -n "${WEB_CF_DISTRIBUTION_ID:-}" ]] || fail "WEB_CF_DISTRIBUTION_ID is empty in $CONFIG_FILE"
[[ -f "$WEB_DIR/.env.production" ]]    || fail ".env.production missing — Vite needs it for build-time API/image URLs"

# Confirm we can talk to AWS with the configured creds before doing anything.
ACCOUNT="$(aws sts get-caller-identity --query Account --output text)" \
  || fail "aws credentials not working (check AWS_PROFILE / env / aws configure)"

echo "==> Deploying to:"
echo "    bucket:        s3://$WEB_S3_BUCKET"
echo "    distribution:  $WEB_CF_DISTRIBUTION_ID"
echo "    aws account:   $ACCOUNT"
echo "    region:        ${AWS_REGION:-<default>}"
echo

# --- build --------------------------------------------------------------------
if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "==> Installing deps (frozen lockfile)..."
  pnpm install --frozen-lockfile

  echo "==> Building (vite, mode=production)..."
  pnpm build
else
  echo "==> --skip-build: deploying existing dist/"
fi

[[ -f "$WEB_DIR/dist/index.html" ]] || fail "dist/index.html not found — build did not produce output"

# --- upload to S3 -------------------------------------------------------------
# Two passes so the SPA shell is never served stale:
#  1. Hashed assets are content-addressed -> cache forever (immutable).
#  2. HTML (esp. index.html) must revalidate every load so new builds go live.
echo "==> Syncing hashed assets (long cache)..."
aws s3 sync dist/ "s3://$WEB_S3_BUCKET" \
  --delete \
  --exclude "*.html" \
  --cache-control "public,max-age=31536000,immutable"

echo "==> Uploading HTML (no-cache)..."
aws s3 sync dist/ "s3://$WEB_S3_BUCKET" \
  --exclude "*" \
  --include "*.html" \
  --cache-control "no-cache" \
  --content-type "text/html; charset=utf-8"

# --- invalidate CloudFront ----------------------------------------------------
echo "==> Invalidating CloudFront (/*)..."
INVALIDATION_ID="$(aws cloudfront create-invalidation \
  --distribution-id "$WEB_CF_DISTRIBUTION_ID" \
  --paths "/*" \
  --query "Invalidation.Id" --output text)"

echo
echo "Done. Invalidation $INVALIDATION_ID created."
echo "Live at https://fantasy.arjunakankipati.com (allow a minute for the CDN to flush)."
