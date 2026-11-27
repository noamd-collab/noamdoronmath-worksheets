"""Printed answer keys, from the provider wire format to the compiled sheet.

Every prompt here goes through compact_authoring.expand_source first, so a
binder is only credited with spans that a real provider reply can produce.
"""
import copy
import html
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import compact_authoring
import no_carry_addition as addition
import printed_parts
from general_adapters import FAILURE_RECORD, _compile_middle, compile_source
from general_source import GeneralSourceError, validate_question, validate_source
from math_tasks import number, operation, to_house_math
from numeric_literals import decimal_result
from runtime_catalog import CURRICULUM_SHA256, catalog, scope_for_lesson

TOPICS = {topic["topicId"]: topic for topic in catalog().topics}


def lesson_for(topic_id, count=4):
    topic = TOPICS[topic_id]
    return {"version": 3, "gradeNumber": topic["gradeNumber"], "topicId": topic_id, "level": topic["levels"][0],
            "lessonGoal": "practice", "questionCount": count, "minutes": 45, "alreadyLearned": [],
            "lastLesson": "סיימנו ללמוד את הנושא ותרגלנו את המושגים שסומנו.",
            "lessonBoundary": {"version": 1, "kind": "curriculum_scope", "curriculumSha256": CURRICULUM_SHA256,
                               "conceptIds": [concept["id"] for concept in topic["concepts"]]}}


def evaluate(expression, unit=""):
    return {"kind": "computed", "task": {"kind": "evaluate", "expression": expression}, "unit": unit}


def compare(left, right):
    return {"kind": "computed", "task": {"kind": "compare", "left": left, "right": right}, "unit": ""}


def wire(topic_id, intro, prompt, answer, *, table=None):
    """Expand and validate one wire question; return it with its first item and exact result."""
    lesson = lesson_for(topic_id)
    scope = scope_for_lesson(lesson)
    grade = lesson["gradeNumber"]
    items = [{"prompt": prompt, "answer": copy.deepcopy(answer)} for _ in range(5 if grade <= 2 else 3)]
    question = {"intro": intro, "star": False, "items": items}
    if table is not None:
        question["table"] = table
    expanded = compact_authoring.expand_source({"version": 4, "sections": [{"questions": [question]}]}, grade,
                                               fraction_notation=scope["topic"]["domain"] == "fractions")
    question = expanded["sections"][0]["questions"][0]
    evidence = []
    validate_question(question, grade, scope, provider=True, qcount=1, evidence=evidence, pending=[])
    return question, question["items"][0], evidence[0]["computed"], grade


def key(binding):
    """The key as a teacher reads it: formulas and prose in printed order."""
    return "".join(part[0] if isinstance(part, tuple) else part for part in binding.parts)


def bound(topic_id, intro, prompt, answer, **extra):
    question, item, solved, grade = wire(topic_id, intro, prompt, answer, **extra)
    return printed_parts.bind_parts(question, item, solved, grade)


