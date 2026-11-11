# Teacher landing and tool entry

The public teacher landing introduces the existing worksheet tool, shows one real source page, and lets teachers select a grade, topic and level before entering the tool. It does not generate a worksheet or call AI.

## Route contracts

| Request | Behavior |
| --- | --- |
| `/teachers`, including marketing-only query parameters | Server-rendered public landing using `BaseLayout`; canonical URL is `/teachers`. Production follows the normal indexable-site policy; preview hosts remain `noindex`. |
| `/teachers` with any `grade`, `topic`, `level`, `edition`, `minutes` or `pick` parameter | Temporary `307` redirect to `/teachers/app`, preserving the entire query and its encoding, with `Cache-Control: no-store`. Presence triggers the redirect even for empty or invalid values; the existing tool validates them. |
| `/teachers/app` | Existing wizard HTML, served with `Content-Type: text/html; charset=utf-8`, `X-Robots-Tag: noindex, nofollow` and `Cache-Control: no-store`. |
| `/teachers/index.html` | Compatibility `307` redirect to `/teachers/app`, preserving the query, with the same noindex and no-store headers. |

Redirect destinations are fixed relative paths, not caller-supplied URLs. Existing scoped bookmarks and site-companion handoffs therefore retain their scope, selected questions and lesson length. Noindex controls indexing; it is not authentication or access control.

The wizard moved from `headless/astro-poc/public/teachers/index.html` to `headless/astro-poc/src/teacher-pages/wizard.html`. Keeping it under `public/teachers/index.html` would allow the static directory index to shadow the new landing. The app endpoint imports the relocated file as raw HTML; its existing assets retain their `/teachers/` URLs. The relocated HTML is byte-identical to the original, with SHA-256:

```text
97dc6cf45aefab0213d5b613825b7462a32de40813af888b7e521424abf76b8b
```

## Catalog and progressive enhancement

`src/lib/teacherLandingCatalog.ts` projects the existing `loadCatalog()` result: the generated `src/data/catalog.v1.json` snapshot of the canonical catalog, merged with the validated `headless/catalog/worksheet-editions.v1.json` publication registry. It does not maintain a second topic list or import the separate public teacher-catalog snapshot into the server worker. Tests compare its scopes against `public/teachers/teacher-catalog.json` and the existing wizard's selection behavior.

The full projection retains real legacy and published editions. The landing's compact inline projection exposes only each topic's canonical default edition and its available level choices; it omits PDF IDs, alternate editions and repeated destination URLs. Single-edition topics use the wizard's `all` edition convention; `c2` belongs to the excellence family, and single-level sources remain selectable through `all`. Explicit unavailable editions or levels are rejected by the scope helper.

The initial grade-three division selection is used when present, with a first-available-topic fallback. Its edition is derived from the publication registry rather than frozen in UI code. The server renders the initial selection and working default link. `/teachers/landing.js` enables the dependent selectors from escaped inline JSON and constructs `/teachers/app?grade=…&topic=…&level=…&edition=…` locally. There is no new runtime catalog API or fetch. A direct tool link remains available without JavaScript.

## Discovery and sample provenance

`src/lib/teacherLandingContent.ts` supplies shared landing copy to the page, search generator and site-guide generator. Search includes `/teachers` as a general page without a fabricated grade or catalog-topic association. The pages sitemap discovers the top-level Astro landing. The site guide distinguishes `page-teachers` (public introduction) from `page-teachers-app` (the existing tool); guide inclusion does not make the noindex app search-indexable. Navigation and local-link resolution recognize both routes.

`public/teachers/landing/division-grade-3-preview.png` is a fixed preview of **page 1 of 8** from the existing grade-three topic `10`, level `a`, edition `elementary-20261108-r1` worksheet, “חילוק והקשר ההפוך לכפל”. It was rendered from the unchanged local source PDF and matched against the canonical edition's SHA-256. The image does not change when the teacher changes the selection; the caption states this explicitly.

- Source PDF: `https://static.wixstatic.com/ugd/d8e7ad_3d7563584d774bf5958dc6a37ef7e210.pdf`
- PDF SHA-256: `465f369f94f96bb086ee8a65be928f5d0397f9320ab8fbfa2da95999685002e3`
- Preview PNG SHA-256: `6b6863a0e9e19baf230f15983ef7e8317d851245126c9ebf437109f76f06b331`

## Scope and validation contract

This change adds an entry page and preserves access to the existing tool. It does not change AI providers, prompts, question-selection algorithms, printing, answer assembly, Word export, worksheet content, authentication, reCAPTCHA or other security policy. The PNG is a source-page preview, not a new generated worksheet or hint drawing.

Validation covers route/query compatibility and the static-shadow regression; canonical/robots/sitemap/search/guide consistency; catalog publication defaults, all emitted scopes and level-family parity with the wizard; byte integrity of the relocated HTML and preview provenance; mobile/desktop layout, keyboard/dialog behavior, dependent selection and no-JavaScript fallback; and production build, worker payload budget and the repository's required checks. Release evidence records the actual outcomes separately; this document defines the implementation and validation boundaries.
