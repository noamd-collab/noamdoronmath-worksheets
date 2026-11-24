"""school_math (V5-DESIGN §2.4-§2.8, §3, §6.1): school grammar, CST, scope, kernel, house and key printers.

Includes the 13 RTL/print cases of the stage-1 plan §e4 at string level, and (guarded like the existing tests) the
same island strings run through the pinned middle skill's own emitter.
"""
import dataclasses
import hashlib
from html.parser import HTMLParser
import importlib.util
import json
import os
from fractions import Fraction
from pathlib import Path
import re
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from math_tasks import MathTaskError, inspect_ast, number, operation, validate_and_solve_task
import school_math as sm
from school_math import Group, Neg, Num, Power, Product, Ref, Relation, SchoolMathError, Sum, Term, Var

LETTERS = ("x", "y", "a", "b")                     # the g7 overlay letters = the kernel symbols
ABCX = ("a", "b", "c", "x")
MINUS = "−"
PROFILE = {"literal_max": 20, "result_literal_max": 99, "value_min": -10, "value_max": 10,
           "terms_max": 4, "letters_max": 2, "power": False, "division": False, "decimal": False,
           "percent": False, "explicit_product": False, "brackets": "negative_number"}   # V5-DESIGN §2.7
X, Y = {"type": "symbol", "name": "x"}, {"type": "symbol", "name": "y"}
A, B = {"type": "symbol", "name": "a"}, {"type": "symbol", "name": "b"}
SECTION_2_5 = (  # V5-DESIGN §2.5, verbatim
    '{"type":"operation","op":"subtract","args":[{"type":"operation","op":"add","args":[{"type":"operation","op":"add",'
    '"args":[{"type":"operation","op":"multiply","args":[{"type":"number","numerator":3,"denominator":1},{"type":"symbol",'
    '"name":"x"}]},{"type":"number","numerator":5,"denominator":1}]},{"type":"operation","op":"multiply","args":[{"type":'
    '"number","numerator":2,"denominator":1},{"type":"symbol","name":"x"}]}]},{"type":"number","numerator":1,'
    '"denominator":1}]}')

CORPUS = [  # canonical school-grammar strings over LETTERS: unparse(parse(s)) == s
    "3x+5+2x-1", "-4y+9+6y-2", "2(x+3)", "(-3)^2", "-3^2", "x-(-2)", "ab", "3xy", "{n1}x", "4y-y",
    "2a+5", "5b-2b", "8a-3+a-5", "4a+3+a+2", "6x+7-1-2x", "5b+2a+b", "4x", "a+b", "3y+x", "10a",
    "4x+8", "5b+2a", "(-3)+(-4)", "5-(-2)", "2*3+4", "9/25", "12:4", "30%", "2.5x", "x^2+3x^2",
    "-(x+1)", "-(-3)", "x(-3)", "3(-2)", "(x+1)(x+2)", "((x))", "x/2/3", "1/2x", "0", "-0",
    "x^0", "{n2}+{n3}", "7a-2a+4-a", "-x", "-2a+10", "x-y", "7+3x", "0.05", "100%", "x:y:a",
    "2^3x", "x{n4}", "-{n1}", "2xy-yx", "-6", "3*(x+2)", "2x*3y", "(x)^2", "a(b)", "10.25%",
    "6:2/3", "2x/3", "(1/2)^2", "(x^2+1)", "x^2y", "-3x+2", "x+(-3)", "4x+7-0+x",
]
RELATIONS = ["y=-2", "x=20%", "3x+5x=8x", "-x=-2", "x+y=a-b", "{n1}=5"]


def p(text, letters=LETTERS, **options):
    return sm.parse(text, letters=letters, **options)


def span(notation, symbols=()):
    return {"kind": "display", "notation": notation, "symbols": list(symbols)}


def simplified(node, mapping=None):
    return validate_and_solve_task({"kind": "simplify", "expression": sm.to_kernel(node, mapping)})["result"]["value"]


def substituted(node, values):
    task = {"kind": "substitute", "expression": sm.to_kernel(node),
            "values": {letter: number(value) for letter, value in sm.parse_values(values, letters=LETTERS)}}
    return validate_and_solve_task(task)["result"]["value"]


def evaluated(node):
    return validate_and_solve_task({"kind": "evaluate", "expression": sm.to_kernel(node)})["result"]["value"]


def glyphs(island):
    """Left-to-right glyph order of one island printed as a single direction:ltr element: spaces dropped, the escaped
    percent printed as '%', a superscript read after its base (plan §e4 'Expected order')."""
    assert island.count("$") == 2 and island[0] == island[-1] == "$", island
    inner = island[1:-1].replace("\\%", "%").replace(" ", "")
    return re.sub(r"\^\{([0-9])\}", r"\1", inner)


class SchoolMathCase(unittest.TestCase):
    def code(self, code, function, *args, **kwargs):
        with self.assertRaises(SchoolMathError) as raised:
            function(*args, **kwargs)
        self.assertEqual(raised.exception.code, code)
        return raised.exception


