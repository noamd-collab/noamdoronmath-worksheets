"""Bind exact tasks to complete formulas that the student actually sees."""

from dataclasses import dataclass
import re
import unicodedata

from compact_authoring import display_parts
from general_source import GeneralSourceError
from math_tasks import number, validate_and_solve_task
from numeric_literals import display_literal, literal_value


@dataclass(frozen=True)
class Binding:
    proof: dict
    label: str = ""


OP_NAMES = {
    "add": "חיבור", "subtract": "חיסור", "multiply": "כפל", "divide": "חילוק",
    "power": "העלאה בחזקה", "sqrt": "הוצאת שורש",
}


def _reject():
    raise GeneralSourceError("PRINTED_TASK_MISMATCH", "The exact answer disagrees with the printed task")


def _tree(part):
    if isinstance(part, str):
        literal = display_literal(part)
        if literal is None:
            return None
        rational = literal_value(literal)
        return number(rational.numerator, rational.denominator)
    tree, names = part[:2]
    if names and set(names.values()) != {"___"}:
        return None
    return tree


def _first_step(expr):
    if expr["type"] != "operation":
        return []
    if all(arg["type"] == "number" for arg in expr["args"]):
        return [expr]
    return [step for arg in expr["args"] for step in _first_step(arg)]


def match_printed_task(item, solved, grade):
    """Check a printed fill-in equality or unique next operation, across the curriculum."""
    if not solved or solved["question"]["kind"] != "evaluate":
        return None
    spans = item["prompt"]
    math = [s for s in spans if s["kind"] != "text"]
    if len(math) != 1:
        return None
    span = math[0]
    if span["kind"] == "math":
        parts = [span["expression"]]
    elif span["kind"] == "formula":
        parts = [(_tree(p) or p) for p in display_parts(span["notation"], grade)]
    else:
        return None

    words = " ".join(s["text"] for s in spans if s["kind"] == "text")
    words = "".join(c for c in words if not unicodedata.combining(c)).strip()
    first = re.fullmatch(r"(?:איזו|איזה) פעולה (?:מבצעים|יש לבצע) (?:ראשונה|תחילה)[\s:?]*", words)
    if first and len(parts) == 1 and isinstance(parts[0], dict):
        steps = _first_step(parts[0])
        if len(steps) != 1 or steps[0] != solved["question"]["expression"] or item["answer"]["unit"]:
            _reject()
        labels = OP_NAMES if grade > 2 else {
            "add": "חִבּוּר", "subtract": "חִסּוּר", "multiply": "כֶּפֶל", "divide": "חִלּוּק"}
        return Binding({"rule": "first_operation", "step": steps[0]}, labels[steps[0]["op"]])
    if (re.fullmatch(r"(?:השלימו|המספר החסר הוא(?: ___)?|מצאו את המספר החסר)[\s:?.]*", words)
            and span["kind"] == "formula" and span["notation"].count("___") == 1 and len(parts) == 3
            and parts[1] == "=" and isinstance(parts[0], dict) and isinstance(parts[2], dict)
            and not item["answer"]["unit"]):
        eq = {"kind": "solve", "variable": "x", "lhs": parts[0], "rhs": parts[2]}
        result = validate_and_solve_task(eq)["result"]
        if result["classification"] != "finite" or result["values"] != [solved["result"]["value"]]:
            _reject()
        return Binding({"rule": "unique_missing_number", "equation": eq,
                        "value": result["values"][0]})
    return None


def _named_equation(notation, grade):
    """Match one pupil-facing equality in one Latin unknown; keep its original name."""
    if not isinstance(notation, str) or len(notation) > 220:
        return None
    names = set(re.findall(r"[A-Za-z_]+", notation)) - {"sqrt", "frac"}
    if len(names) != 1:
        return None
    name = next(iter(names))
    if not re.fullmatch("[a-z]", name):
        return None
    from compact_authoring import expression, MATH_TRANSLATION
    compact = re.sub(r"(?<![A-Za-z_])" + name + r"(?![A-Za-z_])", "x", notation)
    sides = compact.translate(MATH_TRANSLATION).split("=")
    if len(sides) != 2:
        return None
    return name, expression(sides[0], grade), expression(sides[1], grade)


SOLVE_DIRECTIVE = re.compile(
    r"(?:פתרו(?:\s+את\s+המשוואה)?\s*[:]?\s*@\s*[.?!]?|"
    r"פתרון המשוואה\s*@\s*הוא\s*[:?.]?|@\s*[.?]?)"
)


