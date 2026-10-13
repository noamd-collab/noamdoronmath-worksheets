import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';

const PROD = 'https://www.noamdoronmath.co.il';
const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

mkdirSync('src/data/site-pages', { recursive: true });
mkdirSync('reports', { recursive: true });

function clean(s){ return (s||'').replace(/\s+/g,' ').trim(); }

async function extractPage(slug) {
  const page = await browser.newPage();
  await page.goto(`${PROD}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1800));
  try {
    await page.evaluate(() => {
      const b = [...document.querySelectorAll('button')].find((el) => /אישור|הבנתי|מסכים/.test(el.textContent || ''));
      b?.click();
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

    const root = document.createElement('div');
    for (const s of contentSections) root.appendChild(s.cloneNode(true));

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
      // rich text divs that hold text without a <p> child
      if (node.getAttribute('data-testid') === 'richTextElement') {
        const hasBlockChild = !!node.querySelector(':scope > p, :scope > h1, :scope > h2, :scope > h3, :scope > h4, :scope > ul, :scope > ol');
        if (!hasBlockChild) {
          const text = clean(node.textContent);
          // skip if it's just a heading that exists as real h2 elsewhere — headings usually have h2 child
          if (text && text.length > 2) push({ type: 'p', text });
          return;
        }
      }
      for (const child of node.children) walk(child);
    };
    walk(root);

    // iframes anywhere under content (shadow/custom wrappers)
    for (const iframe of root.querySelectorAll('iframe')) {
      const src = iframe.getAttribute('src') || '';
      if (!src) continue;
      if (!blocks.some((b) => b.type === 'iframe' && b.src === src)) {
        push({ type: 'iframe', src, title: iframe.getAttribute('title') || '' });
      }
    }

    // orphan CTAs
    for (const a of root.querySelectorAll('a[href]')) {
      if (a.closest('p, li, h1, h2, h3, h4, form, ul, ol')) continue;
      const href = a.getAttribute('href') || '';
      const text = clean(a.textContent);
      if (!text || text.length < 2) continue;
      if (blocks.some((b) => b.type === 'a' && b.href === href && b.text === text)) continue;
      push({ type: 'a', text, href });
    }

    const intro = [];
    for (const b of blocks) {
      if (['h2', 'h3', 'h4', 'form', 'iframe'].includes(b.type)) break;
      if (b.type === 'p') intro.push(b.text);
    }

    const jsonLd = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map((s) => { try { return JSON.parse(s.textContent || ''); } catch { return null; } })
      .filter(Boolean);

    // FAQ visible pairs if FAQPage present
    let faq = null;
    const faqLd = jsonLd.find((j) => j['@type'] === 'FAQPage' || (Array.isArray(j['@graph']) && j['@graph'].some((x) => x['@type'] === 'FAQPage')));
    // also flatten
    const faqNode = jsonLd.find((j) => j['@type'] === 'FAQPage') ||
      jsonLd.flatMap((j) => (Array.isArray(j['@graph']) ? j['@graph'] : [])).find((x) => x['@type'] === 'FAQPage');
    if (faqNode?.mainEntity) {
      faq = {
        schema: faqNode,
        items: faqNode.mainEntity.map((e) => ({
          question: e.name || e.acceptedAnswer?.name || '',
          answer: e.acceptedAnswer?.text || '',
        })),
      };
    }

    return {
      title: document.title || '',
      description: meta('description') || og('og:description'),
      ogTitle: og('og:title'),
      ogDescription: og('og:description'),
      canonicalPath: `/${document.location.pathname.replace(/^\//,'').replace(/\/$/,'')}`,
      h1,
      intro,
      blocks,
      jsonLd,
      faq,
      mainText: clean(root.innerText).slice(0, 6000),
    };
  });

  // Fetch terms iframe body into blocks if present
  const iframeBlock = snap.blocks.find((b) => b.type === 'iframe');
  if (slug === 'terms' && iframeBlock?.src) {
    const ip = await browser.newPage();
    await ip.goto(iframeBlock.src, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await new Promise((r) => setTimeout(r, 800));
    const iframeData = await ip.evaluate(() => {
      const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
      const blocks = [];
      // Prefer structured elements; also split by newlines in body if sparse
      const els = [...document.querySelectorAll('h1,h2,h3,h4,p,ul,ol,li')];
      if (els.length >= 3) {
        for (const el of els) {
          const tag = el.tagName.toLowerCase();
          if (tag === 'li') continue;
          if (tag === 'ul' || tag === 'ol') {
            const items = [...el.querySelectorAll(':scope > li')].map((li) => ({ text: clean(li.textContent) })).filter((i) => i.text);
            if (items.length) blocks.push({ type: tag, items });
          } else {
            const text = clean(el.textContent);
            if (!text) continue;
            const type = tag === 'h1' ? 'h2' : tag;
            blocks.push({ type, text });
          }
        }
      } else {
        // fallback: preserve full legal text as paragraphs split on blank lines
        const raw = (document.body.innerText || '').replace(/\r/g, '');
        const parts = raw.split(/\n\s*\n/).map((p) => clean(p.replace(/\n/g, ' '))).filter(Boolean);
        for (const p of parts) {
          if (/^תנאי השימוש/.test(p) && p.length < 40) continue;
          if (/^\d+\.\s/.test(p) || /^[א-ת].{0,40}:/.test(p) || p.length < 80) {
            // short heading-like
            if (/^\d+\.\s/.test(p) && p.length < 60) blocks.push({ type: 'h3', text: p });
            else blocks.push({ type: 'p', text: p });
          } else blocks.push({ type: 'p', text: p });
        }
      }
      return { blocks, fullText: clean(document.body.innerText) };
    });
    snap.legalIframeSrc = iframeBlock.src;
    snap.legalFullText = iframeData.fullText;
    // Keep intro + embed iframe for visual parity, AND store extracted legal blocks for parity tests
    snap.legalBlocks = iframeData.blocks;
    await ip.close();
  }

  snap.slug = slug;
  snap.liveUrl = `${PROD}/${slug}`;
  await page.close();
  return snap;
}

const SLUGS = [
  'aboutus',
  'math-tools',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
  'high-school-math',
];

const pages = {};
for (const slug of SLUGS) {
  console.log('capturing', slug);
  const snap = await extractPage(slug);
  pages[slug] = snap;
  writeFileSync(`reports/m24-captures/${slug}.json`, JSON.stringify(snap, null, 2) + '\n');
  console.log(' ', snap.h1, 'blocks', snap.blocks.length, 'faq', snap.faq?.items?.length || 0);
  if (slug === 'aboutus') {
    const bio = snap.blocks.find((b) => b.type === 'p' && b.text.includes('שמי נועם'));
    console.log('  bio found:', !!bio, bio?.text?.slice(0, 80));
  }
  if (slug === 'terms') {
    console.log('  legal blocks', snap.legalBlocks?.length, 'iframe', !!snap.legalIframeSrc);
  }
}

await browser.close();

// Write SitePageContent JSON files (normalized)
function toSitePage(snap) {
  const blocks = snap.blocks.filter((b) => {
    // Drop decorative fraction "3/4" alone if tiny — keep all source text actually
    return true;
  });
  // For aboutus: replace form with mailto contact CTA (document skip)
  const outBlocks = [];
  let formSkipped = false;
  for (const b of blocks) {
    if (b.type === 'form') {
      formSkipped = true;
      outBlocks.push({
        type: 'contact',
        note: 'wix-form-backend-unavailable',
        mailto: 'mailto:noamd@noamdoronmath.co.il',
        mailtoLabel: 'פנו אליי בדוא״ל: noamd@noamdoronmath.co.il',
        fieldsShownAsLabels: b.fields.filter((f) => f.tag !== 'button').map((f) => f.label || f.placeholder || f.name).filter(Boolean),
      });
      continue;
    }
    outBlocks.push(b);
  }

  return {
    slug: snap.slug,
    title: snap.title,
    description: snap.description,
    h1: snap.h1,
    intro: snap.intro,
    blocks: outBlocks,
    faq: snap.faq
      ? { items: snap.faq.items }
      : null,
    jsonLd: snap.jsonLd?.length ? snap.jsonLd : undefined,
    legalIframeSrc: snap.legalIframeSrc || undefined,
    legalBlocks: snap.legalBlocks || undefined,
    formSkipped: formSkipped || undefined,
    source: {
      liveUrl: snap.liveUrl,
      capturedAt: new Date().toISOString(),
    },
  };
}

for (const slug of SLUGS) {
  const content = toSitePage(pages[slug]);
  writeFileSync(`src/data/site-pages/${slug}.json`, JSON.stringify(content, null, 2) + '\n');
  console.log('wrote data', slug);
}

writeFileSync('reports/m24-slug-manifest.txt', `# HEADLESS-MIGRATION-24 slug/classification manifest
# Generated before route implementation. Live vs redirect vs skip.

## Targets audited (from production-route-coverage missing buckets)

### site-nav-page (3)
/aboutus                     LIVE     → MIGRATE (static bio+contact; Wix form submit SKIPPED → mailto)
/high-school-math-1          REDIRECT → /high-school-math (document; Astro redirect)
/math-tools                  LIVE     → MIGRATE

### policy (2 + 1 misbucketed)
/accessibilityadaptation     LIVE     → MIGRATE
/terms                       LIVE     → MIGRATE (legal body via production HTML iframe embed)
/conditionforfreeworksheets  LIVE     → MIGRATE (reclassify from topic-seo → policy)

### other-page (2)
/high-school-math            LIVE     → MIGRATE (canonical high-school hub)
/page                        REDIRECT → /terms (document; Astro redirect)

## Explicitly out of scope this batch
- blog/* and /post/* (63)
- remaining topic-SEO exclusions (5): equations-grade-7 (redirect), triangle-area-grade-7,
  triangle-similarity-aa-grade-9, special-triangles-grade-7-new, patterns-and-graphs-grade-7

## Counts planned
migrate_exact: 6
redirect_routes: 2
skipped_functionality: aboutus Wix contact form backend (mailto fallback)
`);
console.log('manifest written');
