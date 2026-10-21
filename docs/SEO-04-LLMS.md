# SEO-04 — `llms.txt` educational navigation

## Scope

- `headless/astro-poc/src/data/site-llms.md` is a factual English/Hebrew navigation summary for Noam Doron Math. It identifies Noam as the user-supplied math teacher, distinguishes the original grades 1–9 worksheet catalog from curated external resources for grades 10–12, and links to published site pages.
- `headless/astro-poc/src/pages/llms.txt.ts` bundles that Markdown as a raw build asset and serves it as `text/plain; charset=utf-8`. It does not read files at runtime.
- This work does **not** change `robots.txt`, crawler directives, bot permissions, account settings, security settings, or the published terms.

## Limits and release check

`llms.txt` is a navigation aid only. It is **not** a ranking guarantee, a promise of inclusion in AI answers, an authority claim, or a promise of answer keys.

The Astro preview can verify the endpoint locally, but Wix custom-route precedence for `/llms.txt` is still **unverified**. Do not describe the live site as fixed. After Noam's approved release, check the actual public URL for the expected text/plain response and confirm that the existing live `robots.txt` behavior remains unchanged.
