# FIXLOG — G9-KITE level a

All edits in pkg/level_a.py only. kit.py and content.py were not touched.

| # | Found by | Problem | Fix |
|---|---|---|---|
| 1 | deliver | content.py `CURRICULUM` track `ט` is not an official sequence | level_a.py sets `curriculum=dict(topic="kite", track="ט_רגילה", grade="9")` (content.py uses setdefault). Levels b and c need the same, or content.py should be fixed |
| 2 | deliver | PACKAGE `G9-KITE` is refused (not a site id) | first checked on a scratch copy (scratch/a/fake, `G9-T99` placeholder, never delivered); then the coordinator set `G9-T99` in content.py and the official run went through. Noam's decision is pending (EYE_CHECK_a) |
| 3 | deliver | q7c text read as asking to prove AB = AD, which is a given | reworded: "...ובדקו מה נותן הפתרון שלו לשתי הצלעות שנפגשות בקודקוד A" |
| 4 | deliver N1 | marks with no exact given: q8 right angle at M, q12 right angle at O, q14 four-way ticks | declared `perpendicular at M (EM, FM)`, `perpendicular at O (OQ, OR)`, `equal_length KL LM MN NK` |
| 5 | deliver D11 | q20 stem named BE and DE together with "=", read as stating EB = ED | stem now says E "מחוברת בקטעים לקודקודים B ו־D" |
| 6 | didactic D12 | text-answer values printed numbers or tokens of the stem (q7c, q10a) | text-only answers rewritten with no digits or relation symbols (also q6b, q18c, q19c, q2c checked) |
| 7 | didactic D4 | tick marks covered by givens not written in the text (q4, q6, q11, q13, q15, q18, q20) | stems now state `AB=AD ו־CB=CD` |
| 8 | didactic D11 | after #7, q15c `BD=CB` would be stated by the stem | q15c now proves `△BCD` equilateral (shape target). The key derives BD=CB=CD |
| 9 | didactic D2 | q18 draws AC without naming it | stems of q6, q11, q18, q20 name "האלכסונים AC ו־BD" |
| 10 | didactic D12 REVIEW | q18c printed 40, which equals the answer OC = 40 | hypothetical perimeter changed to 44 (CB = 7 < BO = 9, still impossible) |
| 11 | didactic D9 | q2c "הוסיפו נתון" read as a construction request | "כתבו נתון נוסף אחד" |
| 12 | didactic D4/D8, deliver | q14: the equation in the text, then the word מעוין as a shape given, were refused or raised D8 | the text states the equality in words; one D4 REVIEW kept (EYE_CHECK) |
| 13 | eye | q11 label A crowded against O | label direction set outward |
| 14 | eye | q10, q17, q19 split across pages | `keep=True` (break-inside: avoid) |
| 15 | eye | q20 figure small and crowded | rotated to a horizontal main diagonal, size 230; q12 size 200 |
| 16 | text check | `$169$.` digit-led island against a period (q11 key) | "ולא $169$ כפי שנדרש." |
| 17 | self scan | the role classifier first matched "גדר" inside "הגדרה" and "בנו" inside "לבנות" | word-boundary rules in self_scan.py; real sequences are all distinct |

Tried and reverted: room 192 pt for the words questions (the page count did not change). Back to 200 pt, giving 71.5 mm.

## Round 2 — after REVIEW_a.json (FIX_NEEDED) and the coordinator's decisions

| Review id | Change in pkg/level_a.py |
|---|---|
| A-R01 q5 (same set as b q16) | KL=KN=35, ML=MN=53, LN=56 → KO=21, MO=45, KM=66. The reviewer's 13/37/24 was not used: its 5-12-13 / 35-12-37 met level c q9, and my first choice 41/50/80 met level c's rewritten q9 (30-40-50) and q12 (9-40-41) |
| A-R02 q7 (shifted equation of b q7) | AB=3x−4, AD=x+6, CB=2x+4: x=5, AB=11, perimeter 50. Tal's error is now AD=CB, giving x=2 and the contradiction AB=2, AD=8. Figure redrawn 11:14 |
| A-R14 q7 ticks | ticks removed (the stem says the heads are A and C); fam `quad.kite`; the q7 D4 REVIEW is gone |
| A-R03 q11 (c q9 design, 5-12-13) | AB=39, BD=72, AC=42 → BO=36, AO=15, OC=27, CB=45. Dana's AO=21 gives 1737, not 1521. Item ג is now the perimeter, 168 (was an area). The reviewer's 25/30/56 was not used: 15-20-25 is b q5's triangle with the legs role-swapped |
| A-R04 q13 (shifted equation of b q15) | ∠ABC=115°, ∠BAD=3x−10, ∠BCD=2x → x=28, 74° and 56°, then 37° and 28° |
| A-R07 q14 (role pair of b q12) | ב now asks that each diagonal bisect the two angles at its ends (text targets); ג asks whether this holds in every kite. K04 replaces K07 here; K07 stays in q5, q11, q12, q17, q18, q20 |
| A-R08 q9ג (same item as b q10ג) | new point P on AB with AP=2 (drawn, given). ג: the image Q under reflection in AC lies on AD with AQ=2; CP and CQ are equal because C is on the axis. fam `quad.kite+main-diagonal+side-point` |
| A-R09 q15 (angle set of an earlier sheet) | ∠BAD=40°, ∠ABC=130° → ∠ABD=70°, ∠DBC=60°, △BCD equilateral; Yoav's wrong value is now 65° |
| A-R11 q16 (no marks for ∠SRT=∠URT) | DRAW_SRC draws `arcs` and registers a marked `equal_angle` (`g.ex.constrain`, dict operands), so verify_export M1 maps both arcs |
| A-R12 lone page | q20 figure size 190: "בהצלחה!" closes page 11; 14 pages |
| A-R13 scan scope | new scratch/a/cross_scan.py (a against built b and c). STATUS records the scope of self_scan as within-level |
| collision found by cross_scan | q12 garden had b q5's kite (25/29/40 → 15, 21). Now PQ=25, PR=39, QO=24 → PO=7, OR=32, RQ=40, area 936 m², perimeter 130 m |
| A-R05 q19, A-R06 q20, A-R10 q8/q17 | kept, by the coordinator's decision (level c changes) |

