import json
import os
from pathlib import Path
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from general_source import GeneralSourceError, validate_source
from runtime_catalog import catalog, scope_for_lesson
import provider
import triangle_parts_shape
from test_general_runtime import intake, source


class TrianglePartsTests(unittest.TestCase):
    def test_saved_triangle_parts_form_reaches_provider_and_preserves_all_selections(self):
        from skill_authoring import question_plan, worksheet_schema
        fixture = Path(__file__).parent / "fixtures/grade8-triangle-parts-intake.json"
        lesson = json.loads(fixture.read_text(encoding="utf-8"))
        scope = scope_for_lesson(lesson)
        for level, expected in (("a", 3), ("b", 4), ("e", 2)):
            plan = question_plan({**lesson, "level": level}, scope)
            self.assertEqual(sum(row["representation"] == "drawingFromWords" for row in plan), expected)
        original = source(lesson)
        qs = original["sections"][0]["questions"]
        rows = [{k: v for k, v in q.items() if k != "star"} for q in qs]
        for row, construction in zip(rows, triangle_parts_shape.PARTS):
            row["figure"] = {"kind": "triangle_part", "names": "MNPK", "base": 10,
                             "left": 6, "right": 8, "rotate": 22, "construction": construction}
            row["items"][0]["answer"] = {"kind": "figure", "operation": "perimeter", "unit": "סנטימטרים"}
        flat = {"title": original["title"], "rule": original["rule"],
                "practice": rows[:-3], "challenges": rows[-3:]}
        with patch("provider.build_authoring_context", return_value={}), patch(
                "provider.request_author_json", return_value=flat) as request:
            reply = provider.author_lesson(lesson, api_key="synthetic-fixture-key", model="fixture-model",
                                          base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        body = request.call_args.args[2]
        wire = body["response_format"]["json_schema"]["schema"]
        old = worksheet_schema(lesson, scope)
        self.assertEqual(wire["$defs"]["freeSource"], {k:v for k,v in old.items() if k != "$defs"})
        self.assertEqual(wire["anyOf"][0], triangle_parts_shape.design_schema(20))
        plan = json.loads(body["messages"][1]["content"])["questionPlan"]
        self.assertEqual(len(plan), 20)
        self.assertEqual(list(dict.fromkeys(k for r in plan for k in r["conceptIds"])),
                         lesson["lessonBoundary"]["conceptIds"])
        checked = validate_source(lesson, reply, scope)
        self.assertEqual([q["figure"]["construction"] for q in checked["source"]["sections"][0]["questions"][:4]],
                         list(triangle_parts_shape.PARTS))
        self.assertIn("triangle_part", json.dumps(worksheet_schema(lesson, scope)))
        other = intake(next(t for t in catalog().topics if t["topicId"] == "g8:pythagoras"))
        other_schema = json.dumps(worksheet_schema(other, scope_for_lesson(other)))
        self.assertNotIn('"triangle_part"', other_schema)
        self.assertNotIn('"half_base"', other_schema)

    def test_bounded_design_is_authored_and_keeps_the_full_revision_scope(self):
        from skill_authoring import question_plan
        lesson=json.loads((Path(__file__).parent/"fixtures/grade8-triangle-parts-intake.json").read_bytes())
        scope=scope_for_lesson(lesson)
        plan=question_plan(lesson,scope)
        options=triangle_parts_shape.design_choices(lesson,scope,plan)
        self.assertIsNone(triangle_parts_shape.design_choices(lesson,{**scope,"selectedConcepts":scope["selectedConcepts"][:2]},plan))
        rows=[{"design":names[0],"size":2+i%8,"names":"ABCD","rotation":0} for i,names in enumerate(options)]
        def submit(rows):
            with patch("provider.build_authoring_context",return_value={}), patch("provider.request_author_json",return_value={"mode":"triangle-design/1","questions":rows}) as request:
                metadata={}
                answer=provider.author_lesson(lesson,api_key="fixture",base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1",model="fixture",metadata=metadata)
                self.assertEqual(request.call_count,1)
                self.assertEqual(metadata["authorContract"],"triangle-design/1")
                return answer["sections"][0]["questions"]
        generated=submit(rows)
        self.assertEqual(len(generated),20)
        self.assertEqual(sum(len(q["items"]) for q in generated),60)
        self.assertEqual([q.get("drawingFromWords",False) for q in generated],[slot["representation"]=="drawingFromWords" for slot in plan])
        self.assertEqual(sum(q.get("figure",{}).get("kind")=="coordinate_plane" for q in generated),5)
        alt=submit([{**row,"design":opts[-1],"size":11-row["size"],"names":"PQRS","rotation":22} for row,opts in zip(rows,options)])
        self.assertTrue(all(a!=b for a,b in zip(generated,alt)))
        for bad in ({**rows[0],"size":True}, {k:v for k,v in rows[0].items() if k!="names"}, {**rows[0],"design":"outside"}):
            with self.assertRaises(GeneralSourceError):
                triangle_parts_shape.compile_design({"mode":"triangle-design/1","questions":[bad,*rows[1:]]},options,plan)

    def test_bad_geometry_from_the_free_source_response_is_reported_before_render(self):
        rows=[{"intro":"בסרטוט שני משולשים: משולש $ABC$ ומשולש $DEF$.",
               "figure":{"kind":"triangle_part","names":"ABCM"},
               "items":[{"prompt":"חשבו את הזווית החיצונית.","answer":{"kind":"computed","task":{"kind":"evaluate","expression":"atan(3/4)*180/pi"}}}]}]
        findings=triangle_parts_shape.authored_findings(rows,[{"representation":"geometryFigure"}])
        self.assertEqual([f["question"] for f in findings],[1])
        self.assertEqual(len(findings[0]["feedback"]),2)

    def test_printed_givens_sketches_and_challenges_do_not_reveal_or_repeat_earlier_tasks(self):
        import math
        t=triangle_parts_shape
        easy=t._euclidean_question("equal_legs", 6, "RSTH", 0, False)
        printed, claims=t.givens(easy["figure"])
        self.assertIn("ST=16",printed)
        self.assertNotIn("=19",printed)
        self.assertEqual([v["of"] for v in claims if v["type"]=="length"],["ST"])
        sketch=t._euclidean_question("equal_legs", 4, "ABCD", 0, True)
        self.assertTrue(sketch["drawingFromWords"])
        self.assertNotIn("figure",sketch)
        self.assertIn("שני משולשים",sketch["intro"])
        self.assertIn("לקבוע",sketch["items"][-1]["prompt"])
        challenge=t._euclidean_question("challenge_paths",9,"EFGH",0,False)
        self.assertIn("שחזרו",challenge["items"][0]["prompt"])
        self.assertEqual([v["value"] for v in t.givens(challenge["figure"])[1] if v["type"]=="length"],[22])
        ordinary=t._euclidean_question("broken_path",9,"EFGH",0,False)
        self.assertNotEqual(ordinary["items"][0]["answer"],challenge["items"][0]["answer"])
        for size in range(2,10):
            for rotation in (-22,0,22):
                for design in ("grid_midpoint","grid_disprove","grid_altitude","grid_error_proof"):
                    q=t._grid_question(design,size,"ABCD",rotation)
                    ps={p["name"]:(p["x"],p["y"]) for p in q["figure"]["points"]}
                    if design=="grid_error_proof":
                        self.assertEqual(len(q["figure"]["segments"]),6)
                        self.assertEqual(len(ps),5)
                        a,c,x=ps["A"],ps["C"],ps["X"]
                        u,v=tuple(p-q for p,q in zip(a,c)),tuple(p-q for p,q in zip(x,c))
                        self.assertAlmostEqual(math.degrees(math.acos(sum(p*q for p,q in zip(u,v))/math.hypot(*u)/math.hypot(*v))),135)
                    else:
                        a,b,c,d=(ps[k] for k in "ABCD")
                        self.assertEqual(tuple((u+v)/2 for u,v in zip(b,c))==d,design!="grid_disprove")
                        self.assertEqual(sum((u-v)*(w-z) for u,v,w,z in zip(a,d,b,c))==0,design!="grid_midpoint")
        last=t._euclidean_question("challenge_converse",7,"MNPK",0,False)
        self.assertIn("חופפים",last["items"][1]["answer"]["text"])
        self.assertIn("לא נתון",last["intro"])

    @unittest.skipUnless(os.getenv("MIDDLE_SKILL_PATH"),"needs pinned middle skill")
    def test_authored_angles_match_measured_rendered_figures_for_every_geometry_parameter(self):
        from math import hypot,acos,degrees
        with patch.object(sys,"path",[os.environ["MIDDLE_SKILL_PATH"],*sys.path]):
            from export import lookup
            for design in ("apex_from_base","exterior_forward","apex_split"):
                for size in range(2,10):
                    fig=triangle_parts_shape._euclidean_question(design,size,"PQRS",22,False)["figure"]
                    data=lookup(triangle_parts_shape.render(fig)).objects.as_dict()["objects"]
                    p={k["name"]:k["xy"] for k in data["points"]}
                    for center,reverse,wanted in (("Q","R",fig["angles"][0]),("R","Q",fig["angles"][1])):
                        u=tuple(a-b for a,b in zip(p["P"],p[center]))
                        v=tuple(a-b for a,b in zip(p[reverse],p[center]))
                        angle=degrees(acos(sum(a*b for a,b in zip(u,v))/hypot(*u)/hypot(*v)))
                        self.assertAlmostEqual(angle,wanted,places=3)

    def test_named_construction_validation_and_exact_quantities(self):
        from general_source import validate_figure
        from general_geometry import solve_figure_task
        fixture = Path(__file__).parent / "fixtures/grade8-triangle-parts-intake.json"
        scope = scope_for_lesson(json.loads(fixture.read_text()))
        fig = dict(kind="triangle_part", names="MNPK", base=7, left=5, right=6, rotate=0, construction="median")
        validate_figure(fig, scope)
        result = solve_figure_task(fig, "half_base")["result"]["value"]
        self.assertEqual((result["numerator"], result["denominator"]), (7, 2))
        for kind in ("altitude", "angle_bisector", "side_extension"):
            with self.subTest(kind=kind), self.assertRaises(ValueError):
                solve_figure_task({**fig, "construction": kind}, "half_base")
        for bad in ({"names":"MNNK"}, {"names":"<SVG"}, {"construction":[]}, {"left":20},
                    {"base":5, "left":3, "right":7, "construction":"altitude"}, {"rotate":181}):
            with self.subTest(bad=bad), self.assertRaises(GeneralSourceError):
                validate_figure({**fig, **bad}, scope)

    @unittest.skipUnless(os.getenv("MIDDLE_SKILL_PATH"), "needs pinned middle skill")
    def test_svg_objects_measure_declared_triangle_and_each_named_construction(self):
        from math import dist
        with patch.object(sys, "path", [os.environ["MIDDLE_SKILL_PATH"], *sys.path]):
            from export import lookup
            for base, left, right in ((8, 7, 6), (8, 7, 7), (7, 8, 7), (7, 7, 8),
                                      (8, 8, 8), (10, 6, 8), (6, 8, 10), (6, 10, 8)):
                for construction in triangle_parts_shape.PARTS:
                    fig = dict(kind="triangle_part", names="MNPK", base=base, left=left, right=right,
                               rotate=23, construction=construction)
                    if construction == "altitude" and not 0 < triangle_parts_shape.foot_fraction(fig) < 1:
                        continue
                    with self.subTest(fig=fig):
                        objects = lookup(triangle_parts_shape.render(fig)).objects.as_dict()["objects"]
                        points = {p["name"]:p["xy"] for p in objects["points"]}
                        a, b, c = (points[k] for k in fig["names"][:3])
                        d = points["K"]
                        for p, q, length in ((b,c,base), (a,b,left), (a,c,right)):
                            self.assertAlmostEqual(dist(p,q), length, places=4)
                        names = {s["name"] for s in objects["segments"] if s["role"] == "data" and s.get("name")}
                        self.assertEqual(names, {"KP" if construction == "side_extension" else "KM"})
                        bx, by = c[0]-b[0], c[1]-b[1]
                        dx, dy = d[0]-b[0], d[1]-b[1]
                        self.assertAlmostEqual(bx*dy - by*dx, 0, places=4)
                        ratio = (bx*dx + by*dy) / base**2
                        if construction == "side_extension":
                            self.assertGreater(ratio, 1)
                        elif construction == "median":
                            self.assertAlmostEqual(ratio, 0.5, places=5)
                        elif construction == "angle_bisector":
                            self.assertAlmostEqual(ratio, left/(left+right), places=5)
                        else:
                            self.assertAlmostEqual(bx*(a[0]-d[0]) + by*(a[1]-d[1]), 0, places=4)


    def test_checked_coordinate_pair_is_ordered_even_when_one_component_is_zero(self):
        from general_adapters import _answer_text
        from general_geometry import solve_figure_task
        figure = {"kind":"coordinate_plane", "points":[{"name":"G","x":-3,"y":0}]}
        result = solve_figure_task(figure, "coordinate_pair", "G")
        self.assertEqual(_answer_text(result, "", 8), "$(-3, 0)$")
        with self.assertRaises(ValueError):
            solve_figure_task(figure, "coordinate_pair", "Z")

    def test_targeted_correction_preserves_original_authoring_and_rejects_unrelated_replacement(self):
        from copy import deepcopy
        from validation import GenerationError
        lesson = json.loads((Path(__file__).parent/"fixtures/grade8-triangle-parts-intake.json").read_text())
        scope = scope_for_lesson(lesson)
        template=source(lesson)
        rows=[{k:v for k,v in q.items() if k != "star"} for q in template["sections"][0]["questions"]]
        rows[2]["intro"]="השוו בין הצלעות במשולש."
        rows[2]["items"][0]={"prompt":"האם שלושת האורכים יוצרים משולש?",
                             "answer":{"kind":"review","text":"לא, כי 3+5 < 7."}}
        original={"title":template["title"], "rule":template["rule"], "practice":rows[:-3],"challenges":rows[-3:]}
        good=deepcopy(rows[2])
        good["items"][0]["answer"]["text"]="כן. סכום שתי הצלעות הקצרות גדול מן הצלע הארוכה."
        config=dict(api_key="mock",model="fixture",base_url="https://dashscope-intl.aliyuncs.com/compatible-mode/v1")
        for result,ok in [({"q3":good},True),({"q1":good},False),({"q3":deepcopy(rows[2])},False)]:
            control={}
            with self.subTest(ok=ok), patch("provider.build_authoring_context",return_value={}), patch(
                    "provider.request_author_json",side_effect=[original,result]) as net:
                with self.assertRaises(GenerationError) as problem:
                    provider.author_lesson(lesson,revision=control,**config)
                self.assertEqual(problem.exception.code,"TRIANGLE_SOURCE_MISMATCH")
                self.assertEqual([r["question"] for r in control["sourceFindings"]],[3])
                if ok:
                    fixed=control["revise"](control["sourceFindings"])
                    validate_source(lesson,fixed,scope)
                    self.assertEqual(len(fixed["sections"][0]["questions"]),20)
                else:
                    with self.assertRaises(GenerationError):
                        control["revise"](control["sourceFindings"])
                self.assertEqual(net.call_count,2)

    def test_false_assertion_and_plural_coordinate_request_are_separate_findings(self):
        plan=[{"representation":"coordinate_plane"},{"representation":"drawingFromWords"}]
        ans=lambda p,a: {"prompt":p,"answer":a}
        wrong={"kind":"computed","task":{"kind":"evaluate","expression":"5"},"unit":""}
        rows=[{"figure":{"kind":"coordinate_plane"},"items":[ans("רשמו את שיעורי הנקודה K.",wrong)]},
              {"items":[ans("נמקו.",{"kind":"review","text":"לא, כי 2+4 > 9."})]}]
        self.assertEqual([i["question"] for i in triangle_parts_shape.authored_findings(rows,plan)],[1,2])
        rows[0]["items"][0]["answer"]={"kind":"figure","operation":"coordinate_pair","point":"K","unit":""}
        rows[1]["items"][0]["answer"]["text"]="לא, כי 2+4 < 9."
        self.assertEqual(triangle_parts_shape.authored_findings(rows,plan),[])

    def test_measured_angle_and_hebrew_triangle_name_are_normalized_as_complete_islands(self):
        from compact_authoring import spans
        from general_adapters import rich_text
        from general_source import rich
        source="במשולש שווה שוקיים MNP נתון כי ∡NMP = 35 מעלות."
        self.assertEqual(rich_text(rich(spans(source,8),8),8),
                         r"במשולש שווה שוקיים $MNP$ נתון כי $\angle{NMP} = 35°$.")
        with self.assertRaises(GeneralSourceError):
            rich(spans("הסימן ∡MNM אינו שם זווית.",8),8)

if __name__ == "__main__":
    unittest.main()
