using System.Diagnostics;

namespace EnduranceFantasy.Api.Parsing;

/// <summary>
/// Config for the entry-list PDF parser sidecar (bound from the "EntryListParser" section).
/// Command is the parse-entry-list console script from the pitpass-parser package — an absolute
/// venv path locally (user-secrets) and /opt/parser-venv/bin/parse-entry-list in the image.
/// </summary>
public sealed class EntryListParserOptions
{
    public string? Command { get; set; }
    public int TimeoutSeconds { get; set; } = 120;
    public bool IsConfigured => !string.IsNullOrWhiteSpace(Command);
}

public sealed record ParserRunResult(bool TimedOut, int ExitCode, string Stdout, string Stderr);

/// <summary>
/// Runs the Python parser as a short-lived subprocess: PDF in (temp file), entries.json on stdout,
/// human-readable summary/errors on stderr, non-zero exit on failure. Reports IsConfigured so the
/// app still runs (and the endpoint 503s cleanly) where no parser is installed.
/// </summary>
public sealed class EntryListParser(EntryListParserOptions o)
{
    public bool IsConfigured => o.IsConfigured;

    public async Task<ParserRunResult> RunAsync(Stream pdf, string fileName, CancellationToken ct)
    {
        // The parser sniffs the series code (IWSC/IMPC/...) from the filename, so the temp copy
        // must keep the original basename.
        var dir = Directory.CreateTempSubdirectory("entry-list-");
        try
        {
            var safeName = Path.GetFileName(fileName);
            foreach (var c in Path.GetInvalidFileNameChars()) safeName = safeName.Replace(c, '_');
            var pdfPath = Path.Combine(dir.FullName, safeName);
            await using (var tmp = File.Create(pdfPath))
                await pdf.CopyToAsync(tmp, ct);

            var psi = new ProcessStartInfo(o.Command!)
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
            };
            psi.ArgumentList.Add(pdfPath);
            using var proc = Process.Start(psi)
                ?? throw new InvalidOperationException($"Could not start parser '{o.Command}'.");

            // Drain both pipes concurrently: the parser writes JSON to stdout and its summary to
            // stderr, and waiting before reading can deadlock once either pipe's buffer fills.
            var stdout = proc.StandardOutput.ReadToEndAsync(ct);
            var stderr = proc.StandardError.ReadToEndAsync(ct);
            using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);
            cts.CancelAfter(TimeSpan.FromSeconds(o.TimeoutSeconds));
            try
            {
                await proc.WaitForExitAsync(cts.Token);
            }
            catch (OperationCanceledException)
            {
                proc.Kill(entireProcessTree: true);
                ct.ThrowIfCancellationRequested(); // client went away — don't report a timeout
                return new ParserRunResult(TimedOut: true, -1, "", "");
            }
            return new ParserRunResult(TimedOut: false, proc.ExitCode, await stdout, await stderr);
        }
        finally
        {
            dir.Delete(recursive: true);
        }
    }
}

public static class EntryListParserSetup
{
    public static IServiceCollection AddEntryListParser(this IServiceCollection services, IConfiguration config)
    {
        var opts = config.GetSection("EntryListParser").Get<EntryListParserOptions>() ?? new EntryListParserOptions();
        services.AddSingleton(opts);
        services.AddSingleton<EntryListParser>();
        return services;
    }
}
