# -*- coding: utf-8 -*-
# q5_head — the code that drew this figure.
# Written by deliver.py from the build itself (skill 6.18-noam).
# fam:  quad.kite+both-diagonals
# view: {"data_unit_px": [9.835124, 9.835124], "height_px": 227.5, "rotate": null, "unit_px": 1.0, "viewbox": [221.5, 227.5], "width_px": 221.5}
# RUNNABLE: running this file re-draws figures/q5_head.svg byte for byte (checked when the package was written).
# Change a number in the call below and run it again; `python3 q5_head.py > q5_head.svg`.

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

svg = _draw({'points': {'E': (-1.03527618, -3.863703305), 'G': (3.623466631, 13.522961568), 'F': (-9.659258263, 2.588190451), 'H': (9.659258263, -2.588190451), 'T': (0.0, 0.0)}, 'polygons': ['EFGH'], 'segments': ['EG', 'FH'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals', 'prefer': {'E': (-0.26, 0.97)}}, replay=False)

if __name__ == "__main__":
    sys.stdout.write(svg)

# ---- where the level asked for it, innermost first (for reading; not executed) ----
# level_b.py:46 in _draw()
#   Q = {'E': (-10.182069308234212, 37.999999998032976), 'G': (35.637242588654864, -132.99999999803296), 'F': (-95.0, -25.455173280420652), 'H': (95.0, 25.455173280420652), 'T': (0.0, -0.0)}
#   k = 9.835123713784482
#   n = 'T'
#   names = 'EFGH'
#   p = (0.0, -0.0)
#   pts = {'E': (-1.03527618, -3.863703305), 'G': (3.623466631, 13.522961568), 'F': (-9.659258263, 2.588190451), 'H': (9.659258263, -2.588190451), 'T': (0.0, 0.0)}
#   replay = True
#   s = 'FH'
#   span = 19.318516526
#   spec = {'points': {'E': (-1.03527618, -3.863703305), 'G': (3.623466631, 13.522961568), 'F': (-9.659258263, 2.588190451), 'H': (9.659258263, -2.588190451), 'T': (0.0, 0.0)}, 'polygons': ['EFGH'], 'segments': ['EG', 'FH'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals', 'prefer': {'E': (-0.26, 0.97)}}
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
#   fam = 'quad.kite+both-diagonals'
#   labels = ()
#   points = {'E': (-1.03527618, -3.863703305), 'G': (3.623466631, 13.522961568), 'F': (-9.659258263, 2.588190451), 'H': (9.659258263, -2.588190451), 'T': (0.0, 0.0)}
#   polygons = ['EFGH']
#   prefer = {'E': (-0.26, 0.97)}
#   right = ()
#   segments = ['EG', 'FH']
#   size = None
#   spec = {'points': {'E': (-1.03527618, -3.863703305), 'G': (3.623466631, 13.522961568), 'F': (-9.659258263, 2.588190451), 'H': (9.659258263, -2.588190451), 'T': (0.0, 0.0)}, 'polygons': ['EFGH'], 'segments': ['EG', 'FH'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals', 'prefer': {'E': (-0.26, 0.97)}}
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
# level_b.py:259 in <module>()
#   | ], fig=fig(P, "quad.kite+both-diagonals", polygons=["EFGH"],
#   |            segments=["EG", "FH"], prefer={"E": (-0.26, 0.97)}),
# content.py:33 in <module>()
#   |     _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
