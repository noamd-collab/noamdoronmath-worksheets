# Private skill worksheet generation

The owner-only generator uses the installed, hash-pinned Hebrew worksheet
skills to create private PDF and editable Word drafts in Cloudflare. Ordinary
teacher tools remain available to any verified Google teacher. New generation
and its output objects remain restricted to the configured owner; this change
does not grant other teachers access.

## Curriculum and authoring

The intake-v3 catalog contains 232 topics: 160 elementary topics in grades 1–6
and 72 middle-school topics in grades 7–9, including both grade-9 tracks. The
catalog fingerprint is
`57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b`.
The UI asks for grade, topic, level, selected taught concepts and the actual
stopping point. Punctuation-equivalent labels share one visible choice while
all underlying concept IDs are preserved. Earlier curriculum eligibility is
not proof of student mastery. Calendar alignment is not independently verified.

`authoring_context.py` reads the actual pinned skill documents, curriculum,
tool eligibility and glossary. `general_provider.py` sends the selected scope
to the configured Qwen authoring model. It makes one bounded authoring attempt;
validation failure never triggers an automatic billed retry. The model is not
a reviewer and cannot assert approval.

The general author returns source-v4 declarative JSON. The provider boundary
wraps single typed spans and unambiguous Hebrew prose in span arrays before
the canonical validator checks every field. It preserves mathematical ASTs.

Basic grade-two practice for the single concept ב05#1 also offers a compact
parameter contract for 8–12 questions. The author selects operands and settings
within a no-regrouping plan. The compiler constructs vocalized problems and
checks each actual operand pair. Custom teacher constraints can use full
source-v4 in the same authoring call. Other scopes use full source-v4 directly.

`general_source.py` checks closed shapes, size, volume, niqqud, allowed concepts
and expression bounds. `math_tasks.py` verifies typed arithmetic, symbolic
operations, bounded equations/systems, inequalities and descriptive statistics.
No model string is passed to eval, exec or a symbolic expression parser.
Computed answers are derived from the same typed task printed in the question.
Prose, reasoning and pedagogical correspondence still require human review.

`general_adapters.py` compiles only trusted templates. Typed figures are
restricted to geometry and analytic geometry.
Measurement figures print their givens; read-off figures do not reveal the
answer. All plain text is escaped. No model-selected file, URL, shell command,
Python program, SVG or approval flag is accepted.

## Availability and results

The worker advertises `general-skill-source/v1`, the exact curriculum hash,
accepted intake versions and per-topic levels/counts. The UI can plan all topics,
but enqueue is enabled only when the live worker advertises the exact compatible
profile. Topic availability means private draft authoring is implemented; it
does not mean every possible worksheet in that topic has been visually or
pedagogically approved. The old two-pilot intake-v2 route retains its separate
limits and evidence; see [the legacy contract](legacy-pilot.md).

`runner.render_job(lesson, source, empty_directory, skill_paths=...)` performs
no network, provider or queue operations. It verifies elementary 1.0.5-noam or
middle 7.2.0-noam (engine 6.18) against `skill-lock.json`, then invokes the fixed
compiler and native skill gates. Each job uses an isolated directory.

A result is always `needs_review` or `failed`, never publication approval:

- All PASS steps and both exact output files produce `automatedChecksPassed`.
- A genuine FAIL exposes no downloadable artifacts.
- A narrowly verified middle-skill didactic REVIEW may produce a private draft
  with `automatedChecksPassed: false`, `renderingChecksPassed: true` and explicit
  review findings. `didactic_review.py` reconciles only the pinned driver's
  documented REVIEW-only exit discrepancy, checks every other gate and output
  hash, and reruns the pinned checker. It never converts FAIL to REVIEW.
- API, UI and private-storage RLS use equivalent readiness rules. Only exact
  owner PDF/DOCX paths can be downloaded; source, logs and keys remain private.

The middle adapter currently builds broad worksheets via `LEVELS`, not `SHEET`.
Section-specific G85–G89/G92 and catalog/landing steps therefore report legacy
SKIP, never PASS. The output remains a private draft; it does not publish topic
landing pages or certify the skill's draft official-source subtopic registry.
The old grade-7-specific Word-web postprocessor is not applied to general
worksheets. Native editable Word and RTL/parity checks apply; actual Word
pagination still needs visual inspection.

## Tests and deployment

```sh
python3 -m unittest discover -s tools/teacher-generation/tests
python3 -m unittest discover -s tools/release/tests -p 'test_teacher_cloudflare_*.py'
python3 tools/teacher-generation/cloud/container/test_packaging.py
```

The hash-pinned Linux image includes SymPy/mpmath, fonts, Chromium, Poppler and
a fixed Tesseract OCR bridge. The cloud qualification workflow runs without
network or secrets: three legacy fixtures, four general fixtures (grade-2
niqqud, grade-4 fractions, grade-9 quadratic equations and triangles in the coordinate plane), real
raster OCR, and the existing Chromium fallback. Fixture coverage is not
232-topic pedagogical certification. Inspect the generated PDFs and Word files.

Production runs in Cloudflare. A Mac development command is not a backup
worker and must not claim the live queue. Preserve the owner's reserved trial
when running offline or isolated authoring development checks.

Deploy only through `tools/release/release.sh`, with the exact reviewed source,
qualified image and explicit release approval. The upgrade controller drains
and verifies the existing singleton, preserves its identity, checks fresh job
and quota fingerprints, and activates only the exact qualified image. See
[the cloud release guide](../../docs/teacher-cloudflare-release.md).
The private REVIEW-download migration must be reviewed and applied separately.
The website, cloud image and migration form one coordinated release package.
