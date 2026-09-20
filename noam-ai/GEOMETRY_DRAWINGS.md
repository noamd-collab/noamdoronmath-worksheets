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

The latest private planner enumerates permitted directed ray names. A narrow
normalization may remove an unsupported arrowhead only when its base segment
already exists, and accepts the result only after complete contract revalidation.
It does not add a model call, segment, point, or mathematical fact. The planner
also resolves angle pronouns against the current hint and asks for the permitted
angle arcs; coloring only a transversal is insufficient for an angle-location
request. A bounded frontend review catches the observed explicit contradiction
of a source-parallel line being called a transversal, using the existing single
repair path. It is not a general proof checker.

Recognized Hebrew and English statements that a point lies on an extension
beyond a named endpoint become `pointOnExtension` constraints. A deterministic
repair may correct coordinates only, then must pass the complete contract again.
It cannot change labels, givens, marks or focus and does not add an AI call. Tests
now include the actual Q24 English source with and without “side” before BA.
The live v9 saved-plan suppression check passes; its retry failed with
`outside_current_focus`. The final v10 retry and reload both passed. Coverage is limited to the
recognized source forms, not all possible wording.

The server caches up to 40 successful plans for ten minutes and joins identical
in-flight requests, with at most 20 distinct requests pending. The browser keeps
up to 16 validated successful plans and can reuse a matching saved conversation
result. Failed plans are not cached. If the worksheet image has not yet been
analyzed, a separate existing image-analysis call precedes the planner; therefore
one drawing action is not guaranteed to mean only one total model call.

Backend implementation, source backups, the build script and server tests are in
the workspace's `work/diagram-ai/`.

## Verification checkpoint

2026-09-20: frontend `21e871f3876411af374914b20ddfd99426dedd87`
was published with script version `20260920-10`; Pages `35527663952` succeeded. Prior
frontend `415d905` / run `35527319123` succeeded.
Diagnostic deployment `39b2087` / `35527091239` and preceding `26f3b9d` /
`35526761229` succeeded. The latest Wix planner read back exactly as 52,346
characters (FNV-1a `3233995830`), then synced and published with Studio confirmation. The main
solver was not edited. Temporary opt-in diagnostics are removed, with no normal raw-question
console logging. Automated checks passed 288 frontend and 46 backend tests.
Only the latest continuity-document edits await their commit.
Catalog validation covered 959 catalog PDF IDs; it did not open or visually
inspect 959 PDFs.

The original live G9-T15 excellence Q24 named-angle retry returned a constructed
SVG with colored EAD and DAC arcs, persisted after reload, and contained 0
transcript image elements. The newest natural-request figure was correct live: the
hint identified alternating angles formed by transversal AC and parallel lines
AD and BC, and “כן אתה יכול לסמן לי אותן כי אני לא בטוח שאני מבין.” produced
DAC marked orange and ACB marked blue. Full visual inspection verified E beyond
A on BA, AD∥BC and AB=AC; the transcript image count was 0. This does not prove
that the deterministic extension repair ran. Earlier attempts highlighting only
AC, or placing E on AC, failed visual QA. On the earlier v8 reload, the
older incorrect E-on-AC figure still rendered alongside the newest correct figure.
Opt-in diagnosis confirmed the source was English: “Point E lies on the extension
of BA beyond A.” and its “extension of side BA” variant. The earlier validator
only recognized Hebrew. Those exact forms now pass regression tests, including
the backend repair path. Live reload with v9 removed the old invalid figure (SVG count 2 → 1), preserved
the correct newer figure, exposed its retry, and contained 0 transcript images.
The v9 retry then failed `outside_current_focus`; it did not produce a successful
replacement. The published correction can correct only a wrong name-only arc choice
when the allowed pair is uniquely derived from the parallel lines and transversal.
Narrower requests for one angle must not be expanded, including Hebrew and
lowercase forms. This adds no model call. The final published v10 actual retry passed: DAC and ACB named arcs were
visible in a complete SVG above the composer, with E correctly beyond A on BA,
AB=AC and AD∥BC. Both current figures are correct; the old bad figure was replaced
and transcript images remained 0. Final v10 reload also passed: script `20260920-10` was verified in the DOM,
both correct SVGs and their coordinates persisted, transcript images were 0,
and no retry button appeared. This reproduced Q24 case is complete; no universal
worksheet-coverage claim follows.

Prior live checks recorded on 2026-09-20: G9-T18-A-Q02א displayed a constructed
rectangle with AC, BD and O after the retry, without repeating the worksheet crop
or adding a solution; G7-T15 displayed a constructed angle/ray drawing on desktop
and mobile, and its conversation survived reload. Earlier real model requests
for a triangle and square also passed; the single-vertex triangle hint showed
only its requested vertex. These prior checks are not fresh tests of the latest
publication. The two-triangle case remains unverified live. Do not infer support
for every worksheet from these checks: the general mechanism remains limited to
its supported straight-line geometry contract and source readability.

For verified local guides, verify the actual PDF and point order, add a
source-bound resolver and narrowly scoped stages, and test positive and
misleading/conflicting cases. Verify SVG appearance at a narrow width before
publishing. Do not expand local guide coverage by matching arbitrary chat text
or question numbers alone.

Checks: `node --test tests/*.test.cjs` and `node tools/validate.js index.html`.
