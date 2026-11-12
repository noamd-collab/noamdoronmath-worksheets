"""Fixed gate launcher; no model-authored Python is executed."""
import argparse
import sys
from pathlib import Path

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--skill',required=True);p.add_argument('--pdf',required=True);p.add_argument('--band',required=True)
    a=p.parse_args();sys.path.insert(0,str(Path(a.skill)/'scripts/lib'))
    from gates_runner import run_output_gates
    run_output_gates([a.pdf],strict=True,band=a.band)
