# FIXLOG — G9-KITE level c

All edits in pkg/level_c.py only (kit.py and content.py untouched by this writer).

1. Coordinate plane (q19) refused at max_width 210: set max_width=330.
2. G78 letter size: plane letters are 9.5pt (house); Euclidean labels were 10.5pt -> label size 12.67 (LBL) so the sheet prints one letter size.
3. Deliver refused PACKAGE 'G9-KITE' (shared content.py). Ran checks in a scratch sandbox with a placeholder until the coordinator set PACKAGE = "G9-T99" in content.py; sandbox then deleted. Official locked_check run afterwards.
4. Words questions (q6, q7, q11): typed lengths/angles in to_construct and a typed angle target cannot be measured without a figure -> moved to text strings; angle targets became value targets; added point S to q6's construction objects.
5. q13: one fact given in one item and proved in another -> item א proves the shape (kite) instead of AB=AD.
6. q16 ב / q18 ד: argued clause naming ABCD read as restating the given shape -> reworded without ABCD.
7. Right-angle marks (q4, q5, q8) declared as givens at the marked vertex, and the text states the same relation (BH⊥CH, ET⊥HT, VW⊥VX).
8. Find labels with digits (q11) leaked into noam-ai.json -> relabelled without numbers.
9. PDF text layer flattened 13^2 to '132' (numbers not in data) -> integer squares printed as their values (169, 225, ...); the q4 ג line rewritten so it still shows AB²+BC²=AC².
10. q1 ב and q10: a claim to prove was written as a fact -> asked only after 'הוכיחו כי'; q10 stem no longer says the kite 'may be a rhombus'.
11. Didactic D12: find values printed in the item text (q6 א/ב, q7 ג, q14 ב, q16 א) -> targets turned into proof/decision values; q14 ב no longer prints 60, which was the answer of q14 א (leak).
12. Didactic D8/D4/D2/D9 REVIEWs: equalities stated in stems declared as givens (q2, q3, q14); helper segments LX, NY and diagonals KM etc. named in text; 'בנו משוואה' -> 'כתבו משוואה'. Result: FAIL 0, REVIEW 0.
13. Lint: digit-led island before a period (q1, q11, q12, q14, q15, q20), one-letter angle in q20's key -> reworded.
14. Subtitle no longer repeats 'מצוינות'; q14 figure enlarged (size 260).
15. Level dict sets curriculum track ט_רגילה (content.py default 'ט' matches no sequence) — coordinator may want this in content.py for all levels.

## Review round 1 (REVIEW_c.json, FIX_NEEDED, 10 MAJOR / 6 MINOR)

- C-01 q8 ד: no longer prints WY = 69, which is the answer of ג. The item now gives WY=PR and XZ=QS (typed equal_length) and asks two questions: are the areas equal (yes, by ב), and is WXYZ a kite (not necessarily). Leak scan fixed: it used to subtract item-level givens, so it missed this leak. It now compares every later item text and given with every earlier answer, and it flags the old build.
- C-02 q4: new data AB=AD=20, CB=CD=37, BD=24, giving AO=16, OC=35, AC=51, area 612 and perimeter 114. ג now asks whether ∠ABC is right (no: 1769 vs 2601) and computes the area again from △ABC and △ADC. ד: BH=840/37. Figure redrawn; the fam tag is now quad.kite+altitude-to-side, since the side angles are no longer right.
- C-03 q7: sides 5 and 6. BD=11 is impossible, 0<BD<10, and BD=8 gives AC=3+2√5. The ∠ABC check compares 61 with 29+12√5 (not right). The construction starts from BD=8. The decimal roots are gone.
- C-04 q6: KM=10, KS=3, KL=5 and no LN given. א derives LN=8, ב gives ML=√65, area 40 and asks whether ∠KLM is right (no). The rhombus question was dropped. Construction room raised to 250pt.
- C-05 q5: new design, a kite from a reflection, PQRS with S the image of Q in line PR. ב is now a general theorem: with perpendicular diagonals, two adjacent sides are equal iff the diagonal through their common vertex bisects the other, so such a quadrilateral is a kite iff one diagonal bisects the other. It is no longer a number counterexample, which would repeat a q17 ב and b q11 א. ג kept.
- C-06 q9: data AB=34, CB=50, AC=56, with no student-claim frame. א: O is not the midpoint of AC, otherwise AB=CB by SAS. ב: t=16, BO=30, BD=60. ג: area 1680. I did not use the reviewer's 25/51/52 numbers because they give AO=7, BO=24, BD=48, which is b q14's kite.
- C-07 q12: E and F on the secondary diagonal with OE=OF, giving inner kite AECF and area ratio EF/BD. Data AB=15, CB=41, BD=18: area 468, and OE=3 gives one third. ד: with OE≠OF there is no pair of equal adjacent sides. I did not use the reviewer's 26/40/48 numbers because they share OC=32, CB=40 and BD=48 with b q14. The figure uses OE=6, which is not the answer position. Enlarged (size 300) with label directions for E, F and O.
- C-08 q14: KLMN and the second figure dropped; the context is now a mosaic, because level a has a garden. א: area = BC·h. ב: bound 60, using א. ג: BD=120/13. ד: perimeter 36, a≠b with an even sum, so the maximum is 80 at sides 8 and 10.
- C-09 q3: ∠BAD=4x−100, ∠BCD=x, ∠ABC=2x+50, so x=40 and the angles are 60, 40, 130, 130. ∠ABD=60, ∠CBD=70, ∠BPC=60. I did not use the reviewer's 3x+10, which is b q15's expression. Figure redrawn.
- C-10 q19: K, L, N are given; M on the positive x-axis always gives a kite with heads K and M. ∠KLM right gives M(9,0); area 78, perimeter 10√13. The figure plots points only, so the y-axis label 5 is back on the left (C-14). The key avoids "(m+4)^2", which flattened to "4)2" in the text layer.
- C-11 q13 ג: now "AB=AD and AC bisects BD" (sufficient). The stem now warns not to infer from the figure.
- C-12 q20: B differs from P and S, stated in the stem and used in the ג key. ב: "show the area does not depend on B and compute it" (252); it is not printed as a value because of D12.
- C-13: no change, as the reviewer allowed. C-15: engine behaviour (radicals drawn as vector paths), nothing to change in the level. C-16: STATUS now has a G79 line and the leak line is corrected.
- Engine refusals met on the way, and their fixes:
  - q14 א / q12 א: a claim was read as a stated fact. q14 א now says "kite with heads A and C". The q12 stem no longer names the polygon AECF (the engine read "AE … FA" as a stated AE=AF), and q12 ד names the four vertices instead.
  - q6 ג / q7 ד: the construction find values contained numbers, so they are now worded without numbers.
