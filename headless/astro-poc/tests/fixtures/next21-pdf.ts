import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './next21-pdf-reviewed.json';

export { reviewed as reviewedNext21 };
export const reviewedNext21Ids = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = (value: unknown): unknown => typeof value === 'string' ? value.replace(/[\u2066-\u2069]/g, '')
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

/** Require the complete seven-edition overlay before recovering canonical451e. */
export function beforeNext21Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  for (const addition of reviewed.additions) {
    const topic = restored.grades.find((g: any) => g.grade === addition.grade)
      .topics.find((t: any) => t.id === addition.topicId);
    assert.equal(topic.defaultEditionId, 'legacy', `${addition.editionId}: original default`);
    assert.equal(topic.editions.length, 1, `${addition.editionId}: exactly one addition`);
    assert.equal(sha(topic.editions[0]), addition.generatedEditionSha256, `${addition.editionId}: exact overlay`);
    delete topic.editions;
    delete topic.defaultEditionId;
    assert.equal(sha(topic), addition.baselineTopicSha256, `${addition.editionId}: every original topic field`);
  }
  return restored;
}

/** Exact rows, not a broad ID filter: substitutions and duplicate rows must fail. */
export function beforeNext21Registry<T>(registry: T): T {
  const restored: any = structuredClone(registry);
  for (const addition of reviewed.additions) {
    const matches = restored.editions.filter((e: any) => e.editionId === addition.editionId);
    assert.deepEqual(matches, [addition.edition], `${addition.editionId}: exact reviewed registry row`);
    restored.editions = restored.editions.filter((e: any) => e.editionId !== addition.editionId);
  }
  return restored;
}

/** Preserve historical snapshots by validating each new field before reversing it. */
export function beforeNext21Copy<T>(slug: string, page: T): T {
  const delta = reviewed.landingDeltas.find(d => d.slug === slug);
  if (!delta) return page;
  const restored: any = structuredClone(page);
  for (const change of delta.fields) {
    assert.equal(change.path.length, 1, `${slug}: reviewed top-level copy field`);
    const key = change.path[0];
    const actual: any = plain(restored[key]);
    if (key === 'jsonLd') {
      const dated = actual['@graph'].filter((n: any) => ['WebPage', 'LearningResource'].includes(n['@type']));
      if (dated.some((n: any) => Object.hasOwn(n, 'dateModified'))) {
        for (const node of dated) {
          assert.equal(node.dateModified, '2026-11-15', `${slug}: exact hydrated date`);
          delete node.dateModified;
        }
      }
    }
    assert.deepEqual(actual, plain(change.after), `${slug}: exact ${key}`);
    if (change.existedBefore) restored[key] = structuredClone(change.before);
    else delete restored[key];
  }
  return restored;
}
