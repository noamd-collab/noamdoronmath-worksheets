"""Glyph-run check of every math atom of a rendered worksheet-wire/5 middle PDF (V5-DESIGN §5).

Every island ($…$) of levels.json is one atom. Rendered correctly, an atom is one left-to-right run of glyphs on
one PDF row: "5x + 4" reads 5, x, +, 4 from left to right. A reversed or split atom ("% 30", "6−", "4 + x5") has
no matching run and is reported missing. The question and answer markers "(n)" are atoms too.

Questions are matched before the answers band (the single row reading "תשובות סופיות"), answers after it, each
with multiplicity, on any page. The PDF must be made by WeasyPrint.

Rows: glyphs from page.get_text("rawdict") minus whitespace, grouped by origin y within 0.75 pt (as
elementary_pdf_order.visual_baselines). A run is a maximal x-sorted sequence of ATOM_CHARS glyphs with x strictly
increasing and each gap at most 1.0 × the font size; any other glyph breaks it.

CLI: python3 -B atom_order.py --levels L --pdf P --json J  → exit 0 PASS / 1 FAIL;
     J = {status, code?, missing, atoms, pages, producer}. Codes only, never sheet text.

Elementary sheets (worksheet-wire/5 elementary, no levels.json): --html sheet.html instead of --levels. Every
outermost span.ltr of the pinned elementary template's HTML is one atom (the ws_html H.ltr convention), read with
its whitespace removed; the question markers "(n)" come from the template's CSS counter, one per li of
ol.questions; the answer region is div.answers, whose "(n)" key markers are atoms too. The elementary atom glyphs
add ':' (the spaced division sign) and '×' (grade ב) to ATOM_CHARS; any other glyph in an atom is ATOM_NOT_FLAT
(a thousands comma among them, which no elementary v5 profile prints yet). The anchor row is the answers heading.
Imports: the standard library and pymupdf (lazily).
"""
from __future__ import annotations

import argparse
from collections import Counter
import json
from pathlib import Path
import sys

ATOM_CHARS = frozenset("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+−=()%·")
ELEMENTARY_ATOM_CHARS = ATOM_CHARS | frozenset(":×")
ANCHOR = "תשובות סופיות"                       # emit_html answers band
ROW_TOLERANCE = 0.75
GAP_FACTOR = 1.0
MAX_MISSING = 20
MAX_LEVELS_BYTES = 4_000_000
CODES = ("ATOM_MISSING", "ATOM_NOT_FLAT", "ATOM_ANCHOR_MISSING", "ATOM_PDF_UNREADABLE", "ATOM_LEVELS_INVALID",
         "PDF_PRODUCER_NOT_WEASYPRINT")


class AtomOrderError(ValueError):
    """code ∈ ATOM_MISSING, ATOM_NOT_FLAT, ATOM_ANCHOR_MISSING, ATOM_PDF_UNREADABLE, ATOM_LEVELS_INVALID,
    PDF_PRODUCER_NOT_WEASYPRINT; .missing = [(region, atom)] ≤ 20."""

    def __init__(self, code: str, missing=()):
        self.code = code
        self.missing = [tuple(entry) for entry in list(missing)[:MAX_MISSING]]
        super().__init__(code)


def island_glyphs(island: str) -> str:
    """Inside of $…$ → expected visual LTR glyphs: drop spaces/NBSP, '\\%' → '%'; any other '\\', '^', '_', '{', '}'
    or a char outside ATOM_CHARS → ATOM_NOT_FLAT (stage 2: fractions, powers, °, ₪ are stage 3)."""
    if type(island) is not str:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    out, index = [], 0
    while index < len(island):
        char = island[index]
        if char in (" ", "\u00a0"):
            index += 1
        elif island.startswith("\\%", index):
            out.append("%")
            index += 2
        elif char not in ATOM_CHARS:
            raise AtomOrderError("ATOM_NOT_FLAT")
        else:
            out.append(char)
            index += 1
    if not out:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return "".join(out)


def _islands(value) -> list:
    if type(value) is not str:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    parts = value.split("$")
    if len(parts) % 2 == 0:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return [island_glyphs(island) for island in parts[1::2]]


def _marker(n) -> str:
    if type(n) is bool or not isinstance(n, (int, str)) or not str(n).isdigit():
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return "(%d)" % int(n)


