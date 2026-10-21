import puppeteer from 'puppeteer-core';const S=ms=>new Promise(r=>setTimeout(r,ms));
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});const pg=await b.newPage();await pg.setViewport({width:1366,height:900});
pg.on('response',async r=>{if(r.url().includes('/api/noamSiteCompanion')&&r.request().method()==='POST'){try{const j=await r.json();console.log(r.status(),j.code,j.source,(j.siteverify&&JSON.stringify(j.siteverify))||'')}catch(e){}}});
await pg.goto('https://noamdoronmath.co.il/kite-grade-9',{waitUntil:'networkidle0'});await S(2000);await pg.click('#noam-site-companion-launch');await S(1000);await pg.type('#noam-site-companion-input','יש מרובעים?');await pg.keyboard.press('Enter');await S(8000);await b.close();
