# -*- coding: utf-8 -*-
# q16_head — the code that drew this figure.
# Written by deliver.py from the build itself (skill 6.18-noam).
# fam:  compound.two-kites-same-sides
# view: {"data_unit_px": [3.146943, 3.146943], "height_px": 201.0, "rotate": null, "unit_px": 1.0, "viewbox": [331.5, 201.0], "width_px": 331.5}
# RUNNABLE: running this file re-draws figures/q16_head.svg byte for byte (checked when the package was written).
# Change a number in the call below and run it again; `python3 q16_head.py > q16_head.svg`.

import os
import sys
from fractions import Fraction  # noqa: F401
_HERE = os.path.dirname(os.path.abspath(globals().get("__file__", ".")))
_FOUND = __import__("importlib.util").util.find_spec("figkit") is not None
SKILL = os.environ.get("WORKSHEET_SKILL_DIR") or (None if _FOUND else next((p for p in ('/Users/noamdoron/worksheet-work/hub-18/tasks/18-worksheets/work/buildroot/skills/hebrew-math-worksheet-v5', os.path.join(_HERE, "..", "skill"), os.path.join(_HERE, "..", "..", "skill"), os.path.expanduser("~/.claude/skills/hebrew-math-worksheet-v5")) if os.path.isfile(os.path.join(p, "figkit.py"))), None))
if SKILL:
    sys.path.insert(0, SKILL)
elif not _FOUND:
    raise SystemExit("set WORKSHEET_SKILL_DIR to the folder of the hebrew-math-worksheet skill")
sys.path.insert(0, os.path.join(_HERE, "..", "source"))
import export  # the skill's; light_import below
inspect = export.light_import('inspect')  # its defs only: the call below runs in well under a second
def _draw(spec, replay=True):
    u"""Exact native figure: points in DATA units, scaled uniformly."""
    import figkit
    import export
    pts = spec["points"]
    span = max(max(p[i] for p in pts.values()) - min(p[i] for p in pts.values())
               for i in (0, 1))
    k = spec.get("size", 190) / span
    Q = dict((n, (p[0] * k, -p[1] * k)) for n, p in pts.items())
    g = figkit.Figure()
    g.ex.set_data(lambda p: (p[0] / k, -p[1] / k))
    for n, p in sorted(Q.items()):
        g.ex.name_point(p, n)
    for names in spec.get("polygons", []):
        g.poly([Q[n] for n in names])
    for s in spec.get("segments", []):
        g.line(Q[s[0]], Q[s[1]])
    for n, p in sorted(Q.items()):
        g.label(p, n, size=14, kind="vertex",
                prefer=spec.get("prefer", {}).get(n))
    for s, t in spec.get("labels", []):
        g.edge_label(Q[s[0]], Q[s[1]], t, size=13)
    for s in spec.get("right", []):
        g.right_angle(Q[s[1]], Q[s[0]], Q[s[2]])
    if replay:
        src = (u"import inspect\n" + inspect.getsource(_draw)
               + u"\nsvg = _draw(%r, replay=False)\n" % (spec,))
        with export.replay(src):
            return g.render(fam=spec["fam"])
    return g.render(fam=spec["fam"])

svg = _draw({'points': {'A': (-0.0, -20.0), 'C': (0.0, 28.0), 'B': (-21.0, 0.0), 'D': (21.0, -0.0), 'O': (0.0, 0.0), 'K': (52.0, -18.502518078), 'M': (52.0, 26.950754632), 'L': (29.669374734, 0.0), 'N': (74.330625266, -0.0)}, 'polygons': ['ABCD', 'KLMN'], 'segments': ['AC', 'BD', 'KM'], 'labels': [], 'right': ['KLM'], 'fam': 'compound.two-kites-same-sides', 'size': 300}, replay=False)

if __name__ == "__main__":
    sys.stdout.write(svg)

