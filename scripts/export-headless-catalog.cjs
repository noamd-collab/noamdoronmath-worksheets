#!/usr/bin/env node
'use strict';

/**
 * Export a deterministic headless catalog contract from index.html.
 *
 * Usage:
 *   node scripts/export-headless-catalog.cjs           # write headless/catalog/catalog.v1.json
 *   node scripts/export-headless-catalog.cjs --check   # validate existing file matches regeneraton
 *   node scripts/export-headless-catalog.cjs --dry-run # print stats only
 *
 * Does not modify index.html or any production runtime behavior.
 */

const fs = require('node:fs');
const {
  exportCatalog,
  assertDeterministic,
  OUT_JSON,
  validateCatalog,
  loadIndexCatalog,
  buildCatalog,
  stableStringify,
} = require('./lib/headless-catalog.cjs');

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');
const check = args.has('--check');

function fail(msg, code) {
  console.error(msg);
  process.exit(code == null ? 1 : code);
}

const det = assertDeterministic();
const result = exportCatalog({ dryRun: dryRun || check });
const { validation, hash, outPath, catalog } = result;

if (!validation.ok) {
  console.error('Catalog validation failed:');
  validation.errors.forEach((e) => console.error('  ✗ ' + e));
  fail('Export aborted.', 1);
}

if (validation.warnings.length) {
  console.log('Warnings:');
  validation.warnings.forEach((w) => console.log('  ⚠ ' + w));
}

const s = validation.stats;
console.log('Headless catalog contract v' + catalog.contractVersion);
console.log(
  [
    s.grades + ' grades',
    s.topics + ' topics',
    s.levels + ' worksheet levels',
    s.uniquePdfIds + ' unique PDF ids',
    s.searchEntries + ' SEARCH_TERMS entries',
    s.withNoamTopicId + ' topics with noamTopicId (x)',
    s.viewerRoutedLevels + ' viewer-routed levels',
    s.iconKeys + ' icons',
  ].join(' · ')
);
console.log('sha256 ' + hash);

if (check) {
  if (!fs.existsSync(OUT_JSON)) fail('Missing ' + OUT_JSON + ' — run without --check first.');
  const onDisk = fs.readFileSync(OUT_JSON, 'utf8');
  if (onDisk !== result.text) {
    fail('catalog.v1.json is out of date with index.html. Re-run: node scripts/export-headless-catalog.cjs');
  }
  // Re-validate on-disk parse
  const parsed = JSON.parse(onDisk);
  const raw = loadIndexCatalog();
  const again = validateCatalog(parsed, raw);
  if (!again.ok) {
    again.errors.forEach((e) => console.error('  ✗ ' + e));
    fail('On-disk catalog failed parity validation.');
  }
  console.log('OK — ' + OUT_JSON + ' matches deterministic export from index.html');
  process.exit(0);
}

if (dryRun) {
  console.log('Dry run — no file written.');
  process.exit(0);
}

console.log('Wrote ' + outPath);
// Touch-free confirmation that written bytes round-trip
const written = fs.readFileSync(outPath, 'utf8');
if (written !== stableStringify(buildCatalog(loadIndexCatalog()))) {
  fail('Post-write deterministic round-trip failed.');
}
process.exit(0);
