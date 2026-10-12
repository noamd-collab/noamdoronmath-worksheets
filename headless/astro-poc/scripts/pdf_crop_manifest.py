#!/usr/bin/env python3
"""Crop boxes from PDF objects.

Each answer is the union of the glyphs and drawings that sit in that part's
slot: to the left of its own prefix, and to the right of the next part's
prefix. Figures are unions of stroke paths that touch, plus the short labels
on them. A callout is the title bar plus the body text down to the next part.
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import pymupdf

PARTS = 'אבגדהו'
HEBREW = set('אבגדהוזחטיכלמנסעפצקרשתךםןףץ')
MARKER = re.compile(r'^\(\d{1,2}\)$|^\d{1,2}\.$')
QNUM = re.compile(r'^\(?(\d{1,2})\)?\.?$')


def _chars(page):
    out = []
    raw = page.get_text('rawdict')
    for block in raw.get('blocks') or []:
        if block.get('type') != 0:
            continue
        for line in block.get('lines') or []:
            for span in line.get('spans') or []:
                for ch in span.get('chars') or []:
                    text = ch.get('c') or ''
                    if not text or text == ' ':
                        continue
                    x0, y0, x1, y1 = ch['bbox']
                    if x1 <= x0 or y1 <= y0:
                        continue
                    out.append({
                        'c': text,
                        'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                        'size': span.get('size') or (y1 - y0),
                    })
    return out


def _spans(page):
    out = []
    data = page.get_text('dict')
    for block in data.get('blocks') or []:
        if block.get('type') != 0:
            continue
        for line in block.get('lines') or []:
            for span in line.get('spans') or []:
                text = span.get('text') or ''
                if not text.strip():
                    continue
                x0, y0, x1, y1 = span['bbox']
                out.append({
                    'text': text,
                    'x0': x0, 'y0': y0, 'x1': x1, 'y1': y1,
                })
    return out


def _near(chars, ch, dx=8, dy=3.2):
    cx = (ch['x0'] + ch['x1']) / 2
    found = []
    for other in chars:
        if other is ch:
            continue
        if abs(other['y0'] - ch['y0']) > dy:
            continue
        ocx = (other['x0'] + other['x1']) / 2
        if abs(ocx - cx) <= dx:
            found.append(other)
    return found


def _is_part_label(ch, chars):
    if ch['c'] not in PARTS:
        return False
    near = _near(chars, ch)
    has_dot = False
    glued_letter = False
    for other in near:
        gap = min(abs(other['x1'] - ch['x0']), abs(ch['x1'] - other['x0']))
        overlap = min(other['x1'], ch['x1']) - max(other['x0'], ch['x0'])
        touching = gap < 3.6 or overlap > -0.4
        if other['c'] == '.' and touching:
            has_dot = True
        if other['c'] in HEBREW and gap < 1.05 and other['c'] not in PARTS:
            glued_letter = True
        if other['c'] in HEBREW and gap < 0.8:
            glued_letter = True
    return has_dot and not glued_letter


def _markers(spans, width):
    found = []
    for span in spans:
        token = span['text'].strip()
        match = QNUM.match(token)
        if not match:
            continue
        if len(token) > 6:
            continue
        # A bare "17" in the answer key sits left of the real "(3)". Only a
        # parenthesized or dotted number, or a bare number in the far margin,
        # starts a question.
        parenthesized = token.startswith('(') or token.endswith('.')
        if span['x0'] < width * (0.86 if parenthesized else 0.91):
            continue
        found.append({
            'q': int(match.group(1)),
            'x0': span['x0'], 'y0': span['y0'], 'x1': span['x1'], 'y1': span['y1'],
        })
    found.sort(key=lambda item: (item['y0'], -item['x0']))
    # The same number can be drawn twice. Keep the first on that line.
    kept = []
    for item in found:
        if kept and kept[-1]['q'] == item['q'] and abs(kept[-1]['y0'] - item['y0']) < 4:
            continue
        kept.append(item)
    return kept


def _answer_start(spans, height):
    for span in spans:
        if 'תשובות סופיות' in span['text'] or 'תשובות' == span['text'].strip():
            return span['y0'] - 2
    return None


def _norm(x0, y0, x1, y1, width, height, pad=0.7):
    x0 = max(0.0, x0 - pad)
    y0 = max(0.0, y0 - pad)
    x1 = min(width, x1 + pad)
    y1 = min(height, y1 + pad)
    if x1 - x0 < 1.2 or y1 - y0 < 1.2:
        return None
    return {
        'x': round(x0 / width, 5),
        'y': round(y0 / height, 5),
        'w': round((x1 - x0) / width, 5),
        'h': round((y1 - y0) / height, 5),
    }


def _glued_to_label(ch, label):
    """The prefix's own period or middot. It is not part of the answer."""
    if not label or ch['c'] not in '.·•':
        return False
    if abs(ch['y0'] - label['y0']) > 4.5:
        return False
    # RTL puts the mark just to the left of א. A stray mark on the right is the same prefix.
    if -2 <= label['x0'] - ch['x1'] <= 7:
        return True
    return -2 <= ch['x0'] - label['x1'] <= 4


