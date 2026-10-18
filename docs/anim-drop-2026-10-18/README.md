# Animation drop 2026-10-18 (staging only, no site code)

Four finished topic-page films, made with the film pipeline. Final deliverables per slug:
`film.js` (final round), `index.html` (standalone preview), `spec.md` (the brief), `reviews.md` (full review history), `contact.png`.
`_shared/` holds the engine pieces (engine.js, card.css, build.mjs, lib.mjs, spec-common.md, fonts).

| slug | final round | Qwen visual | DeepSeek code |
|---|---|---|---|
| distributive-area-model-grade-4 | r5 | PASS | PASS |
| fraction-division-meaning-grade-6 | r6 | PASS | PASS |
| grade-4-summary | r5 | PASS | PASS |
| measurement-geometry-synthesis-grade-6 | r9 | PASS | FAIL (disputed: label-anchor overlap claim contradicted by the rendered 390px frame) |

Note: grade-4-summary reports seamIdentical=false in every Qwen round (first frame differs from last frame); check the loop seam when integrating.
