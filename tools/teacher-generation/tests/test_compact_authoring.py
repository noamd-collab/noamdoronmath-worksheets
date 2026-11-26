import copy
import json
import os
import tempfile
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from compact_authoring import expression, expand_source, expand_task, spans
from general_source import GeneralSourceError, validate_source
from math_tasks import validate_and_solve_task
from runtime_catalog import scope_for_lesson


class CompactAuthoringTests(unittest.TestCase):
    def result(self, source, grade=8):
        task = {"kind": "evaluate", "expression": expression(source, grade)}
        return validate_and_solve_task(task)["result"]["value"]

    def test_arithmetic_is_exact_and_has_normal_precedence(self):
        for source, n, d in [
            ("8 - 3 - 2", 3, 1),
            ("6/2*3", 9, 1),
            ("3*(2+4)", 18, 1),
            ("-2^2", -4, 1),
            ("(-2)^2", 4, 1),
            ("2^-2", 1, 4),
            ("frac(-3,4)+0.25", -1, 2),
            ("sqrt(25)", 5, 1),
        ]:
            with self.subTest(source=source):
                self.assertEqual(
                    self.result(source),
                    {"type": "number", "numerator": n, "denominator": d},
                )

    def test_invalid_or_out_of_grade_expressions_fail_closed(self):
        for source, grade in [
            ("frac(3,0)", 8),
            ("x.y", 8),
            ("sqrt(9)", 3),
            ("x", 1),
            ("2*3", 1),
            ("2^3", 3),
            ("3xx", 8),
            ("1 2", 8),
            ("1//2", 8),
            ("2+?", 8),
            ("3+4)", 8),
            ("sqrt()", 8),
            ("9" * 500, 8),
            ("", 8),
        ]:
            with (
                self.subTest(source=source, grade=grade),
                self.assertRaises(GeneralSourceError),
            ):
                expression(source, grade)
        for value in ["מלה [[3", "מלה [[[]]", "מלה ]]", "[[point:ABCD_E]]"]:
            with self.assertRaises(GeneralSourceError):
                spans(value, 8)

    def test_display_formulas_do_not_change_computed_tasks(self):
        from general_adapters import _formula, _prints_calculation

        self.assertEqual(
            _formula("a^2 + b^2 = c^2", 8, None), "$a^{2} + b^{2} = c^{2}$"
        )
        self.assertEqual(_formula("AD=8", 8, None), "$AD = 8$")
        for symbol, macro in [("!=", r"\neq"), ("<=", r"\leq"), (">=", r"\geq")]:
            with self.subTest(symbol=symbol):
                self.assertEqual(_formula("5 " + symbol + " 7", 8, None), "$5 " + macro + " 7$")
        self.assertEqual(
            spans("[[1/2+___=5/6]]", 5, fraction_notation=True),
            [{"kind": "formula", "notation": "frac(1,2)+___=frac(5,6)"}],
        )
        self.assertEqual(
            spans("[[2/4]]", 5, fraction_notation=True)[0]["expression"]["denominator"],
            4,
        )
        real = {"prompt": spans("חשבו [[frac(1,3)+frac(1,7)]]", 5)}
        solved = {
            "question": {
                "kind": "evaluate",
                "expression": expression("frac(1,3)+frac(1,7)", 5),
            }
        }
        self.assertTrue(_prints_calculation(real, solved))
        self.assertFalse(
            _prints_calculation({"prompt": spans("חשבו [[frac(1,3)]]", 5)}, solved)
        )
        for invalid in ("x+1=3", "<script>", "1 < < 2", "func(2)"):
            with self.assertRaises(GeneralSourceError):
                spans("[[" + invalid + "]]", 5)

    def test_common_divisors_and_multiples_match_the_printed_positive_pair(self):
        for source, kind, expected in [
            ("gcd(21,14)", "gcd", 7),
            ("lcm(6,8)", "lcm", 24),
        ]:
            task = {"kind": "evaluate", "expression": source}
            expand_task(task, 5, True)
            self.assertEqual(task["kind"], kind)
            self.assertEqual(
                validate_and_solve_task(task)["result"]["value"]["numerator"], expected
            )
        for source, grade in [
            ("lcm(18,0)", 5),
            ("gcd(1,2)", 3),
            ("lcm(9999999,2)", 5),
            ("gcd(1.5,8)", 5),
            ("2+lcm(3,4)", 5),
        ]:
            with self.subTest(source=source), self.assertRaises(GeneralSourceError):
                expand_task({"kind": "evaluate", "expression": source}, grade, False)

    def test_adjacent_islands_keep_math_together_and_separate_adjacent_quantities(self):
        atoms = spans("חשבו [[1/3]] + [[1/6]].", 5, fraction_notation=True)
        self.assertEqual(len(atoms), 3)
        self.assertEqual(atoms[1]["expression"], expression("frac(1,3)+frac(1,6)", 5))
        separate = spans("[[3]] וגם [[5]]", 5)
        self.assertEqual([item["kind"] for item in separate], ["math", "text", "math"])
        coordinate = spans("הנקודה [[A(-2,4)]]", 8)
        self.assertEqual(coordinate[-1], {"kind": "formula", "notation": "A(-2,4)"})
        for invalid in ["B(1234567,9)", "AB(2,3)", "A(1,x)", "AB="]:
            with self.subTest(invalid=invalid), self.assertRaises(GeneralSourceError):
                spans("[[" + invalid + "]]", 8)

    def test_prose_comparison_signs_are_isolated_and_markup_is_rejected(self):
        from general_source import rich

        result = rich(spans("בחרו סימן (<, > או =).", 5), 5)
        self.assertEqual(
            [part["notation"] for part in result if part["kind"] == "formula"],
            ["<", ">", "="],
        )
        with self.assertRaises(GeneralSourceError):
            rich(spans("מלאו <br> כאן", 5), 5)

    def test_prompt_cannot_reference_a_missing_table(self):
        q = {"intro": "השלימו את הטבלה הבאה."}
        source = {"version": 4, "sections": [{"questions": [q]}]}
        with self.assertRaisesRegex(GeneralSourceError, "table"):
            expand_source(source, 5)
        q["table"] = {"head": ["סכום", "כמות"], "rows": [["[[1/2]]", "___"]]}
        self.assertEqual(
            len(
                expand_source(source, 5)["sections"][0]["questions"][0]["table"]["rows"]
            ),
            1,
        )

    def test_drawing_instruction_in_prose_cannot_escape_the_topic_policy(self):
        fixture = (
            Path(__file__).resolve().parents[1]
            / "cloud/container/fixtures/general/grade4-fractions"
        )
        lesson = json.loads((fixture / "lesson.json").read_text())
        payload = json.loads((fixture / "model-output.json").read_text())
        for prompt in ("ציירו ריבוע.", "שַׂרְטְטוּ ריבוע.", "התבוננו בשרטוט."):
            payload["sections"][0]["questions"][0]["intro"] = [
                {"kind": "text", "text": prompt}
            ]
            with (
                self.subTest(prompt=prompt),
                self.assertRaises(GeneralSourceError) as failure,
            ):
                validate_source(lesson, payload, scope_for_lesson(lesson))
            self.assertEqual(failure.exception.code, "DRAWING_POLICY")

    def test_numeric_islands_preserve_percent_spelling_and_explicit_lists(self):
        atoms = spans("התוצאות הן 20, 40, 60. ההנחה היא [[10.50%]].", 8)
        self.assertEqual([s["expression"]["numerator"] for s in atoms if s["kind"] == "math"], [20, 40, 60])
        self.assertIn({"kind": "formula", "notation": "10.50%"}, atoms)
        # A percent sign written after the island is refused, never moved into it.
        with self.assertRaises(GeneralSourceError) as refused:
            spans("התוצאות הן 20, 40, 60. ההנחה היא [[10.50]]%.", 8)
        self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        self.assertEqual(spans("[[point:A(-2,4)]]", 8), spans("[[A(-2,4)]]", 8))
        for token, grade in [("point:A(-2,4)", 4), ("point:A(x,4)", 8), ("point:AB(1,2)", 8)]:
            with self.subTest(token=token, grade=grade), self.assertRaises(GeneralSourceError):
                spans("[[" + token + "]]", grade)

    def test_inline_rows_are_refused_and_a_supplied_table_binds_its_rows(self):
        from printed_tasks import printed_table_row

        def question(records, grade, formula, table=None):
            data = {"intro": "השלימו את הטבלה.", "items": [
                {"prompt": record, "answer": {"kind": "computed", "unit": "",
                                               "task": {"kind": "evaluate", "expression": formula}}}
                for record in records
            ]}
            if table is not None:
                data["table"] = table
            return expand_source({"version": 4, "sections": [{"questions": [data]}]}, grade)["sections"][0]["questions"][0]

        for table, grade, formula in [
            ({"head": ["מחולק", "מחלק", "מנה"],
              "rows": [["[[16]]", "[[4]]", "[[___]]"], ["[[12]]", "[[3]]", "[[___]]"]]}, 3, "16/4"),
            ({"head": ["מספר", "אחוז", "תוצאה"],
              "rows": [["[[100]]", "[[10%]]", "[[___]]"], ["[[200]]", "[[5%]]", "[[___]]"]]}, 8, "100*0.10"),
        ]:
            with self.subTest(table=table):
                q = question(["שורה [[1]]", "שורה [[2]]"], grade, formula, table)
                self.assertEqual(len(q["table"]["rows"]), 2)
                for n, item in enumerate(q["items"], 1):
                    self.assertEqual(item["prompt"], spans(f"שורה [[{n}]]", grade))
                    solved = validate_and_solve_task(item["answer"]["task"])
                    self.assertEqual(printed_table_row(q, item, solved)["row"], n)
                    wrong = validate_and_solve_task({"kind": "evaluate", "expression": expression("3", grade)})
                    with self.assertRaises(GeneralSourceError):
                        printed_table_row(q, item, wrong)
                item["answer"]["unit"] = "סנטימטרים"
                with self.assertRaises(GeneralSourceError):
                    printed_table_row(q, item, solved)
        for records, grade, formula in [
            (["מחולק: 16, מחלק: 4, מנה: ___", "[[מחולק | מחלק | מנה]]\n[[12 | 3 | ___]]"], 3, "16/4"),
            (["בטבלה: מספר=[[100]], אחוז=[[10]]%, תוצאה=?",
              "בטבלה: מספר=[[200]], אחוז=[[5]]%, תוצאה=?"], 8, "100*0.10"),
            (["מחולק: 16, מחלק: 4, מנה: ___", "מחולק: 30, מנה: ___, מחלק: 6"], 3, "4"),
            (["מחולק: 16, מחלק: 4, מנה: ___", "כמה מספרים יש?"], 3, "4"),
            (["סכום: ___, כמות: ___"], 3, "4"),
            (["סכום: 3, כמות: 4"], 3, "4"),
        ]:
            with self.subTest(records=records):
                with self.assertRaisesRegex(GeneralSourceError, "table") as failure:
                    question(records, grade, formula)
                self.assertEqual(failure.exception.code, "SOURCE_TABLE")

    def test_explicit_table_references_in_intro_or_item_require_a_table(self):
        from compact_authoring import requires_existing_table

        for prompt in ["השתמשו בטבלה הנתונה.", "השלימו את הטבלה.", "קראו בטבלה שלפניכם."]:
            with self.subTest(prompt=prompt):
                self.assertTrue(requires_existing_table({"intro": spans(prompt, 3)}))
                with self.assertRaisesRegex(GeneralSourceError, "table"):
                    expand_source({"version": 4, "sections": [{"questions": [{"intro": "קראו.",
                                  "items": [{"prompt": prompt}]}]}]}, 3)
        self.assertFalse(requires_existing_table({"intro": "בנו טבלה והשלימו את הטבלה שלכם."}))
        self.assertFalse(requires_existing_table({"intro": "השתמשו בלוח הכפל."}))
        self.assertTrue(requires_existing_table({"intro": "בנו טבלה.", "items": [{"prompt": "עיינו בטבלה הנתונה."}]}))

    def test_a_missing_number_equation_is_one_island_or_refused(self):
        from printed_tasks import match_printed_task

        # Partly marked or unmarked, the equation is refused as written; nothing wraps it.
        for visible in ("24 : [[___]] = 6", "[[35]] : 7 = [[___]]", "[[___]] : 9 = 8", "24 : 6 = ___",
                        "[[24]] : [[6]] = ___", "7 + 5 = ___"):
            with self.subTest(visible=visible):
                with self.assertRaises(GeneralSourceError) as refused:
                    spans(visible, 3)
                self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        # Islands joined across their operators (as before) are read as the one formula they spell.
        self.assertEqual(spans("[[8]] + ___ = [[15]]", 3), [{"kind": "formula", "notation": "8 +  ___ = 15"}])
        for visible, value in [("[[24 : ___ = 6]]", 4), ("[[35 : 7 = ___]]", 5),
                               ("[[___ : 9 = 8]]", 72), ("[[24 : 6 = ___]]", 4)]:
            with self.subTest(visible=visible):
                item = {"prompt": spans(visible, 3), "answer": {"unit": ""}}
                self.assertEqual([s["kind"] for s in item["prompt"]], ["formula"])
                solved = validate_and_solve_task({"kind": "evaluate", "expression": expression(str(value), 3)})
                self.assertEqual(match_printed_task(item, solved, 3).proof["value"]["numerator"], value)
                wrong = validate_and_solve_task({"kind": "evaluate", "expression": expression(str(value + 1), 3)})
                with self.assertRaises(GeneralSourceError):
                    match_printed_task(item, wrong, 3)
                item["answer"]["unit"] = "מטרים"
                with self.assertRaises(GeneralSourceError):
                    match_printed_task(item, solved, 3)
        with self.assertRaises(GeneralSourceError):
            spans("חשבו את הנעלם x בתרגיל: [[x : 5 = 8]]", 3)

    def test_the_model_notation_is_never_rewritten(self):
        # A blank after an island stays outside it, so the "=" between them is refused.
        for value, grade in [("[[47 : 5]] = ___", 4), ("[[345]] = ___ מאות + ___ עשרות", 3)]:
            with self.subTest(value=value), self.assertRaises(GeneralSourceError) as refused:
                spans(value, grade)
            self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        # A blank inside an island stays inside it, also before a Hebrew label.
        self.assertEqual(spans("[[5 + 3 = ___]] מאות", 3),
                         [{"kind": "formula", "notation": "5 + 3 = ___"}, {"kind": "text", "text": " מאות"}])
        # An "=" between prose and an island is not folded into the sentence, and a
        # percent sign after an island is not moved into it.
        for value, grade in [("המחיר = [[5]]", 8), ("[[5]] = המחיר", 8), ("המחיר = [[5]] שקלים", 5),
                             ("בדקו [[25]]%.", 8), ("בדקו [[2.5]]%.", 5)]:
            with self.subTest(value=value), self.assertRaises(GeneralSourceError) as refused:
                spans(value, grade)
            self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        self.assertEqual(spans("בדקו [[25%]].", 8)[1], {"kind": "formula", "notation": "25%"})
        # A solve task keeps its own letter: one outside x, y, a and b is refused, not renamed to x.
        task = {"kind": "solve", "lhs": "3*c + 4", "rhs": "40", "variable": "c"}
        source = {"version": 4, "sections": [{"questions": [{"intro": "פתרו.", "items": [
            {"prompt": "פתרו [[3*x + 4 = 40]].", "answer": {"kind": "computed", "unit": "", "task": task}}]}]}]}
        with self.assertRaises(GeneralSourceError) as refused:
            expand_source(source, 8)
        self.assertEqual(refused.exception.code, "SOURCE_NOTATION")

    def test_a_printed_minus_before_anything_but_a_number_is_refused(self):
        from compact_authoring import display_parts
        from math_tasks import to_house_math
        # The tree has no negation sign: -2^4 would print as 0 − 2^4, a zero that was never written.
        for value in ("[[-2^4]]", "[[-x + 3]]", "[[-(x + 2)]]", "חשבו [[3 - -2^2]].", "[[2 * -x]]"):
            with self.subTest(value=value), self.assertRaises(GeneralSourceError) as refused:
                spans(value, 8)
            self.assertEqual(refused.exception.code, "SOURCE_NOTATION")
        with self.assertRaises(GeneralSourceError):
            display_parts("-x^2 + 4 = 0", 8)
        # A negative number, a minus printed as written in a schoolbook polynomial, and a typed task that is never
        # printed keep their meaning.
        self.assertEqual(spans("[[-2]]", 8), [{"kind": "math", "expression": {"type": "number", "numerator": -2, "denominator": 1}}])
        self.assertEqual(to_house_math(spans("[[(-2)^4]]", 8)[0]["expression"]), r"\g{−2}^{4}")
        self.assertEqual(display_parts("-3x + 5", 8), ["−3x + 5"])
        self.assertEqual(validate_and_solve_task({"kind": "evaluate", "expression": expression("-2^4", 8)})["result"]["value"],
                         {"type": "number", "numerator": -16, "denominator": 1})

    def test_compiler_prints_requested_division_equations_from_verified_quantities(self):
        from general_adapters import _compile_elementary, _load_skill
        from printed_elementary import printed_intent

        skill = Path(os.environ.get("ELEMENTARY_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet-elementary")))
        if not (skill / "scripts/lib").is_dir():
            self.skipTest("Installed elementary skill required to inspect the compiled answer key")
        question = {"intro": "בנו דוגמה חדשה:", "star": False, "items": []}
        for prompt, expr in [
            ("כתבו תרגיל חילוק שהמחלק בו הוא 5 והתוצאה היא 8.", "5*8"),
            ("כתבו תרגיל חילוק שהמחולק בו הוא 20 והמחלק הוא 5. מה המנה?", "20/5"),
        ]:
            question["items"].append({"prompt": prompt, "answer": {"kind": "computed", "unit": "",
                                      "task": {"kind": "evaluate", "expression": expr}}})
        q = expand_source({"version": 4, "sections": [{"questions": [question]}]}, 3)["sections"][0]["questions"][0]
        computed = [validate_and_solve_task(item["answer"]["task"]) for item in q["items"]]
        for item, bad in zip(q["items"], ["10*4", "16/4"]):
            wrong = validate_and_solve_task({"kind": "evaluate", "expression": expression(bad, 3)})
            with self.assertRaises(GeneralSourceError):
                printed_intent(q, item, wrong, 3, location="q1")
        source = {"title": "חילוק", "rule": spans("קראו.", 3),
                  "sections": [{"title": "חילוק", "conceptIds": ["ג10#0"], "questions": [q]}]}
        evidence = {"computations": [{"itemId": f"q1-i{i}", "computed": v} for i, v in enumerate(computed, 1)]}
        _load_skill(skill, True)
        with tempfile.TemporaryDirectory() as tmp:
            _compile_elementary({"topicId": "ג10", "gradeNumber": 3, "level": "b"}, source, evidence,
                                {"topic": {"topicId": "ג10", "sourceTopicId": "division", "domain": "מספרי"}}, skill, Path(tmp))
            worksheet = json.loads((Path(tmp) / "worksheet-source.json").read_text())
            answers = [item["answer"] for item in worksheet["questions"][0]["items"]]
            self.assertEqual(answers, ["40 : 5 = 8", "20 : 5 = 4"])

    def test_coordinate_viewport_includes_origin_without_moving_the_data(self):
        figure = {
            "kind": "coordinate_plane",
            "xr": [2, 6],
            "yr": [-7, -2],
            "points": [{"name": "P", "x": 4, "y": -3}],
            "segments": [],
        }
        source = {"version": 4, "sections": [{"questions": [{"figure": figure}]}]}
        derived = expand_source(source, 8)["sections"][0]["questions"][0]["figure"]
        self.assertEqual(derived, {**figure, "xr": [0, 6], "yr": [-7, 0]})
        self.assertEqual(figure["xr"], [2, 6])

    def test_compact_middle_source_preserves_typed_operations_tables_and_reviews(self):
        fixture = (
            Path(__file__).resolve().parents[1]
            / "cloud/container/fixtures/general/grade9-quadratic"
        )
        lesson = json.loads((fixture / "lesson.json").read_text())
        original = json.loads((fixture / "model-output.json").read_text())
        source = copy.deepcopy(original)
        question = source["sections"][0]["questions"][0]
        question["table"] = {
            "head": ["ערך", "כמות"],
            "rows": [["[[frac(1,2)]]", "[[3]]"]],
        }
        item = question["items"][0]
        item.update(
            prompt="הציבו [[x]] בביטוי.",
            answer={
                "kind": "computed",
                "unit": "",
                "task": {
                    "kind": "substitute",
                    "expression": "x^2+3",
                    "values": {"x": "2"},
                },
            },
        )
        scope = scope_for_lesson(lesson)
        unpacked = expand_source(source, 9)
        output = validate_source(lesson, unpacked, scope, provider=True)
        first = output["evidence"]["computations"][0]["computed"]
        self.assertEqual(first["result"]["value"]["numerator"], 7)
        self.assertEqual(source["sections"][0]["questions"][0]["items"][0], item)
        self.assertEqual(
            spans("הקטע [[segment:AB]]", 9)[1],
            {"kind": "geometry", "type": "segment", "names": "AB"},
        )

    def test_retained_typed_source_is_lossless(self):
        root = Path(__file__).resolve().parents[1] / "cloud/container/fixtures/general"
        for grade, case in [
            (2, "grade2-vocalized"),
            (4, "grade4-fractions"),
            (9, "grade9-coordinate-triangles"),
        ]:
            payload = json.loads((root / case / "model-output.json").read_text())
            self.assertEqual(expand_source(payload, grade), payload)
