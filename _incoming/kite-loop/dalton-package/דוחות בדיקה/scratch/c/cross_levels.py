# Cross-level number-set check: for each level-c question, the integers >= 13
# printed in its stem/items (not keys) vs every question of the live
# level_a.py / level_b.py (stem + items + keys, read-only). Flags any pair
# sharing 3+ such numbers, for a human look. Also the explicitly retired sets.
import re, sys
from pathlib import Path
PKG = Path(__file__).resolve().parents[2] / 'pkg'
def blocks(path):
    s = path.read_text(encoding='utf-8')
    idx = [(m.start(), int(m.group(1))) for m in re.finditer(r'l\.q\((\d+),', s)]
    out = {}
    for k, (i, n) in enumerate(idx):
        j = idx[k + 1][0] if k + 1 < len(idx) else len(s)
        out[n] = s[i:j]
    return out
def big(t):
    # round 2 (CF-08): every value >= 3, so 3/8/10 kites and angle sets are
    # compared too; only 0-2 and the angle constants 90/180/360 are skipped
    return set(int(x) for x in re.findall(r'(?<![\d.])(\d+)(?![\d.])', t) if 3 <= int(x) <= 9999) - {90, 180, 360}
sys.path[:0] = [str(PKG), '/Users/noamdoron/worksheet-work/hub-18/tasks/18-worksheets/work/buildroot/skills/hebrew-math-worksheet-v5']
import level_c
C = {}
for q in level_c.Lc['questions']:
    C[q['n']] = big(q['intro'] + ' '.join(it['text'] for it in q['items']) +
                    ' '.join(str(g) for it in q['items'] for g in it.get('given', [])) +
                    ' '.join(str(g) for g in q.get('given', [])))
hits = 0
for lv in ('a', 'b'):
    B = {n: big(t) for n, t in blocks(PKG / ('level_%s.py' % lv)).items()}
    for n, cs in C.items():
        for m, bs in B.items():
            com = cs & bs
            if len(com) >= 3:
                print('c q%d ~ %s q%d share %s' % (n, lv, m, sorted(com))); hits += 1
RETIRED = [{15, 41, 18}, {35, 53, 56}, {39, 72, 42}, {25, 39, 24}, {15, 20, 24}, {25, 40, 48}]
for n, cs in C.items():
    for r in RETIRED:
        if len(cs & r) >= 2:
            print('c q%d uses retired set %s' % (n, sorted(r))); hits += 1
print('CROSS-LEVEL pairs to inspect:', hits)

# Right-triangle check: every integer Pythagorean triangle used in a level-c
# question (from its printed data and key) against every sibling question that
# contains all three of its numbers (numbers >= 5, to skip 3-4-5 noise).
import math as _m
def triples(t):
    ns = sorted(set(int(x) for x in re.findall(r'(?<![\d.])(\d+)(?![\d.])', t) if 5 <= int(x) <= 300))
    out = set()
    for i, a in enumerate(ns):
        for b in ns[i + 1:]:
            c = _m.isqrt(a * a + b * b)
            if c * c == a * a + b * b and c in ns:
                out.add((a, b, c))
    return out
CT = {}
for q in level_c.Lc['questions']:
    txt = q['intro'] + ' '.join(it['text'] for it in q['items'])
    for n, rows, *_ in level_c.Lc['answers']:
        if n == q['n']:
            txt += ' '.join(k for _l, k in rows)
    CT[q['n']] = triples(txt)
th = 0
for lv in ('a', 'b'):
    for m, t in blocks(PKG / ('level_%s.py' % lv)).items():
        bt = triples(t)
        for n, ct in CT.items():
            com = ct & bt
            if com:
                print('TRIANGLE c q%d ~ %s q%d: %s' % (n, lv, m, sorted(com))); th += 1
print('shared right triangles:', th)
