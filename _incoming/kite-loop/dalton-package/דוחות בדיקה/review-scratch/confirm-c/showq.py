import sys, json
exec(open('dupscan.py').read().split('C = load')[0])
corp = {k: load(f) for k, f in CORP.items()}
corp['c'] = load(K + '/c/sheet.json')
for arg in sys.argv[1:]:
    k, n = arg.rsplit(':', 1)
    for q in corp[k]:
        if q['n'] == int(n):
            print(f'##### {k} q{n}\nTEXT: {q["text"]}\nANS: {q["ans"][:1500]}\n')
