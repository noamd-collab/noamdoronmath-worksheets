"""Adversarial data-only source and real pinned-input compilation tests."""
import copy
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from curriculum_scope import load_curriculum_scope, validate_curriculum_scope
from general_source import GeneralSourceError, authoring_schema, validate_source
from general_adapters import compile_source, _elementary_math
from math_tasks import number, operation
from general_geometry import solve_figure_task, measure_elementary_svg

ROOT = Path(__file__).resolve().parents[3]
APP = Path(__file__).resolve().parents[1]
PROJECTION = APP / "generation-curriculum.json" if (APP / "generation-curriculum.json").is_file() else ROOT/"headless/astro-poc/public/teachers/generation-curriculum.json"
ELEMENTARY = Path(os.environ.get("ELEMENTARY_SKILL_PATH", str(Path.home()/".codex/skills/hebrew-math-worksheet-elementary")))
MIDDLE = Path(os.environ.get("MIDDLE_SKILL_PATH", str(Path.home()/".codex/skills/hebrew-math-worksheet")))
PIN = "57adca1891cbc2ef333709a6adee18045da23035f9e981f091673d2f8547527b"


def fixture(topic="ד11", grade=4, count=4):
    text = lambda value: [{"kind":"text", "text":value}]
    lesson = {"gradeNumber":grade, "topicId":topic, "level":"b" if grade < 9 else "a", "questionCount":count,
              "lessonBoundary":{"version":1,"kind":"curriculum_scope","curriculumSha256":PIN,"conceptIds":[topic+"#0"]}}
    qs = []
    for i in range(count):
        task = {"kind":"evaluate", "expression":operation("add", number(i+1, 8), number(1, 8))}
        if grade >= 7:
            task = {"kind":"solve", "lhs":operation("subtract", operation("power", {"type":"symbol","name":"x"}, number(2)), number((i+1)**2)), "rhs":number(0), "variable":"x"}
        qs.append({"intro":text("חברו את השברים." if grade<7 else "פתרו את המשוואה ובדקו את הפתרונות."),"star":i<2,
                   "items":[{"prompt":text("כתבו את התוצאה." if grade<7 else "מצאו את כל הפתרונות."),"answer":{"kind":"computed","task":copy.deepcopy(task),"unit":""}} for _ in range(5 if grade<=2 else 3)]})
    payload = {"version":4,"title":"שברים שווי מכנה" if grade<7 else "משוואות ריבועיות", "rule":text("עבדו לפי הסדר."),
               "sections":[{"title":"תרגול","conceptIds":[topic+"#0"],"questions":qs}]}
    return lesson, payload


class SourceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = load_curriculum_scope(PROJECTION, PIN)

    def source(self, topic="ד11", grade=4):
        lesson, payload = fixture(topic, grade)
        scope = validate_curriculum_scope(self.catalog, grade, topic, lesson["lessonBoundary"])
        return lesson, payload, scope

    def test_answers_are_recomputed_and_original_asts_preserved(self):
        lesson,payload,scope = self.source()
        checked=validate_source(lesson,payload,scope)
        computed=checked["evidence"]["computations"][0]["computed"]
        self.assertEqual(computed["result"]["value"], number(1,4))
        self.assertEqual(computed["question"],payload["sections"][0]["questions"][0]["items"][0]["answer"]["task"])
        self.assertTrue(checked["evidence"]["reviewRequired"])
        self.assertNotIn("e2eVerified",checked)

    def test_nary_schema_computation_and_elementary_print_preserve_third_operand(self):
        lesson,payload,scope=self.source()
        expression=operation("add",number(1,8),number(2,8),number(3,8))
        payload["sections"][0]["questions"][0]["items"][0]["answer"]["task"]["expression"]=expression
        checked=validate_source(lesson,payload,scope)
        self.assertEqual(checked["evidence"]["computations"][0]["computed"]["result"]["value"],number(3,4))
        class Renderer:
            @staticmethod
            def fmt(value,grade):return str(value)
            @staticmethod
            def frac(n,d,grade):return 'fraction('+str(n)+','+str(d)+')'
            @staticmethod
            def op(operator,grade):return operator
        self.assertEqual(_elementary_math(expression,"ד",Renderer),'fraction(1,8) + fraction(1,4) + fraction(3,8)')
        self.assertEqual(_elementary_math(operation("multiply",number(2),number(3),number(5)),"ד",Renderer),'2 * 3 * 5')

    def test_model_cannot_add_approval_answers_or_code(self):
        for field in ("approved_by","e2eVerified","python","html","path"):
            lesson,payload,scope=self.source();payload[field]="arbitrary"
            with self.subTest(field=field),self.assertRaises(GeneralSourceError):
                validate_source(lesson,payload,scope)
        for attack in ("<script>alert(1)</script>","$x$","file:///tmp/x","abc\\n","טקסט\u202e"):
            lesson,payload,scope=self.source();payload["rule"][0]["text"]=attack
            with self.subTest(attack=attack),self.assertRaises(GeneralSourceError):
                validate_source(lesson,payload,scope)

    def test_reject_wrong_scope_volume_coverage_and_markers(self):
        mutations=[lambda p:p["sections"][0]["conceptIds"].append("g9r:quad_func_and_eq#0"),
                   lambda p:p["sections"][0]["questions"].pop(),
                   lambda p:p["sections"][0]["questions"][0].update(star=False)]
        for mutate in mutations:
            lesson,payload,scope=self.source();mutate(payload)
            with self.assertRaises(GeneralSourceError):validate_source(lesson,payload,scope)

    def test_figure_permission_comes_from_trusted_catalog(self):
        lesson,payload,scope=self.source()
        payload["sections"][0]["questions"][0]["figure"]={"kind":"grid_shape","cells":[[1,1],[1,0]]}
        with self.assertRaisesRegex(GeneralSourceError,"does not permit"):
            validate_source(lesson,payload,scope)

    def test_clock_graph_and_arithmetic_topics_exclude_drawings(self):
        cases = [
            ("ב25", 2, {"kind": "clock", "hour": 3, "minute": 30}),
            ("ב12", 2, {"kind": "bar_chart", "labels": ["א", "ב"], "values": [1, 2]}),
            ("g9m:graph_reading", 9, {"kind": "coordinate_plane"}),
            ("g7:coordinate_system", 7, {"kind": "coordinate_plane"}),
            ("ד11", 4, {"kind": "grid_shape", "cells": [[1]]}),
        ]
        for topic, grade, figure in cases:
            with self.subTest(topic=topic):
                lesson, payload, scope = self.source(topic, grade)
                lesson["level"] = "b"
                schema = authoring_schema(lesson, scope)
                props = schema["properties"]["sections"]["items"]["properties"]["questions"]["items"]["properties"]
                self.assertNotIn("figure", props)
                self.assertNotIn("drawingFromWords", props)
                self.assertIn("table", props)
                question = payload["sections"][0]["questions"][0]
                for key, value in (("figure", figure), ("drawingFromWords", True)):
                    question[key] = value
                    with self.assertRaises(GeneralSourceError) as raised:
                        validate_source(lesson, payload, scope)
                    self.assertEqual(raised.exception.code, "DRAWING_POLICY")
                    del question[key]

    def test_impossible_middle_triangle_rejected(self):
        lesson,payload,scope=self.source("g8:congruence",8)
        payload["sections"][0]["questions"][0]["figure"]={"kind":"shape","shape":"triangle","parameters":{"a":1,"b":2,"c":3},"names":"ABC","rotate":0}
        with self.assertRaisesRegex(GeneralSourceError,"triangle"):
            validate_source(lesson,payload,scope)

    def test_unverified_proof_cannot_gain_fake_ledger_or_output(self):
        lesson,payload,scope=self.source()
        payload["sections"][0]["questions"][0]["items"][0]["answer"]={"kind":"review","text":[{"kind":"text","text":"זהו ניסוח שעדיין צריך לבדוק."}]}
        checked=validate_source(lesson,payload,scope)
        self.assertEqual(len(checked["evidence"]["unverifiedAnswers"]),1)
        with tempfile.TemporaryDirectory() as work:
            with self.assertRaisesRegex(GeneralSourceError,"no deliverable"):
                compile_source(lesson,checked,scope,"/unused",work)
            self.assertFalse((Path(work)/"verified.json").exists())
            self.assertFalse((Path(work)/"sheet.html").exists())
            self.assertTrue((Path(work)/"general-evidence.json").exists())

    def test_json_schema_is_strict_and_no_figure_in_arithmetic_topic(self):
        lesson,payload,scope=self.source()
        schema=authoring_schema(lesson,scope)
        self.assertFalse(schema["additionalProperties"])
        q=schema["properties"]["sections"]["items"]["properties"]["questions"]["items"]
        self.assertNotIn("figure",q["properties"])
        try:import jsonschema
        except ImportError:self.skipTest("jsonschema is a development-only optional test tool")
        jsonschema.Draft202012Validator.check_schema(schema)
        jsonschema.validate(payload,schema)
        payload["sections"][0]["questions"][0]["items"][0]["answer"]["task"]["expression"]=operation("add",number(1,8),number(2,8),number(3,8))
        jsonschema.validate(payload,schema)
        for op,args in [("subtract",[number(1)]*3),("divide",[number(1)]*3),("add",[number(1)]*7),("multiply",[number(1)]),("sqrt",[number(1)]*2)]:
            invalid=copy.deepcopy(payload)
            invalid["sections"][0]["questions"][0]["items"][0]["answer"]["task"]["expression"]=operation(op,*args)
            with self.assertRaises(jsonschema.ValidationError):jsonschema.validate(invalid,schema)

    @unittest.skipUnless((ELEMENTARY/"scripts/ws_html.py").is_file(),"Pinned elementary skill unavailable")
    def test_elementary_original_prose_table_and_fraction_compile_together(self):
        lesson,payload,scope=self.source()
        payload["sections"][0]["questions"][0]["table"]={"head":[[{"kind":"text","text":"שם"}],[{"kind":"text","text":"כמות"}]],"rows":[[[{"kind":"text","text":"עוגה"}],[{"kind":"math","expression":number(1,8)}]]]}
        with tempfile.TemporaryDirectory() as work:
            result=compile_source(lesson,validate_source(lesson,payload,scope),scope,ELEMENTARY,work)
            self.assertTrue(result["reviewRequired"])
            rendered=(Path(work)/"sheet.html").read_text()
            self.assertIn("עוגה",rendered);self.assertIn("work-table",rendered);self.assertIn('class="frac"',rendered)
            ledger=json.loads((Path(work)/"verified.json").read_text())
            self.assertEqual(len(ledger["claims"]),12)
            self.assertTrue(all(x["method"]=="sympy" for x in ledger["claims"]))

    def test_middle_constant_bridge_keeps_multiple_roots_and_review_metadata(self):
        lesson,payload,scope=self.source("g9r:quad_func_and_eq",9)
        with tempfile.TemporaryDirectory() as work:
            compile_source(lesson,validate_source(lesson,payload,scope),scope,MIDDLE,work)
            level=json.loads((Path(work)/"levels.json").read_text())[0]
            self.assertIn("−1",level["answers"][0][1][0][1]);self.assertIn("= 1",level["answers"][0][1][0][1])
            self.assertTrue(level["questions"][0]["items"][0]["to_prove"])
            bridge=(Path(work)/"content.py").read_text()
            self.assertNotIn(payload["title"],bridge);self.assertIn("STRICT_FIGURES = True",bridge)

    def test_bound_coordinate_answer_and_no_model_selected_result(self):
        fig={"kind":"coordinate_plane","xr":[-4,4],"yr":[-4,4],"points":[{"name":"A","x":2,"y":3}],"segments":[]}
        self.assertEqual(solve_figure_task(fig,"y_coordinate","A")["result"]["value"],number(3))
        with self.assertRaises(ValueError):solve_figure_task(fig,"y_coordinate","Z")

    def test_shape_measurement_always_prints_bound_dimensions_but_read_off_does_not(self):
        from general_adapters import _task_text
        rectangle={"kind":"shape","shape":"rectangle","parameters":{"w":3,"h":4},"names":"ABCD","rotate":0}
        visible=_task_text(solve_figure_task(rectangle,"area"),8)
        self.assertIn("$3$",visible);self.assertIn("$4$",visible);self.assertNotIn("$12$",visible)
        coordinate = {"kind": "coordinate_plane", "points": [{"name": "A", "x": 4, "y": 7}]}
        prompt = _task_text(solve_figure_task(coordinate, "y_coordinate", "A"), 9)
        self.assertIn("$y$", prompt)
        self.assertIn("$A$", prompt)
        self.assertNotIn("7", prompt)

    @unittest.skipUnless((ELEMENTARY/"scripts/svg_elementary_ext.py").is_file(),"Pinned elementary skill unavailable")
    def test_grid_figure_measurement_rejects_changed_svg(self):
        sys.path[:0]=[str(ELEMENTARY/"scripts")]
        import svg_elementary_ext as SX
        fig={"kind":"grid_shape","cells":[[1,1],[1,0]]}
        svg=SX.area_grid_shape(fig["cells"])
        self.assertEqual(solve_figure_task(fig,"area")["result"]["value"],number(3))
        self.assertEqual(solve_figure_task(fig,"perimeter")["result"]["value"],number(8))
        self.assertTrue(measure_elementary_svg(fig,svg)[0])
        self.assertFalse(measure_elementary_svg(fig,svg.replace('fill="#D7F0ED"','fill="#FFFFFF"',1))[0])

    def test_all_three_new_task_families_render_typed_answers(self):
        from general_adapters import _answer_text,_task_text
        from math_tasks import validate_and_solve_task
        x={"type":"symbol","name":"x"};y={"type":"symbol","name":"y"}
        tasks=[{"kind":"statistics","operation":"mode","values":[number(1),number(2)]},
               {"kind":"inequality","variable":"x","lhs":x,"rhs":number(2),"relation":"lt"},
               {"kind":"solve_system","variables":["x","y"],"equations":[{"lhs":operation("add",x,y),"rhs":number(3)},{"lhs":operation("subtract",x,y),"rhs":number(1)}]}]
        for task in tasks:
            solved=validate_and_solve_task(task)
            self.assertTrue(_answer_text(solved,"",8));self.assertTrue(_task_text(solved,8))