def expected_atoms(levels: list) -> tuple:
    """(question region, answer region). Questions: islands of title, rule, every intro and item text, plus '(n)' per
    question; answers: islands of every answer string, plus '(n)' per answer row. An odd '$' count → ATOM_LEVELS_INVALID."""
    if type(levels) is not list or not levels:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    questions, answers = Counter(), Counter()
    for level in levels:
        if type(level) is not dict or type(level.get("questions")) is not list or type(level.get("answers")) is not list:
            raise AtomOrderError("ATOM_LEVELS_INVALID")
        for field in ("title", "rule"):
            questions.update(_islands(level.get(field, "")))
        for question in level["questions"]:
            if type(question) is not dict or type(question.get("items")) is not list:
                raise AtomOrderError("ATOM_LEVELS_INVALID")
            questions[_marker(question.get("n"))] += 1
            questions.update(_islands(question.get("intro", "")))
            for item in question["items"]:
                if type(item) is not dict:
                    raise AtomOrderError("ATOM_LEVELS_INVALID")
                questions.update(_islands(item.get("text")))
        for row in level["answers"]:
            if type(row) is not list or len(row) < 2 or type(row[1]) is not list:
                raise AtomOrderError("ATOM_LEVELS_INVALID")
            answers[_marker(row[0])] += 1
            for pair in row[1]:
                if type(pair) is not list or len(pair) != 2:
                    raise AtomOrderError("ATOM_LEVELS_INVALID")
                answers.update(_islands(pair[1]))
    return questions, answers


def _read_pdf_rows(pdf_path):
    """(producer, pages, rows): rows are [(page, y, [(char, x0, x1, size)...] sorted by x)], top to bottom per page;
    y is the origin y of the row's first glyph (the row grouping key)."""
    try:
        import pymupdf
        document = pymupdf.open(str(pdf_path))
    except Exception:  # noqa: BLE001 - any unreadable file is one code
        raise AtomOrderError("ATOM_PDF_UNREADABLE") from None
    try:
        producer = str((document.metadata or {}).get("producer") or "")
        rows = []
        for page_number, page in enumerate(document):
            glyphs = []
            for block in page.get_text("rawdict")["blocks"]:
                for line in block.get("lines", []):
                    for span in line.get("spans", []):
                        for char in span.get("chars", []):
                            text = char["c"]
                            if not text.strip():
                                continue
                            glyphs.append((char["origin"][1], char["bbox"][0], char["bbox"][2], text, span["size"]))
            current = []
            for glyph in sorted(glyphs, key=lambda g: (g[0], g[1])):
                if current and glyph[0] - current[0][0] > ROW_TOLERANCE:
                    rows.append((page_number, current[0][0], sorted(current, key=lambda g: g[1])))
                    current = []
                current.append(glyph)
            if current:
                rows.append((page_number, current[0][0], sorted(current, key=lambda g: g[1])))
        pages = len(document)
    except Exception:  # noqa: BLE001
        raise AtomOrderError("ATOM_PDF_UNREADABLE") from None
    finally:
        document.close()
    return producer, pages, [(page, y, [(g[3], g[1], g[2], g[4]) for g in row]) for page, y, row in rows]


def _read_pdf(pdf_path):
    """(producer, pages, rows): rows are [(page, [(char, x0, x1, size)...] sorted by x)], top to bottom per page."""
    producer, pages, rows = _read_pdf_rows(pdf_path)
    return producer, pages, [(page, glyphs) for page, _, glyphs in rows]


def _runs(row, chars=ATOM_CHARS) -> list:
    out, run, previous = [], "", None
    for char, x0, x1, size in row:
        joined = (run and char in chars and previous is not None and x0 > previous[0]
                  and x0 - previous[1] <= GAP_FACTOR * size)
        if char in chars and len(char) == 1:
            if joined:
                run += char
            else:
                if run:
                    out.append(run)
                run = char
            previous = (x0, x1)
        else:
            if run:
                out.append(run)
            run, previous = "", None
    if run:
        out.append(run)
    return out


def _anchor(rows, anchor=ANCHOR) -> int:
    compact = anchor.replace(" ", "")
    found = [index for index, (_, row) in enumerate(rows)
             if "".join(glyph[0] for glyph in row) in (compact, compact[::-1])]
    if len(found) != 1:
        raise AtomOrderError("ATOM_ANCHOR_MISSING")
    return found[0]


