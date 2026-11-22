import copy
from html import unescape
import json
from pathlib import Path
import re
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from compact_authoring import display_parts, expand_source, expression, has_written_number, spans
from general_adapters import _formula, _prints_calculation, _task_text
from general_source import GeneralSourceError, rich, validate_source
from math_tasks import number, validate_and_solve_task
from numeric_literals import decimal_result, display_literal
from runtime_catalog import scope_for_lesson


class Elementary:
    ltr = staticmethod(lambda x: '<span dir="ltr">' + x + "</span>")
    fmt = staticmethod(lambda n, grade: str(n))
    frac = staticmethod(lambda n, d, grade: f"({n}/{d})")
    op = staticmethod(lambda s, grade: s)


class NumericLiteralTests(unittest.TestCase):
    def result(self, raw, grade=3):
        return validate_and_solve_task({"kind": "evaluate", "expression": expression(raw, grade)})["result"]["value"]

    def test_exact_grade_three_place_values_and_grouping(self):
        self.assertEqual(self.result("1,000 - 900"), number(100))
        self.assertEqual(self.result("1,000 - (300 + 40 + 2)"), number(658))
        self.assertEqual(self.result("1,000,000 - 999,999"), number(1))
        self.assertEqual(self.result("1,250.50 / 10", 6), number(2501, 20))
        self.assertEqual(self.result("12.50% * 400", 6), number(50))
        for bad in ["1,00", "12,34,567", "1000,000", "0,125", "1 234", "12.5.7", "12%%"]:
            with self.subTest(bad=bad), self.assertRaises(GeneralSourceError):
                expression(bad, 3)

    def test_structural_commas_remain_structural(self):
        self.assertEqual(self.result("frac(1,234)"), number(1, 234))
        self.assertFalse(has_written_number("frac(1,234)"))
        self.assertEqual(self.result("frac(1, 250) + 1,000"), number(250001, 250))
        self.assertEqual(display_parts("A(1,234)", 8), ["A(1, 234)"])
        self.assertEqual(display_parts("(12,345)", 8), ["(12, 345)"])
        with self.assertRaises(GeneralSourceError):
            expression("(12,345)", 8)
        with self.assertRaises(GeneralSourceError):
            expression("frac(1,234,5)", 8)
        with self.assertRaises(GeneralSourceError):
            expression("frac(1,000)", 8)

    def test_implicit_coefficient_and_elementary_schoolbook_contexts(self):
        for given in ["2x + 4 = 10", "2x = 3x - 5", "3x^2 + 2 = 29"]:
            printed = _formula(given, 7, None)
            self.assertIn("x", printed)
            self.assertNotIn("·", printed)
        value = validate_and_solve_task({
            "kind": "solve", "variable": "x", "lhs": expression("2x", 7),
            "rhs": expression("3x - 5", 7),
        })
        self.assertEqual(value["result"]["values"], [number(5)])
        self.assertEqual(self.result("12 + 3 x 4", 4), number(24))
        self.assertEqual(self.result("20 : 4 - 2", 4), number(3))
        for raw, grade in [("2xy", 7), ("3name", 7), ("2x", 4), ("x + 2", 4), ("4 : 2", 8)]:
            with self.subTest(raw=raw, grade=grade), self.assertRaises(GeneralSourceError):
                expression(raw, grade)

    def test_authored_decimal_spelling_survives_each_renderer(self):
        self.assertEqual(decimal_result(number(11, 5), "1.10 * 2"), "2.2")
        self.assertEqual(decimal_result(number(-1, 8), "0.125 * -1"), "−0.125")
        self.assertIsNone(decimal_result(number(1, 3), "1.00 / 3"))
        self.assertIsNone(decimal_result(number(1, 2), "frac(1,2)"))
        for grade, helper in [(6, None), ("ו", Elementary)]:
            for raw, expected in [
                ("1,000.50 + 0.50 = 1,001.00", ["1,000.50", "0.50", "1,001.00"]),
                ("12.50% * 20", ["12.50%", "20"]),
                ("-2.50 + 1.50", ["2.50", "1.50"]),
                ("0.50 + frac(1,2) + 0.500", ["0.50", "0.500"]),
            ]:
                with self.subTest(grade=grade, raw=raw):
                    printed = unescape(re.sub("<[^>]+>", "", _formula(raw, grade, helper)))
                    for part in expected:
                        self.assertIn(part, printed)
        for raw in ["1,234,56", "1,000.1.2", "1e3", "2%<tag>", "1/2/3"]:
            self.assertIsNone(display_literal(raw))
        self.assertEqual(display_literal("−1,250.00%"), "-1,250.00%")

    def test_pupil_task_and_key_share_checked_place_value_expression(self):
        fixture = ROOT / "cloud/container/fixtures/general/grade4-fractions"
        original = json.loads((fixture / "model-output.json").read_text())
        lesson = json.loads((fixture / "lesson.json").read_text())
        lesson.update(gradeNumber=3, topicId="ג01", level="b", questionCount=12, minutes=45,
                      lastLesson="סיימנו ללמוד את הנושא ערך מקום ותרגלנו את המושגים שסומנו.")
        lesson["lessonBoundary"]["conceptIds"] = ["ג01#0", "ג01#1", "ג01#2"]
        section = original["sections"][0]
        section["title"] = "ערך מקום"; section["conceptIds"] = lesson["lessonBoundary"]["conceptIds"]
        seed_question = section["questions"][0]
        section["questions"] = [copy.deepcopy(seed_question) for _ in range(12)]
        for i, question in enumerate(section["questions"]):
            question["star"] = i >= 10
            question["intro"] = "חשבו כמה חסר עד אלף."
            question.pop("table", None)
            for j, item in enumerate(question["items"]):
                item.update(prompt="השלימו את ההפרש.", answer={"kind": "computed", "unit": "",
                    "task": {"kind": "evaluate", "expression": f"1,000 - {100 + i * 10 + j}"}})
        original["sections"] = [section]
        source = expand_source(original, 3)
        validated = validate_source(lesson, source, scope_for_lesson(lesson))
        item = source["sections"][0]["questions"][0]["items"][0]
        solved = validated["evidence"]["computations"][0]["computed"]
        self.assertEqual(solved["result"]["value"], number(900))
        self.assertEqual(_task_text(solved, "ג", Elementary, notation=item["answer"]["notation"]),
                         '<span dir="ltr">1,000 - 100</span>')
        self.assertFalse(_prints_calculation(item, solved, 3))
        item["prompt"] = rich(spans("חשבו [[1,000 - 100]].", 3), 3)
        self.assertTrue(_prints_calculation(item, solved, 3))
        item["answer"]["notation"] = "1,000 - 101"
        with self.assertRaisesRegex(GeneralSourceError, "printed calculation"):
            validate_source(lesson, source, scope_for_lesson(lesson))


if __name__ == "__main__":
    unittest.main()
