using EnduranceFantasy.Api.Auth;
using EnduranceFantasy.Api.Picks;
using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;

namespace EnduranceFantasy.Api.Endpoints;

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
            // No event = no release gate (quali lock still applies); otherwise mirror Event.PicksOpen.
            var picksOpen = round.EventId is not { } evId
                || await db.Events.Where(e => e.Id == evId).Select(e => e.PicksOpen).FirstAsync();
            return Results.Ok(BuildResponse(registration.Id, roundId, round.SalaryCap, roster, locked, picksOpen));
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

            // Picks open at the event level — the whole weekend is released together (Event.PicksOpen).
            // A round with no event has no such gate; the quali lock above still applies.
            if (round.EventId is { } eventId &&
                !await db.Events.Where(e => e.Id == eventId).Select(e => e.PicksOpen).FirstAsync())
                return Results.Json(new RosterErrorResponse("not_open", Message: "Picks for this event aren't open yet."),
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
            // The not_open gate above already passed, so the event is open here.
            return Results.Ok(BuildResponse(registrationId, roundId, round.SalaryCap, reloaded, locked: false, picksOpen: true));
        })
        .Produces<RosterResponse>()
        .Produces<RosterErrorResponse>(StatusCodes.Status409Conflict)
        .Produces<RosterErrorResponse>(StatusCodes.Status422UnprocessableEntity);

        // Read-only view of ANOTHER player's picks + their per-pick scores — the standings drill-in.
        // Any signed-in user (the group's auth), but gated on lock: a roster is only revealed once
        // qualifying has begun, so a rival's lineup can't be copied before picks close (409 not_locked
        // otherwise). No ownership check — that's the whole point, unlike GET /roster above.
        group.MapGet("/{roundId:long}/picks", async (long registrationId, long roundId, FantasyDbContext db) =>
        {
            var registration = await db.Registrations.FindAsync(registrationId);
            if (registration is null) return Results.NotFound();
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();

            var roster = await db.Rosters.Include(r => r.Picks)
                .Include(r => r.Modifiers).ThenInclude(m => m.TargetPick)
                .FirstOrDefaultAsync(r => r.RegistrationId == registrationId && r.RoundId == roundId);

            var locked = roster?.LockedAt is not null || DateTime.UtcNow >= round.QualiStart;
            if (!locked)
                return Results.Json(new PlayerPicksError("not_locked", "Picks are hidden until qualifying begins."),
                    statusCode: StatusCodes.Status409Conflict);

            var picks = roster?.Picks.Where(p => p.SlotType == SlotType.Main).ToList() ?? new List<Pick>();
            var mods = roster?.Modifiers.ToList() ?? new List<RosterModifier>();
            var pickIds = picks.Select(p => p.Id).ToList();
            var modifierIds = mods.Select(m => m.Id).ToList();

            // Same score lookup as the admin GET /rounds/{id}/scores, scoped to this one roster.
            var scores = await db.Scores.Where(s =>
                    (s.PickId != null && pickIds.Contains(s.PickId.Value)) ||
                    (s.RosterModifierId != null && modifierIds.Contains(s.RosterModifierId.Value)))
                .ToListAsync();
            var byPick = scores.Where(s => s.PickId != null)
                .GroupBy(s => s.PickId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var byModifier = scores.Where(s => s.RosterModifierId != null)
                .GroupBy(s => s.RosterModifierId!.Value).ToDictionary(g => g.Key, g => g.ToList());
            var total = await db.RoundTotals
                .Where(rt => rt.RegistrationId == registrationId && rt.RoundId == roundId)
                .Select(rt => (decimal?)rt.Points).FirstOrDefaultAsync() ?? 0m;

            var raceNumberBySession = await db.Sessions
                .Where(s => s.RoundId == roundId && s.Type == SessionType.Race)
                .ToDictionaryAsync(s => s.Id, s => s.RaceNumber);
            var raceCount = raceNumberBySession.Count == 0 ? 1 : raceNumberBySession.Values.Max();

            var mainDtos = picks.Select(p =>
            {
                var ss = SourceScoreDto.Order((byPick.GetValueOrDefault(p.Id) ?? new List<Score>())
                    .Select(s => SourceScoreDto.From(s, raceNumberBySession)));
                return new PlayerPickDto(p.EntityType, p.EntityId, p.ClassId, p.PriceAtLock, ss.Sum(x => x.Points), ss);
            }).ToList();

            var modDtos = mods.Select(m => new PlayerModifierDto(
                m.Kind,
                m.TargetPick is { } tp ? new EntityRef(tp.EntityType.ToString(), tp.EntityId) : null,
                (byModifier.GetValueOrDefault(m.Id) ?? new List<Score>()).Sum(s => s.Points))).ToList();

            return Results.Ok(new PlayerPicksResponse(
                registration.Id, registration.TeamName, roundId, locked, total, mainDtos, modDtos, raceCount));
        }).Produces<PlayerPicksResponse>().Produces<PlayerPicksError>(StatusCodes.Status409Conflict);

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

    private static RosterResponse BuildResponse(long registrationId, long roundId, decimal salaryCap, Roster? roster, bool locked, bool picksOpen)
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
            picksOpen,
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
    long RegistrationId, long RoundId, bool Locked, DateTimeOffset? LockedAt, bool PicksOpen,
    decimal SalaryCap, decimal Spent, decimal Remaining,
    List<RosterPickDto> Main, List<RosterModifierDto> Modifiers);

public record RosterPickDto(EntityType EntityType, long EntityId, long ClassId, decimal Price);
public record RosterModifierDto(string Kind, EntityRef? Target);

/// <summary>
/// Read-only disclosure of one player's locked roster + the points each pick scored, for the
/// standings drill-in. <see cref="PlayerPickDto.Scores"/> reuses <see cref="SourceScoreDto"/>
/// (defined alongside the admin scores endpoint) so the quali/race breakdown matches.
/// </summary>
public record PlayerPicksResponse(
    long RegistrationId, string TeamName, long RoundId, bool Locked, decimal Total,
    List<PlayerPickDto> Main, List<PlayerModifierDto> Modifiers, int RaceCount = 1);
public record PlayerPickDto(
    EntityType EntityType, long EntityId, long ClassId, decimal Price, decimal Points, List<SourceScoreDto> Scores);
public record PlayerModifierDto(string Kind, EntityRef? Target, decimal Points);
public record PlayerPicksError(string Error, string? Message = null);

/// <summary>
/// Unified roster PUT error body (409/422). <see cref="Error"/> is the discriminator
/// ("locked" | "not_open" | "cap_exceeded" | "unavailable" | "composition" | "modifier"); the other
/// fields are populated only for the matching case.
/// </summary>
public record RosterErrorResponse(
    string Error, string? Message = null, decimal? Spent = null, decimal? SalaryCap = null,
    List<EntityRef>? Entities = null, List<Picks.CompositionViolation>? Violations = null,
    List<Picks.ModifierViolation>? ModifierViolations = null);

public record EntityRef(string EntityType, long EntityId);
