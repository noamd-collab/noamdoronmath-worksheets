from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import expression, spans
from general_source import GeneralSourceError
from math_tasks import validate_and_solve_task
from printed_tasks import match_printed_task


class PrintedTaskTests(unittest.TestCase):
    def bind(self, prompt, task, grade=4):
        solved = validate_and_solve_task({"kind": "evaluate", "expression": expression(task, grade)})
        item = {"prompt": spans(prompt, grade), "answer": {"unit": ""}}
        return match_printed_task(item, solved, grade)

    def test_first_operation_needs_an_operation_name_in_the_key(self):
        prompt = "איזו פעולה מבצעים ראשונה: [[12 + 3 * 4]]?"
        self.assertEqual(self.bind(prompt, "3*4").label, "כפל")
        with self.assertRaises(GeneralSourceError):
            self.bind(prompt, "12")
        self.assertEqual(self.bind("איזו פעולה מבצעים ראשונה: [[(8-2)+5]]?", "8-2").label, "חיסור")

    def test_unique_missing_number_is_derived_from_the_visible_equation(self):
        prompt = "השלימו: [[(___+6)*2-4=18]]"
        self.assertEqual(self.bind(prompt, "(18+4)/2-6").proof["value"]["numerator"], 5)
        with self.assertRaises(GeneralSourceError):
            self.bind(prompt, "8")
        with self.assertRaises(GeneralSourceError):
            self.bind("השלימו: [[___^2=4]]", "2", 8)
        self.assertIsNone(self.bind("השלימו: [[___ + x = 4]].", "1", 8))

    def test_solver_binds_the_only_printed_unknown_to_its_actual_spelling(self):
        from printed_tasks import printed_solve
        from math_tasks import number, operation
        prompt = spans("פתרו: [[2*z=16]]", 7)
        task = {"kind": "solve", "lhs": "2*z", "rhs": "16", "variable": "x"}
        bound = printed_solve(prompt, task, 7)
        self.assertEqual(bound["lhs"], operation("multiply", number(2), {"type": "symbol", "name": "x"}))
        self.assertEqual(validate_and_solve_task(bound)["result"]["values"], [number(8)])
        self.assertEqual(printed_solve(prompt, bound, 7), "z")
        for invalid in ({**task, "rhs": "17"}, {**task, "lhs": "2*a"}):
            with self.subTest(invalid=invalid), self.assertRaises(GeneralSourceError):
                printed_solve(prompt, invalid, 7)
        self.assertIsNone(printed_solve(spans("פתרו: [[2*z+y=16]]", 7), task, 7))


class PupilAnswerTypeTests(unittest.TestCase):
    def test_noun_mother_is_not_a_yes_no_question(self):
        from printed_tasks import yes_no_question
        for prompt in ["גיל האם הוא @ שנים, והבת צעירה ממנה ב־@ שנים. מה גיל הבת?",
                       "האם קנתה @ תפוחים. כמה תפוחים נשארו?",
                       "האם של דנה בת @. בת כמה דנה?"]:
            with self.subTest(prompt=prompt):
                self.assertFalse(yes_no_question(prompt))
        for prompt in ["האם @ גדול מ־@?", "בדקו: האם @ פתרון של המשוואה?",
                       "@ והאם התוצאה זוגית?", "המספר @. האם הוא זוגי?"]:
            with self.subTest(prompt=prompt):
                self.assertTrue(yes_no_question(prompt))

    def test_scalar_cannot_answer_question_asking_for_a_decision_or_equation(self):
        from printed_tasks import validate_computed_request
        from compact_authoring import spans
        from general_source import GeneralSourceError
        solved = {"result": {"type": "expression", "value": {"type": "number", "numerator": 6, "denominator": 1}}}
        for p in ("האם [[x=5]] מקיים את המשוואה [[x+1=6]]?", "כתבו משוואה שפתרונה הוא [[6]].",
                  "האם [[40%]] מתוך [[50]] גדול מ־[[20]]? חשבו את הערך המדויק."):
            with self.subTest(prompt=p), self.assertRaisesRegex(GeneralSourceError, "at q2.item.1"):
                validate_computed_request({}, {"prompt":spans(p, 8)}, solved, 8, "q2.item.1")
        validate_computed_request({}, {"prompt":spans("אם היו [[6]] ונוספו [[2]], כמה יש עכשיו?", 8)},
                                  solved, 8, "q2.item.1")
