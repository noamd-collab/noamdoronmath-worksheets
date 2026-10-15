#!/usr/bin/env python3
"""Build a Noam AI manifest (schemaVersion 2) for an approved student PDF.

Measures question markers "(N)" and part labels "א." at the right margin of
each page with PyMuPDF text spans; pins point at the part label and crops are
the question's vertical band (the viewer re-tightens crops from PDF tokens at
runtime). Run per level:

  python3 scripts/build-student-manifest.py --pdf <student.pdf> \
    --media-id <32hex> --grade 7 --topic-id 28 --prefix G7-T28 \
    --topic "הסתברות — היכרות" --level a --out noam-ai/manifests/<id>.json
"""
import argparse
import json
import re
import hashlib
import unicodedata

import pymupdf

QMARK = re.compile(r"^\((\d{1,2})\)$")
# Part labels are typeset with their ordinal dot ("א."). A bare Hebrew letter in
# the right margin belongs to the content instead — a table row label or a
# drawing label — so the dot is what separates a real part from such a letter.
PART = re.compile(r"^[.\s]*([א-ת])[.\s]*$")
PART_DOT = "."
HEADER_FOOTER = ("מתמטיקה · נועם דורון", "בס״ד", "© כל הזכויות", "עמוד")
LETTERS = "אבגדהוזחטי"


def norm(t: str) -> str:
    return unicodedata.normalize("NFC", " ".join(t.split()))


def spans(page):
    out = []
    d = page.get_text("dict")
    for b in d["blocks"]:
        for l in b.get("lines", []):
            for s in l["spans"]:
                t = norm(s["text"])
                if t:
                    out.append(
                        {
                            "x0": s["bbox"][0],
                            "y0": s["bbox"][1],
                            "x1": s["bbox"][2],
                            "y1": s["bbox"][3],
                            "size": s["size"],
                            "text": t,
                        }
                    )
    return out


