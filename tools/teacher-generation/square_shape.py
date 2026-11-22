"""Rebuild the named square, comparison quadrilateral, or coordinate construction."""

from __future__ import annotations


def render_square(spec):
    import shapekit as sk

    family = spec["family"]
    s = spec["unit"]
    if family == "coordinate":
        from figkit_plus import wide

        points = [tuple(p) for p in spec["points"]]
        xs, ys = zip(*points)
        return wide(
            (min(-1, min(xs) - 1), max(1, max(xs) + 1)),
            (min(-1, min(ys) - 1), max(1, max(ys) + 1)),
            points=list(zip(points, "ABCD")),
            solid=list(zip(points, points[1:] + points[:1])),
            max_width=280,
        )
    tag = "quad." + family
    args = dict(names="ABCD", rotate=spec["rotation"], marks=False, fam=tag)
    if family == "rectangle":
        g, d = sk.shape("rectangle", w=2 * s, h=s, **args)
    elif family == "rhombus":
        g, d = sk.shape("rhombus", d1=6 * s, d2=8 * s, **args)
    else:
        g, d = sk.shape(
            "square", a=(2**0.5) * s if family == "diagonals" else s, **args
        )
    if family == "diagonals":
        sk.diagonals(g, d, dash=None)
    elif family == "one_diagonal":
        sk.segment(g, d, "A", "C")
    elif family == "midpoint":
        sk.midpoint(g, d, "A", "B", name="M")
    elif family == "rhombus":
        sk.diagonals(g, d, dash=None)
    elif family == "opposite_midpoints":
        sk.midpoint(g, d, "A", "B", name="M")
        sk.midpoint(g, d, "C", "D", name="N")
        sk.segment(g, d, "M", "N")
    elif family not in ("outline", "rectangle"):
        raise ValueError("Unknown square construction")
    # Retain an actual pupil given on each figure. The skill records figure
    # geometry by its rendered SVG, so two geometrically similar diagrams
    # with different numerical scales must remain distinguishable.
    if family == "diagonals":
        sk.side_label(g, d, "A", "O", str(s), t=0.45)
    elif family == "rhombus":
        sk.side_label(g, d, "A", "C", str(6 * s), t=0.28)
    elif family in ("midpoint", "opposite_midpoints"):
        sk.side_label(g, d, "A", "M", str(s // 2))
    else:
        sk.side_label(g, d, "A", "B", str(2 * s if family == "rectangle" else s))
    return sk.finish(g, tag)
