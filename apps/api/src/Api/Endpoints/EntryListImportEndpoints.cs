using System.Text.Json;
using System.Text.Json.Serialization;
using EnduranceFantasy.Api.Parsing;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

/// <summary>
/// Imports a parser-produced entry-list JSON (one file per series per event, converted from the
/// IMSA PDF) into a round. Cars and drivers are season-scoped upserts, same identity rules as the
/// manual entry-list import; lineup rows are written per-round (entry_driver.round_id), so each
/// weekend's lineup, ratings and rookie/coach markers are event-accurate.
/// Field policy: the newest file wins for everything it carries (team, model, bronze cup, rating,
/// slot order, markers); driver country only fills a null (most files don't carry nationality).
/// Unknown ratings/markers warn and import without the value; structural problems (missing number,
/// unresolvable class) fail the request with row-indexed errors, like the manual import.
/// </summary>
public static class EntryListImportEndpoints
{
    // Parser stdout is deserialized by hand (unlike /import, where body binding applies web
    // defaults), so case-insensitivity must be opted into or every single-word property
    // (team, drivers, entries, ...) silently binds null.
    private static readonly JsonSerializerOptions WebJson = new(JsonSerializerDefaults.Web);

    public static IEndpointRouteBuilder MapEntryListImportEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/rounds/{roundId:long}/entry-list").WithTags("EntryList")
            .RequireAuthorization("Admin");

        // PDF front door for /import: runs the pitpass-parser sidecar (parse-entry-list) on the
        // uploaded entry-list PDF and returns the parser's entries.json verbatim — the client then
        // feeds it through the same dryRun/commit calls as a hand-supplied JSON file. Pass-through,
        // not re-serialization: the parser's output is a superset of ParserEntryList (this API binds
        // only the fields it uses), and rewriting it here would silently drop the rest.
        group.MapPost("/parse-pdf", async (
            long roundId, IFormFile file, EntryListParser parser, CancellationToken ct) =>
        {
            if (!parser.IsConfigured)
                return Results.Problem(
                    "The entry-list PDF parser is not configured (set EntryListParser:Command).",
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            if (file.Length == 0 || !file.FileName.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase))
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["file"] = ["A non-empty .pdf file is required."]
                });

            await using var pdf = file.OpenReadStream();
            ParserRunResult run;
            try
            {
                run = await parser.RunAsync(pdf, file.FileName, ct);
            }
            catch (InvalidOperationException e) // configured command missing/unstartable
            {
                return Results.Problem(title: "PDF parser could not be started", detail: e.Message,
                    statusCode: StatusCodes.Status503ServiceUnavailable);
            }

            if (run.TimedOut)
                return Results.Problem(title: "PDF parser timed out",
                    statusCode: StatusCodes.Status504GatewayTimeout);
            if (run.ExitCode != 0)
                return Results.Problem(title: "PDF parser failed", detail: run.Stderr.Trim(),
                    statusCode: StatusCodes.Status422UnprocessableEntity);

