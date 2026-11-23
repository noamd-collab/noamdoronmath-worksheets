import copy
import json
from pathlib import Path
import random
import sys
import unicodedata
import unittest

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from compact_authoring import expand_source, expression, spans
from general_adapters import rich_text
from general_source import GeneralSourceError, rich, validate_question
from math_tasks import MathTaskError
from runtime_catalog import CURRICULUM_SHA256, catalog, question_floor, scope_for_lesson
import source_normalize
from source_normalize import normalize_expression, normalize_question, normalize_rich, normalize_source

TOPICS = {topic["topicId"]: topic for topic in catalog().topics}


def scope(topic_id):
    topic = TOPICS[topic_id]
    return scope_for_lesson({
        "version": 3, "gradeNumber": topic["gradeNumber"], "topicId": topic_id, "level": topic["levels"][0],
        "lessonGoal": "practice", "questionCount": question_floor(topic["gradeNumber"]), "minutes": 40,
        "lastLesson": "למדנו את המושג הראשון בנושא ותרגלנו בכיתה", "alreadyLearned": [],
        "explicitShortSheet": False,
        "lessonBoundary": {"version": 1, "kind": "curriculum_scope", "curriculumSha256": CURRICULUM_SHA256,
                           "conceptIds": [topic["concepts"][0]["id"]]}})


def accepted(value, grade, fractions=False):
    """The engine's own verdict on one rich wire string."""
    try:
        return rich(spans(value, grade, fraction_notation=fractions), grade, provider=True)
    except (GeneralSourceError, MathTaskError) as error:
        return error.code


def compiled(question, topic_id):
    """Expand and validate one wire question exactly as the per-question replay does."""
    bounds = scope(topic_id)
    grade = bounds["topic"]["gradeNumber"]
    expanded = expand_source({"version": 4, "sections": [{"questions": [{**copy.deepcopy(question), "star": False}]}]},
                             grade, topic=bounds["topic"], fraction_notation=bounds["topic"]["domain"] == "fractions")
    result = expanded["sections"][0]["questions"][0]
    evidence = []
    validate_question(result, grade, bounds, provider=True, qcount=1, evidence=evidence, pending=[])
    return result, evidence


def evaluate(expression_text, unit=""):
    return {"kind": "computed", "task": {"kind": "evaluate", "expression": expression_text}, "unit": unit}


