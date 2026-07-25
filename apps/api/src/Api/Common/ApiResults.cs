namespace EnduranceFantasy.Api.Common;

public static class ApiResults
{
    /// <summary>400 validation problem for a referenced parent that does not exist.</summary>
    public static IResult RefNotFound(string field) =>
        Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [field] = [$"Referenced {field} not found."]
        });
}
