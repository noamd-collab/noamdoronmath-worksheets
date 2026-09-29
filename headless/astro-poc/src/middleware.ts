/**
 * M36 cutover helpers — redirect legacy site PDF paths to Wix Media CDN.
 * OPEN-15: then old classic-site paths and trailing slashes (lib/redirects.ts).
 * SEO closure: one set of head tags per HTML page (lib/seoHtml.ts) and an
 * edge-cacheable Cache-Control on HTML that does not set its own.
 * Astro treats `pages/_…` as private (not routed), so this lives in middleware.
 *
 * On Wix Headless hosting, edge often intercepts `/_files` before Astro
 * (301 → site filesusr). This middleware applies when Astro sees the path
 * (local/node, or if edge passes through). Prefer CDN links from catalog.
 */
import { defineMiddleware } from 'astro:middleware';
import { redirectTargetForSiteUgdPath } from './lib/wixMedia';
import { resolveRedirect } from './lib/redirects';
import { dedupeHeadSeoTags } from './lib/seoHtml';

/** Browsers revalidate; the edge may serve 5 min and refresh in the background. */
const HTML_CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=600';

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

  const response = await next();
  const type = response.headers.get('content-type') || '';
  if (!type.includes('text/html') || path.startsWith('/_') || path.startsWith('/api/')) {
    return response;
  }
  const html = await response.text();
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  if (response.status === 200 && context.request.method === 'GET' && !headers.has('cache-control')) {
    headers.set('cache-control', HTML_CACHE_CONTROL);
  }
  return new Response(dedupeHeadSeoTags(html), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
});
