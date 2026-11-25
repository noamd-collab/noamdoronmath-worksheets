"""The four stage-2 item kinds of worksheet-wire/5 (V5-DESIGN §2.6, §2.7, §3, §4).

``compile_item`` is the only producer of v5 IR items and ``verify_item`` the only per-item checker: both
``structured_source`` (compile time) and ``general_source`` (the final validator) call ``verify_item``, so
the two can never drift apart.

What prints is decided here, by code, never by the model:

- the instruction above a question is the overlay's Tier A verb for its kind (``intro_spans``);
- a drill item (collect_like_terms, substitute) prints its task: the display built from the parsed CST;
- find_error_collect prints the task and the erroneous worked result, which code derives from the named
  mistake model (the model's ``expr2`` only has to equal it);
- write_from_words prints a code-written Hebrew phrase from its template, with each number and letter in its
  own display; the task itself is never printed;
- no item prints anything else (``printTask`` is always false), and the key is the kernel result printed by
  the house key printer (first-appearance order, coefficient beside its letters).

Refusals are (field, code) pairs; codes only, never model text (G11). Checks I1-I4 are mutually independent
where their inputs exist; I5 (kernel) and I6 (key and display) run only for an item I1-I4 left clean.
"""
from __future__ import annotations

from dataclasses import dataclass
import re
from types import MappingProxyType

from math_tasks import MathTaskError, inspect_ast, number, validate_and_solve_task
import mistake_models
import school_math
from school_math import Group, Neg, Num, Relation, SchoolMathError, Var
from structured_contract import CHALLENGES, ITEM_FIELDS, LIMITS, OVERLAYS, kernel_code

KINDS = ("write_from_words", "substitute", "collect_like_terms", "find_error_collect")
_G7 = OVERLAYS["g7:algebraic_expressions"]
TEMPLATES = _G7["templates"]           # read-only views of the g7 overlay; functions read the overlay passed in
LAYOUT_TEXT = _G7["layouts"]
BINDING_FIELDS = MappingProxyType({
    "write_from_words": ("kind", "template"),
    "substitute": ("kind",),
    "collect_like_terms": ("kind",),
    "find_error_collect": ("kind", "model"),
})
KEY_FIELDS = ("form", "notation", "symbols", "binding")
ANSWER_FIELDS = ("kind", "task", "unit", "printTask", "key")
DISPLAY_FIELDS = ("kind", "notation", "symbols")
TEXT_FIELDS = ("kind", "text")


@dataclass(frozen=True)
class Context:
    lesson: dict
    scope: dict
    overlay: dict
    skill_path: str | None


@dataclass
class CompiledItem:
    index: int
    prompt: list | None
    answer: dict | None
    solved: dict | None
    refusals: list          # [(field, code)]

    @property
    def codes(self) -> tuple:
        return tuple(sorted({code for _, code in self.refusals}))


