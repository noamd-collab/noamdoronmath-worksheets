# Local geometry demonstrations

The drawing action can build an actual SVG, without an AI request or an image-generation service. It uses two browser modules:

- `noam-geometry.js`: computed rectangles/rhombi, interpolation and perpendicular projection; bounded SVG rendering, aspect preservation, safe text nodes and mathematical checks for equality/right-angle marks.
- `noam-geometry-guides.js`: selects a construction and the current teaching step from independently verified worksheet facts plus the student's question and the associated answer.

The construction helpers adapt the ideas of the supplied `rectkit.py` to dependency-free browser JavaScript. They do not execute Python in a student's browser or install a language model.

## Current verified coverage

- Rhombus Q6, grade 9 topic G9-T19, current A and excellence worksheets: A/E/O/F/C positions, diagonal halves, subtraction, remaining segments, perpendicularity and the inner quadrilateral. A has three subparts, excellence has two.
- Triangle proof Q4, grade 9 topic G9-T15, current excellence worksheet: true angle-bisector and parallel-line construction, individual angles and hint-specific angle pairs.

The exact live PDFs were downloaded and visually compared with the manifests on 2026-09-20. Seven exercises have `geometrySource` and `geometrySourcePdfSha256`; their hashes match the enclosing manifest's `sourceSha256`. PDFs remain in Wix media.

## Scope and safeguards

- A worksheet ID alone never authorizes a new construction. Matching source facts are required, including the verified E/F order for Q6.
- The selected hint/question determines what is highlighted. Color alone does not assert equality. Goal, hypothetical and student-only claims do not authorize target equality marks.
- Clicking an older answer uses that answer's own preceding question, not a later turn.
- Saved visuals contain bounded context, not HTML, SVG or arbitrary coordinates; they are reconstructed against the current manifest when rendered.
- Existing screenshot-only conversations can use the new drawing action without requesting the same hint again.
- Unsupported constructions retain the original question image with the label “הצג את השרטוט המקורי”. They are not presented as a generated demonstration.

To add a new family, verify its actual PDF and point order, add a source-bound resolver and narrowly scoped stages, and test positive and misleading/conflicting cases. Verify SVG appearance at a narrow width before publishing. Do not expand coverage by matching arbitrary chat text or question numbers alone.

Checks: `node --test tests/*.test.cjs` and `node tools/validate.js index.html`.
