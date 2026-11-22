"""Check the pupil givens independently of the grade-eight Pythagorean author."""

import copy
import json
from pathlib import Path
import random
import unittest
from unittest.mock import patch

import pythagoras_lesson as p
from general_source import GeneralSourceError
from provider import author_lesson
from validation import validate_model

FIX = (
    Path(__file__).resolve().parents[1]
    / "cloud/container/fixtures/general/grade8-pythagoras"
)


def dist(points, side):
    first, second = (points[name] for name in side)
    return sum((x - y) ** 2 for x, y in zip(first, second))


class PythagoreanLessonTest(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIX / "lesson.json").read_text())
        self.source = json.loads((FIX / "model-output.json").read_text())

    @patch("provider.build_authoring_context", return_value={})
    def test_only_exact_rehearsed_scope_uses_closed_author(self, _context):
        with patch(
            "general_provider.author_general_lesson",
            side_effect=RuntimeError("Unexpected model call"),
        ):
            meta = {}
            generated = author_lesson(self.lesson, metadata=meta)
        self.assertFalse(meta["providerCalled"])
        self.assertEqual(generated["version"], p.VERSION)
        validate_model(self.lesson, generated)
        for field, value in (
            ("gradeNumber", 7),
            ("topicId", "g8:pythagoras_3d"),
            ("level", "a"),
            ("lessonGoal", "assessment"),
            ("lastLesson", "למדנו רק למצוא את היתר."),
            ("alreadyLearned", ["נושא אחר"]),
            ("questionCount", 21),
        ):
            self.assertFalse(p.eligible(dict(self.lesson, **{field: value})))
        altered = copy.deepcopy(self.lesson)
        altered["lessonBoundary"]["conceptIds"].pop()
        self.assertFalse(p.eligible(altered))

    def test_payload_has_no_authored_answers_coordinates_or_undeclared_keys(self):
        for updates in (
            {"choices": [-1] * 20},
            {"choices": [4] * 20},
            {"choices": [True] * 20},
            {"choices": [0] * 19},
            {"figure": {"names": "DEF"}},
            {"answer": 4},
        ):
            with self.assertRaises(GeneralSourceError):
                p.build(self.lesson, {**self.source, **updates})

    def test_each_parameter_choice_reconstructs_all_named_quantities_and_written_givens(
        self,
    ):
        for choice in range(4):
            level, rows, facts = p.build(
                self.lesson, {**self.source, "choices": [choice] * 20}
            )
            self.assertEqual(sum(q["star"] for q in level["questions"]), 3)
            self.assertEqual(len(set(x["intro"] for x in rows)), 20)
            self.assertEqual(len(level["words_share"]), 4)
            self.assertEqual(sum(r["figure"] is not None for r in rows), 16)
            self.assertEqual(
                set().union(*(set(x["conceptIds"]) for x in rows)),
                set(self.lesson["lessonBoundary"]["conceptIds"]),
            )
            for i, (r, truth) in enumerate(zip(rows, facts), 1):
                with self.subTest(index=i, choice=choice):
                    self.assertEqual([t["label"] for t in r["items"]], list("אבג"))
                    self.assertEqual(
                        level["answers"][i - 1][1],
                        [[x["label"], x["answer"]] for x in r["items"]],
                    )
                    a, b, h = truth["triple"]
                    self.assertEqual(a * a + b * b, h * h)
                    points = truth["vertices"]
                    for side, val in truth["printedLengths"].items():
                        if truth["family"] != "words" or truth["mode"]:
                            self.assertIn(f"{side}={val}", r["intro"])
                        if points:
                            self.assertEqual(dist(points, side), val * val)
                    if truth["family"] == "grid":
                        for name, (x, y) in points.items():
                            self.assertIn(f"{name}({x},{y})", r["intro"])
                        for side, square in truth["sideSquares"].items():
                            self.assertEqual(dist(points, side), square)
                        if truth["mode"] in (2, 4):
                            s1, s2, s3 = sorted(truth["sideSquares"].values())
                            success = s1 + s2 == s3
                            self.assertEqual(success, truth["mode"] == 2)
                            self.assertEqual(
                                r["items"][2]["answer"].startswith("כן"), success
                            )
                    if truth["family"] == "words":
                        last = r["items"][-1]
                        self.assertTrue(last["to_construct"])
                        self.assertIn("סרטטו", last["text"])
                        self.assertIsNone(r["figure"])
                        if truth["converse"]:
                            lengths = sorted(truth["printedLengths"].values())
                            self.assertLess(lengths[2], sum(lengths[:2]))
                            valid = lengths[0] ** 2 + lengths[1] ** 2 == lengths[2] ** 2
                            self.assertEqual(valid, truth["mode"] == 2)
                            self.assertNotIn("ישר", r["intro"])
                    elif truth["family"] != "grid":
                        self.assertEqual(r["figure"]["labels"], truth["printedLengths"])
                        for edge in ("AB", "BC", "AC"):
                            self.assertEqual(
                                dist(points, edge), truth["sideSquares"][edge]
                            )
                        if truth["family"] == "isosceles":
                            self.assertEqual(dist(points, "AH"), a * a)
                            self.assertEqual(dist(points, "CH"), b * b)
                            self.assertEqual(dist(points, "AC"), h * h)
                        if truth["family"] == "median":
                            self.assertEqual(dist(points, "AM"), a * a)
                            self.assertEqual(dist(points, "CM"), h * h)

    def test_mixed_replay_has_distinct_problems_and_unique_geometry_givens(self):
        rng = random.Random(304)
        for _ in range(40):
            model = {**self.source, "choices": [rng.randrange(4) for _ in range(20)]}
            first = p.build(self.lesson, model)
            self.assertEqual(first, p.build(self.lesson, json.loads(json.dumps(model))))
            self.assertEqual(len(set(x["intro"] for x in first[1])), 20)
