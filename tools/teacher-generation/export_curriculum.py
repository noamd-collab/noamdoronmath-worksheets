#!/usr/bin/env python3
"""Export the pinned skills' planning catalog, not a calendar or renderer capability list."""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path


PINNED = {
    "elementary": {
        "skillVersion": "1.0.5-noam",
        "files": {
            "SKILL.md": "27da1f050c6009dcb240cfd29878023904e43cc30703f9038d2113256299affa",
            "curriculum_elementary.json": "817c6085f0d787716f74f9bd1eaa33cd924f308fbeff743aa9b02eaa676cea4f",
            "curriculum_tools_elementary.json": "55cd407b146b581cf5d85b6e046d6699157b54b1054f8a68b0b07d9f26478c76",
        },
    },
    "middle": {
        "skillVersion": "7.2.0-noam",
        "files": {
            "SKILL.md": "507f51b7ed2a5fcdd38dcdf20f642d9f37e471a7829d56cdc3f3b563422401b2",
            "curriculum_tashpaz.json": "d47b11b10caac8639c1f91192dd53ee0a1b936b7652496814d7d9752cfe2afea",
            "curriculum_tools.json": "1c4d029aec2eeb197073eb5a686be988c72b8ac9578583308d8629f8fb6951af",
        },
    },
}
TRACKS = [("g7", "ז", 7), ("g8", "ח", 8), ("g9r", "ט_רגילה", 9), ("g9m", "ט_מצומצמת", 9)]


def read_pinned(folder: Path, kind: str) -> dict:
    data = {}
    for name, expected in PINNED[kind]["files"].items():
        raw = (folder / name).read_bytes()
        if hashlib.sha256(raw).hexdigest() != expected:
            raise ValueError(f"Pinned {kind} input changed: {name}; review the skill version before re-exporting")
        if name.endswith(".json"):
            data[name] = json.loads(raw)
    return data


def project(elementary_folder: Path, middle_folder: Path) -> dict:
    elementary = read_pinned(elementary_folder, "elementary")
    middle = read_pinned(middle_folder, "middle")
    ec = elementary["curriculum_elementary.json"]
    mc = middle["curriculum_tashpaz.json"]
    mt = middle["curriculum_tools.json"]
    rows = []
    for topic in ec["topics"]:
        rows.append([topic["topic_id"], topic["order"], topic["title"], topic["domain"],
                     topic["allowed_concepts"], topic["forbidden_before_here"]])
    for prefix, track, grade in TRACKS:
        sequence = mt["sequences"][track]
        for topic in mc["tracks"][track]["topics"]:
            positions = [i + 1 for i, entry in enumerate(sequence)
                         if entry["track"] == track and entry["grade"] == str(grade)
                         and entry["topic"] == topic["id"]]
            if len(positions) != 1:
                raise ValueError(f"No unique chronology position for {track}:{topic['id']}")
            terms = list(topic.get("details", topic.get("keywords", [])))
            for tool in mt["tools"]:
                if any(unit["track"] == track and unit["topic"] == topic["id"] for unit in tool.get("units", [])):
                    terms.extend([tool["name_he"], *tool.get("keywords", [])])
            rows.append([prefix + ":" + topic["id"], positions[0], topic["name"], topic["domain"],
                         list(dict.fromkeys(terms)), []])
    if len(ec["topics"]) != 160 or len({row[0] for row in rows}) != len(rows):
        raise ValueError("Unexpected elementary count or duplicate scoped topic id")
    rows.sort(key=lambda row: ("אבגדהו".find(row[0][0]) if row[0][0] in "אבגדהו" else
                               {"g7": 6, "g8": 7, "g9r": 8, "g9m": 9}[row[0].split(":")[0]], row[1]))
    return {
        "version": 1,
        "officialCalendarVerified": False,
        "provenanceNote": "רצף נושאים מתוך הסקילים שננעלו; אינו אימות של פריסה רשמית לפי חודשים או שעות.",
        "sources": {
            "elementary": {**PINNED["elementary"], "curriculumVersion": ec["version"],
                           "basis": "כשרים והקשרים ומרשם הסקיל; אין במרשם חלוקה לחודשים."},
            "middle": {**PINNED["middle"], "curriculumVersion": mc["subtopics"]["meta"]["version"],
                       "basis": mc["meta"]["provenance_audit_20261108"]["finding"],
                       "sourceStatus": "needs_official_verification"},
        },
        "tracks": {prefix: {"sourceTrack": track, "gradeNumber": grade,
                            "label": mc["tracks"][track]["label"]} for prefix, track, grade in TRACKS},
        # Tuple columns keep the deployed worker small; the TypeScript API exposes named fields.
        "topicColumns": ["topicId", "order", "title", "domain", "allowedConcepts", "notYetConcepts"],
        "topics": rows,
        "elementaryForbiddenAll": ec["forbidden_in_all_elementary"],
        "elementaryForbiddenByGrade": ec["forbidden_by_grade"],
        "middleExcludedByTrack": {
            prefix: list(dict.fromkeys(keyword for rule in mt["excluded"].get(track, [])
                                      for keyword in rule.get("keywords", [])))
            for prefix, track, _ in TRACKS
        },
    }


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--elementary-skill", type=Path, default=Path.home() / ".codex/skills/hebrew-math-worksheet-elementary")
    ap.add_argument("--middle-skill", type=Path, default=Path.home() / ".codex/skills/hebrew-math-worksheet")
    ap.add_argument("--output", type=Path, default=root / "headless/astro-poc/public/teachers/generation-curriculum.json")
    ap.add_argument("--check", action="store_true", help="Compare the committed projection; do not write")
    args = ap.parse_args()
    try:
        result = project(args.elementary_skill, args.middle_skill)
        encoded = json.dumps(result, ensure_ascii=False, separators=(",", ":")) + "\n"
        if args.check:
            if args.output.read_text(encoding="utf-8") != encoded:
                raise ValueError("Curriculum projection differs from pinned skill inputs")
        else:
            args.output.parent.mkdir(parents=True, exist_ok=True)
            args.output.write_text(encoded, encoding="utf-8")
    except (OSError, ValueError, KeyError) as exc:
        ap.exit(1, str(exc) + "\n")
    print(f"{'Verified' if args.check else 'Exported'} {len(result['topics'])} topics; {len(encoded.encode('utf-8'))} bytes; no official-calendar claim")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
