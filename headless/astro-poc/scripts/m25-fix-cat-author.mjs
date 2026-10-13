import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
for (const path of ['/post/annual-review-grade-7','/post/%D7%AA%D7%A8%D7%92%D7%95%D7%9C-%D7%97%D7%A9%D7%99%D7%91%D7%94-%D7%9E%D7%AA%D7%9E%D7%98%D7%99%D7%AA-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%A9%D7%91%D7%95%D7%A0%D7%94-%D7%91%D7%99%D7%98%D7%97%D7%95%D7%9F']) {
  const page=await browser.newPage();
  await page.goto('https://www.noamdoronmath.co.il'+path,{waitUntil:'networkidle2'});
  await page.evaluate(async()=>{for(let i=0;i<10;i++){window.scrollBy(0,700);await new Promise(r=>setTimeout(r,100));}});
  await new Promise(r=>setTimeout(r,500));
  const info=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const recent=document.querySelector('[data-hook="recent-posts"]');
    const wa=[...document.querySelectorAll('h2')].find(h=>clean(h.textContent)==='נפגשים גם בוואטסאפ');
    const cats=[...document.querySelectorAll('a[href*="/blog/categories/"]')].map(a=>{
      const r=a.getBoundingClientRect();
      return {text:clean(a.textContent),href:a.getAttribute('href'),y:r.y,h:r.height,
        inNav:!!a.closest('nav,header,footer'),
        inRecent:!!(recent&&recent.contains(a)),
        inDesc:!!document.querySelector('[data-hook="post-description"]')?.contains(a),
        parentHook:a.closest('[data-hook]')?.getAttribute('data-hook')||'',
        prevH2:clean([...document.querySelectorAll('h2')].filter(h=>h.getBoundingClientRect().y<r.y).pop()?.textContent||'')
      };
    });
    const authors=[...document.querySelectorAll('p')].filter(p=>/נכתב|נערך|מורה למתמטיקה/.test(clean(p.textContent))).map(p=>({
      text:clean(p.textContent), about:!!p.querySelector('a[href*="aboutus"]'), html:p.innerHTML.slice(0,300)
    }));
    return {cats, authors, waY:wa?.getBoundingClientRect().y, recentY:recent?.getBoundingClientRect().y};
  });
  console.log('\n', decodeURIComponent(path).slice(0,50));
  console.log(JSON.stringify(info,null,2));
  await page.close();
}
await browser.close();
