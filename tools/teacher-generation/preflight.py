"""Read-only readiness check. No provider call, queue claim, upload or heartbeat."""
from __future__ import annotations
import argparse
import importlib
from importlib.metadata import version
import json
import os
import shutil
import sys
from pathlib import Path
from validation import GenerationError
from runner import verify_skill
from provider import author_config, author_provider, verified_tls_context

PACKAGES={'weasyprint':'weasyprint','PyMuPDF':'pymupdf','matplotlib':'matplotlib','fonttools':'fontTools','python-docx':'docx','beautifulsoup4':'bs4','lxml':'lxml','numpy':'numpy','certifi':'certifi'}
PACKAGES.update({'sympy':'sympy','mpmath':'mpmath'})
EXPECTED=dict(line.strip().split('==',1) for line in Path(__file__).with_name('requirements.txt').read_text().splitlines() if '==' in line and not line.lstrip().startswith('#'))


def check(require_provider=False):
    result={'ready':True,'python':'.'.join(map(str,sys.version_info[:3])),'dependencies':{},'skills':{},'provider':{'configured':False,'called':False}}
    if sys.version_info[:2]!=(3,12):result['ready']=False;result['pythonError']='Validated runtime is Python 3.12'
    try:
        verified_tls_context();result['tls']={'status':'PASS','certificateAuthority':'certifi'}
    except Exception:
        result['ready']=False;result['tls']={'status':'FAIL','reason':'Cannot load certificate authority bundle'}
    for package,module in PACKAGES.items():
        try:
            importlib.import_module(module)
            actual=version(package);matches=actual==EXPECTED.get(package)
            result['dependencies'][package]={'status':'PASS' if matches else 'FAIL','version':actual}
            if not matches:result['ready']=False;result['dependencies'][package]['reason']='Dependency version differs from requirements.txt'
        except Exception:
            result['ready']=False;result['dependencies'][package]={'status':'FAIL','reason':'Missing package or native dependency'}
    for kind,env in [('elementary','ELEMENTARY_SKILL_PATH'),('middle','MIDDLE_SKILL_PATH')]:
        try:
            path=os.environ.get(env)
            if not path:raise GenerationError('RUNTIME_NOT_CONFIGURED','Skill path missing')
            _,pin=verify_skill(kind,path)
            result['skills'][kind]={'status':'PASS','version':pin['version'],'sha256':pin['sha256']}
        except GenerationError as e:
            result['ready']=False;result['skills'][kind]={'status':'FAIL','reason':e.code}
    try:
        from runtime_catalog import catalog, PROFILE
        from general_source import authoring_schema, validate_source
        from general_adapters import compile_source
        topics=catalog()
        result['authoring']={'status':'PASS','profile':PROFILE,'topics':len(topics.topics),
                             'curriculumSha256':topics.sha256}
        if sys.platform=='linux' and not shutil.which('tesseract'):
            raise RuntimeError('Tesseract is required for the geometry reader')
    except Exception:
        result['ready']=False;result['authoring']={'status':'FAIL','reason':'GENERAL_AUTHORING_RUNTIME_MISSING'}
    # The selected provider's own configuration, checked by the function the
    # author call uses. Nothing is sent, and no value is kept: only the closed
    # provider name and a fixed reason code.
    try:
        result['provider']['name']=author_provider()
        author_config()
        result['provider']['configured']=True
    except GenerationError as e:
        result['provider']['reason']=e.code
    if require_provider and not result['provider']['configured']:result['ready']=False
    return result


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--require-provider',action='store_true');a=p.parse_args()
    report=check(a.require_provider);print(json.dumps(report,ensure_ascii=False,indent=2));sys.exit(0 if report['ready'] else 1)
