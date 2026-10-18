# PR #169 — review follow-up and replacement similarity animation

Wix preview: https://edjsek-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com

## Similarity replacement requested by Noam

`SimilarityLoop.astro` replaces the three similarity sketches with a compact animated sequence. Following Noam's refinement, the explanation cards are removed: the geometry itself carries the explanation. Three eight-second chapters show (1) an outlined 3–4–5 triangle rotating 90° and scaling onto a 6–8–10 triangle, (2) corresponding right angles in green followed by corresponding acute angles in orange, and (3) one square growing in both dimensions and revealing a 2×2 grid of original square units. A single short caption and formula accompany each chapter. Chapter controls allow revisiting a scene; shared pause and reduced motion are respected. AA mode avoids using side lengths as givens and labels the ×2 area example as an independently chosen enlargement. Area mode retains the four-triangle dissection in its triangle scene.

Item-by-item Hebrew response, including all additional notes: [Gemini response](pr169-gemini-response-he.md).

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

The five mobile routes named in finding 5c were rechecked at 360×800 and 390×800, at three scroll positions each. All 30 observations found both launchers and zero intersections with the visible, clipped card area. The scroll frame ends at y=720, above the controls at y=743.5/748. Full card bounding boxes extending beyond the scrollport do not describe visible overlap. See the linked response and committed measurements; this is not certification of every device.

## Validation and limits

- Local suite: 573 passed, zero failed, two live-only tests skipped with `CI=true`. The Linux Chrome fixture was excluded locally because this Mac has no `/usr/bin/google-chrome`; GitHub must run it.
- Five PR route / visual-review selection tests passed. `git diff --check` passed.
- Tests measure the actual similarity SVG paths: all three corresponding-side ratios are 2; area ratio is 4; the four drawn tiles have the small triangle's area and fill the large triangle.
- Wix build and preview succeeded using ignored `.env.local` only.
- Brave checks cover representative repaired lessons at phone widths and the similarity drawing on desktop. Pause freezes the moving copy; reduced motion leaves the diagram and explanation visible. No Safari or physical-device claim.
- After integrating main (four dedicated topic films and teacher-print fixes), 81 focused integration checks also passed. GitHub run 39144335520 completed all five jobs at `9837d41e`. DeepSeek completed only a truncated diff review: its missing-import blocker is contradicted by tracked files and passing builds. Qwen completed the selected phone/desktop views; its clipping claims were independently checked against scroll boundaries. Neither is a whole-site certification. Subsequent small follow-up changes require their own checks; see the itemized response.

No merge or production release is part of this update. The external review requirement remains in force; a green workflow wrapper alone is not a completed review.
