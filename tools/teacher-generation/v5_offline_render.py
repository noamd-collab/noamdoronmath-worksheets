"""Offline end-to-end render of one worksheet-wire/5 sheet (V5-DESIGN §6.4). No network, no model call.

compile_sheet → validate_source (explicit) → runner.render_job (real WeasyPrint, pinned middle skill, atom_order
inside) → PNG of every PDF page. The build runs in a space-free work dir; only the deliverables are copied to
--out. Nothing outside the work dir and --out is written.

    python3 -B v5_offline_render.py --lesson L --reply R [--repair ROUND.json]... --out DIR [--case NAME]
                                    [--work DIR] [--dpi N]

Without --case the deliverables use the §6.4 layout in DIR (pages/page-NN.png). With --case NAME they go to
DIR/NAME/: sheet.pdf, page-<n>.png per PDF page (n from 1), the same JSON files, and report.json (per-step
status, the atom-order result, the selection record, refusals, the printed keys and the PDF Producer).

Exit 0 = every executed check PASS (notRun listed), 1 = render or gate failure, 2 = compile/selection failure.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

COPIES = (("manifest.json", "manifest.json"), ("out/v72-report.json", "v72-report.json"),
          ("logs/atom-order.json", "atom-order.json"))
CASE_RE = re.compile(r"[A-Za-z0-9][A-Za-z0-9_.-]{0,63}")
STATUSES = ("PASS", "FAIL", "REVIEW", "SKIP")


def _dump(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def _read(path):
    path = Path(path)
    return json.loads(path.read_text(encoding="utf-8")) if path.is_file() else None


def _pdf_facts(pdf) -> dict:
    """sha256, size, page count and the Producer/Creator metadata of one PDF (PyMuPDF)."""
    import pymupdf
    data = Path(pdf).read_bytes()
    with pymupdf.open(str(pdf)) as document:
        metadata = document.metadata or {}
        pages = document.page_count
    return {"file": Path(pdf).name, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data), "pages": pages,
            "producer": metadata.get("producer") or "", "creator": metadata.get("creator") or ""}


def _printed_keys(levels, selection) -> list:
    """What the sheet prints, per question in printed order: slot and origin from the selection record, the
    instruction, each item's label, prompt and answer island exactly as levels.json holds them."""
    level = levels[0] if isinstance(levels, list) and levels else {}
    rows = {row["n"]: row for row in (selection or {}).get("questions") or ()}
    out = []
    for question in level.get("questions") or ():
        row = rows.get(question.get("n"), {})
        out.append({"n": question.get("n"), "slot": row.get("slot"), "origin": row.get("origin"),
                    "star": question.get("star"), "instruction": question.get("intro"),
                    "items": [{"label": item.get("label"), "prompt": item.get("text"), "key": item.get("answer")}
                              for item in question.get("items") or ()]})
    return out


def _report(case, lesson_path, reply_path, repairs, *, status, exit_code, result=None, error=None, manifest=None,
            work=None, pdf_facts=None, pages=(), dpi=150) -> dict:
    """report.json of one --case render (codes, statuses and printed math only; no model text beyond the sheet)."""
    report = {"case": case, "lesson": Path(lesson_path).name, "reply": Path(reply_path).name,
              "repairs": [Path(path).name for path in repairs], "status": status, "exitCode": exit_code}
    if error is not None:
        report.update({"code": error.code, "refusals": error.diagnostics.get("refusals", []),
                       "missing": error.diagnostics.get("missing", []), "diagnostics": error.diagnostics})
        return report
    steps = [{"name": step["name"], "status": step["status"]} for step in (manifest or {}).get("steps") or ()]
    counts = {name: sum(1 for step in steps if step["status"] == name) for name in STATUSES}
    counts["OTHER"] = sum(1 for step in steps if step["status"] not in STATUSES)
    atom = _read(work / "logs/atom-order.json") if work is not None else None
    levels = _read(work / "levels.json") if work is not None else None
    report.update({
        "executedChecksPassed": (manifest or {}).get("executedChecksPassed"),
        "automatedChecksPassed": (manifest or {}).get("automatedChecksPassed"),
        "notRun": (manifest or {}).get("notRun"),
        "stepCounts": counts,
        "steps": steps,
        "atomOrder": atom,
        "selection": result.ir["selection"],
        "refusals": result.diagnostics["refusals"],
        "trimmed": result.diagnostics["trimmed"],
        "repairRounds": result.diagnostics["repairRounds"],
        "keys": _printed_keys(levels, result.ir["selection"]),
        "pdf": pdf_facts,
        "pdfProducer": (pdf_facts or {}).get("producer"),
        "pages": list(pages),
        "dpi": dpi,
        "skill": (manifest or {}).get("skill"),
    })
    return report


