# Elementary question map source notes

The picker displays the original published PDF content. It does not rewrite mathematical prompts, invent missing values, or add figures. Number labels, vector card boundaries, crop containment and source SHA-256 hashes are checked during extraction. Outlined grade 1 labels have a separately verified geometry map; outlined grade 2 labels are matched to their original question cards. Question crops preserve original diagrams and answer rules, including small overflows beyond decorative card borders.

Explicit dependencies and relevant preceding source material are preserved in `elementary-question-context.json` and `outlined-grade1-anchors.json`. Context appears together with the selected question; it is not a second selectable question.

These ambiguities are already present in the original PDFs:

- Grade 5, topic 16, level A, questions 13–15 mention two data series without identifying them. The exact original question is retained; no link to an earlier table is invented.
- Grade 5, topic 17, level A, questions 13–15 and 18 refer to data without identifying a unique series. The exact original question is retained; no data series is assigned by inference.
- Grade 5, topic 32, all levels, questions 13–14 refer to an equation or a given number without repeating it. The exact original card is retained; no equation or given number is assigned by inference.
- Grade 5, topic 33, all levels, several questions refer to a chart, table or data series without reproducing it. Original chart question 1, and question 5 where relevant, are retained. Question 3 does not identify a second series, question 4 does not show a complete missing-cell table, and question 6 does not identify its data list in the source. The picker does not infer those missing mathematical values.
- Grade 5, topic 34, all levels, question 13 refers to a timetable absent from that source page, and question 14 refers to an unnamed given value. No timetable or numerical value has been fabricated.

These notes concern the published source material, separately from whether the picker faithfully displays the whole available question.
