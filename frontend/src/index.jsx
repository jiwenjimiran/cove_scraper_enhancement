import React, { useEffect, useState } from "@cove/runtime/react";
import { DEFAULT_SETTINGS, loadSettings, normalizeSettings, saveSettings } from "./api.js";
import { createBetterScrapersController } from "./controller.js";

let controller;
if (globalThis.document && globalThis.MutationObserver) {
  controller = createBetterScrapersController({
    document: globalThis.document,
    location: globalThis.location,
    MutationObserver: globalThis.MutationObserver,
    settingsProvider: loadSettings,
  });
  controller.start();
}

export function BetterScrapersSettingsPanel() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => { loadSettings().then(setSettings).catch(reason => setMessage(reason.message)).finally(() => setLoading(false)); }, []);
  function update(field, value) { setSettings(current => normalizeSettings({ ...current, [field]: value })); }
  async function save() { setSaving(true); setMessage(""); try { setSettings(await saveSettings(settings)); setMessage("Settings saved. New batches use these values immediately."); } catch (reason) { setMessage(reason.message); } finally { setSaving(false); } }
  if (loading) return <p>Loading Better Scrapers settings…</p>;
  return <div style={{display:"grid",gap:"1rem",maxWidth:"42rem"}}>
    <div><h3 style={{fontWeight:700,fontSize:"1.05rem"}}>Better Scrapers</h3><p style={{color:"#9ca3af",fontSize:".875rem"}}>Controls the rate-limited Scrape All action in the video tagger. Save All saves ready selections sequentially.</p></div>
    <label style={{display:"grid",gap:".35rem"}}><span style={{fontWeight:600}}># to scrape before pausing for timeout</span><input type="number" min="1" max="100" value={settings.batchSize} onChange={event=>update("batchSize",event.target.value)} style={inputStyle}/><small style={{color:"#9ca3af"}}>This is also the maximum number of simultaneous scraper searches.</small></label>
    <label style={{display:"grid",gap:".35rem"}}><span style={{fontWeight:600}}>Seconds to pause for timeout</span><input type="number" min="0" max="3600" value={settings.pauseSeconds} onChange={event=>update("pauseSeconds",event.target.value)} style={inputStyle}/><small style={{color:"#9ca3af"}}>The pause happens after each completed batch except the last.</small></label>
    <div><button type="button" disabled={saving} onClick={save} style={{background:"#2563eb",color:"white",border:0,borderRadius:".375rem",padding:".55rem .9rem",fontWeight:600,cursor:"pointer"}}>{saving?"Saving…":"Save settings"}</button></div>
    {message && <p role="status" style={{color:message.startsWith("Settings saved")?"#22c55e":"#f87171"}}>{message}</p>}
  </div>;
}

const inputStyle={background:"transparent",border:"1px solid #4b5563",borderRadius:".375rem",padding:".5rem .65rem",color:"inherit",maxWidth:"12rem"};
export default { components: { BetterScrapersSettingsPanel } };
