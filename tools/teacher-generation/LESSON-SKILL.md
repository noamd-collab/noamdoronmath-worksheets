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
   general_provider.author_general_lesson   ◄── THE LESSON SKILL (model call, normaliser,
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

- **Layout** (`author_request.py`): the system message opens with the pinned
  skill documents (`author_request.document_prefix`), the same bytes for every
  job of one skill version and grade band, so a provider prefix cache can serve
  them; the user data names them only. The author's copy of the context drops
  file hashes, glossary regexes and source notes (`author_request.trim_context`)
  and keeps chronology, tools, terms and the notation contract.
  `author_request.request_parts` measures each part; `bench/latency.py --sizes`
  prints it (live round 2 rhombus: 162k → 146k characters, 83k of them documents).
- **System text:** the fixed contract sentences in that function, plus
  `answer_kinds.DECISION_GUIDE`, and for grades 1–6
  `answer_kinds.ELEMENTARY_KINDS_GUIDE` and the claim-word bans of the truth
  gates (no `תמיד`, `לעולם`, `לכל מספר`…), or for grades 7–9 the `solve`/`review`
  block. Conditional blocks: reserves; `lessonGoal: "introduce"` (guided entry
  questions first, a rule with one worked example); a time budget of 1.8
  minutes or less per question, or an opening sheet (exactly `minimumItems`
  short items, `skill_authoring.short_items`); a
  non-geometry topic ("text-and-math lesson", no drawing); middle-school
  geometry representations.
- **Parallel parts** (`author_request.slice_plan`, `send_parts`, `join`): the
  plan is split into 2–4 contiguous parts written at the same time with the same
  system text and plans; each part's schema asks only for its rows
  (`part_schema`), the first part also for title and rule. Setting
  `TEACHER_AUTHOR_SLICES` = `1`–`4` or `auto`; unset means `auto` for Gemini
  (about 9 question objects a part: 3 parts for 20 questions) and one call for
  Qwen. A part with no reply, or a failed first part, fails the attempt as the
  one call did; a later part whose reply cannot be used loses only its rows.
  After the join a question that repeats another part's question (the same
  item template, or most of its typed tasks) is refused as `DUPLICATE_QUESTION`
  (`author_request.duplicates`) and takes a reserve.
- **Sheet size** (`skill_authoring.planned_count`): an opening sheet
  (`introduce`) is planned at 1.5 minutes an item with exactly the minimum
  items per question, never above the request and never below
  `lesson_select.minimum_count` of it (30 minutes, 20 requested: 15 questions,
  45 items). The delivered result carries the editorial note `LESSON_SIZED`.
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
  else 5; the last one is a challenge (`lesson_select.reserve_groups`). They are
  optional on arrival (`skill_authoring.split_reserves`).

### 2.3 Notation

