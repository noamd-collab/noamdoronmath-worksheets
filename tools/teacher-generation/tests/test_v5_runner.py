"""runner v5 path with a stubbed subprocess.run: steps, pinned report parsing, notRun and artifacts (V5-DESIGN §5)."""
import json
from pathlib import Path
import shutil
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402
import runner  # noqa: E402
from validation import GenerationError  # noqa: E402

V5_PAYLOAD = {"version": 4, "contract": "worksheet-wire/5"}
LESSON = S.lesson()
CAP = {"skill": "middle", "family": "general"}


class RunnerV5(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / "job"
        self.skill = Path(self.tmp.name) / "skill"
        self.skill.mkdir()
        self.calls = []

    def render(self, report="v72-report-legacy-pass.json", fail=(), pdf=True, cap=CAP, payload=V5_PAYLOAD):
        def execute(args, **kwargs):
            script = Path(args[2]).name
            self.calls.append((script, [str(arg) for arg in args[3:]]))
            if script == "build_v72.py":
                if pdf:
                    path = self.work / "out/deliver/b/sheet.pdf"
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_bytes(b"%PDF stub")
                if report is not None:
                    (self.work / "out").mkdir(exist_ok=True)
                    source = S.FIXTURES / report if report.endswith(".json") else None
                    if source is not None:
                        shutil.copyfile(source, self.work / "out/v72-report.json")
                    else:
                        (self.work / "out/v72-report.json").write_text(report)
            return SimpleNamespace(stdout="", stderr="", returncode=1 if script in fail else 0)
        with patch.object(runner, "validate_model", return_value=cap), \
                patch.object(runner, "verify_skill", return_value=(self.skill, {"version": "7.2.0-noam",
                                                                                "sha256": "a" * 64})), \
                patch.object(runner.subprocess, "run", side_effect=execute):
            return runner.render_job(LESSON, payload, self.work, skill_paths={"middle": self.skill})

    def test_all_pass_legacy_report_is_needs_review_with_not_run(self):
        manifest = self.render()
        self.assertEqual([script for script, _ in self.calls],
                         ["general_adapters.py", "text_lint.py", "build_v72.py", "atom_order.py"])
        self.assertIn("--no-docx", self.calls[2][1])
        self.assertEqual(manifest["status"], "needs_review")
        self.assertIs(manifest["executedChecksPassed"], True)
        self.assertIs(manifest["automatedChecksPassed"], False)
        self.assertIs(manifest["renderingChecksPassed"], False)
        self.assertEqual(set(manifest["notRun"]), runner.V5_NOT_RUN_ALLOWED)
        self.assertEqual(len(manifest["notRun"]), 9)
        self.assertEqual([artifact["path"] for artifact in manifest["artifacts"]], ["out/deliver/b/sheet.pdf"])
        self.assertEqual(manifest["artifacts"][0]["kind"], "pdf")
        self.assertEqual(manifest["authorContract"], "worksheet-wire/5")
        names = [step["name"] for step in manifest["steps"]]
        self.assertEqual(names[:3], ["trusted-adapter", "levels-lint", "middle-build"])
        self.assertEqual(names[-1], "atom-order")
        self.assertIn("pinned:check_didactic.py", names)
        self.assertIn("pinned-gate:G86-terms:sheet", names)
        self.assertNotIn("docxLayoutSha256", manifest)
        self.assertNotIn("Word", json.dumps(manifest["review"]))
        self.assertEqual(json.loads((self.work / "manifest.json").read_text())["status"], "needs_review")

    def test_failed_check_didactic_is_never_reconciled(self):
        manifest = self.render("v72-report-didactic-fail.json", fail=("build_v72.py",))
        self.assertNotIn("didactic_review.py", [script for script, _ in self.calls])
        self.assertEqual(manifest["status"], "failed")
        self.assertEqual(manifest["artifacts"], [])
        self.assertIn({"name": "pinned:check_didactic.py", "status": "FAIL", "source": "out/v72-report.json"},
                      manifest["steps"])

    def test_review_extra_skip_missing_or_invalid_report_and_atom_failure_fail(self):
        cases = (
            ("review", dict(report="v72-report-review.json"), None),
            ("extra skip", dict(report="v72-report-extra-skip.json"), None),
            ("missing", dict(report=None), "PINNED_REPORT_MISSING"),
            ("invalid", dict(report='{"steps": {}}'), "PINNED_REPORT_INVALID"),
            ("not json", dict(report="{"), "PINNED_REPORT_INVALID"),
            ("atom order", dict(fail=("atom_order.py",)), None),
            ("levels lint", dict(fail=("text_lint.py",)), None),
            ("no pdf", dict(pdf=False), None),
        )
        for name, kwargs, reason in cases:
            with self.subTest(name=name):
                shutil.rmtree(self.work, ignore_errors=True)
                self.calls = []
                manifest = self.render(**kwargs)
                self.assertEqual(manifest["status"], "failed")
                self.assertIs(manifest["executedChecksPassed"], False)
                self.assertIs(manifest["automatedChecksPassed"], False)
                self.assertEqual(manifest["artifacts"], [])
                if reason:
                    self.assertIn({"name": "pinned-report", "status": "FAIL", "reason": reason}, manifest["steps"])
                self.assertNotIn("didactic_review.py", [script for script, _ in self.calls])

    def test_unknown_pinned_status_counts_as_fail(self):
        report = json.loads((S.FIXTURES / "v72-report-legacy-pass.json").read_text())
        report["steps"][1]["status"] = "WARN"
        manifest = self.render(json.dumps(report))
        self.assertIn({"name": "pinned:check_plain_math.py", "status": "FAIL", "source": "out/v72-report.json"},
                      manifest["steps"])
        self.assertEqual(manifest["status"], "failed")

    def test_v5_payload_with_another_skill_is_refused(self):
        with self.assertRaises(GenerationError) as caught:
            self.render(cap={"skill": "elementary", "family": "general"})
        self.assertEqual(caught.exception.code, "WIRE_SCOPE_UNSUPPORTED")
        self.assertEqual(self.calls, [])

    def test_a_v4_payload_never_imports_the_v5_detector_module(self):
        self.assertFalse(runner._is_v5({"version": 4, "title": "x"}))
        self.assertFalse(runner._is_v5({"version": 4, "contract": "worksheet-wire/4"}))
        self.assertFalse(runner._is_v5([]))
        self.assertTrue(runner._is_v5(V5_PAYLOAD))


if __name__ == "__main__":
    unittest.main()
