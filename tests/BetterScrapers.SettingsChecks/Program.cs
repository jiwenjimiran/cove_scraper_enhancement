using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Cove.BetterScrapers;
using Cove.Plugins;

const string SettingsPath = "/api/ext/better-scrapers/settings";
var store = new MemoryStore();
var saved = new BetterScrapersSettings
{
    BatchSize = 17,
    PauseSeconds = 23,
    UseBackoff = false,
    MaximumBackoff = 89,
    AutomaticallySaveAfterScrape = true
};

await WithHost(store, async client =>
{
    await CheckSettings(await client.GetAsync(SettingsPath), new BetterScrapersSettings());
    await CheckSettings(await client.PutAsJsonAsync(SettingsPath, saved), saved);
    if (await store.GetAsync("settings") is null)
        throw new Exception("PUT did not persist settings.");
    await CheckSettings(await client.GetAsync(SettingsPath), saved);

    saved.BatchSize = 9;
    await CheckSettings(await client.PutAsJsonAsync(SettingsPath, saved), saved);
    await CheckSettings(await client.GetAsync(SettingsPath), saved);
});

// A new extension instance must still load the values persisted by the first.
await WithHost(store, async client =>
    await CheckSettings(await client.GetAsync(SettingsPath), saved));

await WithHost(null, async client =>
{
    using var response = await client.PutAsJsonAsync(SettingsPath, saved);
    if (response.StatusCode != HttpStatusCode.InternalServerError)
        throw new Exception("Saving without storage must fail.");
    using var body = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
    if (body.RootElement.GetProperty("detail").GetString() != "Extension storage is not initialized.")
        throw new Exception("Missing storage error response.");
});

Console.WriteLine("PASS: defaults, save/read/update round trip, new extension instance, and storage error responses.");

static async Task CheckSettings(HttpResponseMessage response, BetterScrapersSettings expected)
{
    using (response)
    {
        response.EnsureSuccessStatusCode();
        if (response.Content.Headers.ContentType?.MediaType != "application/json")
            throw new Exception("Settings endpoint must return application/json, not an empty response.");
        var actual = await response.Content.ReadFromJsonAsync<BetterScrapersSettings>();
        if (actual is null || JsonSerializer.Serialize(actual) != JsonSerializer.Serialize(expected))
            throw new Exception("Settings response did not match the expected saved values.");
    }
}

static async Task WithHost(IExtensionStore? store, Func<HttpClient, Task> check)
{
    var builder = WebApplication.CreateBuilder();
    builder.Logging.ClearProviders();
    await using var app = builder.Build();
    app.Urls.Add("http://127.0.0.1:0");
    var extension = new BetterScrapersExtension();
    if (store is not null) extension.SetStore(store);
    extension.MapEndpoints(app);
    await app.StartAsync();
    try
    {
        using var client = new HttpClient { BaseAddress = new Uri(app.Urls.Single()) };
        await check(client);
    }
    finally { await app.StopAsync(); }
}

sealed class MemoryStore : IExtensionStore
{
    private readonly Dictionary<string, string> values = new();
    public Task<string?> GetAsync(string key, CancellationToken ct = default) => Task.FromResult(values.GetValueOrDefault(key));
    public Task SetAsync(string key, string value, CancellationToken ct = default) { values[key] = value; return Task.CompletedTask; }
    public Task DeleteAsync(string key, CancellationToken ct = default) { values.Remove(key); return Task.CompletedTask; }
    public Task<Dictionary<string, string>> GetAllAsync(CancellationToken ct = default) => Task.FromResult(new Dictionary<string, string>(values));
}
