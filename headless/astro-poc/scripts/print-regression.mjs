#!/usr/bin/env node
/**
 * Render the fixed print regression set and nothing else.
 *
 * After every print fix, run this first:
 *   node scripts/print-regression.mjs
 * from headless/astro-poc, with the teachers page already served.
 * PNGs land in /opt/cursor/artifacts/pr95-<sha>/regression/.
 * The full print set waits until this regression is reported passed.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const fixturePath = join(root, 'tests/fixtures/print-regression-set.json');
const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'));
const cases = fixture.cases || [];
if (!cases.length) throw new Error('print regression set is empty');

const sha = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
const outDir = `/opt/cursor/artifacts/pr95-${sha}/regression`;
mkdirSync(outDir, { recursive: true });

const base = process.env.PRINT_BASE || 'http://127.0.0.1:8765';
const chrome = process.env.CHROME_PATH || '/opt/google/chrome/chrome';

async function loadChromium() {
  const candidates = [
    'playwright',
    '/home/ubuntu/.npm/_npx/9833c18b2d85bc59/node_modules/playwright/index.js',
  ];
  let last;
  for (const specifier of candidates) {
    try {
      const mod = await import(specifier);
      const chromium = mod.chromium || mod.default?.chromium;
      if (chromium) return chromium;
    } catch (error) {
      last = error;
    }
  }
  throw last || new Error('playwright is not installed');
}

function sessionKey(item) {
  return [item.grade, item.topic, item.level, item.sheetId, item.selection.join('\n')].join('|');
}

const chromium = await loadChromium();
const browser = await chromium.launch({
  executablePath: chrome,
  headless: true,
  args: ['--disable-dev-shm-usage', '--font-render-hinting=none'],
});

const rendered = new Map();
const pages = [];

try {
  for (const item of cases) {
    const key = sessionKey(item);
    if (!rendered.has(key)) rendered.set(key, await renderCase(item));
    const sheets = rendered.get(key);
    const wanted = Array.isArray(item.pages) && item.pages.length
      ? item.pages
      : sheets.map((_, index) => index + 1);
    for (const pageNo of wanted) {
      const info = sheets[pageNo - 1];
      if (!info) {
        throw new Error(`${item.id} asked for page ${pageNo} but the print has ${sheets.length} page(s)`);
      }
      const name = `${item.id}-page-${pageNo}.png`;
      const path = join(outDir, name);
      // A comment keeps two cases that share a sheet from being dropped as one file.
      writeFileSync(path, pngComment(info.bytes, item.id));
      const written = statSync(path);
      if (!written.isFile() || !(written.size > 0)) {
        throw new Error(`${name} was not produced`);
      }
      const entry = {
        file: name,
        path,
        case: item.id,
        page: pageNo,
        pages: sheets.length,
        width: info.w,
        height: info.h,
        sheetId: item.sheetId,
        grade: item.grade,
        topic: item.topic,
        level: item.level,
        selection: item.selection,
        failedBefore: item.failedBefore,
      };
      pages.push(entry);
      console.log('PNG', name, `${info.w}x${info.h}`, item.failedBefore);
    }
  }
} finally {
  await browser.close();
}

const manifest = {
  commit: sha,
  purpose: fixture.purpose,
  output: fixture.output,
  pages,
};
writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
console.log('REGRESSION', outDir);
console.log('DONE', pages.length);

function pngComment(png, comment) {
  const type = Buffer.from('tEXt');
  const data = Buffer.concat([Buffer.from('Comment\0', 'latin1'), Buffer.from(String(comment), 'latin1')]);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([type, data])) >>> 0, 0);
  const chunk = Buffer.concat([len, type, data, crc]);
  const marker = Buffer.from('IEND');
  const iend = png.lastIndexOf(marker);
  if (iend < 4) return png;
  return Buffer.concat([png.subarray(0, iend - 4), chunk, png.subarray(iend - 4)]);
}

async function renderCase(item) {
  const selected = item.selection.map((id) => `ex:${item.sheetId}:${id}`);
  const context = await browser.newContext({ viewport: { width: 1280, height: 1600 } });
  await context.addInitScript((saved) => {
    sessionStorage.setItem('teachers-wizard', JSON.stringify(saved));
  }, {
    grade: item.grade,
    topic: item.topic,
    level: item.level,
    scenario: 'other',
    style: 'scaffold',
    selected,
    output: 'short',
    query: '',
    note: '',
  });
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error)));
  console.log('OPEN', item.id, 'n', item.selection.length);
  await page.goto(`${base}/teachers/#summary`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction((want) => {
    const count = document.getElementById('selection-count');
    return count && new RegExp('^\\s*' + want + '\\b').test(count.textContent || '');
  }, item.selection.length, { timeout: 90000 });
  const count = (await page.locator('#selection-count').innerText()).replace(/\s+/g, ' ');
  console.log('COUNT', item.id, count);
  await page.evaluate(() => document.getElementById('prepare-short').click());
  await page.waitForFunction(() => {
    const canvases = document.querySelectorAll('#print-area canvas');
    return canvases.length > 0 && [...canvases].every((canvas) => canvas.width > 200 && canvas.height > 200);
  }, null, { timeout: 240000 });
  const sheetCount = await page.locator('#print-area canvas').count();
  console.log('SHEETS', item.id, sheetCount, 'errors', errors.length);
  if (errors.length) throw new Error(`${item.id} page error: ${errors[0]}`);
  const sheets = [];
  for (let index = 0; index < sheetCount; index += 1) {
    const info = await page.locator('#print-area canvas').nth(index).evaluate((node) => {
      if (node.width < 200 || node.height < 200) return null;
      return { w: node.width, h: node.height, url: node.toDataURL('image/png') };
    });
    if (!info) throw new Error(`empty canvas ${item.id} ${index}`);
    sheets.push({ w: info.w, h: info.h, bytes: Buffer.from(info.url.split(',')[1], 'base64') });
  }
  await context.close();
  return sheets;
}
