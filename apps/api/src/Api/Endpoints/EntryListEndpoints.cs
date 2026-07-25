using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

/// <summary>
/// Bulk import of a season entry list (the shape of an IMSA PDF entry list): cars grouped by
/// class, each with a team and its drivers. Idempotent — drivers/cars/lineups are created or
/// reused, so re-importing a corrected list converges rather than duplicating. Identity is
/// shared across rounds; only price (Phase 2) varies round to round.
/// </summary>
public static class EntryListEndpoints
{
    public static IEndpointRouteBuilder MapEntryListEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/seasons/{seasonId:long}/entry-list").WithTags("EntryList").RequireAuthorization("Admin");

        group.MapPost("/", async (long seasonId, EntryListImport import, FantasyDbContext db) =>
        {
            var season = await db.Seasons.FindAsync(seasonId);
            if (season is null) return Results.NotFound();
            if (import.Entries is null || import.Entries.Count == 0)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["entries"] = ["At least one entry is required."]
                });

            // ---- Load lookups up front ----
            var classes = await db.Classes
                .Where(c => c.ChampionshipId == season.ChampionshipId).ToListAsync();
            var classById = classes.ToDictionary(c => c.Id);
            var classByName = classes
                .GroupBy(c => c.Name, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            var carsByKey = (await db.CarEntries.Where(c => c.SeasonId == seasonId).ToListAsync())
                .ToDictionary(c => (c.ClassId, c.Number));
            // This manual import writes season-wide lineup rows, so it dedupes against those only —
            // per-round rows (JSON entry-list import) are a separate layer on top.
            var existingLinks = (await db.EntryDrivers
                    .Where(x => x.SeasonId == seasonId && x.RoundId == null).ToListAsync())
                .Select(x => (x.CarEntryId, x.DriverId)).ToHashSet();

            var explicitIds = import.Entries
                .SelectMany(e => e.Drivers ?? [])
                .Where(d => d.DriverId is not null).Select(d => d.DriverId!.Value).Distinct().ToList();
            var driversById = await db.Drivers
                .Where(d => explicitIds.Contains(d.Id)).ToDictionaryAsync(d => d.Id);
            var driverByName = (await db.Drivers.ToListAsync())
                .GroupBy(d => d.FullName, StringComparer.OrdinalIgnoreCase)
                .ToDictionary(g => g.Key, g => g.First(), StringComparer.OrdinalIgnoreCase);

            // ---- Pass 1: validate & resolve class per row ----
            var errors = new List<EntryListError>();
            var resolvedClassId = new long[import.Entries.Count];
            for (var i = 0; i < import.Entries.Count; i++)
            {
                var e = import.Entries[i];

                long? classId = null;
                if (e.ClassId is { } cid)
                    classId = classById.ContainsKey(cid) ? cid : null;
                else if (!string.IsNullOrWhiteSpace(e.ClassName))
                    classId = classByName.TryGetValue(e.ClassName, out var cls) ? cls.Id : null;

                if (classId is null)
                    errors.Add(new(i, e.ClassId is null && e.ClassName is null
                        ? "classId or className is required"
                        : $"class not found for this championship"));
                else
                    resolvedClassId[i] = classId.Value;

                if (string.IsNullOrWhiteSpace(e.Number))
                    errors.Add(new(i, "number is required"));

                var isNewCar = classId is { } rc && !carsByKey.ContainsKey((rc, e.Number ?? ""));
                if (isNewCar && string.IsNullOrWhiteSpace(e.TeamName))
                    errors.Add(new(i, "teamName is required for a new car entry"));

                foreach (var d in e.Drivers ?? [])
                {
                    if (d.DriverId is { } did && !driversById.ContainsKey(did))
                        errors.Add(new(i, $"driverId {did} not found"));
                    else if (d.DriverId is null && string.IsNullOrWhiteSpace(d.FullName))
                        errors.Add(new(i, "each driver needs a driverId or a fullName"));
                }
            }

            if (errors.Count > 0)
                return Results.Json(new { errors }, statusCode: StatusCodes.Status422UnprocessableEntity);

            // ---- Pass 2: apply ----
            var createdDrivers = new HashSet<Driver>();
            var referencedDrivers = new HashSet<Driver>();
            var addedLinks = new HashSet<(CarEntry, Driver)>();
            int createdCars = 0, updatedCars = 0, createdLinks = 0;
            var rowOutputs = new List<(int Index, CarEntry Car, List<Driver> Drivers)>();

            for (var i = 0; i < import.Entries.Count; i++)
            {
                var e = import.Entries[i];
                var classId = resolvedClassId[i];
                var key = (classId, e.Number!);

                if (!carsByKey.TryGetValue(key, out var car))
                {
                    car = new CarEntry { SeasonId = seasonId, ClassId = classId, Number = e.Number!, TeamName = e.TeamName! };
                    db.Add(car);
                    carsByKey[key] = car;
                    createdCars++;
                }
                else
                {
                    if (!string.IsNullOrWhiteSpace(e.TeamName)) car.TeamName = e.TeamName!;
                    updatedCars++;
                }

                var rowDrivers = new List<Driver>();
                foreach (var d in e.Drivers ?? [])
                {
                    Driver drv;
                    if (d.DriverId is { } did)
                    {
                        drv = driversById[did];
                    }
                    else if (driverByName.TryGetValue(d.FullName!, out var existing))
                    {
                        drv = existing;
                    }
                    else
                    {
                        drv = new Driver { FullName = d.FullName!, Country = d.Country };
                        db.Add(drv);
                        driverByName[d.FullName!] = drv;
                        createdDrivers.Add(drv);
                    }

                    referencedDrivers.Add(drv);
                    rowDrivers.Add(drv);

                    var persistedLink = car.Id != 0 && drv.Id != 0 && existingLinks.Contains((car.Id, drv.Id));
                    if (!persistedLink && addedLinks.Add((car, drv)))
                    {
                        db.Add(new EntryDriver { CarEntry = car, Driver = drv, SeasonId = seasonId });
                        createdLinks++;
                    }
                }

                rowOutputs.Add((i, car, rowDrivers));
            }

            await db.SaveChangesAsync();

            var result = new EntryListResult(
                seasonId,
                createdDrivers.Count,
                referencedDrivers.Count - createdDrivers.Count,
                createdCars,
                updatedCars,
                createdLinks,
                rowOutputs.Select(r => new EntryListEntryResult(
                    r.Index, r.Car.Id, r.Car.ClassId, r.Car.Number,
                    r.Drivers.Select(d => d.Id).ToList())).ToList());

            return Results.Ok(result);
        });

        return app;
    }
}

public record EntryListImport(List<EntryListEntry> Entries);

/// <summary>One car on the entry list. Resolve its class by id or by name (e.g. "GTP").</summary>
public record EntryListEntry(
    long? ClassId, string? ClassName, string? Number, string? TeamName, List<EntryListDriver>? Drivers);

/// <summary>A driver: bind an existing one by id, or create/reuse by name.</summary>
public record EntryListDriver(long? DriverId, string? FullName, string? Country);

public record EntryListError(int Index, string Message);

public record EntryListResult(
    long SeasonId,
    int CreatedDrivers,
    int ReusedDrivers,
    int CreatedCarEntries,
    int UpdatedCarEntries,
    int CreatedLineupLinks,
    List<EntryListEntryResult> Entries);

public record EntryListEntryResult(int Index, long CarEntryId, long ClassId, string Number, List<long> DriverIds);