def _split(rows, anchor, chars=ATOM_CHARS):
    before, after = Counter(), Counter()
    for index, (_, row) in enumerate(rows):
        target = before if index < anchor else after
        target.update(_runs(row, chars))
    return before, after


def pdf_runs(pdf_path) -> tuple:
    """(runs before the anchor row, runs after it, producer, pages). Glyphs from page.get_text('rawdict') minus whitespace,
    rows grouped by origin y within 0.75pt (as elementary_pdf_order.visual_baselines [V :58-80]); a run is a maximal
    x-sorted sequence of ATOM_CHARS glyphs with x strictly increasing and gap ≤ 1.0×font size; any other glyph breaks it.
    The anchor is the single row whose compact text equals ANCHOR or ANCHOR[::-1]."""
    producer, pages, rows = _read_pdf(pdf_path)
    before, after = _split(rows, _anchor(rows))
    return before, after, producer, pages


def _read_levels(path):
    try:
        data = Path(path).read_bytes()
        if len(data) > MAX_LEVELS_BYTES:
            raise ValueError("levels.json too large")

        def pairs(items):
            out = {}
            for key, value in items:
                if key in out:
                    raise ValueError("duplicate key")
                out[key] = value
            return out

        return json.loads(data.decode("utf-8"), object_pairs_hook=pairs)
    except (OSError, ValueError, UnicodeDecodeError):
        raise AtomOrderError("ATOM_LEVELS_INVALID") from None


def check_atom_order(levels_path, pdf_path, *, fractions=False) -> dict:
    """Producer must start with 'WeasyPrint'; every expected atom must be found as a run in its region, with multiplicity
    (found[s] ≥ expected[s]) on any page. Returns {"status":"PASS","atoms":n,"pages":p,"producer":…}; else raises.

    fractions=True (CLI --fractions; an overlay whose keys print stacked fractions and decimals) is the fraction
    mode of check_atom_order_fractions; without it a fraction island stays ATOM_NOT_FLAT."""
    if fractions:
        return check_atom_order_fractions(levels_path, pdf_path)
    questions, answers = expected_atoms(_read_levels(levels_path))
    producer, pages, rows = _read_pdf(pdf_path)
    if not producer.startswith("WeasyPrint"):
        raise AtomOrderError("PDF_PRODUCER_NOT_WEASYPRINT")
    before, after = _split(rows, _anchor(rows))
    missing = [("questions", atom) for atom, count in sorted(questions.items()) if before[atom] < count]
    missing += [("answers", atom) for atom, count in sorted(answers.items()) if after[atom] < count]
    if missing:
        raise AtomOrderError("ATOM_MISSING", missing)
    return {"status": "PASS", "atoms": sum(questions.values()) + sum(answers.values()), "pages": pages,
            "producer": producer}


# ------------------------------------------------------------------ the fraction mode (--fractions)
# An island of the fraction mode is a sequence of segments, left to right: ("flat", glyphs) for a run of flat glyphs
# on the island's baseline, ("frac", numerator glyphs, denominator glyphs) for one stacked \f{…}{…} whose two parts
# are flat. A flat run may hold a decimal point between two digits ("0.35"). Any other markup (\g, ^, a nested
# fraction, \d) is ATOM_NOT_FLAT. On the page a fraction is two runs, the numerator above the denominator with the
# same horizontal centre; the segments of one island lie left to right in their written order, the flat ones on one
# baseline row between the numerator and denominator rows of the fractions beside them.
FRACTION_ROW_GAP = (0.3, 2.5)          # denominator baseline below the numerator's, in font sizes
FRACTION_CENTRE = 0.35                 # |centre of numerator − centre of denominator| ≤ this × font size
SEGMENT_GAP = 1.5                      # the gap between two segments of one island ≤ this × font size
SEGMENT_OVERLAP = 0.5                  # a segment may start at most this many points left of the previous end


def _flat_glyphs(text: str, *, decimals: bool) -> str:
    """Glyphs of one flat piece of an island (spaces dropped, '\\%' → '%'); with decimals a '.' between two digits."""
    out, index = [], 0
    while index < len(text):
        char = text[index]
        if char in (" ", "\u00a0"):
            index += 1
        elif text.startswith("\\%", index):
            out.append("%")
            index += 2
        elif char == "." and decimals:
            before = out[-1] if out else ""
            after = text[index + 1] if index + 1 < len(text) else ""
            number = "".join(out)[len("".join(out).rstrip("0123456789.")):]
            if not (before.isdigit() and after.isdigit()) or "." in number:      # one point per number
                raise AtomOrderError("ATOM_NOT_FLAT")
            out.append(".")
            index += 1
        elif char not in ATOM_CHARS:
            raise AtomOrderError("ATOM_NOT_FLAT")
        else:
            out.append(char)
            index += 1
    return "".join(out)


