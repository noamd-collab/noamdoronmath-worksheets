"""Yes/no answers, and the refusal of answers without a key, from the provider wire format to the compiled sheet.

The yes/no items are the "האם" items of recorded provider replies for grade
three division (ג10) and grade eight percentages. In those replies they were
keyed with a number and refused; here each one carries the claim that a
provider is now asked for. Every prompt goes through expand_source first.
An elementary claim typed from a story, a label and an item without a key
have no proven key, and each one is refused.
"""
import copy
import json
from pathlib import Path
import re
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import answer_kinds
import compact_authoring
import provider
from general_adapters import _compile_middle, compile_source
from general_source import GeneralSourceError, validate_question, validate_source
from math_tasks import MathTaskError, number as n, operation as op, validate_and_solve_task as solve
from runtime_catalog import CURRICULUM_SHA256, catalog, scope_for_lesson
from skill_authoring import source_findings, worksheet_schema

TOPICS = {topic["topicId"]: topic for topic in catalog().topics}
OPEN = {"kind": "open"}


def lesson_for(topic_id, count=4):
    topic = TOPICS[topic_id]
    return {"version": 3, "gradeNumber": topic["gradeNumber"], "topicId": topic_id, "level": topic["levels"][0],
            "lessonGoal": "practice", "questionCount": count, "minutes": 45, "alreadyLearned": [],
            "lastLesson": "סיימנו ללמוד את הנושא ותרגלנו את המושגים שסומנו.",
            "lessonBoundary": {"version": 1, "kind": "curriculum_scope", "curriculumSha256": CURRICULUM_SHA256,
                               "conceptIds": [concept["id"] for concept in topic["concepts"]]}}


def decide(relation, left, right=None, values=None):
    task = {"kind": "decide", "relation": relation, "left": left}
    task.update({"values": values} if values is not None else {"right": right})
    return {"kind": "computed", "task": task, "unit": ""}


def evaluate(expression, unit=""):
    return {"kind": "computed", "task": {"kind": "evaluate", "expression": expression}, "unit": unit}


def compare(left, right):
    return {"kind": "computed", "task": {"kind": "compare", "left": left, "right": right}, "unit": ""}


def label(text):
    return {"kind": "label", "text": text}


def expand(topic_id, intro, prompt, answer, *, table=None):
    """Expand one wire question as the provider boundary does; return it with its scope and grade."""
    lesson = lesson_for(topic_id)
    scope = scope_for_lesson(lesson)
    grade = lesson["gradeNumber"]
    items = [{"prompt": prompt, "answer": copy.deepcopy(answer)} for _ in range(5 if grade <= 2 else 3)]
    question = {"intro": intro, "star": False, "items": items}
    if table is not None:
        question["table"] = table
    expanded = compact_authoring.expand_source({"version": 4, "sections": [{"questions": [question]}]}, grade,
                                               fraction_notation=scope["topic"]["domain"] == "fractions")
    return expanded["sections"][0]["questions"][0], scope, grade


def wire(topic_id, intro, prompt, answer, *, table=None):
    """Expand and validate one wire question; return it with its first item, exact result and pending rows."""
    question, scope, grade = expand(topic_id, intro, prompt, answer, table=table)
    evidence, pending = [], []
    validate_question(question, grade, scope, provider=True, qcount=1, evidence=evidence, pending=pending)
    return question, question["items"][0], evidence[0]["computed"] if evidence else None, grade, pending


def decision(*args, **extra):
    question, item, solved, grade, _ = wire(*args, **extra)
    return answer_kinds.bind_decision(question, item, solved, grade)


class DecideKernelTests(unittest.TestCase):
    def result(self, relation, left, right=None, values=None):
        task = {"kind": "decide", "relation": relation, "left": left}
        task.update({"values": values} if values is not None else {"right": right})
        return solve(task)["result"]

    def error(self, code, task):
        with self.assertRaises(MathTaskError) as raised:
            solve(task)
        self.assertEqual(raised.exception.code, code)

    def test_the_kernel_decides_orders_and_equalities_of_closed_expressions(self):
        quotient = op("divide", n(56), n(8))
        self.assertEqual(self.result("gt", quotient, n(5)),
                         {"type": "decision", "relation": "gt", "left": n(7), "right": n(5), "order": "greater", "holds": True})
        for relation, holds in (("lt", False), ("le", False), ("ge", True), ("eq", False), ("ne", True)):
            self.assertIs(self.result(relation, quotient, n(5))["holds"], holds)
        self.assertIs(self.result("eq", op("divide", n(12), n(3)), op("divide", n(12), n(4)))["holds"], False)
        self.assertIs(self.result("le", n(1, 2), n(2, 4))["holds"], True)
        self.assertIs(self.result("lt", op("sqrt", n(2)), n(3, 2))["holds"], True)  # exact, not a decimal estimate

    def test_divisibility_and_list_membership(self):
        even = self.result("divisible", op("divide", n(16), n(4)), n(2))
        self.assertEqual((even["holds"], even["quotient"], even["remainder"]), (True, n(2), n(0)))
        odd = self.result("not_divisible", n(25), n(4))
        self.assertEqual((odd["holds"], odd["quotient"], odd["remainder"]), (True, n(6), n(1)))
        self.assertIs(self.result("divisible", n(25), n(4))["holds"], False)
        listed = self.result("in", op("divide", n(36), n(6)), values=[n(2), n(4), n(6)])
        self.assertEqual((listed["holds"], listed["left"], listed["values"]), (True, n(6), [n(2), n(4), n(6)]))
        self.assertIs(self.result("not_in", n(5), values=[n(2), n(4)])["holds"], True)

    def test_only_a_closed_bounded_claim_is_decided(self):
        x = {"type": "symbol", "name": "x"}
        self.error("UNSUPPORTED_TASK", {"kind": "decide", "relation": "gt", "left": x, "right": n(1)})
        self.error("UNDEFINED_TASK", {"kind": "decide", "relation": "gt", "left": op("divide", n(1), n(0)), "right": n(1)})
        self.error("INVALID_TASK", {"kind": "decide", "relation": "about", "left": n(1), "right": n(1)})
        self.error("INVALID_TASK", {"kind": "decide", "relation": "divisible", "left": n(1, 2), "right": n(2)})
        self.error("INVALID_TASK", {"kind": "decide", "relation": "divisible", "left": n(4), "right": n(0)})
        self.error("INVALID_TASK", {"kind": "decide", "relation": "in", "left": n(3), "values": [n(3)]})
        self.error("INVALID_TASK", {"kind": "decide", "relation": "in", "left": n(3), "values": [n(k) for k in range(13)]})
        # No field for an authored verdict exists.
        self.error("INVALID_TASK", {"kind": "decide", "relation": "gt", "left": n(1), "right": n(2), "holds": True})


