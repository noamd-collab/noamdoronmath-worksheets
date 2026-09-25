/**
 * OPEN-15 — permanent redirects for the domain move (classic Wix site → Headless).
 *
 * The classic site's Redirect Manager stays with the classic site, so after the
 * domain moves every old path has to be answered here. One JSON map is the single
 * source for the middleware and the tests; `src/data/redirects.json`.
 *
 * Rules, in order:
 *  1. An exact map entry (after removing one trailing slash) → its target.
 *  2. Otherwise a trailing slash → the same path without it, as the live site does.
 * The query string is carried over. Targets never chain: a target is never a `from`.
 * Not touched: `/`, `/api/*`, platform paths `/_*`, the blog (`/blog`, `/post/*`,
 * owned by another task) and anything that looks like a file (has an extension).
 */
import map from '../data/redirects.json';

export type RedirectRule = { from: string; to: string; note?: string };

export const REDIRECT_RULES: RedirectRule[] = map.rules;

const byFrom = new Map<string, string>(REDIRECT_RULES.map((r) => [r.from, r.to]));

function isExcluded(path: string): boolean {
  return (
    path === '/' ||
    path.startsWith('/api/') ||
    path.startsWith('/_') ||
    path === '/blog' ||
    path.startsWith('/blog/') ||
    path.startsWith('/post/') ||
    /\.[a-z0-9]{1,5}$/i.test(path.replace(/\/$/, ''))
  );
}

/** Exact-map target for an already-normalized path (no trailing slash), or undefined. */
export function redirectTargetFor(path: string): string | undefined {
  return byFrom.get(path);
}

/** Returns the absolute-path redirect target (with the original query), or null. */
export function resolveRedirect(pathname: string, search = ''): string | null {
  let path: string;
  try {
    path = decodeURI(pathname);
  } catch {
    return null;
  }
  if (isExcluded(path)) return null;
  const bare = path.length > 1 && path.endsWith('/') ? path.replace(/\/+$/, '') || '/' : path;
  const target = byFrom.get(bare) ?? (bare !== path ? bare : null);
  if (!target || target === path) return null;
  return encodeURI(target) + (search || '');
}
