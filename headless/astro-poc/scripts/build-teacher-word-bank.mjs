#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { richXml } from '../../../demos/teacher-word-export.js';
import { verifyWordBankArtifact } from './lib/word-bank-artifact.mjs';
const app = join(dirname(fileURLToPath(import.meta.url)), '..');
const root = join(app, '../..'), sourceDir = join(root, 'tools/teacher-word-content/sources');
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
  for (const q of Object.values(sheet.questions)) {
    assert.equal(q.id, pdfId + ':' + q.q);
    const parts = [...new Set(original.questions.filter(p => p.q === q.q).map(p => p.part).filter(Boolean))];
    assert.deepEqual(new Set(q.items.map(p => p.label).filter(Boolean)), new Set(parts), q.id + ': subpart coverage');
    for (const part of [q, ...q.items]) {
      if (part !== q) assert.ok(part.answer?.trim(), q.id + ': missing answer');
      for (const text of [part.text, part.answer, part.example?.title, ...(part.example?.lines || []), ...(part.table?.head || []), ...(part.table?.rows?.flat() || [])].filter(Boolean)) richXml(text);
      if (part.figure) {
        assert.ok(/^\/(noam-ai\/native\/|teachers\/word-figures\/)/.test(part.figure.url) && !part.figure.url.includes('..'));
        const path = part.figure.url.startsWith('/noam-ai/') ? join(root, part.figure.url.slice(1)) : join(app, 'public', part.figure.url.slice(1));
        assert.equal(createHash('sha256').update(readFileSync(path)).digest('hex'), part.figure.sha256, q.id + ': figure changed');
      }
    }
    q.requiredQuestions = [...new Set([q, ...q.items].flatMap(p => [...String(p.text || '').matchAll(/(?:ב|מ|ל)?שאלה\s+(\d+)/g)].map(m => Number(m[1]))).filter(n => n !== q.q && sheet.questions[n]))];
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