class DecisionWireTests(unittest.TestCase):
    def refused(self, *args, code="PRINTED_TASK_MISMATCH", **extra):
        with self.assertRaises(GeneralSourceError) as caught:
            wire(*args, **extra)
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def verdicts(self, topic_id, rows):
        return [decision(topic_id, intro, prompt, answer).verdict() for intro, prompt, answer in rows]

    def story(self, topic_id, intro, prompt, answer):
        """An elementary claim typed from a story: refused at its item; the binder's own decision, bound "story"."""
        question, scope, grade = expand(topic_id, intro, prompt, answer)
        with self.assertRaises(GeneralSourceError) as caught:
            validate_question(question, grade, scope, provider=True, qcount=1, evidence=[], pending=[])
        self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item),
                         ("PRINTED_ANSWER_KIND", 1, 1))
        item = question["items"][0]
        found = answer_kinds.bind_decision(question, item, solve(item["answer"]["task"]), grade)
        self.assertEqual(found.proof["bound"], "story")
        return found

    def test_recorded_grade_three_yes_no_items_are_decided(self):
        # Prompts as the provider wrote them, in the two recorded ג10 replies.
        rows = [
            ("השוו בין שני תרגילים ובחרו את התשובה הנכונה.", "האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?",
             decide("eq", "12/3", "12/4")),
            ("נחשו את הטווח ואז חשבו את הערך המדויק.", "האם המנה של [[56 : 8]] גדולה מ-5? חשבו את המנה המדויקת.",
             decide("gt", "56/8", "5")),
            ("נחשו את הטווח ואז חשבו את הערך המדויק.", "האם המנה של [[45 : 9]] קטנה מ-6? חשבו את המנה המדויקת.",
             decide("lt", "45/9", "6")),
            ("נחשו את הטווח ואז חשבו את הערך המדויק.", "האם המנה של [[72 : 8]] גדולה מ-8? חשבו את המנה המדויקת.",
             decide("gt", "72/8", "8")),
            ("השוו בין התוצאות:", "האם התוצאה של [[30 : 5]] גדולה מהתוצאה של [[30 : 6]]?", decide("gt", "30/5", "30/6")),
            ("נחשו טווח וחשבו:", "האם התוצאה של [[72 : 9]] היא שווה ל-8? חשבו את התוצאה המדויקת.", decide("eq", "72/9", "8")),
            ("שייכו כל תרגיל לקטגוריה המתאימה:", "האם [[16 : 4]] הוא חילוק שמביא לתוצאה זוגית?", decide("divisible", "16/4", "2")),
            ("שייכו כל תרגיל לקטגוריה המתאימה:", "האם [[25 : 5]] הוא חילוק שמביא לתוצאה אי-זוגית?",
             decide("not_divisible", "25/5", "2")),
            ("שייכו כל תרגיל לקטגוריה המתאימה:", "האם [[36 : 6]] הוא חילוק שמביא לתוצאה זוגית?", decide("divisible", "36/6", "2")),
        ]
        self.assertEqual(self.verdicts("ג10", rows), ["לא", "כן", "כן", "כן", "כן", "כן", "כן", "כן", "כן"])
        # Three items of the same replies type their first side from a story. No binder proves
        # that reading, so in elementary each one is refused; the binder still decides the claim.
        stories = [
            ("חשבו לאחור:", "מספר חולק ב-6 והתקבל 7. האם המספר המקורי גדול מ-40?", decide("gt", "6*7", "40")),
            ("חשבו לאחור:", "מספר חולק ב-8 והתקבל 5. האם המספר המקורי קטן מ-40?", decide("lt", "8*5", "40")),
            ("חשבו לאחור:", "מספר חולק ב-9 והתקבל 4. האם המספר המקורי שווה ל-36?", decide("eq", "9*4", "36")),
        ]
        self.assertEqual([self.story("ג10", *row).verdict() for row in stories], ["כן", "לא", "כן"])
        # The same question in the other order of its two sides is the same claim.
        self.assertEqual(decision("ג10", "נחשו.", "האם המנה של [[56 : 8]] גדולה מ-5?", decide("lt", "5", "56/8")).verdict(), "כן")

    def test_a_printed_statement_is_judged_from_the_print(self):
        rows = [
            ("בדקו אם התרגילים הבאים נכונים לפי הקשר ההפוך לכפל.", "האם [[32 : 4 = 8]] נכון? בדקו באמצעות כפל.",
             decide("eq", "32/4", "8")),
            # The provider checks by multiplying; the verdict is still that of the printed division.
            ("בדקו אם התרגילים הבאים נכונים לפי הקשר ההפוך לכפל.", "האם [[21 : 3 = 7]] נכון? בדקו באמצעות כפל.",
             decide("eq", "7*3", "21")),
            ("מצאו את הטעות ותקנו אותה.", "תלמיד כתב: [[30 : 5 = 7]]. האם זה נכון? אם לא, מה התשובה הנכונה?",
             decide("eq", "30/5", "7")),
            ("מצאו את הטעות:", "דני כתב ש-[[32 : 4 = 7]]. בדקו באמצעות כפל האם התשובה נכונה.", decide("eq", "4*7", "32")),
            ("מצאו את הטעות:", "יוסי כתב ש-[[54 : 6 = 9]]. בדקו באמצעות כפל האם התשובה נכונה.", decide("eq", "6*9", "54")),
        ]
        self.assertEqual(self.verdicts("ג10", rows), ["כן", "כן", "לא", "לא", "כן"])
        bound = decision("ג10", "מצאו את הטעות.", "תלמיד כתב: [[30 : 5 = 7]]. האם זה נכון?", decide("eq", "30/5", "7"))
        self.assertEqual(bound.proof["rule"], "printed_statement")
        self.assertEqual(bound.steps, (("value", op("divide", n(30), n(5)), n(6)),))  # the key can show 30 : 5 = 6
        # A claim that is true while the printed statement is false would print a wrong "כן".
        self.refused("ג10", "בדקו.", "האם [[32 : 4 = 7]] נכון?", decide("eq", "8*4", "32"))
        # Two ways and one equation in one item: nothing says which of them is judged.
        self.refused("ג10", "השוו בין שתי דרכי בדיקה עבור אותו תרגיל.",
                     "עבור [[12 : 2 = 6]], דרך א' היא [[6 x 2]]. דרך ב' היא [[2 x 6]]. האם שתיהן נכונות?",
                     decide("eq", "6*2", "2*6"), code="PRINTED_ANSWER_KIND")

    def test_a_scalar_key_for_a_yes_no_question_still_fails_closed(self):
        # The recorded answers: one of the two quotients, or the product used for the check.
        for prompt, expression in (("האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?", "12/3"),
                                   ("האם [[32 : 4 = 8]] נכון? בדקו באמצעות כפל.", "8*4"),
                                   ("האם המנה של [[56 : 8]] גדולה מ-5? חשבו את המנה המדויקת.", "56/8")):
            with self.subTest(prompt=prompt):
                self.refused("ג10", "בדקו.", prompt, evaluate(expression), code="PRINTED_ANSWER_KIND")

    def test_a_true_claim_that_is_not_the_printed_question_is_refused(self):
        greater = "האם המנה של [[56 : 8]] גדולה מ-5? חשבו את המנה המדויקת."
        self.refused("ג10", "נחשו.", greater, decide("lt", "56/8", "5"))        # the opposite relation
        self.refused("ג10", "נחשו.", greater, decide("gt", "5", "56/8"))        # the sides exchanged
        self.refused("ג10", "נחשו.", greater, decide("gt", "56/8", "6"))        # a number that is not printed
        self.refused("ג10", "נחשו.", greater, decide("gt", "56", "5"))          # the printed calculation left out
        same = "האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?"
        self.refused("ג10", "השוו.", same, decide("eq", "12/3", "12/3"))        # a side compared with itself
        self.refused("ג10", "השוו.", same, decide("eq", "12/3", "4"))
        self.refused("ג10", "השוו.", same, decide("ne", "12/3", "12/4"))
        order = "האם התוצאה של [[30 : 5]] גדולה מהתוצאה של [[30 : 6]]?"
        self.refused("ג10", "השוו.", order, decide("gt", "30/6", "30/5"))
        self.refused("ג10", "שייכו.", "האם [[25 : 5]] הוא חילוק שמביא לתוצאה אי-זוגית?", decide("divisible", "25/5", "2"))
        self.refused("ג03", "ענו.", "האם [[25]] מתחלק ב־[[4]]?", decide("divisible", "4", "25"))

    def test_named_quantities_bind_the_claim_by_value_and_a_story_is_refused_in_elementary(self):
        # The sentence names both quantities, so the verdict is that of the print:
        # every printed number is used here, and still the claim is not the question.
        percent = "האם [[10%]] מ-[[50]] שווה ל-[[5]]?"
        self.refused("g8:percentages", "בדקו.", percent, decide("eq", "10/50", "100+5"))
        self.refused("g8:percentages", "בדקו.", percent, decide("eq", "(50/100)*5", "10+100"))
        self.assertEqual(decision("g8:percentages", "בדקו.", percent, decide("eq", "50/10", "5")).proof["bound"], "print")
        self.refused("g8:percentages", "בדקו.", "האם [[60%]] גדול מ[[50%]]?", decide("gt", "60", "50/100"))  # two readings mixed
        self.refused("g8:percentages", "בדקו.", "האם [[10%]] מ-[[100]] גדול מ-[[5]]?", decide("gt", "10+100", "5-100"))
        self.refused("ג10", "נחשו.", "האם המנה של [[56 : 8]] גדולה מ-5?", decide("gt", "56-8", "5"))
        statement = decision("ג10", "בדקו.", "האם [[32 : 4 = 8]] נכון?", decide("eq", "32/4", "8"))
        self.assertEqual(statement.proof["bound"], "print")
        # A side that only a story describes is checked for its numbers only: no proven key in
        # elementary, so the item is refused. In middle school the item is listed for the teacher.
        story = "מספר חולק ב-6 והתקבל 7. האם המספר המקורי גדול מ-40?"
        self.assertEqual(self.story("ג10", "חשבו לאחור:", story, decide("gt", "6*7", "40")).verdict(), "כן")
        pending = wire("g8:percentages", "חשבו לאחור:", "מספר חולק ב־[[6]] והתקבל [[7]]. האם המספר המקורי גדול מ־[[40]]?",
                       decide("gt", "6*7", "40"))[4]
        self.assertEqual([(row["question"], row["item"], row["kind"]) for row in pending],
                         [(1, 1, "decision"), (1, 2, "decision"), (1, 3, "decision")])
        self.refused("ג10", "חשבו לאחור:", story, decide("gt", "6*7", "6*7"))   # the named 40 is not a typed side
        self.assertEqual(wire("ג10", "נחשו.", "האם המנה של [[56 : 8]] גדולה מ-5?", decide("gt", "56/8", "5"))[4], [])

    def test_only_a_yes_no_question_about_one_relation_is_decided(self):
        either = "האם התוצאה של [[(2 + 3) * 4]] גדולה, קטנה או שווה לתוצאה של [[2 + 3 * 4]]?"
        self.refused("ד07", "השוו.", either, decide("gt", "(2+3)*4", "2+3*4"), code="PRINTED_ANSWER_KIND")
        wire("ד07", "השוו.", either, compare("(2+3)*4", "2+3*4"))  # two outcomes are a comparison
        self.refused("ד07", "בדקו.", "האם הביטוי [[7 + 2 * 3]] מכיל סוגריים? חשבו אותו.", decide("eq", "7+2*3", "13"),
                     code="PRINTED_ANSWER_KIND")
        self.refused("ג03", "חשבו.", "כמה הם [[24 : 6]]?", decide("eq", "24/6", "4"), code="PRINTED_ANSWER_KIND")
        self.refused("ג03", "חשבו.", "[[24 : 6]]", decide("eq", "24/6", "4"), code="PRINTED_ANSWER_KIND")
        self.refused("ג10", "מצאו.", "דני כתב ש-[[32 : 4 = 7]]. האם דני טעה?", decide("ne", "32/4", "7"), code="PRINTED_ANSWER_KIND")
        self.refused("g7:equations", "בדקו.", "האם [[x=5]] הוא פתרון של המשוואה [[x + 3 = 8]]?", decide("eq", "5+3", "8"),
                     code="PRINTED_ANSWER_KIND")

    def test_true_false_forms_and_a_question_asked_once_for_the_group(self):
        self.assertEqual(decision("ג02", "נכון או לא נכון?", "[[345 < 354]]", decide("lt", "345", "354")).verdict(), "נכון")
        self.assertEqual(decision("ג02", "קבעו.", "נכון או לא נכון: [[345 > 354]]", decide("gt", "345", "354")).verdict(), "לא נכון")
        self.assertEqual(decision("ג02", "האם הטענה נכונה?", "[[345 < 354]]", decide("lt", "345", "354")).verdict(), "כן")
        self.assertEqual(decision("ד07", "בדקו.", "בדקו: האם [[(3 + 2) * 3 = 15]]?", decide("eq", "(3+2)*3", "15")).verdict(), "כן")
        self.assertEqual(decision("ד07", "בדקו.", "קבעו אם [[(3 + 2) * 3 = 16]].", decide("eq", "(3+2)*3", "16")).verdict(), "לא")
        shared = "נתונים שני תרגילים: [[2 + 3]] ו־[[1 + 4]]."
        self.assertEqual(decision("ד07", shared, "האם התוצאות שוות? (כן/לא)", decide("eq", "2+3", "1+4")).verdict(), "כן")
        self.refused("ד07", shared, "האם התוצאות שוות? (כן/לא)", decide("eq", "2+3", "2+3"))
        pointed = decision("ב10", "הַשְׁווּ.", "הַאִם [[5 + 3]] גָּדוֹל מִ־[[7]]?", decide("gt", "5+3", "7"))
        self.assertEqual((pointed.verdict(), pointed.verdict(pointed=True)), ("כן", "כֵּן"))

    def test_the_no_regrouping_topic_accepts_a_claim_inside_its_bounds(self):
        fixture = HERE / "cloud/container/fixtures/general/grade2-vocalized"
        lesson = json.loads((fixture / "lesson.json").read_text(encoding="utf-8"))
        payload = json.loads((fixture / "model-output.json").read_text(encoding="utf-8"))
        scope = scope_for_lesson(lesson)
        item = payload["sections"][0]["questions"][0]["items"][0]
        add = lambda a, b: op("add", n(a), n(b))

        def ask(left):
            item["prompt"] = [{"kind": "text", "text": "הַאִם "}, {"kind": "math", "expression": left},
                              {"kind": "text", "text": " גָּדוֹל מִ־"}, {"kind": "math", "expression": n(35)},
                              {"kind": "text", "text": "?"}]
            item["answer"] = {"kind": "computed", "unit": "",
                              "task": {"kind": "decide", "relation": "gt", "left": left, "right": n(35)}}
            return validate_source(lesson, payload, scope, provider=True)

        self.assertIs(ask(add(23, 14))["evidence"]["computations"][0]["computed"]["result"]["holds"], True)
        with self.assertRaises(GeneralSourceError) as caught:
            ask(add(19, 19))  # regrouping is outside the selected concept, in a yes/no question too
        self.assertEqual(caught.exception.code, "SOURCE_ADDITION_SCOPE")

    def test_divisibility_negation_sufficiency_and_membership(self):
        self.assertEqual(decision("ג03", "ענו.", "האם [[24]] מתחלק ב־[[6]]?", decide("divisible", "24", "6")).verdict(), "כן")
        remainder = decision("ג03", "ענו.", "האם [[25]] מתחלק ב־[[4]]?", decide("divisible", "25", "4"))
        self.assertEqual((remainder.verdict(), remainder.steps), ("לא", (("division", n(25), n(4), n(6), n(1)),)))
        self.assertEqual(decision("ג03", "ענו.", "האם [[7]] אינו גדול מ־[[5]]?", decide("le", "7", "5")).verdict(), "לא")
        # A sufficiency question types one side from its story: refused in elementary.
        self.assertEqual(self.story("ג08", "פתרו את הבעיה.", "האם [[124]] גולות מספיקות ל־[[4]] ילדים שכל אחד רוצה [[30]]?",
                                    decide("ge", "124", "4*30")).verdict(), "כן")
        numbers = "המספרים: [[2]], [[4]], [[6]], [[8]]."
        asked = "האם התוצאה של [[36 : 6]] נמצאת ברשימה?"
        self.assertEqual(decision("ג03", numbers, asked, decide("in", "36/6", values=["2", "4", "6", "8"])).verdict(), "כן")
        self.refused("ג03", numbers, asked, decide("in", "36/6", values=["2", "4", "8"]))  # a list without its 6

    def test_recorded_grade_eight_percent_items(self):
        recorded = [
            ("נבאו טווח ואז חשבו ערך ספציפי.", "האם [[10]]% מ-[[100]] גדול מ-[[5]]? חשבו את הערך המדויק.",
             decide("gt", "(10/100)*100", "5")),
            ("נבאו טווח ואז חשבו ערך ספציפי.", "האם [[20]]% מ-[[50]] גדול מ-[[10]]? חשבו את הערך המדויק.",
             decide("gt", "(20/100)*50", "10")),
            ("התאימו דוגמה לקטגוריה ובדקו את התוצאה.", "האם [[10]]% מ-[[50]] שווה ל-[[5]]?", decide("eq", "(10/100)*50", "5")),
            ("זהו איזה מקרה מתאים לקטגוריה.", "האם [[60%]] גדול מ[[50%]]?", decide("gt", "60/100", "50/100")),
            ("זהו איזה מקרה מתאים לקטגוריה.", "האם [[40%]] גדול מ[[50%]]?", decide("gt", "40", "50")),
            ("מצאו ותקנו טעות סבירה.", "תלמיד חישב [[10]]% מ-[[200]] וקיבל [[2]]. האם זה נכון? אם לא, מה התשובה הנכונה?",
             decide("eq", "(10/100)*200", "2")),
            ("השוו בין שני מקרים וזהו את ההבדל.", "חשבו [[10]]% מ-[[100]] וחשבו [[20]]% מ-[[50]]. האם התוצאות שוות?",
             decide("eq", "(10/100)*100", "(20/100)*50")),
            ("השוו בין שני מצבים וזהו את ההבדל.",
             "במבחן א' נכשלו [[5]] מתוך [[25]] תלמידים. במבחן ב' נכשלו [[4]] מתוך [[20]] תלמידים. "
             "האם אחוז הנכשלים זהה בשני המבחנים?", decide("eq", "(5/25)*100", "(4/20)*100")),
        ]
        # As recorded, a percent sign after its island is refused for its notation; nothing moves it inside.
        for intro, prompt, answer in recorded:
            if "]]%" in prompt:
                with self.subTest(prompt=prompt):
                    self.refused("g8:percentages", intro, prompt, answer, code="SOURCE_NOTATION")
        # With the sign inside the island, as the author request asks ([[25%]]), each one is decided.
        rows = [(intro, prompt.replace("]]%", "%]]"), answer) for intro, prompt, answer in recorded]
        self.assertEqual(self.verdicts("g8:percentages", rows), ["כן", "לא", "כן", "כן", "לא", "לא", "כן", "כן"])
        self.refused("g8:percentages", "בדקו.", "האם [[10%]] מ-[[100]] גדול מ-[[5]]? חשבו את הערך המדויק.",
                     evaluate("(10/100)*100"), code="PRINTED_ANSWER_KIND")
        # "קטן או גדול" offers two outcomes: a comparison, as before, and never a yes or a no.
        both = "האם [[15%]] מתוך [[100]] קטן או גדול מ[[20]]? חשבו את הערך המדויק."
        self.refused("g8:percentages", "בדקו.", both, decide("lt", "(15/100)*100", "20"), code="PRINTED_ANSWER_KIND")
        wire("g8:percentages", "בדקו.", both, compare("(15/100)*100", "20"))

    def test_middle_school_key_prints_the_verdict_and_its_calculation(self):
        lesson = lesson_for("g8:percentages")
        scope = scope_for_lesson(lesson)
        rows = [("האם [[10%]] מ-[[100]] גדול מ-[[5]]?", decide("gt", "(10/100)*100", "5")),
                ("האם [[25%]] מ-[[48]] שווה ל-[[15]]?", decide("eq", "(25/100)*48", "15")),
                ("האם [[40%]] גדול מ[[50%]]?", decide("gt", "40", "50"))]
        question = {"intro": "ענו.", "star": False, "items": [{"prompt": p, "answer": a} for p, a in rows]}
        question = compact_authoring.expand_source({"version": 4, "sections": [{"questions": [question]}]}, 8)["sections"][0]["questions"][0]
        evidence = []
        validate_question(question, 8, scope, provider=True, qcount=1, evidence=evidence, pending=[])
        source = {"title": "דף", "rule": [{"kind": "text", "text": "כלל"}],
                  "sections": [{"title": "תרגול", "conceptIds": lesson["lessonBoundary"]["conceptIds"], "questions": [question]}]}
        with tempfile.TemporaryDirectory() as temp:
            _compile_middle(lesson, source, {"computations": evidence}, scope, None, Path(temp))
            draft = json.loads((Path(temp) / "worksheet-source.json").read_text(encoding="utf-8"))
            checks = json.loads((Path(temp) / "verified.json").read_text(encoding="utf-8"))["printedChecks"]
        items = draft["questions"][0]["items"]
        self.assertEqual([item["answer"] for item in items],
                         [r"כן. $\f{10}{100} · 100 = 10$", r"לא. $\f{25}{100} · 48 = 12$", "לא"])
        self.assertEqual(items[0]["text"], "האם $10%$ מ-$100$ גדול מ-$5$?")  # the claim is not printed beside its question
        self.assertEqual(checks["q1-i1"]["rule"], "printed_question")


