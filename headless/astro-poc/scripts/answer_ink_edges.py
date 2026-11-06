#!/usr/bin/env python3
"""Find printed ink that an answer crop would cut.

Each crop edge is checked on a 4x raster of the original page. A stroke that
runs across the cut, with ink just inside and just outside the crop, would be
clipped. Decoration on the cut is not answer ink: a row rule or table border
(solid, dashed or dotted), a border or cell separator that runs on through the
cut, and a tinted or highlighted background. A glyph drawn over a border is
still ink. Inside a tint, ink is what is much darker than the tint; a solid
dark shape stays ink.

No PDF is modified; the check only reads the rendered page.
"""
from collections import deque

import numpy as np
import pymupdf

SCALE = 4
DARK = 180  # luminance under this is ink on white paper
TINT = 70  # ink on a tint is this much darker than the tint
SOLID = 110  # a tone darker than this is a solid shape, not a tint
WINDOW = 12  # points of the page looked at on each side of a cut
THICK = 2.5  # points: a rule or a border is at most this thick
EDGE = 1e-6  # crop coordinates at the page edge have nothing beyond them


def page_luminance(page, scale=SCALE):
    pix = page.get_pixmap(matrix=pymupdf.Matrix(scale, scale), colorspace=pymupdf.csRGB, alpha=False)
    rgb = np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width, pix.n).astype(np.float32)
    return rgb[:, :, 0] * .299 + rgb[:, :, 1] * .587 + rgb[:, :, 2] * .114


def _typical(lum, reach):
    """The usual tone around each pixel: the median within reach pixels, taken
    along rows, then along columns."""
    out = lum
    for axis in (0, 1):
        pad = [(0, 0), (0, 0)]
        pad[axis] = (reach, reach)
        padded = np.pad(out, pad, mode='edge')
        size = out.shape[axis]
        out = np.partition([np.take(padded, range(k, k + size), axis=axis) for k in range(2 * reach + 1)], reach, axis=0)[reach]
    return out


def strip_ink(lum, reach):
    """Ink in a strip of the page: dark, and much darker than the usual tone
    around it (a tint or a highlight is not ink, nor is its edge), unless that
    tone is itself dark (a solid shape or a bold stroke)."""
    usual = _typical(lum, reach)
    return (lum < DARK) & ((lum < usual - TINT) | (usual < SOLID))


def _lines(ink, length, thick):
    """Pixels of thin straight lines along the rows of a strip: runs of at
    least `length` pixels, in at most `thick` rows. Where ink goes on across
    the line on both sides (a glyph drawn over a border), it stays ink."""
    marks = np.zeros(ink.shape, dtype=bool)
    rows, cols = ink.shape

    def beside(r):
        if r < 0 or r >= rows:
            return np.zeros(cols, dtype=bool)
        near = ink[r].copy()
        near[1:] |= ink[r, :-1]
        near[:-1] |= ink[r, 1:]
        return near

    for r in range(rows):
        bounds = np.flatnonzero(np.diff(np.concatenate(([0], ink[r].view(np.int8), [0]))))
        for c0, c1 in zip(bounds[::2], bounds[1::2]):
            if c1 - c0 < length or marks[r, c0:c1].all():
                continue
            up, down = r, r
            while up > 0 and ink[up - 1, c0:c1].mean() >= .8:
                up -= 1
            while down + 1 < rows and ink[down + 1, c0:c1].mean() >= .8:
                down += 1
            if down - up + 1 <= thick:
                through = (beside(up - 1) & beside(down + 1))[c0:c1]
                marks[up:down + 1, c0:c1] |= ink[up:down + 1, c0:c1] & ~through
    return marks


def _component(ink, seed, seen):
    rows, cols = ink.shape
    queue = deque([seed])
    seen[seed] = True
    pixels = []
    while queue:
        r, c = queue.popleft()
        pixels.append((r, c))
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                nr, nc = r + dr, c + dc
                if 0 <= nr < rows and 0 <= nc < cols and ink[nr, nc] and not seen[nr, nc]:
                    seen[nr, nc] = True
                    queue.append((nr, nc))
    rs = [p[0] for p in pixels]
    cs = [p[1] for p in pixels]
    return min(rs), max(rs), min(cs), max(cs)


