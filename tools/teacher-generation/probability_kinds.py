"""The probability kinds of worksheet-wire/5 (overlay g9r:probability, grade 9, level e).

item_kinds dispatches here for an overlay whose "family" is "probability", so item_kinds.compile_item stays the only
producer of v5 IR items and item_kinds.verify_item / verify_question the only checkers, shared by compile time
(structured_source) and the final validator (general_source).

Five kinds, every one a code-written story (Tier A) around typed count givens n1..nK; the model chooses the story
(variant), the counts, one ask and one form per item, and writes as expr the probability the ask names over the
givens. It never writes Hebrew, a table or a key:

- single_draw_probability: one draw from three categories (#0): one_k, either_jk;
- relative_frequency: a one-way table of outcome counts (#1): freq_k (the relative frequency of outcome k) and prob_k
  (the probability it gives); form fraction, decimal or percent as the item declares, printed after the ask;
- complement_probability: two draws with replacement from two categories (#2): not_first_k (1 minus the probability
  of k in the first draw) and at_least_one_k (1 minus the probability of no k in both draws);
- two_stage_with_replacement, two_stage_without_replacement: two draws from two categories (#3): both_k,
  first_j_second_k, one_of_each, same, and (without replacement) at_least_one_k. A starred question (a challenge
  row) asks only combined events (overlay challengeAsks).

Keys. For every (kind, ask, number of categories) code holds one canonical probability over the givens
(canonical_text). The item's task is the kernel task {"kind": "evaluate", "expression": that probability with the
counts in place}; the key is the kernel's exact value printed as a reduced fraction ("2/5", house \\f{2}{5}), a
decimal ("0.35") or a whole percent ("35%", house 35\\%). verify_item recomputes the value from the counts with an
independent Fraction formula (probability_value) and recovers the counts from the task by unifying it with the
canonical expression, so the final validator needs no givens list: the question's printed story (intro and table)
must be exactly the story printed with those counts (verify_question).

The model's expr is bound to its ask, not trusted: it must be written over the givens only (literals 1 and 2, the
power 2), its exact value at the givens must lie strictly between 0 and 1 (PROB_RANGE), and it must agree with the
canonical probability at the givens and at fixed probe points (ASK_MISMATCH). (The kernel's expansion budget cannot
compare the long two-draw rational functions symbolically, so the binding is exact evaluation at several points;
the key never comes from the model's expr.)

Leaks and repeats (codes only, G11): DUPLICATE_ITEM (a later item repeating an ask or a task of its question),
KEY_REPEATED (a later item with the value of an earlier one), LEAK_PINNED_VALUE (the pinned D12 f_atoms / f_hit on the
key island against each printed string of the question: the intro, every table cell and every prompt, as the pinned
D12 file check reads a question's own words), DUPLICATE_TASK (a task an earlier question printed), DUPLICATE_REORDERED (the same kind with
the same counts as an earlier question) and LEAK_RULE_FACT (a question sharing a probability with an equation of the
rule box, overlay ruleFacts). No drawing is ever emitted: this is not a geometry page.

Imports: the standard library, math_tasks, school_math, structured_contract, item_kinds, leak_checks (lazily).
"""
from __future__ import annotations

from fractions import Fraction
import json
import re

from item_kinds import BindingError, CompiledItem
from math_tasks import MathTaskError, number, validate_and_solve_task
import school_math
from school_math import Group, Neg, Num, Power, Product, Ref, Relation, SchoolMathError, Sum, Var
from structured_contract import CHALLENGES, GIVEN_FIELDS, GIVEN_IDS, ITEM_FIELDS, LIMITS, PRACTICE, kernel_code

SINGLE, FREQUENCY, COMPLEMENT = "single_draw_probability", "relative_frequency", "complement_probability"
WITH, WITHOUT = "two_stage_with_replacement", "two_stage_without_replacement"
KINDS = (SINGLE, FREQUENCY, COMPLEMENT, WITH, WITHOUT)
_TWO_STAGE = ("both_1", "both_2", "first_1_second_2", "first_2_second_1", "one_of_each", "same")
ASKS_BY_KIND = {
    SINGLE: ("one_1", "one_2", "one_3", "either_12", "either_13", "either_23"),
    FREQUENCY: ("freq_1", "freq_2", "freq_3", "freq_4", "prob_1", "prob_2", "prob_3", "prob_4"),
    COMPLEMENT: ("not_first_1", "not_first_2", "at_least_one_1", "at_least_one_2"),
    WITH: _TWO_STAGE,
    WITHOUT: _TWO_STAGE + ("at_least_one_1", "at_least_one_2"),
}
# Two draws put the first object back (with) or keep it out (without); a single draw has no second stage.
REPLACEMENT = {SINGLE: None, FREQUENCY: None, COMPLEMENT: True, WITH: True, WITHOUT: False}
ANSWER_FIELDS = ("kind", "task", "unit", "printTask", "key")
KEY_FIELDS = ("form", "notation", "symbols", "binding")
BINDING_FIELDS = ("kind", "template", "ask")
TASK_FIELDS = ("kind", "expression")
FORMS = ("fraction", "decimal", "percent")
# Probe points of the expr/ask binding: generic counts (every value at least 2, so no probe divides by zero for a
# canonical probability); the first K entries of each are the K counts.
PROBE_POINTS = ((7, 11, 13, 17), (19, 23, 29, 31), (37, 41, 43, 47), (5, 3, 2, 9), (53, 59, 61, 67),
                (12, 25, 8, 30))
