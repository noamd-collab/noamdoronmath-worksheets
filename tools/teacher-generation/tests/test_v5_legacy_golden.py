"""The pre-v5 paths are byte-identical to the strict base without v5 (V5-DESIGN §6.3, G1).

golden/*.json were recorded by fixtures/v5/make_golden.py from a clean copy of b5577690 (the base after
#635, with its locked skill archives), before any integrator edit; first recorded at bafa36f0. The adapter
golden was re-recorded from the same base plus the removals of #635's relaxations and no v5 code (local
strict-base commit ff6b1f6c: content.json carries the printed star again). This test
runs the same script against the working tree and requires byte-equal output: the 6 closed authors' adapter
outputs, 8 v4 fixtures (elementary and middle), and the runner's steps and manifests for v3 middle and
elementary general jobs and the v2 grade 7 pilot.
"""
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
import v5_support as S  # noqa: E402

GOLDEN = S.FIXTURES / "golden"
CLOSED = ("closed:counting", "closed:division_facts", "closed:fraction", "closed:pythagoras", "closed:square",
          "closed:triangle")


def make(part):
    with tempfile.TemporaryDirectory() as out:
        env = dict(os.environ, PYTHONDONTWRITEBYTECODE="1", MIDDLE_SKILL_PATH=str(S.MIDDLE),
                   ELEMENTARY_SKILL_PATH=str(S.ELEMENTARY))
        done = subprocess.run([sys.executable, "-B", str(S.FIXTURES / "make_golden.py"), "--app", str(S.APP),
                               "--out", out, "--part", part], env=env, capture_output=True, text=True, timeout=900)
        if done.returncode != 0:
            raise AssertionError("make_golden failed: " + done.stderr[-800:])
        return (Path(out) / ("%s-golden.json" % part)).read_bytes()


class LegacyGolden(unittest.TestCase):
    def test_golden_files_cover_the_closed_authors_and_v4(self):
        adapter = json.loads((GOLDEN / "adapter-golden.json").read_text(encoding="utf-8"))
        names = set(adapter["cases"])
        self.assertTrue(set(CLOSED) <= names)
        self.assertGreaterEqual(len([name for name in names if name.startswith("v4:")]), 8)
        self.assertTrue(all(case["exitCode"] == 0 and case["files"] for case in adapter["cases"].values()))
        runner = json.loads((GOLDEN / "runner-golden.json").read_text(encoding="utf-8"))
        self.assertTrue({"v3-middle-general", "v3-elementary-general", "v2-grade7-pilot"} <= set(runner["cases"]))

    def test_runner_steps_and_manifests_unchanged(self):
        produced = make("runner")
        expected = (GOLDEN / "runner-golden.json").read_bytes()
        self.assertEqual(json.loads(produced), json.loads(expected))
        self.assertEqual(produced, expected)

    @unittest.skipUnless(S.MIDDLE_PINNED and S.ELEMENTARY_PINNED, "Pinned skills unavailable")
    def test_closed_author_and_v4_adapter_outputs_unchanged(self):
        expected = (GOLDEN / "adapter-golden.json").read_bytes()
        lock = json.loads((S.APP / "skill-lock.json").read_text(encoding="utf-8"))["skills"]
        recorded = json.loads(expected)["skillLock"]
        self.assertEqual(recorded, {kind: {"version": row["version"], "sha256": row["sha256"]}
                                    for kind, row in sorted(lock.items())})
        produced = make("adapter")
        self.assertEqual(json.loads(produced), json.loads(expected))
        self.assertEqual(produced, expected)


if __name__ == "__main__":
    unittest.main()
