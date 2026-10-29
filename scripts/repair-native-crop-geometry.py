#!/usr/bin/env python3
"""Replace only native manifest geometry measured from the exact published PDF.

Usage: python3 scripts/repair-native-crop-geometry.py --pdf SOURCE.pdf \
  --manifest noam-ai/manifests/PDF_ID.json [--write]

The existing PDF builder must match every native question/part without issues.
Question text, source identity, native bindings and vision requirements are kept.
No request is made to an AI service, and no source PDF or SVG is modified.
"""
import argparse
import copy
import hashlib
import importlib.util
import json
from pathlib import Path


def geometry_only(current, measured):
    for field in ("pdfHash", "sourceSha256", "prefix", "level", "pageCount",
                  "questionCount", "exerciseCount"):
        if current.get(field) != measured.get(field):
            raise ValueError(f"source/mapping mismatch: {field}")
    if measured.get("issues") or measured.get("mappingValidation") != "native item labels and question IDs checked":
        raise ValueError("PDF/native mapping is not complete")
    old = current.get("exercises", [])
    new = measured.get("exercises", [])
    def keyed(rows):
        result = {(str(e.get("q")), e.get("part", "")): e for e in rows}
        if len(result) != len(rows):
            raise ValueError("duplicate question/part")
        return result
    old_keys, new_keys = keyed(old), keyed(new)
    if not old_keys or old_keys.keys() != new_keys.keys():
        raise ValueError("question/part set changed")
    result = copy.deepcopy(current)
    for exercise in result["exercises"]:
        target = new_keys[(str(exercise["q"]), exercise.get("part", ""))]
        if target["id"] != exercise["id"]:
            raise ValueError("exercise identity changed")
        for field in ("pin", "crop", "crops"):
            exercise[field] = copy.deepcopy(target[field])
        crops = exercise["crops"]
        if not crops or any(not (1 <= c["page"] <= current["pageCount"] and
            0 <= c["x"] < 1 and 0 <= c["y"] < 1 and c["w"] > 0 and c["h"] > 0 and
            c["x"] + c["w"] <= 1.000001 and c["y"] + c["h"] <= 1.000001) for c in crops):
            raise ValueError("invalid measured crop")
        pin = exercise["pin"]
        if not any(c["page"] == pin["page"] and c["y"] - .001 <= pin["y"] <= c["y"] + c["h"] + .001 for c in crops):
            raise ValueError("measured pin is outside its question")
    # The page list is also measured, but its question/part identities cannot change.
    if [(q["q"], q["parts"]) for q in current["questions"]] != [(q["q"], q["parts"]) for q in measured["questions"]]:
        raise ValueError("question list changed")
    result["questions"] = copy.deepcopy(measured["questions"])
    result["exercisePageCount"] = measured["exercisePageCount"]
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--write", action="store_true")
    args = parser.parse_args()
    root = Path(__file__).resolve().parents[1]
    path = args.manifest.resolve()
    if path.parent != root / "noam-ai/manifests":
        raise ValueError("use the root canonical manifest path")
    current = json.loads(path.read_text())
    if hashlib.sha256(args.pdf.read_bytes()).hexdigest() != current.get("sourceSha256"):
        raise ValueError("PDF bytes differ from approved sourceSha256")
    native_url = current.get("nativeExportUrl", "")
    if not native_url.startswith("/noam-ai/native/") or ".." in native_url or not native_url.endswith("/noam-ai.json"):
        raise ValueError("missing trusted native export")
    native_path = root / "headless/astro-poc/public" / native_url.lstrip("/")
    if hashlib.sha256(native_path.read_bytes()).hexdigest() != current.get("nativeExportSha256"):
        raise ValueError("native export bytes differ from approved hash")
    spec = importlib.util.spec_from_file_location("native_pdf_builder", root / "scripts/build-student-manifest.py")
    builder = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(builder)
    measured = builder.build(str(args.pdf), current["pdfHash"], current["grade"],
        current["topicId"], current["prefix"], current["topic"], current["level"],
        str(native_path), current.get("nativeLevel"))
    repaired = geometry_only(current, measured)
    changed = sum(any(a.get(k) != b.get(k) for k in ("pin", "crop", "crops"))
                  for a, b in zip(current["exercises"], repaired["exercises"]))
    if args.write and repaired != current:
        mirror = root / "headless/astro-poc/public/noam-ai/manifests" / path.name
        if mirror.read_bytes() != path.read_bytes():
            raise ValueError("root/public manifest already differs")
        text = json.dumps(repaired, ensure_ascii=False, indent=2) + "\n"
        path.write_text(text)
        mirror.write_text(text)
    print(json.dumps({"pdfId": current["pdfHash"], "changedExercises": changed,
        "questions": measured["questionCount"], "parts": measured["exerciseCount"],
        "issues": measured["issues"], "written": args.write and repaired != current}))


if __name__ == "__main__":
    main()
