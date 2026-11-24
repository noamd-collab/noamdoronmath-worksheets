# Replay of recorded model replies

Delivered with no further model call: **19 of 43 (44%)**. Questions rejected when standing alone: 308 of 951 (32%). Model calls: 0; outbound connections attempted: 0.

| Case | Provider | Topic | Q | Route | First pass | Fail alone | Correction asked | Ladder | First render | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_LEAK | 8 of 20 | 8 q (not recorded) | — | — | failed |
| A-order | qwen | ד07 | 20 | worker | PRINTED_ANSWER_LEAK | 8 of 20 | 8 q (not recorded) | — | — | failed |
| A-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 5 of 20 | 6 q (not recorded) | dropped 5, prints 15 | pass | delivered |
| A-percent | qwen | g8:percentages | 20 | worker | QUALITY_GATE_FAILED | 1 of 20 | 6 q (not recorded) | dropped 1, prints 19 | pass | delivered |
| A-square | qwen | g9m:square | 20 | general | QUALITY_GATE_FAILED | 5 of 20 | 7 q (not recorded) | — | fail: middle-build, didactic-review-reconciliation | failed |
| B-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_LEAK | 7 of 20 | 8 q (not recorded) | — | — | failed |
| B-order | qwen | ד07 | 20 | worker | PRINTED_ANSWER_KIND | 5 of 20 | 5 q (not recorded) | — | fail: output-gates, house-gates | failed |
| B-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 2 of 20 | 3 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| B-percent | qwen | g8:percentages | 20 | worker | SOURCE_TABLE | 2 of 20 | 3 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| B-square | qwen | g9m:square | 20 | general | AUTHOR_PLAN_MISMATCH | 7 of 20 | — | 2nd attempt after AUTHOR_PLAN_MISMATCH | — | needs_unrecorded_reply |
| T1-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 14 of 20 | 8 q (not recorded) | — | — | failed |
| T2-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 15 of 20 | 8 q (not recorded) | — | — | failed |
| S-g4calc | qwen | ד07 | 12 | worker | pass | 0 of 12 | — | — | pass | delivered |
| S-g7eq | qwen | g7:equations | 20 | worker | pass | 0 of 20 | — | — | pass | delivered |
| G-division | gemini | ג10 | 20 | worker | QUALITY_GATE_FAILED | 7 of 20 | 7 q (not recorded) | — | — | failed |
| G-order | gemini | ד07 | 20 | worker | pass | 0 of 20 | — | — | pass | delivered |
| G-equations | gemini | g7:equations | 20 | worker | AUTHOR_PLAN_MISMATCH | 0 of 20 | 5 q (not recorded) | dropped 3, prints 17 | pass | delivered |
| G-percent | gemini | g8:percentages | 20 | worker | SOURCE_PLAIN_MATH | 2 of 20 | 2 q (not recorded) | dropped 2, prints 18 | pass | delivered |
| G-square | gemini | g9m:square | 20 | general | QUALITY_GATE_FAILED | 2 of 20 | 8 q (not recorded) | — | — | failed |
| L1-p1 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_KIND | 14 of 24 | 8 q (not recorded) | — | — | failed |
| L1-p1-a2 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_KIND | 15 of 24 | 8 q (not recorded) | — | — | failed |
| L1-p2 | gemini | g9r:quad_eq_applications | 20 | worker | PRINTED_ANSWER_LEAK | 5 of 24 | 1 q (not recorded) | replaced 3; dropped 2, prints 18 | fail: middle-build, didactic-review-reconciliation | delivered |
| L1-p2-a2 | gemini | g9r:quad_eq_applications | 20 | worker | PRINTED_ANSWER_KIND | 7 of 24 | 6 q (not recorded) | replaced 2; dropped 3, prints 17 | pass | delivered |
| L1-p3 | gemini | g9r:parallels_trapezoid | 20 | worker | PRINTED_ANSWER_KIND | 9 of 24 | 5 q (not recorded) | — | fail: middle-build, didactic-review-reconciliation | failed |
| L1-p3-a2 | gemini | g9r:parallels_trapezoid | 20 | worker | PRINTED_ANSWER_KIND | 15 of 24 | 8 q (not recorded) | — | — | failed |
| L1-g3 | gemini | ג10 | 20 | worker | pass | 8 of 24 | — | replaced 4 | pass | delivered |
| L1-g4 | gemini | ד07 | 20 | worker | pass | 3 of 24 | — | replaced 3 | pass | delivered |
| L1-g7 | gemini | g7:equations | 20 | worker | pass | 5 of 24 | — | replaced 4 | pass | delivered |
| L1-g8 | gemini | g8:percentages | 20 | worker | PRINTED_ANSWER_KIND | 9 of 24 | 2 q (not recorded) | — | — | failed |
| L1-g8-a2 | gemini | g8:percentages | 20 | worker | pass | 4 of 24 | — | replaced 5 | pass | delivered |
| L1-square | gemini | g9m:square | 20 | general | QUALITY_GATE_FAILED | 11 of 24 | 8 q (not recorded) | — | — | failed |
| L1-square-a2 | gemini | g9m:square | 20 | general | PRINTED_ANSWER_KIND | 13 of 24 | 8 q (not recorded) | — | — | failed |
| L2-g3 | gemini | ג10 | 20 | worker | pass | 6 of 24 | — | replaced 3 | pass | delivered |
| L2-g7 | gemini | g7:equations | 20 | worker | pass | 1 of 24 | — | replaced 1 | pass | delivered |
| L2-g8 | gemini | g8:percentages | 20 | worker | pass | 2 of 24 | — | replaced 4 | pass | delivered |
| L2-p1 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_LEAK | 10 of 24 | 6 q (not recorded) | — | — | failed |
| L2-p1-a2 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_KIND | 13 of 24 | 8 q (not recorded) | — | — | failed |
| L2-p2 | gemini | g9r:quad_eq_applications | 20 | worker | PRINTED_ANSWER_LEAK | 10 of 24 | 6 q (not recorded) | — | — | failed |
| L2-p2-a2 | gemini | g9r:quad_eq_applications | 20 | worker | pass | 3 of 24 | — | replaced 2 | pass | delivered |
| L2-p3 | gemini | g9r:parallels_trapezoid | 20 | worker | SOURCE_FIGURE | 15 of 24 | 8 q (not recorded) | — | — | failed |
| L2-p3-a2 | gemini | g9r:parallels_trapezoid | 20 | worker | PRINTED_TASK_MISMATCH | 23 of 27 | 8 q (not recorded) | — | — | failed |
| L2-square | gemini | g9m:square | 20 | general | QUALITY_GATE_FAILED | 9 of 24 | 8 q (not recorded) | — | — | failed |
| L2-square-a2 | gemini | g9m:square | 20 | general | QUALITY_GATE_FAILED | 8 of 24 | 8 q (not recorded) | — | — | failed |