def _objects_in(chars, drawings, x0, x1, y0, y1, label=None):
    taken_c = []
    for ch in chars:
        if ch.get('label') or ch['c'] in '·•':
            continue
        if _glued_to_label(ch, label):
            continue
        if ch['c'] == '.' and (ch['x1'] - ch['x0']) < 4:
            # A sentence period stays. A separator dot hugging the next prefix does not.
            if ch['x0'] < x0 + 3 or ch['x1'] > x1 - 1:
                continue
        cx = (ch['x0'] + ch['x1']) / 2
        cy = (ch['y0'] + ch['y1']) / 2
        if cx < x0 or cx > x1 or cy < y0 or cy > y1:
            continue
        taken_c.append(ch)
    taken_d = []
    for drawing in drawings:
        rect = drawing['rect']
        cx = (rect.x0 + rect.x1) / 2
        cy = (rect.y0 + rect.y1) / 2
        if cx < x0 or cx > x1 or cy < y0 or cy > y1:
            continue
        # The angle mark and a radical are small paths. A row's grey fill is not.
        if rect.width > 36 or rect.height > 22:
            continue
        taken_d.append(drawing)
    return taken_c, taken_d


def _union(chars, drawings):
    xs0, ys0, xs1, ys1 = [], [], [], []
    for ch in chars:
        xs0.append(ch['x0']); ys0.append(ch['y0']); xs1.append(ch['x1']); ys1.append(ch['y1'])
    for drawing in drawings:
        rect = drawing['rect']
        xs0.append(rect.x0); ys0.append(rect.y0); xs1.append(rect.x1); ys1.append(rect.y1)
    if not xs0:
        return None
    return min(xs0), min(ys0), max(xs1), max(ys1)


