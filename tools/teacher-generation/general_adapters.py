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
import re
import json
from pathlib import Path
import sys

from general_source import V5_CONTRACT, GeneralSourceError, validate_source
from math_tasks import to_house_math, validate_and_solve_task
from general_geometry import solve_figure_task, measure_elementary_svg
from no_carry_addition import needs_printed_task, states_entire_task
from printed_percentages import percentage_evidence
from printed_tasks import match_printed_task, matching_solution_choices, printed_solve, printed_table_row
from printed_elementary import guard_counting_input, place_intro, printed_intent, validate_counting_values
from printed_parts import answer_form, bind_parts, carries_data, chosen_solutions, comparison_blank, narrowed, printed_calculation, shows_task
from answer_kinds import TEACHER_CHECK, bind_decision

LETTERS = "אבגדהוזחטי"
LEVELS = {"a": "רמה א׳", "b": "רמה ב׳", "e": "מצוינות"}
MIDDLE_BRIDGE = '''import json
from pathlib import Path
LEVELS = json.loads((Path(__file__).parent / "levels.json").read_text(encoding="utf-8"))
def _recorded_figure(spec):
    if spec["kind"] == "coordinate_plane":
        from figkit_plus import plane, wide
        points = {p["name"]: (p["x"], p["y"]) for p in spec["points"]}
        builder = wide if spec.get("placement") == "wide" else plane
        return builder(tuple(spec["xr"]), tuple(spec["yr"]), points=[(xy, name) for name, xy in points.items()], solid=[(points[a], points[b]) for a, b in spec["segments"]])
    import shapekit as SK
    params = dict(spec["parameters"])
    if spec["shape"] == "triangle": params["variant"] = "sss"
    elif spec["shape"] == "trapezoid": params["variant"] = "scalene"
    family = "general." + spec["shape"]
    g, data = SK.shape(spec["shape"], rotate=spec["rotate"], names=spec["names"], marks=True, fam=family, **params)
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
        elif span["kind"] == "display":
            # worksheet-wire/5 only: one display span is exactly one island, printed by the house printer.
            if H:
                raise GeneralSourceError("SOURCE_WIRE_SCOPE", "Display spans are printed by the middle skill only")
            from school_math import display_island
            result.append(display_island(span))
        else:
            raise GeneralSourceError("SOURCE_RICH_TEXT", "Unsupported text span")
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


def _shape_call(fig):
    """The pinned constructor and its arguments for a validated shape.

    A shape whose given measures have only one reading is drawn as that
    shape: a parallelogram with equal adjacent sides is the rhombus with that
    side and angle, and a trapezoid whose leg leaves the base at offset 0 is
    the right trapezoid. Everything else is passed on unchanged.
    """
    shape, params = fig["shape"], dict(fig["parameters"])
    if shape == "parallelogram" and params.get("a") == params.get("b"):
        return "rhombus", {"a": params["a"], "angle": params["angle"]}
    if shape == "triangle":
        params["variant"] = "sss"
    elif shape == "trapezoid":
        if params.get("dx") == 0:
            params.pop("dx")
            params["variant"] = "right"
        else:
            params["variant"] = "scalene"
    return shape, params


def _figure(fig, elementary, index, work):
    """Invoke only explicit trusted skill constructors with validated fields."""
    kind = fig["kind"]
    if elementary:
        import svg_elementary_ext as SX
        if kind == "grid_shape":
            svg = SX.area_grid_shape(fig["cells"])
        elif kind == "solid":
            svg = SX.polyhedron_3d(kind="triangular_prism" if fig["shape"] == "prism" else fig["shape"], dims=tuple(fig["dimensions"]))
        else:
            raise ValueError("Unsupported elementary geometry figure")
    elif kind=="coordinate_plane":
        from figkit_plus import plane, wide
        points={p["name"]:(p["x"],p["y"]) for p in fig["points"]}
        # Coordinate object identity is measured from actual point sets by
        # figkit.figure_family. A Euclidean fam tag would incorrectly collapse
        # distinct coordinate graphs into one declared shape (G76 contract).
        builder=wide if fig.get("placement")=="wide" else plane
        draw=lambda xr, yr: builder(tuple(xr),tuple(yr),points=[(xy,name) for name,xy in points.items()],solid=[(points[a],points[b]) for a,b in fig["segments"]])
        try:
            svg=draw(fig["xr"], fig["yr"])
        except Exception as exc:  # noqa: BLE001 - only the skill's layout refusal is retried
            if type(exc).__name__ != "LayoutError":
                raise
            # A letter that falls on an axis number: the same points in a window
            # two units wider move the ticks. A second refusal stands.
            svg=draw(_wider(fig["xr"]), _wider(fig["yr"]))
    else:
        import shapekit as SK
        shape, params = _shape_call(fig)
        fam = "general." + shape
        g, data = SK.shape(shape, rotate=fig["rotate"], names=fig["names"], marks=True, fam=fam, **params)
        svg = SK.finish(g, fam)
    path = work / "figures" / f"q{index}.svg"
    path.write_text(svg, encoding="utf-8")
    dump(path.with_suffix(".json"), {"version": 1, "constructorInput": fig, "sha256": hashlib.sha256(svg.encode("utf-8")).hexdigest()})
    return svg, path.relative_to(work).as_posix()


def compile_source(lesson, validated, scope, skill_path, work, *, printed_answers=None, printed_fractions=False,
                   contract=None):
    """Write skill build inputs. A caller must still run every applicable gate.

    ``validated`` is revalidated rather than trusting deserialized evidence.
    Elementary unsupported prose/proof answers require a real Ledger proof and
    are refused before build inputs. Middle-school prose remains explicitly
    unverified; all unchanged proof/didactic gates must still run.
    ``contract`` is the trusted runner's flag (--contract), passed through to
    validate_source: a worksheet-wire/5 source compiles only with it.
    """
    checked = validate_source(lesson, validated["source"], scope, contract=contract)
    source, evidence = checked["source"], checked["evidence"]
    work = Path(work); skill = Path(skill_path)
    work.mkdir(parents=True, exist_ok=True)
    dump(work / "general-source.json", source)
    dump(work / "general-evidence.json", evidence)
    elementary = scope["topic"]["skillId"] == "elementary"
    v5 = source.get("contract") == V5_CONTRACT
    if elementary and v5:
        # validate_source accepted an elementary overlay. With the trusted skill path known here, the final check
        # also runs the source-side mirror of the pinned G62 clone gate on the exact content.json item strings.
        import division_kinds
        from structured_contract import overlay_for
        overlay = overlay_for(lesson["topicId"], lesson["level"])
        if not division_kinds.is_elementary(overlay):
            raise GeneralSourceError("SOURCE_WIRE_SCOPE", "This topic has no elementary worksheet-wire/5 overlay")
        questions = [q for section in source["sections"] for q in section["questions"]]
        if division_kinds.clone_hits(questions, skill_path=str(skill), grade_number=lesson["gradeNumber"],
                                     level=lesson["level"]):
            raise GeneralSourceError("SOURCE_STRUCTURE", "An item structure repeats beyond the pinned G62 limit")
    elif v5:
        # The trusted skill path is known here, so the final check also runs the D12 mirror (pinned f_atoms /
        # f_hit, no stated-given exemption) that validate_source cannot run without it.
        import leak_checks
        from structured_contract import overlay_for
        overlay = overlay_for(lesson["topicId"], lesson["level"])
        # A probability overlay has its own leak checks (its D12 mirror reads the question's table cells too).
        checker = leak_checks.question_leaks
        if overlay is not None and overlay.get("family") == "probability":
            import probability_kinds
            checker = probability_kinds.question_leaks
        for n, question in enumerate((q for section in source["sections"] for q in section["questions"]), 1):
            if checker(question, overlay, skill_path=str(skill)):
                raise GeneralSourceError("SOURCE_LEAK", f"Answer leak at q{n} (pinned D12 mirror)")
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
        if elementary and v5:
            _compile_elementary_v5(lesson, source, evidence, scope, skill, work)
        elif elementary:
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


def _elementary_item(lesson, question, item, computed, n, j, grade, H, ledger, *, intro_spans, printed_answers, printed_fractions):
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
            return prompt + ' <div class="ansline"></div>', html.escape(item["answer"]["text"])
        return prompt + ' <div class="open-work"></div>', html.escape(TEACHER_CHECK)
    if not figure_task and computed["question"].get("kind") == "decide":
        decision = bind_decision(seen, item, computed, number_grade)
        # A fresh calculation, not a model-provided answer or boolean.
        repeated = validate_and_solve_task(item["answer"]["task"])
        ledger.claim(f"{n}.{j}", "תוצאת המשימה המתמטית המודפסת בלבד", (repeated == computed, computed), method="sympy")
        ledger.claim(f"{n}.{j}.decision", "ההכרעה המודפסת היא הכרעת הטענה שבשאלה",
                     (repeated["result"]["holds"] is decision.holds, decision.proof), method="closed_form")
        return prompt + ' <div class="ansline"></div>', _decision_text(decision, grade, H)
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
    show = not bound and (shows_task(seen, item, computed) or needs_printed_task(lesson, n-1, j-1, item))
    task_text = _task_text(computed, grade, H, notation=notation) if show else ""
    # A fresh calculation, not a model-provided answer or boolean.
    repeated = solve_figure_task(question["figure"],item["answer"]["operation"],item["answer"].get("point")) if figure_task else validate_and_solve_task(item["answer"]["task"])
    ledger.claim(f"{n}.{j}", "תוצאת המשימה המתמטית המודפסת בלבד", (repeated == computed, computed), method="closed_form" if figure_task else "sympy")
    return prompt + " " + task_text + '<div class="ansline"></div>', answer


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
            if question is section["questions"][0] and not ((printed_answers is not None or printed_fractions) and len(source["sections"]) == 1):
                pieces.append('<h3 class="section-title">' + html.escape(section["title"]) + '</h3>')
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
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved.get(item_id)
                if computed is None and item["answer"]["kind"] not in ("label", "open"):
                    raise GeneralSourceError("UNVERIFIED_ANSWERS", "An elementary answer has no exact verifier", question=n, item=j)
                try:
                    body, answer = _elementary_item(lesson, question, item, computed, n, j, grade, H, ledger,
                                                    intro_spans=intro_spans, printed_answers=printed_answers,
                                                    printed_fractions=printed_fractions)
                except GeneralSourceError as error:
                    # A later stage replaces exactly this question.
                    raise error.at(n, j)
                pieces.append('<div class="sub">'+LETTERS[j-1]+'. '+body+'</div>')
                items.append(H.plain(body)); answers.append(answer)
                source_items.append({"id": item_id, "label": LETTERS[j-1], "text": H.plain(body), "answer": H.plain(answer), "task": computed["question"], "verificationId": f"{n}.{j}"}
                                    if computed else
                                    {"id": item_id, "label": LETTERS[j-1], "text": H.plain(body), "answer": H.plain(answer), "task": None,
                                     "verification": "unverified label; teacher review required" if item["answer"]["kind"] == "label"
                                     else "no key; the teacher checks this item"})
            q = {"n": str(n), "intro": H.plain(intro), "items": items, "answer": H.plain(H.keyed(answers)), "star": question["star"]}
            if figpath:
                q["fig"] = figpath
            qs.append((q, intro, ''.join(pieces), H.keyed(answers)))
            canon.append({"id": f"q{n}", "n": n, "section": section["title"], "conceptIds": section["conceptIds"], "intro": intro_spans, "table": question.get("table"), "figure": question.get("figure"), "items": source_items})
    cursor["question"] = None
    # content.json carries the printed star: G50 counts it in the HTML and the
    # pinned G61 proxy weighs it; both gates judge the same sheet.
    gate_questions = [q[0] for q in qs]
    ledger.save()
    meta = {"band": "elementary-ab" if ab else "elementary", "grade": grade, "level": {"a":"א", "b":"ב", "e":"מצוינות"}[lesson["level"]], "topic": source["title"], "topic_id": scope["topic"]["sourceTopicId"], "domain": scope["topic"]["domain"]}
    dump(work / "content.json", {"meta": meta, "questions": gate_questions})
    dump(work / "worksheet-source.json", {"version": 4, "meta": dict(meta, gradeNumber=lesson["gradeNumber"], levelCode={"a":"A", "b":"B", "e":"E"}[lesson["level"]], topicId=lesson["topicId"]), "questions": canon, "reviewRequired": True})
    template = (skill / "assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head = template.split("<body", 1)[0]
    # Keep long answer keys readable even when they continue across a page break.
    answer_layout = ("table.ans td{padding:8px}"
                     "table.ans tr:nth-last-child(-n+6):not(:last-child){break-after:avoid}")
    head = head.replace('</head>', '<style>'+answer_layout+'.answers span.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}.work-table{border-collapse:collapse;width:100%;margin:8px 0}.work-table td,.work-table th{border:1px solid #9cb5c8;padding:6px;text-align:center}.section-title{font-size:18px;color:#286ca1}.open-work{min-height:3.2cm;margin:4px 0 8px;border:1px dashed #9cb5c8;border-radius:6px}</style></head>', 1)
    body = ['<body class="'+('band-ab' if ab else 'band-gd' if lesson["gradeNumber"]<=4 else 'band-hv')+'">', '<div class="unit">'+html.escape(source["title"])+'</div><hr class="unit-rule">', '<div class="subtitle">'+LEVELS[lesson["level"]]+' · כיתה '+grade+'׳</div>', '<div class="details"><span>שם: ____________________</span><span>כיתה: ________</span><span>תאריך: __________</span></div>', '<p>'+rich_text(source["rule"], grade, H)+'</p>', '<ol class="questions">']
    for q, intro, rendered, answer in qs:
        body.append('<li'+(' class="starred"' if q["star"] else '')+'>'+('<span class="star"></span> ' if q["star"] else '')+intro+rendered+'</li>')
    body += ['</ol><div class="goodluck">'+('בְּהַצְלָחָה!' if ab else 'בהצלחה!')+'</div>', '<div class="answers"><h2>'+('תְּשׁוּבוֹת סוֹפִיּוֹת' if ab else 'תשובות סופיות')+'</h2><table class="ans">']
    for q, intro, rendered, answer in qs:
        body.append('<tr><td class="qn">'+H.ltr(q["n"]+'.')+'</td><td>'+answer+'</td></tr>')
    body.append('</table></div></body></html>')
    (work / "sheet.html").write_text(head+'\n'.join(body), encoding="utf-8")


V5_ELEMENTARY_STYLE = (
    '<style>.answers span.ltr{direction:ltr;unicode-bidi:isolate;display:inline-block;white-space:nowrap}'
    'table.drill.v5-drill td{vertical-align:top;text-align:right;width:33%;height:3.2cm}'
    'table.v5-story{width:100%;border-collapse:separate;border-spacing:0;margin:4px 0 2px}'
    'table.v5-story td{vertical-align:top;padding:0}td.v5-asks{width:72%}'
    'td.v5-work{width:28%;height:3.2cm;border:1px dashed #9cb5c8;border-radius:6px}'
    '.v5-rule{margin:6px 0 10px}</style></head>')


def _compile_elementary_v5(lesson, source, evidence, scope, skill, work):
    """worksheet-wire/5 elementary build inputs: sheet.html through the pinned elementary template, plus
    content.json, worksheet-source.json and verified.json for the pinned gates. No Word file is written.

    Every number or expression is exactly one LTR atom (the pinned ws_html H.ltr convention), printed with the
    grade's sign table (school_math.to_elementary: Latin x, a spaced ':', U+2212); Hebrew is escaped prose between
    atoms. A drill item prints "347 : 5 = ___" (blank inside the atom); a story prints its code-written template and
    asks. The answer key prints "(n)" markers and the house form "69 שארית 2" (two atoms around the Hebrew word,
    the order pinned G66 requires) or the plain quotient. Each printed answer is claimed in the Ledger against the
    pinned div_qr helper, independent of the kernel. The content.json item strings must equal what the G62 mirror
    read (division_kinds.content_item_text), else SOURCE_STRUCTURE. No vertical long-division drawing (no figure)."""
    import ws_html as H
    from content_truth import Ledger, div_qr
    import division_kinds
    from school_math import parse, to_elementary
    from structured_contract import overlay_for
    overlay = overlay_for(lesson["topicId"], lesson["level"])
    grade = LETTERS[lesson["gradeNumber"] - 1]
    ab = lesson["gradeNumber"] <= 2
    level_letter = {"a": "א", "b": "ב", "e": "מצוינות"}[lesson["level"]]
    solved = {row["itemId"]: row["computed"] for row in evidence["computations"]}
    ledger = Ledger(str(work / "verified.json"))

    def atom(text):
        return H.ltr(html.escape(text))

    def spans_html(spans):
        out = []
        for span in spans:
            if span["kind"] == "text":
                out.append(html.escape(span["text"]))
            else:
                out.append(atom(to_elementary(parse(span["notation"], letters=(), allow_relation=True), grade)))
        return "".join(out)

    qs, canon, n = [], [], 0
    for section in source["sections"]:
        for question in section["questions"]:
            n += 1
            kind = question["items"][0]["answer"]["key"]["binding"]["kind"]
            intro = spans_html(question["intro"])
            pieces, items, answers, source_items, cells = [], [], [], [], []
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"
                computed = solved[item_id]
                if kind == division_kinds.DRILL:
                    body = H.ltr(html.escape(division_kinds.drill_atom(item, grade)) + " = " + H.blank("2.6cm"))
                    cells.append('<td><b>' + LETTERS[j - 1] + '.</b> ' + body + '</td>')
                else:
                    # The ask and its answer blank on one line; the story's long division goes in the work area.
                    body = spans_html(item["prompt"]) + " " + H.blank("1.6cm")
                    pieces.append('<div class="sub">' + LETTERS[j - 1] + '. ' + body + '</div>')
                plain = H.plain(body)
                if plain != division_kinds.content_item_text(item, grade):
                    raise GeneralSourceError("SOURCE_STRUCTURE", "A printed item differs from its mirrored text")
                dividend, divisor = division_kinds.task_pair(item["answer"]["task"])
                quotient, remainder = div_qr(dividend, divisor)
                kernel = computed["result"]
                agrees = (quotient, remainder) == (kernel["quotient"]["numerator"], kernel["remainder"]["numerator"])
                ledger.claim(f"{n}.{j}", division_kinds.LEDGER_STATEMENT,
                             (agrees, {"dividend": dividend, "divisor": divisor, "quotient": quotient,
                                       "remainder": remainder}), method="closed_form")
                parts = division_kinds.key_parts(item, grade, overlay)
                answer = (html.escape(parts[0][1]) if len(parts) == 1 else
                          "".join(atom(value) if part == "atom" else html.escape(value) for part, value in parts))
                answers.append(answer)
                items.append(plain)
                source_items.append({"id": item_id, "label": LETTERS[j - 1], "text": plain,
                                     "answer": "".join(value for _, value in parts), "task": computed["question"],
                                     "verificationId": f"{n}.{j}"})
            if cells:
                pieces = ['<table class="drill v5-drill"><tr>' + "".join(cells) + '</tr></table>']
            else:
                # An empty work area beside the asks (a dashed frame, no drawing: not a geometry page).
                pieces = ['<table class="v5-story"><tr><td class="v5-asks">' + "".join(pieces)
                          + '</td><td class="v5-work"></td></tr></table>']
            q = {"n": str(n), "intro": H.plain(intro), "items": items, "answer": H.plain(H.keyed(answers)),
                 "star": question["star"]}
            qs.append((q, intro, "".join(pieces), H.keyed(answers)))
            canon.append({"id": f"q{n}", "n": n, "section": section["title"], "conceptIds": section["conceptIds"],
                          "intro": question["intro"], "items": source_items})
    ledger.save()
    meta = {"band": "elementary-ab" if ab else "elementary", "grade": grade, "level": level_letter,
            "topic": source["title"], "topic_id": scope["topic"]["sourceTopicId"], "domain": scope["topic"]["domain"]}
    dump(work / "content.json", {"meta": meta, "questions": [q[0] for q in qs]})
    source_meta = {**meta, "gradeNumber": lesson["gradeNumber"], "levelCode": {"a": "A", "b": "B", "e": "E"}[lesson["level"]],
                   "topicId": lesson["topicId"], "contract": V5_CONTRACT}
    dump(work / "worksheet-source.json", {"version": 4, "meta": source_meta, "questions": canon, "reviewRequired": True})
    template = (skill / "assets/worksheet_template_elementary.html").read_text(encoding="utf-8")
    head = template.split("<body", 1)[0].replace('</head>', V5_ELEMENTARY_STYLE, 1)
    body = ['<body class="' + ('band-ab' if ab else 'band-gd' if lesson["gradeNumber"] <= 4 else 'band-hv') + '">',
            '<div class="unit">' + html.escape(source["title"]) + '</div><hr class="unit-rule">',
            '<div class="subtitle">' + LEVELS[lesson["level"]] + ' · כיתה ' + grade + '׳</div>',
            '<div class="details"><span>שם: ____________________</span><span>כיתה: ________</span>'
            '<span>תאריך: __________</span></div>',
            '<div class="reminder v5-rule">' + spans_html(source["rule"]) + '</div>', '<ol class="questions">']
    for index, (q, intro, rendered, _) in enumerate(qs):
        # Four questions to a page (as the closed elementary adapter balances its pages): no question page is
        # near-empty for the pinned page-fill check, and no page overflows.
        page_break = ' style="break-before:page"' if index and index % 4 == 0 else ''
        body.append('<li' + (' class="starred"' if q["star"] else '') + page_break + '>'
                    + ('<span class="star"></span> ' if q["star"] else '') + intro + rendered + '</li>')
    body += ['</ol><div class="goodluck">' + ('בְּהַצְלָחָה!' if ab else 'בהצלחה!') + '</div>',
             '<div class="answers"><h2>' + ('תְּשׁוּבוֹת סוֹפִיּוֹת' if ab else 'תשובות סופיות') + '</h2><table class="ans">']
    for q, _, _, answer in qs:
        # worksheet-wire/5 only: the key column prints the house marker "(n)" as one LTR atom (D10).
        body.append('<tr><td class="qn">' + H.ltr("(" + q["n"] + ")") + '</td><td>' + answer + '</td></tr>')
    body.append('</table></div></body></html>')
    (work / "sheet.html").write_text(head + '\n'.join(body), encoding="utf-8")


def _compile_middle(lesson, source, evidence, scope, skill, work, *, cursor=None):
    cursor = {} if cursor is None else cursor  # compile_source reads the question being compiled
    v5 = source.get("contract") == V5_CONTRACT
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
            bank = None if v5 else matching_solution_choices(question, solutions, lesson["gradeNumber"])
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
                try:
                    q["fig"], path = _figure(question["figure"], False, n, work)
                except Exception as exc:  # noqa: BLE001 - only the pinned constructors' refusals are named
                    if not figure_refused(exc):
                        raise
                    # A figure the pinned constructors refuse names its question, which a later stage replaces.
                    raise GeneralSourceError("SOURCE_FIGURE", "The pinned skill cannot draw this figure").at(n) from None
                q["_generalFigure"] = question["figure"]
            if "table" in question:
                table = question["table"]
                q["table"] = {"head": [rich_text(c, lesson["gradeNumber"]) for c in table["head"]], "rows": [[rich_text(c, lesson["gradeNumber"]) for c in row] for row in table["rows"]], "hcol": True}
            for j, item in enumerate(question["items"], 1):
                item_id = f"q{n}-i{j}"; computed = solved.get(item_id)
                prompt = rich_text(item["prompt"], lesson["gradeNumber"])
                if v5:
                    # No legacy prose binders: the display is the task (item_kinds.verify_item proved it).
                    printed = bound = label = sign = calculation = decision = None
                else:
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
                if v5:
                    # printTask is false: the prompt alone prints; the key comes from the house key printer.
                    from school_math import key_island
                    body, answer = prompt, key_island(item["answer"]["key"])
                else:
                    show_task = (computed and not printed and not _prints_calculation(item, computed, lesson["gradeNumber"])
                                 and shows_task(question, item, computed))
                    body = prompt+(" "+_task_text(computed, lesson["gradeNumber"], notation=item["answer"].get("notation")) if show_task else "")
                    # The key prints only the solutions that the item's words ask for.
                    keyed = narrowed(computed, chosen_solutions(question, item, computed)) if computed and not decision else computed
                    answer = _answer_text(keyed, item["answer"]["unit"], lesson["gradeNumber"], original_variable=label, notation=item["answer"].get("notation"),
                                          forms=answer_form(question, item, computed), sides=sign["sides"] if sign else None) if computed and not decision else rich_text(item["answer"]["text"], lesson["gradeNumber"]) if not computed else _decision_text(decision, lesson["gradeNumber"])
                if bound and bound.label:
                    answer = bound.label + " (" + answer + ")"
                space=280 if question.get("drawingFromWords") and j==len(question["items"]) else 46 if question["star"] else 32
                # The item's stated givens. Without a printed task, the numbers of a
                # shared story live in the intro, and the pinned checks must see them there.
                given = [body] if v5 or show_task or not computed or not carries_data(question["intro"]) else [body, intro]
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
    if v5:
        from structured_contract import GRADE_LINE
        level["grade"] = GRADE_LINE[lesson["gradeNumber"]]
    if words_share:
        # JSON object keys are strings; trusted bridge restores integer ids
        # expected by the pinned skill. Model text is never Python source.
        level["words_share"]={str(k):v for k,v in words_share.items()}
    dump(work / "levels.json", [level])
    meta = {"gradeNumber":lesson["gradeNumber"], "levelCode":lesson["level"], "topicId":lesson["topicId"]}
    if v5:
        meta["contract"] = V5_CONTRACT
    dump(work / "worksheet-source.json", {"version":4, "meta":meta, "questions":canon, "reviewRequired":True})
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
    if args.contract is not None:
        result = compile_source(lesson, validate_source(lesson, payload, scope, contract=args.contract), scope,
                                args.skill, wd, contract=args.contract)
    elif payload.get("version") == fraction_lesson.VERSION:
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
    # Trusted runner flag only (runner.render_job(contract=...)): model-output.json's own root marker never
    # selects worksheet-wire/5; without the flag such a payload stays SOURCE_SHAPE, as before v5.
    ap.add_argument("--contract", choices=(V5_CONTRACT,))
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
