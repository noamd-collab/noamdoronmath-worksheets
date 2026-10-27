import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { worksheetHref } from '../../../noam-ai/site-companion/retrieve.js';
import { worksheetHref as wixWorksheetHref } from '../../../noam-ai/site-companion/DEPLOY_WIX/backend/noam-site-companion-retrieve.js';

const root = new URL('../', import.meta.url);
const read = (file: string) => JSON.parse(readFileSync(new URL(file, root), 'utf8'));
const rows = ['pilot','next-ten','second-ten','third-ten','fourth-ten','remaining-101']
  .flatMap(name => read(`src/data/worksheet-${name}.v1.json`).sheets);
const byPdf = new Map(rows.map(row => [row.pdfId, row]));
const catalog = loadCatalog();
const links = catalog.grades.flatMap(grade => grade.topics.flatMap(topic => topic.levels.map(level => ({
  grade, topic, level,
  url: new URL(buildWorksheetHref({ catalog, grade: grade.grade, topic, levelKey: level.key }), 'https://www.noamdoronmath.co.il'),
}))));

test('ordinary catalog reaches every reviewed PDF with its matching native manifest and subsection SVG', () => {
  const reached = new Set<string>();
  let subsections = 0, figures = 0;
  for (const { grade, topic, level, url } of links) {
    const row: any = byPdf.get(url.searchParams.get('pdf') || '');
    if (!row) continue;
    const firstVisit = !reached.has(row.key);
    reached.add(row.key);
    assert.equal(url.pathname, '/worksheet-viewer-noam.html');
    assert.equal(url.searchParams.get('g'), String(row.grade));
    assert.equal(url.searchParams.get('x'), row.x);
    assert.equal(url.searchParams.get('lv'), row.level);
    assert.equal(url.searchParams.get('topic'), String(topic.parent ?? topic.id));
    assert.equal(url.searchParams.get('back'), `/worksheets?grade=${grade.grade}`);
    const companionUrl = new URL(worksheetHref(catalog, grade, topic, level), 'https://www.noamdoronmath.co.il');
    for (const key of ['pdf', 'g', 'x', 'lv']) assert.equal(companionUrl.searchParams.get(key), url.searchParams.get(key));
    const manifest = read(`public/noam-ai/manifests/${row.pdfId}.json`);
    const native = read('public' + row.nativeExport);
    assert.equal(manifest.sourceSha256, row.pdfSha256);
    assert.equal(manifest.level, row.level);
    for (const ex of manifest.exercises) {
      if (firstVisit) subsections++;
      const question = native.questions.find((q: any) => q.id === ex.nativeQuestionId);
      const part = question?.items.find((p: any) => p.id === ex.nativeItemId && p.label === ex.part);
      assert.ok(part, `${row.key}: ${ex.id} must select a native subsection`);
      if (!part.figure_id) { assert.equal(ex.nativeFigureUrl, undefined); continue; }
      if (firstVisit) figures++;
      const figure = native.figures.find((f: any) => f.id === part.figure_id);
      assert.equal(ex.nativeFigureId, part.figure_id);
      assert.equal(ex.nativeFigureUrl, row.nativeExport.replace(/noam-ai\.json$/, '') + figure.svg);
      assert.ok(existsSync(new URL('public' + ex.nativeFigureUrl, root)), ex.nativeFigureUrl);
    }
    for (const [key, id] of Object.entries(topic.routing.siblingPdfQuery)) {
      assert.equal(url.searchParams.get(key), id);
      if (key === 'pc2') continue;
      const sibling: any = byPdf.get(id);
      assert.ok(sibling, `${row.key}: sibling must belong to the promoted release`);
      assert.equal(sibling.x, row.x);
      assert.equal(sibling.level, key.slice(1));
    }
  }
  assert.equal(reached.size, 412);
  assert.deepEqual([...reached].sort(), rows.map(row => row.key).sort());
  assert.equal(subsections, 30972);
  assert.equal(figures, 14697);
});

test('old PDF migrations preserve exact old identity and select a complete reachable replacement', () => {
  const mapping = read('public/noam-ai/catalog-migrations.json');
  assert.equal(mapping.schemaVersion, 1);
  assert.equal(Object.keys(mapping.byPdf).length, 440);
  for (const [oldPdf, replacement] of Object.entries(mapping.byPdf) as Array<[string, any]>) {
    const old = read(`public/noam-ai/manifests/${oldPdf}.json`);
    const row: any = byPdf.get(replacement.pdfId);
    assert.ok(row, oldPdf);
    assert.notEqual(replacement.pdfId, oldPdf);
    assert.equal(replacement.prefix, row.x);
    assert.equal(replacement.level, row.level);
    assert.equal(replacement.grade, row.grade);
    assert.ok(old.exercises.length > 0, 'old manifest stays available until whole-page migration');
    assert.ok([7, 8, 9].includes(replacement.original.grade));
    assert.match(replacement.original.prefix, /^G[789]-T\d+$/);
    assert.ok(['a', 'b', 'c', 'one'].includes(replacement.original.level));
    assert.ok(links.some(link => link.url.searchParams.get('pdf') === replacement.pdfId));
  }
});


