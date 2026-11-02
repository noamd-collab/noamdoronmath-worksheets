# Final answers — batch 5, the sheets whose source is found per sheet (3 November 2026)

This batch republishes 72 grade 7–9 sheets with final answers: 29 sheets whose source package exists for one level at a time, and 43 sheets found later in older package folders. It follows `docs/final-answers-batch4-20261102.md`.

## Why these were not in batch 4

Batch 4 took only topics whose three levels each rebuilt byte-identically from the delivery folder. For the sheets left over, the first search looked only for a delivery whose PDF was byte-identical to the live sheet, in a few indexed folders. That search came up empty, which was wrongly read as "no source". A wider search found source folders on disk for 72 of the 101 remaining sheets:

- **29 sheets** (23 topics): each level has its own delivery folder with a source snapshot. Each level rebuilt byte-identically, as in batch 4. Seven of them are single-level sheets (catalog level `one`).
- **43 sheets** (22 topics): the live PDF is a copy of the student PDF of an older package. That PDF was cut from a full build and renumbered, so it is not byte-reproducible from the source, but its question pages are. The source was chosen only if its rebuild matched the live sheet pixel for pixel above the footer on every question page (at most a few anti-aliasing pixels, at most 3 in practice; the footer page count always differs).

## How the answers were made and checked

Same route as batch 4: one worker per topic solved every item blind from the live PDF, compared with the private key, rewrote the items that were not final answers, rebuilt through the final-answers hook, and read every answer page. The build then ran the skill's gates, `verify_export`, `selfcheck_noam_package` and `check_didactic`, and a new check that no math is printed outside a math span. The mathematical review found no wrong results in most topics; the errors it found are listed in each topic's `review/INDEPENDENT-MATH-REVIEW.md` (for example G8-T24 c11ג and G8-T33 c14ג, which had a false reason).

A final script rebuilt all 45 topic keys once more and checked: all gates pass, `verify_export` and `selfcheck_noam_package` 0 errors, `check_didactic` FAIL count equal to the unmodified build, no math outside a math span, question pages pixel-identical to the live sheets, an answer page in every level. All 45 pass. One check is not clean in the source itself: `check_didactic` reports FAIL D12 for G7-T03 level b (a find target value printed in the text of q3c). The unmodified build gives the same result; it concerns the question text, not the answers.

## Site changes

- 144 new manifests, 72 teacher sheets that print the answer pages (`full-pages`), the catalog, indexes and migrations. Four single-level diagnostic sheets (G8-T01, T26, T34, T35) sit under catalog topics without a `noamTopicId`; their migrations were added by hand with the sheet's own topic code.
- The 72 PDFs were imported into Wix Media through a temporary GitHub release and compared byte for byte with the built files; the release was deleted.
- Ramzi hints follow through the site alias; Supabase is unchanged. The repository bank and ledger record the new ids for 5,699 rows.
- Tests that pinned old ids follow the republished ids (`g7-pdf-v2`, `noam-site-companion`, `static-manifests`, `teacher-question-manifest`), and `final-answers-republish.test.ts` expects 375 republished manifests.
- `check:static`, `check:catalog`, `check:site-guide` and `check:search-index` pass; the unit suite and the root tests fail only what also fails on the baseline (`noam-captcha-uses`).

## Still without final answers (29 sheets)

- 24 sheets (G7-T03 a; G7-T39 a, b; G8-T15, T22 c, T23, T24 a, b, T30; G9-T06, T09, T31): source folders exist, but every one rebuilds a different version of the sheet (different wording on most pages), so using it would change the live questions.
- G8-T45 and G8-T51 level c2, G8-T56 and G8-T57: no source found.
- G8-T65 (three levels): withdrawn earlier and not yet redone.
