# Originality / variety scan INSIDE level c (from the built sheet.json):
#  * no two questions share the same skeleton (figure family + item role sequence);
#  * no repeated number set of the stem+givens in the same role;
#  * no repeated equation string across questions;
#  * K-id index per question (author's map, checked: every K01-K18 present).
import json, re, sys
from pathlib import Path
SJ = Path(__file__).resolve().parents[2] / 'pkg/out/deliver/c/sheet.json'
S = json.loads(SJ.read_text())
K = {1: 'K01 K02 K04 K05 K07 K15', 2: 'K03 K06 K13 K16 K17', 3: 'K04 K05 K06 K08 K15',
     4: 'K05 K08 K09 K10', 5: 'K02 K06 K11 K12 K13 K17', 6: 'K09 K10 K11 K14',
     7: 'K05 K10 K12 K14 K18', 8: 'K07 K09 K10 K12 K17', 9: 'K07 K08 K09 K10',
     10: 'K01 K05 K12 K16 K17', 11: 'K02 K08 K12 K18', 12: 'K01 K09 K12 K13',
     13: 'K03 K06 K11 K12', 14: 'K05 K09 K10 K17 K18', 15: 'K03 K04 K05 K11',
     16: 'K08 K10 K16 K17', 17: 'K09 K10 K11 K13', 18: 'K01 K02 K04 K05 K13 K16',
     19: 'K02 K09 K10 K11 K18', 20: 'K09 K10 K11 K18'}
ROLES = [('construct', r'בנו|שרטטו'), ('refute', r'הפריכו|שגוי|שגיאות'),
         ('decide', r'האם|הכריעו|קבעו אם|מספיק'), ('prove', r'הוכיחו|הראו|נמקו|הסבירו'),
         ('compute', r'חשבו|מצאו|כתבו משוואה')]
def role(t):
    return '+'.join(r for r, rx in ROLES if re.search(rx, t)) or 'other'
fams = {}
for f in S.get('figures') or []:
    fams[str(f.get('question'))] = f.get('fam') or ''
bad = 0; sk = {}; nums = {}; eqs = {}
for q in S['questions']:
    n = q['n']
    fam = next((v for k, v in fams.items() if k in (str(n), 'q%d' % n)), 'words')
    seq = tuple(role(it['text']) for it in q['items'])
    key = (fam, seq)
    if key in sk:
        print('SAME SKELETON q%d q%d' % (sk[key], n)); bad += 1
    sk[key] = n
    stem = q.get('intro') or q.get('text') or ''
    ns = tuple(sorted(set(re.findall(r'\d+(?:\.\d+)?', stem))))
    if len(ns) >= 2:
        if ns in nums:
            print('SAME NUMBER SET q%d q%d %s' % (nums[ns], n, ns)); bad += 1
        nums[ns] = n
    for it in q['items']:
        for e in re.findall(r'\$([^$]*=[^$]*)\$', it['text']):
            e2 = re.sub(r'\s', '', e)
            if re.search(r'\d', e2) and e2 in eqs and eqs[e2] != n:
                print('REPEATED EQUATION q%d q%d %s' % (eqs[e2], n, e2)); bad += 1
            eqs.setdefault(e2, n)
allk = set(x for v in K.values() for x in v.split())
miss = ['K%02d' % i for i in range(1, 19) if 'K%02d' % i not in allk]
if miss:
    print('K MISSING', miss); bad += 1
if len(S['questions']) != 20:
    print('QUESTION COUNT', len(S['questions'])); bad += 1
for q in S['questions']:
    print('q%-2d %-55s %s' % (q['n'], fams.get('q%d' % q['n'], fams.get(str(q['n']), 'words'))[:55], K[q['n']]))
print('SELF_SCAN problems:', bad)
sys.exit(bool(bad))