class LabelAndOpenWireTests(unittest.TestCase):
    """A label (a name that no kernel computes) and an item without a key have no proven key.

    Neither is an answer kind: each one is refused like any unsupported kind.
    """

    def refused(self, *args, code="PRINTED_ANSWER_KIND", **extra):
        with self.assertRaises(GeneralSourceError) as caught:
            wire(*args, **extra)
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def unsupported(self, *args, **extra):
        return self.refused(*args, code="SOURCE_ANSWER", **extra)

    def test_a_label_is_refused(self):
        self.unsupported("ג16", "מיינו את המשולש.", "משולש שכל צלעותיו שוות נקרא ___", label("משולש שווה צלעות"))
        self.unsupported("ג16", "ענו.", "איזה מצולע הוא בעל שלוש צלעות?", label("משולש"))
        table = {"head": ["יום", "ספרים"], "rows": [["ראשון", "[[4]]"], ["שני", "[[9]]"], ["שלישי", "[[6]]"]]}
        self.unsupported("ג20", "התבוננו בטבלה וענו.", "באיזה יום נקראו הכי הרבה ספרים?", label("יום שני"), table=table)
        for name in ("מְשֻׁלָּשׁ", "מְרֻבָּע", "מְחֻמָּשׁ"):
            self.unsupported("ב28", "עֲנוּ.", "אֵיזוֹ צוּרָה הִיא בַּעֲלַת שָׁלוֹשׁ צְלָעוֹת?", label(name))

    def test_a_label_never_replaces_an_answer_that_can_be_computed(self):
        naming = "איזה מצולע הוא בעל שלוש צלעות?"
        self.unsupported("ג16", "ענו.", naming, label("3"))                       # a number
        self.unsupported("ג16", "ענו.", "כמה צלעות יש למשולש?", label("שלוש"))     # a number in words
        self.unsupported("ג16", "ענו.", naming, label("עשרים וחמש"))
        self.unsupported("ג16", "ענו.", naming, label("רבע"))
        self.unsupported("ג16", "ענו.", "כמה צלעות יש למשולש?", label("משולש"))    # a quantity is asked for
        self.unsupported("ג16", "ענו.", "האם לכל משולש יש שלוש צלעות?", label("כן"))  # the author never supplies a verdict
        self.unsupported("ג16", "ענו.", "איזה מספר גדול יותר?", label("גדול"))
        self.unsupported("ג16", "ענו.", naming, label("משולש ישר זווית מאוד מאוד מיוחד"))
        self.unsupported("ג16", "ענו.", naming, label("משולש [[3]]"))
        self.unsupported("ג16", "ענו.", "[[3 + ___ = 7]]", label("ארבע"))
        self.unsupported("ג16", "ענו.", "שרטטו משולש שווה צלעות.", label("משולש"))
        for prompt in ("מספר כלשהו חולק ב-6 והתקבלה התוצאה 7. מה היה המספר המקורי?",
                       "מהי הפעולה הראשונה בביטוי [[10 + 2 * 3]]?",
                       "בחידוש [[7 + 2 * 5]], איזו פעולה ראשונה?",
                       "איזה תרגיל נותן תוצאה גדולה יותר: [[20 : 4]] או [[20 : 5]]?",
                       "כדי לבדוק את [[45 : 9 = 5]], איזה כפל צריך לעשות?",
                       "אילו הייתה הזמנה של 2 מנות ראשונות ו-2 מנות עיקריות, מה הייתה העלות?",
                       "מי מהשיטות הבאות בודקת נכון את התרגיל [[20 : 4 = 5]]? א. [[4 x 5 = 20]]. ב. [[20 + 4 = 24]]."):
            with self.subTest(prompt=prompt):
                self.unsupported("ד07", "ענו.", prompt, label("כפל"))
        self.unsupported("ג16", "מיינו את המשולשים.", "משולש שצלעותיו [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ.", label("שונה צלעות"))
        self.unsupported("ג16", "ענו.", naming, label("מְשֻׁלָּשׁ"))
        self.unsupported("ב28", "עֲנוּ.", "אֵיזוֹ צוּרָה הִיא בַּעֲלַת שָׁלוֹשׁ צְלָעוֹת?", label("משולש"))
        self.unsupported("g7:coordinate_system", "ענו.", "באיזה רביע נמצאת הנקודה [[A(-2,3)]]?", label("ברביע השני"))

    def test_an_item_without_a_key_is_refused(self):
        self.unsupported("ד28", "בנו משולש.", "שרטטו משולש שצלעותיו [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ.", OPEN)
        self.unsupported("ג18", "בנו צורה על הרשת.", "ציירו על הרשת מלבן ששטחו [[12]] משבצות.", OPEN)
        self.unsupported("ג02", "ענו.", "תנו דוגמה למספר שנמצא בין [[340]] ל־[[360]].", OPEN)
        self.unsupported("ג02", "ענו.", "הסבירו מדוע [[345]] קטן מ־[[354]].", OPEN)
        self.unsupported("ג18", "ענו.", "כמה משבצות יש במלבן שאורכו [[4]] ורוחבו [[3]]?", OPEN)
        self.unsupported("ג02", "ענו.", "[[345 + 10 = ___]]", OPEN)
        self.refused("ג02", "ענו.", "[[345]] + [[10]] = ___", OPEN, code="SOURCE_NOTATION")  # its blank outside the island
        self.unsupported("ד28", "בנו משולש.", "שרטטו משולש שצלעותיו [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ. מה היקפו?", OPEN)
        self.unsupported("ד18", "נמקו.", "האם כל ריבוע הוא מלבן? נמקו.", OPEN)
        self.unsupported("ד28", "בנו משולש.", "שרטטו משולש.", {"kind": "open", "text": "משולש"})
        self.unsupported("g7:coordinate_system", "ענו.", "שרטטו מערכת צירים.", OPEN)
        self.unsupported("ג02", "ציירו ישר מספרים.", "ציירו ישר מספרים מ־[[300]] עד [[400]] וסמנו את [[350]].", OPEN)
        self.unsupported("ב28", "צַיְּרוּ בְּעִפָּרוֹן.", "צַיְּרוּ מְשֻׁלָּשׁ.", OPEN)
        self.unsupported("ב10", "צַיְּרוּ בְּעִפָּרוֹן.", "צַיְּרוּ [[5]] עִגּוּלִים.", OPEN)
        # Drawings stay in geometry lessons, in the pointed spelling of the young grades too.
        self.refused("ב10", "צַיְּרוּ בְּעִפָּרוֹן.", "צַיְּרוּ [[5]] עִגּוּלִים.", evaluate("5"), code="DRAWING_POLICY")

    def test_a_drawing_is_never_keyed_by_a_number(self):
        drawing = "שרטטו משולש שצלעותיו [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ."
        self.refused("ד28", "בנו משולש.", drawing, evaluate("12"))
        self.refused("ג18", "בנו צורה על הרשת.", "ציירו על הרשת מלבן ששטחו [[12]] משבצות.", evaluate("12"))
        self.refused("ג02", "ענו.", "הסבירו מדוע [[345]] קטן מ־[[354]].", evaluate("354"))
        self.refused("ג02", "ציירו ישר מספרים.", "ציירו ישר מספרים מ־[[300]] עד [[400]] וסמנו את [[350]].", evaluate("350"),
                     code="DRAWING_POLICY")
        # A question beside the drawing keeps its computed key.
        _, _, solved, _, _ = wire("ד28", "בנו משולש.", drawing + " מה היקפו?", evaluate("3 + 4 + 5", "ס״מ"))
        self.assertEqual(solved["result"]["value"], n(12))
        # A request to write an expression is bound by its own binder, as before.
        _, _, solved, _, _ = wire("ד07", "כתבו תרגיל וחשבו את התוצאה:", "הסכום של [[6]] ו־[[4]], מוכפל ב־[[3]].", evaluate("(6 + 4) * 3"))
        self.assertEqual(solved["result"]["value"], n(30))


