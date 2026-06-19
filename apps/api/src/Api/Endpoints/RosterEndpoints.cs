using ImsaFantasy.Api.Auth;
using ImsaFantasy.Api.Picks;
using ImsaFantasy.Domain;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// The integrity-critical path (ADR-0002, ADR-0001 D4/D5). A roster's picks are validated for
/// lock + salary cap + class composition in a single transaction, with the round row locked
/// (SELECT ... FOR UPDATE) so concurrent submissions serialize and none can beat the lock.
/// </summary>
public static class RosterEndpoints
{
    public static IEndpointRouteBuilder MapRosterEndpoints(this IEndpointRouteBuilder app)
    {
        // A roster is the player's private data — every action requires auth and ownership.
        var group = app.MapGroup("/registrations/{registrationId:long}/rounds")
            .WithTags("Rosters").RequireAuthorization();

        group.MapGet("/{roundId:long}/roster", async (long registrationId, long roundId, HttpContext http, FantasyDbContext db) =>
        {
            var registration = await db.Registrations.FindAsync(registrationId);
            if (registration is null) return Results.NotFound();
            if (registration.UserId != http.User.GetUserId()) return Results.Forbid();
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();

            var roster = await db.Rosters.Include(r => r.Picks)
                .Include(r => r.Modifiers).ThenInclude(m => m.TargetPick)
                .FirstOrDefaultAsync(r => r.RegistrationId == registrationId && r.RoundId == roundId);

            var locked = roster?.LockedAt is not null || DateTime.UtcNow >= round.QualiStart;
            return Results.Ok(BuildResponse(registration.Id, roundId, round.SalaryCap, roster, locked));
        }).Produces<RosterResponse>();

        group.MapPut("/{roundId:long}/roster", async (long registrationId, long roundId, PutRosterRequest req, HttpContext http, FantasyDbContext db) =>
        {
            var registration = await db.Registrations.FindAsync(registrationId);
            if (registration is null) return Results.NotFound();
            if (registration.UserId != http.User.GetUserId()) return Results.Forbid();
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();
            if (registration.SeasonId != round.SeasonId)
                return Results.ValidationProblem(new Dictionary<string, string[]>
                {
                    ["roundId"] = ["Round is not in the registration's season."]
                });

            await using var tx = await db.Database.BeginTransactionAsync();

            // Lock the round row and decide locked-ness with the DB clock (no app-clock skew).
            if (await IsLocked(db, tx, roundId) is not { } locked)
                return Results.NotFound();
            if (locked)
                return Results.Json(new RosterErrorResponse("locked", Message: "Picks are locked; qualifying has begun."),
                    statusCode: StatusCodes.Status409Conflict);

            // Normalise submitted picks (MAIN only — IMPACT/bonus drivers retired, ADR-0006).
            var main = (req.Main ?? []).DistinctBy(m => (m.EntityType, m.EntityId)).ToList();
            var modifiers = (req.Modifiers ?? []).ToList();

            // Resolve price + class for every referenced entity from this round's price board.
            var refs = main.Select(m => (m.EntityType, m.EntityId)).Distinct().ToList();
            var carIds = refs.Where(r => r.EntityType == EntityType.Car).Select(r => r.EntityId).ToList();
            var drvIds = refs.Where(r => r.EntityType == EntityType.Driver).Select(r => r.EntityId).ToList();
            var priceMap = (await db.EntityPrices.Where(ep => ep.RoundId == roundId &&
                    ((ep.EntityType == EntityType.Car && carIds.Contains(ep.EntityId)) ||
                     (ep.EntityType == EntityType.Driver && drvIds.Contains(ep.EntityId))))
                .ToListAsync()).ToDictionary(ep => (ep.EntityType, ep.EntityId));

            var unavailable = refs.Where(r => !priceMap.ContainsKey(r)).ToList();
            if (unavailable.Count > 0)
                return Results.Json(new RosterErrorResponse("unavailable",
                    Entities: unavailable.Select(u => new EntityRef(u.EntityType.ToString(), u.EntityId)).ToList()),
                    statusCode: StatusCodes.Status422UnprocessableEntity);

            var mainPicks = main.Select(m => (m.EntityType, m.EntityId, Price: priceMap[(m.EntityType, m.EntityId)])).ToList();

            // Salary cap (ADR-0001 D4: snapshot price_at_lock). Modifiers are free (ADR-0006 D2).
            var spent = mainPicks.Sum(x => x.Price.Price);
            if (spent > round.SalaryCap)
                return Results.Json(new RosterErrorResponse("cap_exceeded", Spent: spent, SalaryCap: round.SalaryCap),
                    statusCode: StatusCodes.Status422UnprocessableEntity);

            // Composition + modifiers — resolved through the same helper that backs
            // GET /rounds/{id}/roster-rules (ADR-0001 D5 / ADR-0006 D6), so pills == validation.
            var rules = await RosterRulesResolver.ResolveAsync(db, round);
            var violations = RosterRulesResolver.Violations(rules, mainPicks.Select(x => x.Price.ClassId));
            if (violations.Count > 0)
                return Results.Json(new RosterErrorResponse("composition", Violations: violations),
                    statusCode: StatusCodes.Status422UnprocessableEntity);

            var mainPickKeys = mainPicks.Select(x => (x.EntityType, x.EntityId)).ToHashSet();
            var selections = modifiers
                .Select(m => new ModifierSelection(m.Kind, m.Target is { } t ? (t.EntityType, t.EntityId) : null))
                .ToList();
            var modifierViolations = RosterRulesResolver.ModifierViolations(rules, selections, mainPickKeys);
            if (modifierViolations.Count > 0)
                return Results.Json(new RosterErrorResponse("modifier", ModifierViolations: modifierViolations),
                    statusCode: StatusCodes.Status422UnprocessableEntity);

            // Full replacement of the round's picks + modifiers. Modifiers reference picks, so they
            // are deleted first and re-inserted with their target pick's navigation set (EF resolves
            // the FK on save — no intermediate round-trip).
            var roster = await db.Rosters
                .FirstOrDefaultAsync(r => r.RegistrationId == registrationId && r.RoundId == roundId);
            if (roster is null)
            {
                roster = new Roster { RegistrationId = registrationId, RoundId = roundId, CreatedAt = DateTime.UtcNow, UpdatedAt = DateTime.UtcNow };
                db.Add(roster);
            }
            else
            {
                await db.RosterModifiers.Where(m => m.RosterId == roster.Id).ExecuteDeleteAsync();
                await db.Picks.Where(p => p.RosterId == roster.Id).ExecuteDeleteAsync();
                roster.UpdatedAt = DateTime.UtcNow;
            }

            var pickByEntity = new Dictionary<(EntityType, long), Pick>();
            foreach (var x in mainPicks)
            {
                var pick = new Pick
                {
                    Roster = roster, SlotType = SlotType.Main, EntityType = x.EntityType,
                    EntityId = x.EntityId, ClassId = x.Price.ClassId, PriceAtLock = x.Price.Price
                };
                db.Add(pick);
                pickByEntity[(x.EntityType, x.EntityId)] = pick;
            }

            foreach (var m in modifiers)
                db.Add(new RosterModifier
                {
                    Roster = roster,
                    Kind = m.Kind,
                    TargetPick = m.Target is { } t ? pickByEntity[(t.EntityType, t.EntityId)] : null,
                    Params = m.Params?.GetRawText() ?? "{}"
                });

            await db.SaveChangesAsync();
            await tx.CommitAsync();

            var reloaded = await db.Rosters.Include(r => r.Picks)
                .Include(r => r.Modifiers).ThenInclude(m => m.TargetPick)
                .FirstAsync(r => r.RegistrationId == registrationId && r.RoundId == roundId);
            return Results.Ok(BuildResponse(registrationId, roundId, round.SalaryCap, reloaded, locked: false));
        })
        .Produces<RosterResponse>()
        .Produces<RosterErrorResponse>(StatusCodes.Status409Conflict)
        .Produces<RosterErrorResponse>(StatusCodes.Status422UnprocessableEntity);

        return app;
    }

