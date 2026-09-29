/**
 * Preview vs Production SEO switch for Headless Astro.
 * Preview hosts stay noindex; production main domain is indexable with canonical.
 */

export const SITE_CANONICAL_ORIGIN = 'https://www.noamdoronmath.co.il';

/** Hebrew brand for og:site_name and the single WebSite JSON-LD block. */
export const SITE_NAME_HE = 'נועם דורון — דפי עבודה במתמטיקה';

/** Name the Wix project still injects (dashboard rename pending). Never ship it. */
export const WIX_POC_SITE_NAME = 'Noam Math Astro POC';

/**
 * Fallback og:image for pages without their own image (home, grade hubs, site pages).
 * Logo on a white field, ~2:1. A dedicated 1200×630 card is still open (design asset).
 */
export const DEFAULT_OG_IMAGE = `${SITE_CANONICAL_ORIGIN}/brand/noam-doron-math-logo.png`;

export const TITLE_BRAND = 'נועם דורון';
export const TITLE_MAX = 60;
const TITLE_SUFFIX = ` | ${TITLE_BRAND}`;

export const DEFAULT_SITE_TITLE = 'דפי עבודה במתמטיקה לכיתות א׳–ט׳ | נועם דורון';
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

/**
 * Filter/state variants of the catalog (`/worksheets?grade=…&topic=…`) are
 * functional links, not separate documents: noindex, canonical to /worksheets.
 */
export function isWorksheetsVariant(pathname: string, search = ''): boolean {
  const path = pathname.replace(/\/+$/, '') || '/';
  return path === '/worksheets' && search.replace(/^\?/, '') !== '';
}

export function robotsForRequest(
  hostname: string,
  pathname: string,
  search = '',
  noindex = false
): string {
  if (isPreviewHost(hostname)) return 'noindex,nofollow';
  if (noindex || isWorksheetsVariant(pathname, search)) return 'noindex,follow';
  return 'index,follow';
}

/** Canonical URL on the main production domain (path + search preserved; hash dropped). */
export function canonicalUrl(pathname: string, search = ''): string {
  const path = pathname.startsWith('/') ? pathname : `/${pathname}`;
  const normalized = path === '/' ? '/' : path.replace(/\/+$/, '');
  return `${SITE_CANONICAL_ORIGIN}${normalized}${search || ''}`;
}

/** The one canonical a page emits: absolute, no trailing slash, no query string. */
export function pageCanonicalUrl(pathname: string): string {
  return canonicalUrl(pathname);
}

const TITLE_NOISE = /נועם דורון|דפי עבודה|דפי חזרה|חינם/;
const TRAILING_SEPARATORS = /[\s|·,:;–—-]+$/;

function shortenTopic(topic: string, budget: number): string {
  const grade = topic.match(/\s(לכיתות\s+\S+|ל?כיתה\s+[א-ט]׳?)$/);
  const tail = grade ? grade[1] : '';
  let core = grade ? topic.slice(0, grade.index) : topic;
  const room = tail ? budget - tail.length - 1 : budget;
  if (core.length > room) {
    const cut = core.search(/,|\s[–—-]\s|:/);
    if (cut > 0) core = core.slice(0, cut);
  }
  while (core.length > room && core.includes(' ')) core = core.slice(0, core.lastIndexOf(' '));
  core = core.replace(TRAILING_SEPARATORS, '').slice(0, Math.max(room, 1));
  return tail ? `${core} ${tail}` : core;
}

/**
 * Site-wide title template: "[נושא לכיתה X] | נועם דורון", at most 60 chars.
 * Drops the ten legacy suffixes ("| דפי עבודה חינם", "– נועם דורון", …) and
 * shortens long topics while keeping the grade phrase.
 */
export function formatPageTitle(raw: string | undefined | null): string {
  const clean = (raw || '').replace(/\s+/g, ' ').trim();
  if (!clean) return DEFAULT_SITE_TITLE;
  const bar = clean.indexOf(' | ');
  let topic = bar >= 0 ? clean.slice(0, bar) : clean;
  topic = topic.replace(/\s[–—-]\s[^–—]*$/, (seg) => (TITLE_NOISE.test(seg) ? '' : seg));
  topic = topic.replace(/([א-ת]) כיתה(\s+[א-ט]׳)$/, '$1 לכיתה$2').replace(TRAILING_SEPARATORS, '');
  if (!topic || topic === TITLE_BRAND) return DEFAULT_SITE_TITLE;
  if (topic.startsWith(TITLE_BRAND)) return shortenTopic(topic, TITLE_MAX);
  const budget = TITLE_MAX - TITLE_SUFFIX.length;
  if (topic.length > budget) topic = shortenTopic(topic, budget);
  return `${topic}${TITLE_SUFFIX}`;
}

/** Topic part of a formatted title (breadcrumb label fallback). */
export function titleTopic(title: string): string {
  const formatted = formatPageTitle(title);
  return formatted.endsWith(TITLE_SUFFIX) ? formatted.slice(0, -TITLE_SUFFIX.length) : formatted;
}

export type Crumb = { name: string; path: string };

export function breadcrumbJsonLd(items: readonly Crumb[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: pageCanonicalUrl(item.path),
    })),
  };
}

export const HOME_CRUMB: Crumb = { name: 'בית', path: '/' };
