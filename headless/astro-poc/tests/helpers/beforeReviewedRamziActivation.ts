import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { beforeGrade9SpecialTrianglesReview } from './beforeGrade9SpecialTrianglesReview';

const root = new URL('../../../../', import.meta.url), require = createRequire(import.meta.url);
const { validateAdditionalProjection } = require('../../../../scripts/lib/reviewed-ramzi-activation.mjs');
const read = (path: string) => JSON.parse(readFileSync(new URL(path, root), 'utf8'));
// Every older catalog fence calls this; the on-disk evidence does not change during a run.
let evidenceCache: { registry: any; trust: any; requests: any } | undefined;
const evidence = () => (evidenceCache ??= { registry: read('headless/catalog/worksheet-editions.v1.json'),
  trust: read('headless/catalog/ramzi-additional-trust.v1.json'), requests: read('headless/catalog/ramzi-additional-requests.v1.json') });

/** Reverse only the committed additional reviewed Ramzi activation, after
 * checking every field it added against the trusted, receipt-pinned capsule.
 * Older intake tests use this to keep asserting their own pre-activation state.
 * Never use the catalog merger as the rollback oracle. */
export function beforeReviewedRamziActivation<T>(catalog: T): T {
  const restored: any = beforeGrade9SpecialTrianglesReview(catalog);
  if (!Object.hasOwn(restored, 'reviewedRamziActivations')) {
    // Nothing was activated: prove it instead of silently passing a partial projection.
    for (const g of restored.grades) for (const t of g.topics) {
      assert.equal(Object.hasOwn(t, 'reviewedBaseBinding'), false, 'unprojected base binding');
      for (const e of t.editions || []) for (const l of e.levels) assert.equal(l.ramzi?.learningScopeUrl, undefined, 'unprojected reviewed level');
    }
    return restored;
  }
  const { registry, trust, requests } = evidence();
  assert.deepEqual(restored.reviewedRamziActivations, { schema: 'noam-reviewed-additional-ready/v1', batches: requests.batches.map((r: any) => ({
    scopeId: r.scopeId, scopeSha256: r.scopeSha256, readbackReceiptSha256: r.dbReadbackReceiptSha256,
    evidenceSha256: createHash('sha256').update(JSON.stringify(r)).digest('hex') })) }, 'only the committed receipt-backed activation may be reversed');
  const batches = validateAdditionalProjection(restored, registry, restored.reviewedRamziActivations, trust);
  assert.equal(batches.length, trust.scopes.length);
  for (const b of batches) {
    const topic = restored.grades.find((g: any) => g.grade === b.grade).topics.find((t: any) => t.id === b.topicId);
    const target = b.targetKind === 'edition' ? topic.editions.find((e: any) => e.editionId === b.editionId) : topic.reviewedBaseBinding;
    assert.ok(target, 'activated target ' + b.scopeId);
    assert.deepEqual(target.routing, { resolvedNoamPrefix: b.nativePrefix, aiHintShown: true, usesViewer: true, viewerPath: restored.config.viewer.path,
      siblingPdfQuery: Object.fromEntries(target.levels.map((l: any) => ['p' + l.key, l.pdfId])) }, 'exact activated routing ' + b.scopeId);
    const original = b.targetKind === 'edition' ? registry.editions.find((e: any) => e.editionId === b.editionId) : null;
    for (const level of target.levels) {
      const unit = b.units.find((u: any) => u.level === level.key);
      assert.deepEqual(level.ramzi, { status: 'ready', manifestSha256: unit.manifestSha256, nativeExportSha256: unit.nativeExportSha256,
        sourceNativeExportSha256: unit.sourceNativeExportSha256, canonicalSourceSha256: unit.canonicalSourceSha256, itemCount: unit.itemCount,
        hintCount: unit.hintCount, payloadSha256: b.payloadSha256, verifiedDbReadbackReceiptSha256: b.readbackReceiptSha256,
        learningScopeSha256: b.learningScopeSha256, learningScopeUrl: b.learningScopeUrl }, 'exact activated level ' + b.scopeId + '/' + level.key);
      assert.equal(level.sourceSha256, unit.canonicalSourceSha256);
      for (const field of ['worksheetId', 'revision', 'pdfSha256']) assert.equal(level[field], unit[field]);
      assert.equal(level.nativeExportSha256, unit.sourceNativeExportSha256);
      if (original) {
        delete level.ramzi;
        level.sourceSha256 = original.levels.find((l: any) => l.key === level.key).sourceSha256;
      }
    }
    if (original) { target.routing.aiHintShown = false; target.routing.usesViewer = false; }
    else delete topic.reviewedBaseBinding;
  }
  delete restored.reviewedRamziActivations;
  return restored;
}
