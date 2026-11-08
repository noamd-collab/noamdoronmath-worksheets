# Elementary worksheets: first reviewed edition

This change prepares the first renewed elementary topic, grade 3 topic 10 (division and its inverse relationship with multiplication), alongside all existing worksheets. It is one topic in the larger 169-topic renewal; it does not claim that the remaining topics are complete or published.

The new edition contains three levels, 38 whole questions, 95 subparts and 285 reviewed three-step hints. The PDF sets have 6, 8 and 10 pages for levels B, A and excellence respectively. Source questions, answers, hints, PDF pages and editable Word output were reviewed independently, with later corrections checked against the earlier review. The public data does not contain private review records or local file paths.

## User-visible changes

- Topic and worksheet pages show the new edition and retain the previous worksheets. New learning identities keep progress for different editions separate.
- The teacher workspace can filter new or previous editions while preserving its level selection, saved sections and undo behavior. Selected whole questions retain all parts, their instructions and their answers.
- Measured PDF fragments preserve source geometry, shared figures and prerequisite questions. The editable Word export retains Hebrew RTL, Office Math and native tables. Edition labels distinguish questions from different sources.
- Curated hints have an edition-aware lookup and a separate database table. Missing or mismatched new-edition hints cannot fall back to a different edition's answers. Existing hint and progress behavior remains covered by regressions.

## Reviewed media

All three files were uploaded to Wix media and downloaded again with identical SHA-256 values. Uploading media does not publish the site.

| Level | PDF ID | SHA-256 |
|---|---|---|
| B | `564222bbdc3647a4bc21798f16ff02ac` | `d27d4edc45cff1236e78bae852fc93a8514768453be692216e39ac7d60b1bd2e` |
| A | `3d7563584d774bf5958dc6a37ef7e210` | `465f369f94f96bb086ee8a65be928f5d0397f9320ab8fbfa2da95999685002e3` |
| Excellence | `66b5182b8be74070b1b22b9d393b9b1c` | `12569b36605cffc24ccfc8d4d72fd28f5072eebe385d07cc9f4d42b381d8df89` |

## Validation

- A fresh locked dependency installation passed. After refreshing the catalog, a fresh production build, slash-fraction check and all 2,108 tests passed without skips: 2,099 unit, five isolated drawing-policy and four live SSR tests.
- Root reran 95 focused teacher tests and 14 model-plan identity tests. The latter validated 3,882 supplied plans without live model calls. After normalizing test-only resource paths, all 62 affected fixture tests passed; worksheet bytes and geometry were unchanged.
- All 964 previous teacher catalog rows remain unchanged; the candidate adds three rows. All 1,777 old teacher source files and 846 restored static manifests retain their original hashes. The refreshed catalog snapshot preserves every legacy field and adds only the grade 3 division edition; its SQL seed retains all 964 old identities and adds the three new identities.
- Catalog export and auditing use the registry belonging to the selected repository. Missing or invalid registries still fail, and withdrawing an edition is checked against generated catalog, learning and SQL copies. All 86 focused audit, catalog-contract and edition tests passed; the full audit has zero errors, with its existing warnings and review findings preserved.
- Local desktop and phone flows were exercised. A selection spanning all three levels produced a three-page PDF and a three-page editable Word document; all six rendered pages were inspected. Headers, RTL, tables, mathematics and answer matching were checked.
- The official Wix preview loaded the new edition, rendered a selected question with its answer section, and successfully downloaded an editable Word document.
- `typecheck:tests` still fails with 335 diagnostics. Two isolated comparisons found no newly introduced diagnostic: the captured-before reconstruction also has 335, and a wider reconstruction has 336. This is a documented reconstruction, not a claim that the complete historical checkout has been typechecked successfully.

Preview: https://vldvhb-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com/teachers/index.html?grade=3&topic=10&level=b&edition=elementary-20261108-r1

## Rollout boundary

No production deployment, database migration or hint import has been performed. The migration is included for review; its RLS and binding constraints were exercised locally. The proposed 95-row / 285-hint import remains private and separately hash-bound to the reviewed PDFs. Existing learner data was not queried or changed.

The candidate registry describes the edition that would become available after release. It is not evidence of a live publication. Merge requires Noam's explicit approval of the specific pull request, and publication requires approval and `tools/release/release.sh`. Database rollout and the verified hint import must be completed and checked as part of that coordinated release; no unreviewed hint is advertised as available.
