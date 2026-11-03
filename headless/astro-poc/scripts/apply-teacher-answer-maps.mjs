#!/usr/bin/env node
/** Attach verified public PDF rectangles, never private solution text. */
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function validateAnswerMap(source, map) {
  const prefix = source.pdfId + ': ';
  assert.equal(map?.version, 1, prefix + 'missing answer map');
  assert.match(map.sourceSha256 || '', /^[a-f0-9]{64}$/, prefix + 'missing PDF digest');
  // sourceSha256 is the original question-geometry provenance. Republished
  // PDFs retain it; answerSourceSha256 identifies the actual current PDF.
  if (source.answerSourceSha256) assert.equal(map.sourceSha256, source.answerSourceSha256, prefix + 'answer PDF digest changed');
  assert.ok(Array.isArray(map.questions), prefix + 'invalid questions');
  const expected = [...new Set(source.questions.map(item => Number(item.q)))].sort((a, b) => a - b);
  const actual = map.questions.map(item => item.q).sort((a, b) => a - b);
  assert.deepEqual(actual, expected, prefix + 'answer coverage must match every whole question exactly');
  const rectangles = [];
  for (const answer of map.questions) {
    assert.ok(Array.isArray(answer.parts), prefix + answer.q + ': missing part coverage');
    const parts = [...new Set(source.questions.filter(item => Number(item.q) === answer.q).map(item => item.part || '').filter(Boolean))];
    for (const part of parts) assert.ok(answer.parts.includes(part), prefix + answer.q + part + ': missing part');
    if (answer.unavailableReason) {
      assert.ok(['missing-answer-section', 'missing-answer-body', 'incomplete-answer-placeholder', 'unseparable-source-answer'].includes(answer.unavailableReason), prefix + answer.q + ': unknown content gap');
      // Explicitly missing original answers are not fabricated or treated as
      // usable geometry. The picker explains the gap and printing fails closed.
      if (!answer.crops?.length) continue;
    }
    assert.ok(answer.crops?.length, prefix + answer.q + ': no rectangles');
    for (const crop of answer.crops) {
      const { page, x, y, w, h } = crop;
      assert.ok(Number.isInteger(page) && page >= 1 && page <= source.pageCount, prefix + answer.q + ': page');
      if (source.answerStartPage) assert.ok(page >= source.answerStartPage, prefix + answer.q + ': before answers');
      assert.ok([x, y, w, h].every(Number.isFinite) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.000001 && y + h <= 1.000001, prefix + answer.q + ': invalid rectangle');
      for (const other of rectangles) {
        if (other.q === answer.q || other.page !== page) continue;
        const overlapX = Math.min(x + w, other.x + other.w) - Math.max(x, other.x);
        const overlapY = Math.min(y + h, other.y + other.h) - Math.max(y, other.y);
        assert.ok(overlapX <= 0.00001 || overlapY <= 0.00001, prefix + answer.q + ': overlaps answer ' + other.q);
      }
      rectangles.push({ ...crop, q: answer.q });
    }
  }
  return map;
}

export function applyTeacherAnswerMaps({ check = false } = {}) {
  const bundle = JSON.parse(readFileSync(join(root, 'src/data/teacher-answer-maps.json'), 'utf8'));
  assert.equal(bundle.version, 1);
  const catalog = JSON.parse(readFileSync(join(root, 'public/teachers/teacher-catalog.json'), 'utf8'));
  const ids = [...new Set(catalog.grades.flatMap(grade => grade.topics.flatMap(topic => topic.sheets.filter(sheet => sheet.mode === 'exercise').map(sheet => sheet.pdfId))))];
  assert.deepEqual(Object.keys(bundle.maps).sort(), [...ids].sort(), 'Answer maps must cover the current catalog exactly');
  let questions = 0;
  let crops = 0;
  let unavailableQuestions = 0;
  let unavailableSheets = 0;
  let fullyUnavailableSheets = 0;
  let partiallyUnavailableSheets = 0;
  // Validate the entire batch before writing any generated sheet.
  const updates = ids.map(id => {
    const path = join(root, 'public/teachers/sheets', id + '.json');
    const source = JSON.parse(readFileSync(path, 'utf8'));
    const map = validateAnswerMap(source, bundle.maps[id]);
    questions += map.questions.length;
    const unavailableCount = map.questions.filter(question => question.unavailableReason).length;
    unavailableQuestions += unavailableCount;
    unavailableSheets += Number(unavailableCount > 0);
    fullyUnavailableSheets += Number(unavailableCount > 0 && unavailableCount === map.questions.length);
    partiallyUnavailableSheets += Number(unavailableCount > 0 && unavailableCount < map.questions.length);
    crops += map.questions.reduce((sum, question) => sum + (question.crops || []).length, 0);
    if (check) {
      assert.deepEqual(source.answerMap, map, id + ': generated answer map is stale');
      assert.equal(source.answerGeometry, 'question-crops', id + ': generated geometry mode is stale');
      assert.equal(source.answerSourceSha256, map.sourceSha256, id + ': answer PDF digest is stale');
    }
    return { path, source: { ...source, answerGeometry: 'question-crops', answerSourceSha256: map.sourceSha256, answerMap: map } };
  });
  if (!check) for (const { path, source } of updates) writeFileSync(path, JSON.stringify(source));
  return { sheets: ids.length, questions, crops, unavailableQuestions, unavailableSheets, fullyUnavailableSheets, partiallyUnavailableSheets, status: 'PASS', check };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyTeacherAnswerMaps({ check: process.argv.includes('--check') })));
}