    /// <summary>Locks the round row FOR UPDATE and returns whether qualifying has started; null if no such round.</summary>
    private static async Task<bool?> IsLocked(FantasyDbContext db, IDbContextTransaction tx, long roundId)
    {
        var conn = db.Database.GetDbConnection();
        await using var cmd = conn.CreateCommand();
        cmd.Transaction = tx.GetDbTransaction();
        cmd.CommandText = "SELECT (now() >= quali_start) FROM round WHERE id = @id FOR UPDATE";
        var p = cmd.CreateParameter();
        p.ParameterName = "@id";
        p.Value = roundId;
        cmd.Parameters.Add(p);
        var result = await cmd.ExecuteScalarAsync();
        return result is null ? null : (bool)result;
    }

    private static RosterResponse BuildResponse(long registrationId, long roundId, decimal salaryCap, Roster? roster, bool locked)
    {
        var picks = roster?.Picks ?? new List<Pick>();
        var spent = picks.Sum(p => p.PriceAtLock);
        RosterPickDto Map(Pick p) => new(p.EntityType, p.EntityId, p.ClassId, p.PriceAtLock);
        var mods = (roster?.Modifiers ?? new List<RosterModifier>())
            .Select(m => new RosterModifierDto(
                m.Kind,
                m.TargetPick is { } tp ? new EntityRef(tp.EntityType.ToString(), tp.EntityId) : null))
            .ToList();
        return new RosterResponse(
            registrationId, roundId, locked,
            roster?.LockedAt is { } la ? new DateTimeOffset(la, TimeSpan.Zero) : null,
            salaryCap, spent, salaryCap - spent,
            picks.Where(p => p.SlotType == SlotType.Main).Select(Map).ToList(),
            mods);
    }
}

public record PutRosterRequest(List<RosterPickInput>? Main, List<ModifierInput>? Modifiers);
public record RosterPickInput(EntityType EntityType, long EntityId);

/// <summary>A submitted modifier. <see cref="Target"/> is set for pick-targeted kinds
/// (DOUBLE_POINTS_TEAM, CAPTAIN); <see cref="Params"/> carries non-pick selections for future kinds.</summary>
public record ModifierInput(string Kind, RosterPickInput? Target, System.Text.Json.JsonElement? Params);

public record RosterResponse(
    long RegistrationId, long RoundId, bool Locked, DateTimeOffset? LockedAt,
    decimal SalaryCap, decimal Spent, decimal Remaining,
    List<RosterPickDto> Main, List<RosterModifierDto> Modifiers);

public record RosterPickDto(EntityType EntityType, long EntityId, long ClassId, decimal Price);
public record RosterModifierDto(string Kind, EntityRef? Target);

/// <summary>
/// Unified roster PUT error body (409/422). <see cref="Error"/> is the discriminator
/// ("locked" | "cap_exceeded" | "unavailable" | "composition" | "modifier"); the other fields are
/// populated only for the matching case.
/// </summary>
public record RosterErrorResponse(
    string Error, string? Message = null, decimal? Spent = null, decimal? SalaryCap = null,
    List<EntityRef>? Entities = null, List<Picks.CompositionViolation>? Violations = null,
    List<Picks.ModifierViolation>? ModifierViolations = null);

public record EntityRef(string EntityType, long EntityId);