class GrammarTests(SchoolMathCase):
    def test_round_trip_corpus(self):
        self.assertGreaterEqual(len(CORPUS), 40)
        for text in CORPUS:
            with self.subTest(text=text):
                node = p(text)
                self.assertEqual(sm.unparse(node), text)
                self.assertEqual(p(sm.unparse(node)), node)
        for text in RELATIONS:
            with self.subTest(text=text):
                node = p(text, allow_relation=True)
                self.assertIsInstance(node, Relation)
                self.assertEqual(sm.unparse(node), text)
                self.assertEqual(p(sm.unparse(node), allow_relation=True), node)
        node = p("ax^2+bx+c", letters=ABCX)
        self.assertEqual(sm.unparse(node), "ax^2+bx+c")

    def test_cst_keeps_the_written_form(self):
        self.assertEqual(p("-3^2"), Neg(Power(Num("3"), 2)))
        self.assertEqual(p("(-3)^2"), Power(Group(Neg(Num("3"))), 2))
        self.assertNotEqual(p("(-3)^2"), p("-3^2"))
        self.assertEqual(p("x-(-2)"), Sum(Var("x"), (("-", Group(Neg(Num("2")))),)))
        self.assertEqual(p("2(x+3)"), Product(Num("2"), (("", Group(Sum(Var("x"), (("+", Num("3")),)))),)))
        self.assertEqual(p("ab"), Product(Var("a"), (("", Var("b")),)))
        self.assertEqual(p("3xy"), Product(Num("3"), (("", Var("x")), ("", Var("y")))))
        self.assertEqual(p("{n1}x"), Product(Ref("n1"), (("", Var("x")),)))
        self.assertEqual(p("-4y+9"), Sum(Neg(Product(Num("4"), (("", Var("y")),))), (("+", Num("9")),)))
        self.assertEqual(p("2*3+4"), Sum(Product(Num("2"), (("*", Num("3")),)), (("+", Num("4")),)))
        self.assertEqual(p("9/25"), Product(Num("9"), (("/", Num("25")),)))
        self.assertEqual(p("12:4"), Product(Num("12"), ((":", Num("4")),)))
        self.assertEqual(p("((x))"), Group(Group(Var("x"))))
        self.assertEqual(p("-(x+1)"), Neg(Group(Sum(Var("x"), (("+", Num("1")),)))))
        self.assertEqual(p("x^2y"), Product(Power(Var("x"), 2), (("", Var("y")),)))
        self.assertEqual(p("y=-2", allow_relation=True), Relation(Var("y"), "=", Neg(Num("2"))))
        self.assertEqual(p("2.50"), Num("2.50"))          # literal as written
        self.assertNotEqual(p("2.50"), p("2.5"))
        self.assertEqual(p("2x*3y"), Product(Num("2"), (("", Var("x")), ("*", Num("3")), ("", Var("y")))))

    def test_minus_sign_reads_as_hyphen(self):
        self.assertEqual(p("4y " + MINUS + " y"), p("4y-y"))
        self.assertEqual(p(MINUS + "6"), Neg(Num("6")))
        self.assertEqual(p("x" + MINUS + "(" + MINUS + "2)"), p("x-(-2)"))
        self.assertEqual(p("y=" + MINUS + "2", allow_relation=True), p("y=-2", allow_relation=True))

    def test_whitespace_separates_tokens_but_never_splits_a_number(self):
        self.assertEqual(p(" 3 x + 4 "), p("3x+4"))
        self.assertEqual(p("2 (x + 3)"), p("2(x+3)"))
        self.assertEqual(p("x ^ 2"), p("x^2"))
        for text in ("3 4", "1 0", "2 .5", "2. 5", "30 %", "x 3", "2.5 %"):
            with self.subTest(text=text):
                self.code("MATH_PARSE", p, text)

    def test_parse_refusals(self):
        refused = ["x3", "3 4", "5--2", "5+-2", "3*-2", "(x+1", "x+", "", "x²", "3·x", "X", ")3", "x)", "()",
                   "+3", "--3", "3.", ".5", "1.2.3", "05", "00.5", "x^22", "x^-2", "x^(2)", "x^", "x^2^3", "x^2.5",
                   "x^2%", "{n9}", "{n0}", "{n1", "{N1}", "x\t+1", "x +1", "3–2", "א", "3x+5ש", "  ",
                   "2,5", "x=2", "3*", "*3", "x(", "5x−", "[x]", "x**2", "3÷4", "x×2", "√4", "°"]
        for text in refused:
            with self.subTest(text=text):
                self.code("MATH_PARSE", p, text)
        for text in ("3x=", "=3", "x=y=1", "x==1"):
            with self.subTest(text=text):
                self.code("MATH_PARSE", p, text, allow_relation=True)
        for value in (None, 5, b"x", ["x"]):
            self.code("MATH_PARSE", sm.parse, value, letters=LETTERS)

    def test_undeclared_letters(self):
        self.code("MATH_SYMBOL_UNDECLARED", p, "3c+2c")
        self.code("MATH_SYMBOL_UNDECLARED", p, "x", letters=("y",))
        self.code("MATH_SYMBOL_UNDECLARED", p, "4y-y", letters=())
        self.code("MATH_SYMBOL_UNDECLARED", p, "ax^2+bx+c")
        self.assertEqual(sm.letters_of(p("ax^2+bx+c", letters=ABCX)), ("a", "x", "b", "c"))

    def test_declared_letters_are_at_most_four_lowercase_letters(self):
        for letters in (("x", "y", "a", "b", "c"), ("X",), ("xy",), ("",), (1,), None, 7, ("é",)):
            with self.subTest(letters=letters):
                self.code("MATH_SYMBOL_UNDECLARED", sm.parse, "1", letters=letters)
        self.assertEqual(p("x+y", letters="xy"), p("x+y"))
        self.assertEqual(p("x", letters=("x", "x", "x", "x", "x")), Var("x"))   # duplicates count once

    def test_length(self):
        self.assertEqual(p("1" * 120), Num("1" * 120))
        self.code("MATH_LENGTH", p, "1" * 121)
        self.assertEqual(p("1" * 121, max_length=121), Num("1" * 121))
        self.code("MATH_LENGTH", p, "x+1", max_length=2)
        for bad in (0, -1, True, "5", 2.0):
            with self.assertRaises(ValueError):
                p("x", max_length=bad)

    def test_nesting_limit(self):
        self.assertEqual(sm.unparse(p("(" * 32 + "x" + ")" * 32)), "(" * 32 + "x" + ")" * 32)
        self.code("MATH_PARSE", p, "(" * 33 + "x" + ")" * 33)

    def test_errors_never_echo_the_input(self):
        for text in ("3c+2c", "x²+5ab", "5--2", "שלום", "x+", "(x+1", "y=2", "30 %", "{n9}x"):
            with self.subTest(text=text):
                with self.assertRaises(SchoolMathError) as raised:
                    p(text)
                message = str(raised.exception)
                self.assertNotIn(text, message)
                self.assertFalse(re.search("[֐-׿²]", message))
        with self.assertRaises(SchoolMathError) as raised:
            sm.parse_values("c:=12", letters=LETTERS)
        self.assertNotIn("c:=12", str(raised.exception))

    def test_number_values(self):
        self.assertEqual(Num("12").value, 12)
        self.assertEqual(Num("2.5").value, Fraction(5, 2))
        self.assertEqual(Num("0.05").value, Fraction(1, 20))
        self.assertEqual(Num("30%").value, Fraction(3, 10))
        self.assertEqual(Num("30%").magnitude, 30)
        self.assertEqual(Num("2.5%").value, Fraction(1, 40))
        for bad in ("05", "-1", "1.", "x", ""):
            self.code("MATH_PARSE", lambda text: Num(text).value, bad)

    def test_nodes_are_frozen_and_structural(self):
        with self.assertRaises(dataclasses.FrozenInstanceError):
            Num("1").text = "2"
        self.assertEqual(len({p("3x+4"), p("3x + 4"), p("3x+4")}), 1)
        self.assertNotEqual(Var("x"), Ref("x"))
        self.assertEqual(sm.NODE_TYPES, (Num, Var, Ref, Neg, Group, Sum, Product, Power, Relation))


class ValuesTests(SchoolMathCase):
    def test_values(self):
        self.assertEqual(sm.parse_values("y=-2", letters=LETTERS), (("y", -2),))
        self.assertEqual(sm.parse_values("x=3, y=-1", letters=LETTERS), (("x", 3), ("y", -1)))
        self.assertEqual(sm.parse_values("x=3,y=-1", letters=LETTERS), (("x", 3), ("y", -1)))
        self.assertEqual(sm.parse_values("y = " + MINUS + "2", letters=LETTERS), (("y", -2),))
        self.assertEqual(sm.parse_values(" a=0 ", letters=LETTERS), (("a", 0),))
        self.assertEqual(sm.parse_values("b=-0", letters=LETTERS), (("b", 0),))
        self.assertEqual(sm.parse_values("b=10, a=-10", letters=LETTERS), (("b", 10), ("a", -10)))

    def test_value_refusals(self):
        for text in ("y:=2", "", "y=", "=2", "y=2,", "y=2.5", "y=+2", "y=--2", "y=02", "Y=2", "y=2;x=1",
                     "y=2 x=1", "y=x", "y=1, y=2", "y==2", "y=2 ", "yy=2", "y=2%", "y=(2)", "y=2^2"):
            with self.subTest(text=text):
                self.code("MATH_PARSE", sm.parse_values, text, letters=LETTERS)
        self.code("MATH_SYMBOL_UNDECLARED", sm.parse_values, "c=2", letters=LETTERS)
        self.code("MATH_LENGTH", sm.parse_values, "y=" + "1" * 119, letters=LETTERS)
        self.code("MATH_PARSE", sm.parse_values, None, letters=LETTERS)


class LettersAndResolveTests(SchoolMathCase):
    def test_letters_of_in_first_appearance_order(self):
        self.assertEqual(sm.letters_of(p("3y+x+2y")), ("y", "x"))
        self.assertEqual(sm.letters_of(p("b(a+x)")), ("b", "a", "x"))
        self.assertEqual(sm.letters_of(p("5")), ())
        self.assertEqual(sm.letters_of(p("y=-2", allow_relation=True)), ("y",))
        self.assertEqual(sm.letters_of(p("{n1}x")), ("x",))
        self.assertEqual(sm.letters_of(p("x+y=a-b", allow_relation=True)), ("x", "y", "a", "b"))

    def test_resolve_keeps_the_reading_where_the_reference_stands(self):
        cases = [  # (text, givens, resolved canonical text)
            ("{n1}x", {"n1": "3"}, "3x"),
            ("{n1}x", {"n1": "-2"}, "(-2)x"),
            ("3+{n1}", {"n1": "-2"}, "3+(-2)"),
            ("{n1}+3", {"n1": "-2"}, "-2+3"),
            ("{n1}", {"n1": "-2"}, "-2"),
            ("x{n1}", {"n1": "5"}, "x(5)"),
            ("x*{n1}", {"n1": "5"}, "x*5"),
            ("{n1}^2", {"n1": "-3"}, "(-3)^2"),
            ("{n1}^2", {"n1": "3"}, "3^2"),
            ("-{n1}", {"n1": "3"}, "-3"),
            ("-{n1}", {"n1": "-3"}, "-(-3)"),
            ("2{n1}", {"n1": p("x+1")}, "2(x+1)"),
            ("{n1}", {"n1": p("x+1")}, "x+1"),
            ("6/{n1}", {"n1": p("2x")}, "6/(2x)"),
            ("({n1})", {"n1": p("-2")}, "(-2)"),
            ("{n1}x+{n2}", {"n1": "3", "n2": "-4"}, "3x+(-4)"),
            ("{n1}={n2}", {"n1": "4", "n2": "7"}, "4=7"),
            ("x+{n1}", {"n1": "30%"}, "x+30%"),
        ]
        for text, givens, expected in cases:
            with self.subTest(text=text, expected=expected):
                resolved = sm.resolve(p(text, allow_relation=True), givens)
                self.assertEqual(sm.unparse(resolved), expected)
                self.assertEqual(p(sm.unparse(resolved), allow_relation=True), resolved)

    def test_resolved_values_reach_the_kernel(self):
        resolved = sm.resolve(p("{n1}x+{n2}"), {"n1": "3", "n2": "-4"})
        self.assertEqual(sm.unparse(sm.key_from_result(simplified(resolved), resolved)), "3x-4")
        self.assertEqual(evaluated(sm.resolve(p("{n1}^2"), {"n1": "-3"})), number(9))
        self.assertEqual(evaluated(sm.resolve(p("6/{n1}"), {"n1": p("2*3")})), number(1))
        self.assertEqual(sm.resolve(p("3x+1"), {}), p("3x+1"))

    def test_resolve_refusals(self):
        self.code("REF_UNDECLARED", sm.resolve, p("{n2}x"), {"n1": "3"})
        self.code("REF_UNDECLARED", sm.resolve, p("{n1}x"), [{"id": "n1", "value": "3"}])
        self.code("REF_UNDECLARED", sm.resolve, p("{n1}x"), {"n1": 3})
        self.code("REF_UNDECLARED", sm.resolve, p("{n1}x"), {"n1": p("{n2}")})
        self.code("REF_UNDECLARED", sm.resolve, p("{n1}"), {"n1": p("x=1", allow_relation=True)})
        self.code("MATH_SYMBOL_UNDECLARED", sm.resolve, p("{n1}+1"), {"n1": "x"})   # a string given is a number
        self.code("MATH_PARSE", sm.resolve, p("{n1}+1"), {"n1": "3 4"})


