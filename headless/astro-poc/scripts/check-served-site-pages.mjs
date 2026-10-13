/**
 * M24 served DOM source-parity + 390px + header/footer nav checks.
 * Usage: PREVIEW_BASE=https://… npx tsx scripts/check-served-site-pages.mjs
 */
import puppeteer from 'puppeteer-core';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const PREVIEW = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!PREVIEW) {
  console.error('Set PREVIEW_BASE');
  process.exit(1);
}

const SITE_PAGE_M24_SLUGS = [
  'aboutus',
  'math-tools',
  'accessibilityadaptation',
  'terms',
  'conditionforfreeworksheets',
  'high-school-math',
];
const REDIRECTS = [
  { from: 'high-school-math-1', to: '/high-school-math' },
  { from: 'page', to: '/terms' },
];

function loadSitePage(slug) {
  return require(`../src/data/site-pages/${slug}.json`);
}

const browser = await puppeteer.launch({
  executablePath: '/usr/bin/google-chrome-stable',
  headless: true,
  args: ['--no-sandbox', '--disable-gpu'],
});

let failures = 0;

async function checkPage(slug) {
  const expected = loadSitePage(slug);
  const page = await browser.newPage();
  page.setDefaultTimeout(90000);
  const resp = await page.goto(`${PREVIEW}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
  const status = resp?.status() ?? 0;
  if (status >= 400) {
    console.error('FAIL', slug, 'HTTP', status);
    failures++;
    await page.close();
    return;
  }
  await new Promise((r) => setTimeout(r, 800));
  const snap = await page.evaluate(`(() => {
    const clean = (s) => (s || '').replace(/\\s+/g, ' ').trim();
    const main = document.querySelector('[data-site-page]') || document.querySelector('main');
    const h1 = clean(main?.querySelector('h1')?.textContent || '');
    const h2s = [...(main?.querySelectorAll('h2') || [])].map((h) => clean(h.textContent || ''));
    const bodyText = clean(main?.innerText || '');
    const title = document.title || '';
    const hasTermsIframe = !!document.querySelector('iframe[src*="filesusr.com"]');
    const hasLegalBody = !!(main?.querySelector('[data-legal-body]') || bodyText.includes('1. השירות'));
    const privacyH2 = [...(main?.querySelectorAll('h2') || [])].find(
      (h) => clean(h.textContent || '') === 'מדיניות פרטיות'
    );
    const privacyAnchorId = privacyH2?.id || '';
    return { h1, h2s, bodyText, title, hasTermsIframe, hasLegalBody, privacyAnchorId };
  })()`);

  const issues = [];
  if (snap.h1 !== expected.h1) issues.push(`h1 mismatch: got "${snap.h1.slice(0, 60)}"`);
  if (snap.title !== expected.title) issues.push(`title mismatch got="${snap.title.slice(0, 50)}"`);
  for (const b of expected.blocks) {
    if (b.type === 'h2' || b.type === 'h3' || b.type === 'h4') {
      if (!snap.bodyText.includes(b.text)) issues.push(`missing heading: ${b.text.slice(0, 40)}`);
    }
    if (b.type === 'p' && b.text.length > 40) {
      const needle = b.text.slice(0, 60);
      if (!snap.bodyText.includes(needle)) issues.push(`missing para: ${needle}`);
    }
  }
  if (slug === 'aboutus') {
    if (!snap.bodyText.includes('שמי נועם דורון')) issues.push('missing about bio');
    if (!snap.bodyText.includes('noamd@noamdoronmath.co.il')) issues.push('missing mailto fallback');
  }
  if (slug === 'terms') {
    if (snap.hasTermsIframe) issues.push('terms still embeds filesusr iframe (should be code-owned)');
    if (!snap.hasLegalBody) issues.push('missing code-owned legal body');
    if (!snap.bodyText.includes('1. השירות')) issues.push('missing legal section 1');
    if (!snap.bodyText.includes('noamd@noamdoronmath.co.il')) issues.push('missing legal contact email');
  }
  if (slug === 'accessibilityadaptation') {
    if (!snap.bodyText.includes('מדיניות פרטיות')) issues.push('missing privacy H2');
    if (!snap.bodyText.includes('איזה מידע נאסף באתר?')) issues.push('missing privacy H3 collect');
    if (!snap.privacyAnchorId) issues.push('missing #privacy-policy id on מדיניות פרטיות H2');
  }
  if (slug === 'conditionforfreeworksheets' && !snap.bodyText.includes('שימוש מסחרי')) {
    issues.push('missing policy commercial ban');
  }

  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 1 });
  await new Promise((r) => setTimeout(r, 300));
  const overflow = await page.evaluate(`(() => {
    const doc = document.documentElement;
    return { sw: doc.scrollWidth, cw: doc.clientWidth };
  })()`);
  if (overflow.sw > overflow.cw + 2) {
    issues.push(`390px overflow scrollWidth=${overflow.sw} clientWidth=${overflow.cw}`);
  }

  if (issues.length) {
    console.error('FAIL', slug, issues.slice(0, 8).join(' | '));
    failures++;
  } else {
    console.log('OK', slug, 'h2s', snap.h2s.length);
  }
  await page.close();
}

async function checkRedirect(from, to) {
  const page = await browser.newPage();
  await page.goto(`${PREVIEW}/${from}`, { waitUntil: 'networkidle2', timeout: 90000 });
  const finalPath = new URL(page.url()).pathname.replace(/\/$/, '') || '/';
  const ok = finalPath === to;
  if (!ok) {
    console.error('FAIL redirect', from, '→ expected', to, 'got', finalPath);
    failures++;
  } else {
    console.log('OK redirect', from, '→', finalPath);
  }
  await page.close();
}

async function checkNav() {
  const page = await browser.newPage();
  await page.goto(`${PREVIEW}/aboutus`, { waitUntil: 'networkidle2', timeout: 90000 });
  const hrefs = await page.evaluate(`(() =>
    [...document.querySelectorAll('header a[href], .site-nav a[href], .site-page__footer-links a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => h.startsWith('/') && !h.startsWith('//'))
  )()`);
  // Also home header
  await page.goto(`${PREVIEW}/`, { waitUntil: 'networkidle2' });
  const homeHrefs = await page.evaluate(`(() =>
    [...document.querySelectorAll('header a[href], .site-nav a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => h.startsWith('/') && !h.startsWith('//'))
  )()`);
  // grade hub terms
  await page.goto(`${PREVIEW}/grade-7`, { waitUntil: 'networkidle2' });
  const gradeHrefs = await page.evaluate(`(() =>
    [...document.querySelectorAll('.grade-hub__terms a[href], .grade-hub__footer-links a[href], header a[href]')]
      .map((a) => a.getAttribute('href') || '')
      .filter((h) => h.startsWith('/') && !h.startsWith('//'))
  )()`);

  const all = [...new Set([...hrefs, ...homeHrefs, ...gradeHrefs])];
  for (const href of all) {
    const path = href.split('?')[0];
    if (path === '/blog' || path.startsWith('/blog/') || path.startsWith('/post/')) continue;
    const r = await page.goto(`${PREVIEW}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
    const status = r?.status() ?? 0;
    if (status >= 400) {
      console.error('FAIL nav 404', href, status);
      failures++;
    } else {
      console.log('OK nav', href, status);
    }
  }
  await page.close();
}

const TOPIC_SAMPLES = [
  'distributive-law-grade-9',
  'binomial-square-grade-9',
  'difference-of-squares-grade-9',
  'signed-numbers-grade-7',
  'quadratic-function-grade-9',
];

async function checkTopicSamples() {
  for (const slug of TOPIC_SAMPLES) {
    const page = await browser.newPage();
    const resp = await page.goto(`${PREVIEW}/${slug}`, { waitUntil: 'networkidle2', timeout: 90000 });
    const status = resp?.status() ?? 0;
    const h1 = await page.evaluate(`(() => (document.querySelector('h1')?.textContent || '').trim())()`);
    if (status >= 400 || !h1) {
      console.error('FAIL topic sample', slug, status, h1);
      failures++;
    } else {
      console.log('OK topic sample', slug);
    }
    await page.close();
  }
}

console.log('Preview', PREVIEW);
for (const slug of SITE_PAGE_M24_SLUGS) await checkPage(slug);
for (const r of REDIRECTS) await checkRedirect(r.from, r.to);
await checkNav();
await checkTopicSamples();
await browser.close();

if (failures) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log('\nAll M24 served checks passed');
