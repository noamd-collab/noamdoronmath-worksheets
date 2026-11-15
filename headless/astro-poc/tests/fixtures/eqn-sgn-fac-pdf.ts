import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import reviewed from './eqn-sgn-fac-pdf-reviewed.json';

export { reviewed as reviewedEqnSgnFac };
export const reviewedEqnSgnFacIds = reviewed.additions.map(a => a.editionId);
const sha = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Reverse only this reviewed additive batch before older complete catalog fences. */
export function beforeEqnSgnFacCatalog<T>(catalog: T): T {
  const restored: any = structuredClone(catalog);
  for (const addition of reviewed.additions) {
    const topic = restored.grades.find((g: any) => g.grade === addition.grade).topics.find((t: any) => t.id === addition.topicId);
    assert.equal(topic.defaultEditionId, 'legacy');
    assert.equal(topic.editions.length, 1, `${addition.editionId}: exactly one addition`);
    const edition = topic.editions[0];
    assert.equal(edition.editionId, addition.editionId);
    assert.equal(edition.publicationMode, 'pdf-only');
    assert.deepEqual(edition.levels.map((l: any) => l.pdfId), addition.pdfIds);
    assert.equal(sha(edition), addition.generatedEditionSha256, `${addition.editionId}: exact reviewed overlay`);
    delete topic.editions; delete topic.defaultEditionId;
    assert.equal(sha(topic), addition.baselineTopicSha256, `${addition.editionId}: all original topic fields`);
  }
  return restored;
}

/** Keep historical landing fixtures; accept only exact new scope and copy fields. */
export function beforeEqnSgnFacCopy<T>(slug: string, page: T): T {
  const delta = reviewed.landingDeltas.find(d => d.slug === slug);
  if (!delta) return page;
  const restored: any = structuredClone(page);
  assert.deepEqual(restored.sections.at(-1), delta.appendedSection, `${slug}: exact PDF scope`);
  restored.sections.pop();
  for (const change of delta.fields) {
    let owner = restored;
    for (const key of change.path.slice(0, -1)) owner = owner[key];
    const key = change.path.at(-1)!;
    // loadTopicPage inserts only directional isolates into visible Latin text.
    assert.equal(String(owner[key]).replace(/[\u2066-\u2069]/g, ''), change.after, `${slug}: exact ${change.path.join('.')}`);
    owner[key] = change.before;
  }
  return restored;
}