class ScopeTests(SchoolMathCase):
    def scope(self, text, role="task", profile=PROFILE, letters=LETTERS, relation=False):
        return sm.check_scope(p(text, letters=letters, allow_relation=relation), profile, role=role)

    def variant(self, **changes):
        return dict(PROFILE, **changes)

    def test_fixture_items_are_in_scope(self):
        for text in ("4x", "a+b", "3y+x", "4y-y", "2a+5", "5b-2b", "3x+5+2x-1", "-4y+9+6y-2", "8a-3+a-5",
                     "4a+3+a+2", "6x+7-1-2x", "5b+2a+b", "20x", "x+(-3)", "x-(-2)", "3(-2)", "-(-3)", "-x"):
            with self.subTest(text=text):
                self.assertEqual(self.scope(text), [])
        for text in ("10a", "4x+8", "5b+2a", "5x+4", "2y+7", "9a-8", "-6", "11", "12", "5a+5", "4x+6",
                     "6b+2a", "99x", "-99"):
            with self.subTest(result=text):
                self.assertEqual(self.scope(text, "result"), [])

    def test_each_code(self):
        cases = {
            "MATH_SCOPE_PRODUCT_OF_SUM": ["3(x+2)+x", "3(x+2)", "(x+2)x", "(x+1)(x+2)", "3*(x+2)", "2(-x+1)"],
            "MATH_SCOPE_BRACKETS": ["5-(2x+1)+x", "5-(2x+1)", "(x)", "x+(y)", "-(x+1)", "3(-x)", "((-3))+x"],
            "MATH_SCOPE_POWER": ["x^2+3x^2", "2xx+x", "xx", "x*x", "x^2x", "(-3)^2", "-3^2", "x^0"],
            "MATH_SCOPE_PRODUCT": ["3*x+2x", "2*3", "a*b"],
            "MATH_SCOPE_DIVISION": ["x/2+x", "12:4", "x:2"],
            "MATH_SCOPE_DECIMAL": ["2.5x+x", "0.5"],
            "MATH_SCOPE_PERCENT": ["30%", "2.5%", "x+5%"],
            "MATH_SCOPE_RANGE": ["25x+3x", "21x", "x+21", "-21+x", "2x+100"],
            "MATH_SCOPE_TERMS": ["x+2x+3x+4x+5x", "1+2+3+4+5"],
            "MATH_SCOPE_LETTERS": ["x+y+a", "xy+a", "a+b+x"],
        }
        for code, texts in cases.items():
            for text in texts:
                with self.subTest(code=code, text=text):
                    self.assertEqual(self.scope(text), [code])
        self.assertEqual(self.scope("x=2", relation=True), ["MATH_SCOPE_RELATION"])
        self.assertEqual(self.scope("x=2", "result", relation=True), ["MATH_SCOPE_RELATION"])
        self.assertEqual(self.scope("100x", "result"), ["MATH_SCOPE_RANGE"])
        self.assertEqual(self.scope("x+2x+3x+4x", role="task"), [])
        self.assertEqual(sorted(list(cases) + ["MATH_SCOPE_RELATION"]), sorted(sm.SCOPE_CODES))   # every code

    def test_most_specific_code_per_node(self):
        self.assertEqual(self.scope("3*(x+2)"), ["MATH_SCOPE_PRODUCT_OF_SUM"])        # not PRODUCT / BRACKETS
        self.assertEqual(self.scope("x*x"), ["MATH_SCOPE_POWER"])                     # not PRODUCT
        self.assertEqual(self.scope("2*x*x"), ["MATH_SCOPE_POWER"])
        self.assertEqual(self.scope("(x+2)^2"), ["MATH_SCOPE_POWER", "MATH_SCOPE_PRODUCT_OF_SUM"])
        self.assertEqual(self.scope("3((x+2))"), ["MATH_SCOPE_BRACKETS", "MATH_SCOPE_PRODUCT_OF_SUM"])
        self.assertEqual(self.scope("2*x/3"), ["MATH_SCOPE_DIVISION", "MATH_SCOPE_PRODUCT"])
        self.assertEqual(self.scope("3(x+2)+2.5x/y"),
                         ["MATH_SCOPE_DECIMAL", "MATH_SCOPE_DIVISION", "MATH_SCOPE_PRODUCT_OF_SUM"])
        self.assertEqual(self.scope("30.5%"), ["MATH_SCOPE_PERCENT"])                 # not DECIMAL or RANGE
        self.assertEqual(self.scope("25.5"), ["MATH_SCOPE_DECIMAL"])                  # not RANGE
        self.assertEqual(self.scope("x+y+a+2x+3y"), ["MATH_SCOPE_LETTERS", "MATH_SCOPE_TERMS"])

    def test_value_role(self):
        relation = dict(relation=True)
        self.assertEqual(self.scope("y=-2", "value", **relation), [])
        self.assertEqual(self.scope("y=10", "value", **relation), [])
        self.assertEqual(self.scope("y=-10", "value", **relation), [])
        self.assertEqual(self.scope("y=15", "value", **relation), ["MATH_SCOPE_RANGE"])
        self.assertEqual(self.scope("y=-11", "value", **relation), ["MATH_SCOPE_RANGE"])
        self.assertEqual(self.scope("15", "value"), ["MATH_SCOPE_RANGE"])
        self.assertEqual(self.scope("-2", "value"), [])
        self.assertEqual(self.scope("2.5", "value"), ["MATH_SCOPE_DECIMAL"])
        self.assertEqual(sm.check_scope(Group(Neg(Num("11"))), PROFILE, role="value"), ["MATH_SCOPE_RANGE"])
        self.assertEqual(sm.check_scope(Neg(Group(Neg(Num("11")))), PROFILE, role="value"), ["MATH_SCOPE_RANGE"])
        self.assertEqual(sm.check_scope(Neg(Group(Neg(Num("9")))), PROFILE, role="value"), [])
        values = sm.parse_values("x=3, y=-12", letters=LETTERS)
        found = [sm.check_scope(p("%s=%d" % pair, allow_relation=True), PROFILE, role="value") for pair in values]
        self.assertEqual(found, [[], ["MATH_SCOPE_RANGE"]])

    def test_profile_variants(self):
        distributive = self.variant(distributive=True)
        self.assertEqual(self.scope("3(x+2)", profile=distributive), [])
        self.assertEqual(self.scope("3*(x+2)", profile=distributive), ["MATH_SCOPE_PRODUCT"])
        self.assertEqual(self.scope("(x+2)^2", profile=self.variant(distributive=True, power=True)), [])
        square = self.variant(power=2)
        self.assertEqual(self.scope("x^2", profile=square), [])
        self.assertEqual(self.scope("x^3", profile=square), ["MATH_SCOPE_POWER"])
        self.assertEqual(self.scope("xx", profile=square), ["MATH_SCOPE_POWER"])     # x² is written as a power
        kernel = self.variant(power=True)
        self.assertEqual(self.scope("x^4", profile=kernel), [])
        self.assertEqual(self.scope("x^5", profile=kernel), ["MATH_SCOPE_POWER"])
        self.assertEqual(self.scope("(-3)^2", profile=kernel), [])
        none = self.variant(brackets="none", power=True)
        for text in ("x+(-3)", "3(-2)", "(-3)^2"):
            self.assertEqual(self.scope(text, profile=none), ["MATH_SCOPE_BRACKETS"])
        loose = self.variant(brackets="any")
        self.assertEqual(self.scope("5-(2x+1)", profile=loose), [])
        self.assertEqual(self.scope("(x)", profile=loose), [])
        self.assertEqual(self.scope("3(x+2)", profile=loose), ["MATH_SCOPE_PRODUCT_OF_SUM"])
        self.assertEqual(self.scope("2.5x", profile=self.variant(decimal=True)), [])
        self.assertEqual(self.scope("20%", profile=self.variant(percent=True)), [])
        self.assertEqual(self.scope("30%", profile=self.variant(percent=True)), ["MATH_SCOPE_RANGE"])
        self.assertEqual(self.scope("x/2", profile=self.variant(division=True)), [])
        self.assertEqual(self.scope("12:4", profile=self.variant(division=True)), [])
        self.assertEqual(self.scope("3*x", profile=self.variant(explicit_product=True)), [])
        self.assertEqual(self.scope("x*x", profile=self.variant(explicit_product=True)), ["MATH_SCOPE_POWER"])
        self.assertEqual(self.scope("x=2", profile=self.variant(relation=True), relation=True), [])
        self.assertEqual(self.scope("x+y+a", profile=self.variant(letters_max=3)), [])
        self.assertEqual(self.scope("25x", profile=self.variant(literal_max=25)), [])

    def test_bad_arguments(self):
        with self.assertRaises(ValueError):
            sm.check_scope(p("x"), PROFILE, role="key")
        for broken in ({k: v for k, v in PROFILE.items() if k != "brackets"}, self.variant(brackets="some"),
                       self.variant(power="2"), self.variant(power=10), self.variant(power=-1),
                       self.variant(literal_max="20"), self.variant(decimal=1), self.variant(distributive="yes"),
                       [("literal_max", 20)]):
            with self.subTest(profile=broken):
                with self.assertRaises(ValueError):
                    sm.check_scope(p("x"), broken)

    def test_codes_are_sorted_unique_and_known(self):
        for text in CORPUS:
            if "{" in text:
                continue
            found = self.scope(text)
            self.assertEqual(found, sorted(set(found)))
            self.assertTrue(set(found) <= sm.SCOPE_CODES)
            self.assertTrue(all(re.fullmatch(r"[A-Z_]{1,60}", code) for code in found))


