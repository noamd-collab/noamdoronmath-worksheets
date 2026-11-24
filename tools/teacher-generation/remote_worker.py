"""Private teacher job worker with a bounded, operator-controlled repair ladder.

Run only from a reviewed checkout with pinned skills and operator-supplied
environment. Secrets are not accepted in job JSON, forwarded to child renders,
logged, or copied to job artifacts. A process exit does not install a daemon.

A version 3 job is repaired in this order, each step only when the one before
left a deficit: reserve questions (no model call), ONE targeted correction
call for the missing questions, a shorter sheet, ONE second full author call.
Per job: at most AUTHOR_CALLS author attempts (each one call, or one call per
parallel part: author_request) and CORRECTION_CALLS correction calls, and no
model call starts unless its measured duration fits before MODEL_DEADLINE; a
second author attempt starts only while one correction still fits after it.
A sheet may fail; it never prints a question that a check refused.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import signal
import ssl
import certifi
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler, HTTPSHandler
from urllib.error import HTTPError
from provider import author_lesson, safe_transport_measurements, safe_usage
from gate_policy import public_review_findings, public_teacher_notes, unverified_rows
from runner import precheck_job, render_job
from skill_feedback import gate_report
from validation import GenerationError, capabilities, validate_lesson
from preflight import check as check_readiness

ORIGIN = 'https://ouzquolkeuceektfihss.supabase.co'
BUCKET = 'teacher-generation-private'
ENABLE_SKILL_REVISION = True
# The repair ladder's hard limits for one job.
AUTHOR_CALLS = 2          # the first reply and at most one second full attempt
CORRECTION_CALLS = 2      # targeted corrections, for missing questions only
# The per-job time budget, from the live rounds of 23 Nov (gemini-3.8-flash, 26
# author and 15 correction calls). A call starts only when its measured
# duration still fits before the deadline, and a second author attempt only
# when one correction still fits after it.
AUTHOR_SECONDS = 80           # one single-call author attempt: median 61.8 s, max 74.4 s
PARTS_AUTHOR_SECONDS = 45     # one attempt in parallel parts (author_request): about 27 s expected by bench/latency.py
CORRECTION_SECONDS = 25       # one correction call: median 21.6 s, max 24.0 s
# Two attempts and two corrections at their measured maximum: 210 s after the claim.
MODEL_DEADLINE = 2 * (AUTHOR_SECONDS + CORRECTION_SECONDS)
PRECHECK_PASSES = 2       # rounds of replacing what the pre-pass names, before any PDF or Word file
FULL_RENDERS = 2          # the render, and one more after a gate named questions
RESULT_LIMIT = 30000      # the jobs table refuses a result above 32,000 bytes
# A reply arrived but cannot be used as a whole: a second author call may help.
# Any other failed call (the provider did not answer) closes the job to further calls.
UNUSABLE_REPLY = frozenset({'PROVIDER_INVALID_RESPONSE', 'INVALID_MODEL_OUTPUT', 'PROVIDER_INCOMPLETE',
                            'PROVIDER_OUTPUT_TOO_LARGE', 'REVISION_SCOPE'})
STAGES = ('author', 'source', 'precheck', 'render', 'acceptance', 'upload')
ARTIFACT_LIMIT = 15728640
ARTIFACT_MIMES = {'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
UUID = re.compile(r'^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$')
HERE = Path(__file__).resolve().parent

class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise RuntimeError('REMOTE_REDIRECT_DENIED')

class Remote:
    def __init__(self, key):
        if not key: raise RuntimeError('WORKER_KEY_NOT_CONFIGURED')
        self._key=key
        self._opener=build_opener(NoRedirect(), HTTPSHandler(context=ssl.create_default_context(cafile=certifi.where())))
    def call(self, path, method='GET', value=None, raw=None, mime=None, prefer=None):
        if not path.startswith(('/rest/v1/','/storage/v1/')): raise RuntimeError('REMOTE_PATH_DENIED')
        body=raw if raw is not None else json.dumps(value,ensure_ascii=False).encode() if value is not None else None
        headers={'apikey':self._key,'Authorization':'Bearer '+self._key,'Content-Type':mime or 'application/json'}
        if prefer: headers['Prefer']=prefer
        try:
            with self._opener.open(Request(ORIGIN+path,data=body,headers=headers,method=method),timeout=30) as response:
                data=response.read(256001)
                if len(data)>256000: raise RuntimeError('REMOTE_RESPONSE_TOO_LARGE')
                return json.loads(data) if data else None
        except HTTPError as e:
            # Provider response bodies may contain database details; never log them.
            raise RuntimeError('REMOTE_HTTP_'+str(e.code)) from None

def utc(): return datetime.now(timezone.utc)
def clock():
    """Seconds on the worker's monotonic clock; the bench replaces it to replay measured durations."""
    return time.monotonic()
