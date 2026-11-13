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
    for index, ((offset, heading), question) in enumerate(zip(headings, questions)):
        if not _text(heading).startswith(f"{index + 1}. "):
            raise ValueError("DOCX_LAYOUT_MISMATCH: question sequence")
        count = len(question["items"])
        group = elements[offset:offset + count + 1]
        if len(group) != count + 1 or any(p.tag != W + "p" for p in group):
            raise ValueError("DOCX_LAYOUT_MISMATCH: question paragraph group")
        if index + 1 < len(headings) and offset + count + 1 != headings[index + 1][0]:
            raise ValueError("DOCX_LAYOUT_MISMATCH: unexpected question paragraphs")
        for label, paragraph in zip("אבגדהוזחטי", group[1:]):
            if not _text(paragraph).startswith(label + ". "):
                raise ValueError("DOCX_LAYOUT_MISMATCH: subquestion sequence")
        groups.append(group)
    # Only after the entire structure is verified do we alter the in-memory XML.
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
    return {"questionsKeptTogether": len(groups), "mathRunsProtected": protected}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--docx", required=True)
    parser.add_argument("--content", required=True)
    args = parser.parse_args()
    content = json.loads(Path(args.content).read_text(encoding="utf-8"))
    print(json.dumps(repair_elementary_docx(args.docx, content)))
