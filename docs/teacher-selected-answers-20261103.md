# Selected final answers in teacher printing — 2026-11-03

Teacher printing previously appended entire source answer sections for outlined or republished PDFs. A selection of a few questions therefore included answers to questions the teacher had not selected. The new path prints only verified rectangles for each selected whole question, preserving all its printed subparts and continuations without rearranging formula fragments.

The printer no longer falls back to complete answer pages or text-overlay coordinates. It deduplicates repeated source/question pairs across saved sections, retains equal question numbers from different levels, attaches each source heading to its first answer, and splits oversized answers only between verified source rectangles. Narrow answer columns retain the source font scale and align to the right. A prepared document is printable only after all selected answers have been validated and rendered.

Canonical public metadata lives in `headless/astro-poc/src/data/teacher-answer-maps.json`; `scripts/apply-teacher-answer-maps.mjs` validates the entire catalog and embeds it in existing teacher sheet JSON files. It runs during prebuild and after teacher catalog regeneration. No worksheet PDF or mathematical answer content is edited by this change. Original `sourceSha256` question provenance is retained; `answerSourceSha256` binds the current PDF used for answers. Generator audits check actual cached PDF bytes; runtime checks metadata consistency, not a new digest of downloaded PDF bytes.

## Source-content limits

Thirteen existing middle-school PDFs have no final-answer section: G7-T10 a/b/c, G7-T14 a/b/c, G7-T19 a/b/c, G7-T35 c and G9-T15 a/b/c. Their questions remain visible, with an explicit notice that the original lacks a complete answer; the app does not fabricate an answer or print unrelated answers instead. Twelve blank answer bodies and eight confirmed elementary placeholders are recorded in [the exact source-content gap list](teacher-selected-answer-content-gaps-20261103.md). Across 21 PDFs, 290 questions have a confirmed gap; 18,504 other questions have mapped answer content. A missing original answer is a content gap, distinct from a lost or clipped answer in this printer.

No new mathematical audit of every answer in the full catalog is claimed. Source rectangles preserve the public final-answer content already printed in the PDFs; geometric coverage and part labels do not prove every explanation is mathematically complete.

## Reproduction and validation

- Middle-school geometry: `scripts/build-teacher-answer-maps.py`, using final source PDFs, expected SHA256, visible number anchors, full answer-row borders, printed part labels and raster boundary checks.
- Elementary geometry: `scripts/build-elementary-answer-maps.py`, using original table/card boundaries and verified physical form ownership for outlined corrections. All 507 PDFs / 10,427 questions mapped; every final crop rendered at 2× with zero dark-ink boundary flags. The 20 confirmed original-content gaps remain explicit.
- `node scripts/apply-teacher-answer-maps.mjs --check` checks active source coverage, exact question/part coverage, bounds and cross-question separation, including explicit unavailable states. All 933 active sources / 18,794 question identities passed; 290 retain an explicit unavailable state.
- Unit tests exercise selected-only answers, continuations, missing content, invalid/stale metadata, repeated sections, same-number mixed levels, source-scale column widths, heading placement and legible page packing.
- Real Brave preview checks compare selected question identities with printed answer identities and save actual PDF/canvas images for visual inspection. Initial middle-school sample: eight cases, 32 selected questions, nine answer canvases; all passed including fractions, long explanations and mixed levels.
- Full local suite: 1,957 deterministic tests, 5 isolated drawing-hint tests with a 2 GiB heap cap, and 4 external live-SSR tests passed. Static provenance and slash-fraction checks pass. Wix build locally is blocked by absent WIX_CLIENT_ID; deployment will use the configured CI wrapper. Elementary/live browser evidence and release confirmation will be recorded before delivery.

The middle-school generator covers 413 answer-bearing PDFs and 30,764 source subpart records; printed part-label audit found no missing labels. Independent comparison of all 933 generated sheets confirmed that original question fields are unchanged.

Current local evidence: `outputs/teacher-selected-answers-20261103/` in the task workspace. No AI request, reCAPTCHA change, private answer export, SQL execution or PDF deletion is part of this change.
