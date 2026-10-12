#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""Level b: leak scan and text-layer checks.

LEAK   a later item's printed text (and the figure's printed labels) never
       prints an earlier item's numeric answer, unless the question's own
       data already prints that number.
LAYER  the PDF text layer of every page, student and key:
       * no digit ')' digit or digit '(' digit (bracket reversal, "4)12");
       * no '=' between a unit word and a number (an island led by '=');
       * per page, '(' and ')' are counted separately and must balance.
ISLAND every $...$ island of every printed string (stems, items, examples,
       table cells, keys): never starts with '=', no dropped operand
       (two operators in a row, an operator at an end, an empty bracket or an
       empty fraction slot), no Hebrew parenthetical anywhere.

    python3 text_checks.py <deliver/b dir> <pdf>
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

HERE = Path(__file__).resolve().parent
D = Path(sys.argv[1] if len(sys.argv) > 1 else HERE / 'probe/pkg/out/deliver/b')
PDF = Path(sys.argv[2] if len(sys.argv) > 2 else D / 'sheet.pdf')
sheet = json.loads((D / 'sheet.json').read_text())
fails = []

# ---- LEAK ----------------------------------------------------------------
NUM = re.compile(r'(?<![\d.])\d+(?:\.\d+)?(?![\d.])')
figs = dict((f['id'], f) for f in sheet['figures'])
for q in sheet['questions']:
    intro = q.get('text') or ''
    data_nums = set(NUM.findall(intro))
    for c in (q.get('table') or {}).get('rows', []) if isinstance(q.get('table'), dict) else []:
        data_nums |= set(NUM.findall(' '.join(c)))
    items = q.get('items') or []
    fig_labels = set()
    if q.get('figure'):
        for lab in figs[q['figure']]['objects'].get('labels', []):
            fig_labels |= set(NUM.findall(str(lab.get('text', ''))))
    for i, it in enumerate(items):
        ans = set()
        for f in it.get('find') or []:
            v = str(f.get('value', ''))
            if re.fullmatch(r'\d+(?:/\d+)?', v):
                ans.add(v)
        ans -= data_nums
        ans -= set(NUM.findall(it.get('text') or ''))
        for later in items[i + 1:]:
            hit = ans & set(NUM.findall(later.get('text') or ''))
            if hit:
                fails.append('LEAK q%s%s prints %s, the answer of q%s%s'
                             % (q['n'], later['label'], sorted(hit), q['n'], it['label']))
        hit = ans & fig_labels
        if hit:
            fails.append('LEAK q%s figure prints %s, the answer of %s' % (q['n'], sorted(hit), it['label']))

# ---- ISLANDS / parentheticals -------------------------------------------
strings = []
for q in sheet['questions']:
    strings.append(('q%s stem' % q['n'], q.get('text') or ''))
    ex = q.get('example')
    if ex:
        for ln in ex.get('lines', []):
            strings.append(('q%s example' % q['n'], ln))
    if isinstance(q.get('table'), dict):
        for row in [q['table'].get('head', [])] + q['table'].get('rows', []):
            for c in row:
                strings.append(('q%s table' % q['n'], c))
    for it in q.get('items') or []:
        strings.append(('q%s%s text' % (q['n'], it['label']), it.get('text') or ''))
        strings.append(('q%s%s key' % (q['n'], it['label']), it.get('answer') or ''))
OPS = u'=+−·'
n_isl = 0
for where, s in strings:
    outside = re.sub(r'\$[^$]*\$', ' ', s)
    if re.search(u'\\([^)]*[\u0590-\u05FF][^)]*\\)', outside) or '(' in outside or ')' in outside:
        fails.append('PAREN outside math in %s: %s' % (where, s[:80]))
    for isl in re.findall(r'\$([^$]*)\$', s):
        n_isl += 1
        t = isl.strip()
        if t.startswith('='):
            fails.append('ISLAND starts with "=" in %s: $%s$' % (where, isl))
        if re.search(u'[%s]\\s*[%s]' % (OPS, OPS), t) or (t and t[-1] in OPS) or (t and t[0] in u'=+·'):
            fails.append('ISLAND dropped operand in %s: $%s$' % (where, isl))
        if '()' in t.replace(' ', '') or re.search(r'\\f\{\s*\}|\}\{\s*\}', t):
            fails.append('ISLAND empty slot in %s: $%s$' % (where, isl))
        if re.search(u'[\u0590-\u05FF]', t):
            fails.append('ISLAND holds Hebrew in %s: $%s$' % (where, isl))

# ---- TEXT LAYER ----------------------------------------------------------
doc = pymupdf.open(str(PDF))
UNIT = u'(?:ס״מ|סמ״ר|מעלות)'
for i, pg in enumerate(doc):
    t = pg.get_text()
    for m in re.finditer(r'\d\s*\)\s*\d|\d\s*\(\s*\d', t):
        ctx = t[max(0, m.start() - 15):m.end() + 15].replace('\n', ' ')
        if re.search(r'\d\s*\)\s*\d', m.group(0)):
            fails.append('LAYER p%d digit)digit: %r' % (i + 1, ctx))
    for m in re.finditer(UNIT + r'\s*=\s*\d|\d\s*=\s*' + UNIT, t):
        fails.append('LAYER p%d unit "=" number: %r' % (i + 1, t[max(0, m.start() - 15):m.end() + 15]))
    if t.count('(') != t.count(')'):
        fails.append('LAYER p%d bracket counts ( %d ) %d' % (i + 1, t.count('('), t.count(')')))
    for m in re.finditer(r'\d\.(?=\s|$)', t):
        pass

print('strings scanned %d, islands %d, pages %d' % (len(strings), n_isl, len(doc)))
print('FINDINGS: %d' % len(fails))
for f in fails:
    print('  ', f)
sys.exit(1 if fails else 0)
