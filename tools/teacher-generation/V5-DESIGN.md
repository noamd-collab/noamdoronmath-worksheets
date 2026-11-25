# V5-DESIGN — stage-2 interface spec (worksheet-wire/5, first sheet)

Status: spec only, no code. Branch `claude/teacher-pdf-structured-20261124` at `bafa36f0` (this folder is identical to production `8ea258a8`).
Scope: one sheet. Grade 7, `g7:algebraic_expressions`, level b, 20 questions, concepts #0 ביטוי אלגברי, #1 משתנה, #2 כינוס איברים.
Out of scope for stage 2: the distributive law, powers, fractions, elementary sheets, Word, live model calls, prompt cards, remote worker, site and SQL wiring, and replacing questions after a render.

Tags: **[V]** = read or run in this pass (file:line at `bafa36f0`, or in the pinned middle skill 7.2.0-noam). **[I]** = design choice or inference.
Inputs: stage1/merged.txt, the critiques (they override the plan), the Hebrew stage-1 summary, stage1/facts.txt.
Paths: `TG` = tools/teacher-generation. `SKM` = the pinned middle skill (`MIDDLE_SKILL_PATH`). `B:` = `origin/codex/teacher-skill-site-reliability-20261124` @ `a95959bb`.

## Contents
0. Ground rules
1. Modules, owners and allowed edits
2. Data shapes: 2.1 wire JSON · 2.2 Given/Ref · 2.3 plan rows and reserves · 2.4 school grammar and CST · 2.5 kernel AST · 2.6 IR (v4 plus the v5 additions) · 2.7 the g7 overlay · 2.8 middle-skill emission and RTL atoms
3. Public interfaces (signatures and docstrings)
4. Refusal codes, the per-question pipeline and the exact delivery rule
5. The runner v5 path and atom_order
6. Test plan, golden files and the offline end-to-end script
7. Fixtures (the lesson JSON, verbatim)
8. Deviations from the plan, open items, merge order
9. Review fixes (2026-11-25)
10. Stage-3 hardening (2026-11-25): reordered items in one question, the trusted v5 flag, container packaging, the pinned report copy
11. Stage 3, elementary path (2026-11-25): grade 4, ד10 חילוק ארוך ושארית, level a
12. Stage 3, middle path (2026-11-25): grade 9, g9r:probability הסתברות, level e
13. Stage-3 verification fixes (2026-11-25)
14. Stage 4 wiring (2026-11-25): structured_author, the TEACHER_V5_TOPICS route, the worker's v5 path

---

## 0. Ground rules (binding on all four engineers)

- **G1 Old path unchanged.** Without the root marker `"contract": "worksheet-wire/5"`, every v4 source, closed author and v1/v2 payload produces the same output as at `bafa36f0`, byte for byte. Golden tests (§6.3) prove it. They are recorded before anything in `general_source.py`, `general_adapters.py` or `runner.py` changes.
- **G2 Nothing is deleted or renamed in stage 2.** `preflight.py:46` imports `authoring_schema`, and retained code still uses `MATH_TRANSLATION` [V critique]. `compact_authoring.py`, `skill_authoring.py`, `general_provider.py`, `provider.py`, `remote_worker.py`, `math_tasks.py`, `validation.py`, `runtime_catalog.py` and `preflight.py` do not change.
- **G3 Lazy imports.** The three integrator files import v5 modules only inside `if v5:` branches. A v4 job loads the same modules as today.
- **G4 Tests.** Existing tests are never edited, deleted or weakened. New tests live in `tests/test_v5_*.py`. The final merged state adds no skips, apart from the same "pinned skill/WeasyPrint unavailable" guards that existing tests use [V tests/test_general_source.py:20-21,160].
- **G5 Pinned skills are read-only.** They are loaded only after a sha256 check against `skill-lock.json` [V runner.py:19-29]. Nothing writes bytecode into a skill folder.
- **G6 D12.** The middle bridge keeps `given=[body]` exactly [V general_adapters.py:500]. No dict givens are emitted. The source-side mirror has no stated-given exemption (§3, `leak_checks`).
- **G7 D1 (PASS only).** REVIEW is never PASS. SKIP is never PASS. Allowed skips are reported as `notRun`. `automatedChecksPassed` is false while `notRun` is non-empty (§5).
- **G8 D6.** Every printed item has a key proven by the kernel. v5 has no `review` answer.
- **G9 Codes.** Every refusal or job code matches `^[A-Z_]{1,60}$`. No digits, so no `D12_*` codes [V MIG/PILOT:13 via critique].
- **G10 Determinism.** The same inputs give byte-identical IR (`json.dumps(..., ensure_ascii=False)`, fixed construction order).
- **G11 Privacy.** Diagnostics hold codes, slots, item indices and field names only. They never hold model text, lesson text or expressions.

## 1. Modules, owners and allowed edits

Four engineers (E1–E4). Each file has exactly one owner. Tests are owned by the owner of the module they test.

| File (TG/…) | Owner | New/edit | Purpose | May import |
|---|---|---|---|---|
| `structured_contract.py` | E2 | new | Contract id, code registry, limits, the g7 overlay, wire schema, IR selection validator | stdlib, `runtime_catalog` (lazy) |
| `text_lint.py` | E2 | new | Hebrew-only text rules, the IR atom rule, a pre-render levels.json lint (CLI) | stdlib, `structured_contract`, `general_source.DRAWING_REQUEST` |
| `leak_checks.py` | E2 | new | LEAK_OWN, LEAK_LINKED, LEAK_RULE_FACT, DUPLICATE_ITEM, sheet duplicates and inverses, and the D12 mirror | stdlib, `school_math`, `structured_contract`, the pinned `check_didactic.py` by path |
| `school_math.py` | E1 | new | School grammar, CST, scope rules, kernel conversion, house printer, key builder | stdlib, `math_tasks` |
| `mistake_models.py` | E1 | new | M1, M2, M3 for `find_error_collect` | `school_math` |
| `item_kinds.py` | E3 | new | The 4 kinds: compile_item, the IR binding verifiers, templates and layouts | `school_math`, `mistake_models`, `structured_contract`, `math_tasks` |
| `lesson_select.py` | E3 | new (port) | Port of `B:lesson_select.py` without `soft`/`restore`, with a floor-based minimum and the v5 reserve formula | stdlib |
| `structured_source.py` | E3 | new | Plan → parse wire → compile each question → select → sheet checks → repairs → IR → `validate_source` | everything above, `general_source`, `skill_authoring.question_plan`, `runtime_catalog` |
| `atom_order.py` | E4 | new | PyMuPDF glyph-run check of every atom on every page, plus the producer check (CLI) | stdlib, `pymupdf` |
| `v5_offline_render.py` | E4 | new | Offline end-to-end: compile → select → validate → `render_job` → PNG pages | all |
| `general_source.py` | E4 | edit | 6 hook points, v5 only (§2.6) | v5 modules lazily |
| `general_adapters.py` | E4 | edit | 3 hook points, v5 only (§2.6) | `school_math`, `structured_contract` lazily |
| `runner.py` | E4 | edit | v5 detection plus `_render_job_v5` (§5) | `general_source.V5_CONTRACT` |

`item_kinds.compile_item` is the only producer of v5 IR items. `item_kinds.verify_item` is the only per-item checker, and both `structured_source` and `general_source` call it. Compile time and final validation therefore cannot drift apart [I].

---

## 2. Data shapes

### 2.1 Wire JSON `worksheet-wire/5` (the stage-2 subset; this is what a model will write)

Every property is required. An absent value is `""` or `[]`. Unknown keys are refused. The reply is ≤200,000 bytes and is read with `validation.read_json` (duplicate keys refused) [V validation.py:10,224-236].

```text
root      {"questions": [question × 1..2·(N+R)]}                 (N = 20 planned, R = 6 reserves)
question  {"slot": "Q1".."Q20" | "R1".."R6", "kind": <kind>, "intro": str ≤300, "givens": [given ≤8],
           "table": {"head": [str ≤40] ≤6, "rows": [[str ≤40] ≤6] ≤8}, "items": [item × 3..6]}
item      {"text": str ≤200, "expr": str ≤120, "expr2": str ≤120, "values": str ≤40,
           "ask": "" , "form": "" | <form>, "variant": "" | <template id> | <mistake id>}
given     {"id": "n1".."n8", "type": <given type>, "value": str ≤60, "unit": "" | <unit>}   (§2.2)
```

**Stage 2 departs from the plan's root:** the plan's `rule` field is deferred. The rule box comes from the overlay (§2.7). That is D17's conservative default and matches D4 (Tier B off) [I].

Field use by kind. For all four kinds: `intro` = "", `givens` = [], `table` = {"head":[],"rows":[]}, `ask` = "", `text` = "". Any other value gives FIELD_NOT_EMPTY.

| kind | group | planned concept | reads | form ("" = default) | variant |
|---|---|---|---|---|---|
| `write_from_words` | practice | #0 | `expr`, `variant` | expression | `W_*` (§2.7) |
| `substitute` | practice | #1 | `expr`, `values` | integer | "" |
| `collect_like_terms` | practice | #2 | `expr` | expression | "" |
| `find_error_collect` | challenges | #2 | `expr`, `expr2`, `variant` | expression | `M1` / `M2` / `M3` |

Examples. One question per kind. The keys were checked with sympy. Every item passes the D12 mirror, checked with the pinned `f_atoms`/`f_hit` [V scratch probe].

```json
{"slot":"Q1","kind":"write_from_words","intro":"","givens":[],"table":{"head":[],"rows":[]},"items":[
 {"text":"","expr":"4x","expr2":"","values":"","ask":"","form":"","variant":"W_TIMES"},
 {"text":"","expr":"a+b","expr2":"","values":"","ask":"","form":"","variant":"W_SUM"},
 {"text":"","expr":"3y+x","expr2":"","values":"","ask":"","form":"","variant":"W_TIMES_PLUS"}]}
{"slot":"Q7","kind":"substitute","intro":"","givens":[],"table":{"head":[],"rows":[]},"items":[
 {"text":"","expr":"4y-y","expr2":"","values":"y=-2","ask":"","form":"","variant":""},
 {"text":"","expr":"2a+5","expr2":"","values":"a=3","ask":"","form":"","variant":""},
 {"text":"","expr":"5b-2b","expr2":"","values":"b=4","ask":"","form":"","variant":""}]}
{"slot":"Q13","kind":"collect_like_terms","intro":"","givens":[],"table":{"head":[],"rows":[]},"items":[
 {"text":"","expr":"3x+5+2x-1","expr2":"","values":"","ask":"","form":"","variant":""},
 {"text":"","expr":"-4y+9+6y-2","expr2":"","values":"","ask":"","form":"","variant":""},
 {"text":"","expr":"8a-3+a-5","expr2":"","values":"","ask":"","form":"","variant":""}]}
{"slot":"Q18","kind":"find_error_collect","intro":"","givens":[],"table":{"head":[],"rows":[]},"items":[
 {"text":"","expr":"4a+3+a+2","expr2":"10a","values":"","ask":"","form":"","variant":"M1"},
 {"text":"","expr":"6x+7-1-2x","expr2":"4x+8","values":"","ask":"","form":"","variant":"M2"},
 {"text":"","expr":"5b+2a+b","expr2":"5b+2a","values":"","ask":"","form":"","variant":"M3"}]}
```

Printed and keyed:
- Q1: "מספר הגדול פי $4$ מ־$x$" → $4x$; "הסכום של $a$ ו־$b$" → $a + b$; "פי $3$ מ־$y$ ועוד $x$" → $3y + x$.
- Q7: "$4y − y$ עבור $y = −2$" → $−6$; then $11$ and $12$.
- Q13: $5x + 4$, $2y + 7$, $9a − 8$.
- Q18: "כינוס הביטוי $4a + 3 + a + 2$ נתן $10a$" → $5a + 5$; then $4x + 6$ and $6b + 2a$.

Probed refusals [V]:
- `7a-2a+4-a` (key $4a + 4$) → LEAK_PINNED_VALUE.
- Substitute items {−6, 11, 3} with "a = 3" printed earlier → the third item is LEAK_PINNED_VALUE.
- "מספר הגדול ב־$5$ מ־$x$" with key $x + 5$ → LEAK_PINNED_VALUE.

This last case is why no `W_*` template has an additive constant (§2.7).

### 2.2 Given/Ref model (specified now; the stage-2 kinds use none)

- **Given.** `id` is n1..n8, unique. `type` ∈ number, decimal, fraction, percent, money, measure, count, var, expr, fact, list. `value` is a school literal. It parses with `school_math.parse` for types number, decimal, percent, var, expr, and through a type-specific reader later. `unit` comes from the overlay's unit enum, or "".
- **Ref.** `{nK}` (regex `\{n([1-8])\}`) may appear in text fields (`intro`, `text`, table cells) and as an atom in math fields.
  - REF_UNDECLARED: a ref with no given.
  - REF_UNUSED: a given never referenced.
  - TEXT_GLUED_REF: a Hebrew prefix letter glued to a ref without a maqaf (`ב{n1}`). `ב־{n1}` is fine.
  - TEXT_PAREN_ADJACENT: a bracket next to a ref.
- In math, `school_math.resolve` replaces each `Ref` with the given's parsed literal before kernel conversion.
- In text, a ref prints as one display atom. A Hebrew unit word goes outside the atom, joined by U+00A0. That is stage 3.
- **Stage 2:** `item_kinds` refuses any non-empty `givens` (FIELD_NOT_EMPTY). `text_lint` and `school_math` still implement refs and unit-test them.

### 2.3 Plan rows and reserves

```python
@dataclass(frozen=True)
class PlanRow:
    slot: str                 # "Q1".."QN" | "R1".."RR"
    number: int               # planned position 1..N (Q) | reserve index 1..R (R)
    group: str                # "practice" | "challenges"
    concepts: tuple[str, ...] # concept ids, e.g. ("g7:algebraic_expressions#0",)
    kinds: tuple[str, ...]    # kinds allowed for this row (overlay)
```

