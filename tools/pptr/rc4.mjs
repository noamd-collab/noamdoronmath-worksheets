import puppeteer from 'puppeteer-core';
const U='https://xiugyz-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/kite-grade-9';
const LOCAL=process.env.LOCAL_HTML;if(!LOCAL)throw new Error('LOCAL_HTML is required (file URL of the local kite animation)');
const O=(process.env.OUT_DIR||'./out/');const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox','--allow-file-access-from-files']});
const T=[2,10,18,30,45,55,65,78,84];const res={};
const desk={width:1366,height:900},ph={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
// original
for(const [n,vp] of [['desk',desk],['phone',ph]]){const pg=await b.newPage();await pg.setViewport(vp);
 await pg.goto(LOCAL,{waitUntil:'load'});await pg.evaluate(()=>window.noamKitePlayer.playPause());
 for(let i=0;i<40;i++){await S(250);if(await pg.evaluate(()=>!!window.noamKitePlayer.lesson))break}
 const st=await pg.$('#stage');for(const t of T){await pg.evaluate(t=>{window.noamKitePlayer.jump(t);},t);await S(400);await st.screenshot({path:`${O}orig-${n}-${t}.png`})}
 await pg.close()}
// port
const card=pg=>pg.$('[data-loop="kite-construct"]');
for(const [n,vp] of [['desk',desk],['phone',ph]]){const pg=await b.newPage();await pg.setViewport(vp);
 await pg.goto(U,{waitUntil:'networkidle0',timeout:90000});await S(800);
 await pg.screenshot({path:`${O}port-${n}-full.png`,fullPage:true});
 const c=await card(pg);await c.scrollIntoView();await S(500);
 for(const t of [...T,83.6,84.6,86,90,95,97.6,99.6]){await pg.evaluate(t=>{const r=document.querySelector('[data-loop="kite-construct"]');r.__loop.pause();r.__loop.seek(t)},t);await S(250);await c.screenshot({path:`${O}port-${n}-${t}.png`})}
 res[n]=await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');const tg=r.querySelector('.concept-loop__toggle');
  const cut=[...r.querySelectorAll('*')].filter(e=>{const a=e.getBoundingClientRect(),k=r.getBoundingClientRect();return a.width>0&&(a.left<k.left-1||a.right>k.right+1||a.bottom>k.bottom+1||a.top<k.top-1)}).map(e=>e.tagName+'.'+(e.getAttribute('data-ka')||e.getAttribute('data-el')||e.className.baseVal||e.className)).slice(0,10);
  return {state:r.__loop.state(),toggle:tg&&[tg.getBoundingClientRect().width,tg.getAttribute('aria-label'),tg.getAttribute('aria-pressed')],cut,docW:document.documentElement.scrollWidth}});
 // real play: handoff + toggle
 await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');r.__loop.seek(82.5);r.__loop.play()});await S(3500);
 res[n].afterHandoff=await pg.evaluate(()=>document.querySelector('[data-loop="kite-construct"]').__loop.state());
 await c.screenshot({path:`${O}port-${n}-live86.png`});
 await pg.click('[data-loop="kite-construct"] .concept-loop__toggle');await S(300);
 res[n].clicked=await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]'),tg=r.querySelector('.concept-loop__toggle');return [r.__loop.state(),tg.getAttribute('aria-label'),tg.getAttribute('aria-pressed')]});
 // wrap & laps: seek near end, play
 await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');r.__loop.seek(99.5);r.__loop.play()});await S(1500);
 res[n].afterWrap=await pg.evaluate(()=>document.querySelector('[data-loop="kite-construct"]').__loop.state());
 await pg.close()}
for(const [n,vp,o] of [['phone-rm',ph,'rm'],['desk-rm',desk,'rm'],['phone-nojs',ph,'nojs']]){const pg=await b.newPage();await pg.setViewport(vp);
 if(o=='nojs')await pg.setJavaScriptEnabled(false);else await pg.emulateMediaFeatures([{name:'prefers-reduced-motion',value:'reduce'}]);
 await pg.goto(U,{waitUntil:'networkidle0',timeout:90000});const c=await card(pg);await c.scrollIntoView();await S(1200);await c.screenshot({path:`${O}${n}.png`});
 if(o!='nojs')res[n]=await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');return r.__loop&&r.__loop.state()});await pg.close()}
console.log(JSON.stringify(res,null,0));await b.close();
