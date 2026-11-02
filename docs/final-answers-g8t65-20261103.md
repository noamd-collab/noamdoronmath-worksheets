# G8-T65 republished with final answers — 3 November 2026

G8-T65 (הוכחות בחפיפת משולשים), levels א׳, ב׳ and מצוינות: three sheets, 42 questions. It was republished on 2 November, withdrawn together with the withdrawn batch, and is republished here in the same form after its checks were repeated.

## How it differs from the other batches

The sheet has no package source on disk, so it cannot be rebuilt through the skill's hook. Its answer pages were written in the engine's answers schema (`answers_g8t65.py`) and rendered by the skill's own emitter, then appended to the live PDF. The live question pages are kept as they are; only the footer count "עמוד i מתוך n" is replaced by the engine's rendering of the new total, on every page.

## Checks

- **Mathematics:** a reviewer solved all 42 questions before opening the answers and found no mathematical error. The review's wording and layout findings were fixed (triangle and angle symbols as math islands, no-break space after "לפי", conclusions added to a14א and c10א, and others). Records are in `claude-final-answers-evidence-20261102/g8-t65/review/`.
- **Pixels:** the question pages of all three PDFs are pixel-identical to the live sheets above the footer band (maximum difference 0).
- **Import:** the three PDFs were imported into Wix Media and compared byte for byte with the built files; the temporary release was deleted.
- **Site:** 6 new manifests, 3 teacher sheets that print the answer pages (`full-pages`), the catalog and migrations. Hints follow through the site alias; Supabase is unchanged. The repository bank records the new ids for 123 rows.
- **Tests:** `check:static`, `check:catalog`, `check:site-guide` and `check:search-index` pass. The unit suite and the root tests fail only what also fails on the baseline (`noam-captcha-uses`).

## Known limits

- The build gates, `verify_export` and `check_didactic` could not be run because there is no package source.
- The figure in G8-T65 b q2ג has one unbroken arc at B (recorded earlier).
