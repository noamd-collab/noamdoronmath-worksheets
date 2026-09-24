/**
 * HEADLESS-MIGRATION-33 — בס״ד must sit in the physical TOP-RIGHT
 * (not RTL logical inline-end, which is left).
 *
 * Usage: PREVIEW_BASE=https://… node scripts/check-m33-basad-rect.mjs
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

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'reports', 'm33-basad');
mkdirSync(outDir, { recursive: true });
const chromePath = process.env.CHROME_PATH || '/usr/bin/google-chrome-stable';

const PATHS = ['/', '/worksheets?grade=7', '/equations-basics-grade-7'];
const report = { base: BASE, checks: [], ok: true };

function note(name, pass, detail = '') {
  report.checks.push({ name, pass, detail });
  if (!pass) report.ok = false;
  console.log(pass ? 'OK' : 'FAIL', name, detail);
}

const browser = await puppeteer.launch({
  executablePath: chromePath,
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  for (const size of [
    { name: 'desktop', width: 1280, height: 900 },
    { name: '390', width: 390, height: 844 },
  ]) {
    const page = await browser.newPage();
    await page.setViewport(size);
    for (const path of PATHS) {
      await page.goto(BASE + path, { waitUntil: 'networkidle2', timeout: 60000 });
      const info = await page.evaluate(() => {
        const el = document.querySelector('[data-basad], .basad');
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return {
          left: r.left,
          right: r.right,
          top: r.top,
          width: r.width,
          vw: window.innerWidth,
          text: (el.textContent || '').trim(),
        };
      });
      const label = `${size.name} ${path}`;
      if (!info) {
        note(label, false, 'basad missing');
        continue;
      }
      // Physical top-right: right edge near viewport right; left edge in right half
      const margin = size.width <= 400 ? 16 : 24;
      const nearRight = info.right >= info.vw - margin;
      const inRightHalf = info.left > info.vw / 2;
      const nearTop = info.top >= 0 && info.top <= 24;
      note(
        label,
        nearRight && inRightHalf && nearTop && /בס/.test(info.text),
        JSON.stringify(info)
      );
    }
    await page.close();
  }
} catch (e) {
  report.ok = false;
  report.error = String(e && e.stack ? e.stack : e);
  console.error(report.error);
} finally {
  await browser.close();
  writeFileSync(join(outDir, 'basad-rect.json'), JSON.stringify(report, null, 2));
}

process.exit(report.ok ? 0 : 1);
