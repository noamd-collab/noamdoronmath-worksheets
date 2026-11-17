"""Offline/private renderer API: render_job(lesson, model_payload, workdir, skill_paths=None)."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from validation import GenerationError, read_json, reject, validate_model
from adapters import dump

HERE=Path(__file__).resolve().parent


def sha(path): return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def verify_skill(kind, path):
    pin=read_json(HERE/'skill-lock.json')['skills'][kind]
    root=Path(path).resolve()
    for name, expected in pin['files'].items():
        p=root/name
        if p.is_symlink() or not p.is_file() or sha(p)!=expected:
            reject('SKILL_HASH_MISMATCH', f'{kind} skill differs from pinned file: {name}')
    for p in root.rglob('*.py'):
        if '__pycache__' not in p.parts and str(p.relative_to(root)) not in pin['files']:
            reject('SKILL_HASH_MISMATCH', 'Unpinned executable Python file in skill')
    return root,pin


def render_job(lesson, model_payload, workdir, skill_paths=None, *, allow_legacy=False):
    """Validate first, build into a new directory, return manifest. No provider calls.

    Ready-for-human-review is never publication approval. A failed gate returns
    status failed with no downloadable artifacts. Caller owns authorization,
    job leasing and storage. skill_paths is trusted operator configuration only.
    """
    cap=validate_model(lesson,model_payload,allow_legacy=allow_legacy)
    if cap['skill']=='middle' and not (
        lesson['gradeNumber']==7 and lesson['topicId']=='g7:equations'
        and lesson['level']=='b' and cap['family']=='linear_equation'
    ):
        reject('UNSUPPORTED_WORD_LAYOUT','The verified Word-web repair covers only the grade 7 basic linear-equation pilot')
    paths=skill_paths or {k:os.environ.get(v) for k,v in [('elementary','ELEMENTARY_SKILL_PATH'),('middle','MIDDLE_SKILL_PATH')]}
    if not paths.get(cap['skill']): reject('RUNTIME_NOT_CONFIGURED','Set the configured skill path on the runner')
    skill,pin=verify_skill(cap['skill'],paths[cap['skill']])
    work=Path(workdir).resolve()
    if work.exists() and any(work.iterdir()): reject('OUTPUT_EXISTS','Each job needs an empty isolated output directory')
    work.mkdir(parents=True,exist_ok=True)
    dump(work/'lesson.json',lesson);dump(work/'model-output.json',model_payload)
    (work/'logs').mkdir()
    env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','LANG','LC_ALL','DYLD_FALLBACK_LIBRARY_PATH','FONTCONFIG_PATH')}
    env['PYTHONDONTWRITEBYTECODE']='1'
    if sys.platform=='darwin': env.setdefault('DYLD_FALLBACK_LIBRARY_PATH','/opt/homebrew/lib')
    steps=[]
    def run(name,args):
        try:
            cp=subprocess.run([sys.executable,'-B']+[str(v) for v in args],cwd=work,env=env,capture_output=True,text=True,timeout=240)
            log=(cp.stdout+'\n'+cp.stderr)[-100000:]
            (work/'logs'/f'{name}.txt').write_text(log,encoding='utf-8')
            ok=cp.returncode==0
            steps.append({'name':name,'status':'PASS' if ok else 'FAIL','exitCode':cp.returncode,'log':f'logs/{name}.txt'})
            return ok
        except subprocess.TimeoutExpired:
            steps.append({'name':name,'status':'FAIL','reason':'RENDER_TIMEOUT'});return False
    ok=run('trusted-adapter',[HERE/'adapters.py','--skill',skill,'--work',work]+(['--allow-legacy-intake'] if allow_legacy else []))
    outputs=[]
    word_postprocess=None
    if ok and cap['skill']=='elementary':
        for name,args in [
            ('content-truth',[skill/'scripts/lib/content_truth.py','--work',work,'--quiet']),
            ('pdf',[skill/'scripts/build_pdf.py',work/'sheet.html',work/'sheet.pdf']),
            ('word',[skill/'scripts/build_docx.py',work/'sheet.html',work/'sheet.docx']),
            ('word-layout',[HERE/'docx_layout.py','--docx',work/'sheet.docx','--content',work/'content.json']),
            ('worksheet',[skill/'scripts/check_worksheet.py',work/'sheet.pdf',work/'preview','--band','elementary-ab' if lesson['gradeNumber']<=2 else 'elementary']),
            ('output-gates',[HERE/'output_gates.py','--skill',skill,'--pdf',work/'sheet.pdf','--band','elementary-ab' if lesson['gradeNumber']<=2 else 'elementary']),
            ('house-gates',[skill/'scripts/lib/house_gates.py','--html',work/'sheet.html','--pdf',work/'sheet.pdf','--gen',HERE/'adapters.py','--content',work/'content.json','--figdir',work/'figures','--grade','אבגדהו'[lesson['gradeNumber']-1],'--level',{'a':'א','b':'ב','e':'מצוינות'}[lesson['level']],'--docx',work/'sheet.docx']),
        ]:
            # Run all applicable gates; a previous failure is not erased.
            result=run(name,args);ok=result and ok
        outputs=['sheet.pdf','sheet.docx']
    elif ok:
        ok=run('middle-build',[skill/'build_v72.py','--pkg',work])
        key={'a':'a','b':'b','e':'c'}[lesson['level']]
        original=f'out/docx/{key}/sheet.docx'
        final=f'out/docx/{key}/sheet-web.docx'
        upstream_report=work/'out/v72-report.json'
        if ok and (not (work/original).is_file() or not upstream_report.is_file()):
            ok=False;steps.append({'name':'word-upstream-presence','status':'FAIL'})
        if ok:
            original_sha=sha(work/original)
            upstream_sha=sha(upstream_report)
            ok=run('word-web-layout',[HERE/'docx_web_layout.py','--input',work/original,
                '--output',work/final,'--manifest',work/'logs/word-web-layout.json'])
            if ok:
                # Preserve the upstream build's hash-bearing files and report.
                provenance=read_json(work/'logs/word-web-layout.json')
                intact=(sha(work/original)==original_sha and sha(upstream_report)==upstream_sha
                    and provenance.get('sourceSha256')==original_sha
                    and (work/final).is_file() and provenance.get('outputSha256')==sha(work/final)
                    and provenance.get('printedTextSequencePreserved') is True
                    and provenance.get('bookmarksPreserved') is True)
                steps.append({'name':'word-source-provenance','status':'PASS' if intact else 'FAIL'})
                ok=intact
            if ok:
                ok=run('word-web-rtl-parity',[skill/'check_docx_rtl.py',work/final,
                    '--source',work/f'out/deliver/{key}/sheet.json',
                    '--json',work/'logs/word-web-rtl-parity.json'])
            if ok:
                word_postprocess={'scope':'grade7/basic/linear_equation','format':'editable-ltr-math-text',
                    'postprocessorSha256':sha(HERE/'docx_web_layout.py'),
                    'sourceDocx':{'path':original,'sha256':original_sha},
                    'upstreamBuildReport':{'path':'out/v72-report.json','sha256':upstream_sha},
                    'finalDocx':{'path':final,'sha256':sha(work/final)},
                    'provenanceReport':'logs/word-web-layout.json',
                    'finalGateReport':'logs/word-web-rtl-parity.json'}
        outputs=[f'out/deliver/{key}/sheet.pdf',final]
    artifacts=[]
    if ok:
        for name in outputs:
            path=work/name
            if not path.is_file(): ok=False;steps.append({'name':'artifact-presence','status':'FAIL'});break
            artifacts.append({'path':name,'sha256':sha(path),'bytes':path.stat().st_size,'kind':'pdf' if name.endswith('.pdf') else 'docx'})
    manifest={'version':1,'status':'needs_review' if ok else 'failed','automatedChecksPassed':bool(ok and len(artifacts)==2 and all(s['status']=='PASS' for s in steps)),'skill':{'name':cap['skill'],'version':pin['version'],'sha256':pin['sha256']},'topicId':lesson['topicId'],'gradeNumber':lesson['gradeNumber'],'modelInputSha256':sha(work/'model-output.json'),'adapterSha256':sha(HERE/'adapters.py'),'steps':steps,'artifacts':artifacts if ok else [],'review':{'mathematical':'exact typed arithmetic verified; prose/template review pending','visual':'pending; every final PDF page and actual Word rendering must be inspected','curriculum':'bounded topic allowlist; free-text progress is not independently verified','publication':'not approved; private owner preview only'}}
    manifest['lessonBoundary']=lesson.get('lessonBoundary')
    manifest['legacyIntakeOffline']=bool(allow_legacy and lesson.get('version')==1)
    manifest['docxLayoutSha256']=sha(HERE/'docx_layout.py')
    if word_postprocess is not None:
        manifest['wordPostprocess']=word_postprocess
    dump(work/'manifest.json',manifest)
    return manifest


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--lesson',required=True);p.add_argument('--model-output',required=True);p.add_argument('--out',required=True);p.add_argument('--allow-legacy-intake',action='store_true',help='Offline reproduction of v1 intake only; never permitted for queued jobs')
    a=p.parse_args()
    try:
        m=render_job(read_json(a.lesson),read_json(a.model_output),a.out,allow_legacy=a.allow_legacy_intake)
        print(json.dumps({'status':m['status'],'manifest':str(Path(a.out)/'manifest.json'),'artifacts':m['artifacts']},ensure_ascii=False))
        sys.exit(0 if m['status']=='needs_review' else 1)
    except GenerationError as e:
        print(json.dumps({'status':'failed','error':e.code,'detail':str(e)},ensure_ascii=False));sys.exit(2)
