"""Confirm-c duplication scan: level c vs live a, b, old kite-level-a, kite-smoke, G9-T15, G9-T19.
Reads delivered sheet.json files only (read-only). Prints candidate pairs for eye review."""
import json, re, difflib, glob
R = '/Users/noamdoron/worksheet-work/hub-18/tasks'
K = R + '/143-packages/work/kite-supplement/G9-KITE/pkg/out/deliver'
CORP = {
    'kite_a': K + '/a/sheet.json', 'kite_b': K + '/b/sheet.json',
    'old_kite_a': '/Users/noamdoron/worksheet-work/kite-level-a/pkg/out/deliver/a/sheet.json',
}
for lv in 'abc':
    CORP['T15_' + lv] = R + f'/18-worksheets/workspace/original/packages/G9-T15/final/{lv}/sheet.json'
    CORP['T19_' + lv] = R + f'/143-packages/work/batch-06/G9-T19/pkg/out/deliver/{lv}/sheet.json'
SMOKE = [dict(n=1, text='A(3,8) B(6,3) C(3,0) D(0,3) kite AB=AD CB=CD find AC=8', ans='8', nums={3, 8, 6})]

TRIV = {0, 1, 2, 3, 4, 90, 180, 360, 100}


def nums(s):
    s = s.replace('−', '-')
    return {float(x) for x in re.findall(r'(?<![A-Za-z])\d+(?:\.\d+)?', s)} - TRIV


def norm(s):
    return re.sub(r'[\s$\\{}]+', ' ', s)


def load(f):
    d = json.load(open(f))
    out = []
    for q in d['questions']:
        txt = q.get('text', '') + ' ' + ' '.join(map(str, q.get('given', [])))
        ans = ''
        for it in q.get('items', []):
            txt += ' | ' + it.get('label', '') + ' ' + it.get('text', '') + ' ' + ' '.join(map(str, it.get('given', [])))
            ans += ' ' + str(it.get('answer', ''))
        out.append(dict(n=q['n'], text=norm(txt), ans=norm(ans), nums=nums(txt) | nums(ans), tnums=nums(txt)))
    return out


C = load(K + '/c/sheet.json')
corp = {k: load(f) for k, f in CORP.items()}
corp['smoke'] = SMOKE
rows = []
for c in C:
    for k, qs in corp.items():
        for q in qs:
            sh = (c['nums'] & q['nums'])
            big = {x for x in sh if x >= 5}
            sim = difflib.SequenceMatcher(None, c['text'], q['text']).ratio()
            if len(big) >= 2 or sim > 0.35:
                rows.append((c['n'], k, q['n'], round(sim, 2), sorted(big)))
for r in sorted(rows, key=lambda r: (r[0], -len(r[4]), -r[3])):
    print(r)