Delivered with fewer questions than requested: 8. Corrections the engine asked for that were never recorded: 31. Second author replies it asked for that were never recorded: 1.

## By provider

| Provider | Cases | Delivered | Questions | Fail alone |
| --- | --- | --- | --- | --- |
| gemini | 29 | 13 | 679 | 229 |
| qwen | 14 | 6 | 272 | 79 |

Recorded as text that is not JSON: G-equations. The replay sends the text as recorded; the question counts of such a case come from its declared hand repair.

## Failure classes

| Class | Cases |
| --- | --- |
| DELIVERED | 19 |
| SOURCE:AUTHOR_PLAN_MISMATCH | 1 |
| SOURCE:PRINTED_ANSWER_KIND | 8 |
| SOURCE:PRINTED_ANSWER_LEAK | 5 |
| SOURCE:PRINTED_TASK_MISMATCH | 1 |
| SOURCE:QUALITY_GATE_FAILED | 6 |
| SOURCE:SOURCE_FIGURE | 3 |

## Questions rejected alone, by code

| Code | Questions |
| --- | --- |
| PRINTED_ANSWER_KIND | 88 |
| PRINTED_ANSWER_LEAK | 64 |
| PRINTED_TASK_MISMATCH | 60 |
| SOURCE_FIGURE | 35 |
| SOURCE_NOTATION | 21 |
| SOURCE_PLAIN_MATH | 12 |
| NOT_AN_OBJECT | 8 |
| PRINTED_EXPRESSION_SCOPE | 4 |
| SOURCE_TABLE | 4 |
| QUALITY_GATE_FAILED | 3 |
| SOURCE_FIGURE_TASK | 3 |
| SOURCE_SHAPE | 2 |
| UNSUPPORTED_TASK | 2 |
| OUTSIDE_LESSON_BOUNDARY | 1 |
| SOURCE_RICH_TEXT | 1 |

## Gate findings in the first render

| Gate | Findings |
| --- | --- |
| BLOCKING_BUILD_FAILURE | 3 |
| G51 | 1 |
| G61 | 1 |
| G75 | 1 |
| G76 | 1 |
| middle-build/selfcheck_noam_package.py | 1 |
| output-gates | 1 |

Not installed on this machine: pdffonts, pdftoppm, tesseract. Without poppler the elementary page-fill check is deferred with a warning, and without tesseract the middle-school figure reader cannot run; the worker image has both.

`needs_unrecorded_reply` means the repair ladder ended without a sheet and the engine asked for a second full author reply that was never recorded; the replay stops there instead of inventing one. A correction that was never recorded does not stop a job: it counts as a failed correction and the ladder goes on to a shorter sheet.
