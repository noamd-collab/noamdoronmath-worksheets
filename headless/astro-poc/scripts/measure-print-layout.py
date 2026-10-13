"""Measure what the continuous teacher worksheet needs from each source PDF.

For every middle-school sheet in public/teachers/sheets this writes
public/teachers/print-layout/<pdfId>.json with three things, all as boxes on
the original pages (normalized 0..1, top-left origin). Nothing is re-typed:
the browser crops these boxes from the rendered PDF page.

  title    The sheet title line (largest type on page 1) and the
           "כיתה … · רמה …" line under it, without the running header.
  figures  Vector drawings and images on question pages, merged into one box
           per drawing, with the small labels that sit on the drawing.
           Writing rules (dashed or long thin lines), section bars and the
           running header/footer are not drawings.
  answers  The "תשובות סופיות" section: the title line, and for every
           question its number box, its full source lines, and per part
           (א, ב, …) the pieces of each line that belong to that part.

Usage:
  python3 scripts/measure-print-layout.py --pdfs <dir with <pdfId>.pdf> [ids…]
The PDFs are the same ones the catalog build downloads (TEACHER_PDF_CACHE).
"""
import argparse
import json
import math
import re
import sys
from concurrent.futures import ProcessPoolExecutor
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parent.parent
SHEETS = ROOT / 'public/teachers/sheets'
OUT = ROOT / 'public/teachers/print-layout'

HEADER_WORDS = ('בס״ד', 'בס"ד', 'נועם', 'דורון', 'מתמטיקה')
FOOTER_WORDS = ('עמוד', 'מתוך', 'נועם', 'דורון')
MARKER = re.compile(r'^[★(]*(\d{1,2})[.)]*[★)]*$')
DOT_ONLY = re.compile(r'^[.\u05C3]$')


def r4(value):
    return math.floor(float(value) * 10000 + 0.5) / 10000


def box(page, x0, y0, x1, y1):
    x0, y0 = max(0.0, x0), max(0.0, y0)
    x1, y1 = min(1.0, x1), min(1.0, y1)
    return {'page': page, 'x': r4(x0), 'y': r4(y0), 'w': r4(max(0.001, x1 - x0)), 'h': r4(max(0.001, y1 - y0))}


class Word:
    __slots__ = ('x0', 'y0', 'x1', 'y1', 'text')

    def __init__(self, raw, width, height):
        self.x0 = raw[0] / width
        self.y0 = raw[1] / height
        self.x1 = raw[2] / width
        self.y1 = raw[3] / height
        self.text = raw[4]

    @property
    def h(self):
        return self.y1 - self.y0


def rotated_rects(page):
    """Boxes of vertical text (the copyright line on the margin)."""
    out = []
    width, height = page.rect.width, page.rect.height
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            dx, dy = line.get('dir', (1, 0))
            if abs(dy) > 0.5:
                x0, y0, x1, y1 = line['bbox']
                out.append((x0 / width, y0 / height, x1 / width, y1 / height))
    return out


def page_words(page):
    width, height = page.rect.width, page.rect.height
    vertical = rotated_rects(page)
    words = []
    for raw in page.get_text('words'):
        word = Word(raw, width, height)
        if not word.text.strip():
            continue
        cx, cy = (word.x0 + word.x1) / 2, (word.y0 + word.y1) / 2
        if any(r[0] - 0.002 <= cx <= r[2] + 0.002 and r[1] - 0.002 <= cy <= r[3] + 0.002 for r in vertical):
            continue
        words.append(word)
    return words


def group_lines(words):
    """Visual lines: a word joins a line when it overlaps the line's band by 40%."""
    lines = []
    for word in sorted(words, key=lambda w: ((w.y0 + w.y1) / 2, -w.x1)):
        best = None
        for line in lines:
            top, bot = line['y0'], line['y1']
            overlap = min(bot, word.y1) - max(top, word.y0)
            if overlap > 0.4 * min(word.h, bot - top):
                best = line
                break
        if best is None:
            lines.append({'y0': word.y0, 'y1': word.y1, 'words': [word]})
        else:
            best['words'].append(word)
            best['y0'] = min(best['y0'], word.y0)
            best['y1'] = max(best['y1'], word.y1)
    for line in lines:
        line['words'].sort(key=lambda w: -w.x1)
    lines.sort(key=lambda line: line['y0'])
    return lines


