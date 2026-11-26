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
than 24, otherwise five), each tagged with its group and concept. A reply without
the reserves field still compiles, with no reserves. A reply that carries the field
must carry exactly the reserves the request asked for (`skill_authoring.split_reserves`:
the count, and in order each reserve's group and concept from `reserve_plan`, with no
other field); any other reserve list refuses the whole reply (`SOURCE_SHAPE`). Only in a reply
read question by question (`reply_salvage`) does an entry the reader could not decode count as a
refused reserve in its place. Mathematical
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
too: a refused rule is kept as written and asked for again in the one correction
call, also when no question is missing, unless that call is the notation-only fix.
The title is examined with it and is never asked for again: when the title is
refused, no returned rule is taken and that draft yields no sheet. A finished reply that is
not JSON as a whole is read question by question (`reply_salvage.py`); a question
that does not decode counts as refused.
`lesson_select.py` chooses the sheet: a bad question takes a reserve of its own group;
a practice reserve may stand in for a challenge only while two real challenges remain,
and is then printed as an ordinary question. It knows nothing about the wire format or
a topic. The unchanged whole-sheet validation runs on the chosen sheet.

The production worker repairs a version 3 job in this order, each step only when the one
before left a deficit (`remote_worker.author_and_render`, through `general_provider.Draft`):

1. reserve questions, with no model call;
2. ONE targeted correction call for the missing questions (at most eight) and a refused rule
   (the rule alone when no question is missing), each with the fixed instruction of its code
   and the exact field and substring that carries the fault; or, when unmarked mathematics is
   the only fault, the notation-only fix;
3. a shorter sheet: at least three quarters of the requested questions and never fewer than
   the grade minimum that every request must meet (8 / 12 / 14 / 20 for grades 1–2 / 3–4 /
   5–6 / 7–9; `lesson_select` takes no other floor), so only a sheet requested above that
   minimum is shortened; with at least two real challenges, and the printed count must be one
   the topic allows, as every request's is. The lesson of that sheet carries the rewritten
   count and the request travels beside it (`salvaged_from`); the result holds a
   `SHORTER_SHEET` note;
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

The reply is compiled exactly as the model wrote it; nothing rewrites it. A spelling
outside the contract's notation is refused, and a reserve or the one correction call
replaces the question; unmarked mathematics alone goes to the notation correction,
where the model inserts the marks and no word may change.

`general_source.py` checks closed shapes, size, volume, niqqud, allowed concepts
and expression bounds. `math_tasks.py` verifies typed arithmetic, symbolic
operations, bounded equations/systems, inequalities and descriptive statistics.
No model string is passed to eval, exec or a symbolic expression parser.
Computed answers are derived from the typed task. The task is printed after
a prompt only when the prompt carries no numbers of its own and is a bare
instruction or question, and never when the print would be the answer. A bare
instruction is one clause whose every word is on a closed list of words about
the exercise itself ("חשבו.", "מה הסכום?", "פתרו את המשוואה.",
`printed_parts.bare_instruction`); after any other prompt (a story, also in one
sentence), an intro with numbers, a table (also beside a row whose result is
blank) or a figure the item is refused instead (`PRINTED_TASK_MISMATCH`). A task
printed from its tree whose minus stands before anything but a number (`-2^4`,
`-x + 3`) is refused: the tree would print it as `0 − 2^4`, with a zero the task
never wrote (`printed_parts.refuse_unwritten_zero`, `SOURCE_NOTATION`).
`printed_parts.py` and the other `printed_*` binders
tie the key to an exercise that the prompt already shows. A prompt with several
blanks gets one answer for each blank, or the question is refused. In grades 1–6
a computed item that prints a blank is keyed only when a binder of a closed list
recomputes its key from the print (place value, quotient and remainder,
sequence, two units, the missing number in one complete formula, the comparison
sign, the decided statement), also with the right typed key: a word problem
with a blank, a one-unit conversion written with words and a blank in the intro
are refused (`printed_parts.refuse_unsolved_equation`, `PRINTED_TASK_MISMATCH`).
What may print outside the islands in grades 1–6 is closed as well: Hebrew
words, punctuation, a number on its own, the blank `___` and a sign listed as an
option or used as punctuation. A calculation, a relation sign beside an
operand (also `=` between marked numbers and a blank), a colon after a number
or a blank, a Latin letter, any other blank (`__`, `⬜`, `( )`, `?`) and any
other numeral or symbol there is refused for its notation
(`compact_authoring.sentence_math`, `SOURCE_NOTATION`). In every grade a
one-letter angle (`∠A`, `∡A`, the word זווית or זוית before one letter) and a
percent sign apart from its number (`[[25]]%`, `٪`, `％`, a bidi mark between)
are refused. These refusals read a string field, a provider span array as the
line it prints, and the sheet title, with invisible marks read through
(`compact_authoring.refuse_notation`; LESSON-SKILL.md section 3). The old path
still cannot prove that a word problem's key answers what its prose asks: a
computed item without a blank keeps its typed key, and the request readers
below only refuse the kinds of request that no typed task keys, in the forms
they list. Only worksheet-wire/5 removes that gap, because there code writes the
question from its typed task.

