# Replay of recorded model replies

Delivered with no further model call: **3 of 19 (16%)**. Questions rejected when standing alone: 69 of 372 (19%). Model calls: 0; outbound connections attempted: 0.

| Case | Provider | Topic | Q | Route | First pass | Fail alone | Correction asked | First render | Final |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| A-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| A-order | qwen | ד07 | 20 | worker | SOURCE_NOTATION | 6 of 20 | 6 q (not recorded) | — | needs_unrecorded_reply |
| A-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| A-percent | qwen | g8:percentages | 20 | worker | PRINTED_ANSWER_KIND | 1 of 20 | 1 q (not recorded) | — | needs_unrecorded_reply |
| A-square | qwen | g9m:square | 20 | general | SOURCE_NOTATION | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| B-division | qwen | ג10 | 20 | worker | PRINTED_ANSWER_KIND | 4 of 20 | 4 q (not recorded) | — | needs_unrecorded_reply |
| B-order | qwen | ד07 | 20 | worker | SOURCE_NOTATION | 5 of 20 | 5 q (not recorded) | — | needs_unrecorded_reply |
| B-equations | qwen | g7:equations | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | — | needs_unrecorded_reply |
| B-percent | qwen | g8:percentages | 20 | worker | SOURCE_TABLE | 2 of 20 | 2 q (not recorded) | — | needs_unrecorded_reply |
| B-square | qwen | g9m:square | 20 | general | AUTHOR_PLAN_MISMATCH | 7 of 20 | — | — | failed |
| T1-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_FIGURE | 10 of 20 | — | — | failed |
| T2-triangle | qwen | g8:triangle_parts | 20 | worker | SOURCE_NOTATION | 15 of 20 | — | — | failed |
| S-g4calc | qwen | ד07 | 12 | worker | pass | 0 of 12 | — | pass | delivered |
| S-g7eq | qwen | g7:equations | 20 | worker | pass | 0 of 20 | — | pass | delivered |
| G-division | gemini | ג10 | 20 | worker | pass | 0 of 20 | 1 q (not recorded) | fail: content-truth, house-gates | needs_unrecorded_reply |
| G-order | gemini | ד07 | 20 | worker | pass | 0 of 20 | — | pass | delivered |
| G-equations | gemini | g7:equations | 20 | worker | PROVIDER_INVALID_RESPONSE | 0 of 20 | — | — | failed |
| G-percent | gemini | g8:percentages | 20 | worker | SOURCE_NOTATION | 2 of 20 | 2 q (not recorded) | — | needs_unrecorded_reply |
| G-square | gemini | g9m:square | 20 | general | pass | 0 of 20 | — | fail: middle-build, didactic-review-reconciliation | failed |

## By provider

| Provider | Cases | Delivered | Questions | Fail alone |
| --- | --- | --- | --- | --- |
| gemini | 5 | 1 | 100 | 2 |
| qwen | 14 | 2 | 272 | 67 |

Recorded as text that is not JSON: G-equations. The replay sends the text as recorded; the question counts of such a case come from its declared hand repair.

## Failure classes

| Class | Cases |
| --- | --- |
| DELIVERED | 3 |
| GATES:BLOCKING_BUILD_FAILURE+G75 | 1 |
| GATES:G32+G62 | 1 |
| PROVIDER:PROVIDER_INVALID_RESPONSE | 1 |
| SOURCE:AUTHOR_PLAN_MISMATCH | 1 |
| SOURCE:PRINTED_ANSWER_KIND | 3 |
| SOURCE:SOURCE_FIGURE | 1 |
| SOURCE:SOURCE_NOTATION | 5 |
| SOURCE:SOURCE_TABLE | 3 |

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
| SOURCE_RICH_TEXT | 1 |

## Gate findings in the first render

| Gate | Findings |
| --- | --- |
| BLOCKING_BUILD_FAILURE | 1 |
| G32 | 1 |
| G62 | 1 |
| G75 | 1 |

Not installed on this machine: pdffonts, pdftoppm, tesseract. Without poppler the elementary page-fill check is deferred with a warning, and without tesseract the middle-school figure reader cannot run; the worker image has both.

`needs_unrecorded_reply` means the engine asked the model for a correction that was never recorded; the replay stops there instead of inventing one.
