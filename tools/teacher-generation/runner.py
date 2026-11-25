"""Offline/private renderer API: render_job(lesson, model_payload, workdir, skill_paths=None)."""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
from pathlib import Path
from types import SimpleNamespace
from validation import GenerationError, read_json, reject, validate_model
from adapters import dump
from gate_policy import RECONCILIATION_STEPS, decide, unverified_rows
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


# D22 (approved by Noam on 2026-11-25): the only pinned steps and gates a v5 render may leave as SKIP.
# They are reported as notRun, never as passed. The en dash matches build_v72.py. The worker accepts such a SKIP
# only while remote_worker.D22_APPROVED is True (V5-DESIGN §14).
V5_NOT_RUN_ALLOWED=frozenset({
    'pinned:emit_docx','pinned:catalog/landing','pinned:gate_sections G85\u2013G92',
    *('pinned-gate:%s:sheet'%g for g in ('G85-section-volume','G86-terms','G87-subtopic-chronology',
                                         'G88-level-parity','G89-catalog','G92-section-structure'))})
PINNED_STATUSES=('PASS','FAIL','SKIP','REVIEW')
MAX_REPORT_BYTES=4_000_000
# Sub-checks a pinned step did not run although the step itself passed (D1: a skip is notRun, never PASS).
# check_worksheet prints such a check as "PASS — <what> (warn)" (pdffonts/pdftoppm/PIL missing, no rendered page
# yet, no sibling HTML); the pinned build_plus prints "G83-room c not run -- …", "G83 c not a figure topic -- …" or
# "G83 c DEFERRED -- …". Each becomes one notRun entry "pinned-log:<script>:<sub-check>[:<level>]".
WORKSHEET_SUBCHECKS=(('pdffonts missing','fonts'),('pdfinfo unavailable','brand'),('page-fill check skipped','page-fill'),
    ('fill check deferred','page-fill'),('marker direction check skipped','marker-direction'),
    ('ol.questions counter marker','marker-direction'),('sqrt markup check skipped','sqrt-markup'),
    ('pdftoppm missing','render'))
_WORKSHEET_SKIP=re.compile('^PASS\\s+—\\s+(?P<text>.*\\(warn\\))$')
_BUILD_NOT_RUN=re.compile(r'^(?P<gate>G[0-9]+[A-Za-z0-9/-]*)\s+(?:(?P<level>[abc])\s+)?(?:not run\b|not a figure topic\b|DEFERRED\b)')
MAX_LOG_BYTES=4_000_000


def _pinned_log_not_run(work,elementary):
    """[(name, log, line)] of every sub-check a pinned step's own log says did not run: check_worksheet's log on the
    elementary path, the pinned build_plus log (out/logs/build_plus.log) on the middle path. An absent log adds
    nothing (its step failed or never ran); a log that cannot be read adds a "...:unreadable" entry."""
    log='logs/worksheet.txt' if elementary else 'out/logs/build_plus.log'
    script='check_worksheet' if elementary else 'build_plus'
    path=Path(work)/log
    if not path.exists():
        return []
    try:
        if not path.is_file() or path.is_symlink() or path.stat().st_size>MAX_LOG_BYTES: raise ValueError('log')
        lines=path.read_text(encoding='utf-8',errors='replace').splitlines()
    except (OSError,ValueError):
        return [('pinned-log:%s:unreadable'%script,log,'')]
    out,unknown=[],0
    for raw in lines:
        line=raw.strip()
        if elementary:
            found=_WORKSHEET_SKIP.match(line)
            if not found: continue
            sub=next((name for marker,name in WORKSHEET_SUBCHECKS if marker in found.group('text')),None)
            if sub is None:
                unknown+=1;sub='warn-%d'%unknown
            name='pinned-log:check_worksheet:'+sub
        else:
            found=_BUILD_NOT_RUN.match(line)
            if not found: continue
            name='pinned-log:build_plus:'+found.group('gate')+(':'+found.group('level') if found.group('level') else '')
        if name not in [entry[0] for entry in out]:
            out.append((name,log,line[:300]))
    return out