def header_cut(lines):
    cut = 0.0
    for line in lines:
        if line['y0'] > 0.06:
            break
        text = ' '.join(w.text for w in line['words'])
        if any(token in text for token in HEADER_WORDS):
            cut = max(cut, line['y1'] + 0.002)
    return cut


def footer_cut(lines):
    cut = 1.0
    for line in lines:
        if line['y0'] < 0.88:
            continue
        text = ' '.join(w.text for w in line['words'])
        if any(token in text for token in FOOTER_WORDS):
            cut = min(cut, line['y0'] - 0.002)
    return cut


# ---------------------------------------------------------------- title

def measure_title(doc):
    page = doc[0]
    width, height = page.rect.width, page.rect.height
    spans = []
    for block in page.get_text('dict')['blocks']:
        for line in block.get('lines', []):
            if abs(line.get('dir', (1, 0))[1]) > 0.5:
                continue
            for span in line['spans']:
                if not span['text'].strip():
                    continue
                x0, y0, x1, y1 = span['bbox']
                spans.append((span['size'], x0 / width, y0 / height, x1 / width, y1 / height, span['text']))
    # The title is Hebrew; a large formula in a guided example is not a title.
    body = [s for s in spans if 0.04 < s[2] < 0.35]
    hebrew = [s for s in body if re.search(r'[\u05D0-\u05EA]{2}', s[5])]
    if hebrew:
        biggest = max(s[0] for s in hebrew)
        body = [s for s in body if s[0] <= biggest + 0.01]
    if not body:
        return None
    biggest = max(s[0] for s in body)
    title = [s for s in body if s[0] >= biggest - 0.6]
    y0 = min(s[2] for s in title)
    y1 = max(s[4] for s in title)
    title = [s for s in body if s[2] < y1 and s[4] > y0]
    x0 = min(s[1] for s in title)
    x1 = max(s[3] for s in title)
    # The grade / level line right under the title.
    below = [s for s in body if y1 - 0.002 < s[2] < y1 + 0.035]
    if below:
        first = min(s[2] for s in below)
        line = [s for s in below if s[2] < first + 0.008]
        text = ' '.join(s[5] for s in line)
        if 'כיתה' in text or 'רמה' in text or 'דף' in text:
            y1 = max(s[4] for s in line)
            x0 = min(x0, min(s[1] for s in line))
            x1 = max(x1, max(s[3] for s in line))
    return box(1, x0 - 0.01, y0 - 0.004, x1 + 0.01, y1 + 0.004)


# -------------------------------------------------------------- figures

def path_pieces(paths):
    """A path made only of rectangles is split into its rectangles (rules are often drawn that way)."""
    out = []
    for path in paths:
        items = path.get('items') or []
        if len(items) == 2 and all(item[0] == 're' for item in items):
            # Two almost equal rectangles filled even-odd: a border line, the strip between them.
            a, b = pymupdf.Rect(items[0][1]), pymupdf.Rect(items[1][1])
            if abs(a.x0 - b.x0) < 1 and abs(a.x1 - b.x1) < 1:
                if abs(a.y0 - b.y0) < 1 and abs(a.y1 - b.y1) < 3:
                    out.append((pymupdf.Rect(a.x0, min(a.y1, b.y1), a.x1, max(a.y1, b.y1)), path))
                    continue
                if abs(a.y1 - b.y1) < 1 and abs(a.y0 - b.y0) < 3:
                    out.append((pymupdf.Rect(a.x0, min(a.y0, b.y0), a.x1, max(a.y0, b.y0)), path))
                    continue
        if len(items) > 1 and all(item[0] == 're' for item in items):
            for item in items:
                out.append((pymupdf.Rect(item[1]), path))
        else:
            out.append((path['rect'], path))
    return out


def light(path):
    color = path.get('fill') if path.get('type') == 'f' else path.get('color')
    color = color or path.get('color') or path.get('fill') or (0, 0, 0)
    return sum(color) / 3 > 0.35


def thin_rule(rect, path, width, height):
    w = (rect.x1 - rect.x0) / width
    h = (rect.y1 - rect.y0) / height
    dashed = bool(path.get('dashes')) and path.get('dashes') not in ('[] 0', '[] 0.0', '')
    return h < 0.004 and ((dashed and w > 0.05) or (light(path) and w > 0.1))


