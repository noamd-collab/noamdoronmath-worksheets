#!/usr/bin/env node
/** Attach verified public PDF rectangles, never private solution text. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

export function validateAnswerDocument(doc, prefix = '') {
  const match = /^\/teachers\/answers\/([a-f0-9]{64})\.pdf$/.exec(doc?.url || '');
  assert.ok(match, prefix + 'answer document must be a local content-addressed PDF');
  assert.equal(doc.sha256, match[1], prefix + 'answer document digest does not match URL');
  assert.ok(Number.isSafeInteger(doc.pageCount) && doc.pageCount > 0, prefix + 'answer document page count');
  assert.ok(Number.isSafeInteger(doc.answerStartPage) && doc.answerStartPage > 0 && doc.answerStartPage <= doc.pageCount,
    prefix + 'answer document start page');
  return doc;
}

// Keep this separate from pure geometry validation so unit fixtures need no
// filesystem assets. Production builds always run both checks before writing.
export function validateAnswerAssets(map, { publicDir = join(root, 'public'), cache = new Map() } = {}) {
  for (const answer of map.questions) {
    if (answer.answerDocument === undefined) continue;
    const doc = validateAnswerDocument(answer.answerDocument);
    if (cache.has(doc.sha256)) {
      assert.equal(cache.get(doc.sha256), doc.pageCount, 'Inconsistent page counts for the same answer document');
      continue;
    }
    const bytes = readFileSync(join(publicDir, doc.url.slice(1)));
    assert.equal(bytes.subarray(0, 5).toString(), '%PDF-', doc.url + ': not a PDF');
    assert.equal(createHash('sha256').update(bytes).digest('hex'), doc.sha256, doc.url + ': asset digest mismatch');
    cache.set(doc.sha256, doc.pageCount);
  }
}

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
    const doc = answer.answerDocument !== undefined ? validateAnswerDocument(answer.answerDocument, prefix + answer.q + ': ') : source;
    const documentId = answer.answerDocument !== undefined ? 'answer:' + doc.sha256 : source.pdfId;
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
      assert.ok(Number.isInteger(page) && page >= 1 && page <= doc.pageCount, prefix + answer.q + ': page');
      if (doc.answerStartPage) assert.ok(page >= doc.answerStartPage, prefix + answer.q + ': before answers');
      assert.ok([x, y, w, h].every(Number.isFinite) && x >= 0 && y >= 0 && w > 0 && h > 0 && x + w <= 1.000001 && y + h <= 1.000001, prefix + answer.q + ': invalid rectangle');
      for (const other of rectangles) {
        if (other.q === answer.q || other.page !== page || other.documentId !== documentId) continue;
        const overlapX = Math.min(x + w, other.x + other.w) - Math.max(x, other.x);
        const overlapY = Math.min(y + h, other.y + other.h) - Math.max(y, other.y);
        assert.ok(overlapX <= 0.00001 || overlapY <= 0.00001, prefix + answer.q + ': overlaps answer ' + other.q);
      }
      rectangles.push({ ...crop, q: answer.q, documentId });
    }
  }
  return map;
}

export function applyTeacherAnswerMaps({ check = false } = {}) {
  const bundle = JSON.parse(readFileSync(join(root, 'src/data/teacher-answer-maps.json'), 'utf8'));
  const additions = JSON.parse(readFileSync(join(root, 'src/data/teacher-question-supplements.json'), 'utf8'));
  assert.equal(bundle.version, 1);
  assert.equal(additions.version, 1);
  const catalog = JSON.parse(readFileSync(join(root, 'public/teachers/teacher-catalog.json'), 'utf8'));
  const ids = [...new Set(catalog.grades.flatMap(grade => grade.topics.flatMap(topic => topic.sheets.filter(sheet => sheet.mode === 'exercise').map(sheet => sheet.pdfId))))];
  assert.deepEqual(Object.keys(bundle.maps).sort(), [...ids].sort(), 'Answer maps must cover the current catalog exactly');
  assert.ok(Object.keys(additions.supplements).every(id => ids.includes(id)), 'Unknown question supplement source');
  let questions = 0;
  let crops = 0;
  let unavailableQuestions = 0;
  let unavailableSheets = 0;
  let fullyUnavailableSheets = 0;
  let partiallyUnavailableSheets = 0;
  const assetCache = new Map();
  // Validate the entire batch before writing any generated sheet.
  const updates = ids.map(id => {
    const path = join(root, 'public/teachers/sheets', id + '.json');
    const source = JSON.parse(readFileSync(path, 'utf8'));
    const map = validateAnswerMap(source, bundle.maps[id]);
    validateAnswerAssets(map, { cache: assetCache });
    const supplement = additions.supplements[id];
    if (supplement) {
      assert.equal(supplement.sourceSha256, source.sourceSha256, id + ': stale added question data');
      const numbers = supplement.questions.map(q => q.q);
      assert.equal(new Set(numbers).size, numbers.length, id + ': duplicate question data');
      assert.ok(numbers.every(q => source.questions.some(item => Number(item.q) === q)), id + ': unknown supplemented question');
      const subset = { ...source, answerSourceSha256: source.sourceSha256,
        questions: source.questions.filter(q => numbers.includes(Number(q.q))).map(q => ({ ...q, part: '' })) };
      validateAnswerMap(subset, { version: 1, ...supplement });
      validateAnswerAssets(supplement, { cache: assetCache });
    }
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
      assert.deepEqual(source.questionSupplements, supplement, id + ': added question data is stale');
    }
    return { path, source: { ...source, answerGeometry: 'question-crops', answerSourceSha256: map.sourceSha256, answerMap: map,
      ...(supplement ? { questionSupplements: supplement } : {}) } };
  });
  if (!check) for (const { path, source } of updates) writeFileSync(path, JSON.stringify(source));
  return { sheets: ids.length, questions, crops, unavailableQuestions, unavailableSheets, fullyUnavailableSheets, partiallyUnavailableSheets, status: 'PASS', check };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(applyTeacherAnswerMaps({ check: process.argv.includes('--check') })));
}
