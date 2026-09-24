/**
 * M26 served DOM + href + 390px for blog archives; regress 8 pilots + site/topic samples.
 * CORRECTION: compares served title+href order against LIVE production SSR (not only fixtures),
 * so incomplete capture fixtures cannot false-green.
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-served-blog-archives.mjs
 */
import puppeteer from 'puppeteer-core';
import { readdirSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import {
  PROD,
  fetchLiveArchiveCardIndex,
  diffArchiveCardOrder,
  pathnameOf,
} from './lib/blog-archive-ssr.mjs';

const PREVIEW = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW_BASE');
  process.exit(1);
}

const archives = readdirSync('src/data/blog-archives')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-archives/${f}`, 'utf8')));

const posts = readdirSync('src/data/blog-posts')
  .filter((f) => f.endsWith('.json'))
  .map((f) => JSON.parse(readFileSync(`src/data/blog-posts/${f}`, 'utf8')));

const pilotPaths = posts.map((p) => p.path);
const LOCAL_TOPIC_PATHS = new Set(
  JSON.parse(readFileSync('reports/m27-blog/local-topic-paths.json', 'utf8'))
);

function pathsEqual(a, b) {
  if (a === b) return true;
  try {
    return decodeURIComponent(a) === decodeURIComponent(b);
  } catch {
    return false;
  }
}

function isPilotPath(pathname) {
  const norm = pathname.replace(/\/$/, '') || '/';
  return pilotPaths.some((p) => pathsEqual(p.replace(/\/$/, '') || '/', norm));
}

function isLocallyServedPath(pathname) {
  const path = pathname.replace(/\/$/, '') || '/';
  if (isPilotPath(path)) return true;
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
  if (path.startsWith('/post/') || path === '/blog' || path.startsWith('/blog/')) return false;
  if (LOCAL_TOPIC_PATHS.has(path)) return true;
  return false;
}

mkdirSync('reports/m26-blog', { recursive: true });

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

let failures = 0;
const liveGateReport = [];

async function checkArchive(archive) {
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const url = PREVIEW + archive.path;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status() ?? 0;
  if (status >= 400) {
    console.error('FAIL', archive.path, 'HTTP', status);
    failures++;
    await page.close();
    return;
  }
  await new Promise((r) => setTimeout(r, 700));
  const snap = await page.evaluate(`(() => {
    const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const main = document.querySelector('[data-blog-archive]') || document.querySelector('main');
    const h1 = clean(main?.querySelector('h1')?.textContent || '');
    const title = document.title || '';
    const nav = [...(main?.querySelectorAll('[data-blog-archive-nav] a') || [])].map((a) => ({
      text: clean(a.textContent || ''),
      href: a.getAttribute('href') || '',
      current: a.getAttribute('aria-current') === 'page',
    }));
    const cards = [...(main?.querySelectorAll('[data-blog-archive-card]') || [])].map((el) => ({
      title: clean(el.querySelector('[data-blog-archive-card-link]')?.textContent || ''),
      href: el.querySelector('[data-blog-archive-card-link]')?.getAttribute('href') || '',
      excerpt: clean(el.querySelector('[data-blog-archive-card-excerpt]')?.textContent || ''),
      imageSrc: el.querySelector('[data-blog-archive-card-img]')?.getAttribute('src') || '',
      imageAlt: el.querySelector('[data-blog-archive-card-img]')?.getAttribute('alt') || '',
      author: clean(el.querySelector('[data-blog-archive-card-author]')?.textContent || ''),
      date: clean(el.querySelector('[data-blog-archive-card-date]')?.textContent || ''),
    }));
    const allHrefs = [...(main?.querySelectorAll('a[href]') || [])].map((a) => ({
      href: a.getAttribute('href') || '',
      where: a.closest('[data-blog-archive-card]')
        ? 'card'
        : a.closest('[data-blog-archive-nav]')
          ? 'nav'
          : 'other',
    }));
    const loadMore = !!main?.querySelector('[data-blog-archive-load-more]');
    const pagination = !!main?.querySelector('[data-blog-archive-pagination]');
    return { h1, title, nav, cards, allHrefs, loadMore, pagination };
  })()`);

  const issues = [];

  // --- SOURCE-TO-SERVED: live production SSR title+href order (not fixture-only) ---
  let liveIndex;
  try {
    liveIndex = await fetchLiveArchiveCardIndex(archive.path);
  } catch (e) {
    issues.push(`live SSR fetch failed: ${e.message || e}`);
  }
  if (liveIndex) {
    const liveVsServed = diffArchiveCardOrder(liveIndex, snap.cards, 'served');
    issues.push(...liveVsServed);
    const liveVsFixture = diffArchiveCardOrder(liveIndex, archive.cards, 'fixture');
    if (liveVsFixture.length) {
      issues.push(...liveVsFixture.map((x) => `fixture-stale: ${x}`));
    }
    if (liveIndex.loadMore && !snap.loadMore && !archive.loadMore) {
      issues.push('live has load-more but served/fixture omitted it');
    }
    if (liveIndex.pagination && !snap.pagination && !archive.pagination) {
      issues.push('live has pagination but served/fixture omitted it');
    }
    liveGateReport.push({
      path: archive.path,
      liveCount: liveIndex.count,
      servedCount: snap.cards.length,
      fixtureCount: archive.cards.length,
      liveTitles: liveIndex.titles,
      servedTitles: snap.cards.map((c) => c.title),
      issues: liveVsServed,
    });
  }

  if (snap.h1 !== archive.h1) issues.push(`h1 mismatch got=${snap.h1}`);
  if (snap.title !== archive.title) issues.push('title mismatch');
  for (const nav of archive.nav) {
    if (!snap.nav.some((n) => n.text === nav.text)) issues.push(`missing nav ${nav.text}`);
  }
  for (const card of archive.cards) {
    const found = snap.cards.find((c) => c.title === card.title);
    if (!found) {
      issues.push(`missing fixture card on served ${card.title.slice(0, 40)}`);
      continue;
    }
    if (card.excerpt && !found.excerpt.includes(card.excerpt.slice(0, 40))) {
      issues.push(`excerpt mismatch ${card.title.slice(0, 30)}`);
    }
    if (card.imageSrc) {
      if (!found.imageSrc) issues.push(`missing image ${card.title.slice(0, 30)}`);
      else if (card.imageAlt && found.imageAlt !== card.imageAlt) {
        issues.push(`image alt mismatch ${card.title.slice(0, 30)}`);
      }
    }
  }

  for (const link of snap.allHrefs) {
    const href = link.href;
    if (!href || href.startsWith('#') || href.startsWith('mailto:')) continue;
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
    const served = isLocallyServedPath(path);
    const isLocalRel = href.startsWith('/') && !href.startsWith('//');
    if (!served && isLocalRel) {
      issues.push(`unmigrated ${link.where} href is local: ${href}`);
    }
    if (served && path.startsWith('/post/') && !isLocalRel && !href.startsWith(PROD)) {
      issues.push(`pilot href unexpected: ${href}`);
    }
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 250));
  const overflow = await page.evaluate(
    `(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }))()`
  );
  if (overflow.sw > overflow.cw + 2) issues.push(`390px overflow ${overflow.sw}>${overflow.cw}`);

  if (issues.length) {
    console.error('FAIL', archive.path, issues.slice(0, 12).join(' | '));
    failures++;
  } else {
    console.log(
      'OK archive',
      archive.path,
      'cards',
      snap.cards.length,
      'liveSSR',
      liveIndex?.count ?? '?'
    );
  }
  await page.close();
}

async function regressPilots() {
  const page = await browser.newPage();
  for (const post of posts) {
    const r = await page.goto(PREVIEW + post.path, { waitUntil: 'networkidle2', timeout: 90000 });
    const st = r?.status() ?? 0;
    const h1 = await page.evaluate(
      `(() => (document.querySelector('[data-blog-post] h1')?.textContent || '').trim())()`
    );
    if (st >= 400 || h1 !== post.h1) {
      console.error('FAIL pilot regress', post.path, st, h1?.slice?.(0, 30));
      failures++;
    } else console.log('OK pilot', post.decodedSlug.slice(0, 40));
  }
  await page.close();
}

const REGRESSION = ['/aboutus', '/terms', '/distributive-law-grade-9', '/binomial-square-grade-9', '/grade-7'];

async function regressSite() {
  const page = await browser.newPage();
  for (const path of REGRESSION) {
    const r = await page.goto(PREVIEW + path, { waitUntil: 'networkidle2', timeout: 90000 });
    const st = r?.status() ?? 0;
    const h1 = await page.evaluate(`(() => (document.querySelector('h1')?.textContent || '').trim())()`);
    if (st >= 400 || !h1) {
      console.error('FAIL site regress', path, st);
      failures++;
    } else console.log('OK site', path);
  }
  await page.close();
}

/** Prove the gate fails when served omits live SSR cards (false-green guard). */
async function assertGateDetectsOmission() {
  const live = await fetchLiveArchiveCardIndex('/blog');
  if (live.count < 16) {
    console.error('FAIL gate-self-test: live /blog SSR unexpected count', live.count);
    failures++;
    return;
  }
  const truncated = live.cards.slice(0, 15).map((c) => ({ title: c.title, href: c.href }));
  const issues = diffArchiveCardOrder(live, truncated, 'truncated-15');
  if (!issues.length) {
    console.error('FAIL gate-self-test: truncation of 15/20 did not produce issues');
    failures++;
  } else {
    console.log('OK gate-self-test detects 15-vs-20 omission:', issues[0]);
  }
}

console.log('Preview', PREVIEW, 'archives', archives.length, 'pilots', posts.length);
await assertGateDetectsOmission();
for (const a of archives) await checkArchive(a);
await regressPilots();
await regressSite();
await browser.close();

writeFileSync(
  'reports/m26-blog/live-ssr-served-gate.json',
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      preview: PREVIEW,
      liveGateReport,
      failures,
    },
    null,
    2
  ) + '\n'
);

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll M26 blog archive served checks passed (incl. live SSR title+href order)');
