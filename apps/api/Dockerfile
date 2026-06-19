# syntax=docker/dockerfile:1
# Multi-stage build for the .NET 10 API. Build context is apps/api (the solution root).

# --- build ---
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

# Copy project files first so `restore` is cached unless a .csproj changes.
COPY ImsaFantasy.slnx ./
COPY src/Api/ImsaFantasy.Api.csproj src/Api/
COPY src/Domain/ImsaFantasy.Domain.csproj src/Domain/
COPY src/Infrastructure/ImsaFantasy.Infrastructure.csproj src/Infrastructure/
RUN dotnet restore src/Api/ImsaFantasy.Api.csproj

# Copy the rest of the source and publish.
COPY . .
RUN dotnet publish src/Api/ImsaFantasy.Api.csproj -c Release -o /app --no-restore

# --- runtime ---
FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
# Npgsql probes for GSSAPI/Kerberos at connect time; without this lib it logs a noisy (non-fatal)
# "libgssapi_krb5.so.2: cannot open shared object file" on every startup.
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgssapi-krb5-2 \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app ./
EXPOSE 8080
# Bind to Railway's injected $PORT (falls back to 8080 locally). `exec` keeps dotnet as PID 1 so it
# receives SIGTERM for graceful shutdown.
ENTRYPOINT ["sh", "-c", "exec dotnet ImsaFantasy.Api.dll --urls http://+:${PORT:-8080}"]