def _crossings(ink, cut, lo, hi, thick, span, across):
    """Strokes of ink (rows, cols) across row `cut` of a strip, between columns
    lo and hi, that are not decoration. `span` is the crop's own length along
    the cut; a line across the cut at least `across` long is a border. Returns
    their bounding boxes in strip pixels."""
    # A rule or a border along the cut, and a border or a separator that runs
    # on through it, are thin straight lines: they are not answer ink.
    ink = ink & ~_lines(ink.T, across, thick).T
    ink = ink & ~_lines(ink, max(40, span * .3), thick)
    inside, outside = ink[cut - 1], ink[cut]
    near = outside.copy()
    near[1:] |= outside[:-1]
    near[:-1] |= outside[1:]
    seeds = [c for c in range(lo, hi) if inside[c] and near[c]]
    seen = np.zeros(ink.shape, dtype=bool)
    boxes = []
    for c in seeds:
        if seen[cut - 1, c]:
            continue
        boxes.append(_component(ink, (cut - 1, c), seen))
    found = []
    dashes = []
    for top, bottom, left, right in boxes:
        if bottom - top + 1 <= thick:
            dashes.append((top, bottom, left, right))
            continue
        found.append((top, bottom, left, right))
    # Evenly spaced short strokes along the whole cut are a dashed or dotted
    # rule. Fraction bars of one answer row are spaced by the answers.
    dashes.sort(key=lambda box: box[2])
    lengths = [right - left + 1 for _, _, left, right in dashes]
    gaps = [b[2] - a[3] - 1 for a, b in zip(dashes, dashes[1:])]
    if not (len(dashes) >= 6 and max(lengths) <= 3 * min(lengths) and max(gaps) <= 1.5 * min(gaps) + 2
            and dashes[0][2] <= lo + span * .1 and dashes[-1][3] >= hi - 1 - span * .1):
        found.extend(dashes)
    return found


def clipped_ink(page, crops, lum=None, scale=SCALE):
    """Ink that the crops of one page would cut.

    crops: [{x, y, w, h}] as fractions of the page. Returns one finding per
    stroke: {crop, edge, box} with box [x0, y0, x1, y1] in PDF points."""
    if lum is None:
        lum = page_luminance(page, scale)
    # Pixels are counted from the page size, not the raster size, which is
    # rounded up to whole pixels.
    height, width = page.rect.height * scale, page.rect.width * scale
    window = round(WINDOW * scale)
    thick = round(THICK * scale)
    findings = []
    for index, crop in enumerate(crops):
        x0, x1 = round(crop['x'] * width), round((crop['x'] + crop['w']) * width)
        y0, y1 = round(crop['y'] * height), round((crop['y'] + crop['h']) * height)
        edges = []
        if crop['y'] > EDGE:
            edges.append(('top', y0, False))
        if crop['y'] + crop['h'] < 1 - EDGE:
            edges.append(('bottom', y1, False))
        if crop['x'] > EDGE:
            edges.append(('left', x0, True))
        if crop['x'] + crop['w'] < 1 - EDGE:
            edges.append(('right', x1, True))
        for edge, at, upright in edges:
            # A vertical cut is read as a horizontal one on the transposed strip.
            plane = lum.T if upright else lum
            a, b = (y0, y1) if upright else (x0, x1)
            limit = plane.shape[0]
            top, bottom = max(0, at - window), min(limit, at + window)
            if at - top < 1 or bottom - at < 1:
                continue
            left, right = max(0, a - window), min(plane.shape[1], b + window)
            ink = strip_ink(plane[top:bottom, left:right], 4)
            # The outside of a top or left edge lies before the cut.
            cut = at - top
            if edge in ('top', 'left'):
                ink = ink[::-1]
                cut = bottom - at
            for r0, r1, c0, c1 in _crossings(ink, cut, a - left, b - left, thick, b - a, window):
                if edge in ('top', 'left'):
                    r0, r1 = ink.shape[0] - 1 - r1, ink.shape[0] - 1 - r0
                rows = (top + r0, top + r1 + 1)
                cols = (left + c0, left + c1 + 1)
                ys, xs = (cols, rows) if upright else (rows, cols)
                findings.append({'crop': index, 'edge': edge, 'box': [
                    round(xs[0] / scale, 2), round(ys[0] / scale, 2), round(xs[1] / scale, 2), round(ys[1] / scale, 2)]})
    return findings
