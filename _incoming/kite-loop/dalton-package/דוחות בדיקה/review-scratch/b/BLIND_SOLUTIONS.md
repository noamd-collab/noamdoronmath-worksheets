# G9-KITE level b — blind solutions (student pages 1–13 only, before the key)

Sheet: pkg/out/deliver/b/sheet.pdf, 16 pages; key starts on page 14 (index 13, "מפתח פרטי"). Student pages rendered at 2x into review-scratch/b/png/p00..p12.png and looked at one by one. Figure checks: vertex pixel coordinates read off the 2x renders, lengths/angles computed.

## Q1 (table of 5 quadrilaterals, sides AB, BC, CD, DA)
- א. Kites: 1 (5,5,8,8: AB=BC, CD=DA), 3 (7,7,7,7: rhombus, inclusive), 4 (11,4,4,11: BC=CD, DA=AB). Not kites: 2 (6,9,6,9: opposite sides equal, no adjacent equal pair), 5 (4,4,4,9: three equal sides, the fourth pair 4,9 is not equal).
- ב. Quad 1: heads B and D, main diagonal BD.
- ג. The two pairs must be separate (disjoint); AB=BC and BC=CD share BC, and the remaining pair is CD=4, DA=9, not equal.
- ד. Quad 3: pairs AB=BC & CD=DA -> heads B, D, main diagonal BD; or BC=CD & DA=AB -> heads C, A, main diagonal AC.

## Q2 (AB=AD, CB=CD, ∠BAD=70°, ∠BCD=130°; worked example 80/40 -> 120)
- א. ∠ABC = (360−70−130)/2 = 80°.
- ב. AC bisects head angles: ∠BAC = 35°, ∠ACD = 65°.
- ג. In △ACD: ∠DAC=35°, ∠ACD=65°, ∠ADC = 180−35−65 = 80° = ∠ABC.
- Figure: measured ∠BAD 70.0°, ∠BCD 130.2°, AB≈AD, CB≈CD. OK.

## Q3 (KL=KN, ML=MN, diagonals KM, LN meet at P)
- א. SSS: KL=KN, ML=MN, KM common -> △KLM≅△KNM.
- ב. Corresponding angles: ∠LKM=∠NKM, ∠LMK=∠NMK -> KM bisects ∠LKN and ∠LMN.
- ג. △KLP≅△KNP by SAS (KL=KN, ∠LKP=∠NKP from ב, KP common) -> LP=PN and ∠KPL=∠KPN; these are adjacent (sum 180°) so each 90° -> KM⊥LN.
- Figure: KL≈KN (139/137), ML≈MN (246/248). OK.

## Q4 (AB=AD=15, CB=CD=20, BD=24, O) — worked example 5, 4 -> 3
- א. BO = 12 cm: the main diagonal AC bisects the secondary diagonal BD (and is perpendicular to it).
- ב. AO = √(225−144) = 9 cm; CO = √(400−144) = 16 cm.
- ג. AC = 25; area = 25·24/2 = 300 cm².
- Figure scale matches 12 : 9 : 16 exactly. OK.
- Note: the worked example writes "5·5 − 4·4 = 9, ולכן ... 3" with no square / square-root step; a student copies "9 → 3" without seeing why.

