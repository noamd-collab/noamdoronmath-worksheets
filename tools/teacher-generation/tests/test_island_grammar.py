from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import display_parts, expression, spans
from general_adapters import _answer_text, _elementary_math, _formula, rich_text
from general_source import GeneralSourceError, rich
from math_tasks import MAX_POWER, MathTaskError, number, operation, to_house_math, validate_and_solve_task
from printed_tasks import printed_solve

PI = {"type": "constant", "name": "pi"}
X = {"type": "symbol", "name": "x"}


def solved(kind, grade=8, **fields):
    names = ("variable", "relation")
    return validate_and_solve_task({"kind": kind, **{
        key: expression(value, grade) if isinstance(value, str) and key not in names else value
        for key, value in fields.items()}})


def code(function, *args, **kwargs):
    try:
        function(*args, **kwargs)
    except (GeneralSourceError, MathTaskError) as error:
        return error.code
    return None


def printed(value, grade=8):
    return rich_text(rich(spans(value, grade), grade, provider=True), grade)


class ExponentTests(unittest.TestCase):
    def test_powers_up_to_the_new_bound_are_exact(self):
        for source, grade, expected in [("2^5", 8, 32), ("10^6", 8, 1_000_000), ("2^5", 6, 32), ("10^6", 4, 1_000_000),
                                        ("10^12", 9, 10 ** 12), ("2^12", 7, 4096), ("(-2)^11", 8, -2048)]:
            with self.subTest(source=source, grade=grade):
                self.assertEqual(solved("evaluate", grade, expression=source)["result"]["value"], number(expected))
        self.assertEqual(solved("evaluate", expression="10^-6")["result"]["value"], number(1, 1_000_000))
        self.assertEqual(solved("simplify", expression="x^5 * x^3")["result"]["value"], operation("power", X, number(8)))
        self.assertEqual(to_house_math(solved("simplify", expression="x^8 / x^6")["result"]["value"]), "x^{2}")
        self.assertEqual(MAX_POWER, 12)

    def test_the_result_size_guards_still_fail_closed_with_a_code(self):
        for source, kind, expected in [
            ("2^13", "evaluate", "UNSUPPORTED_POWER"), ("2^-13", "evaluate", "UNSUPPORTED_POWER"),
            ("x^13", "simplify", "UNSUPPORTED_POWER"), ("2^(1+1)", "evaluate", "UNSUPPORTED_POWER"),
            # The value, not the exponent, is what must fit the printable budget.
            ("11^12", "evaluate", "RESOURCE_LIMIT"), ("999999^12", "evaluate", "RESOURCE_LIMIT"),
            ("(2^12)^12", "evaluate", "RESOURCE_LIMIT"), ("x^9", "simplify", "RESOURCE_LIMIT"),
            ("(x^4)^3", "expand", "RESOURCE_LIMIT"), ("(x+1)^7", "expand", "RESOURCE_LIMIT"),
        ]:
            with self.subTest(source=source):
                self.assertEqual(code(solved, kind, expression=source), expected)
        # Third-grade typography has no power, as before.
        self.assertEqual(code(expression, "2^3", 3), "SOURCE_NOTATION")

    def test_two_digit_exponents_print_in_both_schools(self):
        self.assertEqual(printed("[[2^10]]"), "$2^{10}$")
        self.assertEqual(printed("[[x^5 * x^3]]"), "$x^{5} · x^{3}$")
        # The schoolbook polynomial keeps its written coefficients up to the bound.
        self.assertEqual(printed("[[2x^10 + 3x]]"), "$2x^{10} + 3x$")
        self.assertEqual(printed("[[2x^12 - x^2]]"), "$2x^{12} − x^{2}$")
        self.assertEqual(code(spans, "[[2x^13]]", 8), "UNSUPPORTED_POWER")

        class Signs:
            fmt = staticmethod(lambda value, grade: str(value))
            op = staticmethod(lambda sign, grade: sign)
        self.assertEqual(_elementary_math(expression("2^10", 6), "ו", Signs), "(2)<sup>10</sup>")


