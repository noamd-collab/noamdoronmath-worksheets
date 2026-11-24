"""Draw one middle-school question's figure before the question is chosen.

The render draws every figure with the pinned skill's constructors
(general_adapters._figure). A figure those constructors refuse used to be
found only there, with no question named, and cost a whole render round.
Here the same call draws the figure of one validated question into a
temporary folder, so a figure the skill cannot draw is a refusal of that
question (SOURCE_FIGURE) and a reserve takes its place.

The same drawing also gives the figure's identity for the sheet: the middle
skill's G75 counts how many questions print one SVG (emit_html._fig_key,
FIG_REUSE_MAX). drawing_key returns that identity, so selection can hold the
sheet to the gate before anything is rendered.

Nothing is repaired here and nothing drawn here is kept, except the SVG
digest of the last drawings.
"""
from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import tempfile

from general_source import GeneralSourceError

# emit_html.FIG_REUSE_MAX of the pinned middle skill: one SVG may serve at most
# this many questions of a level (G75 REUSE). tests/test_figure_routes.py
# reads the installed skill and fails when the two differ.
FIGURE_REUSE_MAX = 2
FIGURE_REUSE_CODE = "G75"
_DRAWN = {}       # (figure, declared, skill) -> SVG digest, or the refusal
_DRAWN_LIMIT = 512


def _skill_root(skill_path=None):
    root = skill_path or os.environ.get("MIDDLE_SKILL_PATH")
    if not root or not (Path(root) / "SKILL.md").is_file():
        return None
    return str(Path(root))


def _draw(figure, declared, root):
    """The digest of the SVG the pinned constructors draw, or the refusal. Raises on a fault."""
    key = (json.dumps(figure, sort_keys=True, ensure_ascii=False), tuple(sorted(declared)), root)
    if key in _DRAWN:
        return _DRAWN[key]
    if root not in sys.path:
        sys.path.append(root)
    import general_adapters
    with tempfile.TemporaryDirectory(prefix="figure-probe-") as folder:
        work = Path(folder)
        (work / "figures").mkdir()
        try:
            svg, _ = general_adapters._figure(figure, False, 1, work, declared=declared)
        except ImportError:
            return None
        except Exception as exc:  # noqa: BLE001 - only the constructors' own refusals are a verdict
            if not general_adapters.figure_refused(exc):
                raise
            result = GeneralSourceError("SOURCE_FIGURE", "The pinned skill cannot draw this figure")
        else:
            # The key of G75: the SVG with its white space collapsed (emit_html._fig_key).
            result = "svg:" + hashlib.sha256(re.sub(r"\s+", " ", svg).strip().encode("utf-8")).hexdigest()
    if len(_DRAWN) >= _DRAWN_LIMIT:
        _DRAWN.clear()
    _DRAWN[key] = result
    return result


def figure_refusal(figure, *, skill_path=None, declared=frozenset()):
    """SOURCE_FIGURE when the pinned constructors refuse this validated figure, else None.

    ``declared`` is general_adapters.declared_properties of the question, so
    the figure is routed exactly as the render routes it. Without a
    configured middle-school skill nothing can be drawn here and the render
    decides, as before. The skill folder is appended to the import path, so
    a module of the engine is never shadowed by one of the skill's.
    """
    root = _skill_root(skill_path)
    if not isinstance(figure, dict) or root is None:
        return None
    drawn = _draw(figure, frozenset(declared), root)
    return drawn if isinstance(drawn, GeneralSourceError) else None


def drawing_key(figure, *, skill_path=None, declared=frozenset()):
    """The identity of the SVG this validated figure prints, as G75 compares figures; None without one.

    Two questions with one key print one drawing. Without a configured skill
    the key is the figure's own canonical form, which names the same drawing
    whenever the constructors would.
    """
    if not isinstance(figure, dict):
        return None
    root = _skill_root(skill_path)
    if root is None:
        return "figure:" + json.dumps(figure, sort_keys=True, ensure_ascii=False)
    drawn = _draw(figure, frozenset(declared), root)
    return drawn if isinstance(drawn, str) else None
