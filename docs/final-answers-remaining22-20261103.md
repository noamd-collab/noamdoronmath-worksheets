# Remaining 22 worksheets — final answers

This completes the named 404-sheet republishing project: 378 earlier sheets, four source-recovered grade-8 sheets published through PRs #372/#373, and these final 22. The wider middle-school catalog contains 426 unique PDFs; this report does not claim a new mathematical audit of all 426.

The source was rebuilt with hebrew-math-worksheet 7.0.3-noam, engine 6.18. All 1,735 subparts were solved independently before comparing the existing keys, then rewritten as final results with short reasons where requested, all valid solutions/domains, and acceptance conditions for open questions. All 45 answer pages were inspected visually, including stacked fractions, radicals and final subparts. No PDF was edited manually. The combined 26-sheet source audit covers 538 questions and 2,060 subparts with no missing, extra, blank or duplicate final-answer keys.

## Question preservation and approval

Noam explicitly approved only verified antialiasing differences on 2026-11-03: “לאשר הבדלי החלקת אותיות בלבד, לאחר אימות”. This is not pixel identity under the original 30-pixel gate. The original failures remain recorded.

All 292 question pages were compared against the live reference PDFs: 171 are pixel-identical, 119 have maximum grayscale deltas of at most four, and two have 36/31 changed pixels confined to glyph edges. Text, numbers, glyph origins/bounds, fonts, rendering mode/opacity, vectors and embedded images match. Geometric float tolerance is 0.0001 PDF points; opacity/color/render mode are compared exactly. A deliberately changed opacity was initially accepted by an incomplete comparison; the comparison was hardened, 14 regression cases passed, and all 22 final PDF hashes were independently rechecked. No threshold was increased.

The initial mixed G9-T31 source build was rejected because level c imported the wrong helper. It was rebuilt with reframe_c.py from its own archived source and then passed; the failed candidate remains in local history. A division glyph in a G8-T30 answer was replaced by mathematically equivalent stacked fractions in source and rebuilt through all gates. Question text was not edited.

## Integration

The 22 PDFs were uploaded directly to Wix Media Manager without a temporary GitHub Release; every upload returned READY and its public download matched the local bytes. Old PDFs and manifests remain. The 22 new manifest pairs retain every original exercise and source rectangle. Catalog migrations and all teacher routes point to the new PDFs; the original IDs redirect to them.

Teacher print appends the full answer section of each selected PDF. Every selected question therefore has all of its subpart answers, but the section also includes answers to unselected questions. Selection-only answer cropping is not implemented or claimed.

1,735 local prepared-hint bindings follow the new IDs, with original-ID fallback preserved. Hint content and the geometry-only drawing policy are unchanged. The generated SQL seed was updated as data, but no SQL was executed and no Supabase data was mutated. The Velo backend catalog file is updated in the repository; it is not separately deployed by this workflow.

## Files and exact teacher routes

Checksums, old/new PDF IDs, per-level counts and direct teacher URLs are recorded in [the evidence file](final-answers-remaining22-evidence-20261103.json).

| Topic | Level | Question / answer pages | Answer items | Teacher route |
|---|---|---:|---:|---|
| G7-T03 | a | 9 + 2 | 79 | [Open](https://www.noamdoronmath.co.il/teachers?grade=7&topic=3&level=a) |
| G8-T15 | a | 15 + 2 | 73 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=29&level=a) |
| G8-T15 | b | 16 + 1 | 69 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=29&level=b) |
| G8-T15 | c | 17 + 2 | 76 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=29&level=c) |
| G8-T22 | c | 11 + 3 | 81 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=8&level=c) |
| G8-T23 | a | 10 + 2 | 80 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=9&level=a) |
| G8-T23 | b | 11 + 2 | 81 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=9&level=b) |
| G8-T23 | c | 10 + 2 | 80 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=9&level=c) |
| G8-T24 | a | 9 + 2 | 76 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=4&level=a) |
| G8-T24 | b | 9 + 2 | 70 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=4&level=b) |
| G8-T30 | a | 14 + 2 | 79 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=18&level=a) |
| G8-T30 | b | 15 + 2 | 81 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=18&level=b) |
| G8-T30 | c | 16 + 2 | 82 | [Open](https://www.noamdoronmath.co.il/teachers?grade=8&topic=18&level=c) |
| G9-T06 | a | 22 + 3 | 99 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=5&level=a) |
| G9-T06 | b | 21 + 2 | 97 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=5&level=b) |
| G9-T06 | c | 23 + 3 | 99 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=5&level=c) |
| G9-T09 | a | 8 + 1 | 57 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=18&level=a) |
| G9-T09 | b | 7 + 1 | 54 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=18&level=b) |
| G9-T09 | c | 8 + 2 | 55 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=18&level=c) |
| G9-T31 | a | 14 + 2 | 88 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=6&level=a) |
| G9-T31 | b | 12 + 2 | 90 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=6&level=b) |
| G9-T31 | c | 15 + 3 | 89 | [Open](https://www.noamdoronmath.co.il/teachers?grade=9&topic=6&level=c) |

## Validation

- Every pinned final verification is OK: build gates, export, selfcheck, math notation and complete question-page count.
- Didactic FAIL=0; 534 inherited REVIEW items remain unchanged and are not reported as PASS.
- All 45 answer pages visually checked individually; the independent AA audit pins every final PDF hash.
- The earlier 378-sheet group was checked structurally against catalog/manifests/teacher sheets (28,292 answer subparts, 951 answer pages); this is not a repeated blind mathematical audit.
- Full site suite: 1,960 passed, zero failures/skips (1,951 deterministic, five drawing-hint tests isolated with a 2 GiB heap cap, four live-SSR parity checks).
- Root targeted hint/source binding suite: 27 passed. The earlier legacy root full suite had 93 previously recorded failures outside this data change; it is not claimed green or rerun here.
- Static/provenance, catalog, site-guide, search index, worksheet-index and slash-fraction checks passed. Sync generation ran only in an isolated temporary copy, never inside the worktree.
- Loopback Astro production build passed. The local Wix build was attempted and blocked by missing WIX_CLIENT_ID; hosted preview is not treated as passed. Authorized CI publication supplies its own configured environment.
- Local Brave checked every new PDF: first, middle and last question selected manually (66 whole questions / 248 subparts); all 45 answer pages appended. It generated 97 print pages (52 question pages + 45 answer pages), with zero page errors, zero live AI calls and no 390px horizontal overflow. Every source answer page was visually checked; additional printed canvases with fractions/radicals were inspected.
- Required GitHub checks and publication remain pending at this review commit; final run IDs and live evidence are recorded in the task release report.
