"""The elementary division kinds of worksheet-wire/5 (overlay ד10, grade 4, level a).

item_kinds dispatches here for an overlay whose "skill" is "elementary", so item_kinds.compile_item stays the
only producer of v5 IR items and item_kinds.verify_item / verify_question the only checkers, shared by compile
time (structured_source) and the final validator (general_source).

Two kinds, both printed by code (Tier A); the model writes numbers, a story id and asks, never Hebrew text:

- division_remainder_drill: an item is one division NUMBER:NUMBER ("125:4"). It prints as one LTR atom
  "125 : 4 =" (the elementary sign table, school_math.to_elementary) and keys the kernel's quotient with its
  remainder: house form "31 שארית 1", or the plain quotient "26" when nothing is left over.
- division_story: a code-written story template (overlay "stories") around two typed givens, n1 (the whole
  amount) and n2 (the size of one group). Every item is {n1}:{n2} with one ask; the three asks are keyed by code:
  full_groups → the quotient (floor), leftover → the remainder, groups_needed → the quotient plus one (ceil).
  Each printed ask text must carry its wording cue. A story whose division leaves no remainder is refused
  (its three keys would not be three answers), and a starred story (a challenge row) must meet the overlay's
  challengeRule (a zero digit in the quotient).

The kernel task of every item is math_tasks divide_remainder {dividend, divisor}; verify_item recomputes the
quotient and remainder independently and binds the printed display (drill) or the question's printed givens
(story, verify_question) to the task.

Leaks and repeats (codes only, G11): DUPLICATE_ITEM (a later item repeating a division or an ask of its question),
DUPLICATE_TASK (a division an earlier question printed), EXAMPLE_COPY (the rule box's worked division), and
STRUCTURE_REPEATED: the source-side mirror of the pinned elementary gate G62 (content_quality.g62_cloned_items),
applied with the pinned fingerprint and profile, loaded by path after a sha256 check, to the exact item strings
the elementary adapter writes into content.json (content_item_text). No vertical long-division drawing is ever
emitted: this is not a geometry page (Noam's drawing rule).

Imports: the standard library, math_tasks, school_math, structured_contract, item_kinds, leak_checks (the stdlib
guard of a pinned module).
"""
from __future__ import annotations

from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import sys
import types

from item_kinds import BindingError, CompiledItem, check_display_span
from math_tasks import MathTaskError, number, validate_and_solve_task
import school_math
from school_math import Num, Product, Ref, SchoolMathError
from structured_contract import CHALLENGES, GIVEN_FIELDS, GIVEN_IDS, ITEM_FIELDS, LIMITS, PRACTICE, kernel_code

DRILL, STORY = "division_remainder_drill", "division_story"
KINDS = (DRILL, STORY)
ANSWER_FIELDS = ("kind", "task", "unit", "printTask", "key")
KEY_FIELDS = {"quotient_remainder": ("form", "quotient", "remainder", "binding"),
              "integer": ("form", "value", "binding")}
BINDING_FIELDS = {DRILL: ("kind",), STORY: ("kind", "template", "ask")}
TASK_FIELDS = ("kind", "dividend", "divisor")
NUMBER_FIELDS = ("type", "numerator", "denominator")
GRADE_LETTERS = "אבגדהו"
LEVEL_LETTERS = {"a": "א", "b": "ב", "e": "מצוינות"}
# Code-written Hebrew outside the overlay, unreviewed (D7) like the overlay's own strings: the Ledger statement of
# every printed division (verified.json only, never printed). The key's remainder word is overlay["remainderWord"].
LEDGER_STATEMENT = "המנה והשארית של החילוק המודפס"
HERE = Path(__file__).resolve().parent
SKILL_LOCK = HERE / "skill-lock.json"
_WHOLE = re.compile(r"[1-9][0-9]*")


def is_elementary(overlay) -> bool:
    return overlay is not None and overlay.get("skill") == "elementary"


def grade_letter(grade_number: int) -> str:
    if type(grade_number) is not int or not 1 <= grade_number <= 6:
        raise ValueError("elementary grade number outside 1..6")
    return GRADE_LETTERS[grade_number - 1]


# ------------------------------------------------------------------ spans and values

def _text(value: str) -> dict:
    return {"kind": "text", "text": value}