class RuleTests(unittest.TestCase):
    def rewrite(self, grade, before, after, code, domain="operations"):
        with self.subTest(before=before, grade=grade):
            result, notes = normalize_rich(before, grade, domain=domain)
            self.assertEqual(result, after)
            self.assertIn(code, [note["code"] for note in notes])
            self.assertEqual(normalize_rich(result, grade, domain=domain), (result, []))
            self.assertIsInstance(accepted(result, grade), list, accepted(result, grade))

    def test_elementary_school_operators(self):
        self.rewrite(4, "[[324x15]]", "[[324 x 15]]", "SCHOOL_OPERATOR")
        self.rewrite(4, "[[1,845:15]]", "[[1,845 : 15]]", "SCHOOL_OPERATOR")
        self.rewrite(6, "[[25%x80]]", "[[25% x 80]]", "SCHOOL_OPERATOR")
        self.rewrite(4, "[[3 X 4]]", "[[3 x 4]]", "SCHOOL_OPERATOR")
        self.rewrite(4, "חשבו: [[48:6 = ___]]", "חשבו: [[48 : 6 = ___]]", "SCHOOL_OPERATOR")
        # In a fraction topic the tokenizer reads 12/4 as a fraction, so ÷ becomes the school colon.
        self.rewrite(4, "[[12÷4]]", "[[12 : 4]]", "SCHOOL_OPERATOR")
        self.assertEqual(accepted("[[12 : 4]]", 4, fractions=True), [{"kind": "formula", "notation": "12 / 4"}])
        # The already spaced contract form is not touched.
        self.assertEqual(normalize_rich("[[25% x 80]]", 6, domain="ratios"), ("[[25% x 80]]", []))
        # Middle school reads 2x as a coefficient.
        self.assertEqual(normalize_rich("[[2x3]]", 8)[0], "[[2x3]]")

    def test_colon_keeps_its_spelling_where_it_can_be_a_time_or_a_ratio(self):
        for grade, domain, value in [
            (3, "operations", "[[7:30]]"), (3, "operations", "[[20:10]]"), (2, "measurement", "[[36:6]]"),
            (6, "ratios", "[[2:3]]"), (6, "ratios", "[[6:9 = 2:3]]"), (4, "operations", "[[7:30 + 1:15]]"),
            (4, None, "[[36:6]]"),
        ]:
            with self.subTest(value=value, domain=domain):
                self.assertEqual(normalize_rich(value, grade, domain=domain), (value, []))
        self.assertEqual(normalize_rich("[[36:6]]", 3, domain="operations")[0], "[[36 : 6]]")
        self.assertEqual(normalize_rich("[[48:12]]", 4, domain="operations")[0], "[[48 : 12]]")

    def test_roots_powers_fractions_and_signs(self):
        self.rewrite(8, "[[√49]]", "[[sqrt(49)]]", "ROOT_SIGN")
        self.rewrite(8, "[[√(x+1)]]", "[[sqrt(x+1)]]", "ROOT_SIGN")
        self.rewrite(9, "חשבו [[2√3]]", "חשבו [[2sqrt(3)]]", "ROOT_SIGN")
        self.rewrite(8, "[[2³]]", "[[2^3]]", "SUPERSCRIPT")
        self.rewrite(8, "[[x²]]", "[[x^2]]", "SUPERSCRIPT")
        self.rewrite(8, "[[10⁻²]]", "[[10^(-2)]]", "SUPERSCRIPT")
        self.rewrite(4, "[[½]]", "[[frac(1,2)]]", "VULGAR_FRACTION")
        self.rewrite(4, "חצי הוא ½ מהשלם", "חצי הוא [[frac(1,2)]] מהשלם", "VULGAR_FRACTION")
        self.rewrite(8, "[[5 \u2013 10 + 2]]", "[[5 - 10 + 2]]", "SIGN_VARIANT")
        self.rewrite(8, "[[2\u22c53]]", "[[2*3]]", "SIGN_VARIANT")
        self.rewrite(4, "[[6\uff0b3]]", "[[6+3]]", "SIGN_VARIANT")
        self.rewrite(8, "[[.5]]", "[[0.5]]", "LEADING_DOT")
        self.rewrite(6, "[[25 %]]", "[[25%]]", "PERCENT_SPACING")
        self.rewrite(6, "[[%25]]", "[[25%]]", "PERCENT_SPACING")
        self.rewrite(6, "[[25]] % מהכיתה", "[[25%]] מהכיתה", "PERCENT_SPACING")
        self.rewrite(6, "25 % מהכיתה", "25% מהכיתה", "PERCENT_SPACING")
        self.rewrite(8, "[[90\u00ba]]", "[[90°]]", "DEGREE_SIGN")

    def test_placeholders_become_the_blank(self):
        for before in ["[[5 + ☐ = 9]]", "[[5 + □ = 9]]", "[[5 + ? = 9]]", "[[5 + _ = 9]]", "[[5 + ____ = 9]]"]:
            self.rewrite(4, before, "[[5 + ___ = 9]]", "PLACEHOLDER")
        self.rewrite(4, "[[5 + 3 = ?]]", "[[5 + 3 = ___]]", "PLACEHOLDER")
        self.rewrite(4, "[[5 + 3 =]]", "[[5 + 3 = ___]]", "RESULT_BLANK")
        self.rewrite(4, "5 + ☐ = 9", "[[5 + ___ = 9]]", "WHOLE_FORMULA")
        self.rewrite(4, "השלימו: ____ + [[5]] = [[9]]", "השלימו: ___ + [[5]] = [[9]]", "PLACEHOLDER")
        # A question mark after the last operand is punctuation, not an unknown.
        self.rewrite(4, "[[5 + 3 = 8?]]", "[[5 + 3 = 8]]?", "PUNCTUATION_OUT")
        self.rewrite(7, "[[x = 5.]]", "[[x = 5]].", "PUNCTUATION_OUT")
        # In prose a question mark is always punctuation.
        self.assertEqual(normalize_rich("כמה הם [[3]] ועוד [[4]]?", 4), ("כמה הם [[3]] ועוד [[4]]?", []))

    def test_units_leave_the_island_and_the_degree_sign_enters_it(self):
        self.rewrite(4, "[[12.50 ₪]]", "[[12.50]] ₪", "UNIT_OUT")
        self.rewrite(4, "[[₪12.50]]", "[[12.50]] ₪", "UNIT_OUT")
        self.rewrite(3, "[[5 ס״מ]]", "[[5]] ס״מ", "UNIT_OUT")
        self.rewrite(3, '[[5 ס"מ]]', '[[5]] ס"מ', "UNIT_OUT")
        self.rewrite(4, "[[5 + 3 = ___ שקלים]]", "[[5 + 3 = ___]] שקלים", "UNIT_OUT")
        self.rewrite(8, "AD הוא [[תיכון]] לצלע BC.", "[[segment:AD]] הוא תיכון לצלע [[segment:BC]].", "HEBREW_ISLAND",
                     domain="גיאומטרי")
        # Outside its island a degree sign prints on the wrong side in a right-to-left line.
        self.rewrite(5, "[[90]]°", "[[90°]]", "DEGREE_SIGN")
        self.rewrite(8, "[[90]] °", "[[90°]]", "DEGREE_SIGN")
        self.assertEqual(normalize_rich("[[90°]]", 5), ("[[90°]]", []))
        # The pinned elementary signs admit a degree sign from grade five only.
        self.assertEqual(normalize_rich("[[90]]°", 4), ("[[90]]°", []))
        # Hebrew that is not a trailing unit stays where the author put it.
        self.assertEqual(normalize_rich("[[3 תפוחים + 4 תפוחים]]", 3)[0], "[[3 תפוחים + 4 תפוחים]]")

    def test_island_brackets_and_one_unambiguous_repair(self):
        self.rewrite(4, "\u27e65 + 3\u27e7", "[[5 + 3]]", "ISLAND_BRACKETS")
        self.rewrite(4, "מצב ב': [[4 + (2 * 3)]. מה ההפרש", "מצב ב': [[4 + (2 * 3)]]. מה ההפרש", "BRACKET_REPAIR")
        self.rewrite(4, "בחישוב [[(___) + 4] * 3 = 21]], מהו המספר החסר?",
                     "בחישוב [[((___) + 4) * 3 = 21]], מהו המספר החסר?", "BRACKET_REPAIR")
        for doubtful in ["מלה [[3", "מלה ]]", "[[5]] ועוד [[שלוש]", "[[[5]]]", "[[5] + [3]]"]:
            with self.subTest(doubtful=doubtful):
                self.assertEqual(normalize_rich(doubtful, 4), (doubtful, []))

    def test_latex_and_dollar_math(self):
        self.rewrite(8, "[[\\frac{1}{2}]]", "[[frac(1,2)]]", "LATEX")
        self.rewrite(8, "[[2 \\cdot 3]]", "[[2 * 3]]", "LATEX")
        self.rewrite(8, "[[\\sqrt{16}]]", "[[sqrt(16)]]", "LATEX")
        self.rewrite(8, "[[x^{2}]]", "[[x^2]]", "LATEX")
        self.rewrite(8, "חשבו \\(x+1\\) עכשיו", "חשבו [[x+1]] עכשיו", "DOLLAR_MATH")
        self.rewrite(8, "ולכן $AM \\perp BC$.", "ולכן [[AM ⊥ BC]].", "DOLLAR_MATH", domain="גיאומטרי")
        self.rewrite(8, "הקודקודים $A(0, 4)$, $B(-3, 0)$ ו־$C(3, 0)$.",
                     "הקודקודים [[A(0, 4)]], [[B(-3, 0)]] ו־[[C(3, 0)]].", "DOLLAR_MATH", domain="גיאומטרי")
        self.rewrite(8, "חשבו את $x", "חשבו את x", "DOLLAR_STRAY")
        # A dollar next to a digit can be a price; markup outside the closed subset is not guessed.
        for doubtful in ["מחיר: 5$", "המחיר $5 ו-$10", "[[\\alpha + 1]]", "$\\vec{AB}$", "[[x_{1}]]", "$שלום$"]:
            with self.subTest(doubtful=doubtful):
                self.assertEqual(normalize_rich(doubtful, 8), (doubtful, []))

    def test_middle_school_prose(self):
        geometry = "גיאומטרי"
        self.rewrite(8, "מהו גודל הזווית \u2221ACB?", "מהו גודל הזווית [[∠ACB]]?", "GEOMETRY_SIGN", geometry)
        self.rewrite(8, "נתון \u0394ABC.", "נתון [[△ABC]].", "GEOMETRY_SIGN", geometry)
        self.rewrite(8, "ידוע כי AB || CD.", "ידוע כי [[AB ∥ CD]].", "GEOMETRY_SIGN", geometry)
        self.rewrite(8, "אם ∠ABC = 50 מעלות ו-∠BAC = 60 מעלות", "אם [[∠ABC = 50°]] ו-[[∠BAC = 60°]]", "DEGREE_WORD", geometry)
        self.rewrite(8, "הזוויות 40°, 60° ו-80°", "הזוויות [[40°]], [[60°]] ו-[[80°]]", "GEOMETRY_ISLAND", geometry)
        self.rewrite(8, "המספרים 2, 4, 6 הם זוגיים", "המספרים [[2]], [[4]], [[6]] הם זוגיים", "NUMBER_LIST")
        self.rewrite(8, "לא ייתכן, כי 4+6 < 9.", "לא ייתכן, כי [[4+6 < 9]].", "BARE_FORMULA")
        self.rewrite(9, "היקף הריבוע גדול יותר כי 4a > 2a+2b.", "היקף הריבוע גדול יותר כי [[4a > 2a+2b]].", "BARE_FORMULA")
        self.rewrite(9, "מכיוון ש-b<a, השטח גדול יותר.", "מכיוון ש-[[b<a]], השטח גדול יותר.", "BARE_FORMULA")
        self.rewrite(8, "3 < x < 17.", "[[3 < x < 17]].", "WHOLE_FORMULA")
        self.rewrite(8, "[[angle:ABC]] = [[50°]]", "[[∠ABC]] = [[50°]]", "TYPED_RELATION", geometry)
        # A coordinate pair is one token, and these have more than one reading.
        for doubtful in ["הנקודה (2, 3) נמצאת", "בתאריך 01/02/2026 נבחן", "בין 5-10 תלמידים", "השעה 7:30 בבוקר",
                         "היחס 2:3", "בטמפרטורה 25°C", "∠ABC + ∠BCA = 90°", "הקוד XYZ.", "ל-AB יש אורך"]:
            with self.subTest(doubtful=doubtful):
                self.assertEqual(normalize_rich(doubtful, 8, domain=geometry), (doubtful, []))
        # Elementary prose keeps bare numbers: the printed forms there belong to the printed-task binders.
        self.assertEqual(normalize_rich("כי 4+6 < 9 וגם 2, 4, 6", 4), ("כי 4+6 < 9 וגם 2, 4, 6", []))

    def test_a_hebrew_noun_types_the_label_after_it(self):
        geometry = "גיאומטרי"
        cases = [
            ("במשולש ABC, הגובה AD מאונך לצלע BC.",
             "במשולש [[triangle:ABC]], הגובה [[segment:AD]] מאונך לצלע [[segment:BC]].",
             r"במשולש $\tri ABC$, הגובה $AD$ מאונך לצלע $BC$."),
            ("משולש שווה שוקיים ABC (AB=AC).", "משולש שווה שוקיים [[triangle:ABC]] (AB=AC).",
             r"משולש שווה שוקיים $\tri ABC$ ($AB = AC$)."),
            ("הוכיחו כי המשולשים ABD ו-ACD חופפים.", "הוכיחו כי המשולשים [[triangle:ABD]] ו-[[triangle:ACD]] חופפים.",
             r"הוכיחו כי המשולשים $\tri ABD$ ו-$\tri ACD$ חופפים."),
            ("מהו גודל הזווית ABC?", "מהו גודל הזווית [[angle:ABC]]?", r"מהו גודל הזווית $\angle{ABC}$?"),
            ("הנקודה M היא אמצע השוק AB.", "הנקודה [[point:M]] היא אמצע השוק [[segment:AB]].",
             "הנקודה $M$ היא אמצע השוק $AB$."),
            ("מרובע ABCD הוא ריבוע.", "מרובע [[polygon:ABCD]] הוא ריבוע.", "מרובע $ABCD$ הוא ריבוע."),
            ("AE הוא חוצה הזווית \u2221BAC.", "[[segment:AE]] הוא חוצה הזווית [[∠BAC]].", r"$AE$ הוא חוצה הזווית $\angle{BAC}$."),
            ("משולש $ABC$. הנקודה $M$ היא אמצע הצלע $BC$. נתון: $BM=6$ ס\"מ.",
             "משולש [[triangle:ABC]]. הנקודה [[point:M]] היא אמצע הצלע [[segment:BC]]. נתון: [[BM=6]] ס\"מ.",
             "משולש $\\tri ABC$. הנקודה $M$ היא אמצע הצלע $BC$. נתון: $BM = 6$ ס\"מ."),
        ]
        for before, after, printed in cases:
            with self.subTest(before=before):
                result, notes = normalize_rich(before, 8, domain=geometry)
                self.assertEqual(result, after)
                self.assertIn("LABEL_NOUN", [note["code"] for note in notes])
                self.assertEqual(normalize_rich(result, 8, domain=geometry), (result, []))
                self.assertEqual(rich_text(accepted(result, 8), 8), printed)
        # A label that is part of a formula, a coordinate or a repeated-letter name is left to the tokenizer.
        for untouched in ["הקטע CD = 12.50 מופיע בשרטוט.", "הנקודה A(2,3) נמצאת", "משולש ABA"]:
            with self.subTest(untouched=untouched):
                self.assertEqual(normalize_rich(untouched, 8, domain=geometry), (untouched, []))

    def test_spellings_with_two_readings_stay_untouched(self):
        for grade, value in [(8, "[[3,5]]"), (8, "[[5\u201310]]"), (4, "[[2½]]"), (4, "[[3_8]]"), (4, "[[3x = 12]]"),
                             (8, "[[√25x]]"), (4, "[[5 + ... = 9]]"), (4, "[[1 000]]")]:
            with self.subTest(value=value):
                self.assertEqual(normalize_rich(value, grade), (value, []))
                self.assertIsInstance(accepted(value, grade), str)

    def test_contract_notation_is_a_fixed_point(self):
        for grade, value in [
            (4, "חשבו [[324 x 15]] וגם [[1,845 : 15]]."), (4, "השלימו: [[24 / ___ = 6]]"), (2, "כַּמָּה הֵם [[3]] וְעוֹד [[4]]?"),
            (6, "מצאו [[25%]] מתוך [[80]]."), (5, "זווית של [[90°]]"), (4, "[[frac(1,2)]] + [[frac(1,4)]] = ___"),
            (8, "פתרו את המשוואה [[2x + 4 = 10]]."), (8, "במשולש [[triangle:ABC]] נתון [[∠ABC = 50°]] ו-[[AB ⊥ CD]]."),
            (9, "הנקודה [[A(2,3)]] והקטע [[segment:AB]] באורך [[sqrt(13)]]."), (7, "הטמפרטורה ירדה ל-[[-3]] מעלות."),
        ]:
            with self.subTest(value=value):
                self.assertEqual(normalize_rich(value, grade, domain="operations"), (value, []))


