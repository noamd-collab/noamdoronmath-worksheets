# BLIND_SOLUTIONS — G9-KITE level c, confirm round (round 2)

Written from the student pages 1-16 of pkg/out/deliver/c/sheet.pdf (sha256 5ebbce01...) only,
before opening the key pages 17-22, level_c.py or any writer scratch. All 20 questions solved
(FIXLOG changed q1, q3-q9, q12-q15, q19, q20; the rest could not be ruled out, so solved too).

## q1  ABCD, AB=BC, CD=DA, diagonals meet at M
- א: two disjoint pairs of equal adjacent sides -> kite. Heads B, D; side vertices A, C; main diagonal BD, secondary AC.
- ב: error 1: the congruence is SSS (AB=CB, AD=CD, BD common), not SAS (no angle is known). Error 2: "BD bisects the head angle" is what is being proved — circular. Correct: SSS gives ∠BAD=∠BCD.
- ג: ∠BAD=∠BCD=(360−64−46)/2=125°.
- ד: B and D both equidistant from A and C, so BD is the perpendicular bisector of AC: AM=MC, AC⊥BD. M midpoint of BD? ∠ABM=32°, ∠ADM=23°. If BM=DM then △ABM≅△ADM (SAS: AM common, right angles), so ∠ABM=∠ADM, contradiction. No.
- Figure measured: half-angles 32° at B, 23° at D. OK.

## q2  KLMN, KL=KN, ML=MN, KS=4, SM=9, P on SM, Q on SN
- א: KM is the perpendicular bisector of LN (P on it) -> PL=PN (or △PSL≅△PSN SAS).
- ב: QK²=16+SQ², QM²=81+SQ² -> QM>QK.
- ג: △KLM≅△KNM (SSS) -> reflection in KM swaps L,N. Theorem: LN is an axis iff K↔M swap, iff KL=LM and KN=NM, i.e. all sides equal -> rhombus; conversely a rhombus is symmetric in both diagonals. KLMN: KS≠SM so LN does not bisect KM, not a rhombus, LN is not an axis.

## q3  ∠BAD=4x−100, ∠BCD=x, ∠ABC=2x+50, BP bisects ∠ABD
- א: △ABC≅△ADC (SSS) -> ∠ADC=∠ABC. 4x−100+x+2(2x+50)=360 -> 9x=360, x=40. A=60°, C=40°, B=D=130°.
- ב: △ABD isosceles apex 60 -> ∠ABD=60° (equilateral). ∠CBD=130−60=70°.
- ג: 60≠70, so BD does not bisect ∠ABC. True: the main diagonal AC bisects the head angles; the secondary bisects the side angles only in a rhombus.
- ד: ∠ABP=30°, ∠BAP=30° (AC bisects ∠BAD) -> exterior ∠BPC=60°.
- Figure: ∠A 60.2°, ∠C 39.9° measured. OK.

## q4  AB=AD=52, CB=CD=73, BD=96, BH⊥CD
- א: BO=48; AO=√(2704−2304)=20; OC=√(5329−2304)=55; AC=75 cm (AC⊥BD, bisects BD by kite property).
- ב: area 75·96/2=3600 cm²; perimeter 2(52+73)=250 cm.
- ג: 52²+73²=8033 ≠ 75²=5625 -> not right. Area 2·(75·48/2)=3600 cm².
- ד: S(BCD)=96·55/2=2640=73·BH/2 -> BH=5280/73 cm (≈72.3). ∠BCD acute (2·73²>96²) so H on CD; CH≈10.
- Figure: AO:OC = 0.362 (0.364), H near C. OK.

## q5  S reflection of Q in line PR; P, R on opposite sides of QS
- א: PR is the perpendicular bisector of QS -> PQ=PS, RQ=RS. Kite, heads P and R, main diagonal PR. Convex since the diagonals cross inside both.
- ב: diagonals AC⊥BD at O. If AC bisects BD then △ABO≅△ADO (SAS) -> AB=AD. Conversely AB=AD -> BO²=AB²−AO²=AD²−AO²=DO². Hence, with perpendicular diagonals: one diagonal bisects the other => both its endpoints see equal adjacent sides => kite; and a kite has its main diagonal bisecting the secondary.
- ג: kite -> diagonals perpendicular (property); contrapositive.
- Figure: PQ=PS=158, RQ≈RS≈224 px. OK.

