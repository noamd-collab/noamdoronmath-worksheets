import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './next12-pdf-reviewed.json';

export { reviewed as reviewedNext12 };
export const reviewedNext12Ids = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const plain = (value: unknown): unknown => typeof value === 'string' ? value.replace(/[\u2066-\u2069]/g, '')
  : Array.isArray(value) ? value.map(plain) : value && typeof value === 'object'
    ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)])) : value;

/** Undo only four fixed overlays before the complete historical catalog fences. */
export function beforeNext12Catalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  for (const a of reviewed.additions) {
    const t = restored.grades.find((g: any) => g.grade === a.grade).topics.find((t: any) => t.id === a.topicId);
    assert.equal(t.defaultEditionId, 'legacy');
    assert.equal(t.editions.length, 1);
    assert.equal(sha(t.editions[0]), a.generatedEditionSha256, `${a.editionId}: exact overlay`);
    delete t.editions; delete t.defaultEditionId;
    assert.equal(sha(t), a.baselineTopicSha256, `${a.editionId}: all legacy fields preserved`);
  }
  return restored;
}

export function beforeNext12Registry<T>(registry: T): T {
  const restored: any = structuredClone(registry);
  for (const a of reviewed.additions) {
    const matches = restored.editions.filter((e: any) => e.editionId === a.editionId);
    assert.deepEqual(matches, [a.edition]);
    restored.editions = restored.editions.filter((e: any) => e.editionId !== a.editionId);
  }
  return restored;
}

/** Require every reviewed new value before reversing its exact baseline field. */
export function beforeNext12Copy<T>(slug: string, page: T): T {
  const d = reviewed.landingDeltas.find(d => d.slug === slug);
  if (!d) return page;
  const restored: any = structuredClone(page);
  for (const change of d.fields) {
    const key = change.path[0];
    const actual: any = plain(restored[key]);
    // loadTopicPage adds the visible date only to these two schema nodes.
    // Permit raw or hydrated input, requiring the exact reviewed date first.
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
