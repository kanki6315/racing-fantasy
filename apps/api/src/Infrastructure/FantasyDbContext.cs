using System.Text.RegularExpressions;
using ImsaFantasy.Domain;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Infrastructure;

public partial class FantasyDbContext(DbContextOptions<FantasyDbContext> options) : DbContext(options)
{
    // Catalog / structure
    public DbSet<Championship> Championships => Set<Championship>();
    public DbSet<Season> Seasons => Set<Season>();
    public DbSet<Class> Classes => Set<Class>();
    public DbSet<Event> Events => Set<Event>();
    public DbSet<Round> Rounds => Set<Round>();
    public DbSet<Session> Sessions => Set<Session>();

    // Pickable entities & economy
    public DbSet<CarEntry> CarEntries => Set<CarEntry>();
    public DbSet<Driver> Drivers => Set<Driver>();
    public DbSet<EntryDriver> EntryDrivers => Set<EntryDriver>();
    public DbSet<EntityPrice> EntityPrices => Set<EntityPrice>();

    // Registration, rules & picks
    public DbSet<AppUser> Users => Set<AppUser>();
    public DbSet<Registration> Registrations => Set<Registration>();
    public DbSet<RosterRule> RosterRules => Set<RosterRule>();
    public DbSet<RosterModifierRule> RosterModifierRules => Set<RosterModifierRule>();
    public DbSet<Roster> Rosters => Set<Roster>();
    public DbSet<Pick> Picks => Set<Pick>();
    public DbSet<RosterModifier> RosterModifiers => Set<RosterModifier>();

    // Results
    public DbSet<QualiResult> QualiResults => Set<QualiResult>();
    public DbSet<RaceResult> RaceResults => Set<RaceResult>();
    public DbSet<RaceFastestLap> RaceFastestLaps => Set<RaceFastestLap>();

    // Scoring
    public DbSet<ScoringRuleset> ScoringRulesets => Set<ScoringRuleset>();
    public DbSet<PositionPoints> PositionPoints => Set<PositionPoints>();
    public DbSet<ScoringBonus> ScoringBonuses => Set<ScoringBonus>();
    public DbSet<Score> Scores => Set<Score>();
    public DbSet<ScoreAudit> ScoreAudits => Set<ScoreAudit>();
    public DbSet<RoundTotal> RoundTotals => Set<RoundTotal>();

    // Leagues
    public DbSet<League> Leagues => Set<League>();
    public DbSet<LeagueMembership> LeagueMemberships => Set<LeagueMembership>();

    // Notifications
    public DbSet<EventReminder> EventReminders => Set<EventReminder>();
    public DbSet<EmailEvent> EmailEvents => Set<EmailEvent>();
    public DbSet<EmailPreference> EmailPreferences => Set<EmailPreference>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // ---- Enums stored as text (readable in the DB) ----
        b.Entity<Session>().Property(x => x.Type).HasConversion<string>().HasMaxLength(16);
        b.Entity<Session>().Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.Entity<EntityPrice>().Property(x => x.EntityType).HasConversion<string>().HasMaxLength(8);
        b.Entity<RosterRule>().Property(x => x.SlotType).HasConversion<string>().HasMaxLength(8);
        b.Entity<Pick>().Property(x => x.SlotType).HasConversion<string>().HasMaxLength(8);
        b.Entity<Pick>().Property(x => x.EntityType).HasConversion<string>().HasMaxLength(8);
        b.Entity<ScoringRuleset>().Property(x => x.Source).HasConversion<string>().HasMaxLength(24);
        b.Entity<ScoringRuleset>().Property(x => x.Status).HasConversion<string>().HasMaxLength(16);
        b.Entity<Score>().Property(x => x.Source).HasConversion<string>().HasMaxLength(24);
        b.Entity<ScoreAudit>().Property(x => x.Source).HasConversion<string>().HasMaxLength(24);
        b.Entity<League>().Property(x => x.Visibility).HasConversion<string>().HasMaxLength(8);
        b.Entity<EntryDriver>().Property(x => x.Rating).HasConversion<string>().HasMaxLength(8);

