"""Record the outputs of every pre-v5 path, so the v5 hooks can be proven inert (V5-DESIGN §6.3).

A script, not a test. It is run once against the unmodified code (a clean copy of the baseline commit)
and the result is committed under golden/. test_v5_legacy_golden.py runs it again against the working
tree and requires byte-equal JSON.

    python3 -B make_golden.py --app <tools/teacher-generation dir> --out <dir> [--part adapter|runner|all]

Adapter cases run ``general_adapters.py --skill --work`` as a subprocess, exactly as runner.render_job
does, in a fresh work dir holding lesson.json, model-output.json and curriculum-scope.json. Every output
file is recorded by sha256 (the work path is replaced by a placeholder first, so the temp dir name never
matters). The cases: the 6 closed authors (container fixtures with fixed seeds or choices), every v4
container fixture, and test_general_source.fixture("ד11", 4) and fixture("g9r:quad_func_and_eq", 9).

Runner cases stub subprocess.run and verify_skill and record the argv of every step plus the manifest
without content hashes, for a v3 middle general job (pass and reconciliation-fail), a v3 elementary
general job and the v2 grade 7 pilot.

Skill paths come from MIDDLE_SKILL_PATH / ELEMENTARY_SKILL_PATH. They must match skill-lock.json.
"""
from __future__ import annotations

import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from types import SimpleNamespace
from unittest.mock import patch

FIXTURES = "cloud/container/fixtures/general"
ADAPTER_CASES = (
    ("closed:counting", FIXTURES + "/grade1-counting"),
    ("closed:division_facts", FIXTURES + "/grade3-division-curriculum"),
    ("closed:fraction", FIXTURES + "/grade5-unlike-fractions"),
    ("closed:pythagoras", FIXTURES + "/grade8-pythagoras"),
    ("closed:triangle", FIXTURES + "/grade9-special-right-triangle"),
    ("closed:square", FIXTURES + "/grade9-square"),
    ("v4:grade2-vocalized", FIXTURES + "/grade2-vocalized"),
    ("v4:grade4-fractions", FIXTURES + "/grade4-fractions"),
    ("v4:grade4-skill-calculation", FIXTURES + "/grade4-skill-calculation"),
    ("v4:grade7-equation-skill", FIXTURES + "/grade7-equation-skill"),
    ("v4:grade9-coordinate-triangles", FIXTURES + "/grade9-coordinate-triangles"),
    ("v4:grade9-quadratic", FIXTURES + "/grade9-quadratic"),
)
GENERAL_SOURCE_FIXTURES = (("v4:test_general_source:ד11", "ד11", 4),
                           ("v4:test_general_source:g9r", "g9r:quad_func_and_eq", 9))
ENV_KEYS = ("PATH", "HOME", "TMPDIR", "LANG", "LC_ALL", "DYLD_FALLBACK_LIBRARY_PATH", "FONTCONFIG_PATH")


def _sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def skill_paths() -> dict:
    return {"middle": os.environ.get("MIDDLE_SKILL_PATH", ""),
            "elementary": os.environ.get("ELEMENTARY_SKILL_PATH", "")}


def pinned(app: Path, kind: str, path: str) -> bool:
    """True when ``path`` holds every pinned file of ``kind`` with its locked sha256."""
    if not path or not Path(path).is_dir():
        return False
    files = json.loads((app / "skill-lock.json").read_text(encoding="utf-8"))["skills"][kind]["files"]
    root = Path(path)
    return all((root / name).is_file() and _sha((root / name).read_bytes()) == digest
               for name, digest in files.items())


def lock_summary(app: Path) -> dict:
    lock = json.loads((app / "skill-lock.json").read_text(encoding="utf-8"))["skills"]
    return {kind: {"version": row["version"], "sha256": row["sha256"]} for kind, row in sorted(lock.items())}


