# SEO-01: main-page metadata ownership

This PR is a proposed code repair, not a live fix or permission to merge/release.

The live audit found duplicate raw title/canonical tags. Browser MutationObserver removal did not repair the response crawlers received. Wix's documented managed-Astro behavior resolves main-page titles, descriptions, canonicals, robots and social tags from the dashboard at the hosting boundary.

The Wix production configuration now marks that ownership. On recognized production main-page requests, BaseLayout does not emit a competing primary set. The independent Node preview continues to render its existing Hebrew title/description/canonical in initial HTML because it does not run Wix injection. The visual layout, structured-data slot, font preloads and site components remain intact. No dashboard, security, indexing setting or deployment is changed by this PR.

## Mandatory owner gate before merge/release

Noam must confirm that Wix's actual main-page settings contain the intended Hebrew page-specific titles/descriptions/canonicals, not the POC/default patterns. Removing competing tags alone does not correct a bad dashboard value. Then a separately authorized hosted version must be inspected without JS and in a real browser on home, grade 5, factoring, a filtered catalog and an error page. A local Node preview is not evidence that Wix injected exactly one coherent set. Internal request URLs use Wix's documented forwarded public URL.

## Item pages remain open

Current blog `seo-tags` slots contain complements, not a complete Wix `SEO.Tags` primary set. This PR deliberately preserves their post-derived tags and does not strip scripts/schema or silently remove article titles. Any remaining raw blog/item duplicates require a separate, verified item-page SDK integration (`@wix/seo` and compatible `@wix/essentials`), not blanket tag deletion. This is an explicit unresolved part of the audit's sitewide count; do not label all 109 audited URLs fixed.

## References

- https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/feature-guides/seo/manage-seo-for-main-pages
- https://dev.wix.com/docs/go-headless/wix-managed-headless/full-integration-astro/feature-guides/seo/add-seo-support-to-item-pages

The documentation mentions release/dashboard operations. They are Noam-only future verification steps and were not executed by this PR task.