class PrintedElementaryTests(unittest.TestCase):
    def setUp(self):
        self.lesson = {"gradeNumber": 3, "topicId": "ג01"}

    def bind(self, prompt, result, *, table=None, lesson=None):
        from math_tasks import number, validate_and_solve_task
        from printed_elementary import place_answer
        task = {"kind":"evaluate","expression":number(result)} if type(result) is int else result
        item={"prompt":[{"kind":"text","text":prompt}],"answer":{"kind":"computed","unit":"","task":task}}
        q={"intro":[],"items":[item]}
        if table is not None: q["table"]=table
        return place_answer(lesson or self.lesson,q,item,validate_and_solve_task(task))

    def test_real_place_forms_compute_the_answer_to_each_printed_blank(self):
        cases=[
            ("308 = ___ מאות + ___ עשרות + ___ אחדות", 308, ["3","0","8"]),
            ("___ מאות + ___ עשרות + ___ אחדות = 915", 915, ["9","1","5"]),
            ("456 = ___ מאות + 50 + ___ אחדות", 6, ["4","6"]),
            ("123 — ספרת העשרות היא ___", 2, ["2"]),
            ("במספר 523, מהו הערך של הספרה 5?", 500, ["500"]),
            ("200 + 30 + 5 = ___", 235, ["235"]),
            ("מספר תלת-ספרתי שספרת המאות שלו 5, ספרת העשרות 3 וספרת האחדות 7. מהו המספר?", 537, ["537"]),
            ("פרקו את המספר 308 לצורות שונות (למשל: מאות ועשרות ואחדות).", 308, ["300 + 0 + 8","290 + 18"]),
        ]
        for prompt,typed,expected in cases:
            with self.subTest(prompt=prompt):
                bound=self.bind(prompt,typed)
                self.assertEqual([p[0] for p in bound.parts if isinstance(p,tuple)],expected)
                self.assertEqual(bound.proof["verifiedTypedValue"],typed)
                with self.assertRaises(GeneralSourceError): self.bind(prompt,typed+1)
        self.assertIsNone(self.bind("חשבו את הביטוי.",3))
        # A printed place-value form is answered from its own number in any elementary topic.
        self.assertEqual(self.bind(cases[0][0],308,lesson={"gradeNumber":3,"topicId":"ג10"}).proof["rule"],"place_digits")
        self.assertIsNone(self.bind(cases[0][0],308,lesson={"gradeNumber":7,"topicId":"g7:equations"}))

    def test_real_table_and_comparison_are_bound_to_the_data_students_see(self):
        from math_tasks import number
        plain=lambda s:[{"kind":"text","text":s}]
        table={"head":[plain(v) for v in ("מספר","מאות","עשרות","אחדות")],
               "rows":[[plain(v) for v in ("456","___","___","___")]]}
        full="השלמת שורה א׳: 456 = ___ מאות + ___ עשרות + ___ אחדות"
        self.assertEqual(self.bind(full,456,table=table).proof["number"],456)
        table["rows"][0][0]=plain("465")
        with self.assertRaises(GeneralSourceError): self.bind(full,456,table=table)
        task={"kind":"compare","left":number(700),"right":number(70)}
        claim="טענה: במספר 729, הערך של הספרה 7 הוא 70."
        self.assertIn("לא נכון.",self.bind(claim,task).parts[0])
        with self.assertRaises(GeneralSourceError): self.bind(claim,{**task,"left":number(70)})
        with self.assertRaises(GeneralSourceError): self.bind(claim,{**task,"left":number(701)})
        for wrong in ("במספר 525, מהו הערך של הספרה 5?", "356 = ___ מאות + 40 + ___ אחדות"):
            with self.assertRaises(GeneralSourceError): self.bind(wrong,5)

    def test_specialized_counting_evidence_is_complete_and_never_loosens_math(self):
        from math_tasks import number, validate_and_solve_task
        from printed_elementary import guard_counting_input, validate_counting_values
        lesson={"gradeNumber":1,"topicId":"א01"}
        result=validate_and_solve_task({"kind":"evaluate","expression":number(3)})
        solved={"q1-i1":result}
        validate_counting_values(lesson,solved,{"q1-i1":3})
        for wrong in ({},{"q1-i1":2},{"q1-i1":True},{"q1-i1":3,"q2-i1":3}):
            with self.assertRaises(GeneralSourceError):validate_counting_values(lesson,solved,wrong)
        with self.assertRaises(GeneralSourceError):validate_counting_values(self.lesson,solved,{"q1-i1":3})
        item={"prompt":[{"kind":"text","text":"כַּמָּה צִפּוֹרִים יֵשׁ? (דְּמוּת: שָׁלוֹשׁ צִפּוֹרִים)"}]}
        question={"intro":[{"kind":"text","text":"סִפְרוּ אֶת הַפְּרִיטִים"}]}
        with self.assertRaises(GeneralSourceError):guard_counting_input(lesson,question,item,result)
        bad_sort=validate_and_solve_task({"kind":"statistics","operation":"sort","values":[number(3),number(0)]})
        item["prompt"]=[{"kind":"text","text":"עֵט, עֵט, עֵט. כַּמָּה עֵטִים?"}]
        with self.assertRaises(GeneralSourceError):guard_counting_input(lesson,question,item,bad_sort)
        guard_counting_input({"gradeNumber":4,"topicId":"ד01"},question,item,bad_sort)


