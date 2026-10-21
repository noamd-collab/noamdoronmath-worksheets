import puppeteer from 'puppeteer-core';const S=ms=>new Promise(r=>setTimeout(r,ms));const H=process.argv[2],O=(process.env.OUT_DIR||'./out/');
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const res={};
for(const p of ['/grade-9','/worksheets?grade=9'])for(const[n,vp]of[['desk',{width:1366,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){
const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));const r=await pg.goto(H+p,{waitUntil:'networkidle0',timeout:90000});await S(2000);
const tag=n+p.replace(/[\/?=]/g,'_');const o={status:r.status(),errs,docW:await pg.evaluate(()=>document.documentElement.scrollWidth)};
if(p==='/grade-9'){o.section=await pg.evaluate(()=>{const h=[...document.querySelectorAll('h2,h3')].find(e=>e.textContent.includes('מרובעים ומשולשים'));const sec=h.closest('section,div');return [...sec.querySelectorAll('a')].map(a=>a.textContent.trim()+'|'+a.getAttribute('href'))});
 const h=await pg.evaluateHandle(()=>[...document.querySelectorAll('h2,h3')].find(e=>e.textContent.includes('מרובעים ומשולשים')).closest('section,div'));await h.asElement().scrollIntoView();await S(800);await h.asElement().screenshot({path:O+tag+'-quads.png'});
 o.allLinks=await pg.evaluate(()=>[...new Set([...document.querySelectorAll('main a[href^="/"]')].map(a=>a.getAttribute('href')))]);}
else o.g9=await pg.evaluate(()=>{const t=document.body.innerText;return ['דלתון','מקבילית','מלבן','מעוין','ריבוע','טרפז'].map(k=>[k,t.indexOf(k)])});
await pg.screenshot({path:O+tag+'.png',fullPage:p==='/grade-9'});res[tag]=o;await pg.close()}
// link check
const links=res['desk_grade-9'].allLinks;const bad=[];for(const l of links){const r=await fetch(H+l,{redirect:'follow'});if(r.status>=400)bad.push(r.status+' '+l)}res.linkCount=links.length;res.badLinks=bad;
console.log(JSON.stringify(res,(k,v)=>k==='allLinks'?undefined:v,1));await b.close();
