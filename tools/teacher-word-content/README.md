# Editable teacher worksheets

`node headless/astro-poc/scripts/build-teacher-word-bank.mjs` reproducibly builds the compressed server bank. `--check` is part of prebuild. The browser receives only requested, source-bound questions and their complete public final answers. It creates standard DOCX with RTL paragraphs and native Office Math; original illustrations remain images. No private teacher keys, OCR guesses or full-question screenshots enter the Word bank.

`sources/*.json` contains public question text from matching native exports and public final answers. `source-proof.json` pins the native export, public FINAL source and printed answer PDF. The importer checked question structure and exact figure hashes before extraction. There are 404 complete middle-school source PDFs, 8,016 questions. The ten reviewed elementary repairs are separate in `teacher-word-approved-g6.json`; together the bank contains 8,026 questions from 411 source IDs.

Other elementary questions and eight unmatched middle-school source PDFs are not yet editable. An unsupported or stale selection returns a visible error with no partial file. Textual references to an unselected prerequisite require the teacher to select it explicitly; the export renumbers included references. This is not full-site Word coverage.

Validation: native OMML/RTL/selection/completeness tests, all 8,026 question and answer formula conversions, original figure digests, ordinary download UI and print metadata in desktop/mobile Brave, and rendered DOCX pages. Full test suite and live verification are recorded in the release report. Native Microsoft Word UI validation is currently unavailable (macOS automation timed out); bundled LibreOffice was used to render the actual DOCX files.
