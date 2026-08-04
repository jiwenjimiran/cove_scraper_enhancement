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
    controls.className="flex items-center gap-2 flex-wrap";
    controls.innerHTML=`<button type="button" data-action="scrape" class="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-accent text-white hover:bg-accent-hover disabled:opacity-60"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-cloud-download w-3.5 h-3.5" aria-hidden="true"><path d="M12 13v8l-4-4"></path><path d="m12 21 4-4"></path><path d="M4.393 15.269A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.436 8.284"></path></svg><span data-label>Scrape All</span></button><button type="button" data-action="save" class="flex items-center gap-1.5 px-4 py-1 rounded text-xs font-medium bg-green-600 text-white hover:bg-green-500 disabled:opacity-60 flex-shrink-0"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-check w-3.5 h-3.5" aria-hidden="true"><path d="M20 6 9 17l-5-5"></path></svg><span data-label>Save All</span></button><span role="status" aria-live="polite" class="text-xs text-muted-foreground min-w-36"></span>`;
    controls.querySelector('[data-action="scrape"]').addEventListener("click",()=>runScrapeAll(controls));
    controls.querySelector('[data-action="save"]').addEventListener("click",()=>runSaveAll(controls));
    tagger.toolbar.insertBefore(controls,tagger.original);
  }
  function cleanup(){document.getElementById(CONTROLS_ID)?.remove();for(const button of document.querySelectorAll(`[${ORIGINAL_ATTRIBUTE}]`)){button.style.removeProperty("display");button.removeAttribute(ORIGINAL_ATTRIBUTE);}}
  async function runScrapeAll(controls){
    if(running){cancelled=true;setStatus(controls,"Stopping after current batch…");return;}running=true;cancelled=false;setBusy(controls,true,"scrape");let completed=0,failures=0;
    try{const settings=normalizeSettings(await safeSettings(settingsProvider));const tagger=findVideoTagger(document);const buttons=tagger?findSearchButtons(tagger.list):[];const batches=chunk(buttons,settings.batchSize);
      for(let index=0;index<batches.length&&!cancelled;index++){const batch=batches[index];setStatus(controls,`Scraping ${completed+1}–${completed+batch.length} of ${buttons.length}…`);failures+=(await scrapeBatch(batch,settings,controls)).failures;completed+=batch.length;if(index<batches.length-1&&!cancelled&&settings.pauseSeconds>0){setStatus(controls,`Scraped ${completed} of ${buttons.length}. Pausing ${settings.pauseSeconds}s…`);await delay(settings.pauseSeconds*1000);}}
      setStatus(controls,cancelled?`Stopped after ${completed} of ${buttons.length}.`:`Scrape complete: ${completed-failures} succeeded${failures?`, ${failures} failed`:""}.`);
    }catch(reason){setStatus(controls,`Scrape failed: ${reason?.message||reason}`);}finally{running=false;cancelled=false;setBusy(controls,false);}
  }
  async function scrapeBatch(batch,settings,controls){
    let pending=batch,failures=0,lastBackoff=0;
    while(pending.length&&!cancelled){
      const outcomes=await Promise.allSettled(pending.map(clickAndWaitForSearch));
      const rateLimited=[];
      outcomes.forEach((outcome,index)=>{if(outcome.status!=="rejected")return;if(settings.useBackoff&&isRateLimited(outcome.reason))rateLimited.push(pending[index]);else failures++;});
      if(rateLimited.length===0)break;
      const nextBackoff=lastBackoff===0?Math.min(settings.maximumBackoff,Math.max(1,settings.pauseSeconds*2)):Math.min(settings.maximumBackoff,lastBackoff*2);
      setStatus(controls,`429 received. Retrying ${rateLimited.length} after ${nextBackoff}s backoff…`);
      await delay(nextBackoff*1000);
      lastBackoff=nextBackoff;
      pending=rateLimited;
    }
    return{failures};
  }
  async function runSaveAll(controls){
    if(running)return;running=true;setBusy(controls,true,"save");let saved=0,failures=0;
    try{const tagger=findVideoTagger(document);const buttons=tagger?findExactTextButtons(tagger.list,"Save"):[];for(const button of buttons){setStatus(controls,`Saving ${saved+failures+1} of ${buttons.length}…`);try{await clickAndWaitForSave(button);saved++;}catch{failures++;}}setStatus(controls,buttons.length?`Save complete: ${saved} saved${failures?`, ${failures} failed`:""}.`:"Nothing is ready to save.");}
    finally{running=false;setBusy(controls,false);}
  }
  function clickAndWaitForSearch(button){
    const row=closestRow(button);
    return new Promise((resolve,reject)=>{
      let sawLoading=false,settled=false;
      const finish=(callback,value)=>{if(settled)return;settled=true;clearTimeout(timeout);observer.disconnect();callback(value);};
      const check=()=>{
        const loading=button.disabled||Boolean(button.querySelector(".animate-spin"));
        if(loading)sawLoading=true;
        if(!sawLoading||loading)return;
        const error=row.querySelector(".text-red-400");
        if(error)return finish(reject,new Error(error.textContent.trim()||"Scrape failed"));
        finish(resolve);
      };
      const observer=new MutationObserver(check);
      const timeout=setTimeout(()=>finish(reject,new Error("Timed out waiting for Cove.")),120000);
      observer.observe(row,{attributes:true,childList:true,subtree:true});
      button.click();
      check();
    });
  }
  function clickAndWaitForSave(button){const row=closestRow(button);button.click();return waitUntil(()=>/Saved successfully/i.test(row.textContent)||!button.isConnected,30000);}
  return {start,stop,ensureControls,runScrapeAll,runSaveAll};
}

