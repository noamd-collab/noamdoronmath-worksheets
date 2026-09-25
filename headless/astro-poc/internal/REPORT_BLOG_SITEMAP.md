# Blog sitemap (`/sitemap-blog.xml`)

Option (b) from the 25.09.2026 plan. Branch `cursor/headless-blog-sitemap` off `claude/open07-blog-audio-player`. No merge, Production, DNS, or Wix release.

## Files

- `src/lib/blogSitemap.ts` — `listServedBlogPosts()` from `src/lib/blogPosts.ts` and `listBlogArchives()` from `src/lib/blogArchives.ts`. Names match the plan.
- `src/pages/sitemap-blog.xml.ts` — `GET` returns `application/xml; charset=utf-8`.
- `tests/blog-sitemap.test.ts` — 64 URLs, production host, no duplicates, well-formed XML.
- `robots.txt` was not added or edited.

`prerender` stays `false`, same as every other route. The Wix hosting adapter renders server routes; a prerendered file can be left out of that router. The XML is still only the JSON bundled with the build. The handler does not read the request URL.

## URL diff vs live (fetched 25.09.2026)

Live sources: `https://www.noamdoronmath.co.il/sitemap.xml`, then `blog-posts-sitemap.xml` and `blog-categories-sitemap.xml`.

| | Live | This sitemap |
|---|---|---|
| Post `loc` | 60 | 60, same set |
| Hebrew slugs | 30, unencoded | 30, unencoded (`%` count 0) |
| Latin slugs | 30 | 30 |
| Post `lastmod` | `YYYY-MM-DD` | UTC date of `dateModified`. 0 mismatches |
| Category `loc` | 4 | same 4 |
| Category `lastmod` | `/blog` 2026-09-25, elementary 2026-09-08, middle-school 2026-09-19, teachers 2026-09-08 | omitted (archives have no `dateModified`) |
| Only live / only ours | | 0 / 0 |

Every `loc` is `https://www.noamdoronmath.co.il/...`. Order differs (archives first, then `listServedBlogPosts()`). Sitemap order is not significant.

## Tests (`npm test` in `headless/astro-poc`)

- `tests/blog-sitemap.test.ts`: 4 pass, 0 fail.
- Deterministic unit: 207 tests, 205 pass, 2 fail. Both failures are outside this change:
  - `tests/blog-posts.test.ts` — missing gitignored `reports/m25-blog/pilot-manifest.txt`.
  - `tests/nd-gate-fixture.test.ts` — `puppeteer-core` is not installed.
- Live SSR: 4 tests, 3 pass, 1 fail. `blog-posts-live-sitemap.test.ts` passed (60 live post paths still match). `blog-archive-ssr-gate.test.ts` failed on live `/blog` card order versus the archive fixture (the new post shifted the list). Not caused by the sitemap.

The route was not booted under `wix dev` or a browser.

## Not done (dashboard, migration day)

Add this line in the Wix dashboard robots.txt for project `df6b8141`. Do not put it in the repo:

```
Sitemap: https://www.noamdoronmath.co.il/sitemap-blog.xml
```

On migration day, after `https://www.noamdoronmath.co.il` serves this app, open Google Search Console for that property, go to Sitemaps, and submit `https://www.noamdoronmath.co.il/sitemap-blog.xml`. Without the robots line and this submit, the file can exist and still stay undiscovered. Wix `/sitemap.xml` will still omit these JSON posts.
