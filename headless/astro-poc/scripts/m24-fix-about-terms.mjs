import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});

// ABOUTUS structure
{
  const page=await browser.newPage();
  await page.goto('https://www.noamdoronmath.co.il/aboutus',{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,1500));
  const info=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    const secs=[...document.querySelectorAll('section')].map((s,i)=>({
      i,
      hasH1:!!s.querySelector('h1'),
      text:clean(s.innerText).slice(0,250),
      htmlChildren:[...s.children].map(c=>c.tagName+'.'+(c.className||'').toString().slice(0,40)).slice(0,8),
      richTexts:[...s.querySelectorAll('[data-testid="richTextElement"], .wixui-rich-text, p')].map(el=>({tag:el.tagName,text:clean(el.textContent).slice(0,120)})).slice(0,8),
    }));
    return secs.filter(s=>s.hasH1 || /מי אני|צרו קשר|נועם/.test(s.text)).slice(0,5);
  });
  console.log('ABOUT sections', JSON.stringify(info,null,2));
  await page.close();
}

// TERMS iframe
{
  const page=await browser.newPage();
  await page.goto('https://www.noamdoronmath.co.il/terms',{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,2000));
  const iframes=await page.evaluate(()=>[...document.querySelectorAll('iframe')].map(f=>({src:f.src,title:f.title,w:f.width,h:f.height,outer:f.outerHTML.slice(0,300)})));
  console.log('TERMS iframes', iframes);
  // Also check for html component / embed
  const embeds=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    return {
      htmlComps: [...document.querySelectorAll('[data-testid="iframe"], wix-iframe, .wixui-html-component, [id*="comp-"]')].slice(0,10).map(el=>({tag:el.tagName,id:el.id,testid:el.getAttribute('data-testid'),text:clean(el.innerText).slice(0,80),html:el.outerHTML.slice(0,200)})),
      allText: clean(document.querySelector('main')?.innerText || document.body.innerText).slice(0,500),
    };
  });
  console.log('TERMS embeds', JSON.stringify(embeds,null,2));
  if (iframes[0]?.src) {
    const ip=await browser.newPage();
    try {
      const resp=await ip.goto(iframes[0].src,{waitUntil:'domcontentloaded',timeout:60000});
      console.log('iframe status', resp?.status(), 'url', ip.url());
      const t=await ip.evaluate(()=>document.body?.innerText?.slice(0,1500));
      console.log('iframe text', t);
    } catch(e){ console.log('iframe nav err', e.message); }
    await ip.close();
  }
  await page.close();
}
await browser.close();
