"""Rebuild a Pythagorean diagram from the lengths or grid points printed in its question."""


def render_pythagoras(spec):
    family = spec["family"]
    if family == "grid":
        from figkit_plus import wide

        pts = {name: tuple(pair) for name, pair in spec["points"].items()}
        xs, ys = zip(*pts.values())
        return wide(
            (min(-1, *xs) - 1, max(1, *xs) + 1),
            (min(-1, *ys) - 1, max(1, *ys) + 1),
            points=[(pair, name) for name, pair in pts.items()],
            solid=[(pts[a], pts[b]) for a, b in spec["edges"]],
            max_width=280,
        )

    import shapekit as sk

    p, q, h = spec["triple"]
    family_tag = {
        "right": "triangle.right.plain",
        "median": "triangle.right.median-to-leg",
        "rectangle": "quad.rectangle.single-diagonal",
        "isosceles": "triangle.iso.altitude",
    }[family]
    options = {"rotate": spec["rotation"], "fam": family_tag, "marks": True}
    if family == "rectangle":
        g, d = sk.shape(
            "rectangle",
            names="ABCD",
            w=p,
            h=q,
            marks=False,
            rotate=spec["rotation"],
            fam=family_tag,
        )
        sk.segment(g, d, "A", "C")
        sk.right_angle(g, d, "B", "A", "C")
    elif family == "isosceles":
        g, d = sk.shape(
            "triangle", names="ABC", variant="iso", base=2 * p, leg=h, **options
        )
        sk.altitude(g, d, "C", "A", "B", name="H", dash=None)
    else:
        g, d = sk.shape(
            "triangle",
            names="ABC",
            variant="right",
            c=(2 * p if family == "median" else p),
            b=q,
            **options,
        )
        if family == "median":
            sk.median(g, d, "C", "A", "B", name="M", dash=None)
    for side, value in spec["labels"].items():
        sk.side_label(g, d, *side, str(value))
    return sk.finish(g, family_tag)
