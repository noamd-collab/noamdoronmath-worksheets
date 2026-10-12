#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""Level b: recompute every key exactly and compare with the stored finds.

Three independent checks, none of which imports level_b.py:
  1. EXACT -- each numeric answer is recomputed here from the printed data
     with integers / Fractions (square roots only of perfect squares).
  2. STORED -- the value stored in sheet.json for that find equals (1).
  3. MODEL -- every length / angle / area / perimeter find whose objects
     are drawn is re-measured on the figure's own data coordinates; every
     printed given length / angle is re-measured too.

    python3 review_keys.py <deliver/b dir>
"""
from fractions import Fraction as F
import json
import math
import sys
from pathlib import Path

D = Path(sys.argv[1] if len(sys.argv) > 1 else
         Path(__file__).resolve().parent / 'probe/pkg/out/deliver/b')
sheet = json.loads((D / 'sheet.json').read_text())


def isq(n):
    n = F(n)
    assert n.denominator == 1 and n >= 0, n
    r = math.isqrt(int(n))
    assert r * r == n, ('not a perfect square', n)
    return r


def solve_lin(a1, b1, a2, b2):
    u"""a1*x + b1 = a2*x + b2"""
    return F(b2 - b1, a1 - a2)


X = {}   # (q, label, key) -> exact value
# Q1
rows = {1: (5, 5, 8, 8), 2: (6, 9, 6, 9), 3: (7, 7, 7, 7), 4: (11, 4, 4, 11),
        5: (4, 4, 4, 9)}
kites = [n for n, (ab, bc, cd, da) in rows.items()
         if (ab == bc and cd == da) or (bc == cd and da == ab)]
assert kites == [1, 3, 4], kites
# Q2
X[(2, u'א', 'ABC')] = F(360 - 84 - 116, 2)
X[(2, u'ב', 'BAC')] = F(84, 2)
X[(2, u'ב', 'ACD')] = F(116, 2)
X[(2, u'ג', 'ADC')] = 180 - X[(2, u'ב', 'BAC')] - X[(2, u'ב', 'ACD')]
assert X[(2, u'ג', 'ADC')] == X[(2, u'א', 'ABC')]
# Q4
X[(4, u'א', 'BO')] = F(48, 2)
X[(4, u'ב', 'AO')] = isq(26 ** 2 - 24 ** 2)
X[(4, u'ב', 'CO')] = isq(30 ** 2 - 24 ** 2)
X[(4, u'ג', 'ABCD')] = F((X[(4, u'ב', 'AO')] + X[(4, u'ב', 'CO')]) * 48, 2)
# Q5
et, gt = 4, 14
X[(5, u'ב', 'EG')] = et + gt
X[(5, u'ב', 'EFGH')] = F((et + gt) * 20, 2)
assert 2 * et != et + gt
# Q7
x7 = solve_lin(3, -2, 1, 10)
X[(7, u'א', 'x')] = x7
X[(7, u'א', 'RS')] = 3 * x7 - 2
assert 3 * x7 - 2 == x7 + 10
X[(7, u'ב', 'TS')] = F(52 - 2 * X[(7, u'א', 'RS')], 2)
assert F(60 - 2 * X[(7, u'א', 'RS')], 2) == 14     # q7c: x unchanged, TS would be 14
# Q8
X[(8, u'א', 'ABD')] = F(10 * 4, 2)
X[(8, u'א', 'CBD')] = F(10 * 7, 2)
X[(8, u'ב', 'ABCD')] = X[(8, u'א', 'ABD')] + X[(8, u'א', 'CBD')]
assert X[(8, u'ב', 'ABCD')] == F((4 + 7) * 10, 2)
X[(8, u'ג', u'האלכסון האחר')] = F(2 * 60, 8)
# Q9
assert 9 - 2 != 2
# Q12
X[(12, u'ג', 'PQRS')] = F(10 * 7, 2)
# Q13
X[(13, u'ב', 'AB')] = isq(3 ** 2 + 4 ** 2)
# Q14
ao, co = isq(45 ** 2 - 36 ** 2), isq(60 ** 2 - 36 ** 2)
X[(14, u'א', 'AC')] = ao + co
X[(14, u'ב', 'ABCD')] = F((ao + co) * 72, 2)
assert not F(90, 2) < 45
# Q15
x15 = solve_lin(3, 10, 5, -50)
X[(15, u'ב', 'x')] = x15
X[(15, u'ב', 'ABC')] = 3 * x15 + 10
bcd = 360 - 2 * (3 * x15 + 10) - (x15 + 20)
X[(15, u'ג', 'BCD')] = bcd
X[(15, u'ד', 'ACB')] = bcd / 2
# Q16
a16, c16 = isq(29 ** 2 - 21 ** 2), isq(35 ** 2 - 21 ** 2)
X[(16, u'א', 'ABCD')] = F((a16 + c16) * 42, 2)
X[(16, u'ב', 'KLMN')] = 2 * F(29 * 35, 2)
assert X[(16, u'א', 'ABCD')] != X[(16, u'ב', 'KLMN')]
# Q17
X[(17, u'א', u'האלכסון הראשי')] = F(2 * 24, 6)
assert X[(17, u'א', u'האלכסון הראשי')] / 2 == 4      # rhombus split 4 and 4
# Q19
a19 = F(46 - 6, 4)
assert 2 * a19 + 2 * (a19 + 3) == 46
ok = [h for h in (6, 10, 12) if h < a19]
assert ok == [6]
X[(19, u'ג', u'האורך הגדול ביותר')] = max(n for n in range(1, 100) if F(n, 2) < a19 and F(n, 2) < a19 + 3)
# Q20
assert F(180 - 90, 2) == F(90, 2)      # q20a: both base angles of AOB are half the right head angle
X[(20, u'ב', 'AO')] = F(10, 2)          # isosceles right triangle AOB
co20 = isq(13 ** 2 - 5 ** 2)
X[(20, u'ג', 'AC')] = X[(20, u'ב', 'AO')] + co20
X[(20, u'ג', 'ABCD')] = F(X[(20, u'ג', 'AC')] * 10, 2)


def num(v):
    s = str(v).strip()
    try:
        return F(s)
    except ValueError:
        return None


# ---- 2. stored ----------------------------------------------------------
bad, ok_n = [], 0
seen = set()
for q in sheet['questions']:
    for it in q.get('items') or []:
        for f in it.get('find') or []:
            key = f.get('of') or f.get('what')
            k = (q['n'], it['label'], key)
            if k in X:
                seen.add(k)
                got = num(f.get('value'))
                if got != X[k]:
                    bad.append('q%s%s %s: stored %s, exact %s'
                               % (q['n'], it['label'], key, f.get('value'), X[k]))
                else:
                    ok_n += 1
missing = sorted(set(X) - seen)
# ---- 3. model ------------------------------------------------------------
figs = dict((f['id'], f) for f in sheet['figures'])


def pts(fid):
    return dict((p['name'], tuple(p['xy'])) for p in figs[fid]['objects']['points'])


def dist(P, a, b):
    return math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1])


def ang(P, a, v, b):
    u = (P[a][0] - P[v][0], P[a][1] - P[v][1])
    w = (P[b][0] - P[v][0], P[b][1] - P[v][1])
    c = (u[0] * w[0] + u[1] * w[1]) / (math.hypot(*u) * math.hypot(*w))
    return math.degrees(math.acos(max(-1, min(1, c))))


def area(P, names):
    xy = [P[n] for n in names]
    return abs(sum(xy[i][0] * xy[i - 1][1] - xy[i - 1][0] * xy[i][1]
                   for i in range(len(xy)))) / 2


model_ok, model_bad, model_skip = 0, [], []
for q in sheet['questions']:
    fid = q.get('figure')
    if not fid:
        continue
    P = pts(fid)
    checks = []
    for it in q.get('items') or []:
        for f in it.get('find') or []:
            qq, of, v = f.get('quantity'), f.get('of'), num(f.get('value'))
            if v is None or not of:
                continue
            names = list(of)
            if any(n not in P for n in names):
                model_skip.append('q%s%s %s (point not drawn)' % (q['n'], it['label'], of))
                continue
            if qq in ('length',):
                checks.append(('q%s%s |%s|' % (q['n'], it['label'], of), dist(P, *names), v))
            elif qq == 'angle':
                checks.append(('q%s%s ∠%s' % (q['n'], it['label'], of), ang(P, *names), v))
            elif qq == 'area':
                checks.append(('q%s%s area %s' % (q['n'], it['label'], of), area(P, names), v))
            elif qq == 'perimeter':
                checks.append(('q%s%s per %s' % (q['n'], it['label'], of),
                               sum(dist(P, names[i - 1], names[i]) for i in range(len(names))), v))
    for name, got, want in checks:
        if abs(got - float(want)) <= 2e-4 * max(1, abs(float(want))):
            model_ok += 1
        else:
            model_bad.append('%s model %.5f key %s' % (name, got, want))
# Q20: O is constructed by the student; measure it as the foot of BD on AC
P = pts('q20_head')
t = ((P['B'][0] - P['A'][0]) * (P['C'][0] - P['A'][0]) + (P['B'][1] - P['A'][1]) * (P['C'][1] - P['A'][1])) / dist(P, 'A', 'C') ** 2
O = (P['A'][0] + t * (P['C'][0] - P['A'][0]), P['A'][1] + t * (P['C'][1] - P['A'][1]))
P['O'] = O
for name, got, want in [('q20ב |AO|', dist(P, 'A', 'O'), 5), ('q20 |BO|', dist(P, 'B', 'O'), 5),
                        ('q20 |DO|', dist(P, 'D', 'O'), 5), ('q20 ∠BAD', ang(P, 'B', 'A', 'D'), 90),
                        ('q20 |CB|', dist(P, 'C', 'B'), 13)]:
    (model_bad.append('%s %.5f vs %s' % (name, got, want)) if abs(got - want) > 1e-4 else None)
    model_ok += abs(got - want) <= 1e-4
# printed givens on the figure questions
GIV = {2: [('ang', 'BAD', 84), ('ang', 'BCD', 116), ('eq', 'AB', 'AD'), ('eq', 'CB', 'CD')],
       4: [('len', 'AB', 26), ('len', 'AD', 26), ('len', 'CB', 30), ('len', 'CD', 30), ('len', 'BD', 48)],
       5: [('len', 'FH', 20), ('len', 'ET', 4), ('len', 'TG', 14), ('eq', 'EF', 'EH'), ('eq', 'GF', 'GH'), ('eq', 'FT', 'TH')],
       6: [('ang', 'AOB', 90), ('eq', 'BO', 'OD')],
       7: [('len', 'RS', 16), ('len', 'RU', 16), ('len', 'TS', 10), ('len', 'TU', 10)],
       8: [('len', 'AO', 4), ('len', 'OC', 7), ('len', 'BD', 10), ('eq', 'AB', 'AD'), ('eq', 'CB', 'CD'), ('ang', 'AOB', 90)],
       10: [('len', 'AB', 6), ('len', 'AD', 6), ('len', 'CB', 9), ('len', 'CD', 9)],
       12: [('len', 'PR', 10), ('len', 'QS', 7), ('eq', 'PQ', 'QR'), ('eq', 'QR', 'RS'), ('eq', 'RS', 'SP')],
       14: [('len', 'AB', 45), ('len', 'AD', 45), ('len', 'BC', 60), ('len', 'CD', 60), ('len', 'BD', 72)],
       15: [('ang', 'ABC', 100), ('ang', 'ADC', 100), ('ang', 'BAD', 50)],
       16: [('len', 'AB', 29), ('len', 'AD', 29), ('len', 'CB', 35), ('len', 'CD', 35), ('len', 'BD', 42),
            ('len', 'KL', 29), ('len', 'KN', 29), ('len', 'ML', 35), ('len', 'MN', 35), ('ang', 'KLM', 90)],
       18: [('eq', 'AB', 'AD'), ('eq', 'CB', 'CD'), ('eq', 'BM', 'MD')],
       20: [('ang', 'BAD', 90), ('len', 'BD', 10), ('len', 'CB', 13)]}
for n, rows_ in GIV.items():
    P = pts('q%d_head' % n)
    for r in rows_:
        if r[0] == 'len':
            got, want = dist(P, *r[1]), r[2]
        elif r[0] == 'ang':
            got, want = ang(P, *r[1]), r[2]
        else:
            got, want = dist(P, *r[1]), dist(P, *r[2])
        if abs(got - want) > 2e-4 * max(1, want):
            model_bad.append('q%d given %s: %.5f vs %s' % (n, r, got, want))
        else:
            model_ok += 1
# convexity of every drawn kite (heads on opposite sides of the secondary)
for n, quad in [(2, 'ABCD'), (3, 'KLMN'), (4, 'ABCD'), (5, 'EFGH'), (6, 'ABCD'), (7, 'RSTU'),
                (8, 'ABCD'), (10, 'ABCD'), (12, 'PQRS'), (14, 'ABCD'), (15, 'ABCD'), (16, 'ABCD'),
                (16, 'KLMN'), (20, 'ABCD')]:
    P = pts('q%d_head' % n)
    xy = [P[c] for c in quad]
    cr = [(xy[(i + 1) % 4][0] - xy[i][0]) * (xy[(i + 2) % 4][1] - xy[(i + 1) % 4][1])
          - (xy[(i + 1) % 4][1] - xy[i][1]) * (xy[(i + 2) % 4][0] - xy[(i + 1) % 4][0]) for i in range(4)]
    if not (all(c > 0 for c in cr) or all(c < 0 for c in cr)):
        model_bad.append('q%d %s not convex' % (n, quad))
    else:
        model_ok += 1

print('exact keys recomputed: %d' % len(X))
print('stored == exact: %d   MISMATCH: %d   not found in sheet: %d' % (ok_n, len(bad), len(missing)))
for b in bad:
    print('   ', b)
for m in missing:
    print('    missing', m)
print('model re-measurements: %d ok   %d BAD   %d skipped' % (model_ok, len(model_bad), len(model_skip)))
for b in model_bad:
    print('   ', b)
for s in model_skip:
    print('    skipped', s)
sys.exit(1 if (bad or missing or model_bad) else 0)
