# Replay of recorded model replies

Delivered with no further model call: **4 of 35 (11%)**. Questions rejected when standing alone: 315 of 756 (42%). Model calls: 0; outbound connections attempted: 0.

| Case | Provider | Topic | Q | Route | First pass | Fail alone | Correction asked | Ladder | First render | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-division | qwen | ג10 | 20 | worker | SOURCE_NOTATION | 12 of 20 | 8 q (not recorded) | — | — | failed |
| A-order | qwen | ד07 | 20 | worker | PRINTED_ANSWER_LEAK | 14 of 20 | 8 q (not recorded) | — | — | failed |
| A-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 5 of 20 | 5 q (not recorded) | — | — | failed |
| A-percent | qwen | g8:percentages | 20 | worker | SOURCE_NOTATION | 17 of 20 | 8 q + rule (not recorded) | — | — | failed |
| A-square | qwen | g9m:square | 20 | general | SOURCE_NOTATION | 7 of 20 | 7 q (not recorded) | — | — | failed |
| B-division | qwen | ג10 | 20 | worker | SOURCE_NOTATION | 11 of 20 | 8 q (not recorded) | — | — | failed |
| B-order | qwen | ד07 | 20 | worker | SOURCE_NOTATION | 11 of 20 | 8 q (not recorded) | — | — | failed |
| B-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 3 of 20 | 3 q (not recorded) | — | — | failed |
| B-percent | qwen | g8:percentages | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | — | — | failed |
| B-square | qwen | g9m:square | 20 | general | AUTHOR_PLAN_MISMATCH | 9 of 20 | — | 2nd attempt after AUTHOR_PLAN_MISMATCH | — | needs_unrecorded_reply |
| T1-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 16 of 20 | 8 q (not recorded) | — | — | failed |
| T2-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_TEXT | 20 of 20 | 8 q + rule (not recorded) | — | — | failed |
| S-g4calc | qwen | ד07 | 12 | worker | SOURCE_NOTATION | 5 of 12 | 5 q (not recorded) | — | — | failed |
| S-g7eq | qwen | g7:equations | 20 | worker | pass | 0 of 20 | — | — | pass | delivered |
| G-division | gemini | ג10 | 20 | worker | QUALITY_GATE_FAILED | 8 of 20 | 8 q (not recorded) | — | — | failed |
| G-order | gemini | ד07 | 20 | worker | pass | 0 of 20 | 5 q (not recorded) | dropped 5, prints 15 | pass | delivered |
| G-equations | gemini | g7:equations | 20 | worker | AUTHOR_PLAN_MISMATCH | 0 of 20 | 3 q (not recorded) | — | — | failed |
| G-percent | gemini | g8:percentages | 20 | worker | SOURCE_PLAIN_MATH | 3 of 20 | 3 q (not recorded) | — | — | failed |
| G-square | gemini | g9m:square | 20 | general | PRINTED_ANSWER_LEAK | 6 of 20 | 6 q (not recorded) | — | — | failed |
| L1-p1 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_KIND | 19 of 24 | 8 q (not recorded) | — | — | failed |
| L1-p1-a2 | gemini | g9r:rhombus | 20 | worker | PRINTED_ANSWER_LEAK | 19 of 24 | 8 q (not recorded) | — | — | failed |
| L1-p2 | gemini | g9r:quad_eq_applications | 20 | worker | SOURCE_NOTATION | 9 of 24 | 5 q (not recorded) | — | — | failed |
| L1-p2-a2 | gemini | g9r:quad_eq_applications | 20 | worker | PRINTED_ANSWER_KIND | 9 of 24 | 5 q (not recorded) | — | — | failed |
| L1-p3 | gemini | g9r:parallels_trapezoid | 20 | worker | SOURCE_NOTATION | 13 of 24 | 8 q (not recorded) | — | — | failed |
| L1-p3-a2 | gemini | g9r:parallels_trapezoid | 20 | worker | PRINTED_ANSWER_KIND | 19 of 24 | 8 q (not recorded) | — | — | failed |
| L1-g3 | gemini | ג10 | 20 | worker | PRINTED_ANSWER_LEAK | 12 of 24 | 8 q (not recorded) | — | — | failed |
| L1-g4 | gemini | ד07 | 20 | worker | PRINTED_TASK_MISMATCH | 6 of 24 | 2 q (not recorded) | — | — | failed |
| L1-g7 | gemini | g7:equations | 20 | worker | PRINTED_ANSWER_KIND | 5 of 24 | 1 q (not recorded) | — | — | failed |
| L1-g8 | gemini | g8:percentages | 20 | worker | PRINTED_TASK_MISMATCH | 9 of 24 | 5 q (not recorded) | — | — | failed |
| L1-g8-a2 | gemini | g8:percentages | 20 | worker | SOURCE_NOTATION | 5 of 24 | 1 q + rule (not recorded) | — | — | failed |
| L1-square | gemini | g9m:square | 20 | general | SOURCE_FIGURE | 13 of 24 | 8 q (not recorded) | — | — | failed |
| L1-square-a2 | gemini | g9m:square | 20 | general | PRINTED_ANSWER_KIND | 13 of 24 | 9 q | 2nd attempt after PRINTED_ANSWER_KIND | — | needs_unrecorded_reply |
| L2-g3 | gemini | ג10 | 20 | worker | PRINTED_ANSWER_LEAK | 9 of 24 | 5 q (not recorded) | replaced 2; dropped 5, prints 15 | pass | delivered |
| L2-g7 | gemini | g7:equations | 20 | worker | pass | 3 of 24 | — | replaced 2 | pass | delivered |
| L2-g8 | gemini | g8:percentages | 20 | worker | SOURCE_NOTATION | 3 of 24 | rule (not recorded) | — | — | failed |

