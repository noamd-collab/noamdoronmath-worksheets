# Printed question anchors

Reported: Ramzi buttons below their printed parts in G9-T39-A, page 8 (Q14). The stored pin positions are incorrect; CSS scaling reproduces the error at every zoom. PDF.js printed markers place Q14 א/ב/ג at y≈0.375/0.444/0.546, compared with old manifest 0.489/0.600/0.733.

The shared viewer now reads the existing PDF text layer once per rendered page. A complete ordered marker/part match within a column supplies normalized pin positions; missing, duplicated or mismatched markers retain the existing map. Both robot and report controls use that same anchor, including phone grouping. No PDFs, exercise identities, crop data or model requests are changed.

Read-only sample audit (12 original PDFs, no OCR/model calls):

| Grade | Topic | Parts | Matched markers | Old pins displaced >12pt |
|---|---|---:|---:|---:|
| 7 | מערכת צירים — היכרות וקנה מידה | 56 | 56 | 0 |
| 7 | שטח מלבן וריבוע — העמקה | 81 | 81 | 0 |
| 7 | משוואות דו־שלביות | 86 | 86 | 0 |
| 8 | אבחון קדם־ידע | 62 | 62 | 51 |
| 8 | מעבר בין ייצוגים | 67 | 67 | 62 |
| 8 | התיכון במשולש | 83 | 83 | 0 |
| 9 | חוק הפילוג המורחב | 94 | 94 | 0 |
| 9 | המלבן | 56 | 56 | 0 |
| 9 | פיתגורס חלק 1 — היכרות וחישוב — לכיתה ט׳ | 80 | 72 | 0 |
| 9 | הטרפז | 45 | 45 | 37 |
| 9 | דלתון | 59 | 59 | 50 |
| 9 | המקבילית | 35 | 31 | 0 |

This is a sample, not full-site certification. Unmatched/scanned pages preserve their old coordinates; they are not claimed fixed. Existing accurate maps differ by at most about one PDF point in this sample.

Validation: 23 pin tests pass, including real PDF.js item fixtures, missing/duplicate markers, late manifest loading, phone grouping, desktop report pairing, zoom and the existing inventory reachability tests. Wix build passes. Browser verification and DeepSeek/Qwen reviews follow in the PR.
