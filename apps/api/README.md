# EnduranceFantasy API

Modular-monolith backend for the Endurance Fantasy League. See [../docs](../docs/README.md)
for the design (ADRs, ERD, roadmap). This is **Phase 0** — schema + project structure.

## Layout

```
EnduranceFantasy.slnx
└── src/
    ├── Api/            ASP.NET Core host (startup project)
    ├── Domain/         entities + enums (no infra deps)
    └── Infrastructure/ EF Core 10 + Npgsql, FantasyDbContext
```

## Prerequisites

- **.NET 10 SDK** (the projects target `net10.0`).
- Docker (local Postgres via `docker-compose.yml`).
- EF CLI: `dotnet tool install --global dotnet-ef` (use the 10.x tools).

## Dev setup

```bash
# 1. Start Postgres
docker compose up -d

# 2. Create the initial migration from the model (run once)
dotnet ef migrations add InitialSchema \
  --project src/Infrastructure \
  --startup-project src/Api

# 3. Apply it
dotnet ef database update \
  --project src/Infrastructure \
  --startup-project src/Api

# 4. Run the API
dotnet run --project src/Api
# health check: GET /health  ->  { "status": "ok" }
```

The dev connection string lives in `src/Api/appsettings.Development.json`
(`ConnectionStrings:Postgres`) and matches the docker-compose credentials.

## Configuration & secrets

Every config key the app reads is declared (empty) in the committed
[`src/Api/appsettings.json`](src/Api/appsettings.json) — that file is the schema.
Non-secret dev values (the local Postgres string, the admin allowlist) live in
`appsettings.Development.json`. **Real secrets stay out of the repo** and are layered on
top via [.NET user-secrets](https://learn.microsoft.com/aspnet/core/security/app-secrets)
(the `Api` project already has a `UserSecretsId`) locally, or environment variables /
host config in production.

Populate your local secret store from `src/Api`:

```bash
# Google OIDC (required for real Google sign-in; dev-login works without it)
dotnet user-secrets set "Authentication:Google:ClientId"     "<client-id>"
dotnet user-secrets set "Authentication:Google:ClientSecret" "<client-secret>"

# S3 image bucket (admin image upload — see AGENTS.md "Images")
dotnet user-secrets set "Aws:BucketName" "<bucket>"
dotnet user-secrets set "Aws:Region"     "<region>"          # e.g. us-east-1
# Credentials are OPTIONAL — omit to use the default AWS credential chain
# (env vars / shared profile / IAM role). Set them only for explicit keys:
dotnet user-secrets set "Aws:AccessKeyId"     "<access-key-id>"
dotnet user-secrets set "Aws:SecretAccessKey" "<secret-access-key>"

# Inspect / clear
dotnet user-secrets list
```

The admin allowlist (`Authentication:AdminSubjects`) is intentionally **not** a secret —
it's a list of Google `sub`s checked into `appsettings.Development.json`; for production set
it via host config.
