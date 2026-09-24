import type { CatalogTopic, CatalogV1 } from './catalog/types';

/** Verified public GitHub Pages base for the live catalog + viewer. */
export const PUBLIC_WORKSHEETS_BASE =
  'https://noamd-collab.github.io/noamdoronmath-worksheets/';

const env: Record<string, string | undefined> =
  (typeof import.meta !== 'undefined' &&
    (import.meta as ImportMeta & { env?: Record<string, string | undefined> })
      .env) ||
  {};

/**
 * Rollback / cutover flag for HEADLESS-MIGRATION-11.
 * Default OFF: catalog links keep pointing at the GitHub Pages viewer.
 * Set PUBLIC_USE_HEADLESS_VIEWER=true only after desktop+390px parity on the
 * Headless-owned `/worksheet-viewer-noam.html` route.
 */
export const PUBLIC_USE_HEADLESS_VIEWER =
  String(env.PUBLIC_USE_HEADLESS_VIEWER || '').toLowerCase() === 'true' ||
  String(env.PUBLIC_USE_HEADLESS_VIEWER || '') === '1';

/**
 * Optional absolute origin for the Headless viewer (e.g. a preview host).
 * When the flag is on and this is empty, links use a same-origin path
 * (`/worksheet-viewer-noam.html?...`).
 */
export const PUBLIC_HEADLESS_VIEWER_BASE = String(
  env.PUBLIC_HEADLESS_VIEWER_BASE || ''
).trim();

export interface WorksheetLinkInput {
  catalog: CatalogV1;
  grade: number;
  topic: CatalogTopic;
  levelKey: string;
  /** Optional override; defaults to production catalog back-link for this grade. */
  backPath?: string;
}

function viewerDocumentBase(): string {
  if (!PUBLIC_USE_HEADLESS_VIEWER) return PUBLIC_WORKSHEETS_BASE;
  if (PUBLIC_HEADLESS_VIEWER_BASE) {
    return PUBLIC_HEADLESS_VIEWER_BASE.endsWith('/')
      ? PUBLIC_HEADLESS_VIEWER_BASE
      : PUBLIC_HEADLESS_VIEWER_BASE + '/';
  }
  // Same-origin placeholder host → caller gets pathname+search only.
  return 'https://headless-viewer.local/';
}

function defaultBackPath(grade: number): string {
  if (PUBLIC_USE_HEADLESS_VIEWER) {
    return `/worksheets?grade=${encodeURIComponent(String(grade))}`;
  }
  return `/noamdoronmath-worksheets/?grade=${encodeURIComponent(String(grade))}`;
}

/**
 * Build an absolute href that opens the EXISTING worksheet experience
 * (viewer or direct PDF on GitHub Pages / Wix media) — never the prototype route.
 *
 * Mirrors index.html sheetHref + noam-discovery.js topic/back augmentation.
 * When PUBLIC_USE_HEADLESS_VIEWER is enabled, viewer links target the
 * Headless-owned static copy under public/worksheet-viewer-noam.html.
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
  const base = viewerDocumentBase();
  const viewerUrl = new URL(catalog.config.viewer.path, base);
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
  const back = input.backPath ?? defaultBackPath(grade);
  viewerUrl.searchParams.set('back', back);

  if (
    PUBLIC_USE_HEADLESS_VIEWER &&
    !PUBLIC_HEADLESS_VIEWER_BASE &&
    viewerUrl.hostname === 'headless-viewer.local'
  ) {
    return viewerUrl.pathname + viewerUrl.search;
  }

  return viewerUrl.toString();
}
