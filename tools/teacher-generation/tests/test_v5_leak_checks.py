"""v5 leak checks and the D12 mirror (V5-DESIGN.md sections 3, 4, 6.1).

leak_checks calls five school_math functions: parse, unparse, to_kernel,
display_island and key_island. When E1's school_math is importable the tests
use it. Until it lands, they use the stand-in below, written from section 2.4
(grammar, CST), 2.5 (kernel conversion) and 2.8 (house printing) for the
stage-2 shapes; the stand-in is visible to leak_checks only while this module
imports it, and the printed strings are asserted against hand-written house
strings, so the same assertions check E1's printer once it exists.

The D12 tests need the pinned middle skill (same guard as the existing tests).
"""
from __future__ import annotations

import hashlib
import itertools
import json
import os
import re
import shutil
import sys
import tempfile
import types
import unittest
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

APP = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(APP))
from math_tasks import number, operation  # noqa: E402

MIDDLE = Path(os.environ.get("MIDDLE_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet")))
LOCK = json.loads((APP / "skill-lock.json").read_text(encoding="utf-8"))["skills"]["middle"]["files"]


def _pinned_available():
    path = MIDDLE / "check_didactic.py"
    return path.is_file() and hashlib.sha256(path.read_bytes()).hexdigest() == LOCK["check_didactic.py"]


PINNED = _pinned_available()


def make_standin():
    """parse / unparse / to_kernel / display_island / key_island of school_math for the stage-2 shapes."""

    @dataclass(frozen=True)
    class Num:
        text: str

    @dataclass(frozen=True)
    class Var:
        name: str

    @dataclass(frozen=True)
    class Neg:
        operand: object

    @dataclass(frozen=True)
    class Group:
        inner: object

    @dataclass(frozen=True)
    class Sum:
        first: object
        rest: tuple

    @dataclass(frozen=True)
    class Product:
        first: object
        rest: tuple

    @dataclass(frozen=True)
    class Relation:
        left: object
        op: str
        right: object

    class SchoolMathError(ValueError):
        def __init__(self, code, message=""):
            super().__init__(code)
            self.code = code

    def parse(text, *, letters, allow_relation=False, max_length=120):
        text = str(text).replace("\u2212", "-")
        if len(text) > max_length:
            raise SchoolMathError("MATH_LENGTH")
        tokens = re.findall(r"\d+(?:\.\d+)?%?|[A-Za-z]|[-+=()]|\S", text)
        state = {"at": 0}

        def peek():
            return tokens[state["at"]] if state["at"] < len(tokens) else None

        def take():
            token = peek()
            state["at"] += 1
            return token

        def atom():
            token = take()
            if token is None:
                raise SchoolMathError("MATH_PARSE")
            if token[0].isdigit():
                return Num(token)
            if re.fullmatch(r"[a-z]", token):
                if token not in letters:
                    raise SchoolMathError("MATH_SYMBOL_UNDECLARED")
                return Var(token)
            if token == "(":
                inner = expr()
                if take() != ")":
                    raise SchoolMathError("MATH_PARSE")
                return Group(inner)
            raise SchoolMathError("MATH_PARSE")

        def term():
            first, rest = atom(), []
            while peek() is not None and (re.fullmatch(r"[a-z]", peek()) or peek() == "("):
                rest.append(("", atom()))
            return Product(first, tuple(rest)) if rest else first

        def expr():
            negative = peek() == "-"
            if negative:
                take()
            first = term()
            first, rest = (Neg(first) if negative else first), []
            while peek() in ("+", "-"):
                rest.append((take(), term()))
            return Sum(first, tuple(rest)) if rest else first

        node = expr()
        if allow_relation and peek() == "=":
            take()
            node = Relation(node, "=", expr())
        if peek() is not None:
            raise SchoolMathError("MATH_PARSE")
        return node

    def unparse(node):
        kind = type(node).__name__
        if kind == "Num":
            return node.text
        if kind == "Var":
            return node.name
        if kind == "Neg":
            return "-" + unparse(node.operand)
        if kind == "Group":
            return "(" + unparse(node.inner) + ")"
        if kind in ("Sum", "Product"):
            return unparse(node.first) + "".join(op + unparse(piece) for op, piece in node.rest)
        return unparse(node.left) + node.op + unparse(node.right)

    def to_kernel(node, mapping=None):
        kind = type(node).__name__
        if kind == "Num":
            value = Fraction(node.text)
            return number(value.numerator, value.denominator)
        if kind == "Var":
            return {"type": "symbol", "name": (mapping or {}).get(node.name, node.name)}
        if kind == "Neg":
            if type(node.operand).__name__ == "Num":
                value = -Fraction(node.operand.text)
                return number(value.numerator, value.denominator)
            return operation("multiply", number(-1), to_kernel(node.operand, mapping))
        if kind == "Group":
            return to_kernel(node.inner, mapping)
        if kind in ("Sum", "Product"):
            out = to_kernel(node.first, mapping)
            for op, piece in node.rest:
                name = {"+": "add", "-": "subtract", "": "multiply", "*": "multiply", "/": "divide", ":": "divide"}[op]
                out = operation(name, out, to_kernel(piece, mapping))
            return out
        raise SchoolMathError("MATH_PARSE")

    def to_house(node):
        kind = type(node).__name__
        if kind == "Num":
            return node.text
        if kind == "Var":
            return node.name
        if kind == "Neg":
            return "\u2212" + to_house(node.operand)
        if kind == "Group":
            return "(" + to_house(node.inner) + ")"
        if kind == "Sum":
            return to_house(node.first) + "".join((" + " if op == "+" else " \u2212 ") + to_house(piece)
                                                  for op, piece in node.rest)
        if kind == "Product":
            return "".join([to_house(node.first)] + [to_house(piece) for _, piece in node.rest])
        return to_house(node.left) + " = " + to_house(node.right)

    def display_island(span):
        return "$" + to_house(parse(span["notation"], letters=span["symbols"], allow_relation=True)) + "$"

    def key_island(key):
        return "$" + to_house(parse(key["notation"], letters=key["symbols"])) + "$"

    module = types.ModuleType("school_math")
    module.__file__ = "<test stand-in for school_math>"
    for value in (Num, Var, Neg, Group, Sum, Product, Relation, SchoolMathError, parse, unparse, to_kernel,
                  to_house, display_island, key_island):
        setattr(module, value.__name__, value)
    return module