_SYMBOLS = {"n1": "x", "n2": "y", "n3": "a", "n4": "b"}      # given → kernel symbol, for unifying a task only
_COUNT = re.compile(r"[1-9][0-9]{0,3}")


def is_probability(overlay) -> bool:
    return overlay is not None and overlay.get("family") == "probability"


# ------------------------------------------------------------------ asks and their canonical probabilities

def ask_parts(ask):
    """(name, indices) of an ask id, or None: one_2 → ('one', (2,)), either_13 → ('either', (1, 3)),
    first_1_second_2 → ('first_second', (1, 2)), one_of_each → ('one_of_each', ())."""
    if type(ask) is not str:
        return None
    match = re.fullmatch(r"(one|freq|prob|not_first|at_least_one|both)_([1-4])", ask)
    if match:
        return match.group(1), (int(match.group(2)),)
    match = re.fullmatch(r"either_([1-4])([1-4])", ask)
    if match and match.group(1) < match.group(2):
        return "either", (int(match.group(1)), int(match.group(2)))
    match = re.fullmatch(r"first_([12])_second_([12])", ask)
    if match and match.group(1) != match.group(2):
        return "first_second", (int(match.group(1)), int(match.group(2)))
    if ask in ("one_of_each", "same"):
        return ask, ()
    return None


def ask_available(kind, ask, categories) -> bool:
    """True when `ask` is an ask of `kind` that a story with `categories` categories can print."""
    parts = ask_parts(ask)
    if kind not in ASKS_BY_KIND or ask not in ASKS_BY_KIND[kind] or parts is None:
        return False
    name, indices = parts
    if name in ("one", "freq", "prob", "either", "not_first"):
        return all(index <= categories for index in indices) and (REPLACEMENT[kind] is None or categories == 2)
    return categories == 2 and REPLACEMENT[kind] is not None


def _ref(index):
    return "{n%d}" % index


def canonical_text(kind, ask, categories) -> str:
    """The story's own probability of `ask`, over the givens, in school grammar ({n2}/({n1}+{n2}+{n3}), ...)."""
    if not ask_available(kind, ask, categories):
        raise ValueError("no canonical probability for this ask")
    name, indices = ask_parts(ask)
    total = "(" + "+".join(_ref(i) for i in range(1, categories + 1)) + ")"
    if name in ("one", "freq", "prob"):
        return "%s/%s" % (_ref(indices[0]), total)
    if name == "either":
        return "(%s+%s)/%s" % (_ref(indices[0]), _ref(indices[1]), total)
    if name == "not_first":
        return "1-%s/%s" % (_ref(indices[0]), total)
    less = "(" + "+".join(_ref(i) for i in range(1, categories + 1)) + "-1)"

    def path(first, second):
        """first category `first`, then `second`: a product of two fractions."""
        if REPLACEMENT[kind]:
            return "(%s/%s)*(%s/%s)" % (_ref(first), total, _ref(second), total)
        if first == second:
            return "(%s/%s)*((%s-1)/%s)" % (_ref(first), total, _ref(second), less)
        return "(%s/%s)*(%s/%s)" % (_ref(first), total, _ref(second), less)

    if name == "both":
        return path(indices[0], indices[0])
    if name == "first_second":
        return path(*indices)
    if name == "one_of_each":
        return path(1, 2) + "+" + path(2, 1)
    if name == "same":
        return path(1, 1) + "+" + path(2, 2)
    other = 3 - indices[0]                                    # at_least_one_k: 1 minus no k in both draws
    return "1-" + path(other, other)


def canonical_node(kind, ask, categories):
    return school_math.parse(canonical_text(kind, ask, categories), letters=(), max_length=LIMITS["expr"])