class TaskExpressionTests(unittest.TestCase):
    def test_task_expressions_take_the_formula_rewrites(self):
        for grade, before, after in [
            (4, "324x15", "324 x 15"), (4, "48:6 + 2", "48 : 6 + 2"), (4, "48:6", "48 : 6"), (4, "12÷4", "12 : 4"),
            (8, "√49", "sqrt(49)"), (8, "2³", "2^3"), (8, "\\frac{3}{4}+½", "frac(3,4)+frac(1,2)"),
            (8, "[[2*x+3]]", "2*x+3"), (8, "$5^2$", "5^2"), (8, "5 \u2013 3 + 1", "5 - 3 + 1"), (6, "25 %*80", "25%*80"),
        ]:
            with self.subTest(before=before):
                result, notes = normalize_expression(before, grade, domain="operations")
                self.assertEqual(result, after)
                self.assertTrue(notes)
                self.assertEqual(normalize_expression(result, grade, domain="operations"), (result, []))
                expression(result.replace("−", "-"), grade)

    def test_a_task_never_gains_a_reading_that_changes_the_key(self):
        # An inexact lone division would print a fraction as the key of a division exercise.
        for grade, domain, value in [(3, "operations", "13:4"), (3, "operations", "7:30"), (6, "ratios", "6:3"),
                                     (4, "operations", "13:4 + 1"), (4, "operations", "(12+8):4"), (4, "operations", "48:6:3"),
                                     (4, None, "48:6"), (4, "operations", "5 + ? = 9"), (4, "operations", "x : 5 = 8"),
                                     (8, "אלגברי", "2x"), (8, "אלגברי", "(-3,3)"), (4, "operations", "שלוש ועוד ארבע")]:
            with self.subTest(value=value):
                self.assertEqual(normalize_expression(value, grade, domain=domain), (value, []))


