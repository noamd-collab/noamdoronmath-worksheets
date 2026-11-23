"""Draw one middle-school question's figure before the question is chosen.

The render draws every figure with the pinned skill's constructors
(general_adapters._figure). A figure those constructors refuse used to be
found only there, with no question named, and cost a whole render round.
Here the same call draws the figure of one validated question into a
temporary folder, so a figure the skill cannot draw is a refusal of that
question (SOURCE_FIGURE) and a reserve takes its place.

Nothing is repaired here and nothing drawn here is kept.
"""
from __future__ import annotations

import os
from pathlib import Path
import sys
import tempfile

from general_source import GeneralSourceError


def _skill_root(skill_path=None):
    root = skill_path or os.environ.get("MIDDLE_SKILL_PATH")
    if not root or not (Path(root) / "SKILL.md").is_file():
        return None
    return str(Path(root))


def figure_refusal(figure, *, skill_path=None):
    """SOURCE_FIGURE when the pinned constructors refuse this validated figure, else None.

    Without a configured middle-school skill nothing can be drawn here and
    the render decides, as before. The skill folder is appended to the
    import path, so a module of the engine is never shadowed by one of the
    skill's.
    """
    root = _skill_root(skill_path)
    if not isinstance(figure, dict) or root is None:
        return None
    if root not in sys.path:
        sys.path.append(root)
    import general_adapters
    with tempfile.TemporaryDirectory(prefix="figure-probe-") as folder:
        work = Path(folder)
        (work / "figures").mkdir()
        try:
            general_adapters._figure(figure, False, 1, work)
        except ImportError:
            return None
        except Exception as exc:  # noqa: BLE001 - only the constructors' own refusals are a verdict
            if not general_adapters.figure_refused(exc):
                raise
            return GeneralSourceError("SOURCE_FIGURE", "The pinned skill cannot draw this figure")
    return None
