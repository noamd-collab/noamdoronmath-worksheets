"""Exercise every grade-five unlike-fraction role and its signed pupil data."""

from copy import deepcopy
from fractions import Fraction
import json
from pathlib import Path
import unittest
from unittest.mock import patch

import fraction_lesson as f
from general_source import GeneralSourceError, validate_source
from math_tasks import validate_and_solve_task
from provider import author_lesson
from runtime_catalog import scope_for_lesson
from validation import validate_model

FIX = (
    Path(__file__).resolve().parents[1]
    / "cloud/container/fixtures/general/grade5-unlike-fractions"
)


class FractionLessonTests(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIX / "lesson.json").read_text())
        self.data = json.loads((FIX / "model-output.json").read_text())

    @patch("provider.build_authoring_context", return_value={})
    def test_scope_and_replay(self, _context):
        with patch(
            "general_provider.author_general_lesson",
            side_effect=AssertionError("Unexpected live provider"),
        ):
            meta = {}
            supplied = author_lesson(self.lesson, offline_native_fixture=True, metadata=meta)
        self.assertEqual(meta["authorContract"], f.VERSION)
        self.assertFalse(meta["providerCalled"])
        validate_model(self.lesson, supplied)
        for field, value in (
            ("topicId", "ד12"),
            ("level", "e"),
            ("lastLesson", "מתחילים בשברים"),
            ("alreadyLearned", ["צמצום"]),
            ("lessonGoal", "assessment"),
            ("questionCount", 13),
        ):
            self.assertFalse(f.eligible(dict(self.lesson, **{field: value})))
        for seed in (-1, 2**32, True, "123"):
            with self.assertRaises(GeneralSourceError):
                f.build(self.lesson, {**self.data, "seed": seed})
        with self.assertRaises(GeneralSourceError):
            f.build(self.lesson, {**self.data, "answer": 2})

    def test_exact_rational_answers_from_pupil_words_and_native_table(self):
        scope = scope_for_lesson(self.lesson)
        for seed in (0, 1, 91, 89060, 2**32 - 1):
            source = f.build(self.lesson, {**self.data, "seed": seed})
            verified = validate_source(self.lesson, source, scope)
            qs = source["sections"][0]["questions"]
            self.assertEqual(len(verified["evidence"]["computations"]), 42)
            self.assertEqual(sum(q["star"] for q in qs), 3)
            self.assertEqual(sum("table" in q for q in qs), 1)
            self.assertFalse(any("figure" in q for q in qs))
            pairs = set()
            for n, q in enumerate(qs, 1):
                for j, it in enumerate(q["items"]):
                    result = validate_and_solve_task(it["answer"]["task"])
                    proof = f.printed_evidence(q, j, result)
                    a, b, *tail = map(Fraction, proof["printed"])
                    self.assertNotEqual(a.denominator, b.denominator)
                    pairs.add(frozenset((a, b)))
                    val = Fraction(proof["result"])
                    if n in (2, 4, 7, 10):
                        self.assertEqual(val, a - b)
                    if n in (1, 3, 6, 8, 12, 13):
                        self.assertEqual(val, a + b)
                    if n == 14:
                        self.assertEqual(val, a + b - tail[0])
                    if n == 12:
                        self.assertNotEqual(val, tail[0])
            self.assertEqual(len(pairs), 42)

    def test_rejects_fabricated_table_data_wrong_units_changed_prompt_or_answer(self):
        qs = f.build(self.lesson, self.data)["sections"][0]["questions"]
        table = qs[7]
        computed = validate_and_solve_task(table["items"][0]["answer"]["task"])

        def check(change):
            clone = deepcopy(table)
            change(clone)
            with self.assertRaises(GeneralSourceError):
                f.printed_evidence(clone, 0, computed)

        check(lambda q: q.pop("table"))
        check(lambda q: q["table"]["rows"][0].__setitem__(0, f.rich("יום אחר")))
        check(
            lambda q: q["table"]["rows"][0].__setitem__(1, [f.token(Fraction(1, 11))])
        )
        check(lambda q: q["items"][0]["answer"].update(unit="מטר"))
        check(
            lambda q: q["items"][0].update(prompt=f.rich("חשבו בעזרת התשובה המאושרת."))
        )
        with self.assertRaises(GeneralSourceError):
            f.printed_evidence(
                table,
                0,
                {**computed, "result": {"type": "expression", "value": f.number(1)}},
            )
        err = deepcopy(qs[11])
        solved = validate_and_solve_task(err["items"][0]["answer"]["task"])
        err["items"][0]["prompt"][-2] = f.token(Fraction(1, 11))
        with self.assertRaises(GeneralSourceError):
            f.printed_evidence(err, 0, solved)
