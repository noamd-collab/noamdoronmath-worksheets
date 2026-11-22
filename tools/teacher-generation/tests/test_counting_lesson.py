import copy
import json
import sys
import unittest
from pathlib import Path
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import counting_lesson as counting
from general_source import GeneralSourceError, validate_source
from math_tasks import number
from provider import author_lesson
from runtime_catalog import scope_for_lesson
from validation import validate_model

FIXTURE = HERE / "cloud/container/fixtures/general/grade1-counting"


class CountingLessonTests(unittest.TestCase):
    def setUp(self):
        self.lesson = json.loads((FIXTURE / "lesson.json").read_text())
        self.parameters = json.loads((FIXTURE / "model-output.json").read_text())

    def test_native_eligible_intake_needs_no_provider_and_preserves_replay(self):
        metadata = {}
        with patch("counting_lesson.secrets.randbits", return_value=self.parameters["seed"]), patch(
                "general_provider.author_general_lesson", side_effect=AssertionError("unexpected provider call")):
            first = author_lesson(self.lesson, metadata=metadata)
        self.assertEqual(first, self.parameters)
        self.assertIs(metadata["providerCalled"], False)
        validate_model(self.lesson, first)
        source, expected = counting.build(self.lesson, first)
        self.assertEqual(counting.build(self.lesson, first), (source, expected))
        changed = counting.build(self.lesson, {**first, "seed":first["seed"]+1})
        self.assertNotEqual(changed, (source, expected))
        verified = validate_source(self.lesson, source, scope_for_lesson(self.lesson))["evidence"]
        self.assertFalse(verified["unverifiedAnswers"])
        self.assertEqual({v["itemId"]: v["computed"]["result"]["value"]["numerator"] for v in verified["computations"]}, expected)

    def test_count_every_displayed_row_from_independent_tokens_across_seeds(self):
        for seed in range(64):
            src, answers = counting.build(self.lesson, {**self.parameters, "seed":seed})
            qs = src["sections"][0]["questions"]
            self.assertEqual([q["star"] for q in qs], [False]*5+[True]*3)
            self.assertEqual(len({str(q["intro"]) for q in qs}),8)
            for i, question in enumerate(qs):
                self.assertFalse(set(("figure", "table", "drawingFromWords")) & set(question))
                row_answers = []
                for j,item in enumerate(question["items"]):
                    with self.subTest(seed=seed, question=i+1, slot=j+1):
                        prompt = item["prompt"]
                        value = prompt[0]["text"]
                        if i == 2:
                            label, row = value.split(": ")
                            n = row.split(", ").count(label.strip("״"))
                        elif i == 4:
                            n = value.count(" עִם ")
                        elif i == 5:
                            words, _ = value.split(". ")
                            n = len(words.split(", "))
                            claim = prompt[1]["expression"]["numerator"]
                            self.assertEqual(claim == n, j in (1,3))
                        elif i == 6:
                            n = len(set(value.split(", ")))
                        elif i == 7:
                            a,b = value.split(". וְעַכְשָׁו: ")
                            self.assertCountEqual(a.split(", "), b.split(", "))
                            self.assertNotEqual(a, b)
                            n = len(a.split(", "))
                        else:
                            n = len(value.split(", "))
                        self.assertEqual(answers[f"q{i+1}-i{j+1}"], n)
                        self.assertEqual(item["answer"]["task"], {"kind":"evaluate","expression":number(n)})
                        self.assertTrue(1 <= n <= 10)
                        self.assertFalse(set("+=−×÷") & set(value))
                        row_answers.append(n)
                self.assertEqual(len(set(row_answers)), 5)

    def test_invalid_or_out_of_scope_sources_fail_closed(self):
        normal = dict(self.lesson, lastLesson="תרגלנו ספירה עד עשר והתאמה חד־חד־ערכית.")
        self.assertTrue(counting.eligible(normal))
        for update in ({"level":"a"}, {"questionCount":10}, {"topicId":"א02"}, {"gradeNumber":2},
                       {"lastLesson":"תרגלנו ספירה עד חמש בלבד."}, {"lastLesson":"למדנו בלי התאמה"},
                       {"lastLesson":"תרגלנו ספירה לאחור"}, {"alreadyLearned":["חשוב לתרגל רק עם האות א"]},
                       {"lessonBoundary":dict(self.lesson["lessonBoundary"],conceptIds=["א01#0"])}):
            with self.subTest(update=update):
                self.assertFalse(counting.eligible({**self.lesson, **update}))
        for source in ({**self.parameters, "seed":True}, {**self.parameters, "seed":-1},
                       {**self.parameters, "seed":2**32}, {**self.parameters, "seed":1, "answer":4}):
            with self.assertRaises(GeneralSourceError):
                counting.build(self.lesson, source)

    def test_printed_evidence_rejects_disagreements(self):
        src, _ = counting.build(self.lesson, self.parameters)
        qs=src["sections"][0]["questions"]
        for index, corrupted in ((0,"דָּג, סַל"), (2,"״דָּג״: סַל, סַל"), (3,"רֹן, רֹן"),
                                 (4,"רֹן עִם רֹן"), (6,"טַל, רֹן"),
                                 (7,"טַל, רֹן. וְעַכְשָׁו: נִיר, טַל")):
            with self.assertRaises(GeneralSourceError):
                counting.answer_from_prompt(qs[index]["intro"], counting.rich(corrupted))
        bad_claim=copy.deepcopy(qs[5]["items"][0]["prompt"])
        bad_claim[1]["expression"]=number(11)
        with self.assertRaises(GeneralSourceError):
            counting.answer_from_prompt(qs[5]["intro"], bad_claim)