def dash_rules(paths, width, height):
    """Writing rules drawn as many short dashes: group them per row."""
    rows = {}
    for path in paths:
        rect = path['rect']
        w = (rect.x1 - rect.x0) / width
        h = (rect.y1 - rect.y0) / height
        if h > 0.003 or w > 0.03 or w <= 0:
            continue
        key = round((rect.y0 + rect.y1) / 2 / height, 3)
        rows.setdefault(key, []).append((rect.x0 / width, rect.x1 / width, id(path)))
    out = []
    for y, pieces in rows.items():
        if len(pieces) < 6:
            continue
        x0 = min(p[0] for p in pieces)
        x1 = max(p[1] for p in pieces)
        if x1 - x0 < 0.1:
            continue
        out.append({'y': y, 'x0': x0, 'x1': x1, 'ids': {p[2] for p in pieces}})
    return out


def is_rule(rect, path, width, height):
    w = (rect.x1 - rect.x0) / width
    h = (rect.y1 - rect.y0) / height
    dashed = bool(path.get('dashes')) and path.get('dashes') not in ('[] 0', '[] 0.0', '')
    if h < 0.004 and (dashed or w > 0.45):
        return True
    if w > 0.6:  # section bars, instruction boxes, full-width separators
        return True
    return False


def measure_figures(doc, pages):
    figures = []
    for number in pages:
        page = doc[number - 1]
        width, height = page.rect.width, page.rect.height
        rects = []
        paths = page.get_drawings()
        dashes = set()
        for rule in dash_rules(paths, width, height):
            dashes |= rule['ids']
        for rect, path in path_pieces(paths):
            if id(path) in dashes or thin_rule(rect, path, width, height):
                continue
            if rect.is_empty and rect.width == 0 and rect.height == 0:
                continue
            if is_rule(rect, path, width, height):
                continue
            y0, y1 = rect.y0 / height, rect.y1 / height
            if y1 < 0.045 or y0 > 0.93:
                continue
            rects.append([rect.x0 / width, y0, rect.x1 / width, y1])
        for info in page.get_image_info():
            x0, y0, x1, y1 = info['bbox']
            if (x1 - x0) / width > 0.85:
                continue
            rects.append([x0 / width, y0 / height, x1 / width, y1 / height])
        # Merge touching pieces (pad 0.008) into one drawing.
        merged = True
        while merged:
            merged = False
            out = []
            for rect in rects:
                for other in out:
                    if (rect[0] - 0.008 <= other[2] and other[0] - 0.008 <= rect[2]
                            and rect[1] - 0.008 <= other[3] and other[1] - 0.008 <= rect[3]):
                        other[0] = min(other[0], rect[0])
                        other[1] = min(other[1], rect[1])
                        other[2] = max(other[2], rect[2])
                        other[3] = max(other[3], rect[3])
                        merged = True
                        break
                else:
                    out.append(list(rect))
            rects = out
        words = page_words(page)
        for rect in rects:
            if (rect[2] - rect[0]) * (rect[3] - rect[1]) < 0.0004:
                continue
            # Small labels drawn on the figure (side lengths, letters).
            for word in words:
                if len(word.text) > 6:
                    continue
                if (word.x0 > rect[0] - 0.025 and word.x1 < rect[2] + 0.025
                        and word.y0 > rect[1] - 0.02 and word.y1 < rect[3] + 0.02):
                    rect[0] = min(rect[0], word.x0)
                    rect[1] = min(rect[1], word.y0)
                    rect[2] = max(rect[2], word.x1)
                    rect[3] = max(rect[3], word.y1)
            figures.append({
                'page': number,
                'x0': r4(rect[0] - 0.004), 'y0': r4(rect[1] - 0.004),
                'x1': r4(rect[2] + 0.004), 'y1': r4(rect[3] + 0.004),
            })
    return figures


# -------------------------------------------------------------- answers

def is_title_line(line):
    texts = [w.text for w in line['words']]
    return 'תשובות' in texts and 'סופיות' in texts and len(texts) <= 5


def answer_start(doc, last_question_page):
    """First "תשובות סופיות" title at or after the last question page (a later one is a continuation)."""
    for index in range(max(0, last_question_page - 1), doc.page_count):
        for line in group_lines(page_words(doc[index])):
            if is_title_line(line):
                return index, line
    return None, None


def is_label(words, index, letter):
    word = words[index]
    text = word.text
    if text in (letter + '.', '.' + letter):
        return True
    if text != letter:
        return False
    for other in (words[index + 1] if index + 1 < len(words) else None,
                  words[index - 1] if index > 0 else None):
        if other is None or not DOT_ONLY.match(other.text):
            continue
        if abs(other.x1 - word.x0) < 0.006 or abs(word.x1 - other.x0) < 0.006:
            return True
    return False


