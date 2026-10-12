# -*- coding: utf-8 -*-
"""Self scan of G9-KITE level a (originality inside the level).
Reads the built sheet.json. Checks: no two questions share the same role
sequence; no repeated number set in the same role (stem numbers); prints the
K-id index per question. Exit 1 on any finding."""
import json, re, sys
K = {1: 'K01 K02', 2: 'K01 K12 K02', 3: 'K03 K05 K04', 4: 'K05 K02',
     5: 'K06 K07 K10 K15', 6: 'K06 K09', 7: 'K08 K02 K15', 8: 'K11 K03 K12',
     9: 'K13 K06 K05', 10: 'K14 K01', 11: 'K15 K07 K10 K08',
     12: 'K09 K10 K08 K07', 13: 'K05 K04 K02', 14: 'K16 K02 K04 K06',
     15: 'K15 K05 K04', 16: 'K12 K03 K06', 17: 'K12 K14 K07',
     18: 'K08 K10 K07', 19: 'K14 K10 K09 K05', 20: 'K07 K06 K09'}
W = u'(?<![א-ת])%s(?![א-ת])'
ROLES = [('construct', W % u'(?:בנו|שרטטו|בצעו)'), ('error', u'הטעות|שגוי|טל פתר|השוויון שבחר'),
         ('feasibility', u'אין דלתון כזה'), ('prove', u'הוכיחו'),
         ('solve', u'מצאו את [$]x[$]'), ('two-ways', u'בשתי דרכים'), ('check', u'ובדקו'),
         ('apply', u'השתמשו'), ('derive', u'הסיקו|הראו'), ('name', u'מהם|רשמו'),
         ('decide', u'האם'), ('context', W % u'(?:ערוגה|גדר)'), ('calc', u'חשבו|מצאו'),
         ('explain', u'הסבירו|תארו|מדוע|כתבו נתון|איזה שלב|מה ידוע')]
def role(t):
    for r, rx in ROLES:
        if re.search(rx, t):
            return r
    return '?'
def nums(t):
    return tuple(sorted(set(re.findall(r'(?<![A-Za-z])\d+(?:\.\d+)?', re.sub(r'\\f', '', t)))))
def main():
    p = sys.argv[1] if len(sys.argv) > 1 else '../../pkg/out/deliver/a/sheet.json'
    sj = json.load(open(p, encoding='utf-8'))
    bad = []
    seqs, numsets = {}, {}
    for q in sj['questions']:
        n = q['n']
        seq = tuple(role(it['text']) for it in q['items'])
        seqs.setdefault(seq, []).append(n)
        stem = q.get('intro') or q.get('text') or ''
        ns = nums(stem)
        if len(ns) >= 2:
            numsets.setdefault(ns, []).append(n)
        if '?' in seq:
            bad.append('q%d has an unclassified item role %s' % (n, seq))
        print('q%-2d %-22s roles %s  stem-numbers %s' % (n, K[n], '-'.join(seq), ','.join(ns) or '-'))
    for s, qs in seqs.items():
        if len(qs) > 1:
            bad.append('same role sequence %s in questions %s' % ('-'.join(s), qs))
    for s, qs in numsets.items():
        if len(qs) > 1:
            bad.append('same stem number set %s in questions %s' % (s, qs))
    cov = sorted(set(k for v in K.values() for k in v.split()))
    need = ['K%02d' % i for i in range(1, 17)]
    miss = [k for k in need if k not in cov]
    if miss:
        bad.append('principles not covered: %s' % miss)
    print('coverage:', ' '.join(cov))
    print('FINDINGS: %d' % len(bad))
    for b in bad:
        print('  ', b)
    sys.exit(1 if bad else 0)


if __name__ == '__main__':
    main()
