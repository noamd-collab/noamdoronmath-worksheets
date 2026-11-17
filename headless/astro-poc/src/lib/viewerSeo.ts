/**
 * SEO-1: every worksheet viewer URL (/worksheet-viewer-noam.html?g=..&pdf=..)
 * shares one generic title, so it is noindex,follow. The tag is added to the
 * served shell (publicHtmlShells), right after the charset, so the
 * design-fenced bytes of public/worksheet-viewer-noam.html stay unchanged.
 * learning.html already carries noindex,follow in its own head.
 *
 * No rel=canonical: the bare /worksheet-viewer-noam.html is served statically
 * by the Wix CDN without this tag and is itself indexable, so a canonical to it
 * next to noindex would send mixed signals.
 */
export const VIEWER_PATH = '/worksheet-viewer-noam.html';

export const VIEWER_SEO_HEAD = '<meta name="robots" content="noindex,follow">\n';

const VIEWER_CHARSET = '<meta charset="utf-8">\n';

/** Fails open: a viewer whose head changed is served unchanged, and the tests fail instead. */
export function withViewerSeoHead(html: string): string {
  if (html.split(VIEWER_CHARSET).length !== 2) return html;
  if (html.includes(VIEWER_SEO_HEAD)) return html;
  return html.replace(VIEWER_CHARSET, () => VIEWER_CHARSET + VIEWER_SEO_HEAD);
}
