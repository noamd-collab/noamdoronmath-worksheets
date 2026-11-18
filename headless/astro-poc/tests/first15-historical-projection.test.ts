import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { beforeFirst15Correction } from './helpers/beforeFirst15Correction';
import { beforeReviewedRamziActivation } from './helpers/beforeReviewedRamziActivation';

const current = beforeReviewedRamziActivation(JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8')));
const units = (c: any) => c.grades.flatMap((g: any) => g.topics.flatMap((t: any) =>
  (t.editions || []).flatMap((e: any) => e.levels.filter((l: any) => l.ramzi))));
const digest = (c: any) => createHash('sha256').update(JSON.stringify(c, null, 2) + '\n').digest('hex');

test('the verified correction reverses to the exact deployed historical catalog, without mutating input', () => {
  const before = JSON.stringify(current);
  const historical = beforeFirst15Correction(current);
  // Catalog bytes at the published baseline e4ad27c7 (batch 11, live since 18.11; the port
  // of #499 onto it), not a new expected value generated from the correction or from
  // mergeWorksheetEditions. At 58f2892df the same projection was 17bedac5…; batches
  // next21 to 11 and the new base topics were published in between.
  assert.equal(digest(historical), '7b09f211cddfd16dd334b7c886fb616794ec258bc231b7e07a5aeda5ef137bbb');
  assert.equal(units(historical).length, 12);
  assert.equal(JSON.stringify(current), before);
});

const mutations: Array<[string, (c: any) => void]> = [
  ['missing correction', c => { delete c.ramziHintCorrection; }],
  ['forged correction receipt', c => { c.ramziHintCorrection.record.readbackReceiptSha256 = '0'.repeat(64); }],
  ['forged correction status', c => { c.ramziHintCorrection.record.status = 'planned'; }],
  ['changed observation', c => { c.ramziHintCorrection.readback.observedAt = '2026-11-15T00:00:00.000Z'; }],
  ['changed historical readiness', c => { c.ramziActivation.payloadSha256 = '0'.repeat(64); }],
  ['stale unit payload', c => { units(c)[0].ramzi.payloadSha256 = c.ramziActivation.payloadSha256; }],
  ['stale unit readback', c => { units(c)[0].ramzi.verifiedDbReadbackReceiptSha256 = c.ramziActivation.verifiedDbReadbackReceiptSha256; }],
  ['changed source pin', c => { units(c)[0].ramzi.nativeExportSha256 = '0'.repeat(64); }],
  ['missing unit', c => { delete units(c)[0].ramzi; }],
  ['wrong PDF identity', c => { units(c)[0].pdfId = '0'.repeat(32); }],
  ['wrong level identity', c => { units(c)[0].key = 'c'; }],
  ['unexpected correction field', c => { units(c)[0].ramzi.unreviewed = true; }],
];
for (const [label, mutate] of mutations) test('historical rollback rejects ' + label, () => {
  const bad = structuredClone(current); mutate(bad);
  assert.throws(() => beforeFirst15Correction(bad));
});

test('historical rollback does not erase an unrelated legacy change', () => {
  const bad = structuredClone(current);
  bad.grades[0].topics[0].title += ' changed';
  const historical = beforeFirst15Correction(bad);
  assert.equal(historical.grades[0].topics[0].title, bad.grades[0].topics[0].title);
  // The unrelated change keeps the rollback away from the published baseline catalog.
  assert.notEqual(digest(historical), '7b09f211cddfd16dd334b7c886fb616794ec258bc231b7e07a5aeda5ef137bbb');
});