- Final: locked_check CHECKED (didactic 92/0/0), review_keys 44/0, self_scan 0, leak/text 0, lint 0. Every changed page was re-rendered and looked at.

## Cross-level round (coordinator, after level a revision)

New script `scratch/c/cross_levels.py` reads the live `level_a.py` and `level_b.py` (read-only) and compares them with level c in two ways: number sets of 2 or more shared values ≥ 13, and exact right triangles that appear in both. Collisions found and changed in level c:

- **q12:** the data 15/41/18 were a q18's whole kite. I first moved to 35/75/42, but that shares the 21-28-35 triangle and BD=42 with b q16, and 51/75/90 shares 45/60/75 with b q14. Final data: AB=65, CB=89, BD=78, giving AO=52, OC=80, AC=132, area 5148, and OE=13 for one third. E and F are drawn at OE=20.
- **q4:** 20/37/24 used the 12-16-20 half-triangle with BD=24 from b q4. 41/58/80 used the 9-40-41 triangle of a q18. Final data: AB=52, CB=73, BD=96, giving AO=20, OC=55, AC=75, area 3600, perimeter 250, ∠ABC not right (8033 vs 5625), BH=5280/73.
- **q8:** 29/40 (the 20-21-29 triangle with a diagonal of 40) was b q5's equation. Final data: area 3300, QS=66, PQ=55, giving PR=100, PO=44, OR=56, RQ=65, perimeter 240. WXYZ was redrawn with WY=100 (split 40/60) and XZ=66 (split 26/40).
- **q1:** head angles 70/50 with side angle 120 were a q4's numbers. Now 64/46, so ∠BAD=125, and the ד argument compares 32° with 23°.
- **q15:** angles 50/110/100 were the kite of b q15. Now ∠XKY=40 and ∠LMN=110, so the side angles are 105, ∠KLN=70 and ∠NLM=35.

The sets level a newly took (35/53/56, 39/72/42, 25/39/24) are all avoided. Result: locked_check CHECKED (didactic 92/0/0), review_keys 44/0, self_scan 0, leak/text 0, lint 0. Pages 1, 3, 6, 9 and 12 were re-rendered and looked at.

## Confirm round 2 (CONFIRM_c.json, FIX_NEEDED 4 MAJOR / 4 MINOR)

- **CF-01 q12 ד:** the item now opens with 'בנתוני סעיף ג'. The key cites AO=52 and OC=80, so the rhombus case, where AO=OC, cannot break the "no" answer.
- **CF-04 q20:** the rectangle is now 24×40 (it was 24×21). That gives area 480 (ב), t from 1 to 39, PB = 5 or 35, sides 13 and 37 (ג), perimeter 100 (ד). The key lists t by (s−t)(s+t)=144 with even factors. B is drawn at PB=14, which is not an answer. Exactly the kite-level-a q4 set (13/20, 21/24, 252, 66) is avoided. The 12-35-37 triangle also appears in G9-T19 a q12 in a different role; the reviewer judged this acceptable.
- **CF-05 q8 ד:** the key now gives a concrete counterexample: WV=40, VY=60, XV=26, VZ=40 (the drawn WXYZ). The areas are equal, neither diagonal bisects the other, and by 5 ב the quadrilateral is not a kite.
- **CF-06 q15:** ∠LMN=124°, so ∠KLM=98°, ∠KML=62°, ∠KLN=70°, ∠NLM=28°. Figure redrawn.
- **CF-07 q9:** the old opening "O is not the midpoint" item is gone. Item א now asks why BO is half of BD, sets up the equation and finds t=16 and BD=60. Item ב is the area, 1680. The key notes that t ≠ 28. Level c now has 71 items.
- **CF-02 / CF-03:** coordinator decisions. b changes q9 and a changes q15; c keeps q6 and q3.
- **CF-08:** `cross_levels.py` now compares every value ≥ 3 and flags pairs sharing 3 or more values; STATUS lines and hashes are corrected.
- **Result:** locked_check CHECKED (didactic 91/0/0), review_keys 44/0, self_scan 0, leak/text 0, lint 0.
