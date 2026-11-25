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


def _read_pdf(pdf_path):
    """(producer, pages, rows): rows are [(page, [(char, x0, x1, size)...] sorted by x)], top to bottom per page."""
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
                    rows.append((page_number, sorted(current, key=lambda g: g[1])))
                    current = []
                current.append(glyph)
            if current:
                rows.append((page_number, sorted(current, key=lambda g: g[1])))
        pages = len(document)
    except Exception:  # noqa: BLE001
        raise AtomOrderError("ATOM_PDF_UNREADABLE") from None
    finally:
        document.close()
    return producer, pages, [(page, [(g[3], g[1], g[2], g[4]) for g in row]) for page, row in rows]


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


def check_atom_order(levels_path, pdf_path) -> dict:
    """Producer must start with 'WeasyPrint'; every expected atom must be found as a run in its region, with multiplicity
    (found[s] ≥ expected[s]) on any page. Returns {"status":"PASS","atoms":n,"pages":p,"producer":…}; else raises."""
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
    args = parser.parse_args(argv)
    try:
        report = (check_atom_order(args.levels, args.pdf) if args.levels is not None
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
