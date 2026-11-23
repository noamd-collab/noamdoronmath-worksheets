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


def report(*rows, complete=True):
    return {"version": 1, "skill": "elementary", "complete": complete,
            "findings": [row for row in rows if "question" in row],
            "unnamed": [row for row in rows if "question" not in row]}


class TableTests(unittest.TestCase):
    def test_every_code_has_one_class_and_only_editorial_codes_carry_a_note(self):
        self.assertTrue(all(kind in (TRUTH, POLICY, EDITORIAL) and type(named) is bool
                            for kind, named in policy.GATES.values()))
        editorial = {code for code, (kind, _) in policy.GATES.items() if kind == EDITORIAL}
        self.assertEqual(editorial, {"G50", "G61", "G62", "PAGE_FILL", "PAGE_GAP", "DIDACTIC_REVIEW"})
        self.assertEqual(set(policy.NOTES), editorial)
        for note in policy.NOTES.values():
            self.assertRegex(note, r"^[א-ת0-9 ,.:()★-]+$")

    def test_unknown_codes_adapter_and_printed_key_failures_are_truth(self):
        for code in ("G99", "", None, "NEW_GATE", "TRUSTED_ADAPTER", "ANSWER_ORDER", "G32", "G60", "G65",
                     "RENDER_TIMEOUT", "STEP_FAILED", "UNREADABLE", "D12", "K6", "G51"):
            self.assertEqual(policy.gate_class(code), TRUTH, code)
        self.assertEqual([policy.gate_class(code) for code in ("G66", "G84", "G69", "G54", "D6")], [POLICY] * 5)
        self.assertTrue(policy.names_questions("G32"))
        self.assertFalse(policy.names_questions("PAGE_FILL"))
        self.assertFalse(policy.names_questions("G99"))
        self.assertEqual(set(policy.STEP_CODES.values()) - set(policy.GATES), set())

    def test_a_forged_editorial_class_or_reconciliation_does_not_unblock(self):
        forged = {"code": "G32", "class": "editorial", "step": "content-truth", "question": 3}
        self.assertTrue(policy.blocks(forged))
        self.assertTrue(policy.blocks({**forged, "reconciled": True}))
        self.assertFalse(policy.blocks({"code": "G51", "class": "truth", "step": "house-gates", "reconciled": True}))
        self.assertFalse(policy.blocks(finding("G61", "house-gates", 2)))


