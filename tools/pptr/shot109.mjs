import puppeteer from 'puppeteer';
const B='https://vd2gex-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
const b=await puppeteer.launch({args:['--no-sandbox']});
for (const [n,w,h,m] of [['phone',390,844,true],['desk',1366,900,false]]) for (const p of ['/worksheets?grade=9','/grade-9']) {
 const pg=await b.newPage(); await pg.setViewport({width:w,height:h,isMobile:m,deviceScaleFactor:m?2:1});
 await pg.goto(B+p,{waitUntil:'networkidle2',timeout:90000}); await new Promise(r=>setTimeout(r,2500));
 await pg.screenshot({path:`${n}_${p.replace(/\W+/g,'_')}.png`}); await pg.close();}
await b.close();
