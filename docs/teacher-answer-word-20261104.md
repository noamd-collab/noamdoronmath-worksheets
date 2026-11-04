# Teacher answer completion and Word export

Noam approved implementation, tests and live publication. On 4 November he also approved the concrete ten-question missing-data proposal for grade six and its corresponding answers. Original worksheet PDFs are preserved.

## Content and behavior

- 612 newly completed answers; 120 new content-addressed PDF assets (including seven question-data supplements). Each selected answer has complete part coverage and nonoverlapping measured crops.
- All 933 teacher sources / 18,794 questions now have usable answer mappings. Print fails closed on stale, malformed or missing entries; unselected answers are excluded.
- Approved extra data follows exactly its own question in selection and compact print. Marked-source mode switches to compact for these repairs so the data is retained.
- Word button downloads only selected questions, with editable Hebrew RTL paragraphs and native Office Math. Whole questions and their answers stay together when they fit. Tables allocate width according to their content.
- Word coverage: 404 complete native sources plus ten manually verified G6 transcriptions, 8,026 questions. Other elementary and eight unmatched middle-school sources remain unavailable. This limitation is shown on a failed request; no partial file is downloaded.
- No AI calls or reCAPTCHA changes. No original PDFs edited. No database changes in this PR.

## Validation so far

- Full suite before final layout/context refinements: 1,987 deterministic, five isolated drawing tests with 2 GiB heap cap, four external live-SSR checks passed.
- Selected-answer, question-preview, URL and marked-print checks passed; two new approved-data placement/provenance tests passed. Word completeness/conversion/selection tests passed.
- Ordinary local Brave UI: middle fractions plus all seven affected G6 worksheet/level combinations passed, including all ten repaired questions, exact selected answer keys, actual Word download, desktop/mobile layout. Original PDFs were served from SHA-checked local caches because host DNS could not resolve Wix assets; this is not live verification.
- Rendered DOCX samples inspected with bundled LibreOffice; RTL, horizontal fractions, figures and answer placement checked. Native Microsoft Word UI timed out, so no native Word acceptance claim.
- Local Astro preview build passed. Local Wix build is blocked by missing WIX_CLIENT_ID; official `wix env pull` failed with network ENOTFOUND/404. No credentials were extracted, printed or committed.
- Test TypeScript checking reports existing errors across unrelated test files; no teacher-word error reported. Production build and release checks remain required.

## Remaining release work

Final refinement checks, protected PR checks, Wix build/preview, baseline merge, release through `tools/release/release.sh`, and live verification. Supabase hint authoring/integration and the remaining editable elementary source conversion are separate unfinished work; neither is claimed complete here.
