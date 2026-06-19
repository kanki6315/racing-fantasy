using System.Text.Json;
using System.Text.Json.Serialization;

namespace ImsaFantasy.Api.Ingestion;

/// <summary>
/// Parser for Al Kamel "Time Cards" race JSON (lap-by-lap, per driver). Each lap carries a
/// driver_number and is_valid flag, so a driver's fastest race lap = their fastest valid lap.
/// This is the per-driver source the standard results CSV lacks (unblocks IMPACT scoring).
/// </summary>
public static class TimeCardsJson
{
    private static readonly JsonSerializerOptions Options = new() { PropertyNameCaseInsensitive = true };

    public static TimeCardsDoc Parse(string json) =>
        JsonSerializer.Deserialize<TimeCardsDoc>(json, Options) ?? new TimeCardsDoc();

    /// <summary>Fastest valid lap (ms) per driver, per car/class.</summary>
    public static List<DriverFastestLap> ExtractFastestLaps(TimeCardsDoc doc)
    {
        var result = new List<DriverFastestLap>();
        foreach (var p in doc.Participants)
        {
            var nameByNumber = p.Drivers.ToDictionary(
                d => d.Number.ToString(),
                d => string.Join(' ', new[] { d.FirstName, d.Surname }.Where(s => !string.IsNullOrWhiteSpace(s))).Trim());

            var bestByDriver = new Dictionary<string, long>();
            foreach (var lap in p.Laps)
            {
                if (!lap.IsValid || lap.DriverNumber is null) continue;
                var ms = ImsaResultsCsv.ParseLapMs(lap.Time);
                if (ms is null) continue;
                if (!bestByDriver.TryGetValue(lap.DriverNumber, out var cur) || ms < cur)
                    bestByDriver[lap.DriverNumber] = ms.Value;
            }

            foreach (var (driverNumber, ms) in bestByDriver)
                result.Add(new DriverFastestLap(
                    p.Number, p.ClassName,
                    nameByNumber.GetValueOrDefault(driverNumber, ""), ms));
        }
        return result;
    }
}

public sealed class TimeCardsDoc
{
    [JsonPropertyName("participants")] public List<TcParticipant> Participants { get; set; } = [];
}

public sealed class TcParticipant
{
    [JsonPropertyName("number")] public string Number { get; set; } = "";
    [JsonPropertyName("class")] public string ClassName { get; set; } = "";
    [JsonPropertyName("drivers")] public List<TcDriver> Drivers { get; set; } = [];
    [JsonPropertyName("laps")] public List<TcLap> Laps { get; set; } = [];
}

public sealed class TcDriver
{
    [JsonPropertyName("number")] public int Number { get; set; }
    [JsonPropertyName("firstname")] public string? FirstName { get; set; }
    [JsonPropertyName("surname")] public string? Surname { get; set; }
}

public sealed class TcLap
{
    [JsonPropertyName("driver_number")] public string? DriverNumber { get; set; }
    [JsonPropertyName("time")] public string? Time { get; set; }
    [JsonPropertyName("is_valid")] public bool IsValid { get; set; }
}

public sealed record DriverFastestLap(string CarNumber, string ClassName, string DriverName, long FastestMs);
