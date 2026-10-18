# PR #169 — review follow-up and replacement similarity animation

Wix preview: https://sjfme8-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com

## Similarity replacement requested by Noam

`SimilarityLoop.astro` replaces the previous `similar`, `similar-area` and `similar-aa` sketches wherever those variants are selected. The common diagram uses true 3–4–5 and 6–8–10 triangles at one scale, labelled corresponding vertices and sides. The basic version enlarges an outlined copy onto the larger triangle. Area mode partitions the large triangle into four congruent copies. AA mode teaches two equal-angle pairs without assuming side lengths. All explanations remain readable throughout the animation; ratios use horizontal fraction bars. Pause and reduced-motion modes retain the mathematical information.

## Antigravity findings addressed

| Finding | Change |
|---|---|
| Slash fractions remained in topic paragraphs | Shared `TopicText` / `LessonMath` render balanced numeric and algebraic fractions in paragraphs, lists and FAQ answers; URLs remain text. Accessibility labels explicitly distinguish numerator and denominator. |
| Corrupted grade-7 algebra prose | Seven exact source paragraphs repaired, including multiplication signs, exponents and worked arithmetic. |
| Inaccurate level descriptions | All 265 topic-page FAQ sources and their structured data say A is the default, B is easier, and excellence is harder. The generated site guide is refreshed. Blog content is outside this change. |
| Wrong introductory/advanced animation mappings | Corrected triangle classification, parallel/perpendicular lines, reading graphs/tables, means, group comparison, number-line fractions, decimal comparison and linear-function tables. Full routing inventory is in the adjacent audit. |
| Misleading visual examples | Base-ten pictures show the actual operands, mixed-number operations show inputs/intermediate values, the percentage grid represents 45%, and bar-chart heights stay faithful to the data. |
| Reflection marker stayed behind | The reflected marker moves with the folding half. |
| Motion and mobile defects | Pause controls cover CSS loops; ConceptLoop now observes OS reduced-motion preference changes; decorative pencil is hidden on narrow screens. |

The corner widgets are existing fixed controls. A viewport-edge intersection is not proof that the animation is internally clipped. No general repositioning of those controls is included, and this report does not certify every scroll position or every device.

## Validation and limits

- Local suite: 573 passed, zero failed, two live-only tests skipped with `CI=true`. The Linux Chrome fixture was excluded locally because this Mac has no `/usr/bin/google-chrome`; GitHub must run it.
- Five PR route / visual-review selection tests passed. `git diff --check` passed.
- Tests measure the actual similarity SVG paths: all three corresponding-side ratios are 2; area ratio is 4; the four drawn tiles have the small triangle's area and fill the large triangle.
- Wix build and preview succeeded using ignored `.env.local` only.
- Brave checks cover representative repaired lessons at phone widths and the similarity drawing on desktop. Pause freezes the moving copy; reduced motion leaves the diagram and explanation visible. No Safari or physical-device claim.
- After integrating main (four dedicated topic films and teacher-print fixes), 81 focused integration checks also passed. New GitHub build/test/link checks and DeepSeek/Qwen reviews must be assessed at the new commit. Earlier reviews of `419c2e37` are not evidence for this revision. Previous DeepSeek attempts timed out.

No merge or production release is part of this update. The external review requirement remains in force; a green workflow wrapper alone is not a completed review.
