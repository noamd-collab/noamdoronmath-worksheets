# Four recovered grade 8 worksheets — final answers

Four editable sources previously reported missing were found in the original batch archives. Each was rebuilt with hebrew-math-worksheet 7.0.3-noam / engine 6.18. All 56 original question pages are pixel-identical above the footer; 11 final-answer pages were appended. No PDF was edited manually.

All 325 subparts were solved independently before opening the private keys, then compared and rewritten as final answers. Reasons are included where requested; open questions state an example and acceptance condition. Every final-answer page was visually inspected. A second targeted review checked G8-T45 question 11 and G8-T57 questions 14 and 20; this is not a second full mathematical audit.

| Topic | Catalog level | Questions / answer pages | Subparts | New PDF ID |
|---|---|---:|---:|---|
| G8-T45 | c2 | 15 + 3 | 81 | `d8e7ad_37e09211e4dd425cbcbf5fe78eb68080.pdf` |
| G8-T51 | c2 | 13 + 2 | 82 | `d8e7ad_404058e8bee94abb9a2c7afc8035f316.pdf` |
| G8-T56 | one | 14 + 3 | 81 | `d8e7ad_e648c67dc98342e18dacae510a233f75.pdf` |
| G8-T57 | one | 14 + 3 | 81 | `d8e7ad_79cfe2e25051430f991cac0d5a8600d5.pdf` |

## Upload and routing

The four PDFs were uploaded directly to Wix Media Manager on site `36dd9544-acf9-4e85-a01a-798f3c1efbb9`, without a temporary GitHub Release. All returned READY and a public download matched the local PDF bytes exactly.

The old PDFs and manifests remain available. Catalog migrations route all four old IDs to the new files, including both `c2` levels. Teacher sheets retain all original question regions and append the entire answer section using `answerGeometry: full-pages`; selected questions therefore keep every answer subpart, although the answer section also contains answers to unselected questions. No claim of selection-only answer cropping is made.

325 local hint source bindings follow the new PDF IDs, retaining the old IDs through `questionPagesIdenticalTo`. Hint content is unchanged. No SQL was executed and Supabase was not mutated. The Velo backend catalog file is updated in the repository but is not deployed by this PR.

## PDF checksums

- [G8-T45-s3-c-e4da7225-final-answers.pdf](https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_37e09211e4dd425cbcbf5fe78eb68080.pdf): `22aa73faec3e9c085331845f3719475573d1c9ca060c9e4db20cc518ffa0e330`
- [G8-T51-s3-c-0b79f523-final-answers.pdf](https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_404058e8bee94abb9a2c7afc8035f316.pdf): `4758ba1d4ea73ed1be47d262d175e59d178e64dbfe70c69c15304dc6d5de4179`
- [G8-T56-s3-c-45591aa6-final-answers.pdf](https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_e648c67dc98342e18dacae510a233f75.pdf): `330d17cf2db949c53df8ee72927553656ea41382efcf18a9513f3bb8f5bc4e58`
- [G8-T57-s3-c-3bcf34a7-final-answers.pdf](https://36dd9544-acf9-4e85-a01a-798f3c1efbb9.usrfiles.com/ugd/d8e7ad_79cfe2e25051430f991cac0d5a8600d5.pdf): `6294ba7526be5b5945702d03f65e1757c4ebaf3b831e76c1da330a5cfcd84302`

## Verification and release status

- Four pinned final_verify runs: OK; question pixel difference 0 on every page.
- Didactic validation: 0 FAIL; 69 existing REVIEW items remain and are not reported as PASS.
- Original-source ID coverage: 325 answer entries, no missing or extra subparts.
- Site suite: 1,955 passed (1,946 deterministic, 5 drawing-hint tests isolated with a 2 GiB cap, 4 live SSR); no skips. Static/provenance, catalog, site-guide, search-index and slash-fraction checks passed.
- Root legacy suite: 548 passed, 94 failed initially. 93 failure names match the prior recorded Claude baseline (not a fresh run of the current baseline). The additional failure was an active E2 PDF expectation; it was updated and its targeted rerun passed. The root suite is not reported green.
- Loopback Astro production build passed. Wix build/remote preview is BLOCKED: the isolated checkout has no WIX_CLIENT_ID. No credentials were searched for or extracted.
- Brave browser checks: questions 1, 11 and 20 selected manually for each of the four sources, 23 printed pages generated (12 question pages and all 11 answer pages), all answer-page counts correct; no page errors or live AI requests. Desktop 1440px and phone 390px layout checked without horizontal overflow. Printed answer pages visually inspected: fractions and complete subparts are preserved without overlap; short final answer pages retained.
- Teacher selection includes the entire answer section of each selected PDF; it does not yet isolate answers to only the three selected questions.
- Integration and publication: pending required GitHub checks; the user-provided completion workflow authorizes squash integration and the publication trigger. Temporary GitHub Release approval was not needed because upload was direct to Wix.

This batch advances the candidate from 378 to 382 of 404 sheets. The other 22 are excluded: their reconstructed question text matches, but raster differences exceed the user-authorized 30-pixel limit. No acceptance threshold was relaxed.


## Subsequent confirmed release

PR #372 merged as 95994999bd3915355b01385bcc5f3c230dfb2bd2; publish PR #373 merged as 2e45be269f23d2c51ee45dad941fe85b6f116841. Run 41621680608 completed with RELEASE_EXIT=0. All four new PDF IDs were verified in the live teacher page: manual Q1/Q11/Q20 selection, all 11 answer pages, desktop/phone and zero AI calls. The earlier pending status above is retained as the pre-merge record. Noam subsequently approved AA-only differences for the other 22; see final-answers-remaining22-20261103.md.