def check_transport(remote):
    """Read-only schema/storage readiness. Never claims a job or advertises health.

    The claim RPC is deliberately verified by a successful real claim in the
    run loop, not by a pretend dry run that could start a paid job.
    """
    bucket = remote.call('/storage/v1/bucket/' + BUCKET)
    if (not isinstance(bucket, dict) or bucket.get('id') != BUCKET or bucket.get('public') is not False
            or bucket.get('file_size_limit') != ARTIFACT_LIMIT
            or not isinstance(bucket.get('allowed_mime_types'), list)
            or len(bucket['allowed_mime_types']) != 2 or set(bucket['allowed_mime_types']) != ARTIFACT_MIMES):
        raise RuntimeError('PRIVATE_BUCKET_NOT_READY')
    # Validate every worker-used column without reading any user's lesson/result.
    rows = remote.call('/rest/v1/noam_teacher_generation_jobs?select=id,owner_id,lesson,status,phase,result,error_code,lease_token,lease_until,updated_at&limit=0')
    if rows != []: raise RuntimeError('QUEUE_NOT_READY')

def heartbeat(remote):
    remote.call('/rest/v1/noam_teacher_generation_workers?on_conflict=id','POST',
                {'id':'primary','updated_at':utc().isoformat(),'capabilities':{**capabilities(),'trialActorIsolation':1}},prefer='resolution=merge-duplicates')

def update_job(remote, job, values):
    for key in ('id','owner_id','lease_token'):
        if not UUID.fullmatch(str(job.get(key,''))): raise RuntimeError('INVALID_JOB_ID')
    values={**values,'updated_at':utc().isoformat()}
    path = ('/rest/v1/noam_teacher_generation_jobs?select=id,owner_id&id=eq.' + job['id']
            + '&owner_id=eq.' + job['owner_id'] + '&lease_token=eq.' + job['lease_token']
            + '&status=eq.running&lease_until=gt.' + utc().isoformat().replace('+00:00','Z'))
    rows=remote.call(path,'PATCH',values,prefer='return=representation')
    if rows != [{'id':job['id'], 'owner_id':job['owner_id']}]: raise RuntimeError('JOB_LEASE_LOST')

def safe_validation_detail(value):
    """Retain known local validation rules, never arbitrary exception/model text."""
    fixed = {
        'Duplicate model JSON key', 'Nonfinite number',
        'Expected author parameter contract version 2',
        'Expected author parameter contract version 3',
        'Author question count must match the trusted plan',
        'Expected 3–6 author parameter items per question',
        'Author could not meet the requested topic/progress boundary',
        'Duplicate task in worksheet', 'Equation solution does not satisfy the equation',
        'Question kind/star must exactly match the trusted question plan',
        'Model output too large', 'Unsupported model schema',
        'Question count must match the requested count',
        'Choose a new first question instead of the reserved demonstration',
        'Choose varied parameters instead of a long predictable numeric pattern',
        'Choose parameters permitting varied verified mistake families',
        'Expected exactly 3 author parameter items per positive-only question',
        'Create a new draft with explicit teaching limits',
        'Division fact exceeds the selected teaching limits',
        'Signed equation outside the selected teaching limits',
        'Negative derived value outside the selected teaching limits',
    }
    patterns = (
        r'(?:A text block needs one to thirty typed spans|Expected a typed span|Unsupported text span) at '
        r'(?:rule|q[1-9][0-9]?(?:\.intro|\.item\.[1-9]\.(?:prompt|answer)|\.table\.(?:head\.[1-6]|row\.(?:[1-9]|1[0-2])\.[1-6])))',
        r'author root: expected fields version,questions',
        r'author question [1-9][0-9]{0,2}: expected fields items',
        r'author question [1-9][0-9]{0,2} item [1-9][0-9]?: expected fields (?:a,b,solution|a,solution|divisor,quotient)',
        r'author question [1-9][0-9]{0,2} item [1-9][0-9]? (?:a|b|solution|derived c|divisor|quotient): integer outside allowed range',
        r'(?:a|b|c|solution): integer outside allowed range',
    )
    if isinstance(value, str) and len(value) <= 240 and (value in fixed or any(re.fullmatch(p, value) for p in patterns)):
        return value
    return None


