/**
 * 301 targets for junior-high worksheets removed from the public site.
 * The map is generated from the catalog (scripts/build-retired-junior-redirects.ts).
 * A pdf stays reachable when any public list still shows it, including a topic
 * whose only sheets are the old ones.
 */
import type { CatalogEdition, CatalogV1 } from './catalog/types';
import { studentFacingEditions } from './catalog/editions';
import redirects from '../data/retired-junior-worksheet-redirects.json';

export type RetiredJuniorRedirects = Record<string, string>;

const PDF_ID = /^[a-f0-9]{32}$/i;

export function topicKey(grade: number, topicId: number): string {
  return `${grade}:${topicId}`;
}

/** pdf id → topic or grade path, for sheets no public list still shows. */
export function buildRetiredJuniorRedirects(
  catalog: CatalogV1,
  topicPaths: Readonly<Record<string, string>>,
): RetiredJuniorRedirects {
  const kept = new Set<string>();
  const dropped: Array<{ pdfId: string; grade: number; topicId: number }> = [];
  for (const grade of catalog.grades) {
    for (const topic of grade.topics) {
      const visible = studentFacingEditions(topic, grade.grade);
      for (const edition of visible) for (const level of edition.levels) kept.add(level.pdfId);
      if (grade.grade < 7 || grade.grade > 9 || topic.reviewedBaseBinding) continue;
      const hidden = hiddenLegacy(topic, visible);
      if (!hidden) continue;
      for (const level of hidden.levels) {
        dropped.push({ pdfId: level.pdfId, grade: grade.grade, topicId: topic.id });
      }
    }
  }
  const out: RetiredJuniorRedirects = {};
  for (const row of dropped) {
    if (kept.has(row.pdfId) || out[row.pdfId]) continue;
    out[row.pdfId] = topicPaths[topicKey(row.grade, row.topicId)] || `/grade-${row.grade}`;
  }
  return out;
}

function hiddenLegacy(topic: CatalogV1['grades'][number]['topics'][number], visible: CatalogEdition[]) {
  if (visible.some(edition => edition.editionId === 'legacy')) return null;
  return { levels: topic.levels };
}

export const RETIRED_JUNIOR_WORKSHEET_REDIRECTS: RetiredJuniorRedirects = redirects;

export function retiredJuniorWorksheetTarget(pdfId: string | null | undefined): string | undefined {
  if (!pdfId || !PDF_ID.test(pdfId)) return undefined;
  return RETIRED_JUNIOR_WORKSHEET_REDIRECTS[pdfId.toLowerCase()];
}

const SITE_PDF = /^\/_files\/ugd\/d8e7ad_([a-f0-9]{32})\.pdf$/i;
const VIEWER_PATH = '/worksheet-viewer-noam.html';

/** Topic-page target when this request is opening a removed junior-high sheet. */
export function retiredJuniorRequestTarget(pathname: string, searchParams: URLSearchParams): string | null {
  const fromPath = pathname.match(SITE_PDF)?.[1];
  const fromQuery = pathname === VIEWER_PATH ? searchParams.get('pdf') : null;
  return retiredJuniorWorksheetTarget(fromPath || fromQuery) ?? null;
}
