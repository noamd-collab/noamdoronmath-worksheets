import type { CatalogEdition, CatalogTopic, CatalogV1 } from './catalog/types';
import { resolveEdition, topicEditions, worksheetEditionNote } from './catalog/editions';
import { buildWorksheetHref } from './worksheetLinks';

export interface TopicWorksheetEditionLinks {
  editionId: string;
  label: string;
  pdfOnly: boolean;
  note: string | null;
  levels: Array<{ key: string; label: string; href: string }>;
}

const printLevelLabels = { a: 'רמה א׳', b: 'רמה ב׳', c: 'מצוינות' } as const;

/** Reviewed elementary PDFs hosted alongside their topic landing pages. */
export function elementaryPrintEdition(catalog: CatalogV1, grade: number, topicId: number): TopicWorksheetEditionLinks | undefined {
  const row = catalog.elementaryPrintTopics?.find(row => row.grade === grade && row.topicId === topicId);
  if (!row) return;
  return {
    editionId: 'elementary-print-20261121',
    label: 'דפי עבודה חדשים',
    pdfOnly: true,
    note: null,
    levels: (Object.keys(printLevelLabels) as Array<keyof typeof printLevelLabels>)
      .filter(key => row.levels.includes(key))
      .map(key => ({
        key,
        label: printLevelLabels[key],
        href: `/worksheet-pdfs/elementary/${row.slug}/level-${key}.pdf`,
      })),
  };
}

/** The catalog topic behind a topic page's level buttons, or null when there is none. */
export function findCatalogTopic(
  catalog: CatalogV1,
  grade: number,
  topicId: number | null | undefined,
): CatalogTopic | null {
  if (topicId == null) return null;
  return catalog.grades.find(g => g.grade === grade)?.topics.find(t => t.id === topicId) || null;
}

/** Every published edition of a topic in page order: the selected edition first. */
export function topicEditionsSelectedFirst(topic: CatalogTopic): CatalogEdition[] {
  const selected = resolveEdition(topic);
  return [selected, ...topicEditions(topic).filter(e => e.editionId !== selected.editionId)];
}

/** Keep the selected edition first while exposing every published addition. */
export function topicWorksheetEditionLinks(
  catalog: CatalogV1,
  grade: number,
  topicId: number | null | undefined,
  backPath: string,
): TopicWorksheetEditionLinks[] {
  const topic = findCatalogTopic(catalog, grade, topicId);
  if (!topic) return [];
  const editions = topicEditionsSelectedFirst(topic).map(edition => ({
    editionId: edition.editionId,
    label: edition.label,
    pdfOnly: edition.publicationMode === 'pdf-only',
    note: worksheetEditionNote(edition),
    levels: edition.levels.map(level => ({
      key: level.key,
      label: level.label,
      href: buildWorksheetHref({ catalog, grade, topic, levelKey: level.key,
        editionId: edition.editionId, backPath }),
    })),
  }));
  const print = elementaryPrintEdition(catalog, grade, topic.id);
  return print ? [print, ...editions] : editions;
}
