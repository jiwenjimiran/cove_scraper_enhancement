export const DEFAULT_SETTINGS = Object.freeze({ batchSize: 5, pauseSeconds: 5 });
const SETTINGS_URL = "/api/ext/better-scrapers/settings";
export function normalizeSettings(value = {}) { return { batchSize: clamp(value.batchSize,1,100,5), pauseSeconds: clamp(value.pauseSeconds,0,3600,5) }; }
export async function loadSettings() { return normalizeSettings(await request(SETTINGS_URL)); }
export async function saveSettings(value) { return normalizeSettings(await request(SETTINGS_URL,{method:"PUT",body:JSON.stringify(normalizeSettings(value))})); }
async function request(url, options={}) {
  const token=globalThis.localStorage?.getItem("cove_access_token");
  const response=await fetch(url,{credentials:"same-origin",...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{}) ,...(options.headers||{})}});
  const text=await response.text(); let body; try { body=text?JSON.parse(text):null; } catch { body=text; }
  if(!response.ok) throw new Error(body?.detail||body?.message||body||`Request failed (${response.status}).`); return body;
}
function clamp(value,min,max,fallback){const number=Number(value);return Number.isFinite(number)?Math.min(max,Math.max(min,Math.round(number))):fallback;}
