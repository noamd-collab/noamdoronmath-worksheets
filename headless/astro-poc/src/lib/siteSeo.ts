/**
 * Preview vs Production SEO switch for Headless Astro.
 * Preview hosts stay noindex; production main domain is indexable with canonical.
 */

export const SITE_CANONICAL_ORIGIN = 'https://www.noamdoronmath.co.il';

export const DEFAULT_SITE_TITLE = 'נועם דורון מתמטיקה · דפי עבודה';
export const DEFAULT_SITE_DESCRIPTION =
  'דפי עבודה במתמטיקה בעברית לכיתות א׳–ט׳ — הסברים ברורים, תרגול ברמות, בחינם וללא הרשמה.';

/** True for local/dev and Wix preview hosts — never index these. */
export function isPreviewHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true;
  if (h.includes('wix-site-host.com')) return true;
  if (h.includes('wixstudio.io') || h.includes('editorx.io')) return true;
  return false;
}

export function robotsContent(hostname: string): string {
  return isPreviewHost(hostname) ? 'noindex,nofollow' : 'index,follow';
}

/** Canonical URL on the main production domain (path + search preserved; hash dropped). */
export function canonicalUrl(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  return `${SITE_CANONICAL_ORIGIN}${normalized}${search || ''}`;
}
