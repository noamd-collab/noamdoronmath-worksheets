# Final answers — batch 4, the remaining grade 7–9 topics with source (2 November 2026)

This batch republishes 92 topics, all three levels of each: 276 sheets and 21,079 items, with final answers. It follows the route of G9-T07 and batches 2 and 3 (`docs/final-answers-g9t07-20261102.md`, `docs/final-answers-batch2-20261102.md`, `docs/final-answers-batch3-20261102.md`). Noam asked for all the remaining topics in one go instead of small batches.

Topics: G7 — 01, 02, 05–09, 11–13, 15, 20, 22, 24–31, 33, 37, 40, 44, 49, 50; G8 — 04–06, 10–14, 16–20, 28, 29, 31, 34, 36–55, 61–64, 66; G9 — 01, 02, 08, 12, 13, 21–24, 26–29, 32–40, 46. Eight G9 topics (G9-T21 to T24 and T26 to T29) print "כיתה ז׳" on the sheet; the catalog files them under grade 9, and this batch does not change that.

## How the answers were made

- **Rebuild check.** Each unmodified package source was rebuilt first, and its three PDFs had to be byte-identical to the verified delivery (a topic that failed this would have been set aside; none did). The question pages of the final sheets are pixel-identical to the live sheets above the footer band.
- **Answer text.** `final_answers.py` holds the public answer for each item. The package's `content.py` prints these answers instead of the private key through a hook that refuses a missing or extra item. Five topics with pie-chart questions (G7-T08, T24, T26, T27, G8-T12) expand the generated answer rows before the hook runs.
- **Mathematical review.** Full review, not a sample: one reviewer per topic first solved every item from the live PDF, saved the solutions, and only then opened the key. Reviewers were Sonnet agents (Noam chose the cheaper model for this batch). Each reviewer classified every item (OK, error, incomplete, long, wording) and rewrote the ones that were not OK.
  - At least 22 mathematical errors were found in the private keys and fixed, in about 18 topics. Examples: G7-T11 a5ה (total change 121 instead of 202), G9-T32 c7ג (a different equation from the one printed), G9-T12 c2א (a counterexample that did not refute the claim), G8-T31 c9ד (wrong set of removed values).
  - Most other fixes added a missing note that other answers exist (open questions), a missing reason, a missing name or unit, or shortened a worked solution to a final answer.
  - Reviewers disclosed several of their own misreads of a figure; each was resolved against the PDF text layer and noted in that topic's `SOLVED-BEFORE-ANSWERS.md`. A few items were therefore not purely blind.
- **Engine gates and symbols.** Answers use the engine's math notation: every formula inside `$…$`, `\neq` and `\cong` as vector macros, three-letter angle names, ratios written as words or fractions, and no space before an exponent on a letter or bracket base (a space on a plain-number base, because the text layer otherwise reads `5^2` as 52). A new check in the build fails any answer page that prints a Latin letter or a math sign outside a math span.
- **Final verification.** After all workers finished, every topic was rebuilt once more and checked by one script (`tools/final_verify.py`). All 92 topics pass every item of this list:
  - build exit 0 and all gates pass;
  - `verify_export` and `selfcheck_noam_package`: 0 errors;
  - `check_didactic`: 0 FAIL, and the REVIEW counts equal those of the unmodified build;
  - no math printed outside a math span;
  - question pages pixel-identical to the live sheets; each level has at least one answer page.
- **Visual check.** Each worker read every answer page of its topic and confirmed the right-to-left order of formulas from the PDF text positions (on every line in most topics, on sampled lines in some). No second person looked at the pages.

## Site changes

- 552 new manifests (`questionPagesIdenticalTo` the old id), plus catalog, indexes, migrations and 276 teacher sheets that print the answer pages (`full-pages`).
- The 276 PDFs were imported into Wix Media through a temporary GitHub release and compared byte for byte with the files that were built; the release was then deleted.
- Ramzi hints follow the republished sheets through the site alias. Supabase is unchanged. The repository bank and ledger record the new ids for all 21,079 rows.
- Tests that pinned old ids now pin the republished ones: `g9-pdf-v2.test.ts`, `noam-site-companion.test.ts`, `static-manifests.test.ts`, `ramzi-hints-build.test.cjs`, `final-answers-republish.test.ts` (new total 303 republished manifests).
- check:static, check:catalog, check:site-guide and check:search-index pass. The unit suite and the root tests fail only what also fails on the baseline (`noam-captcha-uses`).

## Not in this batch

38 topics (about 100 sheets) have no source that rebuilds all their levels: some have only one level on file, some have deliveries that do not match the live sheet. They are handled separately.

The sources, builds, checker logs and reviews are kept outside the public repository, in `worksheet-work/claude-final-answers-skill-20261102/<topic>/` (`review/INDEPENDENT-MATH-REVIEW.md` lists, per topic, every item that was rewritten and the problems the reviewer saw in the question text; the questions themselves are not changed).
