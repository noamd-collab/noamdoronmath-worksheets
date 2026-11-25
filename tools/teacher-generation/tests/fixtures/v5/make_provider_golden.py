"""Record what provider.author_lesson sends and returns on every path the TEACHER_V5_TOPICS route must leave alone.

A script, not a test. It was run once against the unmodified code (515ebd5a, before structured_author.py and the
routing hook existed) and its output is committed as golden/provider-golden.json. test_v5_structured_author.py
runs it again against the working tree and requires byte-equal JSON: with the route off (the variable unset or
empty, or naming other topics) and wherever the route must not apply (an unreviewed overlay, a level the overlay
does not enable, a version 2 lesson), the provider request and the metadata are exactly the baseline ones.

The network function provider.request_author_json is replaced by a recorder: it keeps the target, the key, the
timeout and the sha256 of the canonical request body, sets httpStatus 418 and raises PROVIDER_HTTP_ERROR, as the
real function does for an HTTP error. No network, no model call.

    python3 -B make_provider_golden.py --app <tools/teacher-generation dir> --out <file>
        [--site-ready VALUE] [--topics VALUE]

Skill paths come from MIDDLE_SKILL_PATH / ELEMENTARY_SKILL_PATH (they must match skill-lock.json).
TEACHER_V5_SITE_READY is unset unless --site-ready gives its value for every case (added in stage 4, after the
golden was recorded; the default output is unchanged). --topics replaces every case's TEACHER_V5_TOPICS value (and
its "env" field), so a test can list the topics while the site is not ready and compare the rest of each case.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import os
from pathlib import Path
import sys
from unittest.mock import patch

HERE = Path(__file__).resolve().parent
CONFIG = {"api_key": "golden-unit-key", "base_url": "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
          "model": "golden-unit-model"}
G7 = "lesson-g7-algebraic-expressions.json"


def _lesson(name, **changes):
    lesson = json.loads((HERE / name).read_text(encoding="utf-8"))
    lesson.update(changes)
    return lesson


def _v2_lesson(app):
    lesson = json.loads((app / "examples/elementary-lesson.json").read_text(encoding="utf-8"))
    lesson.update(version=2, lessonBoundary={"version": 1, "kind": "division_facts",
                                             "allowedDivisors": list(range(1, 11)), "maxDividend": 100})
    return lesson


def cases(app):
    """(name, lesson, TEACHER_V5_TOPICS value or None for unset)."""
    v2 = _v2_lesson(app)
    return (
        ("v3-g7-unset", _lesson(G7), None),
        ("v3-g7-empty", _lesson(G7), ""),
        ("v3-g7-other-topics", _lesson(G7), "g7:equations, g9r:probability"),
        ("v3-g7-level-not-enabled", _lesson(G7, level="a"), "g7:algebraic_expressions"),
        ("v3-g9r-unreviewed-listed", _lesson("g9r_probability/lesson.json"), "g9r:probability"),
        ("v3-d10-unreviewed-listed", _lesson("d10/lesson.json"), "ד10"),
        ("v2-elementary-listed", v2, v2["topicId"]),
    )


def _canonical(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def record(app, site_ready=None, topics=None) -> dict:
    sys.path.insert(0, str(app))
    import provider
    from validation import GenerationError

    out = {}
    for name, lesson, flag in cases(app):
        flag = flag if topics is None else topics
        calls = []

        def fake(target, key, body, measured, timeout):
            calls.append({"target": target, "key": key, "timeout": timeout,
                          "bodySha256": hashlib.sha256(_canonical(body)).hexdigest(),
                          "bodyBytes": len(_canonical(body))})
            measured["httpStatus"] = 418
            raise GenerationError("PROVIDER_HTTP_ERROR", "Provider returned HTTP 418; body omitted")

        env = dict(os.environ)
        env.pop("TEACHER_V5_TOPICS", None)
        env.pop("TEACHER_V5_SITE_READY", None)
        if flag is not None:
            env["TEACHER_V5_TOPICS"] = flag
        if site_ready is not None:
            env["TEACHER_V5_SITE_READY"] = site_ready
        metadata = {}
        case = {"env": flag}
        with patch.dict(os.environ, env, clear=True), patch.object(provider, "request_author_json", fake):
            try:
                returned = provider.author_lesson(copy.deepcopy(lesson), metadata=metadata, **CONFIG)
            except GenerationError as exc:
                case.update(outcome="error", code=exc.code, detail=str(exc))
            else:
                case.update(outcome="returned", returnedType=type(returned).__name__,
                            returnedSha256=hashlib.sha256(_canonical(returned)).hexdigest())
        metadata.pop("elapsedSeconds", None)
        case.update(calls=calls, metadata=json.loads(_canonical(metadata)))
        out[name] = case
    return {"version": 1, "cases": out}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--app", required=True)
    parser.add_argument("--out", required=True)
    parser.add_argument("--site-ready")
    parser.add_argument("--topics")
    args = parser.parse_args()
    sys.dont_write_bytecode = True
    data = record(Path(args.app).resolve(), site_ready=args.site_ready, topics=args.topics)
    Path(args.out).write_text(json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
