import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { test } from 'node:test';
import type { CatalogV1 } from '../src/lib/catalog/types';
import { resolveEdition } from '../src/lib/catalog/editions';
import { buildWorksheetHref } from '../src/lib/worksheetLinks';
import { buildIndex } from '../src/lib/siteSearch/buildIndex';
import { prepareIndex, search } from '../src/lib/siteSearch/engine';
import { mergeWorksheetEditions } from '../../../scripts/lib/worksheet-editions.cjs';
import { buildTeacherCatalog } from '../scripts/build-teacher-catalog.mjs';
import { buildTeacherLandingCatalog, getTeacherLandingScope } from '../src/lib/teacherLandingCatalog';
import { editionFixture, middleEditionFixture } from './fixtures/worksheet-editions';

const sha = (text: string) => createHash('sha256').update(text).digest('hex');
const committed = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')) as CatalogV1;
const { ramziActivation: _activationSummary, ...committedWithoutActivation } = committed;
const base: CatalogV1 = { ...committedWithoutActivation, grades: committed.grades.map(g => ({ ...g,
  topics: g.topics.map(t => { const { editions, defaultEditionId, ...legacy } = t; return legacy; }),
})) };
const topic = (catalog: CatalogV1, grade: number, id: number) => catalog.grades.find(g => g.grade === grade)!.topics.find(t => t.id === id)!;

// Synthetic test-only files/IDs, never imported into a publication registry.
function pdfOnlyFixture() {
  const fixture = middleEditionFixture();
  return { version: 1, editions: fixture.editions.map(row => ({ ...row,
    publicationMode: 'pdf-only' as const, label: 'תרגול ממוקד חדש',
    levels: row.levels.map(level => {
      const { canonicalSourceSha256, manifestSha256, answerMapSha256, wordSourceSha256, hintsBundleSha256, ...provenance } = level;
      return { ...provenance, sourceSha256: sha(`test-sheet-json-${row.nativePrefix}-${level.key}`) };
    }),
  })) };
}

test('PDF-only publications need only real-file provenance and keep every legacy field and default', () => {
  const rows = pdfOnlyFixture(); const before = JSON.stringify(rows);
  const merged = mergeWorksheetEditions(base, rows);
  for (const g of base.grades) for (const t of g.topics) {
    const { editions, defaultEditionId, ...legacy } = topic(merged, g.grade, t.id);
    assert.deepEqual(legacy, t);
  }
  assert.deepEqual(merged.grades.filter(g => g.grade <= 6), base.grades.filter(g => g.grade <= 6));
  for (const row of rows.editions) {
    const t = topic(merged, row.grade, row.topicId);
    assert.equal(resolveEdition(t).editionId, 'legacy');
    const selected = resolveEdition(t, row.editionId);
    assert.equal(selected.publicationMode, 'pdf-only');
    if (selected.publicationMode !== 'pdf-only') throw Error('Expected PDF-only type narrowing');
    assert.equal(selected.routing.resolvedNoamPrefix, row.nativePrefix);
    assert.equal(selected.routing.usesViewer, false);
    assert.equal(selected.routing.aiHintShown, false);
    for (const level of selected.levels) {
      const source = row.levels.find(l => l.key === level.key)!;
      assert.equal(level.sourceSha256, source.sourceSha256);
      assert.equal(level.nativeExportSha256, source.nativeExportSha256);
      assert.equal(level.pdfSha256, source.pdfSha256);
      assert.equal(buildWorksheetHref({ catalog: merged, grade: row.grade, topic: t, levelKey: level.key, editionId: row.editionId }),
        base.config.pdfBase + level.pdfId + '.pdf');
      assert.equal(buildWorksheetHref({ catalog: merged, grade: row.grade, topic: t, levelKey: level.key }),
        buildWorksheetHref({ catalog: base, grade: row.grade, topic: topic(base, row.grade, row.topicId), levelKey: level.key }));
      for (const field of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
        assert.equal(Object.hasOwn(level, field), false, field);
      }
    }
  }
  assert.equal(JSON.stringify(rows), before);
});

test('PDF-only publication/default/withdrawal semantics do not depend on measured or hints artifacts', () => {
  const rows = pdfOnlyFixture(); const row = rows.editions[0];
  row.isDefault = true;
  const published = mergeWorksheetEditions(base, rows);
  assert.equal(resolveEdition(topic(published, row.grade, row.topicId)).editionId, row.editionId);
  assert.equal(resolveEdition(topic(published, row.grade, row.topicId), 'legacy').editionId, 'legacy');
  for (const status of ['draft', 'reviewed']) {
    const pending = structuredClone(rows); pending.editions.forEach(r => { r.status = status; });
    assert.deepEqual(mergeWorksheetEditions(published, pending), base);
    assert.throws(() => resolveEdition(topic(base, row.grade, row.topicId), row.editionId), /Unavailable/);
  }
  assert.deepEqual(mergeWorksheetEditions(published, { version: 1, editions: [] }), base);
});

