import assert from 'node:assert/strict';
import { isolateMathRuns } from '../../src/lib/mathDirection';
import { createHash } from 'node:crypto';
import reviewed from '../../../../docs/middle-090-091-094-pdf-20261121.json';

import seven from '../../../../docs/middle-b18-seven-pdf-20261122.json';

export { reviewed, seven };
const releases = [reviewed, seven];
const allPackages = [...reviewed.packages, ...seven.packages];
export const renewalIds = allPackages.map(item => item.edition.editionId);
// The SSR loader normalizes property insertion order without changing data.
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
})).digest('hex');
const strip = (text: string) => text.replace(/[⁦-⁩]/g, '');

/** Recover the catalog before the November 21–22 PDF editions, while checking each exact overlay. */
export function beforeNovember21Catalog<T>(catalog: T): T {
  const result: any = structuredClone(catalog);
  for (const item of allPackages) {
    const topic = result.grades.find((g: any) => g.grade === item.grade)?.topics.find((t: any) => t.id === item.topicId);
    assert.ok(topic, item.slug);
    assert.deepEqual(topic.editions?.map((e: any) => e.editionId), [item.edition.editionId], item.slug);
    assert.equal(digest(topic.editions[0]), item.generatedEditionSha256, item.slug);
    delete topic.editions;
    delete topic.defaultEditionId;
    assert.equal(digest(topic), item.priorTopicSha256, item.slug);
  }
  return result;
}

export function beforeNovember21Registry<T>(registry: T): T {
  const result: any = structuredClone(registry);
  assert.deepEqual(result.editions.slice(-renewalIds.length), allPackages.map(item => item.edition));
  result.editions.splice(-renewalIds.length);
  return result;
}

export function beforeNovember21Copy<T>(slug: string, page: T): T {
  const release = releases.find(batch => batch.packages.some(p => p.slug === slug));
  const item = release?.packages.find(p => p.slug === slug);
  if (!release || !item) return page;
  const result: any = structuredClone(page);
  if ('priorCopyEdits' in item) {
    for (const edit of item.priorCopyEdits) {
      const parent = edit.path.slice(0, -1).reduce((node: any, key) => node[key], result);
      const key = edit.path.at(-1)!;
      assert.equal(strip(parent[key]), edit.after, slug);
      parent[key] = parent[key] === edit.after ? edit.before : isolateMathRuns(edit.before);
    }
  }
  const section = result.sections.pop();
  assert.equal(strip(section.heading), item.section.heading, slug);
  assert.deepEqual(section.blocks.map((b: any) => strip(b.text)), item.section.blocks.map(b => b.text), slug);
  if (result.bodyFlow) {
    const tail = result.bodyFlow.splice(-1 - section.blocks.length);
    assert.deepEqual(tail.map((b: any) => strip(b.text)), [item.section.heading, ...item.section.blocks.map(b => b.text)], slug);
  }
  assert.equal(result.updatedLine, item.priorUpdatedLine ? release.updatedLine : null, slug);
  result.updatedLine = item.priorUpdatedLine;
  const originalDate = item.priorUpdatedLine?.match(/(\d+)\.(\d+)\.(\d+)$/);
  for (const node of result.jsonLd?.['@graph'] || []) {
    if (['WebPage', 'LearningResource'].includes(node['@type']) && node.dateModified === release.date) {
      assert.ok(originalDate, slug);
      node.dateModified = [originalDate[3], originalDate[2].padStart(2, '0'), originalDate[1].padStart(2, '0')].join('-');
    }
  }
  return result;
}
