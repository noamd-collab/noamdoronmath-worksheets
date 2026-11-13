import type { CatalogV1 } from './catalog/types';
import { resolveEdition, topicEditions } from './catalog/editions';
import { buildWorksheetHref } from './worksheetLinks';

export interface TopicWorksheetEditionLinks {
  editionId: string;
  label: string;
  pdfOnly: boolean;
  levels: Array<{ key: string; label: string; href: string }>;
}

/** Keep the selected edition first while exposing every published addition. */
export function topicWorksheetEditionLinks(
  catalog: CatalogV1,
  grade: number,
  topicId: number | null | undefined,
  backPath: string,
): TopicWorksheetEditionLinks[] {
  if (topicId == null) return [];
  const topic = catalog.grades.find(g => g.grade === grade)?.topics.find(t => t.id === topicId);
  if (!topic) return [];
  const selected = resolveEdition(topic);
  const editions = [selected, ...topicEditions(topic).filter(e => e.editionId !== selected.editionId)];
  return editions.map(edition => ({
    editionId: edition.editionId,
    label: edition.label,
    pdfOnly: edition.publicationMode === 'pdf-only',
    levels: edition.levels.map(level => ({
      key: level.key,
      label: level.label,
      href: buildWorksheetHref({ catalog, grade, topic, levelKey: level.key,
        editionId: edition.editionId, backPath }),
    })),
  }));
}