def _is_v5(payload,*,contract=None):
    """True only for a compiled worksheet-wire/5 source whose trusted caller passed contract='worksheet-wire/5'.

    The payload's own root marker is model-shaped data and never selects the v5 path on its own: without the
    flag the answer is False and nothing is imported (a v4 job loads the same modules as before v5)."""
    if contract is None:
        return False
    from general_source import V5_CONTRACT
    if contract!=V5_CONTRACT:
        raise ValueError('Unsupported trusted source contract')
    return isinstance(payload,dict) and payload.get('contract')==V5_CONTRACT


def _pinned_steps(work,steps):
    """Append the pinned build's own steps and gates from out/v72-report.json; True iff it reports PASS, no REVIEW."""
    path=Path(work)/'out/v72-report.json'
    if not path.is_file():
        steps.append({'name':'pinned-report','status':'FAIL','reason':'PINNED_REPORT_MISSING'});return False
    try:
        if path.stat().st_size>MAX_REPORT_BYTES: raise ValueError('report too large')
        report=read_json(path)
        if (type(report) is not dict or type(report.get('steps')) is not list or type(report.get('gates')) is not list
                or any(type(row) is not dict or type(row.get('step')) is not str for row in report['steps'])
                or any(type(row) is not dict or type(row.get('gate')) is not str for row in report['gates'])):
            raise ValueError('report shape')
    except (GenerationError,OSError,ValueError):
        steps.append({'name':'pinned-report','status':'FAIL','reason':'PINNED_REPORT_INVALID'});return False
    for row in report['steps']:
        status=row.get('status') if row.get('status') in PINNED_STATUSES else 'FAIL'
        steps.append({'name':'pinned:'+row['step'],'status':status,'source':'out/v72-report.json'})
    for row in report['gates']:
        status=row.get('status') if row.get('status') in PINNED_STATUSES else 'FAIL'
        level=row.get('level') if type(row.get('level')) is str and row.get('level') else 'sheet'
        steps.append({'name':'pinned-gate:%s:%s'%(row['gate'],level),'status':status,'source':'out/v72-report.json'})
    return report.get('result')=='PASS' and not report.get('review')


def _approval(overlay):
    """Who approved a reviewed overlay and when (D7), as recorded in the overlay."""
    return {'by':overlay.get('approvedBy'),'at':overlay.get('approvedAt')}


def _render_job_v5(lesson,cap,work,skill,pin,steps,run,ok,adapter):
    """PDF-only middle render for a v5 source. Never calls didactic_review; artifacts are [pdf] only.

    Every executed step must PASS; a SKIP is allowed only inside V5_NOT_RUN_ALLOWED and is reported as notRun,
    so automatedChecksPassed stays false while anything did not run (D1, G7). A gate the pinned build_plus log
    says it did not run (G83-room "not run", G83 "not a figure topic") is listed in notRun too (notRunDetail
    holds its log line); it does not fail the render, but nothing counts as fully checked while it is there."""
    key={'a':'a','b':'b','e':'c'}[lesson['level']];pdf=f'out/deliver/{key}/sheet.pdf'
    from structured_contract import overlay_for
    overlay=overlay_for(lesson['topicId'],lesson['level'])
    # An overlay whose keys print stacked fractions and decimals (the probability overlay) checks its atoms in the
    # atom-order fraction mode; every other overlay keeps the flat check, which refuses a fraction (ATOM_NOT_FLAT).
    fractions=['--fractions'] if overlay is not None and overlay.get('atomFractions') is True else []
    if ok:
        ok=run('levels-lint',[HERE/'text_lint.py','--levels',work/'levels.json']) and ok
        ok=run('middle-build',[skill/'build_v72.py','--pkg',work,'--no-docx']) and ok
        ok=_pinned_steps(work,steps) and ok
        ok=run('atom-order',[HERE/'atom_order.py','--levels',work/'levels.json','--pdf',work/pdf,
                             '--json',work/'logs/atom-order.json']+fractions) and ok
    skipped=[s['name'] for s in steps if s['status']=='SKIP']
    passed=bool(ok and all(s['status']=='PASS' for s in steps if s['status']!='SKIP')
                and set(skipped)<=V5_NOT_RUN_ALLOWED and (work/pdf).is_file())
    subchecks=_pinned_log_not_run(work,elementary=False)
    not_run=skipped+[name for name,_,_ in subchecks if name not in skipped]
    # D7: the code-written Hebrew (title, rule, verbs, templates, layouts) is unreviewed until Noam signs the
    # overlay. An unreviewed overlay is recorded and can never make the automated checks count as passed.
    reviewed=bool(overlay is not None and overlay['reviewed'] is True)
    artifacts=[]
    if passed:
        artifacts=[{'path':pdf,'sha256':sha(work/pdf),'bytes':(work/pdf).stat().st_size,'kind':'pdf'}]
    manifest={'version':1,'status':'needs_review' if passed else 'failed',
        'executedChecksPassed':passed,
        'automatedChecksPassed':bool(passed and not not_run and reviewed),
        'renderingChecksPassed':bool(passed and not not_run and reviewed),
        'notRun':not_run,
        'notRunDetail':[{'name':name,'log':log,'line':line} for name,log,line in subchecks],
        'overlayReviewed':reviewed,
        'overlayPendingReview':list(overlay['pendingReview']) if overlay is not None and not reviewed else [],
        'overlayApproval':_approval(overlay) if reviewed else None,
        'authorContract':'worksheet-wire/5','authoringProfile':'general-skill-source/v1',
        'skill':{'name':cap['skill'],'version':pin['version'],'sha256':pin['sha256']},
        'topicId':lesson['topicId'],'gradeNumber':lesson['gradeNumber'],
        'modelInputSha256':sha(work/'model-output.json'),'adapterSha256':sha(adapter),
        'steps':steps,'lessonBoundary':lesson.get('lessonBoundary'),'reviewFindings':[],
        'artifacts':artifacts,
        'review':{
            'mathematical':'typed computations independently evaluated; prose and proof review pending',
            'visual':'pending; every final PDF page must be inspected',
            'curriculum':'selected pinned concepts supplied to author; teacher must verify actual pedagogical fit',
            'publication':'not approved; private owner draft only'}}
    dump(work/'manifest.json',manifest)
    return manifest


