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

## Entry-list PDF parser sidecar

`POST /rounds/{id}/entry-list/parse-pdf` shells out to the `parse-entry-list`
console command from the **pitpass-parser** package (the parser lives in the
broadcast-helper repo under `parser/`; see its SCHEMA.md for the contract and
compatibility policy). Unconfigured, the endpoint 503s and the JSON import
keeps working — the parser is optional per environment.

Local setup (editable install, so parser edits in broadcast-helper are live
here without reinstalling):

```bash
python3 -m venv ~/.venvs/pitpass-parser
~/.venvs/pitpass-parser/bin/pip install -e ../../../broadcast-helper/parser
cd src/Api
dotnet user-secrets set "EntryListParser:Command" "$HOME/.venvs/pitpass-parser/bin/parse-entry-list"
```

In production the [Dockerfile](Dockerfile) bakes a venv and pip-installs the
package from the broadcast-helper repo at the `PARSER_REF` tag; the build needs
`GH_PARSER_TOKEN` (fine-grained PAT, read-only Contents on broadcast-helper) as
a Railway service variable. To pick up a new parser release, bump `PARSER_REF`.

The admin allowlist (`Authentication:AdminSubjects`) is intentionally **not** a secret —
it's a list of Google `sub`s checked into `appsettings.Development.json`; for production set
it via host config.
