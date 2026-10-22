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
 * include a query string. `context.rewrite(pathname)` still 404s on Wix — return
 * the bundled HTML body instead so the browser URL (and location.search) stay.
 */
import { defineMiddleware } from 'astro:middleware';
import { OTTERLY_API_KEY } from 'astro:env/server';
import { redirectTargetForSiteUgdPath } from './lib/wixMedia';
import { resolveRedirect } from './lib/redirects';
import { PUBLIC_HTML_SHELLS } from './lib/publicHtmlShells';
import { secretFromEnv } from './lib/noamSecrets';
import { OTTERLY_API_KEY_NAME, scheduleOtterlyPageLog } from './lib/otterlyAiLogs';

export const onRequest = defineMiddleware(async (context, next) => {
  // AI-crawler log only. waitUntil on Cloudflare, otherwise a detached promise.
  // A secret or logging failure must not change the page response.
  try {
    scheduleOtterlyPageLog({
      method: context.request.method,
      pathname: context.url.pathname,
      search: context.url.search,
      requestUrl: context.request.url,
      forwardedUrl: context.request.headers.get('x-wix-forwarded-url'),
      userAgent: context.request.headers.get('user-agent'),
      referer: context.request.headers.get('referer'),
      clientIp: context.request.headers.get('true-client-ip'),
      secFetchDest: context.request.headers.get('sec-fetch-dest'),
      apiKey: secretFromEnv(OTTERLY_API_KEY_NAME, OTTERLY_API_KEY),
      locals: context.locals,
    });
  } catch {
    console.error('Otterly AI log skipped');
  }
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
  const shell = context.url.search ? PUBLIC_HTML_SHELLS[path] : undefined;
  if (shell) {
    return new Response(shell, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        ...(context.url.searchParams.get('pilot') === '1' ? { 'X-Robots-Tag': 'noindex, nofollow, noarchive' } : {}),
        'Cache-Control': 'public, max-age=0, must-revalidate',
      },
    });
  }
  const response = await next();
  // Hashed Astro bundles and self-hosted font files. Wix may serve public
  // files at the edge before this middleware; the header still applies when
  // Astro handles the request (local preview and any pass-through).
  const versionedFont = /^\/fonts\/[^/]+\.[a-f0-9]{8}\.woff2$/.test(path);
  if (response.ok && (path.startsWith('/_astro/') || versionedFont)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }
  return response;
});