def run(lesson_path, reply_path, out_dir, *, repairs=(), work_dir=None, skill_path=None, dpi=150, case=None) -> dict:
    """compile_reply → validate_source (explicit) → runner.render_job (real WeasyPrint, pinned middle) → atom_order (inside
    render_job) → PNG of every PDF page. Renders in a space-free work dir, then copies deliverables to out_dir.

    With ``case`` the deliverables go to out_dir/case/ (page-<n>.png next to sheet.pdf, plus report.json)."""
    from general_source import validate_source
    from runtime_catalog import scope_for_lesson
    from structured_source import V5Error, compile_sheet
    from validation import read_json, validate_lesson
    import runner

    if case is not None and (type(case) is not str or not CASE_RE.fullmatch(case)):
        raise ValueError("A case name is one plain file name (letters, digits, '_', '.', '-')")
    lesson = read_json(lesson_path)
    reply = read_json(reply_path)
    rounds = [read_json(path) for path in repairs]
    validate_lesson(lesson)
    scope = scope_for_lesson(lesson)
    skill_path = skill_path or os.environ.get("MIDDLE_SKILL_PATH", "")
    out = Path(out_dir) if case is None else Path(out_dir) / case
    out.mkdir(parents=True, exist_ok=True)
    try:
        result = compile_sheet(lesson, scope, reply, skill_path=skill_path, repairs=rounds)
    except V5Error as error:
        _dump(out / "compile-diagnostics.json", error.diagnostics)
        summary = {"status": "compile_failed", "code": error.code}
        _dump(out / "summary.json", summary)
        if case is not None:
            _dump(out / "report.json", _report(case, lesson_path, reply_path, repairs, status="compile_failed",
                                               exit_code=2, error=error, dpi=dpi))
        return summary
    validate_source(lesson, result.ir, scope)
    _dump(out / "ir.json", result.ir)
    _dump(out / "compile-diagnostics.json", result.diagnostics)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    work = Path(work_dir) if work_dir else Path(os.environ.get("TMPDIR", "/tmp")) / ("v5-work-" + stamp)
    if " " in str(work.resolve()):
        raise ValueError("The work dir must not contain spaces")
    manifest = runner.render_job(lesson, result.ir, work, skill_paths={"middle": skill_path})
    key = {"a": "a", "b": "b", "e": "c"}[lesson["level"]]
    pdf = work / ("out/deliver/%s/sheet.pdf" % key)
    pages = 0
    page_files = []
    pdf_facts = None
    if pdf.is_file():
        import pymupdf
        shutil.copyfile(pdf, out / "sheet.pdf")
        pages_dir = out if case is not None else out / "pages"
        pages_dir.mkdir(exist_ok=True)
        with pymupdf.open(str(pdf)) as document:
            for number, page in enumerate(document, 1):
                name = ("page-%d.png" % number) if case is not None else ("page-%02d.png" % number)
                page.get_pixmap(dpi=dpi).save(str(pages_dir / name))
                page_files.append(name)
                pages = number
        pdf_facts = _pdf_facts(out / "sheet.pdf")
    for source, target in COPIES:
        if (work / source).is_file():
            shutil.copyfile(work / source, out / target)
    atom = json.loads((work / "logs/atom-order.json").read_text(encoding="utf-8")) if (
        work / "logs/atom-order.json").is_file() else {}
    selection = result.ir["selection"]
    summary = {"status": manifest["status"], "requested": selection["requested"], "delivered": selection["delivered"],
               "replaced": selection["replaced"], "notRun": manifest.get("notRun"), "pages": pages,
               "producer": atom.get("producer"), "workDir": str(work),
               "failedSteps": [step["name"] for step in manifest["steps"] if step["status"] not in ("PASS", "SKIP")]}
    _dump(out / "summary.json", summary)
    if case is not None:
        _dump(out / "report.json", _report(case, lesson_path, reply_path, repairs, status=manifest["status"],
                                           exit_code=0 if manifest["status"] == "needs_review" else 1,
                                           result=result, manifest=manifest, work=work, pdf_facts=pdf_facts,
                                           pages=page_files, dpi=dpi))
    return summary


def main(argv=None) -> int:
    """CLI. Exit 0 = every executed check PASS (notRun listed), 1 = render or gate failure, 2 = compile/selection failure."""
    parser = argparse.ArgumentParser(description="Offline worksheet-wire/5 render (no network, no model call).")
    parser.add_argument("--lesson", required=True)
    parser.add_argument("--reply", required=True)
    parser.add_argument("--repair", action="append", default=[])
    parser.add_argument("--out", required=True)
    parser.add_argument("--case")
    parser.add_argument("--work")
    parser.add_argument("--skill")
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args(argv)
    sys.dont_write_bytecode = True
    summary = run(args.lesson, args.reply, args.out, repairs=args.repair, work_dir=args.work,
                  skill_path=args.skill, dpi=args.dpi, case=args.case)
    print(json.dumps(summary, ensure_ascii=False))
    if summary["status"] == "compile_failed":
        return 2
    return 0 if summary["status"] == "needs_review" else 1


if __name__ == "__main__":
    sys.exit(main())
