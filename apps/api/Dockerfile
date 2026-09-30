# syntax=docker/dockerfile:1
# Multi-stage build for the .NET 10 API. Build context is apps/api (the solution root).

# --- build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first so `restore` is cached unless a .csproj changes.
COPY EnduranceFantasy.slnx ./
COPY src/Api/EnduranceFantasy.Api.csproj src/Api/
COPY src/Domain/EnduranceFantasy.Domain.csproj src/Domain/
COPY src/Infrastructure/EnduranceFantasy.Infrastructure.csproj src/Infrastructure/
RUN dotnet restore src/Api/EnduranceFantasy.Api.csproj

# Copy the rest of the source and publish.
COPY . .
RUN dotnet publish src/Api/EnduranceFantasy.Api.csproj -c Release -o /app --no-restore

# --- runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# GH_PARSER_TOKEN: fine-grained PAT, read-only Contents on kanki6315/broadcast-helper, supplied as a
# Railway service variable (Railway passes service variables to Dockerfile builds as matching ARGs).
# ARG values used in RUN are recorded in image history — acceptable for this narrowly-scoped token.
ARG GH_PARSER_TOKEN
ARG PARSER_REF=parser-v1.0.1
# Npgsql probes for GSSAPI/Kerberos at connect time; without this lib it logs a noisy (non-fatal)
# "libgssapi_krb5.so.2: cannot open shared object file" on every startup.
# python3/venv host the entry-list parser sidecar (pitpass-parser, pip-installed from the
# broadcast-helper repo at the PARSER_REF tag); git exists only for that install and is purged.
# Debian's python3 (3.13) has healthy native wheels for pdfplumber's deps — the SIGILL that forced
# broadcast-helper to pin an older base was specific to Python 3.14.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 python3 python3-venv git \
    && python3 -m venv /opt/parser-venv \
    && /opt/parser-venv/bin/pip install --no-cache-dir \
       "pitpass-parser @ git+https://oauth2:${GH_PARSER_TOKEN}@github.com/kanki6315/broadcast-helper.git@${PARSER_REF}#subdirectory=parser" \
    && apt-get purge -y git \
    && apt-get autoremove -y \
    && rm -rf /var/lib/apt/lists/*
ENV EntryListParser__Command=/opt/parser-venv/bin/parse-entry-list
WORKDIR /app
COPY --from=build /app ./
EXPOSE 8080
# Bind to Railway's injected $PORT (falls back to 8080 locally). `exec` keeps dotnet as PID 1 so it
# receives SIGTERM for graceful shutdown.
ENTRYPOINT ["sh", "-c", "exec dotnet EnduranceFantasy.Api.dll --urls http://+:${PORT:-8080}"]