def save_author_diagnostics(root, job_id, metadata, failure=None):
    """Bounded private operator evidence, kept outside render/upload directories.

    The author returns only sanitized measurements. Explicitly allowlist those
    fields again here; no raw response, headers, lesson or credentials persist.
    A diagnostics I/O failure must not replace the original authoring result.
    """
    try:
        if not UUID.fullmatch(str(job_id)): return False
        record = {'version': 1, 'jobId': job_id, 'recordedAt': utc().isoformat(),
                  'stage': 'authoring', 'outcome': 'failed' if failure else 'passed'}
        for key in ('responseReceived', 'validated', 'providerCalled'):
            if type(metadata.get(key)) is bool: record[key] = metadata[key]
        for key in ('requestedModel', 'responseModel'):
            value = metadata.get(key)
            if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', value): record[key] = value
        elapsed = metadata.get('elapsedSeconds')
        if type(elapsed) in (int, float) and 0 <= elapsed <= 86400: record['elapsedSeconds'] = round(elapsed, 3)
        # Which provider answered, how the call ended and how many attempts it
        # took: fixed labels and small numbers only (provider.py vocabularies).
        record.update(safe_transport_measurements(metadata))
        if metadata.get('correctionRequested') is True: record['correctionRequested'] = True
        rewrites = metadata.get('sourceRewrites')
        if type(rewrites) is int and 0 <= rewrites <= 100_000: record['sourceRewrites'] = rewrites
        # The repair ladder's model calls for this job.
        for key, top in (('authorCalls', AUTHOR_CALLS), ('correctionCalls', CORRECTION_CALLS)):
            if type(metadata.get(key)) is int and 0 <= metadata[key] <= top: record[key] = metadata[key]
        # Parallel author parts and the questions their duplicate filter refused: two small counts.
        parts = metadata.get('authorSlices')
        if isinstance(parts, dict) and all(type(parts.get(key)) is int and 0 <= parts[key] <= 99 for key in ('parts', 'duplicates')):
            record['authorSlices'] = {'parts': parts['parts'], 'duplicates': parts['duplicates']}
        # Whether the author wrote the reserve questions it was asked for: two small counts.
        reserves = metadata.get('reserves')
        if isinstance(reserves, dict) and all(type(reserves.get(key)) is int and 0 <= reserves[key] <= 99 for key in ('offered', 'dropped')):
            record['reserves'] = {'offered': reserves['offered'], 'dropped': reserves['dropped']}
        record['usage'] = safe_usage(metadata.get('usage'))
        if 'revisionUsage' in metadata:
            record['revisionUsage'] = safe_usage(metadata.get('revisionUsage'))
        if metadata.get('authorContract') in (
            'worksheet-parameters/2', 'worksheet-parameters/3', 'worksheet-source/4', 'no-carry-addition/1',
            'triangle-parameters/1', 'division-facts/1', 'square-parameters/1', 'counting-words/1',
            'pythagoras-parameters/1', 'unlike-fractions/1', 'square-introduction/1',
            'intro-algebra/1', 'intro-arithmetic/1',
        ):
            record['authorContract'] = metadata['authorContract']
        derivation = metadata.get('derivation')
        if isinstance(derivation, dict) and type(derivation.get('performed')) is bool:
            record['derivationPerformed'] = derivation['performed']
        validation = metadata.get('validationError')
        validation = validation if isinstance(validation, dict) else {}
        code = failure.code if isinstance(failure, GenerationError) else validation.get('code')
        if isinstance(code, str) and re.fullmatch(r'[A-Z_]{1,60}', code): record['errorCode'] = code
        detail = safe_validation_detail(validation.get('detail'))
        if detail is None and isinstance(failure, GenerationError): detail = safe_validation_detail(str(failure))
        if detail is not None: record['validationDetail'] = detail
        data = (json.dumps(record, ensure_ascii=False, indent=2) + '\n').encode()
        if len(data) > 8192: return False
        folder = root / 'author-diagnostics'
        if folder.is_symlink(): return False
        folder.mkdir(mode=0o700, exist_ok=True)
        folder.chmod(0o700)
        path = folder / (job_id + '.json')
        flags = os.O_WRONLY | os.O_CREAT | os.O_EXCL | getattr(os, 'O_NOFOLLOW', 0)
        with os.fdopen(os.open(path, flags, 0o600), 'wb') as output:
            output.write(data)
        return True
    except (OSError, TypeError, ValueError):
        return False


