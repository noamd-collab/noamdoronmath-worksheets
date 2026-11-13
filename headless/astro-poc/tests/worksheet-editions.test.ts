import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { build } from 'esbuild';
import { parseHTML } from 'linkedom';
import puppeteer from 'puppeteer-core';
import { resolveTestBrowser } from './helpers/chromium';
import type { CatalogTopic, CatalogV1 } from '../src/lib/catalog/types';
import { resolveEdition, topicEditions } from '../src/lib/catalog/editions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { buildIndex } from '../src/lib/siteSearch/buildIndex';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import { editionFixture, middleEditionFixture } from './fixtures/worksheet-editions';
import { mergeWorksheetEditions, worksheetLearningId } from '../../../scripts/lib/worksheet-editions.cjs';

const require = createRequire(import.meta.url);
const committed = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')) as CatalogV1;
// Synthetic registries start from legacy fields, regardless of which real
// editions are currently published. Do not use the merger itself as this oracle.
const base: CatalogV1 = { ...committed, grades: committed.grades.map(g => ({
  ...g, topics: g.topics.map(t => {
    const { editions, defaultEditionId, ...legacy } = t;
    return legacy;
  }),
})) };
const topic = (catalog: CatalogV1, grade = 1, id = 5) => catalog.grades.find(g => g.grade === grade)!.topics.find(t => t.id === id)!;
const elementary = (catalog: CatalogV1) => catalog.grades.filter(g => g.grade <= 6);
const registry = () => editionFixture();

test('empty registry preserves all 169 elementary topics and 507 legacy links byte-for-byte', () => {
  const actual = JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.v1.json', import.meta.url), 'utf8'));
  const merged = mergeWorksheetEditions(base, { version: 1, editions: [] });
  const production = mergeWorksheetEditions(base, actual);
  assert.deepEqual(production, committed, 'the committed snapshot must include the actual registry');
  for (const g of base.grades) for (const t of g.topics) assert.deepEqual(topic(production, g.grade, t.id).levels, t.levels);
  assert.equal(JSON.stringify(merged), JSON.stringify(base));
  assert.equal(elementary(merged).flatMap(g => g.topics).length, 169);
  assert.equal(elementary(merged).flatMap(g => g.topics.flatMap(t => t.levels)).length, 507);
  for (const g of base.grades) for (const t of g.topics) for (const level of t.levels) {
    assert.equal(buildWorksheetHref({ catalog: base, grade: g.grade, topic: t, levelKey: level.key }),
      buildWorksheetHref({ catalog: merged, grade: g.grade, topic: topic(merged, g.grade, t.id), levelKey: level.key, editionId: 'legacy' }));
  }
});

test('withdrawal removes real published overlays from a refreshed snapshot without changing legacy fields', () => {
  const before = JSON.stringify(committed);
  assert.deepEqual(mergeWorksheetEditions(committed, { version: 1, editions: [] }), base);
  assert.equal(JSON.stringify(committed), before);
});

test('only published complete editions are merged; original fields and inputs remain intact', () => {
  const rows = registry(); const before = JSON.stringify(base); const beforeRows = JSON.stringify(rows);
  const merged = mergeWorksheetEditions(base, rows);
  assert.equal(topicEditions(topic(merged)).length, 2);
  assert.equal(topicEditions(topic(merged, 2, 28)).length, 1);
  for (const g of base.grades) for (const t of g.topics) {
    const { editions, defaultEditionId, ...legacy } = topic(merged, g.grade, t.id);
    assert.deepEqual(legacy, t);
  }
  assert.equal(JSON.stringify(base), before); assert.equal(JSON.stringify(rows), beforeRows);
  rows.editions[0].status = 'draft';
  assert.deepEqual(mergeWorksheetEditions(base, rows), base);
});

