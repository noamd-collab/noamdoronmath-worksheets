// Local browser integration only: all network requests are served from local
// files or synthetic fixture responses. No real hints, AI, DB or media upload.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname,join,extname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:http';
import {createHash} from 'node:crypto';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium.ts';
import {prepareMeasuredManifestDraft} from '../scripts/lib/measured-worksheet.mjs';
const here=dirname(fileURLToPath(import.meta.url)),app=resolve(here,'..'),pub=join(app,'public');
const scenario=process.env.NOAM_HINT_SCENARIO||'available';
const rootViewer=process.env.NOAM_ROOT_VIEWER==='1';
const out=resolve(process.argv[2]||join(app,'reports/edition-hints'));mkdirSync(out,{recursive:true});
const fixture=join(here,'fixtures/measured-v1/a05-B'),pdf=readFileSync(join(fixture,'sheet.pdf'));
const draft=JSON.parse(readFileSync(join(fixture,'draft.json'))),pdfId='a'.repeat(32);
const generated=prepareMeasuredManifestDraft(draft,readFileSync(join(fixture,'layout.json')),{pdfId,url:`https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,downloadedSha256:draft.binding.pdfSha256,syntheticTestFixture:true});
// Publication flags are simulated only for this in-memory response, never saved
// as a manifest/proof or added to the production registry.
const manifest={...generated,publishable:true,reviewRequired:false,syntheticTestFixture:false};
const hints=manifest.exercises.map(ex=>({edition_id:manifest.editionId,exercise_id:ex.id,source_pdf_hash:pdfId,source_pdf_sha256:manifest.sourceSha256,canonical_source_sha256:manifest.canonicalSourceSha256,canonical_question_sha256:ex.canonicalQuestionSha256,canonical_item_id:ex.canonicalItemId,source_exercise_sha256:ex.sourceExerciseSha256,hint_1:'זהו רמז סינתטי לבדיקת הקישור. חפשו את הכמויות.',hint_2:'בדקו מה מצטרף.',hint_3:'בצעו את החישוב בעצמכם.',status:'verified'}));
const mime=p=>({'.js':'text/javascript','.html':'text/html; charset=utf-8','.css':'text/css','.json':'application/json','.pdf':'application/pdf','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ttf':'font/ttf'})[extname(p)]||'application/octet-stream';
const server=createServer((req,res)=>{
 const name=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(name==='/noam-learning-config.js'){res.setHeader('Content-Type','text/javascript');res.end('window.NOAM_LEARNING_CONFIG={url:"https://synthetic123.supabase.co",key:"sb_publishable_test"};');return;}
 if(rootViewer&&name==='/root-viewer.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(readFileSync(join(app,'../../worksheet-viewer-noam.html')));return;}
 const p=resolve(pub,'.'+name);if(!p.startsWith(pub+'/')||!existsSync(p)){res.statusCode=404;res.end();return;}
 res.setHeader('Content-Type',mime(p));res.end(readFileSync(p));
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const browser=await puppeteer.launch({executablePath:process.env.CHROME_BIN||resolveTestBrowser(),headless:true});
const result={scope:'Local synthetic browser test, no publication or network services',viewerSha256:createHash('sha256').update(readFileSync(rootViewer?join(app,'../../worksheet-viewer-noam.html'):join(pub,'worksheet-viewer-noam.html'))).digest('hex'),cases:[]};
try{
 for(const viewport of [{width:1280,height:1000},{width:390,height:844}]){
  const page=await browser.newPage();await page.setViewport(viewport);await page.setRequestInterception(true);
  const counts={pdf:0,hints:0,ai:0},errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(['error','warn'].includes(m.type()))console.log(m.type(),m.text());});
  page.on('request',request=>{
   const u=new URL(request.url());
   const reply=(body,contentType='application/json',status=200)=>request.respond({status,body,contentType,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'apikey,content-type','access-control-allow-methods':'GET,OPTIONS'}});
   if(u.pathname.includes('/noam-ai/manifests/'))return reply(JSON.stringify(manifest));
   if(u.hostname==='static.wixstatic.com'&&u.pathname.endsWith(pdfId+'.pdf')){counts.pdf++;return reply(pdf,'application/pdf');}
   if(u.hostname==='synthetic123.supabase.co'&&u.pathname==='/rest/v1/noam_worksheet_edition_hints'){if(request.method()==='OPTIONS')return reply('');counts.hints++;return reply(JSON.stringify(scenario==='missing'?[]:hints),'application/json',scenario==='offline'?503:200);}
   const asset='/npm/pdfjs-dist@3.11.174/';if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes(asset)){const p=join(app,'node_modules/pdfjs-dist',u.pathname.split(asset)[1]);return existsSync(p)?reply(readFileSync(p),mime(p)):request.abort();}
   const mathAsset='/npm/katex@0.18.4/dist/';if(u.hostname==='cdn.jsdelivr.net'&&u.pathname.includes(mathAsset)){const p=join(process.env.NOAM_KATEX_DIST||'/tmp/noam-elementary-browser-tests/node_modules/katex/dist',u.pathname.split(mathAsset)[1]);return existsSync(p)?reply(readFileSync(p),mime(p)):request.abort();}
   if(u.hostname==='127.0.0.1')return request.continue();
   if(u.pathname.includes('/_functions')||u.pathname.includes('recaptcha'))counts.ai++;
   return request.abort();
  });
  const url=`http://127.0.0.1:${server.address().port}/${rootViewer?'root-viewer.html':'worksheet-viewer-noam.html'}?g=1&x=G1-T05&lv=b&pdf=${pdfId}&edition=${manifest.editionId}&t=${encodeURIComponent('חיבור — בדיקה מקומית')}`;
  await page.goto(url,{waitUntil:'domcontentloaded'});
  try { await page.waitForFunction((m,scenario)=>scenario==='available'?window.NoamCuratedHints?.status(m,m.exercises[0].id)==='available':scenario==='missing'?window.NoamCuratedHints?.status(m,m.exercises[0].id)==='missing':!!document.querySelector('.noam-exercise-pin'),{timeout:25000},manifest,scenario); } catch(e) { console.log(JSON.stringify({counts,errors,state:await page.evaluate(m=>({status:window.NoamCuratedHints?.status(m,m.exercises[0].id),hasConfig:!!window.NOAM_LEARNING_CONFIG,body:document.body.innerText.slice(-1500)}),manifest)})); throw e; }
  if(await page.$('#noamAiToggle'))await page.click('#noamAiToggle');
  if(!rootViewer&&await page.evaluate(()=>document.getElementById('panel').classList.contains('hidden'))){await page.click(!rootViewer&&viewport.width<900?'#exactHelpTab':'#fab');}
  if(rootViewer){await page.evaluate(()=>document.querySelector('.noam-exercise-pin').click());await page.waitForFunction(()=>!!document.querySelector('#noamHint,#panelBody [data-exercise-id]'));if(!await page.$('#noamHint'))await page.evaluate(()=>document.querySelector('#panelBody [data-exercise-id]').click());}else{await page.waitForSelector('.exact-q-track button',{visible:true,timeout:10000});await page.click('.exact-q-track button');}
  await page.waitForSelector('#noamHint',{timeout:10000});
  const clicked=await page.evaluate(()=>{const b=[...document.querySelectorAll('#panelBody button')].find(x=>/רמז/.test(x.textContent)&&!x.disabled);if(b){b.click();return b.textContent;}return null;});
  assert.ok(clicked,'prepared hint button');
  await page.waitForSelector('#noamPickedText .katex, #noamPickedText .katex-error',{timeout:10000});
  if(scenario!=='available'){
    await page.waitForSelector('.noam-retry-action',{visible:true,timeout:12000});
    const state=await page.$eval('#panelBody',e=>({body:e.textContent,cta:e.querySelector('.noam-retry-action')?.textContent,freeform:!!e.querySelector('#noamQuestion,#noamSend'),checks:e.querySelectorAll('.ramzi-check').length}));
    assert.equal(state.cta,'חזרה לדף');assert.equal(state.freeform,false);assert.equal(state.checks,0);assert.ok(!state.body.includes('כתבו שאלה נוספת'));assert.equal(counts.ai,0);assert.equal(counts.pdf,1);assert.ok(counts.hints>=1);
    const image=join(out,`edition-${scenario}-${viewport.width}.png`);if(viewport.width>=900)await page.waitForSelector('.pdf-page.is-ready',{timeout:10000});await page.screenshot({path:image,fullPage:false});
    await page.click('.noam-retry-action');assert.equal(counts.ai,0);assert.deepEqual(errors,[]);
    result.cases.push({viewport,scenario,counts,state,image,sha256:createHash('sha256').update(readFileSync(image)).digest('hex'),errors});await page.close();continue;
  }
  await page.waitForFunction(()=>document.getElementById('panelBody')?.textContent.includes('זהו רמז סינתטי לבדיקת הקישור'),{timeout:12000});
  const state=await page.evaluate(()=>({grade:document.body.dataset.grade,body:document.getElementById('panelBody').textContent,keys:Object.keys(sessionStorage).filter(k=>k.includes('threads')||k.includes('analysis')),mathErrors:[...document.querySelectorAll('#noamPickedText .katex-error')].map(n=>n.textContent),freeform:!!document.querySelector('#noamQuestion,#noamSend,#noamDraw,#noamOverview,#noamAttachInput'),overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(state.grade,'1');assert.equal(state.freeform,false);assert.deepEqual(state.mathErrors,[]);assert.equal(state.overflow,false);assert.ok(state.keys.every(k=>k.startsWith('noam-edition-')));assert.equal(counts.pdf,1);assert.equal(counts.hints,1);assert.equal(counts.ai,0);assert.deepEqual(errors,[]);
  const image=join(out,`edition-hint-${viewport.width}.png`);if(viewport.width>=900)await page.waitForSelector('.pdf-page.is-ready',{timeout:10000});await page.screenshot({path:image,fullPage:false});
  if(!rootViewer){
  await page.click('.ramzi-check-no');
  await page.waitForFunction(()=>document.getElementById('panelBody')?.textContent.includes('בדקו מה מצטרף.'),{timeout:10000});
  await page.click('#noamHint');
  await page.waitForFunction(()=>document.getElementById('panelBody')?.textContent.includes('בצעו את החישוב בעצמכם.'),{timeout:10000});
  assert.equal(await page.$eval('#noamHint',b=>b.disabled),true);
  await page.click('.ramzi-check-no');
  await page.waitForFunction(()=>document.getElementById('panelBody')?.textContent.includes('לבקש עזרה מהמורה'),{timeout:10000});
  assert.equal(counts.pdf,1);assert.equal(counts.hints,1);assert.equal(counts.ai,0);assert.deepEqual(errors,[]);
  }
  const ladder=await page.$eval('#panelBody',e=>e.textContent);
  const bubbleGeometry=await page.$$eval('.noam-row.assistant .noam-bubble',els=>els.map(e=>({html:e.outerHTML,width:e.clientWidth,height:e.clientHeight,scrollHeight:e.scrollHeight,scrollWidth:e.scrollWidth,children:[...e.children].map(c=>({tag:c.tagName,class:c.className,width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,rects:[...c.getClientRects()].map(r=>({x:r.x,y:r.y,width:r.width,height:r.height})),whiteSpace:getComputedStyle(c).whiteSpace,display:getComputedStyle(c).display}))})));
  result.cases.push({viewport,counts,state,image,sha256:createHash('sha256').update(readFileSync(image)).digest('hex'),ladder,bubbleGeometry,errors});await page.close();
 }
}finally{await browser.close();await new Promise(r=>server.close(r));writeFileSync(join(out,'browser-result.json'),JSON.stringify(result,null,2)+'\n');}
console.log(JSON.stringify(result.cases.map(c=>({viewport:c.viewport,counts:c.counts,overflow:c.state.overflow})),null,2));