- **Practice rows Q1..Q(N−3).** Their concepts come from `skill_authoring.question_plan(lesson, scope)` rows 1..N−3, the unchanged rotation [V skill_authoring.py:12-28]. For N = 20 that is Q1–Q6 → #0, Q7–Q12 → #1, Q13–Q17 → #2 [V ran `question_plan` on the fixture]. `kinds` = the union of `overlay.conceptKinds[c]` over the row's concepts.
- **Challenge rows Q(N−2)..QN.** `kinds` = every overlay challenge kind; `concepts` = the concepts those kinds exercise. Stage 2: `("find_error_collect",)`, (#2). This is a deliberate difference from `question_plan`, which rotates challenges over the concepts [V skill_authoring.py:19-21] [I].
- **Reserves.** `lesson_select.reserve_groups(N)`:
  - practice = max(3, ⌈0.2·(N−3)⌉);
  - challenges = 1 if N < 20, else 2.
  - N=20 → R1–R4 practice (concepts rotate in catalog order: #0, #1, #2, #0), R5–R6 `find_error_collect`.
- **Printed order** = `Selection.layout()`: ordinary questions first, then challenges, each by planned number [V B:lesson_select.py:150-153].

### 2.4 School grammar and CST (`school_math`)

ASCII only, plus one normalisation: U+2212 is read as `-`. Whitespace may separate tokens, but never split a number.

```text
display := expr ( '=' expr )?                         # relation only where the caller allows it
expr    := [ '-' ] term ( ('+' | '-') term )*         # a unary minus only at the start of an expr
term    := power ( ( '*' | '/' | ':' ) power | IMPLICIT power )*
power   := atom [ '^' INT ]
atom    := NUMBER | LETTER | REF | '(' expr ')'
NUMBER  := DIGITS [ '.' DIGITS ] [ '%' ]     LETTER := one of the declared lowercase letters     REF := '{n'[1-8]'}'
IMPLICIT:= a next token that starts with LETTER, REF or '('    (never a NUMBER: "x3", "3 4", ")3" → MATH_PARSE)
```

Rules that follow from the grammar:
- A unary minus after any operator is refused ("5--2", "5+-2", "3*-2"). It must be written in brackets: `5-(-2)`.
- `-3^2` → `Neg(Power(3,2))`, which is −9.
- `(-3)^2` → `Power(Group(Neg(3)),2)`, which is 9.

CST nodes are frozen dataclasses with structural equality. `parse(unparse(n)) == n`.

| Node | Fields | Meaning |
|---|---|---|
| `Num` | `text: str` | Literal as written (`"12"`, `"2.5"`, `"30%"`). `.value` → `Fraction` |
| `Var` | `name: str` | One declared letter |
| `Ref` | `given: str` | `"n1"`..`"n8"` |
| `Neg` | `operand` | A leading unary minus |
| `Group` | `inner` | Brackets exactly as written |
| `Sum` | `first, rest: tuple[(op, node)]` | op ∈ `+`, `-`; `len(rest) ≥ 1` |
| `Product` | `first, rest: tuple[(op, node)]` | op ∈ `''` (implicit), `*`, `/`, `:` |
| `Power` | `base, exponent: int` | Exponent as written, 0..9 |
| `Relation` | `left, op, right` | op `=` only |

**Monomial sum** (the stage-2 shape behind `school_math.terms`):
- A `Sum`, or a single term.
- Each term is `Num`, `Var`, a `Product` of an optional leading `Num` and 1–2 distinct `Var`s joined implicitly, or `Group(Neg(Num))`.
- The first term may be wrapped in `Neg`.

`Term(sign ±1, coefficient: Fraction > 0, signature: tuple of sorted letters (() = constant), implicit_one: bool, spelling: tuple of letters as written)`.

### 2.5 Kernel AST (what `math_tasks.validate_and_solve_task` accepts) [V math_tasks.py:36,85-121,668-782]

- **number:** `{"type":"number","numerator":int,"denominator":int>0}`. Build it with `math_tasks.number(n, d)`, which reduces it and keeps the sign on the numerator.
- **symbol:** `{"type":"symbol","name": "x"|"y"|"a"|"b"}`. These are the only symbols.
- **operation:** `{"type":"operation","op":op,"args":[…]}`.
  - `add` and `multiply` take 2–6 args.
  - `subtract`, `divide` and `power` take exactly 2.
  - `sqrt` takes 1.
  - A `power` exponent must be an integer number literal, |e| ≤ 4.
- **Limits:** ≤128 nodes, depth ≤12, |integer| ≤ 1,000,000.
- **Tasks used in stage 2:**
  - `{"kind":"simplify","expression":E}` runs `S.cancel` [V :774].
  - `{"kind":"substitute","expression":E,"values":{"y":number}}`. The values must exactly cover the free symbols and be literal numbers [V :713-721, 757-768].
  - The result is `{"type":"expression","value":AST}` [V :777].
- Errors are `MathTaskError(code)`. The codes are INVALID_TASK, INVALID_AST, UNDEFINED_TASK, RESOURCE_LIMIT, UNSUPPORTED_POWER, UNSUPPORTED_SYMBOLIC_ROOT, UNSUPPORTED_ROOT, UNSUPPORTED_RESULT, UNSUPPORTED_EQUATION, EMPTY_DOMAIN, UNVERIFIED_SOLUTION, UNSUPPORTED_SYSTEM, UNSUPPORTED_COMPARISON, UNSUPPORTED_DOMAIN, UNSUPPORTED_TASK, OUTSIDE_DOMAIN [V grep]. v5 reports `KERNEL_<code>`.

CST → kernel (`school_math.to_kernel`; letters map by identity in stage 2, §2.7):

| CST | Kernel |
|---|---|
| `Num` | `number(p, q)` of `.value` |
| `Var(v)` | `symbol(mapping[v])` |
| `Neg(Num n)` | `number(−n)` |
| `Neg(t)` | `multiply(number(−1), K(t))` |
| `Group(e)` | `K(e)` |
| `Sum` | Left-associative binary `add`/`subtract` chain |
| `Product` | Left-associative chain: `''`/`*` → `multiply`, `/`/`:` → `divide` |
| `Power(b, e)` | `power(K(b), number(e))` |
| `Ref`, `Relation` | `SchoolMathError("MATH_PARSE")`. Resolve or split first |

Example: `3x+5+2x-1` →
```json
{"type":"operation","op":"subtract","args":[{"type":"operation","op":"add","args":[{"type":"operation","op":"add","args":[
 {"type":"operation","op":"multiply","args":[{"type":"number","numerator":3,"denominator":1},{"type":"symbol","name":"x"}]},
 {"type":"number","numerator":5,"denominator":1}]},{"type":"operation","op":"multiply","args":[{"type":"number","numerator":2,
 "denominator":1},{"type":"symbol","name":"x"}]}]},{"type":"number","numerator":1,"denominator":1}]}
```

### 2.6 IR: v4 typed source plus v5 additions, and where they are accepted

The compiled sheet is a v4 source [V general_source.py:184-297] with these additions. **They are accepted only when the root carries `"contract": "worksheet-wire/5"`.** Closed authors and v4 never set it, so the added branches are unreachable for them [I; proven by §6.3].

| # | Addition | Shape | v4 behaviour without the marker |
|---|---|---|---|
| 0 | Root marker | `"contract": "worksheet-wire/5"` (`general_source.V5_CONTRACT`, equal to `structured_contract.CONTRACT`) | Extra root key → SOURCE_SHAPE (as today, :192) |
| 1 | Display span | `{"kind":"display","notation": <canonical school grammar>, "symbols": [letters]}` | SOURCE_RICH_TEXT (as today, :100-101) |
| 2 | `answer.printTask` | always `false` | SOURCE_SHAPE (:249) |
| 3 | `answer.key` | `{"form": "expression"\|"integer", "notation": <canonical school grammar>, "symbols": [...], "binding": {...}}` | SOURCE_SHAPE |
| 4 | Kernel `divide_remainder` | **not in stage 2.** `math_tasks.py` does not change | — |
| 5 | Root `selection` | below | SOURCE_SHAPE |

`key.binding` (fixed layouts in §2.7):
- `{"kind":"collect_like_terms"}`
- `{"kind":"substitute"}`
- `{"kind":"write_from_words","template":"W_TIMES"}`
- `{"kind":"find_error_collect","model":"M1"}`

```json
"selection": {"requested": 20, "floor": 20, "delivered": 20,
  "questions": [{"n": 1, "slot": "Q1", "origin": "planned", "conceptIds": ["g7:algebraic_expressions#0"], "star": false}],
  "replaced":  [{"slot": "Q4", "by": "R1", "codes": ["ITEM_COUNT", "TEMPLATE_MISMATCH"]}],
  "dropped":   []}
```

How `structured_contract.validate_selection` checks the record:
- `requested` = `lesson.questionCount`.
- `floor` = `runtime_catalog.question_floor(grade)`, recomputed [V runtime_catalog.py:28-29].
- floor ≤ delivered ≤ requested, and delivered = the number of IR questions.
- `len(dropped)` = requested − delivered.
- `questions[i].n` = i+1, in printed order. Slots are unique and match `^(Q|R)[1-9][0-9]?$`. `origin` ∈ planned | reserve | repair.
- Each `conceptIds` is a non-empty subset of the selected concepts, and their union equals all selected concepts. Otherwise SOURCE_COVERAGE.
- `questions[i].star` equals the IR question's `star`.
- `by` matches `^(R[1-9][0-9]?|REPAIR)$`. Codes match the code regex, ≤16 per entry. `replaced` has ≤32 entries.

Example IR item (one per kind; `K(...)` is §2.5):

```json
{"intro":[{"kind":"text","text":"כנסו איברים דומים:"}],"star":false,"items":[
 {"prompt":[{"kind":"display","notation":"3x+5+2x-1","symbols":["x"]}],
  "answer":{"kind":"computed","task":{"kind":"simplify","expression":"K(3x+5+2x-1)"},"unit":"","printTask":false,
            "key":{"form":"expression","notation":"5x+4","symbols":["x"],"binding":{"kind":"collect_like_terms"}}}}]}
substitute prompt: [{"kind":"display","notation":"4y-y","symbols":["y"]},{"kind":"text","text":" עבור "},
                    {"kind":"display","notation":"y=-2","symbols":["y"]}]
           task: {"kind":"substitute","expression":"K(4y-y)","values":{"y":{"type":"number","numerator":-2,"denominator":1}}}
           key:  {"form":"integer","notation":"-6","symbols":[],"binding":{"kind":"substitute"}}
write_from_words prompt: [{"kind":"text","text":"מספר הגדול פי "},{"kind":"display","notation":"4","symbols":[]},
                          {"kind":"text","text":" מ־"},{"kind":"display","notation":"x","symbols":["x"]}]   task simplify(K(4x))
find_error_collect prompt: [{"kind":"text","text":"כינוס הביטוי "},{"kind":"display","notation":"4a+3+a+2","symbols":["a"]},
                            {"kind":"text","text":" נתן "},{"kind":"display","notation":"10a","symbols":["a"]}]  key "5a+5"
```

Root: `{"version":4,"contract":…,"title":overlay.title,"rule":overlay.rule,"sections":[{"title":overlay.title,"conceptIds":[all selected],"questions":[…printed order…]}],"selection":{…}}`.

**`general_source.py` hook points (E4).** Every `else` keeps today's code.

- **H1 (:192)**
  ```python
  v5 = type(payload) is dict and payload.get("contract") == V5_CONTRACT
  if v5:
      exact(payload, ("version","contract","title","rule","sections","selection"))
      overlay = _v5_overlay(lesson, scope)
  else:
      exact(payload, (...as today...))
  ```
  `_v5_overlay`: `skillId == "middle"` and `structured_contract.overlay_for(topicId, level)` is not None. Otherwise SOURCE_V5_SCOPE.
- **H2.** `rich(value, grade, *, provider=False, location="", v5=False)`. All 6 call sites (:200, 216, 225, 230, 243, 270) pass `v5=v5`. When v5:
  - the provider pre-pass (:63-74) is skipped;
  - span kinds other than `text`/`display` → SOURCE_RICH_TEXT;
  - `display` → `item_kinds.check_display_span(span, overlay)`, else SOURCE_DISPLAY;
  - each text span → `text_lint.check_ir_text`, else SOURCE_PLAIN_MATH;
  - the whole list → `text_lint.check_ir_spans`, else SOURCE_ATOM.
- **H3 (:214).** v5: `exact(question, ("intro","star","items"))`. No table, figure or drawingFromWords in stage 2.
- **H4 (:238).** v5: 3 ≤ items ≤ 6 (the house maximum) [V SKM curriculum_tashpaz.json:1680 via plan].
- **H5 (:248-273).** v5:
  - kind must be `computed`, else SOURCE_ANSWER;
  - `exact(answer, ("kind","task","unit","printTask","key"))`;
  - `unit == ""` and `printTask is False`, else SOURCE_SHAPE;
  - `solved = validate_and_solve_task(task)`;
  - `item_kinds.verify_item(item["prompt"], answer, solved, overlay)`. A `BindingError(c)` maps to SOURCE_KEY when c ∈ {KEY_ROUNDTRIP, FORM_UNREPRESENTABLE, FORM_UNKNOWN}, else SOURCE_BINDING. The message is `"<c> at q{n}.item.{j}"`;
  - `evidence.append` exactly as today.
  - `printed_intent` (:251-253) is unreachable: v5 is middle only.
- **H6 (:274-279).** v5 replaces only the exact-count line (:274-275):
  - `validate_selection(...)`, plus `4 ≤ qcount ≤ 30` and `item_count ≤ MAX_ITEMS` (SOURCE_VOLUME).
  - Unchanged: the coverage line (:276-277, one section with all concepts) and the 2–4 stars line (:278-279).
  - Then: `item_kinds.verify_question(q, overlay)` for each question (SOURCE_BINDING); `leak_checks.question_leaks(q, overlay, skill_path=None)` and `leak_checks.sheet_leaks(questions)` (any hit → SOURCE_LEAK).
  - Everything from :280 on is unchanged.

`validate_source` stays the final authority, and v5 only adds refusals. The one v4 rule v5 replaces is the exact count (:274-275). The selection rule recomputes the floor and, at stage 2's N = floor = 20, is equivalent to it. In v4 the adapter printed the task itself, so the print always matched the task (:494-495). In v5 the adapter prints the display instead, and `verify_item` keeps that guarantee by checking structurally that the display is the task (§3 `item_kinds`) [I].

**`general_adapters.py` hook points (E4).**
- **A1** `rich_text` (:147-158):
  - add `elif span["kind"]=="display":` → `school_math.display_island(span)` for middle; GeneralSourceError("SOURCE_V5_SCOPE") when `H` is set;
  - add a final `else: raise GeneralSourceError("SOURCE_RICH_TEXT", ...)`. Today unknown kinds are silently dropped [V :147-158]. That branch is unreachable for validated v4 input.
- **A2** `_compile_middle` (:448-532), with `v5 = source.get("contract") == V5_CONTRACT`:
  - :460 `bank = None`;
  - :480-493 `printed = bound = label = None` (no legacy binders);
  - :494-496 `body = prompt`, `answer = school_math.key_island(item["answer"]["key"])` (no task text);
  - :520 `"grade": structured_contract.GRADE_LINE[gradeNumber]` → "כיתה ז׳" (D10);
  - :526 meta gets `"contract"`.
  - Unchanged: `given=[body]` (:500), `to_prove`, `space`, answers, the canon, verified.json, and the content.py bridge with `PACKAGE "G7-T90"` (:532).
- **A3** `compile_source` (:315-344): v5 with an elementary skill → SOURCE_V5_SCOPE (a guard only).

### 2.7 The g7 overlay (`structured_contract.OVERLAYS["g7:algebraic_expressions"]`; D7: `reviewed: False` until Noam signs — he approved it on 2026-11-25, see §13)

```python
{"topicId": "g7:algebraic_expressions", "reviewed": False, "levels": ("b",),
 "title": "ביטויים אלגבריים: הצבה וכינוס איברים דומים",      # the catalog title names חוק הפילוג and זהות [V curriculum row]
 "letters": ("x", "y", "a", "b"),                            # = kernel symbols, identity map in stage 2 [V math_tasks.py:36]
 "conceptKinds": {"g7:algebraic_expressions#0": ("write_from_words",),
                  "g7:algebraic_expressions#1": ("substitute",),
                  "g7:algebraic_expressions#2": ("collect_like_terms",)},
 "challengeKinds": {"find_error_collect": ("g7:algebraic_expressions#2",)},
 "profile": {"literal_max": 20, "result_literal_max": 99, "value_min": -10, "value_max": 10,
             "terms_max": 4, "letters_max": 2, "power": False, "division": False, "decimal": False,
             "percent": False, "explicit_product": False, "brackets": "negative_number"},
 "verbs": {"write_from_words":   "כתבו ביטוי אלגברי מתאים לכל תיאור:",
           "substitute":         "חשבו את ערך הביטוי:",
           "collect_like_terms": "כנסו איברים דומים:",
           "find_error_collect": "בכל סעיף תלמיד כינס איברים דומים וטעה. רשמו את התוצאה הנכונה."},
 "rule": [{"kind": "text", "text": "ביטוי אלגברי הוא ביטוי שיש בו מספרים, משתנים ופעולות חשבון. כדי למצוא את ערך "
           "הביטוי מציבים מספר במקום המשתנה. איברים דומים הם איברים שיש להם אותו חלק של משתנים. כדי לכנס איברים "
           "דומים מחברים או מחסרים את המספרים שלפני המשתנה, למשל: "},
          {"kind": "display", "notation": "3x+5x=8x", "symbols": ["x"]}, {"kind": "text", "text": "."}],
 "ruleFacts": (("3x+5x", "8x"),),
 "forbiddenTerms": ("חוק הפילוג", "פילוג", "זהות", "משוואה", "חזקה", "שוויון"),
 "mistakes": ("M1", "M2", "M3")}
```

- **"משוואה" is not-yet for this topic in the pinned curriculum**, yet the pinned G84 does not catch it. G84 has only 19 regex rules; for this topic the active ones are all geometry theorems [V scratch probe of `build_plus.assert_chronology`/`didactic.curriculum_block`]. G86-terms is skipped for legacy packages. **`TEXT_FORBIDDEN_TERM` is therefore the real guard.**
- None of the strings in this section contains any of the 71 not-yet tool keywords, and none trips G84 [V scratch probe].

**Tier A templates** for `write_from_words`. `k, m` ∈ 2..20; `v ≠ w` ∈ letters. Every number is glued to a letter as a coefficient, so the key has no standalone integer and the pinned D12 has no atom to match. The pinned `fnums` skips `5x` [V check_didactic.py:1945-1956, probe].

| id | CST pattern of `expr` | Prompt layout (T = text span, D = display) | Key |
|---|---|---|---|
| W_TIMES | `Product(Num k,('',Var v))` | T"מספר הגדול פי " D(k) T" מ־" D(v) | `kv` |
| W_SUM | `Sum(Var v,('+',Var w))` | T"הסכום של " D(v) T" ו־" D(w) | `v + w` |
| W_DIFF | `Sum(Var v,('-',Var w))` | T"ההפרש בין " D(v) T" לבין " D(w) | `v − w` |
| W_PRODUCT | `Product(Var v,('',Var w))` | T"המכפלה של " D(v) T" ב־" D(w) | `vw` |
| W_TIMES_PLUS | `Sum(kv,('+',Var w))` | T"פי " D(k) T" מ־" D(v) T" ועוד " D(w) | `kv + w` |
| W_TIMES_MINUS | `Sum(kv,('-',Var w))` | T"פי " D(k) T" מ־" D(v) T" פחות " D(w) | `kv − w` |
| W_TWO_TIMES | `Sum(kv,('+',mw))` | T"פי " D(k) T" מ־" D(v) T" ועוד פי " D(m) T" מ־" D(w) | `kv + mw` |

**Fixed layouts for the other kinds:**
- **collect:** [D(expr)].
- **substitute:** [D(expr), T" עבור ", D(v=n)], and when there are 2 letters, add [T" ו־", D(w=m)].
- **find_error:** [T"כינוס הביטוי ", D(expr), T" נתן ", D(wrong)].

`wrong` is printed by code from M(expr) in canonical form. The model's `expr2` only has to equal it. No false "=" is printed, so no pinned truth check can object [I].

**Mistake models** act on the terms of a monomial sum. `apply` checks only structural preconditions; `item_kinds` makes the comparisons.
- **M1** adds all signed coefficients and constants into one term with the first letter signature.
  - Precondition: ≥2 distinct signatures. K ≠ 0.
  - `4a+3+a+2` → `10a`.
- **M2** writes `+` for the first term joined by a binary `−`.
  - Precondition: such a term exists.
  - `6x+7-1-2x` → `4x+8`.
- **M3** drops the first term written as a bare letter (implicit 1) that has a like term elsewhere.
  - Precondition: such a term exists.
  - `5b+2a+b` → `5b+2a`.

### 2.8 Middle-skill emission and RTL atoms (how v5 must emit)

**How the pinned emitter works** [V SKM/emit_html.py]:
- `seg` splits on `$` and raises on an odd count. In prose it raises on any `\` and any stray `*` (:446-481).
- Islands become `<span class="m">` with `direction:ltr; white-space:nowrap` (:476-480, CSS :543-544); `body` is `direction:rtl` (:534).
- `m_body` handles:
  - `\f{n}{d}` (stacked fraction, :284-294);
  - `\g{…}` (stretched brackets, :295-301);
  - `^{…}` → `<sup>` (:302-310);
  - `\%` → a literal `%` inside the island (:362-367).
  - An unknown macro raises (:397-400).
- `_plain` puts binary `+`/`−` in `.op1` and relations in `.op2`. ASCII `-` and U+2212 are the same sign; a unary minus stays glued (:118-156).
- A space between an island and the next punctuation mark is stripped (:443).
- Question and answer markers come only from `ltr_marker` → `(n)`, asserted by `MARKER_RE ^\(\d+\)$` (:702, 748-757). Hebrew item labels print as `א.` (:720-745).
- **WeasyPrint 70 drops `unicode-bidi`.** The only working isolation is one `direction:ltr` element holding the whole token [V facts render-rtl §5].

**Rules for v5** (enforced by `school_math.to_house`, `text_lint` and `atom_order`):
1. Every number, letter, expression or relation is exactly one `$…$` island built by code: one display span → one island. Text spans hold only Hebrew and punctuation, with no digits, Latin letters or `+ − × ÷ = < > % ° ² √ · / * ^ $ \ [ ] { }`.
2. Two islands are always separated by a text span that contains a Hebrew letter. No bracket sits in prose next to an island.
3. Inside an island:
   - U+2212 for every minus (never ASCII `-`);
   - single spaces around binary operators and `=` (`5x + 4`, `y = −2`);
   - unary minus glued (`−6`);
   - implicit products side by side (`5x`, `xy`); explicit `*` prints ` · ` (refused by the stage-2 profile);
   - brackets exactly as written, plain `(`/`)` for flat content.
   - Stage 3 adds `\f{}{}`, `^{}`, `\g{}` around non-flat content, and `30\%` inside the island.
4. Units: symbol units go inside the island; Hebrew unit words go outside with U+00A0. That is stage 3; stage 2 requires `unit == ""`.
5. Keys use the same printer. Terms appear in first-appearance order, with the letters spelled as first written. Examples: `5x + 4`, `7 + 3x` for `5+3x+2`, and `−2a + 10` kept as written (D10).
6. The adapter never emits markers or labels; the pinned skill does. The grade line is "כיתה ז׳" (D10). `deliver` reads it, but the curriculum block resolves the track from `curriculum.track`, so the text form is safe [V didactic.py:1694-1700; build_plus.py:160] [I until the offline build].

---

## 3. Public interfaces

Docstrings are binding. `Node` = any CST node. All functions are pure unless they say otherwise.

```python
# ---------------- school_math.py (E1) ----------------
class SchoolMathError(ValueError):
    """code ∈ MATH_PARSE, MATH_LENGTH, MATH_SYMBOL_UNDECLARED, REF_UNDECLARED, FORM_UNREPRESENTABLE."""
    def __init__(self, code: str, message: str): ...
def parse(text: str, *, letters, allow_relation: bool = False, max_length: int = 120) -> Node:
    """Parse school grammar (§2.4) into a CST. Letters outside `letters` → MATH_SYMBOL_UNDECLARED."""
def parse_values(text: str, *, letters) -> tuple[tuple[str, int], ...]:
    """'y=-2' or 'x=3, y=-1' → (('y', -2),). Integer values only; a malformed value → MATH_PARSE."""
def unparse(node: Node) -> str:
    """Canonical ASCII form, no spaces, U+2212 never used. parse(unparse(n)) == n."""
def letters_of(node: Node) -> tuple[str, ...]:
    """Declared letters in order of first appearance."""
def resolve(node: Node, givens) -> Node:
    """Replace every Ref with the Num of its given; unknown ref → REF_UNDECLARED."""
def check_scope(node: Node, profile, *, role: str = "task") -> list[str]:
    """Sorted unique MATH_SCOPE_* codes, [] when in scope. Each offending node gives only its most specific code:
    a bracketed sum used as a factor → PRODUCT_OF_SUM (not BRACKETS/PRODUCT); any other Group except Group(Neg(Num))
    → BRACKETS; Power or a repeated letter → POWER (not PRODUCT); explicit '*' → PRODUCT; '/' ':' → DIVISION;
    decimals → DECIMAL; '%' → PERCENT; literals > literal_max → RANGE; TERMS and LETTERS once per expression.
    role 'result' uses result_literal_max; role 'value' checks value_min..value_max."""
def terms(node: Node) -> tuple["Term", ...]:
    """Signed monomial terms of a monomial sum (§2.4); anything else → SchoolMathError MATH_PARSE."""
def is_collected(node: Node) -> bool:
    """True when no two terms share a signature."""
def to_kernel(node: Node, mapping=None) -> dict:
    """Kernel AST per §2.5; letters outside the kernel symbols need `mapping` (stage 2: identity)."""
def polynomial_of_kernel(ast: dict) -> dict:
    """Kernel result → {signature: Fraction}; divide by a non-number, sqrt or a negative power → FORM_UNREPRESENTABLE."""
def first_appearance(node: Node) -> tuple[tuple[tuple[str, ...], tuple[str, ...]], ...]:
    """((signature, spelling), ...) in first written order."""
def key_node(poly: dict, order) -> Node:
    """Collected CST: monomials in `order`, then the rest by (-degree, signature); zero → Num('0')."""
def kernel_equal(node: Node, ast: dict, mapping=None) -> bool:
    """True iff the kernel simplifies (node − ast) to the number 0; any kernel error → False."""
def to_house(node: Node) -> str:
    """House DSL for the inside of $…$ (§2.8). Never emits ASCII '-'."""
def from_house_flat(text: str, *, letters, allow_relation: bool = False) -> Node:
    """Inverse of to_house for flat output (used by DISPLAY_ROUNDTRIP)."""
def display_island(span: dict) -> str:
    """'$' + to_house(parse(span['notation'], letters=span['symbols'], allow_relation=True)) + '$'."""
def key_island(key: dict) -> str:
    """'$' + to_house(parse(key['notation'], letters=key['symbols'])) + '$'."""

# ---------------- mistake_models.py (E1) ----------------
MISTAKES = ("M1", "M2", "M3")
class MistakeError(ValueError):
    """code ∈ MISTAKE_UNKNOWN, MISTAKE_NOT_APPLICABLE."""
def apply(model: str, node: Node) -> dict:
    """The student's polynomial {signature: Fraction} under `model` (§2.7); checks preconditions only."""

# ---------------- structured_contract.py (E2) ----------------
CONTRACT = "worksheet-wire/5"; CODE_RE = re.compile(r"^[A-Z_]{1,60}$"); SLOT_RE = re.compile(r"^(?:Q|R)[1-9][0-9]?$")
CODES: frozenset          # every code of §4 except KERNEL_* (validated by prefix)
QUESTION_FIELDS = ("slot","kind","intro","givens","table","items"); ITEM_FIELDS = ("text","expr","expr2","values","ask","form","variant")
GIVEN_FIELDS = ("id","type","value","unit"); GIVEN_IDS = ("n1",...,"n8"); GIVEN_TYPES = (...§2.2...)
LIMITS = {"intro":300,"text":200,"expr":120,"expr2":120,"values":40,"cell":40,"given_value":60,
          "items_min":3,"items_max":6,"givens_max":8,"table_cols":6,"table_rows":8,"reply_bytes":200_000}
FORMS = ("expression","integer"); GRADE_LINE = {7:"כיתה ז׳",8:"כיתה ח׳",9:"כיתה ט׳"}; OVERLAYS = {...§2.7...}
class SelectionError(ValueError):
    """code ∈ SOURCE_SELECTION, SOURCE_COVERAGE; reason is short English, never model text."""
def kernel_code(math_task_code: str) -> str:
    """'KERNEL_' + code; ValueError unless the result matches CODE_RE."""
def overlay_for(topic_id: str, level: str):
    """The frozen overlay when topic and level are v5-enabled, else None."""
def slot_names(planned: int, reserves: int) -> tuple[str, ...]:
    """('Q1'..'QN', 'R1'..'RR')."""
def wire_schema(lesson, scope, overlay, reserves: int) -> dict:
    """Strict-mode JSON Schema of §2.1: root object, all keys required, additionalProperties false, enums for
    slot/kind/form/variant; no anyOf/oneOf/allOf/pattern/const/format. Advisory; parse_wire decides."""
def validate_selection(selection, *, lesson, scope, questions) -> None:
    """Final-authority check of the IR selection record (§2.6); raises SelectionError."""

# ---------------- text_lint.py (E2) ----------------
REF = re.compile(r"\{n([1-8])\}"); ARGUMENT_WORDS = ("הוכיחו","הראו","נמקו","הסבירו","מדוע","למה","בדקו","שכנעו","ודאו","אמתו")
NUMBER_WORDS: tuple      # closed strong list (אפס…עשרים, שלושים…תשעים, מאה, מאתיים, אלף, חצי, שליש, רבע, תריסר, פעמיים)
def lint_model_text(text: str, *, grade: int, declared, forbidden_terms, max_length: int) -> tuple[list[str], tuple[str, ...]]:
    """(codes, refs used) for one model text field: TEXT_LENGTH, TEXT_MARKUP (CONTROL/MARKUP of general_source :17-18),
    TEXT_CHAR, TEXT_GLUED_REF, TEXT_PAREN_ADJACENT, TEXT_NUMBER_WORD, TEXT_ARGUMENT_REQUEST, TEXT_FORBIDDEN_TERM,
    TEXT_DRAWING_REQUEST (general_source.DRAWING_REQUEST, imported), TEXT_NIQQUD, TEXT_NOT_HEBREW, REF_UNDECLARED."""
def check_ir_text(text: str) -> list[str]:
    """Codes for one code-written IR text span: TEXT_MARKUP, TEXT_CHAR; TEXT_NOT_HEBREW unless punctuation only."""
def check_ir_spans(spans: list) -> list[str]:
    """Atom rule over one span list: ATOM_ADJACENT (two displays without a Hebrew text span between),
    TEXT_PAREN_ADJACENT (a text span ending '(' or starting ')' next to a display)."""
def lint_levels(levels: list) -> list[tuple[str, str]]:
    """Pre-render lint of every levels.json string (title, rule, intros, item texts, answers): outside $…$ no digit,
    Latin or math symbol; Hebrew between islands; even '$' count. Returns [(json_path, code)]."""
# CLI: python3 -B text_lint.py --levels <levels.json>  → exit 0 clean, 1 findings (codes and paths on stdout)

# ---------------- leak_checks.py (E2) ----------------
def pinned_module(skill_path: str, filename: str = "check_didactic.py"):
    """Import a stdlib-only pinned module by path after a sha256 check against skill-lock.json (middle);
    no sys.path change, sys.dont_write_bytecode held True. Mismatch → ValueError('SKILL_HASH_MISMATCH'). Cached."""
def d12_mirror(question: dict, skill_path: str) -> list[int]:
    """1-based item indices the pinned D12 would FAIL or REVIEW, using the pinned f_atoms/f_hit on the exact strings
    the adapter emits: atoms = f_atoms(key_island(key)); words = [intro text] + every item's rendered prompt.
    No stated-given exemption, no givens read (G6); later items count too (pinned REVIEW, v5 refuses)."""
def question_leaks(question: dict, overlay, *, skill_path: str | None) -> list[tuple[int, str]]:
    """[(item index, code)] over one IR question: DUPLICATE_ITEM (later item), LEAK_OWN, LEAK_LINKED (later item),
    LEAK_RULE_FACT and, when skill_path is given, LEAK_PINNED_VALUE. Monotone: removing items never adds a hit."""
def sheet_leaks(questions: list) -> dict[int, list[str]]:
    """{0-based index of the LATER question: sorted codes} for DUPLICATE_TASK and LEAK_SHEET_INVERSE (§4)."""

# ---------------- item_kinds.py (E3) ----------------
@dataclass(frozen=True)
class Context:
    lesson: dict; scope: dict; overlay: dict; skill_path: str | None
@dataclass
class CompiledItem:
    index: int; prompt: list | None; answer: dict | None; solved: dict | None; refusals: list   # [(field, code)]
class BindingError(ValueError):
    """code = one item-level code of §4."""
KINDS = ("write_from_words","substitute","collect_like_terms","find_error_collect"); TEMPLATES: dict; LAYOUT_TEXT: dict
def intro_spans(kind: str, overlay) -> list:
    """[{"kind":"text","text": overlay.verbs[kind]}]."""
def compile_item(kind: str, item: dict, index: int, ctx: Context) -> CompiledItem:
    """Wire item → IR prompt and answer (§2.6) through checks I1–I6 (§4); ends by calling verify_item."""
def verify_item(prompt: list, answer: dict, solved: dict, overlay) -> None:
    """IR re-check shared by compile and general_source: layout of key.binding.kind, display parse and scope of the task
    expression, structural equality to_kernel(display) == task.expression, template or mistake or values binding,
    key form, KEY_ROUNDTRIP (kernel_equal). Raises BindingError."""
def verify_question(question: dict, overlay) -> None:
    """All items share one binding kind; intro == intro_spans(kind); star is True iff the kind is a challenge kind."""
def check_display_span(span: dict, overlay) -> None:
    """exact keys; symbols are distinct overlay letters (≤4); notation parses (allow_relation) with letters ⊆ symbols;
    to_kernel of each side passes math_tasks.inspect_ast. Raises BindingError('DISPLAY_INVALID' | 'MATH_SYMBOL_UNDECLARED')."""

# ---------------- lesson_select.py (E3, port of B:lesson_select.py minus soft/restore) ----------------
PRACTICE, CHALLENGES = "practice", "challenges"; MINIMUM_CHALLENGES = 2; NO_QUESTION = "QUESTION_MISSING"
def reserve_groups(planned: int) -> list[str]:
    """Practice ×max(3, ceil(0.2·(planned−3))), then challenges ×(1 if planned < 20 else 2)."""
class Selection:
    """As B:lesson_select.Selection (screen, reject, fill, layout, missing, real_challenges, reserves_left, summary,
    record) with: __init__(planned, reserves, predicate, shared=None, *, minimum: int) (minimum required = the grade floor);
    no `soft`; no restore(); can_shorten() = missing and present ≥ minimum and real_challenges ≥ 2."""
def select(planned, reserves, predicate, *, minimum: int) -> Selection:
    """Selection(...).screen() and return it."""

# ---------------- structured_source.py (E3) ----------------
@dataclass(frozen=True)
class Refusal:
    slot: str; item: int; field: str; code: str   # item 0 = question or sheet level
@dataclass
class CompiledQuestion:
    slot: str; kind: str | None; row: PlanRow | None; ir: dict | None; refusals: list; trimmed: tuple
    @property
    def codes(self) -> tuple: """() when printable, else sorted unique codes."""
class V5Error(ValueError):
    """Sheet-level failure: code ∈ WIRE_JSON, WIRE_SHAPE, V5_TOPIC_UNSUPPORTED, SHEET_BELOW_MINIMUM, SHEET_STARS,
    SHEET_COVERAGE, REPAIR_BUDGET, RUNTIME_NOT_CONFIGURED; .diagnostics holds codes only (G11)."""
@dataclass
class CompileResult:
    ir: dict; evidence: dict; diagnostics: dict
def plan_slots(lesson, scope, overlay) -> tuple[list[PlanRow], list[PlanRow]]:
    """Planned rows Q1..QN and reserve rows R1..RR (§2.3)."""
def parse_wire(reply, planned, reserves) -> tuple[dict, list[Refusal]]:
    """{slot: wire question} (first occurrence wins) plus refusals Q_SHAPE, Q_SLOT_UNKNOWN, Q_SLOT_DUPLICATE.
    A non-dict root, keys ≠ {'questions'} or more than 2·(N+R) entries → V5Error WIRE_SHAPE."""
def compile_question(wire: dict, row: PlanRow, ctx: Context) -> CompiledQuestion:
    """Checks Q1–Q5 and per item I1–I6 (§4); refused items are trimmed while ≥3 clean items remain."""
def compile_reply(lesson, scope, reply, *, skill_path: str, repairs=(), overlay=None) -> CompileResult:
    """Wire reply plus ≤2 repair rounds ({slot: wire question}) → validated v4+v5 IR. Order: plan → parse → compile
    every question once → Selection.screen → sheet loop → repair rounds (fill, sheet loop) → acceptance (§4) → build IR
    → general_source.validate_source. Raises V5Error; GeneralSourceError from validate_source is an internal bug."""
def repair_targets(diagnostics: dict) -> list[dict]:
    """[{slot, group, concepts, kinds, codes}] for still-missing slots, the input of a later repair prompt (no model text)."""
```

`compile_reply` diagnostics:
```json
{"contract":"worksheet-wire/5","requested":20,"floor":20,"delivered":20,"refusals":[{"slot","item","field","code"}],
 "trimmed":[{"slot":"Q12","items":[3]}],"selection":<Selection.summary()>,"record":<Selection.record>,"repairRounds":0}
```

---

## 4. Refusal codes, the per-question pipeline and the exact delivery rule

**Codes.** All match `^[A-Z_]{1,60}$`. Owners: E1 = school_math/mistake_models, E2 = text_lint/leak_checks/contract, E3 = item_kinds/structured_source/lesson_select.

| Stage | Codes |
|---|---|
| Sheet input (E3) | WIRE_JSON, WIRE_SHAPE, V5_TOPIC_UNSUPPORTED |
| Question shape (E3) | Q_SHAPE, Q_SLOT_UNKNOWN, Q_SLOT_DUPLICATE, Q_KIND_NOT_ALLOWED, FIELD_NOT_EMPTY, ITEM_COUNT, ITEM_SHAPE, QUESTION_MISSING |
| Text (E2) | TEXT_LENGTH, TEXT_MARKUP, TEXT_CHAR, TEXT_GLUED_REF, TEXT_PAREN_ADJACENT, TEXT_NUMBER_WORD, TEXT_ARGUMENT_REQUEST, TEXT_FORBIDDEN_TERM, TEXT_DRAWING_REQUEST, TEXT_NIQQUD, TEXT_NOT_HEBREW, ATOM_ADJACENT |
| References (E2/E1) | REF_UNDECLARED, REF_UNUSED, GIVEN_SHAPE, GIVEN_VALUE |
| Math (E1) | MATH_PARSE, MATH_LENGTH, MATH_SYMBOL_UNDECLARED, MATH_SCOPE_PRODUCT_OF_SUM, MATH_SCOPE_BRACKETS, MATH_SCOPE_POWER, MATH_SCOPE_DIVISION, MATH_SCOPE_DECIMAL, MATH_SCOPE_PERCENT, MATH_SCOPE_PRODUCT, MATH_SCOPE_RANGE, MATH_SCOPE_TERMS, MATH_SCOPE_LETTERS, MATH_SCOPE_RELATION, TASK_LITERAL |
| Kernel | KERNEL_ + each MathTaskError code (§2.5) |
| Key / display (E1/E3) | FORM_UNKNOWN, FORM_UNREPRESENTABLE, KEY_ROUNDTRIP, DISPLAY_ROUNDTRIP, DISPLAY_INVALID, BINDING_INTERNAL |
| Binding (E3/E1) | TEMPLATE_UNKNOWN, TEMPLATE_MISMATCH, VALUES_SHAPE, VALUES_MISMATCH, MISTAKE_UNKNOWN, MISTAKE_NOT_APPLICABLE, MISTAKE_UNMODELED, MISTAKE_NOT_WRONG, NOTHING_TO_DO, REVEALS_ANSWER |
| Leaks (E2) | DUPLICATE_ITEM, LEAK_OWN, LEAK_LINKED, LEAK_RULE_FACT, LEAK_PINNED_VALUE (the D12 mirror), DUPLICATE_TASK, LEAK_SHEET_INVERSE |
| Sheet (E3) | SHEET_BELOW_MINIMUM, SHEET_STARS, SHEET_COVERAGE, REPAIR_BUDGET, REPAIR_SLOT_NOT_MISSING |
| IR validator (E4, GeneralSourceError) | SOURCE_V5_SCOPE, SOURCE_DISPLAY, SOURCE_ATOM, SOURCE_KEY, SOURCE_BINDING, SOURCE_SELECTION, SOURCE_LEAK, plus the existing SOURCE_* |
| Runner / render (E4) | V5_SCOPE_UNSUPPORTED, PINNED_REPORT_MISSING, PINNED_REPORT_INVALID, ATOM_MISSING, ATOM_NOT_FLAT, ATOM_ANCHOR_MISSING, ATOM_PDF_UNREADABLE, ATOM_LEVELS_INVALID, PDF_PRODUCER_NOT_WEASYPRINT |

**Leak rules.** Values are exact polynomials from `school_math`. Keys equal to the constants 0 or 1 are ignored.
- **LEAK_OWN.** The key equals a printed atom of the item that is neither the task display nor one of its operands, or equals either side of a rule fact.
  - Example: `6x+2x`, key `8x` = the fact's right side.
  - Example: a find_error wrong result equal to the correct key.
- **LEAK_LINKED.** A key with ≥2 terms appears verbatim (canonical `unparse`) as a contiguous run of ≥2 terms in another item's display in the same question. The later item is refused.
- **LEAK_RULE_FACT.** A contiguous run of a task display has the same term multiset as a fact's left side (`5x+3x+1` contains `{3x,5x}`).
- **DUPLICATE_ITEM / DUPLICATE_TASK.** The same canonical task display, within a question or across the sheet.
- **LEAK_SHEET_INVERSE.** The LEAK_LINKED rule applied across questions, in both directions. The later question is refused.
- **LEAK_PINNED_VALUE.** The `d12_mirror` result.

Numeric chance matches between questions are allowed by design (the plan §c2).

**Per-question pipeline** (`compile_question`). Independent checks always run. A check whose input failed is skipped; it is not a pass, because the item is already refused.

| Step | Checks |
|---|---|
| Q1 Shape | Q_SHAPE; Q_KIND_NOT_ALLOWED (kind ∉ row.kinds); ITEM_COUNT (3..6 wire items); FIELD_NOT_EMPTY (intro, givens, table). (Q_SLOT_* come from `parse_wire`.) |
| Q2 Text | `lint_model_text` on every non-empty text field. In stage 2 these are all FIELD_NOT_EMPTY anyway |
| Q3 References | REF_UNDECLARED / REF_UNUSED (none can arise in stage 2) |
| I1 Item shape | ITEM_SHAPE; FIELD_NOT_EMPTY (fields the kind does not read); FORM_UNKNOWN; TEMPLATE_UNKNOWN / MISTAKE_UNKNOWN |
| I2 Parse | MATH_LENGTH, MATH_PARSE, MATH_SYMBOL_UNDECLARED (`expr`, `expr2`); VALUES_SHAPE (`values`) |
| I3 Scope | `check_scope`: role task for `expr`, result for `expr2`, value for values |
| I4 Binding | TEMPLATE_MISMATCH; VALUES_MISMATCH (value letters ≠ `letters_of(expr)`); MISTAKE_NOT_APPLICABLE; NOTHING_TO_DO (collect/find_error already collected); REVEALS_ANSWER (substitute `expr` is a bare letter) |
| I5 Kernel | `validate_and_solve_task(task)` → KERNEL_* |
| I6 Key and display | FORM_UNREPRESENTABLE (integer form needs a denominator-1 constant; expression form needs integer coefficients and no repeated letter); KEY_ROUNDTRIP; DISPLAY_ROUNDTRIP (`from_house_flat(to_house(n)) == n`); MISTAKE_UNMODELED (polynomial of `expr2` ≠ M(expr)); MISTAKE_NOT_WRONG (M(expr) = correct); then `verify_item`, whose failure here is BINDING_INTERNAL |
| Q4 Leaks | `question_leaks(ir_question, overlay, skill_path=ctx.skill_path)` |
| Q5 Trim | Drop refused items. If <3 remain, the question is refused with the union of codes plus ITEM_COUNT |

**Sheet steps** (`compile_reply`):
1. `Selection(planned_rows, reserve_rows, predicate=lambda q, ch, n: q.codes, minimum=floor).screen()`. Reserves are compiled against their own row.
2. **Sheet loop:**
   - `sheet_leaks(layout IR)` → `selection.reject({planned number: codes}, stage="sheet")`;
   - repeat until no new codes. The loop is bounded by N+R.
3. **Repairs**, ≤2 rounds. Each round is one `{slot: wire question}` mapping:
   - each missing slot is compiled against its own row and passed to `selection.fill`;
   - a slot that is not missing gives REPAIR_SLOT_NOT_MISSING (recorded, not compiled);
   - a third round gives REPAIR_BUDGET;
   - the sheet loop runs again after each round.
4. **Acceptance:** see the delivery rule below.

**Repair latency** (critique): stage 2 makes no model calls, so there are no timeouts. Stage 3/4 sets repair timeouts from measured latency: at least the author timeout, or a single round. It publishes the fill table both with and without successful repair.

**Exact delivery rule.** A sheet is delivered if and only if ALL of these hold:
1. floor ≤ M ≤ N, with floor = `question_floor(grade)` (grades 1–2 → 8, 3–4 → 12, 5–6 → 14, 7–9 → 20) and N = `questionCount`. For this sheet, M = 20, so every slot must be filled. Otherwise SHEET_BELOW_MINIMUM. A shorter sheet arises only when N > floor (D2).
2. 2 ≤ stars ≤ 4, and stars count only challenge-kind questions (D5 stand-ins print unstarred). Otherwise SHEET_STARS. With N = floor this cannot fire, because lesson_select lets a practice reserve stand in only while 2 real challenges remain; it stays as a defensive check.
3. Every selected concept has ≥1 printed question, counted by the row it was written for. Otherwise SHEET_COVERAGE (kept strict; unreachable at N = floor = 20 [I]).
4. No sheet-level leak or duplicate remains.
5. `validate_source` (v5) passes.
6. Render (§5): every executed pinned step and gate is PASS, every SKIP is in the D22 allowlist, there is no REVIEW, atom-order PASS, the producer is WeasyPrint, and the artifacts are exactly [pdf].

In stage 2 any render failure fails the run: there is no replacement after a render. **This rule is stricter than "fail only below the floor":** the star and coverage rules are not about the count, so the literal "only if" of requirement (b) cannot hold (critique).

---

## 5. Runner v5 path and atom_order

**Hooks in `runner.py`** (E4). Lines 79-169 are untouched.
- **R1, after :39:**
  ```python
  v5 = isinstance(model_payload, dict) and model_payload.get("contract") == V5_CONTRACT
  if v5 and cap["skill"] != "middle":
      reject("V5_SCOPE_UNSUPPORTED", ...)
  ```
- **R2, after :78** (trusted-adapter): `if v5: return _render_job_v5(lesson, cap, work, skill, pin, steps, run, ok, adapter)`.

```python
V5_NOT_RUN_ALLOWED = frozenset({                 # D22, pending Noam's approval before stage 4; status SKIP only
    "pinned:emit_docx", "pinned:catalog/landing", "pinned:gate_sections G85–G92",   # en dash, as in build_v72.py:266
    *("pinned-gate:%s:sheet" % g for g in ("G85-section-volume", "G86-terms", "G87-subtopic-chronology",
                                            "G88-level-parity", "G89-catalog", "G92-section-structure"))})

def _render_job_v5(lesson, cap, work, skill, pin, steps, run, ok, adapter):
    """PDF-only middle render for a v5 source. Never calls didactic_review; artifacts are [pdf] only."""
    key = {"a": "a", "b": "b", "e": "c"}[lesson["level"]]; pdf = f"out/deliver/{key}/sheet.pdf"
    if ok:
        ok = run("levels-lint", [HERE/"text_lint.py", "--levels", work/"levels.json"]) and ok
        ok = run("middle-build", [skill/"build_v72.py", "--pkg", work, "--no-docx"]) and ok
        ok = _pinned_steps(work, steps) and ok          # appends pinned:* and pinned-gate:* entries
        ok = run("atom-order", [HERE/"atom_order.py", "--levels", work/"levels.json", "--pdf", work/pdf,
                                "--json", work/"logs/atom-order.json"]) and ok
    not_run = [s["name"] for s in steps if s["status"] == "SKIP"]
    passed = bool(ok and all(s["status"] == "PASS" for s in steps if s["status"] != "SKIP")
                  and set(not_run) <= V5_NOT_RUN_ALLOWED and (work/pdf).is_file())
    ...  # manifest below; dump(work/"manifest.json", manifest); return manifest
```

**`_pinned_steps(work, steps) -> bool`.** Reads `out/v72-report.json`: ≤4 MB, a JSON object with list fields `steps` and `gates` [V build_v72.py:180-183, 324-347].
- Missing or invalid → append `{"name":"pinned-report","status":"FAIL","reason":"PINNED_REPORT_MISSING"|"PINNED_REPORT_INVALID"}`.
- For each `report["steps"]` row, append `{"name":"pinned:"+row["step"],"status":row["status"],"source":"out/v72-report.json"}`.
- For each `report["gates"]` row, append `{"name":"pinned-gate:%s:%s" % (gate, level or "sheet"), ...}`.
- Any status outside PASS/FAIL/SKIP/REVIEW is recorded as FAIL.
- Returns `report["result"] == "PASS" and not report["review"]`.

What the pinned report contains for this sheet [V build_v72.py:205-275; gate_sections.py:87-89,1757-1758]:
- A legacy package with `--no-docx` gives: build_plus PASS/FAIL, the 4 checkers, `emit_docx` SKIP, `catalog/landing` SKIP, `gate_sections G85–G92` SKIP, and 6 SKIP gates.
- check_didactic exit 2 (REVIEW) appears as FAIL [V didactic_review.py:3-5]. **v5 never reconciles it.**

**Manifest (v5):**
- `version` 1; `status` = `"needs_review"` if `passed`, else `"failed"`.
- `executedChecksPassed` = `passed`. `automatedChecksPassed` and `renderingChecksPassed` = `passed and not notRun`, which is false in stage 2 because of the legacy skips (G7). `notRun` = `not_run`.
- `authorContract` `"worksheet-wire/5"`; `authoringProfile` `"general-skill-source/v1"`; `skill` {name, version, sha256}; `topicId`; `gradeNumber`; `modelInputSha256`; `adapterSha256` (sha of general_adapters.py); `steps`; `lessonBoundary`; `reviewFindings` `[]`.
- `artifacts` = `[{"path":pdf,"sha256","bytes","kind":"pdf"}]` if passed, else `[]`.
- `review` = today's general wording, with "every final PDF page must be inspected" (no Word).

**`atom_order.py` (E4)**

```python
ATOM_CHARS = frozenset("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+−=()%·")
ANCHOR = "תשובות סופיות"                       # emit_html answers band [V emit_html.py:1205]
class AtomOrderError(ValueError):
    """code ∈ ATOM_MISSING, ATOM_NOT_FLAT, ATOM_ANCHOR_MISSING, ATOM_PDF_UNREADABLE, ATOM_LEVELS_INVALID,
    PDF_PRODUCER_NOT_WEASYPRINT; .missing = [(region, atom)] ≤ 20."""
def island_glyphs(island: str) -> str:
    """Inside of $…$ → expected visual LTR glyphs: drop spaces/NBSP, '\\%' → '%'; any other '\\', '^', '_', '{', '}'
    or a char outside ATOM_CHARS → ATOM_NOT_FLAT (stage 2: fractions, powers, °, ₪ are stage 3)."""
def expected_atoms(levels: list) -> tuple["Counter", "Counter"]:
    """(question region, answer region). Questions: islands of title, rule, every intro and item text, plus '(n)' per
    question; answers: islands of every answer string, plus '(n)' per answer row. An odd '$' count → ATOM_LEVELS_INVALID."""
def pdf_runs(pdf_path) -> tuple["Counter", "Counter", str, int]:
    """(runs before the anchor row, runs after it, producer, pages). Glyphs from page.get_text('rawdict') minus whitespace,
    rows grouped by origin y within 0.75pt (as elementary_pdf_order.visual_baselines [V :58-80]); a run is a maximal
    x-sorted sequence of ATOM_CHARS glyphs with x strictly increasing and gap ≤ 1.0×font size; any other glyph breaks it.
    The anchor is the single row whose compact text equals ANCHOR or ANCHOR[::-1]."""
def check_atom_order(levels_path, pdf_path) -> dict:
    """Producer must start with 'WeasyPrint'; every expected atom must be found as a run in its region, with multiplicity
    (found[s] ≥ expected[s]) on any page. Returns {"status":"PASS","atoms":n,"pages":p,"producer":…}; else raises."""
# CLI: atom_order.py --levels L --pdf P --json J  → exit 0 PASS / 1 FAIL; J = {status, code?, missing, atoms, pages, producer}
```

A reversed or split atom (`% 30`, `6−`, `4 + x5`) has no matching run, so it is reported as missing. Single-character atoms (`x`, `3`) are a weak signal; the multi-character atoms are the real test [I]. Markers `(n)` are checked as runs. `1.` / `.1` cannot be emitted, because the pinned `ltr_marker` asserts `^\(\d+\)$` [V emit_html.py:702,748-757].

---

## 6. Test plan, golden files and the offline end-to-end script

Run the suite (as the stage brief says; a TMPDIR containing "private" breaks one existing test):

```text
mkdir -p "$HOME/.cache/tg-tmp" && cd /Users/noamdoron/agy-site/wt-teacher-pdf-structured && env TMPDIR="$HOME/.cache/tg-tmp" \
  PYTHONDONTWRITEBYTECODE=1 DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib MIDDLE_SKILL_PATH=<pinned middle> \
  ELEMENTARY_SKILL_PATH=<pinned elementary> python3 -B -m unittest discover -s tools/teacher-generation/tests
```

Baseline: 389 OK, 1 skip (Tesseract). Every new file below must pass, and the baseline tests must stay unchanged.

### 6.1 Per-module tests (new files only)

| File | Owner | Must cover |
|---|---|---|
| `test_v5_structured_contract.py` | E2 | Every code matches CODE_RE (no digits, ≤60); `kernel_code` for every MathTaskError literal grepped from math_tasks.py; `CONTRACT == general_source.V5_CONTRACT`; overlay concept ids exist in `scope_for_lesson(fixture)`; `wire_schema` has no anyOf/oneOf/allOf/pattern/const/format, all properties required, additionalProperties false, a slot enum of 26; the good fixture reply satisfies it (a small structural walker, no jsonschema dependency); `validate_selection` passes a good record and refuses each mutation (requested, floor, delivered, dropped length, bad code, unknown concept, coverage gap, star mismatch, `by`) with the right code |
| `test_v5_text_lint.py` | E2 | Each lint_model_text code (digits, Latin, every listed symbol, `$`/`\`/`<`, bidi controls, `ב{n1}` vs `ב־{n1}`, `({n1})`, strong and weak number words, each ARGUMENT_WORD, forbidden terms, drawing request, niqqud at grade 7, an undeclared ref; refs returned); check_ir_text and check_ir_spans cases; lint_levels on clean and broken levels (`% 30`, `$30$ %`, adjacent islands, odd `$`); every code-written overlay string passes check_ir_text and contains no forbidden term or argument word |
| `test_v5_school_math.py` | E1 | parse/unparse round trip on ≥40 strings (`3x+5+2x-1`, `-4y+9+6y-2`, `2(x+3)`, `(-3)^2`, `-3^2`, `x-(-2)`, `ab`, `3xy`, `{n1}x`, U+2212 input); `(-3)^2` vs `-3^2` give distinct CSTs and kernel values 9 / −9; MATH_PARSE for `x3`, `3 4`, `5--2`, `5+-2`, `3*-2`, `(x+1`, `x+`, `""`, `x²`, `3·x`, `X`; MATH_SYMBOL_UNDECLARED; every MATH_SCOPE_* (incl. `3(x+2)+x`, `5-(2x+1)`, `xx`, `21x`, 5 terms, 3 letters); exact kernel ASTs (§2.5 example) pass inspect_ast; to_house strings (`3x + 5 + 2x − 1`, `y = −2`, `(−3) + (−4)`, `5 − (−2)`, `2(x + 3)`, no ASCII `-`); from_house_flat round trip; keys `5x+4`, `2y+7`, `9a-8`, `x-y`, `3y+x`, `7+3x`, `-2a+10`, `0`, `-6`; kernel_equal true and false; the letter-mapping round trip (`ax^2+bx+c` with c→y) |
| `test_v5_mistake_models.py` | E1 | M1/M2/M3 on the §2.7 examples; each precondition failure → MISTAKE_NOT_APPLICABLE; MISTAKE_UNKNOWN |
| `test_v5_leak_checks.py` | E2 | `pinned_module` hash check (a temp copy with one byte changed → SKILL_HASH_MISMATCH; no sys.path change; no `__pycache__` in the skill dir); `d12_mirror` equals the pinned `f_hit` on the §2.1 probes (refusals and passes, including a later-item hit); the mirror's result is unchanged when `given` lists differ (no exemption); every LEAK_* / DUPLICATE_* rule of §4, with positive and negative cases; the monotonicity property |
| `test_v5_item_kinds.py` | E3 | Per kind: the §2.1 inputs → the exact §2.6 prompt, task and key; every I1–I6 code (§7 adversarial table); verify_item accepts compile output and refuses tampering (display changed, key off by one, template text changed, wrong result changed, layout reordered); verify_question cases; every template's canonical instance passes `d12_mirror`; code-written strings against the pinned not-yet keywords (subprocess `python3 -I -B` calling the pinned `didactic.curriculum_block`) |
| `test_v5_lesson_select.py` | E3 | Port of the 17 tests in B:tests/test_lesson_select.py (all except :137 soft-restore and :151 restore), with :36/:43/:158/:176 rewritten for `reserve_groups` and the floor; a table N=8→3+1, 12→3+1, 20→4+2, 30→6+2 |
| `test_v5_structured_source.py` | E3 | plan_slots for the fixture (§2.3); parse_wire errors; the good reply → 20/20 with replacements exactly Q4→R1, Q9→R2, Q14→R3, Q19→R5, and Q12 trimmed to 3 items; the IR passes validate_source; each adversarial case gives its exact code set; repairs fill a missing slot, while without them → SHEET_BELOW_MINIMUM; SHEET_STARS and SHEET_COVERAGE via crafted Selections; determinism (byte-identical IR twice); diagnostics contain no Hebrew letter and no fixture expression string |
| `test_v5_general_source.py` | E4 | The compiled IR validates; each v5 addition without the marker → today's codes; v5 refusals: review answer, printTask true, unit ≠ "", key off, binding tamper, selection errors, elementary topic, a topic with no overlay, table present, 7 items, math/formula span, adjacent displays, leak tamper, each with the code in §4 |
| `test_v5_adapter.py` | E4 | With the pinned middle skill: levels.json grade "כיתה ז׳"; item texts exactly `$3x + 5 + 2x − 1$`, `$4y − y$ עבור $y = −2$`, `מספר הגדול פי $4$ מ־$x$`; answers `$5x + 4$`, `$−6$`; `given == [body]`; to_prove value == answer; no task text; content.py byte-equal to today's constant plus `PACKAGE = "G7-T90"`; `lint_levels(levels) == []`; rich_text raises on an unknown kind |
| `test_v5_runner.py` | E4 | With a stubbed `subprocess.run` (the pattern of test_runner_word_web.py): v5 steps in order, `--no-docx` in argv, no `didactic_review.py` call even when check_didactic FAILs, pinned entries parsed from fixture reports (an all-PASS legacy report → needs_review, notRun = the allowlist, automatedChecksPassed False; any REVIEW, a non-allowlisted SKIP, a missing report or an atom-order FAIL → failed), artifacts [pdf] only |
| `test_v5_atom_order.py` | E4 | island_glyphs cases; expected_atoms on a fixture levels.json; with real WeasyPrint (skip guard as in existing tests): synthetic RTL HTML with one `direction:ltr` span per atom (`5x + 4`, `y = −2`, `−6`, `(−3) + (−4)`, `5 − (−2)`, `2(x + 3)`, `30%`, `(1)`) → PASS; the same with `$30$ %` split boxes → ATOM_MISSING; a fraction island → ATOM_NOT_FLAT; a PyMuPDF-made PDF → PDF_PRODUCER_NOT_WEASYPRINT; a missing anchor → ATOM_ANCHOR_MISSING |
| `test_v5_legacy_golden.py` | E4 | §6.3 |

### 6.2 RTL matrix in stage 2 (the plan's 13 cases)

| Coverage | Cases |
|---|---|
| Real sheet | `(n)` markers, `א.` labels, `−6` / `y = −2`, "4y − y עבור y = −2", `5x + 4` keys |
| Printer and synthetic WeasyPrint | 30%, x = 20%, (−3)+(−4), 5−(−2), 2(x+3) |
| Printer only (non-flat, stage 3) | ax²+bx+c, (−3)² vs −3², 9/25 |
| Stage 3 | "31 שארית 1", ס״מ/°/₪ |

### 6.3 Golden files: the closed authors and the old path stay byte-identical

1. E4's first commit is `tests/fixtures/v5/make_golden.py`. It is a script, not a test. Run it at `bafa36f0` before any integrator edit, and run it twice to prove determinism. It writes `tests/fixtures/v5/golden/adapter-golden.json` and `runner-golden.json`.
2. **Adapter cases.** Each case is run through the function that the `general_adapters.py __main__` dispatch calls (:546-559), in a temp work dir with lesson.json, model-output.json and curriculum-scope.json written as `runner.render_job` writes them. Record the sha256 of every output file.
   - The 6 closed authors with fixed seeds or choices, taken from their existing tests: fraction (g5), counting (א01), division_facts, pythagoras, square, triangle.
   - `test_general_source.fixture("ד11", 4)` (elementary).
   - `fixture("g9r:quad_func_and_eq", 9)` (middle).
3. **Runner cases.** With `subprocess.run` stubbed, record the (step name, argv) list and the manifest without sha fields for: a v3 middle general job, a v3 elementary general job, and the v2 g7 pilot.
4. `test_v5_legacy_golden.py` recomputes both files and requires equality. The golden records the skill-lock version and sha. If a skill is unavailable, the test uses the same skip guard as existing tests.

### 6.4 Offline end-to-end: `tools/teacher-generation/v5_offline_render.py` (E4)

```python
def run(lesson_path, reply_path, out_dir, *, repairs=(), work_dir=None, skill_path=None, dpi=150) -> dict:
    """compile_reply → validate_source (explicit) → runner.render_job (real WeasyPrint, pinned middle) → atom_order (inside
    render_job) → PNG of every PDF page. Renders in a space-free work dir, then copies deliverables to out_dir."""
def main(argv=None) -> int:
    """CLI. Exit 0 = every executed check PASS (notRun listed), 1 = render or gate failure, 2 = compile/selection failure."""
```

```text
env TMPDIR="$HOME/.cache/tg-tmp" PYTHONDONTWRITEBYTECODE=1 DYLD_FALLBACK_LIBRARY_PATH=/opt/homebrew/lib \
  MIDDLE_SKILL_PATH=<pinned middle> python3 -B tools/teacher-generation/v5_offline_render.py \
  --lesson tools/teacher-generation/tests/fixtures/v5/lesson-g7-algebraic-expressions.json \
  --reply  tools/teacher-generation/tests/fixtures/v5/reply-g7-good.json [--repair <round.json>]... \
  --out "/Users/noamdoron/Desktop/הוראה ובית ספר/לאתר noamdoronmath/שלב-2-רינדור-20261124"
```

1. Lesson and reply are read with `validation.read_json`. `validate_lesson` and `scope_for_lesson` run.
2. The work dir defaults to `$TMPDIR/v5-work-<UTC timestamp>`. It must not contain spaces; the build path is not trusted with spaces [I; V build_v72.py:28-34 for the skill path].
3. Outputs in `--out`: `sheet.pdf`, `pages/page-NN.png` (PyMuPDF `get_pixmap(dpi)`), `ir.json`, `compile-diagnostics.json`, `manifest.json`, `v72-report.json`, `atom-order.json`, and `summary.json` = {status, requested, delivered, replaced, notRun, pages, producer}.
4. It never writes anywhere else on the Desktop, makes no network or model calls, and cleans nothing outside its own work dir.
5. **Stage-2 exit criteria:** 20/20 delivered; every executed pinned step PASS, with `notRun` = the allowlist; atom-order PASS; producer WeasyPrint; the PNGs inspected by eye; the existing suite and all new tests pass; 0 wrong keys and 0 leaks on the fixtures; every adversarial case refused with its code.

---

## 7. Fixtures (owner E3 unless noted)

`tests/fixtures/v5/lesson-g7-algebraic-expressions.json` is the repro lesson, verbatim. It validates with `validate_lesson` (topic g7, middle, levels b/a/e) and its floor is 20 [V].

```json
{"level":"b","minutes":30,"topicId":"g7:algebraic_expressions","version":3,"lastLesson":"למדנו מהו משתנה וביטוי אלגברי, הצבה בביטוי וכינוס איברים דומים. עדיין לא למדנו את חוק הפילוג.","lessonGoal":"practice","gradeNumber":7,"questionCount":20,"alreadyLearned":[],"lessonBoundary":{"kind":"curriculum_scope","version":1,"conceptIds":["g7:algebraic_expressions#0","g7:algebraic_expressions#1","g7:algebraic_expressions#2"],"curriculumSha256":"57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"},"explicitShortSheet":false}
```

**`reply-g7-good.json`** has 26 questions (Q1–Q20, R1–R6) in the §2.1 style. It includes exactly these designed refusals. Q4, Q9, Q14 and Q19 each have 3 items with exactly one bad item, so trimming leaves 2 and the question is refused with that item's code plus ITEM_COUNT:
- Q4 `W_TIMES` with `x+3` → TEMPLATE_MISMATCH → R1;
- Q9 `3(x+2)` → MATH_SCOPE_PRODUCT_OF_SUM → R2;
- Q14 `7a-2a+4-a` → LEAK_PINNED_VALUE → R3;
- Q19 an `expr2` that M1 does not produce → MISTAKE_UNMODELED → R5;
- Q12 has 4 items, one of them VALUES_MISMATCH → trimmed to 3 and printed.

R4 and R6 stay unused.

**`repair-g7-round1.json`** is `{"Q4": <valid write_from_words question>}`. It is used with a variant reply that leaves Q4 missing.

**`reply-g7-adversarial.json`** is `[{"case","slot","question","expect":[codes]}]`, with ≥34 cases and at least one per reachable code (code: example input):
- **Shape:** Q_SHAPE: no `table` · Q_SLOT_UNKNOWN: Q21 · Q_SLOT_DUPLICATE: a second Q3 · Q_KIND_NOT_ALLOWED: substitute in a #0 row · FIELD_NOT_EMPTY: intro "כנסו", item text "חשבו", non-empty givens · ITEM_COUNT: 2 items, 7 items · ITEM_SHAPE: no `expr2`.
- **Parse and scope** (scope codes carry the `MATH_SCOPE_` prefix): MATH_PARSE: `3x+`, `x3+1`, `5--2x`, `3·x` · MATH_SYMBOL_UNDECLARED: `3c+2c` · PRODUCT_OF_SUM: `3(x+2)+x` · BRACKETS: `5-(2x+1)+x` · POWER: `x^2+3x^2`, `2xx+x` · DIVISION: `x/2+x` · DECIMAL: `2.5x+x` · RANGE: `25x+3x`, values `y=15` · TERMS: `x+2x+3x+4x+5x` · LETTERS: `x+y+a` · PRODUCT: `3*x+2x`.
- **Binding:** NOTHING_TO_DO: collect `3x+5` · TEMPLATE_UNKNOWN: `W_HALF` · TEMPLATE_MISMATCH: `W_SUM` with `x+x` · VALUES_SHAPE: `y:=2` · VALUES_MISMATCH: `4y-y` with `x=2` · REVEALS_ANSWER: `y` with `y=3` · FORM_UNKNOWN: collect with form `integer` · MISTAKE_UNKNOWN: `M9` · MISTAKE_NOT_APPLICABLE: M3 on `4a+3+2a` · MISTAKE_UNMODELED: M1 `4a+3+a+2` with `9a` · MISTAKE_NOT_WRONG: M2 on `4x+7-0+x`.
- **Leaks:** LEAK_PINNED_VALUE: `7a-2a+4-a`, and substitute keys {−6, 11, 3} · LEAK_LINKED: items `3x+2y+x`, `4x+2y+5x` · LEAK_RULE_FACT: `5x+3x+1` · LEAK_OWN: `6x+2x` · DUPLICATE_ITEM.

Sheet-level cases live in `test_v5_structured_source.py`: QUESTION_MISSING, DUPLICATE_TASK, LEAK_SHEET_INVERSE, SHEET_BELOW_MINIMUM, WIRE_SHAPE, WIRE_JSON.

KERNEL_*, KEY_ROUNDTRIP, DISPLAY_ROUNDTRIP and BINDING_INTERNAL cannot be reached under the stage-2 profile. They are tested by monkeypatching the printer or the kernel in `test_v5_item_kinds.py`.

**E4 fixtures:** `tests/fixtures/v5/golden/*`, `tests/fixtures/v5/v72-report-*.json` (runner tests), and `tests/fixtures/v5/levels-g7-sample.json` (atom_order and lint tests).

---

## 8. Deviations from the plan, open items, merge order

**Deviations and refinements** (all [I], for Noam to see):
1. **The wire root has no `rule` in stage 2.** The rule box is curated in the overlay: D17 is open, and the curated rule is the conservative default.
2. **Challenge slots are all `find_error_collect` (concept #2)** instead of `question_plan`'s concept rotation.
3. **`write_from_words` templates are limited to coefficient forms.** Under the pinned D12 with `given=[body]`, every additive-constant phrase is refused. Probed: `x + 5` → hit. This is the D19 trade-off, with no relaxation.
4. **find_error prints "כינוס הביטוי X נתן Y"** instead of a false equation `X = Y`. The instruction asks only for the correct result: an explanation would need a key the kernel cannot prove (D6).
5. **Letters are {x, y, a, b} only (identity map).** The mapping API exists but is unused in stage 2.
6. **`key.binding` and the IR-level `verify_item`/`verify_question` are new.** With them `validate_source` checks that the printed display matches the task, which replaces the v4 "task is printed" guarantee. This is stricter than the plan's display/printTask design.
7. **Items are trimmed inside a question** while ≥3 clean items remain. The plan refused whole questions.
8. **The pinned G84 does not catch "משוואה" for this topic** [V], and G86 is skipped for legacy packages. `TEXT_FORBIDDEN_TERM` is the guard.
9. **`automatedChecksPassed` is false for every stage-2 sheet**, because of the legacy-package SKIPs (G85–G89, G92, emit_docx, catalog). Stage 4 needs D22 (approve the allowlist) or a sectioned bridge in a new skill version (D19). Source-side replacements for the skipped gates:
   - G85 volume holds by construction: 20 questions × 3–6 items ≥ the house minimum of 60 sub-items and the maximum of 6 per question [V SKM/curriculum_tashpaz.json:1679-1682; gate_sections.py:585,695].
   - G86-terms → `TEXT_FORBIDDEN_TERM`.
   - G87/G88/G89/G92 check sectioned sheets and catalogs and have no source-side equivalent.
10. **No replacement after a render in stage 2.** A pinned D12 finding at render means the mirror diverged from the gate, and it fails loudly.

**Open, not in stage 2:** the prompt card and a live call (D15); `divide_remainder`; Tier B; elementary v5; worker, site and SQL (M1, M2); diagnostics persistence; the remote-worker acceptance; deleting old code; the stage-3 bench and probe port.

Before any container build, the new runtime modules must also be added to the exact Docker-context allowlist (`cloud/container/context-files.json` plus `Dockerfile.dockerignore`, asserted by `cloud/container/test_packaging.py:84-102` [V]). Stage 2 is Mac-only and does not touch those files.

**Unknowns** [U until the offline build]:
- Whether `deliver`/`check_didactic` accept the v5 strings and the grade line.
- PDF text extraction of U+2212 and of the pinned `span.sym`.
- Whether the mirror matches D12 on `noam-ai.json` text (the mirror reads the levels.json strings).
- Pango 1.50.12 in the container versus 1.58.2 on the Mac.

**Merge order:**
1. E2: `structured_contract.py`. It is the leaf every module needs.
2. E4: golden fixtures generated at `bafa36f0`.
3. In parallel: E1 school_math and mistake_models; E2 text_lint and leak_checks; E3 lesson_select, item_kinds, structured_source and fixtures; E4 atom_order and the hooks.
4. Integration: `v5_offline_render.py` on the fixtures. Each step is one commit, ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

---

## 9. Review fixes (2026-11-25)

Tests: `tests/test_v5_review_fixes.py` (new). No existing test was relaxed; one branch-added test lost its `@expectedFailure` because its defect is fixed.

1. **Reordered repeats.** `leak_checks.reordered_tasks` refuses a later question with an item whose signed-term multiset equals an earlier question's item in another order (`DUPLICATE_REORDERED`, registered). Stage 2 printed `x + 6 + 5x + 2` (Q16) and then the starred reserve `5x + 2 + x + 6` (Q19). It runs in the sheet loop, at acceptance and in the final validator (`SOURCE_LEAK`). `DUPLICATE_ITEM`/`DUPLICATE_TASK` keep the §4 definition (the exact canonical display), because `test_v5_leak_checks` pins order-sensitive cases (`test_duplicate_item`, `test_inverse_leaks_across_questions_in_both_directions`). So a reordered item inside one question is not refused. The fixture `reply-g7-good.json` R5 item א became `5x+2+x+9` → `17x`, so R5 stays the clean reserve §7 describes.
2. **References in model math.** `school_math.parse(..., allow_refs=False)` refuses `{nK}` (`MATH_PARSE`). `item_kinds.compile_item` uses it for every kind that declares no givens (all stage-2 kinds). The code is `MATH_PARSE` for every kind, as `math_ref_in_collect_expr` pins it. A kernel-conversion failure is a refusal of that item. `structured_source` turns an unexpected exception in one item into `BINDING_INTERNAL` for that item only.
3. **Provider boundary.** `validate_source(..., provider=True)` (every model reply, `general_provider.compile_content`) never selects v5. A root `contract`/`selection` key stays `SOURCE_SHAPE`, as at `bafa36f0`. `validate_model` and `runner._is_v5` still read the marker, because the v5 tests pin that. Those paths get no model payload that is not first validated with `provider=True`.
4. **Scope.**
   - Keys obey `result_literal_max` (`MATH_SCOPE_RANGE`, in compile and in `verify_item`).
   - A written coefficient 0, 1 or (−1) before a letter (`1x`, `0x`, `(-1)x`) is `MATH_SCOPE_RANGE`. It is checked after the other checks, so `TEMPLATE_MISMATCH` still wins for `W_TIMES` `1x`.
   - An implicit product after `:` (`6:2x`) is `MATH_SCOPE_DIVISION` even where division is allowed.
5. **Final validator.**
   - The title, the section titles and the rule box must equal the overlay (`SOURCE_BINDING`).
   - Each printed question's kind and `conceptIds` must match its slot's row, recomputed with `plan_rows` (`SOURCE_SELECTION`).
   - `general_adapters.compile_source` runs the D12 mirror with the trusted skill path (`SOURCE_LEAK`).
6. **Records.**
   - Compile diagnostics carry `warnings`. `EQUIVALENT_TASK` (registered as a warning, never a refusal) marks two substitute items with the same simplified expression and values after renaming letters, for example root Q7 א and Q10 ג.
   - The v5 manifest records `overlayReviewed` and `overlayPendingReview`. `automatedChecksPassed` also needs a reviewed overlay (D7).
   - `v5_offline_render` writes `report.json` for every render, with `trimmed`, `warnings` and a `verdict`. It copies the pinned report as `pinned-v72-report.raw.json`.

**Still open, for Noam:**
- One-term answer leaks; the order of the challenge templates and harder challenges; the `W_TIMES_MINUS`/`W_TIMES_PLUS` wording.
- D5 stand-ins and trimming inside a question: both are pinned by tests, so a flag that is off by default needs a decision.
- An exit code for "not fully checked": `report.exitCode` 0 is pinned. The verdict carries `fullyChecked`.
- A real-page render of `%` and brackets; the D22 allowlist.

---

## 10. Stage-3 hardening (2026-11-25)

Tests: `tests/test_v5_stage3_hardening.py` (new). Branch tests touched by this stage were only made stricter: they pass the trusted flag where they validate or render a v5 source, and assert the unflagged refusal next to it. No baseline test changed.

1. **Reordered repeats inside one question.** `leak_checks.reordered_items(question)` returns `(later item, DUPLICATE_REORDERED)` when an item has the same signed-term multiset as an earlier item of the same question in another order. Exact repeats stay `DUPLICATE_ITEM`.
   - `structured_source.compile_question` (Q4) refuses that item and trims it while three clean items remain; otherwise the question is refused with `ITEM_COUNT`, and a reserve fills its slot.
   - As with `DUPLICATE_ITEM`, the canonical task is the task expression, so a substitute item's values do not make it another task.
   - The final validator refuses a v5 IR that still holds one (`SOURCE_LEAK`).
   - `question_leaks` keeps the §4 rule, and the order-sensitive assertions in `test_v5_leak_checks` still hold. `test_duplicate_item` now also asserts the refusal at the `structured_source` level.
2. **Trusted v5 marker.** The root `"contract": "worksheet-wire/5"` is honoured only when the caller passes the keyword-only trusted flag `contract="worksheet-wire/5"`. This applies to `general_source.validate_source`, `validation.validate_model`, `runner.render_job` and `runner._is_v5`, and to the adapter CLI as `--contract`.
   - Only `structured_source.compile_sheet` and `v5_offline_render` set the flag. `runner` passes it to `validate_model` and to the adapter; `validate_model` and `general_adapters.compile_source` pass it to `validate_source`. A test scans every `contract=` keyword to keep it that way.
   - Without the flag, a payload that carries the v5 root keys is refused with `SOURCE_SHAPE` and the message "Unexpected or missing source fields", byte for byte as at `bafa36f0` (probed on a `git archive bafa36f0` copy). `render_job` refuses it before any step runs or any work dir is made. G1 still holds; what changes is that the marker alone no longer selects v5 anywhere, which closes the residual named in §9.3.
   - With the flag, the source must carry the marker (`SOURCE_SHAPE`), and the lesson must be version 3 (`WIRE_SCOPE_UNSUPPORTED`).
   - Any other flag value, or the flag together with `provider=True`, raises `ValueError`. That is a trusted-caller bug, not a refusal.
   - The runner CLI takes no such flag, so it renders no v5 source.
3. **Container packaging.** The ten v5 modules are in the exact Docker-context allowlist: `atom_order`, `item_kinds`, `leak_checks`, `lesson_select`, `mistake_models`, `school_math`, `structured_contract`, `structured_source`, `text_lint` and `v5_offline_render`.
   - They are listed in `cloud/container/context-files.json` and `cloud/container/Dockerfile.dockerignore`. `cloud/render/Dockerfile.dockerignore` is kept equal to the container list plus its three render lines, as `test_http_supervisor` requires.
   - No data file is needed at runtime beyond what was already shipped (`skill-lock.json`, `generation-curriculum.json`). The pinned skill archives are unchanged.
   - v5 tests and fixtures are not shipped: the image's `unittest discover` runs the shipped baseline tests only.
   - A test checks that every module the image ships imports only modules the image ships.
4. **The pinned report copy is never the verdict** (`v5_offline_render` only).
   - The copy keeps its name `pinned-v72-report.raw.json`, byte for byte.
   - `report.json` is marked `"authoritative": true` with `"verdictFile": "report.json"`, and gives every output file's role under `fileRoles`.
   - It describes the pinned copy under `pinnedReport`: its sha256, its own `result` and `"isVerdict": false`.
   - It lists under `staleFiles` any file of a known output name, or any page image, that this run did not write. That includes a legacy `v72-report.json` left by an earlier render. Nothing is deleted.
   - `summary.json` carries `verdictFile`. The compile-failure summary is unchanged.

---

## 11. Stage 3, elementary path (2026-11-25): grade 4, ד10 חילוק ארוך ושארית, level a

Tests: `tests/test_v5_d10_elementary.py` and `tests/test_v5_d10_render.py` (new). Fixtures: `tests/fixtures/v5/d10/`. No existing test changed. The middle path and every v4 path are unchanged: the golden tests (§6.3) stay byte-identical.

**Scope.** One topic and level: `overlay_for("ד10", "a")`. Every other elementary topic and every other ד10 level keeps `SOURCE_WIRE_SCOPE` / `WIRE_TOPIC_UNSUPPORTED`. The lesson is the repro lesson, verbatim: concepts #0 חילוק ארוך (מאונך) and #1 מנה ושארית; #2 בדיקת חילוק is not taught yet, so nothing asks for a check by multiplication.

1. **Kernel task `divide_remainder`** (`math_tasks`): `{dividend, divisor}` → `{"type": "quotient_remainder", "quotient", "remainder"}`.
   - Both operands are positive integer literals (bounded by `inspect_ast`); the divisor is at least 2.
   - The result is re-checked against dividend = quotient · divisor + remainder, 0 ≤ remainder < divisor.
   - It uses existing codes only (`INVALID_TASK`, `INVALID_AST`, `UNVERIFIED_SOLUTION`). No existing kind and not `to_house_math` changed.
   - `general_source` keeps refusing it on the v4 path, with the same code and message as before the kernel learned it (G1).
2. **Elementary sign table** (`school_math.to_elementary`, `ELEMENTARY_SIGNS`): Latin x from grade ג (× in ב), the division sign printed ` : `, U+2212, the thousands comma from grade ג. A test compares it with the pinned `signs.py` PROFILE. `to_house` is unchanged.
3. **The ד10 overlay** (`structured_contract.OVERLAYS["ד10"]`, `"skill": "elementary"`, `reviewed: False`). Every Hebrew string is code-written Tier A text pending Noam's review (`pendingReview`): title, rule box, the drill verb, eight story templates, the remainder word, the profile and the challenge rule. Tier B stays off: the model writes numbers, a story id and asks, never Hebrew.
   - Profile (level a): dividend 100–999, divisor 2–9.
   - Plan (12 questions, floor 12): Q1–Q5 #0 (drill or story), Q6–Q9 #1 (story), Q10–Q12 challenges (story, starred), reserves R1–R3 practice and R4 challenge.
   - `check_overlay` has an elementary branch. `authoring_card` has an elementary card (3–5 KB, same lint).
4. **The two kinds** (`division_kinds`, dispatched from `item_kinds`, so `item_kinds` stays the only producer and checker).
   - `division_remainder_drill`: an item is `expr` NUMBER:NUMBER. It prints one atom `347 : 5 = ___`. The key is `{form: quotient_remainder, quotient, remainder}` and prints `69 שארית 2`, or `27` when nothing is left over.
   - `division_story`: typed givens n1 (whole amount) and n2 (group size), type count. Every item is `{n1}:{n2}` with one ask. Code prints the template story and the template's question for each ask. Keys: full_groups → floor, leftover → remainder, groups_needed → ceil.
   - Wording cues on every printed ask (`WORDING_CUE`): full needs מלא…/שלמ… and no other cue; leftover needs יישאר/נשאר/שארית; groups_needed needs צריך … כדי.
   - A story must leave a remainder (`STORY_REMAINDER_ZERO`). A starred story needs a zero digit in its quotient (`CHALLENGE_PROFILE`, e.g. 413:4 = 103 r1).
   - The star follows the row (`validate_selection` already checked it); `verify_question` also refuses a starred drill.
   - New codes: `DIVISION_SHAPE`, `ASK_UNKNOWN`, `STORY_REMAINDER_ZERO`, `CHALLENGE_PROFILE`, `WORDING_CUE`, `STRUCTURE_REPEATED`, `SOURCE_STRUCTURE`.
5. **Repeats and the pinned G62 mirror.**
   - Inside a question: `DUPLICATE_ITEM` (a division or an ask twice). Across the sheet: `DUPLICATE_TASK` (a division printed twice) and `EXAMPLE_COPY` (the rule box's 125:4).
   - `STRUCTURE_REPEATED` mirrors the pinned G62 clone gate. It loads the pinned `content_quality` by path after a sha256 check and applies its own fingerprint, skip rule and `max_clone` to the exact content.json item strings.
   - At grade ד `max_clone` is 3 and every drill item has the fingerprint `#:#=`. So **a sheet holds one drill question**, and a story template serves at most three questions. The mirror runs in the sheet loop (a later question takes a reserve) and again in `general_adapters.compile_source` with the trusted skill path (`SOURCE_STRUCTURE`).
6. **The adapter branch** (`general_adapters._compile_elementary_v5`).
   - It writes `sheet.html` through the pinned elementary template, plus `content.json`, `worksheet-source.json` and `verified.json`. No Word file.
   - Every number or expression is exactly one `H.ltr` atom; Hebrew is escaped prose between atoms.
   - The answer key prints `(n)` markers (v5 only; the v4 elementary key keeps `n.`). The house form `69 שארית 2` is two atoms around the word.
   - Each answer is claimed in the Ledger against the pinned `div_qr`, independent of the kernel.
   - Stories get a dashed work area for the long division (a frame, not a drawing). Questions are four to a page, so no page is near-empty for the pinned page-fill check.
   - No vertical long-division SVG: this is not a geometry page.
7. **The runner path** (`runner._render_job_v5_elementary`): content-truth → `pdf_weasyprint_only.py` → check_worksheet → output-gates → house-gates (no `--docx`) → atom-order.
   - Every step must PASS and none may SKIP, so `notRun` is empty. Artifacts are `[sheet.pdf]`.
   - `automatedChecksPassed` stays false while the overlay is unreviewed (D7).
   - The overlay's skill must equal the lesson's skill, else `WIRE_SCOPE_UNSUPPORTED`.
8. **`pdf_weasyprint_only.py`** (new). It loads the pinned `ensure_fonts` and `build_with_weasyprint` by path after a sha256 check and never calls the Chromium fallback. It fails when WeasyPrint fails or when the Producer does not start with "WeasyPrint", and removes such a PDF.
9. **Gate support.**
   - `atom_order.py --html`: every outermost `span.ltr` is an atom, plus `(n)` per question from the template's CSS counter. The elementary atom glyphs add `:` and `×`. No code-written text may touch an atom with a colon (checked by `check_overlay`).
   - `output_gates.py --paren-markers` and `general_pdf_order.check_answer_order(..., markers="paren")` accept `(n)` key labels. The default stays `n.`.
   - `v5_offline_render` picks the skill path and the PDF location from the topic's skill.
10. **Packaging.** `division_kinds.py` and `pdf_weasyprint_only.py` are in the exact Docker-context allowlists.

**For Noam to decide:**
- The ★ rule: a story in a challenge row with a zero digit in the quotient. The same story kind serves practice and challenge rows.
- The one-drill limit, which follows from the pinned G62 at grade ד.
- The work area beside each story, and four questions to a page.
- Every code-written Hebrew string of the overlay is unreviewed.
- On this Mac `pdftoppm`/`pdffonts` are missing, so the pinned check_worksheet reports its page-fill and font checks as warn-PASS. The container has poppler-utils. The page-fill rule was checked here with the pinned `check_page_fill` on 110-dpi PyMuPDF renders.

---

## 12. Stage 3, middle path (2026-11-25): grade 9, g9r:probability הסתברות, level e

Tests: `tests/test_v5_g9r_probability.py` and `tests/test_v5_g9r_render.py` (new). Fixtures: `tests/fixtures/v5/g9r_probability/`. No existing test changed. The g7 and ד10 overlays, every v4 path and the golden outputs (§6.3) are unchanged; the flat atom-order check still refuses a fraction (`ATOM_NOT_FLAT`).

**Scope.** One topic and level: `overlay_for("g9r:probability", "e")`. The lesson is the repro lesson, verbatim: concepts #0 מהי הסתברות, מושגים בסיסיים, #1 חישובי הסתברות והקשר לשכיחות יחסית, #2 מאורע משלים, #3 מאורעות דו־שלביים. The teacher learned the tree diagram and not the two-way table, so no item prints a two-way table; the domain is אי-ודאות (not geometry), so no question has a figure field and nothing draws a tree.

1. **The overlay** (`structured_contract.OVERLAYS["g9r:probability"]`, `"family": "probability"`, `reviewed: False`). Every Hebrew string is code-written Tier A text pending Noam's review (`pendingReview`): the title, the rule box, 17 stories (intros, 108 ask sentences, 4 table heads), the three form notes. Tier B stays off: the model writes a story id, typed count givens, one ask, one form and the probability as `expr` per item, never Hebrew and never a table.
   - Plan (20 questions, floor 20): Q1–Q5 #0 `single_draw_probability`, Q6–Q9 #1 `relative_frequency`, Q10–Q13 #2 `complement_probability`, Q14–Q17 #3 `two_stage_with_replacement` or `two_stage_without_replacement`, Q18–Q20 challenges (`two_stage_without_replacement`, starred); reserves R1–R4 practice, R5–R6 challenges.
   - Counts are typed givens n1..nK (type `count`): 2–20 in a bag story (a count of 1 would print "1 כדורים"), total 6–40 (three categories) or 4–30 (two); 1–400 in a frequency table, total 10–1000.
   - `check_overlay`, `code_strings`, `wire_schema` (forms `""`, fraction, decimal, percent) and `authoring_card` (4.8 KB, same lint) have a probability branch.
2. **The five kinds** (`probability_kinds`, dispatched from `item_kinds` and `structured_source`, so `item_kinds` stays the only producer and checker).
   - `single_draw_probability`: one draw from three categories; asks `one_k`, `either_jk`.
   - `relative_frequency`: a one-way table (head labels, one count row of display atoms); asks `freq_k` (the relative frequency) and `prob_k` (the probability it gives); each item declares fraction, decimal (at most two places) or percent (a whole percent), and code prints the form note after the ask.
   - `complement_probability`: two draws with replacement; asks `not_first_k` (1 minus P) and `at_least_one_k` (1 minus P(no k)).
   - `two_stage_with_replacement` / `two_stage_without_replacement`: asks `both_k`, `first_j_second_k`, `one_of_each`, `same`, and (without replacement) `at_least_one_k`. A starred question asks only `one_of_each`, `same`, `at_least_one_k` (`challengeRule` "combined_event", code `CHALLENGE_PROFILE`).
   - **Keys.** For every (kind, ask, categories) code holds one canonical probability (`canonical_text`). The task is the kernel's `evaluate` of it with the counts in place; the key is the kernel's exact value as a reduced fraction (`2/5` → `\f{2}{5}`), a decimal (`0.35`) or a whole percent (`35%` → `35\%`, the sign inside the atom). `verify_item` recovers the counts from the task by unification, recomputes the value with an independent Fraction formula and checks the printed key; `verify_question` checks that the intro and the table are the story printed with those counts. The final validator needs no givens list.
   - **The model's expr is bound, never trusted.** It is written over the givens only (literals 1 and 2, the power 2: `TASK_LITERAL`, `REF_UNDECLARED`, `MATH_SCOPE_POWER`); its exact value at the givens must lie strictly between 0 and 1 (`PROB_RANGE`); and it must equal the canonical probability at the givens and at six fixed probe points (`ASK_MISMATCH`). The kernel's expansion budget (`RESOURCE_LIMIT`) cannot compare the long two-draw rational functions symbolically, so the binding is exact evaluation; the key never comes from the model's expr.
   - New codes (group `probability`): `PROB_RANGE`, `ASK_MISMATCH`, `KEY_REPEATED`. Reused: `GIVEN_SHAPE`, `GIVEN_VALUE`, `REF_UNUSED`, `TEMPLATE_*`, `ASK_UNKNOWN`, `CHALLENGE_PROFILE`, `FORM_*`, `DUPLICATE_*`, `LEAK_PINNED_VALUE`.
3. **Repeats and leaks.** Inside a question: `DUPLICATE_ITEM` (an ask or a task twice; equal counts make two asks one task), `KEY_REPEATED` (two items with one value), and the D12 mirror `LEAK_PINNED_VALUE`: the pinned `f_atoms` of the key island against the pinned `f_hit` of each printed string of the question (the intro, every table cell, every prompt), as the pinned D12 file check reads a question's own words field by field and cell by cell. A fraction key is printed only when one string prints both its numerator and its denominator; a percent key when one string prints its percent number (a count of 35 in a table of 100 gives away 35%). Across the sheet: `DUPLICATE_TASK` (a task printed twice) and `DUPLICATE_REORDERED` (the same kind with the same counts in another order). The mirror runs at compile time and again in `general_adapters.compile_source` with the trusted skill path.
4. **The IR and the final validator.** A v5 question may carry `"table"` only on an overlay with `"tables": true`; its cells pass the v5 span rules (text and display only). `general_source` passes `v5`/`overlay` to the table cells' `rich` calls (unchanged for v4: `v5=False`).
5. **Rendering.** The middle adapter, the pinned build (`build_v72 --no-docx`), the pinned report parsing and the D22 allowlist are unchanged. `text_lint.lint_levels` also lints table cells. `school_math.from_house` (new, non-flat inverse of `to_house`) checks a key island round trip.
6. **atom_order fraction mode** (`--fractions`, `check_atom_order(..., fractions=True)`), used by the runner only for an overlay with `"atomFractions": true`. An island is a sequence of segments: flat runs on one baseline and stacked `\f{…}{…}` fractions (numerator above the denominator, same centre). Every segment of an island must lie left to right in written order, the flat ones between each fraction's numerator and denominator rows; a decimal point joins a run only between two digits. Fractions and composite islands are placed first (each run used once), then the flat atoms are counted among the runs left over. Table cells are atoms of the question region. Without the flag the check is byte-for-byte the stage-2 flat check.
7. **Packaging.** `probability_kinds.py` is in the exact Docker-context allowlists.

**Render** (`v5_offline_render --case g9r_probability_good`): 20 of 20, nothing replaced or trimmed, 10 pages, producer WeasyPrint 70.0; check_didactic PASS 86, FAIL 0, REVIEW 0; G84-chronology PASS (track ט_רגילה, topic probability, 0 premature terms); atom-order PASS, 159 atoms of which 59 fractions (58 fraction keys and the rule box `1 − \f{3}{10} = \f{7}{10}`). `notRun` is the same nine allowed SKIPs as every middle v5 sheet.

**For Noam to decide:**
- Every code-written Hebrew string of the overlay is unreviewed (stories, ask sentences, table heads, form notes, rule box, title).
- The kinds, the asks and the challenge rule (a starred question asks only combined events), and the count ranges.
- Whether a decimal may have three places (now two) and a percent one place (now whole).
- Questions are not split across pages, so some pages end half empty (pinned layout).

## 13. Stage-3 verification fixes (2026-11-25)

The independent stage-3 verification found three major defects (d10 rule box, g9r rule box, d10 verdict) and two related minor ones. All are fixed; every printed key is unchanged.

1. **ד10 rule box reading order.** The example was the island `125 : 4 = 31` followed by ` שארית ` and `1`, so right to left the word stood after the dividend. Every number is now its own atom with Hebrew between: "למשל, כשמחלקים 125 ב־4 מקבלים 31 שארית 1." (5 text spans, 4 atoms; still `reviewed: False`). `structured_contract.remainder_word_neighbours` lists any atom next to the remainder word that is not one plain number; `check_overlay` refuses such a rule box or story intro. Tests check the overlay, the IR and the printed `sheet.html` (the neighbours of every שארית are exactly 31 | 1, 69 | 2, 84 | 5).
2. **g9r rule box leak.** The example `1 − 3/10 = 7/10` printed the keys of Q1 and the whole solution of Q12 א. A numeric example cannot lie outside what questions may print (a frequency table counts up to 400 of up to 1000, so nearly every fraction with a denominator up to 1000 can be a key), so the example is now in words: "למשל, ההסתברות שלא ייצא כדור אדום היא אחת פחות ההסתברות שייצא כדור אדום." The overlay gains `ruleFacts` (every equation of the rule box; `check_overlay` requires exactly its display spans, now none). `probability_kinds.sheet_leaks` adds `LEAK_RULE_FACT`: a question whose key values or single-draw probabilities (count over total) share a value with a rule fact (`rule_values`) is refused at sheet level and a reserve takes its place; the final validator refuses it as `SOURCE_LEAK`. With the old example put back, Q1, Q8, Q12 and Q17 are replaced by R1–R4. The probability card names rule facts only when there are some. The sheet now has 58 stacked fractions (the keys) and 158 atoms.
3. **Skipped pinned sub-checks.** `runner._pinned_log_not_run` reads the pinned step logs: check_worksheet's `PASS — … (warn)` lines (`pinned-log:check_worksheet:fonts|render|page-fill|brand|marker-direction|sqrt-markup`, unknown ones `warn-N`) and the pinned build_plus lines `G… <level> not run` / `not a figure topic` / `DEFERRED` (`pinned-log:build_plus:<gate>[:<level>]`). Each is listed in `notRun` (its line in `notRunDetail`), so `automatedChecksPassed`, `renderingChecksPassed` and the verdict's `fullyChecked` are false while one is there. They do not fail the render; step-level SKIPs keep their old rules (D22 allowlist on the middle path, none on the elementary path). On this Mac d10 now reports fonts, render and page-fill as notRun; every middle sheet reports G83 and G83-room. `report.json`/`summary.json` name `pinned-v72-report.raw.json` (file role and verdict note) only when the render copied one; the elementary note says no pinned build report exists.
4. **g7 wording and approval (Noam, 2026-11-25).** `W_TIMES_MINUS` prints "ההפרש בין פי k מ־u לבין v" (key ku − v unchanged). The g7 overlay is `reviewed: True` with `approvedBy: "Noam"`, `approvedAt: "2026-11-25"` and nothing pending; `check_overlay` requires exactly that shape of a reviewed overlay (and no approval record on an unreviewed one). The g7 card says "overlay reviewed: yes"; the manifest and report carry `overlayApproval`. A g7 render still has `automatedChecksPassed` false because of its 11 notRun entries. ד10 and g9r stay unreviewed.

**For Noam to decide:** whether a check_worksheet sub-check that cannot run on a host (no poppler on this Mac) should fail the render instead of only being listed as notRun; whether G83 "not a figure topic" (correct under the no-drawings rule) should move to a separate not-applicable list.

## 14. Stage 4 wiring (2026-11-25): structured_author, the TEACHER_V5_TOPICS route, the worker's v5 path

Tests: `tests/test_v5_structured_author.py` (new, fake `provider.request_author_json`, no network). Golden: `tests/fixtures/v5/golden/provider-golden.json`, recorded by `tests/fixtures/v5/make_provider_golden.py` at `515ebd5a` before any edit. No baseline test changed.

1. **`structured_author.author_structured_lesson`.** The system message is `authoring_card`; the user message is a fixed task line plus the teacher's `lastLesson` and `alreadyLearned` as data. The wire schema goes only in `response_format` (strict); `max_tokens` 16000, temperature 0.25, thinking off. The call is the unchanged `provider.request_author_json`. `structured_source.compile_sheet` decides.
   - **Repairs** (plan §b3), at most 2 rounds and 3 model calls per job: round 1 targeted (card, plan rows of the empty slots, each slot's refused wire question if it is at most 2 KB, one fixed instruction per code from `structured_contract.REPAIR_INSTRUCTIONS`), round 2 fresh (card, plan rows, codes; the codes include those of a refused round-1 candidate). Temperature 0.15, `max_tokens = min(6000, 600+450n)`, reply schema `{"Qk": question}` with slot and kind fixed per row. Empty slots are the missing ones of a failed compile and the dropped ones of a shorter sheet; the delivered sheet is the compile with the most questions.
   - **Unusable first reply** (`PROVIDER_INVALID_RESPONSE`, `PROVIDER_INCOMPLETE`, `PROVIDER_OUTPUT_TOO_LARGE`, `INVALID_MODEL_OUTPUT`, `WIRE_JSON`, `WIRE_SHAPE`, or no slot parsed): round 1 is a full re-author with the same request; a second unusable reply fails the job. An unusable repair reply spends its round. HTTP, network and TLS failures end the calls: the job fails (stage `author` or `repair`) unless a compiled sheet already stands.
   - **Time** (plan §b6): no call starts after deadline−120 s and none runs past the deadline; the deadline defaults to start+720 s (no call after +600 s); a repair call waits at most 200 s (`repair_timeout`).
   - **Result** `StructuredAuthored(source, contract)`; `contract` is `structured_source.CONTRACT`, never read from the payload.
   - **metadata** gets `authorContract` `worksheet-wire/5` and `structured`: per call {purpose, ms, timeoutSeconds, finishReason (`stop`/`incomplete`), usage, and code, httpStatus, httpClass on failure}, refusals {slot, item, field, code} (at most 64, plus a total), selection {requested, delivered, replaced, dropped}, cardSha256, schemaSha256, repairRounds, reauthored, outcome, code, stage, questions. No teacher text, model text, prompt or body (G11). `finishReason` is `stop` or `incomplete` only, because the unchanged provider function does not expose the raw value. The HTTP class comes from the status alone (the body is never read).
2. **Route** (`provider.author_lesson`, v3 only, after the closed authors): `structured_author` only when `TEACHER_V5_TOPICS` (comma list, empty by default) lists the topic and the overlay is reviewed (today only `g7:algebraic_expressions` level b). Otherwise the old path runs byte for byte (golden: unset, empty, other topics, a level the overlay does not enable, the unreviewed ד10 and g9r overlays listed, a v2 lesson listed). With the list empty no v5 author module is imported. `remote_worker.load_env` allows `TEACHER_V5_TOPICS`; `cloud/render/http_supervisor.CHILD_ENV` and the Cloudflare controller do not forward it yet, so neither deployment can switch the route on.
3. **Worker** (`remote_worker`): a v5 result renders with `render_job(..., contract=contract)` and no correction call. Acceptance: status needs_review, `executedChecksPassed`, every step PASS or a SKIP listed in `notRun` (REVIEW is refused), artifacts exactly `[pdf]`; only `sheet.pdf` is uploaded. The result adds `authorContract`, `renderingChecksPassed`, `notRun`, `questionsRequested`, `questionsDelivered` and `replaced`. A v5 failure prints one line `{event: generation_failed, jobId, code, stage, questions[, httpStatus]}`; v4 lines are unchanged. The diagnostics file allowlists the structured record again and halves its detail lists to stay within 8 KB.
4. **Branch test changed:** `test_v5_stage3_hardening.test_only_the_compilers_set_the_flag` lists `remote_worker.py` as the one new pass-through (the task requires the worker to pass the flag), and now also asserts that the worker binds `contract` exactly once, from `structured.source, structured.contract`, has no parameter of that name and passes it to `render_job` only. `V5_MODULES` gains `structured_author.py`.

**Open:** the site has no sentences for `SHEET_*`, `WIRE_*` or `AUTHOR_DEADLINE`; diagnostics stay in the container file (no M2 table); render findings are not yet mapped to question numbers (`questions` is empty for render and acceptance failures); no replacement after a render.
