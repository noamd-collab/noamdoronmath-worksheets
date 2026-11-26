from copy import deepcopy
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import display_parts, expand_source, expression, spans
from general_adapters import _answer_text, _elementary_math, _formula, rich_text
from general_source import GeneralSourceError, rich, validate_question
from math_tasks import MAX_POWER, MathTaskError, number, operation, to_house_math, validate_and_solve_task
from printed_tasks import printed_solve
from runtime_catalog import CURRICULUM_SHA256, catalog, question_floor, scope_for_lesson

PI = {"type": "constant", "name": "pi"}
X = {"type": "symbol", "name": "x"}


def solved(kind, grade=8, **fields):
    names = ("variable", "relation")
    return validate_and_solve_task({"kind": kind, **{
        key: expression(value, grade) if isinstance(value, str) and key not in names else value
        for key, value in fields.items()}})


def code(function, *args, **kwargs):
    try:
        function(*args, **kwargs)
    except (GeneralSourceError, MathTaskError) as error:
        return error.code
    return None


def printed(value, grade=8):
    return rich_text(rich(spans(value, grade), grade, provider=True), grade)


class ExponentTests(unittest.TestCase):
    def test_powers_up_to_the_new_bound_are_exact(self):
        for source, grade, expected in [("2^5", 8, 32), ("10^6", 8, 1_000_000), ("2^5", 6, 32), ("10^6", 4, 1_000_000),
                                        ("10^12", 9, 10 ** 12), ("2^12", 7, 4096), ("(-2)^11", 8, -2048)]:
            with self.subTest(source=source, grade=grade):
                self.assertEqual(solved("evaluate", grade, expression=source)["result"]["value"], number(expected))
        self.assertEqual(solved("evaluate", expression="10^-6")["result"]["value"], number(1, 1_000_000))
        self.assertEqual(solved("simplify", expression="x^5 * x^3")["result"]["value"], operation("power", X, number(8)))
        self.assertEqual(to_house_math(solved("simplify", expression="x^8 / x^6")["result"]["value"]), "x^{2}")
        self.assertEqual(MAX_POWER, 12)

    def test_the_result_size_guards_still_fail_closed_with_a_code(self):
        for source, kind, expected in [
            ("2^13", "evaluate", "UNSUPPORTED_POWER"), ("2^-13", "evaluate", "UNSUPPORTED_POWER"),
            ("x^13", "simplify", "UNSUPPORTED_POWER"), ("2^(1+1)", "evaluate", "UNSUPPORTED_POWER"),
            # The value, not the exponent, is what must fit the printable budget.
            ("11^12", "evaluate", "RESOURCE_LIMIT"), ("999999^12", "evaluate", "RESOURCE_LIMIT"),
            ("(2^12)^12", "evaluate", "RESOURCE_LIMIT"), ("x^9", "simplify", "RESOURCE_LIMIT"),
            ("(x^4)^3", "expand", "RESOURCE_LIMIT"), ("(x+1)^7", "expand", "RESOURCE_LIMIT"),
        ]:
            with self.subTest(source=source):
                self.assertEqual(code(solved, kind, expression=source), expected)
        # Third-grade typography has no power, as before.
        self.assertEqual(code(expression, "2^3", 3), "SOURCE_NOTATION")

    def test_two_digit_exponents_print_in_both_schools(self):
        self.assertEqual(printed("[[2^10]]"), "$2^{10}$")
        self.assertEqual(printed("[[x^5 * x^3]]"), "$x^{5} · x^{3}$")
        # The schoolbook polynomial keeps its written coefficients up to the bound.
        self.assertEqual(printed("[[2x^10 + 3x]]"), "$2x^{10} + 3x$")
        self.assertEqual(printed("[[2x^12 - x^2]]"), "$2x^{12} − x^{2}$")
        self.assertEqual(code(spans, "[[2x^13]]", 8), "UNSUPPORTED_POWER")

        class Signs:
            fmt = staticmethod(lambda value, grade: str(value))
            op = staticmethod(lambda sign, grade: sign)
        self.assertEqual(_elementary_math(expression("2^10", 6), "ו", Signs), "(2)<sup>10</sup>")


