# Lint the printed strings of level c before building: Hebrew parentheticals,
# islands starting with '=', digit-led island + period, one-letter angles,
# raw root / not-equal codepoints, unbalanced islands.
import os, re, sys
PKG = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'pkg')
SK = '/Users/noamdoron/worksheet-work/hub-18/tasks/18-worksheets/work/buildroot/skills/hebrew-math-worksheet-v5'
sys.path[:0] = [PKG, SK]
import level_c
L = level_c.Lc
texts = [('rule', L['rule']), ('subtitle', L['subtitle']), ('ansnote', L['ansnote'])]
for q in L['questions']:
    texts.append(('q%d stem' % q['n'], q['intro']))
    for it in q['items']:
        texts.append(('q%d%s text' % (q['n'], it['label']), it['text']))
for n, rows, *_ in L['answers']:
    for lab, key in rows:
        texts.append(('q%d%s key' % (n, lab), key))
bad = 0
for where, t in texts:
    if t.count('$') % 2:
        print(where, 'ODD $'); bad += 1; continue
    parts = t.split('$')
    for i, p in enumerate(parts):
        if i % 2 == 0:
            if '(' in p or ')' in p:
                print(where, 'HEBREW PAREN:', p[:60]); bad += 1
            if '√' in p or '≠' in p:
                print(where, 'raw glyph outside island'); bad += 1
        else:
            s = p.strip()
            if s.startswith('='):
                print(where, 'ISLAND STARTS WITH =:', s); bad += 1
            if re.match(r'\d', s) and i + 1 < len(parts) and parts[i + 1].startswith('.'):
                print(where, 'DIGIT-LED ISLAND + PERIOD:', s); bad += 1
            if re.search(r'∠[A-Z](?![A-Z])', s):
                print(where, 'ONE-LETTER ANGLE:', s); bad += 1
            if '√' in s or '≠' in s:
                print(where, 'RAW GLYPH IN ISLAND:', s); bad += 1
print('LINT problems:', bad, 'strings:', len(texts))
