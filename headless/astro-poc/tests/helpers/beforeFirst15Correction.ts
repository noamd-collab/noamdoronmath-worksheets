import assert from 'node:assert/strict';
import { readFirst567Activation } from './first567Activation';

/** Reverse only the applied, independently verified 15-row correction metadata.
 * Historical catalog hashes remain frozen. Never use the catalog merger as the
 * rollback oracle or remove an arbitrary readiness field to make a hash pass. */
export function beforeFirst15Correction<T>(catalog: T): T {
  const phase = readFirst567Activation();
  assert.ok(phase.hintCorrection, 'historical projection requires the actual correction evidence');
  const restored: any = structuredClone(catalog);
  assert.deepEqual(restored.ramziActivation, phase.ready, 'historical readiness remains exact');
  assert.deepEqual(restored.ramziHintCorrection, phase.hintCorrection, 'only the actual applied correction may be reversed');
  const seen = new Set<string>();
  for (const grade of restored.grades) for (const topic of grade.topics) {
    for (const edition of topic.editions || []) for (const level of edition.levels) {
      if (!level.ramzi) continue;
      const unit = phase.units.get(level.pdfId);
      assert.ok(unit, 'no unexpected corrected unit');
      assert.equal(edition.editionId, unit.editionId);
      assert.equal(level.key, unit.level);
      assert.ok(!seen.has(level.pdfId), 'no duplicated corrected unit');
      seen.add(level.pdfId);
      assert.deepEqual(level.ramzi, {
        status: 'ready', manifestSha256: unit.manifestSha256,
        nativeExportSha256: unit.nativeExportSha256,
        sourceNativeExportSha256: unit.sourceNativeExportSha256,
        canonicalSourceSha256: unit.canonicalSourceSha256,
        itemCount: unit.itemCount, hintCount: unit.hintCount,
        payloadSha256: phase.hintCorrection.record.effectivePayloadSha256,
        verifiedDbReadbackReceiptSha256: phase.hintCorrection.record.readbackReceiptSha256,
      }, 'the exact corrected unit metadata must be present before rollback');
      level.ramzi.payloadSha256 = phase.ready.payloadSha256;
      level.ramzi.verifiedDbReadbackReceiptSha256 = phase.ready.verifiedDbReadbackReceiptSha256;
    }
  }
  assert.deepEqual([...seen].sort(), [...phase.units.keys()].sort(), 'all twelve corrected unit projections are present');
  delete restored.ramziHintCorrection;
  return restored;
}
