# Teacher selection marks — 2026-10-20

Reported case: grade 8, topic 44, excellence, PDF `0d2c19b340234a8db8c0bc9d080b50d1`, questions 1–2. Fixed-size orange rectangles covered the start of the Hebrew sentence and overlapped adjacent parts.

Selected parts now have a small teal check outside the right edge of the existing label/text box. The same vector path is shown in the preview and baked into the print canvas; print CSS hides the duplicate DOM marker. No PDF content, question selection, source metadata, cropping, or AI behavior changes. The demo printer stays identical to the served printer.

Validation:
- 29 tests pass across teacher-selection-markers, teacher-marked-print and teacher-print-pack.
- All 30,728 catalog boxes yield bounded markers outside the stored text rectangle. This checks geometry against metadata, not every page's rendered ink.
- The reported page was tested through the real local picker. Desktop and 390×844 phone captures inspected. Browser print produced 2 pages with 9 and 1 selected marks, respectively. Raster connected-component inspection independently confirmed all 10 printed checkmarks on the right side; no orange fills/frames remain.
- `npm run build` and `npm run preview` succeeded using local configuration. Deployed preview JS is byte-identical to the working source; served HTML contains both new marker CSS and print-only hiding. Preview URL stays outside GitHub, per project policy.

Review adjudication (both model calls HTTP200):
- DeepSeek claimed canvas coordinates were still relative: rejected. `bakeMarks` first multiplies percentages by canvas width/height, then adds the path offsets to those pixel coordinates. Executed canvas-path regression and rendered PDF confirm correct placement.
- DeepSeek claimed an aria-labelled role=img span becomes unnamed when its decorative SVG is hidden: rejected. Browser accessibility tree exposes each span as “שאלה … סעיף … — נבחר”. Hiding the decorative child avoids duplicate announcements.
- Qwen claimed markers were left-aligned and absent in print: rejected against screenshots, rendered print, and detected mark positions (page1 raster x962–979 on width1190; 9 marks; page2 1 mark).
- Boundary fallback omits malformed/edge boxes rather than covering content. No current catalog mark hits that fallback. Check dimensions maintain approximately square proportions on A4; no distorted glyph observed.

Evidence on local host: `/tmp/teacher-marker-desktop.png`, `/tmp/teacher-marker-phone.png`, `/tmp/teacher-marker-print-page1.png`, `/tmp/teacher-markers-print.pdf`, `/tmp/teacher-markers-review/`.

Not a live publication receipt. Cherry-pick onto current main; do not release this pre-Ramzi base over the newer live version.