test('documented grade-nine reuse keeps a complete grade-seven package and an honest source note', () => {
  const reuse = read('src/data/native-catalog-reuse.v1.json').duplicates;
  let reusedLevels = 0;
  for (const { grade, topic, level, url } of links) {
    const source = reuse[topic.noamTopicId || ''];
    if (!source) continue;
    reusedLevels++;
    assert.equal(grade.grade, 9);
    assert.equal(url.searchParams.get('g'), '7');
    assert.equal(url.searchParams.get('x'), source);
    assert.equal(url.searchParams.get('back'), '/worksheets?grade=9');
    assert.match(topic.note || '', /מכיתה ז׳.*כיתה ט׳/);
    const row: any = byPdf.get(level.pdfId);
    assert.equal(row.x, source);
    assert.equal(row.grade, 7);
    assert.equal(url.searchParams.get('lv'), row.level);
  }
  assert.equal(reusedLevels, 31);
});

test('learning and both companion exports open the same catalog package for all worksheet entries', () => {
  const learningContext: any = { window: {} };
  runInNewContext(readFileSync(new URL('public/noam-learning-catalog.js', root), 'utf8'), learningContext);
  const learning = learningContext.window.NOAM_LEARNING_CATALOG;
  const guide = read('src/data/site-guide.v1.json').records;
  const navigation = read('public/noam-navigation-guide.json').records;
  const openers = ['public/noam-learning.js', '../../noam-learning.js'].map(file => {
    const script = readFileSync(new URL(file, root), 'utf8');
    const start = script.indexOf(' function openPdf(item)');
    const end = script.indexOf(' function controls(', start);
    assert.ok(start >= 0 && end > start);
    return runInNewContext('(' + script.slice(start, end) + ')', {
      catalog: learning, URL, location: { href: 'https://www.noamdoronmath.co.il/learning.html' },
    });
  });
  assert.equal(learning.length, links.length);
  const wixContext: any = {};
  runInNewContext(readFileSync(new URL('../../noam-ai/site-companion/DEPLOY_WIX/backend/noam-site-catalog.js', root), 'utf8').replace('export const catalog =', 'var catalog ='), wixContext);
  assert.deepEqual(JSON.parse(JSON.stringify(wixContext.catalog)), read('src/data/catalog.v1.json'));
  for (const { grade, topic, level, url } of links) {
    const id = `g${grade.grade}-t${topic.id}-${level.key}`;
    const item = learning.find((entry: any) => entry.id === id);
    assert.ok(item, id);
    assert.equal(item.pdf, level.pdfId);
    const exports = [guide, navigation].map(records => {
      const entry = records.find((record: any) => record.id === id);
      assert.ok(entry, id);
      return new URL(entry.href, url);
    });
    exports.push(...openers.map(opener => new URL(opener(item))), new URL(wixWorksheetHref(catalog, grade, topic, level), url));
    for (const other of exports) {
      if (grade.grade < 7) { assert.ok(other.pathname.endsWith(`d8e7ad_${level.pdfId}.pdf`)); continue; }
      assert.equal(other.pathname, url.pathname, id);
      for (const key of ['g', 'x', 'lv', 'pdf', 't', 'topic', 'pa', 'pb', 'pc', 'pc2']) {
        assert.equal(other.searchParams.get(key), url.searchParams.get(key), `${id}: ${key}`);
      }
    }
  }
});

test('teacher picker uses the current exact PDFs and manifests for every middle-school slot', () => {
  const picker = read('public/teachers/teacher-catalog.json');
  const picks = read('src/data/teacher-pick-index.json');
  const reached = new Set();
  let slots = 0;
  for (const { grade, topic, level } of links.filter(link => link.grade.grade >= 7)) {
    slots++;
    const sheet = picker.grades.find((g: any) => g.grade === grade.grade)
      ?.topics.find((t: any) => t.id === topic.id)?.sheets.find((s: any) => s.level === level.key);
    assert.equal(sheet?.pdfId, level.pdfId);
    assert.equal(sheet.pdfUrl, `https://static.wixstatic.com/ugd/d8e7ad_${level.pdfId}.pdf`);
    if (topic.routing.sourceGrade) assert.equal(sheet.sourceGrade, topic.routing.sourceGrade);
    const source = read(`public/teachers/sheets/${level.pdfId}.json`);
    const manifest = read(`public/noam-ai/manifests/${level.pdfId}.json`);
    assert.equal(source.pdfId, level.pdfId);
    assert.equal(source.sourceSha256, manifest.sourceSha256);
    const expectedIds = manifest.exercises.map((ex: any) => String(ex.q) + (ex.part || ''));
    assert.deepEqual(source.questions.map((q: any) => q.id), expectedIds);
    const pick = picks.find((p: any) => p.grade === grade.grade && p.topicId === String(topic.id) && p.level === level.key);
    assert.equal(pick?.pdfId, level.pdfId);
    assert.deepEqual(pick.questions, expectedIds);
    reached.add(level.pdfId);
  }
  assert.equal(slots, 457);
  assert.equal(reached.size, 426);
});
