import puppeteer from 'puppeteer-core';
const H='https://noamdoronmath.co.il';const O=(process.env.OUT_DIR||'./out/');const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const res={};
const desk={width:1366,height:900},ph={width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true};
for(const[n,vp]of[['desk',desk],['phone',ph]]){const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
 const r=await pg.goto(H+'/kite-grade-9?v=105',{waitUntil:'networkidle0',timeout:90000});const c=await pg.$('[data-loop="kite-construct"]');
 if(!c){res[n]={status:r.status(),err:'no card'};continue}
 await c.scrollIntoView();await S(3000);
 const st=()=>pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');return {...r.__loop.state(),title:r.querySelector('[data-el="kite-top"]').textContent,area:getComputedStyle(r.querySelector('[data-el="kite-area"]')).display}});
 const a=await st();await c.screenshot({path:`${O}${n}-area-live.png`});
 await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');r.__loop.seek(83);r.__loop.play()});await S(13500);
 const bld=await st();await c.screenshot({path:`${O}${n}-build-live.png`});
 await pg.evaluate(()=>{const r=document.querySelector('[data-loop="kite-construct"]');r.__loop.seek(99.6);r.__loop.play()});await S(1500);const w=await st();
 res[n]={status:r.status(),startedAuto:a,afterHandoff:bld,wrap:w,docW:await pg.evaluate(()=>document.documentElement.scrollWidth),errs};
 await pg.screenshot({path:`${O}${n}-kite-full.png`,fullPage:true});await pg.close()}
for(const p of ['/','/grade-9','/rhombus-grade-9','/trapezoid-grade-9']) for(const[n,vp]of[['desk',desk],['phone',ph]]){const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));const r=await pg.goto(H+p,{waitUntil:'networkidle0',timeout:90000});await S(1500);
 res[p+'|'+n]={status:r.status(),title:await pg.title(),kiteLinks:await pg.evaluate(()=>[...document.querySelectorAll('a[href*="kite-grade-9"]')].map(a=>a.textContent.trim().slice(0,40))),loops:await pg.evaluate(()=>document.querySelectorAll('[data-loop]').length),docW:await pg.evaluate(()=>document.documentElement.scrollWidth),errs};
 await pg.screenshot({path:`${O}${n}${p.replace(/\//g,'_')}.png`});await pg.close()}
console.log(JSON.stringify(res,null,1));await b.close();
