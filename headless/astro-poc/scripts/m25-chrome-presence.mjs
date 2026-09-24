import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync, writeFileSync } from 'fs';
const PROD='https://www.noamdoronmath.co.il';
const posts=readdirSync('src/data/blog-posts').filter(f=>f.endsWith('.json')).map(f=>JSON.parse(readFileSync('src/data/blog-posts/'+f,'utf8')));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
const rows=[];
for (const post of posts) {
  const page=await browser.newPage();
  await page.setViewport({width:1280,height:1800});
  await page.goto(PROD+post.path,{waitUntil:'networkidle2',timeout:90000});
  await new Promise(r=>setTimeout(r,1200));
  try{await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/אישור|הבנתי|מסכים/.test(b.textContent||''))?.click());}catch{}
  await page.evaluate(async()=>{ for(let i=0;i<10;i++){ window.scrollBy(0,700); await new Promise(r=>setTimeout(r,150)); }});
  await new Promise(r=>setTimeout(r,800));
  const info=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const text=clean(document.body.innerText);
    const has= (re)=> re.test(text);
    const reading=([...document.querySelectorAll('*')].map(el=>clean(el.textContent)).find(t=>/^זמן קריאה /.test(t) && t.length<30))||null;
    const faqH=[...document.querySelectorAll('h2')].find(h=>clean(h.textContent)==='שאלות נפוצות');
    let faqItems=[];
    if (faqH) {
      let n=faqH.parentElement;
      // collect following h3+p until next h2
      const scope=faqH.closest('section')||faqH.parentElement;
      const kids=[...scope.querySelectorAll('h2,h3,p')];
      let on=false;
      for (const el of kids) {
        const t=clean(el.textContent);
        if (el.tagName==='H2') { if (t==='שאלות נפוצות') { on=true; continue; } if (on) break; }
        if (!on) continue;
        if (el.tagName==='H3') faqItems.push({q:t,a:''});
        else if (el.tagName==='P' && faqItems.length) faqItems[faqItems.length-1].a=t;
      }
    }
    const authorP=[...document.querySelectorAll('p')].map(p=>({t:clean(p.textContent), html:p.innerHTML, about:!!p.querySelector('a[href*="aboutus"]')}))
      .filter(p=>/נכתב ונערך|מורה למתמטיקה/.test(p.t));
    const relatedAfter=[...document.querySelectorAll('a')].filter(a=>{
      const t=clean(a.textContent);
      return /כל דפי|מספרים מכוונים|זוויות|נושאים קשורים/.test(t) || (a.closest('p') && /נושאים קשורים/.test(clean(a.closest('p')?.innerText||'')));
    }).slice(0,6).map(a=>({text:clean(a.textContent),href:a.getAttribute('href')}));
    // Better: find "נושאים קשורים" text block
    const relatedBlock=[...document.querySelectorAll('p,div,section')].map(el=>clean(el.innerText)).find(t=>t.startsWith('נושאים קשורים')||t.includes('נושאים קשורים:'));
    const waH=[...document.querySelectorAll('h2')].some(h=>clean(h.textContent)==='נפגשים גם בוואטסאפ');
    const recent=document.querySelector('[data-hook="recent-posts"]');
    const recentItems=recent?[...recent.querySelectorAll('a.hPl9QB, a[href*="/post/"]')].filter(a=>clean(a.textContent).length>5).map(a=>{
      const card=a.closest('section,article,div')||a;
      const desc=clean(card.querySelector('[data-hook="recent-post__description"], [data-hook="post-description"]')?.textContent||'');
      return {title:clean(a.textContent), href:a.getAttribute('href'), description:desc.slice(0,160)};
    }):[];
    // dedupe recent by href
    const seen=new Set(); const recentDedup=[];
    for (const r of recentItems){ if(seen.has(r.href)) continue; seen.add(r.href); recentDedup.push(r); }

    // category under post (not nav)
    const catLinks=[...document.querySelectorAll('a[href*="/blog/categories/"]')].map(a=>({
      text:clean(a.textContent), href:a.getAttribute('href'),
      y:a.getBoundingClientRect().y,
      nearRecent: !!a.closest('[data-hook="recent-posts"]'),
      inNav: !!a.closest('nav, header'),
    })).filter(c=>!c.inNav && !c.nearRecent && c.text);

    return {
      readingTime: reading,
      hasFaq: !!faqH,
      faqItems,
      authorEditor: authorP[0]||null,
      relatedBlock: relatedBlock?.slice(0,200)||null,
      hasWhatsapp: waH,
      hasRecent: !!recent,
      recentCount: recentDedup.length,
      recent: recentDedup.slice(0,3),
      categories: catLinks.slice(0,4),
      hasAboutLink: [...document.querySelectorAll('a[href*="aboutus"]')].length>0,
    };
  });
  rows.push({fileSlug:post.fileSlug, path:post.path, ...info});
  console.log(post.fileSlug, '| read:', info.readingTime, '| faq', info.hasFaq, info.faqItems.length, '| author', !!info.authorEditor, '| wa', info.hasWhatsapp, '| recent', info.recentCount, '| cats', info.categories.map(c=>c.text).join(','));
  await page.close();
}
await browser.close();
writeFileSync('reports/m25-blog/chrome-presence.json', JSON.stringify(rows,null,2)+'\n');
