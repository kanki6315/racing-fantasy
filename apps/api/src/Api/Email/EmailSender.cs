using Amazon;
using Amazon.Runtime;
using Amazon.SimpleEmailV2;
using Amazon.SimpleEmailV2.Model;

namespace ImsaFantasy.Api.Email;

/// <summary>One transactional HTML email. <see cref="ListUnsubscribeUrl"/>, when set, adds the
/// one-click List-Unsubscribe headers Gmail/Yahoo bulk senders require (ADR-0009 D7).</summary>
public sealed record EmailMessage(string ToAddress, string Subject, string HtmlBody, string? ListUnsubscribeUrl = null);

public interface IEmailSender
{
    /// <summary>Sends the message; returns the SES messageId, or null (and logs) without throwing when
    /// SES is unconfigured. The messageId correlates later bounce/complaint events to the send (ADR-0010).</summary>
    Task<string?> SendAsync(EmailMessage message, CancellationToken ct = default);
}

/// <summary>
/// Sends mail via Amazon SES v2 (ADR-0009 D5). Mirrors <c>ImageStorage</c>: optional creds fall back
/// to the default AWS credential chain, and an unconfigured sender logs-and-skips so the app/worker
/// run before SES is provisioned. Uses SES "simple" content with a Headers list so the one-click
/// List-Unsubscribe headers ride along without hand-building MIME.
/// </summary>
public sealed class SesEmailSender : IEmailSender, IDisposable
{
    private readonly SesOptions _o;
    private readonly ILogger<SesEmailSender> _log;
    private readonly IAmazonSimpleEmailServiceV2? _ses;

    public SesEmailSender(SesOptions o, ILogger<SesEmailSender> log)
    {
        _o = o;
        _log = log;
        if (o.IsConfigured)
        {
            var region = RegionEndpoint.GetBySystemName(o.Region);
            _ses = !string.IsNullOrWhiteSpace(o.AccessKeyId) && !string.IsNullOrWhiteSpace(o.SecretAccessKey)
                ? new AmazonSimpleEmailServiceV2Client(new BasicAWSCredentials(o.AccessKeyId, o.SecretAccessKey), region)
                : new AmazonSimpleEmailServiceV2Client(region); // default credential chain
        }
    }

    public async Task<string?> SendAsync(EmailMessage m, CancellationToken ct = default)
    {
        if (_ses is null)
        {
            _log.LogWarning("SES not configured; skipping email to {To}.", m.ToAddress);
            return null;
        }

        var headers = new List<MessageHeader>();
        if (!string.IsNullOrWhiteSpace(m.ListUnsubscribeUrl))
        {
            headers.Add(new MessageHeader { Name = "List-Unsubscribe", Value = $"<{m.ListUnsubscribeUrl}>" });
            headers.Add(new MessageHeader { Name = "List-Unsubscribe-Post", Value = "List-Unsubscribe=One-Click" });
        }

        var req = new SendEmailRequest
        {
            FromEmailAddress = _o.FromAddress,
            // The configuration set is what makes SES publish bounce/complaint events (ADR-0010).
            ConfigurationSetName = string.IsNullOrWhiteSpace(_o.ConfigurationSetName) ? null : _o.ConfigurationSetName,
            Destination = new Destination { ToAddresses = [m.ToAddress] },
            ReplyToAddresses = string.IsNullOrWhiteSpace(_o.ReplyTo) ? null : [_o.ReplyTo],
            Content = new EmailContent
            {
                Simple = new Message
                {
                    Subject = new Content { Data = m.Subject, Charset = "UTF-8" },
                    Body = new Body { Html = new Content { Data = m.HtmlBody, Charset = "UTF-8" } },
                    Headers = headers.Count > 0 ? headers : null,
                },
            },
        };

        var resp = await _ses.SendEmailAsync(req, ct);
        _log.LogInformation("Sent email to {To} (SES messageId {Id}).", m.ToAddress, resp.MessageId);
        return resp.MessageId;
    }

    public void Dispose() => _ses?.Dispose();
}

public static class EmailSetup
{
    /// <summary>Registers the email sender. <see cref="SesOptions"/> is bound + registered in Program.cs.</summary>
    public static IServiceCollection AddEmail(this IServiceCollection services)
    {
        services.AddSingleton<IEmailSender, SesEmailSender>();
        return services;
    }
}