class WirePathTests(unittest.TestCase):
    def refused(self, *args, code="PRINTED_TASK_MISMATCH", **extra):
        with self.assertRaises(GeneralSourceError) as caught:
            wire(*args, **extra)
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def test_place_value_spellings_answer_every_blank_or_are_refused(self):
        # An "=" written between the island and the blanks is refused for its notation, and so are the
        # equation written without islands and an island that ends with its blank before the place's name.
        for prompt in ("[[345]] = ___ מאות + ___ עשרות + ___ אחדות", "___ מאות + ___ עשרות + ___ אחדות = [[345]]",
                       "345 = ___ מאות + ___ עשרות + ___ אחדות", "[[345 = ___]] מאות + ___ עשרות + ___ אחדות",
                       "[[345]] = [[___]] מאות + [[___]] עשרות + [[___]] אחדות"):
            with self.subTest(prompt=prompt):
                self.refused("ג01", "השלימו את המספרים החסרים.", prompt, evaluate("345"), code="SOURCE_NOTATION")
        spellings = [
            "במספר [[345]] יש ___ מאות, ___ עשרות ו־___ אחדות",
            "במספר [[345]] יש ___ מאות + ___ עשרות + ___ אחדות",
        ]
        for prompt in spellings:
            with self.subTest(prompt=prompt):
                binding = bound("ג01", "השלימו את המספרים החסרים.", prompt, evaluate("345"))
                self.assertEqual(key(binding), "3 מאות, 4 עשרות, 5 אחדות")
                self.assertEqual(binding.proof["rule"], "place_digits")
                # The author can model the whole number or one of its digits, never another value.
                self.assertEqual(key(bound("ג01", "השלימו.", prompt, evaluate("4"))), "3 מאות, 4 עשרות, 5 אחדות")
                self.refused("ג01", "השלימו.", prompt, evaluate("354"))

    def test_a_blank_prints_where_the_model_wrote_it(self):
        # Nothing moves a blank out of its island. An island that ends with its blank before a Hebrew label
        # would print the blank away from that label, so it is refused as written, not printed.
        self.refused("ג01", "השלימו.", "[[345 = ___]] מאות + ___ עשרות + ___ אחדות", evaluate("345"),
                     code="SOURCE_NOTATION")
        _, item, _, _ = wire("ג01", "השלימו.", "[[345 = ___ + ___ + ___]]", evaluate("345"))
        self.assertEqual(item["prompt"], [{"kind": "formula", "notation": "345 = ___ + ___ + ___"}])
        # Nor into one: a calculation that ends with its blank is one exercise only when written as one.
        self.refused("ג06", "חשבו.", "[[348]] + [[276]] = ___", evaluate("348 + 276"), code="SOURCE_NOTATION")
        _, item, _, _ = wire("ג06", "חשבו.", "[[348 + 276 = ___]]", evaluate("348 + 276"))
        self.assertEqual(item["prompt"], [{"kind": "formula", "notation": "348 + 276 = ___"}])

    def test_an_equation_with_a_blank_is_keyed_only_by_solving_it_from_the_print(self):
        # Partly marked or unmarked, also among words: refused for its notation, whatever the typed key.
        for topic_id, intro, prompt, typed in (
                ("ג10", "השלימו.", "24 : ___ = [[6]]", "5"), ("ג10", "השלימו.", "72 : ___ = [[8]]", "8"),
                ("ג10", "השלימו.", "[[72]] : ___ = [[8]]", "8"), ("ב10", "הַשְׁלִימוּ.", "7 + ___ = [[15]]", "9"),
                ("ב10", "הַשְׁלִימוּ.", "20 - ___ = [[15]]", "6"), ("ג10", "השלימו.", "24 : [[___]] = [[6]]", "5"),
                ("ב10", "הַשְׁלִימוּ.", "7 + [[___]] = [[15]]", "9"), ("ג10", "חשבו.", "חשבו: 24 : 6 = ___", "5"),
                ("ג10", "חשבו.", "24 : 6 = ___ .", "5"), ("ג10", "חשבו.", "מהו 24 : 6 = ___ ?", "5"),
                ("ג10", "חשבו.", "24 : 6 = [[___]]", "5"), ("ה28", "השלימו.", "[[3.47]] = [[3]] + [[0.4]] + ___", "0.07"),
                ("ג22", "המירו.", "3 מטרים = ___ ס״מ", "300"),
                # An "=" in the sentence is refused also when every number of the conversion is marked.
                ("ג22", "המירו.", "[[3]] מטרים = ___ ס״מ", "300"), ("ג19", "המירו.", "[[150]] דקות = ___ שעות ו־___ דקות", "150"),
                # Round 3: a letter, a word or a fullwidth sign as the relation, another blank, a calculation outside
                # an island, and a colon that touches a blank. Each was delivered with the wrong key given here.
                ("ג10", "השלימו.", "x : [[5]] = [[8]]", "45"), ("ג10", "השלימו.", "[[24]] : ___ שווה [[6]]", "5"),
                ("ג10", "השלימו.", "[[24]] : ___ ＝ [[6]]", "5"), ("ג10", "חשבו.", "24 : 6 = ?", "5"),
                ("ג10", "חשבו.", "24 : ? = 6", "5"), ("ג10", "חשבו.", "24 : __ = 6", "5"), ("ג10", "חשבו.", "24 : ⬜ = 6", "5"),
                ("ג10", "חשבו.", "24 : ( ) = 6", "5"), ("ג10", "חשבו.", "x : 5 = 8", "45"), ("ג10", "חשבו.", "חשבו: 24 : 6", "5"),
                ("ג10", "חשבו.", "חשבו: [[24]] : [[6]]", "5"), ("ג10", "השלימו.", "___: [[4]] = [[6]]", "20"),
                ("ג10", "השלימו.", "___:[[4]]=[[6]]", "20"), ("ג10", "השלימו.", "מספר: ___: [[4]] = [[6]]", "20"),
                ("ג10", "השלימו.", "[[24 : 6]] שווה ___", "4")):
            with self.subTest(prompt=prompt):
                self.refused(topic_id, intro, prompt, evaluate(typed), code="SOURCE_NOTATION")
        # One complete island: bound by the missing-number binder, which refuses a wrong key.
        _, item, _, _ = wire("ב10", "הַשְׁלִימוּ.", "הַשְׁלִימוּ אֶת הַמִּסְפָּר הֶחָסֵר: [[7 + ___ = 15]]", evaluate("8"))
        self.assertEqual(item["prompt"][-1], {"kind": "formula", "notation": "7 + ___ = 15"})
        self.refused("ב10", "הַשְׁלִימוּ.", "הַשְׁלִימוּ אֶת הַמִּסְפָּר הֶחָסֵר: [[7 + ___ = 15]]", evaluate("9"))
        # Nothing solves the printed equation: words the binder does not read, one unit conversion,
        # or the equation in the intro or in a table cell. Refused even with the right key.
        for topic_id, intro, prompt, typed, extra in (
                ("ג10", "השלימו.", "מהו המספר החסר? [[24 : ___ = 6]]", "4", {}),
                # A conversion into one unit written with words (round 3), with a wrong key and with the right one.
                ("ג22", "המירו.", "[[3]] מטרים הם ___ ס״מ", "301", {}), ("ג22", "המירו.", "[[3]] מטרים הם ___ ס״מ", "300", {}),
                ("ג22", "המירו.", "[[3]] מטרים שווים ___ ס״מ", "301", {}),
                ("ג22", "המירו.", "ב־[[3]] מטרים יש ___ ס״מ", "301", {}), ("ג22", "המירו.", "ב־[[3]] מטרים יש ___ ס״מ", "300", {}),
                ("ג19", "המירו.", "[[2]] שעות הן ___ דקות", "121", {}), ("ג19", "המירו.", "[[2]] שעות הן ___ דקות", "120", {}),
                ("ג22", "המירו.", "[[3]] מטרים ו־[[20]] ס״מ הם ___ ס״מ", "321", {}),
                # Any other blank that no binder fills: beside a closed formula, after a printed calculation, a blank
                # in the intro.
                ("ג10", "השלימו.", "התוצאה של [[24 : 6]] היא ___", "4", {}),
                ("ד07", "מצאו את הטעות.", "יערה חישבה: [[(5 + 3) x 2 = 5 + 6 = 11]]. התוצאה הנכונה היא ___", "(5 + 3) * 2", {}),
                ("ג10", "המספר החסר הוא ___.", "[[24 : ___ = 6]]", "4", {}),
                ("ג10", "בתרגיל [[24 : ___ = 6]] חסר מספר.", "מהו המספר החסר?", "4", {}),
                ("ג10", "השלימו את הטבלה.", "חשבו.", "4",
                 {"table": {"head": ["תרגיל", "תוצאה"], "rows": [["[[24 : ___ = 6]]", "___"]]}})):
            with self.subTest(prompt=prompt, intro=intro):
                error = self.refused(topic_id, intro, prompt, evaluate(typed), **extra)
                self.assertEqual((error.question, error.item), (1, 1))
        # A binder that recomputes every blank from the printed givens keys a conversion into two units.
        self.assertEqual(key(bound("ג19", "המירו.", "[[150]] דקות הן ___ שעות ו־___ דקות", evaluate("150"))),
                         "2 שעות ו־30 דקות")
        # A formula that is a whole equation is not read as one number beside the field's blank.
        self.assertTrue(printed_parts.prints_blank_equation([{"kind": "text", "text": "___: "},
                                                             {"kind": "formula", "notation": "4 = 6"}]))
        self.assertFalse(printed_parts.prints_blank_equation([{"kind": "text", "text": "___ "},
                                                              {"kind": "formula", "notation": "4 + 6"}]))
        # A sign listed as an option is no equation: the comparison blank keeps its own binder.
        _, item, solved, grade = wire("ג10", "השלימו את הסימן (<, > או =).", "[[24 : 6 ___ 5]]", compare("24/6", "5"))
        self.assertEqual(printed_parts.comparison_blank(item, solved, grade)["rule"], "printed_sign")

    def test_other_grades_bind_from_the_printed_number_or_fail_closed(self):
        # With the "=" between the island and its blanks, each of these is refused for its notation.
        for topic_id, intro, prompt, typed in (
                ("ב02", "הַשְׁלִימוּ.", "[[47]] = ___ עֲשָׂרוֹת + ___ יְחִידוֹת", "47"),
                ("ג04", "השלימו.", "[[4,507]] = ___ אלפים + ___ מאות + ___ עשרות + ___ אחדות", "4507"),
                ("ה28", "פרקו.", "[[3.47]] = ___ שלמים + ___ עשיריות + ___ מאיות", "3.47"),
                ("ג01", "השלימו.", "[[345]] = ___ עשרות + ___ אחדות", "345"),
                ("ג01", "השלימו.", "[[456]] = ___ מאות + [[50]] + ___ אחדות", "6"),
                ("ג01", "השלימו.", "[[345]] = ___ + ___ + ___", "345"),
                ("ג01", "השלימו.", "[[345]] = ___ מאות + ___ אחדות", "345"),
                ("ג01", "השלימו.", "[[456]] = ___ מאות + [[40]] + ___ אחדות", "6"),
                ("ג01", "השלימו.", "[[10]] = ___ + ___ + ___", "10"),
                # An island that ends with its blank before the place's name prints the blank away from it.
                ("ב02", "הַשְׁלִימוּ.", "[[47 = ___]] עֲשָׂרוֹת + ___ יְחִידוֹת", "47"),
                ("ג04", "השלימו.", "[[4,507 = ___]] אלפים + ___ מאות + ___ עשרות + ___ אחדות", "4507"),
                ("ה28", "פרקו.", "[[3.47 = ___]] שלמים + ___ עשיריות + ___ מאיות", "3.47"),
                ("ג01", "השלימו.", "[[345 = ___]] עשרות + ___ אחדות", "345"),
                ("ג01", "השלימו.", "[[456 = ___]] מאות + [[50]] + ___ אחדות", "6"),
                ("ג01", "השלימו.", "[[345 = ___]] מאות + ___ אחדות", "345"),
                ("ג01", "השלימו.", "[[456 = ___]] מאות + [[40]] + ___ אחדות", "6")):
            with self.subTest(prompt=prompt):
                self.refused(topic_id, intro, prompt, evaluate(typed), code="SOURCE_NOTATION")
        sentence = bound("ב02", "הַשְׁלִימוּ.", "בַּמִּסְפָּר [[47]] יֵשׁ ___ עֲשָׂרוֹת וְ־___ יְחִידוֹת.", evaluate("47"))
        self.assertEqual(key(sentence), "4 עֲשָׂרוֹת, 7 יְחִידוֹת")  # the pupil's own pointed words
        thousands = bound("ג04", "השלימו.", "במספר [[4,507]] יש ___ אלפים, ___ מאות, ___ עשרות ו־___ אחדות",
                          evaluate("4507"))
        self.assertEqual(key(thousands), "4 אלפים, 5 מאות, 0 עשרות, 7 אחדות")
        decimals = bound("ה28", "פרקו.", "במספר [[3.47]] יש ___ שלמים, ___ עשיריות ו־___ מאיות", evaluate("3.47"))
        self.assertEqual(key(decimals), "3 שלמים, 4 עשיריות, 7 מאיות")
        regrouped = bound("ג01", "השלימו.", "במספר [[345]] יש ___ עשרות ו־___ אחדות", evaluate("345"))
        self.assertEqual(key(regrouped), "34 עשרות, 5 אחדות")
        given = bound("ג01", "השלימו.", "במספר [[456]] יש ___ מאות, [[5]] עשרות ו־___ אחדות", evaluate("6"))
        self.assertEqual(key(given), "4 מאות, 6 אחדות")
        self.assertEqual(given.proof["rule"], "missing_digits")
        expanded = bound("ג01", "השלימו.", "[[345 = ___ + ___ + ___]]", evaluate("345"))
        self.assertEqual(key(expanded), "300 + 40 + 5")
        # Hundreds and units alone cannot rebuild 345; a given part must be the right one.
        self.refused("ג01", "השלימו.", "במספר [[345]] יש ___ מאות ו־___ אחדות", evaluate("345"))
        self.refused("ג01", "השלימו.", "במספר [[456]] יש ___ מאות, [[4]] עשרות ו־___ אחדות", evaluate("6"))
        self.refused("ג01", "השלימו.", "[[10 = ___ + ___ + ___]]", evaluate("10"))

    def test_place_value_table_row_is_answered_from_its_own_number(self):
        table = {"head": ["מספר", "מאות", "עשרות", "אחדות"], "rows": [["[[456]]", "___", "___", "___"]] * 3}
        row = bound("ג01", "השלימו את הטבלה.", "שורה [[1]]", evaluate("456"), table=table)
        self.assertEqual(key(row), "4 מאות, 5 עשרות, 6 אחדות")
        self.refused("ג01", "השלימו את הטבלה.", "שורה [[1]]", evaluate("465"), table=table)

    def test_one_number_never_answers_several_blanks(self):
        error = self.refused("ג03", "השלימו.", "[[5]], ___, ___, [[20]]", evaluate("10"))
        self.assertEqual((error.question, error.item), (1, 1))  # structured, not only message text
        self.refused("ג19", "חשבו.", "הסרט נמשך ___ שעות ו־___ דקות", evaluate("7"))
        solve = {"kind": "computed", "task": {"kind": "solve", "lhs": "x", "rhs": "3", "variable": "x"}, "unit": ""}
        self.refused("g7:equations", "השלימו.", "[[x = ___]], [[x = ___]]", solve)
        # Before a Hebrew word, an island that ends with its blank is refused for its notation in every grade.
        self.refused("g7:equations", "השלימו.", "[[x = ___]] או [[x = ___]]", solve, code="SOURCE_NOTATION")
        # The same unknown named twice is one answer, and its equation is solved from the print. A colon touching
        # the blank would be the division sign, so that spelling is refused for its notation.
        question, item, solved, grade = wire("ד07", "השלימו את המספר החסר.", "המספר החסר הוא ___. [[___ + 4 * 3 = 17]]",
                                             evaluate("17 - 4 * 3"))
        self.assertIsNone(printed_parts.bind_parts(question, item, solved, grade))
        self.refused("ד07", "השלימו.", "המספר החסר הוא ___. [[___ + 4 * 3 = 17]]", evaluate("6"))
        for typed in ("17 - 4 * 3", "6"):
            self.refused("ד07", "השלימו.", "המספר החסר הוא ___: [[___ + 4 * 3 = 17]]", evaluate(typed),
                         code="SOURCE_NOTATION")

    def test_quotient_and_remainder_are_keyed_together(self):
        for typed in ("47 / 5", "9", "2"):
            with self.subTest(typed=typed):
                binding = bound("ג21", "חשבו וכתבו את השארית.", "[[47 : 5 = ___]] (שארית ___)", evaluate(typed))
                self.assertEqual(key(binding), "9 (שארית 2)")
                self.assertNotIn("47/5", key(binding))
        self.refused("ג21", "חשבו וכתבו את השארית.", "[[47 : 5 = ___]] (שארית ___)", evaluate("48 / 5"))
        # Straight before the word, the island's blank prints away from it: refused for its notation.
        self.refused("ג21", "חשבו וכתבו את השארית.", "[[47 : 5 = ___]] שארית ___", evaluate("47 / 5"),
                     code="SOURCE_NOTATION")
        # The blank written after the island is not moved into it: refused for its notation.
        self.refused("ג21", "חשבו וכתבו את השארית.", "[[47 : 5]] = ___ (שארית ___)", evaluate("47 / 5"),
                     code="SOURCE_NOTATION")
        self.assertEqual(key(bound("ד10", "חשבו את המנה ואת השארית.", "[[845 : 7]]", evaluate("845 / 7"))),
                         "120 (שארית 5)")
        story = bound("ג21", "פתרו.", "מחלקים [[34]] גולות ל־[[6]] ילדים. כמה גולות מקבל כל ילד וכמה נשארות?",
                      evaluate("34 / 6", "גולות"))
        self.assertEqual(key(story), "5 גולות (שארית 4)")
        # Before a quotient is taught as a fraction, an uneven division has a remainder even unsaid.
        self.assertEqual(key(bound("ג10", "חשבו.", "[[25 : 7]]", evaluate("25 / 7"))), "3 (שארית 4)")
        self.assertIsNone(bound("ו07", "חשבו.", "[[25 : 7]]", evaluate("25 / 7")))
        # Only the remainder is asked for: the ordinary key already states it.
        self.assertIsNone(bound("ג21", "ענו.", "מהי השארית בחילוק [[47]] ב־[[5]]?", evaluate("2")))

    def test_sequences_and_two_unit_answers(self):
        self.assertEqual(key(bound("ג03", "השלימו את הסדרה.", "[[5]], [[10]], ___, ___, [[25]]", evaluate("15"))), "15, 20")
        self.assertEqual(key(bound("ג03", "השלימו את הסדרה.", "[[2]], [[4]], [[8]], ___, ___", evaluate("16"))), "16, 32")
        self.refused("ג03", "השלימו את הסדרה.", "[[5]], [[10]], ___, ___, [[25]]", evaluate("17"))
        # One blank with another typed rule: no binder fills the blank from the print, so the item is refused;
        # only an agreeing value is bound.
        self.refused("ג03", "השלימו את הסדרה.", "[[1]], [[2]], [[4]], ___", evaluate("7"))
        self.assertEqual(key(bound("ג03", "השלימו את הסדרה.", "[[2]], [[4]], [[6]], ___", evaluate("8"))), "8")
        time = bound("ג19", "המירו.", "[[150]] דקות הן ___ שעות ו־___ דקות", evaluate("150"))
        self.assertEqual(key(time), "2 שעות ו־30 דקות")
        self.assertEqual(key(bound("ג22", "המירו.", "[[345]] ס״מ הם ___ מטרים ו־___ ס״מ", evaluate("345 / 100"))),
                         "3 מטרים ו־45 ס״מ")
        self.refused("ג19", "המירו.", "[[150]] דקות הן ___ שעות ו־___ דקות", evaluate("140"))
        # Without a printed size, only a typed unit says what the typed number measures.
        self.assertEqual(key(bound("ג19", "חשבו.", "הסרט נמשך ___ שעות ו־___ דקות", evaluate("150", "דקות"))), "2 שעות ו־30 דקות")
        self.assertEqual(key(bound("ג19", "הסרט נמשך [[150]] דקות.", "כתבו: ___ שעות ו־___ דקות", evaluate("150"))), "2 שעות ו־30 דקות")
        self.refused("ג19", "חשבו.", "הסרט נמשך ___ שעות ו־___ דקות", evaluate("150"))
        # Two blanks are a quotient and a remainder only when the second one is the remainder's.
        self.refused("ג21", "חשבו את השארית.", "___ ועוד ___ [[47 : 5]]", evaluate("47 / 5"))

    def test_a_blank_between_two_quantities_is_a_comparison_sign(self):
        for prompt in ("[[345]] ___ [[354]]", "[[345 ___ 354]]", "[[345]] ☐ [[354]]"):
            with self.subTest(prompt=prompt):
                question, item, solved, grade = wire("ג02", "השלימו את הסימן המתאים.", prompt, compare("345", "354"))
                proof = printed_parts.comparison_blank(item, solved, grade)
                self.assertEqual((proof["rule"], proof["left"], proof["right"]), ("printed_sign", number(345), number(354)))
                self.refused("ג02", "השלימו.", prompt, compare("354", "345"))
                self.refused("ג02", "השלימו.", prompt, evaluate("354"))
        # The blank is never read as the letter of a multiplication sign.
        self.assertEqual(compact_authoring.display_parts("345 ___ 354", 3)[1], "___")
        self.assertIsNone(compact_authoring.schoolbook_tokens("3 + 4 ___ 9 - 1", 1))
        # A missing operation inside an equation has no exact key.
        self.refused("ג10", "השלימו.", "[[5 ___ 3 = 15]]", evaluate("15"), code="SOURCE_NOTATION")

    def test_task_is_printed_only_for_a_prompt_without_numbers(self):
        def shown(topic, intro, prompt, answer, **extra):
            question, item, solved, _ = wire(topic, intro, prompt, answer, **extra)
            return printed_parts.shows_task(question, item, solved)

        self.assertTrue(shown("ג06", "חשבו בטור.", "חשבו.", evaluate("348 + 276")))
        # A bare literal would print the answer beside the question.
        self.assertFalse(shown("ד01", "כתבו בספרות.", "ארבעים וחמישה אלף מאתיים שלושים ושמונה", evaluate("45238")))
        self.assertFalse(shown("ד01", "ענו.", "במספר [[45,238]], מהו הערך של הספרה [[5]]?", evaluate("5000")))
        self.assertFalse(shown("ה09", "צמצמו את השבר.", "צמצמו.", {"kind": "computed", "unit": "",
                               "task": {"kind": "simplify", "expression": "frac(6,8)"}}))
        # A word problem never has its operation printed after it.
        self.assertFalse(shown("ג08", "פתרו.", "לדני היו [[124]] גולות. הוא קיבל עוד [[38]]. כמה גולות יש לו?",
                               evaluate("124 + 38")))
        self.assertFalse(shown("ג08", "לדני היו [[124]] גולות והוא קיבל עוד [[38]].", "כמה גולות יש לו עכשיו?",
                               evaluate("124 + 38")))
        self.assertFalse(shown("ג08", "פתרו.", "כמה שעות יש בשלושה ימים?", evaluate("3 * 24")))
        self.assertFalse(shown("ג08", "במשפחה שלושה ילדים וכל ילד קיבל ארבעה ממתקים.", "חשבו כמה ממתקים קיבלו יחד.", evaluate("3 * 4")))
        # A number word that is not one of the task's numbers hides nothing.
        self.assertTrue(shown("ג08", "חברו.", "כמה כרטיסים יש יחד בשלוש קופסאות?", evaluate("20 + 30 + 10")))
        self.assertFalse(shown("ג08", "לדנה [[12]] בלונים ו־[[5]] מהם התפוצצו.", "חשבו כמה בלונים נשארו.", evaluate("12 - 5")))
        # An exercise that the prompt already shows is not printed twice.
        self.assertFalse(shown("ג06", "חשבו.", "[[348 + 276]]", evaluate("348 + 276")))
        # The pupil's own earlier answers are never printed for them.
        self.assertFalse(shown("ד07", "חשבו.", "מהו ההפרש בין שתי התוצאות?", evaluate("36 - 16")))
        self.assertFalse(shown("ד07", "חשבו.", "חשבו את הביטוי שכתבתם בסעיף הקודם.", evaluate("3 * 4 - 2")))
        # An instruction without numbers still needs its task, also beside a rule in the intro.
        self.assertTrue(shown("ג22", "זכרו: במטר אחד יש [[100]] סנטימטרים.", "המירו לסנטימטרים.", evaluate("3 * 100")))
        middle = {"kind": "computed", "unit": "", "task": {"kind": "solve", "lhs": "2*x+3", "rhs": "9", "variable": "x"}}
        self.assertTrue(shown("g7:equations", "פתרו.", "פתרו את המשוואה.", middle))
        self.assertFalse(shown("g7:equations", "פתרו.", "חשבתי על מספר, הכפלתי אותו ב־[[2]], הוספתי [[3]] וקיבלתי [[9]]. מהו המספר?", middle))

    def test_a_typed_task_is_printed_only_after_a_bare_instruction(self):
        def refusal(topic, intro, prompt, answer, **extra):
            question, item, solved, _ = wire(topic, intro, prompt, answer, **extra)
            self.assertTrue(printed_parts.shows_task(question, item, solved))
            try:
                printed_parts.refuse_shown_task(question, item)
            except GeneralSourceError as error:
                return error.code
            return None

        # A bare instruction or question: the typed task is the exercise.
        self.assertIsNone(refusal("ג06", "חשבו בטור.", "חשבו.", evaluate("348 + 276")))
        self.assertIsNone(refusal("ג08", "חברו.", "מה הסכום?", evaluate("20 + 30 + 10")))
        # A story of several sentences, an intro that states numbers, or a table: the task would show the operation
        # or print an exercise again, so the item is refused.
        self.assertEqual(refusal("ג08", "חשבו.", "בכיתה יש בנים ובנות. חשבו כמה ילדים יש בסך הכול.", evaluate("12 + 15")),
                         "PRINTED_TASK_MISMATCH")
        self.assertEqual(refusal("ג22", "זכרו: במטר אחד יש [[100]] סנטימטרים.", "המירו לסנטימטרים.", evaluate("3 * 100")),
                         "PRINTED_TASK_MISMATCH")
        table = {"head": ["ביטוי", "תוצאה"], "rows": [["[[10 + 2 x 3]]", "___"], ["[[5 x 4 - 2]]", "___"]]}
        self.assertEqual(refusal("ד07", "השלימו את הטבלה.", "חשבו את הביטוי שבשורה הראשונה.", evaluate("10 + 2 * 3"),
                                 table=table), "PRINTED_TASK_MISMATCH")
        # Beside any table: the row's own calculation would be printed a second time, another row's
        # calculation under the name of this row, and an operation on the table's data revealed. A blank that no
        # binder fills is refused before the print is even considered, and so is an item whose typed task is not
        # the printed expression of the one row it names (printed_tasks.table_row_task): another row's
        # calculation, a row that prints its result too, or the table's data with no row named.
        self.refused("ד07", "השלימו את הטבלה.", "הערך החסר בטבלה הוא ___.", evaluate("10 + 2 * 3"), table=table)
        self.refused("ד07", "השלימו את הטבלה.", "חשבו את הביטוי שבשורה השנייה.", evaluate("10 + 2 * 3"), table=table)
        filled = {"head": ["ביטוי", "תוצאה"], "rows": [["[[10 + 2 x 3]]", "[[16]]"], ["[[5 x 4 - 2]]", "[[18]]"]]}
        self.refused("ד07", "השלימו את הטבלה.", "חשבו את הביטוי שבשורה הראשונה.", evaluate("10 + 2 * 3"), table=filled)
        data = {"head": ["יום", "ספרים"], "rows": [["ראשון", "[[12]]"], ["שני", "[[15]]"]]}
        self.refused("ד07", "התבוננו בטבלה.", "חשבו כמה ספרים נקראו בסך הכול.", evaluate("12 + 15"), table=data)
        # A story in one sentence, or any word that is not about the exercise itself, is not a bare instruction.
        self.assertEqual(refusal("g8:probability", "חשבו את ההסתברות.",
                                 "מה ההסתברות לקבל מספר זוגי בהטלת קובייה הוגנת, כאחוז?", evaluate("3/6*100", "%")),
                         "PRINTED_TASK_MISMATCH")
        self.assertEqual(refusal("g8:probability", "חשבו את ההסתברות.",
                                 "בהטלת קובייה הוגנת מה הסיכוי באחוזים לקבל מספר זוגי?", evaluate("3/6*100", "%")),
                         "PRINTED_TASK_MISMATCH")
        self.assertEqual(refusal("ג22", "המירו.", "המירו לסנטימטרים.", evaluate("3 * 100")), "PRINTED_TASK_MISMATCH")
        self.assertEqual(refusal("ג08", "חשבו.", "חשבו כמה ילדים יש בכיתה.", evaluate("12 + 15")), "PRINTED_TASK_MISMATCH")
        self.assertIsNone(refusal("ג08", "חשבו.", "חשבו את התרגיל הבא.", evaluate("12 + 15")))
        self.assertIsNone(refusal("g7:equations", "פתרו.", "פתרו את המשוואה.",
                                  {"kind": "computed", "unit": "", "task": {"kind": "solve", "lhs": "2*x+3", "rhs": "9",
                                                                            "variable": "x"}}))

    def test_a_typed_task_never_prints_a_zero_it_did_not_write(self):
        def zero(topic, prompt, answer):
            question, item, solved, _ = wire(topic, "חשבו.", prompt, answer)
            self.assertTrue(printed_parts.shows_task(question, item, solved))
            printed_parts.refuse_shown_task(question, item)
            try:
                printed_parts.refuse_unwritten_zero(solved)
            except GeneralSourceError as error:
                return error.code
            return None

        def solve(lhs, rhs):
            return {"kind": "computed", "unit": "", "task": {"kind": "solve", "lhs": lhs, "rhs": rhs, "variable": "x"}}

        # A minus before anything but a number is the subtraction 0 − ..., and its zero would be printed.
        self.assertEqual(zero("g7:powers_roots", "חשבו את הביטוי.", evaluate("-2^4")), "SOURCE_NOTATION")
        self.assertEqual(zero("g7:powers_roots", "מה התוצאה?", evaluate("-2^4 + 20")), "SOURCE_NOTATION")
        self.assertEqual(zero("g7:equations", "פתרו את המשוואה.", solve("-x + 3", "5")), "SOURCE_NOTATION")
        self.assertEqual(zero("g7:equations", "פתרו את המשוואה.", solve("4", "3 - (-x + 1)")), "SOURCE_NOTATION")
        # A negative number and a bracketed power keep their sign; the print is the task as written.
        self.assertIsNone(zero("g7:powers_roots", "חשבו את הביטוי.", evaluate("(-2)^4")))
        self.assertIsNone(zero("g7:equations", "פתרו את המשוואה.", solve("2*x - 3", "-5")))

    def test_a_printed_calculation_must_be_the_one_that_is_keyed(self):
        question, item, solved, grade = wire("ג06", "חשבו.", "[[348 + 276]]", evaluate("348 + 276"))
        self.assertEqual(printed_parts.printed_calculation(question, item, solved, grade)["rule"], "printed_calculation")
        self.refused("ג06", "חשבו.", "[[348 + 276]]", evaluate("348 + 267"))
        self.refused("ג06", "חשבו את התרגילים.", "חשבו: [[348 + 276]]", evaluate("600"))
        # Another group instruction changes what is asked about the calculation.
        question, item, solved, grade = wire("ג06", "עגלו את התוצאה לעשרות.", "[[348 + 276]]", evaluate("620"))
        self.assertIsNone(printed_parts.printed_calculation(question, item, solved, grade))
        # A bare number keyed by a calculation that equals it asks for the calculation itself.
        self.refused("ה05", "פרקו לגורמים ראשוניים.", "[[60]]", evaluate("2 * 2 * 3 * 5"))

    def test_a_bare_number_that_the_prompt_already_prints_is_not_a_key(self):
        def refused(topic, intro, prompt, answer):
            with self.assertRaises(GeneralSourceError) as caught:
                wire(topic, intro, prompt, answer)
            return (caught.exception.code, caught.exception.question, caught.exception.item)

        # The unit stands outside the island; what is left asks for nothing.
        self.assertEqual(refused("ג25", "חשבו.", "מחיר: [[12.50]] ₪", evaluate("12.50")), ("PRINTED_TASK_MISMATCH", 1, 1))
        self.assertEqual(refused("ג02", "כתבו את המספר.", "המספר הוא [[350]].", evaluate("350")), ("PRINTED_TASK_MISMATCH", 1, 1))
        self.assertEqual(refused("ה28", "כתבו.", "[[0.25]]", evaluate("0.25")), ("PRINTED_TASK_MISMATCH", 1, 1))
        # A fraction in lowest terms keyed as that fraction is the same echo.
        self.assertEqual(refused("ה28", "כתבו כשבר עשרוני.", "[[frac(3,10)]]", evaluate("frac(3,10)")), ("PRINTED_TASK_MISMATCH", 1, 1))
        self.assertEqual(refused("ה13", "כתבו את השבר.", "[[frac(7,3)]]", evaluate("frac(7,3)")), ("PRINTED_TASK_MISMATCH", 1, 1))
        # A change of form is a task: a decimal or a fraction for the other spelling, a reduced
        # fraction, a mixed number when one is asked for, another number, a calculation.
        wire("ה28", "כתבו כשבר פשוט.", "[[0.25]]", evaluate("frac(1,4)"))
        wire("ה28", "כתבו כשבר עשרוני.", "[[frac(3,10)]]", evaluate("0.3"))
        wire("ה09", "צמצמו.", "[[frac(6,8)]]", evaluate("frac(6,8)"))
        wire("ה13", "כתבו כמספר מעורב.", "[[frac(7,3)]]", evaluate("frac(7,3)"))
        wire("ה28", "מהי ספרת העשיריות במספר?", "[[3.47]]", evaluate("4"))
        wire("ג02", "חשבו.", "מהו המספר העוקב של [[399]]?", evaluate("399 + 1"))
        # A prompt that only lists numbers, keyed by one of them, picks a number and calculates nothing.
        self.assertEqual(refused("ג02", "ענו.", "[[354]], [[345]], [[435]]", evaluate("345")),
                         ("PRINTED_TASK_MISMATCH", 1, 1))
        self.assertEqual(refused("ג02", "ענו.", "[[354]]; [[345]]; [[435]]", evaluate("435")),
                         ("PRINTED_TASK_MISMATCH", 1, 1))
        # Under a request for an order the same key is refused first: one number is never an order.
        self.assertEqual(refused("ג02", "סדרו מהקטן לגדול.", "[[354]], [[345]], [[435]]", evaluate("345")),
                         ("PRINTED_ANSWER_KIND", None, None))
        # Two printed numbers in a question, a blank or a printed calculation leave something to do.
        wire("ג02", "איזה מספר גדול יותר?", "[[345]] או [[354]]?", evaluate("354"))
        wire("ג08", "חשבו.", "[[124 + 0 = ___]]", evaluate("124 + 0"))
        # Its blank written after the island is refused for the notation, before any key check.
        self.assertEqual(refused("ג08", "חשבו.", "[[124]] + [[0]] = ___", evaluate("124 + 0")), ("SOURCE_NOTATION", None, None))
        # A local author may state a count that the pupil checks against the printed words.
        lesson = lesson_for("ג02")
        scope = scope_for_lesson(lesson)
        question = {"intro": "ספרו וכתבו כמה יש.", "star": False, "items": [
            {"prompt": "כד, סל, גג. דן אמר: [[3]]", "answer": evaluate("3")}] * 3}
        expanded = compact_authoring.expand_source({"version": 4, "sections": [{"questions": [question]}]}, 3)
        local = expanded["sections"][0]["questions"][0]
        validate_question(copy.deepcopy(local), 3, scope, provider=False, qcount=1, evidence=[], pending=[])
        with self.assertRaises(GeneralSourceError):
            validate_question(copy.deepcopy(local), 3, scope, provider=True, qcount=1, evidence=[], pending=[])

    def test_written_spelling_of_a_comparison_survives_expansion(self):
        _, item, solved, _ = wire("ה29", "השוו.", "השלימו את הסימן.", compare("0.5", "0.45"))
        self.assertEqual(item["answer"]["notation"], "0.5 ___ 0.45")
        self.assertEqual(solved["result"]["relation"], "greater")
        _, item, _, _ = wire("ג02", "השוו.", "השלימו את הסימן.", compare("345", "354"))
        self.assertNotIn("notation", item["answer"])
        source = {"kind": "computed", "unit": "", "notation": "0.5 ___ 0.46",
                  "task": {"kind": "compare", "left": number(1, 2), "right": number(9, 20)}}
        question = {"intro": [{"kind": "text", "text": "השוו."}], "star": False,
                    "items": [{"prompt": [{"kind": "text", "text": "השלימו את הסימן."}], "answer": source}] * 3}
        with self.assertRaises(GeneralSourceError) as caught:
            validate_question(question, 5, scope_for_lesson(lesson_for("ה29")), provider=False, qcount=1, evidence=[], pending=[])
        self.assertEqual(caught.exception.code, "SOURCE_NOTATION")

    def test_keys_use_the_written_form_of_the_question(self):
        self.assertEqual(decimal_result(number(102, 5), "12.50 + 7.90"), "20.40")
        self.assertEqual(decimal_result(number(1, 2), "0.25 + 0.25"), "0.5")
        self.assertEqual(decimal_result(number(1, 2), "0.25 + 0.25", money=True), "0.50")
        self.assertEqual(decimal_result(number(20), "12.50 + 7.50", money=True), "20")
        x, y = {"type": "symbol", "name": "x"}, {"type": "symbol", "name": "y"}
        for tree, expected in [
            (operation("multiply", number(5), x), "5x"),
            (operation("multiply", number(-5), x), "−5x"),
            (operation("multiply", number(2), operation("add", x, number(1))), r"2\g{x + 1}"),
            (operation("multiply", operation("add", x, number(1)), operation("subtract", x, number(2))), r"\g{x + 1}\g{x − 2}"),
            (operation("multiply", number(2), x, y), "2xy"),
            (operation("multiply", number(2), number(3)), "2 · 3"),          # two numbers never fuse
            (operation("multiply", x, number(2)), "x · 2"),
            (operation("multiply", operation("power", x, number(2)), operation("power", x, number(3))), "x^{2} · x^{3}"),
            (operation("add", operation("power", x, number(2)), operation("add", operation("multiply", number(-1), x), number(-6))), "x^{2} − x − 6"),
        ]:
            self.assertEqual(to_house_math(tree, schoolbook=True), expected)
        self.assertEqual(to_house_math(operation("multiply", number(5), x)), "5 · x")  # the default is unchanged

        def forms(topic, intro, prompt, answer):
            question, item, solved, _ = wire(topic, intro, prompt, answer)
            return printed_parts.answer_form(question, item, solved)

        self.assertEqual(forms("ה13", "כתבו כמספר מעורב.", "[[frac(7,3)]]", evaluate("frac(7,3)")), {"mixed"})
        self.assertEqual(forms("ה13", "כתבו כשבר מדומה.", "[[2 + frac(1,3)]]", evaluate("2 + frac(1,3)")), set())
        self.assertEqual(forms("ה14", "חשבו.", "חשבו.", evaluate("2 + frac(1,3) + 1 + frac(1,6)")), {"mixed"})
        self.assertEqual(forms("ג25", "פתרו.", "עט עולה [[7.90]] שקלים ומחברת [[12.50]] שקלים. כמה שילמו?",
                               evaluate("12.50 + 7.90", "שקלים")), {"money"})


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

    def source(self, topic_id, questions, *, count=None):
        lesson = lesson_for(topic_id, count or len(questions))
        scope = scope_for_lesson(lesson)
        rows = [{"intro": intro, "star": index >= len(questions) - 2,
                 "items": [{"prompt": prompt, "answer": copy.deepcopy(answer)} for prompt, answer in items]}
                for index, (intro, items) in enumerate(questions)]
        payload = {"version": 4, "title": "דף תרגול", "rule": "קראו כל שאלה בעיון.",
                   "sections": [{"title": "תרגול", "conceptIds": lesson["lessonBoundary"]["conceptIds"], "questions": rows}]}
        expanded = compact_authoring.expand_source(payload, lesson["gradeNumber"],
                                                   fraction_notation=scope["topic"]["domain"] == "fractions")
        return lesson, scope, expanded

    def sheet(self, topic_id, questions):
        """Compile wire questions and return {(question, item): (pupil line, key)}."""
        lesson, scope, expanded = self.source(topic_id, questions)
        work = Path(tempfile.mkdtemp(dir=self.root))
        compile_source(lesson, validate_source(lesson, expanded, scope, provider=True), scope, self.skill, work)
        draft = json.loads((work / "worksheet-source.json").read_text(encoding="utf-8"))
        clean = lambda text: re.sub(r"\s+([,.?)])", r"\1", text)
        rows = {(q["n"], index): (clean(item["text"]), clean(item["answer"]))
                for q in draft["questions"] for index, item in enumerate(q["items"], 1)}
        return rows, work

    def test_grade_three_sheet_from_the_wire_prints_complete_keys_and_no_leak(self):
        place = lambda n, form: (form.format(n=n), evaluate(str(n)))
        rows, work = self.sheet("ג01", [
            ("השלימו את המספרים החסרים.", [place(345, "במספר [[{n}]] יש ___ מאות, ___ עשרות ו־___ אחדות"),
                                           place(728, "במספר [[{n}]] יש ___ מאות + ___ עשרות + ___ אחדות"),
                                           place(906, "במספר [[{n}]] יש ___ מאות, ___ עשרות ו־___ אחדות")]),
            ("מצאו את הספרות.", [place(451, "במספר [[{n}]] יש ___ מאות, ___ עשרות ו־___ אחדות"),
                                 place(630, "במספר [[{n}]] יש ___ מאות + ___ עשרות + ___ אחדות"),
                                 ("במספר [[4,507]], מהו הערך של הספרה [[5]]?", evaluate("500"))]),
            ("חשבו וכתבו את השארית.", [("[[47 : 5 = ___]] (שארית ___)", evaluate("47 / 5")),
                                       ("מחלקים [[34]] גולות ל־[[6]] ילדים. כמה מקבל כל ילד וכמה נשארות?", evaluate("34 / 6")),
                                       ("חשבו.", evaluate("29 / 4"))]),
            ("השלימו.", [("[[345 ___ 354]]", compare("345", "354")),
                         ("[[5]], [[10]], ___, ___, [[25]]", evaluate("15")),
                         ("לדני היו [[124]] גולות. הוא נתן [[38]] וקנה עוד [[15]]. כמה גולות יש לו?", evaluate("124 - 38 + 15"))]),
        ])
        self.assertEqual(rows[1, 1], ("במספר 345 יש ___ מאות, ___ עשרות ו־___ אחדות", "3 מאות, 4 עשרות, 5 אחדות"))
        self.assertEqual(rows[1, 2], ("במספר 728 יש ___ מאות + ___ עשרות + ___ אחדות", "7 מאות, 2 עשרות, 8 אחדות"))
        self.assertEqual(rows[1, 3], ("במספר 906 יש ___ מאות, ___ עשרות ו־___ אחדות", "9 מאות, 0 עשרות, 6 אחדות"))
        self.assertEqual(rows[2, 1], ("במספר 451 יש ___ מאות, ___ עשרות ו־___ אחדות", "4 מאות, 5 עשרות, 1 אחדות"))
        self.assertEqual(rows[2, 2], ("במספר 630 יש ___ מאות + ___ עשרות + ___ אחדות", "6 מאות, 3 עשרות, 0 אחדות"))
        # The value of the digit is the answer: it is in the key and nowhere beside the question.
        self.assertEqual(rows[2, 3], ("במספר 4,507, מהו הערך של הספרה 5?", "500"))
        self.assertEqual(rows[3, 1], ("47 : 5 = ___ (שארית ___)", "9 (שארית 2)"))
        self.assertEqual(rows[3, 2][1], "5 (שארית 4)")
        self.assertNotIn(":", rows[3, 2][0])                      # no operation after the story
        self.assertEqual(rows[3, 3], ("חשבו. 29 : 4", "7 (שארית 1)"))  # the task is the only exercise here
        self.assertEqual(rows[4, 1], ("345 ___ 354", "345 < 354"))    # never "345 x 354"
        self.assertEqual(rows[4, 2], ("5, 10, ___, ___, 25", "15, 20"))
        self.assertEqual(rows[4, 3], ("לדני היו 124 גולות. הוא נתן 38 וקנה עוד 15. כמה גולות יש לו?", "101"))
        claims = {claim["id"]: claim for claim in json.loads((work / "verified.json").read_text(encoding="utf-8"))["claims"]}
        self.assertEqual(claims["1.1.printed"]["evidence"]["rule"], "place_digits")
        self.assertEqual(claims["3.1.printed"]["evidence"]["remainder"], 2)
        self.assertEqual(claims["4.1.sign"]["evidence"]["rule"], "printed_sign")
        sheet = (work / "sheet.html").read_text(encoding="utf-8")
        self.assertIn('<span class="ltr">9</span> (שארית <span class="ltr">2</span>)', sheet)
        self.assertNotIn("345 x 354", html.unescape(re.sub(r"<[^>]+>", "", sheet)))

    def test_elementary_keys_keep_decimals_money_and_mixed_numbers(self):
        rows, _ = self.sheet("ה28", [
            ("השלימו את הסימן המתאים.", [("[[0.5]] ___ [[0.45]]", compare("0.5", "0.45")),
                                         ("השלימו את הסימן.", compare("0.5", "0.45")),
                                         # Beside a printed relation the item's own blank is a number.
                                         ("[[3.47 = 3 + 0.4 + ___]]", evaluate("0.07"))]),
            ("פתרו.", [("דנה קנתה מחברת ב־[[12.50]] שקלים ועט ב־[[7.90]] שקלים. כמה שילמה?", evaluate("12.50 + 7.90", "שקלים")),
                       ("חשבו.", evaluate("7.15 + 7.2")),
                       ("במספר [[45,238]] יש ___ עשרות אלפים, ___ אלפים, ___ מאות, ___ עשרות ו־___ אחדות",
                        evaluate("45238")),
                       ("במספר [[3.47]] יש ___ שלמים, ___ עשיריות ו־___ מאיות", evaluate("3.47"))]),
            ("כתבו כמספר מעורב.", [("[[frac(7,3)]]", evaluate("frac(7,3)")),
                                   ("חשבו.", evaluate("2 + frac(1,3) + 1 + frac(1,6)")),
                                   ("כתבו את [[2 + frac(1,3)]] כשבר מדומה.", evaluate("2 + frac(1,3)"))]),
            ("חשבו.", [("חשבו.", evaluate("124 - 38 + 15")),
                       ("חשבו.", evaluate("4 + 3 * 2")),
                       ("חשבו.", evaluate("(10 + 2) * (5 - 3)"))]),
            ("השלימו את הסימן.", [("[[4507 ___ 4570]]", compare("4507", "4570")),
                                  ("[[4507]] ___ [[4570]]", compare("4507", "4570")),
                                  ("[[3 + 4 ___ 9 - 1]]", compare("3 + 4", "9 - 1"))]),
        ])
        self.assertEqual(rows[5, 1], ("4,507 ___ 4,570", "4,507 < 4,570"))          # the grade's thousands comma
        self.assertEqual(rows[5, 2], ("4,507 ___ 4,570", "4,507 < 4,570"))
        self.assertEqual(rows[5, 3], ("3 + 4 ___ 9 − 1", "3 + 4 < 9 − 1"))
        self.assertEqual(rows[1, 1], ("0.5 ___ 0.45", "0.5 > 0.45"))                # not 1/2 > 9/20
        self.assertEqual(rows[1, 2], ("השלימו את הסימן. 0.5 ___ 0.45", "0.5 > 0.45"))
        self.assertEqual(rows[1, 3], ("3.47 = 3 + 0.4 + ___", "0.07"))
        self.assertEqual(rows[2, 1][1], "20.40 שקלים")
        self.assertEqual(rows[2, 2], ("חשבו. 7.15 + 7.2", "14.35"))
        self.assertEqual(rows[2, 3][1], "4 עשרות אלפים, 5 אלפים, 2 מאות, 3 עשרות, 8 אחדות")
        self.assertEqual(rows[2, 4][1], "3 שלמים, 4 עשיריות, 7 מאיות")
        self.assertEqual(rows[3, 1][1], "2 1 3")      # the mixed number 2⅓: whole, numerator, denominator
        self.assertEqual(rows[3, 2][1], "3 1 2")
        self.assertEqual(rows[3, 3][1], "7 3")        # an improper fraction where it is asked for
        self.assertEqual(rows[4, 1][0], "חשבו. 124 − 38 + 15")                      # no "(124 − 38) + 15"
        self.assertEqual(rows[4, 2][0], "חשבו. 4 + 3 x 2")
        self.assertEqual(rows[4, 3][0], "חשבו. (10 + 2) x (5 − 3)")                 # needed brackets stay

    def test_brackets_follow_the_grade(self):
        sys.path[:0] = [str(self.skill / "scripts"), str(self.skill / "scripts/lib")]
        import ws_html as H
        from general_adapters import _elementary_math
        product_in_sum = operation("add", number(4), operation("multiply", number(3), number(2)))
        self.assertEqual(_elementary_math(product_in_sum, "ד", H), "4 + 3 x 2")
        # Before the order of operations is taught, a later product keeps its brackets.
        self.assertEqual(_elementary_math(product_in_sum, "ג", H), "4 + (3 x 2)")
        self.assertEqual(_elementary_math(operation("add", operation("multiply", number(3), number(2)), number(4)), "ג", H), "3 x 2 + 4")
        self.assertEqual(_elementary_math(operation("subtract", number(10), operation("add", number(2), number(3))), "ג", H), "10 − (2 + 3)")
        self.assertEqual(_elementary_math(operation("divide", number(24), operation("multiply", number(2), number(3))), "ד", H), "24 : (2 x 3)")
        self.assertEqual(_elementary_math(operation("multiply", operation("multiply", number(2), number(3)), operation("add", number(4), number(1))), "ד", H), "2 x 3 x (4 + 1)")

    def test_trusted_check_item_still_prints_its_sum(self):
        lesson = lesson_for("ב05", 8)
        lesson["lessonBoundary"]["conceptIds"] = ["ב05#1"]
        lesson["level"] = "b"
        scope = scope_for_lesson(lesson)
        plan = addition.parameter_plan(8)
        choices = {"version": 1, "questions": [{"theme": q + 1, "choices": [(i + q) % 4 + 1 for i in range(5)]} for q in range(8)]}
        source = addition.build_source(lesson, choices, plan)
        work = Path(tempfile.mkdtemp(dir=self.root))
        compile_source(lesson, validate_source(lesson, source, scope), scope, self.skill, work)
        draft = json.loads((work / "worksheet-source.json").read_text(encoding="utf-8"))
        kinds = addition.question_kinds(8)
        for question, kind in zip(draft["questions"], kinds):
            for item in question["items"]:
                args = [value["numerator"] for value in item["task"]["expression"]["args"]]
                printed = re.sub(r"\s+", " ", item["text"]).endswith(f"{args[0]} + {args[1]}")
                # The proposed answer alone would leave nothing to calculate; a story needs no print.
                self.assertEqual(printed, kind in ("tens", "place", "check"), (kind, item["text"]))

    def test_refusals_carry_the_question_and_item(self):
        lesson, scope, expanded = self.source("ג01", [
            ("השלימו.", [("במספר [[345]] יש ___ מאות, ___ עשרות ו־___ אחדות", evaluate("345"))] * 3)] * 3 + [
            ("השלימו.", [("במספר [[345]] יש ___ מאות, ___ עשרות ו־___ אחדות", evaluate("345"))] * 2
             + [("במספר [[728]] יש ___ מאות, ___ עשרות ו־___ אחדות", evaluate("729"))])])
        with self.assertRaises(GeneralSourceError) as caught:
            validate_source(lesson, expanded, scope, provider=True)
        self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item),
                         ("PRINTED_TASK_MISMATCH", 4, 3))
        # The isolated adapter process leaves a record for its parent instead of a traceback to parse.
        work = Path(tempfile.mkdtemp(dir=self.root))
        (work / "lesson.json").write_text(json.dumps(lesson, ensure_ascii=False), encoding="utf-8")
        (work / "model-output.json").write_text(json.dumps(expanded, ensure_ascii=False), encoding="utf-8")
        (work / "curriculum-scope.json").write_text(json.dumps(scope, ensure_ascii=False), encoding="utf-8")
        env = {key: value for key, value in os.environ.items() if key in ("PATH", "HOME", "TMPDIR", "LANG")}
        done = subprocess.run([sys.executable, "-B", str(HERE / "general_adapters.py"), "--skill", str(self.skill),
                               "--work", str(work)], cwd=work, env=env, capture_output=True, text=True, timeout=120)
        self.assertNotEqual(done.returncode, 0)
        self.assertEqual(json.loads((work / FAILURE_RECORD).read_text(encoding="utf-8")),
                         {"version": 1, "step": "trusted-adapter", "code": "PRINTED_TASK_MISMATCH", "question": 4, "item": 3})
        self.assertFalse((work / "sheet.html").exists())

    def test_unverified_elementary_answer_names_its_item(self):
        lesson, scope, expanded = self.source("ג01", [
            ("השלימו.", [("במספר [[345]] יש ___ מאות, ___ עשרות ו־___ אחדות", evaluate("345"))] * 3)] * 4)
        expanded["sections"][0]["questions"][2]["items"][1]["answer"] = {
            "kind": "review", "text": [{"kind": "text", "text": "תשובה בעל פה"}]}
        with self.assertRaises(GeneralSourceError) as caught:
            compile_source(lesson, validate_source(lesson, expanded, scope), scope, self.skill, self.root / "unused")
        self.assertEqual((caught.exception.code, caught.exception.question, caught.exception.item),
                         ("UNVERIFIED_ANSWERS", 3, 2))


