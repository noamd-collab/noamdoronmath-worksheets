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
        self.assertIn("ONE named unit", out[1]["feedback"][0])
        self.assertNotIn("טקסט שאין להעביר", str(out))

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