def _brace_part(text: str, start: int):
    """text[start] == '{' → (its content, the index after the closing brace); unbalanced → ATOM_LEVELS_INVALID."""
    depth = 0
    for index in range(start, len(text)):
        if text[index] == "{":
            depth += 1
        elif text[index] == "}":
            depth -= 1
            if depth == 0:
                return text[start + 1:index], index + 1
    raise AtomOrderError("ATOM_LEVELS_INVALID")


def island_segments(island: str) -> tuple:
    """Fraction mode: one island → its segments (see above). An island with no glyph → ATOM_LEVELS_INVALID."""
    if type(island) is not str:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    segments, flat, index = [], [], 0

    def close_flat():
        if flat:
            glyphs = _flat_glyphs("".join(flat), decimals=True)
            if glyphs:
                segments.append(("flat", glyphs))
            flat.clear()

    while index < len(island):
        if island.startswith("\\f{", index):
            close_flat()
            top, index = _brace_part(island, index + 2)
            if not island.startswith("{", index):
                raise AtomOrderError("ATOM_NOT_FLAT")
            bottom, index = _brace_part(island, index)
            if any(mark in part for part in (top, bottom) for mark in ("\\f", "\\g", "\\d", "^", "{", "}")):
                raise AtomOrderError("ATOM_NOT_FLAT")
            numerator, denominator = _flat_glyphs(top, decimals=True), _flat_glyphs(bottom, decimals=True)
            if not numerator or not denominator:
                raise AtomOrderError("ATOM_LEVELS_INVALID")
            segments.append(("frac", numerator, denominator))
        elif island.startswith("\\%", index):
            flat.append("\\%")
            index += 2
        elif island[index] in ("\\", "^", "_", "{", "}"):
            raise AtomOrderError("ATOM_NOT_FLAT")
        else:
            flat.append(island[index])
            index += 1
    close_flat()
    if not segments:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return tuple(segments)


def _islands_segments(value) -> list:
    if type(value) is not str:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    parts = value.split("$")
    if len(parts) % 2 == 0:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return [island_segments(island) for island in parts[1::2]]


def _table_strings(question) -> list:
    """Every printed string of a question's table (head and rows), or [] without a table."""
    table = question.get("table")
    if table is None:
        return []
    if type(table) is not dict or type(table.get("head", [])) is not list or type(table.get("rows")) is not list:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    cells = list(table.get("head") or [])
    for row in table["rows"]:
        if type(row) is not list:
            raise AtomOrderError("ATOM_LEVELS_INVALID")
        cells += row
    return cells


def expected_atoms_fractions(levels: list) -> tuple:
    """Fraction mode: (question flats, answer flats, question shapes, answer shapes). A flat island counts by its
    glyphs as in expected_atoms; an island holding a fraction counts as its segment tuple. The question region also
    reads every table cell (the probability overlay prints its counts in a one-way table)."""
    if type(levels) is not list or not levels:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    flats = (Counter(), Counter())
    shapes = (Counter(), Counter())

    def add(region, value):
        for segments in _islands_segments(value):
            if len(segments) == 1 and segments[0][0] == "flat":
                flats[region][segments[0][1]] += 1
            else:
                shapes[region][segments] += 1

    for level in levels:
        if type(level) is not dict or type(level.get("questions")) is not list or type(level.get("answers")) is not list:
            raise AtomOrderError("ATOM_LEVELS_INVALID")
        for field in ("title", "rule"):
            add(0, level.get(field, ""))
        for question in level["questions"]:
            if type(question) is not dict or type(question.get("items")) is not list:
                raise AtomOrderError("ATOM_LEVELS_INVALID")
            flats[0][_marker(question.get("n"))] += 1
            add(0, question.get("intro", ""))
            for cell in _table_strings(question):
                add(0, cell)
            for item in question["items"]:
                if type(item) is not dict:
                    raise AtomOrderError("ATOM_LEVELS_INVALID")
                add(0, item.get("text"))
        for row in level["answers"]:
            if type(row) is not list or len(row) < 2 or type(row[1]) is not list:
                raise AtomOrderError("ATOM_LEVELS_INVALID")
            flats[1][_marker(row[0])] += 1
            for pair in row[1]:
                if type(pair) is not list or len(pair) != 2:
                    raise AtomOrderError("ATOM_LEVELS_INVALID")
                add(1, pair[1])
    return flats[0], flats[1], shapes[0], shapes[1]