- **Rich fields** are Hebrew prose. Every number or compound formula goes in
  `[[...]]`, one parseable number, expression or relation per island; words,
  units and punctuation stay outside. No HTML, LaTeX, `$`, `\` or links
  (`general_source.MARKUP`).
- **Elementary:** every product with its sign; a missing number is `___`
  inside one complete formula (`[[24 / ___ = 6]]`), never a letter.
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
| **label** | `{"kind":"label","text":"משולש"}` | printed as written, listed for the teacher | 1–6 |
| **open** | `{"kind":"open"}` | `סעיף פתוח: לבדיקת המורה.` (`answer_kinds.TEACHER_CHECK`) | 1–6 |
| review | `{"kind":"review","text":rich}` | printed as written, listed for the teacher | 7–9 |
| figure | `{"kind":"figure","operation","unit","point"?}` | computed from the figure | middle geometry |

- **decide** is bound to the print by `answer_kinds.bind_decision`: to the one
  printed statement asked about (also when the words restate its sign), to an
  equation and a value ("is [[x = 5]] a solution of ...", "for [[x = 5]], is
  A greater than B"), or to the relation word, its order and the printed
  quantities ("∠BAD = 110°" counts as 110). A true claim that is not the
  printed question is refused, and so is a bound claim whose two sides are the
  same ("9 = 9"). A claim typed from a story is delivered but listed as `decision`.
- **label** only where the prompt asks for a name (`answer_kinds.check_label`);
  **open** only for drawing, building, explaining or inventing
  (`answer_kinds.check_open`); a number is never the key of a drawing
  (`answer_kinds.refuse_dummy_key`).
- **parts.** Wire v1 has no `parts` answer. A prompt with two or more blanks
  must be answered blank by blank: an elementary binder in `printed_parts`
  (place value, remainder, sequence, two-unit sizes) recomputes every blank
  from the printed givens, or the task's result has that many values (a list
  or a system). Otherwise the question is refused (`printed_parts.bind_parts`).
  Explicit `parts`, `list` and `set` answers come with wire v2 (section 8).
- **Print rule.** The typed task is printed after the prompt only when the
  prompt shows no number (`printed_parts.shows_task`); a later item may not
  print an earlier item's answer (`printed_parts.answer_leak`,
  `PRINTED_ANSWER_LEAK`). A task that would show an earlier answer ("2 · 62"
  after the item keyed 62) is left off the page when the prompt names what to
  find and the pupil can form the calculation from the page
  (`printed_parts.stands_alone`); both printers and the validation read the
  same `earlier_answers`. A prompt that needs its task, or prints the answer
  itself, is refused. A key unit of another size than the item asks
  (a width in דצמ"ר) is `PRINTED_ANSWER_KIND` (`printed_parts.check_unit_size`).
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

## 3. The normaliser

`source_normalize.py`; the full rule table is its module docstring.

- **When:** once on arrival (`source_normalize.normalize_source` in
  `general_provider.author_general_lesson`), again inside
  `compact_authoring.expand_source` (a no-op on normal text), and on every
  reserve and correction reply (`Draft._normalise`, `normalize_rich` for the rule).
- **Contract:** pure, idempotent, never raises, never computes, never chooses
  between two readings. Only the number of rewrites is measured
  (`sourceRewrites`); the notes quote worksheet text and are never logged.
- **Rule families:** invisible and bidi characters; `$…$` and LaTeX to islands;
  sign variants, `√`, superscripts, `½`; placeholders to `___`; punctuation and
  units out of islands; school operators in grades 1–6 (`324x15`, `12÷4`); the
  elementary unknown letter to `___` (whole question or nothing); geometry signs,
  bare formulas, number lists and label nouns (`משולש ABC` →
  `משולש [[triangle:ABC]]`) in grades 7–9; one-letter angles to three letters when
  the figure fixes them; `name=value` lists; a coordinate window that hides a
  point; a flat `decide` answer wrapped as `computed` (`DECIDE_WRAPPER`).
- **Never rewritten:** `3,5`, `7:30` and colons in ratio or time topics, `2½`,
  `3x = 12` in grades 1–6, an unknown used twice, a one-letter angle without a
  figure, bare mathematics in elementary prose. These stay for validation to
  refuse, so a reserve can replace the question.

---

## 4. One question at a time

- **The predicate** is `skill_authoring.question_codes`: the question is
  expanded and validated alone (`skill_authoring.examine_question`, the same
  `expand_source` and `validate_question` as the whole sheet); a middle-school
  figure is drawn with the pinned constructors (`figure_probe.figure_refusal`,
  `SOURCE_FIGURE`); an elementary question is read for the truth gates' claim
  words (`claim_words.claim_lint`). Any code makes it a bad question, never a
  failed sheet.
- **Selection** is `lesson_select.Selection`, which knows no wire format, topic
  or grade. A bad question takes an unused reserve of its own group, same
  concept first. A practice reserve may fill a challenge slot only while two real
  challenges remain, and then prints as an ordinary question. A challenge
  reserve never fills a practice slot.
- `general_provider.Draft` drops a reserve that repeats a planned question word
  for word. When the sheet changed, a question that points at another by number
  is refused (`skill_authoring.refers_to_another_question`, `QUESTION_REFERENCE`).
- **The rule** is examined alone (`skill_authoring.examine_frame`); refused
  sentences are dropped (`skill_authoring.trim_rule`), else the correction asks
  for the rule again.
- **A reply that is not JSON** is read question by question
  (`reply_salvage.salvage`, called from `provider.parse_author_reply`); a
  question that does not decode counts as refused. Nothing is repaired there.

---

## 5. Gate policy

`gate_policy.py` classifies 98 codes: 68 truth, 22 policy, 8 editorial. A code
not in `gate_policy.GATES` is truth.

| Class | Meaning | Effect |
|---|---|---|
| truth | the mathematics, the key or its print may be wrong, unverified or unreadable | blocks; replaces the named question, else fails |
| policy | correct but not allowed here: chronology (G66, G84), drawings outside geometry, signs by grade, niqqud, brand | blocks; same as truth |
| editorial | G50, G61, G62, page fill, page gap, didactic review, shorter sheet | never blocks; a fixed Hebrew note (`gate_policy.NOTES`) |

- `gate_policy.decide` returns `deliver`, `replace` (every blocking finding
  names a question) or `fail`. A timeout, a crash, an unreadable line or an
  incomplete report fails.
- `runner.lesson_gate` builds the report (`skill_feedback.gate_report`) and
  decides; `runner.precheck_job` runs the adapter, content-truth and house gates
  before any PDF exists (elementary only).
- Two documented false positives are measured a second time. G51 brackets are
  re-read on the PDF (`paren_order.py`): a correct pair is cleared, a reversed
  pair still fails. The middle driver's REVIEW-only exit is reconciled by
  `didactic_review.py`, which never turns a FAIL finding into REVIEW.

**What the teacher gets** (`remote_worker.process_job`):

- **Delivered:** status `needs_review`, the PDF and the DOCX, and in the result
  `reviewFindings` (editorial codes, counts, question numbers, the fixed note;
  `gate_policy.public_review_findings`), `teacherNotes` (labels, open items,
  story-typed verdicts and review answers by question and item;
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
2. **One correction call** for the missing questions only (`Draft.correct`):
   the notation-only fix, or a rewrite of at most 8 questions and the rule.
3. **A shorter sheet** (`Draft.shorten`, `lesson_select.Selection.shorten`): at
   least `max(6, ⌈3N/4⌉)` questions and two real challenges. The manifest keeps
   the requested count (`salvaged_from`).
4. **Pre-pass** (elementary, `runner.precheck_job`): named questions are
   swapped and the ladder settles again; at most `PRECHECK_PASSES` = 2 rounds.
5. **Render** (`runner.render_job`), then `manifest.gate`: `deliver` ends;
   `replace` swaps the named questions and renders once more
   (`FULL_RENDERS` = 2); `fail` goes to step 6.
6. **One second full author call** when a reply was received and the ladder
   ended without a sheet, or the reply was unusable as a whole.

**Limits** (`remote_worker.py` constants): `AUTHOR_CALLS` = 2 attempts (one
call or one call per part each), `CORRECTION_CALLS` = 2. The per-job deadline
`MODEL_DEADLINE` = 2 × (`AUTHOR_SECONDS` 80 + `CORRECTION_SECONDS` 25) = 210 s
after the claim, sized from the live rounds of 23 Nov (author call median
61.8 s, max 74.4 s; correction median 21.6 s, max 24.0 s): a correction starts
only when 25 s still fit before it, and a second attempt only when the attempt
(80 s, or `PARTS_AUTHOR_SECONDS` 45 s when the first attempt was written in
parts) and exactly one correction after it still fit. A call with no answer closes the job to further calls,
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
| `bench/latency.py [--case ID] [--parts N] [--goal practice] [--sizes]` | the author stage in one call and in parts, at the measured Gemini rate (`engine.LATENCY`), on a virtual clock | none |
| `bench/probes/run.py [--family F] [--show] [--update]` | 285 synthetic question forms: pass, rejected or wrong print; exit 1 on a regression | none |
| `bench/sweep.py --live --max-calls N --max-output-tokens T …` | default teacher requests across topics and levels | real, budgeted |

- **Recorded state** (after merging the m3 tracks): the corpus holds every
  author and correction reply of both live rounds (43 cases). Replay delivers
  19 of 43 with no further model call, and 308 of 951 questions are refused
  alone (`bench/corpus/baseline/summary.md`); with `--corrections subset`, 20.
  At 63e2055e the same 43 cases gave 19 (20) and 350. Corrections that were
  never recorded count as failed, so this under-states the live ladder: the
  engine now refuses other questions than it did live, so most recorded
  corrections no longer match the request exactly. The key-print checks of
  section 2.4 cost three ג10 replays (A-, B- and G-division) whose fact-family
  items print their own answer; live, those questions go to the correction
  call. Opening sheets print 15 of 20 (`skill_authoring.planned_count`).
  Probes: 209 pass, 62 rejected, 14 wrong print.
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
- 14 probes are still recorded as wrong prints: 11 wrong or incomplete keys
  and 3 prints that add numbers. Examples: a double inequality keyed by one
  side, a time answer keyed `8` for `8:15`, a ratio keyed without `:`. The test
  only forbids new ones (`tests/test_bench_probes.py`).
- `label`, `open`, `review` and story-typed verdicts are human-checked by design.
- An answer printed in another question of the sheet is not refused (in the
  round-2 percentages sheet, 50% → 1/2 in Q1 and 1/2 → 50% in Q5): numbers of
  independent questions match by chance too often for a sheet-wide rule.
- Grade-9 geometry is the weakest area. In the replay of both live rounds,
  no recorded reply of `g9r:rhombus` or `g9r:parallels_trapezoid` delivers;
  three of the four `g9r:quad_eq_applications` replies deliver (the fourth
  with `--corrections subset`). Selecting at most two questions per drawing
  (G75 REUSE) can push a figure sheet under G75's 60% drawing floor, which
  names no question (A-square).

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