test('default fallback and rollback work, while explicit unknown/unpublished editions fail', () => {
  const rows = registry(); const merged = mergeWorksheetEditions(base, rows); const t = topic(merged);
  assert.equal(resolveEdition(t).editionId, rows.editions[0].editionId);
  assert.equal(resolveEdition(t, 'legacy').editionId, 'legacy');
  assert.throws(() => resolveEdition(t, 'missing'), /Unavailable/);
  assert.throws(() => resolveEdition(topic(merged, 2, 28), rows.editions[1].editionId), /Unavailable/);
  assert.equal(resolveEdition({ ...t, defaultEditionId: 'missing' }).editionId, 'legacy');
  rows.editions[0].isDefault = false;
  assert.equal(resolveEdition(topic(mergeWorksheetEditions(base, rows))).editionId, 'legacy');
  assert.deepEqual(mergeWorksheetEditions(merged, { version: 1, editions: [] }), base);
  assert.deepEqual(mergeWorksheetEditions(merged, registry()), merged);
});

test('two published topics keep distinct media and learning identities without legacy progress reuse', () => {
  const rows = registry(); rows.editions[1].status = 'published';
  const merged = mergeWorksheetEditions(base, rows); const ids: string[] = [];
  for (const row of rows.editions) {
    const edition = resolveEdition(topic(merged, row.grade, row.topicId));
    for (const level of edition.levels) {
      const oldId = worksheetLearningId(row.grade, row.topicId, level.key);
      assert.equal(oldId, `g${row.grade}-t${row.topicId}-${level.key}`);
      assert.equal(level.learningId, oldId + '-e-' + row.editionId);
      assert.notEqual(oldId, level.learningId); ids.push(level.learningId!);
    }
  }
  assert.equal(new Set(ids).size, 6);
});

test('static elementary publication preserves the learning catalog without undeployed progress identities', () => {
  const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
  const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
  const scope = { window: { NOAM_LEARNING_CATALOG: [] as any[] } };
  runInNewContext(readFileSync(new URL('../../../noam-learning-catalog.js', import.meta.url), 'utf8'), scope);
  const legacy = buildLearningCatalog(loadIndexCatalog(), { version: 1, editions: [] });
  assert.equal(JSON.stringify(legacy), JSON.stringify(scope.window.NOAM_LEARNING_CATALOG.filter((item: any) => !item.editionId)));
  const result = buildLearningCatalog(loadIndexCatalog(), registry());
  assert.deepEqual(result, legacy);
  assert.equal(result.length, legacy.length);
  assert.equal(new Set(result.map((item: any) => item.id)).size, result.length);
});

test('bad identity, duplication, incomplete sets and insufficient provenance are rejected', () => {
  const cases: Array<(rows: ReturnType<typeof registry>) => void> = [
    r => { r.editions[0].levels[0].pdfId = topic(base).levels[0].pdfId; },
    r => { r.editions.push(structuredClone(r.editions[0])); },
    r => { r.editions[0].levels[1].key = 'a'; },
    r => { r.editions[0].levels.pop(); },
    r => { r.editions[0].levels[0].viewerLevel = 'E'; },
    r => { r.editions[0].levels[0].manifestSha256 = ''; },
    r => { r.editions[0].levels[1].pdfSha256 = r.editions[0].levels[0].pdfSha256; },
    r => { r.editions[1].levels[0].pdfId = r.editions[0].levels[0].pdfId; },
    r => { r.editions[0].editionId = 'legacy'; },
    r => { r.editions[0].label = '<script>'; },
    r => { r.editions[0].grade = 7; },
    r => { r.editions[0].topicId = 9999; },
    r => { r.editions[0].status = 'approved'; },
    r => { r.editions[1].status = 'published'; r.editions[1].grade = 1; r.editions[1].topicId = 5; r.editions[1].editionId = 'test-second'; },
  ];
  for (const mutate of cases) { const rows = registry(); mutate(rows); assert.throws(() => mergeWorksheetEditions(base, rows), /Worksheet editions:/); }
});

