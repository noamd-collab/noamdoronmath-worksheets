/**
 * Wix's Cloudflare handler serves public HTML and /_files from ASSETS before
 * Astro middleware. Retired junior sheets must be answered here, on the worker
 * fetch, or those URLs never reach retiredJuniorRequestTarget.
 */
import { retiredJuniorRequestTarget } from '../lib/retiredJuniorWorksheets';

export function retiredJuniorEdgeResponse(request: Request): Response | null {
  let url: URL;
  try {
    url = new URL(request.url);
  } catch {
    return null;
  }
  const target = retiredJuniorRequestTarget(url.pathname, url.searchParams);
  if (!target || !target.startsWith('/') || target.startsWith('//')) return null;
  return new Response(null, {
    status: 301,
    headers: {
      Location: target,
      'Cache-Control': 'no-store',
      'X-Noam-Retired-Sheet': '1',
    },
  });
}
