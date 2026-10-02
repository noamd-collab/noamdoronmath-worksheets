# Loop text audit

Read-only audit of every animated loop on the site. No loop code was changed in this pass.

Completed-frame screenshots (reduced motion) were taken of all 73 loops plus the triangle explorer. They match the strings below, including the trapezoid answer line, `rise / run = 2`, `14 ≠ 20`, `1 m = 100 cm`, and the `80` gap on the parallels.

**Text-only rule.** A later edit may replace characters inside existing text nodes, and may change the existing `dir` value on that same node when the new string is Hebrew prose and the node is currently `dir="ltr"` (or the reverse). It may not change layout, positions, colors, shapes, animation, sizes, or add elements. Problems that only a move or a resize would fix are listed under [Not fixed (visual)](#not-fixed-visual) and must be left alone.

## Scope and counts

| Item | Count |
| --- | --- |
| ConceptLoop variants (the whole catalog) | **73** |
| Variants with a recommended string change | **36** |
| Variants with no text change | **37** |
| Extra diagram, not a loop: triangle-area explorer | 1 (same formula fix as `triangle`) |

There is no separate Grok file and nothing under `public/` with its own loop copy. `HeroLoop.astro` only mounts the same 73 variants. `GradeLoopPlayer.astro` shows the same loops plus the visible 4-line copy in `gradeLoopPools.ts` (`domain`, `claim`, `mathLine`, `explain`). `conceptLoops.ts` changes four strings at runtime (`c = ?` → `c = 5`, similar-triangle `4`→`8` and `3`→`6`, polygon counters, parabola `y = 0`…`y = 3`). Those runtime strings are mathematically correct. **Do not edit `conceptLoops.ts`.**

`public/noam-diagram-plan.js` builds worksheet diagrams from exercise text. It is not a fixed loop. Out of scope.

Grade comes from `LOOPS` in `src/lib/gradeLoopPools.ts`. Four variants are intentionally not in a grade pool: `array`, `pct-25`, `tri-sort`, `topic-card`.

### The 10 worst

1. **`trap-area`** — midline is the bare number `4`, so it reads as the right leg; the answer is `(6 + 2) / 2 × 3 = 12` (ASCII slash, easy to parse as `(6+2)/(2×3)`).
2. **`para-perp`** — the equal distance between the parallels is labeled `80`, which is the pixel gap, not a length from the problem.
3. **`sq-stretch`** — the four sides are numbered `1 2 3 4`. Read as lengths, the shape would not be a rectangle.
4. **`slope`** — the answer line is the English `rise / run = 2`.
5. **`order-ops`** — the question is `2 + 3 × 4 = ?`, and the answer line is `14 ≠ 20`, which names neither expression.
6. **`quad-tree`** — `יורש` / `מה יורש הריבוע?` is inheritance jargon, not school Hebrew.
7. **`diff-sq`** — a grade-9 difference of squares is asked as `25 − 9 = ?`.
8. **`tri-sort`** — the scalene basket is `צלעות שונות` instead of `שונה־צלעות`.
9. **`ruler`** — the Hebrew question uses ס״מ, and the figure answers with `1 m`, `10 cm`, `100 cm`.
10. **`coord-walk`** — the question is already `(3, 2) = ?`, so the walk’s result is printed before the walk.

## Notation to apply everywhere a string changes

- Fraction bar in plain text: U+2044 `⁄`, not ASCII `/`. No stacked-fraction markup (that would be a new element).
- Arithmetic multiplication: `×`. A product with variables, as on the triangle loop: `·`.
- Do not invent units. No loop states ס״מ except the ruler question. Do not add ס״מ or סמ״ר to unlabeled lengths.
- Do not rewrite aria-labels, pause buttons, or `conceptLoops.ts` in this pass.
- Do not “clean up” a formula that this audit marks as no change, including spacing.

## Not fixed (visual)

Leave the geometry, coordinates, and opacity timing alone. A string listed here may still be renamed in the loop’s table; the position stays.

| Loop | What is wrong visually | Why text cannot fix it |
| --- | --- | --- |
| `trap-area` | `4` sits at the right end of the green midline (`x="330"`), so it reads as the leg. `3` sits low, beside the height segment, inside the shape. | Renaming to `m = 4` and `h = 3` is allowed. Moving either label is not. |
| `peri-rect` | The rectangle is 240×140 px. Labels say 6 and 4. Pixel ratio ≈ 1.71, label ratio = 1.5. | The perimeter `6+4+6+4=20` matches the labels. Do not resize the rectangle and do not change 6 or 4. |
| `exterior` | `30°` is placed mid-side, not at the 30° vertex. The angle measures 30°, 60°, 90° are correct (`tan` of the top angle is 69.3/120 ≈ 30°). | Do not move the label. |
| `mark-250` | Ticks for 200, 250, and 300 are 40 px apart on a 0–1000 line, so 250 looks glued to its neighbors. The values and the midpoint are correct (250 is exactly halfway from 200 to 300). | Do not move ticks. |
| `ratio-beads` | `א` and `כ` have no legend. A word does not fit inside a bead of radius 12. | Do not change those letters and do not add a legend. |
| `quad-gate` | `4` and `3` sit inside the shapes and can be read as side lengths. The answer line already says `4 צלעות`. | A longer phrase will not fit. Do not change the digits. |
| `signed-jump` | The side thermometer labels `−2`, `0`, `3` are not on a linear scale. The number line and `−2 + 5 = 3` are correct. | Do not move the thermometer labels. |

## Index

The 36 problem variants each have their own table under “Problem loops”. The 37 with no text change are one row each under “Clean loops”. Those 73 names are exactly the `SPECS` keys. `birds-sub` and `sticks` each appear once.

---

## Problem loops

File for every card string: `headless/astro-poc/src/components/ConceptLoop.astro`.
Grade-player copy, when it also changes: `headless/astro-poc/src/lib/gradeLoopPools.ts` (`GRADE_LOOP_COPY`).

### trap-area — grade 7, שטח טרפז

Screenshot in the request matches the source: title `מה שטח הטרפז?`, labels `2`, `4`, `3`, `6`, answer `(6 + 2) / 2 × 3 = 12`.

Checked on the polygon `(140,230) (356,230) (284,122) (212,122)` at 36 px per unit: bases 6 and 2, height 3, midline exactly 4. The arithmetic result 12 is right. The writing is not.

| | |
| --- | --- |
| Current | Top: `מה שטח הטרפז?`. Labels: `6`, `2`, `3`, `4`. Formula: `(6 + 2) / 2 × 3 = 12`. Grade `mathLine`: the same formula. Grade `explain` is already clear Hebrew. |
| Problem | `4` is only a digit, placed where the eye reads a leg (position: Not fixed). `3` is not named as height (position: Not fixed). ASCII `/` plus `×` is not the textbook form `(סכום הבסיסים · גובה) ⁄ 2`, and `(6+2)/2×3` is easy to misread. No Hebrew in the answer line. The top is missing the copula. |
| Suggested | Top: `מהו שטח הטרפז?`. Labels, same nodes: `a = 6`, `b = 2`, `h = 3`, `m = 4`. Formula: `S = (6 + 2) · 3 ⁄ 2 = 12`. Grade `mathLine`: the same formula. Grade `explain`: `לטרפז בסיסים 6 ו־2 וגובה 3. אורך הקו האמצעי הוא 4, ממוצע הבסיסים. 4 כפול הגובה 3 נותן שטח 12.` |

### para-perp — grade 8, מקבילים ומאונכים

| | |
| --- | --- |
| Current | Top: `מקביל או מאונך?`. Labels: `מקבילים`, `80`, `80`, `מאונכים`. Formula: `מרחק שווה · 90°`. |
| Problem | Both distances say `80` because the lines are 80 px apart (`y=80` and `y=160`). That number is not a given length. The Hebrew labels and the formula are fine. |
| Suggested | Replace both `80` labels with `d`. Leave every other string. |

### sq-stretch — grade 7, ריבוע ומלבן

| | |
| --- | --- |
| Current | Top: `כמה צלעות?`. Side labels: `1`, `2`, `3`, `4`. Formula: `4 צלעות`. |
| Problem | `1 2 3 4` read as side lengths. Opposite sides would be unequal, so the shape would not be a rectangle. The formula’s claim (still 4 sides) is right. |
| Suggested | Same four nodes: `א`, `ב`, `ג`, `ד`. Top and formula stay. |

### slope — grade 8, שיפוע

| | |
| --- | --- |
| Current | Top: `מה השיפוע?`. Step labels `1` and `2` (twice). Extra label `2`. Formula and grade `mathLine`: `rise / run = 2`. |
| Problem | `rise / run` is English, and `/` is an ASCII slash. The steps really are 1 across and 2 up (60 px and 120 px on the first triangle). Grade `explain` is already good Hebrew. |
| Suggested | Formula and grade `mathLine`: `m = 2 ⁄ 1 = 2`. Leave the step labels `1` and `2` and the top. |

### order-ops — grade 7, סדר פעולות

| | |
| --- | --- |
| Current | Top: `2 + 3 × 4 = ?`. On the card: `2 + 3 × 4`, `= 14`, `(2 + 3) × 4`, `= 20`. Formula: `14 ≠ 20`. Grade `mathLine` already says `קודם כפל: 3 × 4 = 12, ואז 2 + 12 = 14`. |
| Problem | `14 ≠ 20` does not answer the question and does not say which expression is which. The two results themselves are correct (`2+3×4=14`, `(2+3)×4=20`). |
| Suggested | Formula only: `2 + 3 × 4 = 14, (2 + 3) × 4 = 20`. Do not change the grade copy. |

### quad-tree — grade 9, משפחת המרובעים

| | |
| --- | --- |
| Current | Top: `מה יורש הריבוע?`. Labels: `מקבילית`, `מלבן`, `מעוין`, `ריבוע` (those four are correct terms). Formula: `ריבוע יורש מלבן ומעוין`. Grade `claim`: `ריבוע הוא גם מלבן וגם מעוין` is already right. Grade `mathLine`: `ריבוע יורש מלבן ומעוין`. Grade `explain` uses `יורש` twice. |
| Problem | `יורש` is not Israeli textbook language for this tree. |
| Suggested | Top: `מה נכון לומר על הריבוע?`. Formula and grade `mathLine`: `ריבוע הוא גם מלבן וגם מעוין`. Grade `explain`: `בעץ המרובעים, המלבן והמעוין נמצאים מעל הריבוע. לריבוע יש את התכונות של שניהם. לכן ריבוע הוא גם מלבן וגם מעוין.` Leave the four shape names. Grade `claim` stays. |

### diff-sq — grade 9, הפרש ריבועים

| | |
| --- | --- |
| Current | Top: `25 − 9 = ?`. Labels `9` and `16` (inner square and remainder; outer:inner pixel ratio 150:90 = 5:3). Formula: `25 − 9 = 16`. Grade `mathLine` is already `5² − 3² = 25 − 9 = 16`. |
| Problem | The card asks a grade-3 subtraction. The identity is `5² − 3²`. The region labels 9 and 16 are the right areas. |
| Suggested | Top stays `ltr`: `5² − 3² = ?`. Formula: `5² − 3² = 25 − 9 = 16`. Do not change grade copy. Do not change the `9` and `16` labels. |

### tri-sort — not in a grade pool (map says ו׳–ז׳, landing page is grade 9)

| | |
| --- | --- |
| Current | Top: `לאיזה סל?`. Baskets: `שווה צלעות`, `שווה שוקיים`, `צלעות שונות`. Formula: `לפי אורך הצלעות`. Scalene sides `3`, `4`, `5`. |
| Problem | Textbook terms take a maqaf, and the third basket is the wrong name. `צלעות שונות` is not `שונה־צלעות`. The 3-4-5 triangle is scalene (pixel sides 36, 48, 60). Sorting by side length is right. |
| Suggested | Baskets: `שווה־צלעות`, `שווה־שוקיים`, `שונה־צלעות`. Leave the top, the formula, and `3` `4` `5`. |

### ruler — grade 3, מדידה

| | |
| --- | --- |
| Current | Top: `כמה ס״מ יש במטר?`. Figure: `1 m`, `10 cm`. Formula: `1 m =` / `100 cm`. Grade `mathLine`: `1 m = 100 cm`. Grade `explain` already uses ס״מ. |
| Problem | The question is Hebrew units; the answer is Latin unit symbols. `1 m = 100 cm` is numerically right. |
| Suggested | Figure: `1 מ׳`, `10 ס״מ`. Formula spans: `1 מ׳ =` and `100 ס״מ`. Remove `dir="ltr"` on that formula `<p>` only, so the Hebrew abbreviations are not reordered. Grade `mathLine`: `1 מ׳ = 100 ס״מ`. |

### coord-walk — grade 7, נקודה במערכת הצירים

| | |
| --- | --- |
| Current | Top: `(3, 2) = ?` (`ltr`). Axis labels `1 2 3` and `1 2`. Point label `(3, 2)`. Formula: `(3, 2)`. |
| Problem | The question prints the answer. The point `(3, 2)` and the three-then-two walk are correct. |
| Suggested | Top: `לאן מגיעה הנקודה?` and turn **off** `ltr` on that top. Leave the point label and the formula. |

### rect-count — grade 7, שטח והיקף

| | |
| --- | --- |
| Current | Top: `שטח או היקף?`. Labels `12`, `4`, `3`. Formula and grade `mathLine`: `4×3 = 12, P = 14`. |
| Problem | `P` is not the Israeli word or symbol for perimeter. The numbers are right: area `4×3=12`, perimeter `2×(4+3)=14`. |
| Suggested | Formula (keep `dir="ltr"`): `S = 4 × 3 = 12,  2 × (4 + 3) = 14`. Grade `mathLine`: `שטח = 4 × 3 = 12, היקף = 14`. |

### prime-rect — grade 6, ראשוניים

| | |
| --- | --- |
| Current | Top: `למי יש מלבן?`. Labels `2×3`, `אין מלבן`. Formula: `6 = 2×3, 7 ≠ □`. Grade `mathLine` is already `2 × 3 = 6, ול־7 אין מלבן`. |
| Problem | `□` is the unknown-box from the balance loop, not “no rectangle”. `אין מלבן` on the figure is the right Hebrew. |
| Suggested | Formula: `6 = 2 × 3`. Leave `2×3` and `אין מלבן` on the figure. Do not change grade copy. |

### triangle — grade 7, שטח משולש

| | |
| --- | --- |
| Current | Labels `a = 6`, `h = 4`, `6·4 = 24` (correct rectangle). Formula: `S = a·h/2` / `= 6·4/2` / `= 12`. Caption: `אותו שטח: 12`. Grade `mathLine`: `S = a·h/2 = 6·4/2 = 12`. |
| Problem | ASCII slash instead of a fraction bar. Caption is telegram Hebrew. The 24 and the half-rectangle story are correct. |
| Suggested | Formula spans, joined: `S = (a · h) ⁄ 2 = (6 · 4) ⁄ 2 = 12`. Caption: `השטח נשאר 12`. Grade `mathLine`: the same formula string. |

### Triangle explorer (diagram, not a loop)

File: `headless/astro-poc/src/components/TriangleAreaExplorer.astro`. Same 6 by 4 triangle.

| | |
| --- | --- |
| Current | Labels `a = 6`, `h = 4`. Readout: `S = a·h/2 = 6·4/2 = 12`. Hint: `גררו את הקודקוד ימינה ושמאלה — הבסיס והגובה לא משתנים, וגם השטח נשאר 12`. |
| Problem | Same slash as `triangle`. The hint is good Hebrew. |
| Suggested | Readout only: `S = (a · h) ⁄ 2 = (6 · 4) ⁄ 2 = 12`. Leave the hint and the labels. |

### pythagoras — grade 8, משפט פיתגורס

| | |
| --- | --- |
| Current | Labels `a = 3`, `b = 4`, runtime `c = ?` then `c = 5`. Formula: `c² =` / `9 + 16` / `= 25`. Caption: `ולכן c = 5`. Grade `mathLine`: `c² = 9 + 16 = 25 → c = 5`. |
| Problem | 9 and 16 are not written as `3²` and `4²` on the answer line. The 3-4-5 arithmetic is correct. Caption Hebrew is acceptable. |
| Suggested | Formula, as one line: `c² = 3² + 4² = 9 + 16 = 25`. Grade `mathLine`: `c² = 3² + 4² = 9 + 16 = 25, c = 5`. Leave the caption and the runtime `c = 5`. |

### mean-cols — grade 8, ממוצע

| | |
| --- | --- |
| Current | Top: `מה הממוצע של 2, 4 ו־6?`. Labels `2`, `4`, `6`, then three `4`s. Formula and grade `mathLine`: `(2 + 4 + 6) / 3 = 4`. |
| Problem | ASCII slash. Column heights 44, 88, 132 px match 2, 4, 6. The mean 4 is correct. |
| Suggested | Formula and grade `mathLine`: `(2 + 4 + 6) ⁄ 3 = 4`. |

### frac-product — grade 6, כפל שברים

| | |
| --- | --- |
| Current | Top: `חצי של שליש — כמה?`. Labels `1/2`, `1/3`, `1/6`. Formula and grade `mathLine`: `1/2 × 1/3 = 1/6`. |
| Problem | ASCII slashes. Overlap area `(80×75)/(240×150) = 1/6` is correct. `חצי של שליש` is the right Hebrew. |
| Suggested | Labels `1⁄2`, `1⁄3`, `1⁄6`. Formula and grade `mathLine`: `1⁄2 × 1⁄3 = 1⁄6`. |

### pct-25 — not in a grade pool (map says ו׳–ז׳, landing page is grade 8)

| | |
| --- | --- |
| Current | Top: `כמה זה 25 מתוך 100?`. Label `25%`. Formula: `25/100 = 25%`. |
| Problem | ASCII slash. 25 of 100 cells is correct. The top is acceptable spoken Hebrew for this grade. Grade fit of the *placement* is a mapping issue, not a text bug. |
| Suggested | Formula: `25⁄100 = 25%`. |

### half-eq — grade 9, משולש 30°–60°–90°

| | |
| --- | --- |
| Current | Top: `מה מול הזווית של 30°?`. Labels `30°`, `60°`, `80`, `160`. Formula and grade `mathLine`: `80 = 160 / 2`. |
| Problem | ASCII slash. The split of an equilateral triangle of side 160 is correct (base 160 px, height ≈ 138.6). The side opposite 30° is 80. The top already asks the right question. |
| Suggested | Formula and grade `mathLine`: `80 = 160 ⁄ 2`. |

### quarter-12 — grade 5, חלק מכמות

| | |
| --- | --- |
| Current | Top is built from spans: `1/4` + ` מ־` + `12` + ` = ` + `?` (the `¼` in `topTexts` is not what renders). Card: `¼ × 12 = 3`. Formula and grade `mathLine`: `1/4 × 12 = 3`. |
| Problem | ASCII `1/4` on the top and on the answer, while the in-figure string already uses `¼`. `1/4 × 12 = 3` is correct. |
| Suggested | Top span `1/4` → `1⁄4`. Card and formula and grade `mathLine`: `1⁄4 × 12 = 3`. |

### tenth-cell — grade 5, עשירית ומאית

| | |
| --- | --- |
| Current | Top: `מה זו משבצת אחת?`. Labels `1/10`, `1/100`. Formula and grade `mathLine`: `1/10 = 10 × 1/100`. |
| Problem | ASCII slashes. One row of 10 cells and one cell of a 10×10 square is the right model. |
| Suggested | Labels `1⁄10`, `1⁄100`. Formula and grade `mathLine`: `1⁄10 = 10 × 1⁄100`. |

### equiv-half — grade 4, שברים שקולים

| | |
| --- | --- |
| Current | Top: `איפה יושב החצי?`. Tick labels `0`, `1`, `1/4`, `3/4`, `1/6`, `2/6`, `4/6`, `5/6`. Point labels `1/2`, `2/4`, `3/6`. Formula and grade `mathLine`: `1/2 = 2/4 = 3/6`. |
| Problem | ASCII slashes only. Tick positions on the 90–450 segment match those fractions. Showing `2/4` and `3/6` unsimplified is intentional. |
| Suggested | Every fraction string above, with `⁄` in place of `/`. Formula and grade `mathLine`: `1⁄2 = 2⁄4 = 3⁄6`. |

### unit-frac — grade 3, שברי יחידה

| | |
| --- | --- |
| Current | Top: `איזה חלק הכי גדול?`. Labels `1/2`, `1/3`, `1/4`. Formula and grade `mathLine`: `1/2 > 1/3 > 1/4`. |
| Problem | ASCII slashes. Bar widths 90, 60, 45 inside a bar of 180 match one half, one third, one quarter. |
| Suggested | Labels and formula and grade `mathLine`: `1⁄2`, `1⁄3`, `1⁄4`, and `1⁄2 > 1⁄3 > 1⁄4`. |

### fraction — grade 4, שבר כחלק משלם

| | |
| --- | --- |
| Current | Top: `איזה חלק של העוגה צבוע?`. Three labels `1/4` (cake, bar, line at 375 on a 330–510 segment, which is the quarter). Formula: `אותו חלק בשלוש צורות: עוגה, פס וישר`. Grade `mathLine`: `אותו רבע בשלוש צורות: 1/4`. |
| Problem | The answer line never says that the part is a quarter, and the labels use an ASCII slash. The three models are the same quarter. |
| Suggested | Labels: `1⁄4`. Formula: `אותו רבע: עוגה, פס וישר`. Grade `mathLine`: `אותו רבע בשלוש צורות: 1⁄4`. |

### two-coins — grade 9, הסתברות

| | |
| --- | --- |
| Current | Top: `מה ההסתברות לשני עצים?`. Coins `ע`, `פ`. Cells `עע`, `עפ`, `פע`, `פפ`. Formula: `P(עע) = 1/4`. Grade `mathLine`: `עץ־עץ: 1 מתוך 4 = 1/4`. |
| Problem | ASCII slash. `P(עע)` puts Hebrew letters inside an LTR formula, which reorders. Four equally likely outcomes, one of them עץ־עץ, is correct. `ע` / `פ` are the usual abbreviations. |
| Suggested | Formula (stay LTR, no Hebrew inside it): `1⁄4`. The cell `עע` already names the outcome. Grade `mathLine`: `עץ־עץ: 1 מתוך 4 = 1⁄4`. |

### similar — grade 8, דמיון משולשים

| | |
| --- | --- |
| Current | Top: `מה נשאר שווה?`. Runtime labels `4` then `8`, `3` then `6`. Label `הזוויות נשארות`. Formula and grade `mathLine`: `פי 2, אותן זוויות` on a `dir="ltr"` node. |
| Problem | Telegram Hebrew, and it sits in an LTR formula so the words can reorder. Doubling 4→8 and 3→6 matches the 80×60 px triangle at 20 px per unit. |
| Suggested | Formula text: `הצלעות פי 2, הזוויות שוות`. Remove `dir="ltr"` on that formula `<p>` only. Grade `mathLine`: the same Hebrew sentence. |

### angle-sum — grade 7, סכום זוויות במשולש

| | |
| --- | --- |
| Current | Top: `כמה זה סכום הזוויות?`. Label `180°`. Formula and grade `mathLine`: `∠ + ∠ + ∠ = 180°`. |
| Problem | `כמה זה` is spoken Hebrew, and it does not say “in a triangle”. The 180° claim is correct. |
| Suggested | Top: `מהו סכום הזוויות במשולש?`. Leave the formula and the grade copy. |

### exterior — grade 8, זווית חיצונית

| | |
| --- | --- |
| Current | Top: `כמה הזווית החיצונית?`. Labels `30°`, `60°`, `90°`, then `90°`, `60°`, `150°`. Formula and grade `mathLine`: `90° + 60° = 150°`. |
| Problem | `כמה` asks for a count. The measure question is `מה גודל`. Remote interiors 90° and 60° sum to the exterior 150°. Label position of `30°`: Not fixed. |
| Suggested | Top: `מה גודל הזווית החיצונית?`. Leave the degree labels and the formula. |

### l-split — grade 7, שטח צורה מורכבת

| | |
| --- | --- |
| Current | Top: `12 + 4 = ?` (`ltr`). Labels `12`, `4`. Formula and grade `mathLine`: `12 + 4 = 16`. Parts are 88×66 and 44×44 at 22 px per unit (areas 12 and 4). |
| Problem | The top gives both addends and never asks for the area. The sum 16 is correct. |
| Suggested | Top: `מה שטח הצורה?` and turn **off** `ltr`. Leave the formula and the grade copy. |

### apples-5 — grade 1, חילופיות

| | |
| --- | --- |
| Current | Top: `2 + 3 או 3 + 2?` (`ltr`). Labels `2`, `3`. Card and formula: `2 + 3 = 3 + 2 = 5`. |
| Problem | `או` does not ask whether the sums are equal. The equality is correct. |
| Suggested | Top: `2 + 3 = 3 + 2?` (keep `ltr`). Leave the formula. |

### transform — grade 9, שיקוף, סיבוב והזזה

| | |
| --- | --- |
| Current | Tops: `מה זה שיקוף?`, `ומה זה סיבוב?`, `ומה זו הזזה?`. Formula: `שיקוף, סיבוב והזזה — הצורה נשארת חופפת`. |
| Problem | `מה זה` is spoken. For grade 9 the copula is `מהו` / `מהי`. `ומה זו הזזה?` already agrees in gender. `חופפת` is the right word. |
| Suggested | Tops: `מהו שיקוף?`, `ומהו סיבוב?`, `ומהי הזזה?`. Leave the formula. |

### para-rect — grade 7, שטח מקבילית

| | |
| --- | --- |
| Current | Top: `האם השטח משתנה?`. Labels `h`, `אותו שטח`. Formula and grade `mathLine`: `הגובה נשאר, השטח נשאר`. |
| Problem | Telegram Hebrew. The claim (height fixed, area fixed) is right. |
| Suggested | Formula and grade `mathLine`: `הגובה לא משתנה, ולכן השטח לא משתנה`. |

### angle-kinds — grade 7, סוגי זוויות

| | |
| --- | --- |
| Current | Top: `איזו זווית זו?`. Labels `חדה`, `ישרה`, `קהה`. Formula: `חדה, ישרה, ואז קהה`. Grade `mathLine` is already a proper definition. |
| Problem | `ואז` narrates the animation instead of naming the three kinds. The three labels are the right terms. |
| Suggested | Formula: `חדה, ישרה, קהה`. Do not change the grade copy. |

### bars — grade 3, מודל פסים

| | |
| --- | --- |
| Current | Top: `לדנה 12 מדבקות. לרון 5 מדבקות יותר מלדנה. כמה מדבקות יש להם יחד?`. Labels `דנה`, `רון`, `12`, `12`, `5`, `12 + 5 = 17`. Formula: `12 + 17 = 29`. |
| Problem | The opening clauses drop `יש`. `יותר מלדנה` is normal school Hebrew. Dana 12, Ron 17, together 29 is correct. |
| Suggested | Top: `לדנה יש 12 מדבקות. לרון יש 5 מדבקות יותר מלדנה. כמה מדבקות יש להם יחד?`. Leave the formula. |

### clock-span — grade 3, משך זמן

| | |
| --- | --- |
| Current | Top: `כמה שעות עברו?`. Clock shows `12`, `2`, `4`, `6`. Label `2 שעות`. Formula and grade `mathLine`: `4 − 2 = 2`. |
| Problem | The answer line is a bare subtraction, not a duration. From 2:00 to 4:00 is two hours. The figure label `2 שעות` is fine. |
| Suggested | Formula: `2 שעות` (keep `dir="ltr"`; the string starts with a digit). Grade `mathLine`: `שעתיים`. |

### map-scale — grade 7, קנה מידה

| | |
| --- | --- |
| Current | Top: `4 × 5 = ?` (`ltr`). Labels `מפה`, `4`, `× 5`, `במציאות`, `20`. Formula and grade `mathLine`: `4 × 5 = 20`. |
| Problem | Nothing in the question says this is a scale. `מפה` / `במציאות` are good words. `4 × 5 = 20` is the right product. Units are not given; do not add ס״מ. |
| Suggested | Top: `קנה מידה פי 5. מה האורך במציאות?` and turn **off** `ltr`. Label `× 5` → `פי 5`. Leave `4`, `20`, and the formula. |

### circ-unroll — grade 8, היקף מעגל

| | |
| --- | --- |
| Current | Top: `כמה קטרים בהיקף?`. Labels `d`, `d`, `d`, `d`, `0.14d`. Formula and grade `mathLine`: `C = πd ≈ 3.14d`. |
| Problem | `πd` and `3.14d` and `0.14d` read as single names. The comparison (a bit more than three diameters) is right. |
| Suggested | Label `0.14d` → `0.14·d`. Formula and grade `mathLine`: `C = π·d ≈ 3.14·d`. |

---

## Clean loops — no text change

37 variants. Current answer line is quoted so the extraction is on record. Suggested text: none.

| Variant | Grade | Topic | Current answer line (and the question, if it matters) | Problem |
| --- | --- | --- | --- | --- |
| tenframes | 1 | השלמה לעשר | `7 + 5 = 7 + 3 + 2 = 10 + 2 = 12` | none |
| add-within | 1 | חיבור בתחום 10 | `3 + 4 = 7` | none |
| birds-sub | 1 | חיסור בתחום 10 | `6 − 2 = 4` | none |
| neighbors | 1 | מספרים שכנים | `7 < 8 < 9`, labels `שכן` | none |
| clock-3 | 1 | שעה שלמה | `3:00` | none |
| sticks | 2 | עשרות ויחידות | `34 = 30 + 4`, headers `עשרות` `יחידות` | none |
| coins-12 | 2 | מטבעות | `10 + 1 + 1 = 12` | none. Do not add ש״ח; the coins are only numbered. |
| polygon | 2 | מחומש | `מספר הצלעות = מספר הקודקודים` | none |
| odd-pair | 2 | זוגי ואי־זוגי | `7 = 3×2 + 1`, label `אי־זוגי` | none. Do not respace `3×2` in this pass. |
| baseten | 2 | חיבור רב־ספרתי | `38 + 25 = 60 + 3 = 63` | none |
| place-123 | 2 | מאות עשרות יחידות | Top `100 + 20 + 3 = ?`. Formula `100 + 10 + 10 + 1 + 1 + 1 = 123`. Both true (two rods of 10). | none |
| cookies | 3 | חילוק עם שארית | `14 = 4 × 3 + 2`, `נשארו 2` | none |
| share-12 | 3 | חלוקה שווה | `12 = 3 × 4`, `בלי שארית` | none |
| jumps-4 | 3 | כפל כקפיצות | `4 × 3 = 12` on `0, 3, 6, 9, 12` | none |
| numberline | 4 | השוואה ועיגול | `47 < 52`, then `47 ≈ 50`. Questions `מי גדול יותר?` / `לאן מעגלים את 47?`. Distances 7 and 3. | none |
| data | 4 | נתונים | `8 + 5 + 3 = 16`. Names `תפוחים` `בננות` `ענבים`. | none |
| mark-250 | 4 | מספרים עד 1000 | `200 < 250 < 300` | none. Crowding: Not fixed (visual). |
| quad-gate | 4 | מרובעים | `4 צלעות`, basket `מרובעים` | none. Digits inside shapes: Not fixed (visual). |
| balance | 5 | מאזניים | `3 + □ = 8`, `□ = 5` | none |
| pattern | 6 | חוקיות | `11 + 3 = 14` for stages 2, 5, 8, 11 | none |
| two-diag | 6 | אלכסונים | `2 אלכסונים` | none |
| sup-angles | 7 | זוויות צמודות | `60° + 120° = 180°` | none |
| peri-rect | 7 | היקף מלבן | `6 + 4 + 6 + 4 = 20` | none. Aspect ratio: Not fixed (visual). |
| obtuse-ht | 7 | גובה במשולש קהה | `הגובה פוגש את המשך הבסיס`, label `h` | none |
| signed-jump | 7 | חיבור על הישר | `−2 + 5 = 3` | none. Thermometer scale: Not fixed (visual). |
| cube-8 | 7 | חזקה שלישית | `2³ = 2 × 2 × 2 = 8` | none |
| box-vol | 7 | נפח תיבה | `3 × 2 × 2 = 12` | none |
| ratio-beads | 7 | יחס | `2:3 = 4:6` | none. Bead letters: Not fixed (visual). |
| sas-snap | 8 | חפיפה צ.ז.צ | `צלע־זווית־צלע`, `התלכדו, והסימנים זהים` | none |
| corr-angles | 8 | זוויות מתאימות | `זוויות מתאימות שוות`, both `60°` | none |
| cyl-stack | 8 | נפח גליל | `V = B·h = 4B`, `h = 4`, `B = πr²` | none |
| signed-ops | 7 | סדר פעולות מכוונים | Top `(−3) + 2 × 4 = ?`. Formula `2×4 = 8, (−3)+8 = 5` | none. Do not respace. |
| area-model | 9 | כפל ביטויים | `(x+3)(x+2) = x² + 5x + 6`, caption `2x + 3x = 5x` | none |
| area-x4 | 9 | הגדלה ושטח | `צלע × 2` … `שטח × 4`. Cell numbers 1–4 count the four copies. | none |
| parab | 9 | פרבולה | `y = x² + 3`. Live label `y = 0` … `y = 3`. Top `מה ה־y של הקודקוד?` | none. The maqaf before `y` is already the right bidi habit. |
| array | not pooled | כפל במערך | `4 × 3 = 12` and `3 × 4 = 12` | none |
| topic-card | not pooled | תבנית זוגית | `2, 4, 6, 8` with the gap filled by 6 | none |

---

## Brief for Claude and Kimi Work

Paste this section as-is. Claude owns the diagram contract and should return replacement strings only. Kimi Work applies those strings. If Claude has not replied yet, apply the suggested strings in this document exactly.

### TEXT ONLY

Change only existing text strings: titles, labels, captions, step texts, answer lines, and notation inside those strings.

You may also flip the existing `dir` attribute on a node when this brief says “turn off `ltr`” or “remove `dir="ltr"`”. That is a bidi fix for the new string, not a layout change.

Do not change layout, positions, colors, shapes, animation, sizes, or CSS. Do not add elements, including a fraction stack, a legend, a `<bdi>`, or a new caption. Do not move a label to stop it overlapping a leg or a vertex. Do not edit `conceptLoops.ts`, aria-labels, or pause-button copy.

If a problem is listed under “Not fixed (visual)”, leave it alone.

Fraction bar means the single character U+2044 `⁄`. Do not use ASCII `/` for a fraction. Do not invent units (ס״מ, סמ״ר, ש״ח).

### Loops to edit

Apply every “Suggested” cell in the problem-loop tables above. The loops are:

1. `trap-area` — top, four labels, formula, grade `mathLine`, grade `explain`.
2. `para-perp` — both `80` labels become `d`.
3. `sq-stretch` — side numbers become `א` `ב` `ג` `ד`.
4. `slope` — formula and grade `mathLine`.
5. `order-ops` — formula only.
6. `quad-tree` — top, formula, grade `mathLine`, grade `explain`.
7. `diff-sq` — top and formula. Keep `ltr` on the top.
8. `tri-sort` — three basket names.
9. `ruler` — two figure labels, two formula spans, remove `dir="ltr"` on that formula `<p>`, grade `mathLine`.
10. `coord-walk` — top, and turn off `ltr`.
11. `rect-count` — formula and grade `mathLine`.
12. `prime-rect` — formula only.
13. `triangle` — formula spans, caption, grade `mathLine`.
14. Triangle explorer readout only (`TriangleAreaExplorer.astro`).
15. `pythagoras` — formula and grade `mathLine`.
16. `mean-cols` — formula and grade `mathLine`.
17. `frac-product` — three labels, formula, grade `mathLine`.
18. `pct-25` — formula.
19. `half-eq` — formula and grade `mathLine`.
20. `quarter-12` — top span, card label, formula, grade `mathLine`.
21. `tenth-cell` — two labels, formula, grade `mathLine`.
22. `equiv-half` — every fraction label, formula, grade `mathLine`.
23. `unit-frac` — three labels, formula, grade `mathLine`.
24. `fraction` — three labels, formula, grade `mathLine`.
25. `two-coins` — formula and grade `mathLine`.
26. `similar` — formula, remove `dir="ltr"` on that formula `<p>`, grade `mathLine`.
27. `angle-sum` — top only.
28. `exterior` — top only.
29. `l-split` — top, and turn off `ltr`.
30. `apples-5` — top only. Keep `ltr`.
31. `transform` — three tops.
32. `para-rect` — formula and grade `mathLine`.
33. `angle-kinds` — formula only.
34. `bars` — top only.
35. `clock-span` — formula and grade `mathLine`.
36. `map-scale` — top (turn off `ltr`) and the `× 5` label.
37. `circ-unroll` — `0.14d` label, formula, grade `mathLine`.

### Do not edit

`tenframes`, `add-within`, `birds-sub`, `neighbors`, `clock-3`, `sticks`, `coins-12`, `polygon`, `odd-pair`, `baseten`, `place-123`, `cookies`, `share-12`, `jumps-4`, `numberline`, `data`, `mark-250`, `quad-gate`, `balance`, `pattern`, `two-diag`, `sup-angles`, `peri-rect`, `obtuse-ht`, `signed-jump`, `cube-8`, `box-vol`, `ratio-beads`, `sas-snap`, `corr-angles`, `cyl-stack`, `signed-ops`, `area-model`, `area-x4`, `parab`, `array`, `topic-card`.

Also do not edit: `HeroLoop.astro`, `GradeLoopPlayer.astro` chrome, `conceptLoops.ts`, aria-labels.

### What Claude should return

For each loop in the edit list: the exact Hebrew or math string that replaces each current string, and nothing else. If a suggestion above should be worded differently, return the new string only. Do not propose new labels, new captions, moved text, or a redraw.

### Not fixed (visual) — do not touch

`trap-area` label positions, `peri-rect` rectangle size, `exterior` position of `30°`, `mark-250` tick spacing, `ratio-beads` letters `א`/`כ`, `quad-gate` digits inside the shapes, `signed-jump` thermometer spacing.