try:
    import school_math as SM  # noqa: E402
    STANDIN = False
except ImportError:
    SM, STANDIN = make_standin(), True

if STANDIN:
    sys.modules["school_math"] = SM
    try:
        import leak_checks  # noqa: E402
    finally:
        sys.modules.pop("school_math", None)
        sys.modules.pop("leak_checks", None)
else:
    import leak_checks  # noqa: E402

# Read from the module object bound above: a fresh `from leak_checks import` would re-import it.
DUPLICATE_ITEM, DUPLICATE_TASK, EXAMPLE_COPY = leak_checks.DUPLICATE_ITEM, leak_checks.DUPLICATE_TASK, leak_checks.EXAMPLE_COPY
LEAK_LINKED, LEAK_OWN, LEAK_PINNED_VALUE = leak_checks.LEAK_LINKED, leak_checks.LEAK_OWN, leak_checks.LEAK_PINNED_VALUE
LEAK_RULE_FACT, LEAK_SHEET_INVERSE = leak_checks.LEAK_RULE_FACT, leak_checks.LEAK_SHEET_INVERSE

# ---- the section 2.7 overlay pieces the checks read, and IR builders (section 2.6 layouts) ----------
LETTERS = ("x", "y", "a", "b")
RULE = [{"kind": "text", "text": "כדי לכנס איברים דומים מחברים או מחסרים את המספרים שלפני המשתנה, למשל: "},
        {"kind": "display", "notation": "3x+5x=8x", "symbols": ["x"]}, {"kind": "text", "text": "."}]
OVERLAY = {"topicId": "g7:algebraic_expressions", "letters": LETTERS, "ruleFacts": (("3x+5x", "8x"),), "rule": RULE}
VERBS = {"write_from_words": "כתבו ביטוי אלגברי מתאים לכל תיאור:", "substitute": "חשבו את ערך הביטוי:",
         "collect_like_terms": "כנסו איברים דומים:",
         "find_error_collect": "בכל סעיף תלמיד כינס איברים דומים וטעה. רשמו את התוצאה הנכונה."}


def symbols(notation):
    return list(dict.fromkeys(c for c in notation if c in LETTERS))


def D(notation):
    return {"kind": "display", "notation": notation, "symbols": symbols(notation)}


def T(text):
    return {"kind": "text", "text": text}


def kernel(notation):
    return SM.to_kernel(SM.parse(notation, letters=LETTERS))


