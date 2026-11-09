import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { buildIndex } from '../src/lib/siteSearch/buildIndex';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';
import type { CatalogV1 } from '../src/lib/catalog/types';

const require = createRequire(import.meta.url);
const publicRoot = new URL('../public/', import.meta.url);
const repoRoot = new URL('../../../', import.meta.url);
const registry = JSON.parse(readFileSync(new URL('headless/catalog/worksheet-editions.v1.json', repoRoot), 'utf8'));
const actual = registry.editions.find((e: any) => e.grade === 3 && e.topicId === 10 && e.status === 'published');
assert.ok(actual, 'real first elementary edition must be present');
assert.deepEqual(actual.levels.map((l: any) => l.key).sort(), ['a', 'b', 'c']);
const pdfHref = (id: string) => `https://static.wixstatic.com/ugd/d8e7ad_${id}.pdf`;
const viewerPath = '/worksheet-viewer-noam.html';
const previewOrigin = 'https://abc123-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
const productionOrigin = 'https://www.noamdoronmath.co.il';
const copies = [repoRoot, publicRoot].map(root => {
  const html = readFileSync(new URL('worksheet-viewer-noam.html', root), 'utf8');
  const { document } = parseHTML(html);
  const scripts = Array.from(document.querySelectorAll('script'));
  const early = document.getElementById('noam-preview-viewer-redirect')?.textContent;
  const main = scripts.find(s => s.textContent?.includes('var mobileLayout ='))?.textContent;
  const adapter = document.getElementById('exact-viewer-adapter')?.textContent;
  assert.ok(early && main && adapter, 'exercise the complete released IIFEs, not a hand-written substitute');
  return { root, html, early, main, adapter };
});
function query(level = actual.levels[0], changes: Record<string, string> = {}) {
  return new URLSearchParams({ g: '3', x: 'G3-T10', lv: level.key, pdf: level.pdfId,
    edition: actual.editionId, ...changes }).toString();
}
function context(searchText: string, origin = productionOrigin) {
  const url = new URL(viewerPath + '?' + searchText + '#kept', origin);
  const replacements: string[] = [], calls: string[] = [];
  const { document } = parseHTML('<html><body><button id="noamAiToggle">רמזים</button><div id="panel"></div></body></html>');
  const c: any = { URL, URLSearchParams, document, console,
    location: { href: url.href, hostname: url.hostname, pathname: url.pathname, search: url.search,
      hash: url.hash, replace(target: string) { replacements.push(target); } } };
  c.window = c; c.self = c; c.top = c;
  // Trip on reads as well as calls. This catches state restoration, owner
  // lookups, PDF preload and hint initialization before an asynchronous fetch.
  c.matchMedia = () => { calls.push('matchMedia'); throw Error('unexpected access: matchMedia'); };
  for (const name of ['fetch', 'XMLHttpRequest', 'localStorage', 'sessionStorage',
    'NoamCuratedHints', 'NoamOwner', 'NoamOwnerClient', 'NoamEnsureSupabase', 'supabase']) {
    Object.defineProperty(c, name, { configurable: true, get() { calls.push(name); throw Error('unexpected access: ' + name); } });
  }
  return { c, document, replacements, calls };
}

