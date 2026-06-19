using ImsaFantasy.Api.Images;
using ImsaFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace ImsaFantasy.Api.Endpoints;

/// <summary>
/// Admin image uploads. The API only issues a short-lived presigned PUT URL — the browser converts
/// the image to WebP and uploads it straight to S3, so bytes never pass through the API. Keys are a
/// convention the player UI mirrors (no DB writes; presence = "does the object exist", UI fallback):
///   liveries/{roundId}/{entryId}.webp   (per-round → rotating liveries; entryId = CarEntry.Id)
///   drivers/{driverId}.webp             (stable headshot)
/// </summary>
public static class ImageEndpoints
{
    private static readonly TimeSpan PresignTtl = TimeSpan.FromMinutes(5);

    public static IEndpointRouteBuilder MapImageEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/admin/images").WithTags("Images").RequireAuthorization("Admin");

        // Presign a livery upload for a car entry at a round. Keyed by the globally-unique CarEntry id
        // (not the car number) so the player UI can build the URL straight from the price board's entityId.
        group.MapPost("/liveries/{roundId:long}/{entryId:long}", async (
            long roundId, long entryId, ImageStorage storage, FantasyDbContext db) =>
        {
            if (!storage.IsConfigured) return NotConfigured();
            var round = await db.Rounds.FindAsync(roundId);
            if (round is null) return Results.NotFound();
            var entry = await db.CarEntries.FindAsync(entryId);
            if (entry is null || entry.SeasonId != round.SeasonId) return Results.NotFound();

            var key = $"liveries/{roundId}/{entryId}.webp";
            return Results.Ok(new ImagePresignResponse(key, storage.PresignPut(key, PresignTtl)));
        }).Produces<ImagePresignResponse>();

        // Presign a driver headshot upload (season/round-agnostic).
        group.MapPost("/drivers/{driverId:long}", async (long driverId, ImageStorage storage, FantasyDbContext db) =>
        {
            if (!storage.IsConfigured) return NotConfigured();
            if (!await db.Drivers.AnyAsync(d => d.Id == driverId)) return Results.NotFound();

            var key = $"drivers/{driverId}.webp";
            return Results.Ok(new ImagePresignResponse(key, storage.PresignPut(key, PresignTtl)));
        }).Produces<ImagePresignResponse>();

        return app;
    }

    private static IResult NotConfigured() =>
        Results.Problem("Image storage is not configured (set Aws:BucketName / Aws:Region / Aws:PublicBaseUrl).",
            statusCode: StatusCodes.Status503ServiceUnavailable);
}

/// <summary>uploadUrl = presigned S3 PUT (short-lived). The display URL is built UI-side from VITE_IMAGE_BASE_URL.</summary>
public record ImagePresignResponse(string Key, string UploadUrl);
