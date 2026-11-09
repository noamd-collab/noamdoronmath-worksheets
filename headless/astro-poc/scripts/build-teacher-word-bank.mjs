#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { richXml, tableXml } from '../../../demos/teacher-word-export.js';
import { verifyWordBankArtifact } from './lib/word-bank-artifact.mjs';
const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(app, '../..'), sourceDir = join(root, 'tools/teacher-word-content/sources');

// Canonical sources carry immutable figure occurrences in addition to the
// existing public PDF/answer proof. Neither contract replaces the other.
export function validateCanonicalWordSource(pdfId, sheet, original, readAsset) {
  if (sheet.sourceFormat === undefined) {
    assert.equal(sheet.canonicalSourceSha256, undefined, 'Word canonical source format missing');
    return;
  }
  assert.equal(sheet.sourceFormat, 'noam-canonical-word-source-v1');
  assert.ok(typeof sheet.worksheetId === 'string' && sheet.worksheetId.trim());
  assert.ok(Number.isSafeInteger(sheet.revision) && sheet.revision > 0);
  assert.match(sheet.canonicalSourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(sheet.canonicalSourceSha256, original.canonicalSourceSha256, pdfId + ': stale canonical source');
  assert.equal(sheet.sourceSha256, original.sourceSha256, pdfId + ': stale PDF source');
  assert.ok(typeof sheet.worksheetInstructions === 'string' && sheet.worksheetInstructions.trim());
  assert.equal(createHash('sha256').update(sheet.worksheetInstructions).digest('hex'), sheet.worksheetInstructionsSha256, 'Word instructions changed');
  richXml(sheet.worksheetInstructions);
  for (const match of sheet.worksheetInstructions.matchAll(/(?:ב|מ|ל)?שאלה\s+(\d+)/g)) {
    assert.ok(Object.hasOwn(sheet.questions, String(Number(match[1]))), 'Word instructions reference unavailable question');
  }
  const occurrences = new Map();
  for (const question of Object.values(sheet.questions)) {
    assert.ok(Number.isSafeInteger(question.grade) && question.grade >= 1 && question.grade <= 6, 'Word canonical grade invalid');
    assert.match(question.canonicalQuestionId, /^[A-Za-z0-9][A-Za-z0-9_.:-]*$/);
    assert.match(question.canonicalQuestionSha256, /^[a-f0-9]{64}$/);
    const sourceParts = original.questions.filter(part => part.q === question.q);
    assert.ok(sourceParts.length && sourceParts.every(part => part.canonicalQuestionId === question.canonicalQuestionId), 'Word question owner mismatch');
    assert.deepEqual(question.items.map(item => item.canonicalItemId), sourceParts.map(part => part.canonicalItemId), 'Word item identity mismatch');
    for (const item of question.items) {
      const lines = item.answerLines === undefined ? 0 : item.answerLines;
      assert.ok(Number.isSafeInteger(lines) && lines >= 0 && lines <= 3, 'Word answerLines invalid');
    }
    for (const part of [question, ...question.items]) {
      if (!part.figure) continue;
      const figure = part.figure, binding = figure.binding;
      assert.ok(binding && typeof binding.figureId === 'string', 'Word figure binding missing');
      assert.equal(binding.canonicalSourceSha256, sheet.canonicalSourceSha256, 'Word figure source mismatch');
      assert.equal(binding.questionId, question.canonicalQuestionId, 'Word figure question owner mismatch');
      assert.equal(binding.questionSha256, question.canonicalQuestionSha256, 'Word figure question hash mismatch');
      assert.equal(binding.itemId, part === question ? null : part.canonicalItemId, 'Word figure item owner mismatch');
      assert.match(binding.sourceSvgSha256, /^[a-f0-9]{64}$/);
      assert.match(figure.sha256, /^[a-f0-9]{64}$/);
      assert.equal(figure.url, `/teachers/word-figures/${figure.sha256}.png`, 'Word figure immutable PNG path required');
      const bytes = readAsset(figure.url);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), figure.sha256, 'Word figure PNG changed');
      assert.ok(bytes.length >= 33 && Buffer.from(bytes).subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])), 'Word figure PNG bytes required');
      const list = occurrences.get(binding.figureId) || [];
      list.push({ questionId: binding.questionId, questionSha256: binding.questionSha256, itemId: binding.itemId });
      occurrences.set(binding.figureId, list);
    }
  }
  if (!occurrences.size) { assert.equal(sheet.figureAssets, null, 'Word unexpected figure manifest'); return; }
  const manifest = sheet.figureAssets;
  assert.ok(manifest && manifest.sourceFormat === 'noam-word-figure-assets' && manifest.schemaVersion === 1, 'Word figure manifest missing');
  assert.equal(manifest.canonicalSourceSha256, sheet.canonicalSourceSha256);
  assert.equal(manifest.worksheetId, sheet.worksheetId);
  assert.equal(manifest.revision, sheet.revision);
  assert.equal(manifest.renderer?.name, 'svg_word/weasyprint+pymupdf', 'Word figure renderer missing');
  assert.equal(manifest.renderer.dpi, 260);
  for (const key of ['weasyprint', 'pymupdf']) assert.match(manifest.renderer[key], /^\d+(?:\.\d+)+(?:[A-Za-z0-9.+-]*)?$/, 'Word figure renderer version missing');
  assert.match(manifest.renderer.fontSha256, /^[a-f0-9]{64}$/, 'Word figure renderer font missing');
  assert.ok(Array.isArray(manifest.figures));
  assert.equal(manifest.figures.length, occurrences.size, 'Word figure manifest coverage');
  const used = new Set();
  for (const asset of manifest.figures) {
    assert.ok(!used.has(asset.figureId) && occurrences.has(asset.figureId), 'Word duplicate/unknown figure manifest');
    used.add(asset.figureId);
    assert.deepEqual(asset.occurrences, occurrences.get(asset.figureId), 'Word figure occurrence coverage');
    for (const question of Object.values(sheet.questions)) for (const part of [question, ...question.items]) {
      if (part.figure?.binding?.figureId !== asset.figureId) continue;
      assert.equal(part.figure.binding.sourceSvgSha256, asset.sourceSvgSha256);
      for (const key of ['url', 'sha256', 'displayWidthPx']) assert.equal(part.figure[key], asset[key], 'Word figure asset mapping mismatch');
    }
    const bytes = Buffer.from(readAsset(asset.url));
    assert.equal(bytes.readUInt32BE(16), asset.widthPx); assert.equal(bytes.readUInt32BE(20), asset.heightPx);
    assert.ok(asset.widthPx > 0 && asset.heightPx > 0 && asset.widthPx * asset.heightPx <= 4000000);
    assert.ok(Number.isFinite(asset.displayWidthPx) && asset.displayWidthPx > 0 && asset.displayWidthPx <= Math.min(2000, asset.widthPx));
  }
}
// Called only after the enclosing source and public answer proofs are checked.
// An explicit canonical dependency must not disappear just because its wording
// does not contain the legacy Hebrew "question N" pattern.
export function collectRequiredQuestions(question, questions) {
  const explicit = question.requiredQuestions === undefined ? [] : question.requiredQuestions;
  assert.ok(Array.isArray(explicit), question.id + ': requiredQuestions must be an array');
  for (const n of explicit) {
    assert.ok(Number.isSafeInteger(n) && n > 0 && n <= 999,
      question.id + ': invalid required question');
    assert.notEqual(n, question.q, question.id + ': self dependency');
    assert.ok(Object.hasOwn(questions, String(n)), question.id + ': missing required question ' + n);
  }
  const inferred = [question, ...question.items].flatMap(part =>
    [...String(part.text || '').matchAll(/(?:ב|מ|ל)?שאלה\s+(\d+)/g)].map(match => Number(match[1]))
  ).filter(n => n !== question.q && Object.hasOwn(questions, String(n)));
  return [...new Set([...explicit, ...inferred])];
}

