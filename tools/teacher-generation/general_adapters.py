"""Compile validated data-only drafts to the two unchanged pinned skill inputs.

The generated content.py is constant trusted glue. Model strings are stored
only in JSON and escaped by the elementary adapter or the middle skill's seg.
This compiler does not run builds, skip gates, approve prose, or publish files.
"""
from __future__ import annotations

import argparse
from copy import deepcopy
import hashlib
import html
import math
import re
import json
from pathlib import Path
import sys

from general_source import GeneralSourceError, validate_source
from math_tasks import to_house_math, validate_and_solve_task
from general_geometry import solve_figure_task, measure_elementary_svg
from no_carry_addition import needs_printed_task, states_entire_task
from printed_percentages import percentage_evidence
from printed_tasks import match_printed_task, matching_solution_choices, printed_solve, printed_table_row
from printed_elementary import guard_counting_input, place_intro, printed_intent, validate_counting_values
from printed_parts import answer_form, bind_parts, carries_data, chosen_solutions, comparison_blank, earlier_answers, narrowed, printed_calculation, printed_keys, shows_task
from answer_kinds import TEACHER_CHECK, bind_decision

LETTERS = "אבגדהוזחטי"
LEVELS = {"a": "רמה א׳", "b": "רמה ב׳", "e": "מצוינות"}
MIDDLE_BRIDGE = '''import json
from pathlib import Path
LEVELS = json.loads((Path(__file__).parent / "levels.json").read_text(encoding="utf-8"))
def _recorded_figure(spec):
    # spec is the exact constructor call the compiler drew (general_adapters._middle_call).
    if spec["kind"] == "coordinate_plane":
        from figkit_plus import plane, wide
        points = {p["name"]: (p["x"], p["y"]) for p in spec["points"]}
        builder = wide if spec.get("placement") == "wide" else plane
        step = {"step": spec["step"]} if "step" in spec else {}
        return builder(tuple(spec["xr"]), tuple(spec["yr"]), points=[(xy, name) for name, xy in points.items()], solid=[(points[a], points[b]) for a, b in spec["segments"]], **step)
    import shapekit as SK
    family = spec["family"]
    g, data = SK.shape(spec["shape"], rotate=spec["rotate"], names=spec["names"], marks=True, fam=family, **spec["parameters"])
    return SK.finish(g, family)
for level in LEVELS:
    if "words_share" in level:
        level["words_share"] = {int(k): v for k, v in level["words_share"].items()}
    for question in level["questions"]:
        if "_generalFigure" in question:
            svg = _recorded_figure(question.pop("_generalFigure"))
            if svg != question["fig"]:
                raise ValueError("Recorded figure differs from the compiled canonical figure")
            question["fig"] = svg
STRICT_FIGURES = True
'''