test('all three real published levels open direct PDFs from catalog and search; learning remains legacy only', () => {
  const committed = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')) as CatalogV1;
  const catalog = mergeWorksheetEditions(committed, registry) as CatalogV1;
  const topic = catalog.grades.find(g => g.grade === 3)!.topics.find(t => t.id === 10)!;
  const edition = topic.editions!.find(e => e.editionId === actual.editionId)!;
  assert.equal(edition.routing.usesViewer, false);
  assert.equal(edition.routing.aiHintShown, false);
  for (const level of edition.levels) assert.equal(buildWorksheetHref({ catalog, grade: 3, topic,
    levelKey: level.key, editionId: edition.editionId }), catalog.config.pdfBase + level.pdfId + '.pdf');
  const index = buildIndex({ catalog, pages: [], posts: [], termsDecisions: [] }).index;
  const hit = search(prepareIndex(index), topic.title, { grade: 3 }).results.find(r => r.key === 'topic:3:10');
  assert.ok(hit); assert.equal(hit.levels.length, 3);
  assert.deepEqual(hit.levels.map(l => l.href).sort(), edition.levels.map(l => catalog.config.pdfBase + l.pdfId + '.pdf').sort());
  const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
  const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
  const baseline = buildLearningCatalog(loadIndexCatalog(), { version: 1, editions: [] });
  const published = buildLearningCatalog(loadIndexCatalog(), registry);
  assert.equal(published.length, 967); // +3: grade 8 topic 67 (2026-11-09)
  assert.deepEqual(published, baseline, 'no new progress identities without the DB rollout');
  assert.ok(published.every((row: any) => !row.editionId));
});

test('both viewer copies redirect real historical elementary URLs before main state, owner, PDF or hints initialization', () => {
  for (const copy of copies) for (const origin of [productionOrigin, previewOrigin]) for (const level of actual.levels) {
    const s = context(query(level), origin);
    runInNewContext(copy.early, s.c);
    assert.equal(s.c.NOAM_ELEMENTARY_PDF_ONLY, true);
    assert.deepEqual(s.replacements, [pdfHref(level.pdfId)]);
    runInNewContext(copy.main, s.c);
    assert.equal(s.document.body.textContent, 'פותחים את דף העבודה…');
    assert.equal(s.document.querySelector('#noamAiToggle'), null);
    assert.deepEqual(s.calls, []);
  }
});

test('invalid elementary prefix, level, edition and PDF fail closed without redirect or main initialization', () => {
  const invalid: Array<Record<string, string>> = [
    { x: 'G9-T10' }, { x: 'G3-T1' }, { x: 'G3-T10\n' },
    { lv: 'A' }, { lv: 'one' }, { lv: 'c2' }, { lv: '' }, { lv: 'b\n' },
    { edition: '' }, { edition: 'legacy' }, { edition: 'UPPER' }, { edition: '../x' },
    { edition: 'a'.repeat(65) }, { edition: 'valid\n' },
    { pdf: 'f'.repeat(31) }, { pdf: 'f'.repeat(33) }, { pdf: 'g'.repeat(32) }, { pdf: 'https://evil.test/x.pdf' },
  ];
  for (const copy of copies) for (const change of invalid) {
    const s = context(query(undefined, change));
    runInNewContext(copy.early, s.c);
    assert.equal(s.c.NOAM_ELEMENTARY_PDF_ONLY, true);
    assert.deepEqual(s.replacements, [], JSON.stringify(change));
    runInNewContext(copy.main, s.c);
    assert.equal(s.document.body.textContent, 'הקישור לדף העבודה אינו תקין.');
    assert.deepEqual(s.calls, []);
  }
});

test('malformed elementary grade cannot bypass PDF-only via the later parseInt parser', () => {
  for (const copy of copies) for (const grade of ['3junk', '3.5', '3/9']) {
    const s = context(query(undefined, { g: grade }));
    runInNewContext(copy.early, s.c);
    assert.equal(s.c.NOAM_ELEMENTARY_PDF_ONLY, true, `must fail closed for ${grade}`);
    assert.deepEqual(s.replacements, []);
    runInNewContext(copy.main, s.c);
    assert.equal(s.document.body.textContent, 'הקישור לדף העבודה אינו תקין.');
    assert.deepEqual(s.calls, []);
  }
});

