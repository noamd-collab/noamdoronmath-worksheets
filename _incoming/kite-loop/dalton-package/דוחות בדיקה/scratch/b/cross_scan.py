#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""Cross-level scan: level b against the LIVE level_a.py and level_c.py.

The other levels are read as source with `ast` and never executed, because
they may be mid-edit. Each question's string literals (stem, items, keys,
examples, table cells) are pooled, and the scan flags the following for a
b-question vs an a- or c-question:
  KITE     two or more shared Pythagorean triples (a²+b²=c², c <= 200, read
           off the length numbers both questions print) -- the same kite;
           ONE shared triple is reported as INFO (a common triangle in a
           different kite is not a copy by the batch rules);
  EQUATION the same linear expression pair: the islands holding x,
           whitespace-normalised;
  NUMBERS  3 or more shared numbers >= 5 among the stem numbers;
  ANGLES   3 or more shared degree values (90/180/360 ignored); 2 is INFO.
Exit 0 when nothing but INFO is found.
"""
import ast
import re
import sys
from collections import defaultdict
from itertools import combinations
from pathlib import Path

PKG = Path(__file__).resolve().parents[2] / 'pkg'


def questions(path):
    tree = ast.parse(path.read_text())
    out = {}
    for node in ast.walk(tree):
        if (isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute)
                and node.func.attr == 'q' and node.args
                and isinstance(node.args[0], ast.Constant)
                and isinstance(node.args[0].value, int)):
            n = node.args[0].value
            strs = [c.value for c in ast.walk(node)
                    if isinstance(c, ast.Constant) and isinstance(c.value, str)]
            stem = node.args[1].value if len(node.args) > 1 and isinstance(node.args[1], ast.Constant) else ''
            if not stem and len(node.args) > 1:
                stem = ''.join(c.value for c in ast.walk(node.args[1])
                               if isinstance(c, ast.Constant) and isinstance(c.value, str))
            out[n] = (stem, u' '.join(strs))
    return out


NUM = re.compile(r'(?<![\d.])\d+(?![\d.])')


def nums(t):
    return set(int(x) for x in NUM.findall(t))


def triples(t):
    t = re.sub(r'\d+\s*°', ' ', t)          # angle values are not lengths
    ns = sorted(x for x in nums(t) if 0 < x <= 200)
    S = set(ns)
    out = set()
    for a, b in combinations(ns, 2):
        c2 = a * a + b * b
        c = int(round(c2 ** 0.5))
        if c * c == c2 and c in S:
            out.add((a, b, c))
    return out


def eqs(t):
    return set(re.sub(r'\s', '', e) for e in re.findall(r'\$([^$]*\d[^$]*x[^$]*|[^$]*x[^$]*\d[^$]*)\$', t)
               if '=' not in e or re.search(r'[A-Z∠]=', e))


def angles(t):
    return set(int(x) for x in re.findall(r'(\d+)°', t) if int(x) not in (90, 180, 360))


L = dict((k, questions(PKG / ('level_%s.py' % k))) for k in 'abc'
         if (PKG / ('level_%s.py' % k)).exists())
fails, info = [], []
for nb, (sb, tb) in sorted(L['b'].items()):
    for other in 'ac':
        for no, (so, to) in sorted(L.get(other, {}).items()):
            tag = 'b%d vs %s%d' % (nb, other, no)
            com = triples(tb) & triples(to)
            big = sorted(t for t in com if t != (3, 4, 5))
            if len(big) >= 2:
                fails.append('KITE (two shared right triangles) %s %s' % (tag, big))
            for t in com:
                info.append('TRIPLE %s %s (one shared right triangle, different kite)' % (tag, t))
            e = eqs(sb + ' ' + tb) & eqs(so + ' ' + to)
            e = set(x for x in e if len(x) > 3)
            if e:
                fails.append('EQUATION %s %s' % (tag, sorted(e)))
            sn = set(x for x in nums(sb) & nums(so) if x >= 5)
            if len(sn) >= 3:
                fails.append('NUMBERS %s %s' % (tag, sorted(sn)))
            an = angles(sb + tb) & angles(so + to)
            if len(an) >= 3:
                fails.append('ANGLES %s %s' % (tag, sorted(an)))
            elif len(an) == 2:
                info.append('ANGLES %s %s (two common values)' % (tag, sorted(an)))
print('levels read: %s (questions %s)' % (''.join(sorted(L)), dict((k, len(v)) for k, v in L.items())))
print('FINDINGS: %d   INFO: %d' % (len(fails), len(info)))
for f in fails + ['INFO ' + i for i in info]:
    print('  ', f)
sys.exit(1 if fails else 0)