class PiTests(unittest.TestCase):
    def test_pi_is_exact_in_grades_seven_to_nine(self):
        for source, key in [("pi*5^2", r"25\pi"), ("2*pi*5", r"10\pi"), ("π*5^2/2", r"\f{25}{2}\pi"),
                            ("2π", r"2\pi"), ("3*pi - pi", r"2\pi"), ("pi^2", r"\pi^{2}"), ("1/pi", r"\f{1}{\pi}"),
                            ("pi + 2", r"2 + \pi"), ("4*pi^2", r"4\pi^{2}"), ("pi*x/pi", "x")]:
            with self.subTest(source=source):
                kind = "simplify" if "x" in source else "evaluate"
                self.assertEqual(to_house_math(solved(kind, expression=source)["result"]["value"]), key)
        self.assertEqual(solved("compare", left="3*pi", right="10")["result"], {"type": "comparison", "relation": "less"})
        self.assertEqual(solved("compare", left="pi", right="frac(22,7)")["result"]["relation"], "less")
        self.assertEqual(solved("compare", left="2*pi", right="pi + pi")["result"]["relation"], "equal")
        self.assertEqual(expression("pi", 7), PI)
        self.assertEqual(expression("π", 9), PI)

    def test_pi_prints_as_the_pinned_skill_macro_and_keeps_the_key_in_terms_of_pi(self):
        self.assertEqual(printed("חשבו [[2*pi*5]] בדיוק."), r"חשבו $2\pi · 5$ בדיוק.")
        self.assertEqual(printed("שטח העיגול הוא [[π*r^2]]."), r"שטח העיגול הוא $\pi · r^{2}$.")
        self.assertEqual(printed("[[2πr]]"), r"$2\pi · r$")
        area = solved("evaluate", expression="pi*5^2")
        self.assertEqual(_answer_text(area, 'סמ"ר', 8), '$25\\pi$ סמ"ר')
        # A product of π alone is a plain math span, so a matching task is not printed twice.
        self.assertEqual(spans("[[pi*5^2]]", 8), [{"kind": "math", "expression": expression("pi*5^2", 8)}])

    def test_pi_fails_closed_where_nothing_exact_is_implemented(self):
        self.assertEqual(code(solved, "solve", lhs="2*pi*x", rhs="10*pi", variable="x"), "UNSUPPORTED_EQUATION")
        self.assertEqual(code(solved, "inequality", lhs="pi*x", rhs="3", variable="x", relation="lt"), "UNSUPPORTED_EQUATION")
        # The pinned emitters cannot draw π under a root.
        self.assertEqual(code(solved, "evaluate", expression="sqrt(pi)"), "UNSUPPORTED_ROOT")
        self.assertEqual(code(solved, "evaluate", expression="pi^9"), "UNSUPPORTED_RESULT")
        self.assertEqual(code(validate_and_solve_task, {"kind": "evaluate", "expression": {"type": "constant", "name": "e"}}),
                         "INVALID_AST")
        self.assertEqual(code(validate_and_solve_task, {"kind": "substitute", "expression": X, "values": {"x": PI}}),
                         "INVALID_TASK")
        self.assertEqual(code(validate_and_solve_task, {"kind": "statistics", "operation": "mean", "values": [PI]}),
                         "INVALID_TASK")
        # Elementary school has no approved typography for it: rejected at the source, never at render.
        for grade in (1, 4, 6):
            self.assertEqual(code(expression, "pi", grade), "SOURCE_NOTATION")
            self.assertEqual(code(spans, "[[2*π]]", grade), "SOURCE_NOTATION")
        self.assertEqual(code(_elementary_math, PI, "ו", None), "ELEMENTARY_SYMBOL")
        self.assertEqual(code(spans, "[[2pir]]", 8), "SOURCE_NOTATION")