class BindingError(ValueError):
    """code = one item-level code of §4. The message is the code only (G11)."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


# ------------------------------------------------------------------ spans

def intro_spans(kind: str, overlay) -> list:
    """[{"kind":"text","text": overlay.verbs[kind]}]."""
    return [{"kind": "text", "text": overlay["verbs"][kind]}]


def _text(value: str) -> dict:
    return {"kind": "text", "text": value}


def _display(node) -> dict:
    return {"kind": "display", "notation": school_math.unparse(node),
            "symbols": list(school_math.letters_of(node))}


def _value_node(letter: str, value: int):
    right = Num(str(value)) if value >= 0 else Neg(Num(str(-value)))
    return Relation(Var(letter), "=", right)


def _integer_node(value: int):
    return Num(str(value)) if value >= 0 else Neg(Num(str(-value)))


# ------------------------------------------------------------------ templates

def _template_holes(shape: str, node, overlay):
    """{hole: written value} when ``node`` has exactly the template ``shape`` (k, m numbers in the overlay's
    templateNumbers; v != w letters), else None. Matching the canonical unparse is matching the tree, because
    parse(unparse(n)) == n."""
    pattern, names = "", []
    for char in shape:
        if char in "km":
            pattern += "(0|[1-9][0-9]*)"
            names.append(char)
        elif char in "vw":
            pattern += "([a-z])"
            names.append(char)
        elif char in "+-":
            pattern += re.escape(char)
        else:
            raise ValueError("Unknown template shape character")
    try:
        match = re.fullmatch(pattern, school_math.unparse(node))
    except SchoolMathError:
        return None
    if match is None:
        return None
    holes = {}
    for name, value in zip(names, match.groups()):
        if holes.setdefault(name, value) != value:
            return None
    low, high = overlay["templateNumbers"]
    if any(name in holes and not low <= int(holes[name]) <= high for name in "km"):
        return None
    if "v" in holes and "w" in holes and holes["v"] == holes["w"]:
        return None
    if any(name in holes and holes[name] not in overlay["letters"] for name in "vw"):
        return None
    return holes


def _template_expression(shape: str, holes: dict, overlay):
    """The CST of a template instance (the task of a write_from_words item)."""
    text = "".join(holes[char] if char in "kmvw" else char for char in shape)
    return school_math.parse(text, letters=tuple(overlay["letters"]))


def _hole_node(name: str, value: str):
    return Num(value) if name in "km" else Var(value)


# ------------------------------------------------------------------ layouts

def _layout(kind: str, binding: dict, value_count: int, overlay) -> list:
    """[("T", text) | ("D", hole)] for one item of ``kind``."""
    if kind == "write_from_words":
        return [tuple(part) for part in overlay["templates"][binding["template"]]["layout"]]
    parts = [tuple(part) for part in overlay["layouts"][kind]]
    if kind == "substitute":
        parts = [("D", "value1") if part == ("D", "value") else part for part in parts]
        for extra in range(2, value_count + 1):
            parts += [("T", overlay["valueSeparator"]), ("D", "value%d" % extra)]
    return parts


def _render_layout(parts: list, nodes: dict) -> list:
    return [_text(value) if part == "T" else _display(nodes[value]) for part, value in parts]


# ------------------------------------------------------------------ the item checker shared with general_source

def _polynomial(node) -> dict:
    return school_math.polynomial(node)


def _form_problem(form: str, poly: dict) -> bool:
    """True when a kernel result cannot be printed in ``form``."""
    if form == "integer":
        return any(signature != () for signature in poly) or any(
            value.denominator != 1 for value in poly.values())
    return any(value.denominator != 1 for value in poly.values()) or any(
        len(set(signature)) != len(signature) for signature in poly)


def _parse_display(span, overlay):
    """The CST of one IR display span, which must be canonical: unparse(node) == notation and
    symbols == letters_of(node) in order. Raises BindingError DISPLAY_INVALID | MATH_SYMBOL_UNDECLARED."""
    check_display_span(span, overlay)
    node = school_math.parse(span["notation"], letters=tuple(span["symbols"]), allow_relation=True)
    if list(school_math.letters_of(node)) != list(span["symbols"]):
        raise BindingError("DISPLAY_INVALID")
    return node


def check_display_span(span: dict, overlay) -> None:
    """exact keys; symbols are distinct overlay letters (≤4); notation parses (allow_relation) with letters ⊆ symbols;
    to_kernel of each side passes math_tasks.inspect_ast. Raises BindingError('DISPLAY_INVALID' | 'MATH_SYMBOL_UNDECLARED').

    The notation must also be canonical school grammar (unparse(parse(notation)) == notation, §2.6)."""
    if type(span) is not dict or set(span) != set(DISPLAY_FIELDS) or span.get("kind") != "display":
        raise BindingError("DISPLAY_INVALID")
    symbols, notation = span["symbols"], span["notation"]
    if type(symbols) is not list or any(type(letter) is not str for letter in symbols) or type(notation) is not str:
        raise BindingError("DISPLAY_INVALID")
    if len(set(symbols)) != len(symbols) or len(symbols) > school_math.MAX_LETTERS:
        raise BindingError("DISPLAY_INVALID")
    if any(letter not in overlay["letters"] for letter in symbols):
        raise BindingError("MATH_SYMBOL_UNDECLARED")
    try:
        node = school_math.parse(notation, letters=tuple(symbols), allow_relation=True)
        if school_math.unparse(node) != notation:
            raise BindingError("DISPLAY_INVALID")
        sides = (node.left, node.right) if type(node) is Relation else (node,)
        for side in sides:
            inspect_ast(school_math.to_kernel(side))
    except SchoolMathError as error:
        raise BindingError("MATH_SYMBOL_UNDECLARED" if error.code == "MATH_SYMBOL_UNDECLARED"
                           else "DISPLAY_INVALID") from None
    except MathTaskError:
        raise BindingError("DISPLAY_INVALID") from None


def verify_item(prompt: list, answer: dict, solved: dict, overlay) -> None:
    """IR re-check shared by compile and general_source: layout of key.binding.kind, display parse and scope of the task
    expression, structural equality to_kernel(display) == task.expression, template or mistake or values binding,
    key form, KEY_ROUNDTRIP (kernel_equal). Raises BindingError.

    The key must also be exactly the house key printer's output for the kernel result (first-appearance order,
    §2.8 rule 5), and a find_error wrong result exactly the code-printed result of its mistake model.

    An elementary overlay (skill "elementary") is checked by division_kinds.verify_item."""
    if overlay.get("skill") == "elementary":
        import division_kinds
        division_kinds.verify_item(prompt, answer, solved, overlay)
        return

    def fail(code):
        raise BindingError(code)

    profile = overlay["profile"]
    if (type(answer) is not dict or set(answer) != set(ANSWER_FIELDS) or answer.get("kind") != "computed"
            or answer.get("printTask") is not False or answer.get("unit") != ""):
        fail("BINDING_INTERNAL")
    key, task = answer["key"], answer["task"]
    if type(key) is not dict or set(key) != set(KEY_FIELDS):
        fail("FORM_UNKNOWN")
    binding = key["binding"]
    kind = binding.get("kind") if type(binding) is dict else None
    if type(kind) is not str or kind not in overlay["kinds"] or set(binding) != set(BINDING_FIELDS.get(kind, ())):
        fail("BINDING_INTERNAL")
    if kind == "write_from_words" and (type(binding["template"]) is not str
                                       or binding["template"] not in overlay["templates"]):
        fail("TEMPLATE_UNKNOWN")
    if kind == "find_error_collect" and (type(binding["model"]) is not str
                                         or binding["model"] not in overlay["mistakes"]):
        fail("MISTAKE_UNKNOWN")
    if type(key["form"]) is not str or key["form"] != overlay["kinds"][kind]["form"]:
        fail("FORM_UNKNOWN")

    # Layout: the exact span sequence of the kind, with the overlay's own text spans.
    if type(prompt) is not list or not prompt:
        fail("BINDING_INTERNAL")
    for span in prompt:
        if type(span) is not dict or span.get("kind") not in ("text", "display"):
            fail("DISPLAY_INVALID")
        if span["kind"] == "text" and (set(span) != set(TEXT_FIELDS) or type(span["text"]) is not str):
            fail("DISPLAY_INVALID")
    displays = [span for span in prompt if span["kind"] == "display"]
    parts = _layout(kind, binding, max(0, len(displays) - 1), overlay)
    mismatch = "TEMPLATE_MISMATCH" if kind == "write_from_words" else "BINDING_INTERNAL"
    if len(parts) != len(prompt):
        fail(mismatch)
    nodes = {}
    for (part, value), span in zip(parts, prompt):
        if part == "T":
            if span != _text(value):
                fail(mismatch)
        else:
            if span["kind"] != "display":
                fail(mismatch)
            nodes[value] = _parse_display(span, overlay)

    # The task expression the displays state.
    if kind == "write_from_words":
        shape = overlay["templates"][binding["template"]]["shape"]
        holes = {}
        for name in sorted(nodes):
            node = nodes[name]
            if name in "km" and (type(node) is not Num or not re.fullmatch(r"[1-9][0-9]*", node.text)):
                fail("TEMPLATE_MISMATCH")
            if name in "vw" and type(node) is not Var:
                fail("TEMPLATE_MISMATCH")
            holes[name] = node.text if name in "km" else node.name
        try:
            expression = _template_expression(shape, holes, overlay)
        except SchoolMathError:
            fail("TEMPLATE_MISMATCH")
        if _template_holes(shape, expression, overlay) != holes:
            fail("TEMPLATE_MISMATCH")
    else:
        expression = nodes["expr"]
        if type(expression) is Relation:
            fail("BINDING_INTERNAL")
    scope = school_math.check_scope(expression, profile, role="task")
    if scope:
        fail(scope[0])
    if school_math.written_unit_coefficient(expression):
        fail("MATH_SCOPE_RANGE")
    expected_task = ("kind", "expression", "values") if kind == "substitute" else ("kind", "expression")
    if (type(task) is not dict or set(task) != set(expected_task)
            or task["kind"] != ("substitute" if kind == "substitute" else "simplify")):
        fail("BINDING_INTERNAL")
    try:
        same = school_math.to_kernel(expression) == task["expression"]
    except SchoolMathError:
        same = False
    if not same:
        fail("BINDING_INTERNAL")

    # Kind bindings.
    if kind in ("collect_like_terms", "find_error_collect"):
        try:
            collected = school_math.is_collected(expression)
        except SchoolMathError:
            fail("MATH_PARSE")
        if collected:
            fail("NOTHING_TO_DO")
    if kind == "substitute":
        if type(expression) is Var:
            fail("REVEALS_ANSWER")
        letters = school_math.letters_of(expression)
        values = [nodes["value%d" % i] for i in range(1, len(displays))]
        if not letters or len(values) != len(letters):
            fail("VALUES_MISMATCH")
        expected_values = {}
        for letter, node in zip(letters, values):
            if type(node) is not Relation or type(node.left) is not Var or node.left.name != letter:
                fail("VALUES_MISMATCH")
            right = node.right
            if not (type(right) is Num or (type(right) is Neg and type(right.operand) is Num)):
                fail("VALUES_MISMATCH")
            written = right if type(right) is Num else right.operand
            if not re.fullmatch(r"0|[1-9][0-9]*", written.text):
                fail("VALUES_MISMATCH")
            for code in school_math.check_scope(right, profile, role="value"):
                fail(code)
            value = int(written.text) * (1 if type(right) is Num else -1)
            expected_values[letter] = number(value)
        if type(task["values"]) is not dict or task["values"] != expected_values:
            fail("VALUES_MISMATCH")
    mistake = None
    if kind == "find_error_collect":
        try:
            mistake = mistake_models.apply(binding["model"], expression)
        except mistake_models.MistakeError as error:
            fail(error.code)
        wrong = nodes["wrong"]
        if type(wrong) is Relation:
            fail("MISTAKE_UNMODELED")
        printed = school_math.key_node(mistake, school_math.first_appearance(expression))
        if wrong != printed:
            fail("MISTAKE_UNMODELED")
        for code in school_math.check_scope(wrong, profile, role="result"):
            fail(code)

    # The kernel result and the key.
    if type(solved) is not dict or type(solved.get("result")) is not dict:
        fail("BINDING_INTERNAL")
    if solved["result"].get("type") != "expression":
        fail("FORM_UNREPRESENTABLE")
    result = solved["result"]["value"]
    try:
        poly = school_math.polynomial_of_kernel(result)
        expected_key = school_math.key_from_result(result, expression)
    except SchoolMathError as error:
        fail("FORM_UNREPRESENTABLE" if error.code == "FORM_UNREPRESENTABLE" else "KEY_ROUNDTRIP")
    if _form_problem(key["form"], poly):
        fail("FORM_UNREPRESENTABLE")
    for code in school_math.check_scope(expected_key, profile, role="result"):
        fail(code)
    symbols, notation = key["symbols"], key["notation"]
    if (type(symbols) is not list or any(type(letter) is not str for letter in symbols)
            or any(letter not in overlay["letters"] for letter in symbols) or type(notation) is not str):
        fail("KEY_ROUNDTRIP")
    try:
        key_node = school_math.parse(notation, letters=tuple(symbols))
    except SchoolMathError:
        fail("KEY_ROUNDTRIP")
    if (school_math.unparse(key_node) != notation or list(school_math.letters_of(key_node)) != symbols
            or key_node != expected_key or not school_math.key_roundtrip(key, result)):
        fail("KEY_ROUNDTRIP")
    if mistake is not None and mistake == _polynomial(expression):
        fail("MISTAKE_NOT_WRONG")


def verify_question(question: dict, overlay) -> None:
    """All items share one binding kind; intro == intro_spans(kind); star is True iff the kind is a challenge kind.

    Also 3..6 items (ITEM_COUNT). Raises BindingError. An elementary overlay is checked by
    division_kinds.verify_question (the star follows the row there; the selection record checks the row)."""
    if overlay.get("skill") == "elementary":
        import division_kinds
        division_kinds.verify_question(question, overlay)
        return
    if type(question) is not dict or type(question.get("items")) is not list:
        raise BindingError("BINDING_INTERNAL")
    items = question["items"]
    if not LIMITS["items_min"] <= len(items) <= LIMITS["items_max"]:
        raise BindingError("ITEM_COUNT")
    kinds = set()
    for item in items:
        try:
            kinds.add(item["answer"]["key"]["binding"]["kind"])
        except (KeyError, TypeError):
            raise BindingError("BINDING_INTERNAL") from None
    if len(kinds) != 1:
        raise BindingError("BINDING_INTERNAL")
    kind = kinds.pop()
    if kind not in overlay["kinds"] or question.get("intro") != intro_spans(kind, overlay):
        raise BindingError("BINDING_INTERNAL")
    if question.get("star") is not (overlay["kinds"][kind]["group"] == CHALLENGES):
        raise BindingError("BINDING_INTERNAL")


# ------------------------------------------------------------------ compile one wire item

def compile_item(kind: str, item: dict, index: int, ctx: Context, *, givens=None) -> CompiledItem:
    """Wire item → IR prompt and answer (§2.6) through checks I1–I6 (§4); ends by calling verify_item.

    An elementary overlay compiles in division_kinds.compile_item; ``givens`` (keyword only) is the question's
    checked {given id: value} map there. The middle kinds declare no givens and ignore it."""
    overlay = ctx.overlay
    if overlay.get("skill") == "elementary":
        import division_kinds
        return division_kinds.compile_item(kind, item, index, ctx, givens=givens)
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
    for field in ("text", "expr", "expr2", "values", "variant"):
        if field not in reads and item[field] != "":
            refuse(field, "FIELD_NOT_EMPTY")
    if item["ask"] not in row["asks"]:
        refuse("ask", "FIELD_NOT_EMPTY")
    if item["form"] not in ("", row["form"]):
        refuse("form", "FORM_UNKNOWN")
    variant = item["variant"]
    if kind == "write_from_words" and variant not in overlay["templates"]:
        refuse("variant", "TEMPLATE_UNKNOWN")
    if kind == "find_error_collect" and variant not in overlay["mistakes"]:
        refuse("variant", "MISTAKE_UNKNOWN")
    if item["text"]:                                  # Q2: lint every non-empty text field
        from text_lint import lint_model_text
        codes, _ = lint_model_text(item["text"], grade=ctx.lesson["gradeNumber"], declared=(),
                                   forbidden_terms=overlay["forbiddenTerms"], max_length=LIMITS["text"])
        for code in codes:
            refuse("text", code)

    # I2 parse. A kind that declares no givens (every stage-2 kind: FIELD_NOT_EMPTY on givens) has no `{nK}`
    # reference in its math grammar, so a reference is MATH_PARSE here and can never reach the kernel.
    letters = tuple(overlay["letters"])
    allow_refs = bool(row.get("givens", False))
    nodes = {}
    for field in ("expr", "expr2"):
        if field in reads:
            try:
                nodes[field] = school_math.parse(item[field], letters=letters, max_length=LIMITS[field],
                                                 allow_refs=allow_refs)
            except SchoolMathError as error:
                refuse(field, error.code)
    values = None
    if "values" in reads:
        if len(item["values"]) > LIMITS["values"]:
            refuse("values", "MATH_LENGTH")
        else:
            try:
                values = school_math.parse_values(item["values"], letters=letters)
            except SchoolMathError as error:
                refuse("values", error.code if error.code == "MATH_SYMBOL_UNDECLARED" else "VALUES_SHAPE")

    # I3 scope. A binding check below reads only inputs that parsed and are in scope: a check whose input
    # failed is skipped (the item is already refused), never counted as passed.
    profile = overlay["profile"]
    for field, role in (("expr", "task"), ("expr2", "result")):
        if field in nodes:
            codes = school_math.check_scope(nodes[field], profile, role=role)
            for code in codes:
                refuse(field, code)
            if codes:
                del nodes[field]
    if values is not None:
        codes = [code for _, value in values
                 for code in school_math.check_scope(_integer_node(value), profile, role="value")]
        for code in codes:
            refuse("values", code)
        if codes:
            values = None

    # I4 binding
    expression = nodes.get("expr")
    holes = mistake = None
    if kind == "write_from_words" and expression is not None and variant in overlay["templates"]:
        holes = _template_holes(overlay["templates"][variant]["shape"], expression, overlay)
        if holes is None:
            refuse("expr", "TEMPLATE_MISMATCH")
    if kind == "substitute" and expression is not None:
        if type(expression) is Var:
            refuse("expr", "REVEALS_ANSWER")
        if values is not None and {letter for letter, _ in values} != set(school_math.letters_of(expression)):
            refuse("values", "VALUES_MISMATCH")
    if kind in ("collect_like_terms", "find_error_collect") and expression is not None:
        try:
            if school_math.is_collected(expression):
                refuse("expr", "NOTHING_TO_DO")
        except SchoolMathError as error:
            refuse("expr", error.code)
    if kind == "find_error_collect" and expression is not None and variant in overlay["mistakes"]:
        try:
            mistake = mistake_models.apply(variant, expression)
        except mistake_models.MistakeError as error:
            refuse("variant", error.code)
        else:
            if "expr2" in nodes:
                try:
                    mistake_models.verify_wrong(variant, expression, nodes["expr2"])
                except mistake_models.MistakeError as error:
                    refuse("expr2", error.code)
    # A written coefficient 1 or 0 before a letter ("1x+2x") prints as written but is never house notation.
    # Checked last on a printed expr no other check refused, so a more specific code (TEMPLATE_MISMATCH) wins.
    if (expression is not None and not any(field == "expr" for field, _ in refusals)
            and school_math.written_unit_coefficient(expression)):
        refuse("expr", "MATH_SCOPE_RANGE")
    if refusals:
        return done()

    # I5 kernel. A conversion failure is a refusal of this item, never an exception out of the sheet.
    try:
        if kind == "substitute":
            ordered = dict(values)
            task = {"kind": "substitute", "expression": school_math.to_kernel(expression),
                    "values": {letter: number(ordered[letter]) for letter in school_math.letters_of(expression)}}
        else:
            task = {"kind": "simplify", "expression": school_math.to_kernel(expression)}
    except SchoolMathError as error:
        refuse("expr", error.code)
        return done()
    try:
        solved = validate_and_solve_task(task)
    except MathTaskError as error:
        refuse("expr", kernel_code(error.code))
        return done()

    # I6 key and display
    result = solved["result"]
    try:
        if result.get("type") != "expression":
            raise SchoolMathError("FORM_UNREPRESENTABLE", "the kernel result is not an expression")
        poly = school_math.polynomial_of_kernel(result["value"])
        key_node = school_math.key_from_result(result["value"], expression)
    except SchoolMathError:
        refuse("form", "FORM_UNREPRESENTABLE")
        return done()
    if _form_problem(row["form"], poly):
        refuse("form", "FORM_UNREPRESENTABLE")
        return done()
    # The key is a result: the profile's result bound applies to it as to a find_error wrong result.
    scope_codes = school_math.check_scope(key_node, profile, role="result")
    for code in scope_codes:
        refuse("expr", code)
    if scope_codes:
        return done()
    if kind == "write_from_words":
        binding = {"kind": kind, "template": variant}
    elif kind == "find_error_collect":
        binding = {"kind": kind, "model": variant}
    else:
        binding = {"kind": kind}
    key = {"form": row["form"], "notation": school_math.unparse(key_node),
           "symbols": list(school_math.letters_of(key_node)), "binding": binding}
    if not school_math.key_roundtrip(key, result["value"]):
        refuse("", "KEY_ROUNDTRIP")
    if mistake is not None and mistake == school_math.polynomial(expression):
        refuse("variant", "MISTAKE_NOT_WRONG")

    if kind == "write_from_words":
        layout_nodes = {name: _hole_node(name, value) for name, value in holes.items()}
    else:
        layout_nodes = {"expr": expression}
        if kind == "substitute":
            for number_, letter in enumerate(school_math.letters_of(expression), 1):
                layout_nodes["value%d" % number_] = _value_node(letter, dict(values)[letter])
        if kind == "find_error_collect":
            layout_nodes["wrong"] = school_math.key_node(mistake, school_math.first_appearance(expression))
    parts = _layout(kind, binding, len(values or ()), overlay)
    prompt = _render_layout(parts, layout_nodes)
    for span in prompt:
        if span["kind"] == "display":
            node = school_math.parse(span["notation"], letters=tuple(span["symbols"]), allow_relation=True)
            try:
                back = school_math.from_house_flat(school_math.to_house(node), letters=tuple(span["symbols"]),
                                                   allow_relation=True)
            except SchoolMathError:
                back = None
            if back != node:
                refuse("", "DISPLAY_ROUNDTRIP")
    if refusals:
        return done()
    answer = {"kind": "computed", "task": task, "unit": "", "printTask": False, "key": key}
    try:
        verify_item(prompt, answer, solved, overlay)
    except BindingError:
        refuse("", "BINDING_INTERNAL")
        return done()
    return done(prompt, answer, solved)


__all__ = ["KINDS", "TEMPLATES", "LAYOUT_TEXT", "Context", "CompiledItem", "BindingError", "intro_spans",
           "compile_item", "verify_item", "verify_question", "check_display_span"]
