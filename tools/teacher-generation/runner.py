"""Offline/private renderer API: render_job(lesson, model_payload, workdir, skill_paths=None)."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from validation import GenerationError, read_json, reject, validate_model
from adapters import dump
from gate_policy import RECONCILIATION_STEPS, decide
from skill_feedback import gate_report

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


def _open_job(lesson, model_payload, workdir, skill_paths, allow_legacy, *, elementary_general_only=False):
    """Validate, verify the pinned skill and open the isolated work folder.

    Returns None, before anything is written, when ``elementary_general_only``
    is set and the lesson is not a version 3 elementary lesson.
    """
    cap=validate_model(lesson,model_payload,allow_legacy=allow_legacy)
    from division_facts import VERSION as division_version
    general=lesson['version']==3
    native_division=general and model_payload.get('version')==division_version
    adapter=HERE/('general_adapters.py' if general else 'adapters.py')
    if not general and cap['skill']=='middle' and not (
        lesson['gradeNumber']==7 and lesson['topicId']=='g7:equations'
        and lesson['level']=='b' and cap['family']=='linear_equation'
    ):
        reject('UNSUPPORTED_WORD_LAYOUT','The verified Word-web repair covers only the grade 7 basic linear-equation pilot')
    if elementary_general_only and not (general and cap['skill']=='elementary'):
        return None
    paths=skill_paths or {k:os.environ.get(v) for k,v in [('elementary','ELEMENTARY_SKILL_PATH'),('middle','MIDDLE_SKILL_PATH')]}
    if not paths.get(cap['skill']): reject('RUNTIME_NOT_CONFIGURED','Set the configured skill path on the runner')
    skill,pin=verify_skill(cap['skill'],paths[cap['skill']])
    work=Path(workdir).resolve()
    if work.exists() and any(work.iterdir()): reject('OUTPUT_EXISTS','Each job needs an empty isolated output directory')
    work.mkdir(parents=True,exist_ok=True)
    dump(work/'lesson.json',lesson);dump(work/'model-output.json',model_payload)
    if general:
        from runtime_catalog import scope_for_lesson
        dump(work/'curriculum-scope.json',scope_for_lesson(lesson))
    (work/'logs').mkdir()
    env={k:v for k,v in os.environ.items() if k in ('PATH','HOME','TMPDIR','LANG','LC_ALL','DYLD_FALLBACK_LIBRARY_PATH','FONTCONFIG_PATH')}
    env['PYTHONDONTWRITEBYTECODE']='1'
    # Fixed, reviewed OCR adapter; model input and ambient environment cannot
    # select an executable. It emits actual Tesseract observations to G79.
    if general:
        env['WSPEC_OCR']=str(HERE/'wspec_ocr_tesseract.py')
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
    return SimpleNamespace(cap=cap,general=general,native_division=native_division,adapter=adapter,skill=skill,pin=pin,
                           work=work,steps=steps,run=run,
                           adapter_args=[adapter,'--skill',skill,'--work',work]+(['--allow-legacy-intake'] if allow_legacy else []))


def _content_truth_args(job):
    return [job.skill/'scripts/lib/content_truth.py','--work',job.work]


def _house_gate_args(job, lesson, *, rendered):
    """The pinned house gates. Before rendering, only the checks that read the
    HTML, content.json and the figure sources run: no PDF and no Word file."""
    work=job.work
    return ([job.skill/'scripts/lib/house_gates.py','--html',work/'sheet.html']
            +(['--pdf',work/'sheet.pdf'] if rendered else [])
            +['--gen',job.adapter,'--content',work/'content.json','--figdir',work/'figures',
              '--grade','אבגדהו'[lesson['gradeNumber']-1],'--level',{'a':'א','b':'ב','e':'מצוינות'}[lesson['level']]]
            +(['--docx',work/'sheet.docx'] if rendered else []))


def lesson_gate(job, lesson):
    """Read every finding of a version 3 lesson and decide (gate_policy.decide).

    Truth and policy findings block; when each names a question the caller can
    replace those questions and render again. Editorial findings alone do not
    block. An unknown finding, a timeout or a crashed step blocks.
    """
    count=lesson['questionCount']
    report=gate_report(job.work,job.cap['skill'],job.steps,count)
    if (job.cap['skill']=='elementary' and (job.work/'sheet.pdf').is_file()
            and any(row['code']=='G51' for row in report['unnamed'])
            and not any(step['name']=='bracket-order-reconciliation' for step in job.steps)):
        # Fixed second measurement of the one documented G51 false positive.
        job.run('bracket-order-reconciliation',[HERE/'paren_order.py','--pdf',job.work/'sheet.pdf',
                                                 '--json',job.work/'logs/bracket-order.json'])
        report=gate_report(job.work,job.cap['skill'],job.steps,count)
    failed=[step['name'] for step in job.steps if step['status']=='FAIL' and step['name'] not in RECONCILIATION_STEPS]
    return report,decide(report,failed)


def precheck_job(lesson, model_payload, workdir, skill_paths=None):
    """Elementary pre-pass: build content.json and run only the gates that read it.

    No PDF, no Word file and no provider call, so a caller can replace the
    questions that the truth and house gates name and then render once.
    Returns {'status','steps','gate'}:
      clean           the trusted adapter and both gates passed
      review          only editorial findings (they would not block a render)
      replace         blocking findings that each name a question: gate['questions']
      failed          a blocking finding that names no question
      not_applicable  not a version 3 elementary lesson; nothing was written
    The gates that need the rendered PDF or Word file still run in render_job.
    """
    job=_open_job(lesson,model_payload,workdir,skill_paths,False,elementary_general_only=True)
    if job is None:
        return {'version':1,'status':'not_applicable','steps':[],'gate':None}
    if job.run('trusted-adapter',job.adapter_args):
        # Both run even when the first fails: the report names every question.
        job.run('content-truth',_content_truth_args(job))
        job.run('house-gates',_house_gate_args(job,lesson,rendered=False))
    report,decision=lesson_gate(job,lesson)
    clean=all(step['status']=='PASS' for step in job.steps)
    status='clean' if clean else {'deliver':'review','replace':'replace'}.get(decision['action'],'failed')
    result={'version':1,'status':status,'steps':job.steps,
            'gate':{'version':1,'action':decision['action'],'complete':report['complete'],'blocking':decision['blocking'],
                    'questions':decision['questions'],'review':decision['reviewFindings']}}
    dump(job.work/'precheck.json',result)
    return result


def render_job(lesson, model_payload, workdir, skill_paths=None, *, allow_legacy=False):
    """Validate first, build into a new directory, return manifest. No provider calls.

    Ready-for-human-review is never publication approval. A failed gate returns
    status failed with no downloadable artifacts. Caller owns authorization,
    job leasing and storage. skill_paths is trusted operator configuration only.

    Version 3 lessons follow the delivery policy in gate_policy: a render
    whose failed steps hold only editorial findings is delivered as
    needs_review with those findings in reviewFindings; anything else that
    fails stays failed, and manifest['gate'] says which questions are named.
    """
    job=_open_job(lesson,model_payload,workdir,skill_paths,allow_legacy)
    cap,general,native_division,adapter,skill,pin=job.cap,job.general,job.native_division,job.adapter,job.skill,job.pin
    work,steps,run=job.work,job.steps,job.run
    ok=run('trusted-adapter',job.adapter_args)
    outputs=[]
    review_findings=[]
    word_postprocess=None
    if ok and cap['skill']=='elementary':
        for name,args in [
            ('content-truth',_content_truth_args(job)),
            ('pdf',[skill/'scripts/build_pdf.py',work/'sheet.html',work/'sheet.pdf']),
            ('word',[skill/'scripts/build_docx.py',work/'sheet.html',work/'sheet.docx']),
            ('word-layout',[HERE/'docx_layout.py','--docx',work/'sheet.docx','--content',work/'content.json']),
            ('worksheet',[skill/'scripts/check_worksheet.py',work/'sheet.pdf',work/'preview','--band','elementary-ab' if lesson['gradeNumber']<=2 else 'elementary']),
            ('output-gates',[HERE/'output_gates.py','--skill',skill,'--pdf',work/'sheet.pdf','--band','elementary-ab' if lesson['gradeNumber']<=2 else 'elementary']+(['--general'] if general and not native_division else [])),
            ('house-gates',_house_gate_args(job,lesson,rendered=True)),
        ]:
            if general and not native_division and name=='word-layout':
                # This postprocessor only understands the old fixed pilot
                # wording; native Word and house gates cover general source.
                continue
            # Run all applicable gates; a previous failure is not erased.
            result=run(name,args);ok=result and ok
        outputs=['sheet.pdf','sheet.docx']
    elif ok:
        ok=run('middle-build',[skill/'build_v72.py','--pkg',work])
        key={'a':'a','b':'b','e':'c'}[lesson['level']]
        if general and not ok and (work/'out/v72-report.json').is_file():
            middle_step=steps[-1]
            # This fixed reconciliation is limited to the documented didactic
            # REVIEW-only case. All true FAIL findings remain unavailable.
            ok=run('didactic-review-reconciliation',[HERE/'didactic_review.py',
                '--skill',skill,'--work',work,'--level',key])
            if ok:
                evidence=read_json(work/'logs/didactic-review.json')
                middle_step['status']='REVIEW'
                middle_step['reason']='PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY'
                review_findings.append({'code':'DIDACTIC_REVIEW','count':evidence['count']})
        original=f'out/docx/{key}/sheet.docx'
        final=f'out/docx/{key}/sheet-web.docx'
        upstream_report=work/'out/v72-report.json'
        if ok and (not (work/original).is_file() or not upstream_report.is_file()):
            ok=False;steps.append({'name':'word-upstream-presence','status':'FAIL'})
        if ok and not general:
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
        outputs=[f'out/deliver/{key}/sheet.pdf',original if general else final]
    gate=None
    if general and any(step['status']!='PASS' for step in steps):
        report,decision=lesson_gate(job,lesson)
        if not ok and decision['action']=='deliver':
            # Every failed step holds only editorial or reconciled findings.
            for step in steps:
                if step['status']=='FAIL' and step['name'] in decision['reviewSteps']:
                    step['status']='REVIEW';step['reason']='EDITORIAL_FINDINGS_ONLY'
            ok=all(step['status'] in ('PASS','REVIEW') for step in steps)
        if ok:
            for row in decision['reviewFindings']:
                known=next((r for r in review_findings if r['code']==row['code']),None)
                if known is None:review_findings.append(row)
                elif known['count']==row['count']:known.update(row)
        gate={'version':1,'action':decision['action'] if not ok else 'deliver','complete':report['complete'],
              'blocking':decision['blocking'] if not ok else [],'questions':decision['questions'] if not ok else [],
              'review':decision['reviewFindings']}
    artifacts=[]
    if ok:
        for name in outputs:
            path=work/name
            if not path.is_file(): ok=False;steps.append({'name':'artifact-presence','status':'FAIL'});break
            artifacts.append({'path':name,'sha256':sha(path),'bytes':path.stat().st_size,'kind':'pdf' if name.endswith('.pdf') else 'docx'})
    manifest={'version':1,'status':'needs_review' if ok else 'failed','automatedChecksPassed':bool(ok and len(artifacts)==2 and all(s['status']=='PASS' for s in steps)),'skill':{'name':cap['skill'],'version':pin['version'],'sha256':pin['sha256']},'topicId':lesson['topicId'],'gradeNumber':lesson['gradeNumber'],'modelInputSha256':sha(work/'model-output.json'),'adapterSha256':sha(HERE/'adapters.py'),'steps':steps,'artifacts':artifacts if ok else [],'review':{'mathematical':'exact typed arithmetic verified; prose/template review pending','visual':'pending; every final PDF page and actual Word rendering must be inspected','curriculum':'bounded topic allowlist; free-text progress is not independently verified','publication':'not approved; private owner preview only'}}
    manifest['lessonBoundary']=lesson.get('lessonBoundary')
    if general:
        manifest['adapterSha256']=sha(adapter)
        manifest['authoringProfile']='general-skill-source/v1'
        manifest['renderingChecksPassed']=bool(ok and len(artifacts)==2 and all(s['status'] in ('PASS','REVIEW') for s in steps))
        manifest['reviewFindings']=review_findings
        if gate is not None:
            manifest['gate']=gate
        manifest['review']={
            'mathematical':'typed computations independently evaluated; prose and proof review pending',
            'visual':'pending; every final PDF page and actual Word rendering must be inspected',
            'curriculum':'selected pinned concepts supplied to author; teacher must verify actual pedagogical fit',
            'publication':'not approved; private owner draft only'}
    manifest['legacyIntakeOffline']=bool(allow_legacy and lesson.get('version')==1)
    manifest['docxLayoutSha256']=sha(HERE/'docx_layout.py')
    if word_postprocess is not None:
        manifest['wordPostprocess']=word_postprocess
    dump(work/'manifest.json',manifest)
    return manifest


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--lesson',required=True);p.add_argument('--model-output',required=True);p.add_argument('--out',required=True);p.add_argument('--allow-legacy-intake',action='store_true',help='Offline reproduction of v1 intake only; never permitted for queued jobs')
    p.add_argument('--precheck',action='store_true',help='Elementary version 3 lessons: run only the trusted adapter and the gates that read content.json; no PDF or Word file')
    a=p.parse_args()
    try:
        if a.precheck:
            r=precheck_job(read_json(a.lesson),read_json(a.model_output),a.out)
            print(json.dumps({'status':r['status'],'gate':r['gate']},ensure_ascii=False))
            sys.exit(0 if r['status'] in ('clean','review') else 1)
        m=render_job(read_json(a.lesson),read_json(a.model_output),a.out,allow_legacy=a.allow_legacy_intake)
        print(json.dumps({'status':m['status'],'manifest':str(Path(a.out)/'manifest.json'),'artifacts':m['artifacts']},ensure_ascii=False))
        sys.exit(0 if m['status']=='needs_review' else 1)
    except GenerationError as e:
        print(json.dumps({'status':'failed','error':e.code,'detail':str(e)},ensure_ascii=False));sys.exit(2)