class QuestionTests(unittest.TestCase):
    def test_recorded_elementary_unknown_becomes_the_blank_the_contract_asks_for(self):
        # From a recorded grade-four reply: every field of the question named the unknown x.
        question = {
            "intro": "השלימו את המספר החסר כדי שהמשוואה תהיה נכונה.",
            "table": {"head": ["משוואה", "ערך x"],
                      "rows": [["[[2 * x + 3 = 9]]", "___"], ["[[10 - x * 2 = 4]]", "___"], ["[[x / 3 + 2 = 5]]", "___"]]},
            "items": [
                {"prompt": "מצאו את [[x]] במשוואה [[2 * x + 3 = 9]].", "answer": evaluate("(9 - 3) / 2")},
                {"prompt": "מצאו את [[x]] במשוואה [[10 - x * 2 = 4]].", "answer": evaluate("(10 - 4) / 2")},
                {"prompt": "מצאו את [[x]] במשוואה [[x / 3 + 2 = 5]].", "answer": evaluate("(5 - 2) * 3")},
            ]}
        original = copy.deepcopy(question)
        with self.assertRaises(GeneralSourceError) as rejected:
            validate_question({**copy.deepcopy(question), "star": False, "intro": spans(question["intro"], 4),
                               "table": {"head": [spans(c, 4) for c in question["table"]["head"]],
                                         "rows": [[spans(c, 4) for c in row] for row in question["table"]["rows"]]}},
                              4, scope("ד07"), provider=True, qcount=1, evidence=[], pending=[])
        self.assertEqual(rejected.exception.code, "SOURCE_NOTATION")
        result, notes = normalize_question(question, 4, topic_id="ד07", domain="operations")
        self.assertEqual(question, original)
        self.assertEqual(result["table"]["head"], ["משוואה", "ערך המספר החסר"])
        self.assertEqual(result["table"]["rows"][1][0], "[[10 - ___ * 2 = 4]]")
        self.assertEqual([item["prompt"] for item in result["items"]], [
            "מצאו את המספר החסר במשוואה [[2 * ___ + 3 = 9]].",
            "מצאו את המספר החסר במשוואה [[10 - ___ * 2 = 4]].",
            "מצאו את המספר החסר במשוואה [[___ / 3 + 2 = 5]].",
        ])
        self.assertEqual({note["code"] for note in notes}, {"ELEMENTARY_UNKNOWN"})
        self.assertEqual(normalize_question(result, 4, topic_id="ד07", domain="operations"), (result, []))
        expanded, evidence = compiled(question, "ד07")
        self.assertEqual(expanded["items"][0]["prompt"][1], {"kind": "formula", "notation": "2 * ___ + 3 = 9"})
        self.assertEqual([row["computed"]["result"]["value"]["numerator"] for row in evidence], [3, 3, 9])

    def test_unknown_named_after_its_noun_and_other_letters(self):
        question = {"intro": "בנו דוגמה חדשה:", "items": [
            {"prompt": "חשבו את הנעלם x בתרגיל: [[x : 5 = 8]]", "answer": evaluate("5 * 8")},
            {"prompt": "חשבו את הנעלם y בתרגיל: [[y:9 = 4]]", "answer": evaluate("9 * 4")},
            {"prompt": "מהו z? [[(z * 2) + 4 = 12]]", "answer": evaluate("(12 - 4) / 2")},
        ]}
        result, _ = normalize_question(question, 3, topic_id="ג10", domain="operations")
        self.assertEqual([item["prompt"] for item in result["items"]], [
            "חשבו את הנעלם בתרגיל: [[___ : 5 = 8]]",
            "חשבו את הנעלם בתרגיל: [[___ : 9 = 4]]",
            "מהו המספר החסר? [[(___ * 2) + 4 = 12]]",
        ])
        pointed, _ = normalize_question({"intro": "מִצְאוּ אֶת x.", "items": [{"prompt": "[[x + 3 = 7]]", "answer": {}}]}, 2)
        self.assertEqual(pointed["intro"], "מִצְאוּ אֶת הַמִּסְפָּר הֶחָסֵר.")
        self.assertEqual(pointed["items"][0]["prompt"], "[[___ + 3 = 7]]")
        # The multiplication sign of the elementary grades is never an unknown.
        signs = {"intro": "חשבו.", "items": [{"prompt": "[[3 x 4 = ___]]", "answer": {}}, {"prompt": "[[3x4]]", "answer": {}}]}
        self.assertEqual(normalize_question(signs, 4)[0]["items"][1]["prompt"], "[[3 x 4]]")

    def test_unknown_rule_is_all_or_nothing_for_the_question(self):
        doubtful = [
            # The letter is part of other mathematics in the same sentence.
            ["ידוע כי [[(x + 2) * 3 = 15]]. מהו הערך של x+2?"],
            ["ידוע ש-[[(x + 2) * 3 = 15]]. מהו הערך של [[x + 2]]?"],
            # It occurs twice, two letters share a formula, or it carries a coefficient.
            ["[[x + x = 10]]"], ["[[x + y = 10]]"], ["[[3x = 12]]"],
            # x = 5 states a value, and a fused Hebrew prefix would need new grammar.
            ["אם [[x = 5]], חשבו [[x + 3 = ___]]"], ["מה שווה ל-x? [[x + 2 = 5]]"],
            # A mention in another field that cannot be rewritten blocks every field.
            ["[[x : 5 = 8]]", "חשבו x+1 לפי התרגיל הקודם."],
        ]
        for prompts in doubtful:
            with self.subTest(prompts=prompts):
                question = {"intro": "פתרו.", "items": [{"prompt": text, "answer": {}} for text in prompts]}
                result, notes = normalize_question(question, 4, domain="operations")
                self.assertEqual(result, question)
                self.assertEqual(notes, [])
        # Middle school keeps its variables.
        middle = {"intro": "פתרו.", "items": [{"prompt": "[[x : 5 = 8]]", "answer": {}}]}
        self.assertEqual(normalize_question(middle, 7)[0], middle)

    def test_one_letter_angle_takes_its_three_letters_from_the_figure_only(self):
        square = {"kind": "shape", "shape": "square", "parameters": {"a": 5}, "names": "ABCD", "rotate": 0}
        question = {"intro": "התבוננו בריבוע [[ABCD]] המצויר בתמונה.", "figure": square, "items": [
            {"prompt": "מהי הזווית [[angle:A]]?", "answer": evaluate("90", "מעלות")},
            {"prompt": "חשבו את \u2221B ואת זווית C וגם [[∠D]].", "answer": evaluate("90", "מעלות")},
            {"prompt": "מהי הזווית [[angle:ABC]]?", "answer": evaluate("90", "מעלות")},
        ]}
        result, notes = normalize_question(question, 9, topic_id="g9m:square", domain="גיאומטרי")
        self.assertEqual(result["intro"], "התבוננו בריבוע [[polygon:ABCD]] המצויר בתמונה.")
        self.assertEqual([item["prompt"] for item in result["items"]], [
            "מהי הזווית [[angle:BAD]]?", "חשבו את [[∠ABC]] ואת זווית [[angle:BCD]] וגם [[∠ADC]].",
            "מהי הזווית [[angle:ABC]]?"])
        self.assertIn("ANGLE_THREE_LETTER", {note["code"] for note in notes})
        self.assertEqual(normalize_question(result, 9, topic_id="g9m:square", domain="גיאומטרי"), (result, []))
        with self.assertRaises(GeneralSourceError):
            compiled({**question, "items": question["items"][:1] * 3, "figure": None}, "g9m:square")
        expanded, _ = compiled({**question, "items": [question["items"][0], question["items"][2], question["items"][0]]},
                               "g9m:square")
        self.assertEqual(expanded["items"][0]["prompt"][1], {"kind": "geometry", "type": "angle", "names": "BAD"})
        # The pinned skill's gate G81 refuses a one-letter angle, so without a deciding figure nothing is guessed.
        plane = {"kind": "coordinate_plane", "xr": [0, 5], "yr": [0, 5], "segments": [["A", "B"], ["B", "C"], ["C", "A"]],
                 "points": [{"name": n, "x": x, "y": y} for n, x, y in (("A", 0, 0), ("B", 4, 0), ("C", 2, 3))]}
        for figure, prompt, expected in [
            (plane, "חשבו את [[∠C]].", "חשבו את [[∠ACB]]."),
            (None, "חשבו את [[angle:A]] ואת \u2221B.", "חשבו את [[angle:A]] ואת \u2221B."),
            ({"kind": "shape", "shape": "circle", "parameters": {"r": 3}, "names": "O", "rotate": 0},
             "חשבו את [[angle:O]].", "חשבו את [[angle:O]]."),
            ({**plane, "segments": [["A", "B"]]}, "חשבו את [[∠A]].", "חשבו את [[∠A]]."),
        ]:
            with self.subTest(prompt=prompt, figure=figure and figure["kind"]):
                wire = {"intro": "חשבו.", "items": [{"prompt": prompt, "answer": {}}]}
                if figure:
                    wire["figure"] = figure
                self.assertEqual(normalize_question(wire, 8, domain="גיאומטרי")[0]["items"][0]["prompt"], expected)

    def test_recorded_geometry_reply_with_dollar_math_now_compiles(self):
        question = {
            "intro": "בסרטוט שלפניכם משולש שווה־שוקיים $ABC$ ($AB=AC$). התיכון $AD$ לבסיס $BC$ הוא גם גובה. נתון: $\\angle{ABC}=70°$.",
            "items": [
                {"prompt": "מהו גודל הזווית $\\angle{ACB}$?", "answer": evaluate("70", "מעלות")},
                {"prompt": "מהו גודל זווית הראש $\\angle{BAC}$?", "answer": evaluate("180-70-70", "מעלות")},
                {"prompt": "מהו גודל הזווית $\\angle{BAD}$?", "answer": evaluate("40/2", "מעלות")},
            ]}
        expanded, evidence = compiled(question, "g8:triangle_parts")
        self.assertEqual(rich_text(expanded["intro"], 8),
                         r"בסרטוט שלפניכם משולש שווה־שוקיים $\tri ABC$ ($AB = AC$). התיכון $AD$ לבסיס $BC$ הוא גם גובה. "
                         r"נתון: $\angle{ABC} = 70°$.")
        self.assertEqual(rich_text(expanded["items"][0]["prompt"], 8), r"מהו גודל הזווית $\angle{ACB}$?")
        self.assertEqual(len(evidence), 3)

    def test_recorded_bracket_typos_now_compile(self):
        question = {"intro": "השוו בין שני מצבים המשלבים סוגריים ופעולות מעורבות.", "items": [
            {"prompt": "מצב א': [[(4 + 2) * 3]]. מצב ב': [[4 + (2 * 3)]. מה ההפרש בין התוצאות?",
             "answer": evaluate("(4 + 2) * 3 - (4 + 2 * 3)")},
            {"prompt": "בחישוב [[(___) + 4] * 3 = 21]], מהו המספר החסר?", "answer": evaluate("21 / 3 - 4")},
            {"prompt": "חשבו: [[324x15]]", "answer": evaluate("324x15")},
        ]}
        expanded, evidence = compiled(question, "ד07")
        self.assertEqual(expanded["items"][1]["prompt"][1], {"kind": "formula", "notation": "((___) + 4) * 3 = 21"})
        self.assertEqual([row["computed"]["result"]["value"]["numerator"] for row in evidence], [8, 3, 4860])