def probability_value(kind, ask, counts) -> Fraction:
    """The probability of `ask` for these counts, computed directly with Fractions (independent of the kernel and of
    canonical_text). ValueError when the ask does not fit the counts."""
    categories = len(counts)
    if not ask_available(kind, ask, categories) or any(type(c) is not int or c < 0 for c in counts):
        raise ValueError("no probability for this ask")
    total = sum(counts)
    if total < 2:
        raise ValueError("too few objects for a probability")
    name, indices = ask_parts(ask)
    count = lambda index: counts[index - 1]
    if name in ("one", "freq", "prob"):
        return Fraction(count(indices[0]), total)
    if name == "either":
        return Fraction(count(indices[0]) + count(indices[1]), total)
    if name == "not_first":
        return 1 - Fraction(count(indices[0]), total)

    def path(first, second):
        if REPLACEMENT[kind]:
            return Fraction(count(first), total) * Fraction(count(second), total)
        return Fraction(count(first), total) * Fraction(count(second) - (first == second), total - 1)

    if name == "both":
        return path(indices[0], indices[0])
    if name == "first_second":
        return path(*indices)
    if name == "one_of_each":
        return path(1, 2) + path(2, 1)
    if name == "same":
        return path(1, 1) + path(2, 2)
    other = 3 - indices[0]
    return 1 - path(other, other)


# ------------------------------------------------------------------ exact evaluation and unification

def evaluate(node, values):
    """The exact value of a school-grammar tree with every reference bound in `values` ({given: Fraction | int}),
    or None when it divides by zero or names an unbound given."""
    kind = type(node)
    if kind is Num:
        return node.value
    if kind is Ref:
        value = values.get(node.given)
        return None if value is None else Fraction(value)
    if kind is Neg:
        inner = evaluate(node.operand, values)
        return None if inner is None else -inner
    if kind is Group:
        return evaluate(node.inner, values)
    if kind is Sum:
        total = evaluate(node.first, values)
        for op, child in node.rest:
            value = evaluate(child, values)
            if total is None or value is None:
                return None
            total = total + value if op == "+" else total - value
        return total
    if kind is Product:
        total = evaluate(node.first, values)
        for op, child in node.rest:
            value = evaluate(child, values)
            if total is None or value is None:
                return None
            if op in ("", "*"):
                total = total * value
            elif value == 0:
                return None
            else:
                total = total / value
        return total
    if kind is Power:
        base = evaluate(node.base, values)
        return None if base is None else base ** node.exponent
    return None


def _as_letters(node):
    """The tree with every reference n1..n4 replaced by its kernel symbol (x, y, a, b), for unification only."""
    kind = type(node)
    if kind is Ref:
        return Var(_SYMBOLS[node.given])
    if kind is Neg:
        return Neg(_as_letters(node.operand))
    if kind is Group:
        return Group(_as_letters(node.inner))
    if kind in (Sum, Product):
        return kind(_as_letters(node.first), tuple((op, _as_letters(child)) for op, child in node.rest))
    if kind is Power:
        return Power(_as_letters(node.base), node.exponent)
    return node


def task_counts(kind, ask, categories, expression):
    """The counts a task expression was built from, recovered by unifying it with the canonical probability of
    `ask` (each given a positive whole number, the same at every occurrence), or None when it is not that task."""
    if not ask_available(kind, ask, categories):
        return None
    pattern = school_math.to_kernel(_as_letters(canonical_node(kind, ask, categories)))
    binding = {}

    def unify(left, right):
        if type(right) is not dict:
            return False
        if left["type"] == "symbol":
            if (set(right) != {"type", "numerator", "denominator"} or right["type"] != "number"
                    or right["denominator"] != 1 or type(right["numerator"]) is not int or right["numerator"] < 1):
                return False
            return binding.setdefault(left["name"], right["numerator"]) == right["numerator"]
        if left["type"] == "number":
            return right == left
        args = right.get("args")
        return (right.get("type") == "operation" and right.get("op") == left["op"] and type(args) is list
                and len(args) == len(left["args"]) and all(unify(a, b) for a, b in zip(left["args"], args))
                and set(right) == {"type", "op", "args"})

    if not unify(pattern, expression):
        return None
    symbols = [_SYMBOLS["n%d" % i] for i in range(1, categories + 1)]
    if any(symbol not in binding for symbol in symbols):
        return None
    return tuple(binding[symbol] for symbol in symbols)


def task_of(kind, ask, counts) -> dict:
    """The kernel task of one item: evaluate the canonical probability with the counts in place."""
    node = school_math.resolve(canonical_node(kind, ask, len(counts)),
                               {"n%d" % i: str(value) for i, value in enumerate(counts, 1)})
    return {"kind": "evaluate", "expression": school_math.to_kernel(node)}