def line_bands(lines):
    """Vertical band of each line, padded but never past the middle of the gap to a neighbour."""
    bands = []
    for index, line in enumerate(lines):
        top = line['y0'] - 0.004
        bot = line['y1'] + 0.004
        prev = lines[index - 1] if index else None
        nxt = lines[index + 1] if index + 1 < len(lines) else None
        if prev is not None and prev['page'] == line['page']:
            top = max(top, (prev['y1'] + line['y0']) / 2)
        if nxt is not None and nxt['page'] == line['page']:
            bot = min(bot, (line['y1'] + nxt['y0']) / 2)
        bands.append((top, bot))
    return bands


def measure_answers(doc, parts_by_q, last_question_page):
    start, title_line = answer_start(doc, last_question_page)
    if start is None:
        return None
    lines = []
    for index in range(start, doc.page_count):
        page_lines = group_lines(page_words(doc[index]))
        top = header_cut(page_lines)
        bottom = footer_cut(page_lines)
        if index == start:
            top = max(top, title_line['y1'] + 0.001)
        for line in page_lines:
            if line['y0'] < top or line['y1'] > bottom or is_title_line(line):
                continue
            line['page'] = index + 1
            lines.append(line)
    if not lines:
        return None
    right = max(line['words'][0].x1 for line in lines)
    markers = []
    for li, line in enumerate(lines):
        words = line['words']
        if words[0].x1 < right - 0.02:
            continue
        used = []
        number = None
        for word in words[:3]:
            if word.text == '★':
                used.append(word)
                continue
            match = MARKER.match(word.text)
            if match and number is None:
                number = int(match.group(1))
                used.append(word)
                continue
            break
        if number is None or number not in parts_by_q or (markers and number <= markers[-1][1]):
            continue
        markers.append((li, number, used))
    if not markers:
        return None
    # The subtitle and anything else before the first number is not an answer.
    lines = lines[markers[0][0]:]
    shift = markers[0][0]
    markers = [(li - shift, number, used) for li, number, used in markers]
    bands = line_bands(lines)
    title_page = start + 1
    out = {
        'head': box(title_page, min(w.x0 for w in title_line['words']) - 0.006, title_line['y0'] - 0.004,
                    max(w.x1 for w in title_line['words']) + 0.006, title_line['y1'] + 0.003),
        'x0': r4(max(0.0, min(min(w.x0 for w in line['words']) for line in lines) - 0.008)),
        'x1': r4(min(1.0, right + 0.008)),
        'questions': {},
    }
    for mi, (li, number, used) in enumerate(markers):
        end = markers[mi + 1][0] if mi + 1 < len(markers) else len(lines)
        qlines = lines[li:end]
        qbands = bands[li:end]
        record = {
            'num': {'page': qlines[0]['page'], 'x0': r4(min(w.x0 for w in used) - 0.004)},
            'lines': [{'page': line['page'], 'y': r4(top), 'h': r4(bot - top)} for line, (top, bot) in zip(qlines, qbands)],
        }
        parts = parts_by_q.get(number) or []
        if parts:
            used_ids = {id(w) for w in used}
            assigned = assign_parts(qlines, qbands, used_ids, parts)
            if assigned:
                record['parts'], record['seps'] = assigned
        out['questions'][str(number)] = record
    return out


def assign_parts(qlines, qbands, used_ids, parts):
    """Per part, the piece of every source line it occupies, and the '·' before its label."""
    order = []
    for li, line in enumerate(qlines):
        words = [w for w in line['words'] if id(w) not in used_ids]
        for wi in range(len(words)):
            order.append((li, words, wi))
    if not order:
        return None
    current = None
    next_part = 0
    pieces = {}
    seps = {}
    pending_sep = None
    for li, words, wi in order:
        word = words[wi]
        if next_part < len(parts) and is_label(words, wi, parts[next_part]):
            current = parts[next_part]
            next_part += 1
            if pending_sep is not None:
                seps[current] = pending_sep
            pending_sep = None
        elif current is None:
            # Text before the first label: this question is not split by parts.
            return None
        if word.text == '·':
            pending_sep = (li, word)
            continue
        if pending_sep is not None:
            # A separator that did not open a new part belongs to the text.
            pieces.setdefault(current, []).append(pending_sep)
            pending_sep = None
        pieces.setdefault(current, []).append((li, word))
    if next_part < len(parts):
        return None

    def piece_box(li, x0, x1):
        top, bot = qbands[li]
        return box(qlines[li]['page'], x0 - 0.003, top, x1 + 0.003, bot)

    out = {}
    for part, items in pieces.items():
        segments = []
        for li, word in items:
            if segments and segments[-1][0] == li:
                segments[-1][1] = min(segments[-1][1], word.x0)
                segments[-1][2] = max(segments[-1][2], word.x1)
            else:
                segments.append([li, word.x0, word.x1])
        out[part] = [piece_box(li, x0, x1) for li, x0, x1 in segments]
    sep_out = {part: piece_box(li, word.x0, word.x1) for part, (li, word) in seps.items()}
    return out, sep_out


