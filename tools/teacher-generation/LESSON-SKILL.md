# The lesson skill

The lesson skill is the part of the teacher generator that turns one teacher
request on <https://www.noamdoronmath.co.il/teachers/generate> ("create a
worksheet for a lesson": grade, topic, level, taught concepts, stopping point,
question count, minutes, lesson goal) into a checked PDF and an editable Word
file, or into a failure with a fixed code. It is code, not a prompt: the model
writes declarative content, and everything that decides what is printed is in
this folder.

This document describes the code on branch `claude/teacher-lesson-skill-20261123`
at `a50bcb91`. All paths are relative to `tools/teacher-generation/` unless they
start with `tools/` or `.github/`. Citations are `file:function`.

**Status.** Not deployed. Production still runs worker commit `8ea258a8`, which
fails a whole sheet on one notation fault. Nothing in this document is live
until the release path at the end has run.

---

## 1. Where it sits

```
teacher form (site) ──► job row (Supabase) ──► worker (Cloudflare container)
                                                  │
              remote_worker.process_job ──────────┤
              remote_worker.author_and_render     │  the repair ladder (section 6)
                     │                            │
   provider.author_lesson ── local author? ──► fraction_lesson, counting_lesson,
                     │                          division_facts, pythagoras_lesson,
                     │                          square_lesson, triangle_lesson (no model call)
                     ▼
   general_provider.author_general_lesson   ◄── THE LESSON SKILL (model call,
                     │                            per-question predicate, reserves, Draft)
                     ▼
   runner.precheck_job / runner.render_job  ◄── trusted adapter + the locked skills' own
                     │                            build scripts and gates, then gate_policy
                     ▼
   manifest ──► remote_worker.process_job ──► job result: PDF, DOCX, notes
```

**The locked skills.** Two worksheet skills are pinned by hash in
`skill-lock.json` and shipped as archives in `cloud/container/skills/`:

| Skill | Version | Grades |
|---|---|---|
| `hebrew-math-worksheet-elementary` | 1.0.5-noam | 1–6 (א׳–ו׳) |
| `hebrew-math-worksheet` (middle) | 7.2.0-noam | 7–9, both grade-9 tracks |

The lesson skill never edits them. It uses them three ways:

1. **As the author's rules.** `authoring_context.build_authoring_context` reads
   the skill documents listed in `authoring_context.DOCUMENTS`;
   `general_provider.author_guidance` keeps the ones in `AUTHOR_REFERENCES` and
   the topic's didactic principles, and sends them as `authoringContext`.
2. **As the printer.** `general_adapters.compile_source` turns validated source
   into the skill's own input (`_compile_elementary` writes `content.json`,
   `_compile_middle` writes a package), using only trusted templates.
3. **As the gates.** `runner.render_job` verifies the pin (`runner.verify_skill`)
   and runs the skill's own scripts: `build_pdf.py`, `build_docx.py`,
   `check_worksheet.py` (elementary) or `build_v72.py` (middle), plus this
   engine's `output_gates.py`, content-truth and house gates.

Topics come from `generation-curriculum.json` (232 topics: 160 elementary, 72
middle; hash `runtime_catalog.CURRICULUM_SHA256`), a projection of the two
skills' registries made by `export_curriculum.py`. A request is resolved to a
scope by `curriculum_scope.validate_curriculum_scope`.

---

## 2. The authoring contract (what the model receives)

### 2.1 Request

Built in `general_provider.author_general_lesson`.

- **System text:** the fixed contract sentences in that function, plus
  `answer_kinds.DECISION_GUIDE`, and for grades 1–6 the claim-word bans of the truth
  gates (no `תמיד`, `לעולם`, and no `לכל` in any sense…), or for grades 7–9 the `solve`/`review`
  block. Conditional blocks: reserves; `lessonGoal: "introduce"` (guided entry
  questions first, a rule with one worked example); a time budget of 1.8
  minutes or less per question (exactly `minimumItems` short items); a
  non-geometry topic ("text-and-math lesson", no drawing); middle-school
  geometry representations.
- **User JSON:** `authoringContext`, `questionPlan`
  (`skill_authoring.question_plan`: number, group, conceptIds, minimumItems,
  `role: guided_entry`, `representation` for middle geometry, and an `activity`
  from a fixed rotation), `reservePlan` (`skill_authoring.reserve_plan`),
  `teacherStoppingPoint`, `selectedConcepts`, `finalContractReminder`,
  `sourceSchema` (`skill_authoring.worksheet_schema`).
- **Format:** Qwen gets `response_format: json_schema` (strict),
  `enable_thinking: false`, temperature 0.25, `max_tokens` 40000. Gemini cannot
  take the strict schema, so `provider.author_body` rewrites the body to
  `response_format: json_object`, `reasoning_effort: low`, appends
  `provider.GEMINI_REPLY_RULE` to the system text and adds `replyExample`.
  Local validation is the only authority either way.

### 2.2 Reply (wire format v1)

```
{ "title": str,
  "rule": rich,
  "practice":   [Q × (questionCount − 3)],
  "challenges": [Q × 3],
  "reserves":   [{"group": "practice"|"challenges", "conceptId": id, "question": Q} × 3|4|5] }
Q    = {"intro": rich, "items": [{"prompt": rich, "answer": A}, ...], "table"?, "figure"?, "drawingFromWords"?}
```

- Items per question: 5–9 in grades 1–2, 3–9 otherwise
  (`general_source.validate_question`).
- No `star` and no numbering: the compiler owns both
  (`skill_authoring.bind_content`, `general_provider.assemble_sections`).
- Reserves: 3 beside fewer than 16 planned questions, 4 beside fewer than 24,
  else 5; the last one is a challenge (`lesson_select.reserve_groups`), each
  written for the concept `reserve_plan` names. A reply without the `reserves`
  field has no reserves. A reply that carries it must carry exactly that plan,
  in order: the count, each entry's `group` and `conceptId`, a question object
  and no other field. Anything else (more or fewer entries, the alias
  `"challenge"`, another order or concept, an entry that is not an object)
  refuses the whole reply with `SOURCE_SHAPE` (`skill_authoring.split_reserves`);
  no entry is dropped and the rest kept. The one exception is a reply that was
  not JSON as a whole and was read question by question (`reply_salvage`): an
  entry the reader could not decode counts as a refused reserve in its place,
  as a lost planned question counts as a refused question; the count and every
  decoded entry must still be the plan's.

