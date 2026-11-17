/**
 * Wix builds /pages-sitemap.xml (the child of the /sitemap.xml that robots.txt
 * declares) from /_wix/pages.json. @wix/astro-pages fills that list with every
 * src/pages/**\/*.astro file, so it advertised URLs that are not pages to send a
 * search engine to:
 *   /404                 answers 404
 *   /dev-loops           a local review route (already outside src/pages)
 *   /search              X-Robots-Tag noindex, follow
 *   /teachers/login      noindex
 *   /teachers/start      noindex, signed-out visitors are redirected
 *   /teachers/generate   noindex, signed-out visitors are redirected
 * The routes themselves are unchanged; only the Wix page list drops them.
 * Our own /sitemap-pages.xml already leaves all six out (siteSitemaps.ts).
 * Re-applied from PR #449 (/404 and /dev-loops) and extended for SEO-1.
 */

export const WIX_SITEMAP_OMITTED_PATHS = Object.freeze([
  '/404',
  '/dev-loops',
  '/search',
  '/teachers/login',
  '/teachers/start',
  '/teachers/generate',
]);

const PAGES_EXPORT = /export const pages = handlePages\(([\s\S]*?)\);/;

/** Rewrite the generated `wix:astro:pages` module so its list skips the omitted paths. */
export function filterWixPagesModuleSource(code) {
  if (!PAGES_EXPORT.test(code)) return code;
  const omitted = JSON.stringify(WIX_SITEMAP_OMITTED_PATHS);
  return code.replace(
    PAGES_EXPORT,
    (_match, args) =>
      `export const pages = handlePages(${args}).filter((page) => !${omitted}.includes(page.path));`,
  );
}

/** Vite plugin applied after @wix/astro-pages loads its virtual module. */
export function omitWixSitemapPathsPlugin() {
  return {
    name: 'noam-omit-wix-sitemap-paths',
    enforce: 'post',
    transform(code, id) {
      if (!String(id).includes('wix:astro:pages')) return null;
      const next = filterWixPagesModuleSource(code);
      return next === code ? null : { code: next, map: null };
    },
  };
}
