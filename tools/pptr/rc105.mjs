import puppeteer from 'puppeteer-core';
const U='https://nykfbh-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/kite-grade-9';
const O=(process.env.OUT_DIR||'./out/'); const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const res={};
async function probe(pg){return pg.evaluate(()=>{
 const card=document.querySelector('[data-loop="kite-construct"]');
 const words=[...card.querySelectorAll('.concept-loop__formula [data-fx]')].map(sp=>{
   const out=[];const w=document.createTreeWalker(sp,NodeFilter.SHOW_TEXT);let n;
   while(n=w.nextNode()){const re=/\S+/g;let m;while(m=re.exec(n.data)){const r=document.createRange();r.setStart(n,m.index);r.setEnd(n,m.index+m[0].length);const q=r.getBoundingClientRect();out.push([m[0],Math.round(q.left),Math.round(q.top)]);}}
   return out;});
 const t=card.querySelector('.concept-loop__toggle');const tr=t&&t.getBoundingClientRect();
 const title=card.querySelector('.cl-kite-title');const trr=title.getBoundingClientRect();
 const nw=[...document.querySelectorAll('.topic-math-nowrap')].map(e=>{const rs=e.getClientRects();return [e.textContent,rs.length,Math.round(e.getBoundingClientRect().height)]});
 const vis=[...card.querySelectorAll('[data-el]')].map(e=>e.dataset.el+':'+(+getComputedStyle(e).opacity).toFixed(2)).join(' ');
 return {words,toggle:t&&{w:tr.width,h:tr.height,aria:t.getAttribute('aria-label'),pressed:t.getAttribute('aria-pressed'),disp:getComputedStyle(t).display},titlePx:Math.round(trr.height),nowrap:nw,vis,docW:document.documentElement.scrollWidth};});}
async function run(name,vp,opts={}){
 const pg=await b.newPage(); await pg.setViewport(vp);
 if(opts.nojs) await pg.setJavaScriptEnabled(false);
 if(opts.rm) await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await pg.goto(U,{waitUntil:'networkidle0',timeout:90000}); await S(1500);
 if(opts.full) await pg.screenshot({path:O+name+'-full.png',fullPage:true});
 const card=await pg.$('[data-loop="kite-construct"]'); await card.scrollIntoView(); await S(opts.wait||2500);
 await card.screenshot({path:O+name+'-card.png'});
 if(!opts.nojs){ res[name]=await probe(pg);
  if(opts.pause){ await pg.click('[data-loop="kite-construct"] .concept-loop__toggle'); await S(500);
   res[name].afterClick=(await probe(pg)).toggle; await card.screenshot({path:O+name+'-paused.png'});
   for(let i=0;i<4;i++){} }
  if(opts.frames){ await pg.click('[data-loop="kite-construct"] .concept-loop__toggle'); for(let i=0;i<6;i++){await S(1800);await card.screenshot({path:O+name+`-f${i}.png`});} }
 } else res[name]='nojs';
 await pg.close();}
await run('desk',{width:1366,height:900},{full:true,pause:true});
await run('phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},{full:true,pause:true,frames:true});
await run('phone-rm',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true},{rm:true,wait:800});
await run('desk-rm',{width:1366,height:900},{rm:true,wait:800});
await run('phone-nojs',{width:390,height:844,deviceScaleFactor:2},{nojs:true,wait:300});
// pre-start: right after load before scrolling
{const pg=await b.newPage();await pg.setViewport({width:390,height:844,deviceScaleFactor:2});await pg.goto(U,{waitUntil:'domcontentloaded'});const c=await pg.$('[data-loop="kite-construct"]');await c.screenshot({path:O+'phone-prestart-card.png'});await pg.close();}
// regression: other loop pages
for(const p of ['rhombus-grade-9','trapezoid-grade-9']){const pg=await b.newPage();await pg.setViewport({width:390,height:844,deviceScaleFactor:1});const r=await pg.goto(U.replace('kite-grade-9',p),{waitUntil:'networkidle0',timeout:90000});await S(1500);await pg.screenshot({path:O+'reg-'+p+'.png',fullPage:true});res['reg-'+p]=r.status();await pg.close();}
console.log(JSON.stringify(res,null,1)); await b.close();