test('grades 7–9 retain their production viewer and existing preview-to-production redirect', () => {
  for (const copy of copies) for (const grade of [7, 8, 9]) {
    const params = new URLSearchParams({ g: String(grade), x: `G${grade}-T10`, lv: 'b', pdf: 'a'.repeat(32) });
    const prod = context(params.toString()); runInNewContext(copy.early, prod.c);
    assert.equal(prod.c.NOAM_ELEMENTARY_PDF_ONLY, undefined); assert.deepEqual(prod.replacements, []);
    const preview = context(params.toString(), previewOrigin); runInNewContext(copy.early, preview.c);
    assert.equal(preview.c.NOAM_ELEMENTARY_PDF_ONLY, undefined);
    assert.deepEqual(preview.replacements, [productionOrigin + viewerPath + '?' + params + '#kept']);
    // Prove the new main guard does not swallow the middle-school path: the
    // first legacy initialization is still reached, and deliberately trapped.
    assert.throws(() => runInNewContext(copy.main, prod.c), /unexpected access: matchMedia/);
    assert.deepEqual(prod.calls, ['matchMedia']);
  }
});

test('post-main adapter, learning boot and site companion also stay inert even when redirect cannot navigate', () => {
  for (const copy of copies) for (const change of [{}, { edition: 'legacy' }]) {
    const s = context(query(undefined, change));
    runInNewContext(copy.early, s.c); runInNewContext(copy.main, s.c);
    const originalText = s.document.body.textContent;
    runInNewContext(copy.adapter, s.c);
    // A signed-in/OAuth-return page would otherwise ask the boot code for the
    // Supabase SDK. The same guard must run before consulting this config.
    s.c.NOAM_LEARNING_CONFIG = { googleEnabled: true };
    for (const asset of ['noam-learning-boot.js', 'noam-site-companion.js']) {
      runInNewContext(readFileSync(new URL(asset, copy.root), 'utf8'), s.c, { filename: asset });
    }
    assert.deepEqual(s.calls, []);
    assert.equal(s.document.body.textContent, originalText);
    assert.equal(s.document.querySelectorAll('script, button, form, input').length, 0);
    assert.equal(s.c.__noamSiteCompanion, undefined);
    assert.equal(Object.getOwnPropertyDescriptor(s.c, 'NoamEnsureSupabase')?.set, undefined);
  }
});

test('real Chromium invalid-link page has no later AI, learning SDK, manifest or hints activity', async () => {
  const browser = await puppeteer.launch({ executablePath: resolveTestBrowser(), headless: true });
  try {
    for (const copy of copies) {
      const page = await browser.newPage(); const requests: string[] = [], errors: string[] = [];
      await page.setRequestInterception(true);
      page.on('request', request => {
        const url = new URL(request.url()); requests.push(url.href);
        if (url.pathname === viewerPath) return void request.respond({ status: 200, contentType: 'text/html', body: copy.html });
        if (url.hostname === 'pdf-only.test' && url.pathname.endsWith('.js')) {
          try { return void request.respond({ status: 200, contentType: 'application/javascript',
            body: readFileSync(new URL(url.pathname.slice(1), copy.root), 'utf8') }); } catch { /* optional asset below */ }
        }
        void request.respond({ status: 204, body: '' });
      });
      page.on('pageerror', error => errors.push(String(error)));
      await page.goto('https://pdf-only.test' + viewerPath + '?' + query(undefined, { edition: 'legacy' }), { waitUntil: 'networkidle0' });
      assert.match(await page.$eval('body', node => node.innerText), /^הקישור לדף העבודה אינו תקין\./);
      assert.equal(await page.$$eval('#noamAiToggle, #fab, #panel, .noam-site-companion', nodes => nodes.length), 0);
      assert.equal(await page.evaluate(() => (window as any).__noamSiteCompanion), undefined);
      assert.ok(!requests.some(href => {
        const url = new URL(href);
        return url.hostname.endsWith('.supabase.co') ||
          /\/vendor\/supabase|\/noam-learning\.js$|\/noam-learning-auth-redirect\.js$|\/manifests\/|\/rest\/v1\/|\/api\/noam/.test(url.pathname);
      }), JSON.stringify(requests));
      assert.deepEqual(errors, []);
      await page.close();
    }
  } finally { await browser.close(); }
});
