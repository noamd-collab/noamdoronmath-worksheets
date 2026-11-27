"""v5 mistake models M1/M2/M3 for find_error_collect (V5-DESIGN.md sections 2.7, 3, 7).

mistake_models reads school_math CST nodes by class name and field (section 2.4).
The nodes here come from school_math.parse when E1's module is importable, and
otherwise from the small section 2.4 node set below; the non-monomial shapes are
built by hand either way, so the field contract itself is exercised.
"""
from __future__ import annotations

import re
import sys
import unittest
from dataclasses import dataclass
from fractions import Fraction
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import mistake_models  # noqa: E402
from mistake_models import MISTAKES, MistakeError, apply, polynomial, verify_wrong, written_terms  # noqa: E402

LETTERS = ("x", "y", "a", "b")


# ---- the section 2.4 CST node set (names and fields as specified) ----------------------------
@dataclass(frozen=True)
class Num:
    text: str


@dataclass(frozen=True)
class Var:
    name: str


@dataclass(frozen=True)
class Ref:
    given: str


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
class Power:
    base: object
    exponent: int


@dataclass(frozen=True)
class Relation:
    left: object
    op: str
    right: object


def _term_node(token):
    negative = re.fullmatch(r"\(-(\d+)\)", token)
    if negative:
        return Group(Neg(Num(negative.group(1))))
    digits, names = re.fullmatch(r"(\d*)([a-z]*)", token).groups()
    factors = ([Num(digits)] if digits else []) + [Var(name) for name in names]
    return factors[0] if len(factors) == 1 else Product(factors[0], tuple(("", f) for f in factors[1:]))


def local_parse(text):
    """Monomial sums only: [-]term([+-]term)*, term = (-n) | n | [n]letter[letter]."""
    tokens = re.findall(r"[+-]|\(-\d+\)|\d*[a-z]+|\d+", text)
    assert "".join(tokens) == text, text
    lead = tokens[0] == "-"
    pieces, op = [], ""
    for token in tokens[1:] if lead else tokens:
        if token in ("+", "-"):
            op = token
            continue
        pieces.append((op, _term_node(token)))
    first = Neg(pieces[0][1]) if lead else pieces[0][1]
    return Sum(first, tuple(pieces[1:])) if len(pieces) > 1 else first


try:  # E1's parser when it has landed; the section 2.4 node set otherwise
    import school_math  # noqa: E402
except ImportError:
    school_math = None


def parse(text):
    return school_math.parse(text, letters=LETTERS) if school_math is not None else local_parse(text)


def poly(**terms):
    """poly(a=10, _=5) -> {('a',): 10, (): 5}; 'ab' -> ('a', 'b')."""
    return {(() if name == "_" else tuple(sorted(name))): Fraction(value) for name, value in terms.items()}


class ExampleTests(unittest.TestCase):
    def test_the_section_2_7_examples(self):
        self.assertEqual(MISTAKES, ("M1", "M2", "M3"))
        self.assertEqual(apply("M1", parse("4a+3+a+2")), poly(a=10))
        self.assertEqual(apply("M2", parse("6x+7-1-2x")), poly(x=4, _=8))
        self.assertEqual(apply("M3", parse("5b+2a+b")), poly(b=5, a=2))

    def test_the_fixture_find_error_question(self):
        # Q18 of section 2.1: each wrong result is modeled, each is wrong, and the keys are 5a+5, 4x+6, 6b+2a.
        for model, expr, wrong, key in (("M1", "4a+3+a+2", "10a", poly(a=5, _=5)),
                                        ("M2", "6x+7-1-2x", "4x+8", poly(x=4, _=6)),
                                        ("M3", "5b+2a+b", "5b+2a", poly(b=6, a=2))):
            self.assertEqual(verify_wrong(model, parse(expr), parse(wrong)), polynomial(parse(wrong)))
            self.assertEqual(polynomial(parse(expr)), key)
            self.assertNotEqual(apply(model, parse(expr)), key)

    def test_results_are_exact_ordered_and_deterministic(self):
        first, second = apply("M2", parse("-4y+9+6y-2")), apply("M2", parse("-4y+9+6y-2"))
        self.assertEqual(first, poly(y=2, _=11))
        self.assertEqual(list(first.items()), list(second.items()))
        self.assertEqual(list(first), [("y",), ()])                     # first written order
        self.assertTrue(all(type(value) is Fraction for value in first.values()))
        self.assertEqual(polynomial(parse("-4y+9+6y-2")), poly(y=2, _=7))
        self.assertEqual(polynomial(parse("3x-3x")), {})                # zero coefficients are dropped


