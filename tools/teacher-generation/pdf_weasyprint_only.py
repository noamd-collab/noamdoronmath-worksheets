"""WeasyPrint-only PDF build of an elementary sheet (worksheet-wire/5; plan §e5).

The pinned elementary build_pdf.py falls back to headless Chromium when WeasyPrint fails
(`build_with_weasyprint(...) or build_with_chromium(...)`). This trusted wrapper imports only the pinned
`ensure_fonts` and `build_with_weasyprint` by path, after a sha256 check of scripts/build_pdf.py against
skill-lock.json, and never calls the Chromium path:

- WeasyPrint fails (the pinned function returns False) → exit 1, no fallback;
- the PDF exists but its Producer does not start with "WeasyPrint" → exit 1 (PDF_PRODUCER_NOT_WEASYPRINT);
- a skill file that differs from the lock → exit 1 (SKILL_HASH_MISMATCH).

No bytecode is written into the skill folder (sys.dont_write_bytecode is held True while the pinned module runs,
and it is never added to sys.path or sys.modules). Output: one line, "pdf-weasyprint-only: PASS ..." or a code.

CLI: python3 -B pdf_weasyprint_only.py --skill SKILL --html sheet.html --pdf sheet.pdf   → exit 0 PASS / 1 FAIL
Imports: the standard library, and pymupdf for the Producer (lazily).
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import sys
import types

HERE = Path(__file__).resolve().parent
BUILD_PDF = "scripts/build_pdf.py"
PRODUCER_PREFIX = "WeasyPrint"


class WeasyPrintOnlyError(RuntimeError):
    """code ∈ SKILL_HASH_MISMATCH, WEASYPRINT_FAILED, PDF_MISSING, PDF_PRODUCER_NOT_WEASYPRINT."""

    def __init__(self, code: str):
        self.code = code
        super().__init__(code)


def pinned_build_pdf(skill: Path):
    """The pinned elementary build_pdf module, loaded by path after its sha256 check (never cached on disk)."""
    pin = json.loads((HERE / "skill-lock.json").read_text(encoding="utf-8"))["skills"]["elementary"]["files"]
    path = Path(skill) / BUILD_PDF
    if path.is_symlink() or not path.is_file():
        raise WeasyPrintOnlyError("SKILL_HASH_MISMATCH")
    source = path.read_bytes()
    if hashlib.sha256(source).hexdigest() != pin.get(BUILD_PDF):
        raise WeasyPrintOnlyError("SKILL_HASH_MISMATCH")
    module = types.ModuleType("_v5_pinned_elementary_build_pdf")
    module.__file__ = str(path)
    code = compile(source, str(path), "exec", dont_inherit=True)
    previous = sys.dont_write_bytecode
    sys.dont_write_bytecode = True
    try:
        exec(code, module.__dict__)
    finally:
        sys.dont_write_bytecode = previous
    return module


def producer(pdf: Path) -> str:
    import pymupdf
    with pymupdf.open(str(pdf)) as document:
        return str((document.metadata or {}).get("producer") or "")


def build(skill, html, pdf) -> str:
    """Build `pdf` from `html` with the pinned WeasyPrint path only; returns the PDF Producer. Raises
    WeasyPrintOnlyError. A PDF left by a failed run is removed so no non-WeasyPrint file can pass on."""
    module = pinned_build_pdf(Path(skill))
    html, pdf = Path(html), Path(pdf)
    if not html.is_file():
        raise WeasyPrintOnlyError("PDF_MISSING")
    if pdf.exists():
        pdf.unlink()
    module.ensure_fonts(html)
    if module.build_with_weasyprint(html, pdf) is not True:
        if pdf.exists():
            pdf.unlink()
        raise WeasyPrintOnlyError("WEASYPRINT_FAILED")
    if not pdf.is_file():
        raise WeasyPrintOnlyError("PDF_MISSING")
    made_by = producer(pdf)
    if not made_by.startswith(PRODUCER_PREFIX):
        pdf.unlink()
        raise WeasyPrintOnlyError("PDF_PRODUCER_NOT_WEASYPRINT")
    return made_by


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description="WeasyPrint-only PDF build of an elementary worksheet-wire/5 sheet.")
    parser.add_argument("--skill", required=True)
    parser.add_argument("--html", required=True)
    parser.add_argument("--pdf", required=True)
    args = parser.parse_args(argv)
    try:
        made_by = build(args.skill, args.html, args.pdf)
    except WeasyPrintOnlyError as error:
        print("pdf-weasyprint-only: FAIL " + error.code)
        return 1
    print("pdf-weasyprint-only: PASS producer=%s bytes=%d" % (made_by, Path(args.pdf).stat().st_size))
    return 0


if __name__ == "__main__":
    sys.dont_write_bytecode = True
    sys.exit(main())