def blocking_questions(folder, skill, steps, gate, count):
    """{printed question: codes} for the blocking findings of one gate decision that name a question.

    ``gate`` is the runner's decision (manifest['gate'] or the pre-pass
    result). For a refusal of the trusted adapter the refused source code is
    added from the structured report (skill_feedback.gate_report), so a
    correction can carry that code's instruction.
    """
    named = {}
    rows = gate.get('blocking') if isinstance(gate, dict) else None
    for row in rows if isinstance(rows, list) else []:
        question, code = (row.get('question'), row.get('code')) if isinstance(row, dict) else (None, None)
        if type(question) is int and 1 <= question <= count and isinstance(code, str) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,59}', code):
            if code not in named.setdefault(question, []):
                named[question].append(code)
    if named:
        for row in gate_report(folder, skill, steps, count)['findings']:
            refusal = (row.get('evidence') or {}).get('refusal')
            if row.get('question') in named and isinstance(refusal, str) and re.fullmatch(r'[A-Z_]{1,60}', refusal):
                if refusal not in named[row['question']]:
                    named[row['question']].append(refusal)
    return named


def public_salvage(summary, requested):
    """What the repair ladder did, for the job result: counts and fixed codes only."""
    if not isinstance(summary, dict) or type(summary.get('attempts')) is not int:
        return None
    def count(key, top=99):
        value = summary.get(key)
        return value if type(value) is int and 0 <= value <= top else 0
    def codes(key):
        found = summary.get(key) if isinstance(summary.get(key), dict) else {}
        return {code: number for code, number in sorted(found.items())[:40]
                if isinstance(code, str) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,59}', code)
                and type(number) is int and 0 < number <= 99}
    result = {'attempts': count('attempts', AUTHOR_CALLS), 'corrections': count('corrections', CORRECTION_CALLS),
              'requestedQuestions': requested, 'printedQuestions': count('printed') or requested,
              # Questions that a reserve or a correction replaced, and questions that were left out.
              'replaced': {'count': count('replaced'), 'codes': codes('replacedCodes')},
              'dropped': {'count': count('dropped'), 'codes': codes('droppedCodes')}}
    if summary.get('gate') in ('deliver', 'replace', 'fail'):
        result['gate'] = summary['gate']
    return result


def failure_detail(error, summary, stage=None):
    """One sanitised record of where a job failed: fixed labels, codes and small numbers only."""
    summary = summary if isinstance(summary, dict) else {}
    stage = stage or summary.get('stage')
    question, gate = summary.get('question'), summary.get('gateCode')
    detail = {'stage': stage if stage in STAGES else 'author',
              'question': question if type(question) is int and 1 <= question <= 99 else None,
              'gate': gate if isinstance(gate, str) and re.fullmatch(r'[A-Z][A-Z0-9_]{0,39}', gate) else None}
    for key, top in (('attempts', AUTHOR_CALLS), ('corrections', CORRECTION_CALLS)):
        if type(summary.get(key)) is int and 0 <= summary[key] <= top:
            detail[key] = summary[key]
    first = summary.get('firstCode')
    if isinstance(first, str) and re.fullmatch(r'[A-Z_]{1,60}', first):
        detail['firstCode'] = first
    if isinstance(error, GenerationError) and error.code == 'PROVIDER_HTTP_ERROR':
        transport = safe_transport_measurements(getattr(error, 'http_transport', None))
        if transport.get('httpStatus', 0) >= 300:
            detail['providerHttp'] = {key: transport[key] for key in
                                      ('provider', 'httpStatus', 'providerError', 'attempts') if key in transport}
    return detail


