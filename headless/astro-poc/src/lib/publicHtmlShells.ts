/**
 * Bundled public HTML shells for Wix/Astro document navigations with ?query.
 * Bare paths are still served from CDN/static; middleware returns these bodies
 * when search is present so the viewer/learning clients keep location.search.
 */
import viewerHtml from '../../public/worksheet-viewer-noam.html?raw';
import learningHtml from '../../public/learning.html?raw';

export const PUBLIC_HTML_SHELLS: Record<string, string> = {
  '/worksheet-viewer-noam.html': viewerHtml,
  '/learning.html': learningHtml,
};