def _display(notation: str) -> dict:
    return {"kind": "display", "notation": notation, "symbols": []}


def drill_intro(overlay) -> list:
    """The code-written instruction above a drill question."""
    return [_text(overlay["verbs"][DRILL])]


def story_intro(template: str, pair, overlay) -> list:
    """The code-written story of `template` with its givens printed as display spans (n1, n2)."""
    values = {"n1": str(pair[0]), "n2": str(pair[1])}
    return [_text(value) if part == "T" else _display(values[value])
            for part, value in overlay["stories"][template]["intro"]]


def ask_prompt(template: str, ask: str, overlay) -> list:
    """The prompt of one story item: the template's code-written question for `ask`."""
    return [_text(overlay["stories"][template]["asks"][ask])]


def division_pair(node):
    """(dividend, divisor) when `node` is exactly NUMBER:NUMBER with whole numbers as written, else None."""
    if type(node) is not Product or len(node.rest) != 1:
        return None
    op, right = node.rest[0]
    if op != ":" or type(node.first) is not Num or type(right) is not Num:
        return None
    if not (_WHOLE.fullmatch(node.first.text) and _WHOLE.fullmatch(right.text)):
        return None
    return int(node.first.text), int(right.text)


def in_profile(pair, overlay) -> bool:
    profile = overlay["profile"]
    return (profile["dividend_min"] <= pair[0] <= profile["dividend_max"]
            and profile["divisor_min"] <= pair[1] <= profile["divisor_max"])


def task_of(pair) -> dict:
    return {"kind": "divide_remainder", "dividend": number(pair[0]), "divisor": number(pair[1])}


def task_pair(task):
    """(dividend, divisor) of an IR divide_remainder task, or None when it is not one."""
    if type(task) is not dict or set(task) != set(TASK_FIELDS) or task.get("kind") != "divide_remainder":
        return None
    out = []
    for field in ("dividend", "divisor"):
        value = task[field]
        if (type(value) is not dict or set(value) != set(NUMBER_FIELDS) or value.get("type") != "number"
                or value.get("denominator") != 1 or type(value.get("numerator")) is not int):
            return None
        out.append(value["numerator"])
    return tuple(out)


def key_value(ask: str, quotient: int, remainder: int, overlay) -> int:
    """floor / remainder / ceil of the division, by the overlay's ask table."""
    rule = overlay["asks"][ask]
    if rule == "floor":
        return quotient
    if rule == "remainder":
        return remainder
    if rule == "ceil":
        return quotient + (1 if remainder else 0)
    raise ValueError("unknown ask rule")


def cue_missing(ask: str, text: str, overlay) -> bool:
    """True when a printed ask text lacks its wording cue: full_groups needs a full/whole word (מלא…/שלמ…) and
    neither a leftover nor a needed cue; leftover needs יישאר/נשאר/שארית and no needed cue; groups_needed needs
    צריך … כדי and no leftover cue."""
    has = {name: re.search(pattern, text) is not None for name, pattern in overlay["cues"].items()}
    if ask == "full_groups":
        return not (has["full"] and not has["needed"] and not has["leftover"])
    if ask == "leftover":
        return not (has["leftover"] and not has["needed"])
    if ask == "groups_needed":
        return not (has["needed"] and not has["leftover"])
    return True


