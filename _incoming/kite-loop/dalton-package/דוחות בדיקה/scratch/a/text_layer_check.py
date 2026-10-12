# -*- coding: utf-8 -*-
"""Text-layer and island check, level a (student and key pages).
1. PDF text layer: no digit-bracket-digit ('4)12', '4(12' reversed) -- '(' and
   ')' compared as different characters; no '=' sitting between a unit word
   and a number; no empty operator pair (dropped operand: '= =', '+ ·', '·=').
2. Source islands (sheet.json texts, intros and answers): no island starts or
   ends with '=' or an operator; no Hebrew parenthetical in round brackets
   anywhere; brackets balanced inside every island. Exit 1 on any finding."""
import json, re, sys
import pymupdf as fitz
base = sys.argv[1] if len(sys.argv) > 1 else 'fake/pkg/out/deliver/a'
bad = []
doc = fitz.open(base + '/sheet.pdf')
UNIT = u'(?:ס״מ|סמ״ר|מ״ר|מ׳|מעלות)'
for i, pg in enumerate(doc):
    t = pg.get_text()
    for m in re.finditer(r'\d\)\d|\d\(\d', t):
        bad.append('page %d: digit-bracket-digit %r' % (i + 1, t[max(0, m.start()-8):m.end()+8]))
    for m in re.finditer(UNIT + r'\s*=\s*\d|\d\s*=\s*' + UNIT, t):
        bad.append('page %d: "=" between unit and number %r' % (i + 1, m.group(0)))
    for m in re.finditer(r'[=+·−]\s*[=+·]', t):
        bad.append('page %d: operator pair %r' % (i + 1, t[max(0, m.start()-8):m.end()+8]))
sj = json.load(open(base + '/sheet.json', encoding='utf-8'))
texts = []
for q in sj['questions']:
    texts.append(('q%s stem' % q['n'], q.get('intro') or q.get('text') or ''))
    for it in q['items']:
        texts.append((it['id'], it.get('text') or ''))
        texts.append((it['id'] + ' key', it.get('answer') or ''))
n_isl = 0
for where, t in texts:
    if re.search(u'\\([^()$]*[\u05d0-\u05ea][^()$]*\\)', re.sub(r'\$[^$]*\$', '', t)):
        bad.append('%s: Hebrew parenthetical' % where)
    for isl in re.findall(r'\$([^$]*)\$', t):
        n_isl += 1
        s = isl.strip()
        if s.startswith('=') or s.endswith('='):
            bad.append('%s: island %r starts/ends with "="' % (where, isl))
        if re.match(u'^[+·−]', s) and not re.match(u'^−\\d', s):
            bad.append('%s: island %r starts with an operator' % (where, isl))
        if s.count('(') != s.count(')') or s.count('{') != s.count('}'):
            bad.append('%s: unbalanced island %r' % (where, isl))
for where, t in texts:
    for m in re.finditer(r'\$(\d[^$]*\d)\$\.', t):
        bad.append('%s: digit-led island against a period %r' % (where, m.group(0)))
print('pages %d, islands %d, findings %d' % (doc.page_count, n_isl, len(bad)))
for b in bad:
    print('  ', b)
sys.exit(1 if bad else 0)
