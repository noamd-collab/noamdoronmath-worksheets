#!/usr/bin/env python3
# -*- coding: utf-8 -*-
u"""PROBE ONLY -- never a delivery.

content.py says PACKAGE = "G9-KITE", which deliver.py refuses (PACKAGE_RE
wants a site topic id) and which the writer may not edit or replace (no site
id may be invented). To still run deliver, verify_export, selfcheck and
check_didactic on level b's CONTENT, this copies kit.py, level_b.py and a
content.py whose only change is PACKAGE = "G9-T99" (an obviously fake probe
id) into scratch/b/probe/pkg and builds there, under the shared build lock.
Nothing here is delivered; out/ of the probe is scratch.
"""
import fcntl, re, shutil, subprocess, sys, os
from pathlib import Path
HERE = Path(__file__).resolve().parent
PKG = HERE.parents[1] / 'pkg'
KS = HERE.parents[2]
SKILL = KS.parents[2] / '18-worksheets/work/buildroot/skills/hebrew-math-worksheet-v5'
PROBE = HERE / 'probe' / 'pkg'
if PROBE.exists():
    shutil.rmtree(PROBE)
PROBE.mkdir(parents=True)
for f in ('kit.py', 'level_b.py'):
    shutil.copy2(PKG / f, PROBE / f)
c = (PKG / 'content.py').read_text()
c2 = c.replace('PACKAGE = "G9-KITE"', 'PACKAGE = "G9-T99"  # PROBE ONLY')
assert c2 != c
(PROBE / 'content.py').write_text(c2)
env = dict(os.environ, LEVEL='b', DYLD_FALLBACK_LIBRARY_PATH='/opt/homebrew/lib')
with (KS / 'build-resource.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    r = subprocess.run([sys.executable, str(SKILL / 'build_plus.py')], cwd=str(PROBE),
                       env=env, capture_output=True, text=True)
(HERE / 'probe' / 'build.log').write_text(r.stdout + r.stderr)
log = r.stdout + r.stderr
print('\n'.join([l for l in log.splitlines() if l.startswith(('GATES', 'built ', 'G8', 'G7')) or 'FAIL' in l or 'Error' in l][-20:]))
if r.returncode:
    print('PROBE BUILD FAILED'); sys.exit(1)
out = PROBE / 'out/deliver/b'
for tool in ('verify_export', 'selfcheck_noam_package', 'check_didactic'):
    rr = subprocess.run([sys.executable, str(SKILL / (tool + '.py')), str(out)],
                        capture_output=True, text=True, env=env)
    (HERE / 'probe' / (tool + '.log')).write_text(rr.stdout + rr.stderr)
    t = rr.stdout + rr.stderr
    n = re.findall(r'(\d+) error', t)
    m = re.search(r'PASS (\d+)\s+FAIL (\d+)\s+REVIEW (\d+)', t)
    print(tool, 'rc', rr.returncode, 'errors', n[-1] if n else '?', m.group(0) if m else '')
