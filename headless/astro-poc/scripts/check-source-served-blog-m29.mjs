/**
 * M29: live SOURCE → served PREVIEW parity for each of the 18 remaining posts
 * (+ optional all served). Compares content blocks (h1/h2/h3/para skim) and
 * every visible same-site link destination policy.
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-source-served-blog-m29.mjs
 */
import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// Use compiled path list from candidates + all fixtures via dynamic read
import { readdirSync } from 'node:fs';

const PREVIEW = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
const PROD = 'https://www.noamdoronmath.co.il';
if (!PREVIEW) {
  console.error('Set PREVIEW_BASE');
  process.exit(1);
}

const posts = readdirSync('src/data/blog-posts')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-posts/${f}`, 'utf8')))
  .filter((p) => p.batch === 'm29');

mkdirSync('reports/m29-blog', { recursive: true });

function clean(s) {
  return (s || '').replace(/\s+/g, ' ').trim();
}

function pathsEqual(a, b) {
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

const servedPaths = readdirSync('src/data/blog-posts')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-posts/${f}`, 'utf8')).path);

const LOCAL_TOPIC_PATHS = new Set(
  JSON.parse(readFileSync('reports/m27-blog/local-topic-paths.json', 'utf8'))
);

function isServedPost(pathname) {
  const norm = pathname.replace(/\/$/, '') || '/';
  return servedPaths.some((p) => pathsEqual(p.replace(/\/$/, '') || '/', norm));
}

function isLocallyServedPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (isServedPost(path)) return true;
  if (
    [
      '/',
      '/aboutus',
      '/math-tools',
      '/terms',
      '/accessibilityadaptation',
      '/conditionforfreeworksheets',
      '/high-school-math',
      '/worksheets',
      '/blog',
      '/blog/categories/elementary-math',
      '/blog/categories/middle-school-math',
      '/blog/categories/teachers-and-parents',
    ].includes(path)
  )
    return true;
  if (/^\/grade-[1-9]$/.test(path)) return true;
  if (path.startsWith('/worksheets')) return true;
  if (path.startsWith('/post/') || path.startsWith('/blog')) return false;
  // Migrated topic SEO pages only — never the broad -grade-N regex
  if (LOCAL_TOPIC_PATHS.has(path)) return true;
  return false;
}

const SNAP_SCRIPT = `(() => {
  const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
  const main = document.querySelector('[data-blog-post]') || document.querySelector('main') || document.body;
  const bodyRoot = document.querySelector('[data-blog-body]') || document.querySelector('[data-hook="post-description"]') || main;
  const h1 = clean(document.querySelector('h1')?.textContent || '');
  const h2s = [...(bodyRoot?.querySelectorAll('h2') || [])].map((h) => clean(h.textContent)).filter(Boolean);
  const h3s = [...(bodyRoot?.querySelectorAll('h3') || [])].map((h) => clean(h.textContent)).filter(Boolean);
  const paras = [...(bodyRoot?.querySelectorAll('p') || [])]
    .map((p) => clean(p.textContent))
    .filter((t) => t.length > 40)
    .slice(0, 12);
  const readingTime = clean(document.querySelector('[data-blog-reading-time]')?.textContent || '');
  // live may not have data-hooks — fall back to text scan for reading time
  let readingLive = readingTime;
  if (!readingLive) {
    for (const el of document.querySelectorAll('span, p, div, time')) {
      const t = clean(el.textContent);
      if (/^זמן קריאה\\s+\\d+/.test(t) && t.length < 40) { readingLive = t; break; }
    }
  }
  const faqH = [...document.querySelectorAll('h2')].some((h) => clean(h.textContent) === 'שאלות נפוצות');
  const waH = [...document.querySelectorAll('h2')].some((h) => clean(h.textContent) === 'נפגשים גם בוואטסאפ');
  const recentH = !!document.querySelector('[data-hook="recent-posts"], [data-blog-recent]');
  const hrefs = [...main.querySelectorAll('a[href]')].map((a) => ({
    text: clean(a.textContent).slice(0, 40),
    href: a.getAttribute('href') || '',
  }));
  return { h1, h2s, h3s, paras, readingTime: readingLive, faqH, waH, recentH, hrefs };
})()`;

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

let failures = 0;
const report = [];

