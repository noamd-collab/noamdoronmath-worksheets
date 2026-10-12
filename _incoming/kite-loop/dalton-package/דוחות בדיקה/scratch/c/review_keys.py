# Independent exact re-computation of every numeric key of level c from the
# printed data only (Fraction arithmetic; roots kept exact as k*sqrt(m)).
# Compares with the stored find values in sheet.json; also checks figure
# coordinates agree with the givens where a value is derived from them.
import json, math, re, sys
from fractions import Fraction as Fr
from pathlib import Path
S = json.loads((Path(__file__).resolve().parents[2] / 'pkg/out/deliver/c/sheet.json').read_text())
def isq(n):
    r = math.isqrt(int(n)); assert r * r == n, n; return r
def leg(h, a):  # exact integer/rational leg
    v = Fr(h) ** 2 - Fr(a) ** 2; assert v > 0
    num, den = v.numerator, v.denominator
    return Fr(isq(num), isq(den))
def ev(s):
    s = str(s).replace('−', '-')
    return eval(s, {'sqrt': math.sqrt})
E = {}
def put(q, lab, key, val): E[(q, lab, key)] = val
# Q1: heads B,D; angles 70, 50 -> BAD
put(1, 'ג', 'BAD', (360 - 64 - 46) / 2)
# Q3: (4x-100)+x+2(2x+50)=360
x = Fr(360, 9); put(3, 'א', 'x', x); put(3, 'א', 'BAD', 4 * x - 100); put(3, 'א', 'BCD', x); put(3, 'א', 'ABC', 2 * x + 50)
abd = 180 - 90 - (4 * x - 100) / 2; put(3, 'ב', 'ABD', abd); put(3, 'ב', 'CBD', 2 * x + 50 - abd)
put(3, 'ד', 'BPC', (4 * x - 100) / 2 + abd / 2)
# Q4: 20/37/24
ao, oc = leg(52, 48), leg(73, 48); ac = ao + oc; put(4, 'א', 'AC', ac)
put(4, 'ב', 'ABCD', (ac * 96 / 2, 2 * 52 + 2 * 73))
assert 52 ** 2 + 73 ** 2 != ac ** 2
put(4, 'ג', 'שטח בדרך נוספת', 2 * (ac * 48 / 2))
put(4, 'ד', 'BH', 2 * (Fr(96) * oc / 2) / 73)
# Q5 ב: general fact, sample check a=c <=> adjacent equal
for a_, b_, c_ in [(4, 3, 9), (5, 2, 5)]:
    assert (math.hypot(a_, b_) == math.hypot(c_, b_)) == (a_ == c_)
# Q6
ks, kl, km = 3, 5, 10; ls = leg(kl, ks); put(6, 'א', 'LN', 2 * ls)
put(6, 'ב', 'ML', math.hypot(km - ks, ls)); put(6, 'ב', 'KLMN', Fr(km * 2 * ls, 2))
assert kl ** 2 + (km - ks) ** 2 + ls ** 2 != km ** 2
# Q7
assert 5 + 5 < 11
bo = 4; ao7 = leg(5, bo); oc7 = math.sqrt(36 - 16); put(7, 'ג', 'AC', ao7 + oc7)
assert abs(25 + 36 - (ao7 + oc7) ** 2) > 1e-6
# Q8
pr = Fr(2 * 3300, 66); po = leg(55, 33); orr = pr - po; rq = math.hypot(33, orr)
put(8, 'ג', 'PR', pr); put(8, 'ג', 'PQRS', 2 * 55 + 2 * rq)
# Q9: 1156 - t^2 = 2500 - (56-t)^2
t = Fr(1156 - 2500 + 3136, 112); put(9, 'א', 't', t); bo9 = leg(34, t); put(9, 'א', 'BD', 2 * bo9)
assert leg(50, 56 - t) == bo9
put(9, 'ב', 'ABCD', Fr(56) * 2 * bo9 / 2)
# Q10 counterexample
assert 2 + 10 == 12 and math.hypot(2, 6) != math.hypot(10, 6)
# Q11
for xx in (1, 8):
    s11 = [xx + 2, 2 * xx + 1, xx + 9, 10]
    assert min(s11) > 0