class TermsTests(SchoolMathCase):
    def test_terms(self):
        self.assertEqual(sm.terms(p("3x+5+2x-1")), (
            Term(1, 3, ("x",), False, ("x",)), Term(1, 5, (), False, ()),
            Term(1, 2, ("x",), False, ("x",)), Term(-1, 1, (), False, ())))
        self.assertEqual(sm.terms(p("-4y+9"))[0], Term(-1, 4, ("y",), False, ("y",)))
        self.assertEqual(sm.terms(p("5b+2a+b"))[2], Term(1, 1, ("b",), True, ("b",)))
        self.assertEqual(sm.terms(p("2yx")), (Term(1, 2, ("x", "y"), False, ("y", "x")),))
        self.assertEqual(sm.terms(p("ab")), (Term(1, 1, ("a", "b"), True, ("a", "b")),))
        self.assertEqual(sm.terms(p("x+(-3)"))[1], Term(-1, 3, (), False, ()))
        self.assertEqual(sm.terms(p("x-(-3)"))[1], Term(1, 3, (), False, ()))
        self.assertEqual(sm.terms(p("-(-3)")), (Term(1, 3, (), False, ()),))
        self.assertEqual(sm.terms(p("-x")), (Term(-1, 1, ("x",), True, ("x",)),))
        self.assertEqual(sm.terms(p("4x+7-0+x"))[2], Term(-1, 0, (), False, ()))     # M2's not-wrong case
        self.assertEqual(sm.terms(p("2.5x"))[0].coefficient, Fraction(5, 2))           # scope refuses it, not terms
        self.assertEqual([t.signed for t in sm.terms(p("6x+7-1-2x"))], [6, 7, -1, -2])

    def test_non_monomial_sums(self):
        for text in ("2(x+3)", "3*x", "x^2", "2xx", "x/2", "(x)", "x(-3)", "3(-2)", "{n1}x", "(-3)^2",
                     "xya", "x:2", "-(x+1)", "(x+1)(x+2)"):
            with self.subTest(text=text):
                self.code("MATH_PARSE", sm.terms, p(text))
        self.code("MATH_PARSE", sm.terms, p("y=2", allow_relation=True))

    def test_is_collected(self):
        for text, expected in (("5x+4", True), ("3x+5+2x-1", False), ("5b+2a", True), ("x+y", True),
                               ("3+4", False), ("x-x", False), ("ab+ba", False), ("7", True), ("5x+0", True)):
            with self.subTest(text=text):
                self.assertIs(sm.is_collected(p(text)), expected)
        self.code("MATH_PARSE", sm.is_collected, p("2(x+3)"))


class KernelTests(SchoolMathCase):
    def test_section_2_5_example_exactly(self):
        ast = sm.to_kernel(p("3x+5+2x-1"))
        self.assertEqual(ast, json.loads(SECTION_2_5))
        self.assertEqual(json.dumps(ast, separators=(",", ":")), SECTION_2_5)   # key order too (G10)
        self.assertIs(inspect_ast(ast), ast)

    def test_corpus_passes_inspect_ast(self):
        for text in CORPUS:
            if "{" in text:
                continue
            with self.subTest(text=text):
                inspect_ast(sm.to_kernel(p(text)))

    def test_conversion_table(self):
        self.assertEqual(sm.to_kernel(p("-6")), number(-6))
        self.assertEqual(sm.to_kernel(p("-2.5")), number(-5, 2))
        self.assertEqual(sm.to_kernel(p("30%")), number(3, 10))
        self.assertEqual(sm.to_kernel(p("-x")), operation("multiply", number(-1), X))
        self.assertEqual(sm.to_kernel(p("-3^2")), operation("multiply", number(-1), operation("power", number(3), number(2))))
        self.assertEqual(sm.to_kernel(p("(-3)^2")), operation("power", number(-3), number(2)))
        self.assertEqual(sm.to_kernel(p("((x))")), X)
        self.assertEqual(sm.to_kernel(p("12:4")), operation("divide", number(12), number(4)))
        self.assertEqual(sm.to_kernel(p("x/2")), operation("divide", X, number(2)))
        self.assertEqual(sm.to_kernel(p("6/2x")), operation("multiply", operation("divide", number(6), number(2)), X))
        self.assertEqual(sm.to_kernel(p("2x*3y")), operation("multiply", operation("multiply", operation(
            "multiply", number(2), X), number(3)), Y))
        self.assertEqual(sm.to_kernel(p("x^2")), operation("power", X, number(2)))
        self.assertEqual(sm.to_kernel(p("a-b+x")), operation("add", operation("subtract", A, B), X))
        self.assertEqual(sm.to_kernel(p("-(-3)")), operation("multiply", number(-1), number(-3)))

    def test_square_of_negative_versus_negative_square(self):
        self.assertEqual(evaluated(p("(-3)^2")), number(9))
        self.assertEqual(evaluated(p("-3^2")), number(-9))
        self.assertEqual(evaluated(p("(-3)+(-4)")), number(-7))
        self.assertEqual(evaluated(p("5-(-2)")), number(7))
        self.assertEqual(evaluated(p("2*3+4")), number(10))
        self.assertEqual(evaluated(p("12:4")), number(3))
        self.assertEqual(evaluated(p("9/25")), number(9, 25))

    def test_references_and_relations_are_not_kernel_input(self):
        self.code("MATH_PARSE", sm.to_kernel, p("{n1}x"))
        self.code("MATH_PARSE", sm.to_kernel, p("y=-2", allow_relation=True))

    def test_letters_need_a_kernel_symbol(self):
        node = p("c+1", letters=("c",))
        self.code("MATH_SYMBOL_UNDECLARED", sm.to_kernel, node)
        self.assertEqual(sm.to_kernel(node, {"c": "y"}), operation("add", Y, number(1)))
        for mapping in ({"c": "z"}, {"c": "y", "d": "y"}, {"d": "x"}, [("c", "y")],
                        {"c": "x", "d": "y", "e": "a", "f": "b", "g": "x"}, {"C": "x"}):
            with self.subTest(mapping=mapping):
                self.code("MATH_SYMBOL_UNDECLARED", sm.to_kernel, node, mapping)

    def test_kernel_mapping(self):
        self.assertEqual(sm.KERNEL_SYMBOLS, ("x", "y", "a", "b"))
        self.assertEqual(sm.kernel_mapping(ABCX), {"a": "a", "b": "b", "c": "y", "x": "x"})
        self.assertEqual(sm.kernel_mapping(("p", "q")), {"p": "x", "q": "y"})
        self.assertEqual(sm.kernel_mapping(("y", "c")), {"y": "y", "c": "x"})
        self.assertEqual(sm.kernel_mapping(LETTERS), {letter: letter for letter in LETTERS})
        self.code("MATH_SYMBOL_UNDECLARED", sm.kernel_mapping, ("a", "b", "c", "d", "x"))

    def test_letter_mapping_round_trip(self):
        # ax^2+bx+c keeps its own letters on the sheet; the kernel sees c as y (V5-DESIGN §6.1).
        task = p("ax^2+bx+c", letters=ABCX)
        mapping = sm.kernel_mapping(ABCX)
        ast = sm.to_kernel(task, mapping)
        self.assertEqual(ast, operation("add", operation("add", operation("multiply", A, operation(
            "power", X, number(2))), operation("multiply", B, X)), Y))
        result = simplified(task, mapping)
        self.assertEqual(sm.polynomial_of_kernel(result), {("a", "x", "x"): 1, ("b", "x"): 1, ("y",): 1})
        key = sm.key_from_result(result, task, mapping)
        self.assertEqual(sm.unparse(key), "ax^2+bx+c")
        self.assertEqual(key, task)
        self.assertEqual(sm.key_island({"notation": sm.unparse(key), "symbols": list(ABCX)}), "$ax^{2} + bx + c$")
        self.assertTrue(sm.kernel_equal(task, result, mapping))
        self.assertTrue(sm.key_roundtrip({"notation": "ax^2+bx+c", "symbols": list(ABCX)}, result, mapping))
        self.assertEqual(sm.polynomial(task), {("a", "x", "x"): 1, ("b", "x"): 1, ("c",): 1})

    def test_stage_2_tasks_solve_through_the_kernel(self):
        simplify = {"3x+5+2x-1": "5x+4", "-4y+9+6y-2": "2y+7", "8a-3+a-5": "9a-8",          # collect
                    "4x": "4x", "a+b": "a+b", "3y+x": "3y+x",                                # write from words
                    "4a+3+a+2": "5a+5", "6x+7-1-2x": "4x+6", "5b+2a+b": "6b+2a"}             # find the error
        for text, key in simplify.items():
            with self.subTest(task=text):
                task = p(text)
                result = simplified(task)
                self.assertEqual(sm.unparse(sm.key_from_result(result, task)), key)
        for text, values, key in (("4y-y", "y=-2", "-6"), ("2a+5", "a=3", "11"), ("5b-2b", "b=4", "12"),
                                  ("x+y", "x=3, y=-1", "2")):
            with self.subTest(task=text):
                task = p(text)
                self.assertEqual(sm.unparse(sm.key_from_result(substituted(task, values), task)), key)


