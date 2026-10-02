/**
 * Preview vs Production SEO switch for Headless Astro.
 * Preview hosts stay noindex; production main domain is indexable with canonical.
 */

export const SITE_CANONICAL_ORIGIN = 'https://www.noamdoronmath.co.il';

export const SITE_NAME = 'נועם דורון מתמטיקה';

export const DEFAULT_SITE_TITLE = 'נועם דורון מתמטיקה · דפי עבודה';
export const DEFAULT_SITE_DESCRIPTION =
  'דפי עבודה במתמטיקה בעברית לכיתות א׳–ט׳ — הסברים ברורים, תרגול ברמות, בחינם וללא הרשמה.';

export type OgType = 'website' | 'article';

export type SocialMetaTag = { property?: string; name?: string; content: string };

/** Env read at request time. Wix production sets SITE_INDEXABLE=true via `wix env`. */
export type SiteIndexEnv = { SITE_INDEXABLE?: string | undefined };

/** True for local/dev and Wix preview hosts — never index these. */
export function isPreviewHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  if (!h || h === 'localhost' || h === '127.0.0.1' || h.endsWith('.local')) return true;
  if (h.includes('wix-site-host.com')) return true;
  if (h.includes('wixstudio.io') || h.includes('editorx.io')) return true;
  return false;
}

export function isProductionHost(hostname: string): boolean {
  const h = (hostname || '').toLowerCase();
  return h === 'www.noamdoronmath.co.il' || h === 'noamdoronmath.co.il';
}

export function readSiteIndexEnv(env: SiteIndexEnv | NodeJS.ProcessEnv = process.env): SiteIndexEnv {
  return { SITE_INDEXABLE: env.SITE_INDEXABLE };
}

/**
 * noindex stays on every preview host, even if SITE_INDEXABLE=true.
 * SITE_INDEXABLE=false forces noindex (soft launch / preview-like production).
 * SITE_INDEXABLE=true indexes non-preview hosts.
 * Unset: only the production hostname is indexable, so a cutover without the
 * env var does not leave www noindex, and unknown hosts stay noindex.
 */
export function robotsContent(hostname: string, env: SiteIndexEnv = readSiteIndexEnv()): string {
  if (isPreviewHost(hostname)) return 'noindex,nofollow';
  const flag = (env.SITE_INDEXABLE || '').trim().toLowerCase();
  if (flag === 'false' || flag === '0' || flag === 'preview' || flag === 'noindex') {
    return 'noindex,nofollow';
  }
  if (flag === 'true' || flag === '1' || flag === 'production' || flag === 'index') {
    return 'index,follow';
  }
  return isProductionHost(hostname) ? 'index,follow' : 'noindex,nofollow';
}

/** robots.txt body. Sitemap always points at the production origin. */
export function renderRobotsTxt(indexable: boolean): string {
  const lines = indexable
    ? ['User-agent: *', 'Allow: /', 'Disallow: /dev-loops', 'Disallow: /hero-loops/']
    : ['User-agent: *', 'Disallow: /'];
  lines.push('', `Sitemap: ${SITE_CANONICAL_ORIGIN}/sitemap.xml`, '');
  return lines.join('\n');
}

/** Open Graph + Twitter tags owned by our layout (Wix copies are stripped). */
export function buildSocialMeta(input: {
  title: string;
  description: string;
  url: string;
  image?: string;
  type?: OgType;
}): SocialMetaTag[] {
  const type = input.type || 'website';
  const tags: SocialMetaTag[] = [
    { property: 'og:title', content: input.title },
    { property: 'og:description', content: input.description },
    { property: 'og:url', content: input.url },
    { property: 'og:locale', content: 'he_IL' },
    { property: 'og:type', content: type },
    { property: 'og:site_name', content: SITE_NAME },
    { name: 'twitter:card', content: input.image ? 'summary_large_image' : 'summary' },
    { name: 'twitter:title', content: input.title },
    { name: 'twitter:description', content: input.description },
  ];
  if (input.image) {
    tags.push({ property: 'og:image', content: input.image });
    tags.push({ name: 'twitter:image', content: input.image });
  }
  return tags;
}

/** Canonical URL on the main production domain (path + search preserved; hash dropped). */
export function canonicalUrl(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  return `${SITE_CANONICAL_ORIGIN}${normalized}${search || ''}`;
}
