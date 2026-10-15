/**
 * Viewer document metadata is derived only from the checked-in public catalog.
 * Query display text is deliberately not an SEO source of truth.
 */
import type { CatalogV1 } from './catalog/types';

export interface ViewerMetadata {
  title: string;
  description: string;
  verified: boolean;
}

type SearchParams = Pick<URLSearchParams, 'get'>;

export const GENERIC_VIEWER_METADATA: ViewerMetadata = Object.freeze({
  title: 'דף עבודה במתמטיקה | נועם דורון',
  description: 'דף עבודה במתמטיקה באתר נועם דורון. בחרו דף עבודה מתאים מתוך קטלוג דפי העבודה.',
  verified: false,
});

function genericMetadata(): ViewerMetadata {
  return { ...GENERIC_VIEWER_METADATA };
}

function optionalParam(params: SearchParams, name: string): string | undefined {
  const value = params.get(name);
  if (value === null) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function parseGrade(value: string | undefined): number | undefined {
  if (!value || !/^[789]$/.test(value)) return undefined;
  return Number(value);
}

function parseTopicId(value: string | undefined): number | undefined {
  if (!value || !/^(?:0|[1-9]\d*)$/.test(value)) return undefined;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : undefined;
}

/**
 * Returns catalog-derived metadata only when all supplied resource identifiers
 * point to one viewer-enabled catalog level. Ambiguous or incoherent URLs fall
 * back rather than borrowing a title from another topic, grade, or level.
 */
export function resolveViewerMetadata(catalog: CatalogV1, params: SearchParams): ViewerMetadata {
  const gradeNumber = parseGrade(optionalParam(params, 'g'));
  const pdfId = optionalParam(params, 'pdf')?.toLowerCase();
  const requestedTopic = optionalParam(params, 'topic');
  const requestedLevel = optionalParam(params, 'lv')?.toLowerCase();

  if (!gradeNumber || !pdfId || !/^[0-9a-f]{32}$/.test(pdfId)) {
    return genericMetadata();
  }

  const topicId = requestedTopic === undefined ? undefined : parseTopicId(requestedTopic);
  if (requestedTopic !== undefined && topicId === undefined) return genericMetadata();
  if (requestedLevel !== undefined && !/^[a-z0-9]+$/.test(requestedLevel)) {
    return genericMetadata();
  }

  const grade = catalog.grades.find((candidate) => candidate.grade === gradeNumber);
  if (!grade) return genericMetadata();

  const matches = grade.topics.flatMap((topic) => {
    if (!topic.routing.usesViewer || (topicId !== undefined && topic.id !== topicId)) return [];
    return topic.levels
      .filter((level) => level.pdfId.toLowerCase() === pdfId)
      .filter((level) => requestedLevel === undefined || level.key === requestedLevel)
      .map((level) => ({ topic, level }));
  });

  if (matches.length !== 1) return genericMetadata();

  const { topic, level } = matches[0];
  return {
    title: `${topic.title} — ${grade.label} — ${level.label} | נועם דורון`,
    description: `דף עבודה במתמטיקה בנושא ${topic.title} לכיתה ${grade.label.replace(/^כיתה\s+/, '')}, ${level.label}, באתר נועם דורון.`,
    verified: true,
  };
}

/** Escape text placed between head-element tags. */
export function escapeHtmlText(value: string): string {
  return value.replace(/[&<>]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
  })[character] as string);
}

/** Escape a double-quoted HTML attribute value. */
export function escapeHtmlAttribute(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character] as string);
}

/** Serialize data for an application/json script without allowing a closing tag. */
export function escapeJsonForHtmlScript(value: unknown): string {
  return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, (character) => ({
    '<': '\\u003c',
    '>': '\\u003e',
    '&': '\\u0026',
    '\u2028': '\\u2028',
    '\u2029': '\\u2029',
  })[character] as string);
}

function replaceRequired(html: string, pattern: RegExp, replacement: string, marker: string): string {
  let replacements = 0;
  const rendered = html.replace(pattern, () => {
    replacements += 1;
    return replacement;
  });
  if (replacements !== 1) {
    throw new Error(`Viewer shell must contain exactly one ${marker} marker`);
  }
  return rendered;
}

/**
 * Rewrites only the dedicated head markers in the bundled public viewer shell.
 * The body, PDF behavior, print rules, canonical policy, and robots policy are
 * intentionally not touched here.
 */
export function renderViewerHtmlWithMetadata(html: string, metadata: ViewerMetadata): string {
  const title = escapeHtmlText(metadata.title);
  const description = escapeHtmlAttribute(metadata.description);
  const resourceTitle = escapeHtmlAttribute(metadata.verified ? metadata.title : '');
  const payload = escapeJsonForHtmlScript(metadata);

  let rendered = replaceRequired(
    html,
    /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`,
    'title'
  );
  rendered = replaceRequired(
    rendered,
    /<meta name="description" data-viewer-description content="[^"]*">/,
    `<meta name="description" data-viewer-description content="${description}">`,
    'data-viewer-description'
  );
  rendered = replaceRequired(
    rendered,
    /<meta name="viewer-resource-title" content="[^"]*">/,
    `<meta name="viewer-resource-title" content="${resourceTitle}">`,
    'viewer-resource-title'
  );
  rendered = replaceRequired(
    rendered,
    /<meta name="viewer-resource-verified" content="(?:true|false)">/,
    `<meta name="viewer-resource-verified" content="${String(metadata.verified)}">`,
    'viewer-resource-verified'
  );
  return replaceRequired(
    rendered,
    /<script id="viewer-resource-metadata" type="application\/json">[\s\S]*?<\/script>/,
    `<script id="viewer-resource-metadata" type="application/json">${payload}</script>`,
    'viewer-resource-metadata'
  );
}