class PolynomialTests(SchoolMathCase):
    def poly(self, text, letters=LETTERS):
        return sm.polynomial_of_kernel(sm.to_kernel(p(text, letters=letters)))

    def test_polynomials(self):
        self.assertEqual(sm.polynomial_of_kernel(number(0)), {})
        self.assertEqual(sm.polynomial_of_kernel(number(-6)), {(): Fraction(-6)})
        self.assertEqual(sm.polynomial_of_kernel(X), {("x",): 1})
        self.assertEqual(self.poly("3x+5+2x-1"), {("x",): 5, (): 4})
        self.assertEqual(self.poly("x^2+2xy+y^2"), {("x", "x"): 1, ("x", "y"): 2, ("y", "y"): 1})
        self.assertEqual(self.poly("(x+1)^2"), {("x", "x"): 1, ("x",): 2, (): 1})
        self.assertEqual(self.poly("x/2"), {("x",): Fraction(1, 2)})
        self.assertEqual(self.poly("x/(1+1)"), {("x",): Fraction(1, 2)})
        self.assertEqual(self.poly("x-x"), {})
        self.assertEqual(self.poly("ba"), {("a", "b"): 1})
        self.assertEqual(self.poly("-3^2"), {(): -9})
        self.assertEqual(self.poly("x^0"), {(): 1})
        self.assertEqual(list(self.poly("4+x+x^2+a")), [("x", "x"), ("a",), ("x",), ()])   # deterministic order

    def test_unrepresentable(self):
        for ast in (operation("divide", number(1), X), operation("sqrt", number(4)),
                    operation("power", X, number(-1)), operation("power", number(0), number(0)),
                    operation("divide", X, number(0)), operation("divide", X, operation("subtract", Y, Y)),
                    {"type": "foo"}, "x", None, {"type": "number", "numerator": 1, "denominator": 0},
                    operation("multiply", operation("power", X, number(4)), operation("power", X, number(4)), X)):
            with self.subTest(ast=ast):
                self.code("FORM_UNREPRESENTABLE", sm.polynomial_of_kernel, ast)

    def test_polynomial_helper_uses_the_nodes_own_letters(self):
        self.assertEqual(sm.polynomial(p("c-2c+d", letters=("c", "d"))), {("c",): -1, ("d",): 1})
        self.assertEqual(sm.polynomial(p("3x+5+2x-1")), {("x",): 5, (): 4})


class KeyTests(SchoolMathCase):
    KEYS = [  # (task, values, key notation, key island) — V5-DESIGN §6.1 keys, each proven by the kernel
        ("3x+5+2x-1", "", "5x+4", "$5x + 4$"),
        ("-4y+9+6y-2", "", "2y+7", "$2y + 7$"),
        ("8a-3+a-5", "", "9a-8", "$9a − 8$"),
        ("3x-y-2x", "", "x-y", "$x − y$"),
        ("3y+x", "", "3y+x", "$3y + x$"),
        ("5+3x+2", "", "7+3x", "$7 + 3x$"),
        ("-4a+3+2a+7", "", "-2a+10", "$−2a + 10$"),
        ("4x-4x", "", "0", "$0$"),
        ("4y-y", "y=-2", "-6", "$−6$"),
    ]

    def result(self, task, values):
        return substituted(task, values) if values else simplified(task)

    def test_design_keys(self):
        for text, values, notation, island in self.KEYS:
            with self.subTest(task=text):
                task = p(text)
                result = self.result(task, values)
                key = sm.key_from_result(result, task)
                self.assertEqual(sm.unparse(key), notation)
                symbols = list(sm.letters_of(key))
                self.assertEqual(sm.key_island({"form": "expression", "notation": notation, "symbols": symbols,
                                                "binding": {"kind": "collect_like_terms"}}), island)
                self.assertTrue(sm.key_roundtrip({"notation": notation, "symbols": symbols}, result))
                self.assertNotIn("-", island)

    def test_first_appearance(self):
        self.assertEqual(sm.first_appearance(p("3x+5+2x-1")), ((("x",), ("x",)), ((), ())))
        self.assertEqual(sm.first_appearance(p("5+3x+2")), (((), ()), (("x",), ("x",))))
        self.assertEqual(sm.first_appearance(p("5b+2a+b")), ((("b",), ("b",)), (("a",), ("a",))))
        self.assertEqual(sm.first_appearance(p("2yx+xy")), ((("x", "y"), ("y", "x")),))
        self.assertEqual(sm.first_appearance(p("ax^2+bx+c", letters=ABCX)), (
            (("a", "x", "x"), ("a", "x", "x")), (("b", "x"), ("b", "x")), (("c",), ("c",))))
        self.assertEqual(sm.first_appearance(p("3+2(x+1)")), (((), ()),))
        self.assertEqual(sm.first_appearance(p("{n1}x+y")), ((("y",), ("y",)),))
        self.assertEqual(sm.first_appearance(p("x-(-3)+(-2)")), ((("x",), ("x",)), ((), ())))
        self.code("MATH_PARSE", sm.first_appearance, p("y=2", allow_relation=True))

    def test_key_node(self):
        self.assertEqual(sm.key_node({}, ()), Num("0"))
        self.assertEqual(sm.key_node({(): 0, ("x",): Fraction(0)}, ()), Num("0"))
        self.assertEqual(sm.key_node({(): Fraction(-6)}, ()), Neg(Num("6")))
        order = sm.first_appearance(p("3x+5+2x-1"))
        self.assertEqual(sm.key_node({("x",): 5, (): 4}, order),
                         Sum(Product(Num("5"), (("", Var("x")),)), (("+", Num("4")),)))
        self.assertEqual(sm.unparse(sm.key_node({(): 7, ("x",): 3}, sm.first_appearance(p("5+3x+2")))), "7+3x")
        self.assertEqual(sm.unparse(sm.key_node({(): 1, ("x",): 2, ("x", "x"): 3, ("a",): 4}, ())), "3x^2+4a+2x+1")
        self.assertEqual(sm.unparse(sm.key_node({("x", "y"): 1}, ((("x", "y"), ("y", "x")),))), "yx")
        self.assertEqual(sm.unparse(sm.key_node({("x", "y"): -1}, ())), "-xy")
        self.assertEqual(sm.unparse(sm.key_node({("x", "x", "y"): 2}, ())), "2x^2y")
        self.assertEqual(sm.unparse(sm.key_node({("a",): -2, (): 10}, ((("a",), ("a",)),))), "-2a+10")
        self.assertEqual(sm.unparse(sm.key_node({("x",): 1, ("y",): -1}, ())), "x-y")
        self.assertEqual(sm.unparse(sm.key_node({("y",): 1, ("x",): -1}, ((("y",), ("y",)),))), "y-x")
        self.assertEqual(sm.unparse(sm.key_node({(): 3, ("b",): 1}, ((("c",), ("c",)), ((), ())))), "3+b")

    def test_fraction_coefficients(self):
        half = sm.key_node({("x",): Fraction(1, 2)}, ())
        self.assertEqual(sm.unparse(half), "1/2x")
        self.assertEqual(sm.to_house(half), "\\f{1}{2}x")
        self.assertTrue(sm.kernel_equal(half, operation("divide", X, number(2))))
        minus = sm.key_node({(): Fraction(-3, 4)}, ())
        self.assertEqual((sm.unparse(minus), sm.to_house(minus)), ("-3/4", MINUS + "\\f{3}{4}"))
        self.assertEqual(sm.unparse(sm.key_node({("x",): Fraction(-2, 3), (): 1}, ())), "-2/3x+1")

    def test_key_node_input_rules(self):
        for poly, order in (([(("x",), 1)], ()), ({("y", "x"): 1}, ()), ({("x",): 0.5}, ()), ({("x",): True}, ()),
                            ({"x": 1}, ()), ({("X",): 1}, ()), ({("x",): 1}, ((("x",), ("y",)),))):
            with self.subTest(poly=poly, order=order):
                with self.assertRaises(ValueError):
                    sm.key_node(poly, order)
        self.code("FORM_UNREPRESENTABLE", sm.key_node, {("x",) * 10: 1}, ())

    def test_key_from_result_needs_the_tasks_letters(self):
        self.code("MATH_SYMBOL_UNDECLARED", sm.key_from_result, Y, p("x"))
        self.code("FORM_UNREPRESENTABLE", sm.key_from_result, operation("divide", number(1), X), p("x"))