class PiTests(unittest.TestCase):
    def test_pi_is_exact_in_grades_seven_to_nine(self):
        for source, key in [("pi*5^2", r"25\pi"), ("2*pi*5", r"10\pi"), ("π*5^2/2", r"\f{25}{2}\pi"),
                            ("2π", r"2\pi"), ("3*pi - pi", r"2\pi"), ("pi^2", r"\pi^{2}"), ("1/pi", r"\f{1}{\pi}"),
                            ("pi + 2", r"2 + \pi"), ("4*pi^2", r"4\pi^{2}"), ("pi*x/pi", "x")]:
            with self.subTest(source=source):
                kind = "simplify" if "x" in source else "evaluate"
                self.assertEqual(to_house_math(solved(kind, expression=source)["result"]["value"]), key)
        self.assertEqual(solved("compare", left="3*pi", right="10")["result"], {"type": "comparison", "relation": "less"})
        self.assertEqual(solved("compare", left="pi", right="frac(22,7)")["result"]["relation"], "less")
        self.assertEqual(solved("compare", left="2*pi", right="pi + pi")["result"]["relation"], "equal")
        self.assertEqual(expression("pi", 7), PI)
        self.assertEqual(expression("π", 9), PI)

    def test_pi_prints_as_the_pinned_skill_macro_and_keeps_the_key_in_terms_of_pi(self):
        self.assertEqual(printed("חשבו [[2*pi*5]] בדיוק."), r"חשבו $2\pi · 5$ בדיוק.")
        self.assertEqual(printed("שטח העיגול הוא [[π*r^2]]."), r"שטח העיגול הוא $\pi · r^{2}$.")
        self.assertEqual(printed("[[2πr]]"), r"$2\pi · r$")
        area = solved("evaluate", expression="pi*5^2")
        self.assertEqual(_answer_text(area, 'סמ"ר', 8), '$25\\pi$ סמ"ר')
        # A product of π alone is a plain math span, so a matching task is not printed twice.
        self.assertEqual(spans("[[pi*5^2]]", 8), [{"kind": "math", "expression": expression("pi*5^2", 8)}])

    def test_pi_fails_closed_where_nothing_exact_is_implemented(self):
        self.assertEqual(code(solved, "solve", lhs="2*pi*x", rhs="10*pi", variable="x"), "UNSUPPORTED_EQUATION")
        self.assertEqual(code(solved, "inequality", lhs="pi*x", rhs="3", variable="x", relation="lt"), "UNSUPPORTED_EQUATION")
        # The pinned emitters cannot draw π under a root.
        self.assertEqual(code(solved, "evaluate", expression="sqrt(pi)"), "UNSUPPORTED_ROOT")
        self.assertEqual(code(solved, "evaluate", expression="pi^9"), "UNSUPPORTED_RESULT")
        self.assertEqual(code(validate_and_solve_task, {"kind": "evaluate", "expression": {"type": "constant", "name": "e"}}),
                         "INVALID_AST")
        self.assertEqual(code(validate_and_solve_task, {"kind": "substitute", "expression": X, "values": {"x": PI}}),
                         "INVALID_TASK")
        self.assertEqual(code(validate_and_solve_task, {"kind": "statistics", "operation": "mean", "values": [PI]}),
                         "INVALID_TASK")
        # Elementary school has no approved typography for it: rejected at the source, never at render.
        for grade in (1, 4, 6):
            self.assertEqual(code(expression, "pi", grade), "SOURCE_NOTATION")
            self.assertEqual(code(spans, "[[2*π]]", grade), "SOURCE_NOTATION")
        self.assertEqual(code(_elementary_math, PI, "ו", None), "ELEMENTARY_SYMBOL")
        self.assertEqual(code(spans, "[[2pir]]", 8), "SOURCE_NOTATION")