def dump(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def _load_skill(skill, elementary):
    # These paths are trusted configuration, verified against skill-lock by the
    # caller before the isolated compiler process is started.
    paths = [skill / "scripts", skill / "scripts/lib"] if elementary else [skill]
    sys.path[:0] = [str(p) for p in paths]


def _elementary_math(ast, grade, H, *, blank=False, number_spellings=None):
    kind = ast["type"]
    if kind == "number":
        if number_spellings:
            from numeric_literals import printed_number
            spelling = printed_number(ast, number_spellings)
            if spelling is not None:
                return html.escape(spelling.replace("-", "−"))
        return H.fmt(ast["numerator"], grade) if ast["denominator"] == 1 else H.frac(ast["numerator"], ast["denominator"], grade)
    if kind == "symbol":
        if blank and ast["name"] == "x":
            return "___"
        raise GeneralSourceError("ELEMENTARY_SYMBOL", "The elementary adapter has no approved symbolic-variable typography")
    if kind == "constant":
        raise GeneralSourceError("ELEMENTARY_SYMBOL", "The elementary adapter has no approved typography for a named constant")
    op, args = ast["op"], ast["args"]
    if op == "sqrt":
        raise GeneralSourceError("ELEMENTARY_SQRT", "Roots are outside elementary signs")
    if op == "power":
        if grade in ("א", "ב", "ג"):
            raise GeneralSourceError("ELEMENTARY_POWER", "Power typography starts in grade four")
        return "(" + _elementary_math(args[0], grade, H, blank=blank, number_spellings=number_spellings) + ")<sup>" + _elementary_math(args[1], grade, H, blank=blank, number_spellings=number_spellings) + "</sup>"
    operator = {"add": "+", "subtract": "-", "multiply": "*", "divide": ":"}[op]
    values = []
    for index, arg in enumerate(args):
        value = _elementary_math(arg, grade, H, blank=blank, number_spellings=number_spellings)
        if _needs_brackets(op, index, arg, grade):
            value = "(" + value + ")"
        values.append(value)
    return (" " + H.op(operator, grade) + " ").join(values)


_PRECEDENCE = {"add": 1, "subtract": 1, "multiply": 2, "divide": 2}


def _needs_brackets(parent, index, child, grade):
    """Brackets that change the reading stay; "(124 − 38) + 15" loses its pair.

    A first operand is read first in any case. Before the order of operations
    is taught (grade four), a later product inside a sum keeps its brackets,
    because a pupil who reads from left to right would get another value.
    """
    if child["type"] != "operation":
        return False
    if child["op"] not in _PRECEDENCE:
        return child["op"] != "power"  # a power prints its own bracketed base
    outer, inner = _PRECEDENCE[parent], _PRECEDENCE[child["op"]]
    if inner < outer:
        return True
    if index == 0:
        return False
    if inner > outer:
        return grade in ("א", "ב", "ג")
    return parent in ("subtract", "divide")


def _notation(span):
    names = span["names"]
    if span["type"] == "angle":
        return "\\angle{" + names + "}"
    if span["type"] == "triangle":
        return "\\tri " + names
    return names


# Both pinned middle emitters support these macros in native math islands.
# Unicode relation glyphs can instead select an unshipped fallback font.
_MIDDLE_RELATIONS = str.maketrans({"≤": r"\leq", "≥": r"\geq", "≠": r"\neq"})


def _middle_math(text):
    return "$" + text.translate(_MIDDLE_RELATIONS) + "$"


def _formula(notation, grade, H):
    text = _formula_text(notation, grade, H)
    return H.ltr(text) if H else _middle_math(text)


def _formula_text(notation, grade, H):
    """The printed contents of one formula, before its direction wrapper."""
    from compact_authoring import display_parts, schoolbook_tokens
    number_grade = LETTERS.index(grade) + 1 if H else grade
    tokens = schoolbook_tokens(notation, number_grade) if H else None
    if tokens is not None:
        # Reconstruct the exact checked operands and brackets. Adding brackets
        # around a product in a sum would reveal which operation comes first.
        rendered = []
        previous = None
        for token in tokens:
            if token in ("(", ")", "___"):
                rendered.append(token)
            elif token in ("=", "<", ">", "≤", "≥", "≠"):
                rendered.append(" " + html.escape(token) + " ")
            elif token in ("+", "-", "*", "/"):
                sign = H.op(":" if token == "/" else token, grade)
                unary = token == "-" and previous in (None, "(", "+", "-", "*", "/")
                rendered.append(sign if unary else " " + sign + " ")
            elif token.isascii() and token.isdigit() and str(int(token)) == token:
                rendered.append(H.fmt(int(token), grade))
            else:
                rendered.append(html.escape(token))
            previous = token
        return "".join(rendered)
    rendered = []
    for part in display_parts(notation, number_grade):
        if isinstance(part,str):
            if H and part.isascii() and part.isdigit() and str(int(part)) == part:
                # One side of a sign blank: a plain number in the grade's spelling.
                rendered.append(H.fmt(int(part), grade))
            else:
                rendered.append(html.escape(part.replace("-", "−")) if H else part.replace("-", "−"))
            continue
        tree, aliases, spellings = part
        if H:
            rendered.append(_elementary_math(tree,grade,H,blank=bool(aliases),number_spellings=spellings))
        else:
            # Only genuine one-letter variables sit next to their coefficient.
            # A blank or a segment name keeps the sign: 3 · ___, AB · CD.
            text = to_house_math(tree,number_spellings=spellings,
                                 schoolbook=all(re.fullmatch("[a-z]",name) for name in aliases.values()))
            # Every letter of the rendering is a symbol, also where two stand together (bx, ax^2);
            # only the house macros (\f, \g, \sqrt, \pi) are words, and they are kept.
            rendered.append(re.sub(r"\\[A-Za-z]+|[xyab]",
                                   lambda match: match[0] if match[0].startswith("\\") else aliases.get(match[0],match[0]),
                                   text))
    return " ".join(rendered)


def _span_text(span, grade, H):
    """One printed operand, unwrapped, so that a key can join two of them."""
    if span["kind"] == "formula":
        return _formula_text(span["notation"], grade, H)
    return _elementary_math(span["expression"], grade, H) if H else to_house_math(span["expression"], schoolbook=True)


def rich_text(spans, grade, H=None):
    result = []
    for span in spans:
        if span["kind"] == "text":
            result.append(html.escape(span["text"]) if H else span["text"])
        elif span["kind"] == "math":
            result.append(H.ltr(_elementary_math(span["expression"], grade, H)) if H else _middle_math(to_house_math(span["expression"], schoolbook=True)))
        elif span["kind"] == "formula":
            result.append(_formula(span["notation"],grade,H))
        elif span["kind"] == "geometry":
            result.append(_middle_math(_notation(span)))
    return "".join(result)


def _prints_calculation(item, computed, number_grade=None):
    # The same exercise can arrive both in a pupil math span and its exact
    # task. Preserve the printed span and retain the independent solution.
    if not computed or computed["question"]["kind"] != "evaluate":
        return False
    mathematics = [span for span in item["prompt"] if span["kind"] != "text"]
    if number_grade and mathematics and mathematics[-1]["kind"] == "formula":
        from compact_authoring import expression, has_written_number, schoolbook_tokens
        notation = mathematics[-1]["notation"]
        if (has_written_number(notation) or schoolbook_tokens(notation, number_grade) is not None) and not re.search(r"[<>=!≤≥≠]", notation):
            # Coordinates and named-geometry labels are display only.
            from compact_authoring import COORDINATE
            if not COORDINATE.fullmatch(notation) and not re.search(r"[A-Z]|___", notation):
                try:
                    return expression(notation, number_grade) == computed["question"]["expression"]
                except GeneralSourceError:
                    return False
    return mathematics == [{"kind": "math", "expression": computed["question"]["expression"]}]


def _task_text(solved, grade, H=None, *, notation=None):
    """Question math is always rendered from the same AST as its answer."""
    task = solved["question"]
    if notation is not None:
        return _formula(notation, grade, H)
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else (lambda ast: to_house_math(ast, schoolbook=True))
    wrap = H.ltr if H else _middle_math
    kind = task["kind"]
    if kind == "figure_measure":
        figure=task["figure"]
        # Read-off tasks must not print the requested coordinate.
        # Shape measurements, however, need visible dimensions: the pinned
        # shapekit marks types but does not label constructor measurements.
        # Bind these givens directly to the same typed constructor values.
        if figure["kind"]=="shape" and task["operation"]!="side_count":
            params=figure["parameters"];shape=figure["shape"]
            n=lambda key:wrap(render({"type":"number","numerator":params[key],"denominator":1}))
            if shape=="rectangle":return "נתון: אורכי שתי צלעות סמוכות במלבן הם "+n("w")+" ו־"+n("h")+"."
            if shape=="square":return "נתון: אורך צלע הריבוע הוא "+n("a")+"."
            if shape=="triangle":return "נתון: אורכי צלעות המשולש הם "+n("a")+", "+n("b")+", "+n("c")+"."
            if shape=="rhombus":return "נתון: אורכי אלכסוני המעוין הם "+n("d1")+" ו־"+n("d2")+"."
            if shape=="trapezoid":return "נתון: אורכי בסיסי הטרפז הם "+n("a")+" ו־"+n("b")+", והגובה בין הבסיסים הוא "+n("h")+"."
            if shape=="parallelogram":return "נתון: אורכי שתי צלעות סמוכות במקבילית הם "+n("a")+" ו־"+n("b")+"."
            if shape=="polygon":return "נתון: המצולע משוכלל, ובו "+n("n")+" צלעות. אורך כל צלע הוא "+n("a")+"."
            if shape=="circle":return "נתון: רדיוס המעגל הוא "+n("r")+"."
        if figure["kind"]=="coordinate_plane" and task["operation"] in ("x_coordinate","y_coordinate"):
            axis="x" if task["operation"]=="x_coordinate" else "y"
            return "קראו את שיעור ה־"+wrap(axis)+" של הנקודה "+wrap(task["point"])+"."
        return ""
    if kind in ("gcd","lcm"):
        label = "המחלק המשותף הגדול ביותר של " if kind == "gcd" else "הכפולה המשותפת הקטנה ביותר של "
        return label + wrap(render(task["left"])) + " ושל " + wrap(render(task["right"]))
    if kind == "solve":
        return wrap(render(task["lhs"]) + " = " + render(task["rhs"]))
    if kind == "compare":
        return wrap(render(task["left"]) + " ___ " + render(task["right"]))
    if kind == "solve_system":
        return "; ".join(wrap(render(eq["lhs"])+" = "+render(eq["rhs"])) for eq in task["equations"])
    if kind == "inequality":
        return wrap(render(task["lhs"])+" "+{"lt":"<","le":"≤","gt":">","ge":"≥"}[task["relation"]]+" "+render(task["rhs"]))
    if kind == "statistics":
        return ", ".join(wrap(render(value)) for value in task["values"])
    expression = wrap(render(task["expression"]))
    if kind == "substitute":
        values = ", ".join(wrap(name + " = " + render(ast)) for name, ast in task["values"].items())
        return expression + (" עבור " if not H else " עֲבוּר " if grade in "אב" else " עבור ") + values
    return expression


def _mixed_number(value, grade, H):
    """A mixed number for an improper fraction, in the notation of each band."""
    if value.get("type") != "number" or value["denominator"] <= 1 or abs(value["numerator"]) <= value["denominator"]:
        return None
    n, d = value["numerator"], value["denominator"]
    whole, rest = divmod(abs(n), d)
    sign = "−" if n < 0 else ""
    if H:
        return sign + H.fmt(whole, grade) + H.frac(rest, d, grade)
    return sign + str(whole) + r"\f{" + str(rest) + "}{" + str(d) + "}"


def _answer_text(solved, unit, grade, H=None, *, original_variable=None, notation=None, forms=frozenset(), sides=None):
    """Print the exact key in the written form of its question.

    ``forms`` and ``sides`` only choose a spelling (two money decimals, a mixed
    number, the compared sides as printed). They never change a value.
    """
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else (lambda ast: to_house_math(ast, schoolbook=True))
    wrap = H.ltr if H else _middle_math
    # A percent sign belongs to its number, inside the formula: "30%", "x = 20%".
    # Printed after the formula as prose, the right-to-left line puts it on the wrong side.
    percent = (unit or "").strip() == "%" and solved["result"]["type"] in ("expression", "list", "solutions")
    value_wrap = (lambda text: wrap(text + "%")) if percent else wrap
    if percent:
        unit = ""
    result = solved["result"]
    if result["type"] == "expression":
        from numeric_literals import decimal_result
        decimal = decimal_result(result["value"], notation, money="money" in forms)
        if decimal is None and "decimal" in forms:
            from printed_parts import terminating_decimal
            # The item asks for a decimal; a value without one is refused at source validation.
            decimal = terminating_decimal(result["value"])
            if decimal is None:
                raise GeneralSourceError("PRINTED_ANSWER_KIND", "The item asks for a decimal and its exact answer has no finite decimal")
        mixed = _mixed_number(result["value"], grade, H) if "mixed" in forms and decimal is None else None
        answer = value_wrap(decimal if decimal is not None else mixed if mixed is not None else render(result["value"]))
    elif result["type"] == "comparison":
        sign = {"less": "<", "equal": "=", "greater": ">"}[result["relation"]]
        relation = html.escape(sign) if H else sign
        if sides:
            # The pupil sees these two sides; the key repeats them with the sign.
            answer = wrap(_span_text(sides[0], grade, H) + " " + relation + " " + _span_text(sides[1], grade, H))
        elif notation and notation.count("___") == 1:
            answer = _formula(notation.replace("___", sign), grade, H)
        else:
            answer = wrap(render(solved["question"]["left"])+" "+relation+" "+render(solved["question"]["right"]))
    elif result["type"] == "decision":
        # A verdict is printed only by _decision_text, from a claim bound to the printed question.
        raise GeneralSourceError("PRINTED_ANSWER_KIND", "A decided claim has no key without its printed question")
    elif result["type"] == "list":
        answer = ", ".join(value_wrap(render(value)) for value in result["values"]) or "אין שכיח"
    elif result["type"] == "system":
        answer = "אין פתרון בתחום ההצבה" if result["classification"] == "none" else "; ".join(", ".join(wrap(name+" = "+render(solution[name])) for name in result["variables"]) for solution in result["solutions"])
    elif result["type"] == "intervals":
        def interval(row):
            lo, hi, variable = row["lower"], row["upper"], result["variable"]
            if lo is None and hi is None:
                return "כל מספר ממשי"
            if lo is not None and hi is not None and lo == hi:
                return wrap(variable+" = "+render(lo))
            if lo is None:
                return wrap(variable+(" ≤ " if row["upperClosed"] else " < ")+render(hi))
            if hi is None:
                return wrap(variable+(" ≥ " if row["lowerClosed"] else " > ")+render(lo))
            return wrap(render(lo)+(" ≤ " if row["lowerClosed"] else " < ")+variable+(" ≤ " if row["upperClosed"] else " < ")+render(hi))
        answer = " או ".join(interval(row) for row in result["intervals"]) or "אין פתרון בתחום ההצבה"
    else:
        if result["classification"] == "finite":
            answer = ", ".join(value_wrap(result["variable"] + " = " + render(value)) for value in result["values"])
        elif result["classification"] == "none":
            answer = "אין פתרון בתחום ההצבה"
        else:
            answer = "כל מספר ממשי בתחום ההצבה"
    if unit:
        answer += " " + (html.escape(unit) if H else unit)
    conditions = solved["domain"]["conditions"]
    if conditions:
        domain = []
        for condition in conditions:
            # Elementary symbolic denominator restrictions are not supported.
            condition_math = render(condition["expression"])
            if original_variable:
                condition_math = re.sub(r"(?<![A-Za-z])x(?![A-Za-z])", original_variable, condition_math)
            domain.append(wrap(condition_math + (" שונה מאפס" if H else " \\neq 0")))
        answer += ". תחום ההצבה: " + ", ".join(domain)
    return answer


def _decision_text(decision, grade, H=None):
    """Print a computed verdict and the exact calculations behind it.

    The words are fixed and the numbers are the kernel's. When a calculation
    has no approved typography in this grade, the verdict stands alone.
    """
    render = (lambda ast: _elementary_math(ast, grade, H)) if H else (lambda ast: to_house_math(ast, schoolbook=True))
    wrap = H.ltr if H else _middle_math
    verdict = decision.verdict(pointed=bool(H) and grade in "אב")
    reasons = []
    try:
        for step in decision.steps:
            if step[0] == "value":
                uneven = (step[1]["op"] == "divide" and step[2].get("denominator", 1) != 1
                          and all(arg.get("type") == "number" and arg["denominator"] == 1 for arg in step[1]["args"]))
                if H and grade in "אבגד" and uneven:
                    continue  # before grade five a quotient is not written as a fraction
                reasons.append(wrap(render(step[1]) + " = " + render(step[2])))
            elif H:
                dividend, divisor, quotient, remainder = step[1:]
                division = wrap(render({"type": "operation", "op": "divide", "args": [dividend, divisor]})
                                + " = " + render(quotient))
                if remainder["numerator"]:
                    division += " (" + ("שְׁאֵרִית" if grade in "אב" else "שארית") + " " + wrap(render(remainder)) + ")"
                reasons.append(division)
            else:
                dividend, divisor, quotient, remainder = step[1:]
                product = {"type": "operation", "op": "multiply", "args": [divisor, quotient]}
                whole = product if not remainder["numerator"] else {"type": "operation", "op": "add", "args": [product, remainder]}
                reasons.append(wrap(render(dividend) + " = " + to_house_math(whole)))
    except (GeneralSourceError, ValueError):
        reasons = []
    text = html.escape(verdict) if H else verdict
    return text + (". " + ", ".join(reasons) if reasons else "")


# The refusals of the pinned figure constructors: a shape they will not draw
# and a layout their checker refuses. Anything else is a fault, not a refusal.
FIGURE_REFUSALS = ("ShapeError", "LayoutError", "ValueError")


def figure_refused(exc):
    """Whether an exception of a figure constructor is one of its refusals."""
    return any(cls.__name__ in FIGURE_REFUSALS for cls in type(exc).__mro__)


def _wider(span, limit=10):
    """An axis window two units wider: one unit on each side, both on one side at the limit."""
    low, high = span[0] - 1, span[1] + 1
    if high > limit:
        low, high = low - (high - limit), limit
    if low < -limit:
        low, high = -limit, min(limit, high + (-limit - low))
    return [low, high]


# What the givens of a question declare about its figure. A definition
# constructor draws the marks of its definition (equal ticks, right-angle
# marks), and a mark is a given the pupil reads: it may show what the
# question states, never what an item asks. Only declarative sentences of
# the intro count: a question, a condition, a negation or a request to
# prove or check states nothing.
_NOT_STATED = re.compile(r"\?|(?<![א-ת])(?:[וש]?ה?אם|הוכיחו|הראו|נמקו|בדקו|קבעו|הסבירו|ייתכן|ו?לא|אינ(?:ו|ה|ם|ן)|אין)(?![א-ת])")
_PREFIX = r"(?<![א-ת])(?:[וש]?[הבלכ]?)"
_STATED_WORDS = {
    "isosceles": re.compile(r"(?<![א-ת])ו?שוו(?:ה|ת|י|ות)[\s־-]*(?:ה)?שוקיים(?![א-ת])"),
    "equilateral": re.compile(r"(?<![א-ת])ו?שוו(?:ה|ת|י|ות)[\s־-]*(?:ה)?צלעות(?![א-ת])"),
    "right": re.compile(r"(?<![א-ת])(?:ו?ישר(?:ת|י|ות)?[\s־-]*(?:ה)?זווית|זווי(?:ת|ות)[\s־-]*ישר(?:ה|ות))(?![א-ת])"),
    "rhombus": re.compile(_PREFIX + r"מעוין(?![א-ת])"),
    "rectangle": re.compile(_PREFIX + r"מלבן(?![א-ת])"),
    # Not after ב: "בריבוע" is also "squared".
    "square": re.compile(r"(?<![א-ת])(?:[וש]?[הל]?)ריבוע(?![א-ת])"),
}
_SEGMENT = re.compile(r"[A-Z]{2}")
_RIGHT_ANGLE = re.compile(r"^∠\s?[A-Z]{1,3}(?:\s?=\s?∠\s?[A-Z]{1,3})*\s?=\s?90\s?°?$")
_ANGLE_NAME = re.compile(r"∠\s?([A-Z]{1,3})")


def _sentences(spans):
    """The intro as sentences: [(Hebrew words, [formula or segment notations])]."""
    rows, words, formulas = [], [], []
    for span in spans if isinstance(spans, list) else ():
        if not isinstance(span, dict):
            continue
        if span.get("kind") == "text" and isinstance(span.get("text"), str):
            parts = re.split(r"(?<=[.!?])", span["text"])
            for k, part in enumerate(parts):
                words.append(part)
                if k < len(parts) - 1:
                    rows.append(("".join(words), formulas))
                    words, formulas = [], []
        elif span.get("kind") == "formula" and isinstance(span.get("notation"), str):
            formulas.append(span["notation"])
        elif span.get("kind") == "geometry" and isinstance(span.get("names"), str):
            formulas.append(span["names"])
    if words or formulas:
        rows.append(("".join(words), formulas))
    return rows


def declared_properties(question):
    """What the intro of a validated question states about its figure, as a frozenset of strings.

    Words: "isosceles", "equilateral", "right", "rhombus", "rectangle",
    "square". A right angle at a named vertex ([[∠A = ∠D = 90°]],
    [[AD ⊥ CD]]) adds "right" and "right@A", "right@D". Equal segments:
    "=AD,BC" for every pair the intro states equal, by a chain of names
    ([[AD = BC]]) or by one length given to both ([[AD = 13]] ...
    [[BC = 13]]); each name is spelled in sorted letters.
    """
    found, lengths = set(), {}
    for words, formulas in _sentences((question or {}).get("intro")):
        if _NOT_STATED.search(words):
            continue
        found.update(name for name, pattern in _STATED_WORDS.items() if pattern.search(words))
        for notation in formulas:
            text = notation.strip()
            if _RIGHT_ANGLE.search(text):
                found.add("right")
                found.update("right@" + (name[1] if len(name) == 3 else name[0]) for name in _ANGLE_NAME.findall(text))
            sides = [part.strip() for part in text.split("⊥")]
            if len(sides) == 2 and all(_SEGMENT.fullmatch(part) for part in sides):
                found.add("right")
                found.update("right@" + vertex for vertex in set(sides[0]) & set(sides[1]))
            parts = [part.strip() for part in text.split("=")]
            names = ["".join(sorted(part)) for part in parts if _SEGMENT.fullmatch(part)]
            if len(parts) >= 2 and re.fullmatch(r"[0-9]+(?:\.[0-9]+)?", parts[-1]) and len(names) == len(parts) - 1:
                for name in names:
                    lengths.setdefault(parts[-1], set()).add(name)
            elif len(parts) >= 2 and len(names) == len(parts):
                lengths.setdefault(("chain", len(lengths)), set()).update(names)
    for group in lengths.values():
        found.update("=" + ",".join(pair) for pair in
                     ([a, b] for a in sorted(group) for b in sorted(group) if a < b))
    return frozenset(found)


def _equal(declared, one, other):
    """Whether the intro states segments ``one`` and ``other`` equal."""
    return "=" + ",".join(sorted(("".join(sorted(one)), "".join(sorted(other))))) in declared


def _right(declared, vertices):
    """Whether the intro states a right angle that may stand at one of ``vertices``."""
    named = {entry[6:] for entry in declared if entry.startswith("right@")}
    return "right" in declared and (not named or bool(named & set(vertices)))


def _equal_pair(declared, word, names, one, other):
    """Whether the intro states that sides ``one`` and ``other`` are the equal pair of the figure.

    By naming the pair, or by the shape's name (``word``) when it names no
    other pair of the figure's sides as equal: "שווה שוקיים (AB = AC)" over
    a figure whose equal sides are CA and CB states the wrong pair.
    """
    if _equal(declared, one, other):
        return True
    sides = [names[k] + names[(k + 1) % len(names)] for k in range(len(names))]
    stated = [(s, t) for i, s in enumerate(sides) for t in sides[i + 1:] if _equal(declared, s, t)]
    return word in declared and not stated


def _shape_call(fig, declared=frozenset()):
    """(constructor, arguments, names, family) of the pinned call that draws a validated shape.

    A constructor of a general shape refuses a figure whose measures make it a
    special one (legs that come out equal, a corner of 90 degrees), and points
    to the constructor whose definition says so. That constructor draws the
    same figure exactly, with the marks of its definition. Such a figure is
    routed there only when its own measures make it that shape exactly AND
    the question's intro states the property (declared_properties), so a mark
    never shows what an item asks. A triangle is renamed in cyclic order (its
    orientation kept) so that the vertex of the definition comes where the
    constructor puts it. Everything else is passed on unchanged and refused,
    or drawn, by the constructor the author chose.

    The family names the configuration drawn (G76 counts objects by it): a
    special shape is its own configuration.
    """
    shape, params, names = fig["shape"], dict(fig["parameters"]), fig["names"]
    special = None
    if shape == "parallelogram":
        a, b, angle = params["a"], params["b"], params["angle"]
        if angle == 90 and a == b and "square" in declared:
            shape, params = "square", {"a": a}
        elif angle == 90 and ("rectangle" in declared or _right(declared, names)):
            shape, params = "rectangle", {"w": a, "h": b}
        elif a == b and ("rhombus" in declared or _equal(declared, names[0:2], names[1:3])
                         or _equal(declared, names[0:2], names[3] + names[0])):
            shape, params = "rhombus", {"a": a, "angle": angle}
    elif shape == "rhombus" and params["d1"] == params["d2"] and "square" in declared:
        shape, params = "square", {"a": params["d1"] / math.sqrt(2)}
    elif shape == "rectangle" and params["w"] == params["h"] and "square" in declared:
        shape, params = "square", {"a": params["w"]}
    elif shape == "kite" and params["a"] == params["b"] and "rhombus" in declared and 2 * params["a"] > params["q"]:
        # Four equal sides: the rhombus whose diagonal BD is q.
        shape, params = "rhombus", {"d1": 2 * math.sqrt(params["a"] ** 2 - params["q"] ** 2 / 4), "d2": params["q"]}
    elif shape == "trapezoid":
        a, b, h, dx = params["a"], params["b"], params["h"], params["dx"]
        legs = (names[3] + names[0], names[1] + names[2])
        if dx == 0 and _right(declared, names[0] + names[3]):
            special, params = "right", {"a": a, "b": b, "h": h}
        elif 2 * dx == a - b and _equal_pair(declared, "isosceles", names, *legs):
            special, params = "iso", {"a": a, "b": b, "h": h}
        params["variant"] = special or "scalene"
    elif shape == "triangle":
        # Side k runs from vertex k to vertex k+1: AB = c, BC = a, CA = b.
        side = {0: params["c"], 1: params["a"], 2: params["b"]}
        params = {"a": params["a"], "b": params["b"], "c": params["c"], "variant": "sss"}
        if side[0] == side[1] == side[2] and ("equilateral" in declared or
                                              all(_equal(declared, names[k] + names[(k + 1) % 3],
                                                         names[(k + 1) % 3] + names[(k + 2) % 3]) for k in range(2))):
            special, params = "equilateral", {"a": side[0], "variant": "equilateral"}
        else:
            for k in range(3):
                near, far, opposite = side[k], side[(k + 2) % 3], side[(k + 1) % 3]
                turned = names[k:] + names[:k]
                # The right angle at vertex k: pinned 'right' puts it at its first vertex.
                if near ** 2 + far ** 2 == opposite ** 2 and _right(declared, names[k]):
                    special, params, names = "right", {"c": near, "b": far, "variant": "right"}, turned
                    break
                # The apex at vertex k: pinned 'iso' puts it last, over its base.
                if near == far and _equal_pair(declared, "isosceles", names, names[k] + names[(k + 1) % 3],
                                               names[k] + names[(k + 2) % 3]):
                    special = "iso"
                    params = {"base": opposite, "leg": near, "variant": "iso"}
                    names = names[(k + 1) % 3:] + names[:(k + 1) % 3]
                    break
    family = "general." + shape + ("." + special if special else "")
    return shape, params, names, family


# Other windows and numbering of one coordinate figure, in the order tried:
# (more below x, more above x, more below y, more above y, numbering step).
# Measured with _middle_call on 379 rhombus and kite point sets with vertices on
# the axes: the author's window refused 99, and each of them was drawn by the
# wider window (33), one unit more below both axes (30) or numbering on every
# unit (36). The later shifts are kept for other point sets.
_PLANE_SHIFTS = ((-1, 0, -1, 0, None), (0, 0, 0, 0, 1), (-2, 2, -2, 2, None), (0, 1, 0, 1, None),
                 (0, 0, -1, 0, None), (-1, 0, 0, 0, None))


def _plane_layouts(fig, limit=10, span=16):
    """The windows and numbering steps a coordinate figure may be drawn in, in order.

    Each one draws the same points and segments exactly: the author's window
    first, then the window two units wider, then the shifts above. A letter
    that the skill finds in the slot of an axis number moves with the window
    or the step; an axis number is never dropped (the skill refuses that). A
    window keeps the origin, stays inside +-limit and spans at most ``span``
    units, as general_source requires of the author's own window.
    """
    xr, yr = list(fig["xr"]), list(fig["yr"])
    candidates = [(xr, yr, None), (_wider(xr), _wider(yr), None)]
    candidates += [([xr[0] + a, xr[1] + b], [yr[0] + c, yr[1] + d], step) for a, b, c, d, step in _PLANE_SHIFTS]
    seen, layouts = set(), []
    for x, y, step in candidates:
        key = (tuple(x), tuple(y), step)
        if key in seen or not all(-limit <= lo <= 0 <= hi <= limit and hi - lo <= span for lo, hi in (x, y)):
            continue
        seen.add(key)
        layouts.append({"xr": list(x), "yr": list(y), **({"step": step} if step else {})})
    return layouts


def _middle_call(fig, declared=frozenset()):
    """(svg, call) for a validated middle-school figure; ``call`` replays the drawing exactly.

    The render bridge (MIDDLE_BRIDGE) draws the figure again from ``call``
    and refuses the build when the two differ, so the routed constructor and
    the chosen window must be the recorded ones.
    """
    if fig["kind"] == "coordinate_plane":
        from figkit_plus import plane, wide
        points = {p["name"]: (p["x"], p["y"]) for p in fig["points"]}
        # Coordinate object identity is measured from actual point sets by
        # figkit.figure_family. A Euclidean fam tag would incorrectly collapse
        # distinct coordinate graphs into one declared shape (G76 contract).
        builder = wide if fig.get("placement") == "wide" else plane
        refusal = None
        for layout in _plane_layouts(fig):
            try:
                svg = builder(tuple(layout["xr"]), tuple(layout["yr"]), points=[(xy, name) for name, xy in points.items()],
                              solid=[(points[a], points[b]) for a, b in fig["segments"]],
                              **({"step": layout["step"]} if "step" in layout else {}))
            except Exception as exc:  # noqa: BLE001 - only the skill's layout refusal is retried
                if refusal is None and type(exc).__name__ != "LayoutError":
                    raise  # the author's own window: anything but a layout refusal is the skill's verdict
                if refusal is not None and not isinstance(exc, AssertionError) and not figure_refused(exc):
                    raise
                # Another window or step is only a way out: any refusal of it leaves the first one standing.
                refusal = refusal or exc
                continue
            return svg, {**deepcopy(fig), **layout}
        raise refusal
    import shapekit as SK
    shape, params, names, family = _shape_call(fig, declared)
    g, data = SK.shape(shape, rotate=fig["rotate"], names=names, marks=True, fam=family, **params)
    return SK.finish(g, family), {"kind": "shape", "shape": shape, "parameters": params, "names": names,
                                  "rotate": fig["rotate"], "family": family}


def _figure(fig, elementary, index, work, *, declared=frozenset(), call=None):
    """Invoke only explicit trusted skill constructors with validated fields.

    ``declared`` is declared_properties of the question (middle school).
    When ``call`` is a dict, the exact middle-school constructor call is
    stored in it under "call" for the render bridge.
    """
    kind = fig["kind"]
    if elementary:
        import svg_elementary_ext as SX
        if kind == "grid_shape":
            svg = SX.area_grid_shape(fig["cells"])
        elif kind == "solid":
            svg = SX.polyhedron_3d(kind="triangular_prism" if fig["shape"] == "prism" else fig["shape"], dims=tuple(fig["dimensions"]))
        else:
            raise ValueError("Unsupported elementary geometry figure")
    else:
        svg, made = _middle_call(fig, declared)
        if isinstance(call, dict):
            call["call"] = made
    path = work / "figures" / f"q{index}.svg"
    path.write_text(svg, encoding="utf-8")
    dump(path.with_suffix(".json"), {"version": 1, "constructorInput": fig, "sha256": hashlib.sha256(svg.encode("utf-8")).hexdigest()})
    return svg, path.relative_to(work).as_posix()


def compile_source(lesson, validated, scope, skill_path, work, *, printed_answers=None, printed_fractions=False):
    """Write skill build inputs. A caller must still run every applicable gate.

    ``validated`` is revalidated rather than trusting deserialized evidence.
    Elementary unsupported prose/proof answers require a real Ledger proof and
    are refused before build inputs. Middle-school prose remains explicitly
    unverified; all unchanged proof/didactic gates must still run.
    """
    checked = validate_source(lesson, validated["source"], scope)
    source, evidence = checked["source"], checked["evidence"]
    work = Path(work); skill = Path(skill_path)
    work.mkdir(parents=True, exist_ok=True)
    dump(work / "general-source.json", source)
    dump(work / "general-evidence.json", evidence)
    elementary = scope["topic"]["skillId"] == "elementary"
    refused = [row for row in evidence["unverifiedAnswers"] if row.get("kind") not in ("label", "open", "decision")]
    if refused and elementary:
        where = re.fullmatch(r"q([1-9][0-9]?)-i([1-9])", refused[0]["itemId"])
        raise GeneralSourceError("UNVERIFIED_ANSWERS", "This draft contains prose or proof answers without an implemented exact verifier; no deliverable was compiled",
                                 question=int(where[1]) if where else None, item=int(where[2]) if where else None)
    if printed_fractions:
        from fraction_lesson import eligible
        if not elementary or not eligible(lesson):
            raise GeneralSourceError("FRACTION_SCOPE", "Printed fractions require the supported lesson scope")
    if printed_answers is not None and not elementary:
        raise GeneralSourceError("PRINTED_TASK_MISMATCH", "Counting evidence must belong to an elementary worksheet")
    _load_skill(skill, elementary)
    (work / "figures").mkdir(exist_ok=True)
    # The question being compiled. A refusal raised there names that question;
    # a position the raiser already recorded (question and item) is kept.
    cursor = {"question": None}
    try:
        if elementary:
            _compile_elementary(lesson, source, evidence, scope, skill, work, printed_answers=printed_answers, printed_fractions=printed_fractions, cursor=cursor)
        else:
            _compile_middle(lesson, source, evidence, scope, skill, work, cursor=cursor)
    except GeneralSourceError as error:
        raise (error.at(cursor["question"]) if cursor["question"] else error)
    return {"skill": scope["topic"]["skillId"], "work": str(work), "sourcePath": str(work / "worksheet-source.json"), "evidencePath": str(work / "general-evidence.json"), "unverifiedAnswerCount": len(evidence["unverifiedAnswers"]),
            # For a teacher note: which printed answers no kernel verified, and which items have no key.
            "unverifiedAnswers": [{"question": row.get("question"), "item": row.get("item"), "kind": row.get("kind", "review")}
                                  for row in evidence["unverifiedAnswers"]],
            "reviewRequired": True}


_PARTS_NUMBER = re.compile(r"(?<![.\d])\d{4,}(?![\d])")


def _elementary_item(lesson, question, item, computed, n, j, grade, H, ledger, *, intro_spans, printed_answers, printed_fractions, withheld=None):
    """Render one item: the pupil line and its key, each bound to what is printed.

    Every binder either proves that the prompt already shows the exercise or
    raises. The typed task is printed after the prompt only by shows_task.
    """
    item_id = f"q{n}-i{j}"
    number_grade = lesson["gradeNumber"]
    notation = item["answer"].get("notation")
    figure_task = item["answer"]["kind"] == "figure"
    prompt = rich_text(item["prompt"], grade, H)
    seen = dict(question, intro=intro_spans)
    if computed is None:
        # A label is the author's own plain Hebrew, escaped. An open item has
        # no key: a fixed line sends it to the teacher. Neither enters the ledger.
        if item["answer"]["kind"] == "label":
            return prompt, html.escape(item["answer"]["text"])
        return prompt, html.escape(TEACHER_CHECK)
    if not figure_task and computed["question"].get("kind") == "decide":
        decision = bind_decision(seen, item, computed, number_grade)
        # A fresh calculation, not a model-provided answer or boolean.
        repeated = validate_and_solve_task(item["answer"]["task"])
        ledger.claim(f"{n}.{j}", "תוצאת המשימה המתמטית המודפסת בלבד", (repeated == computed, computed), method="sympy")
        ledger.claim(f"{n}.{j}.decision", "ההכרעה המודפסת היא הכרעת הטענה שבשאלה",
                     (repeated["result"]["holds"] is decision.holds, decision.proof), method="closed_form")
        return prompt, _decision_text(decision, grade, H)
    forms = frozenset() if figure_task else answer_form(seen, item, computed)
    keyed = computed if figure_task else narrowed(computed, chosen_solutions(seen, item, computed))
    answer = _answer_text(keyed, item["answer"]["unit"], grade, H, notation=notation, forms=forms)
    # True once a binder has tied the key to the exercise that the prompt shows.
    bound = states_entire_task(lesson, n-1, j-1, item) or _prints_calculation(item, computed, number_grade)
    intent = (printed_intent(question, item, computed, number_grade, location=f"q{n}.item.{j}")
              or printed_table_row(question, item, computed))
    if intent:
        bound = True
        if intent["rule"] in ("write_expression", "write_division"):
            entered = _elementary_math(intent["expression"], grade, H)
            result = _elementary_math(intent.get("value", computed["result"]["value"]), grade, H)
            answer = H.ltr(entered + " = " + result)
        ledger.claim(f"{n}.{j}.intent", "הפעולות והנתונים אומתו מול השאלה המודפסת",
                     intent, method="closed_form")
    visible = match_printed_task(item, computed, number_grade)
    if visible:
        bound = True
        if visible.label:
            answer = html.escape(visible.label) + " (" + answer + ")"
        ledger.claim(f"{n}.{j}.visible", "התשובה אומתה מול הביטוי המודפס",
                     visible.proof, method="closed_form")
    if printed_fractions:
        from fraction_lesson import printed_evidence
        proof = printed_evidence(question, j - 1, computed)
        ledger.claim(f"{n}.{j}.printed", "תשובה שנבדקה מול השברים המודפסים", proof, method="closed_form")
        bound = True
    guard_counting_input(lesson, question, item, computed)
    # Multi-part keys and the fail-closed guard for several blanks.
    binding = bind_parts(question, item, computed, number_grade)
    if printed_answers is not None:
        from counting_lesson import answer_from_prompt
        counted = answer_from_prompt(intro_spans, item["prompt"])
        if type(counted) is not int or counted != printed_answers[item_id]:
            raise GeneralSourceError("PRINTED_TASK_MISMATCH", "The printed words and exact counting key disagree")
        bound = True
        ledger.claim(f"{n}.{j}.printed", "תשובה שנבדקה מול המילים המודפסות",
                     {"countFromWords": counted, "evaluated": computed["result"]["value"]}, method="closed_form")
    if binding:
        # The key answers every blank. The prompt shows the givens unless the
        # binder read them from the typed task of a prompt without numbers.
        bound = bound or binding.proof.get("givens") != "task"
        # Tuples are formulas computed here; strings are prose and are escaped.
        answer = "".join(H.ltr(_PARTS_NUMBER.sub(lambda m: H.fmt(int(m[0]), grade), p[0])) if isinstance(p, tuple)
                         else html.escape(p) for p in binding.parts)
        ledger.claim(f"{n}.{j}.printed", "התשובה לכל מקום ריק חושבה מנתוני השאלה המודפסים",
                     binding.proof, method="closed_form")
    if not figure_task:
        sign = comparison_blank(item, computed, number_grade)
        if sign:
            bound = True
            answer = _answer_text(computed, item["answer"]["unit"], grade, H, sides=sign["sides"])
            ledger.claim(f"{n}.{j}.sign", "סימן ההשוואה אומת מול שני האגפים המודפסים",
                         {"rule": sign["rule"], "left": sign["left"], "right": sign["right"]}, method="closed_form")
        calculation = printed_calculation(question, item, computed, number_grade)
        if calculation:
            bound = True
            ledger.claim(f"{n}.{j}.calculation", "התשובה היא ערך התרגיל המודפס", calculation, method="closed_form")
    forced = not bound and needs_printed_task(lesson, n-1, j-1, item)
    if forced and not shows_task(seen, item, computed, withheld=withheld) and shows_task(seen, item, computed):
        # The calculation this item must print shows an earlier item's answer.
        raise GeneralSourceError("PRINTED_ANSWER_LEAK", "An item prints the answer of an earlier item of the same question")
    # An earlier item's answer in the typed task keeps the task off the page (withheld, validated by answer_leak).
    show = not bound and (shows_task(seen, item, computed, withheld=withheld) or forced)
    task_text = _task_text(computed, grade, H, notation=notation) if show else ""
    # A fresh calculation, not a model-provided answer or boolean.
    repeated = solve_figure_task(question["figure"],item["answer"]["operation"],item["answer"].get("point")) if figure_task else validate_and_solve_task(item["answer"]["task"])
    ledger.claim(f"{n}.{j}", "תוצאת המשימה המתמטית המודפסת בלבד", (repeated == computed, computed), method="closed_form" if figure_task else "sympy")
    return (prompt + " " + task_text if task_text else prompt), answer


# The writing room under an item, sized by what the item asks the pupil to write.
_DRAWING = re.compile(r"(?<![א-ת])ו?(?:צי?ירו|שרטטו|סרטטו|צבעו|גזרו|קפלו|בנו|הרכיבו|מדדו|סמנו\s+על)(?![א-ת])")
_POINTED = re.compile(r"[\u0591-\u05c7]")


def _plain_words(spans):
    return _POINTED.sub("", "".join(span.get("text", "") if span.get("kind") == "text" else "@" for span in spans or ()))


def _operations(tree):
    """How many operations a typed expression performs (an n-ary sum of four terms is three)."""
    if isinstance(tree, dict):
        own = max(0, len(tree.get("args") or ()) - 1) if tree.get("type") == "operation" else 0
        if tree.get("type") == "operation" and tree.get("op") in ("sqrt", "negate"):
            own = 1 if tree.get("op") == "sqrt" else 0
        return own + sum(_operations(child) for key, child in tree.items() if key != "type")
    if isinstance(tree, list):
        return sum(_operations(child) for child in tree)
    return 0


def answer_room(question, item, computed):
    """(kind, lines): the room an item needs, from what it asks the pupil to write.

    drawing      an open item that asks to draw, build or measure: a framed box
    explanation  an open item that asks to explain or invent, a middle-school review: three lines
    computation  the pupil writes an exercise from words (a story), or a solution with several steps: three lines
    steps        a printed calculation of several operations, a one-operation story, a verdict with its check: two lines
    short        a blank inside the printed formula, a name, a one-operation printed calculation: one line
    """
    answer = item["answer"]
    words = _plain_words(item.get("prompt")) + " " + _plain_words(question.get("intro"))
    if answer["kind"] == "open":
        return ("drawing", 4) if _DRAWING.search(words) else ("explanation", 3)
    if answer["kind"] == "review":
        return "explanation", 3
    if answer["kind"] == "label" or computed is None:
        return "short", 1
    task = computed["question"]
    if task.get("kind") == "decide":
        return "steps", 2
    if any(span.get("kind") == "formula" and "___" in span.get("notation", "") for span in item.get("prompt") or ()):
        return "short", 1
    operations = _operations({key: value for key, value in task.items() if key != "kind"})
    if task.get("kind") in ("solve", "solve_system", "inequality"):
        # Solving is written line by line, whether or not the equation is printed.
        operations += 1
        if operations > 2:
            return "computation", 3
    printed = any(span.get("kind") != "text" and _operations(span.get("expression")) + len(re.findall(r"[-+*/:^x×·]", span.get("notation", ""))) > 0
                  for span in item.get("prompt") or ())
    if printed:
        return ("short", 1) if operations <= 1 else ("steps", 2)
    return ("steps", 2) if operations <= 1 else ("computation", 3)


# Points below a middle-school item; the pinned printer leaves them blank under the item.
MIDDLE_SPACE = {"short": 32, "steps": 50, "computation": 68, "explanation": 68, "drawing": 120}


def _elementary_room(kind, lines):
    """The room as the pinned printer and the Word exporter both read it, beside (not inside) the item.

    The Word exporter turns a direct ``ansline`` child of a question into an
    answer line and ignores one nested in the item, so the room follows the
    item. Ruled lines above it are one block of line breaks, a blank paragraph
    of the same height in Word.
    """
    if kind == "drawing":
        return '<div class="open-work">' + "<br>" * lines + '</div>'
    ruled = "".join('<div class="wl"><br></div>' for _ in range(lines - 1))
    return ('<div class="work-room">' + ruled + '</div>' if ruled else '') + '<div class="ansline"></div>'


def _compile_elementary(lesson, source, evidence, scope, skill, work, *, printed_answers=None, printed_fractions=False, cursor=None):
    cursor = {} if cursor is None else cursor  # compile_source reads the question being compiled
    import ws_html as H
    from content_truth import Ledger
    grade = LETTERS[lesson["gradeNumber"] - 1]
    ab = lesson["gradeNumber"] <= 2
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    if printed_answers is not None:
        validate_counting_values(lesson, solved, printed_answers)
    ledger = Ledger(str(work / "verified.json"))
    qs, canon, n = [], [], 0
    for section in source["sections"]:
        for question in section["questions"]:
            n += 1; pieces, items, answers, source_items = [], [], [], []
            cursor["question"] = n
            revised_intro = place_intro(lesson, question)
            intro_spans = [{"kind":"text","text":revised_intro}] if revised_intro else question["intro"]
            intro = rich_text(intro_spans, grade, H)
            # A section heading stands before its first question, never inside it. A heading
            # that repeats the sheet title (one selected-topic section) is not printed again.
            heading = ('<h3 class="section-title">' + html.escape(section["title"]) + '</h3>'
                       if question is section["questions"][0] and section["title"] != source["title"]
                       and not ((printed_answers is not None or printed_fractions) and len(source["sections"]) == 1) else '')
            if "table" in question:
                table = question["table"]
                pieces.append('<table class="work-table" dir="rtl"><thead><tr>' + ''.join('<th>'+rich_text(c, grade, H)+'</th>' for c in table["head"]) + '</tr></thead><tbody>' + ''.join('<tr>'+''.join('<td>'+rich_text(c, grade, H)+'</td>' for c in row)+'</tr>' for row in table["rows"]) + '</tbody></table>')
            figpath = None
            if "figure" in question:
                svg, figpath = _figure(question["figure"], True, n, work)
                measurement=measure_elementary_svg(question["figure"],svg)
                if not measurement[0]:
                    raise GeneralSourceError("UNVERIFIED_FIGURE","The rendered elementary figure has no passing measured-SVG assertion", question=n)
                ledger.claim(str(n),"בדיקת הנתונים בשרטוט המודפס",measurement,method="figure_assert")
                pieces.append(H.fig(svg))
            # The earlier answers each item's printed task may not show (validated by answer_leak).
            seen = dict(question, intro=intro_spans)
            withheld = earlier_answers(seen, printed_keys(seen, [solved.get(f"q{n}-i{k}") for k in range(1, len(question["items"]) + 1)]))
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved.get(item_id)
                if computed is None and item["answer"]["kind"] not in ("label", "open"):
                    raise GeneralSourceError("UNVERIFIED_ANSWERS", "An elementary answer has no exact verifier", question=n, item=j)
                try:
                    body, answer = _elementary_item(lesson, question, item, computed, n, j, grade, H, ledger,
                                                    intro_spans=intro_spans, printed_answers=printed_answers,
                                                    printed_fractions=printed_fractions, withheld=withheld[j])
                except GeneralSourceError as error:
                    # A later stage replaces exactly this question.
                    raise error.at(n, j)
                pieces.append('<div class="sub">'+LETTERS[j-1]+'. '+body+'</div>' + _elementary_room(*answer_room(seen, item, computed)))
                items.append(H.plain(body)); answers.append(answer)
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": H.plain(body), "answer": H.plain(answer), "task": computed["question"], "verificationId": f"{n}.{j}"}
                                    if computed else
                                    {"id": item_id, "label": LETTERS[j-1], "text": H.plain(body), "answer": H.plain(answer), "task": None,
                                     "verification": "unverified label; teacher review required" if item["answer"]["kind"] == "label"
                                     else "no key; the teacher checks this item"})
            q = {"n": str(n), "intro": H.plain(intro), "items": items, "answer": H.plain(H.keyed(answers)), "star": question["star"]}
            if figpath:
                q["fig"] = figpath
            qs.append((q, intro, ''.join(pieces), H.keyed(answers), heading))
            canon.append({"id": f"q{n}", "n": n, "section": section["title"], "conceptIds": section["conceptIds"], "intro": intro_spans, "table": question.get("table"), "figure": question.get("figure"), "items": source_items})
    cursor["question"] = None
    # The pinned content schema is {n, intro, items, answer, fig}. The star stays
    # in the HTML, where G50 counts it; in content.json the pinned difficulty
    # proxy (G61) would add two points to exactly the three challenge questions.
    gate_questions = [{k: v for k, v in q[0].items() if k != "star"} for q in qs]
    from claim_words import register
    register(ledger, gate_questions)
    ledger.save()
    meta = {"band": "elementary-ab" if ab else "elementary", "grade": grade, "level": {"a":"א", "b":"ב", "e":"מצוינות"}[lesson["level"]], "topic": source["title"], "topic_id": scope["topic"]["sourceTopicId"], "domain": scope["topic"]["domain"]}
    dump(work / "content.json", {"meta": meta, "questions": gate_questions})
    dump(work / "worksheet-source.json", {"version": 4, "meta": dict(meta, gradeNumber=lesson["gradeNumber"], levelCode={"a":"A", "b":"B", "e":"E"}[lesson["level"]], topicId=lesson["topicId"]), "questions": canon, "reviewRequired": True})
    template = (skill / "assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head = template.split("<body", 1)[0]
    # Keep long answer keys readable even when they continue across a page break.
    answer_layout = ("table.ans td{padding:8px}"
                     "table.ans tr:nth-last-child(-n+6):not(:last-child){break-after:avoid}")
    head = head.replace('</head>', '<style>'+answer_layout+'.answers span.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}.work-table{border-collapse:collapse;width:100%;margin:8px 0}.work-table td,.work-table th{border:1px solid #9cb5c8;padding:6px;text-align:center}.section-title{font-size:18px;color:#286ca1}.open-work{min-height:3.2cm;margin:4px 0 8px;border:1px dashed #9cb5c8;border-radius:6px}'
                        '.work-room .wl{border-bottom:1px solid #555;min-height:1.6em;margin:2px 0}'
                        # The closing line goes with the last question, never alone on a page of its own.
                        '.goodluck{break-before:avoid;page-break-before:avoid}'
                        '.rule-box{border:1px solid #9cb5c8;border-radius:6px;background:#F4FAFF;padding:4px 12px;margin:8px 0}</style></head>', 1)
    body = ['<body class="'+('band-ab' if ab else 'band-gd' if lesson["gradeNumber"]<=4 else 'band-hv')+'">', '<div class="unit">'+html.escape(source["title"])+'</div><hr class="unit-rule">', '<div class="subtitle">'+LEVELS[lesson["level"]]+' · כיתה '+grade+'׳</div>', '<div class="details"><span>שם: ____________________</span><span>כיתה: ________</span><span>תאריך: __________</span></div>', '<div class="rule-box">'+rich_text(source["rule"], grade, H)+'</div>', '<ol class="questions">']
    for q, intro, rendered, answer, heading in qs:
        body.append(heading+'<li'+(' class="starred"' if q["star"] else '')+'>'+('<span class="star"></span> ' if q["star"] else '')+intro+rendered+'</li>')
    body += ['</ol><div class="goodluck">'+('בְּהַצְלָחָה!' if ab else 'בהצלחה!')+'</div>', '<div class="answers"><h2>'+('תְּשׁוּבוֹת סוֹפִיּוֹת' if ab else 'תשובות סופיות')+'</h2><table class="ans">']
    for q, intro, rendered, answer, heading in qs:
        body.append('<tr><td class="qn">'+H.ltr(q["n"]+'.')+'</td><td>'+answer+'</td></tr>')
    body.append('</table></div></body></html>')
    (work / "sheet.html").write_text(head+'\n'.join(body), encoding="utf-8")


def _compile_middle(lesson, source, evidence, scope, skill, work, *, cursor=None):
    cursor = {} if cursor is None else cursor  # compile_source reads the question being compiled
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    qs, answers, canon, n = [], [], [], 0
    words_share={}
    printed_checks = {}
    for section in source["sections"]:
        first = n + 1
        for question in section["questions"]:
            n += 1; items, answer_items, source_items = [], [], []
            cursor["question"] = n
            intro = rich_text(question["intro"], lesson["gradeNumber"])
            q = {"n": n, "intro": intro, "star": question["star"], "items": items, "to_prove": []}
            solutions = [solved.get(f"q{n}-i{j}") for j in range(1, len(question["items"]) + 1)]
            # The earlier answers each item's printed task may not show (validated by answer_leak).
            withheld = earlier_answers(question, printed_keys(question, solutions))
            bank = matching_solution_choices(question, solutions, lesson["gradeNumber"])
            if bank:
                options, reused = bank
                q["given"] = [rich_text([option], lesson["gradeNumber"]) for option in options]
                if reused:
                    intro += " אפשר לבחור אותו פתרון ליותר ממשוואה אחת."
                    q["intro"] = intro
            if question.get("drawingFromWords"):
                words_share[n]="משימת סרטוט על סמך נתונים מילוליים; מקום הסרטוט נשמר ריק"
            if n == first:
                q["part"] = [section["title"], str(first)+"–"+str(first+len(section["questions"])-1)]
            if "figure" in question:
                drawn = {}
                try:
                    q["fig"], path = _figure(question["figure"], False, n, work,
                                             declared=declared_properties(question), call=drawn)
                except Exception as exc:  # noqa: BLE001 - only the pinned constructors' refusals are named
                    if not figure_refused(exc):
                        raise
                    # A figure the pinned constructors refuse names its question, which a later stage replaces.
                    raise GeneralSourceError("SOURCE_FIGURE", "The pinned skill cannot draw this figure").at(n) from None
                # The bridge replays this exact call: the routed constructor, the chosen window.
                q["_generalFigure"] = drawn["call"]
            if "table" in question:
                table = question["table"]
                q["table"] = {"head": [rich_text(c, lesson["gradeNumber"]) for c in table["head"]], "rows": [[rich_text(c, lesson["gradeNumber"]) for c in row] for row in table["rows"]], "hcol": True}
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved.get(item_id)
                prompt = rich_text(item["prompt"], lesson["gradeNumber"])
                try:
                    printed = (percentage_evidence(lesson, question["intro"], item, computed)
                               or printed_table_row(question, item, computed))
                    bound = match_printed_task(item, computed, lesson["gradeNumber"])
                    label = printed_solve(item["prompt"], computed["question"], lesson["gradeNumber"]) if computed else None
                    sign = comparison_blank(item, computed, lesson["gradeNumber"]) if computed else None
                    calculation = printed_calculation(question, item, computed, lesson["gradeNumber"]) if computed else None
                    decision = bind_decision(question, item, computed, lesson["gradeNumber"]) if computed else None
                except GeneralSourceError as error:
                    # A later stage replaces exactly this question.
                    raise error.at(n, j)
                if isinstance(label, str) and label != computed["question"]["variable"]:
                    # Use the original, verified variable in the answer, its conditions and the skill targets.
                    computed = deepcopy(computed)
                    computed["result"]["variable"] = label
                    computed["domain"]["variables"] = [label]
                if isinstance(label, str):
                    printed = {"rule": "printed_equation", "variable": label}
                elif computed and item["answer"].get("printedVariable"):
                    # The question's own letter, which the compiler wrote as x (rename_unknown).
                    label = item["answer"]["printedVariable"]
                    computed = deepcopy(computed)
                    computed["result"]["variable"] = label
                    computed["domain"]["variables"] = [label]
                if bound:
                    printed = bound.proof
                if sign:
                    printed = {"rule": sign["rule"], "left": sign["left"], "right": sign["right"]}
                if calculation and not printed:
                    printed = calculation
                if decision:
                    printed = decision.proof
                if printed:
                    printed_checks[item_id] = printed
                show_task = (computed and not printed and not _prints_calculation(item, computed, lesson["gradeNumber"])
                             and shows_task(question, item, computed, withheld=withheld[j]))
                body = prompt+(" "+_task_text(computed, lesson["gradeNumber"], notation=item["answer"].get("notation")) if show_task else "")
                # The key prints only the solutions that the item's words ask for.
                keyed = narrowed(computed, chosen_solutions(question, item, computed)) if computed and not decision else computed
                answer = _answer_text(keyed, item["answer"]["unit"], lesson["gradeNumber"], original_variable=label, notation=item["answer"].get("notation"),
                                      forms=answer_form(question, item, computed), sides=sign["sides"] if sign else None) if computed and not decision else rich_text(item["answer"]["text"], lesson["gradeNumber"]) if not computed else _decision_text(decision, lesson["gradeNumber"])
                if bound and bound.label:
                    answer = bound.label + " (" + answer + ")"
                # The writing room, in points, by what the item asks the pupil to write (answer_room).
                space=(280 if question.get("drawingFromWords") and j==len(question["items"])
                       else MIDDLE_SPACE[answer_room(question, item, computed)[0]] + (14 if question["star"] else 0))
                # The item's stated givens. Without a printed task, the numbers of a
                # shared story live in the intro, and the pinned checks must see them there.
                given = [body] if show_task or not computed or not carries_data(question["intro"]) else [body, intro]
                row = {"label": LETTERS[j-1], "text": body, "space": space, "answer": answer, "given": given, "to_prove": []}
                result = computed["result"] if computed else {}
                if result.get("classification") == "finite" and result.get("variable"):
                    row["variables"] = computed["domain"]["variables"]
                    row["to_prove"] = [{"type":"find", "quantity":"variable", "of":result["variable"], "value":answer}]
                elif computed:
                    # A typed numeric/algebraic task has an exact private
                    # result, even when that result is a list or interval.
                    row["variables"] = computed["domain"]["variables"]
                    row["to_prove"] = [{"type":"find", "quantity":"value", "what":"תוצאת המשימה המתמטית בסעיף", "value":answer}]
                else:
                    # The pinned didactic gate must retain REVIEW, not a forged
                    # relation or an empty target presented as verified.
                    row["no_target_reason"] = "תוצאה של משימה מתמטית מוקלדת; נדרש לבדוק התאמה בין הניסוח, המשימה וההקשר"
                items.append(row); answer_items.append([LETTERS[j-1], answer])
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": body, "answer": answer, "task": computed["question"] if computed else None, "verification": "typed answer and verified printed givens" if printed else "typed task only" if computed else "unverified prose/proof; owner review required"})
            qs.append(q); answers.append([n, answer_items, question["star"]])
            canon.append({"id":f"q{n}", "n":n, "intro":intro, "section":section["title"], "conceptIds":section["conceptIds"], "items":source_items, "table":question.get("table"), "figure":question.get("figure")})
    cursor["question"] = None
    from general_source import geometry_topic
    figure_topic = True if geometry_topic(scope) else [False, "הנושא אינו גיאומטריה; הוראת נועם אוסרת שרטוטים בנושא זה"]
    level = {"level": LEVELS[lesson["level"]], "key": {"a":"a", "b":"b", "e":"c"}[lesson["level"]], "grade": str(lesson["gradeNumber"]), "keep_questions": True, "figure_topic": figure_topic, "title": source["title"], "rule": rich_text(source["rule"], lesson["gradeNumber"]), "questions": qs, "answers": answers, "curriculum": {"topic":scope["topic"]["sourceTopicId"], "track":scope["topic"]["sourceTrack"]}}
    if words_share:
        # JSON object keys are strings; trusted bridge restores integer ids
        # expected by the pinned skill. Model text is never Python source.
        level["words_share"]={str(k):v for k,v in words_share.items()}
    dump(work / "levels.json", [level])
    dump(work / "worksheet-source.json", {"version":4, "meta":{"gradeNumber":lesson["gradeNumber"], "levelCode":lesson["level"], "topicId":lesson["topicId"]}, "questions":canon, "reviewRequired":True})
    verification = {"version":1, "scope":"typed tasks only", "computations":evidence["computations"], "proseReviewRequired":True}
    if printed_checks:
        verification.update(scope="typed tasks and checked printed givens", printedChecks=printed_checks)
    dump(work / "verified.json", verification)
    # Constant bridge: no provider-controlled source is interpolated as Python.
    (work / "content.py").write_text(MIDDLE_BRIDGE+'PACKAGE = "G'+str(lesson["gradeNumber"])+'-T90"\n', encoding="utf-8")


FAILURE_RECORD = "adapter-failure.json"


def _main(args, wd):
    load = lambda name: json.loads((wd / name).read_text(encoding="utf-8"))
    lesson, payload, scope = load("lesson.json"), load("model-output.json"), load("curriculum-scope.json")
    import division_facts
    import square_lesson
    import pythagoras_lesson
    import fraction_lesson
    import counting_lesson
    from triangle_lesson import VERSION, compile_triangle
    if payload.get("version") == fraction_lesson.VERSION:
        result = fraction_lesson.compile_fractions(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == counting_lesson.VERSION:
        result = counting_lesson.compile_counting(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == division_facts.VERSION:
        result = division_facts.compile_source(lesson, payload, args.skill, wd)
    elif payload.get("version") == pythagoras_lesson.VERSION:
        result = pythagoras_lesson.compile_pythagoras(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") in (square_lesson.VERSION, square_lesson.INTRO_VERSION):
        result = square_lesson.compile_square(lesson, payload, scope, args.skill, wd)
    elif payload.get("version") == VERSION:
        result = compile_triangle(lesson, payload, scope, args.skill, wd)
    else:
        result = compile_source(lesson, validate_source(lesson, payload, scope), scope, args.skill, wd)
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    ap = argparse.ArgumentParser(); ap.add_argument("--skill", required=True); ap.add_argument("--work", required=True)
    args = ap.parse_args(); wd = Path(args.work)
    try:
        _main(args, wd)
    except GeneralSourceError as error:
        # The parent process reads this record instead of parsing a traceback
        # (skill_feedback.adapter_refusal). It holds a code and a position
        # only, never model text.
        dump(wd / FAILURE_RECORD, {"version": 1, "step": "trusted-adapter", "code": error.code,
                                   "question": error.question, "item": error.item})
        raise
