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