            try
            {
                var doc = JsonSerializer.Deserialize<ParserEntryList>(run.Stdout, WebJson);
                if (doc?.Entries is null || doc.Entries.Count == 0) throw new JsonException("no entries");
            }
            catch (JsonException)
            {
                return Results.Problem(title: "PDF parser produced no readable entries",
                    detail: run.Stderr.Trim(), statusCode: StatusCodes.Status502BadGateway);
            }
            return Results.Text(run.Stdout, "application/json");
        })
        .DisableAntiforgery()
        .Produces<ParserEntryList>();

        group.MapPost("/import", async (
            long roundId, ParserEntryList file, FantasyDbContext db,
            bool dryRun = false, bool createMissingClasses = false) =>
        {
            var round = await db.Rounds
                .Include(r => r.Season).ThenInclude(s => s.Championship)
                .SingleOrDefaultAsync(r => r.Id == roundId);
            if (round is null) return Results.NotFound();
            if (file.Entries is null || file.Entries.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["entries"] = ["At least one entry is required."]
                });

            var season = round.Season;
            var warnings = new List<string>();

            // The file's event block is context, not routing — the admin picked the round. Warn on
            // mismatches (wrong file dropped on the wrong round) instead of guessing.
            if (file.Event is { } ev)
            {
                if (string.IsNullOrWhiteSpace(ev.Series))
                    warnings.Add("file carries no series code (renamed PDF? the parser reads it from the " +
                                 "filename) — could not verify this file belongs to this championship");
                else if (!string.Equals(ev.Series, season.Championship.Slug, StringComparison.OrdinalIgnoreCase))
                    warnings.Add($"file is for series '{ev.Series}' but the round belongs to " +
                                 $"'{season.Championship.Name}' (slug '{season.Championship.Slug}') — check the target round");
                if (DateOnly.TryParse(ev.StartDate, out var start) && start.Year != season.Year)
                    warnings.Add($"file event starts {ev.StartDate} but the round's season is {season.Year}");
                if (ev.TotalEntries is int total && total != file.Entries.Count)
                    warnings.Add($"file header says {total} entries but {file.Entries.Count} were parsed — " +
                                 "the parser may have dropped some; compare against the PDF before importing");
            }
            else
            {
                warnings.Add("file has no event block — could not verify series or season");
            }

            // ---- Lookups: classes / cars keyed by class NAME so not-yet-saved classes (id 0) work ----
            var classes = await db.Classes.Where(c => c.ChampionshipId == season.ChampionshipId).ToListAsync();
            var classByName = classes
                .GroupBy(c => c.Name, ClassNameComparer.Instance)
                .ToDictionary(g => g.Key, g => g.First(), ClassNameComparer.Instance);
            var classNameById = classes.ToDictionary(c => c.Id, c => c.Name);

            var carsByKey = (await db.CarEntries.Where(c => c.SeasonId == season.Id).ToListAsync())
                .ToDictionary(c => (ClassNameComparer.Key(classNameById[c.ClassId]), c.Number));
            var roundLinks = (await db.EntryDrivers.Where(x => x.RoundId == roundId).ToListAsync())
                .ToDictionary(x => (x.CarEntryId, x.DriverId));
            var driverByName = (await db.Drivers.ToListAsync())
                .GroupBy(d => d.FullName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            // ---- Pass 1: structural validation (row-indexed, all-or-nothing like the manual import) ----
            var errors = new List<EntryListError>();
            var classesToCreate = new Dictionary<string, Class>(ClassNameComparer.Instance);
            for (var i = 0; i < file.Entries.Count; i++)
            {
                var e = file.Entries[i];
                var code = e.ClassCode?.Trim();
                if (string.IsNullOrWhiteSpace(code))
                    errors.Add(new(i, "class_code is required"));
                else if (!classByName.ContainsKey(code) && !classesToCreate.ContainsKey(code))
                {
                    if (createMissingClasses)
                        classesToCreate[code] = new Class
                        {
                            ChampionshipId = season.ChampionshipId,
                            Name = code,
                            SortOrder = e.ClassOrder ?? 0
                        };
                    else
                        errors.Add(new(i, $"class '{code}' not found for {season.Championship.Name} " +
                                        "(pass createMissingClasses=true to create it)"));
                }

                if (string.IsNullOrWhiteSpace(e.CarNumber))
                    errors.Add(new(i, "car_number is required"));

                var isNewCar = code is not null
                               && !carsByKey.ContainsKey((code.ToUpperInvariant(), e.CarNumber ?? ""));
                if (isNewCar && string.IsNullOrWhiteSpace(e.Team))
                    errors.Add(new(i, "team is required for a new car entry"));

                for (var j = 0; j < (e.Drivers?.Count ?? 0); j++)
                {
                    var d = e.Drivers![j];
                    if (d.IsTbd != true && string.IsNullOrWhiteSpace(d.Name))
                        errors.Add(new(i, $"drivers[{j}] needs a name (or is_tbd)"));
                    // SCHEMA.md: unparsed lines must fail loud, never import silently.
                    if (d.Unparsed == true)
                        errors.Add(new(i, $"drivers[{j}] ('{d.Name ?? "?"}') was not recognized by the " +
                                        "PDF parser — re-parse or hand-edit the JSON before importing"));
                }
            }

            if (errors.Count > 0)
                return Results.Json(new { errors }, statusCode: StatusCodes.Status422UnprocessableEntity);

            foreach (var cls in classesToCreate.Values) db.Add(cls);

            // ---- Pass 2: apply ----
            var createdDrivers = new List<Driver>();
            var reusedDrivers = new HashSet<Driver>();
            int carsCreated = 0, carsUpdated = 0, lineupCreated = 0, lineupUpdated = 0, tbdSkipped = 0;
            var rows = new List<ImportRowResult>();

            for (var i = 0; i < file.Entries.Count; i++)
            {
                var e = file.Entries[i];
                var code = e.ClassCode!.Trim();
                var cls = classByName.TryGetValue(code, out var existing) ? existing : classesToCreate[code];
                var carKey = (ClassNameComparer.Key(code), e.CarNumber!);

                string carStatus;
                if (!carsByKey.TryGetValue(carKey, out var car))
                {
                    car = new CarEntry
                    {
                        SeasonId = season.Id,
                        ClassId = cls.Id,          // 0 for a new class — the nav below wires it up
                        Class = cls,
                        Number = e.CarNumber!,
                        TeamName = e.Team!,
                        CarModel = e.CarType,
                        BronzeCup = e.BronzeCup ?? false
                    };
                    db.Add(car);
                    carsByKey[carKey] = car;
                    carsCreated++;
                    carStatus = "create";
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(e.Team)) car.TeamName = e.Team!;
                    if (!string.IsNullOrWhiteSpace(e.CarType)) car.CarModel = e.CarType;
                    car.BronzeCup = e.BronzeCup ?? false;
                    carsUpdated++;
                    carStatus = "update";
                }

                var rowDrivers = new List<ImportDriverResult>();
                foreach (var d in e.Drivers ?? [])
                {
                    if (d.IsTbd == true)
                    {
                        tbdSkipped++;
                        rowDrivers.Add(new(d.Name ?? "TBD", "tbd-skipped", null));
                        continue;
                    }

                    var name = d.Name!.Trim();
                    string driverStatus;
                    if (driverByName.TryGetValue(name, out var drv))
                    {
                        if (drv.Country is null && !string.IsNullOrWhiteSpace(d.Nationality))
                            drv.Country = d.Nationality;
                        var newThisImport = createdDrivers.Contains(drv);
                        if (!newThisImport) reusedDrivers.Add(drv);
                        driverStatus = newThisImport ? "new" : "reused";
                    }
                    else
                    {
                        drv = new Driver { FullName = name, Country = d.Nationality };
                        db.Add(drv);
                        driverByName[name] = drv;
                        createdDrivers.Add(drv);
                        driverStatus = "new";
                    }

                    var rating = ParseRating(d.Rating, i, name, warnings);
                    var (isRookie, isCoach) = ParseMarkers(d.Markers, i, name, warnings);

                    // Per-round lineup upsert. Persisted rows are keyed by ids; rows created earlier
                    // in this same request are found via the car's Lineup nav (ids still 0).
                    var link = car.Id != 0 && drv.Id != 0 && roundLinks.TryGetValue((car.Id, drv.Id), out var persisted)
                        ? persisted
                        : car.Lineup.FirstOrDefault(x => x.RoundId == roundId && ReferenceEquals(x.Driver, drv));
                    if (link is null)
                    {
                        link = new EntryDriver
                        {
                            CarEntry = car, Driver = drv, SeasonId = season.Id, RoundId = roundId
                        };
                        car.Lineup.Add(link);
                        db.Add(link);
                        lineupCreated++;
                    }
                    else lineupUpdated++;

                    link.Rating = rating;
                    link.SlotOrder = d.Order;
                    link.IsRookie = isRookie;
                    link.IsCoach = isCoach;

                    rowDrivers.Add(new(name, driverStatus, rating?.ToString()));
                }

                rows.Add(new(i, code, e.CarNumber!, car.TeamName, carStatus, rowDrivers));
            }

            if (!dryRun) await db.SaveChangesAsync();

            return Results.Ok(new EntryListImportResult(
                roundId, season.Id, dryRun, warnings,
                classesToCreate.Keys.ToList(),
                carsCreated, carsUpdated,
                createdDrivers.Select(d => d.FullName).ToList(),
                reusedDrivers.Count,
                lineupCreated, lineupUpdated, tbdSkipped, rows));
        }).Produces<EntryListImportResult>();

        return app;
    }

    private static DriverRating? ParseRating(string? raw, int row, string driver, List<string> warnings)
    {
        var r = raw?.Trim().ToUpperInvariant();
        switch (r)
        {
            case null or "": return null;
            case "P": return DriverRating.Platinum;
            case "G": return DriverRating.Gold;
            case "S": return DriverRating.Silver;
            case "B": return DriverRating.Bronze;
            default:
                warnings.Add($"entries[{row}] {driver}: unknown rating '{raw}' — imported without a rating");
                return null;
        }
    }

    private static (bool Rookie, bool Coach) ParseMarkers(
        List<string>? markers, int row, string driver, List<string> warnings)
    {
        bool rookie = false, coach = false;
        foreach (var m in markers ?? [])
        {
            if (string.Equals(m, "rookie", StringComparison.OrdinalIgnoreCase)) rookie = true;
            else if (string.Equals(m, "coach", StringComparison.OrdinalIgnoreCase)) coach = true;
            // Documented markers with no fantasy meaning; per SCHEMA.md, non_series drivers still
            // score and must NOT be treated as invitational/guest entries.
            else if (string.Equals(m, "invitational", StringComparison.OrdinalIgnoreCase)) { }
            else if (string.Equals(m, "non_series", StringComparison.OrdinalIgnoreCase)) { }
            else warnings.Add($"entries[{row}] {driver}: unknown marker '{m}' — ignored");
        }
        return (rookie, coach);
    }
}

