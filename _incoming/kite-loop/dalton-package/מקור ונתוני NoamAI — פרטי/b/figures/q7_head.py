# -*- coding: utf-8 -*-
# q7_head — the code that drew this figure.
# Written by deliver.py from the build itself (skill 6.18-noam).
# fam:  quad.kite
# view: {"data_unit_px": [10.182798, 10.182798], "height_px": 192.7, "rotate": null, "unit_px": 1.0, "viewbox": [216.1, 192.7], "width_px": 216.1}
# RUNNABLE: running this file re-draws figures/q7_head.svg byte for byte (checked when the package was written).
# Change a number in the call below and run it again; `python3 q7_head.py > q7_head.svg`.

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

svg = _draw({'points': {'R': (-13.020762902, -4.739170124), 'T': (5.638155725, 2.05212086), 'S': (-2.736161147, 7.517540966), 'U': (2.736161147, -7.517540966)}, 'polygons': ['RSTU'], 'segments': [], 'labels': [], 'right': [], 'fam': 'quad.kite'}, replay=False)

if __name__ == "__main__":
    sys.stdout.write(svg)

# ---- where the level asked for it, innermost first (for reading; not executed) ----
# level_b.py:46 in _draw()
#   Q = {'R': (-132.58779894136683, 48.2580122439161), 'T': (57.4122010586332, -20.89633226846271), 'S': (-27.861776361344546, -76.54960140472241), 'U': (27.861776361344546, 76.54960140472241)}
#   k = 10.18279803873867
#   n = 'U'
#   names = 'RSTU'
#   p = (27.861776361344546, 76.54960140472241)
#   pts = {'R': (-13.020762902, -4.739170124), 'T': (5.638155725, 2.05212086), 'S': (-2.736161147, 7.517540966), 'U': (2.736161147, -7.517540966)}
#   replay = True
#   span = 18.658918627
#   spec = {'points': {'R': (-13.020762902, -4.739170124), 'T': (5.638155725, 2.05212086), 'S': (-2.736161147, 7.517540966), 'U': (2.736161147, -7.517540966)}, 'polygons': ['RSTU'], 'segments': [], 'labels': [], 'right': [], 'fam': 'quad.kite'}
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
#   fam = 'quad.kite'
#   labels = ()
#   points = {'R': (-13.020762902, -4.739170124), 'T': (5.638155725, 2.05212086), 'S': (-2.736161147, 7.517540966), 'U': (2.736161147, -7.517540966)}
#   polygons = ['RSTU']
#   prefer = None
#   right = ()
#   segments = ()
#   size = None
#   spec = {'points': {'R': (-13.020762902, -4.739170124), 'T': (5.638155725, 2.05212086), 'S': (-2.736161147, 7.517540966), 'U': (2.736161147, -7.517540966)}, 'polygons': ['RSTU'], 'segments': [], 'labels': [], 'right': [], 'fam': 'quad.kite'}
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
# level_b.py:293 in <module>()
#   | ], fig=fig(P, "quad.kite", polygons=["RSTU"]),
# content.py:33 in <module>()
#   |     _L = getattr(importlib.import_module("level_%s" % _k), "L%s" % _k)
