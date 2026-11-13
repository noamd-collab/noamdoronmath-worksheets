import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { loadCatalog } from '../src/lib/catalog/loadCatalog';
import {
  buildTeacherLandingCatalog, getTeacherLandingCatalog, getTeacherLandingPickerData, getTeacherLandingScope,
} from '../src/lib/teacherLandingCatalog';
import { wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';
import { editionFixture } from './fixtures/worksheet-editions';

const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8');
const teacher = JSON.parse(read('../public/teachers/teacher-catalog.json'));
const raw = JSON.parse(read('../src/data/catalog.v1.json'));
const registry = JSON.parse(read('../../catalog/worksheet-editions.v1.json'));
const projection = getTeacherLandingCatalog();

// Execute the existing tool's filter, rather than reimplementing the projection
// as a second expected-result algorithm. No browser, network or AI is involved.
const printer = read('../public/teachers/teacher-factoring-print.js');
const start = printer.indexOf('function topicSheets()');
const end = printer.indexOf('\nfunction ', start + 1);
assert.ok(start >= 0 && end > start);
const toolSheets = new Function('topic', 'state',
  'const currentTopic = () => topic;\n' + printer.slice(start, end) + '\nreturn topicSheets();');

test('landing follows every source grade/topic in order without mutating the canonical catalog', () => {
  const source = loadCatalog(), before = JSON.stringify(source);
  assert.deepEqual(buildTeacherLandingCatalog(source), projection);
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(projection.grades.map(grade => ({ grade: grade.grade, label: grade.label,
    topics: grade.topics.map(topic => ({ id: topic.id, title: topic.title })) })),
  teacher.grades.map((grade: any) => ({ grade: grade.grade, label: grade.label,
    topics: grade.topics.map((topic: any) => ({ id: topic.id, title: topic.title })) })));
  assert.deepEqual(projection.counts, { grades: 9, topics: 331, catalogEntries: 982,
    uniquePdfIds: 951, validScopes: 1325, topicsWithPublishedDefaultEdition: 5 });
});

test('all emitted scopes round-trip and select exactly the actual teacher-tool PDFs', () => {
  let checked = 0;
  for (const grade of projection.grades) for (const topic of grade.topics) {
    const source = teacher.grades.find((row: any) => row.grade === grade.grade).topics.find((row: any) => row.id === topic.id);
    for (const edition of topic.editions) for (const level of edition.levels) {
      const url = new URL(level.teacherPath, 'https://example.invalid');
      assert.equal(url.pathname, '/teachers/app');
      assert.equal(url.hash, '');
      assert.deepEqual([...url.searchParams.keys()], ['grade', 'topic', 'level', 'edition']);
      const parsed = wizardPrefillFromSearch(url.search);
      assert.ok(parsed, level.teacherPath);
      assert.equal(parsed.grade, String(grade.grade));
      assert.equal(parsed.topic, String(topic.id));
      assert.equal(parsed.level, level.value);
      assert.equal(parsed.edition, edition.id);
      const actual = toolSheets(source, { level: parsed.level, edition: parsed.edition });
      assert.ok(actual.length > 0, level.teacherPath);
      assert.deepEqual(level.pdfIds, [...new Set(actual.map((sheet: any) => sheet.pdfId))], level.teacherPath);
      assert.deepEqual(getTeacherLandingScope({ grade: grade.grade, topic: topic.id, level: level.value, edition: edition.id }),
        { grade: grade.grade, topic: topic.id, level: level.value, edition: edition.id,
          teacherPath: level.teacherPath, pdfIds: level.pdfIds });
      checked++;
    }
  }
  assert.equal(checked, projection.counts.validScopes);
});

test('published canonical defaults resolve exclusively to their own sources, including the preview topic', () => {
  for (const edition of registry.editions.filter((row: any) =>
    row.status === 'published' && row.isDefault && row.publicationMode !== 'pdf-only')) {
    const scope = getTeacherLandingScope({ grade: edition.grade, topic: edition.topicId });
    assert.ok(scope);
    assert.equal(scope.edition, edition.editionId);
    assert.equal(scope.level, 'a');
    assert.deepEqual(scope.pdfIds, [edition.levels.find((level: any) => level.key === 'a').pdfId]);
  }
  assert.deepEqual(projection.defaultScope, { grade: 3, topic: 10, level: 'a', edition: 'elementary-20261108-r1' });
  assert.equal(projection.defaultTeacherPath, '/teachers/app?grade=3&topic=10&level=a&edition=elementary-20261108-r1');
  assert.deepEqual(getTeacherLandingScope(projection.defaultScope)?.pdfIds, ['3d7563584d774bf5958dc6a37ef7e210']);
});

test('single sheets and c2 sources use only the levels accepted by the actual tool', () => {
  let single = 0, enrichment = 0;
  for (const grade of teacher.grades) for (const topic of grade.topics) {
    if (topic.sheets.every((sheet: any) => sheet.level === 'one')) {
      const shown = projection.grades.find(row => row.grade === grade.grade)!.topics.find(row => row.id === topic.id)!;
      assert.deepEqual(shown.editions[0].levels.map(level => level.value), ['all']);
      assert.equal(shown.editions[0].levels[0].label, topic.sheets[0].levelLabel);
      assert.equal(getTeacherLandingScope({ grade: grade.grade, topic: topic.id })?.level, 'all');
      assert.equal(getTeacherLandingScope({ grade: grade.grade, topic: topic.id, level: 'a' }), null);
      single++;
    }
    if (topic.sheets.some((sheet: any) => sheet.level === 'c2')) {
      const scope = getTeacherLandingScope({ grade: grade.grade, topic: topic.id, level: 'c' });
      assert.deepEqual(scope?.pdfIds, topic.sheets.filter((sheet: any) => ['c', 'c2'].includes(sheet.level)).map((sheet: any) => sheet.pdfId));
      assert.equal(getTeacherLandingScope({ grade: grade.grade, topic: topic.id, level: 'c2' }), null);
      enrichment++;
    }
  }
  assert.equal(single, 11);
  assert.equal(enrichment, 2);
});

test('publication, withdrawal and nondefault editions follow the existing registry merger', () => {
  const fixture = editionFixture();
  const build = () => buildTeacherLandingCatalog(mergeWorksheetEditions(raw, fixture));
  const published = build();
  assert.equal(getTeacherLandingScope({ grade: 1, topic: 5 }, published)?.edition, 'test-renewal-r1');
  assert.equal(getTeacherLandingScope({ grade: 2, topic: 28, edition: 'test-renewal-r1' }, published), null);
  fixture.editions[0].isDefault = false;
  const notDefault = build();
  assert.equal(getTeacherLandingScope({ grade: 1, topic: 5 }, notDefault)?.edition, 'legacy');
  assert.ok(getTeacherLandingScope({ grade: 1, topic: 5, edition: 'test-renewal-r1' }, notDefault));
  fixture.editions[0].status = 'draft';
  const withdrawn = build();
  assert.equal(getTeacherLandingScope({ grade: 1, topic: 5 }, withdrawn)?.edition, 'all');
  assert.equal(getTeacherLandingScope({ grade: 1, topic: 5, edition: 'test-renewal-r1' }, withdrawn), null);
});

test('missing preview topic falls back to the first actual topic; explicit invalid scopes do not', () => {
  const source = loadCatalog();
  const smaller = buildTeacherLandingCatalog({ grades: source.grades.slice(0, 1).map(grade => ({ ...grade, topics: grade.topics.slice(0, 1) })) });
  assert.deepEqual(smaller.defaultScope, { grade: 1, topic: 1, level: 'a', edition: 'all' });
  for (const input of [
    { grade: 0, topic: 1 }, { grade: 10, topic: 1 }, { grade: '3&x=1', topic: 10 },
    { grade: 3, topic: 999999 }, { grade: 3, topic: '../app' },
    { grade: 3, topic: 10, edition: 'unpublished' }, { grade: 3, topic: 10, edition: '' },
    { grade: 3, topic: 10, level: 'one' }, { grade: 3, topic: 10, level: '' },
  ]) assert.equal(getTeacherLandingScope(input), null);
});

test('inline picker data includes only default editions and selectable levels, without PDF/URL duplication', () => {
  const picker = getTeacherLandingPickerData();
  assert.deepEqual(picker.defaultScope, projection.defaultScope);
  assert.equal(picker.defaultTeacherPath, projection.defaultTeacherPath);
  assert.equal(picker.grades.length, 9);
  assert.equal(picker.grades.flatMap(grade => grade.topics).length, 331);
  for (const grade of picker.grades) for (const topic of grade.topics) {
    const full = projection.grades.find(row => row.grade === grade.grade)!.topics.find(row => row.id === topic.id)!;
    assert.deepEqual(Object.keys(topic), ['id', 'title', 'edition', 'defaultLevel', 'levels']);
    assert.equal(topic.edition.id, full.defaultEditionId);
    for (const level of topic.levels) {
      assert.deepEqual(Object.keys(level), ['value', 'label']);
      assert.ok(getTeacherLandingScope({ grade: grade.grade, topic: topic.id, level: level.value, edition: topic.edition.id }));
    }
  }
  assert.ok(Buffer.byteLength(JSON.stringify(picker)) < 120_000, 'compact inline catalog stays below120KB');
  assert.ok(JSON.stringify(picker).length < JSON.stringify(projection).length / 2);
  // Import the already-shared canonical loader, not another worker-sized JSON.
  assert.doesNotMatch(read('../src/lib/teacherLandingCatalog.ts'), /import\s+.*(?:teacher-catalog\.json|worksheet-editions\.v1\.json)/);
});
