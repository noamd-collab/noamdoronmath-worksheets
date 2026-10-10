"""Find the empty pixel row just above each exercise label.

The crop used to start a fixed fraction above the pin. That cut tall glyph
tops and left a sliver of the next label. For each pin, the lowest white
row in [pin.y - 0.6*line, pin.y - 0.003] is the top of that label. A dashed
answer rule is ink, so the white gap under it is chosen and the dash stays
out.

When that full-width row does not exist (a drawing on the left fills every
row), the same search runs only in the text column (x 0.45–0.95). If a
rectangle, triangle, or grid still crosses that edge, the crop grows to the
whole drawing. A table border with no white row still returns null, and the
catalog builder falls back to half a line.
"""
import json
import math
import sys
from concurrent.futures import ProcessPoolExecutor

import numpy as np
import pymupdf

ZOOM = 4  # 288 dpi, fine enough to see a one-pixel gap at 300 dpi
INK = 250
X0 = 0.05
X1 = 0.95
TEXT_X0 = 0.45
TEXT_X1 = 0.95


def round4(value):
    if value is None:
        return None
    return math.floor(float(value) * 10000 + 0.5) / 10000


def white_rows(pix, x0_frac, x1_frac):
    height, width, channels = pix.height, pix.width, pix.n
    image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(height, width, channels)
    x0 = int(width * x0_frac)
    x1 = int(width * x1_frac)
    if x1 <= x0:
        x0, x1 = 0, width
    band = image[:, x0:x1, : min(3, channels)]
    return (band >= INK).all(axis=(1, 2))


def white_top(flags, pin_y, line):
    height = flags.shape[0]
    line = line if line and line > 0 else 0.026
    high = min(height - 1, max(0, int(round((pin_y - 0.003) * height))))
    low = min(height - 1, max(0, int(round((pin_y - 0.6 * line) * height))))
    if high < low:
        return None
    window = flags[low:high + 1]
    if not window.any():
        return None
    # Lowest empty row: the one closest to the pin, just above the label ink.
    offset = int(np.flatnonzero(window)[-1])
    return round4((low + offset) / height)


def lift_above_drawing(pix, figure_top, floor, max_lift=0.04):
    """Full-width white row above the drawing and any stem ink sitting on it.

    Vector boxes sit inside the stroke, so the raster can extend past them.
    Walk up through that ink and stop at the first real white gap, which keeps
    a dashed answer rule that sits further up out of the crop.
    """
    flags = white_rows(pix, X0, X1)
    height = flags.shape[0]
    start = min(height - 1, max(0, int(round(figure_top * height))))
    floor_y = max(floor, figure_top - max_lift)
    floor_i = max(0, int(round(floor_y * height)))
    gap_rows = max(2, int(round(0.0035 * height)))
    white_run = 0
    for index in range(start, floor_i - 1, -1):
        if flags[index]:
            white_run += 1
            if white_run >= gap_rows:
                return round4((index + white_run - 1) / height)
        else:
            white_run = 0
    return round4(max(floor, figure_top - 0.003))


def page_figures(page):
    """Left-side rectangles, triangles, and grids. Not rules or answer dashes."""
    width = page.rect.width or 1
    height = page.rect.height or 1
    boxes = []
    for drawing in page.get_drawings():
        rect = drawing.get('rect')
        if rect is None:
            continue
        x0, y0, x1, y1 = rect.x0 / width, rect.y0 / height, rect.x1 / width, rect.y1 / height
        boxes.append((x0, y0, x1, y1))
    for info in page.get_image_info() or []:
        bbox = info.get('bbox')
        if not bbox:
            continue
        x0, y0, x1, y1 = bbox[0] / width, bbox[1] / height, bbox[2] / width, bbox[3] / height
        boxes.append((x0, y0, x1, y1))
    kept = []
    for x0, y0, x1, y1 in boxes:
        w, h = x1 - x0, y1 - y0
        if h > 0.45 or y1 < 0.03 or y0 > 0.98:
            continue
        if x0 > 0.52:
            continue  # text-column decoration, not the figure beside the label
        if w > 0.62:
            continue  # full-width rule or answer line
        axis = h >= 0.04 and w <= 0.02 and x1 <= 0.55
        if not axis and (h < 0.012 or w < 0.02):
            continue
        kept.append((x0, y0, x1, y1))
    return cluster_boxes(kept)


