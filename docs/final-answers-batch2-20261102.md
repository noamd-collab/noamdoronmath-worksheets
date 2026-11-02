# Final answers — batch 2 (2 November 2026)

This batch covers G9-T04 (צמצום שברים אלגבריים), G9-T05 (שורשים), G9-T10 (סטטיסטיקה) and G9-T11 (הסתברות), all three levels of each: 12 sheets, 619 items. It follows the same route as G9-T07 (`docs/final-answers-g9t07-20261102.md`).

- **Rebuild check.** Each unmodified package source was rebuilt first. All 12 PDFs came out byte-identical to their verified deliveries, and their question pages are pixel-identical to the live sheets.
- **Answer text.** The final answers start from the package key, which already gives a result and a short reason for each item. The public build prints them through a `final_answers.py` hook that refuses a missing or extra item, and the answers note names the level. G9-T04 keeps its own student-facing note, because that note says what a simplification answer includes.
- **Mathematical review.** Full review, not a sample: each topic had its own independent reviewer, who solved every item from the printed pages before reading the answers. Result: 0 mathematical errors in all four topics. The reviewers' fixes were applied:

  | Topic | Incomplete | Wording |
  |---|---|---|
  | G9-T04 | 4 | 9 |
  | G9-T05 | 9 | 10 |
  | G9-T10 | 12 | 36 |
  | G9-T11 | 6 | 21 |

  Most of the incomplete items were open questions without the "other answers exist" note, checks the item asks for, and comparisons with no verdict. In G9-T10 two new texts failed engine gates (a `3:1` ratio and a `≠` glyph the font lacks); both were reworded and the build passes.
- **Technical checks** (final build, all 12 levels):
  - all build gates pass;
  - `verify_export` and `selfcheck_noam_package`: 0 errors;
  - `check_didactic`: 0 FAIL. Its remaining REVIEW items are the same as in the unmodified build.
- **Visual check.** The answer pages of every topic were rendered and inspected.
- **Site.**
  - The 12 PDFs were imported into Wix Media and checked byte-identical.
  - Manifests (`questionPagesIdenticalTo` the old id), catalog, indexes and migrations are updated.
  - The teacher sheets print the answer pages (`full-pages`).
  - Hints follow through the site alias. Supabase is unchanged; the repository bank records the new ids for the 619 rows.
- **Tests.** check:static, check:catalog, check:site-guide and check:search-index pass. The unit suite and the root tests fail only what also fails on the baseline.

The sources, builds, checker logs and reviews are kept outside the public repository, in `worksheet-work/claude-final-answers-skill-20261102/<topic>/`. Problems the reviewers found in the question text are listed in each topic's `review/INDEPENDENT-MATH-REVIEW.md`; the questions are not changed here.