class PrintedPercentagesTests(unittest.TestCase):
    @staticmethod
    def rich_text(s):
        return [{"kind":"text","text":s}]

    def setup_item(self, intro, prompt, value, unit, lesson=None):
        from math_tasks import validate_and_solve_task
        from printed_percentages import percentage_evidence
        source_lesson=lesson or {"gradeNumber":8,"topicId":"g8:percentages"}
        item={"prompt":self.rich_text(prompt),"answer":{"kind":"computed","unit":unit}}
        return percentage_evidence(source_lesson,self.rich_text(intro),item,validate_and_solve_task({"kind":"evaluate","expression":value}))

    def test_exact_visible_base_amount_and_units(self):
        intro="בכיתה יש 25 תלמידים."
        prompt="כמה הם 20 אחוזים מ־25 התלמידים?"
        check=self.setup_item(intro,prompt,number(5),"תלמידים")
        self.assertEqual((check["role"],check["value"]),("part","5"))
        with self.assertRaises(GeneralSourceError):self.setup_item(intro,prompt,number(4),"תלמידים")
        with self.assertRaises(GeneralSourceError):self.setup_item(intro,prompt,number(5),"שקלים")
        with self.assertRaises(GeneralSourceError):self.setup_item("בכיתה יש 20 תלמידים.",prompt,number(5),"תלמידים")
        with self.assertRaises(GeneralSourceError):self.setup_item("","כמה הם 10 אחוזים מ־25 התלמידים?",number(5,2),"תלמידים")
        self.assertEqual(self.setup_item("","כמה הם 10 אחוזים מ־25 השקלים?",number(5,2),"שקלים")["value"],"5/2")
        self.assertIsNone(self.setup_item(intro,"מצאו את הכמות.",number(5),"תלמידים"))
        self.assertIsNone(self.setup_item(intro,"כמה הם 20 אחוזים מ־25 התלמידים שקיבלו בונוס של 5?",number(5),"תלמידים"))
        self.assertIsNone(self.setup_item(intro,prompt,number(5),"תלמידים",{"gradeNumber":7,"topicId":"g7:other"}))

    def test_inverse_percentage_requires_its_own_known_base(self):
        p="דנה ענתה נכון על 45 שאלות. כמה אחוזים מהשאלות ענתה דנה נכון?"
        self.assertEqual(self.setup_item("במבחן היו 50 שאלות.",p,number(90),"אחוזים")["role"],"percentage")
        self.assertIsNone(self.setup_item("",p,number(90),"אחוזים"))
        self.assertIsNone(self.setup_item("במבחן היו 50 שאלות.",p.replace("ענתה דנה נכון?","ענה דני נכון?"),number(90),"אחוזים"))
        with self.assertRaises(GeneralSourceError):self.setup_item("במבחן היו 40 שאלות.",p,number(90),"אחוזים")
        with self.assertRaises(GeneralSourceError):self.setup_item("במבחן היו 50 שאלות.",p,number(90),"שאלות")

    def test_middle_native_compiler_keeps_recipe_for_an_incomplete_instruction(self):
        import tempfile
        from general_adapters import _compile_middle
        from math_tasks import validate_and_solve_task
        task={"kind":"evaluate","expression":{"type":"operation","op":"multiply","args":[number(1,5),number(25)]}}
        def row(prompt):
            return {"prompt":self.rich_text(prompt),"answer":{"kind":"computed","unit":"תלמידים","task":task}}
        q={"intro":self.rich_text("בכיתה יש 25 תלמידים."),"star":False,"items":[row("כמה הם 20 אחוזים מ־25 התלמידים?"),row("חשבו כמה תלמידים מתקבלים.")]}
        source={"title":"אחוזים","rule":self.rich_text("חלק ממאה"),"sections":[{"title":"אחוז מתוך השלם","conceptIds":["g8:percentages#0"],"questions":[q]}]}
        solved=validate_and_solve_task(task); evidence={"computations":[{"itemId":"q1-i1","computed":solved},{"itemId":"q1-i2","computed":solved}]}
        scope={"topic":{"sourceTopicId":"percentages","sourceTrack":"ח","domain":"מספרי"}}
        with tempfile.TemporaryDirectory() as tmp:
            _compile_middle({"gradeNumber":8,"level":"b","topicId":"g8:percentages"},source,evidence,scope,None,Path(tmp))
            items=json.loads((Path(tmp)/"worksheet-source.json").read_text())["questions"][0]["items"]
            self.assertEqual(items[0]["text"],"כמה הם 20 אחוזים מ־25 התלמידים?")
            self.assertIn("25",items[1]["text"])
            self.assertEqual(set(json.loads((Path(tmp)/"verified.json").read_text())["printedChecks"]),{"q1-i1"})

if __name__=="__main__":unittest.main()
