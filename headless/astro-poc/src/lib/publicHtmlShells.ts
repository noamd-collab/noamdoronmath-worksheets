/**
 * Bundled public HTML shells for Wix/Astro document navigations with ?query.
 * Bare paths are still served from CDN/static; middleware returns these bodies
 * when search is present so the viewer/learning clients keep location.search.
 */
import viewerHtml from '../../public/worksheet-viewer-noam.html?raw';
import learningHtml from '../../public/learning.html?raw';
import { VIEWER_PATH, withViewerSeoHead } from './viewerSeo';

export const PUBLIC_HTML_SHELLS: Record<string, string> = {
  // SEO-1: the served viewer shell carries noindex,follow and its canonical.
  [VIEWER_PATH]: withViewerSeoHead(viewerHtml),
  '/learning.html': learningHtml,
};
