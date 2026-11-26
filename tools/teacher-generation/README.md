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

The general author supplies a title, one rule, two groups of questions and a few
reserve questions (three beside fewer than 16 planned questions, four beside fewer
than 24, otherwise five), each tagged with its group and concept. Reserves are
optional on arrival: a reply without them still compiles. Mathematical
tasks are parsed into bounded, verified expressions. Printed literals preserve significant
decimal zeros, thousands separators, and percent signs. A completed source-v4 document
remains a supported input. Basic grade-two no-regrouping addition also accepts its existing
compact parameter format. Every output goes through the same applicable skill gates.

Every question is examined alone by one predicate, `skill_authoring.question_codes`:
it is expanded and validated by itself (notation, typed task, printed-key binders,
answer kinds) and, in elementary school, read for the claim words of the truth gates.
Any code it raises (a notation fault, a printed-key refusal, a kernel limit such as a
power beyond the bound) makes it a bad question to replace, never a failed sheet.
In middle school its figure is also drawn with the pinned constructors
(`figure_probe.py`), so a figure the skill refuses is a refused question
(`SOURCE_FIGURE`) and not an unnamed render failure. The rule is examined alone
too: a refused rule loses each sentence that is refused on its own, or is asked for
again in the one correction call. A finished reply that is not JSON as a whole is
read question by question (`reply_salvage.py`); a question that does not decode
counts as refused.
`lesson_select.py` chooses the sheet: a bad question takes a reserve of its own group;
a practice reserve may stand in for a challenge only while two real challenges remain,
and is then printed as an ordinary question. It knows nothing about the wire format or
a topic. The unchanged whole-sheet validation runs on the chosen sheet.

The production worker repairs a version 3 job in this order, each step only when the one
before left a deficit (`remote_worker.author_and_render`, through `general_provider.Draft`):

1. reserve questions, with no model call;
2. ONE targeted correction call for the missing questions only (at most eight), each with
   the fixed instruction of its code and the exact field and substring that carries the fault;
3. a shorter sheet: at least three quarters of the requested questions, never fewer than six,
   with at least two real challenges. The lesson of that sheet carries the rewritten count
   and the request travels beside it (`salvaged_from`); the result holds a `SHORTER_SHEET` note;
4. ONE second full author call, when the first reply is unusable as a whole (not JSON, wrong
   shape, plan mismatch) or the steps above ended without a sheet.

Before the PDF and Word steps the worker runs `runner.precheck_job` and replaces the questions
it names (at most two rounds). After a render it follows `manifest.gate`: `deliver` is a
`needs_review` sheet with its notes; `replace` swaps the named questions and renders once more
in a fresh folder; `fail` goes to step 4. Hard limits per job: two author calls, two correction
calls, and no model call starts later than 150 seconds after the claim. A call that got no
answer from the provider closes the job to further calls. The lease is confirmed before every
model call and every render. A delivered result carries `salvage` (attempts, corrections,
replaced questions by code, dropped questions, the gate decision), `reviewFindings`,
`teacherNotes` and `unverifiedAnswers` (a count by kind). A failed job stores its code only;
the worker logs one `generation_failed` line with the code, the stage, the question and the gate.

`lessonGoal: "introduce"` is accepted for version 3 lessons that the general author writes: the
request states that this is an opening sheet and the plan marks its first questions as guided
entry questions. Each local author keeps its own eligibility rule; `assessment` stays unsupported.

`source_normalize.py` runs once on the reply when it arrives
(`general_provider.author_general_lesson`), so the compile, the notation correction
and the per-question predicate read the same text, and again inside `expand_source`,
where it is a no-op on text that is already normal. It rewrites spellings that
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
`general-evidence.json`. `runner.render_job` copies the positions and kinds to
`manifest.unverifiedAnswers`, and the worker result carries them as
`teacherNotes`: one entry per kind with a fixed Hebrew sentence
(`gate_policy.UNVERIFIED_NOTES`) and the question and item numbers. Evidence
that is present but unreadable fails the render before anything is built.
Authored prose answers (`review`) remain middle-school only.
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
  page fill) block in the same way. An unknown line, a timeout or a crashed
  step blocks.
  `skill_feedback.gate_report` reads every finding of a work folder. When the
  trusted adapter refuses a question it leaves `adapter-failure.json`
  (`code`, `question`, `item`), and the report names that question from it.
- The pinned bracket gate G51 is never measured again. It names no question,
  so a G51 finding fails the sheet, also on a correctly printed product of two
  bracketed groups (a known false refusal, accepted).
- `claim_words.py` names, before rendering, the claims among the words that
  the pinned truth gates G32/G33 search for (`claim_lint`). Nothing is
  recorded in the ledger, so the gates judge every listed word: a per-unit
  "לכל" or a conditional "אילו" is refused in the pre-pass and the question is
  replaced, like a universal claim or a request to enumerate.
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
