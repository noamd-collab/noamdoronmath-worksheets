"""The pre-v5 paths are byte-identical to the strict base without v5 (V5-DESIGN §6.3, G1).

golden/*.json were recorded by fixtures/v5/make_golden.py from a clean copy of b5577690 (the base after
#635, with its locked skill archives), before any integrator edit; first recorded at bafa36f0. The adapter
golden was re-recorded from the same base plus the removals of #635's relaxations and no v5 code (local
strict-base commit dfebb04b: content.json carries the printed star again, and the elementary sheet.html has no
style for keyless items). This test
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
        # Every case compiles, except the v4 fixtures that the strict engine refuses. Each stays recorded with its
        # exact refusal: the adapter's exit code, its last error line, and its failure record, which holds the error
        # code with the question and item. Two would print their typed task after a prompt that is not a bare
        # instruction: a story ("כמה ספרים יש יחד בשתי קופסאות?") and a row named without a table ("השוו את השברים
        # בשורה הראשונה."). The third prints "הערך החסר בטבלה הוא ___." beside the table row "(10 + 2) x 3 | ___", a
        # blank that no binder fills, refused when the adapter reads the source.
        import hashlib
        shown = ["general_source.GeneralSourceError: The prompt does not print the exercise that its key answers; "
                 "a typed task is printed only after a bare instruction"]
        blank = ["general_source.GeneralSourceError: The printed blank is not filled from the print by any binder"]
        record = lambda question, item: hashlib.sha256((json.dumps(
            {"version": 1, "step": "trusted-adapter", "code": "PRINTED_TASK_MISMATCH", "question": question,
             "item": item}, ensure_ascii=False, indent=2) + "\n").encode("utf-8")).hexdigest()
        refused = {"v4:grade2-vocalized": (1, 1, shown), "v4:grade4-fractions": (1, 1, shown),
                   "v4:grade4-skill-calculation": (9, 1, blank)}
        self.assertEqual({name: (case["exitCode"], case["error"], case["files"]["adapter-failure.json"]["sha256"])
                          for name, case in adapter["cases"].items() if case["exitCode"] != 0},
                         {name: (1, error, record(question, item)) for name, (question, item, error) in refused.items()})
        self.assertTrue(all(case["files"] for name, case in adapter["cases"].items() if name not in refused))
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
