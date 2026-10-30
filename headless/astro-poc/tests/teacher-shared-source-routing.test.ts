import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { classifierRequestBody, hrefForSheet, parseClassifier, selectTeacherPicks } from '../../../noam-ai/site-companion/teacher-pick.js';
import { buildCatalogRecords } from '../../../noam-ai/site-companion/retrieve.js';
import { wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
const index = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const records = buildCatalogRecords(catalog);
const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

test('saved grade 7 and current grade 9 sections keep independent context when they share a cached PDF', () => {
  const teacherCatalog = JSON.parse(readFileSync(new URL('../public/teachers/teacher-catalog.json', import.meta.url), 'utf8'));
  const ninth = index.find((sheet: any) => sheet.grade === 9 && sheet.topicId === '23' && sheet.level === 'a');
  const seventh = index.find((sheet: any) => sheet.grade === 7 && sheet.pdfId === ninth.pdfId);
  assert.ok(seventh);
  const source = JSON.parse(readFileSync(new URL(`../public/teachers/sheets/${ninth.pdfId}.json`, import.meta.url), 'utf8'));
  const before = JSON.stringify(source);
  const first = `ex:${source.pdfId}:${source.questions[0].id}`;
  const last = `ex:${source.pdfId}:${source.questions.at(-1).id}`;
  const app = new Function('CATALOG', 'source', 'seventh', 'ninth', 'first', 'last', `
    const state = { grade: '9', topic: ninth.topicId, scenario: 'other',
      blocks: [{ grade: '7', topic: seventh.topicId, title: seventh.topic, kind: 'review', keys: [first] }] };
    const sheets = new Map([[source.pdfId, source]]);
    const sectionKind = value => value;
    ${['gradeRecord', 'exKey', 'sourceForContext', 'questionsForKeys', 'pageBlocks', 'escapeHTML', 'levelPrintName', 'metaHTML'].map(definition).join('\n')}
    return { saved: () => pageBlocks()[0].questions, current: () => questionsForKeys([last]),
      meta: chosen => metaHTML(chosen, { label: 'תרגול' }), state };
  `)(teacherCatalog, source, seventh, ninth, first, last);
  const saved = app.saved();
  const current = app.current();
  assert.ok(saved.length && current.length);
  assert.ok(saved.every((question: any) => question.source.grade === 7 && question.source.gradeLabel === 'כיתה ז׳' && question.source.topic === seventh.topic));
  assert.ok(current.every((question: any) => question.source.grade === 9 && question.source.gradeLabel === 'כיתה ט׳' && question.source.topic === ninth.topic));
  assert.notEqual(saved[0].source, current[0].source);
  assert.equal(JSON.stringify(source), before, 'Geometry and metadata in the shared PDF cache remain unchanged');
  const html = app.meta([...saved, ...current]);
  assert.match(html, /כיתה ז׳/);
  assert.match(html, /כיתה ט׳/);
  app.state.grade = '7';
  app.state.topic = seventh.topicId;
  assert.equal(app.current()[0].source.gradeLabel, 'כיתה ז׳');
  assert.equal(app.saved()[0].source.gradeLabel, 'כיתה ז׳');
  assert.equal(current[0].source.gradeLabel, 'כיתה ט׳', 'A later scope change cannot alter a prepared grade 9 section');
});

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
