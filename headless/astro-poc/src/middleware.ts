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
 *
 * OtterlyAI agent analytics: page requests from known AI bots are forwarded
 * in the background to the Otterly logs webhook. Failures never affect the page.
 */
import { defineMiddleware } from 'astro:middleware';
import { OTTERLY_API_KEY } from 'astro:env/server';
import { redirectTargetForSiteUgdPath } from './lib/wixMedia';
import { resolveRedirect } from './lib/redirects';
import { PUBLIC_HTML_SHELLS } from './lib/publicHtmlShells';
import { secretFromEnv } from './lib/noamSecrets';

const OTTERLY_LOGS_URL = 'https://analytics.otterly.ai/logs';
const AI_BOT_USER_AGENT =
  /GPTBot|ChatGPT-User|OAI-SearchBot|ClaudeBot|Claude-User|PerplexityBot|Perplexity-User|Google-Extended|Bytespider/i;

function forwardAiBotHitToOtterly(request: Request, url: URL): void {
  if (request.method !== 'GET') return;
  // Skip static assets; only page requests are useful for agent analytics.
  if (/\.[a-z0-9]+$/i.test(url.pathname)) return;
  const userAgent = request.headers.get('user-agent') ?? '';
  if (!AI_BOT_USER_AGENT.test(userAgent)) return;
  const apiKey = secretFromEnv('OTTERLY_API_KEY', OTTERLY_API_KEY);
  if (!apiKey) return;

  const event: Record<string, string> = {
    requestUrl: url.href,
    userAgent,
    timestamp: new Date().toISOString(),
  };
  const referer = request.headers.get('referer');
  if (referer && /^https?:\/\//i.test(referer)) event.referer = referer;

  fetch(OTTERLY_LOGS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify([event]),
  }).catch(() => {
    // Ignore delivery errors; the page response must not depend on analytics.
  });
}

export const onRequest = defineMiddleware(async (context, next) => {
  const path = context.url.pathname;
  forwardAiBotHitToOtterly(context.request, context.url);
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
