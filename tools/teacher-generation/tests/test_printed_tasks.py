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

    def test_a_yes_no_or_true_false_question_takes_only_a_decision(self):
        from printed_tasks import validate_computed_request
        compare = validate_and_solve_task({"kind": "compare", "left": expression("345", 3), "right": expression("354", 3)})
        decision = validate_and_solve_task({"kind": "decide", "relation": "lt", "left": expression("345", 3),
                                            "right": expression("354", 3)})
        scalar = validate_and_solve_task({"kind": "evaluate", "expression": expression("32 / 4", 3)})
        # A comparison sign printed as the key of a yes/no or true/false question is not its answer.
        for prompt, solved in (("האם [[345 < 354]]?", compare), ("האם [[32 : 4 = 8]] נכון?", compare),
                               ("נכון או לא נכון: [[32 : 4 = 9]]", compare), ("נכון או לא נכון: [[32 : 4 = 8]]", scalar)):
            with self.subTest(prompt=prompt), self.assertRaisesRegex(GeneralSourceError, "at q1.item.2") as refused:
                validate_computed_request({}, {"prompt": spans(prompt, 3)}, solved, 3, "q1.item.2")
            self.assertEqual(refused.exception.code, "PRINTED_ANSWER_KIND")
        # Only a decision answers it; a question that offers its outcomes is a comparison.
        validate_computed_request({}, {"prompt": spans("האם [[345 < 354]]?", 3)}, decision, 3, "q1.item.2")
        validate_computed_request({}, {"prompt": spans("האם [[345]] קטן או גדול מ־[[354]]?", 3)}, compare, 3, "q1.item.2")
        validate_computed_request({}, {"prompt": spans("[[345]] ___ [[354]]", 3)}, compare, 3, "q1.item.2")

    def test_a_number_is_not_a_ratio_a_time_of_day_or_who_or_which(self):
        from printed_tasks import validate_computed_request
        def solved(text, grade):
            return validate_and_solve_task({"kind": "evaluate", "expression": expression(text, grade)})
        # A clock time in digits is mathematics outside an island in grades 1-6, refused for its notation before
        # the request is read; the readers below get the time in words.
        for prompt in ("השעה עכשיו 7:30. מה תהיה השעה בעוד [[45]] דקות?", "השעה עכשיו 7:30. כמה דקות נשארו עד 8:00?",
                       "השעה עכשיו [[7]]:[[30]]. בעוד [[45]] דקות השעה תהיה ___."):
            with self.subTest(prompt=prompt), self.assertRaises(GeneralSourceError) as refused:
                spans(prompt, 3)
            self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        for intro, prompt, task, grade in (
                ("כתבו את היחס.", "בכיתה [[12]] בנים ו־[[18]] בנות. מהו היחס בין הבנים לבנות?", "12/18", 6),
                ("צמצמו את היחס.", "[[12 : 18]]", "12/18", 6),                        # no words: the intro asks
                ("ענו.", "השעה עכשיו שבע וחצי. מה תהיה השעה בעוד [[45]] דקות?", "8", 3),
                ("פתרו את הבעיה.", "לדני היו [[124]] גולות ולרון [[98]]. למי יש יותר גולות, ובכמה?", "124 - 98", 3),
                # The question is its intro and its item together: an intro that asks for a ratio is not
                # answered by the count that the item's words ask for.
                ("צמצמו את היחס.", "כמה בנים יש בכיתה של [[30]] תלמידים?", "12", 6)):
            with self.subTest(prompt=prompt), self.assertRaises(GeneralSourceError) as refused:
                validate_computed_request({"intro": spans(intro, grade)}, {"prompt": spans(prompt, grade)},
                                          solved(task, grade), grade, "q1.item.1")
            self.assertEqual(refused.exception.code, "PRINTED_ANSWER_KIND")
        # A number that the words ask for is a key: the missing term of a printed proportion, a ratio
        # stated as data, a count.
        for intro, prompt, task, grade in (
                ("השלימו יחס שקול.", "[[2 : 3 = ___ : 12]]", "2*12/3", 6),
                ("חשבו.", "היחס בין הבנים לבנות הוא [[2]] ל־[[3]]. בכיתה [[30]] תלמידים. כמה בנים בכיתה?", "30*2/5", 6),
                ("ענו.", "השעה עכשיו שבע וחצי. כמה דקות נשארו עד שמונה?", "30", 3),
                ("ענו.", "איזה מספר גדול יותר: [[345]] או [[354]]?", "354", 3),
                ("פתרו את הבעיה.", "לדני היו [[124]] גולות ולרון [[98]]. כמה גולות יש לשניהם?", "124 + 98", 3)):
            with self.subTest(prompt=prompt):
                validate_computed_request({"intro": spans(intro, grade)}, {"prompt": spans(prompt, grade)},
                                          solved(task, grade), grade, "q1.item.1")


    def test_a_request_is_read_from_its_form_whatever_the_verb(self):
        from printed_tasks import validate_computed_request
        def solved(task, grade):
            return validate_and_solve_task({key: expression(value, grade) if key in ("expression", "left", "right") else value
                                            for key, value in task.items()})
        number = lambda text: {"kind": "evaluate", "expression": text}
        sign = lambda left, right: {"kind": "compare", "left": left, "right": right}

        def check(intro, prompt, task, grade):
            validate_computed_request({"intro": spans(intro, grade)}, {"prompt": spans(prompt, grade)},
                                      solved(task, grade), grade, "q1.item.1")

        # Rewordings of the refused probe forms, in the intro or in the item, with any verb.
        for intro, prompt, task, grade in (
                ("האם הטענה נכונה?", "[[345 < 354]]", sign("345", "354"), 3),
                ("בדקו.", "האם [[345 < 354]] או לא?", sign("345", "354"), 3),
                ("ענו.", "בדקו אם [[32 : 4 = 8]].", sign("32 / 4", "8"), 3),
                ("ענו.", "[[32 : 4 = 8]], נכון?", sign("32 / 4", "8"), 3),
                ("קבעו נכון או לא נכון.", "[[32 : 4 = 9]]", sign("32 / 4", "9"), 3),
                ("ענו.", "בדקו אם השברים שווים.", number("1/2"), 4),
                ("השלימו את הסימן.", "[[345]] ___ [[354]]", number("354"), 3),
                ("ענו.", "סדרו את המספרים [[354]], [[345]], [[435]] מהקטן לגדול.", number("345"), 3),
                ("ענו.", "בכיתה [[12]] בנים ו־[[18]] בנות. היחס בין מספר הבנים למספר הבנות הוא ___.", number("12/18"), 6),
                ("ענו.", "בכיתה [[12]] בנים ו־[[18]] בנות. איזה יחס יש בין הבנים לבנות?", number("12/18"), 6),
                ("כתבו כיחס מצומצם.", "[[12 : 18]]", number("12/18"), 6),
                ("ענו.", "השעה עכשיו שבע וחצי. בעוד [[45]] דקות יצלצל הפעמון. מתי יצלצל הפעמון?", number("8"), 3),
                ("ענו.", "השעה עכשיו שבע וחצי. בעוד [[45]] דקות השעה תהיה ___.", number("8"), 3),
                ("כתבו את השעה.", "המחוג הקטן על [[7]] והגדול על [[12]].", number("7"), 3),
                ("ענו.", "לדני [[124]] גולות ולרון [[98]]. לאיזה ילד יש יותר גולות, ובכמה?", number("124 - 98"), 3),
                ("ענו.", "לדני [[124]] גולות ולרון [[98]]. כתבו מי מהם קיבל יותר גולות, ובכמה.", number("124 - 98"), 3)):
            with self.subTest(intro=intro, prompt=prompt), self.assertRaises(GeneralSourceError) as refused:
                check(intro, prompt, task, grade)
            self.assertEqual(refused.exception.code, "PRINTED_ANSWER_KIND")
        # The same words where they ask for the kind that is keyed, or ask for nothing.
        for intro, prompt, task, grade in (
                ("כתבו סימן השוואה מתאים.", "בדקו אם השברים שווים.", sign("1/2", "2/4"), 4),
                ("כתבו סימן השוואה מתאים.", "בדקו את היחס בין שני השברים.", sign("1/2", "2/4"), 4),
                ("השתמשו ביחס הנתון לכל מאה פריטים.", "במאגר [[200]] בקבוקים. כמה מהם מיועדים לתצוגה?", number("200*30/100"), 6),
                ("ענו.", "איזה אחוז מהתלמידים לומדים נגינה?", number("30"), 6),
                ("שימו לב מתי יש לחשב תחילה את הביטוי שבסוגריים.", "[[(10 + 2) x 3]]", number("(10 + 2) * 3"), 4),
                ("קראו אילו פריטים מבקשים לספור, וחברו.", "בסל [[44]] צדפים ו־[[3]] גולות. כמה צדפים בסל ובמגירה?",
                 number("44 + 25"), 4),
                ("נכון או לא נכון?", "[[45 : 9 = ___]]", number("45/9"), 3)):
            with self.subTest(intro=intro, prompt=prompt):
                check(intro, prompt, task, grade)


