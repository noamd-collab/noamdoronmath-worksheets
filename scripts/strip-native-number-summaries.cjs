#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

// The authoring kit synthesizes this JSON-only, deduplicated bag of numbers
// from the introduction, table AND all subsections. It is not printed givens.
// Only text-only records in this exact format qualify; typed relations stay.
function isGenericNumberSummary(given) {
  return given && !Array.isArray(given) && typeof given === 'object' &&
    Object.keys(given).length === 1 && typeof given.text === 'string' &&
    /^הנתונים: \$[+−-]?\d+(?:\.\d+)?\$(?:, \$[+−-]?\d+(?:\.\d+)?\$)*$/.test(given.text);
}

function printedStrings(value, result = []) {
  if (typeof value === 'string') result.push(value);
  else if (Array.isArray(value)) value.forEach(item => printedStrings(item, result));
  else if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => {
      if (!['given', 'to_prove', 'to_construct'].includes(key)) printedStrings(item, result);
    });
  }
  return result;
}

function summariesForQuestion(question) {
  const printed = printedStrings(question);
  return (question.given || []).filter(isGenericNumberSummary).map(g => g.text)
    .filter(text => !printed.some(value => value.includes(text)));
}

function cleanManifest(manifest, native) {
  const cleaned = JSON.parse(JSON.stringify(manifest));
  const questions = new Map(native.questions.map(q => [q.id, q]));
  const changes = [];
  for (const exercise of cleaned.exercises || []) {
    const question = questions.get(exercise.nativeQuestionId);
    if (!question || !question.items.some(item => item.id === exercise.nativeItemId && item.label === exercise.part)) continue;
    const summaries = new Set(summariesForQuestion(question));
    for (const field of ['context', 'prompt']) {
      if (typeof exercise[field] !== 'string') continue;
      const removed = [];
      const value = exercise[field].split('\n').filter(line => {
        if (!summaries.has(line.trim())) return true;
        removed.push(line.trim()); return false;
      }).join('\n');
      if (removed.length) {
        changes.push({ exerciseId: exercise.id, questionId: question.id, field, removed });
        exercise[field] = value;
      }
    }
  }
  return { manifest: cleaned, changes };
}

function scan(repo, write = false) {
  const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
  const directory = path.join(repo, 'noam-ai/manifests');
  const files = fs.readdirSync(directory).filter(name => name.endsWith('.json')).sort();
  const result = { nativeManifests: 0, mainQuestions: 0, strictSummaryEntries: 0,
    affectedManifests: 0, affectedQuestions: 0, affectedExercises: 0, removedLineOccurrences: 0, changes: [] };
  // Validate the entire input set before writing either public mirror.
  const writes = [];
  for (const name of files) {
    const sourcePath = path.join(directory, name), bytes = fs.readFileSync(sourcePath);
    const manifest = JSON.parse(bytes);
    if (!manifest.nativeExportUrl) continue;
    if (!/^\/noam-ai\/native\/G[789]-[A-Z0-9]+\/[abc]\/noam-ai\.json$/.test(manifest.nativeExportUrl)) throw Error('Invalid native path: ' + name);
    const nativePath = path.join(repo, manifest.nativeExportUrl), nativeBytes = fs.readFileSync(nativePath);
    if (sha(nativeBytes) !== manifest.nativeExportSha256) throw Error('Native SHA mismatch: ' + name);
    const publicPath = path.join(repo, 'headless/astro-poc/public/noam-ai/manifests', name);
    if (!bytes.equals(fs.readFileSync(publicPath))) throw Error('Manifest mirror mismatch: ' + name);
    if (!nativeBytes.equals(fs.readFileSync(path.join(repo, 'headless/astro-poc/public', manifest.nativeExportUrl)))) throw Error('Native mirror mismatch: ' + name);
    const native = JSON.parse(nativeBytes), fixed = cleanManifest(manifest, native);
    result.nativeManifests++;
    result.mainQuestions += native.questions.length;
    result.strictSummaryEntries += native.questions.reduce((n, q) => n + (q.given || []).filter(isGenericNumberSummary).length, 0);
    if (!fixed.changes.length) continue;
    const record = { pdfId: name.slice(0, -5), nativeExportUrl: manifest.nativeExportUrl,
      nativeSha256: manifest.nativeExportSha256, changes: fixed.changes };
    result.changes.push(record);
    result.affectedManifests++;
    result.affectedQuestions += new Set(fixed.changes.map(c => c.questionId)).size;
    result.affectedExercises += new Set(fixed.changes.map(c => c.exerciseId)).size;
    result.removedLineOccurrences += fixed.changes.reduce((n, c) => n + c.removed.length, 0);
    writes.push([sourcePath, publicPath, JSON.stringify(fixed.manifest, null, 2) + '\n']);
  }
  if (write) for (const [sourcePath, publicPath, bytes] of writes) {
    fs.writeFileSync(sourcePath, bytes); fs.writeFileSync(publicPath, bytes);
  }
  return result;
}

module.exports = { isGenericNumberSummary, summariesForQuestion, cleanManifest, scan };
if (require.main === module) {
  const args = process.argv.slice(2), write = args.includes('--write');
  if (args.some(arg => !['--write', '--check'].includes(arg)) || write && args.includes('--check')) throw Error('Use --write or --check');
  const result = scan(path.resolve(__dirname, '..'), write);
  console.log(JSON.stringify(result, null, 2));
  if (!write && result.affectedManifests) process.exitCode = 1;
}
