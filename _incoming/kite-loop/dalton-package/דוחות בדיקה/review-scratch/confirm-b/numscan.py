"""Cross-sheet number-set scan: b questions vs other sheets. Integers >=5, excluding 90/180/360."""
import re, sys
IGN = {90, 180, 360, 100}
def nums(t):
    t = t.replace('%s', '-')
    return {int(x) for x in re.findall(r'(?<![\d.])\d+(?![\d.])', t) if 5 <= int(x) <= 99999 and int(x) not in IGN}
def dump_qs(path):
    qs = {}; cur = None
    for line in open(path, encoding='utf-8'):
        m = re.match(r'=== Q(\d+)', line)
        if m: cur = int(m.group(1)); qs[cur] = ''; continue
        if cur: qs[cur] += line
    return qs
def pdf_qs(path):
    t = open(path, encoding='utf-8').read()
    cut = t.find('תשובות סופיות')
    stud, key = (t[:cut], t[cut:]) if cut > 0 else (t, '')
    qs = {}
    parts = re.split(r'\((\d{1,2})\)', stud)
    # parts: text, num, text, num...
    for i in range(1, len(parts) - 1, 2):
        n = int(parts[i]); qs[n] = qs.get(n, '') + parts[i+1]
    kparts = re.split(r'\((\d{1,2})\)', key)
    for i in range(1, len(kparts) - 1, 2):
        n = int(kparts[i]); qs[n] = qs.get(n, '') + kparts[i+1]
    return qs
b = dump_qs('b_dump.txt')
others = {'a': dump_qs('a_dump.txt'), 'c': dump_qs('c_dump.txt')}
for k in ['kla', 'T15a', 'T15b', 'T15c', 'T19a', 'T19b', 'T19c']:
    others[k] = pdf_qs('ext/%s.txt' % k)
for bq, bt in sorted(b.items()):
    bn = nums(bt)
    for src, qs in others.items():
        for oq, ot in sorted(qs.items()):
            sh = bn & nums(ot)
            big = {x for x in sh if x >= 10}
            if len(sh) >= 3 or len(big) >= 2:
                print('b q%-2d ~ %s q%-2d shared %s' % (bq, src, oq, sorted(sh)))
