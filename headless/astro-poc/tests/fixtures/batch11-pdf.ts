import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './batch11-pdf-reviewed.json';
import { beforeFirst15Correction } from '../helpers/beforeFirst15Correction';
import { beforeReviewedRamziActivation } from '../helpers/beforeReviewedRamziActivation';

export { reviewed as reviewedBatch11 };
export const reviewedBatch11Ids = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const shaPage = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const plain = (value: unknown): unknown => typeof value === 'string' ? value.replace(/[⁦-⁩]/g, '')
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

/** Undo only batch 11's reviewed overlays and return the exact earlier state. */
export function beforeBatch11Catalog<T>(catalog: T): T {
  // The verified first15 hint-correction metadata (Codex #499, ported 18.11) is newer than
  // batch 11: reverse it first, exactly once, for every older catalog fence.
  // The receipt-backed additional Ramzi activation is newer still: reverse it before that.
  const restored: any = structuredClone(beforeFirst15Correction(beforeReviewedRamziActivation(catalog)));
  const groups = new Map<string, typeof reviewed.additions>();
  for (const addition of reviewed.additions) {
    const key = `${addition.grade}:${addition.topicId}`;
    groups.set(key, [...(groups.get(key) || []), addition]);
  }
  for (const group of groups.values()) {
    const first = group[0];
    const topic = restored.grades.find((g: any) => g.grade === first.grade)
      .topics.find((t: any) => t.id === first.topicId);
    assert.deepEqual((topic.editions ?? []).map((e: any) => e.editionId),
      [...first.baselineEditionIds, ...group.map(a => a.editionId)], `${first.editionId}: only reviewed appended editions`);
    for (const addition of [...group].reverse()) {
      assert.deepEqual(addition.baselineEditionIds, first.baselineEditionIds, `${addition.editionId}: shared baseline`);
      assert.equal(addition.baselineTopicSha256, first.baselineTopicSha256, `${addition.editionId}: shared baseline topic`);
      assert.equal(sha(topic.editions.at(-1)), addition.generatedEditionSha256, `${addition.editionId}: exact overlay`);
      topic.editions.pop();
    }
    if (!topic.editions.length) {
      delete topic.editions;
      delete topic.defaultEditionId;
    }
    assert.equal(sha(topic), first.baselineTopicSha256, `${first.editionId}: every original topic field`);
  }
  return restored;
}

/** Validate exact registry rows before removing batch 11. */
export function beforeBatch11Registry<T>(registry: T): T {
  const restored: any = structuredClone(registry);
  for (const addition of reviewed.additions) {
    const matches = restored.editions.filter((e: any) => e.editionId === addition.editionId);
    assert.deepEqual(matches, [addition.edition], `${addition.editionId}: exact reviewed registry row`);
    restored.editions = restored.editions.filter((e: any) => e.editionId !== addition.editionId);
  }
  return restored;
}

/** Verify batch 11's exact changed fields and recover the earlier landing. */
export function beforeBatch11Copy<T>(slug: string, page: T): T {
  const delta = reviewed.landingDeltas.find(d => d.slug === slug);
  if (!delta) return page;
  const restored: any = structuredClone(page);
  for (const change of delta.fields) {
    assert.equal(change.path.length, 1, `${slug}: reviewed top-level copy field`);
    const key = change.path[0];
    const actual: any = plain(restored[key]);
    // A hydrated page (loadTopicPage) carries the batch date in its JSON-LD; restore the prior date with the line.
    if (key === 'updatedLine' && restored.jsonLd?.['@graph']) {
      const dated = restored.jsonLd['@graph'].filter((n: any) =>
        ['WebPage', 'LearningResource'].includes(n['@type']) && Object.hasOwn(n, 'dateModified'));
      for (const node of dated) {
        assert.equal(node.dateModified, '2026-11-18', `${slug}: exact hydrated date`);
        if (change.before === null) {
          delete node.dateModified;
        } else {
          const date = String(change.before).match(/(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
          assert.ok(date, `${slug}: prior updatedLine has a date`);
          node.dateModified = `${date[3]}-${date[2].padStart(2, '0')}-${date[1].padStart(2, '0')}`;
        }
      }
    }
    assert.deepEqual(actual, plain(change.after), `${slug}: exact ${key}`);
    if (change.existedBefore) restored[key] = structuredClone(change.before);
    else delete restored[key];
  }
  // The raw-file digest of the restored page is asserted in tests/batch09-pdf-intake.test.ts.
  return restored;
}