### 2.3 Notation

- **Rich fields** are Hebrew prose. Every number or compound formula goes in
  `[[...]]`, one parseable number, expression or relation per island; words,
  units and punctuation stay outside. No HTML, LaTeX, `$`, `\` or links
  (`general_source.MARKUP`).
- **Elementary:** every product with its sign; a missing number is `___`
  inside one complete formula (`[[24 / ___ = 6]]`), never a letter. Outside the
  islands only Hebrew words, punctuation, a number on its own and a blank that a
  binder fills (section 3).
- **Middle:** letters `x y a b`, `sqrt(...)`, `pi`, schoolbook implicit products
  (`3(x+2)`, `2ab`), typed names `[[point:A]]`, `[[segment:AB]]`,
  `[[angle:ABC]]`, `[[triangle:ABC]]`, `[[polygon:ABCD]]`, coordinates `[[A(2,3)]]`.
- **Task fields** are compact infix strings (`compact_authoring.wire_schema`:
  `^[0-9a-z+*/^(),.:% -]+$`, at most 220 characters): numbers, `frac(1,4)`,
  `+ - * / ^`, parentheses; exponents up to 12 (`math_tasks.MAX_POWER`);
  `lcm(6,8)`/`gcd(6,8)` from grade 4 (`compact_authoring.expand_task`).
- Niqqud on every Hebrew field in grades 1–2, none from grade 3
  (`general_source.validate_prose`, code `SOURCE_NIQQUD`).

### 2.4 Answer kinds

Schema in `general_source.authoring_schema`; checks in
`general_source.validate_question`.

| Kind | Wire form | Key | Where |
|---|---|---|---|
| computed | `{"kind":"computed","task":T,"unit":""}` | the kernel's value of `T` (`math_tasks.validate_and_solve_task`) | all |
| task `evaluate`/`simplify`/`factor`/`expand`, `compare` | `T = {"kind":…, "expression"}` / `{left,right}` | computed | all |
| task `solve`, `substitute`, `solve_system`, `inequality` | lhs/rhs/variable… | computed | 7–9 |
| task `statistics` | mean, median, mode, range, sort | computed | data domains only |
| **decide** | `T = {"kind":"decide","relation":eq…ge\|divisible\|not_divisible,"left","right"}` or `in`/`not_in` with `values` | verdict plus its calculation; the author never writes yes/no | all |
| review | `{"kind":"review","text":rich}` | printed as written, listed for the teacher | 7–9 |
| figure | `{"kind":"figure","operation","unit","point"?}` | computed from the figure | middle geometry |

- **decide** is bound to the print by `answer_kinds.bind_decision`: to the one
  printed statement asked about, or to the relation word, its order and the
  printed quantities. A true claim that is not the printed question is refused.
  A claim typed from a story is refused in grades 1–6 (`PRINTED_ANSWER_KIND`);
  in grades 7–9 it is delivered but listed as `decision`.
- **Grades 1–6 print no answer without a proven key.** The schema offers no
  `label`, `open` or `review` kind there; `label` and `open` are refused as
  `SOURCE_ANSWER`, and the adapter refuses any unverified answer, an authored
  `review` included (`UNVERIFIED_ANSWERS`). A number is never the key of a
  drawing (`answer_kinds.refuse_dummy_key`).
- **parts.** Wire v1 has no `parts` answer. A prompt with two or more blanks
  must be answered blank by blank: an elementary binder in `printed_parts`
  (place value, remainder, sequence, two-unit sizes) recomputes every blank
  from the printed givens, or the task's result has that many values (a list
  or a system). Otherwise the question is refused (`printed_parts.bind_parts`).
  Explicit `parts`, `list` and `set` answers come with wire v2 (section 8).
- **Print rule.** The typed task is printed after the prompt only when the
  prompt shows no number (`printed_parts.shows_task`), and only after a bare
  instruction or question: one clause, every word on the closed list
  `printed_parts._BARE_WORDS` (what to do with the exercise and what it is:
  "חשבו.", "מה הסכום?", "פתרו את המשוואה.", "כנסו איברים דומים.";
  `printed_parts.bare_instruction`). After any other prompt (a story, also in
  one sentence, or a unit to convert to), an intro that states numbers, a table
  (also a row whose result is blank beside the same calculation) or a figure
  the item is refused (`printed_parts.refuse_shown_task`,
  `PRINTED_TASK_MISMATCH`).
- **Beside a table** (`printed_tasks.table_row_task`, run in
  `validate_question`, an allowlist): an item that names a row is keyed only
  when its typed task is exactly that row's printed expression. The row is
  named by an ordinal ("בשורה השנייה"), "השורה האחרונה" or a row number ("שורה
  [[2]]", "שורה מספר [[2]]") in the item, or else in its intro, and the row
  prints exactly one closed expression or number, equal to the typed task (an
  `evaluate` task). A mention of a row in any other form ("השורה הבאה", "בכל
  שורה", two rows) is refused, and so is a named row that prints two numbers or
  its result too. In grades 1–6 every computed item beside a table must name its
  row so: an item that names no row, a lookup by a row's label, a total of a
  column or another typed kind is refused (`PRINTED_TASK_MISMATCH`), also with
  the right typed key. The role-named row of `printed_tasks.printed_table_row`
  and the local fraction author's table (`fraction_lesson.printed_evidence`)
  keep their own binders. In grades 7–9 an item beside a table that names no
  row is not refused here and its key is not proven against the table: the
  reviewed fixture grade7-equation-skill asks for a table's values by an x
  value ("עבור [[x = 5]]"), and the v4 golden pins it as compiling, so refusing
  it needs the owner's decision. A later item may not print an earlier item's answer
  (`printed_parts.answer_leak`, `PRINTED_ANSWER_LEAK`). A minus before anything
  but a number (`-2^4`, `-x`) is refused in printed math unless it is printed as
  written: the tree would print it as `0 − 2^4` (`SOURCE_NOTATION`). This holds
  for the prompt's notation (`compact_authoring.expression`) and for a typed task
  printed from its tree after a bare instruction: any subtraction from zero in
  it is refused, also one the task wrote (`printed_parts.refuse_unwritten_zero`,
  `SOURCE_NOTATION`).
- **The key beside its own item** (`printed_parts.check_key_print`, run in
  `validate_question`, so selection, the whole sheet and the adapter agree):
  - an item may not print its own answer, in a complete numeric fact that
    shares a number with its task ("35 : 7 = 5 ... 5 x 7") or in a sentence
    about a result ("הפתרון קרוב ל־8") — `PRINTED_ANSWER_LEAK`;
  - when an equation has several solutions, the key prints only those the
    item's words choose: a sign word, a unit of size, price, time or count,
    "the smaller solution", or "the smaller number" when every kept solution
    has one sign; words that choose none, or both signs for one number, are
    refused (`chosen_solutions`, `PRINTED_ANSWER_KIND`);
  - a requested decimal is keyed as a decimal, or refused when it has none;
    a percent key prints its sign inside the formula (`30%`, `x = 20%`);
  - a printed fraction read by the task as two numbers ("5/24" typed as
    `x(x+5) = 24`) is `PRINTED_TASK_MISMATCH`; an item that asks for an
    equation and for a number gets no single-number key.
- **The answer kind the question asks for** (`printed_tasks.validate_computed_request`,
  `PRINTED_ANSWER_KIND`). `printed_tasks.requested` reads the intro and the item
  prompt, unpointed and clause by clause, by form and not by one verb; a request
  of the intro applies to every item.
  - A yes/no or true/false question (`האם ...?`, "נכון או לא נכון", "כן או לא",
    "(כן/לא)") takes only a `decide` task, never a number or a `compare` sign; a
    yes/no question that offers comparison outcomes ("קטן או גדול מ...") asks for a
    sign. An item with a blank of its own is not asked the intro's yes/no or
    "whether" when the blank is part of its mathematics (inside a formula, or
    after a prompt that prints no complete relation); a blank in the words after
    a complete printed relation ("[[32 : 4 = 9]] ___") is where the verdict goes,
    so the intro's decision still applies. Beside a printed relation
    ("[[3.47 = 3 + 0.4 + ___]]") the blank is not asked the intro's sign.
  - "Whether" (`בדקו/קבעו/החליטו/בררו ... אם`, any word ending in ו directly
    before `אם`/`האם`, or a question ending in "נכון?", "שגוי?" without another
    question word) takes a `decide` task. A true/false word anywhere in the
    intro or the prompt, with any prefix ("הקיפו את התרגילים הנכונים", "סמנו ✓
    ליד כל תרגיל נכון", "מתחו קו מתחת לתרגילים השגויים", "ציינו אם הוא נכון")
    asks the same, unless it is one of the readings on a closed list that ask
    for a number: it describes a quantity or the order of operations within the
    three words before it ("התוצאה הנכונה", "מהי תוצאת החילוק הנכונה", "האחוז
    הנכון", "סדר הפעולות הנכון"), it belongs to what a quantity is of
    ("התוצאה הנכונה של כל תרגיל שגוי"), it says how someone answered or solved
    ("ענה נכון על", "פתרו נכון את") or what a calculation checks ("שבודק את
    נכונות המנה"), or it stands after "כך ש", "כדי ש" or "כדי ל". A `compare`
    sign answers "whether" only when the item and the intro print no relation
    and the words ask for it ("בדקו אם השברים שווים."); "בדקו אם [[32 : 4 =
    8]]." is refused. A `compare` sign is never the key of an item that prints a
    complete relation ("[[32 : 4 = 9]]", "[[345 < 354]]"), whatever its words ask.
  - A comparison sign ("סימן", or a relation sign in the words, in a clause
    that asks for it as below) takes only a `compare` task; an order takes only
    a list: "סדרו", "דרגו", "בסדר עולה/יורד", or a direction from one extreme to
    the other in any spelling ("מהקטן לגדול", "מהקטן ביותר לגדול ביותר", "מהגדול
    אל הקטן", "מן הקטן עד הגדול", "מהנמוך לגבוה").
  - A ratio or a map scale (any inflection of יחס, or קנה המידה), who or which
    thing (איזה/איזו/אילו before a noun that is not a number word such as
    מספר, אחוז, אורך, מחיר) is never keyed, by a number or by a `compare` sign,
    when its clause asks for it: it is a question, holds a blank, or tells the
    pupil to write, state, find, complete, reduce or calculate it (a closed list
    of verbs). Who is also read anywhere from "מיהו/מיהי/מיהם/מיהן", from "מי"
    that opens its clause (not "מי ש..." and not the name מי in a list) and from
    a request for a name ("את שם", "את שמו", "שמו של", "מה שם", "שם הילד"). A
    time of day is never keyed either: "איזו שעה" anywhere; "מתי" in a question
    or beside a blank, and in a question that names hours or minutes also as a
    request or opening its clause without a question mark ("כתבו מתי הסתיים",
    "מתי הסתיים השיעור"; "מצאו מתי הם שווים" in an equation is not read as a
    time); השעה, שעת ("שעת הסיום") or השעון
    in a question, beside a blank, or told to be written in a clause that states
    no number; "בשעה" beside a blank; and, in a question that names an hour, a
    clock, "מתי" or a part of the day, a blank after "ב־", "ל־" or "עד" that
    ends its clause, or a blank before a part of the day ("ב־___ בערב"). The
    earlier wording-specific readers ("מהו היחס", "מה תהיה השעה", "למי ...?")
    still apply anywhere. A ratio is data only when its word is followed by its
    value ("ביחס [[2:3]]", "היחס הנתון", "היחס בין הבנים לבנות הוא [[2:3]]"); a
    number stated for something else in the clause ("הבנים הם [[12]]") does not
    state it. A time stated in a clause that asks nothing is data. A printed
    proportion with one missing term (`[[2 : 3 = ___ : 12]]`) keys that term;
    "איזו פעולה מבצעים ראשונה" is keyed by the operation's name
    (`match_printed_task`) or refused.
  - These readers refuse the forms listed here. A request for a time of day, a
    name, an order or a ratio written in a form they do not list is not refused
    by them; the old path cannot prove that a word problem's key answers what its
    prose asks (only worksheet-wire/5 removes that, because code writes the
    question from its typed task).
  - A number is never the key of a requested equation.
  A prompt that only lists numbers is not keyed by one of them
  (`printed_parts.echoed_given`). A printed inequality binds a typed
  inequality: a chain such as `-3 < 2x + 1 ≤ 7` is refused, and one printed
  inequality must have the typed solution set (`printed_tasks.printed_inequality`,
  `PRINTED_TASK_MISMATCH`).

### 2.5 Reply examples

`reply_examples.py` holds one valid question per grade band, sent as
`replyExample` only to a provider without the strict schema (Gemini):
`LOWER` (grades 1–2: niqqud, five items, a blank in one formula), `UPPER`
(3–6: plain Hebrew, a blank, a word problem with unit), `MIDDLE` (7–9: a `solve`
task, an `evaluate`, a `review`). The system text forbids reusing its numbers,
wording or opening verbs. `tests/test_provider_selection.py` proves each
example compiles for every grade of its band.

### 2.6 Correction request

`skill_authoring.revision_request`: rewrite only the listed questions, at keys
`q<n>` (at most `MAX_CORRECTED` = 8, challenges first), plus `rule` when the
rule was refused. Each row carries its plan row, the refused question and fixed
instructions (`skill_authoring.correction_instructions`, located to the field
and substring by `skill_authoring.refusal_feedback`). When unmarked mathematics
is the only fault, `skill_authoring.notation_correction` asks instead for the
original fragments with `[[...]]` marks inserted, keeping every word.

---

## 3. The reply is read as written

Nothing rewrites the model's reply. `compact_authoring.expand_source` parses a
copy of the reply exactly as it arrived, and every check reads that text. A
spelling outside the notation of section 2.3 is refused with its code. These
are the refusals, by where the spelling stands:

- **Every grade, anywhere in a rich field, in the sentence or in an island,
  and in the title** (`compact_authoring.refuse_notation`, `SOURCE_NOTATION`).
  A string field is read as written; a provider span array is read as the one
  line it prints (`compact_authoring.marked_line`: text as written, every other
  span one island, a relation-sign formula as that sign in the sentence), in
  `compact_authoring.provider_span_array`, which `general_source.rich` runs on
  every provider field; the sheet and section titles go through
  `general_source.title` (also when `skill_authoring.examine_frame` examines the
  frame). Invisible format marks (bidi marks, joiners) are read through
  (`compact_authoring.printing_characters`).
  - An angle sign other than `∠` (`∡`, `∢`, `⦟` and the rest), also before
    three letters (`∡ABC`), and `∠` not before exactly three letters: `∠A`,
    `∠AB`, `[[∠D = 70°]]`, `[[∠A + ∠B]]`, `[[∠A = 3*x]]`, `מצאו את גודל ∠A.`,
    `∠` with a bidi mark before `A`, `∠` in text before a formula `A`. The word
    זווית, or זוית with one vav, before one point name: `זווית A`, `זוית A`,
    `הזווית [[point:B]]`, a text span `זווית ` before a geometry span or formula
    `A`. The locked gate G81 would fail the whole sheet on it at render
    (`compact_authoring.OTHER_ANGLE_SIGN`, `SHORT_ANGLE`, `ANGLE_WORD`).
  - A percent sign that does not directly follow its number in the sentence:
    `[[25]]%`, `[[25]] %`, a bidi mark between `[[25]]` and `%`, `25 %`,
    `כמה % מהכיתה?`, a text span `% מהכיתה` after a math span; and any percent
    glyph other than `%` (`٪`, `％`, `﹪`, `‰`, `‱`), anywhere. The spellings are
    `[[25%]]` and, in the sentence of grades 1–6, `25%`
    (`compact_authoring.percent_outside_island`).
  - An island that ends with its blank directly before a Hebrew word:
    `[[345 = ___]] מאות`, `[[47 : 5 = ___]] שארית ___`, `[[AB = ___]] ס״מ`, and a
    formula `345 = ___` before the text ` מאות + ...` in a span array. Inside the
    left-to-right island the blank prints away from that word
    (`compact_authoring.labelled_blank`). `[[47 : 5 = ___]] (שארית ___)` and
    `במספר [[345]] יש ___ מאות, ___ עשרות ו־___ אחדות` are read.
  - `$...$`, LaTeX or other markup in a text span, where no refusal of this
    section comes first (`SOURCE_TEXT`, `general_source.MARKUP`), and an `=`
    with spaces between a word or blank and an island in grades 7–9
    (`המחיר = [[5]]`).
- **Grades 1–6, the sentence outside every island, and the title** (the same
  reading: `refuse_notation`, `SOURCE_NOTATION`; strings after adjacent islands
  are joined, span arrays as they print). What may print there is closed (an
  allowlist, `compact_authoring.sentence_math`): Hebrew words and punctuation,
  a number on its own (it becomes a math span), the blank `___` and a box
  (`☐ □ ▢`) that the binders read as a blank, and a sign in one of the
  readings below. Everything else prints mathematics or a blank that no binder
  ties to the key, and is refused:
  - an equation or inequality with a blank that is not one complete island
    (`compact_authoring.blank_equation_outside_island`): `24 : ___ = [[6]]`
    (read as `24 : [[___ = 6]]`), `[[72]] : ___ = [[8]]`, `7 + [[___]] = [[15]]`,
    `[[3.47]] = [[3]] + [[0.4]] + ___`, `24 : 6 = ___`, `5 + ☐ = 9`, and a
    relation in the sentence beside an operand while the field has a blank and
    an unmarked number (`___ מאות + ___ עשרות + ___ אחדות = 728`);
  - a blank other than `___` or a box: `__`, `____`, `⬜`, `◻`, an empty bracket
    `( )`, and `?` beside a sign (`24 : 6 = ?`, `24 : ? = 6`);
  - a Latin letter: `x : [[5]] = [[8]]`, `x : 5 = 8`, `24 x 6`, `המספר x`;
  - a digit that does not stand alone as a number: `חשבו: 24 : 6`, `7:30`,
    `1/2`, `3-4`, `25 %`, `הציונים: 80, 90, 100`, `קנה המידה 1:50,000`; and any
    other numeral (`½`, `²`);
  - a mathematical symbol that has no reading in the sentence (`＝`, `≈`, `→`)
    and another spelling of a sign (`：`, `／`, `－`);
  - a relation sign (`= < > ≤ ≥ ≠`) with an operand beside it on either side,
    also when every number is marked: `[[3]] מטרים = ___ ס״מ`,
    `[[150]] דקות = ___ שעות ו־___ דקות`, `[[24 : 6]] = ?`. Only a sign listed
    as an option, with no operand beside it, is read (`(<, > או =)`,
    `כתבו < או > או =.`);
  - a colon after an operand (a number, an island, a bracket, a percent or a
    blank, spaced or touching): `[[24]] : [[6]]`, `___: [[4]] = [[6]]` (which
    the joins would otherwise read as the false formula `[[4 = 6]]` beside a
    separate blank), `המספר החסר הוא ___: [[___ + 4 x 3 = 17]]`. After a word
    the colon ends the sentence (`השלימו: [[24 : ___ = 6]]`,
    `המספר החסר הוא: [[___ + 4 x 3 = 17]]`);
  - a dash, hyphen or minus between two operands (`5 - 3`), or at an end of the
    line beside one (`[[5]] -`); with a word on one side it is punctuation
    (`ו־[[5]]`, `[[345]] – ספרת המאות היא ___`), and a minus written onto the
    number that opens the line is its sign (`-5`);
  - a plus after an operand, or before one with no word before it (`[[5]] + עוד`);
    only the place-value sum `___ מאות + ___ עשרות` is read;
  - `× · * / ÷ ^` beside an operand (`[[3]] · [[4]]`, `24 ÷ 6`);
  - the word שווה between two operands (`[[24]] : ___ שווה [[6]]`,
    `[[24 : 6]] שווה [[4]]`).
  An operand is an island, a number, a blank, a letter, `?` or `%`, and a
  bracket around one of them. Adjacent islands joined across an operator are
  read as the one formula they spell (`[[8]] + ___ = [[15]]` is `[[8 + ___ = 15]]`).
- **Inside an island only**, in grades 7–9 (in grades 1–6 the sentence refuses
  them too, as above; in grades 7–9 a digit or letter in the sentence is
  `SOURCE_PLAIN_MATH`): `324x15`, `2³`, `½`, `☐`, a typed angle inside a formula
  (`[[angle:D = 70°]]`) or with fewer than three points (`[[angle:A]]`),
  `[[a=1, b=-6, c=9]]`; in grades 1–6 a letter for the missing number
  (`[[x : 5 = 8]]`).
- **Outside the rich text:** a coordinate window that leaves out a point, a
  `decide` answer without its task wrapper, a `solve` task for a letter other
  than `x y a b`.
- **A blank no binder fills** (grades 1–6, `printed_parts.refuse_unsolved_equation`,
  `PRINTED_TASK_MISMATCH`, after every other check of the item). A computed
  item whose prompt prints a blank (`___` or a box, in the sentence or in an
  island) is keyed only when one binder of a closed list recomputes its key from the print
  (`printed_parts.solved_from_the_print`): a parts binder of section 2.4 (place
  value, quotient and remainder, sequence, two units), the missing-number and
  first-operation binder `printed_tasks.match_printed_task` (the island alone,
  or after השלימו, השלימו את המספר החסר, מצאו את המספר החסר or המספר החסר
  הוא), the comparison sign between two printed quantities
  (`printed_parts.comparison_blank`), or the printed statement a yes/no item
  decides (`answer_kinds.bind_decision`). Otherwise the item is refused, also
  with the right key: `מהו המספר החסר? [[24 : ___ = 6]]`, a conversion into one
  unit with words (`[[3]] מטרים הם ___ ס״מ`, `ב־[[3]] מטרים יש ___ ס״מ`,
  `[[2]] שעות הן ___ דקות`), a sequence keyed with another term than the one
  its printed terms fix (`[[1]], [[2]], [[4]], ___` keyed 7), a blank after a
  story or after a printed
  calculation (`... התוצאה הנכונה היא ___`), a blank beside a table
  (`הערך החסר בטבלה הוא ___.`). A two-unit conversion is read when its numbers
  fix both blanks: `[[150]] דקות הן ___ שעות ו־___ דקות`. No binder reads a
  blank in the intro, so a question whose intro prints one is refused, and so
  is one whose table cell prints an equation with a blank; a formula that is a
  whole equation counts as one beside the field's blank
  (`printed_parts.prints_blank_equation`).

What is still not proven, also after every check above: a computed item
without a blank keeps its typed key, and the old path cannot prove that a word
problem's key answers what its prose asks (the typed task is checked, the
reading of the story is not; only worksheet-wire/5 removes that, because there
code writes the question from its typed task; in grades 7–9 a yes/no claim typed from a story is
listed as `decision`, and in grades 1–6 it is refused). A figure answer is
computed from the figure for the operation typed, not for the question its
words ask, and a blank in its prompt is not read by the binder rule above. A typed source validated without the provider flag (a code-written
lesson, a source handed straight to `runner.render_job`) gets the binder
refusal above but not the sentence refusals, which run where the model's reply
is read (`general_source.rich(provider=True)`), on every reply of the worker.

A reserve takes the place of the refused question, or the one correction call
asks for it again. When unmarked mathematics is the only fault,
`skill_authoring.notation_correction` asks the model to insert the `[[...]]`
marks, and its `apply` checks that no word changed.

---

## 4. One question at a time

- **The predicate** is `skill_authoring.question_codes`: the question is
  expanded and validated alone (`skill_authoring.examine_question`, the same
  `expand_source` and `validate_question` as the whole sheet); a middle-school
  figure is drawn with the pinned constructors (`figure_probe.figure_refusal`,
  `SOURCE_FIGURE`); an elementary question is read for the claims among the
  truth gates' words (`claim_words.claim_lint`). A word with a benign reading (a
  per-unit `לכל`, a conditional `אילו`) is not named there; G32/G33 refuse it in
  the pre-pass. Not in a question with a figure: the adapter records its measured
  figure in the ledger under the bare question number (`figure_assert`), and the
  locked G32/G33 accept that id for every listed word of the question, so a
  benign reading there is printed (a claim is still named by `claim_lint`). Any
  code makes it a bad question, never a failed sheet.
- **Selection** is `lesson_select.Selection`, which knows no wire format or
  topic; of the grades it knows only their minimums, the one value it accepts
  as a floor (`runtime_catalog.question_floor`). A bad question takes an unused reserve of its own group, same
  concept first. A practice reserve may fill a challenge slot only while two real
  challenges remain, and then prints as an ordinary question. A challenge
  reserve never fills a practice slot.
- `general_provider.Draft` drops a reserve that repeats a planned question word
  for word. When the sheet changed, a question that points at another by number
  is refused (`skill_authoring.refers_to_another_question`, `QUESTION_REFERENCE`).
- **The rule** is examined alone (`skill_authoring.examine_frame`). A refused
  rule is not shortened or rewritten; the one correction call asks for the rule
  again, also when no question is missing, unless that call is the notation-only
  fix. `examine_frame` reads the title too, and no call asks for a title: when
  the title is refused, no returned rule is taken and that draft yields no
  sheet.
- **A reply that is not JSON** is read question by question
  (`reply_salvage.salvage`, called from `provider.parse_author_reply`); a
  question that does not decode counts as refused. Nothing is repaired there.

---

## 5. Gate policy

`gate_policy.py` classifies 96 codes: 68 truth, 21 policy, 7 editorial. A code
not in `gate_policy.GATES` is truth.

| Class | Meaning | Effect |
|---|---|---|
| truth | the mathematics, the key or its print may be wrong, unverified or unreadable | blocks; replaces the named question, else fails |
| policy | correct but not allowed here: chronology (G66, G84), drawings outside geometry, signs by grade, niqqud, brand | blocks; same as truth |
| editorial | G50, G61, G62, page fill, page gap, didactic review, shorter sheet | blocks; same as truth, except the middle-build didactic review that `didactic_review.py` already reconciled (`gate_policy.blocks`), which is delivered with its fixed Hebrew note (`gate_policy.NOTES`). A shorter-sheet finding of a gate blocks; the worker adds its own `SHORTER_SHEET` note to a sheet it shortened |

- `gate_policy.decide` returns `deliver`, `replace` (every blocking finding
  names a question) or `fail`. A timeout, a crash, an unreadable line or an
  incomplete report fails.
- `runner.lesson_gate` builds the report (`skill_feedback.gate_report`) and
  decides; `runner.precheck_job` runs the adapter, content-truth and house gates
  before any PDF exists (elementary only).
- One documented false positive is measured a second time: the middle
  driver's REVIEW-only exit is reconciled by `didactic_review.py`, which never
  turns a FAIL finding into REVIEW. A G51 bracket finding is not measured
  again; it names no question, so the sheet fails.

**What the teacher gets** (`remote_worker.process_job`):

- **Accepted** (`remote_worker.general_verdict`, by allowlist; the image smoke
  calls the same function): the manifest names the lesson's own skill, its
  `unverifiedAnswers` list is present and every row reads, an elementary lesson
  or a manifest that names the elementary skill lists no answer (D6), and there
  are exactly one PDF and one Word file. Then one of two forms: every step PASS
  with `reviewFindings` exactly `[]`; or, on a middle-school lesson, the one
  middle-build REVIEW of the reconciled driver exit (reason
  `PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY`, then `didactic-review-reconciliation`
  PASS; `remote_worker.accepted_review`) whose `reviewFindings` are
  `DIDACTIC_REVIEW` rows of middle-build and nothing else. Everything else is
  refused before anything is uploaded: any other REVIEW, any review row that
  `gate_policy.blocks` blocks (G61, G62, G50, PAGE_*, any truth or policy
  code), a G51 row whatever class it claims, a review row of another step, a
  review row on an all-PASS manifest, a manifest that names another skill, and
  a missing or unreadable `unverifiedAnswers` list. No row is dropped and the
  sheet delivered without it.
- **Delivered:** status `needs_review`, the PDF and the DOCX, and in the result
  `reviewFindings` (codes, counts, question numbers and the fixed note of the
  middle-build didactic review rows of an accepted REVIEW, by
  `gate_policy.public_review_findings`, and the worker's own shorter-sheet
  note), `teacherNotes` (middle-school review
  answers and story-typed verdicts by question and item;
  `gate_policy.public_teacher_notes`), `unverifiedAnswers` counts, and
  `salvage` (attempts, corrections, replaced and dropped questions by code). A
  shorter sheet adds `SHORTER_SHEET`. No gate or model text leaves the worker.
- **Failed:** the code only. The site shows one fixed Hebrew sentence per code
  (`headless/astro-poc/public/teachers/generation-v3.js`). The worker logs one
  `generation_failed` line with the code, stage, question and gate.
- **Gap:** the live site does not read `reviewFindings`, `teacherNotes` or
  `unverifiedAnswers` yet. Showing them is a site change that needs Noam's
  approval.

---

## 6. The repair ladder

`remote_worker.author_and_render`, through `general_provider.Draft`. Each step
runs only when the one before left a deficit.

1. **Reserves**, no model call (inside `Draft.__init__`).
2. **One correction call** (`Draft.correct`): the notation-only fix, or a
   rewrite of the missing questions (at most 8) and of a refused rule; a
   refused rule alone is asked for when no question is missing.
3. **A shorter sheet** (`Draft.shorten`, `lesson_select.Selection.shorten`): at
   least `max(⌈3N/4⌉, floor)` questions and two real challenges, where floor
   is the grade minimum every request must meet (`runtime_catalog.question_floor`:
   8 / 12 / 14 / 20 for grades 1–2 / 3–4 / 5–6 / 7–9; `lesson_select` refuses
   any other floor). A sheet requested at its minimum is never shortened.
   `validation.salvaged_count` checks the same rule again when the sheet is
   pre-checked and rendered. The manifest keeps the requested count
   (`salvaged_from`).
4. **Pre-pass** (elementary, `runner.precheck_job`, status `clean`, `replace`
   or `failed`): named questions are swapped and the ladder settles again; at
   most `PRECHECK_PASSES` = 2 rounds. Questions named by an editorial finding
   (G61, G62) take the same path, so they may be replaced, corrected or
   dropped into a shorter sheet (step 3).
5. **Render** (`runner.render_job`), then `manifest.gate`: `deliver` ends;
   `replace` swaps the named questions and renders once more
   (`FULL_RENDERS` = 2); `fail` goes to step 6.
6. **One second full author call** when a reply was received and the ladder
   ended without a sheet, or the reply was unusable as a whole.

**Limits** (`remote_worker.py` constants): `AUTHOR_CALLS` = 2,
`CORRECTION_CALLS` = 2, no model call starts later than `MODEL_CALL_WINDOW` =
150 s after the claim, a call with no answer closes the job to further calls,
the lease is confirmed before every call and render, and the author call
timeout is 300 s. A failed job reports `Draft.first_refusal`'s code
(`general_provider.failure_code`).

---

## 7. Provider switch

`provider.author_provider` and `provider.author_config`.

| Variable | Meaning |
|---|---|
| `TEACHER_AUTHOR_PROVIDER` | `qwen` (default when unset or empty) or `gemini`; anything else fails closed |
| `GEMINI_API_KEY` | Gemini credential; read only when the switch is `gemini` |
| `GEMINI_MODEL` | optional; closed list `provider.GEMINI_MODELS` = `gemini-3.8-flash` |
| `QWEN_API_KEY` or `DASHSCOPE_API_KEY`, `QWEN_BASE_URL`, `QWEN_MODEL` | Qwen; URL host allowlisted (`provider.qwen_chat_url`) |
| `ELEMENTARY_SKILL_PATH`, `MIDDLE_SKILL_PATH` | installed skill roots |

- Gemini has one fixed endpoint (`provider.GEMINI_CHAT_URL`) and refuses
  Qwen-style `api_key`/`base_url` arguments, so one provider's key never reaches
  the other's host.
- Transport: 10 s connect limit, two attempts on 429/503 with 2–8 s backoff, no
  redirects, verified TLS.
- The worker env-file allowlist is `remote_worker.load_env`; the Cloudflare
  controller passes the three Gemini names when set
  (`cloud/cloudflare/src/controller.ts`).

---

## 8. Adding a topic today

A topic is a catalog row (`export_curriculum.project`), not code. Today:

1. Add the row to the skill registry (`curriculum_elementary.json`, or
   `curriculum_tashpaz.json` and a regenerated `curriculum_tools.json`).
2. Re-lock the skill: `skill-lock.json`, the archive, `skill-archives.json`.
3. Re-export the catalog; update the pinned hashes and the counts in
   `export_curriculum.py` (`!= 160`) and `curriculum_scope._decode` (`!= 232`),
   and `runtime_catalog.CURRICULUM_SHA256`.
4. Switch the site literals together (`generation-v3.js`,
   `src/lib/teacherGenerationContract.ts`) and the hash in
   `worker_ready()` of `supabase/migrations/20261122151819_teacher_generation_public_trial.sql`
   (a new migration).
5. Release worker, site and SQL together.

No topic-specific author is needed. Measure the new topic with `sweep.py`
before offering it.

**What the general layer changes** (`HANDOFF/reports/design-spec.md`, designed,
not built):

- wire v2: sections, `$…$` school notation, `___` blanks, typed answers
  `number | yesno | label | list | set | parts | expr | text | none`;
- a display tier that typesets every expression through the skill's own parsers;
- the verify ladder: T1 exact from the printed tokens; T2 blind re-solve by the
  other provider family; T3 teacher check. A disagreement replaces the question;
  a disputed key is never printed;
- topics as data: `catalog-extensions.json`, `add_topic.py`, one hash source;
- mixed sheets with up to three topics.

Acceptance A1–A8 in the spec. Never cut: the display tier, T1, T2 with its
comparator, reserve salvage, "no key without a tier record", v1 compatibility.

---

## 9. Measuring

Run from the repository root. Full guide: `bench/README.md`.

| Tool | Answers | Calls |
|---|---|---|
| `bench/replay.py [--case ID] [--corrections exact\|subset\|none] [--compare bench/corpus/baseline/results.json]` | recorded replies through the unchanged worker (`bench/engine.run_job` → `remote_worker.process_job`) | none; sockets refused |
| `bench/probes/run.py [--family F] [--show] [--update]` | 285 synthetic question forms: pass or rejected; exit 1 on a regression or any wrong print | none |
| `bench/sweep.py --live --max-calls N --max-output-tokens T …` | default teacher requests across topics and levels | real, budgeted |

- **Recorded state:** replay delivers 4 of 35 cases with no further model
  call, and 328 of 756 questions are refused alone
  (`bench/corpus/baseline/summary.md`). Corrections that were never recorded
  count as failed, so this under-states the live ladder. The key-print checks
  of section 2.4 cost three ג10 replays (A-, B- and G-division) whose
  fact-family items print their own answer; live, those questions go to the
  correction call. The missing-number binding of section 3 costs L1-g4: its
  "[[___ * 5 + 12 = 47]]" after "אלעד חישב לפי סדר הפעולות:" and its reserve
  "בתרגיל [[(14 - 6) * ___ = 24]], מהו המספר החסר?" are not solved from the
  print, and its "[[6 + ___]]" (a blank no binder fills). The sentence
  allowlist and the blank rule of section 3 cost S-g4calc five of its twelve
  questions as recorded ("המספר החסר הוא ___: [[...]]" three times, a blank
  beside its table, a blank after a printed calculation) and A-division the
  question whose intro prints a blank. The table rule of section 2.4 (grades
  1–6: an item beside a table names its row and types that row's expression)
  and the round 4 request readers cost thirteen more questions of four replays
  that were not delivered before either: nine table questions of B-order, one
  each of A-order, B-division and G-division, and B-division's "בחרו את
  הנתונים הנכונים". Probes: 158 pass, 127 rejected, no wrong print (the
  five ג20, ד25 and ב12 table probes that named no row, or a row of numbers,
  are refused now).
- **Sweep flags:** `--dry-run`, `--topics`, `--grades`, `--levels`, `--limit`,
  `--one-level-per-topic`, `--only-failed`, `--question-count`, `--minutes`
  (default 30), `--calls-per-case` (4), `--concurrency` (4), `--case-timeout`
  (1200 s), `--allow-host`, `--out`. The lesson goal is `practice`
  (`bench/lessons.GOAL`).
- **Sweep budget:** calls and output tokens are reserved per case and refused
  before any network use. Input tokens are not capped. A price exists only for
  the verified Qwen model; Gemini reports `MODEL_PRICE_NOT_VERIFIED`.
- **Live key:** read from the Keychain into the child process only:
  `GEMINI_API_KEY="$(security find-generic-password -s GEMINI_API_KEY -a noamdoron -w)" TEACHER_AUTHOR_PROVIDER=gemini python3 tools/teacher-generation/bench/sweep.py --live …`.
  Never print, log or store it. Every live run needs Noam's approval of its size.
- **After an engine change:** unit tests, then `probes/run.py` (record with
  `--update` only when intended), then `replay.py --compare`.

---

## 10. The invariant and the red lines

**Invariant:** a sheet may fail, but it must never print a wrong answer key, an
answer beside its question, or an exercise the pupil is not meant to see. Fail
closed.

How the code holds it:

- The key comes from the kernel, never from model text.
- A blank is answered from the printed givens or the question is refused.
- Answer leaks are refused: an earlier item's answer and the item's own.
- The key prints only the solutions the item asks for, in the requested form.
- A verdict is bound to the printed question.
- An unknown gate code blocks.
- Unreadable evidence fails the render.
- A failed render exposes no artifact.

Known gaps, stated plainly:

- The kernel proves the typed task, not that the task is what the prose asks.
  A wrong typing can print a wrong key; T2 (section 8) exists for this.
- Middle-school `review` answers and story-typed verdicts are human-checked by
  design. Grades 1–6 refuse every answer without a proven key.
- An answer printed in another question of the sheet is not refused (in the
  round-2 percentages sheet, 50% → 1/2 in Q1 and 1/2 → 50% in Q5): numbers of
  independent questions match by chance too often for a sheet-wide rule.
- Grade-9 geometry is the weakest area. In the replay of live round 1,
  `g9r:rhombus` and `g9r:parallels_trapezoid` still fail;
  `g9r:quad_eq_applications` delivers.

**Red lines:**

- Figures only on geometry and analytic-geometry sheets
  (`general_source.geometry_topic`, `DRAWING_POLICY`).
- Niqqud in grades 1–2 only.
- No model string reaches `eval`, `exec` or a symbolic parser.
- No model-chosen file, URL, SVG or approval flag.
- No secret in any file, log or command line.
- No Supabase write without Noam's approval.
- New runtime modules go into all three packaging allowlists:
  `cloud/container/context-files.json`, `cloud/container/Dockerfile.dockerignore`,
  `cloud/render/Dockerfile.dockerignore`. Otherwise the image lacks them.

---

## 11. Release path

Merging and the site pin do **not** deploy the engine.

1. **Tests:**
   `DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib python3 -m unittest discover -s tools/teacher-generation/tests`
   and `python3 tools/teacher-generation/cloud/container/test_packaging.py`.
   `test_wspec_ocr_tesseract…output_limit` is flaky on the Mac; rerun it alone.
2. **CI:** open a PR to `headless/astro-poc-baseline`. All six checks must pass:
   `canonical-site-build`, `canonical-unit-tests`, `seo`,
   `astro-poc-slash-fractions`, `teacher-cloud-linux`,
   `teacher-free-http-512mb-01cpu`. `teacher-cloud-linux` builds the image
   (`.github/workflows/teacher-generation-cloud.yml`); its artifact expires one
   day after the run.
3. **Merge** with a merge commit, never a squash. The controller requires a CI
   run whose head is the released commit.
4. **Cloudflare release**, local, one ledger, one chain. The controller is the
   `main` copy of `tools/release/teacher-cloudflare-release.py` through
   `tools/release/release.sh`, normally run by Codex's kit. It has four phases,
   each with its own plan and **Noam's explicit GO**:
   - `image-push`
   - `upgrade-drain`
   - `upgrade-preflight` (zero active jobs, runtime secrets file)
   - `upgrade-activate`

   Agents never run these commands themselves.
5. **Gemini in production:**
   - Noam sets `GEMINI_API_KEY` as a Cloudflare secret, and
     `TEACHER_AUTHOR_PROVIDER=gemini` goes into the worker configuration.
   - The controller's `RUNTIME_SECRET_KEYS` accepts only the five Qwen-era names
     today, so it must be extended on `main` first (`cloud/cloudflare/README.md`).
6. **Verify:**
   - the controller's `--observe`, the ledger `active`, a heartbeat under 90 s;
   - one real sheet on the live site, made by Noam or Cursor.

**Rollback** is another upgrade to the old identity and has never been
exercised. `upgrade-drain` alone is the emergency stop.

Runbook with commands: `HANDOFF/reports/deploy-map.md`, where `HANDOFF` is
`…/submissions/Claude/MANAGER-20261116/handoff-20261123`.
