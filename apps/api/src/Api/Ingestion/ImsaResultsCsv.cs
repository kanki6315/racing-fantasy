using System.Globalization;

namespace EnduranceFantasy.Api.Ingestion;

/// <summary>
/// Parser for IMSA timing export CSVs (semicolon-delimited, BOM, up to 6 driver blocks per row).
/// Header-name based so it tolerates the differing column layouts of the qualifying and race files.
/// </summary>
public static class ImsaResultsCsv
{
    public static List<ImsaResultRow> Parse(string content)
    {
        content = content.TrimStart('﻿');
        var lines = content.Replace("\r\n", "\n").Split('\n', StringSplitOptions.RemoveEmptyEntries);
        if (lines.Length < 2) return [];

        var headers = lines[0].Split(';');
        var rows = new List<ImsaResultRow>(lines.Length - 1);
        for (var i = 1; i < lines.Length; i++)
        {
            var values = lines[i].Split(';');
            var fields = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            for (var c = 0; c < headers.Length; c++)
                fields[headers[c]] = c < values.Length ? values[c] : "";
            rows.Add(new ImsaResultRow(fields));
        }
        return rows;
    }

    /// <summary>Parses a lap time like "1:13.221" or "13.221" into milliseconds; null if unparseable/blank.</summary>
    public static long? ParseLapMs(string? time)
    {
        if (string.IsNullOrWhiteSpace(time) || time is "-") return null;
        var parts = time.Split(':');
        try
        {
            double seconds = parts.Length switch
            {
                2 => int.Parse(parts[0], CultureInfo.InvariantCulture) * 60
                     + double.Parse(parts[1], CultureInfo.InvariantCulture),
                1 => double.Parse(parts[0], CultureInfo.InvariantCulture),
                _ => double.NaN
            };
            return double.IsNaN(seconds) ? null : (long)Math.Round(seconds * 1000);
        }
        catch (FormatException)
        {
            return null;
        }
    }
}

public sealed class ImsaResultRow(IReadOnlyDictionary<string, string> fields)
{
    public string? Get(string key) =>
        fields.TryGetValue(key, out var v) && !string.IsNullOrWhiteSpace(v) ? v.Trim() : null;

    public string Number => Get("NUMBER") ?? "";
    public string ClassName => Get("CLASS") ?? "";
    public string Team => Get("TEAM") ?? "";

    /// <summary>Driver full names present on the row (DRIVER1..DRIVER6 blocks).</summary>
    public IEnumerable<string> DriverNames()
    {
        for (var n = 1; n <= 6; n++)
        {
            var first = Get($"DRIVER{n}_FIRSTNAME");
            var last = Get($"DRIVER{n}_SECONDNAME");
            if (first is null && last is null) continue;
            yield return string.Join(' ', new[] { first, last }.Where(s => s is not null));
        }
    }
}
