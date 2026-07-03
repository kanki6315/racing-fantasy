using System.Security.Cryptography;
using System.Text;
using ImsaFantasy.Api.Workers;

namespace ImsaFantasy.Api.Email;

/// <summary>
/// Signs / verifies the one-click unsubscribe token (ADR-0009 D7): "{userId}.{kind}.{HMAC}". The kind
/// is encoded so an unsubscribe link disables only that email kind (ADR-0009 amendment). No auth is
/// needed to unsubscribe, so the signature is what proves the link wasn't forged. No expiry. The secret
/// comes from Reminders:UnsubscribeSecret; without it <see cref="IsConfigured"/> is false and the worker
/// won't send (links would be unverifiable).
/// </summary>
public sealed class UnsubscribeTokenService(ReminderOptions options)
{
    private readonly byte[] _key = string.IsNullOrWhiteSpace(options.UnsubscribeSecret)
        ? []
        : Encoding.UTF8.GetBytes(options.UnsubscribeSecret);

    public bool IsConfigured => _key.Length > 0;

    public string Create(long userId, string kind)
    {
        var payload = $"{userId}.{kind}";
        return $"{payload}.{Sign(payload)}";
    }

    public bool TryValidate(string? token, out long userId, out string kind)
    {
        userId = 0;
        kind = "";
        if (string.IsNullOrEmpty(token)) return false;
        // payload = "{userId}.{kind}"; kind has no dots, the sig (base64url) has none → split into 3.
        var parts = token.Split('.');
        if (parts.Length != 3 || !long.TryParse(parts[0], out var id)) return false;

        var payload = $"{parts[0]}.{parts[1]}";
        var expected = Encoding.UTF8.GetBytes(Sign(payload));
        if (!CryptographicOperations.FixedTimeEquals(expected, Encoding.UTF8.GetBytes(parts[2]))) return false;

        userId = id;
        kind = parts[1];
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
