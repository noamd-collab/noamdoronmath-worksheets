# -*- coding: utf-8 -*-
# q3_head — the code that drew this figure.
# Written by deliver.py from the build itself (skill 6.18-noam).
# fam:  quad.kite+both-diagonals
# view: {"data_unit_px": [18.381252, 18.381252], "height_px": 233.0, "rotate": null, "unit_px": 1.0, "viewbox": [169.6, 233.0], "width_px": 169.6}
# RUNNABLE: running this file re-draws figures/q3_head.svg byte for byte (checked when the package was written).
# Change a number in the call below and run it again; `python3 q3_head.py > q3_head.svg`.

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

svg = _draw({'points': {'K': (1.02606043, -2.819077862), 'M': (-2.736161147, 7.517540966), 'L': (-3.758770483, -1.368080573), 'N': (3.758770483, 1.368080573), 'P': (0.0, 0.0)}, 'polygons': ['KLMN'], 'segments': ['KM', 'LN'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals'}, replay=False)

if __name__ == "__main__":
    sys.stdout.write(svg)

# ---- where the level asked for it, innermost first (for reading; not executed) ----
# level_b.py:46 in _draw()
#   Q = {'K': (18.860275777211818, 51.81818181483977), 'M': (-50.294068745358594, -138.18181818516024), 'L': (-69.09090909258012, 25.147034363488675), 'N': (69.09090909258012, -25.147034363488675), 'P': (0.0, -0.0)}
#   k = 18.381252434821814
#   n = 'P'
#   names = 'KLMN'
#   p = (0.0, -0.0)
#   pts = {'K': (1.02606043, -2.819077862), 'M': (-2.736161147, 7.517540966), 'L': (-3.758770483, -1.368080573), 'N': (3.758770483, 1.368080573), 'P': (0.0, 0.0)}
#   replay = True
#   s = 'LN'
#   span = 10.336618828
#   spec = {'points': {'K': (1.02606043, -2.819077862), 'M': (-2.736161147, 7.517540966), 'L': (-3.758770483, -1.368080573), 'N': (3.758770483, 1.368080573), 'P': (0.0, 0.0)}, 'polygons': ['KLMN'], 'segments': ['KM', 'LN'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals'}
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
#   points = {'K': (1.02606043, -2.819077862), 'M': (-2.736161147, 7.517540966), 'L': (-3.758770483, -1.368080573), 'N': (3.758770483, 1.368080573), 'P': (0.0, 0.0)}
#   polygons = ['KLMN']
#   prefer = None
#   right = ()
#   segments = ['KM', 'LN']
#   size = None
#   spec = {'points': {'K': (1.02606043, -2.819077862), 'M': (-2.736161147, 7.517540966), 'L': (-3.758770483, -1.368080573), 'N': (3.758770483, 1.368080573), 'P': (0.0, 0.0)}, 'polygons': ['KLMN'], 'segments': ['KM', 'LN'], 'labels': [], 'right': [], 'fam': 'quad.kite+both-diagonals'}
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
# level_b.py:225 in <module>()
#   | ], fig=fig(P, "quad.kite+both-diagonals", polygons=["KLMN"],
#   |            segments=["KM", "LN"]),
# content.py:33 in <module>()
#   |     _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
