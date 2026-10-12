# -*- coding: utf-8 -*-
"""Cross-level scan: level a against levels b and c (built sheet.json).
Per question pair (a qN, other qM) it reports:
  E  a shared variable expression in the stems/items ('2x+1', '3x+10' ...),
  T  a shared right triangle with integer sides, read from the question's
     FIGURE coordinates (a right angle at a drawn point, all three lengths
     integers in data units); for a question with no figure, from the
     printed numbers only when its key uses Pythagoras. S = the question's
     whole set of right triangles (2 or more) equal to the other's after a
     common scale -- a scaled design,
  N  the same set of stem numbers (2 or more numbers),
  R  the same item-role sequence (self_scan's classifier) together with a
     shared E, T or N (a role match alone is reported only as a count).
  A  a shared set of angle values (3 or more, at least one not 60 or 90),
     from every angle find value of the key and every angle given of the
     figures -- so angles that come out of an equation are compared too,
  R  every pair with the same item-role sequence is listed for adjudication.
Exit 1 when any E, T, S, N or A is found."""
import json, re, sys, math, itertools
from fractions import Fraction
sys.path.insert(0, '.')
from self_scan import role
base = sys.argv[1] if len(sys.argv) > 1 else '../../pkg/out/deliver'
L = dict((k, json.load(open('%s/%s/sheet.json' % (base, k), encoding='utf-8')))
         for k in 'abc')
def texts(q):
    out = [q.get('intro') or q.get('text') or '']
    for it in q.get('items') or []:
        out += [it.get('text') or '', it.get('answer') or '']
    return out
def stem_items(q):
    return ' '.join([q.get('intro') or ''] + [it.get('text') or '' for it in q.get('items') or []])
def exprs(t):
    t = t.replace(u'−', '-').replace(' ', '')
    return set(m for m in re.findall(r'\d*x[+-]\d+|\d+[+-]\d*x', t))
def ints(ts):
    return set(int(x) for t in ts for x in re.findall(r'(?<![\d.])\d+(?![\d.])', t) if int(x) < 5000)
def triangles(ns):
    out = set()
    for a, b in itertools.combinations(sorted(ns), 2):
        c = math.isqrt(a * a + b * b)
        if a > 0 and c * c == a * a + b * b and c in ns:
            out.add((a, b, c))
    return out
def fig_triangles(sj, n):
    out = set()
    for f in sj.get('figures') or []:
        if f.get('question') != 'q%d' % n:
            continue
        P = dict((o['name'], o['xy']) for o in (f.get('objects') or {}).get('points') or [] if o.get('name'))
        names = sorted(P)
        def d(a, b):
            return math.hypot(P[a][0] - P[b][0], P[a][1] - P[b][1])
        for x in names:
            for a, b in itertools.combinations([y for y in names if y != x], 2):
                u = (P[a][0] - P[x][0], P[a][1] - P[x][1]); w = (P[b][0] - P[x][0], P[b][1] - P[x][1])
                nu, nw = math.hypot(*u), math.hypot(*w)
                if nu < 1e-9 or nw < 1e-9 or abs(u[0] * w[0] + u[1] * w[1]) / (nu * nw) > 1e-6:
                    continue
                L = [nu, nw, d(a, b)]
                if all(abs(l - round(l)) < 1e-4 for l in L):
                    out.add(tuple(sorted(int(round(l)) for l in L)))
    return out
def prim(t):
    g = math.gcd(math.gcd(*t[:2]), t[2]); return tuple(x // g for x in t)
def nums(t):
    return tuple(sorted(set(re.findall(r'(?<![A-Za-z\d.])\d+(?:\.\d+)?', t))))
info = {}
for k, sj in L.items():
    for q in sj['questions']:
        ts = texts(q)
        printed = ints(ts)
        T = set(t for t in fig_triangles(sj, q['n']) if sum(v in printed for v in t) >= 2)
        if not any(f.get('question') == 'q%d' % q['n'] for f in sj.get('figures') or []):
            keys = ' '.join(it.get('answer') or '' for it in q.get('items') or [])
            if re.search(u'פיתגורס|\\^\\{2\\}|\\^2', keys):
                T = triangles(ints(ts))
        angs = set()
        for it in q.get('items') or []:
            for f in it.get('find') or []:
                if f.get('quantity') == 'angle':
                    try:
                        angs.add(float(f.get('value')))
                    except (TypeError, ValueError):
                        pass
        for f in sj.get('figures') or []:
            if f.get('question') == 'q%d' % q['n']:
                for c in f.get('constraints') or []:
                    if c.get('type') == 'angle' and c.get('value') is not None:
                        try:
                            angs.add(float(c['value']))
                        except (TypeError, ValueError):
                            pass
        info[(k, q['n'])] = dict(E=exprs(stem_items(q)), T=T, A=angs,
                                 N=nums(q.get('intro') or ''),
                                 R=tuple(role(it.get('text') or '') for it in q.get('items') or []))
bad, notes, rmatch = [], [], 0
for (ka, na), A in sorted(info.items()):
    if ka != 'a':
        continue
    for (kb, nb), B in sorted(info.items()):
        if kb == 'a':
            continue
        tag = 'a q%d ~ %s q%d' % (na, kb, nb)
        e = A['E'] & B['E']
        t = A['T'] & B['T']
        def sig(T):
            if len(T) < 2:
                return None
            g = 0
            for x in T:
                for v in x:
                    g = math.gcd(g, v)
            return tuple(sorted(tuple(v // g for v in x) for x in T))
        s = sig(A['T']) if (sig(A['T']) and sig(A['T']) == sig(B['T']) and A['T'] != B['T']) else None
        nset = A['N'] if len(A['N']) >= 2 and A['N'] == B['N'] else None
        if e:
            bad.append('%s  E shared expression(s) %s' % (tag, sorted(e)))
        if t:
            bad.append('%s  T shared triangle(s) %s' % (tag, sorted(t)))
        if s:
            bad.append('%s  S same set of right triangles up to scale %s' % (tag, s))
        if nset:
            bad.append('%s  N same stem numbers %s' % (tag, nset))
        sa = A['A'] & B['A']
        if len(sa) >= 3 and sa - {60.0, 90.0}:
            bad.append('%s  A shared angle set %s' % (tag, sorted(sa)))
        if A['R'] == B['R']:
            rmatch += 1
            notes.append('%s  R same role sequence %s (adjudicate)' % (tag, '-'.join(A['R'])))
            if e or t or nset or s:
                notes.append('%s  R same role sequence %s plus shared data above' % (tag, '-'.join(A['R'])))
print('pairs %d; same role sequence alone: %d pairs' % (20 * (len(L['b']['questions']) + len(L['c']['questions'])), rmatch))
print('FINDINGS (E, exact T, N): %d' % len(bad))
for b in bad:
    print('  ', b)
print('NOTES (scaled triangles, role+data): %d' % len(notes))
for n in notes:
    print('  ', n)
sys.exit(1 if bad else 0)
