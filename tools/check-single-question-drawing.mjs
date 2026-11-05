#!/usr/bin/env node
/**
 * Offline browser regression for the single-drawing control. Real viewer,
 * manifests, native source files and renderers; a text-only assistant reply is
 * seeded because this check must never call the live AI or verification APIs.
 * Current public PDFs are cached before launch; hash differences from manifest
 * metadata are recorded separately from UI assertions.
 * Bundled PDF.js and cached PDFs are served locally; all off-origin browser
 * requests are blocked at the browser request layer. No security
 * settings or production functions are changed.
 *
 * CHROME_PATH=/path/to/chrome node tools/check-single-question-drawing.mjs
 * Optional: DRAWING_QA_OUTPUT=/absolute/screenshot/directory
 *           DRAWING_QA_REPORT=/absolute/report.json
 */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { homedir, tmpdir } from 'node:os';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(root, 'headless/astro-poc/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = [process.env.CHROME_PATH,
  join(homedir(), 'Library/Caches/ms-playwright/chromium_headless_shell-1248/chrome-headless-shell-mac-arm64/chrome-headless-shell'),
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
assert.ok(chrome, 'Set CHROME_PATH to an installed Chromium browser');
const catalog = JSON.parse(readFileSync(join(root, 'headless/astro-poc/src/data/catalog.v1.json'), 'utf8'));
const fixtures = [
  ['parallelogram-trapezoid', 'G7-T45'],
  ['analytic-geometry', 'G9-T08'],
  ['signed-numbers', 'G7-T02'],
].flatMap(([name, prefix]) => {
  const topic = catalog.grades.flatMap(grade => grade.topics).find(topic => topic.noamTopicId === prefix);
  assert.ok(topic, `Missing current catalog topic ${prefix}`);
  return topic.levels.filter(level => name !== 'signed-numbers' || level.key === 'a')
    .map(level => [name === 'signed-numbers' ? name : `${name}-${level.key}`, level.pdfId]);
});
const pdfCache = process.env.DRAWING_QA_CACHE || join(tmpdir(), 'noam-drawing-qa-pdfs');
mkdirSync(pdfCache, { recursive: true });
const cachedPdfs = new Map();
const sourcePdfHashes = [];
for (const [, pdf] of fixtures) {
  const manifest = JSON.parse(readFileSync(join(root, 'noam-ai/manifests', pdf + '.json'), 'utf8'));
  const file = join(pdfCache, pdf + '.pdf');
  let bytes = existsSync(file) ? readFileSync(file) : null;
  const digest = data => createHash('sha256').update(data).digest('hex');
  if (!bytes || digest(bytes) !== manifest.sourceSha256) {
    const response = await fetch(`https://static.wixstatic.com/ugd/d8e7ad_${pdf}.pdf`);
    assert.ok(response.ok, `Download source PDF ${pdf}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());

    writeFileSync(file, bytes);
  }
  sourcePdfHashes.push({pdf, expected:manifest.sourceSha256, actual:digest(bytes), matches:digest(bytes)===manifest.sourceSha256});
  cachedPdfs.set(`/qa-pdfs/${pdf}.pdf`, bytes);
}
const out = process.env.DRAWING_QA_OUTPUT;
if (out) mkdirSync(out, { recursive: true });
const contentTypes = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml', '.css': 'text/css', '.png': 'image/png' };
const server = createServer((request, response) => {
  const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
  if (cachedPdfs.has(pathname)) {
    response.writeHead(200, { 'Content-Type': 'application/pdf' });
    response.end(cachedPdfs.get(pathname)); return;
  }
  if (pathname.startsWith('/qa-pdfjs/')) {
    const base = join(root, 'headless/astro-poc/node_modules/pdfjs-dist');
    const path = resolve(base, pathname.slice('/qa-pdfjs/'.length));
    if (path.startsWith(base + '/') && existsSync(path) && statSync(path).isFile()) {
      response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] || 'application/octet-stream' });
      response.end(readFileSync(path)); return;
    }
  }
  for (const base of [join(root, 'headless/astro-poc/public'), root]) {
    const path = resolve(base, '.' + pathname);
    if (!path.startsWith(base + '/') || !existsSync(path) || !statSync(path).isFile()) continue;
    response.writeHead(200, { 'Content-Type': contentTypes[extname(path)] || 'application/octet-stream' });
    let body = readFileSync(path);
    if (pathname === '/worksheet-viewer-noam.html') {
      // Expose a closure inspector in this ephemeral offline response only.
      // The real IIFE, event handlers and renderers still execute unchanged.
      body = body.toString('utf8').replace('\"https://static.wixstatic.com/ugd/d8e7ad_\"', '\"/qa-pdfs/\"').replace(/var PDFJS_BASE =[\s\S]*?;/, 'var PDFJS_BASE = \"/qa-pdfjs/\";').replace(/<script>([\s\S]*?)<\/script>/g, (tag, source) => {
        if (!source.includes('function requestNoamDiagram(')) return tag;
        const end = source.lastIndexOf('})();');
        assert.ok(end > 0, 'Viewer closure must exist');
        return '<script>' + source.slice(0, end) + '\nwindow.__drawingQA={evaluate:function(source){return eval(source);}};\n' + source.slice(end) + '</script>';
      });
    }
    response.end(body);
    return;
  }
  response.writeHead(404); response.end('Not found');
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, protocolTimeout: 30000, args: ['--disable-background-networking', '--disable-component-update'] });
const report = { offline: true, cachedSourcePdfs: true, sourcePdfHashes, realRenderers: true, checks: [], blockedExternalRequests: 0, failures: [] };

const snapshot = () => {
  const thread = exerciseThread(selectedExercise.id);
  const buttons = [...document.querySelectorAll('#noamDraw, .noam-draw-action:not(.noam-diagram-expand)')];
  return {
    visibleButtons: buttons.filter(b => !b.hidden && getComputedStyle(b).display !== 'none' && b.getClientRects().length).length,
    drawings: document.querySelectorAll('#noamTranscript .noam-bubble > .noam-geometry').length,
    visuals: thread.messages.filter(m => m.visual).length,
    pending: !!noamPendingQuestionDrawing(thread),
    errors: thread.messages.filter(m => m.diagramError).map(m => m.diagramErrorCode),
  };
};
const inspect = (page, fn) => page.evaluate(source => window.__drawingQA.evaluate('(' + source + ')()'), fn.toString());
const wait = (page, fn, timeout = 15000) => page.waitForFunction(source => window.__drawingQA && window.__drawingQA.evaluate('(' + source + ')()'), { timeout }, fn.toString());
try {
  for (const viewport of [{ name: 'desktop', width: 1440, height: 1000 }, { name: 'phone', width: 390, height: 844, isMobile: true, hasTouch: true }]) {
    const page = await browser.newPage();
    const pageErrors = [];
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setViewport(viewport);
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (request.url().startsWith(origin + '/') || /^(?:data|blob):/.test(request.url())) return request.continue();
      report.blockedExternalRequests++;
      return request.abort('blockedbyclient');
    });
    for (const [name, pdf] of fixtures) {
      const manifest = JSON.parse(readFileSync(join(root, 'noam-ai/manifests', pdf + '.json'), 'utf8'));
      const query = new URLSearchParams({ g: manifest.prefix.slice(1, 2), x: manifest.prefix, lv: manifest.level, pdf, t: manifest.topic });
      console.log(`CHECK ${viewport.name} ${name}`);
      await page.goto(`${origin}/worksheet-viewer-noam.html?${query}`, { waitUntil: 'domcontentloaded' });
      console.log('  loaded');
      await wait(page, () => manifestReady && typeof noamPendingQuestionDrawing === 'function', 10000).catch(async error => {
        const state = await page.evaluate(() => ({ inspector: !!window.__drawingQA, scripts: document.scripts.length, title: document.title }));
        throw new Error(`${name}: ${error.message}; state=${JSON.stringify(state)}; errors=${JSON.stringify(pageErrors)}`);
      });
      console.log('  manifest ready');
      await page.waitForSelector('.noam-exercise-pin', { timeout: 20000 });
      // Cover the real authored first question for each level. The independent
      // catalog unit sweep covers every eligible topic with all drawing families.
      await inspect(page, () => {
        selectedExercise = manifest.exercises[0];
        threads = {};
        exerciseThread(selectedExercise.id).messages.push(
          { role: 'user', text: 'רמז 1', kind: 'רמז 1' },
          { role: 'assistant', text: 'בדקו את הנתונים בשאלה ואת הקשר בין הבסיס לגובה.' }
        );
        var pin=[...document.querySelectorAll('.noam-exercise-pin')].find(pin =>
          (pin.dataset.exerciseIds || pin.dataset.exerciseId || '').split(' ').includes(selectedExercise.id));
        if(!pin){throw new Error('Selected question PDF pin is unavailable');}
        document.getElementById('noamAiToggle').click();
        selectManifestExercise(selectedExercise, pin);
      });
      console.log('  conversation ready');
      const before = await inspect(page, snapshot);
      console.log('  initial', JSON.stringify(before));
      if (name === 'signed-numbers') {
        assert.equal(before.visibleButtons, 0, `${viewport.name} ${name}: no drawing action outside geometry`);
        report.checks.push({ viewport: viewport.name, name, before, policy: 'denied' });
        continue;
      }
      assert.ok(before.visibleButtons > 0, `${viewport.name} ${name}: initial drawing action`);
      // Two consecutive events retain the original element, exercising a stale
      // handler after the first event rerenders the composer.
      await page.evaluate(() => { const b = document.getElementById('noamDraw'); b.click(); b.click(); });
      console.log('  clicked');
      await wait(page, () => !noamPendingQuestionDrawing(exerciseThread(selectedExercise.id)));
      const after = await inspect(page, snapshot);
      assert.equal(after.drawings, 1, `${viewport.name} ${name}: one actual rendered drawing, errors=${after.errors}`);
      assert.equal(after.visibleButtons, 0, `${viewport.name} ${name}: all creation buttons disappear`);
      assert.equal(after.visuals, 1, `${viewport.name} ${name}: double click retains one visual`);
      // A new assistant reply and a typed drawing request cannot regenerate.
      await inspect(page, () => {
        exerciseThread(selectedExercise.id).messages.push({ role: 'assistant', text: 'אפשר להמשיך ולהסביר את השלב הבא.' });
        renderNoamChat();
        tryNoamLocalVisual('צייר לי שרטוט נוסף');
      });
      const later = await inspect(page, snapshot);
      assert.equal(later.drawings, 1, `${viewport.name} ${name}: one drawing after follow-up`);
      assert.equal(later.visibleButtons, 0, `${viewport.name} ${name}: no regenerate action`);
      // Persist/reload exercises the actual saved-transcript hydration path.
      await inspect(page, () => saveNoamState());
      await page.reload({ waitUntil: 'domcontentloaded' });
      await wait(page, () => manifestReady);
      await page.waitForSelector('.noam-exercise-pin', { timeout: 20000 });
      await inspect(page, () => {
        var pin=[...document.querySelectorAll('.noam-exercise-pin')].find(pin =>
          (pin.dataset.exerciseIds || pin.dataset.exerciseId || '').split(' ').includes(manifest.exercises[0].id));
        if(!pin){throw new Error('Restored question PDF pin is unavailable');}
        document.getElementById('noamAiToggle').click();
        selectManifestExercise(manifest.exercises[0],pin);
      });
      await page.waitForFunction(() => document.querySelector('#noamTranscript .noam-geometry'), { timeout: 15000 });
      const restored = await inspect(page, snapshot);
      assert.equal(restored.drawings, 1, `${viewport.name} ${name}: saved drawing restored once`);
      assert.equal(restored.visibleButtons, 0, `${viewport.name} ${name}: saved drawing suppresses controls`);
      if (out && ['parallelogram-trapezoid-a', 'analytic-geometry-b'].includes(name)) {
        await page.evaluate(() => { document.getElementById('noamTranscript').scrollTop = 0; });
        await page.$('#panel').then(el => el.screenshot({ path: join(out, `${name}-${viewport.name}.png`) }));
      }
      report.checks.push({ viewport: viewport.name, name, before, after, later, restored });
      console.log(`PASS ${viewport.name} ${name}: one drawing; controls absent after double click, follow-up and reload`);
    }
    await page.close();
  }
} catch (error) {
  report.failures.push(error.message);
  process.exitCode = 1;
} finally {
  await browser.close();
  await new Promise(r => server.close(r));
  if (process.env.DRAWING_QA_REPORT) writeFileSync(process.env.DRAWING_QA_REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ checks: report.checks.length, blockedExternalRequests: report.blockedExternalRequests, failures: report.failures }));
}