def build(pdf_path, media_id, grade, topic_id, prefix, topic, level, native_path=None):
    doc = pymupdf.open(pdf_path)
    page_count = len(doc)
    level_code = {"a": "A", "b": "B", "c": "E", "c2": "E2", "one": "B"}[level]

    questions = []  # {q, page, top, bottom, parts:[{letter,page,x,y,y1}]}
    issues = []
    for pno in range(page_count):
        page = doc[pno]
        W, H = page.rect.width, page.rect.height
        right = 0.72 * W
        for s in sorted(spans(page), key=lambda z: (round(z["y0"], 1), -z["x0"])):
            qm = QMARK.match(s["text"])
            pm = PART.match(s["text"]) if len(s["text"]) <= 4 and PART_DOT in s["text"] else None
            if qm and s["x0"] > right:
                questions.append(
                    {
                        "q": int(qm.group(1)),
                        "page": pno + 1,
                        "top": s["y0"],
                        "bottom": s["y1"],
                        "x": s["x0"],
                        "parts": [],
                    }
                )
            elif pm and s["x0"] > right and questions:
                letter = pm.group(1)
                cur = questions[-1]
                if not any(p["letter"] == letter for p in cur["parts"]):
                    cur["parts"].append(
                        {"letter": letter, "page": pno + 1, "x": s["x0"], "y": s["y0"], "y1": s["y1"]}
                    )

    # sequential sanity
    for i, q in enumerate(questions):
        if q["q"] != i + 1:
            issues.append(f"question order gap at {q['q']} (expected {i + 1})")
    for q in questions:
        letters = [p["letter"] for p in q["parts"]]
        if letters != list(LETTERS[: len(letters)]):
            issues.append(f"q{q['q']} parts out of order: {''.join(letters)}")

    if native_path:
        native = json.load(open(native_path))
        expected = {int(q["label"]): [str(i["label"]) for i in q.get("items", [])]
                    for q in native["questions"]}
        actual = {q["q"]: [p["letter"] for p in q["parts"]] for q in questions}
        for qno in sorted(set(expected) | set(actual)):
            if expected.get(qno) != actual.get(qno):
                issues.append(f"native item mismatch q{qno}: expected={expected.get(qno)} actual={actual.get(qno)}")
        if native.get("package") != prefix or native.get("level") != level:
            issues.append("native package/level mismatch")
    else:
        issues.append("authoritative native item mapping not supplied; parser alone is insufficient")

    def norm_rect(points):
        xs = [p.x for p in points]
        ys = [p.y for p in points]
        return pymupdf.Rect(min(xs), min(ys), max(xs), max(ys))

    INK_TOL = 2.0  # pt; stroke miters and node dots can start a hair past the
    # stroke that connects them, so connected ink is closed over with a small
    # tolerance instead of a strict 1pt overlap.

    def ink_rects(page):
        out = []
        H = page.rect.height
        for d in page.get_drawings():
            for item in d["items"]:
                kind = item[0]
                if kind == "l":
                    r = norm_rect([item[1], item[2]])
                elif kind == "re":
                    r = item[1]
                elif kind == "c":
                    r = norm_rect([item[1], item[2], item[3], item[4]])
                elif kind == "qu":
                    r = item[1].rect
                else:
                    continue
                # A stroke has area even when its centreline bbox is empty.
                # Allow one quarter point for raster edge antialiasing as well.
                # Do not infer header/footer ownership from fixed page y values.
                # Retain the pre-existing large-group/frame exclusion in this narrow fix.
                if r.height > 0.5 * H:
                    continue
                stroked = "s" in d.get("type", "") and (d.get("stroke_opacity", 1) or 0) > 0
                filled = "f" in d.get("type", "") and (d.get("fill_opacity", 1) or 0) > 0
                if not stroked and (not filled or r.width <= 0 or r.height <= 0):
                    continue
                pad = max(0.25, (d.get("width") or 0) / 2 if stroked else 0)
                r = pymupdf.Rect(r.x0 - pad, r.y0 - pad, r.x1 + pad, r.y1 + pad)
                out.append(r)
        return out

    def content_band(pno):
        page = doc[pno]
        H = page.rect.height
        ys = [
            s
            for s in spans(page)
            if s["size"] >= 9.5 and not any(h in s["text"] for h in HEADER_FOOTER)
        ]
        if not ys:
            return 0.0, H
        y0 = min(s["y0"] for s in ys)
        y1 = max(s["y1"] for s in ys)
        # Vector ink (figures, answer rules) has no text span; a band that ends
        # at the last text baseline clips figure bottoms and writing lines that
        # belong to the question. Extend the band over the connected ink
        # closure: ink touching the band within INK_TOL joins it, repeatedly,
        # so the result does not depend on PDF draw order.
        ink = ink_rects(page)
        changed = True
        while changed:
            changed = False
            for r in ink:
                if r.y1 >= y0 - INK_TOL and r.y0 <= y1 + INK_TOL:
                    ny0, ny1 = min(y0, r.y0), max(y1, r.y1)
                    if ny0 != y0 or ny1 != y1:
                        y0, y1 = ny0, ny1
                        changed = True
        return y0, y1

    def qstart(q):
        # A givens/example box can start a few points above the "(N)" marker;
        # include such ink so the crop does not clip its edge.
        y0 = q["top"]
        for r in ink_rects(doc[q["page"] - 1]):
            if r.y0 < y0 <= r.y1 and y0 - r.y0 <= 10:
                y0 = r.y0
        return y0

    def band_crops(qi):
        q = questions[qi]
        nxt = questions[qi + 1] if qi + 1 < len(questions) else None
        crops = []
        start_page = q["page"]
        end_page = (nxt["page"] if nxt else page_count)
        for pno in range(start_page, end_page + 1):
            page = doc[pno - 1]
            H = page.rect.height
            top, bottom = content_band(pno - 1)
            y0 = qstart(q) if pno == start_page else top
            if nxt and pno == nxt["page"]:
                y1 = qstart(nxt)
            else:
                y1 = bottom
            y0n = max(0.0, min(1.0, y0 / H))
            y1n = max(0.0, min(1.0, y1 / H))
            if y1n - y0n < 0.01:
                continue
            crops.append({"page": pno, "x": 0, "y": round(y0n, 6), "w": 1, "h": round(y1n - y0n, 6)})
        return crops

    exercises = []
    for qi, q in enumerate(questions):
        crops = band_crops(qi)
        if not crops:
            issues.append(f"q{q['q']}: empty crop band")
            continue
        first_page = crops[0]["page"]
        H = doc[first_page - 1].rect.height
        W = doc[first_page - 1].rect.width
        if q["parts"]:
            for p in q["parts"]:
                pin = {"page": p["page"], "x": round(p["x"] / W, 6), "y": round(p["y"] / H, 6)}
                crop = next((c for c in crops if c["page"] == p["page"]), crops[0])
                exercises.append(
                    {
                        "id": f"{prefix}-{level_code}-Q{q['q']:02d}{p['letter']}",
                        "q": q["q"],
                        "part": p["letter"],
                        "pin": pin,
                        "crop": crop,
                        "crops": crops,
                        "context": "",
                        "text": f"שאלה {q['q']}, סעיף {p['letter']}",
                        "prompt": (
                            f"התרגיל שנבחר הוא שאלה {q['q']}, סעיף {p['letter']}, בנושא {topic}. "
                            "יש לקרוא את הנתונים וההוראות מתמונות השאלה המצורפות. "
                            "יש להתייחס לסעיף שנבחר בלבד ולהשתמש בנתונים, בשרטוט ובסעיפים הקודמים של אותה שאלה כאשר הם נדרשים. "
                            "אין להשלים נתון שאינו מופיע או שאינו קריא בתמונה."
                        ),
                        "needsVision": True,
                        "requiresVision": True,
                    }
                )
        else:
            pin = {"page": q["page"], "x": round(q["x"] / W, 6), "y": round(q["top"] / H, 6)}
            exercises.append(
                {
                    "id": f"{prefix}-{level_code}-Q{q['q']:02d}",
                    "q": q["q"],
                    "part": "",
                    "pin": pin,
                    "crop": crops[0],
                    "crops": crops,
                    "context": "",
                    "text": f"שאלה {q['q']}",
                    "prompt": (
                        f"התרגיל שנבחר הוא שאלה {q['q']}, בנושא {topic}. "
                        "יש לקרוא את הנתונים וההוראות מתמונות השאלה המצורפות. "
                        "יש להתייחס לשאלה שנבחרה, או לסעיף שהתלמיד מבקש במפורש ולהשתמש בנתונים, בשרטוט ובסעיפים הקודמים של אותה שאלה כאשר הם נדרשים. "
                        "אין להשלים נתון שאינו מופיע או שאינו קריא בתמונה."
                    ),
                    "needsVision": True,
                    "requiresVision": True,
                }
            )

    exercise_pages = {q["page"] for q in questions}
    manifest = {
        "schemaVersion": 2,
        "pdfHash": media_id,
        "aliases": [],
        "grade": grade,
        "topicId": topic_id,
        "prefix": prefix,
        "topic": topic,
        "level": level,
        "levelCode": level_code,
        "pageCount": page_count,
        "exercisePageCount": len(exercise_pages),
        "questionCount": len(questions),
        "exerciseCount": len(exercises),
        "parserConfidence": 0.99 if not issues else 0.8,
        "reviewRequired": True,
        "mappingValidation": "native item labels and question IDs checked" if native_path and not issues else "incomplete",
        "reviewNote": "Cross-page pin/crop visual review required before approval; parser success alone is not visual confirmation",
        "issues": issues,
        "sourceSha256": hashlib.sha256(open(pdf_path, "rb").read()).hexdigest(),
        "questions": [
            {"q": q["q"], "page": q["page"], "parts": [p["letter"] for p in q["parts"]]}
            for q in questions
        ],
        "exercises": exercises,
    }
    return manifest


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pdf", required=True)
    ap.add_argument("--media-id", required=True)
    ap.add_argument("--grade", type=int, required=True)
    ap.add_argument("--topic-id", type=int, required=True)
    ap.add_argument("--prefix", required=True)
    ap.add_argument("--topic", required=True)
    ap.add_argument("--level", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--native", required=True, help="approved public noam-ai.json for exact per-item matching")
    a = ap.parse_args()
    m = build(a.pdf, a.media_id, a.grade, a.topic_id, a.prefix, a.topic, a.level, a.native)
    with open(a.out, "w") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(
        f"{a.out}: pages={m['pageCount']} questions={m['questionCount']} "
        f"exercises={m['exerciseCount']} reviewRequired={m['reviewRequired']} issues={m['issues']}"
    )


if __name__ == "__main__":
    main()
