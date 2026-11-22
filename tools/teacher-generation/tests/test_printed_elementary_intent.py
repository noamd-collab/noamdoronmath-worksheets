import json
from pathlib import Path
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from compact_authoring import expression, spans
from general_source import GeneralSourceError, validate_source
from math_tasks import validate_and_solve_task
from printed_elementary import printed_intent
from runtime_catalog import scope_for_lesson
from skill_authoring import source_findings


class PrintedElementaryIntentTests(unittest.TestCase):
    def binding(self, intro, prompt, task, unit=""):
        question = {"intro": spans(intro, 4)}
        item = {"prompt": spans(prompt, 4), "answer": {"kind": "computed", "task": task, "unit": unit}}
        return printed_intent(question, item, validate_and_solve_task(task), 4, location="q7.item.2")

    def calculated(self, raw):
        return {"kind": "evaluate", "expression": expression(raw, 4)}

    def test_composition_uses_printed_numbers_operations_and_their_order(self):
        intro = "כתבו תרגיל המשלב סוגריים עבור כל מצב מתואר, וחשבו את התוצאה:"
        for words, raw in (("הסכום של 6 ו-4, מוכפל ב-3.", "(6+4)*3"),
                           ("ההפרש בין 15 ל־7, מחולק ב־4.", "(15-7)/4"),
                           ("המכפלה של 5 ו־8, פחות 10.", "5*8-10")):
            self.assertEqual(self.binding(intro, words, self.calculated(raw)),
                             {"rule": "write_expression", "expression": expression(raw, 4)})
        for incorrect in ("6+4*3", "15+15", "(4+6)*3", "30"):
            with self.subTest(raw=incorrect), self.assertRaises(GeneralSourceError) as err:
                self.binding(intro, "הסכום של 6 ו-4, מוכפל ב-3.", self.calculated(incorrect))
            self.assertEqual(err.exception.code, "PRINTED_EXPRESSION_MISMATCH")
        self.assertEqual(self.binding("תרגול מילולי.", "כתבו תרגיל וחשבו את התוצאה: ההפרש בין 9 ל־3, מחולק ב־2.",
                                      self.calculated("(9-3)/2"))["rule"], "write_expression")

    def test_only_checked_comparisons_are_omitted(self):
        task = {"kind": "compare", "left": expression("(4+3)*2", 4), "right": expression("4+3*2", 4)}
        prompt = "השוו: [[(4 + 3) x 2]] לבין [[4 + 3 x 2]]"
        self.assertEqual(self.binding("השוו את הערכים.", prompt, task)["rule"], "printed_comparison")
        with self.assertRaises(GeneralSourceError) as err:
            self.binding("השוו את הערכים.", prompt, {**task, "right": task["left"]})
        self.assertEqual(err.exception.code, "PRINTED_EXPRESSION_MISMATCH")
        self.assertIsNone(self.binding("השוו את הערכים.", "בחרו סימן מתאים.", task))
        with self.assertRaises(GeneralSourceError):
            self.binding("כתבו תרגיל וחשבו את התוצאה:", prompt, task)

    def test_unknown_instruction_or_story_is_a_numbered_teaching_finding(self):
        intro = "כתבו תרגיל המשלב סוגריים עבור כל מצב מתואר, וחשבו את התוצאה:"
        for question, words in ((intro, "בכלי שני צבעים. שערו כמה גולות אדומות."),
                                (intro, "הסכום של 6 ו-4, מוכפל ב-3, ואז מפחיתים אחת."),
                                ("כתבו תרגיל וחשבו את התוצאה ואז הכפילו אותה.", "הסכום של 6 ו-4, מוכפל ב-3."),
                                ("הוסיפו אחת לכל מספר לפני החישוב.", "כתבו תרגיל וחשבו את התוצאה: הסכום של 6 ו-4, מוכפל ב-3.")):
            with self.subTest(words=words), self.assertRaises(GeneralSourceError) as err:
                self.binding(question, words, self.calculated("30"))
            self.assertEqual(err.exception.code, "PRINTED_EXPRESSION_SCOPE")
            self.assertNotIn(words, str(err.exception))
            self.assertIn(" at q7.item.2", str(err.exception))

    def test_canonical_intake_registers_the_exact_unmatched_exercise_for_correction(self):
        fixture = ROOT / "cloud/container/fixtures/general/grade4-fractions"
        lesson = json.loads((fixture / "lesson.json").read_text())
        source = json.loads((fixture / "model-output.json").read_text())
        scope = scope_for_lesson(lesson)
        source["sections"][0]["questions"][0]["intro"] = spans("כתבו תרגיל וחשבו את התוצאה:", 4)
        with self.assertRaises(GeneralSourceError) as err:
            validate_source(lesson, source, scope)
        self.assertEqual(err.exception.code, "PRINTED_EXPRESSION_SCOPE")
        count = lesson["questionCount"]
        raw = {"practice": [{} for _ in range(count - 3)], "challenges": [{} for _ in range(3)]}
        findings = source_findings(raw, lesson, scope, err.exception)
        self.assertEqual([(r["question"], r["codes"]) for r in findings], [(1, ["PRINTED_EXPRESSION_SCOPE"])])


if __name__ == "__main__":
    unittest.main()
