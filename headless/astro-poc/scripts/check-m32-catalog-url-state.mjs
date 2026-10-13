/**
 * HEADLESS-MIGRATION-32 — browser gate: catalog q/filter/cross URL persistence.
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-m32-catalog-url-state.mjs
 */
import puppeteer from 'puppeteer-core';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.env.PREVIEW_BASE || '').replace(/\/$/, '');
if (!BASE) {
  console.error('PREVIEW_BASE required');
  process.exit(2);
}

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'm32-catalog-url');
mkdirSync(outDir, { recursive: true });

const chromePath =
  process.env.CHROME_PATH ||
  '/usr/bin/google-chrome-stable' ||
  '/usr/bin/chromium-browser';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function waitStatus(page, substr, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.$eval('[data-catalog-status]', (el) => el.textContent || '').catch(() => '');
    if (text.includes(substr)) return text;
    await sleep(150);
  }
  throw new Error(`status never included "${substr}"`);
}

const results = { base: BASE, checks: [], ok: true };

function check(name, pass, detail = '') {
  results.checks.push({ name, pass, detail });
  if (!pass) results.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  await page.goto(`${BASE}/worksheets?grade=7`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[data-catalog-search]', { timeout: 30000 });

  // Type search — URL must gain q=
  await page.click('[data-catalog-search]');
  await page.type('[data-catalog-search]', 'משוואות', { delay: 40 });
  await waitStatus(page, 'נושאים תואמים');
  await sleep(400);
  const urlAfterSearch = page.url();
  const u1 = new URL(urlAfterSearch);
  check('url has grade=7', u1.searchParams.get('grade') === '7', urlAfterSearch);
  check('url has q=משוואות', u1.searchParams.get('q') === 'משוואות', urlAfterSearch);

  const statusAfter = await page.$eval('[data-catalog-status]', (el) => el.textContent || '');
  const countMatch = statusAfter.match(/(\d+)\s+נושאים/);
  const filteredCount = countMatch ? Number(countMatch[1]) : -1;
  check('filtered count > 0 and < 50', filteredCount > 0 && filteredCount < 50, statusAfter);

  // Grade-8 tab should carry q
  const grade8Href = await page.$eval('#grade-tab-8', (a) => a.getAttribute('href') || '');
  check(
    'grade-8 tab preserves q',
    grade8Href.includes('grade=8') && decodeURIComponent(grade8Href).includes('משוואות'),
    grade8Href
  );

  // Viewer level link back= should include q
  const backSample = await page.$$eval('a.lvl', (as) => {
    for (const a of as) {
      const href = a.getAttribute('href') || '';
      if (href.includes('back=')) {
        try {
          const u = new URL(href, location.origin);
          return u.searchParams.get('back') || '';
        } catch {
          const m = href.match(/[?&]back=([^&]+)/);
          return m ? decodeURIComponent(m[1]) : '';
        }
      }
    }
    return '';
  });
  check(
    'viewer back includes q',
    !!backSample && backSample.includes('grade=7') && decodeURIComponent(backSample).includes('משוואות'),
    backSample
  );

  // Navigate to grade 8 then Back
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 60000 }),
    page.click('#grade-tab-8'),
  ]);
  check('landed grade 8', new URL(page.url()).searchParams.get('grade') === '8', page.url());
  check(
    'grade 8 kept q',
    new URL(page.url()).searchParams.get('q') === 'משוואות',
    page.url()
  );

  await page.goBack({ waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForSelector('[data-catalog-search]', { timeout: 30000 });
  await sleep(500);
  const backUrl = page.url();
  const bu = new URL(backUrl);
  check('back to grade 7', bu.searchParams.get('grade') === '7', backUrl);
  check('back restored q', bu.searchParams.get('q') === 'משוואות', backUrl);
  const searchVal = await page.$eval('[data-catalog-search]', (el) => el.value);
  check('search input restored', searchVal === 'משוואות', searchVal);
  const statusBack = await page.$eval('[data-catalog-status]', (el) => el.textContent || '');
  check('status still filtered', /נושאים תואמים/.test(statusBack), statusBack);

  // Deep-link hydrate
  await page.goto(`${BASE}/worksheets?grade=7&q=${encodeURIComponent('משוואות')}&cross=1`, {
    waitUntil: 'networkidle2',
    timeout: 60000,
  });
  await page.waitForSelector('[data-catalog-search]', { timeout: 30000 });
  await sleep(400);
  const deepQ = await page.$eval('[data-catalog-search]', (el) => el.value);
  const deepCross = await page.$eval('[data-catalog-cross-input]', (el) => el.checked);
  check('deep-link hydrates q', deepQ === 'משוואות', deepQ);
  check('deep-link hydrates cross', deepCross === true, String(deepCross));
} catch (e) {
  results.ok = false;
  results.error = String(e && e.stack ? e.stack : e);
  console.error(results.error);
} finally {
  await browser.close();
  writeFileSync(join(outDir, 'gate.json'), JSON.stringify(results, null, 2));
  console.log('wrote', join(outDir, 'gate.json'));
}

process.exit(results.ok ? 0 : 1);
