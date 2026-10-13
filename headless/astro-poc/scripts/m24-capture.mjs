import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const SLUGS = [
  'aboutus',
  'math-tools',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
  'high-school-math',
];

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

mkdirSync('reports/m24-captures', { recursive: true });
mkdirSync('src/data/site-pages', { recursive: true });

function clean(s){ return (s||'').replace(/\s+/g,' ').trim(); }

for (const slug of SLUGS) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${PROD}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise(r => setTimeout(r, 1500));

  const snap = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';
    const canon = document.querySelector('link[rel="canonical"]')?.href || '';

    // Prefer main content; fall back to body
    const root = document.querySelector('main') || document.querySelector('[data-testid="mesh-container-content"]') || document.body;

    // Structured extraction of ordered blocks after first H1
    const h1El = root.querySelector('h1');
    const h1 = clean(h1El?.textContent);
    const blocks = [];
    const all = [...root.querySelectorAll('h1, h2, h3, p, ul, ol, a, form, iframe, img')];
    let pastH1 = false;
    const seen = new Set();

    function push(item) {
      const key = JSON.stringify(item);
      if (seen.has(key)) return;
      seen.add(key);
      blocks.push(item);
    }

    for (const el of all) {
      if (el === h1El) { pastH1 = true; continue; }
      if (!pastH1) continue;
      // Skip nav chrome
      if (el.closest('header, footer, nav, [role="navigation"], .site-nav')) continue;
      const tag = el.tagName.toLowerCase();
      if (tag === 'h2' || tag === 'h3') {
        push({ type: tag, text: clean(el.textContent) });
      } else if (tag === 'p') {
        const t = clean(el.textContent);
        if (t) push({ type: 'p', text: t });
      } else if (tag === 'ul' || tag === 'ol') {
        const items = [...el.querySelectorAll(':scope > li')].map(li => clean(li.textContent)).filter(Boolean);
        if (items.length) push({ type: tag, items });
      } else if (tag === 'a') {
        // only standalone CTAs / notable links with meaningful text that aren't inside p/li already captured
        if (el.closest('p, li, h1, h2, h3')) continue;
        const href = el.getAttribute('href') || '';
        const text = clean(el.textContent);
        if (text && href && text.length > 1) push({ type: 'a', text, href });
      } else if (tag === 'form') {
        const fields = [...el.querySelectorAll('input, textarea, select, button')].map(f => ({
          tag: f.tagName.toLowerCase(),
          type: f.getAttribute('type') || '',
          name: f.getAttribute('name') || '',
          placeholder: f.getAttribute('placeholder') || '',
          ariaLabel: f.getAttribute('aria-label') || '',
          label: clean(f.labels?.[0]?.textContent || ''),
        }));
        push({ type: 'form', fields, action: el.getAttribute('action') || '', method: el.getAttribute('method') || '' });
      } else if (tag === 'iframe') {
        push({ type: 'iframe', src: el.getAttribute('src') || '', title: el.getAttribute('title') || '' });
      } else if (tag === 'img') {
        const src = el.getAttribute('src') || el.getAttribute('data-src') || '';
        const alt = el.getAttribute('alt') || '';
        if (src && !src.includes('data:image/svg')) push({ type: 'img', src, alt });
      }
    }

    // Also grab JSON-LD
    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')].map(s => {
      try { return JSON.parse(s.textContent || ''); } catch { return null; }
    }).filter(Boolean);

    // Intro: first paragraphs before first H2
    const intro = [];
    for (const b of blocks) {
      if (b.type === 'h2' || b.type === 'h3') break;
      if (b.type === 'p') intro.push(b.text);
    }

    return {
      title: document.title || '',
      description: meta('description') || og('og:description'),
      canonical: canon,
      ogTitle: og('og:title'),
      ogDescription: og('og:description'),
      h1,
      intro,
      blocks,
      jsonLd,
      bodyTextSample: clean(document.body.innerText).slice(0, 800),
    };
  });

  // Also get absolute URL for links relative resolution
  snap.liveUrl = page.url();
  snap.slug = slug;

  writeFileSync(`reports/m24-captures/${slug}.json`, JSON.stringify(snap, null, 2) + '\n');
  console.log(slug, '| h1:', snap.h1, '| blocks:', snap.blocks.length, '| title:', snap.title.slice(0,60));
  // print block skim
  for (const b of snap.blocks.slice(0, 30)) {
    if (b.type === 'h2' || b.type === 'h3') console.log(' ', b.type.toUpperCase(), b.text.slice(0,80));
    else if (b.type === 'p') console.log('  p:', b.text.slice(0,80));
    else if (b.type === 'a') console.log('  a:', b.text.slice(0,40), '->', b.href);
    else if (b.type === 'form') console.log('  FORM fields', b.fields.length);
    else if (b.type === 'iframe') console.log('  IFRAME', b.src.slice(0,80));
    else if (b.type === 'ul' || b.type === 'ol') console.log(' ', b.type, b.items.length, 'items');
    else console.log(' ', b.type);
  }
  console.log('---');
  await page.close();
}
await browser.close();