def _positioned_runs(row) -> list:
    """Fraction-mode runs of one row: [(text, x0, x1, size)]. As _runs, plus a '.' that joins a run only between two
    digits (the decimal point of "0.35"); any other '.' breaks it."""
    out, run, previous = [], None, None
    for index, (char, x0, x1, size) in enumerate(row):
        if char == ".":
            nxt = row[index + 1] if index + 1 < len(row) else None
            decimal = (run is not None and run[0][-1:].isdigit() and previous is not None and x0 > previous[0]
                       and x0 - previous[1] <= GAP_FACTOR * size and nxt is not None and nxt[0].isdigit()
                       and nxt[1] > x0 and nxt[1] - x1 <= GAP_FACTOR * nxt[3])
            if decimal:
                run = (run[0] + ".", run[1], x1, max(run[3], size))
                previous = (x0, x1)
                continue
        joined = (run is not None and char in ATOM_CHARS and previous is not None and x0 > previous[0]
                  and x0 - previous[1] <= GAP_FACTOR * size)
        if char in ATOM_CHARS and len(char) == 1:
            if joined:
                run = (run[0] + char, run[1], x1, max(run[3], size))
            else:
                if run is not None:
                    out.append(run)
                run = (char, x0, x1, size)
            previous = (x0, x1)
        else:
            if run is not None:
                out.append(run)
            run, previous = None, None
    if run is not None:
        out.append(run)
    return out


def _fraction_regions(rows, anchor) -> tuple:
    """(runs before the anchor row, runs after it): each run a dict with page, row index, y, x0, x1, size, text."""
    before, after = [], []
    for index, (page, y, glyphs) in enumerate(rows):
        for text, x0, x1, size in _positioned_runs(glyphs):
            run = {"page": page, "row": index, "y": y, "x0": x0, "x1": x1, "size": size, "text": text, "used": False}
            (before if index < anchor else after).append(run)
    return before, after


def _stacked(numerator, denominator) -> bool:
    size = max(numerator["size"], denominator["size"])
    low, high = FRACTION_ROW_GAP
    centre = abs((numerator["x0"] + numerator["x1"]) / 2 - (denominator["x0"] + denominator["x1"]) / 2)
    return (numerator["page"] == denominator["page"] and low * size <= denominator["y"] - numerator["y"] <= high * size
            and centre <= FRACTION_CENTRE * size)


def _match_shape(segments, runs) -> bool:
    """Find one placement of an island's segments among the unused runs (left to right, one baseline for the flat
    segments between each fraction's numerator and denominator rows); mark its runs used. False when none."""
    by_text = {}
    for run in runs:
        if not run["used"]:
            by_text.setdefault(run["text"], []).append(run)

    def candidates(segment, previous, baseline):
        if segment[0] == "flat":
            for run in by_text.get(segment[1], ()):
                if run["used"] or (baseline is not None and abs(run["y"] - baseline) > ROW_TOLERANCE):
                    continue
                yield (run,), run["x0"], run["x1"], run["page"], run["size"]
        else:
            for top in by_text.get(segment[1], ()):
                if top["used"]:
                    continue
                for bottom in by_text.get(segment[2], ()):
                    if bottom["used"] or bottom is top or not _stacked(top, bottom):
                        continue
                    if baseline is not None and not top["y"] < baseline < bottom["y"]:
                        continue
                    yield ((top, bottom), min(top["x0"], bottom["x0"]), max(top["x1"], bottom["x1"]), top["page"],
                           max(top["size"], bottom["size"]))

    def search(index, previous, baseline, chosen):
        if index == len(segments):
            fractions = [runs for kind_, runs in chosen if kind_ == "frac"]
            if baseline is not None and any(not top["y"] < baseline < bottom["y"] for top, bottom in fractions):
                return None
            return chosen
        segment = segments[index]
        for picked, left, right, page, size in candidates(segment, previous, baseline):
            if previous is not None:
                prev_right, prev_page, prev_size = previous
                gap = left - prev_right
                if page != prev_page or gap < -SEGMENT_OVERLAP or gap > SEGMENT_GAP * max(size, prev_size):
                    continue
            for run in picked:
                run["used"] = True
            line = picked[0]["y"] if segment[0] == "flat" and baseline is None else baseline
            found = search(index + 1, (right, page, size), line, chosen + [(segment[0], picked)])
            if found is not None:
                return found
            for run in picked:
                run["used"] = False
        return None

    return search(0, None, None, []) is not None


