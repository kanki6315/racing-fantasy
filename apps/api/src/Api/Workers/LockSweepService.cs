using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Workers;

/// <summary>
/// Defense-in-depth for the lock (ADR-0002): once a round's quali_start passes, stamp locked_at on
/// its rosters so they're an immutable, audited record. Idempotent — only un-stamped rosters are
/// touched, so a missed or double-fired sweep is a no-op the second time.
/// </summary>
public sealed class LockSweepService(IServiceProvider services, ILogger<LockSweepService> logger) : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(60);

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        using var timer = new PeriodicTimer(Interval);
        do
        {
            try
            {
                using var scope = services.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<FantasyDbContext>();
                var affected = await db.Database.ExecuteSqlRawAsync(
                    """
                    UPDATE roster SET locked_at = now()
                    FROM round
                    WHERE roster.round_id = round.id
                      AND now() >= round.quali_start
                      AND roster.locked_at IS NULL
                    """, ct);
                if (affected > 0)
                    logger.LogInformation("Lock-sweep stamped {Count} roster(s) as locked.", affected);
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "Lock-sweep iteration failed; will retry next tick.");
            }
        } while (await timer.WaitForNextTickAsync(ct));
    }
}
