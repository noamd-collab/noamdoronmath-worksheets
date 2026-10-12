import re,sys
s=open(sys.argv[1],encoding='utf-8').read()
# print question stems and item texts compactly
for m in re.finditer(r'l\.q\((\d+),\s*u?"([^"]*)"',s):
    print('Q'+m.group(1)+':',m.group(2)[:260])
    # items following
    end=s.find('l.q(',m.end())
    blk=s[m.end(): end if end>0 else len(s)]
    for it in re.finditer(r'I\(u?"(.)",\s*u?"([^"]*)"',blk):
        print('   ',it.group(1),it.group(2)[:200])
