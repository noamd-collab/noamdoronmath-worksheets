from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import expand_source, expression, spans
from general_source import GeneralSourceError
from math_tasks import validate_and_solve_task
from printed_tasks import matching_solution_choices, printed_solve


class EquationChoicesTests(unittest.TestCase):
    def setUp(self):
        # The third printed unknown z is represented as x by the bounded solver.
        work = (("x + 2 = 5", "x + 2", "5", "x"),
                ("y - 3 = 5", "y - 3", "5", "y"),
                ("2*z = 16", "2*x", "16", "x"))
        self.items = []
        for shown, left, right, name in work:
            task = {"kind": "solve", "lhs": expression(left, 7), "rhs": expression(right, 7), "variable": name}
            self.items.append({"prompt": spans("פתרון המשוואה [[" + shown + "]] הוא:", 7),
                               "answer": {"kind": "computed", "unit": "", "task": task}})
        self.intro = "התאימו לכל משוואה את הפתרון הנכון מתוך הרשימה: [[3]], [[5]], [[8]]."

    def check(self, intro=None, items=None, **kwargs):
        items = self.items if items is None else items
        evidence = [validate_and_solve_task(item["answer"]["task"]) for item in items]
        question = {"intro": spans(intro or self.intro, 7), "items": items, **kwargs}
        return matching_solution_choices(question, evidence, 7)

    def test_exact_public_integer_options_and_true_reuse(self):
        options, repeated = self.check()
        self.assertEqual([p["expression"]["numerator"] for p in options], [3, 5, 8])
        self.assertTrue(repeated)
        self.assertEqual(self.check(intro=self.intro.replace("[[", "").replace("]]", "")), (options, True))
        decimal = self.check(intro=self.intro.replace("[[5]]", "[[5.00]]"))[0][1]
        self.assertEqual(decimal, {"kind": "formula", "notation": "5.00"})
        self.assertFalse(self.check(items=self.items[:2])[1])
        self.assertEqual([printed_solve(i["prompt"], i["answer"]["task"], 7) for i in self.items],
                         ["x", "y", "z"])

    def test_wrong_or_duplicate_options_do_not_declare_any_public_givens(self):
        for raw in (self.intro.replace("[[8]]", "[[6]]"), self.intro.replace("[[5]]", "[[8]]"),
                    self.intro.replace("[[3]], [[5]], ", ""), self.intro + " הפתרון הראשון הוא שלוש.",
                    self.intro.replace("[[5]],", "[[5]], אחר כך")):
            with self.subTest(raw=raw), self.assertRaises(GeneralSourceError):
                self.check(intro=raw)
        self.assertIsNone(self.check(intro="נתונים מספרים: [[3]], [[5]], [[8]]."))

    def test_closed_solve_question_rejects_a_different_provider_equation(self):
        wrong = {"kind": "solve", "lhs": "2*x+4", "rhs": "12", "variable": "x"}
        for prompt in ("פתרו את המשוואה [[2x + 4 = 10]].", "[[2x + 4 = 10]]",
                       "פתרו: [[2x + 4 = 10]]."):
            item = {"prompt": prompt, "answer": {"kind": "computed", "task": wrong, "unit": ""}}
            with self.subTest(prompt=prompt), self.assertRaises(GeneralSourceError) as caught:
                expand_source({"version": 4, "sections": [{"questions": [{"items": [item]}]}]}, 7)
            self.assertEqual(caught.exception.code, "PRINTED_TASK_MISMATCH")
        canonical = {**wrong, "lhs": expression(wrong["lhs"], 7), "rhs": expression(wrong["rhs"], 7)}
        with self.assertRaises(GeneralSourceError):
            printed_solve(spans("פתרו את המשוואה [[2x + 4 = 10]].", 7), canonical, 7)
        self.assertIsNone(printed_solve(spans("בדוגמה התקבלה המשוואה [[2x + 4 = 10]]. פתרו את התרגיל הבא.", 7), canonical, 7))
        self.assertIsNone(printed_solve(spans("השוו [[2x + 4 = 10]] ו־[[2x + 4 = 12]].", 7), canonical, 7))
        self.assertEqual(printed_solve(spans("פתרו את המשוואה [[2z+4=12]].", 7), wrong, 7),
                         {**canonical})

    def test_disallow_spoilers_trivial_equations_and_inconsistent_evidence(self):
        altered = deepcopy(self.items)
        altered[0]["prompt"] = spans("הפתרון הוא שלוש: [[x + 2 = 5]].", 7)
        with self.assertRaises(GeneralSourceError):
            self.check(items=altered)
        altered[0]["prompt"] = spans("פתרון המשוואה [[x=3]] הוא:", 7)
        altered[0]["answer"]["task"].update(lhs=expression("x", 7), rhs=expression("3", 7))
        with self.assertRaises(GeneralSourceError):
            self.check(items=altered)
        altered = deepcopy(self.items)
        altered[1]["prompt"] = spans("פתרון המשוואה [[y + 3 = 5]] הוא:", 7)
        with self.assertRaises(GeneralSourceError):
            self.check(items=altered)
        with self.assertRaises(GeneralSourceError):
            self.check(table={"head": [], "rows": []})
        with self.assertRaises(GeneralSourceError):
            self.check(items=[self.items[1], self.items[2]])


if __name__ == "__main__":
    unittest.main()
