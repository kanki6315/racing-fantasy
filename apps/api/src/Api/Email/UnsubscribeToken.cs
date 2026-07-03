using System.Security.Cryptography;
using System.Text;
using ImsaFantasy.Api.Workers;

namespace ImsaFantasy.Api.Email;

/// <summary>
/// Signs / verifies the one-click unsubscribe token (ADR-0009 D7): "{userId}.{HMAC}". No auth is
/// needed to unsubscribe, so the signature is what proves the link wasn't forged. No expiry — an
/// unsubscribe link should keep working. The secret comes from Reminders:UnsubscribeSecret; without
/// it <see cref="IsConfigured"/> is false and the worker won't send (links would be unverifiable).
/// </summary>
public sealed class UnsubscribeTokenService(ReminderOptions options)
{
    private readonly byte[] _key = string.IsNullOrWhiteSpace(options.UnsubscribeSecret)
        ? []
        : Encoding.UTF8.GetBytes(options.UnsubscribeSecret);

    public bool IsConfigured => _key.Length > 0;

    public string Create(long userId)
    {
        var payload = userId.ToString();
        return $"{payload}.{Sign(payload)}";
    }

    public bool TryValidate(string? token, out long userId)
    {
        userId = 0;
        if (string.IsNullOrEmpty(token)) return false;
        var dot = token.IndexOf('.');
        if (dot <= 0) return false;

        var payload = token[..dot];
        var sig = token[(dot + 1)..];
        if (!long.TryParse(payload, out var id)) return false;

        var expected = Encoding.UTF8.GetBytes(Sign(payload));
        if (!CryptographicOperations.FixedTimeEquals(expected, Encoding.UTF8.GetBytes(sig))) return false;

        userId = id;
        return true;
    }

    private string Sign(string payload)
    {
        using var hmac = new HMACSHA256(_key);
        return Base64UrlEncode(hmac.ComputeHash(Encoding.UTF8.GetBytes(payload)));
    }

    private static string Base64UrlEncode(byte[] bytes) =>
        Convert.ToBase64String(bytes).TrimEnd('=').Replace('+', '-').Replace('/', '_');
}
