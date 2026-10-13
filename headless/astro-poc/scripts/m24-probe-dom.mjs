import puppeteer from 'puppeteer-core';
const PROD='https://www.noamdoronmath.co.il';
const slugs=['aboutus','terms','conditionforfreeworksheets','accessibilityadaptation'];
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
for (const slug of slugs) {
  const page=await browser.newPage();
  await page.goto(`${PROD}/${slug}`,{waitUntil:'networkidle2',timeout:90000});
  await new Promise(r=>setTimeout(r,2000));
  const info=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    // Find all text-bearing containers with length
    const candidates=[...document.querySelectorAll('section, article, [data-testid="richTextElement"], [data-testid="inline-content"], .wixui-rich-text, p, h1, h2, h3, iframe')]
      .map(el=>({
        tag: el.tagName.toLowerCase(),
        testid: el.getAttribute('data-testid')||'',
        cls: (el.className||'').toString().slice(0,80),
        text: clean(el.innerText||el.textContent).slice(0,200),
        src: el.getAttribute('src')||'',
        len: clean(el.innerText||el.textContent).length,
      }))
      .filter(x=>x.len>40 || x.tag==='iframe')
      .sort((a,b)=>b.len-a.len)
      .slice(0,25);
    const body=clean(document.body.innerText);
    return { bodyLen: body.length, body: body.slice(0,2500), candidates };
  });
  console.log('\n====', slug, 'bodyLen', info.bodyLen);
  console.log(info.body.slice(0,1500));
  console.log('--- top candidates ---');
  for (const c of info.candidates.slice(0,12)) console.log(c.tag, c.testid||c.cls, 'len='+c.len, c.src?('src='+c.src.slice(0,60)):'', '|', c.text.slice(0,100));
  await page.close();
}
await browser.close();
