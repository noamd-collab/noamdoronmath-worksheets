/**
 * HEADLESS-MIGRATION-32 — general same-site URL resolver.
 *
 * Keeps already-migrated HTML routes on the Headless origin; preserves
 * anchors/query, Wix Media PDF URLs, and genuinely external links.
 * No per-topic hard-coded exceptions.
 */
import { TOPIC_PAGE_SLUGS } from './topicPages';
import { BLOG_POST_SERVED_PATHS } from './blogPosts';
import { redirectTargetFor } from './redirects';

export const PROD_ORIGIN = 'https://www.noamdoronmath.co.il';

const LOCAL_SITE_PATHS = new Set([
  '/',
  '/aboutus',
  '/math-tools',
  '/terms',
  '/accessibilityadaptation',
  '/conditionforfreeworksheets',
  '/high-school-math',
  '/worksheets',
  '/learning.html',
  '/worksheet-viewer-noam.html',
]);
// Old paths such as /high-school-math-1, /page and /equations-grade-7 are not pages:
// the middleware answers them with a 301 (src/data/redirects.json), and links to them
// are rewritten below straight to the target, so no rendered link costs a redirect.

const LOCAL_TOPIC_PATHS = new Set(TOPIC_PAGE_SLUGS.map((s) => `/${s}`));

const BLOG_ARCHIVE_PATHS = new Set([
  '/blog',
  '/blog/categories/elementary-math',
  '/blog/categories/middle-school-math',
  '/blog/categories/teachers-and-parents',
]);

function normPath(pathname: string): string {
  if (!pathname) return '/';
  const p = pathname.replace(/\/$/, '') || '/';
  return p;
}

function pathsEqual(a: string, b: string): boolean {
  const na = normPath(a);
  const nb = normPath(b);
  if (na === nb) return true;
  try {
    return decodeURIComponent(na) === decodeURIComponent(nb);
  } catch {
    return false;
  }
}

/** True when this isolated preview serves the pathname as HTML. */
export function isLocallyServedPath(pathname: string): boolean {
  const path = normPath(pathname);
  if (LOCAL_SITE_PATHS.has(path)) return true;
  if (/^\/grade-[1-9]$/.test(path)) return true;
  if (path.startsWith('/worksheets')) return true;
  if (BLOG_ARCHIVE_PATHS.has(path)) return true;
  if ((BLOG_POST_SERVED_PATHS as readonly string[]).some((p) => pathsEqual(p, path))) {
    return true;
  }
  if (LOCAL_TOPIC_PATHS.has(path)) return true;
  return false;
}

function isOwnProductionHost(hostname: string): boolean {
  return (
    hostname === 'www.noamdoronmath.co.il' ||
    hostname === 'noamdoronmath.co.il' ||
    hostname.endsWith('.wix-site-host.com')
  );
}

/** Wix Media / static asset hosts — never rewrite to relative HTML routes. */
export function isMediaOrAssetUrl(url: URL): boolean {
  const path = url.pathname;
  if (path.includes('/_files/') || path.endsWith('.pdf')) return true;
  const host = url.hostname;
  if (
    host.includes('wixstatic.com') ||
    host.includes('filesusr.com') ||
    host.includes('parastorage.com') ||
    host.includes('github.io')
  ) {
    return true;
  }
  return false;
}

export type ResolveSiteHrefResult = {
  href: string;
  local: boolean;
  reason: 'local' | 'external' | 'media' | 'unserved-prod' | 'passthrough';
};

/**
 * Resolve a href for rendering in the isolated Headless preview.
 * - Migrated routes → same-origin path (+ search + hash)
 * - Media/PDFs/external → unchanged absolute URL
 * - Own-site but unserved → keep absolute production URL (honest escape hatch)
 */
export function resolveSiteHref(href: string): ResolveSiteHrefResult {
  if (!href) return { href, local: false, reason: 'passthrough' };
  if (
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    href.startsWith('javascript:') ||
    href.startsWith('data:')
  ) {
    return { href, local: false, reason: 'passthrough' };
  }
  if (href.startsWith('#')) return { href, local: true, reason: 'local' };

  try {
    const u = new URL(href, PROD_ORIGIN);

    if (isMediaOrAssetUrl(u)) {
      return { href: u.href, local: false, reason: 'media' };
    }

    if (!isOwnProductionHost(u.hostname) && !href.startsWith('/')) {
      return { href, local: false, reason: 'external' };
    }

    // Relative or own-host
    const requested = normPath(u.pathname);
    let decoded = requested;
    try {
      decoded = decodeURI(requested);
    } catch {
      /* keep the raw path */
    }
    const path = redirectTargetFor(decoded) ?? requested;
    const suffix = `${u.search}${u.hash}`;

    if (isLocallyServedPath(path)) {
      return { href: `${path === '/' ? '/' : path}${suffix}`, local: true, reason: 'local' };
    }

    // Own site but not served here — keep absolute production (do not invent a 404)
    if (isOwnProductionHost(u.hostname) || href.startsWith('/')) {
      return {
        href: `${PROD_ORIGIN}${path === '/' ? '/' : path}${suffix}`,
        local: false,
        reason: 'unserved-prod',
      };
    }

    return { href, local: false, reason: 'external' };
  } catch {
    return { href, local: false, reason: 'passthrough' };
  }
}

/** Convenience: return only the resolved href string. */
export function resolveSiteHrefString(href: string): string {
  return resolveSiteHref(href).href;
}