class ImplicitProductTests(unittest.TestCase):
    def test_schoolbook_juxtaposition_is_the_explicit_product(self):
        for written, explicit in [
            ("3(x+2)", "3*(x+2)"), ("(x+2)(x-3)", "(x+2)*(x-3)"), ("2ab", "2*a*b"), ("2x(x+1)", "2*x*(x+1)"),
            ("-2(x+1)", "-2*(x+1)"), ("x(x+1)", "x*(x+1)"), ("(a+b)(a-b)", "(a+b)*(a-b)"), ("2(x+1)(x-1)", "2*(x+1)*(x-1)"),
            ("3(x+2)^2", "3*(x+2)^2"), ("x^2(x+1)", "x^2*(x+1)"), ("(x+1)^2(x-1)", "(x+1)^2*(x-1)"),
            ("2sqrt(3)", "2*sqrt(3)"), ("2π", "2*pi"), ("frac(1,2)x", "frac(1,2)*x"), ("3xy", "3*x*y"), ("2 (3)", "2*3"),
        ]:
            with self.subTest(written=written):
                self.assertEqual(expression(written, 8), expression(explicit, 8))
        self.assertEqual(solved("expand", expression="(x+2)(x-3)")["result"]["value"],
                         solved("expand", expression="x^2 - x - 6")["result"]["value"])
        self.assertEqual(solved("solve", lhs="3(x+2)", rhs="12", variable="x")["result"]["values"], [number(2)])

    def test_a_second_reading_is_rejected_not_guessed(self):
        for doubtful in ["1/2(x+1)", "(x+1)/(x-1)(x+2)", "x^(2)(x+1)", "xx", "2 3", "(x+1)2", "x2",
                         "3frac(1,2)", "a(2,3)", "2x3", "x y", "2 x", "a b + 1", "(x+1) y", "2 pi", "x 2"]:
            with self.subTest(doubtful=doubtful):
                self.assertEqual(code(expression, doubtful, 8), "SOURCE_NOTATION")
        # The written coefficient keeps the reading it already had: 1/2x is one half of x.
        self.assertEqual(expression("1/2x", 8), expression("(1/2)*x", 8))
        # Not in elementary school, where a letter is never a variable.
        for doubtful, grade in [("2(3+4)", 4), ("3(2)", 6), ("2ab", 5)]:
            self.assertEqual(code(expression, doubtful, grade), "SOURCE_NOTATION")
        # Two diagram labels side by side are not a product.
        self.assertEqual(code(spans, "[[AB CD]]", 8), "SOURCE_NOTATION")
        self.assertEqual(code(expression, "x y", 8, implicit=False), "SOURCE_NOTATION")

    def test_the_pupil_sees_the_formula_as_written(self):
        for written, shown in [("[[3(x+2)]]", "$3(x+2)$"), ("[[(x+2)(x-3)]]", "$(x+2)(x−3)$"), ("[[2ab]]", "$2ab$"),
                               ("[[3(x+2) = 12]]", "$3(x+2) = 12$"), ("[[2x(x+1)]]", "$2x(x+1)$"),
                               ("[[2sqrt(3)]]", r"$2\sqrt{3}$"), ("[[2AB = 10]]", "$2 · AB = 10$")]:
            with self.subTest(written=written):
                self.assertEqual(printed(written), shown)
        # The printed equation still binds to its typed task, and a different task is still refused.
        prompt = spans("פתרו את המשוואה [[3(x+2) = 12]].", 8)
        task = {"kind": "solve", "lhs": "3*(x+2)", "rhs": "12", "variable": "x"}
        self.assertIsNone(printed_solve(prompt, dict(task), 8))
        self.assertEqual(code(printed_solve, prompt, {**task, "rhs": "13"}, 8), "PRINTED_TASK_MISMATCH")


