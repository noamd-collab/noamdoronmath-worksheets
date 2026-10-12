# G9-KITE level a: blind solutions (reviewer, before key)

Written from the rendered student pages 1-12 only (student_p01..p12.png). Process note: when locating the key
start page I printed the first 120 characters of every page; for key pages that exposed only the key header,
the first line of q1א, q9א and q19א (AC = 5). Nothing else of the key or of level_a.py was read before this file.

Figure measurements are from the 2x renders (pixel coordinates of vertices), compared with the stated data.

## Q1 PQRS, PQ = PS (1 tick), QR = RS (2 ticks)
- א: PQ and PS are adjacent at P and equal; RQ and RS are adjacent at R and equal; the two pairs are separate (no common side) -> kite by definition.
- ב: heads P and R, side vertices Q and S; main diagonal PR, secondary QS.
- ג: No. PQ and QR carry different marks and nothing is given about them; appearance is not data.
- Figure: PQ 207, PS 210, QR 229, RS 230 px. Marks match givens.

## Q2
- א: ABCD: AB = DC, AD = BC are OPPOSITE sides. That is not the definition; from the data we cannot say it is a kite (it is a parallelogram; only if all sides were equal would it be a rhombus = kite). Answer: not by the data.
- ב: PQRS: only one pair PQ = PS. No second pair -> cannot conclude it is a kite.
- ג: RQ = RS (the only side condition that gives a second separate pair of adjacent sides). Heads P and R.

## Q3 AB = AD, CB = CD, AC drawn
- א: In △ABC and △ADC: AB = AD (given), CB = CD (given), AC common -> SSS (צ.צ.צ).
- ב: corresponding angles opposite AC in congruent triangles -> ∠ABC = ∠ADC.
- ג: from the same congruence ∠BAC = ∠DAC and ∠BCA = ∠DCA, so AC bisects ∠BAD and ∠BCD.
- Figure: CB 208.5 / CD 207.5, AB 123 / AD 124. OK.

## Q4 ∠BAD = 70°, ∠BCD = 50°
- א: side angles equal (q3/K05): ∠ABC = ∠ADC = (360 − 70 − 50)/2 = 120°.
- ב: △ABD isosceles (AB = AD): ∠ABD = (180 − 70)/2 = 55°.
- ג: way 1: 120 − 55 = 65°; way 2: △BCD isosceles: (180 − 50)/2 = 65°.
- Figure: ∠BAD measured 70.1°, ∠BCD 49.8°. OK.

## Q5 KL = KN = 10, ML = MN = 17, LN = 16, O midpoint of LN
- א: KO is the median to the base of isosceles △KLN -> altitude, KO ⊥ LN; likewise MO ⊥ LN in isosceles △MLN. (Or SSS △KLO ≅ △KNO, supplementary equal angles = 90°.)
- ב: through O there is exactly one perpendicular to LN in the plane, so K, O, M are collinear; KM is the perpendicular bisector of LN (KM ⊥ LN, passes through its midpoint).
- ג: KO = √(100 − 64) = 6, MO = √(289 − 64) = 15, KM = 21 ס״מ.
- Figure: 10:17:16 -> 149.6 : 253.4/254.3 : 237.5 px (LN 0.8% short). OK.

## Q6
- א: AC bisects ∠BAD (q3 property); in isosceles △ABD the bisector of the apex angle is also the altitude, so AC ⊥ BD; hence BO ⊥ AC (altitude of △ABC to AC) and DO ⊥ AC (altitude of △ADC).
- ב: S = AC·BO/2 + AC·DO/2 = AC·(BO + DO)/2 = AC·BD/2 (O between B and D, convex).
- ג: 18·10/2 = 90 סמ״ר.
- Figure: AC·BD dot product ≈ 0; no right-angle mark drawn (correct: not given). OK.

## Q7 heads A, C; AB = 2x + 1, AD = x + 5, CB = 3x
- א: AB = AD: 2x + 1 = x + 5 -> x = 4, AB = 9 ס״מ.
- ב: CB = CD = 12; P = 9 + 9 + 12 + 12 = 42 ס״מ.
- ג: AB and CB meet at the side vertex B; nothing says they are equal. Tal's x = 1 gives AB = 3, AD = 6: the two sides at A are unequal, contradicting the data.
- Figure: AB 158.8, AD 159.3, BC 213, CD 212.9 (ratio 1.34 vs 12/9). OK.