def check_atom_order_fractions(levels_path, pdf_path) -> dict:
    """The fraction mode of check_atom_order: every fraction or composite island placed as its segments (most
    segments first, each run used once), then every flat atom counted among the runs no placement used, in its
    region, with multiplicity, on any page. Producer WeasyPrint. Returns the PASS report; else raises."""
    questions, answers, question_shapes, answer_shapes = expected_atoms_fractions(_read_levels(levels_path))
    producer, pages, rows = _read_pdf_rows(pdf_path)
    if not producer.startswith("WeasyPrint"):
        raise AtomOrderError("PDF_PRODUCER_NOT_WEASYPRINT")
    anchor = _anchor([(page, glyphs) for page, _, glyphs in rows])
    before, after = _fraction_regions(rows, anchor)
    missing = []
    for region, shapes, runs in (("questions", question_shapes, before), ("answers", answer_shapes, after)):
        for segments in sorted(shapes, key=lambda s: (-len(s), repr(s))):
            for _ in range(shapes[segments]):
                if not _match_shape(segments, runs):
                    missing.append((region, _shape_text(segments)))
                    break
    found_before = Counter(run["text"] for run in before if not run["used"])
    found_after = Counter(run["text"] for run in after if not run["used"])
    missing += [("questions", atom) for atom, count in sorted(questions.items()) if found_before[atom] < count]
    missing += [("answers", atom) for atom, count in sorted(answers.items()) if found_after[atom] < count]
    if missing:
        raise AtomOrderError("ATOM_MISSING", missing)
    atoms = (sum(questions.values()) + sum(answers.values()) + sum(question_shapes.values())
             + sum(answer_shapes.values()))
    return {"status": "PASS", "atoms": atoms, "fractions": sum(question_shapes.values()) + sum(answer_shapes.values()),
            "pages": pages, "producer": producer}


def _shape_text(segments) -> str:
    """A readable code-only name of a segment tuple for the missing list: 1−[3/10]=[7/10]."""
    return "".join(segment[1] if segment[0] == "flat" else "[%s/%s]" % (segment[1], segment[2]) for segment in segments)


class _ElementaryAtoms:
    """Outermost span.ltr texts of an elementary sheet.html by region, the li count of ol.questions and the
    answers heading (html.parser; style and script content ignored)."""

    def __init__(self):
        from html.parser import HTMLParser

        outer = self

        class Parser(HTMLParser):
            def handle_starttag(self, tag, attrs):
                outer.start(tag, dict(attrs))

            def handle_endtag(self, tag):
                outer.end(tag)

            def handle_data(self, data):
                outer.data(data)

        self.parser = Parser(convert_charrefs=True)
        self.stack = []                 # (tag, flags) for every open element
        self.questions, self.answers = Counter(), Counter()
        self.items, self.heading, self.text, self.hidden = 0, "", None, 0

    def _inside(self, flag):
        return any(flag in flags for _, flags in self.stack)

    def start(self, tag, attrs):
        if tag in ("br", "hr", "img", "meta", "link", "input", "col", "wbr"):
            return
        classes = set((attrs.get("class") or "").split())
        flags = set()
        if tag in ("style", "script"):
            flags.add("hidden")
            self.hidden += 1
        if tag == "div" and "answers" in classes:
            flags.add("answers")
        if tag == "ol" and "questions" in classes:
            flags.add("questions")
        if tag == "li" and self.stack and "questions" in self.stack[-1][1]:
            self.items += 1
        if tag == "span" and "ltr" in classes and self.text is None:
            flags.add("atom")
            self.text = []
        if tag in ("h1", "h2", "h3") and self._inside("answers") and not self.heading:
            flags.add("heading")
            self.heading_parts = []
        self.stack.append((tag, flags))

    def end(self, tag):
        for index in range(len(self.stack) - 1, -1, -1):
            if self.stack[index][0] == tag:
                for _, flags in reversed(self.stack[index:]):
                    if "atom" in flags:
                        atom = "".join(ch for ch in "".join(self.text) if not ch.isspace())
                        (self.answers if self._inside("answers") else self.questions)[atom] += 1
                        self.text = None
                    if "heading" in flags:
                        self.heading = "".join(ch for ch in "".join(self.heading_parts) if not ch.isspace())
                    if "hidden" in flags:
                        self.hidden -= 1
                del self.stack[index:]
                return

    def data(self, data):
        if self.hidden:
            return
        if self.text is not None:
            self.text.append(data)
        if self._inside("heading"):
            self.heading_parts.append(data)

    def feed(self, source):
        self.parser.feed(source)
        self.parser.close()
        return self