def item(prompt, task, key, form, binding):
    return {"prompt": prompt, "answer": {"kind": "computed", "task": task, "unit": "", "printTask": False,
                                         "key": {"form": form, "notation": key, "symbols": symbols(key),
                                                 "binding": binding}}}


def collect(expr, key):
    return item([D(expr)], {"kind": "simplify", "expression": kernel(expr)}, key, "expression",
                {"kind": "collect_like_terms"})


def substitute(expr, letter, value, key):
    return item([D(expr), T(" עבור "), D(f"{letter}={value}")],
                {"kind": "substitute", "expression": kernel(expr), "values": {letter: number(value)}},
                key, "integer", {"kind": "substitute"})


def words(parts, expr, template):
    """parts alternate text and display notations, as the section 2.7 templates print them."""
    prompt = [T(part) if index % 2 == 0 else D(part) for index, part in enumerate(parts)]
    return item(prompt, {"kind": "simplify", "expression": kernel(expr)}, expr, "expression",
                {"kind": "write_from_words", "template": template})


def find_error(expr, wrong, model, key):
    return item([T("כינוס הביטוי "), D(expr), T(" נתן "), D(wrong)], {"kind": "simplify", "expression": kernel(expr)},
                key, "expression", {"kind": "find_error_collect", "model": model})


def question(kind, items):
    return {"intro": [T(VERBS[kind])], "star": kind == "find_error_collect", "items": items}


def Q1():
    return question("write_from_words", [words(["מספר הגדול פי ", "4", " מ־", "x"], "4x", "W_TIMES"),
                                         words(["הסכום של ", "a", " ו־", "b"], "a+b", "W_SUM"),
                                         words(["פי ", "3", " מ־", "y", " ועוד ", "x"], "3y+x", "W_TIMES_PLUS")])


def Q7():
    return question("substitute", [substitute("4y-y", "y", -2, "-6"), substitute("2a+5", "a", 3, "11"),
                                   substitute("5b-2b", "b", 4, "12")])


def Q13():
    return question("collect_like_terms", [collect("3x+5+2x-1", "5x+4"), collect("-4y+9+6y-2", "2y+7"),
                                           collect("8a-3+a-5", "9a-8")])


def Q18():
    return question("find_error_collect", [find_error("4a+3+a+2", "10a", "M1", "5a+5"),
                                           find_error("6x+7-1-2x", "4x+8", "M2", "4x+6"),
                                           find_error("5b+2a+b", "5b+2a", "M3", "6b+2a")])


def leaks(q, skill_path=None):
    return leak_checks.question_leaks(q, OVERLAY, skill_path=skill_path)


class PrinterContractTests(unittest.TestCase):
    """The strings the mirror reads are the adapter's: section 2.8 house islands."""

    def test_the_rendered_prompts_and_keys_are_house_islands(self):
        render = leak_checks._render
        self.assertEqual(render(Q7()["items"][0]["prompt"]), "$4y − y$ עבור $y = −2$")
        self.assertEqual(render(Q13()["items"][0]["prompt"]), "$3x + 5 + 2x − 1$")
        self.assertEqual(render(Q13()["items"][1]["prompt"]), "$−4y + 9 + 6y − 2$")
        self.assertEqual(render(Q1()["items"][0]["prompt"]), "מספר הגדול פי $4$ מ־$x$")
        self.assertEqual(render(Q18()["items"][1]["prompt"]), "כינוס הביטוי $6x + 7 − 1 − 2x$ נתן $4x + 8$")
        self.assertEqual(render([D("x-(-2)")]), "$x − (−2)$")
        self.assertEqual(SM.key_island(Q13()["items"][0]["answer"]["key"]), "$5x + 4$")
        self.assertEqual(SM.key_island(Q7()["items"][0]["answer"]["key"]), "$−6$")
        self.assertEqual(SM.key_island(Q13()["items"][2]["answer"]["key"]), "$9a − 8$")
        with self.assertRaises(ValueError):
            render([{"kind": "math", "expression": kernel("x")}])

    def test_values_are_exact_polynomials_of_the_kernel(self):
        poly = leak_checks._poly
        self.assertEqual(poly(kernel("3x+5+2x-1")), {("x",): 5, (): 4})
        self.assertEqual(poly(kernel("x-(-2)")), {("x",): 1, (): 2})
        self.assertEqual(poly(kernel("3x-3x")), {})
        self.assertEqual(poly(kernel("2xy+yx")), {("x", "y"): 3})
        self.assertEqual(poly(operation("power", kernel("x+1"), number(2))), {("x", "x"): 1, ("x",): 2, (): 1})
        self.assertEqual(poly(operation("divide", kernel("6x"), number(4))), {("x",): Fraction(3, 2)})
        for bad in (operation("divide", number(1), kernel("x")), operation("sqrt", number(4)),
                    operation("power", kernel("x"), number(-1)), {"type": "unknown"}):
            with self.assertRaises(ValueError):
                poly(bad)