class DecisionTests(unittest.TestCase):
    def test_editorial_findings_alone_deliver_with_teacher_notes(self):
        rows = [finding("G61", "house-gates", 2, 3, score=3), finding("G61", "house-gates", 10, 1, score=8),
                finding("G62", "house-gates", 3, 1), finding("PAGE_FILL", "worksheet", page=4)]
        decision = decide(report(*rows), ["house-gates", "worksheet"])
        self.assertEqual((decision["action"], decision["blocking"], decision["questions"]), ("deliver", [], []))
        self.assertEqual(decision["reviewSteps"], ["house-gates", "worksheet"])
        self.assertEqual([(r["code"], r["count"], r["questions"]) for r in decision["reviewFindings"]],
                         [("G61", 2, [2, 10]), ("G62", 1, [3]), ("PAGE_FILL", 1, [])])
        self.assertTrue(all(r["note"] == policy.NOTES[r["code"]] and r["class"] == EDITORIAL for r in decision["reviewFindings"]))

    def test_named_truth_and_policy_findings_ask_for_those_questions(self):
        rows = [finding("G32", "content-truth", 8), finding("G32", "content-truth", 4), finding("G66", "house-gates", 4, 2),
                finding("G61", "house-gates", 10, 1)]
        decision = decide(report(*rows), ["content-truth", "house-gates"])
        self.assertEqual((decision["action"], decision["questions"]), ("replace", [4, 8]))
        self.assertEqual([(b["code"], b["class"], b["question"]) for b in decision["blocking"]],
                         [("G32", TRUTH, 8), ("G32", TRUTH, 4), ("G66", POLICY, 4)])
        self.assertEqual(decision["reviewSteps"], [])  # house-gates also holds a blocking finding
        self.assertEqual([r["code"] for r in decision["reviewFindings"]], ["G61"])

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
        # A reconciliation step that refused adds nothing of its own.
        decision = decide(report(finding("G61", "house-gates", 2)), ["house-gates", "bracket-order-reconciliation"])
        self.assertEqual(decision["action"], "deliver")
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
            if name == "paren_order.py" and "--json" in args:
                Path(args[args.index("--json") + 1]).write_text(outputs["bracket-order.json"])
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

    def test_editorial_findings_only_deliver_a_needs_review_sheet_with_notes(self):
        manifest = self.render({"house_gates.py": (HOUSE_G61_G62, 1)})
        self.assertEqual(manifest["status"], "needs_review")
        self.assertFalse(manifest["automatedChecksPassed"])
        self.assertTrue(manifest["renderingChecksPassed"])
        self.assertEqual({a["kind"] for a in manifest["artifacts"]}, {"pdf", "docx"})
        gates = next(step for step in manifest["steps"] if step["name"] == "house-gates")
        self.assertEqual((gates["status"], gates["reason"], gates["exitCode"]), ("REVIEW", "EDITORIAL_FINDINGS_ONLY", 1))
        # The recorded sheet had 20 questions; this one has 12, so Q201 and Q142 name nothing here.
        self.assertEqual([(r["code"], r["count"], r["questions"]) for r in manifest["reviewFindings"]],
                         [("G61", 2, [1]), ("G62", 9, [1, 3, 5])])
        self.assertTrue(all(r["note"] == policy.NOTES[r["code"]] for r in manifest["reviewFindings"]))
        self.assertEqual((manifest["gate"]["action"], manifest["gate"]["blocking"]), ("deliver", []))
        self.assertEqual(json.loads((self.work / "manifest.json").read_text())["status"], "needs_review")

    def test_truth_findings_block_and_say_which_questions_to_replace(self):
        manifest = self.render({"content_truth.py": (TRUTH_G32, 1), "house_gates.py": (HOUSE_G61, 1)})
        self.assertEqual((manifest["status"], manifest["artifacts"], manifest["reviewFindings"]), ("failed", [], []))
        self.assertFalse(manifest["renderingChecksPassed"])
        self.assertEqual(self.statuses(manifest)["house-gates"], "FAIL")
        gate = manifest["gate"]
        self.assertEqual((gate["action"], gate["questions"], gate["complete"]), ("replace", [4, 8, 12], True))
        self.assertEqual({(b["code"], b["class"], b["step"]) for b in gate["blocking"]}, {("G32", "truth", "content-truth")})
        self.assertEqual([(r["code"], r["questions"]) for r in gate["review"]], [("G61", [2, 10])])

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

    def test_bracket_sample_is_measured_again_and_only_a_balanced_product_is_reconciled(self):
        good = json.dumps({"status": "RECONCILED", "code": "G51", "matches": 1, "unbalanced": 0, "pages": [9]})
        bad = json.dumps({"status": "UNBALANCED", "code": "G51", "matches": 1, "unbalanced": 1, "pages": [9]})
        manifest = self.render({"house_gates.py": (HOUSE_G51_G61, 1), "paren_order.py": ("", 0), "bracket-order.json": good})
        self.assertEqual(manifest["status"], "needs_review")
        self.assertEqual(self.statuses(manifest), {"trusted-adapter": "PASS", "content-truth": "PASS", "pdf": "PASS", "word": "PASS",
                                                   "worksheet": "PASS", "output-gates": "PASS", "house-gates": "REVIEW",
                                                   "bracket-order-reconciliation": "PASS"})
        self.assertEqual([(r["code"], r["class"]) for r in manifest["reviewFindings"]], [("G61", "editorial"), ("G51", "reconciled")])
        self.assertEqual([r["code"] for r in public_review_findings(manifest["reviewFindings"])], ["G61"])
        self.work = Path(self.tmp.name) / "reversed"
        manifest = self.render({"house_gates.py": (HOUSE_G51_G61, 1), "paren_order.py": ("", 1), "bracket-order.json": bad})
        self.assertEqual((manifest["status"], manifest["gate"]["action"]), ("failed", "fail"))
        self.assertEqual([row["code"] for row in manifest["gate"]["blocking"]], ["G51"])
        self.assertEqual(self.statuses(manifest)["bracket-order-reconciliation"], "FAIL")
        self.assertEqual(self.calls.count("paren_order.py"), 2)

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
        self.assertEqual((result["status"], result["gate"]["questions"]), ("replace", [4, 8, 12]))
        self.assertEqual([step["name"] for step in result["steps"]], ["trusted-adapter", "content-truth", "house-gates"])
        self.assertFalse((self.work / "sheet.pdf").exists() or (self.work / "manifest.json").exists())
        self.assertEqual(json.loads((self.work / "precheck.json").read_text())["status"], "replace")
        for name, outputs, status in (("clean", {}, "clean"), ("review", {"house_gates.py": (HOUSE_G61, 1)}, "review"),
                                      ("adapter", {"general_adapters.py": (ADAPTER_REFUSAL, 1)}, "replace"),
                                      ("unknown", {"content_truth.py": ("odd", 1)}, "failed")):
            self.work = Path(self.tmp.name) / ("pre-" + name)
            self.calls = []
            result = self.render(outputs, precheck=True)
            self.assertEqual(result["status"], status, name)
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
    def test_job_result_carries_editorial_notes_and_nothing_else_from_the_manifest(self):
        import copy
        from datetime import datetime, timedelta, timezone
        from test_remote_worker import FakeRemote, JOB_ID, LEASE, TEACHER_A
        lesson = json.loads((HERE / "cloud/container/fixtures/general/grade4-skill-calculation/lesson.json").read_text())
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
                    "authoringProfile": "general-skill-source/v1", "skill": {"name": "elementary"}, "artifacts": artifacts,
                    "steps": [{"name": "trusted-adapter", "status": "PASS"}, {"name": "house-gates", "status": "REVIEW"},
                              {"name": "bracket-order-reconciliation", "status": "PASS"}],
                    "reviewFindings": [{"code": "G61", "class": "editorial", "count": 2, "steps": ["house-gates"],
                                        "questions": [4, 11], "note": "PRIVATE MODEL TEXT"},
                                       {"code": "G51", "class": "reconciled", "count": 1, "steps": ["house-gates"], "questions": []}]}

        remote = FakeRemote()
        with tempfile.TemporaryDirectory() as root, patch.object(worker, "author_lesson", return_value={}), \
                patch.object(worker, "render_job", side_effect=rendered):
            worker.process_job(remote, job, Path(root).resolve(), enable_skill_revision=False)
        final = [call[2] for call in remote.calls if call[1] == "PATCH" and call[2].get("status") == "needs_review"]
        self.assertEqual(len(final), 1)
        result = final[0]["result"]
        self.assertEqual(result["reviewFindings"], [{"code": "G61", "count": 2, "note": policy.NOTES["G61"], "questions": [4, 11]}])
        self.assertEqual([check["status"] for check in result["checks"]], ["PASS", "REVIEW", "PASS"])
        self.assertNotIn("PRIVATE", json.dumps(result, ensure_ascii=False))
        self.assertLess(len(json.dumps(result, ensure_ascii=False).encode()), 32000)


if __name__ == "__main__":
    unittest.main()