test('PDF-only search links select the explicit default PDF and do not turn on learning/progress IDs', () => {
  const rows = pdfOnlyFixture(); const row = rows.editions[0]; row.isDefault = true;
  const merged = mergeWorksheetEditions(base, rows);
  const { index } = buildIndex({ catalog: merged, pages: [], posts: [], termsDecisions: [] });
  const query = topic(base, row.grade, row.topicId).title;
  const result = search(prepareIndex(index), query, { grade: row.grade });
  const hit = result.results.find(r => r.key === `topic:${row.grade}:${row.topicId}`)!;
  assert.ok(hit);
  assert.deepEqual(hit.levels.map(l => l.href).sort(), row.levels.map(l => base.config.pdfBase + l.pdfId + '.pdf').sort());
  const require = createRequire(import.meta.url);
  const { buildLearningCatalog } = require('../../../scripts/build-learning-catalog.cjs');
  const { loadIndexCatalog } = require('../../../scripts/lib/headless-catalog.cjs');
  const raw = loadIndexCatalog();
  assert.deepEqual(buildLearningCatalog(raw, rows), buildLearningCatalog(raw, { version: 1, editions: [] }));
});

test('PDF-only downloads never enter teacher exercise sources or landing scopes, even as the site default', () => {
  const existing = editionFixture();
  const prior = mergeWorksheetEditions(base, existing);
  const expectedTeacher = buildTeacherCatalog(prior);
  const expectedLanding = buildTeacherLandingCatalog(prior);
  for (const isDefault of [false, true]) {
    const pdf = pdfOnlyFixture(); pdf.editions.forEach(row => { row.isDefault = isDefault; });
    const registry = { version: 1, editions: [...existing.editions, ...pdf.editions] };
    const merged = mergeWorksheetEditions(base, registry);
    const before = JSON.stringify(merged);
    assert.deepEqual(buildTeacherCatalog(base, registry), expectedTeacher);
    assert.deepEqual(buildTeacherCatalog(merged), expectedTeacher);
    const landing = buildTeacherLandingCatalog(merged);
    assert.deepEqual(landing, expectedLanding);
    for (const row of pdf.editions) {
      assert.equal(getTeacherLandingScope({ grade: row.grade, topic: row.topicId, edition: row.editionId }, landing), null);
      const scope = getTeacherLandingScope({ grade: row.grade, topic: row.topicId }, landing)!;
      assert.deepEqual(scope.pdfIds, [topic(base, row.grade, row.topicId).levels[0].pdfId]);
      const selected = resolveEdition(topic(merged, row.grade, row.topicId), row.editionId);
      for (const level of selected.levels) assert.equal(
        buildWorksheetHref({ catalog: merged, grade: row.grade, topic: topic(merged, row.grade, row.topicId),
          levelKey: level.key, editionId: row.editionId }), base.config.pdfBase + level.pdfId + '.pdf');
    }
    assert.equal(JSON.stringify(merged), before, 'teacher projections must not alter student editions');
    topic(merged, pdf.editions[0].grade, pdf.editions[0].topicId).defaultEditionId = 'unavailable';
    assert.throws(() => buildTeacherLandingCatalog(merged), /Unavailable teacher default edition/);
  }
});

test('PDF-only mode rejects absent or invalid provenance, including unpublished rows', () => {
  for (const field of ['pdfSha256', 'sourceSha256', 'nativeExportSha256']) {
    for (const value of [undefined, '', 'a'.repeat(63), 'A'.repeat(64), 'a'.repeat(64) + '\n']) {
      const rows = pdfOnlyFixture(); rows.editions[0].status = 'draft';
      (rows.editions[0].levels[0] as any)[field] = value;
      assert.throws(() => mergeWorksheetEditions(base, rows), new RegExp(field));
    }
  }
  for (const [field, value] of [['pdfId', 'not-media'], ['worksheetId', ''], ['revision', 0], ['viewerLevel', 'E']]) {
    const rows = pdfOnlyFixture(); (rows.editions[0].levels[0] as any)[field] = value;
    assert.throws(() => mergeWorksheetEditions(base, rows), /Worksheet editions:/);
  }
  for (const prefix of [undefined, 'G8-T86']) {
    const rows = pdfOnlyFixture(); (rows.editions[0] as any).nativePrefix = prefix;
    assert.throws(() => mergeWorksheetEditions(base, rows), /nativePrefix/);
  }
});

