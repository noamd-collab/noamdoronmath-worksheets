import type { CatalogEdition, CatalogTopic } from './types';
import { partialHintCount } from './partialHints';

/** The old fields remain authoritative for all pre-edition links. */
export function topicEditions(topic: CatalogTopic): CatalogEdition[] {
  const binding = topic.reviewedBaseBinding;
  const base: CatalogEdition = binding
    ? { ...binding, editionId: 'legacy', viewerEditionId: binding.editionId }
    : { editionId: 'legacy', label: 'דפים קודמים', status: 'published', levels: topic.levels, routing: topic.routing };
  return [base, ...(topic.editions || []).filter(e => e.status === 'published')];
}

/** Missing default falls back; an explicit unknown edition never does. */
export function resolveEdition(topic: CatalogTopic, editionId?: string): CatalogEdition {
  const editions = topicEditions(topic);
  if (editionId !== undefined) {
    const edition = editions.find(e => e.editionId === editionId);
    if (!edition) throw new Error('Unavailable worksheet edition: ' + editionId);
    return edition;
  }
  return editions.find(e => e.editionId === topic.defaultEditionId) || editions[0];
}

/**
 * Public junior-high lists (grades 7–9, including the reduced grade-9 track).
 * Noam, 25 Nov 2026: old junior-high sheets come off the site; sheets from
 * generator/skill 7 and up stay. The pre-generator sheets are the synthetic
 * legacy edition ("דפים קודמים"). A reviewed base binding that reuses the
 * legacy id is the current sheet, so it stays. If dropping the old sheets
 * would leave the topic with nothing, they stay.
 * Grades 1–6 are unchanged. Callers that still need the old sheets (the
 * teacher area) keep using topicEditions / resolveEdition.
 */
export function studentFacingEditions(topic: CatalogTopic, grade: number): CatalogEdition[] {
  const selected = resolveEdition(topic);
  const ordered = [selected, ...topicEditions(topic).filter(e => e.editionId !== selected.editionId)];
  if (grade < 7 || grade > 9) return ordered;
  const kept = ordered.filter(e => e.editionId !== 'legacy' || topic.reviewedBaseBinding);
  return kept.length ? kept : ordered;
}

/** Ready means an evidence-validated viewer, independently of document formats. */
export function worksheetEditionNote(edition: CatalogEdition): string | null {
  if (edition.publicationMode !== 'pdf-only') return null;
  const ready = edition.routing.usesViewer && edition.routing.aiHintShown &&
    edition.levels.length === 3 && edition.levels.every(level => level.ramzi?.status === 'ready');
  return ready ? 'קובצי PDF להדפסה · רמזים בשלוש דרגות' : 'קובצי PDF להדפסה';
}

/** Keep the legacy badge precise when additional editions also supply hints. */
export function worksheetTopicHintLabel(topic: CatalogTopic): string | null {
  return hintLabelForEditions(topic, resolveEdition(topic), topicEditions(topic));
}

/** Public catalog badge after old junior-high sheets are hidden. */
export function studentWorksheetHintLabel(topic: CatalogTopic, grade: number): string | null {
  const editions = studentFacingEditions(topic, grade);
  return hintLabelForEditions(topic, editions[0], editions);
}

function hintLabelForEditions(
  topic: CatalogTopic,
  selected: CatalogEdition | undefined,
  editions: CatalogEdition[],
): string | null {
  if (!selected) return null;
  if (topic.editions?.some(e => e.status === 'published' && e.levels.some(l => partialHintCount(e, l) > 0))) {
    return '✦ רמזי זמין בחלק מהדפים';
  }
  if (!selected.routing.aiHintShown) return null;
  if (editions.length === 1) return '✦ רמזי AI זמין בדף הזה';
  if (selected.editionId !== 'legacy') return `✦ רמזי AI · ${selected.label}`;
  const ready = editions.filter(edition => edition.routing.aiHintShown);
  if (ready.length === editions.length) return '✦ רמזי AI';
  if (ready.some(edition => edition.editionId !== 'legacy')) return '✦ רמזי AI בחלק מהדפים';
  return '✦ רמזי AI בדפים קודמים';
}