def binds(node, kind, ask, counts) -> bool:
    """ASK_MISMATCH's test: the expr agrees exactly with the canonical probability at the counts and at every probe
    point (both defined, equal)."""
    canonical = canonical_node(kind, ask, len(counts))
    for point in (tuple(counts),) + tuple(probe[:len(counts)] for probe in PROBE_POINTS):
        values = {"n%d" % i: value for i, value in enumerate(point, 1)}
        mine, theirs = evaluate(node, values), evaluate(canonical, values)
        if mine is None or theirs is None or mine != theirs:
            return False
    return True


# ------------------------------------------------------------------ what prints

def _text(value: str) -> dict:
    return {"kind": "text", "text": value}


def _display(notation: str) -> dict:
    return {"kind": "display", "notation": notation, "symbols": []}


def story_intro(template, counts, overlay) -> list:
    """The code-written story of `template` with its counts printed as display spans (n1..nK)."""
    values = {"n%d" % i: str(value) for i, value in enumerate(counts, 1)}
    return [_text(value) if part == "T" else _display(values[value])
            for part, value in overlay["stories"][template]["intro"]]


def story_table(template, counts, overlay):
    """The one-way table of a relative-frequency story (head labels; one row: its label, then one display span per
    count), or None for a story without a table. Never a two-way table."""
    table = overlay["stories"][template].get("table")
    if table is None:
        return None
    return {"head": [[_text(label)] for label in table["head"]],
            "rows": [[[_text(table["rowHead"])]] + [[_display(str(value))] for value in counts]]}


def ask_prompt(template, ask, form, overlay) -> list:
    """The prompt of one item: the story's code-written question for `ask` and, when the kind accepts more than one
    form, the form instruction after it."""
    story = overlay["stories"][template]
    text = story["asks"][ask]
    if len(overlay["kinds"][story["kind"]]["forms"]) > 1:
        text += " " + overlay["formNotes"][form]
    return [_text(text)]


def key_notation(value, form, overlay) -> str:
    """The school-grammar notation of a probability in `form`: "2/5", "0.35" or "35%". A value the form cannot
    print exactly (a decimal longer than decimalPlaces, a percent that is not whole) → ValueError."""
    value = Fraction(value)
    if not 0 < value < 1:
        raise ValueError("FORM_UNREPRESENTABLE")
    if form == "fraction":
        return "%d/%d" % (value.numerator, value.denominator)
    if form == "decimal":
        places = overlay["profile"]["decimalPlaces"]
        scaled = value * 10 ** places
        if scaled.denominator != 1:
            raise ValueError("FORM_UNREPRESENTABLE")
        digits = str(scaled.numerator).rjust(places + 1, "0")
        return (digits[:-places] + "." + digits[-places:]).rstrip("0").rstrip(".")
    if form == "percent":
        scaled = value * 100
        if scaled.denominator != 1:
            raise ValueError("FORM_UNREPRESENTABLE")
        return "%d%%" % scaled.numerator
    raise ValueError("FORM_UNKNOWN")


def key_value(key):
    """The value a key notation prints (a Fraction), or None when it is not a plain school number or fraction."""
    try:
        node = school_math.parse(key["notation"], letters=())
    except (SchoolMathError, KeyError, TypeError):
        return None
    return evaluate(node, {})


def key_roundtrip(key, value) -> bool:
    """KEY_ROUNDTRIP: the notation is canonical, its house island reads back to the same tree, and it prints
    `value`."""
    try:
        node = school_math.parse(key["notation"], letters=())
        if school_math.unparse(node) != key["notation"]:
            return False
        if school_math.from_house(school_math.to_house(node), letters=()) != node:
            return False
    except (SchoolMathError, KeyError, TypeError):
        return False
    return evaluate(node, {}) == value


# ------------------------------------------------------------------ givens and the expr scope

def story_counts_of(template, overlay) -> int:
    return overlay["stories"][template]["categories"]


def in_profile(kind, counts, overlay) -> bool:
    profile = overlay["kinds"][kind]["counts"]
    return (all(profile["min"] <= count <= profile["max"] for count in counts)
            and profile["totalMin"] <= sum(counts) <= profile["totalMax"])


