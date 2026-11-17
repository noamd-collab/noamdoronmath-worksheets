/**
 * Wix builds /pages-sitemap.xml from /_wix/pages.json.
 * @wix/astro-pages lists every src/pages file, including the real 404 route.
 * /404 and /dev-loops answer 404 and have no replacement page, so they stay
 * out of that list. The Astro 404 route itself is unchanged.
 */

export function filterWixPagesModuleSource(code) {
  const marker = 'export const pages = handlePages(';
  if (!code.includes(marker)) return code;
  return code.replace(
    /export const pages = handlePages\(([\s\S]*?)\);/,
    'export const pages = handlePages($1).filter((page) => page.path !== "/404" && page.path !== "/dev-loops");',
  );
}

/** @returns {import('astro').AstroIntegration} */
export default function omitWixSitemapPaths() {
  return {
    name: 'noam-omit-wix-sitemap-paths',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        updateConfig({
          vite: {
            plugins: [
              {
                name: 'noam-omit-wix-sitemap-paths',
                enforce: 'post',
                transform(code, id) {
                  if (!String(id).includes('wix:astro:pages')) return null;
                  const next = filterWixPagesModuleSource(code);
                  return next === code ? null : next;
                },
              },
            ],
          },
        });
      },
    },
  };
}
