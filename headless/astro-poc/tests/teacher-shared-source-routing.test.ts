import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifierRequestBody, hrefForSheet, parseClassifier, selectTeacherPicks } from '../../../noam-ai/site-companion/teacher-pick.js';
import { buildCatalogRecords } from '../../../noam-ai/site-companion/retrieve.js';
import { wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const records = buildCatalogRecords(catalog);

test('all 31 reused sources keep their requested grade and topic in returned links', () => {
  const reused = index.filter((sheet: any) => records.some((record: any) => record.pdfId === sheet.pdfId && record.grade !== sheet.grade) && sheet.grade === 9);
  assert.equal(reused.length, 31, 'Exercise the real shared-source routes restored in the live catalog');
  for (const sheet of reused) {
    const record = records.find((item: any) => item.pdfId === sheet.pdfId && item.grade === sheet.grade && String(item.topicId) === sheet.topicId && item.levelKey === sheet.level);
    assert.ok(record, `${sheet.grade}:${sheet.topicId}:${sheet.level}`);
    const href = hrefForSheet(sheet, catalog);
    assert.equal(href, record.href);
    const url = new URL(href, 'https://www.noamdoronmath.co.il');
    assert.equal(url.searchParams.get('back'), '/worksheets?grade=9');
    assert.equal(url.searchParams.get('topic'), sheet.topicId);
    assert.equal(url.searchParams.get('g'), '7', 'The protected viewer still loads the verified original source grade');
    const pick = `ex:${sheet.pdfId}:${sheet.questions[0]}`;
    const handoff = wizardPrefillFromSearch(`?grade=9&topic=${sheet.topicId}&level=${sheet.level === 'one' ? 'all' : sheet.level}&pick=${encodeURIComponent(pick)}`);
    assert.equal(handoff.grade, '9');
    assert.equal(handoff.topic, sheet.topicId);
    assert.deepEqual(handoff.exerciseIds, [pick]);
  }
});

test('a missing requested grade never falls through to another grade that shares the PDF', () => {
  const sheet = index.find((item: any) => item.grade === 9 && item.topicId === '23');
  assert.ok(sheet);
  assert.equal(hrefForSheet({ ...sheet, grade: 1 }, catalog), sheet.pdfUrl);
});

for (const topic of ['43', '54']) {
  for (const count of [5, 10, 15]) {
    test(`grade 8 topic ${topic}: AI ${count} can choose the second excellence source without collisions`, () => {
      const sheets = index.filter((sheet: any) => sheet.grade === 8 && sheet.topicId === topic && ['c', 'c2'].includes(sheet.level));
      assert.deepEqual(sheets.map((sheet: any) => sheet.level).sort(), ['c', 'c2']);
      const candidates = sheets.flatMap((sheet: any) => {
        const seen = new Set<number>();
        return sheet.questions.filter((label: string) => {
          const q = parseInt(label, 10);
          if (seen.has(q)) return false;
          seen.add(q); return true;
        }).map((label: string) => ({ id: `${sheet.level}:${label}`, label, text: `שאלה ${parseInt(label, 10)}`, key: `ex:${sheet.pdfId}:${label}` }));
      });
      const expected = candidates.filter((candidate: any) => candidate.id.startsWith('c2:')).slice(-count);
      assert.equal(expected.length, count);
      const classification = parseClassifier(JSON.stringify({ grade: 8, level: 'c', exerciseLabels: expected.map((candidate: any) => candidate.id) }));
      assert.deepEqual(classification.scopedExerciseLabels, expected.map((candidate: any) => candidate.id));
      for (const level of ['all', 'c']) {
        const input = { message: `בחר ${count} שאלות`, page: { kind: 'teachers' }, teacher: { grade: '8', topic, level, count, candidates } };
        const prompt = classifierRequestBody(input, index).messages[1].content;
        for (const candidate of candidates) assert.ok(prompt.includes(`${candidate.id} (`), candidate.id);
        const picked = selectTeacherPicks(index, input, classification);
        assert.equal(picked.selectionSource, 'classifier');
        assert.deepEqual(new Set(picked.exerciseIds), new Set(expected.map((candidate: any) => candidate.key)));
        assert.deepEqual(new Set(picked.modelExerciseIds), new Set(expected.map((candidate: any) => candidate.key)));
        assert.ok(picked.sheets.every((sheet: any) => sheet.grade === 8 && sheet.topicId === topic && sheet.level === 'c2'));
      }
    });
  }
}
