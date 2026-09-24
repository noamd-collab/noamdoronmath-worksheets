import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

for (const slug of ['math-tools', 'high-school-math', 'accessibilityadaptation', 'aboutus', 'conditionforfreeworksheets', 'terms']) {
  const page = await browser.newPage();
  await page.goto(`${PROD}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1200));
  const richParas = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const sections = [...document.querySelectorAll('section')];
    const contentSections = [];
    let started = false;
    for (const sec of sections) {
      const text = clean(sec.innerText);
      if (!text && !sec.querySelector('iframe')) continue;
      if (sec.querySelector('h1')) { started = true; contentSections.push(sec); continue; }
      if (!started) continue;
      if (/^נפגשים גם בוואטסאפ|^מידע נוסף|^הבהרה/.test(text)) break;
      contentSections.push(sec);
    }
    const top = contentSections.filter((sec) => !contentSections.some((o) => o !== sec && o.contains(sec)));
    const out = [];
    for (const sec of top) {
      for (const p of sec.querySelectorAll('p')) {
        const anchors = [...p.querySelectorAll('a[href]')];
        if (!anchors.length) continue;
        const segments = [];
        const walk = (node) => {
          if (node.nodeType === 3) {
            const t = node.textContent || '';
            if (t) segments.push({ type: 'text', text: t });
            return;
          }
          if (!(node instanceof Element)) return;
          if (node.tagName.toLowerCase() === 'a') {
            segments.push({ type: 'a', text: clean(node.textContent), href: node.getAttribute('href') || '' });
            return;
          }
          for (const c of node.childNodes) walk(c);
        };
        walk(p);
        // normalize whitespace in text segments lightly
        const norm = segments.map((s) => s.type === 'text' ? { ...s, text: s.text.replace(/\s+/g, ' ') } : s)
          .filter((s) => s.type === 'a' || (s.text && s.text.length));
        out.push({ text: clean(p.textContent), segments: norm });
      }
    }
    return out;
  });

  const dataPath = `src/data/site-pages/${slug}.json`;
  const data = JSON.parse(readFileSync(dataPath, 'utf8'));
  let enriched = 0;
  for (const b of data.blocks) {
    if (b.type !== 'p') continue;
    const match = richParas.find((rp) => rp.text === b.text || cleanApprox(rp.text) === cleanApprox(b.text));
    if (match) {
      b.segments = match.segments;
      enriched++;
    }
  }
  function cleanApprox(s){ return (s||'').replace(/\s+/g,' ').trim(); }

  // Also fix standalone orphan CTAs that duplicate segment links — leave as-is
  writeFileSync(dataPath, JSON.stringify(data, null, 2) + '\n');
  console.log(slug, 'rich paras with links', richParas.length, 'enriched blocks', enriched);
  for (const rp of richParas.slice(0, 6)) console.log(' ', rp.text.slice(0, 50), 'segs', rp.segments.length);
  await page.close();
}
await browser.close();