def answer_boxes(page):
    width, height = page.rect.width, page.rect.height
    spans = _spans(page)
    start = _answer_start(spans, height)
    if start is None:
        return []
    chars = [ch for ch in _chars(page) if ch['y0'] >= start - 1]
    for ch in chars:
        ch['label'] = _is_part_label(ch, chars)
    labels = [ch for ch in chars if ch['label']]
    markers = [m for m in _markers(spans, width) if m['y0'] >= start - 4]
    if not markers or not labels:
        return []
    drawings = page.get_drawings()
    boxes = []
    for index, marker in enumerate(markers):
        y0 = marker['y0'] - 3
        y1 = markers[index + 1]['y0'] - 1.5 if index + 1 < len(markers) else height - 28
        mine = [label for label in labels if y0 - 2 <= label['y0'] < y1]
        if not mine:
            continue
        mine.sort(key=lambda label: (round(label['y0'], 0), -label['x0']))
        rows = []
        for label in mine:
            if rows and abs(label['y0'] - rows[-1][0]['y0']) <= 4.5:
                rows[-1].append(label)
            else:
                rows.append([label])
        for row_index, row in enumerate(rows):
            row.sort(key=lambda label: -label['x0'])
            next_row_y = rows[row_index + 1][0]['y0'] if row_index + 1 < len(rows) else y1
            for label_index, label in enumerate(row):
                nxt = row[label_index + 1] if label_index + 1 < len(row) else None
                right = label['x0'] - 0.8
                left = (nxt['x1'] + 0.8) if nxt else 28
                if right - left < 4:
                    continue
                # A superscript sits a few points above the baseline. The next
                # part's line stays below next_row_y, so it is not in this slot.
                band_top = label['y0'] - 8
                band_bot = next_row_y - 1.2
                taken_c, taken_d = _objects_in(chars, drawings, left, right, band_top, band_bot, label)
                if not taken_c and not taken_d:
                    continue
                use = [ch for ch in taken_c if ch['y0'] < next_row_y - 1.5]
                if nxt:
                    # Do not keep a continuation that runs into the next part's column.
                    use = [ch for ch in use if (ch['x0'] + ch['x1']) / 2 > left]
                # The next row's ink is a hard bottom. A parenthesis is taller than
                # the label, so its center — not its top — decides which row owns it.
                foreign_top = None
                for ch in chars:
                    cy = (ch['y0'] + ch['y1']) / 2
                    if cy < next_row_y - 1:
                        continue
                    cx = (ch['x0'] + ch['x1']) / 2
                    if cx < left or cx > right:
                        continue
                    if foreign_top is None or ch['y0'] < foreign_top:
                        foreign_top = ch['y0']
                drawings_here = [d for d in taken_d if d['rect'].y0 < next_row_y - 1]
                if foreign_top is not None:
                    cut = foreign_top - 0.5
                    use = [ch for ch in use if ch['y0'] < cut]
                    drawings_here = [d for d in drawings_here if d['rect'].y0 < cut]
                box = _union(use, drawings_here)
                if not box:
                    continue
                if foreign_top is not None:
                    box = (box[0], box[1], box[2], min(box[3], foreign_top - 0.5))
                norm = _norm(*box, width, height, pad=0.6)
                if not norm:
                    continue
                if foreign_top is not None:
                    limit = (foreign_top - 0.4) / height
                    if norm['y'] + norm['h'] > limit:
                        norm['h'] = round(max(0.0, limit - norm['y']), 5)
                # The slot edges are a hard stop. Padding must not cross the next prefix.
                norm_left = left / width
                norm_right = right / width
                edge_r = norm['x'] + norm['w']
                if norm['x'] < norm_left:
                    norm['w'] -= norm_left - norm['x']
                    norm['x'] = round(norm_left, 5)
                if edge_r > norm_right:
                    norm['w'] = round(norm_right - norm['x'], 5)
                if norm['w'] < 0.008 or norm['h'] < 0.006:
                    continue
                key = (marker['q'], label['c'])
                # The same prefix later on the page is the question body, not a second answer.
                if any(have['q'] == key[0] and have['part'] == key[1] for have in boxes):
                    continue
                boxes.append({
                    'q': marker['q'],
                    'part': label['c'],
                    **norm,
                })
    return boxes


def _is_bar(drawing, width):
    rect = drawing['rect']
    # A writing row or a section band spans most of the page and is short.
    if rect.width > width * 0.55 and rect.height < 80:
        return True
    return False


def _is_stroke(drawing, width):
    if _is_bar(drawing, width):
        return False
    kinds = ''.join(item[0] for item in drawing.get('items') or [])
    if 'l' in kinds or 'c' in kinds:
        rect = drawing['rect']
        if rect.width < 1.2 and rect.height < 1.2:
            return False
        return True
    return False


