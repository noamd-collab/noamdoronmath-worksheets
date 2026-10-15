#!/usr/bin/env python3
"""Replay a crop-curation record against a built student manifest.

The record (scripts/curation/<PACKAGE>-*.json) is bound to the manifest by
media id and to the source PDF by sha256; both are verified before any edit.
Only the listed page slices are trimmed (or dropped when the trim empties
them); exercise IDs, pins and every other field stay byte-identical.

  python3 scripts/apply-crop-curation.py --manifest noam-ai/manifests/<id>.json \
    --curation scripts/curation/G9-T17-section-header-trims.json --level a
"""
import argparse
import json


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", required=True)
    ap.add_argument("--curation", required=True)
    ap.add_argument("--level", required=True)
    a = ap.parse_args()

    cur = json.load(open(a.curation))
    bound = cur["levels"][a.level]
    m = json.load(open(a.manifest))
    if m["pdfHash"] != bound["mediaId"]:
        raise SystemExit(f"media id mismatch: manifest {m['pdfHash']} != record {bound['mediaId']}")
    if m["sourceSha256"] != bound["sourceSha256"]:
        raise SystemExit("source sha256 mismatch; refusing to apply curation to other bytes")

    trims = [t for t in cur["trims"] if t["level"] == a.level]
    applied = []
    for t in trims:
        for e in m["exercises"]:
            if e["q"] != t["question"]:
                continue
            idx = next((i for i, c in enumerate(e["crops"]) if c["page"] == t["page"]), None)
            if idx is None:
                raise SystemExit(f"no crop on page {t['page']} for {e['id']}")
            c = e["crops"][idx]
            old_bottom = round(c["y"] + c["h"], 6)
            if abs(old_bottom - t["expectedOldBottom"]) > 1e-4:
                raise SystemExit(
                    f"{e['id']} page {t['page']}: bottom {old_bottom} != expected {t['expectedOldBottom']}"
                )
            new_h = round(t["trimBottomY"] - c["y"], 6)
            if new_h < 0.01:
                # Slice held only the foreign header; drop it and re-home the
                # primary crop if it pointed here.
                del e["crops"][idx]
                if not e["crops"]:
                    raise SystemExit(f"{e['id']} would have no crops left")
                if e["crop"]["page"] == t["page"]:
                    e["crop"] = e["crops"][0]
                applied.append(f"{e['id']}: dropped empty page-{t['page']} slice")
            else:
                c["h"] = new_h
                if e["crop"] is c or e["crop"]["page"] == t["page"]:
                    e["crop"] = dict(c)
                applied.append(f"{e['id']}: page {t['page']} bottom {old_bottom} -> {t['trimBottomY']}")

    with open(a.manifest, "w") as f:
        json.dump(m, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"{a.manifest}: applied {len(applied)} trims")
    for line in dict.fromkeys(applied):
        print(" ", line)


if __name__ == "__main__":
    main()