## q6  KM=10, KL=5, KS=3 (no figure)
- א: △KLM≅△KNM (SSS) -> KM bisects ∠LKN; in isosceles △KLN the bisector is altitude and median -> LN⊥KM, LS=SN. LS=√(25−9)=4, LN=8 cm.
- ב: SM=7, ML=√(49+16)=√65 cm; area 10·8/2=40 cm². 25+65=90≠100 -> ∠KLM not right.
- ג: construction: KM=10, S at 3 from K, perpendicular at S (set square), L, N at 4 each side (or arcs radius 5 from K). Mark data and derived.

## q7  AB=AD=5, CB=CD=6 (no figure)
- א: BD=11 > AB+AD=10 violates the triangle inequality in △ABD -> impossible.
- ב: 0<BD<10. For each such BD: BD/2<5<6, so A, C exist on the perpendicular bisector at √(25−BD²/4) and √(36−BD²/4), on opposite sides -> convex kite.
- ג: BD=8: AO=3, CO=√20=2√5, AC=3+2√5 cm. AB²+BC²=61, AC²=29+12√5; 61=29+12√5 iff 12√5=32 iff 720=1024: no -> not right.
- ד: construction from BD=8, arcs 5 (A side) and 6 (C side).

## q8  PQRS kite heads P,R; WXYZ with WY⊥XZ at V
- א: S(PQR)=PR·QO/2, S(PSR)=PR·SO/2 -> PR·QS/2.
- ב: same split along WY uses only perpendicularity; the property not used: the main diagonal bisects the secondary (equal sides).
- ג: PR=2·3300/66=100 cm; QO=33, PO=√(3025−1089)=44, OR=56, RQ=√(3136+1089)=65; perimeter 2(55+65)=240 cm.
- ד: areas equal (yes, by א, ב). Kite: not implied — needs one diagonal to bisect the other (q5 ב); drawn WXYZ (40/60, 26/40) is a counterexample.
- No leak: ד prints no number. Figure: PO:OR 44:56, WV:VY 40:60, XV:VZ 26:40 measured. OK.

## q9  AB=34, CB=50, AC=56, heads A, C
- א: if AO=OC then △ABO≅△CBO (SAS: right angles, BO common) -> AB=CB, contradiction. The main diagonal AC bisects BD (kite property).
- ב: 34²−t² = 50²−(56−t)² -> 1156 = −636+112t -> t=16; BO=√(1156−256)=30, BD=60 cm.
- ג: 56·60/2=1680 cm².
- Figure measured exactly to scale (AB 34.0, CB 50.0, AO 16.0, BD 60.0 at 56 cm = AC).

## q10  kite AB=AD, CB=CD; figure is a rhombus; "do not infer"
- א: O midpoint of AC and of BD (kite) and AC⊥BD -> △ABO≅△CBO (SAS) -> AB=CB -> rhombus.
- ב: ∠BAD=∠BCD: isosceles △ABD, △CBD with equal apex angles -> equal base angles; △ABD≅△CBD (ASA, BD common) -> AB=CB -> rhombus.
- ג: counterexample AO=3, BO=OD=4, OC=5: AC=BD=8, AB=5, CB=√41 -> kite, equal diagonals, not a rhombus.

## q11  AB=x+2, BC=2x+1, CD=x+9, DA=10
- א: case AB=BC & CD=DA: x=1 (3,3,10,10; heads B, D). Case BC=CD & DA=AB: x=8 (10,17,17,10; heads C, A). All positive.
- ב: 54 -> x=8 (x=1 gives 26). Heads A, C; BD=16, BO=8, AO=6, CO=15, AC=21 cm, area 168 cm².
- ג: x=1: secondary diagonal AC joins A, C with AB=BC=3, so AC<6<16. No.
- ד: sketches.

## q12  E on OB, F on OD, OE=OF
- א: AC⊥BD and O midpoint of EF -> AC is the perpendicular bisector of EF -> AE=AF, CE=CF. Diagonals AC, EF cross at O inside both -> convex kite, main diagonal AC.
- ב: S(AECF)/S(ABCD) = (AC·EF/2)/(AC·BD/2) = EF/BD.
- ג: BO=39, AO=52, OC=80, AC=132; area 132·78/2=5148 cm². EF=26 -> OE=13 cm.
- ד: AE²=AO²+OE² ≠ AO²+OF²=AF², CE≠CF. Other pairing AE=EC needs AO=OC, false here (52≠80). Not a kite. NOTE: the "no" depends on AO≠OC; if ABCD were a rhombus (allowed by the inclusive definition) AECF would be a kite with heads E, F. Check the key's wording.
- Figure: AO:OC 0.641 (0.65), drawn OE≈20 (not 13). No non-convex shape remains in q12.

