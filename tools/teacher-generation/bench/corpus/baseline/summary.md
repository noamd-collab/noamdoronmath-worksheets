# Replay of recorded model replies

Delivered with no further model call: **1 of 14 (7%)**. Questions rejected when standing alone: 83 of 272 (31%). Model calls: 0; outbound connections attempted: 0.

| Case | Topic | Q | Route | First pass | Fail alone | Correction asked | First render | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-division | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| A-order | ד07 | 20 | worker | SOURCE_NOTATION | 6 of 20 | 6 q (not recorded) | — | needs_unrecorded_reply |
| A-equations | g7:equations | 20 | worker | SOURCE_TABLE | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| A-percent | g8:percentages | 20 | worker | PRINTED_ANSWER_KIND | 1 of 20 | 1 q (not recorded) | — | needs_unrecorded_reply |
| A-square | g9m:square | 20 | general | SOURCE_NOTATION | 6 of 20 | — | — | failed |
| B-division | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 4 of 20 | 4 q (not recorded) | — | needs_unrecorded_reply |
| B-order | ד07 | 20 | worker | SOURCE_NOTATION | 9 of 20 | — | — | failed |
| B-equations | g7:equations | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | — | needs_unrecorded_reply |
| B-percent | g8:percentages | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | — | needs_unrecorded_reply |
| B-square | g9m:square | 20 | general | AUTHOR_PLAN_MISMATCH | 7 of 20 | — | — | failed |
| T1-triangle | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 16 of 20 | — | — | failed |
| T2-triangle | g8:triangle_parts | 20 | worker | SOURCE_NOTATION | 20 of 20 | — | — | failed |
| S-g4calc | ד07 | 12 | worker | pass | 0 of 12 | 5 q (not recorded) | fail: content-truth, house-gates | needs_unrecorded_reply |
| S-g7eq | g7:equations | 20 | worker | pass | 0 of 20 | — | pass | delivered |

## Failure classes

| Class | Cases |
| --- | --- |
| DELIVERED | 1 |
| GATES:G32+G61 | 1 |
| SOURCE:AUTHOR_PLAN_MISMATCH | 1 |
| SOURCE:PRINTED_ANSWER_KIND | 3 |
| SOURCE:SOURCE_FIGURE | 1 |
| SOURCE:SOURCE_NOTATION | 4 |
| SOURCE:SOURCE_TABLE | 3 |

## Questions rejected alone, by code

| Code | Questions |
| --- | --- |
| PRINTED_ANSWER_KIND | 20 |
| SOURCE_TEXT | 20 |
| SOURCE_PLAIN_MATH | 15 |
| SOURCE_NOTATION | 14 |
| PRINTED_EXPRESSION_SCOPE | 4 |
| SOURCE_TABLE | 4 |
| SOURCE_FIGURE | 3 |
| UNSUPPORTED_TASK | 2 |
| SOURCE_RICH_TEXT | 1 |

## Gate findings in the first render

| Gate | Findings |
| --- | --- |
| G32 | 3 |
| G61 | 1 |

Not installed on this machine: pdffonts, pdftoppm, tesseract. Without poppler the elementary page-fill check is deferred with a warning, and without tesseract the middle-school figure reader cannot run; the worker image has both.

`needs_unrecorded_reply` means the engine asked the model for a correction that was never recorded; the replay stops there instead of inventing one.
