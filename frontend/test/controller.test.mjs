import test from "node:test";
import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import { chunk, createBetterScrapersController } from "../src/controller.js";

function setup(url="https://cove.local/videos?view=tagger"){
  const dom=new JSDOM(`<!doctype html><html><head></head><body><main><div id="toolbar"><button id="original">Scrape All</button><span>3 videos</span></div><div><div class="border-b" data-testid="tagger-row"><button class="search"><svg class="lucide-search"></svg></button><button class="save">Save</button></div><div class="border-b" data-testid="tagger-row"><button class="search"><svg class="lucide-search"></svg></button></div><div class="border-b" data-testid="tagger-row"><button class="search"><svg class="lucide-search"></svg></button></div></div></main></body></html>`,{url});
  const controller=createBetterScrapersController({document:dom.window.document,location:dom.window.location,MutationObserver:dom.window.MutationObserver,settingsProvider:async()=>({batchSize:2,pauseSeconds:0})});
  return {dom,controller,document:dom.window.document};
}

test("chunk splits work into configured batches",()=>assert.deepEqual(chunk([1,2,3,4,5],2),[[1,2],[3,4],[5]]));
test("injects native-styled, equal-height controls and hides original",()=>{const {controller,document}=setup();controller.start();const scrape=document.querySelector('[data-action="scrape"]'),save=document.querySelector('[data-action="save"]');assert.equal(save.textContent,"Save All");assert.match(scrape.className,/bg-accent/);assert.match(save.className,/bg-green-600/);assert.ok(scrape.classList.contains("py-1"));assert.ok(save.classList.contains("py-1"));assert.ok(!save.classList.contains("py-1.5"));assert.ok(scrape.querySelector("svg.lucide-cloud-download"));assert.ok(save.querySelector("svg.lucide-check"));assert.equal(document.getElementById("original").style.display,"none");controller.stop();});
test("does not attach outside tagger view",()=>{const {controller,document}=setup("https://cove.local/videos?view=grid");controller.start();assert.equal(document.getElementById("better-scrapers-controls"),null);controller.stop();});
test("scrape all waits for a batch before starting the next",async()=>{const {controller,document}=setup();let active=0,maxActive=0;for(const button of document.querySelectorAll(".search")){button.addEventListener("click",()=>{button.disabled=true;active++;maxActive=Math.max(maxActive,active);setTimeout(()=>{active--;button.disabled=false;},10);});}controller.start();document.querySelector('[data-action="scrape"]').click();await waitFor(()=>/Scrape complete/.test(document.querySelector('[role="status"]').textContent));assert.equal(maxActive,2);controller.stop();});
test("save all saves ready selections",async()=>{const {controller,document}=setup();const save=document.querySelector(".save");save.addEventListener("click",()=>setTimeout(()=>{save.closest(".border-b").append("Saved successfully");save.remove();},5));controller.start();document.querySelector('[data-action="save"]').click();await waitFor(()=>/1 saved/.test(document.querySelector('[role="status"]').textContent));controller.stop();});
async function waitFor(predicate){const start=Date.now();while(!predicate()){if(Date.now()-start>2000)throw new Error("test timeout");await new Promise(resolve=>setTimeout(resolve,10));}}