## Q5 (EF=EH=25, GF=GH=29, FH=40, T)
- א. FT = 20, ET = √(625−400) = 15 cm.
- ב. Error: in a kite only the main diagonal EG bisects FH; FH does not bisect EG. GT = √(841−400) = 21, EG = 15+21 = 36 cm (student's 30 is wrong).
- ג. When the kite is a rhombus (EF = FG), the diagonals bisect each other.
- Figure ratios match 25 : 29 : 40. OK.

## Q6 (AC ⊥ BD at O, O midpoint of BD, A and C on opposite sides)
- א. △ABO≅△ADO (SAS: BO=DO, ∠AOB=∠AOD=90°, AO common) -> AB=AD.
- ב. Same with C -> CB=CD; two separate pairs of equal adjacent sides -> kite.
- ג. No. AB² = AO²+BO², AD² = AO²+DO²; if BO≠DO then AB≠AD. Counterexample: AO=1, BO=2, DO=4.
- Figure: AC ⊥ BD (dot ≈ 0), O midpoint, AB≈AD, CB≈CD. No right-angle / equal-tick marks drawn (givens only in text) — not a contradiction.

## Q7 (RS=RU, TS=TU; RS=2x+1, RU=x+6, TS=3x−2)
- א. 2x+1 = x+6 -> x = 5.
- ב. RS=RU=11, TS=TU=13, perimeter 48 cm.
- ג. No: RS=RU forces the single solution x=5, so the perimeter is always 48.
- Figure ratio 11:13 matches.

## Q8 (rectangle EFGH through the vertices, parallel to the diagonals)
- א. The diagonals are perpendicular, so each of the four small quadrilaterals (e.g. EBOA) is a rectangle; the kite side (AB) is its diagonal, which splits a rectangle into two congruent (equal-area) triangles.
- ב. The kite consists of one triangle from each small rectangle -> half of EFGH. EFGH has sides AC and BD -> S = AC·BD/2.
- ג. 14·10/2 = 70 cm².
- ד. 60 = 8·d/2 -> d = 15 cm.
- Figure ratio AC:BD = 1.40 = 14:10.

## Q9 (construction: AC=9, BD=6, AO=3)
- א. Draw AC = 9, mark O with AO = 3; draw through O the perpendicular to AC; mark B and D on it, 3 cm on each side of O. O must be the midpoint of BD because the main diagonal is the perpendicular bisector of the secondary one.
- ב. Symmetry axis AC; B goes to D.
- ג. Not a rhombus: AO = 3 ≠ OC = 6 (in a rhombus the diagonals bisect each other). Construction space is blank (no grid). OK.

## Q10 (AB=AD=6, CB=CD=9, E on AC)
- א. △ABE≅△ADE (SAS: AB=AD, ∠BAE=∠DAE, AE common) -> EB=ED.
- ב. AC is the symmetry axis: reflection in AC maps B to D and fixes E, so EB = ED.
- ג. Reflection in BD would send A to C, so AB would equal CB; but 6 ≠ 9.
- Figure ratio 6:9 and E on AC confirmed.

## Q11 (convex ABCD, diagonals meet at O)
- א. Not enough. Counterexample: OA=1, OC=3, OB=2, OD=4 with AC⊥BD; sides √5, √13, 5, √17 — no equal adjacent sides.
- ב. In isosceles △ABD the altitude AO to the base is also a median -> O midpoint of BD -> △CBO≅△CDO (SAS) -> CB=CD -> kite.
- ג. Not enough: a parallelogram that is not a rhombus (e.g. a 3×5 rectangle) has O the midpoint of BD and no equal adjacent sides. Construction space blank. OK.

## Q12 (rhombus PQRS, PR=10, QS=7)
- א. Way 1: heads P and R (PQ=PS, RQ=RS). Way 2: heads Q and S (QP=QR, SP=SR).
- ב. Way 1: PR bisects QS and is perpendicular to it; way 2: QS bisects PR and is perpendicular. So each bisects the other and they are perpendicular.
- ג. 10·7/2 = 35 cm².
- Figure: four sides ≈ equal; PR:QS = 1.425 ≈ 10:7.

## Q13 (BD=6, perpendicular bisector, OA=4, C on the other side)
- א. A and C lie on the perpendicular bisector of BD, so AB=AD and CB=CD -> kite, heads A and C.
- ב. AB = √(4²+3²) = 5 cm.
- ג. OC = 4 cm (then CB = 5 = AB, all sides 5). Construct with OC=4 and any other OC (e.g. 7). Blank space. OK.

## Q14 (frame AB=AD=25, CB=CD=40, BD=48)
- א. BO=24, AO = √(625−576) = 7, CO = √(1600−576) = 32, AC = 39 cm.
- ב. 39·48/2 = 936 cm².
- ג. Impossible: in △ABD, 25+25 = 50, so BD=50 is not a triangle (BD must be < 50).
- Figure ratios 25:40:48 and AO:CO = 7:32 match.

## Q15 (AB=AD, CB=CD; ∠ABC=3x+10, ∠ADC=5x−50, ∠BAD=x+20)
- א. ∠ABC = ∠ADC (the side angles; △ABC≅△ADC by SSS).
- ב. 3x+10 = 5x−50 -> x = 30, ∠ABC = 100°.
- ג. ∠BAD = 50°, ∠BCD = 360−100−100−50 = 110°.
- ד. ∠ACB = 55° (AC bisects ∠BCD).
- Figure angles measured 99.6°, 49.8°, 100.6°, 109.9°. OK.

## Q16 (same four rods 10,10,17,17)
- א. BO=8, AO=6, CO=15, AC=21, area = 21·16/2 = 168 cm².
- ב. ∠KLM=90°: area = 2·(10·17/2) = 170 cm².
- ג. No (168 ≠ 170). One more datum is needed: a diagonal or an angle.
- Figures: same scale, ratios match; right-angle mark at L is a given. Label "K" sits inside the shape just above the vertex — readable.

## Q17 (secondary diagonal 6, area 24)
- א. 24 = 6·d/2 -> main diagonal 8 cm.
- ב. 4 and 4 (rhombus iff the diagonals bisect each other).
- ג. E.g. 4+4 (rhombus) and 2+6 (not rhombus). Blank space. OK.

## Q18 (isosceles △ABD, △CBD on common base BD, M midpoint)
- א. △ABM≅△ADM (SSS) -> ∠AMB = ∠AMD, adjacent -> 90°.
- ב. Same for C -> ∠CMB = 90°; ∠AMB + ∠BMC = 180° so A, M, C collinear (one perpendicular to BD at M).
- ג. AC passes through the midpoint of BD and is perpendicular to it (the main diagonal is the perpendicular bisector of the secondary diagonal). Without ב we would only know about two segments AM and MC, not that they form the single diagonal AC.
- Figure: M lies on AC (exactly). The figure draws AC as one straight segment — unavoidable since it is true; acceptable.

## Q19 (perimeter 46, one pair 3 longer)
- א. 4a+6 = 46 -> a = 10; sides 10, 10, 13, 13.
- ב. Secondary diagonal d is the base of the isosceles triangle with legs 10: d < 20. 12 possible; 20 impossible (10+10 = 20, degenerate); 24 impossible.
- ג. 19 cm.

## Q20 (AB=AD, CB=CD, ∠BAD=90°, BD=10, CB=13)
- א. ∠ABD = 45° (isosceles right triangle).
- ב. AO = 5 cm (O midpoint of BD, ∠ABO=45°, ∠AOB=90° -> AO=BO).
- ג. CO = √(169−25) = 12, AC = 17 cm, area = 17·10/2 = 85 cm².
- Figure: ∠BAD measured 90.3°, AO:CO:CB = 5:12:13. No right-angle mark at A (the 90° is given in text only).

## Flags from the blind pass
1. Q4 worked example skips the square/square-root step ("5·5 − 4·4 = 9 ... 3") — MINOR.
2. Page footer reads "עמוד n מתוך 16" on student pages, counting the 3 private key pages — check against the engine convention.
3. Q6 / Q20 figures carry no marks for the given right angle / midpoint — cosmetic, MINOR at most.
4. Nothing unsolvable, no ambiguity, no figure contradicting its text, all answers integers (except none needed), calculator-free.