def check_givens(givens, kind, template, overlay):
    """(counts in id order, []) or (None, [(field, code)]): GIVEN_SHAPE (shape, type, unit, ids other than n1..nK of
    the story), GIVEN_VALUE (not a whole number), MATH_SCOPE_RANGE (a count or the total outside the kind's profile).
    Without a known story (template None) the ids cannot be checked against it and no counts are returned."""
    if type(givens) is not list or not givens or len(givens) > LIMITS["givens_max"]:
        return None, [("givens", "GIVEN_SHAPE")]
    values, refusals = {}, []

    def refuse(code):
        if ("givens", code) not in refusals:
            refusals.append(("givens", code))

    for given in givens:
        if (type(given) is not dict or set(given) != set(GIVEN_FIELDS)
                or any(type(given[field]) is not str for field in GIVEN_FIELDS)
                or given["id"] not in GIVEN_IDS or given["id"] in values
                or given["type"] not in overlay["givenTypes"] or given["unit"] not in ("",) + tuple(overlay["units"])):
            refuse("GIVEN_SHAPE")
            continue
        if not _COUNT.fullmatch(given["value"]):
            refuse("GIVEN_VALUE")
            values[given["id"]] = None
            continue
        values[given["id"]] = int(given["value"])
    if template is None:
        return None, refusals
    categories = story_counts_of(template, overlay)
    if set(values) != {"n%d" % i for i in range(1, categories + 1)}:
        refuse("GIVEN_SHAPE")
    if refusals:
        return None, refusals
    counts = tuple(values["n%d" % i] for i in range(1, categories + 1))
    if not in_profile(kind, counts, overlay):
        return None, [("givens", "MATH_SCOPE_RANGE")]
    return counts, []


def expr_codes(node, ids, overlay) -> list:
    """Sorted scope codes of a model expr: TASK_LITERAL (a number other than the profile's literals 1 and 2: every
    count lives in a given), REF_UNDECLARED (a reference outside the story's givens), MATH_SCOPE_POWER (an exponent
    other than 2)."""
    profile = overlay["profile"]
    literals = {str(value) for value in profile["literals"]}
    codes, stack = set(), [node]
    while stack:
        item = stack.pop()
        kind = type(item)
        if kind is Num and item.text not in literals:
            codes.add("TASK_LITERAL")
        elif kind is Ref and item.given not in ids:
            codes.add("REF_UNDECLARED")
        elif kind is Power and item.exponent != profile["power"]:
            codes.add("MATH_SCOPE_POWER")
        elif kind in (Var, Relation):
            codes.add("MATH_PARSE")
        stack.extend(_children(item))
    return sorted(codes)


def _children(node) -> tuple:
    kind = type(node)
    if kind is Neg:
        return (node.operand,)
    if kind is Group:
        return (node.inner,)
    if kind in (Sum, Product):
        return (node.first,) + tuple(child for _, child in node.rest)
    if kind is Power:
        return (node.base,)
    if kind is Relation:
        return (node.left, node.right)
    return ()


# ------------------------------------------------------------------ the item checker shared with general_source

def _kind_row(kind, overlay):
    return overlay["kinds"].get(kind) if kind in KINDS else None


def verify_item(prompt: list, answer: dict, solved: dict, overlay) -> None:
    """IR re-check of one probability item: answer and key shape, the binding (kind, story, ask, form), the prompt
    (the story's ask text and form note), the evaluate task (the canonical probability of the ask with counts in
    the kind's profile, recovered by unification), the kernel result against the independent probability_value,
    PROB_RANGE, and the key (exactly key_notation of the value; KEY_ROUNDTRIP). Raises BindingError."""
    def fail(code):
        raise BindingError(code)

    if (type(answer) is not dict or set(answer) != set(ANSWER_FIELDS) or answer.get("kind") != "computed"
            or answer.get("printTask") is not False or answer.get("unit") != ""):
        fail("BINDING_INTERNAL")
    key, task = answer["key"], answer["task"]
    if type(key) is not dict or set(key) != set(KEY_FIELDS):
        fail("FORM_UNKNOWN")
    binding = key["binding"]
    kind = binding.get("kind") if type(binding) is dict else None
    row = _kind_row(kind, overlay)
    if row is None or set(binding) != set(BINDING_FIELDS):
        fail("BINDING_INTERNAL")
    template, ask, form = binding["template"], binding["ask"], key["form"]
    if type(template) is not str or template not in overlay["stories"]:
        fail("TEMPLATE_UNKNOWN")
    if overlay["stories"][template]["kind"] != kind:
        fail("TEMPLATE_MISMATCH")
    categories = story_counts_of(template, overlay)
    if not ask_available(kind, ask, categories) or ask not in row["asks"]:
        fail("ASK_UNKNOWN")
    if type(form) is not str or form not in row["forms"]:
        fail("FORM_UNKNOWN")
    if prompt != ask_prompt(template, ask, form, overlay):
        fail("TEMPLATE_MISMATCH")
    if type(task) is not dict or set(task) != set(TASK_FIELDS) or task.get("kind") != "evaluate":
        fail("BINDING_INTERNAL")
    counts = task_counts(kind, ask, categories, task["expression"])
    if counts is None:
        fail("BINDING_INTERNAL")
    if not in_profile(kind, counts, overlay):
        fail("MATH_SCOPE_RANGE")
    value = probability_value(kind, ask, counts)
    if (type(solved) is not dict or solved.get("question") != task
            or solved.get("result") != {"type": "expression", "value": number(value.numerator, value.denominator)}):
        fail("BINDING_INTERNAL")
    if not 0 < value < 1:
        fail("PROB_RANGE")
    try:
        notation = key_notation(value, form, overlay)
    except ValueError:
        fail("FORM_UNREPRESENTABLE")
    if key["symbols"] != [] or key["notation"] != notation or not key_roundtrip(key, value):
        fail("KEY_ROUNDTRIP")


