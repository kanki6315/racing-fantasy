using Amazon;
using Amazon.Runtime;
using Amazon.S3;
using Amazon.S3.Model;

namespace EnduranceFantasy.Api.Images;

/// <summary>
/// Config for the public S3 image bucket (bound from the "Aws" section; set via user-secrets locally).
/// Credentials are optional here — if AccessKeyId/SecretAccessKey are omitted, the default AWS
/// credential chain (env vars, shared profile, IAM role) is used instead.
/// </summary>
public sealed class ImageStorageOptions
{
    public string? BucketName { get; set; }
    public string? Region { get; set; }
    public string? AccessKeyId { get; set; }
    public string? SecretAccessKey { get; set; }
}

/// <summary>
/// Thin wrapper over S3 PutObject for admin image uploads. Storage keys are a pure convention
/// (liveries/{championshipId}/{roundId}/{number}.png, drivers/{driverId}.png) so nothing is persisted
/// in the DB — the player UI builds the same URL from ids it already has. Reports IsConfigured so the
/// app still runs (and the endpoint 503s cleanly) before the bucket secrets are set.
/// </summary>
public sealed class ImageStorage
{
    private readonly ImageStorageOptions _o;
    private readonly IAmazonS3? _s3;

    public ImageStorage(ImageStorageOptions o)
    {
        _o = o;
        if (IsConfigured)
        {
            var region = RegionEndpoint.GetBySystemName(o.Region);
            _s3 = !string.IsNullOrWhiteSpace(o.AccessKeyId) && !string.IsNullOrWhiteSpace(o.SecretAccessKey)
                ? new AmazonS3Client(new BasicAWSCredentials(o.AccessKeyId, o.SecretAccessKey), region)
                : new AmazonS3Client(region); // default credential chain
        }
    }

    public bool IsConfigured => !string.IsNullOrWhiteSpace(_o.BucketName) && !string.IsNullOrWhiteSpace(_o.Region);

    /// <summary>
    /// A short-lived presigned PUT URL the browser uploads to directly (the API never sees the bytes).
    /// Content-Type is intentionally unsigned to avoid signature mismatches — the client still sends
    /// `Content-Type: image/png` so the stored object is typed correctly. The bucket needs a CORS rule
    /// allowing PUT from the web origin.
    /// </summary>
    public string PresignPut(string key, TimeSpan expiry)
    {
        if (_s3 is null) throw new InvalidOperationException("Image storage is not configured.");
        return _s3.GetPreSignedURL(new GetPreSignedUrlRequest
        {
            BucketName = _o.BucketName,
            Key = key,
            Verb = HttpVerb.PUT,
            Expires = DateTime.UtcNow.Add(expiry),
        });
    }
}

public static class ImageStorageSetup
{
    public static IServiceCollection AddImageStorage(this IServiceCollection services, IConfiguration config)
    {
        var opts = config.GetSection("Aws").Get<ImageStorageOptions>() ?? new ImageStorageOptions();
        services.AddSingleton(opts);
        services.AddSingleton<ImageStorage>();
        return services;
    }
}
