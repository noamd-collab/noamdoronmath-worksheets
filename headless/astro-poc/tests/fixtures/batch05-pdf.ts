import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './batch05-pdf-reviewed.json';
import { beforeBatch06Catalog, beforeBatch06Copy, beforeBatch06Registry } from './batch06-pdf';

export { reviewed as reviewedBatch05 };
export const reviewedBatch05Ids = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const shaPage = (value: unknown) => createHash('sha256').update(JSON.stringify(value, null, 2) + '\n').digest('hex');
const plain = (value: unknown): unknown => typeof value === 'string' ? value.replace(/[⁦-⁩]/g, '')
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

/** Undo only reviewed appended editions and verify each topic returns to its pinned baseline. */
export function beforeBatch05Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(beforeBatch06Catalog(catalog));
  const groups = new Map<string, typeof reviewed.additions>();
  for (const addition of reviewed.additions) {
    const key = `${addition.grade}:${addition.topicId}`;
    groups.set(key, [...(groups.get(key) || []), addition]);
  }
  for (const group of groups.values()) {
    const first = group[0];
    const topic = restored.grades.find((g: any) => g.grade === first.grade)
      .topics.find((t: any) => t.id === first.topicId);
    assert.deepEqual(topic.editions.map((e: any) => e.editionId),
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

/** Validate exact registry rows before removing them; substitutions and duplicates fail. */
export function beforeBatch05Registry<T>(registry: T): T {
  const restored: any = structuredClone(beforeBatch06Registry(registry));
  for (const addition of reviewed.additions) {
    const matches = restored.editions.filter((e: any) => e.editionId === addition.editionId);
    assert.deepEqual(matches, [addition.edition], `${addition.editionId}: exact reviewed registry row`);
    restored.editions = restored.editions.filter((e: any) => e.editionId !== addition.editionId);
  }
  return restored;
}

/** Verify changed landing fields and recover the exact pre-batch page. */
export function beforeBatch05Copy<T>(slug: string, page: T): T {
  const delta = reviewed.landingDeltas.find(d => d.slug === slug);
  const afterBatch06 = beforeBatch06Copy(slug, page);
  if (!delta) return afterBatch06;
  const restored: any = structuredClone(afterBatch06);
  for (const change of delta.fields) {
    assert.equal(change.path.length, 1, `${slug}: reviewed top-level copy field`);
    const key = change.path[0];
    const actual: any = plain(restored[key]);
    if (key === 'jsonLd') {
      const dated = actual['@graph'].filter((n: any) => ['WebPage', 'LearningResource'].includes(n['@type']));
      if (dated.some((n: any) => Object.hasOwn(n, 'dateModified'))) {
        for (const node of dated) {
          assert.equal(node.dateModified, '2026-11-17', `${slug}: exact hydrated date`);
          delete node.dateModified;
        }
      }
    }
    assert.deepEqual(actual, plain(change.after), `${slug}: exact ${key}`);
    if (change.existedBefore) restored[key] = structuredClone(change.before);
    else delete restored[key];
  }
  assert.equal(shaPage(restored), delta.baselineSha256, `${slug}: complete baseline page`);
  return restored;
}
