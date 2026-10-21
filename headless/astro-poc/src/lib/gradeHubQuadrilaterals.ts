/**
 * Grade-hub quadrilateral links follow the catalog parent-topic order.
 * That is the same sequence Noam AI uses in noam-ai/site-companion/topic-order.js.
 * A link stays put unless its label is one of those quadrilateral topics.
 */
import type { CatalogV1 } from './catalog/types';

interface HubLink {
  label: string;
}

interface AlignableHub {
  grade: number;
  topicSections: Array<{ heading: string | null; links: HubLink[] }>;
  topicLinks: HubLink[];
}

export function bareTopicTitle(value: string): string {
  return String(value || '')
    .replace(/[\u0591-\u05C7]/g, '')
    .replace(/[׳״"']/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
    .replace(/^ה/, '');
}

/** Parent topics in a מרובעים group, triangles removed, catalog order kept. */
export function catalogQuadrilateralTitles(catalog: CatalogV1, grade: number): string[] {
  const entry = catalog.grades.find((item) => item.grade === grade);
  if (!entry) return [];
  const groupKeys = new Set(
    entry.groups.filter((group) => group.label.includes('מרובע')).map((group) => group.key)
  );
  return entry.topics
    .filter(
      (topic) =>
        topic.parent == null &&
        groupKeys.has(topic.group) &&
        !topic.title.includes('משולש')
    )
    .map((topic) => topic.title);
}

export function orderQuadrilateralLinks<T extends { label: string }>(
  links: readonly T[],
  titles: readonly string[]
): T[] {
  const rank = new Map(titles.map((title, index) => [bareTopicTitle(title), index]));
  const slots: number[] = [];
  links.forEach((link, index) => {
    if (rank.has(bareTopicTitle(link.label))) slots.push(index);
  });
  if (slots.length < 2) return links.slice();
  const sorted = slots
    .map((index) => links[index])
    .sort(
      (a, b) =>
        (rank.get(bareTopicTitle(a.label)) ?? 0) - (rank.get(bareTopicTitle(b.label)) ?? 0)
    );
  const next = links.slice();
  slots.forEach((slot, index) => {
    next[slot] = sorted[index];
  });
  return next;
}

export function alignGradeHubQuadrilaterals<T extends AlignableHub>(
  hub: T,
  catalog: CatalogV1
): T {
  const titles = catalogQuadrilateralTitles(catalog, hub.grade);
  if (titles.length < 2) return hub;
  hub.topicSections = hub.topicSections.map((section) => ({
    ...section,
    links: orderQuadrilateralLinks(section.links, titles),
  }));
  hub.topicLinks = orderQuadrilateralLinks(hub.topicLinks, titles);
  return hub;
}