def question_counts(question, overlay):
    """(kind, story, counts) of an IR probability question, or None when its items disagree."""
    try:
        bindings = [item["answer"]["key"]["binding"] for item in question["items"]]
        kinds = {binding["kind"] for binding in bindings}
        templates = {binding["template"] for binding in bindings}
    except (KeyError, TypeError):
        return None
    if len(kinds) != 1 or len(templates) != 1:
        return None
    kind, template = kinds.pop(), templates.pop()
    if type(template) is not str or template not in overlay["stories"] or overlay["stories"][template]["kind"] != kind:
        return None
    categories = story_counts_of(template, overlay)
    found = set()
    for item, binding in zip(question["items"], bindings):
        task = item["answer"].get("task") if type(item.get("answer")) is dict else None
        expression = task.get("expression") if type(task) is dict else None
        found.add(task_counts(kind, binding.get("ask"), categories, expression))
    if len(found) != 1 or None in found:
        return None
    return kind, template, found.pop()


def verify_question(question: dict, overlay) -> None:
    """One binding kind and one story, its item count; the star allowed for the kind (the row is checked by the
    selection record); every task built from the same counts, each ask once; the intro and the table exactly the
    story printed with those counts (no table for a story without one); a starred question asks only challenge
    asks. Raises BindingError."""
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
    row = _kind_row(kind, overlay)
    if row is None:
        raise BindingError("BINDING_INTERNAL")
    low, high = row["items"]
    if not low <= len(items) <= high:
        raise BindingError("ITEM_COUNT")
    star = question.get("star")
    if type(star) is not bool or (CHALLENGES if star else PRACTICE) not in row["groups"]:
        raise BindingError("BINDING_INTERNAL")
    found = question_counts(question, overlay)
    if found is None:
        raise BindingError("TEMPLATE_MISMATCH")
    _, template, counts = found
    asks = [binding.get("ask") for binding in bindings]
    if len(set(asks)) != len(asks):
        raise BindingError("DUPLICATE_ITEM")
    if question.get("intro") != story_intro(template, counts, overlay):
        raise BindingError("TEMPLATE_MISMATCH")
    table = story_table(template, counts, overlay)
    if (table is None and "table" in question) or (table is not None and question.get("table") != table):
        raise BindingError("TEMPLATE_MISMATCH")
    if star and any(ask not in overlay["challengeAsks"] for ask in asks):
        raise BindingError("CHALLENGE_PROFILE")


# ------------------------------------------------------------------ compile one wire item

