namespace EnduranceFantasy.Api.Email;

/// <summary>
/// Config for sending mail via Amazon SES (bound from the "Aws:Ses" section; set via user-secrets
/// locally / host config in prod). Mirrors <c>ImageStorageOptions</c>: credentials are optional —
/// omit AccessKeyId/SecretAccessKey to use the default AWS credential chain (env vars, shared
/// profile, IAM role). <see cref="IsConfigured"/> is false until a from-address + region are set, so
/// the app and the reminder worker run cleanly before SES is provisioned (the sender logs-and-skips).
/// </summary>
public sealed class SesOptions
{
    /// <summary>Verified SES sender (e.g. "Endurance Fantasy &lt;no-reply@mail.example.com&gt;").</summary>
    public string? FromAddress { get; set; }
    public string? ReplyTo { get; set; }
    public string? Region { get; set; }
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }

    /// <summary>SES configuration set attached to each send so bounces/complaints are published (ADR-0010).</summary>
    public string? ConfigurationSetName { get; set; }
    /// <summary>The SNS topic ARN that delivers those events — the webhook only acts on messages from it (ADR-0010 D5).</summary>
    public string? EventsTopicArn { get; set; }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(FromAddress) && !string.IsNullOrWhiteSpace(Region);
}