test('new and previous elementary editions open their own PDF without AI or database dependencies', () => {
  const merged = mergeWorksheetEditions(base, registry()); const t = topic(merged); const edition = resolveEdition(t);
  for (const level of edition.levels) {
    const url = new URL(buildWorksheetHref({ catalog: merged, grade: 1, topic: t, levelKey: level.key, editionId: edition.editionId }), 'https://local.test');
    assert.equal(url.href, base.config.pdfBase + level.pdfId + '.pdf');
    assert.equal(url.search, '');
    assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    assert.equal(buildWorksheetHref({ catalog: merged, grade: 1, topic: t, levelKey: level.key }),
      base.config.pdfBase + t.levels.find(l => l.key === level.key)!.pdfId + '.pdf');
  }
  assert.throws(() => buildWorksheetHref({ catalog: merged, grade: 1, topic: t, levelKey: 'a', editionId: 'missing' }), /Unavailable/);
});

test('middle-school native identities remain separate from topic IDs and preserve every existing edition', () => {
  const actual = JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.v1.json', import.meta.url), 'utf8'));
  const middle = middleEditionFixture();
  const merged = mergeWorksheetEditions(committed, { version: 1, editions: [...actual.editions, ...middle.editions] });
  assert.deepEqual(elementary(merged), elementary(committed));
  for (const g of committed.grades) for (const t of g.topics) {
    assert.deepEqual(topic(merged, g.grade, t.id).levels, t.levels);
    assert.deepEqual(topic(merged, g.grade, t.id).routing, t.routing);
  }
  for (const row of middle.editions) {
    const t = topic(merged, row.grade, row.topicId);
    assert.equal(resolveEdition(t).editionId, 'legacy');
    const edition = resolveEdition(t, row.editionId);
    assert.equal(edition.routing.resolvedNoamPrefix, row.nativePrefix);
    assert.equal(edition.routing.usesViewer, false);
    assert.equal(edition.routing.aiHintShown, false);
    for (const level of edition.levels) {
      assert.equal(buildWorksheetHref({ catalog: merged, grade: row.grade, topic: t, levelKey: level.key, editionId: row.editionId }),
        base.config.pdfBase + level.pdfId + '.pdf');
    }
  }
  assert.deepEqual(mergeWorksheetEditions(merged, actual), committed, 'withdrawing only the middle editions restores the prior catalog');
  middle.editions.forEach(row => { row.status = 'reviewed'; });
  assert.deepEqual(mergeWorksheetEditions(committed, { version: 1, editions: [...actual.editions, ...middle.editions] }), committed);
});

test('middle-school rows reject missing or cross-grade native provenance before publication', () => {
  for (const prefix of [undefined, '', 'G8-T86', 'G7-T86\n', 'G7-T86/../../', 'G7-T8']) {
    const rows = middleEditionFixture();
    (rows.editions[0] as any).nativePrefix = prefix;
    rows.editions[0].status = 'draft';
    assert.throws(() => mergeWorksheetEditions(base, rows), /nativePrefix/);
  }
  for (const hash of [undefined, '', 'a'.repeat(63), 'a'.repeat(64) + '\n']) {
    const rows = middleEditionFixture();
    (rows.editions[0].levels[0] as any).nativeExportSha256 = hash;
    assert.throws(() => mergeWorksheetEditions(base, rows), /nativeExportSha256/);
  }
  const rows = registry();
  (rows.editions[0] as any).nativePrefix = 'G7-T86';
  assert.throws(() => mergeWorksheetEditions(base, rows), /nativePrefix/);
});

test('the dormant viewer level switch preserves an explicit edition URL and its sibling set', () => {
  const html = readFileSync(new URL('../public/worksheet-viewer-noam.html', import.meta.url), 'utf8');
  const begin = html.indexOf('function buildLevelHref('); const end = html.indexOf('function renderLevelSwitch(', begin);
  assert.ok(begin >= 0 && end > begin);
  const merged = mergeWorksheetEditions(base, registry()); const t = topic(merged); const edition = resolveEdition(t);
  const href = '/worksheet-viewer-noam.html?g=1&edition=' + edition.editionId;
  const scope: any = { URL, window: { location: { href: new URL(href, 'https://local.test').href } },
    levelPdfMap: Object.fromEntries(edition.levels.map(l => [l.key, l.pdfId])) };
  runInNewContext(html.slice(begin, end), scope);
  for (const level of edition.levels) {
    const next = new URL(scope.buildLevelHref(level.key, level.pdfId), 'https://local.test');
    assert.equal(next.searchParams.get('edition'), edition.editionId);
    assert.equal(next.searchParams.get('pdf'), level.pdfId);
    assert.equal(next.searchParams.get('lv'), level.key);
    assert.ok(!t.levels.some(old => next.search.includes(old.pdfId)));
  }
});

