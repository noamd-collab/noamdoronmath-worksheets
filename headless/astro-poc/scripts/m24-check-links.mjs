import puppeteer from 'puppeteer-core';
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome-stable',headless:true,args:['--no-sandbox','--disable-gpu']});
for (const slug of ['math-tools','accessibilityadaptation','high-school-math','aboutus']) {
  const page=await browser.newPage();
  await page.goto('https://www.noamdoronmath.co.il/'+slug,{waitUntil:'networkidle2'});
  await new Promise(r=>setTimeout(r,1200));
  const links=await page.evaluate(()=>{
    const clean=s=>(s||'').replace(/\s+/g,' ').trim();
    // content section links only
    const sections=[...document.querySelectorAll('section')];
    let started=false; const out=[];
    for (const sec of sections) {
      const t=clean(sec.innerText);
      if (sec.querySelector('h1')) {started=true;}
      if (!started) continue;
      if (/^נפגשים גם בוואטסאפ|^מידע נוסף|^הבהרה/.test(t)) break;
      for (const a of sec.querySelectorAll('a[href]')) {
        out.push({text:clean(a.textContent).slice(0,60), href:a.getAttribute('href')});
      }
    }
    return out;
  });
  console.log('\n',slug, links.length);
  for (const l of links.slice(0,30)) console.log(' ', l.text, '->', l.href);
  await page.close();
}
await browser.close();
