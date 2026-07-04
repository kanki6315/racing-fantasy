using ImsaFantasy.Api.Ingestion;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Results ingestion (ADR-0001 D8). Qualifying results stage to a preview, then commit to
/// quali_result on admin approval (idempotent upsert — supports re-import of corrections).
/// Race fastest laps are parsed for review only: this file carries a car-level fastest lap,
/// not per-driver, so it cannot feed IMPACT scoring yet.
/// Note: ingestion lives in the API for now; the isolated ingestion service is a later refactor.
/// </summary>
public static class IngestionEndpoints
{
    public static IEndpointRouteBuilder MapIngestionEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/rounds/{roundId:long}").WithTags("Ingestion").RequireAuthorization("Admin");

        // POST raw IMSA qualifying CSV. ?commit=false (default) stages a preview; ?commit=true publishes.
        group.MapPost("/qualifying-results/import", async (long roundId, bool? commit, Stream body, FantasyDbContext db) =>
        {
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();
            var season = await db.Seasons.FindAsync(round.SeasonId);
            if (season is null) return Results.NotFound();

            using var reader = new StreamReader(body);
            var rows = ImsaResultsCsv.Parse(await reader.ReadToEndAsync());
            if (rows.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["csv"] = ["No rows parsed."] });

            var classesByName = await db.Classes.Where(c => c.ChampionshipId == season.ChampionshipId)
                .ToDictionaryAsync(c => c.Name, c => c, ClassNameComparer.Instance);
            var carsByKey = (await db.CarEntries.Where(c => c.SeasonId == round.SeasonId).ToListAsync())
                .ToDictionary(c => (c.ClassId, c.Number));
            var qualiSessionByClass = await db.Sessions
                .Where(s => s.RoundId == roundId && s.Type == SessionType.Qualifying)
                .ToDictionaryAsync(s => s.ClassId, s => s.Id);

            var resolved = new List<ResolvedQuali>();
            var issues = new List<IngestIssue>();

            foreach (var row in rows)
            {
                if (!classesByName.TryGetValue(row.ClassName, out var cls))
                { issues.Add(new(row.Number, row.ClassName, $"class '{row.ClassName}' not found")); continue; }
                if (!qualiSessionByClass.TryGetValue(cls.Id, out var sessionId))
                { issues.Add(new(row.Number, row.ClassName, "no qualifying session for this class in the round")); continue; }
                if (!carsByKey.TryGetValue((cls.Id, row.Number), out var car))
                { issues.Add(new(row.Number, row.ClassName, "car not in the season entry list")); continue; }
                var lapMs = ImsaResultsCsv.ParseLapMs(row.Get("TIME"));
                if (lapMs is null)
                { issues.Add(new(row.Number, row.ClassName, $"unparseable lap time '{row.Get("TIME")}'")); continue; }

                resolved.Add(new ResolvedQuali(sessionId, car.Id, cls.Id, cls.Name, row.Number, lapMs.Value));
            }

            // Per-class grid position: rank within class by lap time ascending.
            foreach (var byClass in resolved.GroupBy(r => r.ClassId))
            {
                var ranked = byClass.OrderBy(r => r.LapMs).ToList();
                for (var i = 0; i < ranked.Count; i++) ranked[i].Position = i + 1;
            }

            IngestResponse Preview() => new(
                roundId, Committed: false, Parsed: rows.Count, Matched: resolved.Count, Unmatched: issues.Count,
                ByClass: resolved.GroupBy(r => r.ClassName)
                    .Select(g => new IngestClassCount(g.Key, g.Count())).OrderBy(x => x.Class).ToList(),
                Results: resolved.OrderBy(r => r.ClassName).ThenBy(r => r.Position)
                    .Select(r => new IngestResultRow(r.ClassName, r.Number, r.Position, r.LapMs, null, null)).ToList(),
                Inserted: null, Updated: null, Skipped: null, Issues: issues);

            if (commit != true)
                return Results.Ok(Preview());

            // Commit: idempotent upsert keyed by (session, car entry).
            var sessionIds = resolved.Select(r => r.SessionId).Distinct().ToList();
            var existing = (await db.QualiResults.Where(q => sessionIds.Contains(q.SessionId)).ToListAsync())
                .ToDictionary(q => (q.SessionId, q.CarEntryId));
            int inserted = 0, updated = 0;
            foreach (var r in resolved)
            {
                if (existing.TryGetValue((r.SessionId, r.CarEntryId), out var q))
                {
                    q.Position = r.Position; q.BestLapMs = r.LapMs; q.ClassId = r.ClassId;
                    updated++;
                }
                else
                {
                    db.Add(new QualiResult
                    {
                        SessionId = r.SessionId, CarEntryId = r.CarEntryId, ClassId = r.ClassId,
                        Position = r.Position, BestLapMs = r.LapMs
                    });
                    inserted++;
                }
            }

            // Mark the touched qualifying sessions as published (the future scoring-event hook, ADR-0003).
            await db.Sessions.Where(s => sessionIds.Contains(s.Id))
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SessionStatus.Published));

            await db.SaveChangesAsync();

            return Results.Ok(new IngestResponse(roundId, Committed: true, Parsed: rows.Count, Matched: resolved.Count,
                Unmatched: issues.Count, ByClass: [], Results: [], Inserted: inserted, Updated: updated,
                Skipped: issues.Count, Issues: issues));
        }).Produces<IngestResponse>();

        // POST raw IMSA race CSV. ?commit=false stages a preview; ?commit=true publishes finishing positions.
        group.MapPost("/race-results/import", async (long roundId, bool? commit, Stream body, FantasyDbContext db) =>
        {
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();
            var season = await db.Seasons.FindAsync(round.SeasonId);
            if (season is null) return Results.NotFound();

            using var reader = new StreamReader(body);
            var rows = ImsaResultsCsv.Parse(await reader.ReadToEndAsync());
            if (rows.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["csv"] = ["No rows parsed."] });

            var classesByName = await db.Classes.Where(c => c.ChampionshipId == season.ChampionshipId)
                .ToDictionaryAsync(c => c.Name, c => c, ClassNameComparer.Instance);
            var carsByKey = (await db.CarEntries.Where(c => c.SeasonId == round.SeasonId).ToListAsync())
                .ToDictionary(c => (c.ClassId, c.Number));
            var raceSessionByClass = await db.Sessions
                .Where(s => s.RoundId == roundId && s.Type == SessionType.Race)
                .ToDictionaryAsync(s => s.ClassId, s => s.Id);

            var resolved = new List<ResolvedRace>();
            var issues = new List<IngestIssue>();

            foreach (var row in rows)
            {
                if (!classesByName.TryGetValue(row.ClassName, out var cls))
                { issues.Add(new(row.Number, row.ClassName, $"class '{row.ClassName}' not found")); continue; }
                if (!raceSessionByClass.TryGetValue(cls.Id, out var sessionId))
                { issues.Add(new(row.Number, row.ClassName, "no race session for this class in the round")); continue; }
                if (!carsByKey.TryGetValue((cls.Id, row.Number), out var car))
                { issues.Add(new(row.Number, row.ClassName, "car not in the season entry list")); continue; }

                var overall = int.TryParse(row.Get("POSITION"), out var pos) ? pos : int.MaxValue;
                int? laps = int.TryParse(row.Get("LAPS"), out var l) ? l : null;
                resolved.Add(new ResolvedRace(sessionId, car.Id, cls.Id, cls.Name, row.Number, overall, row.Get("STATUS"), laps));
            }

            // Per-class finishing position: rank within class by the official overall classification order.
            foreach (var byClass in resolved.GroupBy(r => r.ClassId))
            {
                var ranked = byClass.OrderBy(r => r.Overall).ToList();
                for (var i = 0; i < ranked.Count; i++) ranked[i].Position = i + 1;
            }

            IngestResponse Preview() => new(
                roundId, Committed: false, Parsed: rows.Count, Matched: resolved.Count, Unmatched: issues.Count,
                ByClass: resolved.GroupBy(r => r.ClassName)
                    .Select(g => new IngestClassCount(g.Key, g.Count())).OrderBy(x => x.Class).ToList(),
                Results: resolved.OrderBy(r => r.ClassName).ThenBy(r => r.Position)
                    .Select(r => new IngestResultRow(r.ClassName, r.Number, r.Position, null, r.Status, r.Laps)).ToList(),
                Inserted: null, Updated: null, Skipped: null, Issues: issues);

            if (commit != true)
                return Results.Ok(Preview());

            var sessionIds = resolved.Select(r => r.SessionId).Distinct().ToList();
            var existing = (await db.RaceResults.Where(q => sessionIds.Contains(q.SessionId)).ToListAsync())
                .ToDictionary(q => (q.SessionId, q.CarEntryId));
            int inserted = 0, updated = 0;
            foreach (var r in resolved)
            {
                if (existing.TryGetValue((r.SessionId, r.CarEntryId), out var rr))
                {
                    rr.Position = r.Position; rr.Status = r.Status; rr.Laps = r.Laps; rr.ClassId = r.ClassId;
                    updated++;
                }
                else
                {
                    db.Add(new RaceResult
                    {
                        SessionId = r.SessionId, CarEntryId = r.CarEntryId, ClassId = r.ClassId,
                        Position = r.Position, Status = r.Status, Laps = r.Laps
                    });
                    inserted++;
                }
            }

            await db.Sessions.Where(s => sessionIds.Contains(s.Id))
                .ExecuteUpdateAsync(u => u.SetProperty(s => s.Status, SessionStatus.Published));

            await db.SaveChangesAsync();
            return Results.Ok(new IngestResponse(roundId, Committed: true, Parsed: rows.Count, Matched: resolved.Count,
                Unmatched: issues.Count, ByClass: [], Results: [], Inserted: inserted, Updated: updated,
                Skipped: issues.Count, Issues: issues));
        }).Produces<IngestResponse>();

        // POST Al Kamel Time Cards race JSON. Computes each driver's fastest valid lap and
        // persists race_fastest_lap (the IMPACT source). ?commit=false stages a preview.
        group.MapPost("/race-fastest-laps/import", async (long roundId, bool? commit, Stream body, FantasyDbContext db) =>
        {
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();
            var season = await db.Seasons.FindAsync(round.SeasonId);
            if (season is null) return Results.NotFound();

            using var reader = new StreamReader(body);
            var fastest = TimeCardsJson.ExtractFastestLaps(TimeCardsJson.Parse(await reader.ReadToEndAsync()));
            if (fastest.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]> { ["json"] = ["No laps parsed."] });

            var classesByName = await db.Classes.Where(c => c.ChampionshipId == season.ChampionshipId)
                .ToDictionaryAsync(c => c.Name, c => c, ClassNameComparer.Instance);
            var raceSessionByClass = await db.Sessions
                .Where(s => s.RoundId == roundId && s.Type == SessionType.Race)
                .ToDictionaryAsync(s => s.ClassId, s => s.Id);
            var driversByName = (await db.Drivers.ToListAsync())
                .GroupBy(d => d.FullName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First().Id, StringComparer.OrdinalIgnoreCase);

            var resolved = new List<ResolvedFastest>();
            var issues = new List<IngestIssue>();

            foreach (var f in fastest)
            {
                if (!classesByName.TryGetValue(f.ClassName, out var cls))
                { issues.Add(new(f.CarNumber, f.ClassName, $"class '{f.ClassName}' not found")); continue; }
                if (!raceSessionByClass.TryGetValue(cls.Id, out var sessionId))
                { issues.Add(new(f.CarNumber, f.ClassName, "no race session for this class in the round")); continue; }
                if (!driversByName.TryGetValue(f.DriverName, out var driverId))
                { issues.Add(new(f.CarNumber, f.ClassName, $"driver '{f.DriverName}' not found")); continue; }

                resolved.Add(new ResolvedFastest(sessionId, driverId, cls.Id, cls.Name, f.DriverName, f.FastestMs));
            }

            object Preview() => new
            {
                roundId,
                committed = false,
                parsedDriverLaps = fastest.Count,
                matched = resolved.Count,
                unmatched = issues.Count,
                fastestPerClass = resolved.GroupBy(r => r.ClassName).Select(g => new
                {
                    @class = g.Key,
                    leader = g.OrderBy(r => r.FastestMs).Select(r => new { r.DriverName, ms = r.FastestMs }).First()
                }),
                issues = issues.Take(20)
            };

            if (commit != true)
                return Results.Ok(Preview());

            var sessionIds = resolved.Select(r => r.SessionId).Distinct().ToList();
            var existing = (await db.RaceFastestLaps.Where(q => sessionIds.Contains(q.SessionId)).ToListAsync())
                .ToDictionary(q => (q.SessionId, q.DriverId));
            int inserted = 0, updated = 0;
            foreach (var r in resolved)
            {
                if (existing.TryGetValue((r.SessionId, r.DriverId), out var fl))
                {
                    fl.FastestLapMs = r.FastestMs; fl.ClassId = r.ClassId;
                    updated++;
                }
                else
                {
                    db.Add(new RaceFastestLap
                    {
                        SessionId = r.SessionId, DriverId = r.DriverId, ClassId = r.ClassId, FastestLapMs = r.FastestMs
                    });
                    inserted++;
                }
            }

            await db.SaveChangesAsync();
            return Results.Ok(new { roundId, committed = true, inserted, updated, skipped = issues.Count, issues = issues.Take(20) });
        });

        return app;
    }

    private sealed record ResolvedQuali(long SessionId, long CarEntryId, long ClassId, string ClassName, string Number, long LapMs)
    {
        public int Position { get; set; }
    }

    private sealed record ResolvedRace(long SessionId, long CarEntryId, long ClassId, string ClassName, string Number, int Overall, string? Status, int? Laps)
    {
        public int Position { get; set; }
    }

    private sealed record ResolvedFastest(long SessionId, long DriverId, long ClassId, string ClassName, string DriverName, long FastestMs);
}

/// <summary>Why a parsed row couldn't be matched (class/session/car/lap-time problem).</summary>
public record IngestIssue(string Number, string Class, string Reason);

/// <summary>Per-class row count in a staged import.</summary>
public record IngestClassCount(string Class, int Count);

/// <summary>One resolved result row in a preview. LapMs is set for qualifying; Status/Laps for race.</summary>
public record IngestResultRow(string ClassName, string Number, int Position, long? LapMs, string? Status, int? Laps);

/// <summary>
/// Unified ingest response. On a staged preview (commit=false) <see cref="Results"/> is populated and the
/// commit counters are null; on commit they flip. <see cref="Issues"/> carries unmatched rows in both cases.
/// </summary>
public record IngestResponse(
    long RoundId, bool Committed, int Parsed, int Matched, int Unmatched,
    List<IngestClassCount> ByClass, List<IngestResultRow> Results,
    int? Inserted, int? Updated, int? Skipped, List<IngestIssue> Issues);