# ------------------------------------------------- markers and rules

def measure_markers(doc, sheet):
    """The printed question number ("19." with its star) beside each question."""
    first = {}
    for question in sheet['questions']:
        q = int(question['q'])
        if q in first:
            continue
        anchor = question.get('stem') or question.get('row') or {}
        first[q] = (int(anchor.get('page') or question['page']), float(anchor.get('y') or 0))
    cache = {}
    out = {}
    for q, (number, y) in first.items():
        if number not in cache:
            cache[number] = group_lines(page_words(doc[number - 1]))
        best = None
        for line in cache[number]:
            if abs(line['y0'] - y) > 0.06:
                continue
            words = [w for w in line['words'] if w.x1 > 0.8]
            hit = [w for w in words if (m := MARKER.match(w.text)) and int(m.group(1)) == q]
            if not hit:
                continue
            used = hit[:1] + [w for w in words if w.text == '★' and abs(w.x1 - hit[0].x0) < 0.03]
            score = abs(line['y0'] - y)
            if best is None or score < best[0]:
                best = (score, used)
        if best:
            used = best[1]
            out[str(q)] = {
                'page': number,
                'x0': r4(min(w.x0 for w in used) - 0.004), 'y0': r4(min(w.y0 for w in used) - 0.004),
                'x1': r4(max(w.x1 for w in used) + 0.004), 'y1': r4(max(w.y1 for w in used) + 0.004),
            }
    return out


def measure_rules(doc, pages):
    """Writing rules (dashed or light thin lines). The browser lifts them out of hidden parts."""
    out = []
    for number in pages:
        page = doc[number - 1]
        width, height = page.rect.width, page.rect.height
        paths = page.get_drawings()
        for rule in dash_rules(paths, width, height):
            if 0.045 < rule['y'] < 0.93:
                out.append({'page': number, 'x0': r4(rule['x0']), 'x1': r4(rule['x1']), 'y': r4(rule['y'])})
        for rect, path in path_pieces(paths):
            if not thin_rule(rect, path, width, height):
                continue
            y = (rect.y0 + rect.y1) / 2 / height
            if y < 0.045 or y > 0.93:
                continue
            out.append({'page': number, 'x0': r4(rect.x0 / width), 'x1': r4(rect.x1 / width), 'y': r4(y)})
    return out


# ------------------------------------------------ sections and header

SECTION = re.compile(r'^חלק$')


def wide_rects(page):
    width, height = page.rect.width, page.rect.height
    out = []
    for path in page.get_drawings():
        rect = path['rect']
        w = (rect.x1 - rect.x0) / width
        h = (rect.y1 - rect.y0) / height
        if w > 0.6 and 0.008 < h < 0.2:
            out.append((rect.x0 / width, rect.y0 / height, rect.x1 / width, rect.y1 / height))
    return out


def measure_sections(doc, pages):
    """Section titles ("חלק ב׳ – …"), with the bar drawn around them."""
    out = []
    for number in pages:
        page = doc[number - 1]
        rects = wide_rects(page)
        for line in group_lines(page_words(page)):
            words = line['words']
            if not words or not SECTION.match(words[0].text) or len(words) < 2:
                continue
            if not re.match(r"^[׳']?[\u05D0-\u05EA][׳']?$", words[1].text):
                continue
            y0, y1 = line['y0'], line['y1']
            cy = (y0 + y1) / 2
            for rect in rects:
                if rect[1] - 0.002 <= cy <= rect[3] + 0.002 and rect[3] - rect[1] < 0.06:
                    y0, y1 = min(y0, rect[1]), max(y1, rect[3])
            out.append({'page': number, 'y0': r4(y0 - 0.003), 'y1': r4(y1 + 0.003)})
    return out