class AdapterTests(unittest.TestCase):
    """The same wire questions through the trusted adapter and the pinned elementary skill."""

    @classmethod
    def setUpClass(cls):
        from cloud.container.skill_bundle import install
        temp = tempfile.TemporaryDirectory()
        cls.addClassCleanup(temp.cleanup)
        cls.root = Path(temp.name)
        install(HERE / "cloud/container/skills", cls.root / "skills", HERE / "skill-lock.json")
        cls.skill = cls.root / "skills/elementary"

    def source(self, topic_id, questions):
        lesson = lesson_for(topic_id, len(questions))
        scope = scope_for_lesson(lesson)
        rows = [{"intro": intro, "star": index >= len(questions) - 2,
                 "items": [{"prompt": prompt, "answer": copy.deepcopy(answer)} for prompt, answer in items]}
                for index, (intro, items) in enumerate(questions)]
        payload = {"version": 4, "title": "דף תרגול" if lesson["gradeNumber"] > 2 else "דַּף תִּרְגּוּל",
                   "rule": "קראו כל שאלה בעיון." if lesson["gradeNumber"] > 2 else "קִרְאוּ כָּל שְׁאֵלָה.",
                   "sections": [{"title": "תרגול" if lesson["gradeNumber"] > 2 else "תִּרְגּוּל",
                                 "conceptIds": lesson["lessonBoundary"]["conceptIds"], "questions": rows}]}
        expanded = compact_authoring.expand_source(payload, lesson["gradeNumber"],
                                                   fraction_notation=scope["topic"]["domain"] == "fractions")
        return lesson, scope, expanded

    def sheet(self, topic_id, questions):
        """Compile wire questions; return {(question, item): (pupil line, key)}, the result and the work folder."""
        lesson, scope, expanded = self.source(topic_id, questions)
        work = Path(tempfile.mkdtemp(dir=self.root))
        result = compile_source(lesson, validate_source(lesson, expanded, scope, provider=True), scope, self.skill, work)
        draft = json.loads((work / "worksheet-source.json").read_text(encoding="utf-8"))
        clean = lambda text: re.sub(r"\s+([,.?)])", r"\1", text)
        rows = {(q["n"], index): (clean(item["text"]), clean(item["answer"]))
                for q in draft["questions"] for index, item in enumerate(q["items"], 1)}
        return rows, result, work

    def test_grade_three_sheet_prints_verdicts_with_their_calculations(self):
        rows, result, work = self.sheet("ג10", [
            ("השוו בין התוצאות.", [("האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?", decide("eq", "12/3", "12/4")),
                                  ("האם התוצאה של [[30 : 5]] גדולה מהתוצאה של [[30 : 6]]?", decide("gt", "30/5", "30/6")),
                                  ("האם המנה של [[56 : 8]] גדולה מ-5? חשבו את המנה המדויקת.", decide("gt", "56/8", "5"))]),
            ("מצאו את הטעות.", [("תלמיד כתב: [[30 : 5 = 7]]. האם זה נכון? אם לא, מה התשובה הנכונה?", decide("eq", "30/5", "7")),
                               ("האם [[32 : 4 = 8]] נכון? בדקו באמצעות כפל.", decide("eq", "8*4", "32")),
                               ("האם [[6 x 7]] גדול מ־[[40]]?", decide("gt", "6*7", "40"))]),
            ("מיינו.", [("האם התוצאה של [[16 : 4]] זוגית?", decide("divisible", "16/4", "2")),
                        ("האם התוצאה של [[25 : 5]] זוגית?", decide("divisible", "25/5", "2")),
                        ("האם [[27]] מתחלק ב־[[4]]?", decide("divisible", "27", "4"))]),
            ("נכון או לא נכון?", [("[[36 : 6 > 5]]", decide("gt", "36/6", "5")),
                                  ("[[40 : 8 = 6]]", decide("eq", "40/8", "6")),
                                  ("[[45 : 9 = ___]]", evaluate("45/9"))]),
        ])
        self.assertEqual(rows[1, 1], ("האם התוצאות של 12 : 3 ושל 12 : 4 זהות?", "לא. 12 : 3 = 4, 12 : 4 = 3"))
        self.assertEqual(rows[1, 2][1], "כן. 30 : 5 = 6, 30 : 6 = 5")
        self.assertEqual(rows[1, 3][1], "כן. 56 : 8 = 7")                 # also answers "חשבו את המנה המדויקת"
        self.assertEqual(rows[2, 1][1], "לא. 30 : 5 = 6")                 # also answers "מה התשובה הנכונה?"
        self.assertEqual(rows[2, 2][1], "כן. 32 : 4 = 8")                 # the printed statement, not the typed check
        self.assertEqual(rows[2, 3][1], "כן. 6 x 7 = 42")
        self.assertEqual(rows[3, 1][1], "כן. 16 : 4 = 4, 4 : 2 = 2")
        self.assertEqual(rows[3, 2][1], "לא. 25 : 5 = 5, 5 : 2 = 2 (שארית 1)")
        self.assertEqual(rows[3, 3], ("האם 27 מתחלק ב־ 4?", "לא. 27 : 4 = 6 (שארית 3)"))
        self.assertEqual((rows[4, 1][1], rows[4, 2][1], rows[4, 3][1]), ("נכון. 36 : 6 = 6", "לא נכון. 40 : 8 = 5", "5"))
        # Every verdict is bound to the print; nothing is left unverified for the teacher.
        self.assertEqual(result["unverifiedAnswers"], [])
        claims = {row["id"]: row for row in json.loads((work / "verified.json").read_text(encoding="utf-8"))["claims"]}
        self.assertEqual({key: row["evidence"]["bound"] for key, row in claims.items() if key.endswith(".decision")},
                         {f"{n}.{j}.decision": "print" for n, j in ((1, 1), (1, 2), (1, 3), (2, 1), (2, 2), (2, 3),
                                                                     (3, 1), (3, 2), (3, 3), (4, 1), (4, 2))})
        self.assertEqual(claims["2.2.decision"]["evidence"]["rule"], "printed_statement")
        self.assertEqual(claims["1.3"]["method"], "sympy")
        html_text = (work / "sheet.html").read_text(encoding="utf-8")
        self.assertIn('<span class="answer-text" dir="rtl">לא. <span class="ltr">12 : 3 = 4</span>', html_text)

    def test_a_verdict_stands_alone_where_its_calculation_has_no_typography(self):
        uneven = ("האם התוצאות של [[8 : 2]] ושל [[18 : 4]] זהות?", decide("eq", "8/2", "18/4"))
        rows, _, _ = self.sheet("ג10", [("השוו.", [uneven, ("האם [[2 : 4]] קטן מ־[[1]]?", decide("lt", "2/4", "1")),
                                                  ("האם [[24]] מתחלק ב־[[6]]?", decide("divisible", "24", "6"))])] * 4)
        # Before grade five a quotient is not written as a fraction: 18 : 4 is left out of the key.
        self.assertEqual((rows[1, 1][1], rows[1, 2][1], rows[1, 3][1]), ("לא. 8 : 2 = 4", "כן", "כן. 24 : 6 = 4"))
        parity = lambda k: (f"הַאִם [[{k}]] זוּגִי?", decide("divisible", str(k), "2"))
        rows, _, _ = self.sheet("א05", [("עֲנוּ.", [parity(6), parity(7), parity(8), parity(9), parity(4)])] * 4)
        self.assertEqual((rows[1, 1][1], rows[1, 2][1]), ("כֵּן", "לֹא"))  # no division sign in grade one

    def test_grade_two_verdicts_are_pointed(self):
        row = lambda a, b, c, relation: (f"הַאִם [[{a} + {b}]] גָּדוֹל מִ־[[{c}]]?", decide(relation, f"{a}+{b}", str(c)))
        truth = lambda a, b, c: (f"[[{a} + {b} = {c}]]", decide("eq", f"{a}+{b}", str(c)))
        rows, _, _ = self.sheet("ב10", [
            ("עֲנוּ.", [row(5, 3, 7, "gt"), row(2, 4, 9, "gt"), row(6, 3, 8, "gt"), row(1, 2, 5, "gt"), row(4, 4, 7, "gt")]),
            ("נָכוֹן אוֹ לֹא נָכוֹן?", [truth(5, 3, 9), truth(4, 2, 6), truth(7, 1, 8), truth(3, 3, 7), truth(2, 2, 4)]),
        ] * 2)
        self.assertEqual((rows[1, 1][1], rows[1, 2][1]), ("כֵּן. 5 + 3 = 8", "לֹא. 2 + 4 = 6"))
        self.assertEqual((rows[2, 1][1], rows[2, 2][1]), ("לֹא נָכוֹן. 5 + 3 = 8", "נָכוֹן. 4 + 2 = 6"))

    def test_a_verdict_typed_from_a_story_is_refused_by_the_adapter(self):
        lesson, scope, expanded = self.source("ג10", [
            ("השוו בין התוצאות.", [("האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?", decide("eq", "12/3", "12/4"))] * 3),
            ("חשבו לאחור.", [("האם [[32 : 4 = 8]] נכון? בדקו באמצעות כפל.", decide("eq", "8*4", "32")),
                             ("האם [[6 x 7]] גדול מ־[[40]]?", decide("gt", "6*7", "40")),
                             ("מספר חולק ב-6 והתקבל 7. האם המספר המקורי גדול מ-40?", decide("gt", "6*7", "40"))]),
            ("מיינו.", [("האם התוצאה של [[16 : 4]] זוגית?", decide("divisible", "16/4", "2"))] * 3),
            ("נכון או לא נכון?", [("[[36 : 6 > 5]]", decide("gt", "36/6", "5"))] * 3),
        ])
        work = self.root / "story"
        for check in (lambda: validate_source(lesson, expanded, scope, provider=True),
                      lambda: compile_source(lesson, {"source": expanded}, scope, self.skill, work)):
            with self.assertRaises(GeneralSourceError) as caught:
                check()
            self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item),
                             ("PRINTED_ANSWER_KIND", 2, 3))
        self.assertFalse(work.exists())

    def test_a_geometry_sheet_with_labels_and_items_without_a_key_is_refused(self):
        computed = [
            ("חשבו את ההיקף.", [("אורכי הצלעות של משולש הם [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ. מה ההיקף?", evaluate("3+4+5", "ס״מ")),
                                ("אורך כל צלע במשולש שווה צלעות הוא [[6]] ס״מ. מה ההיקף?", evaluate("3*6", "ס״מ")),
                                ("האם [[4 + 4 + 4]] גדול מ־[[10]]?", decide("gt", "4+4+4", "10"))]),
            ("ענו.", [("כמה קודקודים יש למשולש?", evaluate("3")),
                      ("כמה צלעות יש למשולש?", evaluate("3")),
                      ("כמה קודקודים יש למשולש?", evaluate("3"))]),
        ]
        for name, answer in (("label", label("משולש שווה צלעות")), ("open", OPEN)):
            with self.subTest(kind=name):
                lesson, scope, expanded = self.source("ג16", [
                    ("כתבו את שם המשולש.", [("משולש שכל צלעותיו שוות נקרא ___", answer)] * 3),
                    ("שרטטו בעזרת סרגל.", [("שרטטו משולש שווה שוקיים.", answer)] * 3)] + computed)
                work = self.root / ("geometry-" + name)
                for check in (lambda: validate_source(lesson, expanded, scope, provider=True),
                              lambda: compile_source(lesson, {"source": expanded}, scope, self.skill, work)):
                    with self.assertRaises(GeneralSourceError) as caught:
                        check()
                    self.assertEqual(caught.exception.code, "SOURCE_ANSWER")
                self.assertFalse(work.exists())
        # Its verdict about a triangle that only the words describe is typed from a story: refused at its item.
        story = ("האם משולש שצלעותיו [[4]] ס״מ, [[4]] ס״מ ו־[[4]] ס״מ הוא משולש שהיקפו גדול מ־[[10]] ס״מ?",
                 decide("gt", "4+4+4", "10"))
        lesson, scope, expanded = self.source("ג16", [(computed[0][0], computed[0][1][:2] + [story]), computed[1]] * 2)
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(lesson, expanded, scope, provider=True)
        self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item),
                         ("PRINTED_ANSWER_KIND", 1, 3))
        # The computed items of that sheet are printed with their keys, and nothing is unverified.
        rows, result, work = self.sheet("ג16", computed * 2)
        self.assertEqual((rows[1, 1][1], rows[1, 3][1]), ("12 ס״מ", "כן. 4 + 4 + 4 = 12"))
        self.assertEqual(rows[2, 1][1], "3")
        self.assertEqual((result["unverifiedAnswers"], result["unverifiedAnswerCount"]), ([], 0))
        html_text = (work / "sheet.html").read_text(encoding="utf-8")
        self.assertNotIn("open-work", html_text)

    def test_an_authored_prose_answer_is_still_refused_in_elementary(self):
        lesson, scope, expanded = self.source("ג16", [
            ("ענו.", [("אורכי הצלעות של משולש הם [[3]] ס״מ, [[4]] ס״מ ו־[[5]] ס״מ. מה ההיקף?", evaluate("3+4+5", "ס״מ"))] * 3)] * 4)
        expanded["sections"][0]["questions"][2]["items"][1]["answer"] = {
            "kind": "review", "text": [{"kind": "text", "text": "משולש ישר זווית"}]}
        with self.assertRaises(GeneralSourceError) as caught:
            compile_source(lesson, validate_source(lesson, expanded, scope), scope, self.skill, self.root / "unused")
        self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item), ("UNVERIFIED_ANSWERS", 3, 2))


