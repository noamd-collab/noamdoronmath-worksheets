import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
await page.goto('https://www.noamdoronmath.co.il/high-school-math',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,2000));
const info=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const h2s=[...document.querySelectorAll('h2')].map(h=>({text:clean(h.textContent), y:h.getBoundingClientRect().y, visible:h.getBoundingClientRect().height>0 && getComputedStyle(h).display!=='none' && getComputedStyle(h).visibility!=='hidden'}));
  const bagrut=[...document.querySelectorAll('h2')].filter(h=>h.textContent.includes('בגרויות משנים'));
  return {
    h2s,
    bagrutCount: bagrut.length,
    bagrutVisible: bagrut.map(h=>({y:h.getBoundingClientRect().y, display:getComputedStyle(h).display, visibility:getComputedStyle(h).visibility, parentHidden:!!h.closest('[aria-hidden=true], [hidden]')})),
    bodyCount: (document.body.innerText.match(/בגרויות משנים קודמות/g)||[]).length,
  };
});
console.log(JSON.stringify(info,null,2));
await browser.close();
