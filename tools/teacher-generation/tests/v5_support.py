"""Shared fixtures of the integrator's v5 tests (not a test module: discover collects test*.py only)."""
from __future__ import annotations

import copy
import functools
import hashlib
import json
import os
from pathlib import Path
import sys

APP = Path(__file__).resolve().parents[1]
if str(APP) not in sys.path:
    sys.path.insert(0, str(APP))
FIXTURES = APP / "tests/fixtures/v5"
MIDDLE = Path(os.environ.get("MIDDLE_SKILL_PATH", str(Path.home() / ".codex/skills/hebrew-math-worksheet")))
ELEMENTARY = Path(os.environ.get("ELEMENTARY_SKILL_PATH",
                                 str(Path.home() / ".codex/skills/hebrew-math-worksheet-elementary")))


def load(name):
    return json.loads((FIXTURES / name).read_text(encoding="utf-8"))


def lesson():
    return load("lesson-g7-algebraic-expressions.json")


def reply():
    return load("reply-g7-good.json")


def scope(of=None):
    from runtime_catalog import scope_for_lesson
    return scope_for_lesson(of or lesson())


def overlay():
    from structured_contract import OVERLAYS
    return OVERLAYS["g7:algebraic_expressions"]


@functools.lru_cache(maxsize=None)
def pinned(kind: str, path: str) -> bool:
    """True when ``path`` holds every pinned file of ``kind`` with its locked sha256 (else the test skips)."""
    root = Path(path)
    if not root.is_dir():
        return False
    files = json.loads((APP / "skill-lock.json").read_text(encoding="utf-8"))["skills"][kind]["files"]
    return all((root / name).is_file() and hashlib.sha256((root / name).read_bytes()).hexdigest() == digest
               for name, digest in files.items())


MIDDLE_PINNED = pinned("middle", str(MIDDLE))
ELEMENTARY_PINNED = pinned("elementary", str(ELEMENTARY))


def weasyprint_available() -> bool:
    try:
        import weasyprint  # noqa: F401
        import pymupdf  # noqa: F401
    except Exception:  # noqa: BLE001 - a missing native library is "unavailable"
        return False
    return True


@functools.lru_cache(maxsize=None)
def _compiled_good():
    from structured_source import compile_sheet
    result = compile_sheet(lesson(), scope(), reply(), skill_path=str(MIDDLE))
    return json.dumps({"ir": result.ir, "evidence": result.evidence, "diagnostics": result.diagnostics},
                      ensure_ascii=False)


def compiled_good() -> dict:
    """{ir, evidence, diagnostics} of the good reply (fresh copies; needs the pinned middle skill)."""
    return json.loads(_compiled_good())


def ir_good() -> dict:
    return compiled_good()["ir"]


def item(expr="", expr2="", values="", variant="", **fields):
    out = {"text": "", "expr": expr, "expr2": expr2, "values": values, "ask": "", "form": "", "variant": variant}
    out.update(fields)
    return out


def question(slot, kind, items, **fields):
    out = {"slot": slot, "kind": kind, "intro": "", "givens": [], "table": {"head": [], "rows": []},
           "items": copy.deepcopy(items)}
    out.update(fields)
    return out


def context(skill_path=None):
    from item_kinds import Context
    return Context(lesson(), scope(), overlay(), skill_path)


def rows():
    from structured_source import plan_slots
    planned, reserves = plan_slots(lesson(), scope(), overlay())
    return {row.slot: row for row in list(planned) + list(reserves)}
