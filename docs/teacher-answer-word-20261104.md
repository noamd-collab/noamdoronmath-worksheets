# Teacher answer completion and Word export

Noam approved implementation, tests and live publication. On 4 November he also approved the concrete ten-question missing-data proposal for grade six and its corresponding answers. Original worksheet PDFs are preserved.

## Content and behavior

- 612 newly completed answers; 120 new content-addressed PDF assets (including seven question-data supplements). Each selected answer has complete part coverage and nonoverlapping measured crops.
- All 933 teacher sources / 18,794 questions now have usable answer mappings. Print fails closed on stale, malformed or missing entries; unselected answers are excluded.
- Approved extra data follows exactly its own question in selection and compact print. Marked-source mode switches to compact for these repairs so the data is retained.
- Word button downloads only selected questions, with editable Hebrew RTL paragraphs and native Office Math. Whole questions and their answers stay together when they fit. Tables allocate width according to their content.
- Word coverage: 404 complete native sources plus ten manually verified G6 transcriptions, 8,026 questions. The other elementary questions and 22 middle-school source PDFs remain unavailable. This limitation is shown on a failed request; no partial file is downloaded.
- No AI calls or reCAPTCHA changes. No original PDFs edited. No database changes in this PR.

## Validation so far

- Full suite before final layout/context refinements: 1,987 deterministic, five isolated drawing tests with 2 GiB heap cap, four external live-SSR checks passed.
- Selected-answer, question-preview, URL and marked-print checks passed; two new approved-data placement/provenance tests passed. Word completeness/conversion/selection tests passed.
- Ordinary local Brave UI: middle fractions plus all seven affected G6 worksheet/level combinations passed, including all ten repaired questions, exact selected answer keys, actual Word download, desktop/mobile layout. Original PDFs were served from SHA-checked local caches because host DNS could not resolve Wix assets; this is not live verification.
- Rendered DOCX samples inspected with bundled LibreOffice; RTL, horizontal fractions, figures and answer placement checked. Native Microsoft Word UI timed out, so no native Word acceptance claim.
- Local Astro and Wix production builds passed. A process-local DNS fallback restored official `wix env pull` without changing OS/TLS/security settings. No credentials were extracted, printed or committed.
- The merged-baseline full suite passed 1,990 unit + five isolated drawing + four live SSR checks (1,999 total).
- Wix preview found a real 413 on deployment finalization: embedding the Word content bank added about 5 MiB to the backend upload. The bank is now an immutable static asset, verified by SHA-256 and loaded from an approved site origin; the worker contains only its descriptor. Added integrity, origin, cache and retry regression tests.
- Test TypeScript checking reports existing errors across unrelated test files; no teacher-word error reported. Production build and release checks remain required.

## Remaining release work

Final refinement checks, protected PR checks, Wix build/preview, baseline merge, release through `tools/release/release.sh`, and live verification. Supabase hint authoring/integration and the remaining editable elementary source conversion are separate unfinished work; neither is claimed complete here.

## 5 November production-build repair

PR #390's release stopped before publication: Node 22/Linux recompressed the reviewed bank to different gzip bytes than Node 26/macOS, triggering a false stale-bank error. `--check` now compares the complete decompressed bank and counts with the freshly source-validated content, then preserves and hashes the exact reviewed compressed artifact. Changed questions, answers, counts, broken compression or a changed descriptor still fail. A Linux Node 22 CI job now checks the whole bank before release. No question, answer, figure or compressed content artifact changed.

Noam plans to replace all elementary worksheets. Further conversion of the old elementary set is deferred; the elementary skill/source contract is being updated for the replacement worksheets.
