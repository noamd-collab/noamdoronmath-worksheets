import copy
import json
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import expression, expand_source, expand_task, spans
from general_source import GeneralSourceError, validate_source
from math_tasks import validate_and_solve_task
from runtime_catalog import scope_for_lesson


class CompactAuthoringTests(unittest.TestCase):
    def result(self, source, grade=8):
        task = {"kind": "evaluate", "expression": expression(source, grade)}
        return validate_and_solve_task(task)["result"]["value"]

    def test_arithmetic_is_exact_and_has_normal_precedence(self):
        for source, n, d in [
            ("8 - 3 - 2", 3, 1),
            ("6/2*3", 9, 1),
            ("3*(2+4)", 18, 1),
            ("-2^2", -4, 1),
            ("(-2)^2", 4, 1),
            ("2^-2", 1, 4),
            ("frac(-3,4)+0.25", -1, 2),
            ("sqrt(25)", 5, 1),
        ]:
            with self.subTest(source=source):
                self.assertEqual(
                    self.result(source),
                    {"type": "number", "numerator": n, "denominator": d},
                )

    def test_invalid_or_out_of_grade_expressions_fail_closed(self):
        for source, grade in [
            ("frac(3,0)", 8),
            ("x.y", 8),
            ("sqrt(9)", 3),
            ("x", 1),
            ("2*3", 1),
            ("2^3", 3),
            ("3xy", 8),
            ("1 2", 8),
            ("1//2", 8),
            ("2+?", 8),
            ("3+4)", 8),
            ("sqrt()", 8),
            ("9" * 500, 8),
            ("", 8),
        ]:
            with (
                self.subTest(source=source, grade=grade),
                self.assertRaises(GeneralSourceError),
            ):
                expression(source, grade)
        for value in ["מלה [[3", "מלה [[[]]", "מלה ]]", "[[point:ABCD_E]]"]:
            with self.assertRaises(GeneralSourceError):
                spans(value, 8)

    def test_display_formulas_do_not_change_computed_tasks(self):
        from general_adapters import _formula, _prints_calculation

        self.assertEqual(
            _formula("a^2 + b^2 = c^2", 8, None), "$a^{2} + b^{2} = c^{2}$"
        )
        self.assertEqual(_formula("AD=8", 8, None), "$AD = 8$")
        for symbol, macro in [("!=", r"\neq"), ("<=", r"\leq"), (">=", r"\geq")]:
            with self.subTest(symbol=symbol):
                self.assertEqual(_formula("5 " + symbol + " 7", 8, None), "$5 " + macro + " 7$")
        self.assertEqual(
            spans("[[1/2+___=5/6]]", 5, fraction_notation=True),
            [{"kind": "formula", "notation": "frac(1,2)+___=frac(5,6)"}],
        )
        self.assertEqual(
            spans("[[2/4]]", 5, fraction_notation=True)[0]["expression"]["denominator"],
            4,
        )
        real = {"prompt": spans("חשבו [[frac(1,3)+frac(1,7)]]", 5)}
        solved = {
            "question": {
                "kind": "evaluate",
                "expression": expression("frac(1,3)+frac(1,7)", 5),
            }
        }
        self.assertTrue(_prints_calculation(real, solved))
        self.assertFalse(
            _prints_calculation({"prompt": spans("חשבו [[frac(1,3)]]", 5)}, solved)
        )
        for invalid in ("x+1=3", "<script>", "1 < < 2", "func(2)"):
            with self.assertRaises(GeneralSourceError):
                spans("[[" + invalid + "]]", 5)

    def test_common_divisors_and_multiples_match_the_printed_positive_pair(self):
        for source, kind, expected in [
            ("gcd(21,14)", "gcd", 7),
            ("lcm(6,8)", "lcm", 24),
        ]:
            task = {"kind": "evaluate", "expression": source}
            expand_task(task, 5, True)
            self.assertEqual(task["kind"], kind)
            self.assertEqual(
                validate_and_solve_task(task)["result"]["value"]["numerator"], expected
            )
        for source, grade in [
            ("lcm(18,0)", 5),
            ("gcd(1,2)", 3),
            ("lcm(9999999,2)", 5),
            ("gcd(1.5,8)", 5),
            ("2+lcm(3,4)", 5),
        ]:
            with self.subTest(source=source), self.assertRaises(GeneralSourceError):
                expand_task({"kind": "evaluate", "expression": source}, grade, False)

    def test_adjacent_islands_keep_math_together_and_separate_adjacent_quantities(self):
        atoms = spans("חשבו [[1/3]] + [[1/6]].", 5, fraction_notation=True)
        self.assertEqual(len(atoms), 3)
        self.assertEqual(atoms[1]["expression"], expression("frac(1,3)+frac(1,6)", 5))
        separate = spans("[[3]] וגם [[5]]", 5)
        self.assertEqual([item["kind"] for item in separate], ["math", "text", "math"])
        coordinate = spans("הנקודה [[A(-2,4)]]", 8)
        self.assertEqual(coordinate[-1], {"kind": "formula", "notation": "A(-2,4)"})
        for invalid in ["B(1234567,9)", "AB(2,3)", "A(1,x)", "AB="]:
            with self.subTest(invalid=invalid), self.assertRaises(GeneralSourceError):
                spans("[[" + invalid + "]]", 8)

    def test_prose_comparison_signs_are_isolated_and_markup_is_rejected(self):
        from general_source import rich

        result = rich(spans("בחרו סימן (<, > או =).", 5), 5)
        self.assertEqual(
            [part["notation"] for part in result if part["kind"] == "formula"],
            ["<", ">", "="],
        )
        with self.assertRaises(GeneralSourceError):
            rich(spans("מלאו <br> כאן", 5), 5)

    def test_prompt_cannot_reference_a_missing_table(self):
        q = {"intro": "השלימו את הטבלה הבאה."}
        source = {"version": 4, "sections": [{"questions": [q]}]}
        with self.assertRaisesRegex(GeneralSourceError, "table"):
            expand_source(source, 5)
        q["table"] = {"head": ["סכום", "כמות"], "rows": [["[[1/2]]", "___"]]}
        self.assertEqual(
            len(
                expand_source(source, 5)["sections"][0]["questions"][0]["table"]["rows"]
            ),
            1,
        )

    def test_drawing_instruction_in_prose_cannot_escape_the_topic_policy(self):
        fixture = (
            Path(__file__).resolve().parents[1]
            / "cloud/container/fixtures/general/grade4-fractions"
        )
        lesson = json.loads((fixture / "lesson.json").read_text())
        payload = json.loads((fixture / "model-output.json").read_text())
        for prompt in ("ציירו ריבוע.", "שַׂרְטְטוּ ריבוע.", "התבוננו בשרטוט."):
            payload["sections"][0]["questions"][0]["intro"] = [
                {"kind": "text", "text": prompt}
            ]
            with (
                self.subTest(prompt=prompt),
                self.assertRaises(GeneralSourceError) as failure,
            ):
                validate_source(lesson, payload, scope_for_lesson(lesson))
            self.assertEqual(failure.exception.code, "DRAWING_POLICY")

    def test_coordinate_viewport_includes_origin_without_moving_the_data(self):
        figure = {
            "kind": "coordinate_plane",
            "xr": [2, 6],
            "yr": [-7, -2],
            "points": [{"name": "P", "x": 4, "y": -3}],
            "segments": [],
        }
        source = {"version": 4, "sections": [{"questions": [{"figure": figure}]}]}
        derived = expand_source(source, 8)["sections"][0]["questions"][0]["figure"]
        self.assertEqual(derived, {**figure, "xr": [0, 6], "yr": [-7, 0]})
        self.assertEqual(figure["xr"], [2, 6])

    def test_compact_middle_source_preserves_typed_operations_tables_and_reviews(self):
        fixture = (
            Path(__file__).resolve().parents[1]
            / "cloud/container/fixtures/general/grade9-quadratic"
        )
        lesson = json.loads((fixture / "lesson.json").read_text())
        original = json.loads((fixture / "model-output.json").read_text())
        source = copy.deepcopy(original)
        question = source["sections"][0]["questions"][0]
        question["table"] = {
            "head": ["ערך", "כמות"],
            "rows": [["[[frac(1,2)]]", "[[3]]"]],
        }
        item = question["items"][0]
        item.update(
            prompt="הציבו [[x]] בביטוי.",
            answer={
                "kind": "computed",
                "unit": "",
                "task": {
                    "kind": "substitute",
                    "expression": "x^2+3",
                    "values": {"x": "2"},
                },
            },
        )
        scope = scope_for_lesson(lesson)
        unpacked = expand_source(source, 9)
        output = validate_source(lesson, unpacked, scope, provider=True)
        first = output["evidence"]["computations"][0]["computed"]
        self.assertEqual(first["result"]["value"]["numerator"], 7)
        self.assertEqual(source["sections"][0]["questions"][0]["items"][0], item)
        self.assertEqual(
            spans("הקטע [[segment:AB]]", 9)[1],
            {"kind": "geometry", "type": "segment", "names": "AB"},
        )

    def test_retained_typed_source_is_lossless(self):
        root = Path(__file__).resolve().parents[1] / "cloud/container/fixtures/general"
        for grade, case in [
            (2, "grade2-vocalized"),
            (4, "grade4-fractions"),
            (9, "grade9-coordinate-triangles"),
        ]:
            payload = json.loads((root / case / "model-output.json").read_text())
            self.assertEqual(expand_source(payload, grade), payload)
