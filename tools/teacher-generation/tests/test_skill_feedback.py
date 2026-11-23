import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from gate_policy import decide
from skill_feedback import (FEEDBACK, blocking_feedback, gate_report, parse_adapter, parse_content_truth,
                            parse_house_gates, parse_output_gates, parse_worksheet, read_gate_report,
                            read_skill_feedback)

# Gate output recorded on 2026-11-23 from real Qwen replies rendered offline
# with the pinned elementary skill (grade 3 division and grade 4 order of
# operations). Only fixed gate wording and structural fingerprints appear.
TRUTH_G32 = ("CONTENT-TRUTH GATES: FAIL\n" + "-" * 60 + "\n"
    " ✗ G32  [content.json.questions#4]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    " ✗ G32  [content.json.questions#8]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    " ✗ G32  [content.json.questions#12]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    + "-" * 60 + "\n3 blocking content defect(s). Do not deliver.\n")
TRUTH_G32_G33 = ("CONTENT-TRUTH GATES: FAIL\n" + "-" * 60 + "\n"
    " ✗ G32  [content.json.questions#4]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    " ✗ G32  [content.json.questions#16]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    " ✗ G32  [content.json.questions#20]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — הריצו no_counterexample על תחום חסום ורשמו ב-Ledger\n"
    " ✗ G33  [content.json.questions#20]  פריט 'כל האפשרויות / אילו / האם ייתכן' בלי מנייה רשומה ב-verified.json\n"
    + "-" * 60 + "\n4 blocking content defect(s). Do not deliver.\n")
HOUSE_PASSING = (
    "PASS — G70-answer-layout: 85 Hebrew answer text nodes checked; no known LTR prose container. Custom CSS, meaning and rendered layout need review\n"
    "PASS — G50-★: ★ = 3 — בטווח 2–4\n"
    "PASS — G53-figs: 0 מקורות SVG לכל 0 השרטוטים\n"
    "PASS — G52-claim: אין ראיות `(True, ...)`\n"
    "PASS — G54-כפל·html: כפל = `x` בלבד (1 גליף)\n"
    "PASS — G60-numbers: כל התשובות בטווח היופי של ד\n"
    "PASS — G66-chronology: כרונולוגיית מושגים תקינה לכיתה ד׳ (ד07)\n"
    "PASS — G68-docx: DOCX תקין (94 פסקאות, 10 טבלאות, 45478 בייטים)\n")
HOUSE_G61 = HOUSE_PASSING + "FAIL — G61-level: פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q101=8)\nHOUSE GATES: FAIL (1)\n"
HOUSE_G51_G61 = (HOUSE_PASSING
    + "FAIL — G51-bidi: סוגריים הפוכים סביב תוכן מספרי: p9:') x (' — החליפו למספור באותיות עבריות (טיפוס חזק)\n"
    + "FAIL — G61-level: פער קושי 7 > 4 — הדף מערבב רמות (Q113=1 מול Q43=8)\nHOUSE GATES: FAIL (2)\n")
HOUSE_G61_G62 = (HOUSE_PASSING
    + "FAIL — G61-level: פער קושי 5 > 4 — הדף מערבב רמות (Q11=2 מול Q201=7)\n"
    + "FAIL — G62-clones: 5 פריטים זהים מבנית (Q11, Q31, Q32, Q33, Q142): «#:___=#»; 4 פריטים זהים מבנית (Q12, Q51, Q52, Q53): «#:#=___»\n"
    + "HOUSE GATES: FAIL (2)\n")
OUTPUT_ANSWER_ORDER = (
    "G42-render sheet.pdf                                  PASS    8074 chars swept\n"
    "G43-F2     sheet.pdf                                  PASS    no bare roots\n"
    "G45/G46    sheet.pdf                                  PASS    body font + figures ok\n\n"
    "PDF-answer-LTR FAIL GENERAL_ANSWER_VISUAL_ORDER: 11.\n")
ADAPTER_REFUSAL = (
    "\nTraceback (most recent call last):\n"
    '  File "/opt/noam/app/printed_tasks.py", line 53, in validate_computed_request\n'
    '    raise GeneralSourceError("PRINTED_ANSWER_KIND",\n'
    "general_source.GeneralSourceError: The printed request needs a decision or an equation, not a scalar at q5.item.1\n")


class SkillFeedbackTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)

    def write(self, relative, text):
        path = self.base / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def manifest(self, name, steps):
        self.write("manifest.json", json.dumps({"status": "failed", "skill": {"name": name},
            "steps": [{"name": k, "status": "FAIL"} for k in steps]}))

    def housed(self, lines):
        self.write("logs/house-gates.txt", lines + "\nHOUSE GATES: FAIL (1)")

    def truths(self, numbers):
        self.write("logs/content-truth.txt", "CONTENT-TRUTH GATES: FAIL\n" + "\n".join(
            f" ✗ G32  [content.json.questions#{n}]  טענה כוללת/שלילת קיום ('לכל ') בלי רישום ב-verified.json — טקסט שאין להעביר" for n in numbers))

    def test_real_elementary_grade_four_ids_and_fixed_per_unit_feedback(self):
        self.manifest("elementary", ["content-truth", "house-gates"])
        self.truths([4, 8, 12])
        # The low and high endpoint labels came from the actual production-skill
        # run on 12 questions. Q23 is question 2 item 3, not question 23.
        self.housed("FAIL — G61-level: פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q101=8)")
        out = read_skill_feedback(self.base, 12)
        self.assertEqual([(r["question"], r["codes"]) for r in out],
                         [(2, ["G61"]), (4, ["G32"]), (8, ["G32"]), (10, ["G61"]), (12, ["G32"])])
        easy = out[0]["feedback"][0]
        hard = out[3]["feedback"][0]
        for finding in [easy, hard]:
            self.assertEqual(finding["measuredRange"], [3, 8])
            self.assertEqual(finding["maxSpread"], 4)
            self.assertEqual(finding["maxItemScore"], 7)
        self.assertEqual(easy["items"], [{"item": 3, "measuredScore": 3, "action": "keep"}])
        self.assertEqual(hard["items"], [{"item": 1, "measuredScore": 8, "action": "reduce"}])
        self.assertIn("fewer distinct operation types", hard["instruction"])
        self.assertIn("every item", hard["instruction"])
        unit_feedback = out[1]["feedback"][0]
        for example in ["ONE named unit", "מחיר מחברת אחת", "שווה בשווה בין 4 תלמידים", "keep the quantifier"]:
            self.assertIn(example, unit_feedback)
        self.assertNotIn("טקסט שאין להעביר", str(out))

    def test_profile_ceiling_and_spread_both_apply_to_each_item(self):
        self.manifest("elementary", ["house-gates"])
        self.housed("FAIL — G61-level: פריטים מעל תקרת ג (6): Q21=8, Q31=9; "
                    "פער קושי 5 > 4 — הדף מערבב רמות (Q22=4 מול Q31=9)")
        result = read_skill_feedback(self.base, 12)
        self.assertEqual([r["question"] for r in result], [2, 3])
        for row in result:
            finding = row["feedback"][0]
            self.assertEqual((finding["profileCeiling"], finding["maxItemScore"]), (6, 6))
        self.assertEqual(result[0]["feedback"][0]["items"],
                         [{"item": 1, "measuredScore": 8, "action": "reduce"},
                          {"item": 2, "measuredScore": 4, "action": "keep"}])
        self.housed("FAIL — G61-level: פריטים מעל תקרת ו/מצוינות (12): Q23=14, Q24=15")
        cap = read_skill_feedback(self.base, 12)[0]["feedback"][0]
        self.assertEqual(cap["maxItemScore"], 12)
        self.assertNotIn("measuredRange", cap)
        self.assertEqual([i["action"] for i in cap["items"]], ["reduce", "reduce"])

    def test_rejects_inconsistent_or_unrecognized_measured_difficulty(self):
        self.manifest("elementary", ["house-gates"])
        for finding in [
            "פער קושי 6 > 4 — הדף מערבב רמות (Q23=3 מול Q101=8)",
            "פער קושי 5 > 5 — הדף מערבב רמות (Q23=3 מול Q101=8)",
            "פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q23=8)",
            "פריטים מעל תקרת ג (6): Q23=7",
            "פריטים מעל תקרת untrusted (6): Q23=8",
            "פריטים מעל תקרת ג (6): Q11=10; פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q101=8)",
            "פריטים מעל תקרת ג (6): Q11=8, Q11=9",
        ]:
            with self.subTest(finding=finding):
                self.housed("FAIL — G61-level: " + finding)
                self.assertEqual(read_skill_feedback(self.base, 12), [])

    def test_content_only_bounded_order_dedup_excludes_unactionable_runs(self):
        self.manifest("elementary", ["house-gates"])
        self.housed("FAIL — G62-clones: 4 פריטים זהים מבנית (Q11, Q12, Q23, Q31): «text not forwarded»\n"
                    "FAIL — G66-chronology: Q23: המושג «מושג» טרם נלמד בנושא ד07")
        result = read_skill_feedback(self.base, 12)
        self.assertEqual([r["question"] for r in result], [1, 2, 3])
        self.assertEqual(result[1]["codes"], ["G62", "G66"])
        self.assertNotIn("text not forwarded", str(result))
        for bad in ["FAIL — G62-clones: 9 פריטים זהים מבנית (Q11, Q12, Q23, Q31): «abc»",
                    "FAIL — G99-unknown: Q21", "WARN — G61-level: Q23=3",
                    "FAIL — G61-level: פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q311=8)"]:
            self.housed(bad)
            self.assertEqual(read_skill_feedback(self.base, 12), [])
        self.manifest("elementary", ["content-truth"])
        self.truths(range(1, 8))
        self.assertEqual(read_skill_feedback(self.base, 12), [])
        self.truths([1])
        self.manifest("elementary", ["content-truth", "pdf"])
        self.assertEqual(read_skill_feedback(self.base, 12), [])

    def test_middle_didactic_genuine_blockers_only(self):
        self.manifest("middle", ["middle-build", "didactic-review-reconciliation"])
        self.write("out/v72-report.json", json.dumps({"steps": [{"step":"check_didactic.py", "status":"FAIL"}]}))
        self.write("out/logs/check_didactic.py.log",
            "  FAIL items: q7c\n  REVIEW items: q3b\n    REVIEW D9 q3b  notes\n"
            "    FAIL   D12 q7c      noam-ai.json prints the find target's value at q7c.text (private text)\n")
        r = read_skill_feedback(self.base, 20)
        self.assertEqual([(x["question"], x["codes"]) for x in r], [(7, ["D12"])])
        self.assertNotIn("private", str(r))
        self.write("out/logs/check_didactic.py.log", "  FAIL items: q7c\n    FAIL D12 q19a misleading")
        self.assertEqual(read_skill_feedback(self.base,20), [])

    def test_middle_chronology_accepts_only_question_scoped_results(self):
        self.manifest("middle", ["middle-build"])
        self.write("out/v72-report.json", json.dumps({"steps":[{"step":"build_plus (PDF + gates)","status":"FAIL"}]}))
        head = "AssertionError: G84-chronology FAIL on level 'b' (package=G8-X, track=g8, topic=2):\n"
        self.write("out/logs/build_plus.log", head+"  - q2.ב.text: מופיע המונח 'opaque'\n")
        self.assertEqual(read_skill_feedback(self.base,20)[0]["codes"], ["G84"])
        self.write("out/logs/build_plus.log", head+"  - final_answers[5]: מופיע המונח 'opaque'\n")
        self.assertEqual(read_skill_feedback(self.base,20), [])

    def test_outside_log_symlink_and_unknown_report_paths_are_ignored(self):
        self.manifest("elementary", ["content-truth"])
        with tempfile.TemporaryDirectory() as elsewhere:
            outside = Path(elsewhere)/"data"
            outside.write_text("CONTENT-TRUTH GATES: FAIL\n ✗ G32  [content.json.questions#1]  טענה כוללת/שלילת קיום x")
            (self.base/"logs").mkdir()
            (self.base/"logs/content-truth.txt").symlink_to(outside)
            self.assertEqual(read_skill_feedback(self.base,12), [])


class GateReportTests(unittest.TestCase):
    """The structured report of every finding, over recorded gate output."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)

    def write(self, relative, text):
        path = self.base / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(text, encoding="utf-8")

    def steps(self, **failed):
        return [{"name": name, "status": status, "log": f"logs/{name}.txt"} for name, status in failed.items()]

    def content(self, items_per_question, count=20):
        self.write("content.json", json.dumps({"questions": [
            {"n": str(n), "items": ["x"] * items_per_question, "answer": ""} for n in range(1, count + 1)]}))

    def named(self, report):
        return [(row["code"], row["question"], row.get("item")) for row in report["findings"]]

    def test_recorded_truth_and_difficulty_findings_name_question_and_item(self):
        self.content(3, 12)
        self.write("logs/content-truth.txt", TRUTH_G32)
        self.write("logs/house-gates.txt", HOUSE_G61)
        report = gate_report(self.base, "elementary", self.steps(**{"content-truth": "FAIL", "house-gates": "FAIL"}), 12)
        self.assertTrue(report["complete"])
        self.assertEqual(self.named(report), [("G32", 4, None), ("G32", 8, None), ("G32", 12, None),
                                              ("G61", 2, 3), ("G61", 10, 1)])
        self.assertEqual({row["class"] for row in report["findings"][:3]}, {"truth"})
        self.assertEqual(report["findings"][0]["evidence"], {"word": "לכל"})
        low, high = report["findings"][3:]
        self.assertEqual((low["class"], low["evidence"]), ("editorial", {"clause": "spread", "role": "low", "score": 3, "spread": 5, "limit": 4}))
        self.assertEqual(high["evidence"]["score"], 8)
        self.assertIn("רמת הקושי", high["note"])
        self.assertEqual(report["unnamed"], [])
        decision = decide(report, ["content-truth", "house-gates"])
        self.assertEqual((decision["action"], decision["questions"]), ("replace", [4, 8, 12]))
        self.assertEqual(decision["reviewSteps"], ["house-gates"])

    def test_adapter_record_in_the_work_folder_names_the_refused_question(self):
        self.write("logs/trusted-adapter.txt", "general_source.GeneralSourceError: The exact answer disagrees with the printed task\n")
        steps = [{"name": "trusted-adapter", "status": "FAIL", "log": "logs/trusted-adapter.txt"}]
        report = gate_report(self.base, "elementary", steps, 20)
        self.assertEqual((self.named(report), [row["code"] for row in report["unnamed"]]), ([], ["TRUSTED_ADAPTER"]))
        self.assertEqual(decide(report, ["trusted-adapter"])["action"], "fail")
        self.write("adapter-failure.json", json.dumps({"version": 1, "step": "trusted-adapter", "code": "PRINTED_TASK_MISMATCH",
                                                       "question": 6, "item": 2}))
        report = gate_report(self.base, "elementary", steps, 20)
        self.assertEqual(self.named(report), [("TRUSTED_ADAPTER", 6, 2)])
        self.assertEqual(report["findings"][0]["evidence"], {"error": "GeneralSourceError", "refusal": "PRINTED_TASK_MISMATCH"})
        self.assertEqual((decide(report, ["trusted-adapter"])["action"], decide(report, ["trusted-adapter"])["questions"]), ("replace", [6]))
        # A question outside the sheet, or an unreadable record, names nothing.
        for record in (json.dumps({"code": "PRINTED_TASK_MISMATCH", "question": 21, "item": 1}), "{not json", "x" * 3000):
            self.write("adapter-failure.json", record)
            report = gate_report(self.base, "elementary", steps, 20)
            self.assertEqual((self.named(report), [row["code"] for row in report["unnamed"]]), ([], ["TRUSTED_ADAPTER"]))

    def test_item_digit_is_settled_by_the_trusted_content_file(self):
        # Q113 is question 11 item 3; with eleven items in question 1 it would be ambiguous.
        self.content(3)
        rows, complete = parse_house_gates(HOUSE_G51_G61, None)
        self.assertEqual([(r["code"], r.get("question"), r.get("item")) for r in rows][1:], [("G61", 11, 3), ("G61", 4, 3)])
        self.assertTrue(complete)
        self.write("content.json", json.dumps({"questions": [{"n": "1", "items": ["x"] * 13}, {"n": "11", "items": ["x"] * 3}]}))
        self.write("logs/house-gates.txt", HOUSE_G51_G61)
        report = gate_report(self.base, "elementary", self.steps(**{"house-gates": "FAIL"}), 20)
        # An ambiguous label names nothing, and the finding stays (editorial, unnamed).
        self.assertEqual([row["code"] for row in report["unnamed"]], ["G51", "G61", "G61"])

    def test_bracket_sample_blocks_until_the_engine_measures_it_again(self):
        self.content(3)
        self.write("logs/house-gates.txt", HOUSE_G51_G61)
        steps = self.steps(**{"house-gates": "FAIL"})
        report = gate_report(self.base, "elementary", steps, 20)
        bracket = report["unnamed"][0]
        self.assertEqual((bracket["code"], bracket["class"]), ("G51", "truth"))
        self.assertEqual(bracket["evidence"], {"samples": 1, "pages": [9], "closedList": True, "productsOnly": True})
        self.assertEqual(decide(report, ["house-gates"])["action"], "fail")
        steps.append({"name": "bracket-order-reconciliation", "status": "PASS", "log": "logs/bracket-order-reconciliation.txt"})
        for measured, action in (({"status": "RECONCILED", "matches": 1, "unbalanced": 0}, "deliver"),
                                 ({"status": "UNBALANCED", "matches": 2, "unbalanced": 1}, "fail"),
                                 ({"status": "RECONCILED", "matches": 0, "unbalanced": 0}, "fail")):
            self.write("logs/bracket-order.json", json.dumps(measured))
            decision = decide(gate_report(self.base, "elementary", steps, 20), ["house-gates"])
            self.assertEqual(decision["action"], action, measured)
        self.assertEqual([row["code"] for row in decision["blocking"]], ["G51"])

    def test_clone_groups_answer_order_and_adapter_refusal(self):
        self.content(3)
        rows, complete = parse_house_gates(HOUSE_G61_G62, None)
        self.assertTrue(complete)
        clones = [(r["question"], r["item"]) for r in rows if r["code"] == "G62"]
        self.assertEqual(clones, [(1, 1), (3, 1), (3, 2), (3, 3), (14, 2), (1, 2), (5, 1), (5, 2), (5, 3)])
        self.assertEqual({r["class"] for r in rows}, {"editorial"})
        rows, complete = parse_output_gates(OUTPUT_ANSWER_ORDER)
        self.assertEqual((rows[0]["code"], rows[0]["class"], rows[0]["question"], complete), ("ANSWER_ORDER", "truth", 11, True))
        rows, _ = parse_adapter(ADAPTER_REFUSAL)
        self.assertEqual((rows[0]["code"], rows[0]["class"], rows[0]["question"], rows[0]["item"]), ("TRUSTED_ADAPTER", "truth", 5, 1))
        self.assertEqual(rows[0]["evidence"], {"error": "GeneralSourceError"})
        rows, _ = parse_adapter("AssertionError: [3.2.intent] claim is FALSE — counterexample 7: private words")
        self.assertEqual((rows[0]["question"], rows[0]["item"]), (3, 2))
        rows, _ = parse_adapter("general_source.GeneralSourceError: The printed words and exact counting key disagree")
        self.assertNotIn("question", rows[0])
        # The adapter's structured record names the question when the message does not.
        refused = "general_source.GeneralSourceError: The printed words and exact counting key disagree\n"
        rows, _ = parse_adapter(refused, record={"version": 1, "step": "trusted-adapter",
                                                 "code": "PRINTED_TASK_MISMATCH", "question": 7, "item": 3})
        self.assertEqual((rows[0]["question"], rows[0]["item"], rows[0]["evidence"]),
                         (7, 3, {"error": "GeneralSourceError", "refusal": "PRINTED_TASK_MISMATCH"}))
        # A record without a position keeps its code, and the message position still counts.
        rows, _ = parse_adapter(ADAPTER_REFUSAL, record={"code": "PRINTED_ANSWER_KIND", "question": None, "item": None})
        self.assertEqual((rows[0]["question"], rows[0]["item"], rows[0]["evidence"]["refusal"]), (5, 1, "PRINTED_ANSWER_KIND"))
        rows, _ = parse_adapter(refused, record={"code": "SOURCE_FIGURE", "question": 4, "item": 12})
        self.assertEqual((rows[0]["question"], rows[0].get("item")), (4, None))
        for forged in ({"code": "x y", "question": 700}, {"question": "7"}, "not a record", [1], {"question": True, "item": 2}):
            rows, _ = parse_adapter(refused, record=forged)
            self.assertEqual((rows[0]["code"], rows[0].get("question"), rows[0]["evidence"]), ("TRUSTED_ADAPTER", None, {"error": "GeneralSourceError"}))
        self.assertNotIn("private", json.dumps(rows))

    def test_every_house_line_is_classified_and_unknown_lines_block(self):
        self.content(3)
        lines = {
            "G70-answer-layout: Hebrew answer text in LTR container (1): line 3: private": ("G70", "truth", None),
            "G50-★: ★ = 9 — כלל הבית הוא 2–4 לדף (style.md §5).": ("G50", "editorial", None),
            "G52-claim: ראיה שחותמת על עצמה `(True, ...)` ב: g.py:1": ("G52", "truth", None),
            "G54-כפל·pdf: גליף כפל שגוי": ("G54", "policy", None),
            "G54-G59·pdf: SKIPPED — pymupdf חסר": ("GATE_NOT_RUN", "truth", None),
            "G60-G69-content: לא נמסר --content — שערי התוכן לא רצו; שער שדולג = כשל": ("GATE_NOT_RUN", "truth", None),
            "G60-numbers: Q23: 4/8 לא מצומצם (÷4)": ("G60", "truth", 2),
            "G65-answer-placeholders: 71: מציין המקום «נימוק» אינו תשובה סופית": ("G65", "truth", 7),
            "G66-chronology: Q23: המושג «אחוז» אסור בכיתה ד׳ (נלמד בכיתה גבוהה יותר)": ("G66", "policy", 2),
            "G66-chronology: Q51: היפוך סדר מנה ושארית בתשובה «שארית 21; 7» — נדרש '<מנה> שארית <שארית>'": ("G66_FLIP", "truth", 5),
            "G63-geometry: Q31:q3.svg: תווית «A» חורגת מה-viewBox (1.0,2.0)–(3.0,4.0)": ("G63", "truth", 3),
            "G64-svg-signs: Q31:q3.svg: מקף ASCII כמינוס ב-«-3» — נדרש U+2212": ("G64", "policy", 3),
            "G69-drawings: איסור שרטוטים בכל חלקי דף שאינו גיאומטריה (הוראת 29.10.2026): HTML": ("G69", "policy", None),
            "G68-docx: קובץ Word לא נמצא: sheet.docx": ("G68", "truth", None),
            "G99-new: something this reader has never seen": ("UNREADABLE", "truth", None),
        }
        for line, (code, kind, question) in lines.items():
            with self.subTest(line=line[:24]):
                rows, complete = parse_house_gates("FAIL — " + line + "\nHOUSE GATES: FAIL (1)\n", None)
                self.assertEqual((rows[0]["code"], rows[0]["class"], rows[0].get("question")), (code, kind, question))
                self.assertEqual(complete, code != "UNREADABLE")
                self.assertNotIn("private", json.dumps(rows, ensure_ascii=False))
                self.assertEqual(decide({"findings": [r for r in rows if "question" in r],
                                         "unnamed": [r for r in rows if "question" not in r], "complete": complete},
                                        ["house-gates"])["action"] == "deliver", kind == "editorial")
        # More findings than the gate printed: the remainder is an unnamed finding.
        rows, _ = parse_house_gates("FAIL — G60-numbers: Q23: מכנה 0; Q31: מכנה 0 …(+3)\nHOUSE GATES: FAIL (1)\n", None)
        self.assertEqual([r.get("question") for r in rows], [2, 3, None])
        # A crash, a wrong count and a missing summary are never a complete report.
        for text in ("Traceback (most recent call last):\nValueError", HOUSE_G61.replace("FAIL (1)", "FAIL (2)"),
                     "FAIL — G61-level: פער קושי 5 > 4 — הדף מערבב רמות (Q23=3 מול Q101=8)\n"):
            self.assertFalse(parse_house_gates(text, None)[1])

    def test_worksheet_page_fill_is_editorial_and_everything_else_blocks(self):
        fill = "FAIL — page-3.png: near-empty page (ink reaches 12% of height); page-04.png: giant interior gap (52mm of blank rows)\n"
        tail = "=" * 50 + "\nGATE: FAIL — fix and regenerate, DO NOT deliver\n"
        rows, complete = parse_worksheet("PASS — text OK (1977 Hebrew chars, 0 U+FFFD)\n" + fill + tail)
        self.assertEqual([(r["code"], r["class"], r["evidence"]) for r in rows],
                         [("PAGE_FILL", "editorial", {"page": 3}), ("PAGE_GAP", "editorial", {"page": 4})])
        self.assertTrue(complete)
        cases = {"brand line missing on page(s) [2] — every page must carry 'x'": "WS_BRAND",
                 "3 U+FFFD replacement chars found": "WS_TEXT", "page-1.png: page appears EMPTY": "PAGE_EMPTY",
                 "reversed-Hebrew tokens (broken RTL in SVG?): ['x']": "WS_REVERSED_HEBREW",
                 "page-1.png: near-empty page (ink reaches 9% of height); something new": "UNREADABLE",
                 "a message nobody has seen": "UNREADABLE"}
        for message, code in cases.items():
            rows, complete = parse_worksheet(fill + "FAIL — " + message + "\n" + tail)
            self.assertEqual(rows[-1]["code"], code)
            self.assertNotEqual(rows[-1]["class"], "editorial")
            self.assertEqual(decide({"findings": [], "unnamed": rows, "complete": complete}, ["worksheet"])["action"], "fail")
        self.assertFalse(parse_worksheet("FAIL: file not found: sheet.pdf\n")[1])

    def test_output_gates_rows_and_skipped_gate(self):
        blocked = ("BUILD BLOCKED — output gates did not all pass:\n"
                   "  sheet.pdf :: G42-render :: FAIL :: 2 inline slash division(s) — a division is a stacked fraction, never `a/b`\n"
                   "  sheet.pdf :: G43-F2 :: SKIPPED :: no PDF text extractor available\n"
                   "  sheet.pdf :: G45/G46 :: FAIL :: G45: body font is 'FreeSerif' (293/459 chars), expected David Libre; G46: p2 figure outside the page box [0, 1, 2, 3]\n")
        rows, complete = parse_output_gates(blocked)
        self.assertEqual([(r["code"], r["class"]) for r in rows],
                         [("G42", "policy"), ("GATE_NOT_RUN", "truth"), ("G45", "policy"), ("G46", "truth")])
        self.assertEqual(rows[3]["evidence"], {"page": 2})
        self.assertTrue(complete)
        self.assertFalse(parse_output_gates("BUILD BLOCKED — output gates did not all pass:\n  unknown shape\n")[1])
        self.assertFalse(parse_output_gates("Traceback (most recent call last):\nKeyError: 1\n")[1])
        rows, _ = parse_output_gates("PDF-answer-LTR FAIL PDF_ANSWER_HEADING_MISSING_OR_AMBIGUOUS\n")
        self.assertNotIn("question", rows[0])

    def test_content_truth_unknown_gate_and_counts(self):
        rows, complete = parse_content_truth(TRUTH_G32_G33)
        self.assertEqual([(r["code"], r["question"]) for r in rows], [("G32", 4), ("G32", 16), ("G32", 20), ("G33", 20)])
        self.assertTrue(complete)
        rows, complete = parse_content_truth(TRUTH_G32.replace("G32  [content.json.questions#4]", "G99  [content.json.questions#4]"))
        self.assertEqual((rows[0]["code"], rows[0]["class"], complete), ("G99", "truth", True))
        self.assertFalse(parse_content_truth(TRUTH_G32.replace("3 blocking", "2 blocking"))[1])
        rows, complete = parse_content_truth(TRUTH_G32.replace(" ✗ G32  [content.json.questions#8]", " ✗ odd line"))
        self.assertEqual((rows[1]["code"], complete), ("UNREADABLE", False))
        whole = parse_content_truth(TRUTH_G32.replace("content.json.questions#4", "<whole-document>"))[0][0]
        self.assertNotIn("question", whole)

    def test_timeouts_missing_logs_and_out_of_range_numbers_block(self):
        self.content(3, 12)
        steps = [{"name": "pdf", "status": "FAIL", "reason": "RENDER_TIMEOUT"},
                 {"name": "word", "status": "FAIL", "exitCode": 1, "log": "logs/word.txt"},
                 {"name": "house-gates", "status": "FAIL", "exitCode": 1, "log": "logs/house-gates.txt"},
                 {"name": "artifact-presence", "status": "FAIL"}, {"name": "brand-new-step", "status": "FAIL"}]
        report = gate_report(self.base, "elementary", steps, 12)
        self.assertEqual([(row["code"], row["step"]) for row in report["unnamed"]],
                         [("RENDER_TIMEOUT", "pdf"), ("WORD_BUILD", "word"), ("UNREADABLE", "house-gates"),
                          ("ARTIFACT_MISSING", "artifact-presence"), ("STEP_FAILED", "brand-new-step")])
        self.assertFalse(report["complete"])
        self.assertEqual({row["class"] for row in report["unnamed"]}, {"truth"})
        self.write("logs/content-truth.txt", TRUTH_G32_G33)
        report = gate_report(self.base, "elementary", self.steps(**{"content-truth": "FAIL"}), 12)
        self.assertEqual(self.named(report), [("G32", 4, None)])
        self.assertEqual([row["code"] for row in report["unnamed"]], ["G32", "G32", "G33"])
        self.assertEqual(decide(report, ["content-truth"])["action"], "fail")
        with tempfile.TemporaryDirectory() as elsewhere:
            (Path(elsewhere) / "leak.txt").write_text(TRUTH_G32)
            (self.base / "logs/content-truth.txt").unlink()
            (self.base / "logs/content-truth.txt").symlink_to(Path(elsewhere) / "leak.txt")
            report = gate_report(self.base, "elementary", self.steps(**{"content-truth": "FAIL"}), 12)
            self.assertEqual((report["findings"], [row["code"] for row in report["unnamed"]]), ([], ["UNREADABLE"]))
        self.assertEqual(read_gate_report(self.base / "missing", 12)["unnamed"][0]["code"], "UNREADABLE")

    def middle(self, steps, **logs):
        self.write("out/v72-report.json", json.dumps({"steps": [{"step": name, "status": status} for name, status in steps]}))
        for name, text in logs.items():
            self.write("out/logs/" + name, text)
        self.write("manifest.json", json.dumps({"status": "failed", "skill": {"name": "middle"}, "steps": [
            {"name": "trusted-adapter", "status": "PASS"}, {"name": "middle-build", "status": "FAIL", "log": "logs/middle-build.txt"},
            {"name": "didactic-review-reconciliation", "status": "FAIL", "log": "logs/didactic-review-reconciliation.txt"}]}))
        return read_gate_report(self.base, 20)

    def test_middle_blocking_findings_name_question_and_item(self):
        report = self.middle([("build_plus (PDF + gates)", "PASS"), ("check_didactic.py", "FAIL"), ("selfcheck_noam_package.py", "FAIL")],
            **{"check_didactic.py.log": "  FAIL items: q7c, q9\n  REVIEW items: q3b\n    REVIEW D9  q3b      notes\n"
                                        "    FAIL   D12 q7c      noam-ai.json prints the find target's value at q7c.text (private text)\n"
                                        "    FAIL   D6  q9       names a tool that is not yet allowed\n"
                                        "    FAIL   D8  fig-2    SVG x.svg missing\n",
               "selfcheck_noam_package.py.log": "out/deliver/b: 2 error(s)\n    K6 q4 given names AB, which no figure of q4 defines\n"
                                                "    K4 f1: SVG 'x.svg' missing\nselfcheck_noam_package: 2 error(s)\n"})
        self.assertEqual(self.named(report), [("D12", 7, 3), ("D6", 9, None), ("K6", 4, None)])
        self.assertEqual([row["class"] for row in report["findings"]], ["truth", "policy", "truth"])
        self.assertEqual([(row["code"], row["class"]) for row in report["unnamed"]], [("D8", "truth"), ("SELFCHECK", "truth")])
        self.assertTrue(report["complete"])
        self.assertNotIn("private", json.dumps(report))
        self.assertEqual(decide(report, ["middle-build", "didactic-review-reconciliation"])["action"], "fail")

    def test_middle_chronology_other_steps_and_unreadable_reports(self):
        head = "AssertionError: G84-chronology FAIL on level 'b' (package=G8-X, track=g8, topic=2):\n"
        report = self.middle([("build_plus (PDF + gates)", "FAIL")],
                             **{"build_plus.log": head + "  - q2.ב.text: מופיע המונח 'opaque'\n  - final_answers[5]: מופיע המונח 'opaque'\n"})
        self.assertEqual((self.named(report), [row["code"] for row in report["unnamed"]]), ([("G84", 2, None)], ["G84"]))
        self.assertEqual(report["findings"][0]["class"], "policy")
        report = self.middle([("build_plus (PDF + gates)", "FAIL")], **{"build_plus.log": "AssertionError: G83 sketch share\n"})
        self.assertEqual([(row["code"], row["class"]) for row in report["unnamed"]], [("G83", "truth")])
        report = self.middle([("verify_export.py", "FAIL"), ("emit_docx b", "FAIL"), ("check_docx_rtl b", "FAIL"),
                              ("gate_sections G85–G92", "FAIL"), ("a step from the future", "FAIL")])
        self.assertEqual([row["code"] for row in report["unnamed"]],
                         ["VERIFY_EXPORT", "EMIT_DOCX", "DOCX_RTL", "GATE_SECTIONS", "UNREADABLE", ])
        self.assertFalse(report["complete"])
        # REVIEW rows alone failed the pinned driver and the reconciliation refused: nothing explains it.
        report = self.middle([("check_didactic.py", "FAIL")], **{"check_didactic.py.log": "  REVIEW items: q3b\n    REVIEW D9  q3b      notes\n"})
        self.assertEqual(([row["code"] for row in report["unnamed"]], report["complete"]), (["UNREADABLE"], False))
        (self.base / "out/v72-report.json").unlink()
        self.assertEqual(read_gate_report(self.base, 20)["unnamed"][0]["code"], "UNREADABLE")

    def test_blocking_feedback_asks_only_for_the_questions_that_block(self):
        self.content(3, 12)
        steps = {"content-truth": "FAIL", "house-gates": "FAIL"}
        manifest = {"status": "failed", "skill": {"name": "elementary"}, "steps": self.steps(**steps)}
        self.write("manifest.json", json.dumps(manifest))
        self.write("logs/content-truth.txt", TRUTH_G32)
        self.write("logs/house-gates.txt", HOUSE_G61)
        rows = blocking_feedback(self.base, 12)
        # The closed correction view also asks about the two difficulty endpoints; this one does not.
        self.assertEqual([(r["question"], r["codes"]) for r in read_skill_feedback(self.base, 12)],
                         [(2, ["G61"]), (4, ["G32"]), (8, ["G32"]), (10, ["G61"]), (12, ["G32"])])
        self.assertEqual([(r["question"], r["codes"], r["feedback"]) for r in rows],
                         [(n, ["G32"], [FEEDBACK["G32"]]) for n in (4, 8, 12)])
        # Clone and difficulty findings no longer exhaust the six-question budget.
        self.write("logs/house-gates.txt", HOUSE_G61_G62)
        self.assertEqual(read_skill_feedback(self.base, 12), [])
        self.assertEqual([r["question"] for r in blocking_feedback(self.base, 12)], [4, 8, 12])
        self.write("logs/content-truth.txt", TRUTH_G32_G33.replace("#16]", "#6]").replace("#20]", "#9]"))
        self.assertEqual([(r["question"], r["codes"]) for r in blocking_feedback(self.base, 12)],
                         [(4, ["G32"]), (6, ["G32"]), (9, ["G32", "G33"])])
        # Nothing is asked when a blocking finding names no question, has no fixed instruction,
        # or when the sheet is not failed.
        self.write("logs/house-gates.txt", HOUSE_G51_G61)
        self.assertEqual(blocking_feedback(self.base, 12), [])
        self.write("logs/house-gates.txt", "FAIL — G60-numbers: Q23: מכנה 0\nHOUSE GATES: FAIL (1)\n")
        self.assertEqual(blocking_feedback(self.base, 12), [])
        self.write("logs/house-gates.txt", HOUSE_G61)
        self.write("manifest.json", json.dumps({**manifest, "status": "needs_review"}))
        self.assertEqual(blocking_feedback(self.base, 12), [])
        self.assertEqual(blocking_feedback(self.base / "missing", 12), [])
        self.write("manifest.json", json.dumps(manifest))
        self.write("logs/content-truth.txt", TRUTH_G32.replace("3 blocking", "9 blocking"))
        self.assertEqual(blocking_feedback(self.base, 12), [])

    def test_reconciled_didactic_review_rows_become_teacher_notes(self):
        self.write("logs/didactic-review.json", json.dumps({"status": "REVIEW", "code": "DIDACTIC_REVIEW", "count": 3, "findings": [
            {"rule": "D12", "item": "q1a", "detail": "private detail"}, {"rule": "D5", "item": "q1a", "detail": "x"},
            {"rule": "D10", "item": "q19c", "detail": "x"}]}))
        steps = [{"name": "middle-build", "status": "REVIEW", "log": "logs/middle-build.txt"},
                 {"name": "didactic-review-reconciliation", "status": "PASS", "log": "logs/didactic-review-reconciliation.txt"}]
        report = gate_report(self.base, "middle", steps, 20)
        self.assertEqual(self.named(report), [("DIDACTIC_REVIEW", 1, 1), ("DIDACTIC_REVIEW", 1, 1), ("DIDACTIC_REVIEW", 19, 3)])
        self.assertEqual([row["evidence"] for row in report["findings"]], [{"rule": "D12"}, {"rule": "D5"}, {"rule": "D10"}])
        decision = decide(report, [])
        self.assertEqual(decision["action"], "deliver")
        self.assertEqual([(r["code"], r["count"], r["questions"], r["rules"]) for r in decision["reviewFindings"]],
                         [("DIDACTIC_REVIEW", 3, [1, 19], {"D12": 1, "D5": 1, "D10": 1})])
        self.assertNotIn("private", json.dumps(report))


if __name__ == "__main__":
    unittest.main()
