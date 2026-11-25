"""End to end: the good reply → validated IR → real pinned middle build (WeasyPrint) → atom order (V5-DESIGN §6.4)."""
import json
import os
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402


@unittest.skipUnless(S.MIDDLE_PINNED and S.weasyprint_available() and " " not in str(S.MIDDLE),
                     "Pinned middle skill or WeasyPrint unavailable")
class OfflineRender(unittest.TestCase):
    def test_good_reply_renders_with_every_executed_check_passing(self):
        import runner
        import v5_offline_render
        with tempfile.TemporaryDirectory() as tmp:
            if " " in tmp:
                self.skipTest("The temporary folder contains a space")
            out, work = Path(tmp) / "out", Path(tmp) / "work"
            summary = v5_offline_render.run(S.FIXTURES / "lesson-g7-algebraic-expressions.json",
                                            S.FIXTURES / "reply-g7-good.json", out, work_dir=work,
                                            skill_path=str(S.MIDDLE), dpi=40)
            self.assertEqual(summary["status"], "needs_review", summary)
            self.assertEqual((summary["requested"], summary["delivered"]), (20, 20))
            self.assertEqual([entry["by"] for entry in summary["replaced"]], ["R1", "R2", "R3", "R5"])
            # Stricter since the stage-3 verification: the pinned build_plus gates that did not run are notRun too.
            self.assertEqual(set(summary["notRun"]), runner.V5_NOT_RUN_ALLOWED | {
                "pinned-log:build_plus:G83:b", "pinned-log:build_plus:G83-room:b"})
            self.assertEqual(summary["failedSteps"], [])
            self.assertTrue(summary["producer"].startswith("WeasyPrint"))
            manifest = json.loads((out / "manifest.json").read_text(encoding="utf-8"))
            self.assertIs(manifest["executedChecksPassed"], True)
            self.assertIs(manifest["automatedChecksPassed"], False)       # legacy SKIPs are notRun, never PASS
            self.assertEqual([artifact["kind"] for artifact in manifest["artifacts"]], ["pdf"])
            executed = [step for step in manifest["steps"] if step["status"] != "SKIP"]
            self.assertTrue(all(step["status"] == "PASS" for step in executed))
            self.assertIn("pinned:check_didactic.py", [step["name"] for step in executed])
            atom = json.loads((out / "atom-order.json").read_text(encoding="utf-8"))
            self.assertEqual((atom["status"], atom["atoms"]), ("PASS", 215))
            self.assertEqual(len(list((out / "pages").glob("page-*.png"))), summary["pages"])
            self.assertFalse(list(work.glob("out/docx/**/*.docx")))
            self.assertTrue(os.path.isfile(out / "sheet.pdf"))


if __name__ == "__main__":
    unittest.main()
