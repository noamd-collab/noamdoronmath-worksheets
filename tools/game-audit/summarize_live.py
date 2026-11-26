#!/usr/bin/env python3
"""Build the audit table for games that are already live.

    python3 summarize_live.py --tools ~/work/tools <slug> [<slug> ...]

Reads what live_audit.sh produced: shots-live/<slug>/summary.json,
audit-live/<slug>.json and verify-live/<slug>.{shots,drag1,drag3,drag5}.txt.
Prints a Markdown table plus a JSON list of every slug with a non-zero finding.
Exit status is 1 when any game has a finding, so it can gate a fix.
"""
import argparse
import json
import pathlib
import re
import sys

ap = argparse.ArgumentParser()
ap.add_argument("--tools", required=True, type=pathlib.Path)
ap.add_argument("--shots-root", default="shots-live")
ap.add_argument("slugs", nargs="+")
a = ap.parse_args()
T = a.tools

rows = []
for s in a.slugs:
    shots = json.load(open(T / a.shots_root / s / "summary.json", encoding="utf-8"))
    audit = json.load(open(T / "audit-live" / f"{s}.json", encoding="utf-8"))
    errs, overflow, small, svgout, steps, kb = [], 0, 0, 0, 0, []
    for vp, v in shots["viewports"].items():
        errs += [f"{vp}: {e}" for e in v.get("errors") or []]
        for r in v.get("steps") or []:
            if "step" not in r:
                continue
            steps += 1
            overflow += r.get("overflowX") or 0
            small += len(r.get("smallTargets") or [])
            svgout += len(r.get("svgTextOutside") or [])
            if r.get("mode") == "scene" and (r.get("keyboardHandles") or 0) < 1:
                kb.append(f"{vp}-{r['step']}")
    aprops = 0
    for key, page in audit["pages"].items():
        errs += [f"{key}: {e}" for e in page.get("errors") or []]
        for st in page.get("states") or []:
            aprops += len(st.get("problems") or [])
    shots_txt = T / "verify-live" / f"{s}.shots.txt"
    flow = re.findall(r"total (\d+)", shots_txt.read_text(encoding="utf-8")) if shots_txt.exists() else []
    drags = []
    for st in (1, 3, 5):
        p = T / "verify-live" / f"{s}.drag{st}.txt"
        drags.append("OK" if p.exists() and "OK" in p.read_text(encoding="utf-8").splitlines()[-1] else "FAIL")
    rows.append(dict(slug=s, steps=steps, errors=len(errs), auditProblems=aprops, overflow=overflow,
                     small=small, svgout=svgout, noKeyboard=kb, flow=sorted(set(flow)), drag=drags))

print("| game | steps | console errors | audit problems | overflow | small targets | svg text out | scenes without keyboard | zero-pointer flow | drag |")
print("|---|---|---|---|---|---|---|---|---|---|")
for r in rows:
    print(f"| {r['slug']} | {r['steps']} | {r['errors']} | {r['auditProblems']} | {r['overflow']} | "
          f"{r['small']} | {r['svgout']} | {len(r['noKeyboard'])} | {','.join(r['flow']) or '-'} | "
          f"{'/'.join(r['drag'])} |")
issues = [r for r in rows if r["errors"] or r["auditProblems"] or r["overflow"] or r["small"]
          or r["svgout"] or r["noKeyboard"] or any(x != "OK" for x in r["drag"])]
print("\nissues:", json.dumps(issues, ensure_ascii=False, indent=1) if issues else "none")
sys.exit(1 if issues else 0)
