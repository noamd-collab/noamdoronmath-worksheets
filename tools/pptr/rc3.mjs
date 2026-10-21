import puppeteer from 'puppeteer-core';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
const pg=await b.newPage();await pg.setViewport({width:390,height:844,deviceScaleFactor:2,isMobile:true});
await pg.goto('https://mtolhq-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/kite-grade-9',{waitUntil:'networkidle0'});
const c=await pg.$('[data-loop="kite-construct"]');await c.scrollIntoView();
for(let i=0;i<24;i++){await new Promise(r=>setTimeout(r,1000));const v=await pg.evaluate(()=>['refl-lbl','eq-lbl','caption','check'].map(n=>(+getComputedStyle(document.querySelector(`[data-loop="kite-construct"] [data-el="${n}"]`)).opacity).toFixed(1)).join(','));console.log(i+1,v);if(i==13)await c.screenshot({path:(process.env.OUT_DIR||'./out/')});}
await b.close();