def _render_job_v5_elementary(lesson,cap,work,skill,pin,steps,run,ok,adapter):
    """PDF-only elementary render for a v5 source (worksheet-wire/5 elementary overlays).

    After the trusted adapter: the pinned content-truth gates, the WeasyPrint-only PDF wrapper
    (pdf_weasyprint_only.py: the pinned build_with_weasyprint, never the Chromium fallback, Producer WeasyPrint),
    the pinned check_worksheet, output-gates (the pinned output gates and the answer order with "(n)" markers),
    the pinned house gates (no --docx) and atom-order on every page. Every step must PASS and no step may SKIP.
    A sub-check the pinned check_worksheet reports as "PASS — … (warn)" without running it (no pdffonts or
    pdftoppm on the host, so no font check, no page render and no page-fill check) is listed in notRun
    ("pinned-log:check_worksheet:<sub-check>", its log line in notRunDetail): it does not fail the render, but
    automatedChecksPassed stays false and nothing counts as fully checked (D1). No Word step runs and the
    artifacts are [pdf]."""
    band='elementary-ab' if lesson['gradeNumber']<=2 else 'elementary'
    pdf='sheet.pdf'
    if ok:
        for name,args in [
            ('content-truth',[skill/'scripts/lib/content_truth.py','--work',work]),
            ('pdf',[HERE/'pdf_weasyprint_only.py','--skill',skill,'--html',work/'sheet.html','--pdf',work/pdf]),
            ('worksheet',[skill/'scripts/check_worksheet.py',work/pdf,work/'preview','--band',band]),
            ('output-gates',[HERE/'output_gates.py','--skill',skill,'--pdf',work/pdf,'--band',band,'--general',
                             '--paren-markers']),
            ('house-gates',[skill/'scripts/lib/house_gates.py','--html',work/'sheet.html','--pdf',work/pdf,'--gen',
                            adapter,'--content',work/'content.json','--figdir',work/'figures','--grade',
                            'אבגדהו'[lesson['gradeNumber']-1],'--level',{'a':'א','b':'ב','e':'מצוינות'}[lesson['level']]]),
            ('atom-order',[HERE/'atom_order.py','--html',work/'sheet.html','--pdf',work/pdf,'--json',
                           work/'logs/atom-order.json']),
        ]:
            # Run every gate; a previous failure is not erased.
            ok=run(name,args) and ok
    skipped=[s['name'] for s in steps if s['status']=='SKIP']
    passed=bool(ok and not skipped and all(s['status']=='PASS' for s in steps) and (work/pdf).is_file())
    subchecks=_pinned_log_not_run(work,elementary=True)
    not_run=skipped+[name for name,_,_ in subchecks]
    from structured_contract import overlay_for
    overlay=overlay_for(lesson['topicId'],lesson['level'])
    reviewed=bool(overlay is not None and overlay['reviewed'] is True)
    artifacts=[]
    if passed:
        artifacts=[{'path':pdf,'sha256':sha(work/pdf),'bytes':(work/pdf).stat().st_size,'kind':'pdf'}]
    manifest={'version':1,'status':'needs_review' if passed else 'failed',
        'executedChecksPassed':passed,
        'automatedChecksPassed':bool(passed and not not_run and reviewed),
        'renderingChecksPassed':bool(passed and not not_run and reviewed),
        'notRun':not_run,
        'notRunDetail':[{'name':name,'log':log,'line':line} for name,log,line in subchecks],
        'overlayReviewed':reviewed,
        'overlayPendingReview':list(overlay['pendingReview']) if overlay is not None and not reviewed else [],
        'overlayApproval':_approval(overlay) if reviewed else None,
        'authorContract':'worksheet-wire/5','authoringProfile':'general-skill-source/v1',
        'skill':{'name':cap['skill'],'version':pin['version'],'sha256':pin['sha256']},
        'topicId':lesson['topicId'],'gradeNumber':lesson['gradeNumber'],
        'modelInputSha256':sha(work/'model-output.json'),'adapterSha256':sha(adapter),
        'pdfBuilderSha256':sha(HERE/'pdf_weasyprint_only.py'),
        'steps':steps,'lessonBoundary':lesson.get('lessonBoundary'),'reviewFindings':[],
        'artifacts':artifacts,
        'review':{
            'mathematical':'typed computations independently evaluated; prose and story review pending',
            'visual':'pending; every final PDF page must be inspected',
            'curriculum':'selected pinned concepts supplied to author; teacher must verify actual pedagogical fit',
            'publication':'not approved; private owner draft only'}}
    dump(work/'manifest.json',manifest)
    return manifest


