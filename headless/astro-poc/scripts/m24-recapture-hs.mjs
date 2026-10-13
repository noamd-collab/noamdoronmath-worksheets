import puppeteer from 'puppeteer-core';
import { writeFileSync, readFileSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

async function extract(slug) {
  const page = await browser.newPage();
  await page.goto(`${PROD}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')].find((el) => /אישור|הבנתי|מסכים/.test(el.textContent || ''))?.click();
    });
    await new Promise((r) => setTimeout(r, 400));
  } catch {}

  const snap = await page.evaluate(() => {
    const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
    const meta = (name) => document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') || '';
    const og = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';

    const sections = [...document.querySelectorAll('section')];
    const contentSections = [];
    let started = false;
    for (const sec of sections) {
      const text = clean(sec.innerText);
      if (!text && !sec.querySelector('iframe')) continue;
      if (sec.querySelector('h1')) { started = true; contentSections.push(sec); continue; }
      if (!started) continue;
      if (/^נפגשים גם בוואטסאפ/.test(text)) break;
      if (/^מידע נוסף/.test(text)) break;
      if (/^הבהרה/.test(text)) break;
      contentSections.push(sec);
    }
    // Deduplicate nested sections: keep only sections not contained in another selected section
    const topLevel = contentSections.filter(
      (sec) => !contentSections.some((other) => other !== sec && other.contains(sec))
    );

    const root = document.createElement('div');
    for (const s of topLevel) root.appendChild(s.cloneNode(true));

    const h1 = clean(root.querySelector('h1')?.textContent);
    const blocks = [];
    const push = (b) => blocks.push(b);

    const walk = (node) => {
      if (!(node instanceof Element)) return;
      const tag = node.tagName.toLowerCase();
      if (['script', 'style', 'svg', 'noscript'].includes(tag)) return;
      if (tag === 'h1') return;
      if (tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const text = clean(node.textContent);
        if (text) push({ type: tag, text });
        return;
      }
      if (tag === 'p') {
        const text = clean(node.textContent);
        if (text) push({ type: 'p', text });
        return;
      }
      if (tag === 'ul' || tag === 'ol') {
        const items = [...node.querySelectorAll(':scope > li')].map((li) => {
          const a = li.querySelector('a[href]');
          if (a) return { text: clean(li.textContent), href: a.getAttribute('href') || '', linkText: clean(a.textContent) };
          return { text: clean(li.textContent) };
        }).filter((i) => i.text);
        if (items.length) push({ type: tag, items });
        return;
      }
      if (tag === 'iframe') {
        push({ type: 'iframe', src: node.getAttribute('src') || '', title: node.getAttribute('title') || '' });
        return;
      }
      if (tag === 'img') {
        const src = node.getAttribute('src') || node.getAttribute('data-src') || '';
        const alt = node.getAttribute('alt') || '';
        if (src && !src.startsWith('data:image/svg')) push({ type: 'img', src, alt });
        return;
      }
      if (tag === 'form') {
        const fields = [...node.querySelectorAll('input, textarea, select, button')].map((f) => ({
          tag: f.tagName.toLowerCase(),
          type: f.getAttribute('type') || '',
          name: f.getAttribute('name') || '',
          placeholder: f.getAttribute('placeholder') || '',
          label: clean(f.labels?.[0]?.textContent || f.getAttribute('aria-label') || ''),
          required: !!f.required,
        }));
        push({ type: 'form', note: 'wix-form-backend-unavailable', fields });
        return;
      }
      if (node.getAttribute('data-testid') === 'richTextElement') {
        const hasBlockChild = !!node.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > ul, :scope > ol');
        if (!hasBlockChild) {
          const text = clean(node.textContent);
          if (text && text.length > 2) push({ type: 'p', text });
          return;
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(root);

    for (const iframe of root.querySelectorAll('iframe')) {
      const src = iframe.getAttribute('src') || '';
      if (!src) continue;
      if (!blocks.some((b) => b.type === 'iframe' && b.src === src)) {
        push({ type: 'iframe', src, title: iframe.getAttribute('title') || '' });
      }
    }

    for (const a of root.querySelectorAll('a[href]')) {
      if (a.closest('p, li, h1, h2, h3, h4, form, ul, ol')) continue;
      const href = a.getAttribute('href') || '';
      const text = clean(a.textContent);
      if (!text || text.length < 2) continue;
      if (blocks.some((b) => b.type === 'a' && b.href === href && b.text === text)) continue;
      push({ type: 'a', text, href });
    }

    // Drop near-duplicate block runs: if an h2 text repeats, drop from second occurrence to end of that mirror
    const seenH2 = new Set();
    const deduped = [];
    let skippingDup = false;
    let skipUntilDepth = null;
    for (const b of blocks) {
      if (b.type === 'h2') {
        if (seenH2.has(b.text)) {
          // skip this duplicate section until next unique h2 or end
          skippingDup = true;
          continue;
        }
        seenH2.add(b.text);
        skippingDup = false;
      }
      if (skippingDup) continue;
      deduped.push(b);
    }

    const intro = [];
    for (const b of deduped) {
      if (['h2', 'h3', 'h4', 'form', 'iframe'].includes(b.type)) break;
      if (b.type === 'p') intro.push(b.text);
    }

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
      .filter(Boolean);

    return {
      title: document.title || '',
      description: meta('description') || og('og:description'),
      h1,
      intro,
      blocks: deduped,
      jsonLd,
      topLevelCount: topLevel.length,
      rawBlockCount: blocks.length,
      mainText: clean(root.innerText).slice(0, 6000),
    };
  });

  // terms iframe
  if (slug === 'terms') {
    const iframeBlock = snap.blocks.find((b) => b.type === 'iframe');
    if (iframeBlock?.src) {
      const ip = await browser.newPage();
      await ip.goto(iframeBlock.src, { waitUntil: 'domcontentloaded', timeout: 60000 });
      await new Promise((r) => setTimeout(r, 800));
      const iframeData = await ip.evaluate(() => {
        const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
        const blocks = [];
        const els = [...document.querySelectorAll('h1,h2,h3,h4,p,ul,ol')];
        if (els.length >= 3) {
          for (const el of els) {
            const tag = el.tagName.toLowerCase();
            if (tag === 'ul' || tag === 'ol') {
              const items = [...el.querySelectorAll(':scope > li')].map((li) => ({ text: clean(li.textContent) })).filter((i) => i.text);
              if (items.length) blocks.push({ type: tag, items });
            } else {
              const text = clean(el.textContent);
              if (!text) continue;
              blocks.push({ type: tag === 'h1' ? 'h2' : tag, text });
            }
          }
        } else {
          const raw = (document.body.innerText || '').replace(/\r/g, '');
          for (const p of raw.split(/\n\s*\n/).map((x) => clean(x.replace(/\n/g, ' '))).filter(Boolean)) {
            if (/^תנאי השימוש/.test(p) && p.length < 40) continue;
            if (/^\d+\.\s/.test(p) && p.length < 60) blocks.push({ type: 'h3', text: p });
            else blocks.push({ type: 'p', text: p });
          }
        }
        return { blocks, fullText: clean(document.body.innerText) };
      });
      snap.legalIframeSrc = iframeBlock.src;
      snap.legalBlocks = iframeData.blocks;
      snap.legalFullText = iframeData.fullText;
      await ip.close();
    }
  }

  snap.slug = slug;
  snap.liveUrl = `${PROD}/${slug}`;
  await page.close();
  return snap;
}

const SLUGS = ['aboutus','math-tools','accessibilityadaptation','terms','conditionforfreeworksheets','high-school-math'];
for (const slug of SLUGS) {
  const snap = await extract(slug);
  writeFileSync(`reports/m24-captures/${slug}.json`, JSON.stringify(snap, null, 2) + '\n');

  const blocks = [];
  let formSkipped = false;
  for (const b of snap.blocks) {
    if (b.type === 'form') {
      formSkipped = true;
      blocks.push({
        type: 'contact',
        note: 'wix-form-backend-unavailable',
        mailto: 'mailto:noamd@noamdoronmath.co.il',
        mailtoLabel: 'פנו אליי בדוא״ל: noamd@noamdoronmath.co.il',
        fieldsShownAsLabels: b.fields.filter((f) => f.tag !== 'button').map((f) => f.label || f.placeholder || f.name).filter(Boolean),
      });
    } else blocks.push(b);
  }

  const content = {
    slug: snap.slug,
    title: snap.title,
    description: snap.description,
    h1: snap.h1,
    intro: snap.intro,
    blocks,
    jsonLd: snap.jsonLd?.length ? snap.jsonLd : undefined,
    legalIframeSrc: snap.legalIframeSrc || undefined,
    legalBlocks: snap.legalBlocks || undefined,
    formSkipped: formSkipped || undefined,
    source: { liveUrl: snap.liveUrl, capturedAt: new Date().toISOString() },
  };
  writeFileSync(`src/data/site-pages/${slug}.json`, JSON.stringify(content, null, 2) + '\n');
  const h2s = blocks.filter((b) => b.type === 'h2').map((b) => b.text);
  console.log(slug, 'blocks', blocks.length, 'raw', snap.rawBlockCount, 'h2s', h2s.length, h2s.slice(0, 8).join(' | '));
}
await browser.close();
