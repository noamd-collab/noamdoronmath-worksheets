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
