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

for (const slug of SLUGS) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  await page.goto(`${PROD}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));

  // Dismiss site disclaimer overlay if present
  try {
    await page.evaluate(() => {
      const btns = [...document.querySelectorAll('button, a, [role="button"]')];
      const b = btns.find((el) => /אישור|הבנתי|מסכים|enter/i.test(el.textContent || ''));
      if (b) b.click();
    });
    await new Promise((r) => setTimeout(r, 500));
  } catch {}

  const snap = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';

    // Exclude chrome: header/nav/footer/whatsapp/disclaimer/cookie
    const isChrome = (el) => {
      if (!el) return true;
      if (el.closest('header, footer, nav, [role="navigation"], [role="banner"], [role="contentinfo"]')) return true;
      const t = clean(el.closest('section')?.innerText || '').slice(0, 40);
      if (/נפגשים גם בוואטסאפ|מידע נוסף|הבהרה|ניווט מהיר|© 20/.test(t) && !el.closest('main')) {
        // soft — handled by section filter below
      }
      return false;
    };

    // Identify primary content sections: those containing h1 or between h1 and whatsapp
    const sections = [...document.querySelectorAll('section.section-container, section')];
    const contentSections = [];
    let started = false;
    for (const sec of sections) {
      const text = clean(sec.innerText);
      if (!text) continue;
      if (sec.querySelector('h1')) { started = true; contentSections.push(sec); continue; }
      if (!started) continue;
      // stop at shared chrome sections
      if (/^נפגשים גם בוואטסאפ/.test(text)) break;
      if (/^מידע נוסף/.test(text)) break;
      if (/^הבהרה/.test(text)) break;
      if (/^ניווט מהיר/.test(text)) break;
      contentSections.push(sec);
    }

    const root = document.createElement('div');
    for (const s of contentSections) root.appendChild(s.cloneNode(true));

    const h1 = clean(root.querySelector('h1')?.textContent);
    const blocks = [];
    const walk = (node) => {
      if (node.nodeType === 3) return;
      if (!(node instanceof Element)) return;
      // skip forms' internals later
      const tag = node.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'noscript'].includes(tag)) return;

      if (tag === 'h1') return; // already captured
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const text = clean(node.textContent);
        if (text) blocks.push({ type: tag, text });
        return;
      }
      if (tag === 'p') {
        const text = clean(node.textContent);
        if (text) blocks.push({ type: 'p', text });
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = [...node.querySelectorAll(':scope > li')].map((li) => {
          const a = li.querySelector('a[href]');
          if (a) {
            return { text: clean(li.textContent), href: a.getAttribute('href') || '', linkText: clean(a.textContent) };
          }
          return { text: clean(li.textContent) };
        }).filter((i) => i.text);
        if (items.length) blocks.push({ type: tag, items });
        return;
      }
      if (tag === 'a') {
        // only if not nested in p/li/heading already handled — check parent walk stopped
        return;
      }
      if (tag === 'iframe') {
        blocks.push({
          type: 'iframe',
          src: node.getAttribute('src') || '',
          title: node.getAttribute('title') || '',
          height: node.getAttribute('height') || '',
          width: node.getAttribute('width') || '',
        });
        return;
      }
      if (tag === 'img') {
        const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
        const alt = node.getAttribute('alt') || '';
        if (src && !src.startsWith('data:image/svg')) blocks.push({ type: 'img', src, alt });
        return;
      }
      if (tag === 'form') {
        const fields = [...node.querySelectorAll('input, textarea, select, button')].map((f) => ({
          tag: f.tagName.toLowerCase(),
          type: f.getAttribute('type') || '',
          name: f.getAttribute('name') || f.getAttribute('id') || '',
          placeholder: f.getAttribute('placeholder') || '',
          ariaLabel: f.getAttribute('aria-label') || '',
          required: f.required || false,
          label: clean(f.labels?.[0]?.textContent || ''),
        }));
        blocks.push({ type: 'form', note: 'wix-form-backend-unavailable', fields });
        return;
      }
      // Standalone CTA buttons rendered as links outside p
      if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'main' || tag === 'span') {
        // Check for direct-child rich CTAs: only recurse
        for (const child of node.children) walk(child);
        // Also pick orphaned direct <a> that are CTAs (not already in list)
        return;
      }
      for (const child of node.children) walk(child);
    };
    walk(root);

    // Capture orphan CTAs (anchors that are significant and not inside captured p/li)
    const capturedHrefs = new Set();
    for (const b of blocks) {
      if (b.type === 'ul' || b.type === 'ol') for (const i of b.items) if (i.href) capturedHrefs.add(i.href);
    }
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.closest('p, li, h1, h2, h3, h4, form')) continue;
      const href = a.getAttribute('href') || '';
      const text = clean(a.textContent);
      if (!text || text.length < 2) continue;
      if (capturedHrefs.has(href) && blocks.some((b) => b.type === 'a' && b.href === href)) continue;
      // skip tiny icon links
      if (/whatsapp|facebook|instagram|twitter/i.test(href) && text.length < 3) continue;
      blocks.push({ type: 'a', text, href });
      capturedHrefs.add(href);
    }

    // Intro paragraphs before first heading
    const intro = [];
    for (const b of blocks) {
      if (b.type === 'h2' || b.type === 'h3' || b.type === 'h4') break;
      if (b.type === 'p') intro.push(b.text);
      if (b.type === 'form' || b.type === 'iframe') break;
    }

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
      .filter(Boolean);

    return {
      title: document.title || '',
      description: meta('description') || og('og:description'),
      ogTitle: og('og:title'),
      ogDescription: og('og:description'),
      canonical: document.querySelector('link[rel="canonical"]')?.href || '',
      h1,
      intro,
      blocks,
      jsonLd,
      sectionCount: contentSections.length,
      bodyMainText: clean(root.innerText).slice(0, 4000),
    };
  });

  // For terms: also fetch iframe HTML text
  if (slug === 'terms') {
    const iframeSrc = snap.blocks.find((b) => b.type === 'iframe')?.src;
    if (iframeSrc) {
      try {
        const abs = new URL(iframeSrc, PROD).href;
        const ip = await browser.newPage();
        await ip.goto(abs, { waitUntil: 'networkidle2', timeout: 60000 });
        await new Promise((r) => setTimeout(r, 1000));
        const iframeContent = await ip.evaluate(() => {
          const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
          const blocks = [];
          for (const el of document.querySelectorAll('h1,h2,h3,h4,p,ul,ol')) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'ul' || tag === 'ol') {
              const items = [...el.querySelectorAll(':scope > li')].map((li) => ({ text: clean(li.textContent) })).filter((i) => i.text);
              if (items.length) blocks.push({ type: tag, items });
            } else {
              const text = clean(el.textContent);
              if (text) blocks.push({ type: tag === 'h1' ? 'h2' : tag, text }); // normalize
            }
          }
          return { title: document.title, blocks, text: clean(document.body.innerText).slice(0, 8000) };
        });
        snap.iframeSrc = iframeSrc;
        snap.iframeContent = iframeContent;
        // Merge: keep intro p, then iframe body blocks (skip duplicate title)
        const merged = snap.blocks.filter((b) => b.type !== 'iframe');
        for (const b of iframeContent.blocks) {
          if (b.type === 'h2' && /תנאי השימוש/.test(b.text) && snap.h1.includes('תנאי')) continue;
          merged.push(b);
        }
        snap.blocks = merged;
        snap.legalSource = 'iframe-html';
        await ip.close();
      } catch (e) {
        snap.iframeError = String(e);
      }
    }
  }

  snap.slug = slug;
  snap.liveUrl = `${PROD}/${slug}`;
  writeFileSync(`reports/m24-captures/${slug}.json`, JSON.stringify(snap, null, 2) + '\n');
  console.log('\n====', slug, 'sections', snap.sectionCount, 'blocks', snap.blocks.length);
  console.log('H1:', snap.h1);
  console.log('title:', snap.title);
  console.log('desc:', (snap.description || '').slice(0, 100));
  for (const b of snap.blocks.slice(0, 40)) {
    if (b.type.startsWith('h')) console.log(' ', b.type.toUpperCase(), b.text.slice(0, 90));
    else if (b.type === 'p') console.log('  p:', b.text.slice(0, 90));
    else if (b.type === 'a') console.log('  a:', b.text.slice(0, 50), '->', b.href.slice(0, 70));
    else if (b.type === 'form') console.log('  FORM', b.fields?.length);
    else if (b.type === 'iframe') console.log('  IFRAME', b.src.slice(0, 90));
    else if (b.type === 'ul' || b.type === 'ol') console.log(' ', b.type, b.items.length, 'items; first:', b.items[0]?.text?.slice(0, 60));
    else if (b.type === 'img') console.log('  img alt=', (b.alt || '').slice(0, 40));
  }
  if (snap.blocks.length > 40) console.log('  ... +', snap.blocks.length - 40, 'more');
  await page.close();
}
await browser.close();
