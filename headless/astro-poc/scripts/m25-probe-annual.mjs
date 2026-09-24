import puppeteer from 'puppeteer-core';
const PROD='https://www.noamdoronmath.co.il/post/annual-review-grade-7';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
const page=await browser.newPage();
await page.setViewport({width:1280,height:2000});
await page.goto(PROD,{waitUntil:'networkidle2',timeout:90000});
await new Promise(r=>setTimeout(r,2000));
try{await page.evaluate(()=>[...document.querySelectorAll('button')].find(b=>/אישור|הבנתי|מסכים/.test(b.textContent||''))?.click());}catch{}
await new Promise(r=>setTimeout(r,500));

// scroll to load lazy
await page.evaluate(async()=>{ for(let i=0;i<8;i++){ window.scrollBy(0,600); await new Promise(r=>setTimeout(r,200)); }});
await new Promise(r=>setTimeout(r,1000));

const info=await page.evaluate(()=>{
  const clean=s=>(s||'').replace(/\s+/g,' ').trim();
  const body=clean(document.body.innerText);
  const markers=[
    'זמן קריאה','עורך','אודות','שאלות נפוצות','נפגשים גם בוואטסאפ','פוסטים אחרונים','פוסטים קשורים','קטגור','FAQ','בדקו','הצטרפו לקבוצת'
  ];
  const found={};
  for (const m of markers) found[m]=body.includes(m);

  // Find sections by heading text
  const headings=[...document.querySelectorAll('h1,h2,h3,h4')].map(h=>({
    tag:h.tagName, text:clean(h.textContent), y:h.getBoundingClientRect().y,
    visible:h.getBoundingClientRect().height>0
  }));

  // Search for FAQ-like Q&A: elements with ? in heading after description
  const desc=document.querySelector('[data-hook="post-description"]');
  const descBottom=desc?.getBoundingClientRect().bottom||0;
  const below=[...document.querySelectorAll('h2,h3,p,a,img,section,aside')].filter(el=>{
    const r=el.getBoundingClientRect();
    return r.top>descBottom-10 && r.height>0 && clean(el.textContent).length>0;
  }).slice(0,80).map(el=>({
    tag:el.tagName.toLowerCase(),
    hook:el.getAttribute('data-hook')||'',
    cls:(el.className||'').toString().slice(0,50),
    text:clean(el.textContent).slice(0,140),
    y:Math.round(el.getBoundingClientRect().y),
  }));

  // specifically aboutus links
  const about=[...document.querySelectorAll('a[href*="aboutus"]')].map(a=>({
    text:clean(a.textContent),
    href:a.getAttribute('href'),
    parent:clean(a.parentElement?.innerText||'').slice(0,200),
    y:Math.round(a.getBoundingClientRect().y),
  }));

  // questions with ?
  const questions=[...document.querySelectorAll('h2,h3,h4,button,summary,[role="button"]')]
    .map(el=>({tag:el.tagName,text:clean(el.textContent),y:Math.round(el.getBoundingClientRect().y)}))
    .filter(x=>x.text.includes('?')||x.text.includes('؟'));

  // recent post cards
  const postLinks=[...document.querySelectorAll('a[href*="/post/"]')].map(a=>{
    const card=a.closest('[data-hook]')||a.parentElement;
    return {
      text:clean(a.textContent).slice(0,60),
      href:a.getAttribute('href'),
      hook:a.closest('[data-hook]')?.getAttribute('data-hook')||'',
      card:clean(card?.innerText||'').slice(0,180),
      y:Math.round(a.getBoundingClientRect().y),
      inDesc:!!(desc&&desc.contains(a)),
    };
  }).filter(x=>!x.inDesc && x.text);

  return {found, headings, about, questions, postLinks:postLinks.slice(0,15), below:below.slice(0,40),
    bodyAroundFaq: (()=>{
      const i=body.indexOf('שאלות');
      return i>=0?body.slice(i,i+500): body.includes('?')? 'has ?' : 'no';
    })(),
  };
});
console.log(JSON.stringify(info,null,2));
await browser.close();