def compile_item(kind: str, item: dict, index: int, ctx, *, givens=None, template=None) -> CompiledItem:
    """Wire item → IR prompt and answer of one probability item (checks I1-I6); ends by calling verify_item.

    `givens` is the question's checked counts (a tuple in id order), or None when the question's givens were refused
    or its story is unknown: the item's own checks still run, but nothing is evaluated and the item carries no IR.
    `template` is the question's story (the first item's known variant); an item naming another is
    TEMPLATE_MISMATCH."""
    overlay = ctx.overlay
    row = _kind_row(kind, overlay)
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
    for field in ("text", "expr2", "values"):
        if item[field] != "":
            refuse(field, "FIELD_NOT_EMPTY")
    ask, variant = item["ask"], item["variant"]
    form = item["form"] or row["form"]
    if ask not in row["asks"]:
        refuse("ask", "ASK_UNKNOWN")
    if item["form"] not in ("",) + tuple(row["forms"]):
        refuse("form", "FORM_UNKNOWN")
    story = None
    if variant not in row["variants"]:
        refuse("variant", "TEMPLATE_UNKNOWN")
    elif template is not None and variant != template:
        refuse("variant", "TEMPLATE_MISMATCH")
    else:
        story = variant
        if ask in row["asks"] and not ask_available(kind, ask, story_counts_of(story, overlay)):
            refuse("ask", "ASK_UNKNOWN")
    if item["text"]:
        from text_lint import lint_model_text
        codes, _ = lint_model_text(item["text"], grade=ctx.lesson["gradeNumber"], declared=(),
                                   forbidden_terms=overlay["forbiddenTerms"], max_length=LIMITS["text"])
        for code in codes:
            refuse("text", code)

    # I2 parse (the givens are the only numbers a probability is written from) and I3 scope
    node = None
    try:
        node = school_math.parse(item["expr"], letters=(), max_length=LIMITS["expr"], allow_refs=True)
    except SchoolMathError as error:
        refuse("expr", error.code)
    if node is not None:
        ids = (tuple("n%d" % i for i in range(1, story_counts_of(story, overlay) + 1)) if story is not None
               else GIVEN_IDS)
        for code in expr_codes(node, ids, overlay):
            refuse("expr", code)
    if refusals or givens is None or story is None:
        return done()

    # I4 binding: the model's probability at the givens, then its agreement with the ask
    values = {"n%d" % i: str(count) for i, count in enumerate(givens, 1)}
    try:
        mine = validate_and_solve_task({"kind": "evaluate",
                                        "expression": school_math.to_kernel(school_math.resolve(node, values))})
    except SchoolMathError as error:
        refuse("expr", error.code)
        return done()
    except MathTaskError as error:
        refuse("expr", kernel_code(error.code))
        return done()
    result = mine["result"].get("value") if mine["result"].get("type") == "expression" else None
    if (type(result) is not dict or result.get("type") != "number"
            or not 0 < Fraction(result["numerator"], result["denominator"]) < 1):
        refuse("expr", "PROB_RANGE")
    if not binds(node, kind, ask, givens):
        refuse("expr", "ASK_MISMATCH")
    if refusals:
        return done()

    # I5 kernel: the story's own probability of the ask, with the counts in place
    task = task_of(kind, ask, givens)
    try:
        solved = validate_and_solve_task(task)
    except MathTaskError as error:
        refuse("expr", kernel_code(error.code))
        return done()
    value = solved["result"]["value"]
    value = Fraction(value["numerator"], value["denominator"])
    if not 0 < value < 1:
        refuse("expr", "PROB_RANGE")
        return done()

    # I6 key and prompt
    try:
        notation = key_notation(value, form, overlay)
    except ValueError:
        refuse("form", "FORM_UNREPRESENTABLE")
        return done()
    key = {"form": form, "notation": notation, "symbols": [], "binding": {"kind": kind, "template": story, "ask": ask}}
    if not key_roundtrip(key, value):
        refuse("", "KEY_ROUNDTRIP")
        return done()
    prompt = ask_prompt(story, ask, form, overlay)
    answer = {"kind": "computed", "task": task, "unit": "", "printTask": False, "key": key}
    try:
        verify_item(prompt, answer, solved, overlay)
    except BindingError:
        refuse("", "BINDING_INTERNAL")
        return done()
    return done(prompt, answer, solved)


# ------------------------------------------------------------------ leaks and repeats

def _render(spans) -> str:
    """What general_adapters.rich_text emits for v5 middle spans: text as written, displays as house islands."""
    out = []
    for span in spans or ():
        if span.get("kind") == "text":
            out.append(span["text"])
        elif span.get("kind") == "display":
            out.append(school_math.display_island(span))
        else:
            raise ValueError("SOURCE_RICH_TEXT")
    return "".join(out)


def printed_words(question) -> list:
    """The question's printed strings as the pinned D12 file check reads a question's own words: the intro, every
    table cell and every item's prompt, each its own string (pinned f_file walks them field by field and the table
    cell by cell; a value counts as printed only when one string prints all its atoms)."""
    words = [_render(question.get("intro"))]
    table = question.get("table")
    if type(table) is dict:
        words += [_render(cell) for cell in table.get("head") or ()]
        words += [_render(cell) for line in table.get("rows") or () for cell in line]
    words += [_render(item["prompt"]) for item in question["items"]]
    return [word for word in words if word]