class AuthorContractTests(unittest.TestCase):
    """What the provider is told stays the same as what the validator accepts."""

    def answers(self, topic_id):
        lesson = lesson_for(topic_id, 20)
        schema = worksheet_schema(lesson, scope_for_lesson(lesson))
        kinds = [row["properties"]["kind"].get("const") for row in
                 schema["$defs"]["question"]["properties"]["items"]["items"]["properties"]["answer"]["oneOf"]]
        tasks = [row for row in schema["$defs"]["task"]["oneOf"] if row["properties"]["kind"].get("const") == "decide"]
        return kinds, tasks

    def test_the_wire_schema_offers_the_kinds_of_each_skill(self):
        kinds, tasks = self.answers("ג16")
        self.assertEqual(kinds, ["computed", "figure"])  # no label and no item without a key
        self.assertEqual(self.answers("ג10")[0], ["computed"])
        self.assertEqual([task["properties"]["relation"]["enum"] for task in tasks],
                         [["eq", "ne", "lt", "le", "gt", "ge", "divisible", "not_divisible"], ["in", "not_in"]])
        self.assertEqual(tasks[1]["required"], ["kind", "relation", "left", "values"])
        self.assertEqual(tasks[0]["properties"]["left"], {"$ref": "#/$defs/expression"})  # a compact string on the wire
        middle, tasks = self.answers("g8:percentages")
        self.assertEqual(middle, ["computed", "review"])
        self.assertEqual(len(tasks), 2)

    def test_the_author_request_describes_the_decide_task_and_no_kind_without_a_key(self):
        config = {"api_key": "synthetic-fixture-key", "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
                  "model": "fixture-model"}
        for topic_id, count in (("ג16", 12), ("g8:percentages", 20)):
            lesson = {**lesson_for(topic_id, count), "explicitShortSheet": False}
            with self.subTest(topic=topic_id), patch("provider.build_authoring_context", return_value={}), \
                    patch("provider.request_author_json", side_effect=StopIteration) as request:
                with self.assertRaises(StopIteration):
                    provider.author_lesson(lesson, **config)
                system = request.call_args.args[2]["messages"][0]["content"]
                self.assertIn(answer_kinds.DECISION_GUIDE, system)
                self.assertNotIn('"kind":"open"', system)
                self.assertNotIn('"kind":"label"', system)

    def test_a_refused_yes_no_item_is_told_to_use_the_decide_task(self):
        lesson = lesson_for("ג10", 12)
        scope = scope_for_lesson(lesson)
        plain = lambda k: {"intro": "חשבו.", "items": [{"prompt": f"[[{k * d} : {d} = ___]]", "answer": evaluate(f"{k * d}/{d}")}
                                                       for d in (2, 3, 4)]}
        questions = [plain(k) for k in range(2, 14)]
        # Question 5 of the recorded reply: a yes/no question keyed with one of its two quotients.
        questions[4] = {"intro": "השוו בין שני תרגילים ובחרו את התשובה הנכונה.", "items": [
            {"prompt": "כמה הם [[12 : 3]]?", "answer": evaluate("12/3")},
            {"prompt": "כמה הם [[12 : 4]]?", "answer": evaluate("12/4")},
            {"prompt": "האם התוצאות של [[12 : 3]] ושל [[12 : 4]] זהות?", "answer": evaluate("12/3")}]}
        reply = {"title": "חילוק", "rule": "חילוק הוא הפעולה ההפוכה לכפל.", "practice": questions[:9], "challenges": questions[9:]}
        findings = source_findings(reply, lesson, scope, GeneralSourceError("PRINTED_ANSWER_KIND", "refused"))
        self.assertEqual([(row["question"], row["codes"]) for row in findings], [(5, ["PRINTED_ANSWER_KIND"])])
        feedback = findings[0]["feedback"][0]
        self.assertIn('"kind":"decide"', feedback)
        self.assertNotIn('"kind":"open"', feedback)       # no answer kind without a key is offered
        self.assertNotIn('"kind":"label"', feedback)
        # The same question with the claim that the instruction asks for is accepted.
        questions[4]["items"][2]["answer"] = decide("eq", "12/3", "12/4")
        self.assertEqual(source_findings(reply, lesson, scope, GeneralSourceError("PRINTED_ANSWER_KIND", "refused")), [])


if __name__ == "__main__":
    unittest.main()
