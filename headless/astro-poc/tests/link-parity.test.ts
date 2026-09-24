/**
 * Link-parity checks for the Astro POC buildWorksheetHref vs representative
 * catalog mappings (grade 7 viewer / one→lv=b, grade 9, direct PDF).
 * Expectations come from catalog.v1.json routing flags — not a copy of the app
 * algorithm beyond calling the shared builder.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog.ts';
import {
  buildWorksheetHref,
  PUBLIC_USE_HEADLESS_VIEWER,
  PUBLIC_WORKSHEETS_BASE,
} from '../src/lib/worksheetLinks.ts';
import { parseGradeParam, familyOf } from '../src/lib/grades.ts';

const catalog = loadCatalog();

describe('astro-poc grade helpers', () => {
  it('defaults absent grade to 7', () => {
    assert.equal(parseGradeParam(null).grade, 7);
    assert.equal(parseGradeParam('99').invalid, true);
    assert.deepEqual(familyOf(7), [7, 8, 9]);
  });
});

describe('astro-poc buildWorksheetHref parity (representative)', () => {
  it('grade-7 viewer a/b/c keeps public github.io base + siblings', () => {
    const g = catalog.grades.find((x) => x.grade === 7)!;
    const topic = g.topics.find(
      (t) => t.routing.usesViewer && t.levels.some((l) => l.key === 'a')
    )!;
    const href = buildWorksheetHref({ catalog, grade: 7, topic, levelKey: 'a' });
    assert.ok(href.startsWith(PUBLIC_WORKSHEETS_BASE));
    const u = new URL(href);
    assert.ok(u.pathname.endsWith('/worksheet-viewer-noam.html'));
    assert.equal(u.searchParams.get('g'), '7');
    assert.equal(u.searchParams.get('lv'), 'a');
    assert.equal(u.searchParams.get('x'), topic.routing.resolvedNoamPrefix);
    assert.equal(u.searchParams.get('pdf'), topic.levels.find((l) => l.key === 'a')!.pdfId);
    if (topic.routing.siblingPdfQuery.pb) {
      assert.equal(u.searchParams.get('pb'), topic.routing.siblingPdfQuery.pb);
    }
    assert.ok(!href.includes('localhost'));
    assert.ok(!href.includes('127.0.0.1'));
  });

  it('viewer-routed one-level uses lv=b while catalog key stays one', () => {
    const g = catalog.grades.find((x) => x.grade === 7)!;
    const topic = g.topics.find(
      (t) => t.routing.usesViewer && t.levels.length === 1 && t.levels[0].key === 'one'
    )!;
    assert.equal(topic.levels[0].key, 'one');
    const href = buildWorksheetHref({ catalog, grade: 7, topic, levelKey: 'one' });
    const u = new URL(href);
    assert.equal(u.searchParams.get('lv'), 'b');
    assert.equal(u.searchParams.get('pdf'), topic.levels[0].pdfId);
    assert.equal(
      u.searchParams.get('topic'),
      String(topic.parent !== undefined ? topic.parent : topic.id)
    );
    assert.equal(u.searchParams.get('back'), '/noamdoronmath-worksheets/?grade=7');
  });

  it('direct PDF uses Wix Media pdfBase (elementary or non-viewer)', () => {
    const g1 = catalog.grades.find((x) => x.grade === 1)!;
    const topic = g1.topics.find((t) => !t.routing.usesViewer && t.levels[0])!;
    const level = topic.levels[0];
    const href = buildWorksheetHref({ catalog, grade: 1, topic, levelKey: level.key });
    assert.equal(href, catalog.config.pdfBase + level.pdfId + '.pdf');
    assert.ok(href.startsWith('https://static.wixstatic.com/ugd/'));
    assert.ok(!href.includes('noamdoronmath.co.il/_files/'));
    assert.ok(href.endsWith('.pdf'));
  });

  it('grade-9 viewer-routed topic stays on public viewer base', () => {
    const g = catalog.grades.find((x) => x.grade === 9)!;
    const topic = g.topics.find((t) => t.routing.usesViewer)!;
    const level = topic.levels[0];
    const href = buildWorksheetHref({
      catalog,
      grade: 9,
      topic,
      levelKey: level.key,
    });
    assert.ok(href.startsWith(PUBLIC_WORKSHEETS_BASE));
    const u = new URL(href);
    assert.equal(u.searchParams.get('g'), '9');
    assert.equal(u.searchParams.get('x'), topic.routing.resolvedNoamPrefix);
    if (level.key === 'one') assert.equal(u.searchParams.get('lv'), 'b');
    else assert.equal(u.searchParams.get('lv'), level.key);
  });

  it('rollback flag defaults OFF — Headless viewer path not used', () => {
    // Env is unset in tests; PUBLIC_USE_HEADLESS_VIEWER must stay false.
    assert.equal(PUBLIC_USE_HEADLESS_VIEWER, false);
    const g = catalog.grades.find((x) => x.grade === 7)!;
    const topic = g.topics.find((t) => t.routing.usesViewer)!;
    const href = buildWorksheetHref({
      catalog,
      grade: 7,
      topic,
      levelKey: topic.levels[0].key,
    });
    assert.ok(href.startsWith(PUBLIC_WORKSHEETS_BASE));
    assert.ok(!href.startsWith('/worksheet-viewer-noam.html'));
  });
});
