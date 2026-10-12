# FIXLOG — G9-KITE level b

Written 2026-10-11 from WRITER_VIEW_G9-KITE.json (approved original blueprint). No source PDF exists or was read. Tool pattern only: batch-06/G9-T19 kit.py (figkit drawing route, words-question convention); no question, number or structure taken from it. Other writers' level files and the excluded kite folders were not opened.

## Build / engine findings
1. `deliver` refuses `PACKAGE = "G9-KITE"` (PACKAGE_RE `G<grade>-T<nn>`). content.py is shared and may not be edited; no site id may be invented. This is an open blocker (EYE_CHECK_b.md). Content checks run on a probe copy: `scratch/b/probe_build.py` copies kit.py and level_b.py unchanged and a content.py whose only change is `PACKAGE = "G9-T99"`, then builds under the shared `build-resource.lock`.
2. Figures: own `_draw` in level_b.py (figkit.Figure, data units, uniform scale). The replay source is `inspect.getsource(_draw)`, so figures/<id>.py doesn't import the level.
3. `curriculum` set in the level to `track="ט_רגילה"`, `topic="kite"` (blueprint registry). content.py's `CURRICULUM` uses `setdefault`, so this doesn't touch the other levels.

## Fixes made on the way to a clean probe
- deliver D8 text vs model: the q7 givens `ln(RS,11)` and `ln(TS,13)` clashed with the printed expressions `RS=2x+1` and `TS=3x−2`. The expressions became a free-text given, and the model keeps the solved lengths.
- deliver D8: q14ג printed a hypothetical "BD = 50". It's now phrased without naming the segment.
- deliver N1: the q6 right-angle mark wasn't a stated given. The mark was removed; `perp(AC,BD)` is still a given. On q16 the mark at L is declared as `perpendicular at L`.
- deliver find-leak: the q14ג stored value held 25, a given that only the figure prints. The value text is now number-free.
- deliver numbers-not-in-data: numeric squares such as `15^2` are extracted as "152". All numeric squares in keys and the example are now products, for example `15·15`.
- deliver: q15א had an `equal_angle` target that the stem's angle expressions state. It's now an identification target.
- didactic D12 FAIL ×4: q9א, q9ג, q10ג and q13ג stored values repeated stem numbers. The values were rephrased without numbers. q13ג now asks for the choice of C "at the same distance as A".
- didactic D9: the construction items q9ג, q11ג, q13ג and q17ג now declare `to_construct`.
- didactic D2: q4 and q16 stems now name the drawn diagonal AC.
- didactic D8: q8ג declares AC=14 and BD=10 as item givens.
- didactic D12 / leak: q5ב printed "15", the q5א answer. It's now "EG ארוך פי שניים מ־ET".
- Stray center label O removed from q2 and q15, which draw only the main diagonal.
- Shape variety: q7 changed to s=7, because s=5 was too flat and s=9 looked square-like. q10 changed to s=5, rot −15.
- Sentence-final periods after a digit were rephrased in the keys of q1, q10, q14, q16, q17 and q19, and in the q7 and q15 stems.
- Self-scan: the 3-4-5 triangle was used in both q13 and q17 in the same role, so q17ב now asks for the rhombus split instead of the side. The 6-8-10 triangle was in q16 and q19, so q19ג became a feasibility bound: the largest whole secondary diagonal, 19.

## Final probe state
GATES all pass · verify_export 0 · selfcheck 0 · didactic PASS 83 FAIL 0 REVIEW 0 · review_keys 30/30 exact, 99 model checks ok · self_scan 0 · text_checks 0 · 16 pages looked at.

## Official run after the coordinator's alias (2026-10-11)
The coordinator set `PACKAGE = "G9-T99"` (local alias) in content.py. `locked_check.py G9-KITE b` → VERDICT CHECKED (evidence `scratch/technical-20261011T135726/`). level_b.py and the PDF have the same sha256 as the probe. G79: not run, because it applies only to wspec figures and these are figkit; this is recorded, not claimed. review_keys, self_scan and text_checks were re-run on the official `out/deliver/b`: 0 findings.

## Round 2 — fixes after REVIEW_b.json (FIX_NEEDED, 8 MAJOR / 13 MINOR), 2026-10-11
The coordinator split the work: levels a and c resolve their pairs with b, so b keeps q7, q12, q15, q16 (design) and q18. b must fix what it shares with outside sheets, plus the minors. Pre-fix copy: `scratch/b/fix2/level_b.before_review.py`. Patch: `scratch/b/fix2/patch_review.py`.

The reviewer's replacement numbers were re-checked against the LIVE level_a.py and level_c.py, which were being edited during this run. One suggestion was rejected for that reason: B-01's 20/34/32 kite uses the 16-30-34 triangle, which live c q9 prints (AB=34).

**MAJOR**
- **B-01 q4:** new kite AB=AD=26, CB=CD=30, BD=48, so AO=10, CO=18, AC=28 and the area is 672. The figure now draws only BD, and the student draws AC and marks O (a new family tag, `quad.kite+secondary-diagonal`), which keeps the kite+both-diagonals tag at 3. The worked example shows the square-root step (B-16).
- **B-02 q5:** new data FH=20, ET=6, TG=15, so EG=21 and the area is 210. The q5 Pythagoras step is dropped; K10 is still tested in q4, q13, q14, q16 and q20. The key is precise for the non-rhombus case (B-18).
- **B-07 q8:** the bounding rectangle and its sentence are gone. The new route uses BD as the common base of △ABD and △CBD with heights AO and CO, then area = AC·BD/2 and an inverse item. The data AO=4, OC=11, BD=10 avoid T19's AC=14.

