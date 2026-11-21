"""Reconcile the pinned v7.2 driver's documented REVIEW-only exit discrepancy.

build_v72 currently maps check_didactic exit 2 to FAIL although its docs permit
private drafts with FAIL 0 / REVIEW > 0. Preserve the original report and call
the exact pinned checker again. No actual failing finding can be reconciled.
"""
from __future__ import annotations
import argparse
import hashlib
import importlib.util
import json
from pathlib import Path
import sys


def reconcile(skill, work, key):
    if key not in ('a','b','c'):
        raise ValueError('INVALID_LEVEL')
    report_path=work/'out/v72-report.json'
    raw=report_path.read_bytes()
    if len(raw)>4_000_000:
        raise ValueError('REPORT_SIZE')
    report=json.loads(raw)
    steps=report.get('steps')
    if not isinstance(steps,list) or not steps or report.get('result')!='FAIL':
        raise ValueError('NOT_REVIEW_ONLY')
    if len({s.get('step') for s in steps})!=len(steps):
        raise ValueError('DUPLICATE_BUILD_STEP')
    failures=[s['step'] for s in steps if s.get('status')=='FAIL']
    if failures!=['check_didactic.py'] or any(s.get('status') not in ('PASS','FAIL','SKIP','REVIEW') for s in steps):
        raise ValueError('BLOCKING_BUILD_FAILURE')
    if any(g.get('status') not in ('PASS','SKIP','REVIEW') for g in report.get('gates',[])):
        raise ValueError('BLOCKING_GATE_FAILURE')
    if not any(g.get('gate')=='G90/G91-docx' and g.get('level')==key and g.get('status')=='PASS'
               for g in report.get('gates',[])):
        raise ValueError('REQUIRED_WORD_GATE_MISSING')
    required={'build_plus (PDF + gates)','check_plain_math.py','verify_export.py',
              'selfcheck_noam_package.py','emit_docx '+key,'check_docx_rtl '+key}
    if not required <= {s['step'] for s in steps if s['status']=='PASS'}:
        raise ValueError('REQUIRED_BUILD_CHECK_MISSING')
    sys.path.insert(0,str(skill))
    spec=importlib.util.spec_from_file_location('pinned_didactic_review',skill/'check_didactic.py')
    checker=importlib.util.module_from_spec(spec);spec.loader.exec_module(checker)
    findings, rows=checker.check_level(str(work/'out/deliver'/key),checker._tools())
    if (not findings or len(findings)>2000 or not rows or
            any(f[0] not in ('REVIEW','PASS') for f in findings) or
            not any(f[0]=='REVIEW' for f in findings)):
        raise ValueError('DIDACTIC_HAS_FAIL_OR_NO_REVIEW')
    files=report.get('files')
    required_files={f'deliver/{key}/sheet.pdf',f'deliver/{key}/sheet.json',f'docx/{key}/sheet.docx'}
    if not isinstance(files,dict) or not required_files <= set(files):
        raise ValueError('REQUIRED_OUTPUT_HASH_MISSING')
    actual={p.relative_to(work/'out').as_posix() for p in (work/'out').rglob('*')
            if p.is_file() and 'logs' not in p.relative_to(work/'out').parts
            and p!=report_path}
    if set(files)!=actual:
        raise ValueError('BUILD_OUTPUT_INVENTORY_CHANGED')
    for relative,digest in files.items():
        path=work/'out'/relative
        if not path.resolve().is_relative_to((work/'out').resolve()) or path.is_symlink():
            raise ValueError('REPORT_PATH')
        if hashlib.sha256(path.read_bytes()).hexdigest()!=digest:
            raise ValueError('BUILD_OUTPUT_CHANGED')
    count=sum(f[0]=='REVIEW' for f in findings)
    return {'status':'REVIEW','code':'DIDACTIC_REVIEW','count':count,
            'originalReportSha256':hashlib.sha256(raw).hexdigest(),
            'checkerSha256':hashlib.sha256((skill/'check_didactic.py').read_bytes()).hexdigest(),
            'documentation':'references/v7-production-he.md:30',
            'failures':0,'findings':[{'rule':f[1],'item':str(f[2]),'detail':str(f[3])[:1200]}
                                     for f in findings if f[0]=='REVIEW']}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--skill',type=Path,required=True)
    parser.add_argument('--work',type=Path,required=True);parser.add_argument('--level',required=True)
    args=parser.parse_args()
    result=reconcile(args.skill,args.work,args.level)
    (args.work/'logs/didactic-review.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'status':'REVIEW','code':result['code'],'count':result['count']}))
