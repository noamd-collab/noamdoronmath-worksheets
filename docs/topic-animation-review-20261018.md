# PR #169 — review follow-up and replacement similarity animation

Wix preview: https://edjsek-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com

## Similarity replacement requested by Noam

`SimilarityLoop.astro` uses one compact player with seven consecutive ten-second chapters: AA, SAS, SSS, altitude, angle bisector, median, and area. AA establishes equal α/β angles, rotates the triangles, then reveals corresponding lengths 1→2 and 2→4 one pair at a time. SAS shows only its two given side pairs and included angle; the third edge is almost hidden and unlabelled until the perimeter result. SSS is a full dedicated proof scene: three equal side ratios are revealed successively, then a rotating enlarged copy fits the second triangle. The three corresponding-segment consequences have separate chapters. The area scene retains square-unit grids inside triangles.

The acute scalene example uses side lengths 1, 2, 1.8 and 2, 4, 3.6, with perimeters 4.8 and 9.6. The third length avoids the degenerate 1–2–3 example. Coordinates, all constructions and markings were recomputed, not just relabelled. Edge lengths are not shown in the area chapter, which uses its own visual square-unit grid. Shared pause, manual chapter selection and reduced motion remain supported; static SAS views expose proof/perimeter controls, while static SSS displays all three ratios.

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
- Tests measure the actual similarity SVG paths: all three corresponding-side ratios are 2; area ratio is 4; the two triangles share the same square-unit size and the highlighted original cell maps to four whole cells inside the larger triangle.
- Wix build and preview succeeded using ignored `.env.local` only.
- Brave checks cover representative repaired lessons at phone widths and the similarity drawing on desktop. Pause freezes the moving copy; reduced motion leaves the diagram and explanation visible. No Safari or physical-device claim.
- After integrating main (four dedicated topic films and teacher-print fixes), 81 focused integration checks also passed. GitHub run 39144335520 completed all five jobs at `9837d41e`. DeepSeek completed only a truncated diff review: its missing-import blocker is contradicted by tracked files and passing builds. Qwen completed the selected phone/desktop views; its clipping claims were independently checked against scroll boundaries. Neither is a whole-site certification. Subsequent small follow-up changes require their own checks; see the itemized response.

No merge or production release is part of this update. The external review requirement remains in force; a green workflow wrapper alone is not a completed review.


## Oblique triangles and Greek angles

Following Noam’s correction, the preceding iteration used scalene acute 5–7–6 and 10–14–12 triangles; the latest simple-length geometry is described above. Equal angles are marked with paired arcs and Greek α and β. No triangle vertex is a right-angle given. The rotation, colored side pairs, perimeter traces, midpoint dissection and every interior construction were recomputed for this geometry. A perpendicular marker appears only at the altitude’s foot, where it is mathematically required. Updated SVG tests check all three angles are acute, angle-bisector ratios and equal split angles, perpendicular altitudes, median midpoints, and the exact correspondence up to SVG decimal precision. Playback remains ten seconds per chapter.

## Area shown inside triangles

The area chapter now fills the two oblique triangles with identical 1×1 square-unit grids, clipped naturally by the triangle outlines. A moving gridded triangle rotates and doubles in length, then the larger grid resolves into the original unit size. One highlighted interior cell corresponds to four same-size cells; boundary fragments remain fragments rather than being counted as whole units. The area comparison is S and 4S, not two standalone squares.

## Separate proof chapters follow-up

24 focused geometry/controller/landing-loop checks pass for the latest change. These cover true side lengths and scale, clipped area-grid cells, perpendicular and angle-bisector/median feet, seven ten-second chapters, pause/reduced motion, and AA/SSS reveal timing. Current preview and external-review results are recorded in the PR description after verification. Prior-head review claims above remain historical.

## Explicit 1×1 to 2×2 area demonstration

The area grids now remain stationary and use the exact same 28-pixel unit size in both triangles throughout the sequence. Only one highlighted square grows and rotates: its 1×1 cell maps exactly to a 2×2 block in the large triangle; four original-size cells are revealed afterward. Visible 1×1 and 2×2 labels replace reliance on tiny grids. Geometry tests verify both containment of the original square and the exact transformed bounds of the four-cell target.
