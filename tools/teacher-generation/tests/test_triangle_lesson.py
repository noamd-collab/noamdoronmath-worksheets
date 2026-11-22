"""Regression coverage at the public author and closed native geometry boundaries."""

import copy
import itertools
import json
import re
from pathlib import Path
import unittest
from unittest.mock import patch

import sympy as sp

import triangle_lesson as tr
from provider import author_lesson
from validation import GenerationError, validate_model

APP = Path(__file__).resolve().parents[1]
FIXTURE = APP / "cloud/container/fixtures/general/grade9-special-right-triangle"


class NativeTriangleTest(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIXTURE / "lesson.json").read_text())
        self.source = json.loads((FIXTURE / "model-output.json").read_text())

    @patch("provider.build_authoring_context", return_value={})
    def test_author_for_neutral_context_works_offline_and_replays(self, _context):
        with patch(
            "general_provider.author_general_lesson",
            side_effect=AssertionError("Unexpected paid call"),
        ):
            meta = {}
            data = author_lesson(self.lesson, metadata=meta)
        self.assertFalse(meta["providerCalled"])
        self.assertFalse(meta["responseReceived"])
        self.assertEqual(meta["authorContract"], tr.VERSION)
        validate_model(self.lesson, data)
        self.assertEqual(
            tr.build(self.lesson, data),
            tr.build(self.lesson, json.loads(json.dumps(data))),
        )

    @patch("provider.build_authoring_context", return_value={})
    def test_custom_free_text_preserves_the_full_general_author(self, _context):
        for field, value in (
            ("lastLesson", "רק הוכחות, בלי חישובים ובשמות קודקודים שונים."),
            ("alreadyLearned", ["בכיתה נעזרנו בחוטים צבעוניים"]),
        ):
            lesson = copy.deepcopy(self.lesson)
            lesson[field] = value
            with patch(
                "general_provider.author_general_lesson", return_value={"custom": True}
            ) as general:
                self.assertEqual(author_lesson(lesson), {"custom": True})
                self.assertEqual(general.call_args.args[0], lesson)
            with self.assertRaises(GenerationError):
                validate_model(lesson, self.source)

    def test_recognizes_each_nonempty_selected_subset(self):
        ids = self.lesson["lessonBoundary"]["conceptIds"]
        for k in range(1, len(ids) + 1):
            for selection in itertools.combinations(ids, k):
                lesson = copy.deepcopy(self.lesson)
                lesson["lessonBoundary"]["conceptIds"] = list(selection)
                self.assertTrue(tr.eligible(lesson))
                validate_model(lesson, self.source)
        for ids_only in ([ids[1]], [ids[0], ids[2]], ids):
            lesson = copy.deepcopy(self.lesson)
            lesson["lessonBoundary"]["conceptIds"] = ids_only
            level, rows, _ = tr.build(lesson, self.source)
            self.assertEqual(
                set().union(*(set(q["conceptIds"]) for q in rows)), set(ids_only)
            )
            self.assertEqual(tr.CONVERSE_RULE in level["rule"], ids[1] in ids_only)
            self.assertEqual(
                tr.DIRECT_RULE in level["rule"], any(x != ids[1] for x in ids_only)
            )

    def test_exact_points_orientation_and_measured_lengths_at_all_sizes(self):
        families = set()
        for grade_level in ("a", "e"):
            for n in range(20, 31):
                lesson = dict(self.lesson, questionCount=n, level=grade_level)
                source = {
                    "version": tr.VERSION,
                    "choices": [(i % 4) + 1 for i in range(n)],
                }
                level, rows, truth = tr.build(lesson, source)
                self.assertEqual(len(level["answers"]), n)
                self.assertEqual(sum(q["star"] for q in level["questions"]), 3)
                self.assertEqual(len(rows), len(truth))
                self.assertEqual(len({q["intro"] for q in rows}), n)
                for q, t in zip(rows, truth):
                    vertices = {
                        p: sp.Point(*(sp.sympify(v) for v in xy))
                        for p, xy in t["vertices"].items()
                    }
                    lengths = {
                        s: vertices[s[0]].distance(vertices[s[1]])
                        for s in ("AB", "BC", "AC")
                    }
                    for s, v in lengths.items():
                        self.assertEqual(v, sp.sympify(t["lengths"][s]))
                    self.assertEqual(
                        lengths["AB"] ** 2 + lengths["AC"] ** 2, lengths["BC"] ** 2
                    )
                    self.assertEqual(
                        2 * lengths["AB"] == lengths["BC"], t["halfHypotenuse"]
                    )
                    if q["figure"]:
                        f = q["figure"]
                        families.add(f["family"])
                        self.assertEqual(f["counterexample"], not t["halfHypotenuse"])
                        self.assertEqual(
                            f["mode"] == "converse", q["conceptIds"] == [tr.CONVERSE_ID]
                        )
                        self.assertTrue(all(item["answer"] for item in q["items"]))
                    else:
                        self.assertIn(q["n"], level["words_share"])
        self.assertEqual(families, set(tr.FAMILIES) | {"coordinate"})

    def test_direct_coordinate_tasks_print_only_givens(self):
        for j in range(8):
            for choice in range(1, 5):
                q, figure, facts = tr.question(
                    self.lesson, 1 + j, "coordinate", choice, False, j
                )
                self.assertEqual(figure["mode"], "forward_short")
                target = q["items"][1]["to_prove"][0]
                self.assertEqual(target["of"], "BC")
                self.assertEqual(int(facts["lengths"]["BC"]), target["value"])
                self.assertNotIn(str(target["value"]), re.findall(r"\d+", q["intro"]))
                self.assertNotIn("1$ יחידות אורך.", q["intro"])

    def test_source_cannot_inject_figures_answers_or_oversized_choice(self):
        for bad in ([True] * 20, [5] * 20, [1] * 19, ["1"] * 20):
            with self.assertRaises(GenerationError):
                validate_model(self.lesson, dict(self.source, choices=bad))
        for field in ("fig", "answers", "script"):
            with self.assertRaises(GenerationError):
                validate_model(self.lesson, dict(self.source, **{field: "external"}))
        with self.assertRaises(GenerationError):
            validate_model(self.lesson, {"version": 4, "choices": [1] * 20})


if __name__ == "__main__":
    unittest.main()