class ElementaryLiteralTests(unittest.TestCase):
    def test_a_measured_angle_is_one_island_from_grade_five(self):
        for grade in (5, 6):
            self.assertEqual(display_parts("90°", grade), ["90°"])
            self.assertEqual(spans("זווית של [[90°]]", grade)[1], {"kind": "formula", "notation": "90°"})
        self.assertEqual(display_parts("45 °", 6), ["45°"])

        class Signs:
            ltr = staticmethod(lambda text: "<ltr>" + text + "</ltr>")
        self.assertEqual(_formula("90°", "ה", Signs), "<ltr>90°</ltr>")
        # The pinned elementary gate G59 allows the sign from grade five only.
        for grade in (1, 4):
            self.assertEqual(code(spans, "[[90°]]", grade), "SOURCE_NOTATION")
        self.assertEqual(code(spans, "[[∠ABC = 90°]]", 6), "SOURCE_NOTATION")
        self.assertEqual(code(spans, "[[90°°]]", 6), "SOURCE_NOTATION")

    def test_a_percentage_is_an_operand_of_the_school_signs(self):
        self.assertEqual(spans("[[25% x 80]]", 6), [{"kind": "formula", "notation": "25% * 80"}])
        self.assertEqual(expression("25% x 80", 6), expression("25% * 80", 6))
        self.assertEqual(solved("evaluate", 6, expression="25% x 80")["result"]["value"], number(20))
        self.assertEqual(code(spans, "[[25%x80]]", 6), "SOURCE_NOTATION")


# The model's reply is never rewritten: each spelling below is judged exactly as written.
# These engine checks used to live beside the removed normaliser (tests/test_source_normalize.py).

TOPICS = {topic["topicId"]: topic for topic in catalog().topics}


def accepted(value, grade, fractions=False):
    """The engine's own verdict on one rich wire string: its spans, or the refusal code."""
    try:
        return rich(spans(value, grade, fraction_notation=fractions), grade, provider=True)
    except (GeneralSourceError, MathTaskError) as error:
        return error.code


def scope(topic_id):
    topic = TOPICS[topic_id]
    return scope_for_lesson({
        "version": 3, "gradeNumber": topic["gradeNumber"], "topicId": topic_id, "level": topic["levels"][0],
        "lessonGoal": "practice", "questionCount": question_floor(topic["gradeNumber"]), "minutes": 40,
        "lastLesson": "למדנו את המושג הראשון בנושא ותרגלנו בכיתה", "alreadyLearned": [],
        "explicitShortSheet": False,
        "lessonBoundary": {"version": 1, "kind": "curriculum_scope", "curriculumSha256": CURRICULUM_SHA256,
                           "conceptIds": [topic["concepts"][0]["id"]]}})


def compiled_code(question, topic_id):
    """The refusal code of one wire question expanded and validated as written, or None."""
    bounds = scope(topic_id)
    grade = bounds["topic"]["gradeNumber"]
    try:
        expanded = expand_source({"version": 4, "sections": [{"questions": [{**deepcopy(question), "star": False}]}]},
                                 grade, fraction_notation=bounds["topic"]["domain"] == "fractions")
        validate_question(expanded["sections"][0]["questions"][0], grade, bounds, provider=True, qcount=1,
                          evidence=[], pending=[])
    except (GeneralSourceError, MathTaskError) as error:
        return error.code
    return None


def evaluate(expression_text, unit=""):
    return {"kind": "computed", "task": {"kind": "evaluate", "expression": expression_text}, "unit": unit}


