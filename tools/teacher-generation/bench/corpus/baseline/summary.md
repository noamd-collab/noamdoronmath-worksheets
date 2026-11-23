# Replay of recorded model replies

Delivered with no further model call: **11 of 19 (58%)**. Questions rejected when standing alone: 70 of 372 (19%). Model calls: 0; outbound connections attempted: 0.

| Case | Provider | Topic | Q | Route | First pass | Fail alone | Correction asked | Ladder | First render | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 5 of 20 | 5 q (not recorded) | dropped 5, prints 15 | pass | delivered |
| A-order | qwen | ד07 | 20 | worker | PRINTED_EXPRESSION_SCOPE | 6 of 20 | 6 q (not recorded) | — | — | failed |
| A-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 5 of 20 | 5 q (not recorded) | dropped 5, prints 15 | pass | delivered |
| A-percent | qwen | g8:percentages | 20 | worker | PRINTED_ANSWER_KIND | 1 of 20 | 1 q (not recorded) | dropped 1, prints 19 | pass | delivered |
| A-square | qwen | g9m:square | 20 | general | SOURCE_RICH_TEXT | 5 of 20 | 5 q (not recorded) | — | fail: middle-build, didactic-review-reconciliation | failed |
| B-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 4 of 20 | 4 q (not recorded) | dropped 4, prints 16 | pass | delivered |
| B-order | qwen | ד07 | 20 | worker | PRINTED_ANSWER_KIND | 5 of 20 | 5 q (not recorded) | — | fail: output-gates, house-gates | failed |
| B-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| B-percent | qwen | g8:percentages | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| B-square | qwen | g9m:square | 20 | general | AUTHOR_PLAN_MISMATCH | 7 of 20 | — | 2nd attempt after AUTHOR_PLAN_MISMATCH | — | needs_unrecorded_reply |
| T1-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 10 of 20 | 8 q (not recorded) | — | — | failed |
| T2-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 15 of 20 | 8 q (not recorded) | — | — | failed |
| S-g4calc | qwen | ד07 | 12 | worker | pass | 0 of 12 | — | — | pass | delivered |
| S-g7eq | qwen | g7:equations | 20 | worker | pass | 0 of 20 | — | — | pass | delivered |
| G-division | gemini | ג10 | 20 | worker | QUALITY_GATE_FAILED | 1 of 20 | 1 q (not recorded) | dropped 1, prints 19 | pass | delivered |
| G-order | gemini | ד07 | 20 | worker | pass | 0 of 20 | — | — | pass | delivered |
| G-equations | gemini | g7:equations | 20 | worker | PROVIDER_INVALID_RESPONSE | 0 of 20 | — | 2nd attempt after PROVIDER_INVALID_RESPONSE | — | needs_unrecorded_reply |
| G-percent | gemini | g8:percentages | 20 | worker | SOURCE_PLAIN_MATH | 2 of 20 | 2 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| G-square | gemini | g9m:square | 20 | general | pass | 0 of 20 | — | 2nd attempt after QUALITY_GATE_FAILED | fail: middle-build, didactic-review-reconciliation | needs_unrecorded_reply |

Delivered with fewer questions than requested: 8. Corrections the engine asked for that were never recorded: 13. Second author replies it asked for that were never recorded: 3.

## By provider

| Provider | Cases | Delivered | Questions | Fail alone |
| --- | --- | --- | --- | --- |
| gemini | 5 | 3 | 100 | 3 |
| qwen | 14 | 8 | 272 | 67 |

Recorded as text that is not JSON: G-equations. The replay sends the text as recorded; the question counts of such a case come from its declared hand repair.

## Failure classes

| Class | Cases |
| --- | --- |
| DELIVERED | 11 |
| GATES:BLOCKING_BUILD_FAILURE+G75 | 1 |
| PROVIDER:PROVIDER_INVALID_RESPONSE | 1 |
| SOURCE:AUTHOR_PLAN_MISMATCH | 1 |
| SOURCE:PRINTED_ANSWER_KIND | 1 |
| SOURCE:PRINTED_EXPRESSION_SCOPE | 1 |
| SOURCE:SOURCE_FIGURE | 2 |
| SOURCE:SOURCE_RICH_TEXT | 1 |

## Questions rejected alone, by code

| Code | Questions |
| --- | --- |
| PRINTED_ANSWER_KIND | 20 |
| SOURCE_FIGURE | 16 |
| SOURCE_NOTATION | 10 |
| SOURCE_PLAIN_MATH | 9 |
| PRINTED_EXPRESSION_SCOPE | 4 |
| SOURCE_TABLE | 4 |
| SOURCE_FIGURE_TASK | 3 |
| UNSUPPORTED_TASK | 2 |
| QUALITY_GATE_FAILED | 1 |
| SOURCE_RICH_TEXT | 1 |

## Gate findings in the first render

| Gate | Findings |
| --- | --- |
| BLOCKING_BUILD_FAILURE | 2 |
| G51 | 1 |
| G61 | 1 |
| G75 | 2 |
| output-gates | 1 |

Not installed on this machine: pdffonts, pdftoppm, tesseract. Without poppler the elementary page-fill check is deferred with a warning, and without tesseract the middle-school figure reader cannot run; the worker image has both.

`needs_unrecorded_reply` means the repair ladder ended without a sheet and the engine asked for a second full author reply that was never recorded; the replay stops there instead of inventing one. A correction that was never recorded does not stop a job: it counts as a failed correction and the ladder goes on to a shorter sheet.
