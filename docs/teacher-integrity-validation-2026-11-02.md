# Teacher selection and print integrity — validation

Date: 2026-11-02. Base: `663e99d510cb20f3c8a366f204ee76f5a33570d1` on `headless/astro-poc-baseline`.

## Authorized scope

Noam approved correctness fixes and asked Codex to handle both implementation tracks. Product proposals still need individual approval. The student's worksheet includes final answers at the end; the teacher uses that same worksheet. There is no separate teacher copy.

This change repairs loading/retry, destructive selection changes, keyboard focus, AI candidate validation and complete print output. It does not introduce the proposed four-stage redesign, topic search, new review screen, split note fields, spiral-selection product, evaluation product or local drafts. Source PDFs, answer metadata, crop geometry and drawing-hint rules are unchanged.

## Behavior covered

- Initial catalog and topic failures have visible loading/error/retry states. Retry does not duplicate event handlers, and saved same-grade sections survive topic changes.
- Topic changes, grade resets, narrowing levels and AI replacement ask before discarding selected work. Cancelling leaves selections intact. Grade changes reset the whole page only after acceptance. Invalid external handoffs are ignored before mutation.
- Both existing print modes append final answers. Every selected question must have answer coverage, either extracted from its source or preserved by verified full-page answer metadata. Missing coverage blocks printing explicitly.
- Marked output includes source pages required by continuation rows and shared question context. Original mark coordinates remain on their original page.
- Printing is committed atomically after exercises and answers finish. Superseded renders and partial failures cannot leave stale canvases printable. Error messages persist, receive focus and clear when the underlying preparation succeeds.
- Server-side candidate identity and descriptions come from the canonical index. Invalid explicit candidate lists fail before a provider request. Explicit `one` scope remains exact. Existing counts, level coverage, correction/recovery limits and security checks are preserved.

## Automated checks

| Check | Result |
| --- | --- |
| `npm ci` | PASS |
| `npm run build` with ignored `.env.local` | PASS |
| `npm test` | PASS: 1,898 unit + 5 isolated drawing-hint + 4 live-SSR tests; 1,907 total, zero failures/skips |
| `node .github/scripts/check-slash-fractions.mjs` | PASS |
| `git diff --check` | PASS |
| Source/demo JavaScript byte comparison | PASS |
| `npm run typecheck` | FAIL: 19 existing diagnostics, identical to base |
| `npm run typecheck:tests` | FAIL: 334 existing diagnostics; no additional normalized file/code/message diagnostics versus base |

The application type errors are confined to unchanged `ConceptLoop.astro` (7) and `PocMotion.astro` (12). Both type checks were also run in a separate checkout of the exact base commit. These failures are not reported as passing checks.

The final retry regression and marked-print suite additionally passed 31 focused cases, and the print-integrity test file passed a dedicated strict TypeScript check.

Candidate validation was additionally checked against all 1,281 current browser-generated candidate scopes. Backend coverage includes 1,294 scopes and 3,882 count plans. No live model request was used.

## Browser and PDF checks

Fourteen scenario groups passed in isolated Chromium at 485px and 1280px widths, without uncaught page errors:

- Catalog HTTP failure followed by retry; retained grade and usable controls.
- Keyboard Next/Back focus and modal-close focus restoration.
- Cancelling AI/topic/grade replacement preserves manual selection and dispatches no AI request.
- Both print modes for G9/T7 level a questions 1–3: two exercise pages, then three original answer pages; A4 PDF export at both widths.
- Saved G9/T7 selection plus G9/T3 selection exports both topics, with answers after exercises.
- Real missing-answer source G9/T2 level a: persistent focused error, retained selection, closed modal, no printable canvases.
- Marked G9/T7 level a questions 7 and 12: source pages 4, 5, 7 and 8 retained, followed by three answer pages.
- A transient first PDF HTTP 503 followed by a successful direct retry, without editing the selection: the old persistent error clears, final answers render, selection remains and modal closure restores the original button focus.

Rendered PDF pages were visually inspected for clipping, question/figure separation and avoidable near-empty pages. Actual source PDFs were used. PDF.js and its worker were served locally from the identical installed 3.11.174 package to remove CDN variability.

For the isolated cancellation tests, CAPTCHA/analytics scripts were blocked and AI endpoint requests were guarded. This tests cancellation before dispatch, not live CAPTCHA/model behavior. No live security check was bypassed. A real screen reader and physical paper printing were not tested.

## Existing source-data gaps

Direct PDF inspection found no answer appendix in current G9/T2 level a source `40e46a64bcf0441bae36eba820884704` (10 exercise pages), or G7/T8 excellence source `0da72e0cca4e454da620640f85476a94` (14 exercise pages). Printing selections without answer coverage now correctly stops. An older G9/T2 pilot PDF has answers, but it is not the current catalog source and was not substituted.

G9/T7 source `963480052e8346d6a6a893b9586192f9` has verified full-page answers on pages 12–14. Its fallback intentionally preserves all three original answer pages, including answers to unselected questions, with the existing full-source label. No answers were fabricated.

## Review delivery

The [hosted Wix preview](https://6klaty-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/teachers?grade=9&topic=7&level=a) contains the reviewed implementation. Its JavaScript is checked byte-for-byte against the source, and the served HTML is checked for the new load panel and cache version. The PR identifies the reviewed commit. No merge or production release is included.