class KeyRoundtripTests(SchoolMathCase):
    def setUp(self):
        self.task = p("3x+5+2x-1")
        self.result = simplified(self.task)

    def test_kernel_equal(self):
        self.assertTrue(sm.kernel_equal(p("5x+4"), self.result))
        self.assertTrue(sm.kernel_equal(p("4+5x"), self.result))
        self.assertFalse(sm.kernel_equal(p("5x+5"), self.result))
        self.assertFalse(sm.kernel_equal(p("x"), Y))
        self.assertFalse(sm.kernel_equal(p("x"), {"type": "symbol", "name": "c"}))
        self.assertFalse(sm.kernel_equal(p("x"), "x"))
        self.assertFalse(sm.kernel_equal(p("c", letters=("c",)), Y))                  # unmapped letter
        self.assertTrue(sm.kernel_equal(p("c", letters=("c",)), Y, {"c": "y"}))
        self.assertFalse(sm.kernel_equal(p("{n1}"), number(1)))
        with patch.object(sm, "validate_and_solve_task", side_effect=MathTaskError("RESOURCE_LIMIT", "stub")):
            self.assertFalse(sm.kernel_equal(p("5x+4"), self.result))

    def test_key_roundtrip(self):
        key = {"form": "expression", "notation": "5x+4", "symbols": ["x"], "binding": {"kind": "collect_like_terms"}}
        self.assertTrue(sm.key_roundtrip(key, self.result))
        self.assertTrue(sm.key_roundtrip({"notation": "4+5x", "symbols": ["x"]}, self.result))  # order is not value
        self.assertFalse(sm.key_roundtrip({"notation": "5x+5", "symbols": ["x"]}, self.result))
        self.assertFalse(sm.key_roundtrip({"notation": "5x + 4", "symbols": ["x"]}, self.result))  # not canonical
        self.assertFalse(sm.key_roundtrip({"notation": "5x+4", "symbols": []}, self.result))
        self.assertFalse(sm.key_roundtrip({"notation": "5x+4", "symbols": "x"}, self.result))
        self.assertFalse(sm.key_roundtrip({"notation": "5x+04", "symbols": ["x"]}, self.result))
        self.assertFalse(sm.key_roundtrip({"symbols": ["x"]}, self.result))
        self.assertFalse(sm.key_roundtrip("5x+4", self.result))
        self.assertFalse(sm.key_roundtrip(key, {"type": "number"}))
        self.assertFalse(sm.key_roundtrip({"notation": "x=1", "symbols": ["x"]}, number(1)))
        self.assertTrue(sm.key_roundtrip({"notation": "-6", "symbols": []}, number(-6)))
        self.assertFalse(sm.key_roundtrip({"notation": "6", "symbols": []}, number(-6)))

    def test_a_wrong_printer_fails_the_round_trip(self):
        key = {"notation": "5x+4", "symbols": ["x"]}
        real = sm.to_house
        with patch.object(sm, "to_house", side_effect=lambda node: real(node).replace("4", "5")):
            self.assertFalse(sm.key_roundtrip(key, self.result))
        with patch.object(sm, "to_house", side_effect=lambda node: real(node).replace(MINUS, "-")):
            self.assertFalse(sm.key_roundtrip({"notation": "-6", "symbols": []}, number(-6)))
        with patch.object(sm, "validate_and_solve_task", side_effect=MathTaskError("RESOURCE_LIMIT", "stub")):
            self.assertFalse(sm.key_roundtrip(key, self.result))
        self.assertTrue(sm.key_roundtrip(key, self.result))


class HouseTests(SchoolMathCase):
    PRINTS = {
        "3x+5+2x-1": "3x + 5 + 2x − 1", "(-3)+(-4)": "(−3) + (−4)", "5-(-2)": "5 − (−2)", "2(x+3)": "2(x + 3)",
        "-4y+9+6y-2": "−4y + 9 + 6y − 2", "4y-y": "4y − y", "2*3+4": "2 · 3 + 4", "12:4": "12 : 4",
        "9/25": "\\f{9}{25}", "x^2": "x^{2}", "30%": "30\\%", "2.5x": "2.5x", "(1/2)^2": "\\g{\\f{1}{2}}^{2}",
        "1/2x": "\\f{1}{2}x", "6:2/3": "\\f{6 : 2}{3}", "2x/3": "\\f{2x}{3}", "-(x+1)": "−(x + 1)",
        "-3^2": "−3^{2}", "(-3)^2": "(−3)^{2}", "3xy": "3xy", "x(-3)": "x(−3)", "(x+1)(x+2)": "(x + 1)(x + 2)",
        "(x^2+1)": "\\g{x^{2} + 1}", "-x": "−x", "x/(y+1)": "\\f{x}{(y + 1)}", "2x*3y": "2x · 3y", "-0": "−0",
    }

    def test_house_strings(self):
        for text, house in self.PRINTS.items():
            with self.subTest(text=text):
                self.assertEqual(sm.to_house(p(text)), house)
        self.assertEqual(sm.to_house(p("y=-2", allow_relation=True)), "y = −2")
        self.assertEqual(sm.to_house(p("x=20%", allow_relation=True)), "x = 20\\%")
        self.assertEqual(sm.to_house(p("3x+5x=8x", allow_relation=True)), "3x + 5x = 8x")
        self.assertEqual(sm.to_house(p("ax^2+bx+c", letters=ABCX)), "ax^{2} + bx + c")

    def test_never_an_ascii_hyphen(self):
        for text in CORPUS + RELATIONS:
            if "{" in text:
                continue
            with self.subTest(text=text):
                house = sm.to_house(p(text, allow_relation=True))
                self.assertNotIn("-", house)
                self.assertEqual(house.count(MINUS), text.count("-"))

    def test_references_are_resolved_before_printing(self):
        self.code("MATH_PARSE", sm.to_house, p("{n1}x"))
        self.code("MATH_PARSE", sm.to_house, Ref("n1"))
        self.assertEqual(sm.to_house(sm.resolve(p("{n1}x"), {"n1": "-2"})), "(−2)x")

    def test_islands(self):
        self.assertEqual(sm.display_island(span("3x+5+2x-1", "x")), "$3x + 5 + 2x − 1$")
        self.assertEqual(sm.display_island(span("4y-y", "y")) + " עבור " + sm.display_island(span("y=-2", "y")),
                         "$4y − y$ עבור $y = −2$")
        self.assertEqual("מספר הגדול פי " + sm.display_island(span("4")) + " מ־" + sm.display_island(span("x", "x")),
                         "מספר הגדול פי $4$ מ־$x$")
        self.assertEqual("כינוס הביטוי " + sm.display_island(span("4a+3+a+2", "a")) + " נתן "
                         + sm.display_island(span("10a", "a")), "כינוס הביטוי $4a + 3 + a + 2$ נתן $10a$")
        self.assertEqual(sm.display_island(span("3x+5x=8x", "x")), "$3x + 5x = 8x$")
        self.assertEqual(sm.key_island({"form": "expression", "notation": "5x+4", "symbols": ["x"]}), "$5x + 4$")
        self.assertEqual(sm.key_island({"form": "integer", "notation": "-6", "symbols": []}), "$−6$")

    def test_island_refusals(self):
        self.code("MATH_PARSE", sm.key_island, {"notation": "x=1", "symbols": ["x"]})        # a key is no relation
        self.code("MATH_SYMBOL_UNDECLARED", sm.display_island, span("4y-y", "x"))
        self.code("MATH_SYMBOL_UNDECLARED", sm.display_island, {"notation": "x", "symbols": "x"})
        self.code("MATH_SYMBOL_UNDECLARED", sm.display_island, {"notation": "x"})
        self.code("MATH_PARSE", sm.display_island, {"symbols": ["x"]})
        self.code("MATH_PARSE", sm.display_island, "x")
        self.code("MATH_PARSE", sm.key_island, {"notation": "{n1}", "symbols": []})

    def test_from_house_flat_round_trip(self):
        count = 0
        for text in CORPUS + RELATIONS:
            node = p(text, allow_relation=True)
            if "{" in text or "^" in text or "/" in text:
                continue
            with self.subTest(text=text):
                house = sm.to_house(node)
                self.assertEqual(sm.from_house_flat(house, letters=LETTERS, allow_relation=True), node)
                count += 1
        self.assertGreaterEqual(count, 50)
        self.assertEqual(sm.from_house_flat("30\\%", letters=()), Num("30%"))
        self.assertEqual(sm.from_house_flat("y = −2", letters="y", allow_relation=True),
                         Relation(Var("y"), "=", Neg(Num("2"))))

    def test_from_house_flat_refusals(self):
        for text in ("x^{2}", "\\f{1}{2}", "\\g{x}", "5x+4", "5x  +  4", "5x + 4 ", " 5x + 4", "3 4", "5x - 4",
                     "2 * 3", "2/3", "30%", "x = 20%", "5x" + MINUS + "4", "(−3)+(−4)", "2 ·3", "12:4", "−(x+1)",
                     "{n1}", "\\%", "שלום", "", "5x + 4$"):
            with self.subTest(text=text):
                self.code("MATH_PARSE", sm.from_house_flat, text, letters=LETTERS, allow_relation=True)
        self.code("MATH_PARSE", sm.from_house_flat, "y = −2", letters=LETTERS)            # relation not allowed
        self.code("MATH_SYMBOL_UNDECLARED", sm.from_house_flat, "5x + 4", letters=())
        self.code("MATH_PARSE", sm.from_house_flat, None, letters=LETTERS)
        self.code("MATH_LENGTH", sm.from_house_flat, "1" * 1000, letters=LETTERS)