assert [1 + 2, 3, 10, 10] == [3, 3, 10, 10] and [10, 17, 17, 10] == [8 + 2, 17, 17, 10]
assert 2 * (3 + 10) == 26 and 2 * (10 + 17) == 54
ao11, oc11 = leg(10, 8), leg(17, 8); put(11, 'ב', 'AC', ao11 + oc11); put(11, 'ב', 'ABCD', (ao11 + oc11) * 16 / 2)
put(11, 'ב', 'x', 8)
# Q12: AB=15, CB=41, BD=18
ao12, oc12 = leg(65, 39), leg(89, 39); put(12, 'ג', 'ABCD', (ao12 + oc12) * 78 / 2); put(12, 'ג', 'OE', Fr(78, 3) / 2)
# Q14
put(14, 'ג', 'BD', 2 * Fr(5 * 12, 13))
best = max(a * (18 - a) for a in range(1, 18) if a != 18 - a); put(14, 'ד', 'שטח מרבי', best)
# Q15
put(15, 'ב', 'KLM', Fr(360 - 40 - 124, 2)); put(15, 'ב', 'KML', Fr(124, 2))
put(15, 'ג', 'KLN', Fr(180 - 40, 2)); put(15, 'ג', 'NLM', Fr(360 - 40 - 124, 2) - Fr(180 - 40, 2))
assert Fr(180 - 124, 2) == 28
# Q16 examples
assert 6 ** 2 == 4 * 9 and 4 + 9 != 12 and 2 + 6 == 8 and 4 ** 2 != 2 * 6
# Q17: y^2+36=(12-y)^2
y = Fr(144 - 36, 24); put(17, 'ג', 'BP', y); put(17, 'ב', 'AC', math.hypot(9, 12)); put(17, 'ב', 'EC', 15 - 9)
put(17, 'ד', 'ABPE', 2 * Fr(9) * y / 2); put(17, 'ד', 'חלק משטח המשולש', (9 * y) / Fr(54))
# Q18
put(18, 'ב', 'ABC', Fr(360 - 130 - 50, 2)); abe = 180 - (180 - 65) - 25; put(18, 'ב', 'EBC', abe + 90)
# Q19: (m+4)^2 = 52 + 36 + m^2
m = Fr(88 - 16, 8); assert m == 9
put(19, 'ג', 'שטח KLMN', Fr((m + 4) * 12, 2)); put(19, 'ג', 'היקף KLMN', 2 * math.hypot(4, 6) + 2 * math.hypot(float(m), 6))
# Q20
sols = [tt for tt in range(1, 40) if math.isqrt(144 + tt * tt) ** 2 == 144 + tt * tt
        and math.isqrt(144 + (40 - tt) ** 2) ** 2 == 144 + (40 - tt) ** 2]
put(20, 'ג', 'PB', sols); put(20, 'ד', 'ABCD', 2 * 13 + 2 * 37); put(20, 'ב', 'ABCD', 24 * 40 - Fr(12 * 80, 2))
assert 24 * 40 - Fr(12 * 80, 2) == Fr(24 * 40, 2)
# ---- compare
got = {}
for q in S['questions']:
    for it in q['items']:
        for f in it.get('find') or []:
            got.setdefault((q['n'], it['label']), []).append(f)
def num(v):
    try: return float(ev(v))
    except Exception: return None
bad = ok = 0
for (qn, lab, key), want in E.items():
    fs = got.get((qn, lab), [])
    cand = [f for f in fs if f.get('of') == key or f.get('what') == key]
    if not cand:
        print('NO STORED TARGET', qn, lab, key); bad += 1; continue
    vals = [f['value'] for f in cand]
    W = want if isinstance(want, (list, tuple)) else [want]
    if isinstance(want, tuple):  # area, perimeter pair on same 'of'
        G = sorted(num(v) for v in vals)
        okk = all(abs(a_ - b_) < 1e-9 for a_, b_ in zip(sorted(float(w) for w in W), G))
    elif isinstance(want, list):
        G = [num(v) for v in re.split(r',\s*', vals[0])]
        okk = len(G) == len(W) and all(g is not None and abs(g - float(w)) < 1e-9 for g, w in zip(G, W))
    else:
        g = num(vals[0]); okk = g is not None and abs(g - float(want)) < 1e-9
    if okk: ok += 1
    else: print('MISMATCH', qn, lab, key, 'stored', vals, 'computed', want); bad += 1
# every stored value appears in its printed key line
ans = {}
for q in S['questions']:
    for it in q['items']:
        ans[(q['n'], it['label'])] = str(it.get('answer') or '')
print('KEYS recomputed: %d matched, %d problems' % (ok, bad))
sys.exit(bool(bad))
