# -*- coding: utf-8 -*-
# q8_head — the code that drew this figure.
# Written by deliver.py from the build itself (skill 6.18-noam).
# fam:  quad.kite+diagonals
# view: {"data_unit_px": [17.470151, 17.470151], "height_px": 229.6, "rotate": null, "unit_px": 1.0, "viewbox": [166.6, 229.6], "width_px": 166.6}
# RUNNABLE: running this file re-draws figures/q8_head.svg byte for byte (checked when the package was written).
# Change a number in the call below and run it again; `python3 q8_head.py > q8_head.svg`.

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
import figkit
def kdraw(spec):
    pts = spec["points"]
    xs = [p[0] for p in pts.values()]
    ys = [p[1] for p in pts.values()]
    span = max(max(xs) - min(xs), max(ys) - min(ys))
    k = spec["size"] / span
    Q = dict((n, (p[0] * k, -p[1] * k)) for n, p in pts.items())
    g = figkit.Figure()
    g.ex.set_data(lambda p: (p[0] / k, -p[1] / k))
    for n, p in Q.items():
        g.ex.name_point(p, n)
    for names in spec["polygons"]:
        g.poly([Q[n] for n in names])
    for s in spec["segments"]:
        g.line(Q[s[0]], Q[s[1]])
    for s, n in spec["ticks"]:
        g.ticks(Q[s[0]], Q[s[1]], n=n)
    for a in spec["right"]:
        g.right_angle(Q[a[1]], Q[a[0]], Q[a[2]])
    for n in spec.get("dots", []):
        g.dot(Q[n])
    for a, n in spec.get("arcs", []):
        g.arc(Q[a[1]], Q[a[0]], Q[a[2]], n=n)
    for angs in spec.get("equal_arcs", []):
        g.ex.constrain("equal_angle", marked=True,
                       of=[dict(at=x[1], rays=[x[0], x[2]]) for x in angs])
    for n, p in Q.items():
        g.label(p, n, size=14, kind="vertex",
                prefer=spec["prefer"].get(n))
    for s, t in spec["labels"]:
        g.edge_label(Q[s[0]], Q[s[1]], t, size=13)
    return g.render(fam=spec["fam"])
svg = kdraw({'points': {'E': (-1.267855, 2.718923), 'F': (-3.625231, -1.690473), 'G': (3.803564, -8.15677), 'H': (3.625231, 1.690473), 'M': (0.0, 0.0)}, 'polygons': ['EFGH'], 'segments': ['EG', 'FH'], 'ticks': [['FM', 1], ['MH', 1]], 'right': ['EMF'], 'labels': [], 'fam': 'quad.kite+diagonals', 'size': 190, 'prefer': {}})

if __name__ == "__main__":
    sys.stdout.write(svg)

# ---- where the level asked for it, innermost first (for reading; not executed) ----
# level_a.py:89 in fig()
#   arcs = ()
#   dots = ()
#   fam = 'quad.kite+diagonals'
#   labels = ()
#   points = {'E': (-1.267855, 2.718923), 'F': (-3.625231, -1.690473), 'G': (3.803564, -8.15677), 'H': (3.625231, 1.690473), 'M': (0.0, 0.0)}
#   polygons = ['EFGH']
#   prefer = None
#   right = ['EMF']
#   segments = ['EG', 'FH']
#   size = 190
#   spec = {'points': {'E': (-1.267855, 2.718923), 'F': (-3.625231, -1.690473), 'G': (3.803564, -8.15677), 'H': (3.625231, 1.690473), 'M': (0.0, 0.0)}, 'polygons': ['EFGH'], 'segments': ['EG', 'FH'], 'ticks': [['FM', 1], ['MH', 1]], 'right': ['EMF'], 'labels': [], 'fam': 'quad.kite+diagonals', 'size': 190, 'prefer': {}}
#   ticks = [('FM', 1), ('MH', 1)]
#   | def fig(points, fam, polygons=("ABCD",), segments=(), ticks=(), right=(),
#   |         labels=(), size=190, prefer=None, arcs=(), dots=()):
#   |     spec = dict(points=dict(points), polygons=list(polygons),
#   |                 segments=list(segments), ticks=[list(t) for t in ticks],
#   |                 right=list(right), labels=[list(x) for x in labels],
#   |                 fam=fam, size=size, prefer=dict(prefer or {}))
#   |     if dots:
#   |         spec["dots"] = list(dots)
#   |     if arcs:
#   |         spec["arcs"] = [list(x) for x in arcs]
#   |         groups = {}
#   |         for a, n in arcs:
#   |             groups.setdefault(n, []).append(a)
#   |         spec["equal_arcs"] = [g for g in groups.values() if len(g) > 1]
#   |     src = DRAW_SRC + u"svg = kdraw(%r)\n" % (spec,)
#   |     with export.replay(src):
#   |         return _NS["kdraw"](spec)
# level_a.py:362 in <module>()
#   | ], fig=fig(P8, "quad.kite+diagonals", polygons=["EFGH"],
#   |            segments=["EG", "FH"], ticks=[("FM", 1), ("MH", 1)],
#   |            right=["EMF"]),
# content.py:33 in <module>()
#   |     _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
