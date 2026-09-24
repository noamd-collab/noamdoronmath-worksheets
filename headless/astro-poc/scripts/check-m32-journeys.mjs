/**
 * HEADLESS-MIGRATION-32 — journey smoke (desktop + 390) without Noam AI.
 * Usage: PREVIEW_BASE=https://… node scripts/check-m32-journeys.mjs
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

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'm32-journeys');
mkdirSync(outDir, { recursive: true });
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchStatus(path, attempts = 5) {
  const statuses = [];
  for (let i = 0; i < attempts; i++) {
    const r = await fetch(BASE + path, { redirect: 'follow' });
    statuses.push(r.status);
    await sleep(200);
  }
  return statuses;
}

const report = { base: BASE, viewports: {}, fiveHundreds: {}, learning: {}, ok: true };

function note(vp, name, pass, detail = '') {
  report.viewports[vp] = report.viewports[vp] || { checks: [] };
  report.viewports[vp].checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', `[${vp}]`, name, detail);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const [vp, size] of [
    ['desktop', { width: 1280, height: 900 }],
    ['390', { width: 390, height: 844 }],
  ]) {
    const page = await browser.newPage();
    await page.setViewport(size);

    // home
    await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
    const h1 = await page.$eval('h1', (el) => el.textContent || '').catch(() => '');
    note(vp, 'home loads', !!h1, h1.slice(0, 40));
    const basad = await page.evaluate(() => {
      const t = document.body?.innerText || '';
      return t.includes('בס״ד') || t.includes('בס"ד') || !!document.querySelector('[data-basad], .basad');
    });
    note(vp, 'basad present', basad);

    // grade hub
    await page.goto(BASE + '/grade-7', { waitUntil: 'networkidle2', timeout: 60000 });
    const topicLocal = await page.$$eval('a[data-topic-path]', (as) =>
      as.slice(0, 5).map((a) => a.getAttribute('href'))
    );
    note(
      vp,
      'grade-7 topics local',
      topicLocal.length > 0 && topicLocal.every((h) => h && h.startsWith('/')),
      JSON.stringify(topicLocal)
    );

    // catalog search → level href (viewer or pdf)
    await page.goto(BASE + '/worksheets?grade=7', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForSelector('[data-catalog-search]', { timeout: 30000 });
    await page.click('[data-catalog-search]', { clickCount: 3 });
    await page.type('[data-catalog-search]', 'משוואות', { delay: 30 });
    await sleep(600);
    const urlQ = new URL(page.url()).searchParams.get('q');
    note(vp, 'search in url', urlQ === 'משוואות', page.url());

    const levelInfo = await page.$$eval('a.lvl', (as) => {
      for (const a of as) {
        const href = a.getAttribute('href') || '';
        if (!href) continue;
        return { href, text: a.textContent?.trim() };
      }
      return null;
    });
    note(vp, 'level link present', !!levelInfo, JSON.stringify(levelInfo)?.slice(0, 120));

    if (levelInfo?.href) {
      const abs = new URL(levelInfo.href, BASE);
      const isPdf = abs.pathname.endsWith('.pdf') || abs.hostname.includes('wixstatic');
      const isViewer =
        abs.pathname.includes('worksheet-viewer') || abs.hostname.includes('github.io');
      note(vp, 'level is viewer or wix pdf', isPdf || isViewer, abs.href.slice(0, 100));
      if (isViewer) {
        const back = abs.searchParams.get('back') || '';
        note(vp, 'viewer back has q', decodeURIComponent(back).includes('משוואות'), back);
      }
    }

    // deep-link restore
    await page.goto(BASE + '/worksheets?grade=7&q=' + encodeURIComponent('משוואות'), {
      waitUntil: 'networkidle2',
      timeout: 60000,
    });
    await page.waitForSelector('[data-catalog-search]', { timeout: 30000 });
    await sleep(300);
    const restored = await page.$eval('[data-catalog-search]', (el) => el.value);
    note(vp, 'deep-link search', restored === 'משוואות', restored);

    await page.close();
  }

  // Recurring 500 probe — multiple paths, multiple attempts (not one lucky retry)
  const probePaths = [
    '/',
    '/grade-7',
    '/worksheets?grade=7',
    '/equations-basics-grade-7',
    '/learning.html',
    '/blog',
    '/post/assessment-1-grade-7',
    '/aboutus',
  ];
  for (const p of probePaths) {
    const statuses = await fetchStatus(p, 6);
    const fives = statuses.filter((s) => s >= 500).length;
    const oks = statuses.filter((s) => s === 200).length;
    report.fiveHundreds[p] = { statuses, fives, oks };
    const pass = fives === 0;
    if (!pass) report.ok = false;
    console.log(pass ? 'OK' : 'FAIL', '500-probe', p, statuses.join(','));
  }

  // Guest learning progress — disposable key only
  {
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 900 });
    await page.goto(BASE + '/learning.html', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(1500);
    const prog = await page.evaluate(() => {
      const keys = Object.keys(localStorage).filter(
        (k) => /noam|learning|progress|guest/i.test(k)
      );
      const sample = {};
      for (const k of keys.slice(0, 8)) {
        sample[k] = String(localStorage.getItem(k) || '').slice(0, 80);
      }
      // disposable write
      const testKey = 'm32-disposable-guest-test';
      localStorage.setItem(testKey, JSON.stringify({ t: Date.now(), mark: 'm32' }));
      const roundtrip = localStorage.getItem(testKey);
      localStorage.removeItem(testKey);
      return {
        keys,
        sample,
        roundtripOk: !!roundtrip && roundtrip.includes('m32'),
        hasApp: !!document.getElementById('learning-app') || !!document.querySelector('[data-learning], .nl-account, main'),
      };
    });
    report.learning = prog;
    const pass = prog.roundtripOk;
    if (!pass) report.ok = false;
    console.log(pass ? 'OK' : 'FAIL', 'guest localStorage disposable', JSON.stringify(prog.keys));
    await page.close();
  }
} catch (e) {
  report.ok = false;
  report.error = String(e && e.stack ? e.stack : e);
  console.error(report.error);
} finally {
  await browser.close();
  writeFileSync(join(outDir, 'journeys.json'), JSON.stringify(report, null, 2));
  console.log('wrote', join(outDir, 'journeys.json'));
}

process.exit(report.ok ? 0 : 1);
