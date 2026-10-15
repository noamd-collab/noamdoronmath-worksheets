import { SITE_CANONICAL_ORIGIN } from './siteSeo';

const PRODUCTION_HOSTS = new Set([
  new URL(SITE_CANONICAL_ORIGIN).hostname,
  'noamdoronmath.co.il',
]);

/**
 * Wix resolves main-page tags at the hosted boundary, after Astro renders.
 * Do not emit a competing set there. Node previews never inject those tags.
 * Item/error pages retain their content-derived metadata and JSON-LD.
 */
export function layoutOwnsSeo({
  managedBuild,
  hostname,
  pathname,
  forwardedUrl,
  status = 200,
}: {
  managedBuild: boolean;
  hostname: string;
  pathname: string;
  forwardedUrl?: string | null;
  status?: number;
}): boolean {
  if (!managedBuild || status >= 400 || pathname === '/404') return true;
  let publicHostname = hostname.toLowerCase();
  // Wix documents x-wix-forwarded-url because its internal request URL can
  // differ from the public one. Only recognized production hosts are accepted;
  // the header is ignored altogether in the independent Node preview build.
  if (forwardedUrl) {
    try {
      const forwarded = new URL(forwardedUrl);
      if (/^https?:$/.test(forwarded.protocol) && !forwarded.username && !forwarded.password &&
          PRODUCTION_HOSTS.has(forwarded.hostname.toLowerCase())) {
        publicHostname = forwarded.hostname.toLowerCase();
      }
    } catch { /* Malformed forwarding data must not remove fallback metadata. */ }
  }
  if (!PRODUCTION_HOSTS.has(publicHostname)) return true;
  // Current blog slots contain complements, not a resolved SEO.Tags primary
  // set. Their separate SDK migration and hosted verification remain open.
  if (pathname.startsWith('/blog/') || pathname.startsWith('/post/')) return true;
  return false;
}
