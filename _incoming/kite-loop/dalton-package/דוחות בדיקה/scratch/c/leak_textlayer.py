# (1) Leak scan: a later item's printed text never prints an earlier item's
#     answer value (numbers of find values not already in the stem / givens /
#     that later item's own data), and never repeats an earlier answer string.
# (2) Text layer of the PDF (student and key pages): digit ')' digit,
#     digit '(' digit, island-start '=', '=' between a unit word and a number,
#     raw sqrt codepoint.
import json, re, sys
from pathlib import Path
import pymupdf
D = Path(__file__).resolve().parents[2] / 'pkg/out/deliver/c'
S = json.loads((D / 'sheet.json').read_text())
nums = lambda s: set(re.findall(r'(?<![\d.])\d+(?:\.\d+)?(?![\d.])', str(s)))
bad = 0
for q in S['questions']:
    base = nums(q.get('intro') or q.get('text') or '') | nums(json.dumps(q.get('given'), ensure_ascii=False))
    seen = []
    for it in q['items']:
        # a later item's own text AND its own givens (an item-level given is
        # printed data too: q8 ד once printed WY = 69 as a given) -- only the
        # question's stem and question-level givens are subtracted
        own = (nums(it['text']) | nums(json.dumps(it.get('given'), ensure_ascii=False))) - base
        for lab, vals in seen:
            hit = own & vals
            if hit:
                print('LEAK? q%d%s prints %s = answer of item %s' % (q['n'], it['label'], sorted(hit), lab)); bad += 1
        v = set()
        for f in it.get('find') or []:
            v |= nums(f.get('value'))
        v -= {'0', '1', '2'}
        seen.append((it['label'], v))
doc = pymupdf.open(D / 'sheet.pdf')
pat = [(r'\d\)\d', 'digit ) digit'), (r'\d\(\d', 'digit ( digit'), (r'√', 'raw root glyph'),
       (r'(ס״מ|סמ״ר|מ״ר|מ׳)\s*=\s*\d', 'unit = number'), (r'\d\s*=\s*(ס״מ|סמ״ר|מ״ר)', 'number = unit')]
for i, pg in enumerate(doc):
    t = pg.get_text('text', sort=False)
    for rx, what in pat:
        for m in re.finditer(rx, t):
            print('TEXT p%d %s: %r' % (i + 1, what, t[max(0, m.start() - 15):m.end() + 15])); bad += 1
for q in S['questions']:
    for it in q['items']:
        for s in re.findall(r'\$([^$]*)\$', it['text'] + str(it.get('answer') or '')):
            if s.strip().startswith('='):
                print('ISLAND STARTS WITH = q%d%s' % (q['n'], it['label'])); bad += 1
print('pages', len(doc), '| LEAK+TEXT problems:', bad)
sys.exit(bool(bad))