class RtlPrintMatrixTests(SchoolMathCase):
    """The 13 RTL/print cases of plan §e4 at string level. Each island is one `$…$` built by code and becomes one
    direction:ltr element (span.m), so its glyphs print in string order; the checks pin that order to the plan's
    'Expected order' column, and show that the defective forms cannot be written at all."""

    def assertIsland(self, island, plan_order):
        self.assertEqual(island.count("$"), 2)
        self.assertTrue(island.startswith("$") and island.endswith("$"))
        self.assertNotIn("-", island)
        self.assertFalse(re.search("[֐-׿]", island))
        self.assertEqual(" ".join(glyphs(island)), plan_order)

    def test_01_percent_given_and_key(self):
        self.assertEqual(sm.display_island(span("30%")), "$30\\%$")
        self.assertEqual(sm.key_island({"notation": "30%", "symbols": []}), "$30\\%$")
        self.assertIsland("$30\\%$", "3 0 %")
        self.code("MATH_PARSE", p, "30 %")            # today's "$30$ %" split cannot be written

    def test_02_relation_key_with_percent(self):
        island = sm.display_island(span("x=20%", "x"))
        self.assertEqual(island, "$x = 20\\%$")
        self.assertIsland(island, "x = 2 0 %")

    def test_03_declared_letters_mapped_internally(self):
        island = sm.display_island(span("ax^2+bx+c", ABCX))
        self.assertEqual(island, "$ax^{2} + bx + c$")
        self.assertIsland(island, "a x 2 + b x + c")
        mapping = sm.kernel_mapping(ABCX)
        self.assertEqual(mapping["c"], "y")                       # renamed only inside the kernel
        task = p("ax^2+bx+c", letters=ABCX)
        key = sm.key_from_result(simplified(task, mapping), task, mapping)
        self.assertEqual(sm.key_island({"notation": sm.unparse(key), "symbols": list(ABCX)}), island)

    def test_04_question_marker(self):
        # Markers come from the pinned ltr_marker as "(n)" (see PinnedEmitterTests); no island can carry the
        # forbidden forms, because the grammar cannot write them.
        self.assertIsland("$" + sm.to_house(p("(1)")) + "$", "( 1 )")
        for marker in ("1.", ".1", "1)", "(1", "1-"):
            self.code("MATH_PARSE", p, marker)

    def test_05_hebrew_sub_label(self):
        # "א." stays RTL prose: Hebrew can never enter an island.
        for label in ("א.", "א", "(א)"):
            self.code("MATH_PARSE", p, label)

    def test_06_negative_number_and_value(self):
        self.assertEqual(sm.display_island(span("-5")), "$−5$")
        self.assertEqual(sm.key_island({"notation": "-5", "symbols": []}), "$−5$")
        self.assertIsland("$−5$", "− 5")
        island = sm.display_island(span("y=-2", "y"))
        self.assertEqual(island, "$y = −2$")
        self.assertIsland(island, "y = − 2")

    def test_07_negative_numbers_keep_their_brackets(self):
        first, second = sm.display_island(span("(-3)+(-4)")), sm.display_island(span("5-(-2)"))
        self.assertEqual((first, second), ("$(−3) + (−4)$", "$5 − (−2)$"))
        self.assertIsland(first, "( − 3 ) + ( − 4 )")
        self.assertIsland(second, "5 − ( − 2 )")
        self.assertEqual((evaluated(p("(-3)+(-4)")), evaluated(p("5-(-2)"))), (number(-7), number(7)))

    def test_08_square_of_negative_versus_negative_square(self):
        square, negative = sm.display_island(span("(-3)^2")), sm.display_island(span("-3^2"))
        self.assertEqual((square, negative), ("$(−3)^{2}$", "$−3^{2}$"))
        self.assertIsland(square, "( − 3 ) 2")
        self.assertIsland(negative, "− 3 2")
        self.assertNotEqual(p("(-3)^2"), p("-3^2"))
        self.assertEqual((evaluated(p("(-3)^2")), evaluated(p("-3^2"))), (number(9), number(-9)))

    def test_09_only_written_brackets(self):
        island = sm.display_island(span("2(x+3)", "x"))
        self.assertEqual(island, "$2(x + 3)$")
        self.assertIsland(island, "2 ( x + 3 )")
        times = sm.display_island(span("2*3+4"))
        self.assertEqual(times, "$2 · 3 + 4$")                    # no brackets added around 2·3
        self.assertIsland(times, "2 · 3 + 4")

    def test_10_stacked_fraction(self):
        island = sm.display_island(span("9/25"))
        self.assertEqual(island, "$\\f{9}{25}$")
        self.code("MATH_PARSE", sm.from_house_flat, "\\f{9}{25}", letters=())   # not flat: stage 3 renders it
        self.assertEqual(sm.to_house(p("9:25")), "9 : 25")          # ':' stays a spaced colon

    def test_11_quotient_and_remainder(self):
        # "31 שארית 1": two islands with Hebrew between (the remainder task kind is stage 3).
        text = sm.display_island(span("31")) + " שארית " + sm.display_island(span("1"))
        self.assertEqual(text, "$31$ שארית $1$")
        self.assertIsland("$31$", "3 1")
        self.code("MATH_PARSE", p, "31 שארית 1")

    def test_12_substitution_prompt(self):
        text = sm.display_island(span("4y-y", "y")) + " עבור " + sm.display_island(span("y=-2", "y"))
        self.assertEqual(text, "$4y − y$ עבור $y = −2$")
        self.assertIsland("$4y − y$", "4 y − y")

    def test_13_units(self):
        # Hebrew unit words go outside the island with a no-break space; °, ₪ and unit words never enter one.
        self.assertEqual(sm.display_island(span("12")) + " ס״מ", "$12$ ס״מ")
        for text in ("30°", "12₪", "₪12", "12 ס״מ", "12 ס״מ"):
            self.code("MATH_PARSE", p, text)
        self.code("MATH_SYMBOL_UNDECLARED", p, "12cm")


class CheckTests(SchoolMathCase):
    """Hand-built trees the grammar cannot produce are refused by every printer and converter."""
    INVALID = [
        Sum(Var("x"), ()), Product(Num("3"), (("", Num("4")),)), Product(Var("x"), (("^", Var("y")),)),
        Neg(Neg(Num("1"))), Sum(Var("x"), (("+", Neg(Num("1"))),)), Power(Var("x"), 10), Power(Var("x"), True),
        Power(Power(Var("x"), 2), 2), Group(Relation(Var("x"), "=", Num("1"))), Num("05"), Num("1."), Num("-1"),
        Var("X"), Var("xy"), Ref("n9"), Product(Sum(Var("x"), (("+", Num("1")),)), (("", Var("y")),)), "x",
        Product(Var("x"), (("", Power(Num("2"), 2)),)), Relation(Var("x"), "<", Num("1")),
        Sum(Sum(Var("x"), (("+", Num("1")),)), (("+", Num("2")),)), Product(Var("x"), [("", Var("y"))]),
        Neg(Sum(Var("x"), (("+", Num("1")),))), Power(Neg(Num("3")), 2), None,
    ]

    def test_invalid_trees(self):
        for node in self.INVALID:
            with self.subTest(node=node):
                for function in (sm.unparse, sm.to_house, sm.to_kernel, sm.letters_of, sm.first_appearance):
                    self.code("MATH_PARSE", function, node)
                self.code("MATH_PARSE", sm.check_scope, node, PROFILE)

    def test_deep_trees_are_refused_not_crashed(self):
        node = Var("x")
        for _ in range(500):
            node = Group(node)
        self.code("MATH_PARSE", sm.unparse, node)


