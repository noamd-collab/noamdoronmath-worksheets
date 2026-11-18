"""Physical answer-layout verification for trusted elementary HTML/PDF pairs.

Unlike the legacy flat-equation gate, fractions are two-dimensional objects:
their original numerator is above a visible fraction rule and denominator below.
Expected math islands are matched in their own numbered table cell, in Hebrew
answer order, after the unique answers heading. PDF extraction order is ignored.
Unsupported markup or missing table boundaries fails closed.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import re

import pymupdf
from bs4 import BeautifulSoup, NavigableString, Tag
from elementary_pdf_order import AnswerOrderError, compact

MATH = re.compile(r"[0-9A-Za-z+\-−×÷:·=().<>≤≥,%]+")

@dataclass(frozen=True)
class Superscript:
    contents: tuple

def _heading_key(text):
    # Vowel marks may be separate PDF glyphs whose x order differs from Unicode
    # combining-mark order. Heading identity still requires every Hebrew letter.
    return re.sub(r"[\u0591-\u05bd\u05bf-\u05c7]", "", compact(text))

def _visible(color, opacity):
    if color is None or opacity < .5:return False
    rgb=tuple(color)
    if len(rgb)==1:return rgb[0]<.92
    return len(rgb)>=3 and .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]<.92


def _tree(element, depth=0):
    if depth > 8:
        raise AnswerOrderError("GENERAL_ANSWER_FORMULA_DEPTH")
    result = []
    for child in element.children:
        if isinstance(child, NavigableString):
            value = compact(str(child))
            if value and not MATH.fullmatch(value):
                raise AnswerOrderError("GENERAL_ANSWER_UNSUPPORTED_MATH_TEXT")
            result.extend(value)
        elif isinstance(child, Tag):
            classes = child.get("class", [])
            if "frac" in classes:
                num, den = child.select(":scope > .fnum"), child.select(":scope > .fden")
                if len(num) != 1 or len(den) != 1 or len(child.find_all(recursive=False)) != 2:
                    raise AnswerOrderError("GENERAL_ANSWER_FRACTION_STRUCTURE")
                numerator, denominator = _tree(num[0], depth + 1), _tree(den[0], depth + 1)
                if not numerator or not denominator:
                    raise AnswerOrderError("GENERAL_ANSWER_EMPTY_FRACTION")
                result.append((numerator, denominator))
            elif child.name == "span" and set(classes) <= {"ltr"}:
                result.extend(_tree(child, depth + 1))
            elif child.name == "sup":
                contents=_tree(child,depth+1)
                if not result or isinstance(result[-1],Superscript) or any(not isinstance(item,str) for item in contents) or not re.fullmatch(r"[-−]?[0-9]{1,2}","".join(contents)):
                    raise AnswerOrderError("GENERAL_ANSWER_SUPERSCRIPT_STRUCTURE")
                result.append(Superscript(contents))
            else:
                raise AnswerOrderError("GENERAL_ANSWER_UNSUPPORTED_MATH_MARKUP")
    if len(result) > 128:
        raise AnswerOrderError("GENERAL_ANSWER_FORMULA_SIZE")
    return tuple(result)


def expected_answers(html):
    soup = BeautifulSoup(Path(html).read_text(encoding="utf-8"), "html.parser")
    sections = soup.select(".answers")
    if len(sections) != 1:
        raise AnswerOrderError("ANSWER_SECTION_MISSING_OR_AMBIGUOUS")
    headings = sections[0].find_all(re.compile(r"^h[1-6]$"), recursive=False)
    if len(headings) != 1 or not compact(headings[0].get_text()):
        raise AnswerOrderError("ANSWER_HEADING_MISSING_OR_AMBIGUOUS")
    rows = []
    for row in sections[0].select("table.ans tr"):
        cells, qn = row.find_all("td", recursive=False), row.select(":scope > td.qn")
        if len(cells) != 2 or len(qn) != 1:
            raise AnswerOrderError("GENERAL_ANSWER_TABLE_STRUCTURE")
        label = compact(qn[0].get_text())
        if not re.fullmatch(r"[1-9][0-9]?\.", label):
            raise AnswerOrderError("GENERAL_ANSWER_QUESTION_LABEL")
        cell = next(cell for cell in cells if cell is not qn[0])
        formulas = [_tree(span) for span in cell.select("span.ltr") if not span.find_parent("span", class_="ltr")]
        if any(not formula for formula in formulas):
            raise AnswerOrderError("GENERAL_ANSWER_EMPTY_MATH_ISLAND")
        rows.append((label, formulas))
    if not rows or len({label for label, _ in rows}) != len(rows):
        raise AnswerOrderError("GENERAL_ANSWER_ROWS_MISSING_OR_AMBIGUOUS")
    return compact(headings[0].get_text()), rows


@dataclass(frozen=True)
class Glyph:
    id: int
    text: str
    box: tuple
    size: float

    @property
    def axis(self):
        return (self.box[1] + self.box[3]) / 2


@dataclass(frozen=True)
class Match:
    box: tuple
    axis: float
    size: float
    glyphs: frozenset
    rules: frozenset = frozenset()


def _glyphs(page):
    result = []
    for span in page.get_texttrace():
        if span["type"]==3 or not _visible(span.get("color"),span.get("opacity",1)):continue
        for codepoint,_,_,box in span["chars"]:
            if 0<=codepoint<=0x10ffff and compact(chr(codepoint)):
                result.append(Glyph(len(result),compact(chr(codepoint)),tuple(box),span["size"]))
    return result

def _heading_lines(glyphs):
    rows=[]
    for glyph in sorted((g for g in glyphs if _heading_key(g.text)),key=lambda g:(g.axis,g.box[0])):
        if not rows or glyph.axis-rows[-1][0].axis>1.0:rows.append([glyph])
        else:rows[-1].append(glyph)
    return [sorted(row,key=lambda g:g.box[0]) for row in rows]


def _axes(page):
    horizontal, vertical = [], []
    def segment(x0, y0, x1, y1):
        if abs(y1 - y0) <= .8 and abs(x1 - x0) > 2:
            horizontal.append((min(x0,x1), max(x0,x1), (y0+y1)/2))
        if abs(x1 - x0) <= .8 and abs(y1 - y0) > 2:
            vertical.append(((x0+x1)/2, min(y0,y1), max(y0,y1)))
    for drawing in page.get_drawings():
        stroke_visible="s" in drawing["type"] and _visible(drawing.get("color"),drawing.get("stroke_opacity",1))
        fill_visible="f" in drawing["type"] and _visible(drawing.get("fill"),drawing.get("fill_opacity",1))
        if not stroke_visible and not fill_visible:continue
        rectangles = []
        for item in drawing["items"]:
            if item[0] == "l" and stroke_visible:
                segment(item[1].x,item[1].y,item[2].x,item[2].y)
            elif item[0] == "re":
                r = item[1]; rectangles.append(r)
                if r.height <= 2:
                    horizontal.append((r.x0,r.x1,(r.y0+r.y1)/2))
                elif r.width <= 2:
                    vertical.append(((r.x0+r.x1)/2,r.y0,r.y1))
                elif stroke_visible:
                    segment(r.x0,r.y0,r.x1,r.y0); segment(r.x0,r.y1,r.x1,r.y1)
                    segment(r.x0,r.y0,r.x0,r.y1); segment(r.x1,r.y0,r.x1,r.y1)
        # WeasyPrint fills the difference between two rectangles for a CSS
        # bottom border; the full drawing bbox also encloses its numerator.
        for i, a in enumerate(rectangles if fill_visible else []):
            for b in rectangles[i+1:]:
                if max(abs(a.x0-b.x0),abs(a.x1-b.x1),abs(a.y0-b.y0)) < .1 and .1 < abs(a.y1-b.y1) <= 2:
                    horizontal.append((a.x0,a.x1,(a.y1+b.y1)/2))
    merged = []
    for x0,x1,y in sorted(set(horizontal),key=lambda r:(round(r[2],1),r[0])):
        if merged and abs(merged[-1][2]-y)<.8 and x0 <= merged[-1][1]+1.5:
            previous=merged[-1];merged[-1]=(min(previous[0],x0),max(previous[1],x1),previous[2])
        else:
            merged.append((x0,x1,y))
    return merged, vertical


def _inside(glyph, box):
    return box[0]-.2 <= glyph.box[0] and glyph.box[2] <= box[2]+.2 and box[1]-.2 <= glyph.axis <= box[3]+.2


def _bounds(matches):
    return (min(m.box[0] for m in matches), min(m.box[1] for m in matches),
            max(m.box[2] for m in matches), max(m.box[3] for m in matches))


def _matches(tree, glyphs, rules, region, depth=0):
    if depth > 8:
        raise AnswerOrderError("GENERAL_ANSWER_MATCH_DEPTH")
    glyphs = [g for g in glyphs if _inside(g,region)]
    def clean(match):
        return all(g.id in match.glyphs or not _inside(g,match.box) for g in glyphs)
    def candidates(part):
        if isinstance(part,str):
            return [Match(g.box,g.axis,g.size,frozenset({g.id})) for g in glyphs if g.text==part]
        if isinstance(part,Superscript):
            return _matches(part.contents,glyphs,rules,region,depth+1)
        result=[]
        for rule_id,(left,right,y) in enumerate(rules):
            if not (region[0]-.2<=left<right<=region[2]+.2 and region[1]<y<region[3]) or right-left>200:
                continue
            nums=_matches(part[0],glyphs,rules,(left, max(region[1],y-80),right,y-.4),depth+1)
            dens=_matches(part[1],glyphs,rules,(left,y+.4,right,min(region[3],y+80)),depth+1)
            for num in nums:
                for den in dens:
                    if num.box[3]>y+.1 or den.box[1]<y-.1 or num.glyphs & den.glyphs:
                        continue
                    if max(abs((num.box[0]+num.box[2]-left-right)/2),abs((den.box[0]+den.box[2]-left-right)/2))>1.5:
                        continue
                    match=Match((left,num.box[1],right,den.box[3]),y,max(num.size,den.size)*1.18,
                                num.glyphs|den.glyphs,num.rules|den.rules|{rule_id})
                    if clean(match):result.append(match)
        return result
    sequences=[[]]
    for part in tree:
        choices=candidates(part); following=[]
        for seq in sequences:
            for candidate in choices:
                if isinstance(part,Superscript):
                    if not seq:continue
                    base=seq[-1]
                    if not (base.box[2]-.2<=candidate.box[0]<=base.box[2]+max(2,base.size*.6) and
                            max(1,base.size*.18)<base.axis-candidate.axis<base.size*1.5 and candidate.size<base.size*.96):continue
                    if any(candidate.glyphs&old.glyphs or candidate.rules&old.rules for old in seq):continue
                    # Following operators return to the base's mathematical
                    # baseline; the exponent still expands the physical bbox.
                    raised=Match(candidate.box,base.axis,base.size,candidate.glyphs,candidate.rules)
                    following.append(seq+[raised])
                    if len(following)>256:raise AnswerOrderError("GENERAL_ANSWER_MATCH_BUDGET")
                    continue
                if seq:
                    previous=seq[-1]
                    if candidate.box[0] < previous.box[2]-.2 or candidate.box[0]-previous.box[2]>max(4,min(candidate.size,previous.size)*.9):continue
                    if abs(candidate.axis-previous.axis)>max(1.5,min(candidate.size,previous.size)*.16):continue
                    if any(candidate.glyphs & old.glyphs or candidate.rules & old.rules for old in seq):continue
                following.append(seq+[candidate])
                if len(following)>256:raise AnswerOrderError("GENERAL_ANSWER_MATCH_BUDGET")
        sequences=following
    result=[]
    for seq in sequences:
        if not seq:continue
        match=Match(_bounds(seq),sum(m.axis for m in seq)/len(seq),max(m.size for m in seq),
                    frozenset().union(*(m.glyphs for m in seq)),frozenset().union(*(m.rules for m in seq)))
        if not clean(match):continue
        # A standalone number/operand cannot borrow digits from a longer value.
        if any(g.id not in match.glyphs and re.fullmatch(r"[0-9A-Za-z.]",g.text) and abs(g.axis-match.axis)<.8 and
               (0<=match.box[0]-g.box[2]<max(1,g.size*.2) or 0<=g.box[0]-match.box[2]<max(1,g.size*.2)) for g in glyphs):continue
        result.append(match)
    return result


def check_answer_order(pdf, html=None):
    pdf=Path(pdf);html=Path(html) if html is not None else pdf.with_suffix(".html")
    if not pdf.is_file() or not html.is_file():raise AnswerOrderError("ANSWER_PDF_OR_HTML_MISSING")
    heading, expected=expected_answers(html)
    with pymupdf.open(pdf) as document:
        heading=_heading_key(heading)
        visible_pages={i:_glyphs(page) for i,page in enumerate(document)}
        anchors=[(i,max(g.box[3] for g in row)) for i,glyphs in visible_pages.items() for row in _heading_lines(glyphs)
                 if _heading_key("".join(g.text for g in row)) in (heading,heading[::-1])]
        if len(anchors)!=1:raise AnswerOrderError("PDF_ANSWER_HEADING_MISSING_OR_AMBIGUOUS")
        start_page,baseline=anchors[0]
        data={i:(visible_pages[i],*_axes(page)) for i,page in enumerate(document) if i>=start_page}
        cells=[]
        for label,formulas in expected:
            possible=[]
            for i,(glyphs,horizontal,vertical) in data.items():
                for word in document[i].get_text("words"):
                    if word[4]!=label or i==start_page and word[1]<=baseline+1:continue
                    x=(word[0]+word[2])/2
                    edges=[h for h in horizontal if h[1]-h[0]>document[i].rect.width*.3 and h[0]<x<h[1]]
                    above=[h for h in edges if h[2]<word[1]]; below=[h for h in edges if h[2]>word[3]]
                    if not above or not below:continue
                    top=max(above,key=lambda h:h[2]);bottom=min(below,key=lambda h:h[2])
                    separators=[v for v in vertical if top[0]+20<v[0]<word[0] and v[1]<=top[2]+1 and v[2]>=bottom[2]-1]
                    if not separators:continue
                    separator=max(separators,key=lambda v:v[0])
                    box=(top[0]+1,top[2]+1,separator[0]-1,bottom[2]-1)
                    possible.append((i,box))
            if len(possible)!=1:raise AnswerOrderError("GENERAL_ANSWER_CELL_MISSING_OR_AMBIGUOUS: "+label)
            cells.append((*possible[0],formulas,label))
        if [(i,b[1]) for i,b,_,_ in cells]!=sorted((i,b[1]) for i,b,_,_ in cells):
            raise AnswerOrderError("GENERAL_ANSWER_QUESTION_ORDER")
        if len({(i,b) for i,b,_,_ in cells})!=len(cells):
            raise AnswerOrderError("GENERAL_ANSWER_CELL_SHARED_BY_QUESTIONS")
        count=0
        for i,box,formulas,label in cells:
            glyphs,horizontal,_=data[i]; used=frozenset();previous=None
            for formula in formulas:
                choices=_matches(formula,glyphs,horizontal,box)
                choices=[m for m in choices if not m.glyphs&used and (previous is None or m.axis>previous.axis+max(2,m.size*.4) or abs(m.axis-previous.axis)<=max(2,m.size*.4) and m.box[2]<previous.box[0])]
                choices.sort(key=lambda m:(round(m.axis/2)*2,-m.box[0]))
                if not choices:raise AnswerOrderError("GENERAL_ANSWER_VISUAL_ORDER: "+label)
                previous=choices[0];used|=previous.glyphs;count+=1
        return {"status":"PASS","formulas":count,"answerStartPage":start_page+1,"answerRows":len(cells)}