function findVideoTagger(document){for(const original of findExactTextButtons(document,"Scrape All")){if(original.closest(`#${CONTROLS_ID}`))continue;const toolbar=original.parentElement,root=toolbar?.parentElement;const list=root&&[...root.children].find(child=>child.classList.contains("divide-y")&&child.classList.contains("divide-border"));if(toolbar&&root&&list&&/\d+\s+videos?/i.test(toolbar.textContent))return{original,toolbar,root,list};}return null;}
function findSearchButtons(list){return[...list.children].map(row=>[...row.querySelectorAll("button")].find(button=>!button.disabled&&button.querySelector("svg.lucide-search"))).filter(Boolean);}
function findExactTextButtons(document,text){return[...document.querySelectorAll("button")].filter(button=>button.textContent.trim()===text&&!button.disabled);}
function closestRow(element){const list=element.closest(".divide-y.divide-border");return(list&&[...list.children].find(row=>row.contains(element)))||element.closest("[data-testid='tagger-row']")||element.parentElement;}
export function isRateLimited(reason){return /\b429\b|too many requests/i.test(reason?.message||String(reason||""));}
async function safeSettings(provider){try{return await provider();}catch{return DEFAULT_SETTINGS;}}
function waitUntil(predicate,timeout){return new Promise((resolve,reject)=>{const started=Date.now();const check=()=>{try{if(predicate())return resolve();if(Date.now()-started>=timeout)return reject(new Error("Timed out waiting for Cove."));setTimeout(check,100);}catch(reason){reject(reason);}};check();});}
function setBusy(controls,busy,active){for(const button of controls.querySelectorAll("button"))button.disabled=busy;const selected=active&&controls.querySelector(`[data-action="${active}"]`);if(selected){selected.disabled=false;setButtonLabel(selected,active==="scrape"?"Stop":"Saving…");}if(!busy){setButtonLabel(controls.querySelector('[data-action="scrape"]'),"Scrape All");setButtonLabel(controls.querySelector('[data-action="save"]'),"Save All");}}
function setButtonLabel(button,label){button.querySelector("[data-label]").textContent=label;}
function setStatus(controls,message){controls.querySelector('[role="status"]').textContent=message;}
function sleep(ms){return new Promise(resolve=>setTimeout(resolve,ms));}
function injectStyles(document){if(document.getElementById(STYLE_ID))return;const style=document.createElement("style");style.id=STYLE_ID;style.textContent=`#${CONTROLS_ID}>button{cursor:pointer}#${CONTROLS_ID}>button:disabled{cursor:not-allowed}`;document.head.appendChild(style);}
