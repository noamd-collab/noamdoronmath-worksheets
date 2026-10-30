# Test gates on the live baseline

Run from `headless/astro-poc` with Node >=22.12:

```sh
npm ci
CI=true npm run test:unit
npm run test:live-ssr
# Both suites, with separate results:
CI=true npm test
```

The deterministic suite runs isolated headless browser fixtures for the entry gate
and game layout. It discovers installed Chrome, Chromium or Brave on macOS, Linux and Windows.
On macOS and Windows it also checks standard Edge installation paths. `CHROME_PATH` explicitly selects an executable and is validated;
a missing browser fails the tests rather than skipping them. The fixtures use fresh
browser contexts and never use the user's browser profile or production storage.

The live SSR suite reads the public production blog archives and blog sitemap. It
requires network access and verifies complete title/link order and sitemap parity.
A blocked request, HTTP error or malformed response fails this separate suite.

The runner selects TAP explicitly so counts remain readable on supported Node
versions; it never reports a successful suite without a test summary. Raw results
and the separate suite summaries are saved under ignored `reports/test-suites/`.

The full runner isolates `drawing-hint-topic.test.ts` in its own process. Every
child has a 2 GiB Node heap cap, one test worker, and a 30-minute timeout. Incomplete
TAP summaries, failed or cancelled tests, and missing required suites fail the run.
The original loop map is committed under `tests/fixtures/grade-loops` with a checksum
and the previously reviewed L14 amendment; the parity check no longer skips.