class ModelSemanticsTests(unittest.TestCase):
    def test_m1_adds_everything_into_the_first_letter_signature(self):
        self.assertEqual(apply("M1", parse("3+4a+a+2")), poly(a=10))     # the first term may be a constant
        self.assertEqual(apply("M1", parse("6x+7-1-2x")), poly(x=10))    # signed coefficients
        self.assertEqual(apply("M1", parse("2ab+3a+1")), poly(ab=6))
        self.assertEqual(apply("M1", parse("x-(-3)")), poly(x=4))        # -(-3) adds +3

    def test_m2_flips_only_the_first_binary_minus(self):
        self.assertEqual(apply("M2", parse("x-3-2x")), poly(x=-1, _=3))
        self.assertEqual(apply("M2", parse("x-(-3)+2x")), poly(x=3, _=-3))   # x+(-3)+2x
        # A leading unary minus is not a binary minus.
        self.assertEqual(apply("M2", parse("-x+5-2")), poly(x=-1, _=7))
        # The zero literal: M2 changes nothing; the caller's MISTAKE_NOT_WRONG decides (section 7).
        self.assertEqual(apply("M2", parse("4x+7-0+x")), polynomial(parse("4x+7-0+x")))

    def test_m3_drops_the_first_implicit_one_term_with_a_like_term(self):
        self.assertEqual(apply("M3", parse("5b+2a-b")), poly(b=5, a=2))     # either sign
        self.assertEqual(apply("M3", parse("a+3a+b+2b")), poly(a=3, b=3))   # only the first
        self.assertEqual(apply("M3", parse("5b+a+2a+b")), poly(b=6, a=2))   # 'a' has a like term, so it goes first
        self.assertEqual(apply("M3", parse("ab+3ab+2")), poly(ab=3, _=2))   # implicit 1 on two letters
        self.assertEqual(apply("M3", parse("-y+4y")), poly(y=4))            # a leading unary minus

    def test_written_terms_keep_the_operator_and_the_sign(self):
        terms = written_terms(parse("-4y+9+6y-2"))
        self.assertEqual([(t.op, t.sign, t.coefficient, t.signature, t.implicit_one) for t in terms],
                         [("", -1, 4, ("y",), False), ("+", 1, 9, (), False), ("+", 1, 6, ("y",), False),
                          ("-", -1, 2, (), False)])
        terms = written_terms(parse("x-(-3)"))
        self.assertEqual([(t.op, t.sign, t.coefficient) for t in terms], [("", 1, 1), ("-", 1, 3)])
        self.assertTrue(terms[0].implicit_one)

    def test_hand_built_nodes_follow_the_field_contract(self):
        # 4a+3+a+2 and 5b+2a+b written out node by node (section 2.4 names and fields).
        four_a = Product(Num("4"), (("", Var("a")),))
        node = Sum(four_a, (("+", Num("3")), ("+", Var("a")), ("+", Num("2"))))
        self.assertEqual(apply("M1", node), poly(a=10))
        node = Sum(Product(Num("5"), (("", Var("b")),)), (("+", Product(Num("2"), (("", Var("a")),))), ("+", Var("b"))))
        self.assertEqual(apply("M3", node), poly(b=5, a=2))
        node = Sum(Neg(Var("x")), (("-", Group(Neg(Num("2")))), ("+", Num("5"))))   # -x-(-2)+5
        self.assertEqual(polynomial(node), poly(x=-1, _=7))
        self.assertEqual(apply("M2", node), poly(x=-1, _=3))