export function buildTeacherWordBank() {
  const parse = p => JSON.parse(readFileSync(p, 'utf8'));
  const proof = new Map(parse(join(root, 'tools/teacher-word-content/source-proof.json')).map(row => [row.pdfId, row]));
  const sheets = {};
  for (const name of readdirSync(sourceDir).filter(n => /^[a-f0-9]{32}\.json$/.test(n)).sort()) {
    const pdfId = name.slice(0, -5), entry = parse(join(sourceDir, name));
    const source = parse(join(app, 'public/teachers/sheets', name));
    assert.equal(entry.sourceSha256, source.sourceSha256, pdfId + ': stale question source');
    assert.equal(proof.get(pdfId)?.answerPDFSha256, entry.answerSourceSha256, pdfId + ': unverified public answers');
    assert.ok(source.answerSourceSha256 === entry.answerSourceSha256 || source.answerMap.questions.some(q => q.answerDocument?.sha256 === entry.answerSourceSha256), pdfId + ': answers no longer match the print source');
    assert.deepEqual(Object.keys(entry.questions).map(Number).sort((a,b)=>a-b), [...new Set(source.questions.map(q => q.q))].sort((a,b)=>a-b), pdfId + ': whole-question coverage');
    sheets[pdfId] = entry;
  }
  // These are reviewed transcriptions of the ten explicitly approved repairs.
  // Their neighboring elementary questions remain unavailable until transcribed.
  const approved = parse(join(app, 'src/data/teacher-word-approved-g6.json'));
  const addedData = parse(join(app, 'src/data/teacher-approved-question-data.json'));
  assert.equal(approved.questions.length, 10);
  for (const row of approved.questions) {
    assert.ok(addedData.answers.some(a => a.pdfId === row.pdfId && a.q === row.question.q && a.sourceSha256 === row.sourceSha256));
    const sheet = sheets[row.pdfId] ||= { sourceSha256: row.sourceSha256, questions: {} };
    assert.equal(sheet.sourceSha256, row.sourceSha256);
    assert.ok(!sheet.questions[row.question.q]);
    sheet.questions[row.question.q] = row.question;
  }
  let count = 0;
  for (const [pdfId, sheet] of Object.entries(sheets)) {
    const original = parse(join(app, 'public/teachers/sheets', pdfId + '.json'));
    validateCanonicalWordSource(pdfId, sheet, original,
      url => readFileSync(join(app, 'public', url.slice(1))));
    for (const q of Object.values(sheet.questions)) {
      assert.equal(q.id, pdfId + ':' + q.q);
      const parts = [...new Set(original.questions.filter(p => p.q === q.q).map(p => p.part).filter(Boolean))];
      assert.deepEqual(new Set(q.items.map(p => p.label).filter(Boolean)), new Set(parts), q.id + ': subpart coverage');
      for (const part of [q, ...q.items]) {
        // Validate the new explicit contract without reinterpreting legacy
        // source tables (some predate the exporter's head/rows contract).
        if (part.table && (part.table.kind !== undefined || part.table.direction !== undefined)) tableXml(part.table);
        if (part !== q) assert.ok(part.answer?.trim(), q.id + ': missing answer');
        for (const text of [part.text, part.answer, part.example?.title, ...(part.example?.lines || []), ...(part.table?.head || []), ...(part.table?.rows?.flat() || [])].filter(Boolean)) richXml(text);
        if (part.figure) {
          assert.ok(/^\/(noam-ai\/native\/|teachers\/word-figures\/)/.test(part.figure.url) && !part.figure.url.includes('..'));
          const path = part.figure.url.startsWith('/noam-ai/') ? join(root, part.figure.url.slice(1)) : join(app, 'public', part.figure.url.slice(1));
          assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), part.figure.sha256, q.id + ': figure changed');
        }
      }
      q.requiredQuestions = collectRequiredQuestions(q, sheet.questions);
      count++;
    }
  }
  const bank = { version: 1, sheets };
  const bundle = { version: 1, sheets: Object.keys(sheets).length, questions: count, gzipBase64: gzipSync(JSON.stringify(bank), { level: 9 }).toString('base64') };
  const output = join(app, 'src/data/teacher-word-content.json');
  const checking = process.argv.includes('--check');
  const content = checking ? readFileSync(output, 'utf8') : JSON.stringify(bundle) + '\n';
  verifyWordBankArtifact(content, bank);
  const bundleSha256 = createHash('sha256').update(content).digest('hex');
  const descriptor = { bundlePath: `/teachers/word-content.${bundleSha256}.json`, bundleSha256, bundleBytes: Buffer.byteLength(content), sheets: bundle.sheets, questions: count };
  const descriptorFile = join(app, 'src/data/teacher-word-descriptor.json');
  const descriptorContent = JSON.stringify(descriptor) + '\n';
  if (!checking) writeFileSync(output, content);
  if (process.argv.includes('--check')) assert.equal(readFileSync(descriptorFile, 'utf8'), descriptorContent, 'Word descriptor is stale');
  else writeFileSync(descriptorFile, descriptorContent);
  // This immutable public data is served as one static asset, outside the worker
  // code upload. Keeping it inline exceeded Wix's finalization request limit.
  writeFileSync(join(app, 'public', descriptor.bundlePath), content);
  console.log(JSON.stringify({ status: 'PASS', sheets: bundle.sheets, questions: count }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) buildTeacherWordBank();
