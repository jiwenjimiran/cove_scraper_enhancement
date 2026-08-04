import { DEFAULT_SETTINGS, normalizeSettings } from "./api.js";
const CONTROLS_ID="better-scrapers-controls", STYLE_ID="better-scrapers-styles", ORIGINAL_ATTRIBUTE="data-better-scrapers-original";

export function chunk(items,size){const groups=[];for(let i=0;i<items.length;i+=size)groups.push(items.slice(i,i+size));return groups;}

export function createBetterScrapersController({document,location,MutationObserver,settingsProvider,delay=sleep}){
  let observer,scheduled=false,running=false,cancelled=false;
  function start(){injectStyles(document);observer=new MutationObserver(schedule);observer.observe(document.documentElement,{childList:true,subtree:true});ensureControls();}
  function stop(){cancelled=true;observer?.disconnect();cleanup();document.getElementById(STYLE_ID)?.remove();}
  function schedule(){if(scheduled)return;scheduled=true;queueMicrotask(()=>{scheduled=false;ensureControls();});}
  function ensureControls(){
    if(new URLSearchParams(location.search).get("view")!=="tagger")return cleanup();
    const tagger=findVideoTagger(document);if(!tagger)return cleanup();if(tagger.toolbar.querySelector(`#${CONTROLS_ID}`))return;
    cleanup();tagger.original.setAttribute(ORIGINAL_ATTRIBUTE,"true");tagger.original.style.display="none";
    const controls=document.createElement("div");controls.id=CONTROLS_ID;
    controls.innerHTML='<button type="button" data-action="scrape">Scrape All</button><button type="button" data-action="save">Save All</button><span role="status" aria-live="polite"></span>';
    controls.querySelector('[data-action="scrape"]').addEventListener("click",()=>runScrapeAll(controls));
    controls.querySelector('[data-action="save"]').addEventListener("click",()=>runSaveAll(controls));
    tagger.toolbar.insertBefore(controls,tagger.original);
  }
  function cleanup(){document.getElementById(CONTROLS_ID)?.remove();for(const button of document.querySelectorAll(`[${ORIGINAL_ATTRIBUTE}]`)){button.style.removeProperty("display");button.removeAttribute(ORIGINAL_ATTRIBUTE);}}
  async function runScrapeAll(controls){
    if(running){cancelled=true;setStatus(controls,"Stopping after current batch…");return;}running=true;cancelled=false;setBusy(controls,true,"scrape");let completed=0,failures=0;
    try{const settings=normalizeSettings(await safeSettings(settingsProvider));const buttons=findSearchButtons(document);const batches=chunk(buttons,settings.batchSize);
      for(let index=0;index<batches.length&&!cancelled;index++){const batch=batches[index];setStatus(controls,`Scraping ${completed+1}–${completed+batch.length} of ${buttons.length}…`);const outcomes=await Promise.allSettled(batch.map(clickAndWaitForSearch));completed+=batch.length;failures+=outcomes.filter(x=>x.status==="rejected").length;if(index<batches.length-1&&!cancelled&&settings.pauseSeconds>0){setStatus(controls,`Scraped ${completed} of ${buttons.length}. Pausing ${settings.pauseSeconds}s…`);await delay(settings.pauseSeconds*1000);}}
      setStatus(controls,cancelled?`Stopped after ${completed} of ${buttons.length}.`:`Scrape complete: ${completed-failures} succeeded${failures?`, ${failures} failed`:""}.`);
    }catch(reason){setStatus(controls,`Scrape failed: ${reason?.message||reason}`);}finally{running=false;cancelled=false;setBusy(controls,false);}
  }
  async function runSaveAll(controls){
    if(running)return;running=true;setBusy(controls,true,"save");let saved=0,failures=0;
    try{const buttons=findExactTextButtons(document,"Save");for(const button of buttons){setStatus(controls,`Saving ${saved+failures+1} of ${buttons.length}…`);try{await clickAndWaitForSave(button);saved++;}catch{failures++;}}setStatus(controls,buttons.length?`Save complete: ${saved} saved${failures?`, ${failures} failed`:""}.`:"Nothing is ready to save.");}
    finally{running=false;setBusy(controls,false);}
  }
  function clickAndWaitForSearch(button){const row=closestRow(button);button.click();return waitUntil(()=>{if(row.querySelector(".text-red-400"))throw new Error("Scrape failed");return !button.disabled;},120000);}
  function clickAndWaitForSave(button){const row=closestRow(button);button.click();return waitUntil(()=>/Saved successfully/i.test(row.textContent)||!button.isConnected,30000);}
  return {start,stop,ensureControls,runScrapeAll,runSaveAll};
}

function findVideoTagger(document){for(const original of findExactTextButtons(document,"Scrape All")){if(original.closest(`#${CONTROLS_ID}`))continue;const toolbar=original.parentElement,root=toolbar?.parentElement;if(toolbar&&root&&/\d+\s+videos?/i.test(toolbar.textContent)&&root.querySelector("button svg.lucide-search"))return{original,toolbar};}return null;}
function findSearchButtons(document){return[...document.querySelectorAll("button")].filter(button=>!button.disabled&&button.querySelector("svg.lucide-search"));}
function findExactTextButtons(document,text){return[...document.querySelectorAll("button")].filter(button=>button.textContent.trim()===text&&!button.disabled);}
function closestRow(element){return element.closest(".border-b, [data-testid='tagger-row']")||element.parentElement?.parentElement||element.parentElement;}
async function safeSettings(provider){try{return await provider();}catch{return DEFAULT_SETTINGS;}}
function waitUntil(predicate,timeout){return new Promise((resolve,reject)=>{const started=Date.now();const check=()=>{try{if(predicate())return resolve();if(Date.now()-started>=timeout)return reject(new Error("Timed out waiting for Cove."));setTimeout(check,100);}catch(reason){reject(reason);}};check();});}
function setBusy(controls,busy,active){for(const button of controls.querySelectorAll("button"))button.disabled=busy;const selected=active&&controls.querySelector(`[data-action="${active}"]`);if(selected){selected.disabled=false;selected.textContent=active==="scrape"?"Stop":"Saving…";}if(!busy){controls.querySelector('[data-action="scrape"]').textContent="Scrape All";controls.querySelector('[data-action="save"]').textContent="Save All";}}
function setStatus(controls,message){controls.querySelector('[role="status"]').textContent=message;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function injectStyles(document){if(document.getElementById(STYLE_ID))return;const style=document.createElement("style");style.id=STYLE_ID;style.textContent=`#${CONTROLS_ID}{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}#${CONTROLS_ID} button{border:0;border-radius:.375rem;padding:.5rem .75rem;font-weight:600;color:#fff;background:#2563eb;cursor:pointer}#${CONTROLS_ID} button[data-action=save]{background:#16a34a}#${CONTROLS_ID} button:disabled{cursor:not-allowed;opacity:.55}#${CONTROLS_ID} [role=status]{font-size:.75rem;color:#9ca3af;min-width:9rem}`;document.head.appendChild(style);}