class QuestionLeakTests(unittest.TestCase):
    def test_the_section_2_1_questions_are_clean(self):
        for build in (Q1, Q7, Q13, Q18):
            self.assertEqual(leaks(build()), [], build.__name__)

    def test_duplicate_item(self):
        q = question("collect_like_terms", [collect("3x+5+2x-1", "5x+4"), collect("-4y+9+6y-2", "2y+7"),
                                            collect("3x+5+2x-1", "5x+4")])
        self.assertEqual(leaks(q), [(3, DUPLICATE_ITEM)])
        # The canonical task is the display's expression: other values do not make it another task.
        q = question("substitute", [substitute("4y-y", "y", -2, "-6"), substitute("2a+5", "a", 3, "11"),
                                    substitute("4y-y", "y", 3, "9")])
        self.assertEqual(leaks(q), [(3, DUPLICATE_ITEM)])
        # One kernel task written two ways is one task.
        q = question("collect_like_terms", [collect("-3+x+2x", "-3+3x"), collect("(-3)+x+2x", "-3+3x"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertIn((2, DUPLICATE_ITEM), leaks(q))
        # Equal keys from different tasks are no duplicate.
        q = question("collect_like_terms", [collect("3x+5+2x-1", "5x+4"), collect("2x+5+3x-1", "5x+4"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [])

    def test_leak_own(self):
        # The key equals the rule fact's right side.
        q = question("collect_like_terms", [collect("6x+2x", "8x"), collect("-4y+9+6y-2", "2y+7"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [(1, LEAK_OWN)])
        # A find_error wrong result equal to the correct key.
        q = question("find_error_collect", [find_error("4a+3+a+2", "5a+5", "M1", "5a+5"),
                                            find_error("6x+7-1-2x", "4x+8", "M2", "4x+6"),
                                            find_error("5b+2a+b", "5b+2a", "M3", "6b+2a")])
        self.assertEqual(leaks(q), [(1, LEAK_OWN)])
        # Operands are exempt: a template's numbers and letters, a substituted value.
        q = question("substitute", [substitute("3y-2y", "y", -2, "-2"), substitute("2a+5", "a", 3, "11"),
                                    substitute("5b-2b", "b", 4, "12")])
        self.assertEqual(leaks(q), [])
        q = question("write_from_words", [words(["המכפלה של ", "a", " ב־", "b"], "ab", "W_PRODUCT"),
                                          words(["הסכום של ", "x", " ו־", "y"], "x+y", "W_SUM"),
                                          words(["ההפרש בין ", "a", " לבין ", "b"], "a-b", "W_DIFF")])
        self.assertEqual(leaks(q), [])
        # Keys equal to the constant 0 or 1 are ignored; 2 is not.
        for key, expected in (("1", []), ("0", []), ("2", [(1, LEAK_OWN)])):
            expr = {"1": "x+1-x", "0": "x-x", "2": "x+2-x"}[key]
            q = question("find_error_collect", [find_error(expr, key, "M2", key),
                                                find_error("6x+7-1-2x", "4x+8", "M2", "4x+6"),
                                                find_error("5b+2a+b", "5b+2a", "M3", "6b+2a")])
            self.assertEqual(leaks(q), expected, key)

    def test_leak_linked_in_both_directions(self):
        q = question("collect_like_terms", [collect("3x+2y+x", "4x+2y"), collect("4x+2y+5x", "9x+2y"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [(2, LEAK_LINKED)])
        q = question("collect_like_terms", [collect("4x+2y+5x", "9x+2y"), collect("3x+2y+x", "4x+2y"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [(2, LEAK_LINKED)])           # the later of the pair
        # A leading minus is part of the run.
        q = question("collect_like_terms", [collect("-2a+3+a+7", "-a+10"), collect("5b-a+10+b", "6b-a+10"),
                                            collect("8x-3+x-5", "9x-8")])
        self.assertEqual(leaks(q), [(2, LEAK_LINKED)])
        # Verbatim only: the same terms in another order, or a key of one term, are not linked.
        q = question("collect_like_terms", [collect("2y+3x+x", "2y+4x"), collect("4x+2y+5x", "9x+2y"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [])
        q = question("collect_like_terms", [collect("6a+2a", "8a"), collect("8a+3+a", "9a+3"),
                                            collect("5b-2+b", "6b-2")])
        self.assertEqual(leaks(q), [])

    def test_leak_rule_fact(self):
        q = question("collect_like_terms", [collect("5x+3x+1", "8x+1"), collect("-4y+9+6y-2", "2y+7"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [(1, LEAK_RULE_FACT)])
        q = question("collect_like_terms", [collect("1+3x+5x", "1+8x"), collect("5x+3x", "8x"),
                                            collect("8a-3+a-5", "9a-8")])
        self.assertEqual(leaks(q), [(1, LEAK_RULE_FACT), (2, LEAK_OWN), (2, LEAK_RULE_FACT)])
        # Not contiguous, other signs, other letters: no run with the fact's terms.
        q = question("collect_like_terms", [collect("3x+1+5x", "8x+1"), collect("5x-3x+1", "2x+1"),
                                            collect("3y+5y+1", "8y+1")])
        self.assertEqual(leaks(q), [])

    def test_hits_are_codes_and_one_based_indices_only(self):
        q = question("collect_like_terms", [collect("3x+2y+x", "4x+2y"), collect("4x+2y+5x", "9x+2y"),
                                            collect("5x+3x+1", "8x+1"), collect("3x+2y+x", "4x+2y")])
        found = leaks(q)
        self.assertEqual(found, sorted(set(found)))
        for index, code in found:
            self.assertIs(type(index), int)
            self.assertTrue(1 <= index <= 4)
            self.assertIn(code, leak_checks.QUESTION_CODES)
        for code in leak_checks.QUESTION_CODES + leak_checks.SHEET_CODES:
            self.assertRegex(code, r"^[A-Z_]{1,60}$")

    def test_removing_items_never_adds_a_hit(self):
        pool = [collect("3x+2y+x", "4x+2y"), collect("4x+2y+5x", "9x+2y"), collect("5x+3x+1", "8x+1"),
                collect("6x+2x", "8x"), collect("3x+2y+x", "4x+2y"), collect("8a-3+a-5", "9a-8")]
        whole = {(index, code) for index, code in leaks(question("collect_like_terms", pool))}
        self.assertTrue(whole)
        for size in range(1, len(pool)):
            for kept in itertools.combinations(range(len(pool)), size):
                found = leaks(question("collect_like_terms", [pool[i] for i in kept]))
                mapped = {(kept[index - 1] + 1, code) for index, code in found}
                self.assertLessEqual(mapped, whole, kept)


class SheetLeakTests(unittest.TestCase):
    def test_the_section_2_1_sheet_is_clean(self):
        self.assertEqual(leak_checks.sheet_leaks([Q1(), Q7(), Q13(), Q18()]), {})
        self.assertEqual(leak_checks.sheet_leaks([Q1(), Q7(), Q13(), Q18()], examples=RULE), {})

    def test_duplicate_task_names_the_later_question(self):
        again = question("substitute", [substitute("3x+5+2x-1", "x", 2, "14"), substitute("2a+5", "a", 3, "11"),
                                        substitute("5b-2b", "b", 4, "12")])
        self.assertEqual(leak_checks.sheet_leaks([Q13(), Q18(), again]), {2: [DUPLICATE_TASK]})
        self.assertEqual(leak_checks.sheet_leaks([again, Q13()]), {1: [DUPLICATE_TASK]})

    def test_inverse_leaks_across_questions_in_both_directions(self):
        shows = question("collect_like_terms", [collect("4x+2y+5x", "9x+2y"), collect("-4y+9+6y-2", "2y+7"),
                                                collect("8a-3+a-5", "9a-8")])
        answers = question("collect_like_terms", [collect("3x+2y+x", "4x+2y"), collect("6b-1+b", "7b-1"),
                                                  collect("2a+7-a", "a+7")])
        self.assertEqual(leak_checks.sheet_leaks([answers, shows]), {1: [LEAK_SHEET_INVERSE]})
        self.assertEqual(leak_checks.sheet_leaks([shows, answers]), {1: [LEAK_SHEET_INVERSE]})
        # A find_error wrong result shows another question's key just the same.
        wrong = question("find_error_collect", [find_error("3x+2y+x", "4x+2y+1", "M2", "4x+2y"),
                                                find_error("6x+7-1-2x", "4x+8", "M2", "4x+6"),
                                                find_error("5b+2a+b", "5b+2a", "M3", "6b+2a")])
        keyed = question("collect_like_terms", [collect("x+2y+3x", "4x+2y"), collect("6b-1+b", "7b-1"),
                                                collect("2a+7-a", "a+7")])
        self.assertEqual(leak_checks.sheet_leaks([keyed, wrong]), {1: [LEAK_SHEET_INVERSE]})

    def test_numeric_chance_matches_between_questions_are_allowed(self):
        other = question("collect_like_terms", [collect("11a+2-a", "10a+2"), collect("12b-6+b", "13b-6"),
                                                collect("7x+5x-6", "12x-6")])
        self.assertEqual(leak_checks.sheet_leaks([Q7(), other]), {})

    def test_example_copy_needs_the_examples(self):
        copy = question("collect_like_terms", [collect("3x+5x", "8x"), collect("6b-1+b", "7b-1"),
                                               collect("2a+7-a", "a+7")])
        self.assertEqual(leak_checks.sheet_leaks([Q13(), copy], examples=RULE), {1: [EXAMPLE_COPY]})
        self.assertEqual(leak_checks.sheet_leaks([Q13(), copy]), {})
        # The same copy is refused inside its question by the rule-fact checks.
        self.assertEqual(leaks(copy), [(1, LEAK_OWN), (1, LEAK_RULE_FACT)])

    def test_removing_questions_never_adds_a_hit(self):
        pool = [Q13(),
                question("collect_like_terms", [collect("3x+2y+x", "4x+2y"), collect("6b-1+b", "7b-1"),
                                                collect("2a+7-a", "a+7")]),
                question("collect_like_terms", [collect("4x+2y+5x", "9x+2y"), collect("-4y+9+6y-2", "2y+7"),
                                                collect("3x+5x", "8x")]),
                Q18()]
        whole = leak_checks.sheet_leaks(pool, examples=RULE)
        self.assertEqual(whole, {2: [DUPLICATE_TASK, EXAMPLE_COPY, LEAK_SHEET_INVERSE]})
        for size in range(1, len(pool)):
            for kept in itertools.combinations(range(len(pool)), size):
                found = leak_checks.sheet_leaks([pool[i] for i in kept], examples=RULE)
                for index, codes in found.items():
                    self.assertLessEqual(set(codes), set(whole.get(kept[index], [])), kept)


@unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
class D12MirrorTests(unittest.TestCase):
    def pinned(self):
        return leak_checks.pinned_module(str(MIDDLE))

    def expected(self, texts, keys):
        """The pinned rule written out: item j is hit when f_hit finds its key's atoms in any text."""
        cd = self.pinned()
        return [j for j, key in enumerate(keys, 1) if any(cd.f_hit(cd.f_atoms(key), text) for text in texts)]

    def test_the_section_2_1_questions_pass_the_pinned_rule(self):
        for build in (Q1, Q7, Q13, Q18):
            self.assertEqual(leak_checks.d12_mirror(build(), str(MIDDLE)), [], build.__name__)
            self.assertEqual(leaks(build(), str(MIDDLE)), [], build.__name__)
        intro = VERBS["collect_like_terms"]
        self.assertEqual(self.expected([intro, "$3x + 5 + 2x − 1$", "$−4y + 9 + 6y − 2$", "$8a − 3 + a − 5$"],
                                       ["$5x + 4$", "$2y + 7$", "$9a − 8$"]), [])

    def test_the_probed_refusals(self):
        # 7a-2a+4-a with key 4a+4: the key's 4 is printed in the item itself.
        q = question("collect_like_terms", [collect("7a-2a+4-a", "4a+4"), collect("-4y+9+6y-2", "2y+7"),
                                            collect("8b-3+b-5", "9b-8")])
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [1])
        self.assertEqual(leaks(q, str(MIDDLE)), [(1, LEAK_PINNED_VALUE)])
        # The pinned rule also counts the other items: key 5x+4 after an item printing 4 is hit as well.
        q = question("collect_like_terms", [collect("7a-2a+4-a", "4a+4"), collect("3x+5+2x-1", "5x+4"),
                                            collect("8b-3+b-5", "9b-8")])
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [1, 2])
        self.assertEqual(self.expected([VERBS["collect_like_terms"], "$7a − 2a + 4 − a$", "$3x + 5 + 2x − 1$",
                                        "$8b − 3 + b − 5$"], ["$4a + 4$", "$5x + 4$", "$9b − 8$"]), [1, 2])
        # Substitute keys -6, 11, 3 with "a = 3" printed earlier: the third item.
        q = question("substitute", [substitute("4y-y", "y", -2, "-6"), substitute("2a+5", "a", 3, "11"),
                                    substitute("x-7", "x", 10, "3")])
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [3])
        self.assertEqual(self.expected([VERBS["substitute"], "$4y − y$ עבור $y = −2$", "$2a + 5$ עבור $a = 3$",
                                        "$x − 7$ עבור $x = 10$"], ["$−6$", "$11$", "$3$"]), [3])
        # "מספר הגדול ב־5 מ־x" keyed x + 5: why no write_from_words template has an additive constant.
        q = question("write_from_words", [words(["מספר הגדול ב־", "5", " מ־", "x"], "x+5", "W_PLUS"),
                                          words(["הסכום של ", "a", " ו־", "b"], "a+b", "W_SUM"),
                                          words(["פי ", "3", " מ־", "y", " ועוד ", "x"], "3y+x", "W_TIMES_PLUS")])
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [1])

    def test_a_later_item_hit_is_refused_too(self):
        # Item 1's key -6 is printed only in item 2 (pinned: REVIEW); v5 refuses item 1.
        q = question("substitute", [substitute("4y-y", "y", -2, "-6"), substitute("2y+1", "y", -6, "-11"),
                                    substitute("2a+5", "a", 3, "11")])
        texts = [VERBS["substitute"], "$4y − y$ עבור $y = −2$", "$2y + 1$ עבור $y = −6$", "$2a + 5$ עבור $a = 3$"]
        self.assertEqual(self.expected(texts, ["$−6$", "$−11$", "$11$"]), [1])
        self.assertEqual(self.expected(texts[:2], ["$−6$"]), [])             # not in its own text or the intro
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [1])

    def test_no_stated_given_exemption(self):
        q = question("substitute", [substitute("3y-2y", "y", -2, "-2"), substitute("2a+5", "a", 3, "11"),
                                    substitute("5b-2b", "b", 4, "12")])
        self.assertEqual(leak_checks.d12_mirror(q, str(MIDDLE)), [1])
        self.assertEqual(leaks(q, str(MIDDLE)), [(1, LEAK_PINNED_VALUE)])
        # The pinned file-level rule would excuse this leak once a dict given states the value
        # (the critique's point); the bridge keeps given=[body], and the mirror reads no given at all.
        cd = self.pinned()
        text = "$3y − 2y$ עבור $y = −2$"
        target = {"type": "find", "quantity": "value", "what": "x", "value": "$−2$"}

        def noam_ai(given):
            return {"questions": [{"id": "q1", "intro": VERBS["substitute"],
                                   "items": [{"id": "q1a", "text": text, "given": given}]}], "figures": []}
        self.assertTrue(cd.f_file(noam_ai([text]), "q1", "q1a", target, "$−2$", None))
        self.assertEqual(cd.f_file(noam_ai([{"type": "value", "of": "y", "value": -2}]), "q1", "q1a", target,
                                   "$−2$", None), [])
        for given in ([text], [{"type": "value", "of": "y", "value": -2, "text": "y = −2"}]):
            stated = json.loads(json.dumps(q))
            stated["given"] = given
            for row in stated["items"]:
                row["given"] = given
            self.assertEqual(leak_checks.d12_mirror(stated, str(MIDDLE)), [1])

    def test_the_mirror_is_monotone(self):
        pool = [substitute("4y-y", "y", -2, "-6"), substitute("2y+1", "y", -6, "-11"),
                substitute("2a+5", "a", 3, "11"), substitute("x-7", "x", 10, "3")]
        whole = set(leak_checks.d12_mirror(question("substitute", pool), str(MIDDLE)))
        self.assertEqual(whole, {1, 4})
        for size in range(1, len(pool)):
            for kept in itertools.combinations(range(len(pool)), size):
                found = leak_checks.d12_mirror(question("substitute", [pool[i] for i in kept]), str(MIDDLE))
                self.assertLessEqual({kept[index - 1] + 1 for index in found}, whole, kept)


@unittest.skipUnless(PINNED, "Pinned middle skill unavailable")
class PinnedModuleTests(unittest.TestCase):
    def setUp(self):
        self.temp = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.temp, ignore_errors=True)

    def copy(self, data=None):
        folder = Path(tempfile.mkdtemp(dir=self.temp))
        (folder / "check_didactic.py").write_bytes(data if data is not None else (MIDDLE / "check_didactic.py").read_bytes())
        return folder

    def test_a_byte_identical_copy_loads_without_side_effects(self):
        folder = self.copy()
        path_before, modules_before, flag_before = list(sys.path), set(sys.modules), sys.dont_write_bytecode
        module = leak_checks.pinned_module(str(folder))
        self.assertTrue(callable(module.f_atoms) and callable(module.f_hit))
        self.assertEqual(module.__file__, str(folder / "check_didactic.py"))
        self.assertEqual(sys.path, path_before)
        self.assertEqual(set(sys.modules) - modules_before, set())
        self.assertEqual(sys.dont_write_bytecode, flag_before)
        self.assertEqual(sorted(p.name for p in folder.iterdir()), ["check_didactic.py"])   # no __pycache__
        self.assertIs(leak_checks.pinned_module(str(folder)), module)                       # cached

    def test_one_changed_byte_is_a_hash_mismatch(self):
        data = bytearray((MIDDLE / "check_didactic.py").read_bytes())
        data[0] = ord(" ") if data[0] != ord(" ") else ord("#")
        folder = self.copy(bytes(data))
        with self.assertRaises(ValueError) as caught:
            leak_checks.pinned_module(str(folder))
        self.assertEqual(str(caught.exception), "SKILL_HASH_MISMATCH")
        self.assertEqual(sorted(p.name for p in folder.iterdir()), ["check_didactic.py"])

    def test_a_cached_module_is_rechecked_on_every_call(self):
        folder = self.copy()
        leak_checks.pinned_module(str(folder))
        (folder / "check_didactic.py").write_bytes(b"# changed\n" + (MIDDLE / "check_didactic.py").read_bytes())
        with self.assertRaises(ValueError):
            leak_checks.pinned_module(str(folder))

    def test_symlinks_missing_unpinned_and_nested_files_are_refused(self):
        linked = Path(tempfile.mkdtemp(dir=self.temp))
        (linked / "check_didactic.py").symlink_to(MIDDLE / "check_didactic.py")
        empty = Path(tempfile.mkdtemp(dir=self.temp))
        cases = [(linked, "check_didactic.py"), (empty, "check_didactic.py"), (MIDDLE, "not_pinned.py"),
                 (MIDDLE, "SKILL.md"), (MIDDLE / "wspec", "../check_didactic.py"), (MIDDLE, "wspec/schema.py")]
        for folder, name in cases:
            with self.assertRaises(ValueError, msg=name) as caught:
                leak_checks.pinned_module(str(folder), name)
            self.assertEqual(str(caught.exception), "SKILL_HASH_MISMATCH")

    def test_the_import_time_code_must_be_standard_library(self):
        check = leak_checks._require_stdlib
        check(b"import json, re\nfrom fractions import Fraction\ndef f():\n    import sympy\n", "ok.py")
        for source in (b"import sympy\n", b"from wspec import canon\n", b"from . import sibling\n",
                       b"try:\n    import didactic\nexcept ImportError:\n    pass\n",
                       b"class C:\n    import numpy\n"):
            with self.assertRaises(ValueError) as caught:
                check(source, "bad.py")
            self.assertEqual(str(caught.exception), "SKILL_MODULE_NOT_STDLIB")
        check((MIDDLE / "check_didactic.py").read_bytes(), "check_didactic.py")


class StandInTests(unittest.TestCase):
    def test_the_school_math_in_use_is_reported(self):
        # Until E1's school_math lands these tests run against the section 2.4/2.5/2.8 stand-in.
        self.assertEqual(leak_checks.school_math is SM, True)
        self.assertEqual(STANDIN, getattr(SM, "__file__", "") == "<test stand-in for school_math>")
        self.assertEqual(kernel("3x+5+2x-1"), operation(
            "subtract", operation("add", operation("add", operation("multiply", number(3), {"type": "symbol", "name": "x"}),
                                                    number(5)),
                                   operation("multiply", number(2), {"type": "symbol", "name": "x"})), number(1)))


if __name__ == "__main__":
    unittest.main()