**Minor fixes**
- **B-09 q2:** angles changed to 84/116, keys 80/42/58/80. The example changed to 96/40, giving 112.
- **B-10 q10ג:** the item is now the head-angle error: the reflection in AC swaps B and D and doesn't map ∠BAD to ∠BCD.
- **B-11 q11:** the counterexample is now 1 and 3 on AC, 2 and 4 on BD. ב is now "CB=CD and O the midpoint of BD".
- **B-13 q9:** AC=10, BD=8, AO=3. Key units added (B-17).
- **B-19:** q13ג and q17ג get the sentence "אפשר לבנות את שניהם על אותו קטע/אלכסון". Rooms are now 85.6 and 96.2 mm.
- **B-20:** given right angles are marked and declared at the point. q6 states "$AO⊥BO$"; the ∠AOB=90° wording drew a D4 REVIEW. q20 marks the right angle at A.
- **B-21:** STATUS now says the self-scan is within-level only. A new `scratch/b/cross_scan.py` compares b with the live levels a and c.

**Changed beyond the review list**
- **q16:** the design is kept, but the live level c q11ב prints the same 10/17 kite with BD=16, AC=21 and area 168. New rods 29 and 35, BD=42: AO=20, CO=28, AC=48, area 1008. The right-angle kite's area is 1015.
- **q14:** the live level a q12 printed the same 25/40 kite with a 48 cross-stick and 39 along the main diagonal. New frame 45/60, stick 72: AC=75, area 2700, and the infeasible stick is 90.
- **q20א:** the find value 45° collided, in noam-ai.json (didactic D12), with the q14 labels "45". q20א now asks why △AOB is right-angled and isosceles, and ב gives AO=5.
- **Layout:** q20 spaces were tightened so "בהצלחה!" doesn't sit alone on a page. Total 15 pages.

**Kept and recorded:** B-12 q19 (perimeter and table add to c q7), B-14 q3/q6 (forced theorem steps), B-15 (the Pythagoras chain recurs in q4, q14, q16 and q20).

**Final state:** official locked_check CHECKED (`scratch/technical-20261011T143756`): GATES all pass, verify_export 0, selfcheck 0, didactic PASS 82 FAIL 0 REVIEW 0. G79 is not applicable on the figkit route. Deliver re-measured 96 constraints. review_keys: 31/31 exact, 100 model checks. self_scan, text_checks and cross_scan: 0 findings. All 15 pages re-rendered and looked at.

## Round 3 — fixes after CONFIRM_b.json (round 2: FIX_NEEDED, 3 MAJOR / 5 MINOR), 2026-10-11
Level c is frozen for this round. Level a is revised after this level. Pre-fix copy: `scratch/b/fix2/level_b.before_confirm.py`.
- **C-01 q7:** new equation `RS=3x−2`, `RU=x+10`, perimeter 52. א: x=6, RS=RU=16. ב: TS=TU=10 rebuilt from the perimeter. ג (רון): at perimeter 60, x stays 6 and only TS changes, to 14. The figure was redrawn as a 16/10 kite (s=8). Targets are typed lengths, `Ln(RS)` and `Ln(TS)`. None of x+6, x=5 or 11 is reused.
- **C-02 q18:** unchanged, per the coordinator: the proof stays in level b and level a q5 moves. The G9-T19 a q7 route (AP=AQ ...) was not used.
- **C-03 / C-07 q9:** now AC=9, BD=4, AO=2, so OC=7 and BO=OD=2. This leaves the c q6 kite (10/3/8) and fits the 76.8 mm room.
- **C-04 q11ב:** back to "AB=AD and AC⊥BD". The key goes from isosceles △ABD (altitude is also the median) to the perpendicular bisector, then CB=CD by SAS, then the kite.
- **C-05 q14:** kept; level a moves its q11.
- **C-06 q8:** the route is kept and the numbers changed to AO=4, OC=7, BD=10: triangle areas 20 and 35, AC=11, kite area 55. ג is kept. I tried the reviewer's 4/9/10 first; its △CBD area 45 failed didactic D12 because noam-ai.json prints "45" as a q14 frame label.
- **C-08 q5:** ET=4, TG=14, FH=20, so EG=18 (the student's value would be 8) and the area is 180.
- **Checks:** official locked_check CHECKED (`scratch/technical-20261011T150032`): GATES all pass, verify_export 0, selfcheck 0, didactic PASS 82 FAIL 0 REVIEW 0. Deliver re-measured 96 constraints. G79 is not applicable on the figkit route. review_keys 32/32 exact, 101 model checks. self_scan, text_checks and cross_scan (vs live a and frozen c): 0 findings, INFO only. G9-T19 spot check of the new numbers: none found. Pages 3–7 and keys 13–14 re-rendered and looked at.

## Round 4 — CONFIRM_b_round3.json R3-02 (MINOR), 2026-10-11
- q5 figure: the vertex label E sat inside the kite near T and read as a point on the diagonal. It now uses `prefer={"E": (-0.26, 0.97)}`, the outward direction of head E, so it prints below the vertex, outside the kite. Nothing else changed.
- Official locked_check CHECKED (`scratch/technical-20261011T151527`): GATES all pass, verify 0, selfcheck 0, didactic PASS 82 FAIL 0 REVIEW 0. review_keys, self_scan, text_checks and cross_scan: unchanged, 0 findings. q5 re-rendered and looked at.