def printed_solve(prompt, task, grade):
    if (grade < 7 or not isinstance(task, dict) or task.get("kind") != "solve"
            or not isinstance(prompt, list)):
        return None
    maths = [s for s in prompt if isinstance(s, dict) and s.get("kind") != "text"]
    if len(maths) != 1 or maths[0].get("kind") != "formula":
        return None
    printed = _named_equation(maths[0].get("notation"), grade)
    if not printed:
        return None
    if any(not isinstance(s, dict) or s.get("kind") == "text" and not isinstance(s.get("text"), str) for s in prompt):
        return None
    wrapper = "".join(s["text"] if s["kind"] == "text" else "@" for s in prompt).strip()
    def mismatch():
        if SOLVE_DIRECTIVE.fullmatch(wrapper):
            _reject()
        return None
    label, left, right = printed
    if isinstance(task.get("lhs"), str) and isinstance(task.get("rhs"), str):
        if set(task) != {"kind", "lhs", "rhs", "variable"} or task["variable"] not in ("x", "y", "a", "b"):
            return None
        authored = _named_equation(task["lhs"] + "=" + task["rhs"], grade)
        # The wire contract can use canonical x for a differently named
        # printed unknown. Both original sides must still match exactly.
        if not authored or authored[1:] != printed[1:] or (
                authored[0] != label and not (authored[0] == task["variable"] == "x")):
            return mismatch()
        # Normalize only variable spelling. Both original sides must agree with the print.
        if task["variable"] == label:
            return None
        return {"kind": "solve", "lhs": left, "rhs": right, "variable": "x"}
    variable = task.get("variable")
    if variable not in {"x", "y", "a", "b"} or variable not in {"x", label}:
        return mismatch()

    def native_symbol(node):
        if not isinstance(node, dict):
            return node
        if node.get("type") == "symbol":
            return {"type": "symbol", "name": variable} if node["name"] == "x" else node
        if node.get("type") == "operation":
            return {**node, "args": [native_symbol(a) for a in node["args"]]}
        return node

    if (native_symbol(left), native_symbol(right)) == (task.get("lhs"), task.get("rhs")):
        return label
    return mismatch()


MATCHING_BANK = re.compile(r"התאימו לכל משוואה את הפתרון הנכון מתוך הרשימה\s*:\s*")


def matching_solution_choices(question, solved, grade):
    """Prove that the displayed numbers form a choice bank for these printed equations."""
    intro = question["intro"]
    if not intro or intro[0]["kind"] != "text" or not MATCHING_BANK.fullmatch(intro[0]["text"]):
        return None
    if any(k in question for k in ("table", "figure", "drawingFromWords")):
        _reject()
    parts = list(intro[1:])
    if parts and parts[-1]["kind"] == "text" and parts[-1]["text"].strip() in (".", ""):
        parts.pop()
    if not 3 <= len(parts) <= 15 or len(parts) % 2 != 1:
        _reject()
    options = []
    for index, part in enumerate(parts):
        if index % 2:
            if part["kind"] != "text" or part["text"].strip() != ",":
                _reject()
            continue
        if part["kind"] == "math" and part["expression"]["type"] == "number":
            value = part["expression"]
        elif (part["kind"] == "formula" and (spelling := display_literal(part["notation"]))
              and not spelling.endswith("%")):
            rational = literal_value(spelling)
            value = number(rational.numerator, rational.denominator)
        else:
            _reject()
        if value in options:
            _reject()
        options.append(value)
    if len(question["items"]) != len(solved):
        _reject()
    solutions = []
    for item, actual in zip(question["items"], solved):
        prompt = item["prompt"]
        wrapper = "".join(p["text"] if p["kind"] == "text" else "@" for p in prompt).strip()
        if not SOLVE_DIRECTIVE.fullmatch(wrapper):
            _reject()
        if (item["answer"].get("kind") != "computed" or item["answer"].get("unit") or not actual
                or not printed_solve(prompt, actual["question"], grade)
                or validate_and_solve_task(item["answer"]["task"]) != actual):
            _reject()
        left, right = actual["question"]["lhs"], actual["question"]["rhs"]
        if {left["type"], right["type"]} == {"number", "symbol"}:
            _reject()
        result = actual["result"]
        values = result.get("values", [])
        if result.get("classification") != "finite" or len(values) != 1 or values[0] not in options:
            _reject()
        solutions.append(values[0])
    if len(solutions) < 2 or all(v == solutions[0] for v in solutions):
        _reject()
    reused = any(solutions.count(v) > 1 for v in solutions)
    return parts[::2], reused
