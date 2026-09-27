/**
 * M36 cutover helpers — redirect legacy site PDF paths to Wix Media CDN.
 * OPEN-15: then old classic-site paths and trailing slashes (lib/redirects.ts).
 * Astro treats `pages/_…` as private (not routed), so this lives in middleware.
 *
 * On Wix Headless hosting, edge often intercepts `/_files` before Astro
 * (301 → site filesusr). This middleware applies when Astro sees the path
 * (local/node, or if edge passes through). Prefer CDN links from catalog.
 *
 * Astra / Wix quirk: public `*.html` assets 404 for document navigations that
 * include a query string. Rewrite to the bare pathname so the static file is
 * served while the browser URL (and `location.search`) stay intact for the viewer.
 */
import { defineMiddleware } from 'astro:middleware';
import { redirectTargetForSiteUgdPath } from './lib/wixMedia';
import { resolveRedirect } from './lib/redirects';

/** Public HTML shells that must accept `?...` (viewer / learning). */
const PUBLIC_HTML_WITH_QUERY = new Set([
  '/worksheet-viewer-noam.html',
  '/learning.html',
]);

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const target = redirectTargetForSiteUgdPath(path, context.url.search);
  if (target) {
    return context.redirect(target, 301);
  }
  // OPEN-15: old classic-site paths and trailing slashes (src/data/redirects.json).
  const moved = resolveRedirect(path, context.url.search);
  if (moved) {
    return context.redirect(moved, 301);
  }
  if (PUBLIC_HTML_WITH_QUERY.has(path) && context.url.search) {
    return context.rewrite(path);
  }
  return next();
});