class MiddleKeyTests(unittest.TestCase):
    def rows(self, topic_id, intro, items):
        lesson = lesson_for(topic_id)
        scope = scope_for_lesson(lesson)
        question = {"intro": intro, "star": False,
                    "items": [{"prompt": prompt, "answer": copy.deepcopy(answer)} for prompt, answer in items]}
        expanded = compact_authoring.expand_source({"version": 4, "sections": [{"questions": [question]}]}, lesson["gradeNumber"])
        question = expanded["sections"][0]["questions"][0]
        evidence = []
        validate_question(question, lesson["gradeNumber"], scope, provider=True, qcount=1, evidence=evidence, pending=[])
        source = {"title": "דף", "rule": [{"kind": "text", "text": "כלל"}],
                  "sections": [{"title": "תרגול", "conceptIds": lesson["lessonBoundary"]["conceptIds"], "questions": [question]}]}
        with tempfile.TemporaryDirectory() as temp:
            _compile_middle(lesson, source, {"computations": evidence}, scope, None, Path(temp))
            draft = json.loads((Path(temp) / "worksheet-source.json").read_text(encoding="utf-8"))
            levels = json.loads((Path(temp) / "levels.json").read_text(encoding="utf-8"))
        return [(item["text"], item["answer"]) for item in draft["questions"][0]["items"]], levels[0]["questions"][0]["items"]

    def test_schoolbook_products_and_no_task_after_a_story(self):
        task = lambda kind, expression: {"kind": "computed", "unit": "", "task": {"kind": kind, "expression": expression}}
        rows, items = self.rows("g7:algebraic_expressions", "פשטו.", [
            ("פשטו את הביטוי [[2*x + 3*x]].", task("simplify", "2*x + 3*x")),
            ("פתחו את הסוגריים.", task("expand", "3*(x + 2)")),
            ("כנסו איברים דומים.", task("simplify", "x^2 + 2*x - 3*x - 6"))])
        self.assertEqual(rows[0], ("פשטו את הביטוי $2x + 3x$.", "$5x$"))          # shown once, keyed 5x
        self.assertEqual(rows[1], (r"פתחו את הסוגריים. $3\g{x + 2}$", "$3x + 6$"))
        self.assertEqual(rows[2][1], "$x^{2} − x − 6$")
        # A printed task is a stated given of its item.
        self.assertEqual(items[1]["given"], [rows[1][0]])
        solve = {"kind": "computed", "unit": "", "task": {"kind": "solve", "lhs": "3*x", "rhs": "15", "variable": "x"}}
        # After a story in the intro the typed equation is never printed: it would show the pupil how to model the
        # story. The bare "פתרו את המשוואה." is refused instead.
        with self.assertRaises(GeneralSourceError) as refused:
            self.rows("g7:equations", "לכל מחברת מחיר של [[3]] שקלים.", [
                ("דנה שילמה [[15]] שקלים. כמה מחברות קנתה?", solve),
                ("כמה מחברות קונים ב־[[15]] שקלים?", solve),
                ("פתרו את המשוואה.", solve)])
        self.assertEqual((refused.exception.code, refused.exception.question, refused.exception.item),
                         ("PRINTED_TASK_MISMATCH", 1, 3))
        rows, items = self.rows("g7:equations", "לכל מחברת מחיר של [[3]] שקלים.", [
            ("דנה שילמה [[15]] שקלים. כמה מחברות קנתה?", solve),
            ("כמה מחברות קונים ב־[[15]] שקלים?", solve),
            ("כמה מחברות קונים ב־[[15]] שקלים?", solve)])
        self.assertEqual(rows[0], ("דנה שילמה $15$ שקלים. כמה מחברות קנתה?", "$x = 5$"))
        # Without a printed task the shared story is a stated given of the item.
        self.assertEqual(items[0]["given"], [rows[0][0], "לכל מחברת מחיר של $3$ שקלים."])

    def test_blank_and_segment_names_keep_their_multiplication_sign(self):
        rows, _ = self.rows("g7:equations", "השלימו.", [
            ("השלימו: [[3 * ___ = 12]].", {"kind": "computed", "unit": "", "task": {"kind": "evaluate", "expression": "12 / 3"}})] * 3)
        self.assertEqual(rows[0], ("השלימו: $3 · ___ = 12$.", "$4$"))


if __name__ == "__main__":
    unittest.main()
