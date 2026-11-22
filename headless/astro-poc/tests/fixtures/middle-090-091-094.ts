import assert from 'node:assert/strict';
import { isolateMathRuns } from '../../src/lib/mathDirection';
import { createHash } from 'node:crypto';
import { beforeGrade9SpecialTrianglesReview } from '../helpers/beforeGrade9SpecialTrianglesReview';
import reviewed from '../../../../docs/middle-090-091-094-pdf-20261121.json';

import seven from '../../../../docs/middle-b18-seven-pdf-20261122.json';

import three from '../../../../docs/middle-077-078-079-pdf-20261122.json';

import renew from '../../../../docs/middle-reviewed-packages-050-076-20261122.json';

import nextRenew from '../../../../docs/middle-renewal-wave2-20261122.json';

export { reviewed, seven, three, renew, nextRenew };
const releases = [nextRenew, renew, three, seven, reviewed];
const allPackages = [...reviewed.packages, ...seven.packages, ...three.packages, ...renew.packages, ...nextRenew.packages];
export const renewalIds = allPackages.map(item => item.edition.editionId);
// The SSR loader normalizes property insertion order without changing data.
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value, (_key, item) => {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
  return Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]]));
})).digest('hex');
const strip = (text: string) => text.replace(/[⁦-⁩]/g, '');

/** Recover the catalog before the November 21–22 PDF editions, while checking each exact overlay. */
export function beforeNovember21Catalog<T>(catalog: T): T {
  return catalogBeforePackages(beforeGrade9SpecialTrianglesReview(catalog), allPackages);
}

export function catalogBeforePackages<T>(catalog: T, packages: typeof allPackages): T {
  const result: any = structuredClone(catalog);
  for (const item of [...packages].reverse()) {
    const topic = result.grades.find((g: any) => g.grade === item.grade)?.topics.find((t: any) => t.id === item.topicId);
    assert.ok(topic, item.slug);
    const priorIds = 'priorEditionIds' in item && Array.isArray(item.priorEditionIds) ? item.priorEditionIds : [];
    assert.deepEqual(topic.editions?.map((e: any) => e.editionId), [...priorIds, item.edition.editionId], item.slug);
    assert.equal(digest(topic.editions.pop()), item.generatedEditionSha256, item.slug);
    if (!topic.editions.length) {
      delete topic.editions;
      delete topic.defaultEditionId;
    }
    assert.equal(digest(topic), item.priorTopicSha256, item.slug);
  }
  return result;
}

type RegistryEdition = { editionId: string };

/** Reverse only the named release block and verify every entry, position and order. */
export function registryBeforeRelease<T>(registry: T, expected: RegistryEdition[]): T {
  const result: any = structuredClone(registry);
  const index = result.editions.findIndex((edition: RegistryEdition) => edition.editionId === expected[0].editionId);
  assert.ok(index >= 0, expected[0].editionId);
  assert.deepEqual(result.editions.splice(index, expected.length), expected);
  return result;
}

export function beforeNovember21Registry<T>(registry: T): T {
  return registryBeforeRelease(registry, allPackages.map(item => item.edition));
}

export function beforeNovember21Copy<T>(slug: string, page: T): T {
  return releases.reduce((current, release) => copyBeforeRelease(slug, current, release), page);
}

export function copyBeforeRelease<T>(slug: string, page: T, release: typeof releases[number]): T {
  const item = release.packages.find(p => p.slug === slug);
  const companion = release === nextRenew && slug === 'coordinate-plane-grade-8'
    ? nextRenew.additionalLandingEdits['coordinate-plane-grade-8'] : [];
  if (!item && !companion.length) return page;
  const result: any = structuredClone(page);
  const edits = item && 'priorCopyEdits' in item && Array.isArray(item.priorCopyEdits)
    ? item.priorCopyEdits : companion;
  for (const edit of edits) {
    const path: (string | number)[] = edit.path;
    const parent = path.slice(0, -1).reduce<any>((node, key) => node[key], result);
    const key = path.at(-1)!;
    assert.equal(strip(parent[key]), edit.after, slug);
    parent[key] = parent[key] === edit.after ? edit.before : isolateMathRuns(edit.before);
  }
  if (!item) return result;
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
