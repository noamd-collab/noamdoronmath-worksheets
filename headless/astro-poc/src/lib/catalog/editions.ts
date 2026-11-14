import type { CatalogEdition, CatalogTopic } from './types';

/** The old fields remain authoritative for all pre-edition links. */
export function topicEditions(topic: CatalogTopic): CatalogEdition[] {
  return [{ editionId: 'legacy', label: 'דפים קודמים', status: 'published',
    levels: topic.levels, routing: topic.routing },
  ...(topic.editions || []).filter(e => e.status === 'published')];
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

/** Ready means an evidence-validated viewer, independently of document formats. */
export function worksheetEditionNote(edition: CatalogEdition): string | null {
  if (edition.publicationMode !== 'pdf-only') return null;
  const ready = edition.routing.usesViewer && edition.routing.aiHintShown &&
    edition.levels.length === 3 && edition.levels.every(level => level.ramzi?.status === 'ready');
  return ready ? 'קובצי PDF להדפסה · רמזים בשלוש דרגות' : 'קובצי PDF להדפסה';
}

/** Keep the legacy badge precise when additional editions also supply hints. */
export function worksheetTopicHintLabel(topic: CatalogTopic): string | null {
  const selected = resolveEdition(topic);
  if (!selected.routing.aiHintShown) return null;
  const editions = topicEditions(topic);
  if (editions.length === 1) return '✦ רמזי AI זמין בדף הזה';
  if (selected.editionId !== 'legacy') return `✦ רמזי AI · ${selected.label}`;
  const ready = editions.filter(edition => edition.routing.aiHintShown);
  if (ready.length === editions.length) return '✦ רמזי AI';
  if (ready.some(edition => edition.editionId !== 'legacy')) return '✦ רמזי AI בחלק מהדפים';
  return '✦ רמזי AI בדפים קודמים';
}
