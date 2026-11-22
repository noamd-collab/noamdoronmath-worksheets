"""Figures for the grade-nine short-leg theorem, built by the pinned geometry skill."""
from __future__ import annotations

from math import ceil, floor, sqrt


def _coordinate_triangle(spec, names, short, long):
    from figkit_plus import wide

    x, y = spec["anchor"]
    a = (x, y)
    if spec["vertical"]:
        b, c = (x, y + short), (x + long, y)
    else:
        b, c = (x + short, y), (x, y + long)
    points = [a, b, c]
    xs, ys = zip(*points)
    return wide(
        (min(-1, floor(min(xs)) - 2), max(1, ceil(max(xs)) + 2)),
        (min(-1, floor(min(ys)) - 2), max(1, ceil(max(ys)) + 2)),
        points=list(zip(points, names)), solid=[(a, b), (b, c), (c, a)], max_width=280,
    )


def render_triangle(spec):
    """A is the right angle, AB the short leg and BC the hypotenuse."""
    import shapekit as sk

    a, b, c = spec["names"]
    s = spec["short"]
    counterexample = spec["counterexample"]
    short, hyp = (3 * s, 5 * s) if counterexample else (s, 2 * s)
    family, mode = spec["family"], spec["mode"]
    if family == "coordinate":
        return _coordinate_triangle(spec, (a, b, c), short, 4 * s if counterexample else sqrt(3) * s)

    family_tag = "triangle.right." + family
    g, data = sk.shape(
        "triangle", variant="right", c=short, hyp=hyp, rotate=spec["rotate"],
        names=spec["names"], marks=True, fam=family_tag,
    )
    if family == "mid_short":
        sk.midpoint(g, data, a, b, name="M")
    elif family == "mid_hyp":
        sk.midpoint(g, data, b, c, name="M")
    elif family in ("extend_short", "extend_hyp"):
        start, end = (a, b) if family == "extend_short" else (b, c)
        x1, y1 = g.pts[data[start]]
        x2, y2 = g.pts[data[end]]
        # Record D as a named point in both the SVG and the editable figure model.
        sk.point(g, data, "D", (x2 + (x2 - x1) / 2, y2 + (y2 - y1) / 2))
        sk.segment(g, data, end, "D")
    elif family in ("rectangle", "equilateral"):
        # Shapekit add-ons take coordinates in the normalized pre-rotation frame.
        ax, ay = g.pts[data[a]]
        bx, by = g.pts[data[b]]
        cx, cy = g.pts[data[c]]
        if family == "rectangle":
            sk.point(g, data, "D", (bx + cx - ax, by + cy - ay))
            sk.segment(g, data, b, "D")
        else:
            # AC is perpendicular to AB, so reflection across AC sends B to 2A-B.
            sk.point(g, data, "D", (2 * ax - bx, 2 * ay - by))
            sk.segment(g, data, a, "D")
        sk.segment(g, data, c, "D")
    elif family != "plain":
        raise ValueError("Unknown special-triangle construction")

    if mode != "converse" and not counterexample:
        sk.angle_arc(g, data, c, a, b, text="30°")
    if mode in ("forward_short", "converse"):
        sk.side_label(g, data, a, b, str(short))
    if mode in ("forward_hyp", "converse"):
        sk.side_label(g, data, b, c, str(hyp))
    return sk.finish(g, family_tag)