## Q8 EG ⊥ FH at M, FM = MH (right-angle mark and ticks shown = givens)
- א: △EMF ≅ △EMH: FM = MH, ∠EMF = ∠EMH = 90°, EM common -> SAS -> EF = EH.
- ב: same with G: △GMF ≅ △GMH -> GF = GH. Two separate pairs of adjacent equal sides -> kite; heads E, G; main diagonal EG.
- ג: the step "∠EMF = ∠EMH = 90°" (the angle in SAS) is lost; without it there is no congruence (e.g. a parallelogram: diagonals bisect each other, not a kite).
- Figure: EG·FH ≈ 0, EF 131.5/EH 130, GF 258/GH 257 (EF = EH not tick-marked: correct, it is the target). OK.

## Q9 AB = AD = 5, CB = CD = 8, AC drawn
- א: AC bisects ∠BAD (q3), so reflection in AC maps ray AB onto ray AD; reflection keeps lengths, AB = AD -> B goes to D.
- ב: reflection maps A->A, B->D, C->C, so ∠ABC -> ∠ADC, equal. B -> D means AC is the perpendicular bisector of BD -> BD ⊥ AC.
- ג: No. Reflection in BD would have to send A to C, so BA = BC, but 5 ≠ 8.
- Figure: 162.2/162 vs 261.7/261.8 (1.614 vs 1.6). OK.

## Q10 construction AB = AD = 4, CB = CD = 7, BD = 6
- א: draw BD = 6; arcs radius 4 about B and D meet at A; arcs radius 7 about B and D meet at C on the other side of BD; join.
- ב: on the same side A falls inside △BCD (heights √7 vs √40 above BD) -> non-convex quadrilateral (a dart); the sheet is convex only.
- ג: drawing; AC ⊥ BD and AC bisects BD (not given, follows from kite properties).
- Blank space: no grid/axes. OK.

## Q11 AC = 14, BD = 24, AB = 13; Dana: each diagonal bisects the other, AO = 7
- א: only the main diagonal AC bisects the secondary BD; BD need not bisect AC.
- ב: BO = 12, AO = √(169 − 144) = 5 ס״מ; OC = 9, CB = √(81 + 144) = 15 ס״מ.
- ג: S(△ABD) = 24·5/2 = 60 סמ״ר.
- Figure: AO:OC ≈ 0.37 vs 5/14; AB, CB in scale. OK.

## Q12 PQ = PS = 25 מ׳, RQ = RS, PR = 36 מ׳, QO = 20 מ׳, QO ⊥ PR (right-angle mark = given)
- א: PR is the main diagonal (heads P, R): perpendicular bisector of QS, so S is also at distance 20 and QS = 40; S = 36·40/2 = 720 מ״ר (or 2·36·20/2).
- ב: PO = √(625 − 400) = 15 מ׳.
- ג: OR = 21, QR = √(400 + 441) = 29; P = 2·25 + 2·29 = 108 מ׳.
- Figure: scale 7.5 px/m: QO 20.1, PO 15.07, PQ 25.1, QR 29.04. OK.

## Q13 ∠ABC = 3x + 10, ∠ADC = 5x − 30, ∠BAD = 4x + 40
- א: side angles equal: 3x + 10 = 5x − 30 -> x = 20.
- ב: ∠ABC = ∠ADC = 70°, ∠BAD = 120°, ∠BCD = 360 − 260 = 100°.
- ג: ∠BAC = 60°, ∠ACB = 50°; 60 + 70 + 50 = 180. 
- Figure: ∠BAD 120°, ∠BCD 100°. OK.