def cluster_boxes(boxes, gap=0.014):
    pending = [list(box) for box in boxes]
    changed = True
    while changed and pending:
        changed = False
        merged = []
        used = [False] * len(pending)
        for index, box in enumerate(pending):
            if used[index]:
                continue
            x0, y0, x1, y1 = box
            used[index] = True
            grew = True
            while grew:
                grew = False
                for other_index, other in enumerate(pending):
                    if used[other_index]:
                        continue
                    if other[0] <= x1 + gap and other[2] >= x0 - gap and other[1] <= y1 + gap and other[3] >= y0 - gap:
                        used[other_index] = True
                        x0, y0 = min(x0, other[0]), min(y0, other[1])
                        x1, y1 = max(x1, other[2]), max(y1, other[3])
                        grew = True
                        changed = True
            merged.append([x0, y0, x1, y1])
        pending = merged
    return [tuple(box) for box in pending]


def pack_gap(y_value, bottom):
    y_value = round4(y_value) if y_value is not None else None
    bottom = round4(bottom) if bottom is not None else None
    if bottom is not None and (y_value is None or bottom > y_value + 0.008):
        return {'y': y_value, 'bottom': bottom}
    return y_value


def measure_pins(pins, full_flags, text_flags, pix, figures):
    """pins are on one page, in any order. Returns id -> gap."""
    ordered = sorted(pins, key=lambda pin: float(pin['y']))
    full_tops = [white_top(full_flags, float(pin['y']), float(pin.get('line') or 0)) for pin in ordered]
    text_tops = [white_top(text_flags, float(pin['y']), float(pin.get('line') or 0)) for pin in ordered]

    def edge_at(index):
        if full_tops[index] is not None:
            return full_tops[index]
        if text_tops[index] is not None:
            return text_tops[index]
        line = float(ordered[index].get('line') or 0) or 0.026
        return max(0.0, float(ordered[index]['y']) - line / 2)

    edges = [edge_at(index) for index in range(len(ordered))]
    owned = {id(pin): [] for pin in ordered}
    for figure in figures:
        best_index = None
        best_overlap = 0.0
        for index, pin in enumerate(ordered):
            previous_y = float(ordered[index - 1]['y']) if index else None
            if previous_y is not None and figure[1] < previous_y + 0.01:
                continue
            next_edge = edges[index + 1] if index + 1 < len(ordered) else min(0.985, edges[index] + 0.2)
            overlap = min(figure[3], next_edge) - max(figure[1], edges[index])
            if figure[1] < edges[index]:
                overlap += edges[index] - figure[1]
            if overlap > best_overlap and overlap > 0.008 and figure[1] < edges[index] + 0.004:
                best_overlap = overlap
                best_index = index
        if best_index is not None:
            owned[id(ordered[best_index])].append(figure)

    gaps = {}
    for index, pin in enumerate(ordered):
        if full_tops[index] is not None:
            gaps[pin['id']] = full_tops[index]
            continue
        y_value = text_tops[index]
        edge = edges[index]
        figures_here = owned[id(pin)]
        bottom = None
        if figures_here:
            figure_top = min(item[1] for item in figures_here)
            figure_bottom = max(item[3] for item in figures_here)
            floor = float(ordered[index - 1]['y']) + 0.012 if index else 0.0
            lifted = lift_above_drawing(pix, figure_top, floor)
            if lifted < edge - 0.0005 and lifted < float(pin['y']):
                y_value = lifted
            next_edge = edges[index + 1] if index + 1 < len(ordered) else None
            if next_edge is not None and figure_bottom > next_edge + 0.006:
                extended = round4(figure_bottom + 0.003)
                # Stay inside this question. The next question's label is not part of the drawing.
                question = pin.get('q')
                cap = None
                for later in ordered[index + 1:]:
                    if question is not None and later.get('q') != question:
                        cap = edge_at(ordered.index(later))
                        break
                if cap is not None:
                    extended = min(extended, round4(cap - 0.002))
                if extended > next_edge + 0.004:
                    bottom = extended
        if y_value is not None and y_value >= float(pin['y']):
            y_value = None
        gaps[pin['id']] = pack_gap(y_value, bottom)
    return gaps


