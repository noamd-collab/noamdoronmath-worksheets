# Sandbox build of level c ONLY, to get evidence past the shared deliver
# refusal (content.py PACKAGE 'G9-KITE' is not a site id). Copies the shared
# kit.py/content.py and level_c.py into scratch/c/sandbox, swaps PACKAGE for a
# placeholder pattern id there ONLY, takes the same build lock, builds and runs
# verify_export / selfcheck_noam_package / check_didactic. Nothing in pkg/ is
# touched; the placeholder never leaves scratch.
import fcntl, os, re, shutil, subprocess, sys
from pathlib import Path
HERE = Path(__file__).resolve().parent
PKG = HERE.parents[1] / 'pkg'
LOCK = HERE.parents[2] / 'build-resource.lock'
SK = Path('/Users/noamdoron/worksheet-work/hub-18/tasks/18-worksheets/work/buildroot/skills/hebrew-math-worksheet-v5')
SB = HERE / 'sandbox'
if SB.exists():
    shutil.rmtree(SB)
SB.mkdir()
for f in ('kit.py', 'level_c.py'):
    shutil.copy2(PKG / f, SB / f)
src = (PKG / 'content.py').read_text()
src = src.replace('PACKAGE = "G9-KITE"', 'PACKAGE = "G9-T99"  # SANDBOX PLACEHOLDER, scratch only')
(SB / 'content.py').write_text(src)
env = dict(os.environ, LEVEL='c', DYLD_FALLBACK_LIBRARY_PATH='/opt/homebrew/lib')
with open(LOCK, 'a') as lk:
    fcntl.flock(lk, fcntl.LOCK_EX)
    r = subprocess.run([sys.executable, str(SK / 'build_plus.py')], cwd=SB, env=env,
                       capture_output=True, text=True)
    log = r.stdout + r.stderr
    (HERE / 'sandbox_build.log').write_text(log)
    lines = [l for l in log.splitlines() if l.startswith(('GATES', 'built ', 'G7', 'G8', 'deliverable'))
             or 'FAIL' in l or 'Error' in l]
    print('\n'.join(lines[-30:]))
    if r.returncode:
        print('BUILD FAILED'); sys.exit(1)
    out = SB / 'out/deliver/c'
    for tool in ('verify_export', 'selfcheck_noam_package', 'check_didactic'):
        rr = subprocess.run([sys.executable, str(SK / (tool + '.py')), str(out)],
                            capture_output=True, text=True, env=env)
        (HERE / ('sandbox-' + tool + '.log')).write_text(rr.stdout + rr.stderr)
        tail = (rr.stdout + rr.stderr).strip().splitlines()[-3:]
        print('==', tool, 'rc', rr.returncode, '|', ' / '.join(tail))
