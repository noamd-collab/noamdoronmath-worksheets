"""Measure again what the pinned elementary gate G51 reports, with the bracket order itself.

house_gates.py g51_bidi_order (pinned, :64) reads every PDF line in visual
order and fails on ')…(' around digits or Latin letters, as the mark of a
bracket pair printed in reverse: ')2('. A product of two bracketed groups,
'(12 : 4) x (6 − 2)', also contains ') x (' when it is printed correctly, and
Latin x is the multiplication sign the same skill requires in grades 3-6
(G54). So the gate fails every sheet that prints such a product.

This script repeats the pinned measurement on the same lines and adds the
one fact that tells the two cases apart: in a reversed pair the closing
bracket has no opening bracket to its left on its line. It reconciles only
when, for every sample, that opening bracket exists, the group it opens holds
arithmetic only, and only numbers and signs stand between the two groups.
Anything else keeps the gate's failure. Like didactic_review.py, it changes
no output and never turns a real finding into a pass.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import re

# The pinned gate's own sample and filters (house_gates.py:88-93).
SAMPLE = re.compile(r"\)([^()]{0,10})\(")
HEBREW = re.compile(r"[\u0590-\u05FF]")
# What the engine prints between two bracketed groups: numbers and signs.
BETWEEN_GROUPS = re.compile(r"[0-9x+\-−:.,\s]{1,10}")
# What the engine prints inside a bracketed group, nested groups included.
GROUP = re.compile(r"[0-9x+\-−:.,\s()]{1,60}")


def measure_line(visual):
    """(samples the gate reports on this line, samples that stay failures)."""
    samples = failures = 0
    for match in SAMPLE.finditer(visual):
        inner = match.group(1)
        if HEBREW.search(inner) or not any(c.isdigit() or c.isalpha() for c in inner):
            continue
        samples += 1
        # The opening bracket of the group that this closing bracket ends.
        depth, opening = 0, None
        for index in range(match.start() - 1, -1, -1):
            depth += (visual[index] == ")") - (visual[index] == "(")
            if depth < 0:
                opening = index
                break
        group = "" if opening is None else visual[opening + 1:match.start()]
        if opening is None or not GROUP.fullmatch(group) or not BETWEEN_GROUPS.fullmatch(inner):
            failures += 1
    return samples, failures


def measure(pdf):
    import pymupdf
    samples = failures = 0
    pages = []
    with pymupdf.open(str(pdf)) as document:
        for number, page in enumerate(document, 1):
            for block in page.get_text("rawdict")["blocks"]:
                for line in block.get("lines", []):
                    chars = [(c["bbox"][0], c["c"]) for span in line["spans"] for c in span["chars"]]
                    found, failed = measure_line("".join(c for _, c in sorted(chars)))
                    samples += found; failures += failed
                    if found and number not in pages:
                        pages.append(number)
    status = "NO_SAMPLE" if not samples else "UNBALANCED" if failures else "RECONCILED"
    return {"status": status, "code": "G51", "matches": samples, "unbalanced": failures, "pages": pages[:50]}


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--json", type=Path, required=True)
    args = parser.parse_args()
    result = measure(args.pdf)
    args.json.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({key: result[key] for key in ("status", "matches", "unbalanced")}))
    raise SystemExit(0 if result["status"] == "RECONCILED" else 1)
