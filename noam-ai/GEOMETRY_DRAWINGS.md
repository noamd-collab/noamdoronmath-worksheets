# Geometry demonstrations

The drawing action produces a local SVG. Verified guides need no AI request;
other supported straight-line geometry uses a small AI-generated JSON plan.
There is no image-generation service. The browser modules are:

- `noam-geometry.js`: computed rectangles/rhombi, interpolation and perpendicular projection; bounded SVG rendering, aspect preservation, safe text nodes and mathematical checks for equality/right-angle marks.
- `noam-geometry-guides.js`: selects a construction and the current teaching step from independently verified worksheet facts plus the student's question and the associated answer.
- `noam-diagram-plan.js`: validates and compiles a general drawing plan against the source and current hint/request. The same validator is bundled into the private Wix planner.

The construction helpers adapt the ideas of the supplied `rectkit.py` to dependency-free browser JavaScript. They do not execute Python in a student's browser or install a language model.

## Verified local guide coverage

- Rhombus Q6, grade 9 topic G9-T19, current A and excellence worksheets: A/E/O/F/C positions, diagonal halves, subtraction, remaining segments, perpendicularity and the inner quadrilateral. A has three subparts, excellence has two.
- Triangle proof Q4, grade 9 topic G9-T15, current excellence worksheet: true angle-bisector and parallel-line construction, individual angles and hint-specific angle pairs.

The exact live PDFs were downloaded and visually compared with the manifests on 2026-09-20. Seven exercises have `geometrySource` and `geometrySourcePdfSha256`; their hashes match the enclosing manifest's `sourceSha256`. PDFs remain in Wix media.

## Scope and safeguards

- A worksheet ID alone never authorizes a local construction. Matching source facts are required, including the verified E/F order for Q6.
- The selected hint/question determines what is highlighted. Color alone does not assert equality. Goal, hypothetical and student-only claims do not authorize target equality marks.
- Clicking an older answer uses that answer's own preceding question, not a later turn.
- Saved local guides contain bounded context and are reconstructed against the current manifest. General AI visuals contain a bounded plan and source identity; their coordinates and marks are revalidated before rendering. Neither path accepts HTML, SVG markup or executable code from the model.
- Existing screenshot-only conversations can use the new drawing action without requesting the same hint again.
- The viewer requires a successfully rendered figure before storing or announcing a successful general demonstration. Unsupported or unrenderable plans produce a retry/explanation message. The original worksheet preview can remain visible separately; it is not substituted for a failed demonstration.

Verified local guides remain the free first choice. The new general fallback uses
`noam-diagram-plan.js` to compile an AI-produced JSON plan for straight-line
geometry, without any exercise-ID-specific resolver. It supports named points,
segments, highlights and angles; it is not a universal geometry theorem prover.
It checks recognized source relations and requires affirmative source evidence
for equality, right-angle and numeric marks. Goals and student assertions are not
evidence. Generated prose, SVG/HTML and executable code are forbidden.

A hint that refers only to vertex B can highlight B with a colored ring using
`pointHighlights`. It cannot thereby highlight the opposite side, choose incident
rays, or reveal a later proof step. An explicit student drawing request takes
precedence over the older hint's focus. When an angle label cannot fit legibly
inside its sector, the arc stays at its correct vertex and its exact name/value
appears in a compact color-matched legend. The renderer does not move the label
across a ray or discard the mathematical annotation.

The viewer calls `noamDiagramPlan` only on an explicit drawing request, with the
worksheet analysis and the exact clicked answer/student message. It deduplicates
requests, caches validated successes, preserves hint progress, and does not
replace an unsuccessful demonstration with the original scan. Cached plans are
scoped to the source PDF/version and revalidated before rendering.

## Deployment and cost bounds

Deployment checkpoint (2026-09-20): the protected Wix `noamDiagramPlan` route and
the general viewer integration have been published. The private planner uses
`qwen3.8-flash`, with thinking disabled and at most 1800 output tokens per call,
through the existing Wix Secrets and usage meter. No new provider, database
architecture or API credential is introduced.

There is one initial planner call. A rejected coordinate plan can receive one
bounded coordinate-only repair using the same model; there are at most two
planner calls, and both count toward the existing usage budget. Validation gates
remain active after repair. Rejection diagnostics can identify a bounded angle,
relation, shape or point-incidence constraint; they contain no raw source/student
prose and are not student-facing explanation text.

The server caches up to 40 successful plans for ten minutes and joins identical
in-flight requests, with at most 20 distinct requests pending. The browser keeps
up to 16 validated successful plans and can reuse a matching saved conversation
result. Failed plans are not cached. If the worksheet image has not yet been
analyzed, a separate existing image-analysis call precedes the planner; therefore
one drawing action is not guaranteed to mean only one total model call.

Backend implementation, source backups, the build script and server tests are in
the workspace's `work/diagram-ai/`.

## Verification checkpoint

Real model requests for a triangle and a square have passed. The triangle's
single-vertex hint also displayed only the requested vertex, without revealing
the opposite side. Final live verification of the rectangle, ray-focused drawing
and two-triangle drawing remains pending at this checkpoint. Do not describe
these as fully verified or infer support for every worksheet from passing local
tests. The general mechanism remains limited to its supported straight-line
geometry contract and source readability.

For verified local guides, verify the actual PDF and point order, add a
source-bound resolver and narrowly scoped stages, and test positive and
misleading/conflicting cases. Verify SVG appearance at a narrow width before
publishing. Do not expand local guide coverage by matching arbitrary chat text
or question numbers alone.

Checks: `node --test tests/*.test.cjs` and `node tools/validate.js index.html`.
