import React, { useEffect, useState } from "@cove/runtime/react";
import { Loader2, Save } from "@cove/runtime/lucide-react";
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from "./api.js";
import { createBetterScrapersController } from "./controller.js";

let controller;
if (globalThis.document && globalThis.MutationObserver) {
  controller = createBetterScrapersController({ document: globalThis.document, location: globalThis.location, MutationObserver: globalThis.MutationObserver, settingsProvider: loadSettings });
  controller.start();
}

export function BetterScrapersSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { loadSettings().then(value => setSettings(normalizeSettings(value))).catch(reason => setMessage(reason.message)).finally(() => setLoading(false)); }, []);
  function update(field, value) { setSettings(current => normalizeSettings({ ...normalizeSettings(current), [field]: value })); }
  async function save() { setSaving(true); setMessage(""); try { setSettings(await saveSettings(settings)); setMessage("Settings saved. New batches use these values immediately."); } catch (reason) { setMessage(reason.message); } finally { setSaving(false); } }
  if (loading) return <p>Loading Better Scrapers settings...</p>;
  const current = normalizeSettings(settings);
  return <div style={{display:"grid",gap:"1rem",maxWidth:"42rem"}}>
    <style>{`.better-scrapers-primary{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;min-height:2.25rem;border-radius:5px;cursor:pointer;padding:.5rem .85rem;border:1px solid var(--color-accent,#2563eb);background:var(--color-accent,#2563eb);color:#fff;font-weight:400}.better-scrapers-primary:hover{filter:brightness(1.1)}.better-scrapers-primary:disabled{cursor:not-allowed;opacity:.6}`}</style>
    <div><h3 style={{fontWeight:700,fontSize:"1.05rem"}}>Better Scrapers</h3><p style={{color:"#9ca3af",fontSize:".875rem"}}>Controls the rate-limited Scrape All action in the video tagger. Save All saves ready selections sequentially.</p></div>
    <label style={{display:"grid",gap:".35rem"}}><span style={{fontWeight:600}}># to scrape before pausing for timeout</span><input type="number" min="1" max="100" value={current.batchSize} onChange={event=>update("batchSize",event.target.value)} style={inputStyle}/><small style={{color:"#9ca3af"}}>This is also the maximum number of simultaneous scraper searches.</small></label>
    <label style={{display:"grid",gap:".35rem"}}><span style={{fontWeight:600}}>Seconds to pause for timeout</span><input type="number" min="0" max="3600" value={current.pauseSeconds} onChange={event=>update("pauseSeconds",event.target.value)} style={inputStyle}/><small style={{color:"#9ca3af"}}>The pause happens after each completed batch except the last.</small></label>
    <label style={{display:"flex",alignItems:"flex-start",gap:".65rem",cursor:"pointer"}}><input type="checkbox" checked={current.useBackoff} onChange={event=>update("useBackoff",event.target.checked)} style={{marginTop:".2rem"}}/><span><strong style={{display:"block"}}>Use exponential backoff</strong><small style={{display:"block",color:"#9ca3af",marginTop:".25rem"}}>When backoff is enabled, if a 429 (too many requests) is encountered during a batch scrape, it will increase the length of the pause until scraping works, up to the maximum backoff.</small></span></label>
    <label style={{display:"grid",gap:".35rem"}}><span style={{fontWeight:600}}>Maximum backoff</span><input type="number" min="1" max="3600" value={current.maximumBackoff} disabled={!current.useBackoff} onChange={event=>update("maximumBackoff",event.target.value)} style={{...inputStyle,opacity:current.useBackoff?1:.55}}/><small style={{color:"#9ca3af"}}>Maximum retry pause in seconds. Defaults to 600.</small></label>
    <label style={{display:"flex",alignItems:"flex-start",gap:".65rem",cursor:"pointer"}}><input type="checkbox" checked={current.automaticallySaveAfterScrape} onChange={event=>update("automaticallySaveAfterScrape",event.target.checked)} style={{marginTop:".2rem"}}/><span><strong style={{display:"block"}}>Automatically save after scrape</strong><small style={{display:"block",color:"#9ca3af",marginTop:".25rem"}}>Immediately save a selected result after that video finishes scraping. Disabled by default.</small></span></label>
    <div><button className="better-scrapers-primary" type="button" disabled={saving} onClick={save}>{saving?<Loader2 className="animate-spin" size={16}/>:<Save size={16}/>}Save settings</button></div>
    {message && <p role="status" style={{color:message.startsWith("Settings saved")?"#22c55e":"#f87171"}}>{message}</p>}
  </div>;
}

const inputStyle={background:"transparent",border:"1px solid #4b5563",borderRadius:".375rem",padding:".5rem .65rem",color:"inherit",maxWidth:"12rem"};
export default { components: { BetterScrapersSettingsPanel } };
