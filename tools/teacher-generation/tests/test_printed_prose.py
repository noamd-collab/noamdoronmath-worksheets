from html import unescape
from pathlib import Path
import re
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import expression, spans
from general_adapters import _prints_calculation, rich_text
from general_source import GeneralSourceError, rich
from math_tasks import validate_and_solve_task
from printed_percentages import percentage_evidence


class PrintedProseTests(unittest.TestCase):
    def render(self, text, grade=8):
        return rich_text(rich(spans(text, grade), grade), grade)

    def test_authored_percent_numbers_match_explicitly_marked_forms(self):
        for sentence in (
            "אחוז הוא חלק מתוך מאה. כדי לחשב אחוז של כמות: מחלקים את האחוז ב־[[100]] ומכפילים בכמות.",
            "כמה הם [[20]] אחוזים מ־[[25]] התלמידים?",
            "במבחן היו [[50]] שאלות.",
            "דנה ענתה נכון על [[45]] שאלות. כמה אחוזים מהשאלות ענתה דנה נכון?",
        ):
            with self.subTest(sentence=sentence):
                self.assertEqual(spans(sentence, 8), spans(sentence.replace("[[", "").replace("]]", ""), 8))

    def test_printed_amount_precision_and_percent_base_keep_their_meaning(self):
        prompt = "כמה הם 12.50% מ־1,200 השקלים?"
        self.assertEqual(self.render(prompt), "כמה הם $12.50%$ מ־$1,200$ השקלים?")
        item = {"prompt": spans(prompt, 8), "answer": {"kind": "computed", "unit": "שקלים"}}
        lesson = {"gradeNumber": 8, "topicId": "g8:percentages"}
        def check(calculation):
            task = {"kind": "evaluate", "expression": expression(calculation, 8)}
            return percentage_evidence(lesson, spans("סכום הקנייה במבצע.", 8), item,
                                       validate_and_solve_task(task))
        proof = check("12.5/100*1200")
        self.assertEqual((proof["percent"], proof["whole"], proof["value"]), ("25/2", "1200", "150"))
        with self.assertRaises(GeneralSourceError):
            check("1200-12.5/100*1200")
        item["answer"]["unit"] = "אחוזים"
        with self.assertRaises(GeneralSourceError):
            check("150")
        self.assertEqual(self.render("18 תלמידים הם 60% מהכיתה. כמה תלמידים יש בכיתה?"),
                         "$18$ תלמידים הם $60%$ מהכיתה. כמה תלמידים יש בכיתה?")
        self.assertEqual(self.render("המחיר ירד מ־240 ל־180 שקלים. מהו אחוז ההנחה?"),
                         "המחיר ירד מ־$240$ ל־$180$ שקלים. מהו אחוז ההנחה?")

    def test_percentage_suffix_with_horizontal_spacing_remains_one_checked_quantity(self):
        expected = self.render("כמה הם 12.50% מ־1,200 השקלים?")
        for space in (" ", "\u00a0", "\u202f"):
            percentage = "12.50" + space + "%"
            for notation in (percentage, "[[" + percentage + "]]", "[[12.50]]" + space + "%"):
                with self.subTest(notation=notation):
                    prompt = "כמה הם " + notation + " מ־1,200 השקלים?"
                    self.assertEqual(self.render(prompt), expected)
                    item = {"prompt": spans(prompt, 8), "answer": {"kind": "computed", "unit": "שקלים"}}
                    lesson = {"gradeNumber": 8, "topicId": "g8:percentages"}
                    task = {"kind": "evaluate", "expression": expression(percentage + " * 1200", 8)}
                    proof = percentage_evidence(lesson, [], item, validate_and_solve_task(task))
                    self.assertEqual((proof["percent"], proof["value"]), ("25/2", "150"))
                    wrong = {"kind": "evaluate", "expression": expression("12.50 * 1200", 8)}
                    with self.assertRaises(GeneralSourceError):
                        percentage_evidence(lesson, [], item, validate_and_solve_task(wrong))
        for broken in ("12 %%", "12 % 3", "1 2 %", "12\n%"):
            with self.subTest(broken=broken), self.assertRaises(GeneralSourceError):
                expression(broken, 8)

    def test_standalone_identifiers_and_signed_quantities_are_display_only(self):
        self.assertEqual(self.render("מצאו את הנקודות A ו־B ואת הקטע AB."),
                         "מצאו את הנקודות $A$ ו־$B$ ואת הקטע $AB$.")
        self.assertEqual(self.render("חשבו את x."), "חשבו את $x$.")
        self.assertEqual([self.render(header) for header in ("x", "y")], ["$x$", "$y$"])
        self.assertEqual(self.render("הנקודה A(−2,4) נמצאת על הישר."),
                         "הנקודה $A(−2, 4)$ נמצאת על הישר.")
        self.assertEqual(self.render("הנקודה (1,234) נמצאת על הישר."),
                         "הנקודה $(1, 234)$ נמצאת על הישר.")
        self.assertEqual(self.render("הטמפרטורה עלתה מ-25 ל־30 מעלות."),
                         "הטמפרטורה עלתה מ-$25$ ל־$30$ מעלות.")
        self.assertEqual(self.render("הטמפרטורה היא −2 מעלות."), "הטמפרטורה היא $−2$ מעלות.")

    def test_ambiguous_or_unsupported_strings_still_fail_strict_validation(self):
        for raw in ("12–18", "12-18", "12:30", "1/2/2026", "2x+1", "x + 2 = 5", "12 34",
                    "1,23", "1e3", ".5", "abc", "XYZ", "A1", "3+x", "מלאו <A> כאן", "$2",
                    "1.2.3", "25%%", "קוד#123", "ערך (1,234)"):
            with self.subTest(raw=raw), self.assertRaises(GeneralSourceError):
                rich(spans("הנתון הוא " + raw + ".", 8), 8)
        with self.assertRaises(GeneralSourceError):
            rich([{"kind": "text", "text": "נתון 20."}], 8)

    def test_schoolbook_precedence_and_authored_parentheses_remain_visible(self):
        class Elementary:
            fmt = staticmethod(lambda n, grade: str(n))
            ltr = staticmethod(lambda s: "<bdi>" + s + "</bdi>")
            op = staticmethod(lambda op, grade: {"*": "×" if grade == "ב" else "x", "-": "−"}.get(op, op))
        for raw, grade, shown, canonical, answer in (
            ("12 + 3 x 4", 4, "12 + 3 x 4", "12+3*4", 24),
            ("12 + (3 x 4)", 4, "12 + (3 x 4)", "12+3*4", 24),
            ("(8 - 2) + 5", 4, "(8 − 2) + 5", "(8-2)+5", 11),
            ("20 : 4 - 2", 4, "20 : 4 − 2", "20/4-2", 3),
            ("2 x (3 + 4)", 2, "2 × (3 + 4)", "2*(3+4)", 14),
        ):
            with self.subTest(raw=raw, grade=grade):
                parts = rich(spans("חשבו: [[" + raw + "]].", grade), grade)
                output = unescape(re.sub("<[^>]+>", "", rich_text(parts, "אבגדהו"[grade - 1], Elementary)))
                self.assertEqual(output, "חשבו: " + shown + ".")
                result = validate_and_solve_task({"kind": "evaluate", "expression": expression(canonical, grade)})
                self.assertEqual(result["result"]["value"]["numerator"], answer)
                self.assertTrue(_prints_calculation({"prompt": parts}, result, grade))
        self.assertNotEqual(spans("[[3 x 4]]", 4), spans("[[frac(3,4)]]", 4))
        with self.assertRaises(GeneralSourceError):
            spans("[[3 x 4]]", 1)
        self.assertEqual(spans("[[x]]", 8)[0]["expression"]["name"], "x")
        for raw, rendered in (
            ("20 - ___ x 2 = 12", "20 − ___ x 2 = 12"),
            ("___ : 5 + 8 = 11", "___ : 5 + 8 = 11"),
            ("20 - (___ x 3 + 2) = 8", "20 − (___ x 3 + 2) = 8"),
        ):
            parts = rich(spans("[[" + raw + "]]", 4), 4)
            self.assertEqual(unescape(re.sub("<[^>]+>", "", rich_text(parts, "ד", Elementary))), rendered)


if __name__ == "__main__":
    unittest.main()