async function snapUrl(page, url) {
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status() ?? 0;
  try {
    await page.evaluate(() => {
      [...document.querySelectorAll('button')]
        .find((b) => /אישור|הבנתי|מסכים/.test(b.textContent || ''))
        ?.click();
    });
  } catch {}
  await page.evaluate(async () => {
    for (let i = 0; i < 12; i++) {
      window.scrollBy(0, 700);
      await new Promise((r) => setTimeout(r, 80));
    }
  });
  await new Promise((r) => setTimeout(r, 400));
  const snap = await page.evaluate(SNAP_SCRIPT);
  return { status, snap };
}

for (const post of posts) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const issues = [];
  const live = await snapUrl(page, PROD + post.path);
  const served = await snapUrl(page, PREVIEW + post.path);

  if (live.status >= 400) issues.push(`live HTTP ${live.status}`);
  if (served.status >= 400) issues.push(`served HTTP ${served.status}`);

  if (live.snap.h1 !== served.snap.h1) {
    issues.push(`h1 live≠served: ${live.snap.h1.slice(0, 30)} vs ${served.snap.h1.slice(0, 30)}`);
  }
  if (live.snap.h1 !== post.h1) issues.push(`fixture h1 ≠ live`);

  for (const h2 of post.blocks.filter((b) => b.type === 'h2').map((b) => b.text)) {
    if (!served.snap.h2s.includes(h2) && !served.snap.h2s.some((x) => x.includes(h2.slice(0, 30)))) {
      // live chrome may add WhatsApp/FAQ h2 outside body — only require body h2s from fixture
      if (!live.snap.h2s.includes(h2) && !live.snap.h2s.some((x) => x.includes(h2.slice(0, 30)))) {
        issues.push(`h2 missing on live+served: ${h2.slice(0, 40)}`);
      } else if (!served.snap.h2s.includes(h2)) {
        issues.push(`h2 missing on served: ${h2.slice(0, 40)}`);
      }
    }
  }

  for (const b of post.blocks.filter((b) => b.type === 'p' && b.text.length > 55).slice(0, 8)) {
    const needle = b.text.slice(0, 50);
    if (!served.snap.paras.some((p) => p.includes(needle))) {
      // check full body via fixture presence already in served check; here compare live had it
      if (live.snap.paras.some((p) => p.includes(needle))) {
        issues.push(`para on live missing on served: ${needle.slice(0, 40)}`);
      }
    }
  }

  if (post.readingTime && !served.snap.readingTime) issues.push('served missing readingTime');
  if (post.faq?.items?.length && !served.snap.faqH) issues.push('served missing FAQ');
  if (post.whatsapp && !served.snap.waH) issues.push('served missing WhatsApp');
  if (post.recentPosts?.items?.length && !served.snap.recentH) issues.push('served missing recent');

  // Link destinations on served
  for (const link of served.snap.hrefs) {
    const href = link.href;
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) continue;
    let path = '';
    let host = '';
    try {
      const u = new URL(href, PROD);
      path = u.pathname.replace(/\/$/, '') || '/';
      host = u.hostname;
    } catch {
      continue;
    }
    const isOwn =
      host === 'www.noamdoronmath.co.il' ||
      host === 'noamdoronmath.co.il' ||
      (href.startsWith('/') && !href.startsWith('//'));
    if (!isOwn) continue;
    const local = isLocallyServedPath(path);
    const isLocalRel = href.startsWith('/') && !href.startsWith('//');
    if (!local && isLocalRel) issues.push(`unmigrated link local: ${href}`);
  }

  await page.setViewport({ width: 390, height: 844 });
  await page.goto(PREVIEW + post.path, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 300));
  const overflow = await page.evaluate(
    `(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))()`
  );
  if (overflow.sw > overflow.cw + 2) issues.push(`390px overflow`);

  report.push({
    fileSlug: post.fileSlug,
    path: post.path,
    liveH1: live.snap.h1,
    servedH1: served.snap.h1,
    issues,
  });
  if (issues.length) {
    console.error('FAIL', post.fileSlug, issues.slice(0, 6).join(' | '));
    failures++;
  } else {
    console.log('OK source→served', post.fileSlug);
  }
  await page.close();
}

await browser.close();
writeFileSync(
  'reports/m29-blog/source-served-parity.json',
  JSON.stringify({ generatedAt: new Date().toISOString(), preview: PREVIEW, report, failures }, null, 2) +
    '\n'
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll M29 source→served parity checks passed');
