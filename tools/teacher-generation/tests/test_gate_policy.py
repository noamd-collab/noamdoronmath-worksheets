"""Gate classes, the delivery decision and the runner's lesson delivery policy."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(HERE), str(Path(__file__).resolve().parent)]
import gate_policy as policy
import remote_worker as worker
import runner
from gate_policy import EDITORIAL, POLICY, TRUTH, decide, finding, public_review_findings
from test_skill_feedback import (ADAPTER_REFUSAL, HOUSE_G51_G61, HOUSE_G61, HOUSE_G61_G62, HOUSE_PASSING,
                                 OUTPUT_ANSWER_ORDER, TRUTH_G32)

# The recorded bracket sample of HOUSE_G51_G61 alone.
HOUSE_G51 = HOUSE_G51_G61.split("FAIL — G61-level")[0] + "HOUSE GATES: FAIL (1)\n"


def report(*rows, complete=True):
    return {"version": 1, "skill": "elementary", "complete": complete,
            "findings": [row for row in rows if "question" in row],
            "unnamed": [row for row in rows if "question" not in row]}


class TableTests(unittest.TestCase):
    def test_every_code_has_one_class_and_only_editorial_codes_carry_a_note(self):
        self.assertTrue(all(kind in (TRUTH, POLICY, EDITORIAL) and type(named) is bool
                            for kind, named in policy.GATES.values()))
        editorial = {code for code, (kind, _) in policy.GATES.items() if kind == EDITORIAL}
        self.assertEqual(editorial, {"G50", "G61", "G62", "PAGE_FILL", "PAGE_GAP", "DIDACTIC_REVIEW", "SHORTER_SHEET"})
        self.assertEqual(set(policy.NOTES), editorial)
        for note in policy.NOTES.values():
            self.assertRegex(note, r"^[א-ת0-9 ,.:()★-]+$")

    def test_unknown_codes_adapter_and_printed_key_failures_are_truth(self):
        for code in ("G99", "", None, "NEW_GATE", "TRUSTED_ADAPTER", "ANSWER_ORDER", "G32", "G60", "G65",
                     "RENDER_TIMEOUT", "STEP_FAILED", "UNREADABLE", "D12", "K6", "G51", "PRINTED_TASK_MISMATCH",
                     "PRINTED_ANSWER_KIND", "PRINTED_EXPRESSION_SCOPE", "PRINTED_EXPRESSION_MISMATCH",
                     "UNVERIFIED_ANSWERS", "UNVERIFIED_FIGURE", "SOURCE_NOTATION", "INVALID_TASK"):
            self.assertEqual(policy.gate_class(code), TRUTH, code)
        self.assertEqual([policy.gate_class(code) for code in ("G66", "G84", "G69", "G54", "D6", "DRAWING_POLICY", "SOURCE_NIQQUD")],
                         [POLICY] * 7)
        self.assertTrue(policy.names_questions("G32"))
        self.assertFalse(policy.names_questions("PAGE_FILL"))
        self.assertFalse(policy.names_questions("G99"))
        self.assertEqual(set(policy.STEP_CODES.values()) - set(policy.GATES), set())

    def test_a_forged_editorial_class_or_reconciliation_does_not_unblock(self):
        forged = {"code": "G32", "class": "editorial", "step": "content-truth", "question": 3}
        self.assertTrue(policy.blocks(forged))
        self.assertTrue(policy.blocks({**forged, "reconciled": True}))
        # G51 is never measured again: a row that says reconciled still blocks.
        self.assertTrue(policy.blocks({"code": "G51", "class": "truth", "step": "house-gates", "reconciled": True}))
        self.assertTrue(policy.blocks(finding("G51", "house-gates")))
        self.assertEqual(policy.RECONCILIATION_STEPS, frozenset({"didactic-review-reconciliation"}))
        self.assertFalse(hasattr(policy, "RECONCILABLE"))
        for code in ("G50", "G61", "G62", "PAGE_FILL", "PAGE_GAP", "SHORTER_SHEET"):
            self.assertTrue(policy.blocks(finding(code, "house-gates", 2)), code)
            self.assertTrue(policy.blocks(finding(code, "worksheet")), code)
        # The one editorial row that does not block: middle-build DIDACTIC_REVIEW, already reconciled by the runner.
        self.assertFalse(policy.blocks(finding("DIDACTIC_REVIEW", "middle-build", 2)))
        self.assertTrue(policy.blocks(finding("DIDACTIC_REVIEW", "house-gates", 2)))
        self.assertTrue(policy.blocks({**finding("DIDACTIC_REVIEW", "middle-build", 2), "class": "truth"}))


class DecisionTests(unittest.TestCase):
    def test_editorial_findings_block_and_name_their_questions(self):
        rows = [finding("G61", "house-gates", 2, 3, score=3), finding("G61", "house-gates", 10, 1, score=8),
                finding("G62", "house-gates", 3, 1), finding("PAGE_FILL", "worksheet", page=4)]
        decision = decide(report(*rows[:3]), ["house-gates"])
        self.assertEqual((decision["action"], decision["questions"]), ("replace", [2, 3, 10]))
        self.assertEqual(decision["blocking"], [
            {"code": "G61", "class": EDITORIAL, "step": "house-gates", "question": 2, "item": 3},
            {"code": "G61", "class": EDITORIAL, "step": "house-gates", "question": 10, "item": 1},
            {"code": "G62", "class": EDITORIAL, "step": "house-gates", "question": 3, "item": 1}])
        self.assertEqual((decision["reviewSteps"], decision["reviewFindings"]), ([], []))
        # A page-fill finding names no question: nothing can be replaced, the render fails.
        decision = decide(report(*rows), ["house-gates", "worksheet"])
        self.assertEqual((decision["action"], decision["questions"]), ("fail", [2, 3, 10]))
        self.assertEqual([(b["code"], b["step"]) for b in decision["blocking"]],
                         [("G61", "house-gates"), ("G61", "house-gates"), ("G62", "house-gates"), ("PAGE_FILL", "worksheet")])
        self.assertEqual((decision["reviewSteps"], decision["reviewFindings"]), ([], []))

    def test_named_truth_and_policy_findings_ask_for_those_questions(self):
        rows = [finding("G32", "content-truth", 8), finding("G32", "content-truth", 4), finding("G66", "house-gates", 4, 2),
                finding("G61", "house-gates", 10, 1)]
        decision = decide(report(*rows), ["content-truth", "house-gates"])
        self.assertEqual((decision["action"], decision["questions"]), ("replace", [4, 8, 10]))
        self.assertEqual([(b["code"], b["class"], b["question"]) for b in decision["blocking"]],
                         [("G32", TRUTH, 8), ("G32", TRUTH, 4), ("G66", POLICY, 4), ("G61", EDITORIAL, 10)])
        self.assertEqual(decision["reviewSteps"], [])  # house-gates also holds a blocking finding
        self.assertEqual(decision["reviewFindings"], [])

    def test_unnamed_unknown_incomplete_and_unexplained_failures_block(self):
        named = finding("G32", "content-truth", 4)
        cases = [
            (report(named, finding("G53", "house-gates")), ["content-truth", "house-gates"], "G53"),
            (report(named, finding("G99", "house-gates")), ["content-truth", "house-gates"], "G99"),
            (report(named, finding("RENDER_TIMEOUT", "pdf")), ["content-truth", "pdf"], "RENDER_TIMEOUT"),
            (report(finding("G61", "house-gates", 2)), ["house-gates", "pdf"], "PDF_BUILD"),
            (report(finding("G61", "house-gates", 2)), ["house-gates", "mystery-step"], "STEP_FAILED"),
            (report(finding("G61", "house-gates", 2), complete=False), ["house-gates"], "UNREADABLE"),
            (report(named, complete=False), ["content-truth"], "UNREADABLE"),
            (report(), ["house-gates"], "STEP_FAILED"),
        ]
        for value, failed, code in cases:
            decision = decide(value, failed)
            self.assertEqual(decision["action"], "fail", code)
            self.assertIn(code, [row["code"] for row in decision["blocking"]])
        # The didactic reconciliation step that refused adds nothing of its own.
        decision = decide(report(finding("G61", "house-gates", 2)), ["house-gates", "didactic-review-reconciliation"])
        self.assertEqual((decision["action"], decision["questions"], [b["code"] for b in decision["blocking"]]),
                         ("replace", [2], ["G61"]))
        # The removed bracket reconciliation is an unknown step now: its failure blocks and names nothing.
        decision = decide(report(finding("G61", "house-gates", 2)), ["house-gates", "bracket-order-reconciliation"])
        self.assertEqual((decision["action"], decision["questions"]), ("fail", [2]))
        self.assertEqual([(b["code"], b["step"]) for b in decision["blocking"]],
                         [("G61", "house-gates"), ("STEP_FAILED", "bracket-order-reconciliation")])
        self.assertEqual(decide(report(), [])["action"], "deliver")

    def test_only_fixed_editorial_notes_reach_the_job_result(self):
        rows = [{"code": "G61", "class": "editorial", "count": 2, "questions": [10, 2, 2, 31, "7", 0], "note": "FORGED", "steps": ["x"]},
                {"code": "DIDACTIC_REVIEW", "count": 62},
                {"code": "G51", "class": "reconciled", "count": 1, "questions": []},
                {"code": "G32", "class": "editorial", "count": 1, "note": "FORGED"},
                {"code": "G62", "count": 0}, {"code": "G62", "count": 2001}, {"code": "G62", "count": True},
                {"code": "DIDACTIC_REVIEW", "class": "reconciled", "count": 3}, "text", None]
        self.assertEqual(public_review_findings(rows), [
            {"code": "G61", "count": 2, "note": policy.NOTES["G61"], "questions": [2, 10]},
            {"code": "DIDACTIC_REVIEW", "count": 62, "note": policy.NOTES["DIDACTIC_REVIEW"]}])
        self.assertEqual(public_review_findings("G61"), [])
        self.assertNotIn("FORGED", json.dumps(public_review_findings(rows), ensure_ascii=False))


class RunnerPolicyTests(unittest.TestCase):
    """render_job and precheck_job with recorded gate output and no real skill."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / "job"
        self.skill = Path(self.tmp.name) / "skill"
        self.skill.mkdir()
        self.lesson = {"version": 3, "gradeNumber": 4, "topicId": "ד07", "level": "b", "questionCount": 12}
        self.calls = []

    def execute(self, outputs, timeout=None):
        def run(args, **kwargs):
            name = Path(args[2]).name
            self.calls.append(name)
            if name == timeout:
                raise runner.subprocess.TimeoutExpired(args, 240)
            if name == "general_adapters.py" and outputs.get(name, ("", 0))[1] == 0:
                (self.work / "content.json").write_text(json.dumps({"questions": [
                    {"n": str(n), "items": ["a", "b", "c"], "answer": ""} for n in range(1, 13)]}))
            if name in ("build_pdf.py", "build_docx.py"):
                (self.work / ("sheet.pdf" if name == "build_pdf.py" else "sheet.docx")).write_bytes(name.encode())
            for relative, data in outputs.get("files", {}).get(name, {}).items():
                path = self.work / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(data)
            text, code = outputs.get(name, ("", 0))
            return SimpleNamespace(stdout=text, stderr="", returncode=code)
        return run

    def render(self, outputs, timeout=None, lesson=None, precheck=False):
        with patch.object(runner, "validate_model", return_value={"skill": "elementary"}), \
             patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "pinned", "sha256": "a" * 64})), \
             patch("runtime_catalog.scope_for_lesson", return_value={}), \
             patch.object(runner.subprocess, "run", side_effect=self.execute(outputs, timeout)):
            job = runner.precheck_job if precheck else runner.render_job
            return job(lesson or self.lesson, {}, self.work, skill_paths={"elementary": self.skill})

    def statuses(self, manifest):
        return {step["name"]: step["status"] for step in manifest["steps"]}

    def test_editorial_findings_fail_the_render(self):
        manifest = self.render({"house_gates.py": (HOUSE_G61_G62, 1)})
        self.assertEqual((manifest["status"], manifest["artifacts"], manifest["reviewFindings"]), ("failed", [], []))
        self.assertFalse(manifest["automatedChecksPassed"])
        self.assertFalse(manifest["renderingChecksPassed"])
        gates = next(step for step in manifest["steps"] if step["name"] == "house-gates")
        self.assertEqual((gates["status"], gates.get("reason"), gates["exitCode"]), ("FAIL", None, 1))
        self.assertNotIn("REVIEW", [step["status"] for step in manifest["steps"]])
        # The recorded sheet had 20 questions; this one has 12, so Q201 and Q142 name nothing here
        # and nothing can be replaced: the action is fail.
        gate = manifest["gate"]
        self.assertEqual((gate["action"], gate["questions"], gate["review"]), ("fail", [1, 3, 5], []))
        self.assertEqual([(b["code"], b["class"], b.get("question"), b.get("item")) for b in gate["blocking"]],
                         [("G61", EDITORIAL, 1, 1)] + [("G62", EDITORIAL, q, i) for q, i in ((1, 1), (3, 1), (3, 2), (3, 3), (1, 2),
                                                                                         (5, 1), (5, 2), (5, 3))]
                         + [("G61", EDITORIAL, None, None), ("G62", EDITORIAL, None, None)])
        self.assertEqual(json.loads((self.work / "manifest.json").read_text())["status"], "failed")

    def test_truth_findings_block_and_say_which_questions_to_replace(self):
        manifest = self.render({"content_truth.py": (TRUTH_G32, 1), "house_gates.py": (HOUSE_G61, 1)})
        self.assertEqual((manifest["status"], manifest["artifacts"], manifest["reviewFindings"]), ("failed", [], []))
        self.assertFalse(manifest["renderingChecksPassed"])
        self.assertEqual(self.statuses(manifest)["house-gates"], "FAIL")
        gate = manifest["gate"]
        self.assertEqual((gate["action"], gate["questions"], gate["complete"]), ("replace", [2, 4, 8, 10, 12], True))
        self.assertEqual({(b["code"], b["class"], b["step"]) for b in gate["blocking"]},
                         {("G32", "truth", "content-truth"), ("G61", "editorial", "house-gates")})
        self.assertEqual(gate["review"], [])

    def test_printed_key_order_names_its_question_and_the_adapter_names_its_item(self):
        manifest = self.render({"output_gates.py": (OUTPUT_ANSWER_ORDER, 1)})
        self.assertEqual((manifest["status"], manifest["gate"]["action"], manifest["gate"]["questions"]), ("failed", "replace", [11]))
        self.assertEqual(manifest["gate"]["blocking"], [{"code": "ANSWER_ORDER", "class": "truth", "step": "output-gates", "question": 11}])
        self.work = Path(self.tmp.name) / "adapter"
        manifest = self.render({"general_adapters.py": (ADAPTER_REFUSAL, 1)})
        self.assertEqual(self.calls[-1], "general_adapters.py")
        self.assertEqual(manifest["gate"]["blocking"],
                         [{"code": "TRUSTED_ADAPTER", "class": "truth", "step": "trusted-adapter", "question": 5, "item": 1}])
        self.assertEqual((manifest["status"], manifest["gate"]["action"]), ("failed", "replace"))

    def test_unknown_lines_timeouts_and_crashes_block(self):
        cases = {
            "unknown": ({"house_gates.py": (HOUSE_PASSING + "FAIL — G99-new: text\nHOUSE GATES: FAIL (1)\n", 1)}, None, "UNREADABLE"),
            "crash": ({"house_gates.py": ("Traceback (most recent call last):\nRuntimeError: boom\n", 1)}, None, "UNREADABLE"),
            "timeout": ({"house_gates.py": (HOUSE_G61, 1)}, "check_worksheet.py", "RENDER_TIMEOUT"),
            "pdf": ({"build_pdf.py": ("no page", 1), "house_gates.py": (HOUSE_G61, 1)}, None, "PDF_BUILD"),
        }
        for name, (outputs, timeout, code) in cases.items():
            with self.subTest(name=name):
                self.work = Path(self.tmp.name) / name
                manifest = self.render(outputs, timeout)
                self.assertEqual((manifest["status"], manifest["artifacts"], manifest["gate"]["action"]), ("failed", [], "fail"))
                self.assertIn(code, [row["code"] for row in manifest["gate"]["blocking"]])
                self.assertFalse(manifest["renderingChecksPassed"])

    def test_a_bracket_sample_fails_the_sheet_and_is_never_measured_again(self):
        # A balanced product of two bracketed groups is a known G51 false refusal (D19): accepted, not reconciled.
        # A RECONCILED record left in the work folder changes nothing.
        forged = {"house_gates.py": {"logs/bracket-order.json": json.dumps(
            {"status": "RECONCILED", "code": "G51", "matches": 1, "unbalanced": 0, "pages": [9]})}}
        expected = {"trusted-adapter": "PASS", "content-truth": "PASS", "pdf": "PASS", "word": "PASS",
                    "worksheet": "PASS", "output-gates": "PASS", "house-gates": "FAIL"}
        manifest = self.render({"house_gates.py": (HOUSE_G51, 1), "files": forged})
        self.assertEqual((manifest["status"], manifest["artifacts"], manifest["reviewFindings"]), ("failed", [], []))
        self.assertEqual((manifest["automatedChecksPassed"], manifest["renderingChecksPassed"]), (False, False))
        self.assertEqual(self.statuses(manifest), expected)
        gates = next(step for step in manifest["steps"] if step["name"] == "house-gates")
        self.assertEqual((gates["status"], gates.get("reason"), gates["exitCode"]), ("FAIL", None, 1))
        # G51 names no question: nothing can be replaced.
        self.assertEqual((manifest["gate"]["action"], manifest["gate"]["questions"], manifest["gate"]["review"]), ("fail", [], []))
        self.assertEqual(manifest["gate"]["blocking"], [{"code": "G51", "class": "truth", "step": "house-gates"}])
        self.assertNotIn("paren_order.py", self.calls)
        # Beside named G61 findings the action is still fail.
        self.work = Path(self.tmp.name) / "with-g61"
        self.calls = []
        manifest = self.render({"house_gates.py": (HOUSE_G51_G61, 1), "files": forged})
        self.assertEqual((manifest["status"], manifest["artifacts"], manifest["reviewFindings"]), ("failed", [], []))
        self.assertEqual(self.statuses(manifest), expected)
        self.assertEqual((manifest["gate"]["action"], manifest["gate"]["questions"]), ("fail", [4, 11]))
        self.assertEqual([(row["code"], row.get("question")) for row in manifest["gate"]["blocking"]],
                         [("G61", 11), ("G61", 4), ("G51", None)])
        self.assertNotIn("paren_order.py", self.calls)
        # The pre-pass fails on it the same way.
        self.work = Path(self.tmp.name) / "pre"
        self.calls = []
        result = self.render({"house_gates.py": (HOUSE_G51, 1)}, precheck=True)
        self.assertEqual((result["status"], result["gate"]["action"], result["gate"]["questions"]), ("failed", "fail", []))
        self.assertEqual(result["gate"]["blocking"], [{"code": "G51", "class": "truth", "step": "house-gates"}])
        self.assertEqual(self.calls, ["general_adapters.py", "content_truth.py", "house_gates.py"])

    def test_a_failed_artifact_check_after_a_delivered_gate_never_reports_deliver(self):
        forged = {"house_gates.py": {"logs/bracket-order.json": json.dumps(
            {"status": "RECONCILED", "code": "G51", "matches": 1, "unbalanced": 0, "pages": [9]})}}
        real = Path.is_file
        def missing_docx(path):
            return path.name != "sheet.docx" and real(path)
        with patch.object(runner.Path, "is_file", missing_docx):
            manifest = self.render({"house_gates.py": (HOUSE_G51, 1), "files": forged})
        # A G51 already fails the render, so no artifact is looked for.
        self.assertEqual((manifest["status"], manifest["artifacts"]), ("failed", []))
        self.assertNotIn("artifact-presence", self.statuses(manifest))
        self.assertEqual((manifest["gate"]["action"], manifest["gate"]["questions"]), ("fail", []))
        self.assertEqual(manifest["gate"]["blocking"], [{"code": "G51", "class": "truth", "step": "house-gates"}])
        # The one gate that delivers is the middle driver's reconciled didactic REVIEW. Without the printed PDF
        # the artifact check fails, and the manifest says fail, not deliver.
        review = json.dumps({"status": "REVIEW", "code": "DIDACTIC_REVIEW", "count": 1, "findings": [{"rule": "D12", "item": "q3b"}]})
        middle = {**self.lesson, "gradeNumber": 8, "topicId": "g8:x"}
        for name, made in (("deliver", ("out/v72-report.json", "out/docx/b/sheet.docx", "out/deliver/b/sheet.pdf")),
                           ("missing-pdf", ("out/v72-report.json", "out/docx/b/sheet.docx"))):
            self.work = Path(self.tmp.name) / name
            self.calls = []
            outputs = {"build_v72.py": ("", 1), "files": {"build_v72.py": {path: "stub" for path in made},
                                                           "didactic_review.py": {"logs/didactic-review.json": review}}}
            with patch.object(runner, "validate_model", return_value={"skill": "middle"}), \
                 patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "pinned", "sha256": "a" * 64})), \
                 patch("runtime_catalog.scope_for_lesson", return_value={}), \
                 patch.object(runner.subprocess, "run", side_effect=self.execute(outputs)):
                manifest = runner.render_job(middle, {}, self.work, skill_paths={"middle": self.skill})
            self.assertEqual(self.calls, ["general_adapters.py", "build_v72.py", "didactic_review.py"], name)
            self.assertEqual([(step["name"], step["status"], step.get("reason")) for step in manifest["steps"]][:3],
                             [("trusted-adapter", "PASS", None), ("middle-build", "REVIEW", "PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY"),
                              ("didactic-review-reconciliation", "PASS", None)], name)
            self.assertEqual([(r["code"], r["count"], r["questions"]) for r in manifest["gate"]["review"]],
                             [("DIDACTIC_REVIEW", 1, [3])], name)
            if name == "deliver":
                self.assertEqual((manifest["status"], [a["path"] for a in manifest["artifacts"]]),
                                 ("needs_review", ["out/deliver/b/sheet.pdf", "out/docx/b/sheet.docx"]))
                self.assertEqual((manifest["gate"]["action"], manifest["gate"]["blocking"]), ("deliver", []))
                continue
            self.assertEqual((manifest["status"], manifest["artifacts"]), ("failed", []))
            self.assertEqual(self.statuses(manifest)["artifact-presence"], "FAIL")
            self.assertEqual((manifest["automatedChecksPassed"], manifest["renderingChecksPassed"]), (False, False))
            self.assertEqual((manifest["gate"]["action"], manifest["gate"]["questions"]), ("fail", []))
            self.assertEqual(manifest["gate"]["blocking"], [{"code": "ARTIFACT_MISSING", "class": "truth", "step": "artifact-presence"}])

    def test_clean_render_has_no_gate_block_and_legacy_lessons_keep_the_old_rule(self):
        manifest = self.render({})
        self.assertEqual((manifest["status"], manifest["automatedChecksPassed"], manifest["reviewFindings"]), ("needs_review", True, []))
        self.assertNotIn("gate", manifest)
        self.work = Path(self.tmp.name) / "legacy"
        legacy = {"version": 2, "gradeNumber": 3, "topicId": "ג10", "level": "b", "questionCount": 12}
        manifest = self.render({"house_gates.py": (HOUSE_G61, 1)}, lesson=legacy)
        self.assertEqual((manifest["status"], manifest["artifacts"]), ("failed", []))
        self.assertNotIn("gate", manifest)
        self.assertNotIn("reviewFindings", manifest)
        self.assertNotIn("paren_order.py", self.calls)

    def test_precheck_runs_only_the_gates_that_read_content_before_any_pdf(self):
        result = self.render({"content_truth.py": (TRUTH_G32, 1), "house_gates.py": (HOUSE_G61, 1)}, precheck=True)
        self.assertEqual(self.calls, ["general_adapters.py", "content_truth.py", "house_gates.py"])
        self.assertEqual((result["status"], result["gate"]["questions"]), ("replace", [2, 4, 8, 10, 12]))
        self.assertEqual([step["name"] for step in result["steps"]], ["trusted-adapter", "content-truth", "house-gates"])
        self.assertFalse((self.work / "sheet.pdf").exists() or (self.work / "manifest.json").exists())
        self.assertEqual(json.loads((self.work / "precheck.json").read_text())["status"], "replace")
        for name, outputs, status, action, questions in (
                ("clean", {}, "clean", "deliver", []),
                ("editorial", {"house_gates.py": (HOUSE_G61, 1)}, "replace", "replace", [2, 10]),
                ("editorial-unnamed", {"house_gates.py": (HOUSE_G61_G62, 1)}, "failed", "fail", [1, 3, 5]),
                ("adapter", {"general_adapters.py": (ADAPTER_REFUSAL, 1)}, "replace", "replace", [5]),
                ("unknown", {"content_truth.py": ("odd", 1)}, "failed", "fail", [])):
            self.work = Path(self.tmp.name) / ("pre-" + name)
            self.calls = []
            result = self.render(outputs, precheck=True)
            self.assertEqual((result["status"], result["gate"]["action"], result["gate"]["questions"]), (status, action, questions), name)
            self.assertEqual(result["gate"]["review"], [], name)
            self.assertNotIn("build_pdf.py", self.calls)

    def test_precheck_gate_arguments_never_name_a_pdf_or_word_file(self):
        seen = {}
        def run(args, **kwargs):
            seen[Path(args[2]).name] = [str(a) for a in args[3:]]
            return SimpleNamespace(stdout="", stderr="", returncode=0)
        with patch.object(runner, "validate_model", return_value={"skill": "elementary"}), \
             patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "p", "sha256": "a" * 64})), \
             patch("runtime_catalog.scope_for_lesson", return_value={}), patch.object(runner.subprocess, "run", side_effect=run):
            runner.precheck_job(self.lesson, {}, self.work, skill_paths={"elementary": self.skill})
            house = seen["house_gates.py"]
            self.assertEqual([a for a in house if a.startswith("--")], ["--html", "--gen", "--content", "--figdir", "--grade", "--level"])
            self.assertEqual((house[house.index("--grade") + 1], house[house.index("--level") + 1]), ("ד", "ב"))
            runner.render_job(self.lesson, {}, Path(self.tmp.name) / "full", skill_paths={"elementary": self.skill})
            self.assertEqual([a for a in seen["house_gates.py"] if a.startswith("--")],
                             ["--html", "--pdf", "--gen", "--content", "--figdir", "--grade", "--level", "--docx"])

    def test_precheck_does_not_apply_to_middle_or_legacy_lessons_and_writes_nothing(self):
        for lesson, cap in (({**self.lesson, "gradeNumber": 8, "topicId": "g8:x"}, {"skill": "middle"}),
                            ({**self.lesson, "version": 2}, {"skill": "elementary"})):
            with patch.object(runner, "validate_model", return_value=cap), patch.object(runner.subprocess, "run") as execute:
                result = runner.precheck_job(lesson, {}, self.work, skill_paths={"elementary": self.skill, "middle": self.skill})
            self.assertEqual(result, {"version": 1, "status": "not_applicable", "steps": [], "gate": None})
            execute.assert_not_called()
            self.assertFalse(self.work.exists())