class SeamAndSafetyTests(unittest.TestCase):
    def test_expand_source_normalises_every_question_and_reports_notes(self):
        notes = []
        payload = {"version": 4, "title": "תרגול", "rule": "פתרו: [[5 + ☐ = 9]]", "sections": [{"questions": [
            {"intro": "חשבו.", "star": False,
             "items": [{"prompt": "[[324x15]]", "answer": evaluate("324x15")} for _ in range(3)]}]}]}
        original = copy.deepcopy(payload)
        expanded = expand_source(payload, 4, topic=TOPICS["ד07"], notes=notes)
        self.assertEqual(payload, original)
        self.assertEqual(expanded["rule"], [{"kind": "text", "text": "פתרו: "},
                                            {"kind": "formula", "notation": "5 + ___ = 9"}])
        item = expanded["sections"][0]["questions"][0]["items"][0]
        self.assertEqual(item["prompt"], [{"kind": "formula", "notation": "324 * 15"}])
        self.assertEqual(item["answer"]["task"]["expression"], expression("324 * 15", 4))
        self.assertEqual({(note["code"], note["path"]) for note in notes}, {
            ("PLACEHOLDER", "rule"), ("SCHOOL_OPERATOR", "q1.item.1.prompt"),
            ("SCHOOL_OPERATOR", "q1.item.1.answer.task.expression"), ("SCHOOL_OPERATOR", "q1.item.2.prompt"),
            ("SCHOOL_OPERATOR", "q1.item.2.answer.task.expression"), ("SCHOOL_OPERATOR", "q1.item.3.prompt"),
            ("SCHOOL_OPERATOR", "q1.item.3.answer.task.expression")})
        # Without the trusted topic the domain-dependent rules stay off; the call still works.
        self.assertEqual(expand_source(payload, 4)["rule"], expanded["rule"])
        flat = {"title": "משולש $ABC$ עד [[100]]", "rule": "[[2³]]", "practice": [{"intro": "[[√49]]", "items": []}],
                "challenges": [{"intro": "[[x²]]", "items": [{"prompt": "חשבו.", "answer": {"unit": "$ס״מ$"}}]}]}
        result = normalize_source(flat, 8)
        self.assertEqual(result["challenges"][0]["intro"], "[[x^2]]")
        self.assertEqual(result["practice"][0]["intro"], "[[sqrt(49)]]")
        # A title and a unit are plain text: delimiters are dropped, nothing becomes an island.
        self.assertEqual(result["title"], "משולש ABC עד 100")
        self.assertEqual(result["challenges"][0]["items"][0]["answer"]["unit"], "ס״מ")
        for doubtful in ["מחיר: 5$", "$\\frac{1}{2}$", "[[angle:ABC]]", 7, None]:
            self.assertEqual(normalize_source({"title": doubtful}, 8)["title"], doubtful)

    def test_typed_sources_and_shipped_fixtures_are_unchanged(self):
        for path in sorted((HERE / "cloud/container/fixtures/general").glob("*/model-output.json")):
            with self.subTest(fixture=path.parent.name):
                source = json.loads(path.read_bytes())
                lesson = json.loads((path.parent / "lesson.json").read_bytes())
                notes = []
                self.assertEqual(normalize_source(copy.deepcopy(source), lesson["gradeNumber"],
                                                  topic=TOPICS[lesson["topicId"]], notes=notes), source)
                self.assertEqual(notes, [])

    def test_no_input_raises_and_no_input_is_mutated(self):
        hostile = [None, 5, "x", [], {}, {"intro": 5, "items": "x"}, {"intro": "[[" * 900, "items": [None]},
                   {"items": [None, {"prompt": 1, "answer": {"task": {"expression": 5, "values": [1, "2³"],
                                                                 "equations": [None, {"lhs": "x²"}]}}}],
                    "table": {"head": "x", "rows": [None, ["[[½]]", 1]]}, "figure": "ABCD"},
                   {"intro": "\\frac{" * 40, "items": [{"prompt": "$" * 300, "answer": {"text": "[[\\sqrt{{{{]]"}}]}]
        for value in hostile:
            for grade in (0, 1, 4, 8, 99, "8", None):
                with self.subTest(value=repr(value)[:40], grade=grade):
                    before = copy.deepcopy(value)
                    result, notes = normalize_question(value, grade, topic_id=5, domain=object())
                    self.assertEqual(value, before)
                    self.assertIsInstance(notes, list)
                    normalize_source(value, grade, topic="x", notes="x")
                    normalize_rich(value, grade)
                    normalize_expression(value, grade)
        self.assertEqual(normalize_rich("א" * 2401 + "[[2³]]", 8)[0], "א" * 2401 + "[[2³]]")

    def test_random_splices_are_idempotent(self):
        chooser = random.Random(20261123)
        alphabet = list("[]$\\{}()_?=<>+-*/:^%°∠△⊥∥√²³½☐□xXyab019 .,;!|·×÷π") + [
            "[[", "]]", "___", "\\frac", "\\sqrt", "angle:", "משולש ", "זווית ", "הנעלם ", "ס״מ", "₪",
            "\u200f", "\u202b", "\u2016", "\u2013", "\u2221", "AB", "ABC"]
        seeds = ["מצאו את [[x]] במשוואה [[2 * x + 3 = 9]].", "משולש $ABC$ ($AB=AC$).", "חשבו: [[324x15]]",
                 "אם \u2221ABC = 50 מעלות, מהו גודל הזווית \u2221ACB?", "השלימו: ____ + [[5]] = [[9]]", ""]
        for _ in range(4000):
            text = list(chooser.choice(seeds))
            for _ in range(chooser.randint(1, 6)):
                text.insert(chooser.randint(0, len(text)), chooser.choice(alphabet))
            text = "".join(text)
            grade = chooser.randint(1, 9)
            domain = chooser.choice([None, "operations", "ratios", "גיאומטרי", "fractions"])
            once, _ = normalize_rich(text, grade, domain=domain)
            self.assertEqual(normalize_rich(once, grade, domain=domain)[0], once, (grade, domain, text))
            task, _ = normalize_expression(text, grade, domain=domain)
            self.assertEqual(normalize_expression(task, grade, domain=domain)[0], task, (grade, domain, text))

    def test_module_source_has_no_invisible_or_confusable_characters(self):
        text = Path(source_normalize.__file__).read_text(encoding="utf-8")
        hidden = sorted({f"U+{ord(char):04X}" for char in text
                         if unicodedata.category(char) in ("Cf", "Zs", "Zl", "Zp", "Cc") and char not in " \n"})
        self.assertEqual(hidden, [])


if __name__ == "__main__":
    unittest.main()