def _general_source_fixture(app: Path, topic: str, grade: int):
    spec = importlib.util.spec_from_file_location("_golden_test_general_source", app / "tests/test_general_source.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.fixture(topic, grade)


def _cases(app: Path):
    for name, folder in ADAPTER_CASES:
        root = app / folder
        yield (name, json.loads((root / "lesson.json").read_text(encoding="utf-8")),
               json.loads((root / "model-output.json").read_text(encoding="utf-8")))
    for name, topic, grade in GENERAL_SOURCE_FIXTURES:
        lesson, payload = _general_source_fixture(app, topic, grade)
        yield name, lesson, payload


def _normalized(data: bytes, replacements) -> bytes:
    for old, new in replacements:
        data = data.replace(old.encode("utf-8"), new.encode("utf-8"))
    return data


def adapter_golden(app: Path, tmp: Path) -> dict:
    sys.path.insert(0, str(app))
    from runtime_catalog import scope_for_lesson
    paths = skill_paths()
    env = {key: value for key, value in os.environ.items() if key in ENV_KEYS}
    env["PYTHONDONTWRITEBYTECODE"] = "1"
    if sys.platform == "darwin":
        env.setdefault("DYLD_FALLBACK_LIBRARY_PATH", "/opt/homebrew/lib")
    out = {}
    for index, (name, lesson, payload) in enumerate(_cases(app)):
        scope = scope_for_lesson(lesson)
        skill = paths[scope["topic"]["skillId"]]
        work = tmp / ("adapter-%02d" % index)
        work.mkdir()
        for filename, value in (("lesson.json", lesson), ("model-output.json", payload),
                                ("curriculum-scope.json", scope)):
            (work / filename).write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        inputs = {path.name for path in work.iterdir()}
        done = subprocess.run([sys.executable, "-B", str(app / "general_adapters.py"), "--skill", skill,
                               "--work", str(work)], cwd=work, env=env, capture_output=True, text=True,
                              timeout=600)
        replacements = ((str(work.resolve()), "<WORK>"), (str(work), "<WORK>"),
                        (str(Path(skill).resolve()), "<SKILL>"), (skill, "<SKILL>"))
        files = {}
        for path in sorted(work.rglob("*")):
            if path.is_file() and path.relative_to(work).as_posix() not in inputs:
                data = _normalized(path.read_bytes(), replacements)
                files[path.relative_to(work).as_posix()] = {"sha256": _sha(data), "bytes": len(data)}
        stdout = _normalized(done.stdout.encode("utf-8"), replacements).decode("utf-8")
        error = _normalized(done.stderr.encode("utf-8"), replacements).decode("utf-8").strip().splitlines()[-1:]
        out[name] = {"exitCode": done.returncode, "stdout": stdout, "files": files,
                     "error": None if done.returncode == 0 else error}
    return out


def _without_hashes(value):
    if isinstance(value, dict):
        return {key: _without_hashes(item) for key, item in value.items() if "sha256" not in key.lower()}
    if isinstance(value, list):
        return [_without_hashes(item) for item in value]
    return value


def runner_golden(app: Path, tmp: Path) -> dict:
    sys.path.insert(0, str(app))
    import runner
    fixtures = app / "cloud/container/fixtures"
    load = lambda path: json.loads((fixtures / path).read_text(encoding="utf-8"))
    middle = (load("general/grade9-quadratic/lesson.json"), load("general/grade9-quadratic/model-output.json"))
    elementary = (load("general/grade4-fractions/lesson.json"), load("general/grade4-fractions/model-output.json"))
    pilot = (load("grade7-positive/lesson.json"), load("grade7-positive/canonical.json"))
    pilot_cap = {"skill": "middle", "family": "linear_equation"}
    cases = (
        ("v3-middle-general", *middle, None, ()),
        ("v3-middle-general-review", *middle, None, ("build_v72.py",)),
        ("v3-middle-general-fail", *middle, None, ("build_v72.py", "didactic_review.py")),
        ("v3-elementary-general", *elementary, None, ()),
        ("v3-elementary-general-fail", *elementary, None, ("house_gates.py",)),
        ("v2-grade7-pilot", *pilot, pilot_cap, ()),
        ("v2-grade7-pilot-fail", *pilot, pilot_cap, ("check_docx_rtl.py",)),
    )
    out = {}
    for index, (name, lesson, payload, cap, fail) in enumerate(cases):
        work = tmp / ("runner-%02d" % index) / "job"
        skill = tmp / ("runner-%02d" % index) / "skill"
        skill.mkdir(parents=True)
        calls = []
        key = {"a": "a", "b": "b", "e": "c"}[lesson["level"]]
        replacements = ((str(work), "<WORK>"), (str(skill), "<SKILL>"), (str(runner.HERE), "<HERE>"),
                        (sys.executable, "<PY>"))

        def execute(args, **kwargs):
            text = [str(arg) for arg in args]
            for old, new in replacements:
                text = [part.replace(old, new) for part in text]
            calls.append(text)
            script = Path(args[2]).name
            made = {
                "build_v72.py": ("out/docx/%s/sheet.docx" % key, "out/deliver/%s/sheet.pdf" % key,
                                 "out/deliver/%s/sheet.json" % key, "out/v72-report.json"),
                "build_pdf.py": ("sheet.pdf",), "build_docx.py": ("sheet.docx",),
            }.get(script, ())
            for relative in made:
                path = work / relative
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_bytes(b"stub " + relative.encode("utf-8"))
            if script == "didactic_review.py" and script not in fail:
                (work / "logs/didactic-review.json").write_text(json.dumps({"count": 2}))
            if script == "docx_web_layout.py":
                source = work / ("out/docx/%s/sheet.docx" % key)
                final = work / ("out/docx/%s/sheet-web.docx" % key)
                final.write_bytes(b"stub final")
                report = {"sourceSha256": runner.sha(source), "outputSha256": runner.sha(final),
                          "printedTextSequencePreserved": True, "bookmarksPreserved": True}
                (work / "logs/word-web-layout.json").write_text(json.dumps(report))
            return SimpleNamespace(stdout="", stderr="", returncode=1 if script in fail else 0)

        patches = [patch.object(runner, "verify_skill", return_value=(skill, {"version": "pinned", "sha256": "a" * 64})),
                   patch.object(runner.subprocess, "run", side_effect=execute)]
        if cap is not None:
            patches.append(patch.object(runner, "validate_model", return_value=cap))
        for item in patches:
            item.start()
        try:
            manifest = runner.render_job(lesson, payload, work, skill_paths={"middle": str(skill),
                                                                             "elementary": str(skill)})
        finally:
            for item in reversed(patches):
                item.stop()
        out[name] = {"calls": calls, "manifest": _without_hashes(manifest)}
    return out


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Record pre-v5 golden outputs (V5-DESIGN §6.3).")
    parser.add_argument("--app", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--part", choices=("adapter", "runner", "all"), default="all")
    args = parser.parse_args(argv)
    sys.dont_write_bytecode = True
    app = Path(args.app).resolve()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="v5-golden-") as name:
        tmp = Path(name)
        if args.part in ("adapter", "all"):
            paths = skill_paths()
            if not all(pinned(app, kind, path) for kind, path in paths.items()):
                print("pinned skills unavailable: set MIDDLE_SKILL_PATH and ELEMENTARY_SKILL_PATH", file=sys.stderr)
                return 2
            golden = {"skillLock": lock_summary(app), "cases": adapter_golden(app, tmp)}
            (out / "adapter-golden.json").write_text(json.dumps(golden, ensure_ascii=False, indent=1, sort_keys=True)
                                                     + "\n", encoding="utf-8")
        if args.part in ("runner", "all"):
            golden = {"cases": runner_golden(app, tmp)}
            (out / "runner-golden.json").write_text(json.dumps(golden, ensure_ascii=False, indent=1, sort_keys=True)
                                                    + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    sys.exit(main())