# ---- where the level asked for it, innermost first (for reading; not executed) ----
# level_b.py:46 in _draw()
#   Q = {'A': (-0.0, 62.93885079698435), 'C': (0.0, -88.11439111577809), 'B': (-66.08579333683356, -0.0), 'D': (66.08579333683356, 0.0), 'O': (0.0, -0.0), 'K': (163.6410120721593, 58.22636123398738), 'M': (163.6410120721593, -84.81247623247914), 'L': (93.36781748115216, -0.0), 'N': (233.91420666316645, 0.0)}
#   k = 3.1469425398492175
#   n = 'O'
#   names = 'KLMN'
#   p = (0.0, -0.0)
#   pts = {'A': (-0.0, -20.0), 'C': (0.0, 28.0), 'B': (-21.0, 0.0), 'D': (21.0, -0.0), 'O': (0.0, 0.0), 'K': (52.0, -18.502518078), 'M': (52.0, 26.950754632), 'L': (29.669374734, 0.0), 'N': (74.330625266, -0.0)}
#   replay = True
#   s = 'KLM'
#   span = 95.330625266
#   spec = {'points': {'A': (-0.0, -20.0), 'C': (0.0, 28.0), 'B': (-21.0, 0.0), 'D': (21.0, -0.0), 'O': (0.0, 0.0), 'K': (52.0, -18.502518078), 'M': (52.0, 26.950754632), 'L': (29.669374734, 0.0), 'N': (74.330625266, -0.0)}, 'polygons': ['ABCD', 'KLMN'], 'segments': ['AC', 'BD', 'KM'], 'labels': [], 'right': ['KLM'], 'fam': 'compound.two-kites-same-sides', 'size': 300}
#   | def _draw(spec, replay=True):
#   |     u"""Exact native figure: points in DATA units, scaled uniformly."""
#   |     import figkit
#   |     import export
#   |     pts = spec["points"]
#   |     span = max(max(p[i] for p in pts.values()) - min(p[i] for p in pts.values())
#   |                for i in (0, 1))
#   |     k = spec.get("size", 190) / span
#   |     Q = dict((n, (p[0] * k, -p[1] * k)) for n, p in pts.items())
#   |     g = figkit.Figure()
#   |     g.ex.set_data(lambda p: (p[0] / k, -p[1] / k))
#   |     for n, p in sorted(Q.items()):
#   |         g.ex.name_point(p, n)
#   |     for names in spec.get("polygons", []):
#   |         g.poly([Q[n] for n in names])
#   |     for s in spec.get("segments", []):
#   |         g.line(Q[s[0]], Q[s[1]])
#   |     for n, p in sorted(Q.items()):
#   |         g.label(p, n, size=14, kind="vertex",
#   |                 prefer=spec.get("prefer", {}).get(n))
#   |     for s, t in spec.get("labels", []):
#   |         g.edge_label(Q[s[0]], Q[s[1]], t, size=13)
#   |     for s in spec.get("right", []):
#   |         g.right_angle(Q[s[1]], Q[s[0]], Q[s[2]])
#   |     if replay:
#   |         src = (u"import inspect\n" + inspect.getsource(_draw)
#   |                + u"\nsvg = _draw(%r, replay=False)\n" % (spec,))
#   |         with export.replay(src):
#   |             return g.render(fam=spec["fam"])
#   |     return g.render(fam=spec["fam"])
# level_b.py:79 in fig()
#   fam = 'compound.two-kites-same-sides'
#   labels = ()
#   points = {'A': (-0.0, -20.0), 'C': (0.0, 28.0), 'B': (-21.0, 0.0), 'D': (21.0, -0.0), 'O': (0.0, 0.0), 'K': (52.0, -18.502518078), 'M': (52.0, 26.950754632), 'L': (29.669374734, 0.0), 'N': (74.330625266, -0.0)}
#   polygons = ['ABCD', 'KLMN']
#   prefer = None
#   right = ['KLM']
#   segments = ['AC', 'BD', 'KM']
#   size = 300
#   spec = {'points': {'A': (-0.0, -20.0), 'C': (0.0, 28.0), 'B': (-21.0, 0.0), 'D': (21.0, -0.0), 'O': (0.0, 0.0), 'K': (52.0, -18.502518078), 'M': (52.0, 26.950754632), 'L': (29.669374734, 0.0), 'N': (74.330625266, -0.0)}, 'polygons': ['ABCD', 'KLMN'], 'segments': ['AC', 'BD', 'KM'], 'labels': [], 'right': ['KLM'], 'fam': 'compound.two-kites-same-sides', 'size': 300}
#   | def fig(points, fam, polygons=("ABCD",), segments=(), labels=(), right=(),
#   |         size=None, prefer=None):
#   |     spec = dict(points=dict(points), polygons=list(polygons),
#   |                 segments=list(segments), labels=list(labels),
#   |                 right=list(right), fam=fam)
#   |     if size:
#   |         spec["size"] = size
#   |     if prefer:
#   |         spec["prefer"] = prefer
#   |     return _draw(spec)
# level_b.py:444 in <module>()
#   | ], fig=fig(P, "compound.two-kites-same-sides", polygons=["ABCD", "KLMN"],
#   |            segments=["AC", "BD", "KM"], right=["KLM"], size=300),
# content.py:33 in <module>()
#   |     _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