Beside a table (old path) an item that names a row is keyed only when its
typed task is exactly that row's printed expression
(`printed_tasks.table_row_task`, an allowlist): the row is named by an ordinal
("בשורה השנייה"), "השורה האחרונה" or a row number ("שורה [[2]]") in the item or
else in its intro, and that row prints exactly one closed expression or
number. A mention of a row in any other form ("בכל שורה", "השורה הבאה", two
rows) is refused. In grades 1–6 every computed item beside a table must name its
row so: one that names no row, a row named by its label, a total of a column or
any other calculation on the table's numbers is refused (`PRINTED_TASK_MISMATCH`),
also with the right typed key. The role-named rows of
`printed_tasks.printed_table_row` and the local fraction author's table keep
their own binders. In grades 7–9 an item beside a table that names no row is
not refused by this check and its key is not proven against the table: the
reviewed fixture grade7-equation-skill asks for a table's values that way, and
the v4 golden pins it as compiling, so refusing it needs the owner's decision.

A yes/no or true/false question carries a typed claim (task kind `decide`: an
order or equality of two expressions, divisibility, membership in a short
list), and any other typed task for it is refused. The kernel decides it; no
field holds an authored yes or no. What a question asks for is read from its
intro and its item prompt together, clause by clause, whatever the verb
(`printed_tasks.requested`, `PRINTED_ANSWER_KIND`): a yes/no or true/false
question takes only a decision (an item with a blank of its own in its
mathematics is not asked the intro's yes/no, nor beside a printed relation the
intro's sign; a blank in the words after a complete printed relation is where
the verdict goes); "whether" ("בדקו אם [[32 : 4 = 8]].", "[[32 : 4 = 8]],
נכון?") takes a decision, and a comparison sign answers it only when no relation
is printed and the relation is asked in words ("בדקו אם השברים שווים."). A
true/false word anywhere ("הקיפו את התרגילים הנכונים", "סמנו ✓ ליד כל תרגיל
נכון", "ציינו אם הוא נכון") or "כן או לא" asks for a decision, unless the word
is one of the readings on a closed list that ask for a number (it describes a
quantity or the order of operations: "התוצאה הנכונה", "האחוז הנכון", "סדר
הפעולות הנכון"; it belongs to what a quantity is of; it says how someone
answered ("ענה נכון") or what a calculation checks ("שבודק את נכונות"); or it
follows "כך ש", "כדי ש" or "כדי ל"). A comparison sign is never the key of an
item that prints a complete relation ("[[32 : 4 = 9]]"), whatever its words
ask. A comparison sign ("השלימו את הסימן", a relation sign in the words, or a
yes/no question that offers "קטן או גדול") takes only a `compare` task; an
order ("סדרו", "דרגו", "בסדר עולה", "מהקטן לגדול", "מהקטן ביותר לגדול ביותר",
"מהגדול אל הקטן", "מן הקטן עד הגדול") takes only a list. A ratio or a map scale
("יחס", "קנה המידה"), a time of day, who, or which thing other than a number is
never keyed, by a number or by a comparison sign: the kernel has no ratio, clock
time or name to print. A sign, a ratio, who or which is asked for in a clause
that is a question, holds a blank or tells the pupil to write, state, find,
complete, reduce or calculate it (a closed list of verbs); who also by
"מיהו/מיהי/מיהם/מיהן" anywhere, by "מי" opening its clause (not "מי ש..." or
a name in a list) and by a request for a name ("את שם", "שמו של", "מה שם"); a
time of day by "איזו שעה", by "מתי" in a question or beside a blank (and, in a
question that names hours or minutes, also as a request or opening its clause
without a question mark), by השעה, שעת or a clock in a question, beside a blank or in an
instruction that states no number, by a blank after "בשעה", and, in a question
that names an hour or a part of the day, by a blank after "ב־", "ל־" or "עד"
that ends its clause. A ratio is data only when its word is followed by its
value ("ביחס [[2:3]]", "היחס הנתון", "היחס ... הוא [[2:3]]"); a printed
proportion with one missing term (`[[2 : 3 = ___ : 12]]`) keys that term. A
request for a time of day, a name, an order or a ratio in a form these readers
do not list is not refused by them.
`answer_kinds.py` ties the claim to the printed question, by the one printed
statement whose correctness is asked about or by the relation word, its order
and the printed quantities, and refuses a true claim that is not that
question. The key prints the verdict with its exact calculation. A number is
never the key of a drawing. Grades 1–6 print no answer without a proven key:
a verdict whose claim was typed from a story is refused, the schema offers no
answer kind without a computed key (no `label`, `open` or `review`), and the
adapter refuses any unverified answer (`UNVERIFIED_ANSWERS`). In middle
school, authored prose answers (`review`) and verdicts whose claim was typed
from a story are listed as `unverifiedAnswers` (`question`, `item`, `kind`)
in the adapter result and in `general-evidence.json`. `runner.render_job`
copies the positions and kinds to `manifest.unverifiedAnswers`, and the worker
result carries them as `teacherNotes`: one entry per kind with a fixed Hebrew
sentence (`gate_policy.UNVERIFIED_NOTES`) and the question and item numbers.
Evidence that is present but unreadable, or that lists an elementary answer,
fails the render before anything is built. The worker checks the manifest
again before anything is uploaded (`remote_worker.general_verdict`): a missing
list or one it cannot read, or any listed answer on an elementary sheet,
refuses the sheet.
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
  the pinned truth gates G32/G33 search for (`claim_lint`). It records nothing
  in the ledger, so the gates judge every listed word: a per-unit "לכל" or a
  conditional "אילו" is refused in the pre-pass and the question is replaced,
  like a universal claim or a request to enumerate. One exception: the adapter
  records the measured figure of an elementary question in the ledger under the
  bare question number (`figure_assert`), and the locked G32/G33 accept that id
  for every listed word of the question. In a question with a figure, a benign
  reading that `claim_lint` does not name is therefore printed, not judged; a
  claim is still named by `claim_lint` and the question replaced.
- `runner.precheck_job` builds `content.json` and runs only the content-truth
  and house gates that read it, before any PDF or Word file exists.
- A narrowly verified middle-skill didactic REVIEW may produce a private draft
  with `automatedChecksPassed: false`, `renderingChecksPassed: true` and explicit
  review findings. `didactic_review.py` reconciles only the pinned driver's
  documented REVIEW-only exit discrepancy, checks every other gate and output
  hash, and reruns the pinned checker. It never converts a FAIL finding to
  REVIEW. This is the only REVIEW the worker accepts: `middle-build` with reason
  `PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY`, followed by
  `didactic-review-reconciliation` PASS, on a middle-school lesson, whose
  review rows are its `DIDACTIC_REVIEW` rows of `middle-build` and nothing
  else; every other REVIEW is refused. The worker accepts by allowlist
  (`remote_worker.general_verdict`): a render whose steps all passed is
  delivered only with `reviewFindings == []`, any review row that
  `gate_policy.blocks` blocks (or a G51 row of any class, or a row of another
  step) refuses the sheet instead of being dropped, and a manifest that names
  another skill than the lesson's is refused. A render that fails after the
  reconciliation (a missing PDF or Word file) puts the step back to FAIL,
  keeps no review note, and lists that step in `gate.blocking` with every other
  failed step.
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
network or secrets: three legacy fixtures, twelve general fixtures (nine must
deliver; grade-2 niqqud, grade-4 fractions and grade-4 calculation must be
refused exactly as recorded, see `cloud/container/README.md`), real raster OCR,
and the existing Chromium fallback. Fixture coverage is not
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