def measure_job(job):
    gaps = {}
    try:
        doc = pymupdf.open(job['pdf'])
    except Exception as error:  # noqa: BLE001 — one bad file should not stop the catalog
        sys.stderr.write(f"measure open failed {job.get('id')}: {error}\n")
        for page in job.get('pages') or []:
            for pin in page.get('pins') or []:
                gaps[pin['id']] = None
        return {'id': job.get('id'), 'gaps': gaps}
    grouped = {}
    for page in job.get('pages') or []:
        grouped.setdefault(int(page['page']), []).extend(page.get('pins') or [])
    for page_no, pins in grouped.items():
        if page_no < 1 or page_no > doc.page_count:
            for pin in pins:
                gaps[pin['id']] = None
            continue
        page = doc[page_no - 1]
        pix = page.get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
        full_flags = white_rows(pix, X0, X1)
        text_flags = white_rows(pix, TEXT_X0, TEXT_X1)
        needs_figure = any(
            white_top(full_flags, float(pin['y']), float(pin.get('line') or 0)) is None
            for pin in pins
        )
        figures = page_figures(page) if needs_figure else []
        gaps.update(measure_pins(pins, full_flags, text_flags, pix, figures))
    doc.close()
    return {'id': job.get('id'), 'gaps': gaps}


def dark_count(rows):
    if rows.size == 0:
        return 0
    return int((rows < INK).any(axis=2).sum())


def crop_edges(spec):
    doc = pymupdf.open(spec['pdf'])
    zoom = 300 / 72
    by_page = {}
    for crop in spec.get('crops') or []:
        by_page.setdefault(int(crop['page']), []).append(crop)
    reports = []
    for page_no, crops in by_page.items():
        pix = doc[page_no - 1].get_pixmap(matrix=pymupdf.Matrix(zoom, zoom), alpha=False)
        height, width, channels = pix.height, pix.width, pix.n
        image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(height, width, channels)
        x0 = int(width * X0)
        x1 = int(width * X1)
        for crop in crops:
            top = int(round(float(crop['y']) * height))
            bottom = int(round((float(crop['y']) + float(crop['h'])) * height))
            top = min(max(top, 0), height - 1)
            bottom = min(max(bottom, top + 1), height)
            band = image[top:bottom, x0:x1, : min(3, channels)]
            reports.append({
                'id': crop.get('id'),
                'topDark': dark_count(band[:1]),
                'botDark': dark_count(band[-1:]),
                'midDark': dark_count(band),
            })
    doc.close()
    return reports


def main():
    data = json.load(sys.stdin)
    if isinstance(data, dict) and data.get('cmd') == 'edges':
        json.dump(crop_edges(data), sys.stdout)
        return
    jobs = data if isinstance(data, list) else [data]
    if len(jobs) <= 1:
        json.dump([measure_job(job) for job in jobs], sys.stdout)
        return
    workers = min(4, len(jobs))
    with ProcessPoolExecutor(max_workers=workers) as pool:
        results = list(pool.map(measure_job, jobs, chunksize=4))
    json.dump(results, sys.stdout)


if __name__ == '__main__':
    main()