def measure_header_end(doc, title, first_top):
    """Bottom of the sheet header on page 1: title, name line, instruction box, first section bar."""
    if first_top is None:
        return None
    page = doc[0]
    end = 0.0
    if title:
        end = max(end, title['y'] + title['h'])
    name_bottom = None
    for line in group_lines(page_words(page)):
        if line['y1'] > first_top:
            break
        text = ' '.join(w.text for w in line['words'])
        if ('שם' in text and ('תאריך' in text or 'כיתה' in text)) or '____' in text:
            name_bottom = line['y1']
            end = max(end, line['y1'])
        if line['words'] and SECTION.match(line['words'][0].text) and line['y1'] < first_top:
            end = max(end, line['y1'])
    for rect in wide_rects(page):
        if rect[3] > first_top + 0.002:
            continue
        near_name = name_bottom is not None and rect[1] < name_bottom + 0.06
        near_end = rect[1] < end + 0.03
        if near_name or near_end:
            end = max(end, rect[3])
    return {'page': 1, 'y': r4(end + 0.003)} if end > 0 else None


# ---------------------------------------------------------------- driver

def measure(job):
    pdf_id, pdf_path, sheet_path = job
    sheet = json.loads(Path(sheet_path).read_text())
    parts_by_q = {}
    pages = set()
    for question in sheet['questions']:
        parts_by_q.setdefault(int(question['q']), [])
        if question.get('part'):
            parts_by_q[int(question['q'])].append(question['part'])
        pages.add(int(question['page']))
        for row in question.get('rows') or []:
            pages.add(int(row.get('page') or question['page']))
    doc = pymupdf.open(pdf_path)
    title = measure_title(doc)
    markers = measure_markers(doc, sheet)
    tops = [marker['y0'] for marker in markers.values() if marker['page'] == 1]
    if not tops:
        tops = [float(q['row']['y']) for q in sheet['questions'] if int(q['page']) == 1 and q.get('row')]
    first_top = min(tops) if tops else None
    figures = measure_figures(doc, sorted(pages))
    # A dashed line inside a drawing (the roof line of the house) is part of the drawing.
    rules = [rule for rule in measure_rules(doc, sorted(pages)) if not any(
        figure['page'] == rule['page'] and figure['y0'] <= rule['y'] <= figure['y1']
        and rule['x0'] >= figure['x0'] - 0.01 and rule['x1'] <= figure['x1'] + 0.01
        for figure in figures)]
    # Running header and footer band of each question page: never part of a crop.
    margins = {}
    for number in sorted(pages):
        page_lines = group_lines(page_words(doc[number - 1]))
        margins[str(number)] = [r4(header_cut(page_lines)), r4(footer_cut(page_lines))]
    return pdf_id, {
        'pdfId': pdf_id,
        'title': title,
        'margins': margins,
        'headerEnd': measure_header_end(doc, title, first_top),
        'sections': measure_sections(doc, sorted(pages)),
        'markers': markers,
        'figures': figures,
        'rules': rules,
        'answers': measure_answers(doc, parts_by_q, max(pages)),
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--pdfs', required=True)
    parser.add_argument('--out', default=str(OUT))
    parser.add_argument('--serial', action='store_true', help='one process (for shells that stop pool workers)')
    parser.add_argument('ids', nargs='*')
    args = parser.parse_args()
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    ids = args.ids or sorted(p.stem for p in SHEETS.glob('*.json'))
    jobs = []
    for pdf_id in ids:
        pdf = Path(args.pdfs) / (pdf_id + '.pdf')
        if not pdf.exists():
            print(f'missing pdf {pdf_id}', file=sys.stderr)
            continue
        jobs.append((pdf_id, str(pdf), str(SHEETS / (pdf_id + '.json'))))
    stats = {'sheets': 0, 'answers': 0, 'questions': 0, 'split': 0, 'figures': 0}
    pool = None if args.serial else ProcessPoolExecutor()
    results = map(measure, jobs) if pool is None else pool.map(measure, jobs)
    try:
        for pdf_id, layout in results:
            (out / (pdf_id + '.json')).write_text(json.dumps(layout, ensure_ascii=False, separators=(',', ':')))
            stats['sheets'] += 1
            stats['figures'] += len(layout['figures'])
            if layout['answers']:
                stats['answers'] += 1
                for record in layout['answers']['questions'].values():
                    stats['questions'] += 1
                    stats['split'] += 1 if record.get('parts') else 0
    finally:
        if pool is not None:
            pool.shutdown()
    print(json.dumps(stats))


if __name__ == '__main__':
    main()
