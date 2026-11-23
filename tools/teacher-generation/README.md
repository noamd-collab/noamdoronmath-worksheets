# Private skill worksheet generation

The generator uses the installed, hash-pinned Hebrew worksheet skills to create
private PDF and editable Word drafts in Cloudflare. A verified Google teacher
can generate up to five worksheets across all supported grades and topics
during the shared 72-hour trial window. The permanent owner has an unlimited quota. Each teacher's
history and private downloads are bound to that teacher's account.

## Curriculum and authoring

The intake-v3 catalog contains 232 topics: 160 elementary topics in grades 1–6
and 72 middle-school topics in grades 7–9, including both grade-9 tracks. The
catalog fingerprint is
`57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b`.
The UI asks for grade, topic, level, selected taught concepts and the actual
stopping point. Punctuation-equivalent labels share one visible choice while
all underlying concept IDs are preserved. Earlier curriculum eligibility is
not proof of student mastery. Calendar alignment is not independently verified.

Every intake-v3 request resolves the selected grade, track and taught concepts against the
same pinned worksheet skill before authoring. Exact previously qualified practice plans
can compile locally. For other selections the skill supplies the teaching rules, the
chronology and the stopping point to the general author. The compiler assigns selected
concepts to practice and challenge slots, owns their numbering and creates the versioned
source. Adding a subject from the curriculum does not require a subject-specific author.

The general author supplies a title, one rule and two groups of questions. Mathematical
tasks are parsed into bounded, verified expressions. Printed literals preserve significant
decimal zeros, thousands separators, and percent signs. A completed source-v4 document
remains a supported input. Basic grade-two no-regrouping addition also accepts its existing
compact parameter format. Every output goes through the same applicable skill gates.

The production worker can request one targeted revision for up to six questions when the skill identifies their
locations and the job still owns its lease. The second provider call has a separate usage
record. Both outputs are rebuilt in a fresh directory and rechecked before any upload.
An infrastructure failure or an unlocalized report does not trigger a correction.

`source_normalize.py` runs first, inside `expand_source`. It rewrites spellings that
have exactly one reading into the contract's notation (an unspaced school operator,
`$...$` math, a letter for the single missing number of an elementary formula, a label
after the Hebrew noun that names it). It never computes and never chooses between two
readings; such a spelling is left for validation to reject. Its module docstring lists every rule.

`general_source.py` checks closed shapes, size, volume, niqqud, allowed concepts
and expression bounds. `math_tasks.py` verifies typed arithmetic, symbolic
operations, bounded equations/systems, inequalities and descriptive statistics.
No model string is passed to eval, exec or a symbolic expression parser.
Computed answers are derived from the typed task. The task is printed after
a prompt only when the prompt carries no numbers of its own, and never when the
print would be the answer; `printed_parts.py` and the other `printed_*` binders
tie the key to an exercise that the prompt already shows. A prompt with several
blanks gets one answer for each blank, or the question is refused.

A yes/no or true/false question carries a typed claim (task kind `decide`: an
order or equality of two expressions, divisibility, membership in a short
list). The kernel decides it; no field holds an authored yes or no.
`answer_kinds.py` ties the claim to the printed question, by the one printed
statement whose correctness is asked about or by the relation word, its order
and the printed quantities, and refuses a true claim that is not that
question. The key prints the verdict with its exact calculation. Grades 1–6
also have a `label` answer (a short Hebrew name, only for a prompt that asks
for a name; printed as authored) and an `open` answer (a drawing, a
construction, an explanation; the key says that the teacher checks it). A
number is never the key of a drawing. Labels, open items and verdicts whose
claim was typed from a story are listed as `unverifiedAnswers`
(`question`, `item`, `kind`) in the adapter result and in
`general-evidence.json`, for a teacher note. Authored prose answers (`review`)
remain middle-school only.
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
- A blocking failure exposes no downloadable artifacts.
- Version 3 lessons follow one delivery policy (`gate_policy.py`). Every gate
  outcome has a class. Truth findings (the mathematics, the key or its print
  form) and policy findings (chronology, drawings, signs, brand) block; when
  the gate output names questions, `manifest.gate.questions` lists them.
  Editorial findings (difficulty spread, repeated item structure, star count,
  page fill) do not block: the step is recorded as REVIEW and
  `reviewFindings` carries the code, the questions and a fixed Hebrew teacher
  note. An unknown line, a timeout or a crashed step blocks.
  `skill_feedback.gate_report` reads every finding of a work folder.
- `paren_order.py` measures again the one documented false positive of the
  pinned bracket gate G51 (a correctly printed product of two bracketed
  groups). A reversed pair still fails.
- `claim_words.py` records in the ledger a closed-pattern reading of the words
  that the pinned truth gates G32/G33 search for ("לכל תלמיד", conditional
  "אילו"). Universal claims and requests to enumerate still fail.
- `runner.precheck_job` builds `content.json` and runs only the content-truth
  and house gates that read it, before any PDF or Word file exists.
- A narrowly verified middle-skill didactic REVIEW may produce a private draft
  with `automatedChecksPassed: false`, `renderingChecksPassed: true` and explicit
  review findings. `didactic_review.py` reconciles only the pinned driver's
  documented REVIEW-only exit discrepancy, checks every other gate and output
  hash, and reruns the pinned checker. It never converts a FAIL finding to
  REVIEW.
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