test('search-index construction retains edition information without changing the legacy level fields', () => {
  const merged = mergeWorksheetEditions(base, registry());
  const { index } = buildIndex({ catalog: merged, pages: [], posts: [], termsDecisions: [] });
  const found = index.docs.find(d => d.key === 'topic:1:5')!.topic!;
  assert.equal(found.defaultEditionId, resolveEdition(topic(merged)).editionId);
  assert.deepEqual(found.editions, topic(merged).editions);
  assert.deepEqual(found.levels.map(l => l.pdfId), topic(base).levels.map(l => l.pdfId));
  const result = search(prepareIndex(index), 'חיבור בתחום 10', { grade: 1 });
  const hit = result.results.find(r => r.key === 'topic:1:5')!;
  assert.ok(hit); assert.equal(hit.levels.length, 3);
  assert.deepEqual(hit.levels.map(link => link.href).sort(), resolveEdition(topic(merged)).levels.map(level => base.config.pdfBase + level.pdfId + '.pdf').sort());
});

async function renderer() {
  const bundle = await build({ stdin: { contents: `
    import { createElement } from 'react'; import { renderToStaticMarkup } from 'react-dom/server';
    import { WorksheetsClient } from './src/components/WorksheetsClient';
    export function render(catalog, grade) { const entry = catalog.grades.find(g => g.grade === grade);
      return renderToStaticMarkup(createElement(WorksheetsClient, {catalog, grade, gradeEntry: entry, familyGrades: [entry]})); }`,
    resolveDir: process.cwd(), loader: 'ts' }, bundle: true, platform: 'node', format: 'cjs',
    packages: 'external', write: false, loader: { '.css': 'empty' }, logLevel: 'silent' });
  const module = { exports: {} as any };
  new Function('module', 'exports', 'require', bundle.outputFiles[0].text)(module, module.exports, require);
  return module.exports.render as (catalog: CatalogV1, grade: number) => string;
}

test('catalog UI renders new and previous links, and no technical metadata or unpublished set', async () => {
  const render = await renderer();
  const merged = mergeWorksheetEditions(base, registry()); const rendered = render(merged, 1);
  assert.match(rendered, /דפים חדשים/); assert.match(rendered, /דפים קודמים/);
  for (const level of [...topic(base).levels, ...resolveEdition(topic(merged)).levels]) assert.ok(rendered.includes(level.pdfId));
  assert.ok(!rendered.includes(registry().editions[0].levels[0].canonicalSourceSha256));
  const grade2 = render(merged, 2);
  assert.ok(!grade2.includes('worksheet-editions'));
  for (const level of registry().editions[1].levels) assert.ok(!grade2.includes(level.pdfId));
});

test('catalog AI badge names only the selected edition and PDF-only additions state their print action', async () => {
  const render = await renderer();
  const card = (catalog: CatalogV1) => parseHTML(render(catalog, 7)).document.querySelector('[data-topic-id="17"]')!;
  const current = card(committed);
  assert.equal(current.querySelector('.aihint')?.textContent, '✦ רמזי AI בדפים קודמים');
  const addition = current.querySelector('.worksheet-editions details')!;
  assert.equal(addition.querySelector('.note')?.textContent, 'קובצי PDF להדפסה');
  assert.equal(addition.querySelector('.aihint'), null);
  assert.equal(addition.querySelectorAll('a.lvl--pdf').length, 3);
  assert.equal(card(base).querySelector('.aihint')?.textContent, '✦ רמזי AI זמין בדף הזה');

  const pdfDefault = structuredClone(committed);
  const pdfTopic = topic(pdfDefault, 7, 17);
  pdfTopic.defaultEditionId = pdfTopic.editions!.find(e => e.publicationMode === 'pdf-only')!.editionId;
  assert.equal(card(pdfDefault).querySelector('.aihint'), null, 'legacy AI must not label a selected PDF-only set');
  assert.equal(card(pdfDefault).querySelector('.worksheet-editions > .note')?.textContent, 'קובצי PDF להדפסה');

  const other = mergeWorksheetEditions(base, middleEditionFixture());
  const otherTopic = topic(other, 7, 17), selected = otherTopic.editions![0];
  otherTopic.defaultEditionId = selected.editionId;
  selected.routing.aiHintShown = true; // Synthetic future edition to check badge scoping, not a publication.
  assert.equal(card(other).querySelector('.aihint')?.textContent, `✦ רמזי AI · ${selected.label}`);
});

