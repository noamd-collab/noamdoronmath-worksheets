# -*- coding: utf-8 -*-
"""Independent re-computation of every numeric key of G9-KITE level a.
Two routes per numeric target: (1) exact arithmetic from the PRINTED data
(Fractions, integer square roots, angle sums); (2) measurement on the
exported figure coordinates (sheet.json figures[].objects.points xy) where the
target is a length / angle / area of a drawn object. Compares both with the
stored find value. Exit 1 on any mismatch or any numeric target not checked."""
import json, math, sys
from fractions import Fraction as Fr
from math import isqrt

p = sys.argv[1] if len(sys.argv) > 1 else 'fake/pkg/out/deliver/a/sheet.json'
sj = json.load(open(p, encoding='utf-8'))

def rt(n):
    n = Fr(n)
    a, b = isqrt(n.numerator), isqrt(n.denominator)
    assert a * a == n.numerator and b * b == n.denominator, ('not a square', n)
    return Fr(a, b)

# (1) exact recomputation from the printed data only
E = {}
# q4: A=70, C=50, side angles equal
B4 = Fr(360 - 70 - 50, 2); E['q4a'] = [B4]; E['q4b'] = [Fr(180 - 70, 2)]
E['q4c'] = [B4 - Fr(180 - 70, 2)]; assert E['q4c'][0] == Fr(180 - 50, 2)
# q5: KL=35, ML=53, LN=56
LO = Fr(56, 2); KO = rt(35**2 - LO**2); MO = rt(53**2 - LO**2)
E['q5a'] = [KO]; E['q5b'] = [MO]; E['q5c'] = [KO + MO]
# q6: AC=17, BD=8
E['q6c'] = [Fr(17 * 8, 2)]
# q7: x+4 = 2x-1, CB = 2x-3; Noa's x-8 negative; BD < AB+AD
x = Fr(4 + 1, 2 - 1); AB = x + 4; assert AB == 2 * x - 1; CB = 2 * x - 3
assert CB > 0 and x - 8 < 0 and 20 >= 2 * AB
E['q7a'] = [x, AB, CB]
# q9: AB=5, AP=1; reflection in AC keeps the distance from A
E['q9c'] = [Fr(1)]
# q11: AB=65, BD=120, AC=105
BO = Fr(120, 2); AO = rt(65**2 - BO**2); OC = 105 - AO
assert Fr(105, 2)**2 + BO**2 != 65**2
E['q11b'] = [AO, rt(OC**2 + BO**2)]; E['q11c'] = [2 * 65 + 2 * rt(OC**2 + BO**2)]
# q12: PQ=25, PR=39, QO=24
QS = 2 * 24; E['q12a'] = [Fr(39 * QS, 2)]; PO = rt(25**2 - 24**2)
E['q12b'] = [PO]; E['q12c'] = [2 * 25 + 2 * rt((39 - PO)**2 + 24**2)]
# q13: angle ABC = 115, BAD = 3x-10, BCD = 2x
x13 = Fr(360 - 2 * 115 + 10, 5); E['q13a'] = [x13]
A13 = 3 * x13 - 10; C13 = 2 * x13; E['q13b'] = [A13, C13]
E['q13c'] = [A13 / 2, C13 / 2]; assert A13 / 2 + C13 / 2 + 115 == 180
# q14: rhombus, angle LKN = 76
OKL = Fr(76, 2); KLM = Fr(360 - 2 * 76, 2); OLK = KLM / 2
E['q14c'] = [OKL, OLK, 180 - OKL - OLK]
# q15: A=36, B=132
E['q15b'] = [Fr(180 - 36, 2), 132 - Fr(180 - 36, 2)]
C15 = 360 - 36 - 2 * 132; assert C15 == 60 and Fr(180 - C15, 2) == 60
# q18: AB=20, BD=32, perimeter 170
BO18 = Fr(16); AO18 = rt(20**2 - BO18**2); CB18 = Fr(170 - 40, 2)
E['q18a'] = [AO18]; E['q18b'] = [CB18, rt(CB18**2 - BO18**2)]
assert Fr(44 - 40, 2) < BO18     # the hypothetical in q18c is impossible
# q19: AB=3, CB=4, right side angles
AC19 = rt(9 + 16); S19 = 2 * Fr(3 * 4, 2)
E['q19a'] = [AC19]; E['q19b'] = [S19, 2 * S19 / AC19]
# q20: AC=20, BD=10, AE=15
E['q20c'] = [Fr(15 * 10, 2), Fr(20 * 10, 2) - Fr(15 * 10, 2)]

def num(v):
    s = str(v).replace(u'−', '-')
    return Fr(s) if '/' not in s else Fr(*map(int, s.split('/')))

# (2) the figures: measure on exported coordinates
figs = dict((f['id'], f) for f in sj['figures'])
def P(fid):
    return dict((o['name'], o['xy']) for o in figs[fid]['objects']['points'])
def d(a, b):
    return math.hypot(a[0] - b[0], a[1] - b[1])
def ang(a, v, b):
    u = (a[0] - v[0], a[1] - v[1]); w = (b[0] - v[0], b[1] - v[1])
    return math.degrees(math.acos((u[0]*w[0] + u[1]*w[1]) / (math.hypot(*u) * math.hypot(*w))))
def area(pts):
    s = 0
    for i in range(len(pts)):
        x1, y1 = pts[i]; x2, y2 = pts[(i + 1) % len(pts)]
        s += x1 * y2 - x2 * y1
    return abs(s) / 2

def measure(fid, f):
    if fid is None:
        return None
    Q = P(fid); q = f.get('quantity'); of = f.get('of') or ''
    try:
        if q == 'length':
            return d(Q[of[0]], Q[of[1]])
        if q == 'angle':
            return ang(Q[of[0]], Q[of[1]], Q[of[2]])
        if q == 'area':
            return area([Q[c] for c in of])
        if q == 'perimeter':
            pts = [Q[c] for c in of]
            return sum(d(pts[i], pts[(i + 1) % len(pts)]) for i in range(len(pts)))
    except KeyError:
        return None
    return None

ok, bad, rows = 0, [], []
numeric_ids = set()
for q in sj['questions']:
    for it in q['items']:
        iid = it['id']
        vals = [f for f in it.get('find') or []]
        nums = []
        for f in vals:
            try:
                nums.append((f, num(f['value'])))
            except Exception:
                pass
        if not nums:
            continue
        numeric_ids.add(iid)
        if iid not in E:
            bad.append('%s has numeric targets but no independent recomputation' % iid)
            continue
        exp = E[iid]
        if len(exp) != len(nums):
            bad.append('%s: %d targets, %d recomputed' % (iid, len(nums), len(exp)))
            continue
        for (f, v), e in zip(nums, exp):
            m = measure(it.get('figure'), f)
            mtxt = '-' if m is None else '%.4f' % m
            good = (v == e) and (m is None or abs(m - float(e)) < 1e-3)
            rows.append('%-5s %-10s %-6s key %-6s recomputed %-6s figure %s %s'
                        % (iid, f.get('quantity'), f.get('of') or f.get('what'), v, e, mtxt,
                           'OK' if good else 'MISMATCH'))
            if good:
                ok += 1
            else:
                bad.append(rows[-1])
for k in E:
    if k not in numeric_ids:
        bad.append('recomputed %s but the sheet stores no numeric target there' % k)
print('\n'.join(rows))
print('matched %d, findings %d' % (ok, len(bad)))
for b in bad:
    print('  ', b)
sys.exit(1 if bad else 0)
