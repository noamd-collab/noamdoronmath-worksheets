/** Map a pull-request diff to Astro routes worth screenshotting. */

export const PAGE_PREFIX = 'headless/astro-poc/src/pages/';
export const FALLBACK_PAGES = ['/', '/grade-5', '/grade-9', '/factoring-grade-9', '/worksheets?grade=9', '/blog'];
export const MAX_SCREENSHOT_PAGES = 6;

const PAGE_FILE = /\.(astro|ts|tsx|js|mjs)$/;

export function routeFromPageFile(file) {
  const norm = String(file).replaceAll('\\', '/');
  if (!norm.startsWith(PAGE_PREFIX)) return null;
  const rel = norm.slice(PAGE_PREFIX.length);
  const parts = rel.split('/');
  if (parts.some((part) => part.startsWith('_') || part.includes('['))) return null;
  if (parts[0] === 'api') return null;
  if (!PAGE_FILE.test(rel)) return null;

  let route = rel.replace(PAGE_FILE, '');
  // Feed contents are tested as data, not mistaken for real learner screenshots.
  if (/\.(xml|txt|json)$/.test(route)) return null;
  if (route.endsWith('/index')) route = route.slice(0, -'/index'.length);
  else if (route === 'index') route = '';
  if (route === 'worksheets') return '/worksheets?grade=9';
  return route === '' ? '/' : `/${route}`;
}

/**
 * Pages whose source files changed. Shared components and styles do not name a
 * single route, so those diffs use the fallback set.
 */
export function pagesTouchedByDiff(files) {
  const seen = new Set();
  const routes = [];
  for (const file of files) {
    const route = routeFromPageFile(file);
    if (!route || seen.has(route)) continue;
    seen.add(route);
    routes.push(route);
  }
  if (routes.length === 0) {
    return { pages: [...FALLBACK_PAGES], fallback: true, omitted: [] };
  }
  return {
    pages: routes.slice(0, MAX_SCREENSHOT_PAGES),
    fallback: false,
    omitted: routes.slice(MAX_SCREENSHOT_PAGES),
  };
}