def _cluster(drawings, pad=7.0):
    parent = list(range(len(drawings)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def unite(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    rects = []
    for drawing in drawings:
        rect = drawing['rect']
        rects.append((rect.x0 - pad, rect.y0 - pad, rect.x1 + pad, rect.y1 + pad))
    for i in range(len(rects)):
        ax0, ay0, ax1, ay1 = rects[i]
        for j in range(i + 1, len(rects)):
            bx0, by0, bx1, by1 = rects[j]
            if ax0 <= bx1 and bx0 <= ax1 and ay0 <= by1 and by0 <= ay1:
                unite(i, j)
    groups = {}
    for i in range(len(drawings)):
        groups.setdefault(find(i), []).append(drawings[i])
    return list(groups.values())


def _question_bands(markers, height, y_stop):
    bands = []
    usable = [m for m in markers if m['y0'] < y_stop]
    for index, marker in enumerate(usable):
        y1 = usable[index + 1]['y0'] - 1 if index + 1 < len(usable) else y_stop
        bands.append((marker['q'], marker['y0'] - 2, y1))
    return bands


def _band_for(y, bands):
    for q, y0, y1 in bands:
        if y0 <= y < y1:
            return q
    return None


def figure_boxes(page, y_stop):
    width, height = page.rect.width, page.rect.height
    spans = _spans(page)
    chars = _chars(page)
    for ch in chars:
        ch['label'] = _is_part_label(ch, chars)
    markers = [m for m in _markers(spans, width) if m['y0'] < y_stop]
    bands = _question_bands(markers, height, y_stop)
    strokes = [d for d in page.get_drawings() if _is_stroke(d, width) and d['rect'].y0 < y_stop and d['rect'].y1 > 40]
    clusters = _cluster(strokes, pad=8)
    figures = []
    for group in clusters:
        x0 = min(d['rect'].x0 for d in group)
        y0 = min(d['rect'].y0 for d in group)
        x1 = max(d['rect'].x1 for d in group)
        y1 = max(d['rect'].y1 for d in group)
        if y1 - y0 < 8 or x1 - x0 < 8:
            continue
        # Short labels that sit on the drawing (a vertex letter, an axis number).
        for ch in chars:
            if ch['y0'] >= y_stop or ch.get('label'):
                continue
            if ch['c'] in '·•.':
                continue
            if (ch['x1'] - ch['x0']) > 28:
                continue
            cx = (ch['x0'] + ch['x1']) / 2
            cy = (ch['y0'] + ch['y1']) / 2
            if cx < x0 - 22 or cx > x1 + 22 or cy < y0 - 22 or cy > y1 + 22:
                continue
            # A word of the question is not a vertex label.
            if any(other['c'] in HEBREW and abs(other['y0'] - ch['y0']) < 2 and 0 < abs(other['x0'] - ch['x1']) < 2 for other in chars):
                continue
            x0 = min(x0, ch['x0'])
            y0 = min(y0, ch['y0'])
            x1 = max(x1, ch['x1'])
            y1 = max(y1, ch['y1'])
        q = _band_for((y0 + y1) / 2, bands)
        if q is None:
            continue
        norm = _norm(x0, y0, x1, y1, width, height, pad=1.2)
        if not norm or norm['h'] < 0.012 or norm['w'] < 0.015:
            continue
        figures.append({'q': q, **norm, '_paths': group, '_rect': (x0, y0, x1, y1)})
    figures = _merge_figures(figures, width, height)
    _absorb_leftovers(figures, strokes, width, height)
    callouts = _callouts(page, chars, markers, y_stop)
    return figures, callouts


def _gap(a, b):
    ax0, ay0, ax1, ay1 = a
    bx0, by0, bx1, by1 = b
    dx = 0 if ax0 <= bx1 and bx0 <= ax1 else min(abs(ax0 - bx1), abs(bx0 - ax1))
    dy = 0 if ay0 <= by1 and by0 <= ay1 else min(abs(ay0 - by1), abs(by0 - ay1))
    return max(dx, dy)


def _merge_figures(figures, width, height):
    """Overlapping clusters of one question are one drawing. A tick or axis
    stub that nearly touches a larger drawing of the same question joins it."""
    pending = figures[:]
    merged = []
    while pending:
        cur = pending.pop(0)
        ax0, ay0, ax1, ay1 = cur['_rect']
        i = 0
        while i < len(pending):
            other = pending[i]
            if other['q'] != cur['q']:
                i += 1
                continue
            bx0, by0, bx1, by1 = other['_rect']
            if ax0 <= bx1 and bx0 <= ax1 and ay0 <= by1 and by0 <= ay1:
                ax0, ay0 = min(ax0, bx0), min(ay0, by0)
                ax1, ay1 = max(ax1, bx1), max(ay1, by1)
                cur['_paths'] = cur['_paths'] + other['_paths']
                pending.pop(i)
                continue
            i += 1
        norm = _norm(ax0, ay0, ax1, ay1, width, height, pad=1.2)
        if not norm:
            continue
        cur.update(norm)
        cur['_rect'] = (ax0, ay0, ax1, ay1)
        merged.append(cur)
    # A tick-marked stub or an axis sliver sits a few points off its drawing.
    changed = True
    while changed:
        changed = False
        merged.sort(key=lambda fig: (fig['_rect'][2] - fig['_rect'][0]) * (fig['_rect'][3] - fig['_rect'][1]), reverse=True)
        i = len(merged) - 1
        while i > 0:
            small = merged[i]
            sx0, sy0, sx1, sy1 = small['_rect']
            sw, sh = sx1 - sx0, sy1 - sy0
            area = sw * sh
            if sw > 28 and sh > 28:
                i -= 1
                continue
            host = None
            host_gap = 16
            for other in merged[:i]:
                if other['q'] != small['q']:
                    continue
                gap = _gap(small['_rect'], other['_rect'])
                ow = other['_rect'][2] - other['_rect'][0]
                oh = other['_rect'][3] - other['_rect'][1]
                if gap < host_gap and ow * oh > area * 1.8:
                    host = other
                    host_gap = gap
            if host is None:
                i -= 1
                continue
            hx0, hy0, hx1, hy1 = host['_rect']
            host['_rect'] = (min(hx0, sx0), min(hy0, sy0), max(hx1, sx1), max(hy1, sy1))
            host['_paths'] = host['_paths'] + small['_paths']
            norm = _norm(*host['_rect'], width, height, pad=1.2)
            if norm:
                host.update(norm)
            merged.pop(i)
            changed = True
            i -= 1
    return merged


def _absorb_leftovers(figures, strokes, width, height):
    """A tick or a zero-height axis sits just outside the cluster that owns it."""
    for drawing in strokes:
        rect = drawing['rect']
        if any(_center_inside(rect, fig, width, height, slop=1.5) for fig in figures):
            continue
        if rect.width > 48 and rect.height > 48:
            continue
        cx = (rect.x0 + rect.x1) / 2
        cy = (rect.y0 + rect.y1) / 2
        host = None
        host_dist = 20
        for fig in figures:
            x0, y0, x1, y1 = fig['_rect']
            dx = 0 if x0 <= cx <= x1 else min(abs(cx - x0), abs(cx - x1))
            dy = 0 if y0 <= cy <= y1 else min(abs(cy - y0), abs(cy - y1))
            dist = max(dx, dy)
            if dist < host_dist:
                host = fig
                host_dist = dist
        if host is None:
            continue
        x0, y0, x1, y1 = host['_rect']
        host['_rect'] = (min(x0, rect.x0), min(y0, rect.y0), max(x1, rect.x1), max(y1, rect.y1))
        host['_paths'].append(drawing)
        norm = _norm(*host['_rect'], width, height, pad=1.2)
        if norm:
            host.update(norm)


def _callouts(page, chars, markers, y_stop):
    """A guided box is one rectangle: its title line, the paragraph inside
    the gray fill, and the lines under it down to the next part prefix."""
    width, height = page.rect.width, page.rect.height
    bands = _question_bands(markers, height, y_stop)
    bars = []
    for drawing in page.get_drawings():
        rect = drawing['rect']
        if rect.y0 < 74 or rect.y0 >= y_stop or rect.height < 16 or rect.height > 110:
            continue
        # Wider than a short rule, and not only a hairline.
        if rect.width < width * 0.45:
            continue
        if any(abs(rect.y0 - have.y0) < 1.5 and abs(rect.x0 - have.x0) < 2 and abs(rect.height - have.height) < 1.5 for have in bars):
            continue
        bars.append(rect)
    bars.sort(key=lambda rect: (rect.y0, -rect.width))
    out = []
    used = set()
    for index, rect in enumerate(bars):
        if index in used:
            continue
        inside = [
            ch for ch in chars
            if rect.x0 - 2 <= (ch['x0'] + ch['x1']) / 2 <= rect.x1 + 2
            and rect.y0 - 1 <= ch['y0'] <= rect.y1 + 1
        ]
        if any(ch.get('label') for ch in inside) or not inside:
            continue
        # The title is the first line in the fill. A writing row's first line is a sentence.
        top_y = min(ch['y0'] for ch in inside)
        title_chars = [ch for ch in inside if ch['y0'] < top_y + 7]
        title = ''.join(ch['c'] for ch in sorted(title_chars, key=lambda ch: -ch['x0']))
        if not title or len(title) > 24:
            continue
        q = _band_for((rect.y0 + rect.y1) / 2, bands)
        if q is None:
            continue
        band = next((item for item in bands if item[0] == q and item[1] - 8 <= rect.y0 < item[2]), None)
        if not band:
            continue
        labels = [
            ch for ch in chars
            if ch.get('label') and top_y + 8 < ch['y0'] < band[2] and ch['x0'] > width * 0.7
        ]
        stop = min(labels, key=lambda ch: ch['y0'])['y0'] - 1.5 if labels else min(band[2], rect.y0 + 170)
        stop = min(stop, rect.y0 + 170)
        x_span_l, x_span_r = rect.x0, rect.x1
        candidates = [
            ch for ch in chars
            if top_y + 7 < ch['y0'] < stop
            and not ch.get('label')
            and ch['c'] not in '·•'
            and x_span_l - 8 <= (ch['x0'] + ch['x1']) / 2 <= x_span_r + 8
        ]
        candidates.sort(key=lambda ch: (ch['y0'], -ch['x0']))
        body = []
        last_bottom = top_y + 7
        for ch in candidates:
            # A blank band means the paragraph ended. Later text is the next exercise.
            if body and ch['y0'] - last_bottom > 20:
                break
            body.append(ch)
            if ch['y1'] > last_bottom:
                last_bottom = ch['y1']
        if len(body) < 8:
            continue
        body_bottom = max(ch['y1'] for ch in body)
        extra = [rect]
        for other_index, other in enumerate(bars):
            if other_index == index or other_index in used:
                continue
            if other.y0 < rect.y1 - 2 or other.y1 > body_bottom + 8:
                continue
            if other.x1 < rect.x0 + 30 or other.x0 > rect.x1 - 30:
                continue
            extra.append(other)
            used.add(other_index)
        owned = title_chars + body
        x0 = min([item.x0 for item in extra] + [ch['x0'] for ch in owned])
        y0 = min([item.y0 for item in extra] + [ch['y0'] for ch in owned])
        x1 = max([item.x1 for item in extra] + [ch['x1'] for ch in owned])
        y1 = max([item.y1 for item in extra] + [ch['y1'] for ch in owned])
        norm = _norm(x0, y0, x1, y1, width, height, pad=1.0)
        if not norm:
            continue
        if any(abs(norm['x'] - have['x']) < 0.002 and abs(norm['y'] - have['y']) < 0.002 and have['q'] == q for have in out):
            continue
        out.append({'q': q, **norm})
    return out


def _part_boxes(page, y_stop):
    """Text of each part, from its prefix down to the next prefix. Used to
    check that a drawing claimed by nobody still sits in a part."""
    width, height = page.rect.width, page.rect.height
    chars = _chars(page)
    for ch in chars:
        ch['label'] = _is_part_label(ch, chars)
    spans = _spans(page)
    markers = [m for m in _markers(spans, width) if m['y0'] < y_stop]
    bands = _question_bands(markers, height, y_stop)
    labels = [ch for ch in chars if ch.get('label') and ch['y0'] < y_stop and ch['x0'] > width * 0.68]
    boxes = []
    labels.sort(key=lambda ch: (ch['y0'], -ch['x0']))
    for index, label in enumerate(labels):
        q = _band_for(label['y0'], bands)
        if q is None:
            continue
        nxt = None
        for other in labels[index + 1:]:
            if _band_for(other['y0'], bands) != q:
                break
            nxt = other
            break
        band = next(band for band in bands if band[0] == q and band[1] <= label['y0'] < band[2])
        y1 = nxt['y0'] - 1 if nxt else band[2]
        owned = [ch for ch in chars if label['y0'] - 2 <= ch['y0'] < y1 and not ch.get('label')]
        if not owned:
            continue
        box = _union(owned, [])
        if not box:
            continue
        norm = _norm(*box, width, height, pad=1)
        if norm:
            boxes.append({'q': q, 'part': label['c'], **norm})
    return boxes


def _center_inside(rect, box, width, height, slop=1.4):
    x0 = box['x'] * width - slop
    y0 = box['y'] * height - slop
    x1 = x0 + box['w'] * width + slop * 2
    y1 = y0 + box['h'] * height + slop * 2
    return rect.x0 >= x0 and rect.y0 >= y0 and rect.x1 <= x1 and rect.y1 <= y1


def validate(page, answers, figures, parts, y_answer):
    issues = []
    width, height = page.rect.width, page.rect.height
    chars = _chars(page)
    for ch in chars:
        ch['label'] = _is_part_label(ch, chars)
    # A part prefix must not sit inside a different part's answer.
    for box in answers:
        for ch in chars:
            if not ch.get('label') or ch['c'] == box['part']:
                continue
            cx = (ch['x0'] + ch['x1']) / 2
            cy = (ch['y0'] + ch['y1']) / 2
            x0, y0 = box['x'] * width, box['y'] * height
            x1, y1 = x0 + box['w'] * width, y0 + box['h'] * height
            if x0 + 1 < cx < x1 - 1 and y0 + 1 < cy < y1 - 1:
                issues.append(f"p{page.number + 1} answer {box['q']}{box['part']} contains {ch['c']}")
                break
    strokes = [d for d in page.get_drawings() if _is_stroke(d, width) and d['rect'].y1 > 48 and d['rect'].y0 < (y_answer or height)]
    figure_only = [{k: v for k, v in fig.items() if not k.startswith('_')} for fig in figures]
    for drawing in strokes:
        owners = [fig for fig in figures if _center_inside(drawing['rect'], fig, width, height)]
        if len(owners) == 1:
            continue
        if len(owners) > 1:
            issues.append(f"p{page.number + 1} stroke in {len(owners)} figures")
            continue
        # A stroke fully inside a part or answer box is owned there.
        in_part = any(_center_inside(drawing['rect'], box, width, height) for box in parts + answers)
        if not in_part:
            rect = drawing['rect']
            issues.append(
                f"p{page.number + 1} stroke unowned {round(rect.x0,1)},{round(rect.y0,1)} {round(rect.width,1)}x{round(rect.height,1)}"
            )
    return issues, figure_only


def manifest_for(path: Path):
    doc = pymupdf.open(path)
    pages = {}
    issues = []
    counts = {'answers': 0, 'figures': 0, 'callouts': 0, 'parts': 0}
    for number, page in enumerate(doc, start=1):
        spans = _spans(page)
        start = _answer_start(spans, page.rect.height)
        y_stop = start if start is not None else page.rect.height - 24
        answers = answer_boxes(page) if start is not None else []
        figures, callouts = figure_boxes(page, y_stop)
        parts = _part_boxes(page, y_stop)
        page_issues, figure_only = validate(page, answers, figures, parts, start)
        issues.extend(page_issues[:8])
        if not answers and not figure_only and not callouts:
            continue
        pages[str(number)] = {
            'w': round(page.rect.width, 2),
            'h': round(page.rect.height, 2),
            'answers': [{k: v for k, v in box.items()} for box in answers],
            'figures': figure_only,
            'callouts': callouts,
        }
        counts['answers'] += len(answers)
        counts['figures'] += len(figure_only)
        counts['callouts'] += len(callouts)
        counts['parts'] += len(parts)
    return {
        'pdfId': path.stem,
        'pages': pages,
        'counts': counts,
        'validation': {
            'failed': len(issues),
            'issues': issues[:40],
        },
    }


def main(argv):
    sheets = Path(argv[1] if len(argv) > 1 else '/tmp/sheets')
    out_dir = Path(argv[2] if len(argv) > 2 else '/workspace/headless/astro-poc/public/teachers/crop-manifest')
    out_dir.mkdir(parents=True, exist_ok=True)
    ids = argv[3:]
    paths = [sheets / f'{pdf_id}.pdf' for pdf_id in ids] if ids else sorted(sheets.glob('*.pdf'))
    summary = {'files': 0, 'failedBoxes': 0, 'issues': []}
    for path in paths:
        if not path.exists():
            print('MISSING', path.name)
            continue
        data = manifest_for(path)
        (out_dir / f'{path.stem}.json').write_text(json.dumps(data, ensure_ascii=False, separators=(',', ':')))
        summary['files'] += 1
        summary['failedBoxes'] += data['validation']['failed']
        for issue in data['validation']['issues'][:6]:
            summary['issues'].append(f"{path.stem[:8]} {issue}")
        print(path.stem[:12], 'answers', data['counts']['answers'], 'figures', data['counts']['figures'], 'callouts', data['counts']['callouts'], 'failed', data['validation']['failed'])
    (out_dir / '_validation.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print('FILES', summary['files'], 'FAILED', summary['failedBoxes'])


if __name__ == '__main__':
    main(sys.argv)
