"""Check the *visual* order of flat answer equations in an elementary PDF.

The trusted sibling HTML supplies the expected equations, not CSS assertions.
PDF glyph coordinates must show every equation contiguously left-to-right on
one baseline, after the exact answers heading. Question-page matches cannot
satisfy this gate. Complex/stacked formula markup is deliberately unsupported.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from pathlib import Path
import re

import pymupdf
from bs4 import BeautifulSoup


class AnswerOrderError(ValueError):
    """A fixed diagnostic code, without arbitrary HTML/PDF text in logs."""


def compact(text):
    return re.sub(r"[\s\u200e\u200f\u202a-\u202e\u2066-\u2069]", "", text)


def expected_answers(html):
    soup = BeautifulSoup(Path(html).read_text(encoding="utf-8"), "html.parser")
    sections = soup.select(".answers")
    if len(sections) != 1:
        raise AnswerOrderError("ANSWER_SECTION_MISSING_OR_AMBIGUOUS")
    headings = sections[0].find_all(re.compile(r"^h[1-6]$"), recursive=False)
    if len(headings) != 1 or not compact(headings[0].get_text()):
        raise AnswerOrderError("ANSWER_HEADING_MISSING_OR_AMBIGUOUS")
    formulas = []
    for span in sections[0].select("span.ltr"):
        # Nested numeric .ltr wrappers are counted once. Keep the outer text so
        # an equation containing nested operand spans cannot evade the gate.
        if span.find_parent("span", class_="ltr") or span.find_parent("td", class_="qn"):
            continue
        value = compact(span.get_text())
        if "=" not in value:
            continue
        if span.find(class_=re.compile(r"^(frac|sqrt|root)$")) or not re.fullmatch(
            r"[0-9A-Za-z+\-−×÷:·=().]+", value
        ):
            raise AnswerOrderError("ANSWER_FORMULA_NOT_FLAT_TEXT")
        formulas.append(value)
    return compact(headings[0].get_text()), formulas


@dataclass(frozen=True)
class Glyph:
    text: str
    x: float
    right: float
    y: float
    size: float


def visual_baselines(page):
    """Merge engine-dependent text blocks by physical baseline, then sort x.

    In particular, Chromium and WeasyPrint split one answer differently into
    PDF blocks; their stream/extraction order is not evidence of visual order.
    """
    glyphs = []
    for block in page.get_text("rawdict")["blocks"]:
        for line in block.get("lines", []):
            for span in line["spans"]:
                for char in span["chars"]:
                    if compact(char["c"]):
                        glyphs.append(Glyph(char["c"], char["bbox"][0],
                                            char["bbox"][2], char["origin"][1], span["size"]))
    rows = []
    for glyph in sorted(glyphs, key=lambda item: (item.y, item.x)):
        if not rows or glyph.y - rows[-1][0].y > 0.75:
            rows.append([glyph])
        else:
            rows[-1].append(glyph)
    return [sorted(row, key=lambda item: item.x) for row in rows]


def contiguous_matches(row, expected):
    # One PDF char normally is one Unicode character. Keep a mapping for a
    # multi-codepoint glyph, so it cannot silently borrow a neighboring glyph.
    text, positions = "", []
    for index, glyph in enumerate(row):
        value = compact(glyph.text)
        text += value
        positions.extend([index] * len(value))
    count, start = 0, 0
    while (start := text.find(expected, start)) != -1:
        end = start + len(expected)
        # Do not accept 2:4=8 as a substring of 32:4=80.
        bounded = not (start and re.match(r"[0-9A-Za-z]", text[start - 1])) and not (
            end < len(text) and re.match(r"[0-9A-Za-z]", text[end]))
        match = row[positions[start]:positions[end - 1] + 1]
        physical = all(
            following.x > previous.x + 0.01
            and following.x - previous.right <= max(3.0, min(previous.size, following.size) * 0.8)
            for previous, following in zip(match, match[1:])
        )
        if bounded and physical:
            count += 1
        start = end
    return count


def check_answer_order(pdf, html=None):
    pdf = Path(pdf)
    html = Path(html) if html is not None else pdf.with_suffix(".html")
    if not pdf.is_file() or not html.is_file():
        raise AnswerOrderError("ANSWER_PDF_OR_HTML_MISSING")
    heading, formulas = expected_answers(html)
    with pymupdf.open(pdf) as document:
        pages = [visual_baselines(page) for page in document]
    anchors = [(page_number, row[0].y) for page_number, rows in enumerate(pages)
               for row in rows if compact("".join(g.text for g in row)) in (heading, heading[::-1])]
    if len(anchors) != 1:
        raise AnswerOrderError("PDF_ANSWER_HEADING_MISSING_OR_AMBIGUOUS")
    start_page, baseline = anchors[0]
    rows = [row for page_number, lines in enumerate(pages) for row in lines
            if page_number > start_page or (page_number == start_page and row[0].y > baseline + 1)]
    expected = Counter(formulas)
    failed = [index for index, formula in enumerate(expected, 1)
              if sum(contiguous_matches(row, formula) for row in rows) != expected[formula]]
    if failed:
        raise AnswerOrderError("PDF_ANSWER_LTR_ORDER: formula indices " + ",".join(map(str, failed)))
    return {"status": "PASS", "formulas": len(formulas), "answerStartPage": start_page + 1}
