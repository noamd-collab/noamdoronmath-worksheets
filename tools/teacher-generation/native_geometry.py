"""Emit native middle-school geometry and replay each signed construction in the pinned skill."""

import hashlib
from pathlib import Path
import shutil
import sys


def compile_geometry(
    lesson, data, skill, work, *, build, render, figure_key, evidence_scope, package
):
    from general_adapters import dump

    sys.path.insert(0, str(Path(skill).resolve()))
    wd = Path(work)
    (wd / "figures").mkdir(exist_ok=True)
    lvl, canon, facts = build(lesson, data)
    for q in lvl["questions"]:
        if figure_key in q:
            spec = q[figure_key]
            svg = render(spec)
            q["fig"] = svg
            path = wd / "figures" / f"q{q['n']}"
            path.with_suffix(".svg").write_text(svg, encoding="utf-8")
            dump(
                path.with_suffix(".json"),
                {
                    "version": 1,
                    "constructorInput": spec,
                    "sha256": hashlib.sha256(svg.encode()).hexdigest(),
                },
            )
    evidence = {
        "version": 1,
        "scope": evidence_scope,
        "computations": facts,
        "proseReviewRequired": True,
    }
    dump(wd / "general-source.json", data)
    dump(wd / "general-evidence.json", evidence)
    dump(wd / "verified.json", evidence)
    dump(wd / "levels.json", [lvl])
    dump(
        wd / "worksheet-source.json",
        {
            "version": 4,
            "meta": {
                "gradeNumber": lesson["gradeNumber"],
                "levelCode": lesson["level"],
                "topicId": lesson["topicId"],
            },
            "questions": canon,
            "reviewRequired": True,
        },
    )
    module = render.__module__
    shape_file = module + ".py"
    shutil.copyfile(Path(__file__).with_name(shape_file), wd / shape_file)
    bridge = f"""import importlib.util
import json
from pathlib import Path
root = Path(__file__).parent
spec = importlib.util.spec_from_file_location({module!r}, root / {shape_file!r})
shapes = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shapes)
LEVELS = json.loads((root / "levels.json").read_text(encoding="utf-8"))
for level in LEVELS:
    level["words_share"] = {{int(k): v for k, v in level["words_share"].items()}}
    for question in level["questions"]:
        if {figure_key!r} in question:
            if shapes.{render.__name__}(question.pop({figure_key!r})) != question["fig"]:
                raise ValueError("Figure differs from its recorded construction")
STRICT_FIGURES = True
PACKAGE = {package!r}
"""
    (wd / "content.py").write_text(bridge, encoding="utf-8")
    return {
        "skill": "middle",
        "work": str(wd),
        "sourcePath": str(wd / "worksheet-source.json"),
        "reviewRequired": True,
    }