def render_structured(lesson, structured, workdir):
    """Render the StructuredAuthored result of structured_author (worksheet-wire/5) with render_job.

    The trusted contract value is bound here, from that result only: StructuredAuthored holds the source the
    compiler built and the compiler's own constant (structured_source.CONTRACT), checked when it was made. The
    worker passes the result and never a contract. Anything else is refused before a file is written or a step
    runs. Importing structured_author here keeps a v4 job's imports unchanged."""
    from structured_author import StructuredAuthored
    if type(structured) is not StructuredAuthored:
        raise TypeError('render_structured needs the StructuredAuthored result of structured_author')
    contract = structured.contract
    return render_job(lesson, structured.source, workdir, contract=contract)


def _open_job(lesson, model_payload, workdir, skill_paths, allow_legacy, *, elementary_general_only=False, salvaged_from=None,
              contract=None):
    """Validate, verify the pinned skill and open the isolated work folder.

    Returns None, before anything is written, when ``elementary_general_only``
    is set and the lesson is not a version 3 elementary lesson.
    ``salvaged_from`` is the requested question count of a shorter, salvaged
    sheet (validation.validate_lesson); only the worker passes it.
    ``contract`` is trusted caller configuration (render_job): only
    render_structured passes contract='worksheet-wire/5'. A v5 sheet is never
    salvaged; it has its own selection (structured_select).
    """
    if contract is None:
        cap=validate_model(lesson,model_payload,allow_legacy=allow_legacy,salvaged_from=salvaged_from)
    else:
        if salvaged_from is not None or elementary_general_only:
            raise ValueError('A worksheet-wire/5 source is neither salvaged nor pre-checked')
        cap=validate_model(lesson,model_payload,allow_legacy=allow_legacy,contract=contract)
    v5=_is_v5(model_payload,contract=contract)
    if contract is not None and not v5:
        reject('SOURCE_SHAPE','The trusted worksheet-wire/5 flag needs a worksheet-wire/5 source')
    if v5:
        # A v5 source renders with the skill of its topic's overlay only (middle, or elementary for an
        # elementary overlay); validate_model already required the overlay and the trusted scope to agree.
        from structured_contract import overlay_for
        overlay=overlay_for(lesson.get('topicId'),lesson.get('level'))
        if overlay is None or overlay.get('skill','middle')!=cap['skill']:
            reject('WIRE_SCOPE_UNSUPPORTED','worksheet-wire/5 renders with the skill of its overlay only')
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
                           work=work,steps=steps,run=run,v5=v5,
                           adapter_args=[adapter,'--skill',skill,'--work',work]+(['--allow-legacy-intake'] if allow_legacy else [])
                           +(['--contract',contract] if v5 else []))


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