        // ---- Money / points precision ----
        b.Entity<Round>().Property(x => x.SalaryCap).HasPrecision(10, 2);
        b.Entity<EntityPrice>().Property(x => x.Price).HasPrecision(10, 2);
        b.Entity<Pick>().Property(x => x.PriceAtLock).HasPrecision(10, 2);
        b.Entity<PositionPoints>().Property(x => x.Points).HasPrecision(10, 2);
        b.Entity<Score>().Property(x => x.Points).HasPrecision(10, 2);
        b.Entity<ScoreAudit>().Property(x => x.OldPoints).HasPrecision(10, 2);
        b.Entity<ScoreAudit>().Property(x => x.NewPoints).HasPrecision(10, 2);
        b.Entity<RoundTotal>().Property(x => x.Points).HasPrecision(10, 2);

        // jsonb params
        b.Entity<ScoringBonus>().Property(x => x.Params).HasColumnType("jsonb");
        b.Entity<RosterModifier>().Property(x => x.Params).HasColumnType("jsonb");
        b.Entity<RosterModifierRule>().Property(x => x.Kind).HasMaxLength(32);
        b.Entity<RosterModifierRule>().Property(x => x.AppliesTo).HasMaxLength(16);
        b.Entity<RosterModifier>().Property(x => x.Kind).HasMaxLength(32);
        b.Entity<Class>().Property(x => x.Color).HasMaxLength(7);   // #RRGGBB

