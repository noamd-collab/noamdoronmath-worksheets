# Final answers — batch 3 (2 November 2026)

This batch covers G9-T17 (המקבילית), G9-T18 (המלבן), G9-T19 (המעוין) and G9-T20 (הריבוע), all three levels of each: 12 sheets, 649 items. It follows the same route as G9-T07 and batch 2 (`docs/final-answers-g9t07-20261102.md`, `docs/final-answers-batch2-20261102.md`).

- **Rebuild check.** Each unmodified package source was rebuilt first. All 12 PDFs came out byte-identical to their verified deliveries. G9-T17 keeps a separate source snapshot per level, so each level was rebuilt from its own snapshot.
- **Answer text.** The final answers start from the package key and are printed through the `final_answers.py` hook, which refuses a missing or extra item. The answers note names the level.
- **Mathematical review.** Full review, not a sample: each topic had its own independent reviewer, who solved every item from the printed pages before reading the answers.

  | Topic | Items | Errors | Incomplete | Long | Wording |
  |---|---|---|---|---|---|
  | G9-T17 | 180 | 0 | 6 | 51 | 1 |
  | G9-T18 | 158 | 0 | 7 | 1 | 9 |
  | G9-T19 | 150 | 1 | 9 | 2 | 18 |
  | G9-T20 | 161 | 0 | 2 | 1 | 8 |

  - The one error was a false reason with a correct result (G9-T19 b 17ב: the rhombus there is AEDF, so the angle at A is ∠EAF, not ∠DAB). It is fixed.
  - "Long" answers showed full working the item did not ask for; they now keep the result and the deciding reason.
  - All the reviewers' fixes were applied.
- **Spacing and formulas.** The G9-T19 and G9-T20 keys were written differently from the other topics:
  - Hebrew words were glued to the number or formula after them ("היא63", "עבורs8"). A mechanical pass separated them (80 answers in G9-T20; in G9-T19 the reviewer's replacements already covered every case). The few answers that had lost their "=" were rewritten by the reviewer.
  - Formulas were typed as plain text instead of math spans ("△ABE≅△BCF", "AE=AF, AC משותפת", "או−4", "0<t<s"). The first visual check found that right-to-left layout reordered them on 15 answer pages ("BCF△≅ABE△", "t<s>0"). A second pass put every formula in a math span (190 answers). A script checked that no answer's content changed: with the markup removed, every answer reads the same as before. A new check now fails the build when any Latin letter or math sign on an answer page sits outside a math span; it passes on all 12 sheets here and on the 15 sheets already published.
- **Engine gates.** Five new texts failed gates and were reworded: three answers with one-letter angles (G81) now use three letters, and two colon ratios (G42) are written as a sentence or a fraction.
- **Technical checks** (final build, all 12 levels):
  - all build gates pass;
  - `verify_export` and `selfcheck_noam_package`: 0 errors;
  - `check_didactic`: 0 FAIL. Its remaining REVIEW items are the same as in the unmodified build.
- **Visual check.** Every answer page was rendered and inspected; the G9-T19 and G9-T20 pages were inspected again after the formula fix. The question pages are pixel-identical to the live sheets above the footer band.
- **Site.**
  - The 12 PDFs were imported into Wix Media and checked byte-identical.
  - Manifests (`questionPagesIdenticalTo` the old id), catalog, indexes and migrations are updated.
  - The teacher sheets print the answer pages (`full-pages`).
  - Hints follow through the site alias. Supabase is unchanged; the repository bank records the new ids.
- **Tests.** check:static, check:catalog, check:site-guide and check:search-index pass. The unit suite and the root tests fail only what also fails on the baseline.

The sources, builds, checker logs and reviews are kept outside the public repository, in `worksheet-work/claude-final-answers-skill-20261102/<topic>/`. Problems the reviewers found in the question text and figures are listed in each topic's `review/INDEPENDENT-MATH-REVIEW.md`; the questions are not changed here. Among them: G9-T17 c 10ד refers to "סעיף ב" where the proof is in סעיף א; G9-T20 a 10ב can be read as a false claim; G9-T20 c2, c13 and c16 figures are drawn at the answer value.
