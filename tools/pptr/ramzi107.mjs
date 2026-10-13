import puppeteer from 'puppeteer-core';const S=ms=>new Promise(r=>setTimeout(r,ms));
const U='https://noamdoronmath.co.il/worksheet-viewer-noam.html?g=9&x=G9-T15&lv=c&pdf=b134261d88c24d9ba32ff73a6ab5fbfd&pa=c1f3b2b325b24edaaf4a10aaa77f8538&pb=d5c02a99a8e14c2299ffd641a4a3c3d4&pc=b134261d88c24d9ba32ff73a6ab5fbfd&topic=4';
const b=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:'new',args:['--no-sandbox']});
for(const[n,vp]of[['desk',{width:1366,height:900}],['phone',{width:390,height:844,deviceScaleFactor:2,isMobile:true,hasTouch:true}]]){const pg=await b.newPage();await pg.setViewport(vp);const errs=[];pg.on('pageerror',e=>errs.push(e.message));
await pg.goto(U,{waitUntil:'networkidle0',timeout:90000});await S(3000);
const btn=async t=>pg.evaluate(t=>{const e=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith(t)&&b.offsetParent);if(e){e.click();return true}return false},t);
const r={};r.openAi=await pg.evaluate(()=>{const e=document.getElementById('noamAiToggle');if(e){e.click();return true}return false});await S(2000);
r.hint=await btn('רמז');await S(3000);
r.buttons=await pg.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/הבנתי/.test(b.textContent)).map(b=>b.textContent.trim()));
r.no=await btn('לא הבנתי');await S(3000);
r.buttons2=await pg.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.offsetParent&&/הבנתי/.test(b.textContent)).map(b=>b.textContent.trim()));
r.last=await pg.evaluate(()=>document.body.innerText.includes('זה בסדר גמור'));r.errs=errs;
await pg.screenshot({path:`${process.env.OUT_DIR||'./out/'}ramzi-${n}.png`});console.log(n,JSON.stringify(r));await pg.close()}
await b.close();
