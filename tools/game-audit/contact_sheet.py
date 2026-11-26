#!/usr/bin/env python3
"""Contact sheet of a game's step screenshots, one row per viewport.

    python3 contact_sheet.py --tools ~/work/tools <slug> [--steps 0,1,3,5,8]
                             [--shots-root shots-live] [--out contact]

Writes <tools>/<out>/<slug>.png: phone row above desktop row, each cell labelled
"<vp> step <n>". Use it to look at every step of a game in one image instead of
opening a dozen files.
"""
import argparse
import pathlib

from PIL import Image, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument("--tools", required=True, type=pathlib.Path)
ap.add_argument("--shots-root", default="shots-live")
ap.add_argument("--out", default="contact")
ap.add_argument("--steps", default="0,1,3,5,8")
ap.add_argument("--width", type=int, default=250)
ap.add_argument("slug")
a = ap.parse_args()
base = a.tools / a.shots_root / a.slug
out = a.tools / a.out / f"{a.slug}.png"
out.parent.mkdir(parents=True, exist_ok=True)
steps = [int(x) for x in a.steps.split(",") if x.strip() != ""]


def sheet(vp):
    imgs = []
    for i in steps:
        p = base / f"{vp}-{i:02d}.png"
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        h = int(im.height * a.width / im.width)
        imgs.append((i, im.resize((a.width, h), Image.LANCZOS)))
    if not imgs:
        return None
    pad, label = 8, 22
    W = len(imgs) * a.width + (len(imgs) + 1) * pad
    H = max(im.height for _, im in imgs) + 2 * pad + label
    canvas = Image.new("RGB", (W, H), "white")
    d = ImageDraw.Draw(canvas)
    for k, (i, im) in enumerate(imgs):
        x = pad + k * (a.width + pad)
        canvas.paste(im, (x, pad + label))
        d.text((x + 4, pad + 4), f"{vp} step {i}", fill="black")
    return canvas


parts = [p for p in (sheet("phone"), sheet("desktop")) if p]
if not parts:
    raise SystemExit(f"no screenshots under {base}")
W = max(p.width for p in parts)
H = sum(p.height for p in parts) + 10
canvas = Image.new("RGB", (W, H), "white")
y = 0
for p in parts:
    canvas.paste(p, (0, y))
    y += p.height + 10
canvas.save(out)
print(out, canvas.size)
