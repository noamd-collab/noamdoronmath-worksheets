"""Local layout repair for the pinned elementary Word exporter, never model code.

Keep each complete question while letting Word paginate its own text metrics.
The exporter's explicitly isolated LTR math runs use nonbreaking spaces so a
result cannot detach from its equation in a Hebrew answer paragraph. The
installed skill, numbers, Hebrew wording, run direction and other ZIP members
are preserved. Unexpected paragraph structure fails before replacing the file.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import tempfile
from pathlib import Path
from zipfile import ZipFile

from lxml import etree as ET

W = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
NS = {"w": W[1:-1]}
WORK_MARKER = "NoamTeacherWork_"
CHECK_INSTRUCTION = "הפתרונות הבאים שגויים. תקנו והסבירו:"
INVERSE_INSTRUCTION = " כתבו גם תרגיל כפל מתאים לבדיקת כל תשובה."


def _work_line_count(question):
    """Closed contract for the trusted adapter's existing elementary wording.

    The model supplies neither instructions nor layout. Unknown wording must
    be reviewed with the adapter instead of silently dropping answer space.
    """
    intro, star = question.get("intro"), question.get("star")
    if type(star) is not bool or not isinstance(intro, str):
        raise ValueError("DOCX_LAYOUT_MISMATCH: missing trusted instruction")
    if star:
        if not intro.endswith(INVERSE_INSTRUCTION):
            raise ValueError("DOCX_LAYOUT_MISMATCH: challenge instruction")
        intro = intro[:-len(INVERSE_INSTRUCTION)]
    if intro not in ("פתרו:", "השלימו את המספר החסר:", CHECK_INSTRUCTION):
        raise ValueError("DOCX_LAYOUT_MISMATCH: unknown trusted instruction")
    return int(intro == CHECK_INSTRUCTION) + int(star)


def _work_line(name, bookmark_id):
    paragraph = ET.Element(W + "p")
    props = ET.SubElement(paragraph, W + "pPr")
    borders = ET.SubElement(props, W + "pBdr")
    # 'between' preserves both writing rules when two empty paragraphs abut.
    for side in ("bottom", "between"):
        border = ET.SubElement(borders, W + side)
        for key, value in {"val": "single", "sz": "4", "space": "0", "color": "A0A0A0"}.items():
            border.set(W + key, value)
    ET.SubElement(props, W + "bidi").set(W + "val", "1")
    spacing = ET.SubElement(props, W + "spacing")
    for key, value in {"before": "0", "after": "80", "line": "360", "lineRule": "atLeast"}.items():
        spacing.set(W + key, value)
    start = ET.SubElement(paragraph, W + "bookmarkStart")
    start.set(W + "id", str(bookmark_id)); start.set(W + "name", name)
    ET.SubElement(paragraph, W + "bookmarkEnd").set(W + "id", str(bookmark_id))
    return paragraph


def _owned_line(paragraph, name):
    if paragraph.tag != W + "p":
        return False
    marks = paragraph.findall(W + "bookmarkStart")
    if not marks or marks[0].get(W + "name") != name:
        return False
    ends = paragraph.findall(W + "bookmarkEnd")
    if (len(marks) != 1 or len(ends) != 1 or _text(paragraph)
            or [node.tag for node in paragraph] != [W + "pPr", W + "bookmarkStart", W + "bookmarkEnd"]
            or marks[0].get(W + "id") != ends[0].get(W + "id")):
        raise ValueError("DOCX_LAYOUT_MISMATCH: modified work paragraph")
    props = paragraph.find(W + "pPr")
    if [node.tag for node in props] != [W + tag for tag in ("keepNext", "keepLines", "pBdr", "bidi", "spacing")]:
        raise ValueError("DOCX_LAYOUT_MISMATCH: modified work layout")
    # Repeated repair must recognize exactly our own layout, not arbitrary blank
    # paragraphs. Keep flags are checked separately as part of the whole group.
    expected = _work_line(name, marks[0].get(W + "id"))
    for tag in ("pBdr", "bidi", "spacing"):
        actual_prop = paragraph.find("w:pPr/w:" + tag, NS)
        expected_prop = expected.find("w:pPr/w:" + tag, NS)
        if actual_prop is None or ET.tostring(actual_prop) != ET.tostring(expected_prop):
            # Namespace prefixes can differ after ZIP/XML round trips.
            if actual_prop is None or [(e.tag, dict(e.attrib)) for e in actual_prop.iter()] != [(e.tag, dict(e.attrib)) for e in expected_prop.iter()]:
                raise ValueError("DOCX_LAYOUT_MISMATCH: modified work layout")
    return True


def _text(element):
    return "".join(t.text or "" for t in element.iter(W + "t"))


def _flag(paragraph, name, enabled):
    props = paragraph.find(W + "pPr")
    if props is None:
        props = ET.Element(W + "pPr")
        paragraph.insert(0, props)
    flag = props.find(W + name)
    if flag is None:
        flag = ET.Element(W + name)
        # Preserve the WordprocessingML pPr order, including in fresh paragraphs.
        predecessors = {W + "pStyle"}
        if name == "keepLines":
            predecessors.add(W + "keepNext")
        insertion = 0
        while insertion < len(props) and props[insertion].tag in predecessors:
            insertion += 1
        props.insert(insertion, flag)
    flag.set(W + "val", "1" if enabled else "0")


def repair_elementary_docx(docx_path, content):
    path = Path(docx_path)
    questions = content["questions"]
    with ZipFile(path) as archive:
        infos = archive.infolist()
        members = {entry.filename: archive.read(entry) for entry in infos}
    root = ET.fromstring(members["word/document.xml"])
    body = root.find(W + "body")
    elements = list(body)
    headings = [(i, element) for i, element in enumerate(elements)
                if element.tag == W + "p" and re.match(r"^\d+\. ", _text(element))]
    if len(headings) != len(questions):
        raise ValueError("DOCX_LAYOUT_MISMATCH: question heading count")
    groups = []
    existing_lines = 0
    expected_lines = 0
    additions = []
    bookmark_ids = [int(node.get(W + "id")) for node in root.iter(W + "bookmarkStart")]
    next_bookmark_id = max(bookmark_ids, default=0) + 1
    for index, ((offset, heading), question) in enumerate(zip(headings, questions)):
        line_count = _work_line_count(question)
        expected_heading = f"{index + 1}. " + ("★ " if question["star"] else "") + question["intro"]
        if " ".join(_text(heading).split()) != " ".join(expected_heading.split()):
            raise ValueError("DOCX_LAYOUT_MISMATCH: question sequence")
        count = len(question["items"])
        if not 3 <= count <= 6:
            raise ValueError("DOCX_LAYOUT_MISMATCH: question paragraph group")
        group = [heading]
        cursor = offset + 1
        for item_index, label in enumerate("אבגדהוזחטי"[:count], 1):
            if cursor >= len(elements) or elements[cursor].tag != W + "p" or not _text(elements[cursor]).startswith(label + ". "):
                raise ValueError("DOCX_LAYOUT_MISMATCH: subquestion sequence")
            paragraph = elements[cursor]; group.append(paragraph); cursor += 1
            previous = paragraph
            for line_index in range(1, line_count + 1):
                expected_lines += 1
                name = f"{WORK_MARKER}q{index + 1:02}_i{item_index:02}_l{line_index:02}"
                if cursor < len(elements) and _owned_line(elements[cursor], name):
                    line = elements[cursor]; cursor += 1; existing_lines += 1
                else:
                    line = _work_line(name, next_bookmark_id); next_bookmark_id += 1
                    additions.append((previous, line))
                group.append(line); previous = line
        if index + 1 < len(headings) and cursor != headings[index + 1][0]:
            raise ValueError("DOCX_LAYOUT_MISMATCH: unexpected question paragraphs")
        groups.append(group)
    if existing_lines not in (0, expected_lines):
        raise ValueError("DOCX_LAYOUT_MISMATCH: incomplete work paragraphs")
    # Only after the entire structure is verified do we alter the in-memory XML.
    for previous, line in additions:
        previous.addnext(line)
    for group in groups:
        for offset, paragraph in enumerate(group):
            _flag(paragraph, "keepLines", True)
            _flag(paragraph, "keepNext", offset < len(group) - 1)
    protected = 0
    for run in root.iter(W + "r"):
        direction = run.find("w:rPr/w:rtl", NS)
        if direction is None or direction.get(W + "val") not in ("0", "false", "off"):
            continue
        for node in run.findall(W + "t"):
            value = node.text or ""
            # These boundaries are emitted by the pinned skill for an LTR span.
            # Do not infer math from ordinary English prose or alter Hebrew runs.
            if (value.startswith("\u200e") and value.endswith("\u200e")
                    and not re.search(r"[\u0590-\u05ff]", value) and " " in value):
                node.text = value.replace(" ", "\u00a0")
                protected += 1
    members["word/document.xml"] = ET.tostring(root, xml_declaration=True, encoding="UTF-8", standalone=True)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(dir=path.parent, suffix=".docx", delete=False) as handle:
            temporary = Path(handle.name)
        with ZipFile(temporary, "w") as archive:
            for entry in infos:
                archive.writestr(entry, members[entry.filename])
        os.replace(temporary, path)
    finally:
        if temporary is not None:
            temporary.unlink(missing_ok=True)
    return {"questionsKeptTogether": len(groups), "mathRunsProtected": protected,
            "answerLines": expected_lines, "answerLinesAdded": len(additions)}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docx", required=True)
    parser.add_argument("--content", required=True)
    args = parser.parse_args()
    content = json.loads(Path(args.content).read_text(encoding="utf-8"))
    print(json.dumps(repair_elementary_docx(args.docx, content)))