class DeterminismTests(unittest.TestCase):
    def test_same_input_same_bytes(self):
        for text in CORPUS:
            if "{" in text:
                continue
            first = json.dumps(sm.to_kernel(p(text)), ensure_ascii=False)
            self.assertEqual(first, json.dumps(sm.to_kernel(p(text)), ensure_ascii=False))
            self.assertEqual(sm.to_house(p(text)), sm.to_house(p(text)))

    def test_codes(self):
        self.assertEqual(sm.ERROR_CODES, frozenset({"MATH_PARSE", "MATH_LENGTH", "MATH_SYMBOL_UNDECLARED",
                                                     "REF_UNDECLARED", "FORM_UNREPRESENTABLE"}))
        for code in sm.ERROR_CODES | sm.SCOPE_CODES:
            self.assertRegex(code, r"^[A-Z_]{1,60}$")          # G9: no digits
        with self.assertRaises(ValueError):
            SchoolMathError("D12_MIRROR", "unknown codes are a programming error")
        self.assertIsInstance(SchoolMathError("MATH_PARSE", "m"), ValueError)

    def test_kernel_round_trip_property(self):
        # Every corpus expression, simplified by the kernel and printed as a key, is the same value again.
        rational = {"x:y:a"}                                   # x/(ya): no polynomial, so no printable key
        for text in rational:
            with self.assertRaises(SchoolMathError) as raised:
                sm.key_from_result(simplified(p(text)), p(text))
            self.assertEqual(raised.exception.code, "FORM_UNREPRESENTABLE")
        for text in CORPUS:
            if "{" in text or text in rational:
                continue
            with self.subTest(text=text):
                node = p(text)
                result = simplified(node)
                key = sm.key_from_result(result, node)
                self.assertTrue(sm.kernel_equal(key, result))
                self.assertTrue(sm.kernel_equal(node, result))
                self.assertEqual(sm.polynomial(key), sm.polynomial(node))


# ------------------------------------------------- the pinned middle emitter (guarded like existing tests) ----
MIDDLE = Path(os.environ.get("MIDDLE_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet")))
LOCK = Path(__file__).resolve().parents[1] / "skill-lock.json"


def pinned_emitter():
    """The pinned middle emit_html, loaded by path only after its sha256 (and its font's) match skill-lock.json;
    no sys.path change, no bytecode written. None when unavailable."""
    try:
        pins = json.loads(LOCK.read_text(encoding="utf-8"))["skills"]["middle"]["files"]
    except (OSError, ValueError, KeyError):
        return None
    for name in ("emit_html.py", "assets/DavidLibre-Regular.ttf"):
        path = MIDDLE / name
        if path.is_symlink() or not path.is_file() or hashlib.sha256(path.read_bytes()).hexdigest() != pins.get(name):
            return None
    try:
        import fontTools  # noqa: F401  (emit_html reads its body font's cmap at import)
    except ImportError:
        return None
    spec = importlib.util.spec_from_file_location("_v5_school_math_pinned_emit_html", MIDDLE / "emit_html.py")
    module = importlib.util.module_from_spec(spec)
    previous, sys.dont_write_bytecode = sys.dont_write_bytecode, True
    try:
        spec.loader.exec_module(module)
    finally:
        sys.dont_write_bytecode = previous
    return module


class Islands(HTMLParser):
    """The text of every span.m (one island) in emitted HTML, and what the emitter put inside the islands."""

    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.islands, self.depth, self.classes = [], 0, []

    def handle_starttag(self, tag, attrs):
        classes = (dict(attrs).get("class") or "").split()
        if self.depth:
            self.depth += 1
            self.classes.extend(classes + ([tag] if tag == "sup" else []))
        elif tag == "span" and "m" in classes:
            self.depth = 1
            self.islands.append("")

    def handle_endtag(self, tag):
        if self.depth:
            self.depth -= 1

    def handle_data(self, data):
        if self.depth:
            self.islands[-1] += data


class PinnedEmitterTests(unittest.TestCase):
    """The house strings, run through the pinned middle skill's own emitter (emit_html.seg / m_body)."""

    @classmethod
    def setUpClass(cls):
        before = sorted(MIDDLE.rglob("emit_html*.pyc")) if MIDDLE.is_dir() else []
        cls.emit = pinned_emitter()
        cls.bytecode = (before, sorted(MIDDLE.rglob("emit_html*.pyc")) if MIDDLE.is_dir() else [])
        if cls.emit is None:
            raise unittest.SkipTest("Pinned middle skill unavailable")

    def read(self, text):
        out = self.emit.seg(text)
        reader = Islands()
        reader.feed(out)
        return out, reader

    def test_loading_wrote_no_bytecode(self):
        self.assertEqual(*self.bytecode)

    def test_island_strings_render_as_one_ltr_element_each(self):
        cases = [  # (sheet string, island texts, binary +/− spans, relation spans, superscripts, fractions)
            ("$3x + 5 + 2x − 1$", ["3x + 5 + 2x − 1"], 3, 0, 0, 0),
            ("$4y − y$ עבור $y = −2$", ["4y − y", "y = −2"], 1, 1, 0, 0),
            ("מספר הגדול פי $4$ מ־$x$", ["4", "x"], 0, 0, 0, 0),
            ("כינוס הביטוי $4a + 3 + a + 2$ נתן $10a$", ["4a + 3 + a + 2", "10a"], 3, 0, 0, 0),
            ("$(−3) + (−4)$", ["(−3) + (−4)"], 1, 0, 0, 0),
            ("$5 − (−2)$", ["5 − (−2)"], 1, 0, 0, 0),
            ("$−6$", ["−6"], 0, 0, 0, 0),
            ("$5x + 4$", ["5x + 4"], 1, 0, 0, 0),
            ("$−2a + 10$", ["−2a + 10"], 1, 0, 0, 0),
            ("$30\\%$", ["30%"], 0, 0, 0, 0),
            ("$x = 20\\%$", ["x = 20%"], 0, 1, 0, 0),
            ("$2(x + 3)$", ["2(x + 3)"], 1, 0, 0, 0),
            ("$2 · 3 + 4$", ["2 · 3 + 4"], 1, 0, 0, 0),
            ("$ax^{2} + bx + c$", ["ax2 + bx + c"], 2, 0, 1, 0),
            ("$(−3)^{2}$", ["(−3)2"], 0, 0, 1, 0),
            ("$−3^{2}$", ["−32"], 0, 0, 1, 0),
            ("$\\f{9}{25}$", ["925"], 0, 0, 0, 1),
        ]
        for text, islands, op1, op2, sup, frac in cases:
            with self.subTest(text=text):
                out, reader = self.read(text)
                self.assertEqual(reader.islands, islands)
                self.assertEqual(reader.classes.count("op1"), op1)        # binary signs get breathing room
                self.assertEqual(reader.classes.count("op2"), op2)        # a unary minus stays glued
                self.assertEqual(reader.classes.count("sup"), sup)
                self.assertEqual(reader.classes.count("frac"), frac)
                self.assertNotIn("-", "".join(reader.islands))
                self.assertFalse(re.search(r"[\\{}^$]", out))             # all markup consumed

    def test_every_printed_corpus_expression_renders(self):
        for text in CORPUS + RELATIONS:
            if "{" in text:
                continue
            with self.subTest(text=text):
                island = "$" + sm.to_house(p(text, allow_relation=True)) + "$"
                out, reader = self.read("חשבו " + island + " עכשיו")
                self.assertEqual(len(reader.islands), 1)
                self.assertNotIn("-", reader.islands[0])
                self.assertFalse(re.search(r"[\\{}^$]", out))
                if "^" not in text and "/" not in text:
                    self.assertEqual(reader.islands[0], island[1:-1].replace("\\%", "%"))

    def test_markers_and_labels_come_from_the_pinned_skill(self):
        self.assertEqual(self.emit.ltr_marker(1), '<span class="qnum">(1)</span>')
        self.assertTrue(self.emit.MARKER_RE.match("(12)"))
        for bad in ("1.", ".1", "1)"):
            self.assertFalse(self.emit.MARKER_RE.match(bad))
        self.assertEqual(self.emit.item_label("א"), '<span class="imark">א.</span>')


if __name__ == "__main__":
    unittest.main()
