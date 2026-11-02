# G9-T07 republished with final answers — 2 November 2026

This is the first approved batch of grade 7–9 sheets that get a final-answers page: G9-T07, אי־שוויונות ריבועיים ומערכות משוואות, levels א׳, ב׳ and מצוינות. It replaces the withdrawn attempt of PR #341, which appended full teacher keys copied from the deliveries.

## How the answers were made

- **Skill:** `hebrew-math-worksheet` 7.0.3-noam, engine 6.18-noam. The production route is the one the skill requires: fix the editable source and rebuild.
- **Rebuild check:** rebuilt with no changes, the package source reproduced the verified delivery byte for byte (level א׳), so the route is safe.
- **Answer text:** `final_answers.py` holds the public answer for each of the 123 items: the result, plus a short reason where the item asks to explain, prove or check. The package's `authoring.py` prints these answers instead of the private key. The build refuses a level with an item that has no answer, or with an answer that matches no item. The private key in the original package is unchanged.
- **Answer note:** the note above the answers names the level ("רמה א׳ · התשובות הסופיות …").

## Verification

**Mathematical review (full, not a sample).**
- An independent reviewer solved all 123 items from the printed pages before opening the answer file. It then checked every system solution by exact substitution and every inequality on a dense grid, plus exact endpoint checks.
- First pass: 0 mathematical errors, 4 incomplete answers and 6 wording issues. All ten were fixed. One more wording fix (c 25א) followed during the visual check.
- The two problems the reviewer found in the question text are not changed here:
  - a Q2 says "הצלע המסומנת x", but no side is marked x;
  - the phrase in c Q2ב is garbled.

**Technical (all three levels, final build).**
- Every build gate passes.
- `verify_export`: 0 errors.
- `selfcheck_noam_package`: 0 errors.
- `check_didactic`: FAIL 0, with REVIEW 4/3/4 on figure items. The unmodified source gives the same REVIEW items, so they are not caused by the answers.

**Visual.**
- Every answer page was rendered and inspected: a p22–23, b p19–20, c p20–21.
- The question pages are pixel-identical to the live sheets above the footer band. Their text differs only in the page-count footer.

**Upload.**
- The three PDFs were imported into Wix Media and downloaded back byte-identical.
- New ids: a `b4335c05…`, b `7625185b…`, c `be641e8b…`.

## Site changes

- 3 new manifests (`questionPagesIdenticalTo` the old id), plus catalog, indexes and migrations from the old ids.
- The teacher sheets point at the answer pages (`answerGeometry: full-pages`, `answerStartPage`, `exercisePageCount`).
- Ramzi hints follow the republished sheets through the site alias, by Noam's decision; production Supabase is not changed.
  - `noam-curated-hints.js` accepts a row bound to the original PDF.
  - `noam-source-panels.js` keeps approved crops on it.
  - The repository bank, seed and ledger record the new ids for the 123 rows. No production SQL is part of this change.
- Tests:
  - `final-answers-republish.test.ts` covers the manifests, migrations, teacher answer pages, the hint alias and the crop alias.
  - The unit suite passes except `noam-captcha-uses`, which also fails on the baseline.
  - The root tests fail exactly the same set as the baseline.
  - `check:static`, `check:catalog`, `check:site-guide` and `check:search-index` pass.

The source, the builds, the checker logs and the review records are kept outside the public repository, in `worksheet-work/claude-final-answers-skill-20261102/G9-T07/`.