class WorkerResultTests(unittest.TestCase):
    def test_job_result_carries_the_didactic_review_note_and_nothing_else_from_the_manifest(self):
        from datetime import datetime, timedelta, timezone
        from test_remote_worker import FakeRemote, JOB_ID, LEASE, TEACHER_A
        # The one REVIEW a render still delivers: the middle driver's reconciled didactic REVIEW.
        lesson = json.loads((HERE / "cloud/container/fixtures/general/grade7-equation-skill/lesson.json").read_text())
        job = {"id": JOB_ID, "owner_id": TEACHER_A, "lease_token": LEASE, "status": "running",
               "lease_until": (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(), "lesson": lesson}

        def rendered(_, payload, target):
            import hashlib
            target.mkdir(parents=True, exist_ok=True)
            artifacts = []
            for kind in ("pdf", "docx"):
                blob = ("synthetic " + kind).encode()
                (target / ("sheet." + kind)).write_bytes(blob)
                artifacts.append({"kind": kind, "path": "sheet." + kind, "sha256": hashlib.sha256(blob).hexdigest(), "bytes": len(blob)})
            return {"status": "needs_review", "automatedChecksPassed": False, "renderingChecksPassed": True,
                    "authoringProfile": "general-skill-source/v1", "skill": {"name": "middle"}, "artifacts": artifacts,
                    "steps": [{"name": "trusted-adapter", "status": "PASS"},
                              {"name": "middle-build", "status": "REVIEW", "reason": "PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY"},
                              {"name": "didactic-review-reconciliation", "status": "PASS"}],
                    "reviewFindings": [{"code": "DIDACTIC_REVIEW", "class": "editorial", "count": 2, "steps": ["middle-build"],
                                        "questions": [4, 11], "rules": {"D12": 2}, "note": "PRIVATE MODEL TEXT"},
                                       {"code": "G51", "class": "reconciled", "count": 1, "steps": ["house-gates"], "questions": []}]}

        remote = FakeRemote()
        with tempfile.TemporaryDirectory() as root, patch.object(worker, "author_lesson", return_value={}), \
                patch.object(worker, "render_job", side_effect=rendered):
            worker.process_job(remote, job, Path(root).resolve(), enable_skill_revision=False)
        final = [call[2] for call in remote.calls if call[1] == "PATCH" and call[2].get("status") == "needs_review"]
        self.assertEqual(len(final), 1)
        result = final[0]["result"]
        # A forged reconciled G51 row stays private; the note is the table's own sentence.
        self.assertEqual(result["reviewFindings"], [{"code": "DIDACTIC_REVIEW", "count": 2, "note": policy.NOTES["DIDACTIC_REVIEW"],
                                                     "questions": [4, 11]}])
        self.assertEqual([(check["name"], check["status"]) for check in result["checks"]],
                         [("trusted-adapter", "PASS"), ("middle-build", "REVIEW"), ("didactic-review-reconciliation", "PASS")])
        self.assertNotIn("G51", json.dumps(result["reviewFindings"]))
        self.assertNotIn("D12", json.dumps(result, ensure_ascii=False))
        self.assertNotIn("PRIVATE", json.dumps(result, ensure_ascii=False))
        self.assertLess(len(json.dumps(result, ensure_ascii=False).encode()), 32000)


if __name__ == "__main__":
    unittest.main()
