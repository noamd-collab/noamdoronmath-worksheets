# -*- coding: utf-8 -*-
"""Leak scan, level a: a later item never prints an earlier item's answer.
For every item, the numeric find values and the typed relations it proves
(to_prove dicts: equal_length / perpendicular / equal_angle / shape) are
searched in the text of every LATER item of the same question (numbers as
whole tokens; relations as 'XY=ZW' / 'XY⊥ZW' / '∠ABC=∠DEF' in either order,
or the shape word with its point run). Exit 1 on any hit."""
import json, re, sys, unicodedata
p = sys.argv[1] if len(sys.argv) > 1 else 'fake/pkg/out/deliver/a/sheet.json'
sj = json.load(open(p, encoding='utf-8'))
SHAPE = {'kite': u'דלתון', 'equilateral': u'שווה צלעות', 'rhombus': u'מעוין'}
def norm(t):
    return re.sub(r'[\s$]', '', unicodedata.normalize('NFKC', t or ''))
def toks(t):
    return set(re.findall(r'(?<![\d.])\d+(?:\.\d+)?(?![\d.])', t or ''))
def rel_strings(c):
    t = c.get('type'); of = c.get('of') or []
    if t in ('equal_length', 'perpendicular') and len(of) == 2:
        op = '=' if t == 'equal_length' else u'⊥'
        a, b = of
        out = []
        for x in (a, a[::-1]):
            for y in (b, b[::-1]):
                out += [x + op + y, y + op + x]
        return out
    if t == 'equal_angle' and len(of) == 2:
        a, b = of
        out = []
        for x in (a, a[::-1]):
            for y in (b, b[::-1]):
                out += [u'∠%s=∠%s' % (x, y), u'∠%s=∠%s' % (y, x)]
        return out
    return []
hits, n = [], 0
for q in sj['questions']:
    its = q['items']
    for i, it in enumerate(its):
        vals = set()
        for f in it.get('find') or []:
            v = str(f.get('value', ''))
            if re.fullmatch(r'\d+(?:\.\d+)?', v):
                vals.add(v)
        rels = [c for c in it.get('to_prove') or [] if isinstance(c, dict)]
        for later in its[i + 1:]:
            t = later.get('text') or ''
            n += 1
            for v in vals & toks(t):
                hits.append('%s prints %s, the answer of %s' % (later['id'], v, it['id']))
            nt = norm(t)
            for c in rels:
                for s in rel_strings(c):
                    if s in nt:
                        hits.append('%s prints %s, proved in %s' % (later['id'], s, it['id']))
                        break
                if c.get('type') == 'shape':
                    w = SHAPE.get(c.get('value'))
                    run = ''.join(c.get('points') or [])
                    if w and w in t and run in t:
                        hits.append('%s states %s %s, proved in %s' % (later['id'], run, w, it['id']))
print('pairs scanned %d, hits %d' % (n, len(hits)))
for h in hits:
    print('  ', h)
sys.exit(1 if hits else 0)