Engine refusals on the way: q9ג first declared `CP = CQ`, but Q is drawn by the student and not in the SVG. It is now a worded target. q14ב's typed equal_angle targets raised D11, so they became text targets. q14's stem now names the diagonals KM, LN (D2).

## Round 3 — after CONFIRM_a.json (FIX_NEEDED: 3 MAJOR, 7 MINOR); levels b and c frozen

| Confirm id | Change in pkg/level_a.py |
|---|---|
| CA-01 q7 | AB=2x+3, AD=4x−13, perimeter 84 → x=8, AB=19. ב is now "rebuild CB from the perimeter": CB=23. ג: Tal sets AD=CB → x=9, AB=21, AD=23, a contradiction. No x+6, x+10, x=5/6/7, or side 10/11/16 (b q7) |
| CA-02 q15 | ∠BAD=36°, ∠ABC=132° → ∠ABD=72°, ∠DBC=60°, △BCD equilateral; Yoav's wrong value is 66° |
| CA-03 q5 | same kite (35/53/56), new roles: א the main-diagonal theorem gives KM⊥LN through O, then KO=21; ב MO=45; ג Noa took MO−KO: which same-side assumption, why KM=KO+OM, KM=66. The twin-median collinearity proof (b q18) is gone |
| CA-04 q11 | AB=65, BD=120, AC=105 → AO=25, OC=80, CB=100, perimeter 330. Tried and dropped: 65/112/75 (c q8's 33-56-65), 61/120/91 (kite almost flat at A). Not the reviewer's 50/80/72 (30-40-50 in c q9) |
| CA-05 q20 | ב: why AE⊥BD and O is the midpoint of BD, and express area ABED by AE and BD. The kite-identification item is gone |
| CA-06 q14 | ג: ∠LKN=76° → ∠OKL=38°, ∠OLK=52°, ∠KOL=90°; the rhombus is redrawn at 76°. The reviewer's 50° shared {25, 50, 90} with c q18 (the new angle-set check found it) |
| CA-07 q9 | P drawn as a dot (DRAW_SRC `dots`); AP=1 (was 2) so P is far from AB's midpoint tick; key AQ=1 |
| CA-08 q6 | AC=17, BD=8, area 68 |
| CA-09 q18 | AB=20, BD=32, perimeter 170 → AO=12, CB=65, OC=63; Gil's 44 gives CB=2 < 16. Tried and dropped: 13/24/100 (c q20's 12-35-37), 17/30/84 (c q9's kite halved, the new S check) |
| CA-10 | cross_scan.py rerun against the live b and c; new A (angle set) check and a listing of every same-role pair; STATUS rewritten from its output |
| layout | q20 items space 30 and ב shortened to one line: 14 pages, בהצלחה closes page 11. q18 figure size 200 |

## Round 4 — after CONFIRM_a_round3.json (FIX_NEEDED: 2 MAJOR, 1 MINOR)

| Id | Change |
|---|---|
| R3-01, R3-02 q7 | New design: the expressions for both pairs are given and there is no perimeter. Data: AB=x+4, AD=2x−1, CB=2x−3 (heads A, C). א: x=5, sides 9 and 7, positivity checked. ב: Noa's CB=x−8 gives a negative length; x is fixed by AB=AD alone. ג: BD=20 is impossible because BD<AB+AD=18 (triangle inequality). Roles: solve, feasibility, decide, unlike b q7 (solve, calc from the perimeter, pupil's perimeter claim). No circular step. Figure redrawn at 9:7 |
| R3-03 q11 key | א: AO²=4225−3600=625, AO=25 and not 52.5, so O is not the midpoint of AC |
| text check | the island `$2x−3$` stood against a period in q7ב; reworded ("... במקום $2x−3$ שבנתונים.") |