test('desktop and phone let pupils expand previous worksheets without overflow or mixing links', async () => {
  const render = await renderer(); const merged = mergeWorksheetEditions(base, registry());
  const css = ['src/styles/catalog.css', 'src/styles/exact-catalog.css'].map(p => readFileSync(p, 'utf8')).join('\n');
  const browser = await puppeteer.launch({ executablePath: resolveTestBrowser(), headless: true });
  const output = 'reports/worksheet-editions'; mkdirSync(output, { recursive: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage(); await page.setViewport({ width, height: 900 });
      await page.setRequestInterception(true);
      page.on('request', request => { void request.abort(); }); // offline fixture, no live services
      await page.setContent('<!doctype html><html dir="rtl" lang="he"><meta charset="utf-8"><style>' + css +
        'body{margin:16px;font-family:Arial,sans-serif;background:#fbfaf5}</style><body>' + render(merged, 1) + '</body></html>');
      const card = await page.$('[data-topic-id="5"]'); assert.ok(card);
      const summary = await card.$('.worksheet-editions summary'); assert.ok(summary);
      assert.equal(await card.$eval('details', d => d.open), false);
      await summary.click();
      assert.equal(await card.$eval('details', d => d.open), true);
      // Measure the settled card: a fractional hover translation can report a
      // 44px button as 43.99997px while its CSS/layout height is exactly 44px.
      await card.evaluate(node => Promise.all(node.getAnimations({ subtree: true }).map(animation => animation.finished)));
      const rect = await card.boundingBox(); assert.ok(rect && rect.x >= 0 && rect.x + rect.width <= width);
      const buttons = await card.$$eval('a.lvl', nodes => nodes.map(n => ({ href: n.getAttribute('href'), height: n.getBoundingClientRect().height })));
      assert.equal(buttons.length, 6); assert.ok(buttons.every(b => b.height >= 44), JSON.stringify({ width, buttons }));
      assert.equal(buttons.filter(b => b.href?.includes('worksheet-viewer-noam.html')).length, 0);
      for (const level of resolveEdition(topic(merged)).levels) assert.ok(buttons.some(b => b.href === base.config.pdfBase + level.pdfId + '.pdf'));
      for (const level of topic(base).levels) assert.ok(buttons.some(b => b.href === base.config.pdfBase + level.pdfId + '.pdf'));
      await card.screenshot({ path: `${output}/card-${width}.png` });
      await page.close();
    }
  } finally { await browser.close(); }
});


test('edition ID length and end-of-input match database and viewer boundaries',()=>{
 for(const id of ['x','a'.repeat(64)])assert.equal(worksheetLearningId(1,5,'b',id),'g1-t5-b-e-'+id);
 for(const id of ['x\n','x\r','x\r\n','a'.repeat(65),'']){
  assert.throws(()=>worksheetLearningId(1,5,'b',id));
  const rows=registry();rows.editions[0].editionId=id;assert.throws(()=>mergeWorksheetEditions(base,rows));
 }
 const schema=JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.schema.json',import.meta.url),'utf8'));
 const valid=new RegExp(schema.$defs.identity.pattern);assert.equal(valid.test('x\n'),false);assert.equal(valid.test('a'.repeat(64)),true);
});
