import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
const PROD='https://www.noamdoronmath.co.il';
const files=readdirSync('src/data/blog-posts').filter(f=>f.endsWith('.json'));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
for (const file of files) {
  const path=`src/data/blog-posts/${file}`;
  const data=JSON.parse(readFileSync(path,'utf8'));
  const page=await browser.newPage();
  await page.goto(PROD+data.path,{waitUntil:'networkidle2',timeout:90000});
  await page.evaluate(async()=>{for(let i=0;i<12;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,100));}});
  await new Promise(r=>setTimeout(r,600));
  const cat=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const wa=[...document.querySelectorAll('h2')].find(h=>clean(h.textContent)==='נפגשים גם בוואטסאפ');
    const recent=document.querySelector('[data-hook="recent-posts"]');
    const waY=wa?.getBoundingClientRect().bottom ?? 0;
    const recentY=recent?.getBoundingClientRect().y ?? 1e9;
    const cands=[...document.querySelectorAll('a[href*="/blog/categories/"]')]
      .map(a=>({text:clean(a.textContent),href:a.getAttribute('href')||'',y:a.getBoundingClientRect().y,h:a.getBoundingClientRect().height}))
      .filter(c=>c.h>0 && c.y>waY-20 && c.y<recentY && c.text.length>0 && c.text.length<=40);
    // prefer unique non-duplicate nav labels appearing once in this band
    return cands.sort((a,b)=>a.y-b.y)[0]||null;
  });
  data.postCategory=cat||undefined;
  writeFileSync(path, JSON.stringify(data,null,2)+'\n');
  console.log(data.fileSlug, 'cat', cat);
  await page.close();
}
await browser.close();