class WrittenAsSentTests(unittest.TestCase):
    def test_contract_spellings_are_accepted_as_written(self):
        for grade, value in [
            (4, "[[324 x 15]]"), (4, "[[1,845 : 15]]"), (6, "[[25% x 80]]"), (4, "[[3 x 4]]"), (4, "חשבו: [[48 : 6 = ___]]"),
            (4, "[[12 : 4]]"), (8, "[[sqrt(49)]]"), (8, "[[sqrt(x+1)]]"), (9, "חשבו [[2sqrt(3)]]"), (8, "[[2^3]]"),
            (8, "[[x^2]]"), (8, "[[10^(-2)]]"), (4, "[[frac(1,2)]]"), (4, "חצי הוא [[frac(1,2)]] מהשלם"),
            (8, "[[5 - 10 + 2]]"), (8, "[[2*3]]"), (4, "[[6+3]]"), (8, "[[0.5]]"), (6, "[[25%]]"), (6, "[[25%]] מהכיתה"),
            (6, "25% מהכיתה"), (8, "[[90°]]"), (4, "[[5 + ___ = 9]]"), (4, "[[5 + 3 = ___]]"),
            (4, "השלימו: ___ + [[5]] = [[9]]"), (4, "[[5 + 3 = 8]]?"), (7, "[[x = 5]]."), (4, "[[12.50]] ₪"),
            (3, "[[5]] ס״מ"), (3, '[[5]] ס"מ'), (4, "[[5 + 3 = ___]] שקלים"),
            (8, "[[segment:AD]] הוא תיכון לצלע [[segment:BC]]."), (5, "[[90°]]"), (4, "[[5 + 3]]"),
            (4, "מצב ב': [[4 + (2 * 3)]]. מה ההפרש"), (4, "בחישוב [[((___) + 4) * 3 = 21]], מהו המספר החסר?"),
            (8, "[[frac(1,2)]]"), (8, "[[2 * 3]]"), (8, "[[sqrt(16)]]"), (8, "חשבו [[x+1]] עכשיו"), (8, "ולכן [[AM ⊥ BC]]."),
            (8, "הקודקודים [[A(0, 4)]], [[B(-3, 0)]] ו־[[C(3, 0)]]."), (8, "חשבו את x"), (8, "מהו גודל הזווית [[∠ACB]]?"),
            (8, "נתון [[△ABC]]."), (8, "ידוע כי [[AB ∥ CD]]."), (8, "אם [[∠ABC = 50°]] ו-[[∠BAC = 60°]]"),
            (8, "הזוויות [[40°]], [[60°]] ו-[[80°]]"), (8, "המספרים [[2]], [[4]], [[6]] הם זוגיים"),
            (8, "לא ייתכן, כי [[4+6 < 9]]."), (9, "היקף הריבוע גדול יותר כי [[4a > 2a+2b]]."),
            (9, "מכיוון ש-[[b<a]], השטח גדול יותר."), (8, "[[3 < x < 17]]."), (8, "[[∠ABC]] = [[50°]]"),
        ]:
            with self.subTest(value=value, grade=grade):
                self.assertIsInstance(accepted(value, grade), list, accepted(value, grade))
        for value in ("נתון כי [[∠DAB = 70°]].", "נתון כי [[∠BCD = 120°]]. חשבו", "אם [[∠DAB = 70°]].",
                      "נתון כי [[∠AOB = 90°]].", "נתון כי [[∠BAC = 35°]].", "נתון כי [[∠D = 70°]].",
                      "שתי זוויות הבסיס העליון, [[∠A + ∠B]].", "נתון כי [[∠A = 100°]] ו־[[∠D = 80°]].",
                      "נתון כי [[∠D = 65°]].", "נתון כי [[∠A = 3*x]] ו־[[∠D = 2*x]].",
                      "טרפז ישר־זווית שבו [[∠A = ∠D = 90°]].", "[[∠ABC]] = [[50°]]"):
            with self.subTest(value=value):
                self.assertIsInstance(accepted(value, 9), list, accepted(value, 9))
        for grade, task in [(4, "324 x 15"), (4, "48 : 6 + 2"), (4, "48 : 6"), (4, "12 : 4"), (8, "sqrt(49)"), (8, "2^3"),
                            (8, "frac(3,4)+frac(1,2)"), (8, "2*x+3"), (8, "5^2"), (8, "5 - 3 + 1"), (6, "25%*80")]:
            with self.subTest(task=task):
                self.assertIsNone(code(expression, task, grade))

    def test_typed_labels_print_with_their_names(self):
        for written, shown in [
            ("במשולש [[triangle:ABC]], הגובה [[segment:AD]] מאונך לצלע [[segment:BC]].",
             r"במשולש $\tri ABC$, הגובה $AD$ מאונך לצלע $BC$."),
            ("משולש שווה שוקיים [[triangle:ABC]] (AB=AC).", r"משולש שווה שוקיים $\tri ABC$ ($AB = AC$)."),
            ("הוכיחו כי המשולשים [[triangle:ABD]] ו-[[triangle:ACD]] חופפים.",
             r"הוכיחו כי המשולשים $\tri ABD$ ו-$\tri ACD$ חופפים."),
            ("מהו גודל הזווית [[angle:ABC]]?", r"מהו גודל הזווית $\angle{ABC}$?"),
            ("הנקודה [[point:M]] היא אמצע השוק [[segment:AB]].", "הנקודה $M$ היא אמצע השוק $AB$."),
            ("מרובע [[polygon:ABCD]] הוא ריבוע.", "מרובע $ABCD$ הוא ריבוע."),
            ("[[segment:AE]] הוא חוצה הזווית [[∠BAC]].", r"$AE$ הוא חוצה הזווית $\angle{BAC}$."),
            ("משולש [[triangle:ABC]]. הנקודה [[point:M]] היא אמצע הצלע [[segment:BC]]. נתון: [[BM=6]] ס\"מ.",
             "משולש $\\tri ABC$. הנקודה $M$ היא אמצע הצלע $BC$. נתון: $BM = 6$ ס\"מ."),
        ]:
            with self.subTest(written=written):
                self.assertEqual(rich_text(accepted(written, 8), 8), shown)
        self.assertEqual(rich_text(accepted("נתון כי [[∠ADC = 70°]]. חשבו את [[∠BAD + ∠ABC]].", 9), 9),
                         r"נתון כי $\angle{ADC} = 70°$. חשבו את $\angle{BAD} + \angle{ABC}$.")
        self.assertEqual(rich_text(accepted("[[∠BAD = 3*x]]", 9), 9), r"$\angle{BAD} = 3x$")

    def test_subscripted_names_print_with_their_subscript(self):
        for before, printed_text in (("[[d1 = 14]]", r"$d_{1} = 14$"), ("[[d1 = 3*x]]", r"$d_{1} = 3x$"),
                                     ("[[(d1 * d2) / 2]]", r"$\f{d_{1} · d_{2}}{2}$")):
            with self.subTest(before=before):
                self.assertEqual(rich_text(accepted(before, 9), 9), printed_text)
        # x2 next to a bare x could be a product: not a name.
        self.assertEqual(accepted("[[x2 + x = 5]]", 9), "SOURCE_NOTATION")

    def test_a_letter_with_a_percent_sign_is_one_operand(self):
        for value in ("[[p%]] מתוך", "המהוות [[x%]] מסך הנקודות"):
            with self.subTest(value=value):
                self.assertNotIsInstance(accepted(value, 8), str)
        self.assertEqual(rich_text(accepted("[[p%]] מתוך", 8), 8), "$p%$ מתוך")

    def test_a_fraction_topic_reads_the_school_colon_as_division(self):
        self.assertEqual(accepted("[[12 : 4]]", 4, fractions=True), [{"kind": "formula", "notation": "12 / 4"}])

    def test_spellings_with_two_readings_are_refused(self):
        for grade, value in [(8, "[[3,5]]"), (8, "[[5\u201310]]"), (4, "[[2½]]"), (4, "[[3_8]]"), (4, "[[3x = 12]]"),
                             (8, "[[√25x]]"), (4, "[[5 + ... = 9]]"), (4, "[[1 000]]")]:
            with self.subTest(value=value):
                self.assertEqual(accepted(value, grade), "SOURCE_NOTATION")

    def test_recorded_replies_are_refused_as_written(self):
        # A recorded grade-four reply: every field of the question named the unknown x.
        question = {
            "intro": "השלימו את המספר החסר כדי שהמשוואה תהיה נכונה.",
            "table": {"head": ["משוואה", "ערך x"],
                      "rows": [["[[2 * x + 3 = 9]]", "___"], ["[[10 - x * 2 = 4]]", "___"], ["[[x / 3 + 2 = 5]]", "___"]]},
            "items": [
                {"prompt": "מצאו את [[x]] במשוואה [[2 * x + 3 = 9]].", "answer": evaluate("(9 - 3) / 2")},
                {"prompt": "מצאו את [[x]] במשוואה [[10 - x * 2 = 4]].", "answer": evaluate("(10 - 4) / 2")},
                {"prompt": "מצאו את [[x]] במשוואה [[x / 3 + 2 = 5]].", "answer": evaluate("(5 - 2) * 3")},
            ]}
        original = deepcopy(question)
        with self.assertRaises(GeneralSourceError) as rejected:
            validate_question({**deepcopy(question), "star": False, "intro": spans(question["intro"], 4),
                               "table": {"head": [spans(c, 4) for c in question["table"]["head"]],
                                         "rows": [[spans(c, 4) for c in row] for row in question["table"]["rows"]]}},
                              4, scope("ד07"), provider=True, qcount=1, evidence=[], pending=[])
        self.assertEqual(rejected.exception.code, "SOURCE_NOTATION")
        self.assertEqual(compiled_code(question, "ד07"), "SOURCE_NOTATION")
        self.assertEqual(question, original)
        # A recorded geometry reply written with $...$ math.
        geometry = {
            "intro": "בסרטוט שלפניכם משולש שווה־שוקיים $ABC$ ($AB=AC$). התיכון $AD$ לבסיס $BC$ הוא גם גובה. נתון: $\\angle{ABC}=70°$.",
            "items": [
                {"prompt": "מהו גודל הזווית $\\angle{ACB}$?", "answer": evaluate("70", "מעלות")},
                {"prompt": "מהו גודל זווית הראש $\\angle{BAC}$?", "answer": evaluate("180-70-70", "מעלות")},
                {"prompt": "מהו גודל הזווית $\\angle{BAD}$?", "answer": evaluate("(180-70-70)/2", "מעלות")},
            ]}
        self.assertEqual(compiled_code(geometry, "g8:triangle_parts"), "SOURCE_TEXT")
        # Recorded bracket typos and an unspaced school operator.
        typos = {"intro": "השוו בין שני מצבים המשלבים סוגריים ופעולות מעורבות.", "items": [
            {"prompt": "מצב א': [[(4 + 2) * 3]]. מצב ב': [[4 + (2 * 3)]. מה ההפרש בין התוצאות?",
             "answer": evaluate("(4 + 2) * 3 - (4 + 2 * 3)")},
            {"prompt": "בחישוב [[(___) + 4] * 3 = 21]], מהו המספר החסר?", "answer": evaluate("21 / 3 - 4")},
            {"prompt": "חשבו: [[324x15]]", "answer": evaluate("324x15")},
        ]}
        self.assertEqual(compiled_code(typos, "ד07"), "SOURCE_NOTATION")
        # A one-letter angle is refused even beside a figure that would name it (the pinned gate G81).
        square = {"kind": "shape", "shape": "square", "parameters": {"a": 5}, "names": "ABCD", "rotate": 0}
        one_letter = {"intro": "התבוננו בריבוע [[polygon:ABCD]] המצויר בתמונה.", "figure": square,
                      "items": [{"prompt": "מהי הזווית [[angle:A]]?", "answer": evaluate("90", "מעלות")}] * 3}
        self.assertEqual(compiled_code(one_letter, "g9m:square"), "SOURCE_NOTATION")
        self.assertEqual(accepted("מהי הזווית [[angle:A]]?", 9), "SOURCE_NOTATION")


if __name__ == "__main__":
    unittest.main()
