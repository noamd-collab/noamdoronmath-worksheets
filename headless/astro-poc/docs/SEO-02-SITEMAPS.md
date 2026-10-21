# SEO-02: supplementary sitemap discovery

This PR changes only the project-owned `/sitemap-index.xml` and `/sitemap-pages.xml` implementation. It adds the nested `/blog` hub, preserves `/sitemap-blog.xml` and its real post/archive revision dates, and removes fabricated request-day lastmod values from the static page/index maps. Existing exclusions for redirects, `/404`, `/dev-loops` and development noise are regression-tested; they were already present in source and are not presented as newly fixed live standard-map behavior.

Wix reserves `/sitemap.xml` and all `*-sitemap.xml` routes. This PR intentionally does not override them, disable integration features, remove the site's actual 404 component, or change live settings. The audit's 116 standard-map entries are a dated live snapshot, not an invariant of this custom map or the current main branch.

## Noam-only actions and hosted gate

1. Inspect Wix's actual page registry/indexability for `/404`, `/dev-loops` and any other utility/redirect entry in the standard map. The deployed registry and dashboard-owned indexability determine that map; this source patch does not certify their removal.
2. Add the supplementary index to discovery while retaining the existing Wix sitemap/allow/disallow policy. The exact additional robots line is:

   `Sitemap: https://www.noamdoronmath.co.il/sitemap-index.xml`

   Alternatively, submit this exact supplementary index through the authorized Search Console property. Neither operation was performed by this task.
3. After a separately authorized merge/release, fetch the real custom index and both child maps, verify canonical 200 content for their entries and review Search Console processing. The local Node preview proves project-owned XML only, not that Wix/Google discovered or indexed it.

Reference: https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/feature-guides/seo/about-sitemaps-in-the-astro-integration
