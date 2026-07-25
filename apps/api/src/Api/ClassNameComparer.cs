namespace EnduranceFantasy.Api;

/// <summary>
/// Matches class names across IMSA data feeds that disagree on spacing/case
/// (e.g. the results CSV's <c>GTDPRO</c> vs the broadcast entry-list JSON's <c>GTD PRO</c>).
/// Both collapse to the same key, so importers resolve to a single <c>class</c> row instead of
/// minting a duplicate. Use it as the comparer when keying a class-by-name dictionary and when
/// looking up an incoming class string.
/// </summary>
public sealed class ClassNameComparer : IEqualityComparer<string>
{
    public static readonly ClassNameComparer Instance = new();

    /// <summary>Canonical key for a class name (whitespace removed, upper-cased) — use when a
    /// class name is part of a composite dictionary key that can't take an <see cref="IEqualityComparer{T}"/>.</summary>
    public static string Key(string s) => Normalize(s);

    private static string Normalize(string s)
    {
        Span<char> buf = s.Length <= 64 ? stackalloc char[s.Length] : new char[s.Length];
        var n = 0;
        foreach (var c in s)
            if (!char.IsWhiteSpace(c)) buf[n++] = char.ToUpperInvariant(c);
        return new string(buf[..n]);
    }

    public bool Equals(string? x, string? y) =>
        x is null || y is null ? ReferenceEquals(x, y) : Normalize(x) == Normalize(y);

    public int GetHashCode(string s) => Normalize(s).GetHashCode();
}