def d12_mirror(question: dict, skill_path: str) -> list:
    """1-based item indices whose key the pinned D12 would find printed in the question: the pinned f_atoms of the
    key island (what the adapter writes as the find target's value) against the pinned f_hit of each printed string
    (no stated-given exemption: an item's given is its prompt, which prints no number)."""
    import leak_checks
    pinned = leak_checks.pinned_module(skill_path)
    words = printed_words(question)
    hits = []
    for index, item in enumerate(question["items"], 1):
        atoms = pinned.f_atoms(school_math.key_island(item["answer"]["key"]))
        if atoms and any(pinned.f_hit(atoms, word) for word in words):
            hits.append(index)
    return hits


def _task_mark(task) -> str:
    return json.dumps(task, sort_keys=True, ensure_ascii=False)


def question_leaks(question: dict, overlay, *, skill_path=None) -> list:
    """[(1-based item index, code)] over one IR question: DUPLICATE_ITEM (a later item with the ask or the task of
    an earlier one), KEY_REPEATED (a later item with the value of an earlier one) and, with a skill path,
    LEAK_PINNED_VALUE (the D12 mirror). Monotone: removing items never adds a hit."""
    hits, asks, tasks, values = set(), set(), set(), set()
    for index, item in enumerate(question["items"], 1):
        ask = item["answer"]["key"]["binding"].get("ask")
        task = _task_mark(item["answer"]["task"])
        value = key_value(item["answer"]["key"])
        if ask in asks or task in tasks:
            hits.add((index, "DUPLICATE_ITEM"))
        elif value in values:
            hits.add((index, "KEY_REPEATED"))
        asks.add(ask)
        tasks.add(task)
        values.add(value)
    if skill_path is not None:
        hits.update((index, "LEAK_PINNED_VALUE") for index in d12_mirror(question, skill_path))
    return sorted(hits)


def rule_values(overlay) -> frozenset:
    """Every probability (a value strictly between 0 and 1) an equation of the rule box prints: for each pair of
    overlay["ruleFacts"], the value of each side and of every number and fraction inside it ("1-3/10" = "7/10"
    gives 3/10 and 7/10). Empty when the rule box prints no equation."""
    out = set()
    for pair in (overlay or {}).get("ruleFacts") or ():
        for side in pair:
            stack = [school_math.parse(side, letters=())]
            while stack:
                node = stack.pop()
                value = evaluate(node, {})
                if value is not None and 0 < value < 1:
                    out.add(value)
                stack.extend(_children(node))
    return frozenset(out)


def question_values(question, overlay) -> frozenset:
    """The probabilities a question prints or asks for: every item's key value and the single-draw probability of
    each category of its story (count over total), so a rule-box example equal to a step of an item is seen too."""
    values = {key_value(item["answer"]["key"]) for item in question["items"]}
    found = question_counts(question, overlay)
    if found is not None and sum(found[2]) > 0:
        values |= {Fraction(count, sum(found[2])) for count in found[2]}
    return frozenset(value for value in values if value is not None and 0 < value < 1)


def sheet_leaks(questions: list, overlay) -> dict:
    """{0-based index of the LATER question: sorted codes}: DUPLICATE_TASK (a task an earlier, unrefused question
    prints), DUPLICATE_REORDERED (the same kind with the same counts, in any order, as an earlier one) and
    LEAK_RULE_FACT (any question sharing a probability with an equation of the rule box: rule_values against
    question_values; the sheet loop puts a reserve in its place)."""
    seen_tasks, seen_stories, hits = set(), set(), {}
    facts = rule_values(overlay)
    for index, question in enumerate(questions):
        tasks = {_task_mark(item["answer"]["task"]) for item in question["items"]}
        found = question_counts(question, overlay)
        story = (found[0], tuple(sorted(found[2]))) if found is not None else None
        codes = set()
        if facts and question_values(question, overlay) & facts:
            codes.add("LEAK_RULE_FACT")
        if tasks & seen_tasks:
            codes.add("DUPLICATE_TASK")
        elif story is not None and story in seen_stories:
            codes.add("DUPLICATE_REORDERED")
        if codes:
            hits[index] = sorted(codes)
            continue
        seen_tasks |= tasks
        if story is not None:
            seen_stories.add(story)
    return hits


__all__ = ["KINDS", "ASKS_BY_KIND", "REPLACEMENT", "FORMS", "PROBE_POINTS", "is_probability", "ask_parts",
           "ask_available", "canonical_text", "canonical_node", "probability_value", "evaluate", "task_counts",
           "task_of", "binds", "story_intro", "story_table", "ask_prompt", "key_notation", "key_value",
           "key_roundtrip", "in_profile", "check_givens", "expr_codes", "verify_item", "question_counts",
           "verify_question", "compile_item", "printed_words", "d12_mirror", "question_leaks", "rule_values",
           "question_values", "sheet_leaks"]