test('PDF-only mode forbids future artifact placeholders instead of accepting fake hash fields', () => {
  for (const field of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
    for (const value of [null, sha('synthetic-but-unavailable-' + field)]) {
      const rows = pdfOnlyFixture(); (rows.editions[0].levels[0] as any)[field] = value;
      assert.throws(() => mergeWorksheetEditions(base, rows), /unknown fields/);
    }
  }
});

test('PDF-only mode is explicit, restricted to grades 7–9, and keeps the no-mode contract strict', () => {
  for (const value of [undefined, null, 'full', 'PDF-only']) {
    const rows = pdfOnlyFixture(); (rows.editions[0] as any).publicationMode = value;
    assert.throws(() => mergeWorksheetEditions(base, rows), /publicationMode/);
  }
  const elementary: any = editionFixture(); elementary.editions[0].publicationMode = 'pdf-only';
  assert.throws(() => mergeWorksheetEditions(base, elementary), /publicationMode/);
  const unmarked: any = pdfOnlyFixture(); delete unmarked.editions[0].publicationMode;
  assert.throws(() => mergeWorksheetEditions(base, unmarked), /unknown fields|canonicalSourceSha256/);
  for (const fixture of [editionFixture(), middleEditionFixture()]) {
    assert.doesNotThrow(() => mergeWorksheetEditions(base, fixture));
    for (const field of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
      const incomplete: any = structuredClone(fixture); delete incomplete.editions[0].levels[0][field];
      assert.throws(() => mergeWorksheetEditions(base, incomplete), new RegExp(field));
    }
  }
});

test('PDF-only editions retain collision and complete-three-level safeguards', () => {
  const cases: Array<(r: ReturnType<typeof pdfOnlyFixture>) => void> = [
    r => { r.editions[0].levels.pop(); },
    r => { r.editions[0].levels[1].key = r.editions[0].levels[0].key; },
    r => { r.editions[0].levels[0].pdfId = topic(base, 7, 17).levels[0].pdfId; },
    r => { r.editions[0].levels[1].pdfId = r.editions[0].levels[0].pdfId; },
    r => { r.editions[0].levels[1].pdfSha256 = r.editions[0].levels[0].pdfSha256; },
    r => { r.editions[0].levels[1].worksheetId = r.editions[0].levels[0].worksheetId; },
    r => { r.editions.push(structuredClone(r.editions[0])); },
  ];
  for (const mutate of cases) { const rows = pdfOnlyFixture(); mutate(rows); assert.throws(() => mergeWorksheetEditions(base, rows), /Worksheet editions:/); }
});

test('JSON schema agrees on PDF-only provenance, forbidden future fields and the existing contract', () => {
  const require = createRequire(import.meta.url);
  const Ajv2020 = require('ajv/dist/2020.js');
  const schema = JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.schema.json', import.meta.url), 'utf8'));
  const validate = new Ajv2020({ strict: false, allErrors: true }).compile(schema);
  const actual = JSON.parse(readFileSync(new URL('../../catalog/worksheet-editions.v1.json', import.meta.url), 'utf8'));
  for (const rows of [actual, editionFixture(), middleEditionFixture(), pdfOnlyFixture()]) {
    assert.equal(validate(rows), true, JSON.stringify(validate.errors));
  }
  const invalid: any[] = [];
  for (const field of ['pdfSha256', 'sourceSha256', 'nativeExportSha256']) {
    const rows: any = pdfOnlyFixture(); delete rows.editions[0].levels[0][field]; invalid.push(rows);
  }
  for (const field of ['canonicalSourceSha256', 'manifestSha256', 'answerMapSha256', 'wordSourceSha256', 'hintsBundleSha256']) {
    const rows: any = pdfOnlyFixture(); rows.editions[0].levels[0][field] = sha('unavailable'); invalid.push(rows);
    const old: any = middleEditionFixture(); delete old.editions[0].levels[0][field]; invalid.push(old);
  }
  const unmarked: any = pdfOnlyFixture(); delete unmarked.editions[0].publicationMode; invalid.push(unmarked);
  const wrongGrade: any = editionFixture(); wrongGrade.editions[0].publicationMode = 'pdf-only'; invalid.push(wrongGrade);
  const wrongMode: any = pdfOnlyFixture(); wrongMode.editions[0].publicationMode = 'full'; invalid.push(wrongMode);
  for (const rows of invalid) {
    assert.equal(validate(rows), false);
    assert.throws(() => mergeWorksheetEditions(base, rows), /Worksheet editions:/);
  }
});
