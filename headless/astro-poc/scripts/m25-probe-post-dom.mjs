import puppeteer from 'puppeteer-core';
const PROD='https://www.noamdoronmath.co.il';
const samples=[
  '/post/annual-review-grade-7',
  '/post/%D7%90%D7%99%D7%9A-%D7%9C%D7%AA%D7%A8%D7%92%D7%9C-%D7%92%D7%90%D7%95%D7%9E%D7%98%D7%A8%D7%99%D7%94-%D7%9C%D7%9B%D7%99%D7%AA%D7%94-%D7%95-%D7%95%D7%9C%D7%94%D7%A6%D7%9C%D7%99%D7%97-%D7%91%D7%9E%D7%91%D7%97%D7%A0%D7%99%D7%9D',
  '/post/%D7%9E%D7%93%D7%A8%D7%99%D7%9A-%D7%9C%D7%A7%D7%A8%D7%99%D7%90%D7%AA-%D7%92%D7%A8%D7%A4%D7%99%D7%9D-%D7%9C%D7%99%D7%9C%D7%93%D7%99%D7%9D-%D7%91%D7%A6%D7%95%D7%A8%D7%94-%D7%A4%D7%A9%D7%95%D7%98%D7%94',
];
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
for (const path of samples) {
  const page=await browser.newPage();
  await page.goto(PROD+path,{waitUntil:'networkidle2',timeout:90000});
  await new Promise(r=>setTimeout(r,1200));
  try{await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/אישור|הבנתי|מסכים/.test(b.textContent||''))?.click());}catch{}
  await new Promise(r=>setTimeout(r,400));
  const info=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    // Find richest content root
    const candidates=[
      '[data-hook="post-description"]',
      '[data-hook="post-content"]',
      '[data-testid="richTextElement"]',
      'article',
      '[data-hook="post"]',
      'main',
    ];
    const found=candidates.map(sel=>{
      const el=document.querySelector(sel);
      return el?{sel,len:clean(el.innerText).length,childTags:[...el.children].map(c=>c.tagName).slice(0,12)}:null;
    }).filter(Boolean);
    // Walk article-like content for block order
    const root=document.querySelector('[data-hook="post-description"]')
      || document.querySelector('[data-hook="post-content"]')
      || document.querySelector('article')
      || document.querySelector('main');
    const blocks=[];
    const walk=(node)=>{
      if(!(node instanceof Element)) return;
      const tag=node.tagName.toLowerCase();
      if(['script','style','svg','noscript'].includes(tag)) return;
      if(['h1','h2','h3','h4','p','blockquote'].includes(tag)) {
        const text=clean(node.textContent);
        if(text) blocks.push({type:tag,text:text.slice(0,100), fullLen:text.length});
        return;
      }
      if(tag==='ul'||tag==='ol'){
        const items=[...node.querySelectorAll(':scope > li')].map(li=>clean(li.textContent)).filter(Boolean);
        blocks.push({type:tag,items:items.length,first:items[0]?.slice(0,60)});
        return;
      }
      if(tag==='img'){
        blocks.push({type:'img',src:(node.getAttribute('src')||'').slice(0,80),alt:node.getAttribute('alt')||''});
        return;
      }
      if(tag==='figure'){
        const img=node.querySelector('img');
        const cap=clean(node.querySelector('figcaption')?.textContent||'');
        blocks.push({type:'figure',src:(img?.getAttribute('src')||'').slice(0,80),alt:img?.getAttribute('alt')||'',caption:cap.slice(0,80)});
        return;
      }
      if(tag==='table'){
        blocks.push({type:'table',rows:node.querySelectorAll('tr').length});
        return;
      }
      if(tag==='a' && !node.closest('p,li,h1,h2,h3,h4')){
        const text=clean(node.textContent); const href=node.getAttribute('href')||'';
        if(text&&href) blocks.push({type:'a',text:text.slice(0,50),href:href.slice(0,80)});
        return;
      }
      // rich text without p
      if(node.getAttribute('data-testid')==='richTextElement'){
        const has=[...node.children].some(c=>['P','H1','H2','H3','H4','UL','OL'].includes(c.tagName));
        if(!has){ const t=clean(node.textContent); if(t) blocks.push({type:'p',text:t.slice(0,100)}); return; }
      }
      for(const c of node.children) walk(c);
    };
    walk(root);

    const meta={
      title:document.title,
      h1:clean(document.querySelector('h1')?.textContent),
      date:clean(document.querySelector('time')?.getAttribute('datetime')||document.querySelector('time')?.textContent||document.querySelector('[data-hook="time-ago"]')?.textContent||''),
      author:clean(document.querySelector('[data-hook="user-name"],[data-hook="author-name"]')?.textContent||''),
      cover:document.querySelector('[data-hook="post-cover"], [data-hook="cover-image"] img, article img')?.getAttribute('src')||'',
    };
    const related=[...document.querySelectorAll('[data-hook*="related"] a, [class*="related"] a')].map(a=>({text:clean(a.textContent),href:a.getAttribute('href')})).slice(0,6);
    const jsonLd=[...document.querySelectorAll('script[type="application/ld+json"]')].map(s=>{try{return JSON.parse(s.textContent||'')}catch{return null}}).filter(Boolean);
    return {found, blockCount:blocks.length, blocks:blocks.slice(0,40), meta, related, jsonLdTypes: jsonLd.map(j=>j['@type']||(j['@graph']||[]).map(x=>x['@type']))};
  });
  console.log('\n====', decodeURIComponent(path).slice(0,60));
  console.log('meta', info.meta);
  console.log('roots', info.found);
  console.log('blocks', info.blockCount);
  for(const b of info.blocks) console.log(' ', b.type, b.text||b.first||b.alt||'', b.src?b.src.slice(0,50):'', b.items!=null?'n='+b.items:'');
  console.log('related', info.related);
  console.log('jsonLd', JSON.stringify(info.jsonLdTypes));
  await page.close();
}
await browser.close();
