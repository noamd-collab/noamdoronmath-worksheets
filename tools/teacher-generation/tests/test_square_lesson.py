"""Exercise the grade 9 reduced-track square lesson through the normal author and verifier."""

import copy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import square_lesson as lesson_source
from provider import author_lesson
from validation import GenerationError, validate_model

APP = Path(__file__).resolve().parents[1]
FIX = APP / "cloud/container/fixtures/general/grade9-square"


class SquareLessonTest(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIX / "lesson.json").read_text())
        self.source = json.loads((FIX / "model-output.json").read_text())

    @patch("provider.build_authoring_context", return_value={})
    def test_exact_case_authors_offline_and_replays_through_validation(self, _context):
        with patch(
            "general_provider.author_general_lesson",
            side_effect=AssertionError("Unexpected paid author"),
        ):
            meta = {}
            source = author_lesson(self.lesson, metadata=meta)
        self.assertEqual(source["version"], lesson_source.VERSION)
        self.assertFalse(meta["providerCalled"])
        validate_model(self.lesson, source)
        self.assertEqual(
            lesson_source.build(self.lesson, source),
            lesson_source.build(self.lesson, json.loads(json.dumps(source))),
        )

    @patch("provider.build_authoring_context", return_value={})
    def test_introduction_uses_real_provider_contract_and_replays_its_selected_geometry(self, _context):
        lesson = dict(self.lesson, lessonGoal="introduce")
        source = {**self.source, "version": lesson_source.INTRO_VERSION,
                  "constructionOrder": list(reversed(lesson_source.FAMILIES[1:]))}
        with patch("provider.request_author_json", return_value=source) as author:
            meta = {}
            got = author_lesson(lesson, metadata=meta, api_key="test", model="test",
                                base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        author.assert_called_once()
        self.assertEqual(meta["authorContract"], lesson_source.INTRO_VERSION)
        validate_model(lesson, got)
        _, _, facts = lesson_source.build(lesson, got)
        self.assertEqual([r["family"] for r in facts if r["family"] in lesson_source.FAMILIES][:7],
                         ["outline", *source["constructionOrder"]])
        for bad in ({**got, "constructionOrder": ["diagonals"] * 6}, {**got, "choices": [True]*20}):
            with self.assertRaises(GenerationError):
                validate_model(lesson, bad)
        self.assertFalse(lesson_source.provider_introduction(dict(lesson, lastLesson="ללא אלכסונים")))
        with self.assertRaises(GenerationError):
            validate_model(dict(lesson, lessonGoal="practice"), got)

    def test_custom_context_or_different_concepts_remain_with_general_author(self):
        for field, value in (
            ("level", "a"),
            ("topicId", "g9r:square"),
            ("lastLesson", "לא לימדנו אלכסונים."),
            ("alreadyLearned", ["לחשב שטחים בעזרת משוואות"]),
            ("lessonGoal", "assessment"),
        ):
            alt = dict(self.lesson, **{field: value})
            self.assertFalse(lesson_source.eligible(alt))
            with self.assertRaises(GenerationError):
                validate_model(alt, self.source)
        alt = copy.deepcopy(self.lesson)
        alt["lessonBoundary"]["conceptIds"].pop()
        self.assertFalse(lesson_source.eligible(alt))

    def test_cannot_supply_answers_figures_or_invalid_parameters(self):
        for change in (
            {"choices": [0] * 20},
            {"choices": [True] * 20},
            {"choices": [1] * 21},
            {"figure": "raw"},
            {"answer": "malicious"},
        ):
            with self.assertRaises(GenerationError):
                validate_model(self.lesson, {**self.source, **change})

    def test_exact_geometry_and_teacher_bounds_across_volumes_and_choices(self):
        for n in range(20, 31):
            for c in range(1, 5):
                lesson = dict(self.lesson, questionCount=n)
                source = dict(self.source, choices=[c] * n)
                level, canonical, truth = lesson_source.build(lesson, source)
                self.assertEqual(len(level["answers"]), n)
                self.assertEqual(len(set(r["intro"] for r in canonical)), n)
                self.assertEqual(sum(r["star"] for r in level["questions"]), 3)
                self.assertEqual(len(level["words_share"]), round(n * 0.20))
                self.assertEqual(
                    set().union(*(set(r["conceptIds"]) for r in canonical)),
                    set(self.lesson["lessonBoundary"]["conceptIds"]),
                )
                all_text = " ".join(
                    [
                        level["rule"],
                        *(r["intro"] for r in canonical),
                        *(
                            t[k]
                            for r in canonical
                            for t in r["items"]
                            for k in ("text", "answer")
                        ),
                    ]
                )
                self.assertNotRegex(all_text, r"שטח|היקף|שיפוע|פיתגורס|נוסחת המרחק")
                self.assertRegex(level["rule"], "האלכסונים שווים.*חוצים.*מאונכים")
                self.assertEqual(
                    {f["family"] for f in truth},
                    set(lesson_source.FAMILIES) | {"coordinate", "words"},
                )
                for row, f in zip(canonical, truth):
                    self.assertEqual([t["label"] for t in row["items"]], list("אבג"))
                    a, b, cpt, d = f["vertices"]

                    def dist2(p, q):
                        return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2

                    sides = [
                        dist2(*seg) for seg in ((a, b), (b, cpt), (cpt, d), (d, a))
                    ]
                    diagonals = [dist2(a, cpt), dist2(b, d)]
                    self.assertEqual(sides, f["sideSquares"])
                    self.assertEqual(diagonals, f["diagonalSquares"])
                    self.assertEqual(
                        f["square"],
                        len(set(sides)) == 1 and diagonals[0] == diagonals[1],
                    )
                    self.assertEqual(
                        f["square"], f["family"] not in ("rectangle", "rhombus")
                    )
                    if f["family"] == "diagonals":
                        self.assertEqual(diagonals[0], 4 * row["figure"]["unit"] ** 2)
                    if f["family"] == "rhombus":
                        self.assertEqual(sides[0], (5 * row["figure"]["unit"]) ** 2)
                    if f["family"] == "words":
                        self.assertEqual(
                            row["items"][2]["to_construct"][0]["points"], list("ABCD")
                        )
                        self.assertIsNone(row["figure"])
                    else:
                        self.assertIsNotNone(row["figure"])
                self.assertTrue(all(i["answer"] for r in canonical for i in r["items"]))


if __name__ == "__main__":
    unittest.main()
