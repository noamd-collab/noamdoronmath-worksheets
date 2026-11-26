"""Regression coverage for bounded Qwen algebra/percentage planning and pupil-visible proof."""

from copy import deepcopy
from fractions import Fraction
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
import intro_algebra as intro
from compact_authoring import spans
from general_source import GeneralSourceError, validate_source
from math_tasks import validate_and_solve_task
from printed_tasks import printed_solve
from runtime_catalog import scope_for_lesson

PIN = "57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"
NOTES = {
    intro.EQ: "אנו מתחילים ללמוד מהי משוואה וכיצד פותרים משוואות ממעלה ראשונה.",
    intro.PCT: "אנו מתחילים ללמוד את משמעות האחוז כחלק מתוך מאה.",
}


def lesson(topic, count=20, note=None):
    return {
        "version": 3,
        "gradeNumber": 7 if topic == intro.EQ else 8,
        "topicId": topic,
        "level": "b",
        "lessonGoal": "introduce",
        "questionCount": count,
        "minutes": 30,
        "lastLesson": note or NOTES[topic],
        "alreadyLearned": [],
        "classLabel": "",
        "lessonBoundary": {
            "version": 1,
            "kind": "curriculum_scope",
            "curriculumSha256": PIN,
            "conceptIds": sorted(intro.CONCEPTS[topic]),
        },
    }


def plan(l, choice=1):
    return {
        "version": intro.VERSION,
        "questions": [
            {"activity": choice, "setting": i % 4 + 1, "operands": [1, 3, 4]}
            for i in range(l["questionCount"])
        ],
    }


class IntroAlgebraTests(unittest.TestCase):
    def test_aligned_customization_and_fallback(self):
        for topic, generic in (
            (intro.EQ, "מתחילים לפתור משוואות"),
            (intro.PCT, "אנחנו מתחילים ללמוד אחוזים"),
        ):
            l = lesson(topic, 23, generic)
            self.assertTrue(intro.compatible(l))
            self.assertTrue(intro.compatible(dict(l, lastLesson="מתחילים נושא חדש")))
            for override in (
                {"questionCount": 19},
                {"questionCount": 31},
                {"level": "e"},
                {"lastLesson": "מתחילים רק עם חצאים ובלי משוואות בשני אגפים"},
                {"alreadyLearned": ["תחום ההצבה"]},
                {"lessonGoal": "review"},
            ):
                self.assertFalse(intro.compatible(dict(l, **override)))
            s = scope_for_lesson(l)
            with self.assertRaises(GeneralSourceError):
                intro.request(l, dict(s, selectedConcepts=[]))
            _, data, schema = intro.request(l, s)
            self.assertEqual(len(data["activities"]), 23)
            self.assertEqual(schema["properties"]["questions"]["minItems"], 23)
            self.assertEqual(
                schema["properties"]["questions"]["items"]["required"], ["activity", "setting", "operands"]
            )

    def test_reject_invalid_wire_and_honor_question_and_subitem_choices(self):
        for topic in NOTES:
            l = lesson(topic)
            s = scope_for_lesson(l)
            initial = plan(l)
            original = intro.build_source(l, initial, s)["sections"][0]["questions"]
            for substitution in ({"activity": True}, {"setting": 0}, {"operands": [1, 1, 5]}, {"extra": 1}):
                rows = deepcopy(initial)
                rows["questions"][0].update(substitution)
                with self.assertRaises(GeneralSourceError):
                    intro.build_source(l, rows, s)
            changed = deepcopy(initial)
            changed["questions"][0]["operands"][2] = 2
            after = intro.build_source(l, changed, s)["sections"][0]["questions"]
            self.assertNotEqual(original[0]["items"][2], after[0]["items"][2])
            self.assertEqual(original[0]["items"][:2], after[0]["items"][:2])
            self.assertEqual(original[1:], after[1:])

    def test_all_options_bind_to_printed_subitems(self):
        for topic, note in (
            (intro.EQ, NOTES[intro.EQ]),
            (intro.PCT, NOTES[intro.PCT]),
            (intro.PCT, "אנחנו מתחילים ללמוד אחוזים"),
        ):
            for count, choice in ((20, 1), (20, 2), (23, 2), (30, 1)):
                l = lesson(topic, count, note)
                s = scope_for_lesson(l)
                source = intro.build_source(l, plan(l, choice), s)
                validate_source(l, source, s, provider=True)
                rows = source["sections"][0]["questions"]
                self.assertEqual([r["star"] for r in rows], [False] * (count - 3) + [True] * 3)
                for r in rows:
                    self.assertEqual(len(r["items"]), 3)
                    for it in r["items"]:
                        task = it["answer"]["task"]
                        solved = validate_and_solve_task(task)
                        if topic == intro.EQ:
                            self.assertEqual(printed_solve(it["prompt"], task, 7), "x")
                            left, right = it["prompt"][0]["notation"].split("=")
                            import sympy

                            x = sympy.Symbol("x")
                            value = solved["result"]["values"][0]
                            self.assertEqual(
                                sympy.solve(sympy.sympify(left) - sympy.sympify(right), x),
                                [Fraction(value["numerator"], value["denominator"])],
                            )
                        else:
                            self.assertIsNotNone(intro.percentage_proof(l, r, it, solved))

    def test_out_of_hundred_respects_explicit_stop_and_comparisons_are_integral(self):
        narrow = lesson(intro.PCT, 30)
        broad = lesson(intro.PCT, 30, "אנחנו מתחילים ללמוד אחוזים")
        self.assertTrue(intro.out_of_hundred(narrow))
        self.assertFalse(intro.out_of_hundred(broad))
        narrow_kinds = {k for pair in intro.activities(narrow) for k in pair}
        self.assertFalse({"recover", "recover_remaining", "gain"} & narrow_kinds)
        self.assertIn("recover", {k for pair in intro.activities(broad) for k in pair})
        for selection in (1, 2):
            src = intro.build_source(narrow, plan(narrow, selection), scope_for_lesson(narrow))
            for row in src["sections"][0]["questions"]:
                for item in row["items"]:
                    solved = validate_and_solve_task(item["answer"]["task"])
                    proof = intro.percentage_proof(narrow, row, item, solved)
                    self.assertEqual(int(proof["givens"].get("w", 100)), 100)
                    if proof["role"] in ("gap", "goal"):
                        values = proof["givens"]
                        self.assertEqual(
                            int(values["t"]) - int(values["p"]), solved["result"]["value"]["numerator"]
                        )
                        self.assertEqual(1, solved["result"]["value"]["denominator"])

    def test_independent_print_unit_number_and_impossible_percentage(self):
        l = lesson(intro.PCT)
        _, items = intro.percent_row("hundred", 1, 1, [1, 2, 3])
        it = items[0]
        sol = validate_and_solve_task(it["answer"]["task"])
        wrong_unit = deepcopy(it)
        wrong_unit["answer"]["unit"] = "%"
        wrong_value = deepcopy(it)
        wrong_value["prompt"] = spans("מתוך מאה ספרים, 120% סומנו. כמה ספרים סומנו?", 8)
        for wrong in (wrong_unit, wrong_value):
            with self.assertRaises(GeneralSourceError):
                intro.percentage_proof(l, {}, wrong, sol)