def expected_atoms_html(source: str) -> tuple:
    """(question region, answer region, anchor) of an elementary sheet.html: every outermost span.ltr text without
    whitespace, plus '(n)' per li of ol.questions in the question region; a glyph outside ELEMENTARY_ATOM_CHARS →
    ATOM_NOT_FLAT; no atom, no answers heading or an unparsable page → ATOM_LEVELS_INVALID."""
    if type(source) is not str:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    try:
        found = _ElementaryAtoms().feed(source)
    except Exception:  # noqa: BLE001 - an unreadable page is one code
        raise AtomOrderError("ATOM_LEVELS_INVALID") from None
    questions, answers = Counter(found.questions), Counter(found.answers)
    for counter in (questions, answers):
        for atom in counter:
            if not atom or any(char not in ELEMENTARY_ATOM_CHARS for char in atom):
                raise AtomOrderError("ATOM_NOT_FLAT" if atom else "ATOM_LEVELS_INVALID")
    for n in range(1, found.items + 1):
        questions[_marker(n)] += 1
    if not found.items or not answers or not found.heading:
        raise AtomOrderError("ATOM_LEVELS_INVALID")
    return questions, answers, found.heading


def check_atom_order_html(html_path, pdf_path) -> dict:
    """check_atom_order for an elementary sheet: the atoms of sheet.html, matched as glyph runs of
    ELEMENTARY_ATOM_CHARS before and after the answers heading, with multiplicity, on any page."""
    try:
        data = Path(html_path).read_bytes()
        if len(data) > MAX_LEVELS_BYTES:
            raise ValueError("sheet.html too large")
        source = data.decode("utf-8")
    except (OSError, ValueError, UnicodeDecodeError):
        raise AtomOrderError("ATOM_LEVELS_INVALID") from None
    questions, answers, heading = expected_atoms_html(source)
    producer, pages, rows = _read_pdf(pdf_path)
    if not producer.startswith("WeasyPrint"):
        raise AtomOrderError("PDF_PRODUCER_NOT_WEASYPRINT")
    before, after = _split(rows, _anchor(rows, heading), ELEMENTARY_ATOM_CHARS)
    missing = [("questions", atom) for atom, count in sorted(questions.items()) if before[atom] < count]
    missing += [("answers", atom) for atom, count in sorted(answers.items()) if after[atom] < count]
    if missing:
        raise AtomOrderError("ATOM_MISSING", missing)
    return {"status": "PASS", "atoms": sum(questions.values()) + sum(answers.values()), "pages": pages,
            "producer": producer}


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="Glyph-run check of every math atom of a v5 PDF.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--levels")
    source.add_argument("--html")
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--json", required=True)
    # The fraction mode (stacked fractions, composite fraction islands, decimals); --levels only.
    parser.add_argument("--fractions", action="store_true")
    args = parser.parse_args(argv)
    if args.fractions and args.levels is None:
        parser.error("--fractions needs --levels")
    try:
        report = (check_atom_order(args.levels, args.pdf, fractions=args.fractions) if args.levels is not None
                  else check_atom_order_html(args.html, args.pdf))
        report["missing"] = []
    except AtomOrderError as error:
        report = {"status": "FAIL", "code": error.code, "missing": [list(entry) for entry in error.missing],
                  "atoms": None, "pages": None, "producer": None}
    Path(args.json).write_text(json.dumps(report, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("atom-order: %s%s" % (report["status"], "" if report["status"] == "PASS" else " " + report["code"]))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    sys.exit(main())