def author_and_render(remote, job, target, lost, enable_skill_revision, *, claimed_at=None, summary=None):
    """Author and render one job. Returns (manifest, folder that holds the artifacts).

    ``summary``, when a dict, is filled as the job advances: the stage, the
    calls used and what was replaced. ``claimed_at`` is the clock() time of
    the claim, for MODEL_DEADLINE.
    """
    lesson = job['lesson']
    metadata = {}
    state = summary if isinstance(summary, dict) else {}
    state['stage'] = 'author'
    author_failure = None

    def save_diagnostics():
        if metadata.get('initialPlainMath') is True:
            # The short-lived container loses private attempt evidence on exit.
            # Log only whether the correction was requested and validated.
            print(json.dumps({'event':'source_notation_recovery', 'jobId':job['id'],
                              'correctionRequested':metadata.get('correctionRequested') is True,
                              'sourceValidated':metadata.get('validated') is True}), flush=True)
        if not save_author_diagnostics(target.parent, job['id'], metadata, author_failure):
            print(json.dumps({'event':'author_diagnostics_unavailable','jobId':job['id']}), flush=True)

    def set_phase(phase):
        if lost.is_set():
            raise RuntimeError('JOB_LEASE_LOST')
        update_job(remote, job, {'phase': phase})
        if lost.is_set():
            raise RuntimeError('JOB_LEASE_LOST')

    if not (lesson.get('version') == 3 and enable_skill_revision):
        # Legacy intake, or the ladder switched off: one author call, one render.
        options = {'timeout': 300} if lesson.get('version') == 3 else {}
        try:
            try:
                payload = author_lesson(lesson, metadata=metadata, **options)
            except Exception as exc:
                author_failure = exc
                raise
        finally:
            save_diagnostics()
        set_phase('rendering')
        state['stage'] = 'render'
        return render_job(lesson, payload, target), target

    claimed = clock() if claimed_at is None else claimed_at
    state.update(attempts=0, corrections=0)
    closed = False  # a model call failed without a reply: no further call for this job

    def may_call(kind):
        """Whether a model call of ``kind`` may start now (MODEL_DEADLINE)."""
        if closed:
            return False
        if kind == 'author':
            # A second attempt is written the way the first one was: one call, or parallel parts.
            parts = metadata.get('authorSlices') if isinstance(metadata.get('authorSlices'), dict) else {}
            author = PARTS_AUTHOR_SECONDS if type(parts.get('parts')) is int and parts['parts'] > 1 else AUTHOR_SECONDS
            # Room for the attempt and for exactly one correction after it.
            needed = author + CORRECTION_SECONDS
        else:
            needed = CORRECTION_SECONDS
        if clock() - claimed + needed > MODEL_DEADLINE:
            return False
        return state['attempts'] < AUTHOR_CALLS if kind == 'author' else state['corrections'] < CORRECTION_CALLS

    def fresh(name):
        """A folder of this job that nothing has used yet."""
        path = target / name
        if target.is_symlink() or path.is_symlink() or path.exists():
            raise RuntimeError('JOB_PATH_DENIED')
        return path

    def settle(draft):
        """Bring a draft to a sheet that may be rendered: one correction call, then a shorter sheet."""
        nonlocal closed, author_failure
        if draft.needs_model() and may_call('correction'):
            set_phase('authoring')
            state['corrections'] += 1
            try:
                draft.correct()
            except GenerationError as exc:
                # The deficit stays and the next step is a shorter sheet.
                author_failure = exc
                state['correctionFailed'] = True
                closed = closed or exc.code not in UNUSABLE_REPLY
            else:
                author_failure = None
        try:
            if draft.missing() and not draft.shorten():
                # Shortening restores usable questions first. The first position
                # still missing is the same one first_refusal() reports.
                state['question'] = next(iter(draft.missing()), None)
                raise draft.first_refusal()
            payload = draft.source()
        except GenerationError:
            raise
        except ValueError as exc:  # GeneralSourceError and the kernel's error carry a fixed code
            code = getattr(exc, 'code', None)
            author_failure = GenerationError(code if isinstance(code, str) else 'QUALITY_GATE_FAILED', str(exc)[:240])
            raise author_failure from None
        author_failure = None  # the sheet is valid again, with or without the correction
        return payload

    def attempt(number):
        """One author call and everything that follows it. Returns (manifest, folder) or raises."""
        nonlocal author_failure
        session = {}
        state['stage'] = 'author'
        try:
            payload = author_lesson(lesson, metadata=metadata, timeout=300, revision=session)
            author_failure = None
        except GenerationError as exc:
            author_failure = exc
            draft = session.get('draft')
            if draft is None:
                exc.session = session
                raise
            state['stage'] = 'source'
            try:
                payload = settle(draft)
            except GenerationError as failure:
                failure.session = session
                raise
            author_failure = None
        draft = session.get('draft')
        requested = lesson['questionCount']

        def sheet():
            # The lesson of the current sheet; a salvaged one prints fewer questions.
            current = draft.lesson if draft is not None else lesson
            return current, ({'salvaged_from': requested} if current['questionCount'] != requested else {})

        def swap(named):
            if draft.replace(named, stage=state['stage']) != len(named):
                raise GenerationError('QUALITY_GATE_FAILED', 'A gate named a question that is not on the sheet')
            return settle(draft)

        def note(named, gate):
            state['question'] = min(named) if named else None
            rows = gate.get('blocking') if isinstance(gate, dict) else None
            codes = [row.get('code') for row in rows if isinstance(row, dict)] if isinstance(rows, list) else []
            state['gateCode'] = next((code for code in codes if isinstance(code, str)), None)

        try:
            checks = renders = 0
            prepass = draft is not None
            set_phase('rendering')
            while True:
                # The pre-pass builds content.json and runs the gates that read it: no PDF, no Word file.
                while prepass and checks < PRECHECK_PASSES:
                    state['stage'] = 'precheck'
                    current, salvage = sheet()
                    folder = fresh(f'check-{number}-{checks + 1}')
                    result = precheck_job(current, payload, folder, **salvage)
                    if result.get('status') == 'not_applicable':
                        # Nothing was written and no round was spent; the render's own adapter step decides.
                        prepass = False
                        break
                    checks += 1
                    named = blocking_questions(folder, 'elementary', result.get('steps') or [], result.get('gate'),
                                               current['questionCount'])
                    if not named:
                        break
                    note(named, result.get('gate'))
                    before = state['corrections']
                    payload = swap(named)
                    if state['corrections'] != before:
                        set_phase('rendering')  # a correction call had moved the job back to authoring
                state['stage'] = 'render'
                current, salvage = sheet()
                folder = fresh(f'render-{number}-{renders + checks + 1}')
                manifest = render_job(current, payload, folder, **salvage)
                gate = manifest.get('gate') if isinstance(manifest.get('gate'), dict) else {}
                if manifest.get('status') != 'failed':
                    state['gate'] = 'deliver'
                    if draft is not None:
                        state.update({key: value for key, value in draft.report().items()
                                      if key in ('planned', 'replaced', 'dropped', 'printed', 'replacedCodes',
                                                 'droppedCodes', 'byReserve', 'byCorrection')})
                    return manifest, folder
                state['gate'] = gate.get('action') if gate.get('action') in ('replace', 'fail') else 'fail'
                steps = manifest.get('steps') if isinstance(manifest.get('steps'), list) else []
                skill = (manifest.get('skill') or {}).get('name') if isinstance(manifest.get('skill'), dict) else None
                named = (blocking_questions(folder, skill, steps, gate, current['questionCount'])
                         if draft is not None and gate.get('action') == 'replace' else {})
                note(named, gate)
                if not named:
                    raise GenerationError('QUALITY_GATE_FAILED', 'A required output gate failed')
                if [step.get('name') for step in steps if isinstance(step, dict)] == ['trusted-adapter']:
                    # Nothing was built: the adapter's refusal is a pre-pass finding.
                    if checks >= PRECHECK_PASSES:
                        raise GenerationError('QUALITY_GATE_FAILED', 'A required output gate failed')
                    checks += 1
                else:
                    renders += 1
                    if renders >= FULL_RENDERS:
                        raise GenerationError('QUALITY_GATE_FAILED', 'A required output gate failed')
                payload = swap(named)
                set_phase('rendering')  # the lease is confirmed again before another render
        except GenerationError as failure:
            failure.session = session
            raise

    try:
        if target.is_symlink() or target.exists():
            raise RuntimeError('JOB_PATH_DENIED')
        target.mkdir(mode=0o700)
        while True:
            state['attempts'] += 1
            try:
                return attempt(state['attempts'])
            except GenerationError as failure:
                session = getattr(failure, 'session', {})
                # A second full attempt: the reply is unusable as a whole, or the ladder ended below the minimum.
                usable = session.get('replyReceived') is True or (
                    session.get('requested') is True and failure.code in UNUSABLE_REPLY)
                if not (usable and may_call('author')):
                    raise
                state['firstCode'] = failure.code
                for key in ('question', 'gateCode', 'gate'):
                    state.pop(key, None)
                metadata.clear()
                set_phase('authoring')
    finally:
        calls = {'authorCalls': state.get('attempts'), 'correctionCalls': state.get('corrections')}
        metadata.update({key: value for key, value in calls.items() if type(value) is int})
        save_diagnostics()


