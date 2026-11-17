/**
 * SEO-1: every worksheet viewer URL (/worksheet-viewer-noam.html?g=..&pdf=..)
 * shares one generic title, so it is noindex,follow with one canonical, the
 * viewer path itself. The tags are added to the served shell (publicHtmlShells),
 * right after the charset, so the design-fenced bytes of
 * public/worksheet-viewer-noam.html stay unchanged. learning.html already
 * carries noindex,follow in its own head.
 */
import { SITE_CANONICAL_ORIGIN } from './siteSeo';

export const VIEWER_PATH = '/worksheet-viewer-noam.html';

export const VIEWER_SEO_HEAD =
  `<link rel="canonical" href="${SITE_CANONICAL_ORIGIN}${VIEWER_PATH}">\n` +
  '<meta name="robots" content="noindex,follow">\n';

const VIEWER_CHARSET = '<meta charset="utf-8">\n';

/** Fails open: a viewer whose head changed is served unchanged, and the tests fail instead. */
export function withViewerSeoHead(html: string): string {
  if (html.split(VIEWER_CHARSET).length !== 2) return html;
  if (html.includes(VIEWER_SEO_HEAD)) return html;
  return html.replace(VIEWER_CHARSET, () => VIEWER_CHARSET + VIEWER_SEO_HEAD);
}