def meets_challenge(pair, overlay) -> bool:
    if overlay["challengeRule"] == "quotient_zero_digit":
        return "0" in str(pair[0] // pair[1])
    return True


# ------------------------------------------------------------------ givens

def check_givens(givens, overlay):
    """({given id: whole-number text}, []) or (None, [(field, code)]): GIVEN_SHAPE, GIVEN_VALUE."""
    if type(givens) is not list or not givens or len(givens) > LIMITS["givens_max"]:
        return None, [("givens", "GIVEN_SHAPE")]
    values, refusals = {}, []
    for given in givens:
        if (type(given) is not dict or set(given) != set(GIVEN_FIELDS)
                or any(type(given[field]) is not str for field in GIVEN_FIELDS)
                or given["id"] not in GIVEN_IDS or given["id"] in values
                or given["type"] not in overlay["givenTypes"] or given["unit"] not in ("",) + tuple(overlay["units"])):
            if ("givens", "GIVEN_SHAPE") not in refusals:
                refusals.append(("givens", "GIVEN_SHAPE"))
            continue
        if not re.fullmatch(r"[1-9][0-9]{0,5}", given["value"]):
            if ("givens", "GIVEN_VALUE") not in refusals:
                refusals.append(("givens", "GIVEN_VALUE"))
            continue
        values[given["id"]] = given["value"]
    return (None, refusals) if refusals else (values, [])


# ------------------------------------------------------------------ the item checker shared with general_source

def verify_item(prompt: list, answer: dict, solved: dict, overlay) -> None:
    """IR re-check of one division item: answer and key shape, the divide_remainder task inside the profile, the
    kernel result against an independent divmod, the prompt (drill: the canonical display of the task; story: the
    template's ask text with its wording cue) and the key (KEY_ROUNDTRIP). Raises BindingError."""
    def fail(code):
        raise BindingError(code)

    if (type(answer) is not dict or set(answer) != set(ANSWER_FIELDS) or answer.get("kind") != "computed"
            or answer.get("printTask") is not False or answer.get("unit") != ""):
        fail("BINDING_INTERNAL")
    key, task = answer["key"], answer["task"]
    if (type(key) is not dict or type(key.get("form")) is not str or key["form"] not in KEY_FIELDS
            or set(key) != set(KEY_FIELDS[key["form"]])):
        fail("FORM_UNKNOWN")
    binding = key["binding"]
    kind = binding.get("kind") if type(binding) is dict else None
    if kind not in KINDS or kind not in overlay["kinds"] or set(binding) != set(BINDING_FIELDS[kind]):
        fail("BINDING_INTERNAL")
    if key["form"] != overlay["kinds"][kind]["form"]:
        fail("FORM_UNKNOWN")
    pair = task_pair(task)
    if pair is None:
        fail("BINDING_INTERNAL")
    if not in_profile(pair, overlay):
        fail("MATH_SCOPE_RANGE")
    quotient, remainder = divmod(pair[0], pair[1])
    if (type(solved) is not dict or solved.get("question") != task or type(solved.get("result")) is not dict
            or solved["result"] != {"type": "quotient_remainder", "quotient": number(quotient),
                                    "remainder": number(remainder)}):
        fail("BINDING_INTERNAL")
    if type(prompt) is not list or len(prompt) != 1 or type(prompt[0]) is not dict:
        fail("BINDING_INTERNAL")
    if kind == DRILL:
        span = prompt[0]
        check_display_span(span, overlay)
        node = school_math.parse(span["notation"], letters=(), allow_relation=True)
        if span["symbols"] != [] or division_pair(node) != pair:
            fail("BINDING_INTERNAL")
        if (type(key["quotient"]) is not int or type(key["remainder"]) is not int
                or (key["quotient"], key["remainder"]) != (quotient, remainder)):
            fail("KEY_ROUNDTRIP")
        return
    template, ask = binding["template"], binding["ask"]
    if type(template) is not str or template not in overlay["stories"]:
        fail("TEMPLATE_UNKNOWN")
    if type(ask) is not str or ask not in overlay["kinds"][STORY]["asks"]:
        fail("ASK_UNKNOWN")
    if prompt != ask_prompt(template, ask, overlay):
        fail("TEMPLATE_MISMATCH")
    if cue_missing(ask, prompt[0]["text"], overlay):
        fail("WORDING_CUE")
    if remainder == 0:
        fail("STORY_REMAINDER_ZERO")
    if type(key["value"]) is not int or key["value"] != key_value(ask, quotient, remainder, overlay):
        fail("KEY_ROUNDTRIP")


def verify_question(question: dict, overlay) -> None:
    """One binding kind, its item count; the star allowed for the kind (the row is checked by the selection
    record); a drill prints the overlay verb; a story's items share one template and one task, ask each ask once,
    and the intro is the template printed with the task's dividend and divisor; a starred story meets the
    challengeRule. Raises BindingError."""
    if type(question) is not dict or type(question.get("items")) is not list or not question["items"]:
        raise BindingError("BINDING_INTERNAL")
    items = question["items"]
    try:
        bindings = [item["answer"]["key"]["binding"] for item in items]
        kinds = {binding["kind"] for binding in bindings}
    except (KeyError, TypeError):
        raise BindingError("BINDING_INTERNAL") from None
    if len(kinds) != 1:
        raise BindingError("BINDING_INTERNAL")
    kind = kinds.pop()
    if kind not in KINDS or kind not in overlay["kinds"]:
        raise BindingError("BINDING_INTERNAL")
    row = overlay["kinds"][kind]
    low, high = row["items"]
    if not low <= len(items) <= high:
        raise BindingError("ITEM_COUNT")
    star = question.get("star")
    if type(star) is not bool or (CHALLENGES if star else PRACTICE) not in row["groups"]:
        raise BindingError("BINDING_INTERNAL")
    if kind == DRILL:
        if question.get("intro") != drill_intro(overlay):
            raise BindingError("BINDING_INTERNAL")
        return
    pairs = {task_pair(item["answer"]["task"]) for item in items}
    templates = {binding.get("template") for binding in bindings}
    if len(pairs) != 1 or None in pairs or len(templates) != 1:
        raise BindingError("TEMPLATE_MISMATCH")
    asks = [binding.get("ask") for binding in bindings]
    if len(set(asks)) != len(asks):
        raise BindingError("DUPLICATE_ITEM")
    pair, template = pairs.pop(), templates.pop()
    if template not in overlay["stories"] or question.get("intro") != story_intro(template, pair, overlay):
        raise BindingError("TEMPLATE_MISMATCH")
    if star and not meets_challenge(pair, overlay):
        raise BindingError("CHALLENGE_PROFILE")


# ------------------------------------------------------------------ compile one wire item

def compile_item(kind: str, item: dict, index: int, ctx, *, givens=None) -> CompiledItem:
    """Wire item → IR prompt and answer of one division item (checks I1-I6); ends by calling verify_item.

    `givens` is the question's checked {id: value} map (story), or None when the question's givens were refused:
    the item's own checks still run, but nothing is resolved and the item carries no IR (the question is refused
    for its givens)."""
    overlay = ctx.overlay
    row = overlay["kinds"].get(kind)
    if row is None:
        raise ValueError("compile_item needs a kind of the overlay")
    refusals = []

    def refuse(field, code):
        if (field, code) not in refusals:
            refusals.append((field, code))

    def done(prompt=None, answer=None, solved=None):
        return CompiledItem(index, prompt, answer, solved, refusals)

    # I1 item shape
    if (type(item) is not dict or set(item) != set(ITEM_FIELDS)
            or any(type(item[field]) is not str for field in ITEM_FIELDS)):
        refuse("", "ITEM_SHAPE")
        return done()
    reads = set(row["reads"])
    for field in ("text", "expr2", "values", "variant", "ask"):
        if field not in reads and item[field] != "":
            refuse(field, "FIELD_NOT_EMPTY")
    if "ask" in reads and item["ask"] not in row["asks"]:
        refuse("ask", "ASK_UNKNOWN")
    if item["form"] not in ("", row["form"]):
        refuse("form", "FORM_UNKNOWN")
    if "variant" in reads and item["variant"] not in overlay["stories"]:
        refuse("variant", "TEMPLATE_UNKNOWN")
    if item["text"]:
        from text_lint import lint_model_text
        codes, _ = lint_model_text(item["text"], grade=ctx.lesson["gradeNumber"], declared=(),
                                   forbidden_terms=overlay["forbiddenTerms"], max_length=LIMITS["text"])
        for code in codes:
            refuse("text", code)

    # I2 parse (a story's expr names its givens; a drill has none, so a reference there is MATH_PARSE)
    node = None
    try:
        node = school_math.parse(item["expr"], letters=(), max_length=LIMITS["expr"], allow_refs=bool(row["givens"]))
    except SchoolMathError as error:
        refuse("expr", error.code)

    # I3/I4 shape, binding and range
    pair, resolvable = None, True
    if node is not None:
        if kind == STORY:
            if not (type(node) is Product and len(node.rest) == 1 and node.rest[0][0] == ":"
                    and node.first == Ref("n1") and node.rest[0][1] == Ref("n2")):
                refuse("expr", "TEMPLATE_MISMATCH")
            elif givens is None:
                resolvable = False
            else:
                try:
                    pair = division_pair(school_math.resolve(node, givens))
                except SchoolMathError as error:
                    refuse("expr", error.code)
                else:
                    if pair is None:
                        refuse("expr", "DIVISION_SHAPE")
        else:
            pair = division_pair(node)
            if pair is None:
                refuse("expr", "DIVISION_SHAPE")
        if pair is not None and not in_profile(pair, overlay):
            refuse("expr", "MATH_SCOPE_RANGE")
            pair = None
    if refusals or not resolvable:
        return done()

    # I5 kernel
    task = task_of(pair)
    try:
        solved = validate_and_solve_task(task)
    except MathTaskError as error:
        refuse("expr", kernel_code(error.code))
        return done()
    result = solved["result"]
    quotient, remainder = result["quotient"]["numerator"], result["remainder"]["numerator"]
    if kind == STORY and remainder == 0:
        refuse("expr", "STORY_REMAINDER_ZERO")
        return done()

    # I6 prompt and key
    if kind == DRILL:
        prompt = [_display("%d:%d" % pair)]
        key = {"form": "quotient_remainder", "quotient": quotient, "remainder": remainder,
               "binding": {"kind": DRILL}}
    else:
        template, ask = item["variant"], item["ask"]
        prompt = ask_prompt(template, ask, overlay)
        key = {"form": "integer", "value": key_value(ask, quotient, remainder, overlay),
               "binding": {"kind": STORY, "template": template, "ask": ask}}
    answer = {"kind": "computed", "task": task, "unit": "", "printTask": False, "key": key}
    try:
        verify_item(prompt, answer, solved, overlay)
    except BindingError as error:
        refuse("", error.code if error.code == "WORDING_CUE" else "BINDING_INTERNAL")
        return done()
    return done(prompt, answer, solved)


# ------------------------------------------------------------------ leaks and repeats

def question_leaks(question: dict) -> list:
    """[(1-based item index, DUPLICATE_ITEM)]: a later item with the division (drill) or the ask (story) of an
    earlier item of the same question. Monotone: removing items never adds a hit."""
    seen, hits = set(), []
    for index, item in enumerate(question["items"], 1):
        binding = item["answer"]["key"]["binding"]
        mark = (task_pair(item["answer"]["task"]), binding.get("ask", ""))
        if mark in seen:
            hits.append((index, "DUPLICATE_ITEM"))
        seen.add(mark)
    return hits


def sheet_leaks(questions: list, overlay) -> dict:
    """{0-based index of the LATER question: sorted codes}: DUPLICATE_TASK (a division an earlier, unrefused
    question prints) and EXAMPLE_COPY (the rule box's worked division)."""
    examples = {(int(a), int(b)) for a, b in overlay["ruleExamples"]}
    seen, hits = set(), {}
    for index, question in enumerate(questions):
        pairs = {task_pair(item["answer"]["task"]) for item in question["items"]}
        codes = set()
        if pairs & seen:
            codes.add("DUPLICATE_TASK")
        if pairs & examples:
            codes.add("EXAMPLE_COPY")
        if codes:
            hits[index] = sorted(codes)
        else:
            seen |= pairs
    return hits


# ------------------------------------------------------------------ what the adapter writes

def drill_atom(item: dict, grade: str) -> str:
    """The LTR atom text of one drill item ("125 : 4"), in the grade's elementary signs."""
    node = school_math.parse(item["prompt"][0]["notation"], letters=())
    return school_math.to_elementary(node, grade)


def key_parts(item: dict, grade: str, overlay) -> list:
    """The printed key of one item as [("atom", text) | ("text", Hebrew)]: "31 שארית 1" is two atoms around the
    overlay's remainder word (the order pinned gate G66 requires); no remainder → the plain quotient; a story → its
    number."""
    key = item["answer"]["key"]
    if key["form"] == "quotient_remainder":
        quotient = school_math.elementary_number(str(key["quotient"]), grade)
        if key["remainder"] == 0:
            return [("atom", quotient)]
        return [("atom", quotient), ("text", " " + overlay["remainderWord"] + " "),
                ("atom", school_math.elementary_number(str(key["remainder"]), grade))]
    return [("atom", school_math.elementary_number(str(key["value"]), grade))]


def content_item_text(item: dict, grade: str) -> str:
    """The plain text the elementary adapter writes for one item into content.json (what pinned G62 reads):
    a drill "125 : 4 =", a story its ask text. The adapter checks that its HTML reads back to exactly this."""
    if item["answer"]["key"]["binding"]["kind"] == DRILL:
        return drill_atom(item, grade) + " ="
    return item["prompt"][0]["text"]


# ------------------------------------------------------------------ the pinned G62 mirror

_PINNED = {}


def pinned_elementary(skill_path: str, relative: str):
    """Import a stdlib-only module of the pinned elementary skill by path after a sha256 check against
    skill-lock.json; no sys.path change, no bytecode written, not registered in sys.modules. Cached by path and
    hash; the file is re-hashed on every call. Mismatch → ValueError('SKILL_HASH_MISMATCH')."""
    import leak_checks
    pin = json.loads(SKILL_LOCK.read_text(encoding="utf-8"))["skills"]["elementary"]["files"]
    expected = pin.get(relative) if isinstance(relative, str) else None
    path = Path(skill_path) / str(relative)
    if (not isinstance(expected, str) or not relative.endswith(".py") or ".." in Path(relative).parts
            or Path(relative).is_absolute() or path.is_symlink() or not path.is_file()):
        raise ValueError("SKILL_HASH_MISMATCH")
    source = path.read_bytes()
    digest = hashlib.sha256(source).hexdigest()
    if digest != expected:
        raise ValueError("SKILL_HASH_MISMATCH")
    cache_key = (str(path.resolve()), digest)
    module = _PINNED.get(cache_key)
    if module is None:
        leak_checks._require_stdlib(source, relative)
        module = types.ModuleType("_v5_pinned_elementary_%s_%s" % (Path(relative).stem, digest[:12]))
        module.__file__ = str(path)
        code = compile(source, str(path), "exec", dont_inherit=True)
        previous = sys.dont_write_bytecode
        sys.dont_write_bytecode = True
        try:
            exec(code, module.__dict__)
        finally:
            sys.dont_write_bytecode = previous
        _PINNED[cache_key] = module
    return module


def clone_limit(skill_path: str, grade_number: int, level: str) -> int:
    """The pinned G62 limit for the sheet: max_clone of the pinned content_quality profile of its grade and level."""
    quality = pinned_elementary(skill_path, "scripts/lib/content_quality.py")
    band = "elementary-ab" if grade_number <= 2 else "elementary"
    profile = quality.profile_of({"meta": {"band": band, "grade": grade_letter(grade_number),
                                           "level": LEVEL_LETTERS[level]}})
    if profile is None:
        raise ValueError("SKILL_HASH_MISMATCH")
    return profile.max_clone


def clone_hits(questions: list, *, skill_path: str, grade_number: int, level: str) -> dict:
    """{0-based index of the LATER question: ["STRUCTURE_REPEATED"]}, in printed order: a question with an item
    whose pinned G62 fingerprint the questions before it (minus the ones already hit) printed max_clone times.

    The fingerprint, the skip rule for short generic prose and the limit are the pinned gate's own, applied to the
    exact content.json item strings (content_item_text). A sheet with no hit passes the pinned clone count."""
    quality = pinned_elementary(skill_path, "scripts/lib/content_quality.py")
    cap = clone_limit(skill_path, grade_number, level)
    grade = grade_letter(grade_number)
    counts, hits = Counter(), {}
    for index, question in enumerate(questions):
        prints = Counter()
        for item in question["items"]:
            fingerprint = quality.fingerprint(content_item_text(item, grade))
            # The pinned gate's own skip rule (content_quality.g62_cloned_items).
            if not fingerprint or ("#" not in fingerprint and "@" not in fingerprint and len(fingerprint) < 12):
                continue
            prints[fingerprint] += 1
        if any(counts[fingerprint] + count > cap for fingerprint, count in prints.items()):
            hits[index] = ["STRUCTURE_REPEATED"]
            continue
        counts.update(prints)
    return hits


__all__ = ["DRILL", "STORY", "KINDS", "is_elementary", "grade_letter", "drill_intro", "story_intro", "ask_prompt",
           "division_pair", "in_profile", "task_of", "task_pair", "key_value", "cue_missing", "meets_challenge",
           "check_givens", "verify_item", "verify_question", "compile_item", "question_leaks", "sheet_leaks",
           "drill_atom", "key_parts", "content_item_text", "pinned_elementary", "clone_limit", "clone_hits"]