Delivered with fewer questions than requested: 2. Corrections the engine asked for that were never recorded: 31. Second author replies it asked for that were never recorded: 2.

## By provider

| Provider | Cases | Delivered | Questions | Fail alone |
| --- | --- | --- | --- | --- |
| gemini | 21 | 3 | 484 | 183 |
| qwen | 14 | 1 | 272 | 132 |

Recorded as text that is not JSON: G-equations. The replay sends the text as recorded; the question counts of such a case come from its declared hand repair.

## Failure classes

| Class | Cases |
| --- | --- |
| DELIVERED | 4 |
| SOURCE:AUTHOR_PLAN_MISMATCH | 2 |
| SOURCE:PRINTED_ANSWER_KIND | 5 |
| SOURCE:PRINTED_ANSWER_LEAK | 4 |
| SOURCE:PRINTED_TASK_MISMATCH | 2 |
| SOURCE:QUALITY_GATE_FAILED | 1 |
| SOURCE:SOURCE_FIGURE | 2 |
| SOURCE:SOURCE_NOTATION | 10 |
| SOURCE:SOURCE_PLAIN_MATH | 1 |
| SOURCE:SOURCE_TABLE | 3 |
| SOURCE:SOURCE_TEXT | 1 |

## Questions rejected alone, by code

| Code | Questions |
| --- | --- |
| PRINTED_ANSWER_KIND | 85 |
| SOURCE_NOTATION | 75 |
| PRINTED_ANSWER_LEAK | 50 |
| PRINTED_TASK_MISMATCH | 42 |
| SOURCE_TEXT | 20 |
| NOT_AN_OBJECT | 8 |
| SOURCE_PLAIN_MATH | 7 |
| SOURCE_SHAPE | 6 |
| SOURCE_TABLE | 6 |
| SOURCE_FIGURE | 5 |
| PRINTED_EXPRESSION_SCOPE | 4 |
| QUALITY_GATE_FAILED | 2 |
| SOURCE_NUMBER | 2 |
| UNSUPPORTED_TASK | 2 |
| SOURCE_RICH_TEXT | 1 |

Not installed on this machine: pdffonts, pdftoppm, tesseract. Without poppler the elementary page-fill check is deferred with a warning, and without tesseract the middle-school figure reader cannot run; the worker image has both.

`needs_unrecorded_reply` means the repair ladder ended without a sheet and the engine asked for a second full author reply that was never recorded; the replay stops there instead of inventing one. A correction that was never recorded does not stop a job: it counts as a failed correction and the ladder goes on, to a shorter sheet only when the request is above its grade minimum (8 / 12 / 14 / 20 questions in grades 1-2 / 3-4 / 5-6 / 7-9). "Correction asked" counts the questions asked for again and names the rule when it was asked for too.
