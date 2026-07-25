using EnduranceFantasy.Domain;
using EnduranceFantasy.Infrastructure;
using Microsoft.EntityFrameworkCore;

namespace EnduranceFantasy.Api.Endpoints;

public static class DriverEndpoints
{
    public static IEndpointRouteBuilder MapDriverEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/drivers").WithTags("Drivers").RequireAuthorization("Admin");

        group.MapGet("/", async (string? search, FantasyDbContext db) =>
            Results.Ok(await db.Drivers
                .Where(d => search == null || EF.Functions.ILike(d.FullName, $"%{search}%"))
                .OrderBy(d => d.FullName)
                .Select(d => new DriverDto(d.Id, d.FullName, d.Country)).ToListAsync())).Produces<List<DriverDto>>();

        group.MapGet("/{id:long}", async (long id, FantasyDbContext db) =>
            await db.Drivers.FindAsync(id) is { } d
                ? Results.Ok(new DriverDto(d.Id, d.FullName, d.Country))
                : Results.NotFound());

        group.MapPost("/", async (CreateDriver dto, FantasyDbContext db) =>
        {
            var d = new Driver { FullName = dto.FullName, Country = dto.Country };
            db.Add(d);
            await db.SaveChangesAsync();
            return Results.Created($"/drivers/{d.Id}", new DriverDto(d.Id, d.FullName, d.Country));
        }).Produces<DriverDto>(StatusCodes.Status201Created);

        group.MapPut("/{id:long}", async (long id, UpdateDriver dto, FantasyDbContext db) =>
        {
            var d = await db.Drivers.FindAsync(id);
            if (d is null) return Results.NotFound();
            d.FullName = dto.FullName;
            d.Country = dto.Country;
            await db.SaveChangesAsync();
            return Results.Ok(new DriverDto(d.Id, d.FullName, d.Country));
        }).Produces<DriverDto>();

        group.MapDelete("/{id:long}", async (long id, FantasyDbContext db) =>
        {
            var d = await db.Drivers.FindAsync(id);
            if (d is null) return Results.NotFound();
            db.Remove(d);
            await db.SaveChangesAsync();
            return Results.NoContent();
        });

        return app;
    }
}

public record DriverDto(long Id, string FullName, string? Country);
public record CreateDriver(string FullName, string? Country);
public record UpdateDriver(string FullName, string? Country);
