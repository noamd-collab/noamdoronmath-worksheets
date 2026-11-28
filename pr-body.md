## What
Serves the 756 KB Pythagoras game document as a static file instead of a `?raw` import inside the worker.

- `src/games/eliyahu-pythagoras.html` moves to `public/games/eliyahu-pythagoras.html`.
- `src/pages/games/eliyahu-pythagoras/play.ts` becomes a 308 redirect to `/games/eliyahu-pythagoras.html`; the embed URL used by the wrapper page is unchanged and the iframe follows the redirect.
- The document now carries `<meta name="robots" content="noindex">`, so the wrapper page at `/games/eliyahu-pythagoras` stays canonical.
- `tests/pythagoras-game.test.ts`, `scripts/build-site-guide.ts` and two engine comments point at the new path.

## Why
The worker ships as base64 inside a JSON body, so every raw byte costs about 1.33 bytes of `budgetedPayloadBytes`. The 756,089-byte HTML was the largest game asset left after the kefel preview PNG (#664). The document is fully self-contained — no relative `src`/`href`, no `fetch`, no `location`/`history` — so the URL can move without rewriting it.

## Measured
```
{"fileCount":876,"rawBytes":13844527,"base64Bytes":18460540,"filesJsonBytes":18519579,
 "payloadBodyBytes":18519607,"metadataAllowanceBytes":16384,
 "budgetedPayloadBytes":18535991,"projectBudgetBytes":19500000,"ok":true}
```
About 964 KB under the old baseline number and about 760 KB under the #664 branch, which leaves real headroom for the next publish.

`dist/_routes.json` excludes `/games/eliyahu-pythagoras.html`, so the file is served directly and never enters the worker.

## Tests
`npx tsx --test tests/pythagoras-game.test.ts tests/public-lesson.test.ts tests/grow-readiness.test.ts` — 35 pass, 0 fail.
