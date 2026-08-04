using System.Text.Json;
using Cove.Plugins;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.Extensions.DependencyInjection;

namespace Cove.BetterScrapers;

public sealed class BetterScrapersExtension : IExtension, IUIExtension, IStatefulExtension, IApiExtension
{
    public const string ExtensionId = "io.github.jiwenjimiran.better-scrapers";
    private const string SettingsKey = "settings";
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web) { WriteIndented = true };
    private IExtensionStore? _store;

    public string Id => ExtensionId;
    public string Name => "Better Scrapers";
    public string Version => "1.0.0";
    public string? Description => "Rate-limited Scrape All and one-click Save All controls for Cove's video tagger.";
    public string? Author => "jiwenji";
    public string? Url => "https://github.com/jiwenjimiran/cove_scraper_enhancement";
    public string? IconUrl => null;
    public IReadOnlyList<string> Categories => ["tools", "metadata", "scrapers", "ui"];
    public string? MinCoveVersion => "1.0.0";
    public IReadOnlyDictionary<string, string> Dependencies => new Dictionary<string, string>();

    public void ConfigureServices(IServiceCollection services, ExtensionContext context) { }
    public void SetStore(IExtensionStore store) => _store = store;

    public UIManifest GetUIManifest() => new()
    {
        SettingsPanels =
        [
            new UISettingsPanel(
                Id: $"{ExtensionId}:settings",
                Label: "Better Scrapers",
                ExtensionId: ExtensionId,
                ComponentName: "BetterScrapersSettingsPanel",
                Order: 260,
                TargetTab: "extensions")
        ]
    };

    public void MapEndpoints(IEndpointRouteBuilder endpoints)
    {
        endpoints.MapGet("/api/ext/better-scrapers/settings", async (HttpContext ctx) =>
            Results.Json(await LoadSettingsAsync(ctx.RequestAborted), JsonOptions));

        endpoints.MapPut("/api/ext/better-scrapers/settings", async (HttpContext ctx) =>
        {
            var incoming = await JsonSerializer.DeserializeAsync<BetterScrapersSettings>(ctx.Request.Body, JsonOptions, ctx.RequestAborted);
            var settings = BetterScrapersSettings.Normalize(incoming);
            if (_store is null) return Results.Problem("Extension storage is not initialized.");
            await _store.SetAsync(SettingsKey, JsonSerializer.Serialize(settings, JsonOptions), ctx.RequestAborted);
            return Results.Json(settings, JsonOptions);
        });
    }

    private async Task<BetterScrapersSettings> LoadSettingsAsync(CancellationToken ct)
    {
        if (_store is null) return BetterScrapersSettings.Normalize(null);
        var json = await _store.GetAsync(SettingsKey, ct);
        if (string.IsNullOrWhiteSpace(json)) return BetterScrapersSettings.Normalize(null);
        try { return BetterScrapersSettings.Normalize(JsonSerializer.Deserialize<BetterScrapersSettings>(json, JsonOptions)); }
        catch { return BetterScrapersSettings.Normalize(null); }
    }
}

public sealed class BetterScrapersSettings
{
    public int BatchSize { get; set; } = 5;
    public int PauseSeconds { get; set; } = 5;

    public static BetterScrapersSettings Normalize(BetterScrapersSettings? value)
    {
        var settings = value ?? new BetterScrapersSettings();
        settings.BatchSize = Math.Clamp(settings.BatchSize, 1, 100);
        settings.PauseSeconds = Math.Clamp(settings.PauseSeconds, 0, 3600);
        return settings;
    }
}
