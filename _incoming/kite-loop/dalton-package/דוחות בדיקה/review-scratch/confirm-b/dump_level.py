"""Dump all string constants per question of a level file (ast only, no execution)."""
import ast, sys
src = open(sys.argv[1], encoding='utf-8').read()
tree = ast.parse(src)
qs = []
for n in ast.walk(tree):
    if isinstance(n, ast.Call):
        f = n.func
        name = f.attr if isinstance(f, ast.Attribute) else getattr(f, 'id', '')
        if name == 'q' and n.args and isinstance(n.args[0], ast.Constant) and isinstance(n.args[0].value, int):
            qs.append((n.lineno, n.args[0].value, n))
qs.sort()
lines = src.split('\n')
for i, (ln, num, n) in enumerate(qs):
    end = qs[i+1][0]-1 if i+1 < len(qs) else len(lines)
    seg = '\n'.join(lines[ln-1:end])
    try:
        t = ast.parse(seg) if False else None
    except Exception:
        pass
    out = []
    for m in ast.walk(n):
        if isinstance(m, ast.Constant) and isinstance(m.value, str) and len(m.value) > 2:
            out.append(m.value)
    print('=== Q%d' % num)
    for s in out:
        print('  ', s.replace('\n', ' ')[:400])