## q13  "is it sufficient?"
- א: ASA (AC common, both angle pairs) -> AB=AD, CB=CD -> kite. Sufficient.
- ב: AB=AD -> ∠ABD=∠ADB; subtract from equal ∠ABC=∠ADC (convex) -> ∠CBD=∠CDB -> CB=CD. Sufficient.
- ג: median AO of isosceles △ABD is also altitude -> AC is the perpendicular bisector of BD -> CB=CD. Sufficient.
- ד: SSA, not sufficient. Counterexample: C(0,0), A(5,0), B(4,3), D(2.4,−1.8): AB=AD=√10, ∠ACB=∠ACD (tan 3/4), CB=5≠CD=3, convex, no kite pairing.

## q14 ★  AB=AD=5, CB=CD=12, ∠ABC=90
- א: △ABC≅△ADC (SSS) -> area = 2·BC·h/2 = BC·h.
- ב: h ≤ AB=5 (perpendicular shortest), area=12h ≤ 60, equality iff AB⊥BC.
- ג: AC=13; 60=13·BD/2 -> BD=120/13 m.
- ד: a+b=18, a≠b integers; area ≤ ab = 81−(a−9)² ≤ 80; attained with 8, 10 and a right side angle -> 80 m².

## q15  KL=KN on the arms, M on the bisector, KLMN convex
- א: △KLM≅△KNM (SAS) -> LM=NM -> kite.
- ב: ∠KLM=(360−40−110)/2=105°; ∠KML=55°.
- ג: ∠KLN=(180−40)/2=70°; ∠NLM=105−70=35°.
- Figure: ∠K 40.6°, ∠LMN 109.7°. OK.

## q16 ★  ∠ABC=90, AO=p, OC=q, BO=r
- א: (p+q)² = (p²+r²)+(q²+r²) -> r²=pq.
- ב: p+q=2r and r²=pq -> (p−q)²=0 -> p=q=r: four isosceles right triangles, all sides r√2, all angles 90 -> square.
- ג: right angle only: p=1, q=4, r=2. Equal diagonals only: p=1, q=3, r=2 (r²=4≠3).

## q17  AB=9, BC=12, ∠B=90, fold along AP
- א: AE=AB, PE=PB -> kite heads A, P; axis AP.
- ב: AC=15, EC=6 cm.
- ג: ∠AEP=∠ABP=90 (fold). x²+36=(12−x)² -> BP=4.5 cm.
- ד: 2·(9·4.5/2)=40.5 cm²; ABC 54 -> 3/4.

## q18  E on the extension of CA beyond A
- א: ∠EAB=∠EAD (supplements of equal ∠BAC, ∠DAC); △EAB≅△EAD (SAS) -> EB=ED; EBCD kite heads E, C.
- ב: ∠ABC=(360−130−50)/2=90°; ∠EAB=115, ∠EBA=40, ∠EBC=130°.
- ג: ∠BEC=25=∠BCE -> EB=CB; with EB=ED, CB=CD -> rhombus.
- ד: △ABC: ∠BAC=65, ∠BCA=25 -> BC>AB -> not a rhombus.
- Figure angles measured 64.8°, 24.9°, 25.1°. EBCD looks like a rhombus (to scale, unmarked) — acceptable.

## q19  K(−4,0), L(0,6), N(0,−6), M(m,0), m>0
- א: x-axis is the perpendicular bisector of LN -> KL=KN, ML=MN; heads K, M; convex since O between K and M and between L and N.
- ב: (m+4)²=52+36+m² -> m=9, M(9,0).
- ג: area 13·12/2=78; perimeter 2(2√13+3√13)=10√13 units.
- Plane: y label 5 now on the left (C-14 fixed); M not plotted.

## q20 ★  PQRS 24×21, A, C midpoints of PQ, SR, PB=QD
- א: △APB≅△AQD (SAS) and △CSB≅△CRD (SAS, SB=RD) -> AB=AD, CB=CD; main diagonal AC.
- ב: AC=21 ⊥ BD=24 -> area 252 cm², for every B.
- ג: t=PB in 1..20; 144+t² and 144+(21−t)² squares: t∈{5,9,16}∩{21−5,21−9,21−16} -> t=5 or 16 (AB=13, CB=20 or swapped).
- ד: perimeter 66 cm both.
- Figure: drawn PB ≈ 8.1 (not an answer).