## Q14 rhombus KLMN
- א: heads K, M: KL = KN and ML = MN; heads L, N: LK = LM and NK = NM.
- ב: way 1: main diagonal KM is the perpendicular bisector of LN -> KM ⊥ LN, O midpoint of LN; way 2: main diagonal LN bisects KM -> O midpoint of KM.
- ג: No. In a kite that is not a rhombus only one way exists, so only the main diagonal bisects the secondary; the secondary need not bisect the main (q11 is an example: AO = 5, OC = 9).
- Figure: four sides 189-189.5 px. OK.

## Q15 ∠BAD = 80°, ∠ABC = 110°; Yoav: BD bisects ∠ABC
- א: BD is the secondary diagonal; only the main diagonal bisects (head) angles. B is a side vertex; nothing makes ∠ABD = ∠DBC.
- ב: ∠ABD = (180 − 80)/2 = 50°, ∠DBC = 110 − 50 = 60°.
- ג: ∠ADC = 110°, ∠BCD = 360 − 80 − 220 = 60°; △BCD isosceles with apex 60° -> base angles 60° -> equilateral. (Or ∠DBC = ∠BDC = 60°.)
- Figure: ∠BAD 80.1°, ∠ABC 110.1°. OK.

## Q16 RS = RU, ∠SRT = ∠URT, RT drawn
- א: SAS: RS = RU, ∠SRT = ∠URT, RT common.
- ב: TS = TU corresponding sides; RS = RU and TS = TU, two separate pairs of adjacent sides -> kite.
- ג: in isosceles △SRU, RT bisects the apex angle -> altitude -> RT ⊥ SU (or △RSK ≅ △RUK at the intersection K).
- Figure: RS 163.7/RU 165, ∠SRT 63.8° = ∠URT 63.8°, TS 227.7/TU 228.1. FINDING: the given equal angles ∠SRT = ∠URT have no angle-arc marks in the figure, while the given RS = RU does have ticks.

## Q17 Adi: every convex quadrilateral with perpendicular diagonals is a kite
- א: in a kite the main diagonal bisects the secondary: the meeting point is the midpoint of the secondary diagonal (one of the two).
- ב: EM = 2, MG = 5, FM = 3, MH = 6: M is the midpoint of neither diagonal -> by א not a kite -> Adi is wrong (counterexample). Convex since M is inside both diagonals.
- Blank space, no grid. OK.

## Q18 AB = AD = 15, BD = 18, P = 112
- א: BO = 9, AO = √(225 − 81) = 12 ס״מ.
- ב: CB = (112 − 30)/2 = 41 ס״מ, OC = √(1681 − 81) = 40 ס״מ.
- ג: CB = (44 − 30)/2 = 7; 7 + 7 = 14 < 18 = BD, no triangle BCD (or OC² = 49 − 81 < 0).
- Figure: scale 8.72 px/cm: BD 17.96, AC 52.0, CB 41.1. OK.

## Q19 AB = AD = 3, CB = CD = 4, ∠ABC = ∠ADC = 90°, "not a rhombus" stated
- א: AC = √(9 + 16) = 5 ס״מ.
- ב: S = 2·(3·4/2) = 12 סמ״ר; 5·BD/2 = 12 -> BD = 24/5 = 4.8 ס״מ.
- ג: draw AC = 5; arcs radius 3 about A and radius 4 about C meet at B and D on both sides (or Thales circle on AC); BD measures about 4.8.
- Blank space, no grid. OK.

## Q20 AC = 20, BD = 10, AE = 15, E on OC
- א: E lies on the main diagonal AC, the perpendicular bisector of BD -> EB = ED (or △BOE ≅ △DOE SAS).
- ב: AB = AD and EB = ED: two separate pairs of adjacent equal sides; E is on segment OC so A and E are on opposite sides of BD -> convex. Main diagonal AE.
- ג: S(ABED) = 15·10/2 = 75 סמ״ר; S(ABCD) = 20·10/2 = 100; outside part 25 סמ״ר.
- Figure: AO:AC = 0.6 (AO = 12), AE 15. OK.

## Stage-1 flags
1. Q16 figure: no equal-angle arcs for the given ∠SRT = ∠URT (MINOR).
2. Page 12: student page holds only "בהצלחה!" (orphan page, MINOR).
3. No unsolvable or ambiguous item found. All figures measured consistent with data; no result marked before proved.