class PrintedInequalityTests(unittest.TestCase):
    def solved(self, lhs, rhs, relation):
        return validate_and_solve_task({"kind": "inequality", "variable": "x", "lhs": expression(lhs, 8),
                                        "rhs": expression(rhs, 8), "relation": relation})

    def test_a_typed_inequality_is_the_printed_one(self):
        from printed_tasks import printed_inequality
        item = lambda prompt: {"prompt": spans(prompt, 8)}
        self.assertEqual(printed_inequality(item("[[2x - 1 > 5]]"), self.solved("2x - 1", "5", "gt"), 8).proof["rule"],
                         "printed_inequality")
        # The same solution set written the other way round, or in another letter, is the printed inequality.
        self.assertTrue(printed_inequality(item("[[5 < 2x - 1]]"), self.solved("2x - 1", "5", "gt"), 8))
        self.assertTrue(printed_inequality(item("פתרו: [[2t - 1 ≥ 5]]"), self.solved("2x - 1", "5", "ge"), 8))
        # A chain is two inequalities; one typed inequality solves only one of them.
        for prompt, typed in (("[[-3 < 2x + 1 <= 7]]", ("2x + 1", "7", "le")), ("[[-3 < 2x + 1 <= 7]]", ("-3", "2x + 1", "lt")),
                              ("[[2x - 1 > 5]]", ("2x + 1", "5", "gt")), ("[[2x - 1 > 5]]", ("2x - 1", "5", "ge")),
                              ("[[2x - 1 > 5]] וגם [[x < 9]]", ("2x - 1", "5", "gt"))):
            with self.subTest(prompt=prompt, typed=typed), self.assertRaises(GeneralSourceError) as refused:
                printed_inequality(item(prompt), self.solved(*typed), 8)
            self.assertEqual(refused.exception.code, "PRINTED_TASK_MISMATCH")
        # A word problem prints no inequality; another task kind is not bound here.
        self.assertIsNone(printed_inequality(item("מספר גדול מ־[[5]]. מהו התחום?"), self.solved("x", "5", "gt"), 8))
        self.assertIsNone(printed_inequality(item("[[2x - 1 > 5]]"), validate_and_solve_task(
            {"kind": "evaluate", "expression": expression("4", 8)}), 8))
