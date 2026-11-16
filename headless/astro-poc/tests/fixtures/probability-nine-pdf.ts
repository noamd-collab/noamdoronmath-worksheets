import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './probability-nine-pdf-reviewed.json';

export { reviewed as reviewedProbabilityNine };
export const probabilityNineIds = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = (value: unknown): unknown => typeof value === 'string' ? value.replace(/[\u2066-\u2069]/g, '')
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

/** Validate all three exact overlays, then retain the complete old topic fence. */
export function beforeProbabilityNineCatalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  const topic = restored.grades.find((g: any) => g.grade === 9).topics.find((t: any) => t.id === 10);
  assert.equal(topic.defaultEditionId, 'legacy');
  assert.deepEqual(topic.editions.map((e: any) => e.editionId), probabilityNineIds);
  for (const [index, addition] of reviewed.additions.entries()) {
    assert.equal(sha(topic.editions[index]), addition.generatedEditionSha256, 'exact reviewed PDF overlay');
  }
  delete topic.editions;
  delete topic.defaultEditionId;
  assert.equal(sha(topic), reviewed.baselineTopicSha256, 'every original probability field');
  return restored;
}

export function beforeProbabilityNineRegistry<T>(registry: T): T {
  const restored: any = structuredClone(registry);
  for (const addition of reviewed.additions) {
    assert.deepEqual(restored.editions.filter((e: any) => e.editionId === addition.editionId), [addition.edition]);
    restored.editions = restored.editions.filter((e: any) => e.editionId !== addition.editionId);
  }
  return restored;
}

export function beforeProbabilityNineCopy<T>(slug: string, page: T): T {
  const delta = reviewed.landingDeltas.find(d => d.slug === slug);
  if (!delta) return page;
  const restored: any = structuredClone(page);
  for (const field of delta.fields) {
    assert.equal(field.path.length, 1);
    const key = field.path[0];
    const actual: any = plain(restored[key]);
    if (key === 'jsonLd') for (const node of actual['@graph']) {
      if (['WebPage', 'LearningResource'].includes(node['@type']) && Object.hasOwn(node, 'dateModified')) {
        assert.equal(node.dateModified, '2026-11-16');
        delete node.dateModified;
      }
    }
    assert.deepEqual(actual, plain(field.after), `exact probability copy: ${key}`);
    restored[key] = structuredClone(field.before);
  }
  return restored;
}