// ---- Parser file shape (snake_case keys, bound verbatim) ----

public record ParserEntryList(ParserEvent? Event, List<ParserEntry>? Entries);

public record ParserEvent(
    string? Name,
    string? Circuit,
    string? Location,
    [property: JsonPropertyName("total_entries")] int? TotalEntries,
    [property: JsonPropertyName("start_date")] string? StartDate,
    [property: JsonPropertyName("end_date")] string? EndDate,
    string? Series,
    [property: JsonPropertyName("source_file")] string? SourceFile);

public record ParserEntry(
    [property: JsonPropertyName("class_name")] string? ClassName,
    [property: JsonPropertyName("class_code")] string? ClassCode,
    [property: JsonPropertyName("class_order")] int? ClassOrder,
    [property: JsonPropertyName("car_number")] string? CarNumber,
    string? Team,
    string? Sponsor,
    [property: JsonPropertyName("bronze_cup")] bool? BronzeCup,
    [property: JsonPropertyName("car_type")] string? CarType,
    string? Tire,
    string? Engine,
    string? Fuel,
    List<ParserDriver>? Drivers);

// A deliberate SUBSET of the parser's contract (see broadcast-helper parser/SCHEMA.md): binding is
// tolerant, so parser fields this app doesn't use (dealer_trophy, team_nationality, ...) are simply
// ignored and new ones never require changes here. `unparsed` is the exception every consumer must
// bind — it flags a driver line the parser couldn't read, and the import fails loud on it.
public record ParserDriver(
    int? Order,
    string? Rating,
    string? Name,
    string? Nationality,
    string? Hometown,
    [property: JsonPropertyName("is_tbd")] bool? IsTbd,
    List<string>? Markers,
    bool? Unparsed);

// ---- Result (drives the admin preview: dryRun=true returns the same shape, nothing saved) ----

public record EntryListImportResult(
    long RoundId,
    long SeasonId,
    bool DryRun,
    List<string> Warnings,
    List<string> ClassesCreated,
    int CarsCreated,
    int CarsUpdated,
    List<string> DriversCreated,
    int DriversReused,
    int LineupCreated,
    int LineupUpdated,
    int TbdSkipped,
    List<ImportRowResult> Rows);

public record ImportRowResult(
    int Index, string ClassCode, string Number, string Team, string CarStatus,
    List<ImportDriverResult> Drivers);

public record ImportDriverResult(string Name, string Status, string? Rating);
