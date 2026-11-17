"""Fixed gate launcher; no model-authored Python is executed."""
import argparse
import sys
from pathlib import Path

if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--skill',required=True);p.add_argument('--pdf',required=True);p.add_argument('--band',required=True);p.add_argument('--html')
    a=p.parse_args();sys.path.insert(0,str(Path(a.skill)/'scripts/lib'))
    from gates_runner import run_output_gates
    run_output_gates([a.pdf],strict=True,band=a.band)
    if a.band in ('elementary', 'elementary-ab'):
        from elementary_pdf_order import AnswerOrderError, check_answer_order
        try:
            report = check_answer_order(a.pdf, a.html)
        except AnswerOrderError as error:
            raise SystemExit('PDF-answer-LTR FAIL ' + str(error)) from None
        print('PDF-answer-LTR PASS %d formula(s) after answers heading' % report['formulas'])