def process_job(remote, job, root, *, enable_skill_revision=ENABLE_SKILL_REVISION):
    if not all(isinstance(job.get(key), str) and UUID.fullmatch(job[key]) for key in ('owner_id','id')):
        raise RuntimeError('INVALID_JOB_ID')
    if job.get('status')!='running' or not UUID.fullmatch(str(job.get('lease_token',''))): raise RuntimeError('JOB_LEASE_LOST')
    try: expires=datetime.fromisoformat(job.get('lease_until','').replace('Z','+00:00'))
    except (ValueError,TypeError,AttributeError): raise RuntimeError('JOB_LEASE_LOST') from None
    if expires.tzinfo is None or expires<=utc(): raise RuntimeError('JOB_LEASE_LOST')
    lesson=job.get('lesson');validate_lesson(lesson, allow_legacy=False)
    raw_target=root/job['id']
    if raw_target.is_symlink(): raise RuntimeError('JOB_PATH_DENIED')
    target=raw_target.resolve()
    if target.parent!=root or target.exists(): raise RuntimeError('JOB_PATH_DENIED')
    claimed=clock()
    summary={}
    stage=None
    # Confirm the current lease against durable state before any billed call.
    update_job(remote,job,{'phase':'authoring'})
    stop=threading.Event();lost=threading.Event()
    def renew():
        while not stop.wait(25):
            try:
                check_transport(remote)
                update_job(remote,job,{'lease_until':(utc()+timedelta(minutes=20)).isoformat()})
                heartbeat(remote)
            except Exception:
                lost.set();return
    thread=threading.Thread(target=renew,daemon=True);thread.start()
    try:
        manifest, artifact_root = author_and_render(remote, job, target, lost, enable_skill_revision,
                                                    claimed_at=claimed, summary=summary)
        stage='acceptance'
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        artifacts=manifest.get('artifacts',[])
        general=lesson.get('version')==3 and manifest.get('authoringProfile')=='general-skill-source/v1'
        passed=manifest.get('status')=='needs_review' and (manifest.get('automatedChecksPassed') is True
            or (general and manifest.get('renderingChecksPassed') is True))
        passed=passed and bool(manifest.get('steps')) and all(s.get('status') in (('PASS','REVIEW') if general else ('PASS',)) for s in manifest['steps'])
        if not passed or {a.get('kind') for a in artifacts}!={'pdf','docx'} or len(artifacts)!=2:
            raise GenerationError('QUALITY_GATE_FAILED','A required output gate failed')
        stage='upload'
        check_transport(remote)
        # Bind private uploads to the durable claim again after the potentially long render.
        update_job(remote,job,{'phase':'checking'})
        published=[]
        for item in artifacts:
            if (artifact_root/item['path']).is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            path=(artifact_root/item['path']).resolve()
            if not path.is_relative_to(artifact_root) or path.is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            blob=path.read_bytes()
            if not 0<len(blob)<=ARTIFACT_LIMIT or hashlib.sha256(blob).hexdigest()!=item['sha256']: raise RuntimeError('ARTIFACT_HASH_MISMATCH')
            mime='application/pdf' if item['kind']=='pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            remote.call('/storage/v1/object/'+BUCKET+'/'+job['owner_id']+'/'+job['id']+'/sheet.'+item['kind'],'POST',raw=blob,mime=mime)
            published.append({'kind':item['kind'],'sha256':item['sha256'],'bytes':len(blob)})
        # Paths/logs/model source stay on the private worker; browser gets only
        # bounded provenance and the exact two artifacts, never public URLs.
        result={'version':1,'automatedChecksPassed':manifest.get('automatedChecksPassed') is True,'humanReviewRequired':True,'skill':manifest['skill'],
                'artifacts':published,'checks':[{'name':s['name'],'status':s['status']} for s in manifest['steps']]}
        if general:
            findings=manifest.get('reviewFindings',[])
            salvage=public_salvage(summary,lesson['questionCount'])
            if salvage and salvage['dropped']['count']:
                # A shorter sheet is delivered with its own note for the teacher.
                findings=(findings if isinstance(findings,list) else [])+[
                    {'code':'SHORTER_SHEET','class':'editorial','count':salvage['dropped']['count']}]
            planned=summary.get('planned')
            if type(planned) is int and 0<planned<lesson['questionCount']:
                # An opening sheet planned by its minutes (skill_authoring.planned_count) has its own note.
                findings=(findings if isinstance(findings,list) else [])+[
                    {'code':'LESSON_SIZED','class':'editorial','count':lesson['questionCount']-planned}]
            unverified=unverified_rows(manifest.get('unverifiedAnswers',[])) or []
            # Editorial findings only: fixed codes, counts, question numbers and
            # this engine's own Hebrew notes. No gate or model text is forwarded.
            result.update(authoringProfile='general-skill-source/v1',renderingChecksPassed=True,
                          reviewFindings=public_review_findings(findings),
                          # Which printed answers no exact kernel verified: labels, open items,
                          # story-typed decisions and review answers, by question and item.
                          teacherNotes=public_teacher_notes(manifest.get('unverifiedAnswers',[])),
                          unverifiedAnswers={kind:sum(row['kind']==kind for row in unverified)
                                             for kind in sorted({row['kind'] for row in unverified})})
            if salvage:
                # What the repair ladder did: attempts, corrections, replaced questions, the gate decision.
                result['salvage']=salvage
            if len(json.dumps(result,ensure_ascii=False).encode())>RESULT_LIMIT:
                # Keep the notes and their counts; the positions are also printed on the sheet's key.
                for entry in result['teacherNotes']: entry.pop('items',None)
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        stop.set();thread.join(timeout=3)
        update_job(remote,job,{'status':'needs_review','phase':'needs_review','result':result,'lease_token':None,'lease_until':None})
    except Exception as error:
        # For the container log: the failed row itself stores the code only.
        error.job_failure=failure_detail(error,summary,stage)
        raise
    finally: stop.set();thread.join(timeout=3)

