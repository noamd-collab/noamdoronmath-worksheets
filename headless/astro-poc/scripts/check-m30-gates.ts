/**
 * HEADLESS-MIGRATION-30 — redirect + served DOM parity + 390px + regressions.
 * Usage: PREVIEW=https://… npx tsx scripts/check-m30-gates.ts
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import puppeteer from 'puppeteer-core';
import { TOPIC_PARITY_EXTRACTOR } from './topic-parity-extractor.js';
import {
  diffTopicParity,
  assertJsonLdFaqVisible,
  type TopicParitySnapshot,
} from '../src/lib/parity/topicParity.ts';
import { TOPIC_PAGE_M30_SLUGS, TOPIC_PAGE_M30_REDIRECTS } from '../src/lib/topicPages.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureDir = join(root, 'tests', 'fixtures', 'topic-parity');
const outDir = join(root, 'reports', 'm30-topic');
mkdirSync(outDir, { recursive: true });

const PREVIEW = (process.env.PREVIEW || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW=...');
  process.exit(1);
}

const REGRESSION_SLUGS = [
  'equations-basics-grade-7',
  'distributive-law-grade-9',
  'signed-numbers-grade-7',
  'angles-grade-7',
];

function loadProd(slug: string): TopicParitySnapshot {
  return JSON.parse(readFileSync(join(fixtureDir, `${slug}.production.json`), 'utf8'));
}

async function checkRedirect(from: string, to: string) {
  const url = `${PREVIEW}/${from}`;
  const res = await fetch(url, { redirect: 'manual' });
  const loc = res.headers.get('location') || '';
  const ok =
    res.status === 301 &&
    (loc === to || loc.endsWith(to) || loc.includes(to));
  console.log(`redirect ${from} → status=${res.status} location=${loc} expected=${to} ${ok ? 'OK' : 'FAIL'}`);
  return { from, to, status: res.status, location: loc, ok };
}

async function extractParity(page: import('puppeteer-core').Page, slug: string) {
  const url = `${PREVIEW}/${slug}`;
  const resp = await page.goto(url, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 1500));
  const raw = (await page.evaluate((code: string) => {
    return (0, eval)('(' + code + ')')();
  }, TOPIC_PARITY_EXTRACTOR)) as any;
  const snap = {
    slug,
    source: 'preview' as const,
    url,
    capturedAt: new Date().toISOString(),
    httpStatus: resp?.status() ?? 0,
    title: raw.title,
    description: raw.description,
    h1: raw.h1,
    intro: raw.intro || '',
    updatedLine: raw.updatedLine,
    authorLine: raw.authorLine,
    authorAboutHref: raw.authorAboutHref,
    sections: raw.sections,
    bodyFlow: raw.bodyFlow || [],
    faqGroups: raw.faqGroups,
    relatedLinks: raw.relatedLinks,
    catalogCta: raw.catalogCta,
    catalogCtas: raw.catalogCtas || [],
    images: raw.images || [],
    jsonLd: { types: raw.jsonLdTypes || [], faq: raw.jsonLdFaq || [] },
  } as TopicParitySnapshot;
  return snap;
}

async function check390(page: import('puppeteer-core').Page, slug: string) {
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await page.goto(`${PREVIEW}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  await new Promise((r) => setTimeout(r, 800));
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  const ok = overflow.sw <= overflow.cw + 2;
  console.log(`390px ${slug}: sw=${overflow.sw} cw=${overflow.cw} ${ok ? 'OK' : 'FAIL'}`);
  return { slug, ...overflow, ok };
}

async function main() {
  const results: Record<string, unknown> = {
    preview: PREVIEW,
    generatedAt: new Date().toISOString(),
  };
  let fail = 0;

  // Redirect
  const redirects = [];
  for (const r of TOPIC_PAGE_M30_REDIRECTS) {
    const row = await checkRedirect(r.from, r.to);
    redirects.push(row);
    if (!row.ok) fail++;
  }
  results.redirects = redirects;

  const browser = await puppeteer.launch({
    executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome-stable',
    headless: true,
    args: ['--no-sandbox', '--disable-gpu'],
  });

  const parityRows: unknown[] = [];
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);

  for (const slug of [...TOPIC_PAGE_M30_SLUGS, ...REGRESSION_SLUGS]) {
    if (!existsSync(join(fixtureDir, `${slug}.production.json`))) {
      console.log(`skip ${slug}: no production fixture`);
      continue;
    }
    const source = loadProd(slug);
    const preview = await extractParity(page, slug);
    // Normalize catalog CTA hrefs: preview uses /worksheets; source may use github
    const diffs = diffTopicParity(source, preview).filter((d) => {
      if (d.field === 'images' && source.images.length === 0) return false;
      // Local preview resolves aboutus to preview host — path parity is enough
      if (d.field === 'authorAboutHref') {
        const exp = String(d.expected || '');
        const act = String(d.actual || '');
        try {
          const ep = new URL(exp, 'https://www.noamdoronmath.co.il').pathname;
          const ap = new URL(act, PREVIEW).pathname;
          if (ep.replace(/\/$/, '') === ap.replace(/\/$/, '')) return false;
        } catch {
          /* keep */
        }
      }
      return true;
    });
    // Soften CTA href absolute vs relative: re-check topic ids only if count/label ok
    const hard = diffs.filter((d) => d.severity === 'error');
    // FAQ visibility
    let faqOk = true;
    try {
      assertJsonLdFaqVisible(preview, slug);
    } catch (e) {
      faqOk = false;
      hard.push({
        field: 'jsonLd.faqVisibility',
        severity: 'error',
        message: String(e),
      });
    }
    // Pre-H1 CTA check for AA
    let preH1Ok = true;
    if (slug === 'triangle-similarity-aa-grade-9') {
      const pre = await page.evaluate(() => {
        const h1 = document.querySelector('h1');
        if (!h1) return { count: 0 };
        const all = [...document.querySelectorAll('a')].filter((a) =>
          /worksheets\?grade=/.test(a.getAttribute('href') || '')
        );
        const before = all.filter((a) => {
          const pos = h1.compareDocumentPosition(a);
          return !!(pos & Node.DOCUMENT_POSITION_PRECEDING);
        });
        return {
          count: before.length,
          labels: before.map((a) => (a.textContent || '').trim()),
        };
      });
      preH1Ok = pre.count >= 1;
      if (!preH1Ok) {
        hard.push({
          field: 'preH1Ctas',
          severity: 'error',
          message: `expected CTA before H1, got ${JSON.stringify(pre)}`,
        });
      }
      console.log(`preH1 ${slug}:`, pre, preH1Ok ? 'OK' : 'FAIL');
    }

    const ok = hard.length === 0 && faqOk && preview.httpStatus === 200;
    console.log(
      `parity ${slug}: status=${preview.httpStatus} diffs=${hard.length} faq=${faqOk} ${ok ? 'OK' : 'FAIL'}`
    );
    if (!ok) {
      fail++;
      console.log(JSON.stringify(hard.slice(0, 8), null, 2));
    }
    writeFileSync(join(outDir, `served-${slug}.json`), JSON.stringify({ preview, hard }, null, 2));
    parityRows.push({ slug, ok, hard: hard.slice(0, 12), httpStatus: preview.httpStatus });
  }

  // 390px for M30 pages
  const vp = [];
  for (const slug of TOPIC_PAGE_M30_SLUGS) {
    const row = await check390(page, slug);
    vp.push(row);
    if (!row.ok) fail++;
  }

  // Sample grade hub + blog regression
  for (const path of ['/grade-7', '/blog', '/post/annual-review-grade-7']) {
    const resp = await page.goto(`${PREVIEW}${path}`, {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });
    const st = resp?.status() ?? 0;
    const ok = st === 200;
    console.log(`regression ${path}: ${st} ${ok ? 'OK' : 'FAIL'}`);
    if (!ok) fail++;
  }

  await browser.close();

  results.parity = parityRows;
  results.viewport390 = vp;
  results.fail = fail;
  writeFileSync(join(outDir, 'm30-gate-summary.json'), JSON.stringify(results, null, 2));
  console.log(`\nM30 gates fail=${fail}`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
