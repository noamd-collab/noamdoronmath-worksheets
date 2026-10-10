"""Find the empty pixel row just above each exercise label.

The crop used to start a fixed fraction above the pin. That cut tall glyph
tops and left a sliver of the next label. For each pin, the lowest white
row in [pin.y - 0.6*line, pin.y - 0.003] is the top of that label. A dashed
answer rule is ink, so the white gap under it is chosen and the dash stays
out. When the window has no white row (a table border, a graph axis), the
value is null and the catalog builder falls back to half a line.
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


def round4(value):
    if value is None:
        return None
    return math.floor(value * 10000 + 0.5) / 10000


def white_rows(pix):
    height, width, channels = pix.height, pix.width, pix.n
    image = np.frombuffer(pix.samples, dtype=np.uint8).reshape(height, width, channels)
    x0 = int(width * X0)
    x1 = int(width * X1)
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
        pix = doc[page_no - 1].get_pixmap(matrix=pymupdf.Matrix(ZOOM, ZOOM), alpha=False)
        flags = white_rows(pix)
        for pin in pins:
            gaps[pin['id']] = white_top(flags, float(pin['y']), float(pin.get('line') or 0))
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
