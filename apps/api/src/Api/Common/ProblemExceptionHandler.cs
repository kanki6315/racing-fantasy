using Microsoft.AspNetCore.Diagnostics;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace EnduranceFantasy.Api.Common;

/// <summary>
/// Translates Postgres constraint violations into clean HTTP problem responses so the
/// admin/import API gives callers actionable status codes instead of raw 500s.
/// </summary>
public sealed class ProblemExceptionHandler : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(HttpContext ctx, Exception exception, CancellationToken ct)
    {
        if (exception is not DbUpdateException { InnerException: PostgresException pg })
            return false;

        var (status, detail) = pg.SqlState switch
        {
            PostgresErrorCodes.UniqueViolation =>
                (StatusCodes.Status409Conflict, "A resource with the same unique value already exists."),
            PostgresErrorCodes.ForeignKeyViolation =>
                (StatusCodes.Status409Conflict, "A referenced resource is missing or still in use."),
            PostgresErrorCodes.CheckViolation =>
                (StatusCodes.Status422UnprocessableEntity, "A value violates a database constraint."),
            PostgresErrorCodes.NotNullViolation =>
                (StatusCodes.Status422UnprocessableEntity, "A required value was missing."),
            _ => (0, string.Empty)
        };

        if (status == 0) return false;

        await Results.Problem(detail: detail, statusCode: status).ExecuteAsync(ctx);
        return true;
    }
}
