import indexes from '../../data/partial-worksheet-hints.v1.json';
import type { CatalogEdition, CatalogLevel } from './types';

const byPdf: Record<string, { editionId: string; pdfSha256: string; items: number }> = indexes;

export function partialHintCount(edition: CatalogEdition, level: CatalogLevel): number {
  const entry = byPdf[level.pdfId];
  if (!entry || edition.routing.usesViewer || entry.editionId !== edition.editionId ||
      !('pdfSha256' in level) || entry.pdfSha256 !== level.pdfSha256) return 0;
  return entry.items;
}
