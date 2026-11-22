"""Current curriculum intake through the pinned native multiplication-table author."""

from copy import deepcopy
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import division_facts as facts
from provider import author_lesson
from validation import GenerationError, validate_lesson, validate_model

FIXTURE = (
    Path(__file__).resolve().parents[1]
    / "cloud/container/fixtures/general/grade3-division-curriculum"
)


class DivisionFactsTest(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIXTURE / "lesson.json").read_text())
        self.source = json.loads((FIXTURE / "model-output.json").read_text())

    def test_original_intake_is_preserved_by_offline_author(self):
        self.lesson["lastLesson"] = (
            "תרגלנו חילוק ללא שארית בתחום לוח הכפל עד 100. מצאנו את המנה בעזרת תרגיל כפל מתאים."
        )
        original = deepcopy(self.lesson)
        meta = {}
        with patch(
            "general_provider.author_general_lesson",
            side_effect=AssertionError("Unexpected provider"),
        ):
            source = author_lesson(self.lesson, metadata=meta)
        self.assertEqual(self.lesson, original)
        self.assertEqual(source["version"], facts.VERSION)
        self.assertEqual(
            meta,
            {
                "authorContract": facts.VERSION,
                "providerCalled": False,
                "responseReceived": False,
            },
        )
        self.assertEqual(validate_model(self.lesson, source)["family"], "general")

    def test_applicable_plans_and_teacher_context(self):
        lesson = deepcopy(self.lesson)
        lesson["lessonBoundary"]["conceptIds"].append(facts.INVERSE)
        self.assertFalse(facts.eligible(lesson))
        lesson["alreadyLearned"] = ["בדיקה בכפל"]
        self.assertTrue(facts.eligible(lesson))
        for chosen in ([facts.INVERSE], ["ג10#2"], ["ג10#3"], [facts.FACTS, "ג10#2"]):
            lesson["lessonBoundary"]["conceptIds"] = chosen
            self.assertFalse(facts.eligible(lesson))
        for key, value in [
            ("level", "a"),
            ("gradeNumber", 4),
            ("questionCount", 14),
            ("topicId", "ג11"),
            ("lastLesson", "ללא חילוק"),
            ("lastLesson", "תרגלנו חילוק עם שארית"),
            ("lastLesson", "רק במחלק שתיים"),
            ("lastLesson", "חילוק עד 50"),
            ("alreadyLearned", ["תרגלנו דרך מסוימת עם מטבעות"]),
        ]:
            with self.subTest(key=key, value=value):
                self.assertFalse(facts.eligible(dict(self.lesson, **{key: value})))
        custom = dict(self.lesson, lastLesson="השיעור התמקד בחילוק בחמש בלבד")
        with patch(
            "general_provider.author_general_lesson", return_value="general"
        ) as g:
            self.assertEqual(author_lesson(custom), "general")
            self.assertEqual(g.call_args.args[0], custom)

    def test_replayable_checked_parameters_and_challenge_arithmetic(self):
        for seed in [0, 1, 17, 1234, 1000000, facts.MAX_SEED]:
            source = {"version": facts.VERSION, "seed": seed}
            view, cap, payload = facts.derive(self.lesson, source)
            self.assertEqual(payload, facts.derive(self.lesson, source)[2])
            self.assertEqual(view["version"], 2)
            self.assertEqual(cap["topicId"], "ג10")
            self.assertEqual(len(payload["questions"]), 12)
            seen = set()
            for n, q in enumerate(payload["questions"], 1):
                self.assertEqual(len(q["items"]), 3)
                self.assertEqual(q["star"], n >= 10)
                for it in q["items"]:
                    l, r, a = [it[k] for k in ("left", "right", "answer")]
                    self.assertEqual(r * a, l)
                    self.assertTrue(1 <= r <= 10 and 1 <= a <= 10 and 1 <= l <= 100)
                    self.assertNotIn((l, r), seen)
                    seen.add((l, r))
                    if n == 10:
                        self.assertTrue(l + r <= 100 and (l + r) // r == a + 1 <= 10)
                    if n == 12:
                        self.assertTrue(a != r and l // a == r)
            self.assertEqual(len(seen), 36)

    def test_render_contract_tracks_selected_methods(self):
        self.lesson["alreadyLearned"] = ["בדיקה בכפל"]
        for ids, facts_only in [
            ([facts.FACTS], True),
            ([facts.FACTS, facts.INVERSE], False),
        ]:
            self.lesson["lessonBoundary"]["conceptIds"] = ids
            with patch("adapters.elementary") as render:
                facts.compile_source(
                    self.lesson, self.source, "unused-skill", "unused-output"
                )
            self.assertEqual(render.call_args.kwargs, {"facts_only": facts_only})
            if facts_only:
                self.assertEqual(
                    render.call_args.args[2]["title"], "חילוק בתחום לוח הכפל"
                )

    def test_reject_tampering_and_invalid_curriculum_before_authorship(self):
        for v in [True, 1.0, -1, facts.MAX_SEED + 1, "5"]:
            with self.assertRaises(GenerationError):
                validate_model(self.lesson, {"version": facts.VERSION, "seed": v})
        for extra in ["answers", "questions", "code"]:
            with self.assertRaises(GenerationError):
                validate_model(self.lesson, dict(self.source, **{extra: []}))
        bad = deepcopy(self.lesson)
        bad["lessonBoundary"]["curriculumSha256"] = "0" * 64
        with self.assertRaises(GenerationError):
            validate_lesson(bad)


if __name__ == "__main__":
    unittest.main()
