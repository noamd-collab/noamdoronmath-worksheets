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
        clock={"kind":"clock","hour":3,"minute":30}
        prompt=_task_text(solve_figure_task(clock,"hour"),2)
        self.assertIn("מְחוֹג",prompt);self.assertNotIn("3",prompt);self.assertNotIn("30",prompt)

    @unittest.skipUnless((ELEMENTARY/"scripts/svg_elementary_ext.py").is_file(),"Pinned elementary skill unavailable")
    def test_grid_figure_measurement_rejects_changed_svg_and_clock_hands(self):
        sys.path[:0]=[str(ELEMENTARY/"scripts")]
        import svg_elementary as SE
        import svg_elementary_ext as SX
        fig={"kind":"grid_shape","cells":[[1,1],[1,0]]}
        svg=SX.area_grid_shape(fig["cells"])
        self.assertEqual(solve_figure_task(fig,"area")["result"]["value"],number(3))
        self.assertEqual(solve_figure_task(fig,"perimeter")["result"]["value"],number(8))
        self.assertTrue(measure_elementary_svg(fig,svg)[0])
        self.assertFalse(measure_elementary_svg(fig,svg.replace('fill="#D7F0ED"','fill="#FFFFFF"',1))[0])
        clock={"kind":"clock","hour":3,"minute":30}
        self.assertTrue(measure_elementary_svg(clock,SE.clock_face(3,30))[0])
        self.assertFalse(measure_elementary_svg(clock,SE.clock_face(4,30))[0])

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


if __name__=="__main__":unittest.main()
