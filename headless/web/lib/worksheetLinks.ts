import type { CatalogTopic, CatalogV1 } from './catalog/types';

/** Verified public GitHub Pages base for the live catalog + viewer. */
export const PUBLIC_WORKSHEETS_BASE =
  'https://noamd-collab.github.io/noamdoronmath-worksheets/';

export interface WorksheetLinkInput {
  catalog: CatalogV1;
  grade: number;
  topic: CatalogTopic;
  levelKey: string;
  /** Optional override; defaults to production catalog back-link for this grade. */
  backPath?: string;
}

/**
 * Build an absolute href that opens the EXISTING worksheet experience
 * (viewer or direct PDF on GitHub Pages / Wix media) — never the prototype route.
 *
 * Mirrors index.html sheetHref + noam-discovery.js topic/back augmentation.
 */
export function buildWorksheetHref(input: WorksheetLinkInput): string {
  const { catalog, grade, topic } = input;
  const level = topic.levels.find((l) => l.key === input.levelKey);
  if (!level) {
    throw new Error(`Missing level ${input.levelKey} on topic ${topic.id}`);
  }

  const pdfDirect = catalog.config.pdfBase + level.pdfId + '.pdf';
  const viewerEnabled = !!catalog.config.viewer.enabled;
  const middle = (catalog.config.middleGrades || []).map(Number);
  const prefix = topic.routing?.resolvedNoamPrefix;
  const usesViewer =
    viewerEnabled &&
    !!prefix &&
    middle.includes(Number(grade)) &&
    !!topic.routing?.usesViewer;

  if (!usesViewer) return pdfDirect;

  const viewerLevel = level.key === 'one' ? 'b' : level.key;
  const viewerUrl = new URL(catalog.config.viewer.path, PUBLIC_WORKSHEETS_BASE);
  viewerUrl.searchParams.set('g', String(grade));
  viewerUrl.searchParams.set('x', String(prefix));
  viewerUrl.searchParams.set('lv', viewerLevel);
  viewerUrl.searchParams.set('pdf', level.pdfId);
  viewerUrl.searchParams.set('t', topic.title);

  const siblings = topic.routing.siblingPdfQuery || {};
  for (const key of ['pa', 'pb', 'pc'] as const) {
    if (siblings[key]) viewerUrl.searchParams.set(key, siblings[key]);
  }

  // Discovery: topic = parent card id (or self), back = production catalog path.
  const topicParam = topic.parent !== undefined ? topic.parent : topic.id;
  viewerUrl.searchParams.set('topic', String(topicParam));
  const back =
    input.backPath ??
    `/noamdoronmath-worksheets/?grade=${encodeURIComponent(String(grade))}`;
  viewerUrl.searchParams.set('back', back);

  return viewerUrl.toString();
}