def precheck_job(lesson, model_payload, workdir, skill_paths=None, *, salvaged_from=None):
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
    job=_open_job(lesson,model_payload,workdir,skill_paths,False,elementary_general_only=True,salvaged_from=salvaged_from)
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


def unverified_answers(work):
    """Printed answers that no exact kernel verified, from the adapter's evidence.

    The general adapter records them in general-evidence.json: a label printed
    as authored, an open item without a key, a yes/no decided from a claim
    typed out of a story, an authored review answer. Returns [{'question',
    'item','kind'}], [] when the adapter kept no such list, or None when the
    file is there but cannot be trusted.
    """
    path=work/'general-evidence.json'
    if not path.is_symlink() and not path.exists():
        return []
    try:
        if path.is_symlink() or path.stat().st_size>4_000_000:
            return None
        evidence=json.loads(path.read_text(encoding='utf-8'))
        return unverified_rows(evidence.get('unverifiedAnswers',[]))
    except (OSError,ValueError,AttributeError):
        return None


def render_job(lesson, model_payload, workdir, skill_paths=None, *, allow_legacy=False, salvaged_from=None, contract=None):
    """Validate first, build into a new directory, return manifest. No provider calls.

    Ready-for-human-review is never publication approval. A failed gate returns
    status failed with no downloadable artifacts. Caller owns authorization,
    job leasing and storage. skill_paths is trusted operator configuration only.

    Version 3 lessons follow the delivery policy in gate_policy: a render
    whose failed steps hold only editorial findings is delivered as
    needs_review with those findings in reviewFindings; anything else that
    fails stays failed, and manifest['gate'] says which questions are named.

    ``salvaged_from`` is the question count the teacher asked for when the
    worker renders a shorter, salvaged sheet; the manifest records it.

    contract is trusted caller configuration too: only structured_source /
    v5_offline_render pass contract='worksheet-wire/5' for a source they compiled.
    A payload's own root marker never selects the v5 path; unflagged, such a
    payload is refused (SOURCE_SHAPE) exactly as before v5.
    """
    job=_open_job(lesson,model_payload,workdir,skill_paths,allow_legacy,salvaged_from=salvaged_from,contract=contract)
    cap,general,native_division,adapter,skill,pin=job.cap,job.general,job.native_division,job.adapter,job.skill,job.pin
    work,steps,run=job.work,job.steps,job.run
    ok=run('trusted-adapter',job.adapter_args)
    if job.v5:
        render=_render_job_v5_elementary if cap['skill']=='elementary' else _render_job_v5
        return render(lesson,cap,work,skill,pin,steps,run,ok,adapter)
    outputs=[]
    review_findings=[]
    word_postprocess=None
    unverified=[]
    if ok and general:
        unverified=unverified_answers(work)
        if unverified is None:
            # Without the list the teacher could not be told which printed
            # answers are unverified, so nothing is rendered or delivered.
            steps.append({'name':'unverified-answers','status':'FAIL','reason':'EVIDENCE_UNREADABLE'})
            ok=False;unverified=[]
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
    if salvaged_from is not None:
        manifest['requestedQuestionCount']=salvaged_from
    if general:
        manifest['adapterSha256']=sha(adapter)
        manifest['authoringProfile']='general-skill-source/v1'
        manifest['renderingChecksPassed']=bool(ok and len(artifacts)==2 and all(s['status'] in ('PASS','REVIEW') for s in steps))
        manifest['reviewFindings']=review_findings
        # Positions and kinds of the printed answers no exact kernel verified.
        manifest['unverifiedAnswers']=unverified
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
