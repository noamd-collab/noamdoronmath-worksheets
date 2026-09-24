/**
 * M36 cutover helpers — redirect legacy site PDF paths to Wix Media CDN.
 * Astro treats `pages/_…` as private (not routed), so this lives in middleware.
 *
 * On Wix Headless hosting, edge often intercepts `/_files` before Astro
 * (301 → site filesusr). This middleware applies when Astro sees the path
 * (local/node, or if edge passes through). Prefer CDN links from catalog.
 */
import { defineMiddleware } from 'astro:middleware';
import { redirectTargetForSiteUgdPath } from './lib/wixMedia';

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  const target = redirectTargetForSiteUgdPath(path, context.url.search);
  if (target) {
    return context.redirect(target, 301);
  }
  return next();
});