def load_env(path):
    allowed={'QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_BASE_URL','QWEN_MODEL','TEACHER_GENERATION_SERVICE_KEY','ELEMENTARY_SKILL_PATH','MIDDLE_SKILL_PATH',
             # The author switch and the selected provider's own credential and model (provider.author_config).
             'TEACHER_AUTHOR_PROVIDER','GEMINI_API_KEY','GEMINI_MODEL',
             # Parallel author parts: 1-4 or auto (author_request.slice_setting).
             'TEACHER_AUTHOR_SLICES'}
    for line in Path(path).read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
        key,value=line.split('=',1);key=key.strip()
        if key not in allowed:continue
        value=value.strip()
        if len(value)>1 and value[0]==value[-1] and value[0] in ('"',"'"):value=value[1:-1]
        os.environ[key]=value

@contextmanager
def shutdown_signals():
    """Request a drain without interrupting an in-flight claim or paid job."""
    shutdown = threading.Event()
    previous = {}
    def request_stop(signum, frame):
        shutdown.set()
    try:
        for signum in (signal.SIGTERM, signal.SIGINT):
            previous[signum] = signal.signal(signum, request_stop)
        yield shutdown
    finally:
        for signum, handler in previous.items():
            signal.signal(signum, handler)


def run_worker(args, shutdown):
    for path in args.env_file:load_env(path)
    if not check_readiness(require_provider=True)['ready']:
        print(json.dumps({'event':'worker_not_ready'}),flush=True)
        raise SystemExit(1)
    if shutdown.is_set():return
    try:
        remote=Remote(os.environ.get('TEACHER_GENERATION_SERVICE_KEY'))
        if args.check_only:
            check_transport(remote)
            print(json.dumps({'event':'worker_preflight_pass','claimVerified':False,'providerCalled':False,'heartbeatWritten':False}),flush=True)
            return
    except Exception:
        print(json.dumps({'event':'worker_not_ready'}),flush=True)
        raise SystemExit(1)
    root=Path(args.work_dir).resolve();root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
    while not shutdown.is_set():
        try:
            check_transport(remote)
            if shutdown.is_set():return
            rows=remote.call('/rest/v1/rpc/claim_teacher_generation_job','POST',{})
            if not isinstance(rows,list) or len(rows)>1 or (rows and not isinstance(rows[0],dict)):
                raise RuntimeError('QUEUE_NOT_READY')
            # A recurring claim failure must never keep the UI "online".
            # Existing heartbeats expire after 90 seconds on the website.
            heartbeat(remote)
            if rows:
                # A signal may arrive while the claim is in flight. Finish that
                # owned job; its separate lease-renewal event stays untouched.
                job=rows[0]
                try:process_job(remote,job,root)
                except Exception as e:
                    code=e.code if isinstance(e,GenerationError) else 'WORKER_FAILED'
                    if not re.fullmatch('[A-Z_]{1,60}',code):code='WORKER_FAILED'
                    try:update_job(remote,job,{'status':'failed','phase':'failed','error_code':code,'lease_token':None,'lease_until':None})
                    except Exception:pass
                    # One line with where it failed: the stage, the question and the gate, when known.
                    detail=getattr(e,'job_failure',None) or failure_detail(e,None)
                    print(json.dumps({'event':'generation_failed','jobId':job.get('id'),'code':code,**detail}),flush=True)
                else:print(json.dumps({'event':'generation_needs_review','jobId':job['id']}),flush=True)
            if args.once:return
        except Exception:
            print(json.dumps({'event':'worker_unavailable'}),flush=True)
            if args.once:raise SystemExit(1)
        shutdown.wait(5)


def main():
    p=argparse.ArgumentParser();p.add_argument('--env-file',action='append',default=[]);p.add_argument('--work-dir');p.add_argument('--once',action='store_true')
    p.add_argument('--check-only',action='store_true',help='Check local runtime and remote schema/private bucket without claim, heartbeat, uploads or model calls')
    args=p.parse_args()
    if not args.check_only and not args.work_dir:p.error('--work-dir is required unless --check-only')
    with shutdown_signals() as shutdown:
        run_worker(args, shutdown)

if __name__=='__main__':main()