class RefusalTests(unittest.TestCase):
    def assertCode(self, code, function, *args):
        with self.assertRaises(MistakeError) as caught:
            function(*args)
        self.assertEqual(caught.exception.code, code)
        self.assertIsInstance(caught.exception, ValueError)

    def test_unknown_models(self):
        for model in ("M9", "M0", "m1", "", None, 1, ("M1",)):
            self.assertCode("MISTAKE_UNKNOWN", apply, model, parse("4a+3+a+2"))
        self.assertCode("MISTAKE_UNKNOWN", apply, "M9", "not a node")      # the model is judged first

    def test_each_precondition_failure_is_not_applicable(self):
        cases = [("M1", "3x+5x"),        # one signature
                 ("M1", "3+4"),          # constants only
                 ("M1", "2a-2"),         # K = 0
                 ("M1", "x-3+2"),        # K = 0
                 ("M2", "4a+3+a+2"),     # no binary minus
                 ("M2", "-x+3"),         # only a unary minus
                 ("M2", "5x"),           # a single term
                 ("M3", "4a+3+2a"),      # section 7: no implicit-1 term
                 ("M3", "5b+a+2b"),      # the implicit-1 term has no like term
                 ("M3", "7")]
        for model, expr in cases:
            self.assertCode("MISTAKE_NOT_APPLICABLE", apply, model, parse(expr))

    def test_a_node_that_is_no_monomial_sum_is_not_applicable(self):
        x = Var("x")
        shapes = [Sum(Power(x, 2), (("+", x),)),                                   # x^2+x
                  Product(Num("3"), (("", Group(Sum(x, (("+", Num("2")),)))),)),    # 3(x+2)
                  Sum(Product(Num("3"), (("*", x),)), (("+", x),)),                 # 3*x+x
                  Sum(Product(x, (("", x),)), (("+", x),)),                         # xx+x
                  Product(Num("2"), (("", x), ("", Var("y")), ("", Var("a")))),     # three letters
                  Relation(x, "=", Num("2")), Ref("n1"), Group(x), Sum(x, ()),
                  Neg(Neg(x)), "4a+3+a+2", None]
        for model in MISTAKES:
            for node in shapes:
                self.assertCode("MISTAKE_NOT_APPLICABLE", apply, model, node)

    def test_an_unmodeled_wrong_result(self):
        # Section 7: M1 on 4a+3+a+2 with 9a.
        self.assertCode("MISTAKE_UNMODELED", verify_wrong, "M1", parse("4a+3+a+2"), parse("9a"))
        self.assertCode("MISTAKE_UNMODELED", verify_wrong, "M2", parse("6x+7-1-2x"), parse("4x+6"))   # the correct key
        self.assertCode("MISTAKE_UNMODELED", verify_wrong, "M3", parse("5b+2a+b"), Power(Var("b"), 2))
        # The model's own refusals come first.
        self.assertCode("MISTAKE_UNKNOWN", verify_wrong, "M9", parse("4a+3+a+2"), parse("10a"))
        self.assertCode("MISTAKE_NOT_APPLICABLE", verify_wrong, "M3", parse("4a+3+2a"), parse("6a+3"))
        # An equal polynomial written in another order is the modeled result.
        self.assertEqual(verify_wrong("M2", parse("6x+7-1-2x"), parse("8+4x")), poly(x=4, _=8))

    def test_codes_have_no_digits_and_messages_hold_no_expression(self):
        self.assertEqual(mistake_models.CODES, ("MISTAKE_UNKNOWN", "MISTAKE_NOT_APPLICABLE", "MISTAKE_UNMODELED"))
        self.assertTrue(all(re.fullmatch(r"[A-Z_]{1,60}", code) for code in mistake_models.CODES))
        try:
            verify_wrong("M1", parse("4a+3+a+2"), parse("9a"))
        except MistakeError as error:
            self.assertNotRegex(str(error), r"[0-9]")


if __name__ == "__main__":
    unittest.main()
