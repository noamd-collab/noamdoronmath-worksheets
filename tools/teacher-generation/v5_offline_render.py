"""Offline end-to-end render of one worksheet-wire/5 sheet (V5-DESIGN §6.4). No network, no model call.

compile_sheet → validate_source (explicit) → runner.render_job (real WeasyPrint, pinned middle skill, atom_order
inside) → PNG of every PDF page. The build runs in a space-free work dir; only the deliverables are copied to
--out. Nothing outside the work dir and --out is written.

    python3 -B v5_offline_render.py --lesson L --reply R [--repair ROUND.json]... --out DIR [--work DIR] [--dpi N]

Exit 0 = every executed check PASS (notRun listed), 1 = render or gate failure, 2 = compile/selection failure.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import shutil
import sys

HERE = Path(__file__).resolve().parent
if str(HERE) not in sys.path:
    sys.path.insert(0, str(HERE))

COPIES = (("manifest.json", "manifest.json"), ("out/v72-report.json", "v72-report.json"),
          ("logs/atom-order.json", "atom-order.json"))


def _dump(path, data):
    Path(path).write_text(json.dumps(data, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")


def run(lesson_path, reply_path, out_dir, *, repairs=(), work_dir=None, skill_path=None, dpi=150) -> dict:
    """compile_reply → validate_source (explicit) → runner.render_job (real WeasyPrint, pinned middle) → atom_order (inside
    render_job) → PNG of every PDF page. Renders in a space-free work dir, then copies deliverables to out_dir."""
    from general_source import validate_source
    from runtime_catalog import scope_for_lesson
    from structured_source import V5Error, compile_sheet
    from validation import read_json, validate_lesson
    import runner

    lesson = read_json(lesson_path)
    reply = read_json(reply_path)
    rounds = [read_json(path) for path in repairs]
    validate_lesson(lesson)
    scope = scope_for_lesson(lesson)
    skill_path = skill_path or os.environ.get("MIDDLE_SKILL_PATH", "")
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    try:
        result = compile_sheet(lesson, scope, reply, skill_path=skill_path, repairs=rounds)
    except V5Error as error:
        _dump(out / "compile-diagnostics.json", error.diagnostics)
        summary = {"status": "compile_failed", "code": error.code}
        _dump(out / "summary.json", summary)
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
    if pdf.is_file():
        import pymupdf
        shutil.copyfile(pdf, out / "sheet.pdf")
        (out / "pages").mkdir(exist_ok=True)
        with pymupdf.open(str(pdf)) as document:
            for number, page in enumerate(document, 1):
                page.get_pixmap(dpi=dpi).save(str(out / "pages" / ("page-%02d.png" % number)))
                pages = number
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
    return summary


def main(argv=None) -> int:
    """CLI. Exit 0 = every executed check PASS (notRun listed), 1 = render or gate failure, 2 = compile/selection failure."""
    parser = argparse.ArgumentParser(description="Offline worksheet-wire/5 render (no network, no model call).")
    parser.add_argument("--lesson", required=True)
    parser.add_argument("--reply", required=True)
    parser.add_argument("--repair", action="append", default=[])
    parser.add_argument("--out", required=True)
    parser.add_argument("--work")
    parser.add_argument("--skill")
    parser.add_argument("--dpi", type=int, default=150)
    args = parser.parse_args(argv)
    sys.dont_write_bytecode = True
    summary = run(args.lesson, args.reply, args.out, repairs=args.repair, work_dir=args.work,
                  skill_path=args.skill, dpi=args.dpi)
    print(json.dumps(summary, ensure_ascii=False))
    if summary["status"] == "compile_failed":
        return 2
    return 0 if summary["status"] == "needs_review" else 1


if __name__ == "__main__":
    sys.exit(main())
