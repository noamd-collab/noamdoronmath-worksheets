/**
 * Link-parity checks for the Astro POC buildWorksheetHref vs representative
 * catalog mappings (native single-level viewer, reused grade 7 sheets, direct PDF).
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
  it('grade-7 viewer a/b/c uses Headless same-origin path + siblings', () => {
    const g = catalog.grades.find((x) => x.grade === 7)!;
    const topic = g.topics.find(
      (t) => t.routing.usesViewer && t.levels.some((l) => l.key === 'a')
    )!;
    const href = buildWorksheetHref({ catalog, grade: 7, topic, levelKey: 'a' });
    assert.ok(href.startsWith('/worksheet-viewer-noam.html'));
    const u = new URL(href, 'https://www.noamdoronmath.co.il');
    assert.ok(u.pathname.endsWith('/worksheet-viewer-noam.html'));
    assert.equal(u.searchParams.get('g'), '7');
    assert.equal(u.searchParams.get('lv'), 'a');
    assert.equal(u.searchParams.get('x'), topic.routing.resolvedNoamPrefix);
    assert.equal(u.searchParams.get('pdf'), topic.levels.find((l) => l.key === 'a')!.pdfId);
    if (topic.routing.siblingPdfQuery.pb) {
      assert.equal(u.searchParams.get('pb'), topic.routing.siblingPdfQuery.pb);
    }
    assert.ok(!href.includes('github.io'));
    assert.ok(!href.includes('localhost'));
    assert.ok(!href.includes('127.0.0.1'));
  });

  it('native single-sheet releases keep the explicit one viewer level', () => {
    // Native releases declare viewerLevel=one to match their source manifests.
    const found = catalog.grades
      .map((grade) => ({
        grade: grade.grade,
        topic: grade.topics.find(
          (t) => t.routing.usesViewer && t.levels.length === 1 && t.levels[0].key === 'one'
        ),
      }))
      .find((entry) => entry.topic);
    assert.ok(found?.topic);
    const topic = found.topic;
    assert.equal(topic.levels[0].key, 'one');
    const href = buildWorksheetHref({ catalog, grade: found.grade, topic, levelKey: 'one' });
    const u = new URL(href, 'https://www.noamdoronmath.co.il');
    assert.equal(topic.levels[0].viewerLevel, 'one');
    assert.equal(u.searchParams.get('lv'), 'one');
    assert.equal(u.searchParams.get('pdf'), topic.levels[0].pdfId);
    assert.equal(
      u.searchParams.get('topic'),
      String(topic.parent !== undefined ? topic.parent : topic.id)
    );
    assert.equal(u.searchParams.get('back'), `/worksheets?grade=${found.grade}`);
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

  it('grade-9 viewer-routed topic stays on Headless viewer path', () => {
    const g = catalog.grades.find((x) => x.grade === 9)!;
    const topic = g.topics.find((t) => t.routing.usesViewer)!;
    const level = topic.levels[0];
    const href = buildWorksheetHref({
      catalog,
      grade: 9,
      topic,
      levelKey: level.key,
    });
    assert.ok(href.startsWith('/worksheet-viewer-noam.html'));
    const u = new URL(href, 'https://www.noamdoronmath.co.il');
    assert.equal(u.searchParams.get('g'), '9');
    assert.equal(u.searchParams.get('x'), topic.routing.resolvedNoamPrefix);
    assert.equal(u.searchParams.get('lv'), level.viewerLevel || (level.key === 'one' ? 'b' : level.key));
  });

  it('declared grade-9 reuse opens the matching grade-7 source while returning to grade 9', () => {
    const grade = catalog.grades.find((entry) => entry.grade === 9)!;
    const reused = grade.topics.filter((topic) => topic.routing.sourceGrade !== undefined);
    assert.equal(reused.length, 11);
    for (const topic of reused) {
      const source = catalog.grades.find((entry) => entry.grade === topic.routing.sourceGrade)!;
      const sourceTopic = source.topics.find((entry) => entry.routing.resolvedNoamPrefix === topic.routing.sourcePrefix)!;
      assert.ok(sourceTopic);
      for (const level of topic.levels) {
        const href = buildWorksheetHref({ catalog, grade: 9, topic, levelKey: level.key });
        const url = new URL(href, 'https://www.noamdoronmath.co.il');
        assert.equal(url.searchParams.get('g'), '7');
        assert.equal(url.searchParams.get('x'), sourceTopic.routing.resolvedNoamPrefix);
        assert.equal(url.searchParams.get('t'), topic.routing.sourceTitle);
        assert.equal(url.searchParams.get('pdf'), level.pdfId);
        assert.ok(sourceTopic.levels.some((sourceLevel) => sourceLevel.pdfId === level.pdfId));
        assert.equal(url.searchParams.get('lv'), level.viewerLevel || level.key);
        assert.equal(url.searchParams.get('back'), '/worksheets?grade=9');
        assert.equal(url.searchParams.get('topic'), String(topic.parent ?? topic.id));
      }
    }
  });

  it('Headless viewer path defaults ON — GitHub Pages reserved for explicit rollback', () => {
    assert.equal(PUBLIC_USE_HEADLESS_VIEWER, true);
    const g = catalog.grades.find((x) => x.grade === 7)!;
    const topic = g.topics.find((t) => t.routing.usesViewer)!;
    const href = buildWorksheetHref({
      catalog,
      grade: 7,
      topic,
      levelKey: topic.levels[0].key,
    });
    assert.ok(href.startsWith('/worksheet-viewer-noam.html'));
    assert.ok(!href.startsWith(PUBLIC_WORKSHEETS_BASE));
  });
});