        // ---- Unique constraints (from data-model.md) ----
        b.Entity<Championship>().HasIndex(x => x.Slug).IsUnique();
        b.Entity<Season>().HasIndex(x => new { x.ChampionshipId, x.Year }).IsUnique();
        b.Entity<Class>().HasIndex(x => new { x.ChampionshipId, x.Name }).IsUnique();
        b.Entity<Round>().HasIndex(x => new { x.SeasonId, x.Sequence }).IsUnique();
        // RaceNumber distinguishes multi-race weekends (MX-5 R1/R2); always 1 for Qualifying.
        b.Entity<Session>().HasIndex(x => new { x.RoundId, x.ClassId, x.Type, x.RaceNumber }).IsUnique();
        b.Entity<Session>().Property(x => x.RaceNumber).HasDefaultValue(1);
        b.Entity<CarEntry>().HasIndex(x => new { x.SeasonId, x.ClassId, x.Number }).IsUnique();
        // RoundId is nullable (NULL = season-wide row, mirrors roster_rule.round_id): treat NULLs as
        // equal so a (car, driver) pair has at most one season-wide row plus one row per round.
        b.Entity<EntryDriver>().HasIndex(x => new { x.CarEntryId, x.DriverId, x.RoundId })
            .IsUnique().AreNullsDistinct(false);
        b.Entity<EntryDriver>().HasOne(x => x.Round).WithMany().HasForeignKey(x => x.RoundId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<EntityPrice>().HasIndex(x => new { x.RoundId, x.EntityType, x.EntityId }).IsUnique();
        b.Entity<AppUser>().HasIndex(x => new { x.ExternalProvider, x.ExternalSubject }).IsUnique();
        b.Entity<AppUser>().Property(x => x.Name).HasMaxLength(200);
        b.Entity<AppUser>().Property(x => x.Email).HasMaxLength(320);
        b.Entity<Registration>().HasIndex(x => new { x.UserId, x.SeasonId }).IsUnique();
        // RoundId/ClassId are nullable (RoundId null = season default, ClassId null = legacy IMPACT "any
        // class"): treat NULLs as equal so there's at most one season default + one per-round override per
        // (season, class, slot).
        b.Entity<RosterRule>().HasIndex(x => new { x.SeasonId, x.RoundId, x.ClassId, x.SlotType })
            .IsUnique().AreNullsDistinct(false);
        b.Entity<RosterRule>().HasOne(x => x.Round).WithMany().HasForeignKey(x => x.RoundId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Roster>().HasIndex(x => new { x.RegistrationId, x.RoundId }).IsUnique();
        b.Entity<Pick>().HasIndex(x => new { x.RosterId, x.SlotType, x.EntityType, x.EntityId }).IsUnique();
        // One modifier-rule per (season, kind); one modifier of each kind per roster (ADR-0006 D3).
        b.Entity<RosterModifierRule>().HasIndex(x => new { x.SeasonId, x.Kind }).IsUnique();
        b.Entity<RosterModifier>().HasIndex(x => new { x.RosterId, x.Kind }).IsUnique();
        b.Entity<QualiResult>().HasIndex(x => new { x.SessionId, x.CarEntryId }).IsUnique();
        b.Entity<RaceResult>().HasIndex(x => new { x.SessionId, x.CarEntryId }).IsUnique();
        b.Entity<RaceFastestLap>().HasIndex(x => new { x.SessionId, x.DriverId }).IsUnique();
        b.Entity<ScoringRuleset>().HasIndex(x => new { x.SeasonId, x.Source, x.Version }).IsUnique();
        b.Entity<PositionPoints>().HasIndex(x => new { x.RulesetId, x.Rank }).IsUnique();
        // A Score is owned by exactly one of a pick or a modifier (ADR-0006 D4): one unique key
        // per owner kind (filtered so the NULL owner column never participates). Pick-owned rows
        // also key on SessionId so a multi-race round holds one RacePosition row per race; NULLs
        // compare equal so legacy rows with no resolvable session still dedupe per (pick, source).
        b.Entity<Score>().HasIndex(x => new { x.PickId, x.Source, x.SessionId }).IsUnique()
            .HasFilter("pick_id IS NOT NULL").AreNullsDistinct(false);
        b.Entity<Score>().HasIndex(x => new { x.RosterModifierId, x.Source }).IsUnique().HasFilter("roster_modifier_id IS NOT NULL");
        b.Entity<Score>().HasOne(x => x.Session).WithMany().HasForeignKey(x => x.SessionId)
            .OnDelete(DeleteBehavior.Restrict);
        b.Entity<Score>().ToTable(t => t.HasCheckConstraint(
            "ck_score_one_owner", "(pick_id IS NULL) <> (roster_modifier_id IS NULL)"));
        b.Entity<RoundTotal>().HasIndex(x => new { x.RegistrationId, x.RoundId }).IsUnique();
        b.Entity<LeagueMembership>().HasIndex(x => new { x.LeagueId, x.RegistrationId }).IsUnique();
        b.Entity<League>().HasIndex(x => x.JoinCode).IsUnique();
        // One reminder per (event, user) — the single-send guarantee (ADR-0009).
        // One reminder per (event, user, kind) — single-send per email kind (ADR-0009 amendment).
        b.Entity<EventReminder>().HasIndex(x => new { x.EventId, x.UserId, x.Kind }).IsUnique();
        b.Entity<EventReminder>().Property(x => x.Kind).HasMaxLength(24);
        // Per-kind email opt-in (ADR-0009 amendment): at most one preference row per (user, kind).
        b.Entity<EmailPreference>().HasIndex(x => new { x.UserId, x.Kind }).IsUnique();
        b.Entity<EmailPreference>().Property(x => x.Kind).HasMaxLength(24);
        // Bounce/complaint events (ADR-0010): jsonb payload; dedupe SNS redelivery on (sns_message_id, email).
        b.Entity<EmailEvent>().Property(x => x.Raw).HasColumnType("jsonb");
        b.Entity<EmailEvent>().Property(x => x.Type).HasMaxLength(16);
        b.Entity<EmailEvent>().Property(x => x.Subtype).HasMaxLength(64);
        b.Entity<EmailEvent>().Property(x => x.Email).HasMaxLength(320);
        b.Entity<EmailEvent>().Property(x => x.SesMessageId).HasMaxLength(255);
        b.Entity<EmailEvent>().Property(x => x.SnsMessageId).HasMaxLength(255);
        b.Entity<EmailEvent>().HasIndex(x => new { x.SnsMessageId, x.Email })
            .IsUnique().HasFilter("sns_message_id IS NOT NULL");
        b.Entity<EmailEvent>().HasIndex(x => x.Email);

        // ---- Extra non-unique hot-path index not covered by a unique prefix ----
        b.Entity<Score>().HasIndex(x => x.RosterId);

        // ---- Delete behavior: Restrict by default; cascade only within aggregates ----
        foreach (var fk in b.Model.GetEntityTypes().SelectMany(e => e.GetForeignKeys()))
            fk.DeleteBehavior = DeleteBehavior.Restrict;

        b.Entity<Pick>().HasOne(p => p.Roster).WithMany(r => r.Picks)
            .HasForeignKey(p => p.RosterId).OnDelete(DeleteBehavior.Cascade);
        // Modifiers are part of the roster aggregate; their target pick is Restrict (default) so the
        // PUT must delete modifiers before picks (it does), surfacing any ordering bug loudly.
        b.Entity<RosterModifier>().HasOne(m => m.Roster).WithMany(r => r.Modifiers)
            .HasForeignKey(m => m.RosterId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<RosterModifier>().HasOne(m => m.TargetPick).WithMany()
            .HasForeignKey(m => m.TargetPickId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<PositionPoints>().HasOne(p => p.Ruleset).WithMany(r => r.PositionPoints)
            .HasForeignKey(p => p.RulesetId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ScoringBonus>().HasOne(x => x.Ruleset).WithMany(r => r.Bonuses)
            .HasForeignKey(x => x.RulesetId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<LeagueMembership>().HasOne(m => m.League).WithMany(l => l.Members)
            .HasForeignKey(m => m.LeagueId).OnDelete(DeleteBehavior.Cascade);
        // Reminder log is disposable telemetry of (event, user): cascade so erasure (ADR-0004 hard-deletes
        // the user) and event deletion clean up their reminder rows instead of being blocked by Restrict.
        b.Entity<EventReminder>().HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<EventReminder>().HasOne(x => x.Event).WithMany()
            .HasForeignKey(x => x.EventId).OnDelete(DeleteBehavior.Cascade);
        // Bounce/complaint record links to a user by resolved email; cascade so erasure removes it (and its
        // stored email) too. UserId is nullable (an event may arrive for an address with no matching user).
        b.Entity<EmailEvent>().HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<EmailPreference>().HasOne(x => x.User).WithMany()
            .HasForeignKey(x => x.UserId).OnDelete(DeleteBehavior.Cascade);

        ApplySnakeCaseNames(b);
    }

    /// <summary>
    /// Maps PascalCase CLR names to singular snake_case table/column/constraint names so the
    /// schema matches docs/data-model.md without per-entity ToTable/HasColumnName calls.
    /// </summary>
    private static void ApplySnakeCaseNames(ModelBuilder b)
    {
        foreach (var entity in b.Model.GetEntityTypes())
        {
            entity.SetTableName(ToSnakeCase(entity.ClrType.Name));

            foreach (var property in entity.GetProperties())
                property.SetColumnName(ToSnakeCase(property.Name));

            foreach (var key in entity.GetKeys())
                key.SetName(ToSnakeCase(key.GetName()));

            foreach (var fk in entity.GetForeignKeys())
                fk.SetConstraintName(ToSnakeCase(fk.GetConstraintName()));

            foreach (var index in entity.GetIndexes())
                index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName()));
        }
    }

    private static string? ToSnakeCase(string? name)
    {
        if (string.IsNullOrEmpty(name)) return name;
        var s = Pascal1().Replace(name, "$1_$2");
        s = Pascal2().Replace(s, "$1_$2");
        return s.ToLowerInvariant();
    }

    [GeneratedRegex("([A-Z]+)([A-Z][a-z])")]
    private static partial Regex Pascal1();

    [GeneratedRegex("([a-z\\d])([A-Z])")]
    private static partial Regex Pascal2();
}
