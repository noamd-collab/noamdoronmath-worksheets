import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
await page.goto('https://www.noamdoronmath.co.il/aboutus',{waitUntil:'networkidle2'});
await new Promise(r=>setTimeout(r,1500));
const info=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const h1=document.querySelector('h1');
  const sec=h1?.closest('section');
  const all=[...sec.querySelectorAll('*')].map(el=>({
    tag:el.tagName.toLowerCase(),
    testid:el.getAttribute('data-testid')||'',
    text:clean(el.textContent).slice(0,100),
    childTags:[...el.children].map(c=>c.tagName.toLowerCase()).slice(0,6),
    ownText:clean([...el.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('')).slice(0,80),
  })).filter(x=>x.text.includes('שמי נועם')||x.text.includes('צרו קשר')||x.tag==='img'||x.tag==='form'||x.tag==='h1'||x.tag==='h2');
  return all.slice(0,30);
});
console.log(JSON.stringify(info,null,2));
await browser.close();