class ImplicitProductTests(unittest.TestCase):
    def test_schoolbook_juxtaposition_is_the_explicit_product(self):
        for written, explicit in [
            ("3(x+2)", "3*(x+2)"), ("(x+2)(x-3)", "(x+2)*(x-3)"), ("2ab", "2*a*b"), ("2x(x+1)", "2*x*(x+1)"),
            ("-2(x+1)", "-2*(x+1)"), ("x(x+1)", "x*(x+1)"), ("(a+b)(a-b)", "(a+b)*(a-b)"), ("2(x+1)(x-1)", "2*(x+1)*(x-1)"),
            ("3(x+2)^2", "3*(x+2)^2"), ("x^2(x+1)", "x^2*(x+1)"), ("(x+1)^2(x-1)", "(x+1)^2*(x-1)"),
            ("2sqrt(3)", "2*sqrt(3)"), ("2π", "2*pi"), ("frac(1,2)x", "frac(1,2)*x"), ("3xy", "3*x*y"), ("2 (3)", "2*3"),
        ]:
            with self.subTest(written=written):
                self.assertEqual(expression(written, 8), expression(explicit, 8))
        self.assertEqual(solved("expand", expression="(x+2)(x-3)")["result"]["value"],
                         solved("expand", expression="x^2 - x - 6")["result"]["value"])
        self.assertEqual(solved("solve", lhs="3(x+2)", rhs="12", variable="x")["result"]["values"], [number(2)])

    def test_a_second_reading_is_rejected_not_guessed(self):
        for doubtful in ["1/2(x+1)", "(x+1)/(x-1)(x+2)", "x^(2)(x+1)", "xx", "2 3", "(x+1)2", "x2",
                         "3frac(1,2)", "a(2,3)", "2x3", "x y", "2 x", "a b + 1", "(x+1) y", "2 pi", "x 2"]:
            with self.subTest(doubtful=doubtful):
                self.assertEqual(code(expression, doubtful, 8), "SOURCE_NOTATION")
        # The written coefficient keeps the reading it already had: 1/2x is one half of x.
        self.assertEqual(expression("1/2x", 8), expression("(1/2)*x", 8))
        # Not in elementary school, where a letter is never a variable.
        for doubtful, grade in [("2(3+4)", 4), ("3(2)", 6), ("2ab", 5)]:
            self.assertEqual(code(expression, doubtful, grade), "SOURCE_NOTATION")
        # Two diagram labels side by side are not a product.
        self.assertEqual(code(spans, "[[AB CD]]", 8), "SOURCE_NOTATION")
        self.assertEqual(code(expression, "x y", 8, implicit=False), "SOURCE_NOTATION")

    def test_the_pupil_sees_the_formula_as_written(self):
        for written, shown in [("[[3(x+2)]]", "$3(x+2)$"), ("[[(x+2)(x-3)]]", "$(x+2)(x−3)$"), ("[[2ab]]", "$2ab$"),
                               ("[[3(x+2) = 12]]", "$3(x+2) = 12$"), ("[[2x(x+1)]]", "$2x(x+1)$"),
                               ("[[2sqrt(3)]]", r"$2\sqrt{3}$"), ("[[2AB = 10]]", "$2 · AB = 10$")]:
            with self.subTest(written=written):
                self.assertEqual(printed(written), shown)
        # The printed equation still binds to its typed task, and a different task is still refused.
        prompt = spans("פתרו את המשוואה [[3(x+2) = 12]].", 8)
        task = {"kind": "solve", "lhs": "3*(x+2)", "rhs": "12", "variable": "x"}
        self.assertIsNone(printed_solve(prompt, dict(task), 8))
        self.assertEqual(code(printed_solve, prompt, {**task, "rhs": "13"}, 8), "PRINTED_TASK_MISMATCH")


class ElementaryLiteralTests(unittest.TestCase):
    def test_a_measured_angle_is_one_island_from_grade_five(self):
        for grade in (5, 6):
            self.assertEqual(display_parts("90°", grade), ["90°"])
            self.assertEqual(spans("זווית של [[90°]]", grade)[1], {"kind": "formula", "notation": "90°"})
        self.assertEqual(display_parts("45 °", 6), ["45°"])

        class Signs:
            ltr = staticmethod(lambda text: "<ltr>" + text + "</ltr>")
        self.assertEqual(_formula("90°", "ה", Signs), "<ltr>90°</ltr>")
        # The pinned elementary gate G59 allows the sign from grade five only.
        for grade in (1, 4):
            self.assertEqual(code(spans, "[[90°]]", grade), "SOURCE_NOTATION")
        self.assertEqual(code(spans, "[[∠ABC = 90°]]", 6), "SOURCE_NOTATION")
        self.assertEqual(code(spans, "[[90°°]]", 6), "SOURCE_NOTATION")

    def test_a_percentage_is_an_operand_of_the_school_signs(self):
        self.assertEqual(spans("[[25% x 80]]", 6), [{"kind": "formula", "notation": "25% * 80"}])
        self.assertEqual(expression("25% x 80", 6), expression("25% * 80", 6))
        self.assertEqual(solved("evaluate", 6, expression="25% x 80")["result"]["value"], number(20))
        self.assertEqual(code(spans, "[[25%x80]]", 6), "SOURCE_NOTATION")


if __name__ == "__main__":
    unittest.main()
