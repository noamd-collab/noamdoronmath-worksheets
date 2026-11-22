import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from skill_feedback import read_skill_feedback


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


if __name__ == "__main__":
    unittest.main()
