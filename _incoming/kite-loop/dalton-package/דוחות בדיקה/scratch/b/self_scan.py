#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""Level b originality self-scan, inside the level only.

  * SKELETON: no two questions share the same skeleton -- the visual kind
    (figure family / table / words) together with the sequence of item roles
    (verb class + target kind). Also no two questions share the role
    sequence alone when it is 3+ items long.
  * NUMBERS: no Pythagorean pair, equation or number set repeats in the same
    role in two questions (triples from the keys, x-equations from the text,
    the multiset of numbers each stem prints).
  * K index: the principle ids each question tests (author's map, checked
    against the blueprint's level-b coverage K01-K16 + K18).

    python3 self_scan.py <deliver/b dir>
Exit 0 only when every check is clean.
"""
import json
import math
import re
import sys
from collections import defaultdict
from pathlib import Path

D = Path(sys.argv[1] if len(sys.argv) > 1 else
         Path(__file__).resolve().parent / 'probe/pkg/out/deliver/b')
sheet = json.loads((D / 'sheet.json').read_text())
WV = json.loads((Path(__file__).resolve().parents[2] / 'WRITER_VIEW_G9-KITE.json').read_text())

KMAP = {
    1: ['K01', 'K02', 'K15', 'K16'],
    2: ['K02', 'K04', 'K05'],
    3: ['K03', 'K04', 'K06', 'K07'],
    4: ['K07', 'K10', 'K09'],
    5: ['K07', 'K09', 'K15', 'K16'],
    6: ['K11', 'K03', 'K12'],
    7: ['K01', 'K02', 'K08'],
    8: ['K09', 'K06'],
    9: ['K14', 'K13', 'K16', 'K07'],
    10: ['K13', 'K04', 'K03', 'K15'],
    11: ['K12', 'K11', 'K14'],
    12: ['K16', 'K07', 'K09'],
    13: ['K14', 'K11', 'K10', 'K16'],
    14: ['K01', 'K10', 'K09', 'K18'],
    15: ['K05', 'K08', 'K04'],
    16: ['K12', 'K10', 'K09', 'K18'],
    17: ['K14', 'K09', 'K18', 'K16'],
    18: ['K11', 'K06', 'K07'],
    19: ['K18', 'K08', 'K12'],
    20: ['K04', 'K06', 'K10', 'K09'],
}
REQUIRED = ['K%02d' % i for i in range(1, 17)] + ['K18']

VERBS = [(u'הוכיחו', 'prove'), (u'הסיקו', 'deduce'), (u'הפריכו', 'refute'),
         (u'בנו', 'construct'), (u'כתבו סדר', 'plan'), (u'חשבו', 'compute'),
         (u'מצאו', 'find'), (u'הסבירו', 'explain'), (u'נמקו', 'explain'),
         (u'קבעו', 'decide'), (u'האם', 'decide'), (u'רשמו', 'name'),
         (u'אילו', 'identify'), (u'איזה', 'identify'), (u'באיזה', 'identify'),
         (u'באיזו', 'identify'), (u'מה ', 'identify'), (u'מהו', 'identify')]


def role(it):
    t = it.get('text') or ''
    hits = sorted((t.find(w), r) for w, r in VERBS if w in t)
    verb = hits[0][1] if hits else 'other'
    kinds = []
    for f in it.get('find') or []:
        kinds.append(f.get('quantity'))
    for c in it.get('to_prove') or []:
        if isinstance(c, str) and not c.startswith(u'אורך') and not c.startswith(u'הערך'):
            kinds.append('claim')
    return verb + ':' + '+'.join(sorted(set(kinds)))


fails = []
skel = {}
roles_only = defaultdict(list)
for q in sheet['questions']:
    vis = q.get('figure') and next(f['fam'] for f in sheet['figures'] if f['id'] == q['figure'])
    vis = vis or ('table' if q.get('table') else 'words')
    seq = tuple(role(it) for it in q.get('items') or [])
    k = (vis, seq)
    if k in skel:
        fails.append('SKELETON q%s = q%s %s' % (q['n'], skel[k], k))
    skel[k] = q['n']
    if len(seq) >= 3:
        roles_only[seq].append(q['n'])
for seq, ns in roles_only.items():
    if len(ns) > 1:
        fails.append('ROLE SEQUENCE shared by q%s: %s' % (ns, seq))

# Pythagorean pairs used in keys: "a·a−b·b" or "a·a+b·b"
trip = defaultdict(list)
eqs = defaultdict(list)
nums = {}
for q in sheet['questions']:
    keys = u' '.join(it.get('answer') or '' for it in q.get('items') or [])
    for a, op, b in re.findall(u'(\\d+)·\\1\\s*([−+])\\s*(\\d+)·\\3', keys):
        a, b = int(a), int(b)
        c = math.isqrt(a * a - b * b) if op == u'−' else math.isqrt(a * a + b * b)
        trip[tuple(sorted((a, b, c)))].append(q['n'])
    text = u' '.join([q.get('text') or ''] + [it.get('text') or '' for it in q.get('items') or []])
    for e in re.findall(r'\$([^$]*x[^$]*)\$', text):
        e = re.sub(r'\s', '', e)
        if e != 'x':
            eqs[e].append(q['n'])
    stem = re.findall(r'(?<![A-Za-z\d])\d+(?![\d])', re.sub(r'\$[^$]*[A-Za-z][^$]*\$', ' ', q.get('text') or ''))
    nums[q['n']] = tuple(sorted(int(x) for x in stem))
for t, ns in trip.items():
    if len(set(ns)) > 1:
        fails.append('PYTHAGORAS pair %s in questions %s' % (t, sorted(set(ns))))
for e, ns in eqs.items():
    if len(set(ns)) > 1:
        fails.append('EQUATION %s in questions %s' % (e, sorted(set(ns))))
seen = {}
for n, s in nums.items():
    if len(s) >= 2:
        if s in seen:
            fails.append('NUMBER SET %s in q%s and q%s' % (s, seen[s], n))
        seen[s] = n

# K index
cov = defaultdict(list)
for n, ks in KMAP.items():
    for k in ks:
        cov[k].append(n)
missing = [k for k in REQUIRED if k not in cov]
if missing:
    fails.append('K not covered: %s' % missing)
if len(sheet['questions']) != 20 or sorted(KMAP) != list(range(1, 21)):
    fails.append('question count %d' % len(sheet['questions']))

print('blueprint level-b coverage:', WV['coverage']['b'])
for k in sorted(cov):
    print('  %s  q%s' % (k, ','.join(map(str, cov[k]))))
print('pythagorean pairs:', dict((str(k), v) for k, v in trip.items()))
print('skeletons: %d distinct of %d' % (len(skel), len(sheet['questions'])))
print('FINDINGS: %d' % len(fails))
for f in fails:
    print('  ', f)
sys.exit(1 if fails else 0)
