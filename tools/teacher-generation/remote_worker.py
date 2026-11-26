"""Private teacher job worker with a bounded, operator-controlled repair ladder.

Run only from a reviewed checkout with pinned skills and operator-supplied
environment. Secrets are not accepted in job JSON, forwarded to child renders,
logged, or copied to job artifacts. A process exit does not install a daemon.

A version 3 job is repaired in this order, each step only when the one before
left a deficit: reserve questions (no model call), ONE targeted correction
call (general_provider.Draft.correct: the notation-only fix, or the missing
questions and a refused rule, or the refused rule alone when no question is
missing), a shorter sheet, ONE second full author call.
Per job: at most AUTHOR_CALLS author calls and CORRECTION_CALLS correction
calls, and no model call starts later than MODEL_CALL_WINDOW seconds after
the claim. A sheet may fail; it never prints a question that a check refused.
A worksheet-wire/5 job (the provider's opt-in v5 route) takes no step of this
ladder: structured_author selects and repairs within its own call budget, and
the worker renders it with runner.render_structured and uploads its PDF only.
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
from gate_policy import NOTES, public_review_findings, public_teacher_notes, unverified_rows
from runner import V5_NOT_RUN_ALLOWED, precheck_job, render_job, render_structured
from skill_feedback import gate_report
from validation import GenerationError, capabilities, validate_lesson
from preflight import check as check_readiness

ORIGIN = 'https://ouzquolkeuceektfihss.supabase.co'
BUCKET = 'teacher-generation-private'
ENABLE_SKILL_REVISION = True
# The repair ladder's hard limits for one job.
AUTHOR_CALLS = 2          # the first reply and at most one second full attempt
CORRECTION_CALLS = 2      # targeted corrections (Draft.correct): missing questions, a refused rule, or the notation-only fix
MODEL_CALL_WINDOW = 150   # seconds after the claim in which a model call may still start
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

def update_job(remote, job, values, confirm=None):
    for key in ('id','owner_id','lease_token'):
        if not UUID.fullmatch(str(job.get(key,''))): raise RuntimeError('INVALID_JOB_ID')
    values={**values,'updated_at':utc().isoformat()}
    path = ('/rest/v1/noam_teacher_generation_jobs?select=id,owner_id' + (',status' if confirm else '') + '&id=eq.' + job['id']
            + '&owner_id=eq.' + job['owner_id'] + '&lease_token=eq.' + job['lease_token']
            + '&status=eq.running&lease_until=gt.' + utc().isoformat().replace('+00:00','Z'))
    rows=remote.call(path,'PATCH',values,prefer='return=representation')
    if confirm is None:
        if rows != [{'id':job['id'], 'owner_id':job['owner_id']}]: raise RuntimeError('JOB_LEASE_LOST')
        return
    # worksheet-wire/5: the trial trigger can turn this very update into failed (DRAFT_NOT_AVAILABLE) and the
    # row still comes back, so only the status the database kept says whether the draft exists. The trigger
    # skips the owner account: for an owner job the kept status is always the one asked for.
    if (not isinstance(rows,list) or len(rows)!=1 or not isinstance(rows[0],dict) or not isinstance(rows[0].get('status'),str)
            or {k:v for k,v in rows[0].items() if k!='status'} != {'id':job['id'], 'owner_id':job['owner_id']}):
        raise RuntimeError('JOB_LEASE_LOST')
    if rows[0]['status'] != confirm: raise GenerationError('DRAFT_NOT_AVAILABLE', 'The database did not keep this draft')

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


STRUCTURED_CONTRACT = 'worksheet-wire/5'
# D22 (V5-DESIGN §5, §14): Noam approved the SKIP allowlist runner.V5_NOT_RUN_ALLOWED on 2026-11-25 (emit_docx,
# catalog/landing and gate_sections G85–G92 may stay SKIP on the PDF-only middle render). Such a step is accepted
# only when it is also listed in notRun; it is never reported as passed, and automatedChecksPassed stays false
# while anything did not run. Set this back to False to refuse every SKIP. The elementary path never accepts one.
D22_APPROVED = True
D22_APPROVAL = {'approvedBy': 'Noam', 'approvedAt': '2026-11-25'}
STRUCTURED_STAGES = ('author', 'compile', 'repair', 'render', 'acceptance', 'upload')
_SLOT = re.compile(r'[QR][1-9][0-9]?')
_CODE = re.compile(r'[A-Z_]{1,60}')
_HEX64 = re.compile(r'[0-9a-f]{64}')
_CALL_PURPOSES = ('author', 'reauthor', 'repair_targeted', 'repair_fresh')
_HTTP_CLASSES = ('bad_request', 'credential_rejected', 'model_not_found', 'rate_limited', 'unavailable',
                 'server_error', 'http_error')


def _bounded_int(value, high):
    return value if type(value) is int and 0 <= value <= high else None


def _safe_codes(values):
    return sorted({v for v in values if isinstance(v, str) and _CODE.fullmatch(v)})[:16] if isinstance(values, list) else []


def safe_structured_record(value):
    """The worksheet-wire/5 author record (structured_author), allowlisted again field by field: counts, codes,
    slots, hashes and fixed labels only. No teacher text, model text, prompt or provider body can pass."""
    value = value if isinstance(value, dict) else {}
    out = {'version': 1, 'authorContract': STRUCTURED_CONTRACT}
    for key in ('cardSha256', 'schemaSha256'):
        if isinstance(value.get(key), str) and _HEX64.fullmatch(value[key]): out[key] = value[key]
    for key, high in (('repairRounds', 2), ('refusalsTotal', 100000), ('deadlineSeconds', 86400)):
        if _bounded_int(value.get(key), high) is not None: out[key] = value[key]
    if type(value.get('reauthored')) is bool: out['reauthored'] = value['reauthored']
    for key, labels in (('outcome', ('delivered', 'failed')), ('stage', STRUCTURED_STAGES),
                        ('repairSkipped', ('deadline', 'calls'))):
        if value.get(key) in labels: out[key] = value[key]
    if isinstance(value.get('code'), str) and _CODE.fullmatch(value['code']): out['code'] = value['code']
    calls = []
    for call in value.get('calls')[:3] if isinstance(value.get('calls'), list) else ():
        if not isinstance(call, dict) or call.get('purpose') not in _CALL_PURPOSES: continue
        entry = {'purpose': call['purpose'], 'usage': safe_usage(call.get('usage'))}
        for key, high in (('ms', 86400000), ('timeoutSeconds', 86400), ('slots', 99)):
            if _bounded_int(call.get(key), high) is not None: entry[key] = call[key]
        if call.get('finishReason') in ('stop', 'incomplete'): entry['finishReason'] = call['finishReason']
        if isinstance(call.get('code'), str) and _CODE.fullmatch(call['code']): entry['code'] = call['code']
        if type(call.get('httpStatus')) is int and 100 <= call['httpStatus'] <= 599: entry['httpStatus'] = call['httpStatus']
        if call.get('httpClass') in _HTTP_CLASSES: entry['httpClass'] = call['httpClass']
        calls.append(entry)
    out['calls'] = calls
    questions = value.get('questions')
    out['questions'] = [q for q in questions if isinstance(q, str) and _SLOT.fullmatch(q)][:32] if isinstance(questions, list) else []
    refusals = []
    for row in value.get('refusals')[:64] if isinstance(value.get('refusals'), list) else ():
        if (isinstance(row, dict) and isinstance(row.get('code'), str) and _CODE.fullmatch(row['code'])
                and isinstance(row.get('slot'), str) and (row['slot'] == '' or _SLOT.fullmatch(row['slot']))
                and _bounded_int(row.get('item'), 99) is not None and isinstance(row.get('field'), str)
                and re.fullmatch(r'(?:[a-z][A-Za-z0-9]{0,23})?', row['field'])):
            refusals.append({'slot': row['slot'], 'item': row['item'], 'field': row['field'], 'code': row['code']})
    out['refusals'] = refusals
    selection = value.get('selection')
    if isinstance(selection, dict):
        checked = {key: selection[key] for key in ('requested', 'delivered') if _bounded_int(selection.get(key), 99) is not None}
        for key in ('replaced', 'dropped'):
            rows = []
            for row in selection.get(key)[:32] if isinstance(selection.get(key), list) else ():
                if not isinstance(row, dict) or not (isinstance(row.get('slot'), str) and _SLOT.fullmatch(row['slot'])): continue
                entry = {'slot': row['slot'], 'codes': _safe_codes(row.get('codes'))}
                if key == 'replaced':
                    if not (isinstance(row.get('by'), str) and (row['by'] == 'REPAIR' or _SLOT.fullmatch(row['by']))): continue
                    entry['by'] = row['by']
                rows.append(entry)
            checked[key] = rows
        out['selection'] = checked
    return out


def shrink_structured(record):
    """Halve the first non-empty detail list (refusals, then replaced, then dropped) of a structured record so the
    8 KB diagnostics file fits; False when nothing is left to drop. Counts (refusalsTotal, requested, delivered)
    stay, and the record says truncated."""
    for holder, key in ((record, 'refusals'), (record.get('selection') or {}, 'replaced'),
                        (record.get('selection') or {}, 'dropped')):
        rows = holder.get(key)
        if isinstance(rows, list) and rows:
            del rows[len(rows) // 2:]
            record['truncated'] = True
            return True
    return False


def safe_failure_detail(value):
    """{stage, questions[, httpStatus]} for the generation_failed log line of a worksheet-wire/5 job, else None."""
    if not isinstance(value, dict) or value.get('stage') not in STRUCTURED_STAGES:
        return None
    questions = value.get('questions')
    out = {'stage': value['stage'],
           'questions': [q for q in questions if isinstance(q, str) and _SLOT.fullmatch(q)][:32] if isinstance(questions, list) else []}
    if type(value.get('httpStatus')) is int and 100 <= value['httpStatus'] <= 599:
        out['httpStatus'] = value['httpStatus']
    return out


def mark_failure(exc, stage, questions=()):
    """Give a worksheet-wire/5 failure its stage for the log line, unless the author already named one."""
    if not isinstance(getattr(exc, 'failure_detail', None), dict):
        try:
            exc.failure_detail = {'stage': stage, 'questions': list(questions)}
        except AttributeError:
            pass
    return exc


def structured_payload(payload, metadata):
    """The trusted worksheet-wire/5 result of structured_author, or None on every other author path.

    Only structured_author records authorContract worksheet-wire/5, so a v4 job imports no v5 module here."""
    if metadata.get('authorContract') != STRUCTURED_CONTRACT:
        return None
    from structured_author import StructuredAuthored
    if not isinstance(payload, StructuredAuthored):
        raise RuntimeError('AUTHOR_ROUTE_MISMATCH')
    return payload


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
        # The repair ladder's model calls for this job.
        for key, top in (('authorCalls', AUTHOR_CALLS), ('correctionCalls', CORRECTION_CALLS)):
            if type(metadata.get(key)) is int and 0 <= metadata[key] <= top: record[key] = metadata[key]
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
            'intro-algebra/1', 'intro-arithmetic/1', STRUCTURED_CONTRACT,
        ):
            record['authorContract'] = metadata['authorContract']
        if metadata.get('authorContract') == STRUCTURED_CONTRACT:
            record['structured'] = safe_structured_record(metadata.get('structured'))
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
        while len(data) > 8192 and isinstance(record.get('structured'), dict) and shrink_structured(record['structured']):
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
    return detail


def author_and_render(remote, job, target, lost, enable_skill_revision, *, claimed_at=None, summary=None):
    """Author and render one job. Returns (manifest, folder that holds the artifacts, structured).

    ``structured`` is the StructuredAuthored result of a worksheet-wire/5 job
    (rendered with runner.render_structured, no ladder step), else None.
    ``summary``, when a dict, is filled as the job advances: the stage, the
    calls used and what was replaced. ``claimed_at`` is the monotonic time of
    the claim, for MODEL_CALL_WINDOW.
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

    def structured_render(structured, render_target):
        # worksheet-wire/5: runner.render_structured takes the trusted render contract from the
        # StructuredAuthored result itself; the worker passes none. No correction call follows a v5 render
        # (its repairs ran inside the author's call budget).
        try:
            set_phase('rendering')
            manifest = render_structured(lesson, structured, render_target)
        except Exception as exc:
            raise mark_failure(exc, 'render')
        return manifest, render_target, structured

    if not (lesson.get('version') == 3 and enable_skill_revision):
        # Legacy intake, or the ladder switched off: one author call, one render.
        options = {'timeout': 300} if lesson.get('version') == 3 else {}
        try:
            try:
                payload = author_lesson(lesson, metadata=metadata, **options)
            except Exception as exc:
                author_failure = exc
                if metadata.get('authorContract') == STRUCTURED_CONTRACT:
                    mark_failure(exc, 'author')
                raise
        finally:
            save_diagnostics()
        structured = structured_payload(payload, metadata)
        if structured is not None:
            return structured_render(structured, target)
        set_phase('rendering')
        state['stage'] = 'render'
        return render_job(lesson, payload, target), target, None

    claimed = time.monotonic() if claimed_at is None else claimed_at
    state.update(attempts=0, corrections=0)
    closed = False  # a model call failed without a reply: no further call for this job
    diagnostics_due = True  # a worksheet-wire/5 job saves its diagnostics before the render

    def may_call(kind):
        if closed or time.monotonic() - claimed >= MODEL_CALL_WINDOW:
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
        """One author call and everything that follows it. Returns (manifest, folder, structured) or raises."""
        nonlocal author_failure, diagnostics_due
        session = {}
        state['stage'] = 'author'
        try:
            payload = author_lesson(lesson, metadata=metadata, timeout=300, revision=session)
            author_failure = None
        except GenerationError as exc:
            author_failure = exc
            if metadata.get('authorContract') == STRUCTURED_CONTRACT:
                # worksheet-wire/5 selects and repairs inside structured_author: no ladder step follows.
                raise mark_failure(exc, 'author')
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
        except Exception as exc:
            if metadata.get('authorContract') == STRUCTURED_CONTRACT:
                author_failure = exc
                mark_failure(exc, 'author')
            raise
        structured = structured_payload(payload, metadata)
        if structured is not None:
            # Persist completed author diagnostics before the potentially long render.
            save_diagnostics()
            diagnostics_due = False
            return structured_render(structured, target)
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
                                      if key in ('replaced', 'dropped', 'printed', 'replacedCodes', 'droppedCodes',
                                                 'byReserve', 'byCorrection')})
                    return manifest, folder, None
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
                if metadata.get('authorContract') == STRUCTURED_CONTRACT:
                    raise  # worksheet-wire/5: structured_author spent its own call budget; no second attempt
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
        if diagnostics_due:
            if metadata.get('authorContract') != STRUCTURED_CONTRACT:
                # A worksheet-wire/5 record lists its own model calls (record['structured']), not the ladder's.
                calls = {'authorCalls': state.get('attempts'), 'correctionCalls': state.get('corrections')}
                metadata.update({key: value for key, value in calls.items() if type(value) is int})
            save_diagnostics()


def accepted_step(step, skill, not_run):
    """The worker's own rule for one step of a worksheet-wire/5 render, independent of the runner's verdict.

    PASS is accepted. A SKIP is accepted only on the middle path, only for a step named in runner.V5_NOT_RUN_ALLOWED
    and listed in the manifest's notRun, and only once Noam has approved D22 (D22_APPROVED). REVIEW, FAIL, any
    other status, and every SKIP on the elementary path are refused."""
    if not isinstance(step, dict) or not isinstance(step.get('name'), str):
        return False
    if step.get('status') == 'PASS':
        return True
    return (step.get('status') == 'SKIP' and D22_APPROVED is True and skill == 'middle'
            and step['name'] in V5_NOT_RUN_ALLOWED and step['name'] in not_run)


REVIEW_REASON = 'PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY'


def accepted_review(steps, index, skill):
    """Whether steps[index], a REVIEW step of a version 3 render, is the one REVIEW the worker delivers.

    Only the production path from before #635 makes it: runner.render_job sets the middle driver's step
    (middle-build) to REVIEW with reason PINNED_DRIVER_REVIEW_EXIT_DISCREPANCY once didactic_review.py
    reconciled it, and records that reconciliation as the next step, PASS. ``skill`` is the lesson's
    skill when the manifest names the same one. Every other REVIEW is refused."""
    step = steps[index]
    after = steps[index + 1] if index + 1 < len(steps) else None
    return (skill == 'middle' and step.get('name') == 'middle-build' and step.get('status') == 'REVIEW'
            and step.get('reason') == REVIEW_REASON and isinstance(after, dict)
            and after.get('name') == 'didactic-review-reconciliation' and after.get('status') == 'PASS')


GENERAL_PROFILE = 'general-skill-source/v1'


def general_verdict(manifest, skill):
    """'PASS', 'REVIEW' or None: the worker's acceptance of a version 3 render, by allowlist.

    ``skill`` is the lesson's own skill (validation.validate_lesson). Two forms are delivered and
    nothing else:
      PASS    every step PASS, automatedChecksPassed and renderingChecksPassed true, reviewFindings
              exactly [] (no note of any code, a DIDACTIC_REVIEW row included).
      REVIEW  a middle-school lesson only: every step PASS except one middle-build REVIEW that
              accepted_review accepts, automatedChecksPassed false, renderingChecksPassed true, and
              one or more reviewFindings rows, each a DIDACTIC_REVIEW row of middle-build alone that
              public_review_findings reads in full.
    Both also need status needs_review, the profile general-skill-source/v1, a manifest that names
    the lesson's own skill, an unverifiedAnswers list that is present and whose every row reads, no
    unverified answer when the lesson or the manifest names the elementary skill (D6), and exactly two
    artifacts, one PDF and one Word file. A review row that blocks (gate_policy.blocks: G61, G62,
    G50, PAGE_*, any truth or policy code), a G51 row whatever class it claims, an unknown code or a
    row of another step refuses the render: it is never dropped and the sheet delivered without it.
    """
    if not isinstance(manifest, dict):
        return None
    steps, artifacts, rows = manifest.get('steps'), manifest.get('artifacts'), manifest.get('reviewFindings')
    named = manifest['skill'].get('name') if isinstance(manifest.get('skill'), dict) else None
    unverified = unverified_rows(manifest['unverifiedAnswers']) if 'unverifiedAnswers' in manifest else None
    if not (manifest.get('status') == 'needs_review' and manifest.get('authoringProfile') == GENERAL_PROFILE
            and skill in ('elementary', 'middle') and named == skill
            and isinstance(steps, list) and bool(steps) and all(isinstance(s, dict) for s in steps)
            and isinstance(artifacts, list) and len(artifacts) == 2 and all(isinstance(a, dict) for a in artifacts)
            and {a.get('kind') for a in artifacts} == {'pdf', 'docx'}
            and unverified is not None and not (unverified and 'elementary' in (skill, named))
            and isinstance(rows, list)):
        return None
    if (manifest.get('automatedChecksPassed') is True and manifest.get('renderingChecksPassed') is True
            and all(s.get('status') == 'PASS' for s in steps) and rows == []):
        return 'PASS'
    reviewed = [i for i, s in enumerate(steps) if s.get('status') == 'REVIEW']
    if (skill == 'middle' and manifest.get('automatedChecksPassed') is False
            and manifest.get('renderingChecksPassed') is True and len(reviewed) == 1
            and accepted_review(steps, reviewed[0], skill)
            and all(s.get('status') == 'PASS' for i, s in enumerate(steps) if i != reviewed[0])
            and 0 < len(rows) <= 40
            and all(isinstance(r, dict) and r.get('code') == 'DIDACTIC_REVIEW' and r.get('steps') == ['middle-build']
                    for r in rows)
            and len(public_review_findings(rows)) == len(rows)):
        return 'REVIEW'
    return None


def structured_result(remote, job, manifest, artifact_root, structured):
    """Accept, upload and describe a worksheet-wire/5 render: the artifacts are exactly [pdf], the render passed
    every executed step, the manifest names the lesson's own skill, and every step passes accepted_step (PASS, or
    an approved middle-path SKIP: none while D22 is pending). REVIEW is never accepted. Only sheet.pdf is uploaded.
    The result carries counts, codes and step names only."""
    steps = manifest.get('steps')
    not_run = manifest.get('notRun') if isinstance(manifest.get('notRun'), list) else []
    artifacts = manifest.get('artifacts')
    skill = validate_lesson(job['lesson'], allow_legacy=False)['skill']
    rendered = manifest.get('status') == 'needs_review' and manifest.get('executedChecksPassed') is True
    executed = (isinstance(steps, list) and bool(steps) and all(accepted_step(s, skill, not_run) for s in steps))
    if not (rendered and executed and isinstance(manifest.get('skill'), dict)
            and manifest['skill'].get('name') == skill and isinstance(artifacts, list)
            and len(artifacts) == 1 and isinstance(artifacts[0], dict) and artifacts[0].get('kind') == 'pdf'
            and isinstance(artifacts[0].get('path'), str) and isinstance(artifacts[0].get('sha256'), str)):
        stage = 'render' if manifest.get('status') != 'needs_review' else 'acceptance'
        raise mark_failure(GenerationError('QUALITY_GATE_FAILED', 'A required output gate failed'), stage)
    item = artifacts[0]
    selection = structured.source.get('selection') if isinstance(structured.source.get('selection'), dict) else {}
    replaced = [{'slot': r['slot'], 'by': r['by'], 'codes': _safe_codes(r.get('codes'))}
                for r in (selection.get('replaced') or [])[:32]
                if isinstance(r, dict) and isinstance(r.get('slot'), str) and _SLOT.fullmatch(r['slot'])
                and isinstance(r.get('by'), str) and (r['by'] == 'REPAIR' or _SLOT.fullmatch(r['by']))]
    result = {'version': 1, 'automatedChecksPassed': manifest.get('automatedChecksPassed') is True,
              'humanReviewRequired': True, 'skill': manifest['skill'], 'artifacts': [],
              'checks': [{'name': s['name'], 'status': s['status']} for s in steps],
              'authoringProfile': 'general-skill-source/v1', 'authorContract': STRUCTURED_CONTRACT,
              'renderingChecksPassed': manifest.get('renderingChecksPassed') is True,
              'notRun': [name for name in not_run if isinstance(name, str)][:64],
              'questionsRequested': _bounded_int(selection.get('requested'), 99),
              'questionsDelivered': _bounded_int(selection.get('delivered'), 99), 'replaced': replaced}
    check_transport(remote)
    update_job(remote, job, {'phase': 'checking'})
    if (artifact_root/item['path']).is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
    path = (artifact_root/item['path']).resolve()
    if not path.is_relative_to(artifact_root) or path.is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
    blob = path.read_bytes()
    if not 0 < len(blob) <= ARTIFACT_LIMIT or hashlib.sha256(blob).hexdigest() != item['sha256']: raise RuntimeError('ARTIFACT_HASH_MISMATCH')
    remote.call('/storage/v1/object/'+BUCKET+'/'+job['owner_id']+'/'+job['id']+'/sheet.pdf', 'POST', raw=blob, mime='application/pdf')
    result['artifacts'] = [{'kind': 'pdf', 'sha256': item['sha256'], 'bytes': len(blob)}]
    return result


def process_job(remote, job, root, *, enable_skill_revision=ENABLE_SKILL_REVISION):
    if not all(isinstance(job.get(key), str) and UUID.fullmatch(job[key]) for key in ('owner_id','id')):
        raise RuntimeError('INVALID_JOB_ID')
    if job.get('status')!='running' or not UUID.fullmatch(str(job.get('lease_token',''))): raise RuntimeError('JOB_LEASE_LOST')
    try: expires=datetime.fromisoformat(job.get('lease_until','').replace('Z','+00:00'))
    except (ValueError,TypeError,AttributeError): raise RuntimeError('JOB_LEASE_LOST') from None
    if expires.tzinfo is None or expires<=utc(): raise RuntimeError('JOB_LEASE_LOST')
    lesson=job.get('lesson');cap=validate_lesson(lesson, allow_legacy=False)
    raw_target=root/job['id']
    if raw_target.is_symlink(): raise RuntimeError('JOB_PATH_DENIED')
    target=raw_target.resolve()
    if target.parent!=root or target.exists(): raise RuntimeError('JOB_PATH_DENIED')
    claimed=time.monotonic()
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
        manifest, artifact_root, structured = author_and_render(remote, job, target, lost, enable_skill_revision,
                                                                claimed_at=claimed, summary=summary)
        if structured is not None:
            # worksheet-wire/5: structured_result alone accepts the render (PDF only, D22, notRun); none of the
            # acceptance below applies to it.
            try:
                if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
                result = structured_result(remote, job, manifest, artifact_root, structured)
                if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
                stop.set();thread.join(timeout=3)
                update_job(remote,job,{'status':'needs_review','phase':'needs_review','result':result,'lease_token':None,'lease_until':None},
                           confirm='needs_review')
            except Exception as exc:
                raise mark_failure(exc, 'upload')
            return
        stage='acceptance'
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        artifacts=manifest.get('artifacts')
        # Every version 3 render is a general one (runner.render_job); it is accepted only by general_verdict.
        general=lesson.get('version')==3
        findings=[];unverified=[]
        if general:
            verdict=general_verdict(manifest,cap['skill'])
            passed=verdict is not None
            if passed:
                unverified=unverified_rows(manifest['unverifiedAnswers'])
                # Only a REVIEW carries notes: the DIDACTIC_REVIEW rows general_verdict read in full.
                findings=public_review_findings(manifest['reviewFindings']) if verdict=='REVIEW' else []
        else:
            steps=manifest.get('steps')
            named=manifest['skill'].get('name') if isinstance(manifest.get('skill'),dict) else None
            passed=(manifest.get('status')=='needs_review' and manifest.get('automatedChecksPassed') is True
                    and named==cap['skill'] and isinstance(steps,list) and bool(steps)
                    and all(isinstance(s,dict) and s.get('status')=='PASS' for s in steps)
                    and isinstance(artifacts,list) and len(artifacts)==2 and all(isinstance(a,dict) for a in artifacts)
                    and {a.get('kind') for a in artifacts}=={'pdf','docx'})
        if not passed:
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
            salvage=public_salvage(summary,lesson['questionCount'])
            if salvage and salvage['dropped']['count']:
                # A shorter sheet is delivered with its own note for the teacher.
                findings=findings+[{'code':'SHORTER_SHEET','count':salvage['dropped']['count'],'note':NOTES['SHORTER_SHEET']}]
            # Notes of the middle didactic REVIEW (the one finding that does not
            # block) and of the worker's own shorter sheet: fixed codes, counts,
            # question numbers and this engine's own Hebrew notes. No gate or
            # model text is forwarded.
            result.update(authoringProfile='general-skill-source/v1',renderingChecksPassed=True,
                          reviewFindings=findings,
                          # Which printed answers no exact kernel verified (middle school only):
                          # review answers and story-typed decisions, by question and item.
                          teacherNotes=public_teacher_notes(manifest['unverifiedAnswers']),
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
    allowed={'QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_BASE_URL','QWEN_MODEL','TEACHER_GENERATION_SERVICE_KEY','ELEMENTARY_SKILL_PATH','MIDDLE_SKILL_PATH','TEACHER_V5_TOPICS','TEACHER_V5_SITE_READY',
             # The author switch and the selected provider's own credential and model (provider.author_config).
             'TEACHER_AUTHOR_PROVIDER','GEMINI_API_KEY','GEMINI_MODEL'}
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
                    # worksheet-wire/5 failures add {stage, questions[, httpStatus]}: codes and slots, never text.
                    # Any other job: one line with where it failed: the stage, the question and the gate, when known.
                    detail=(safe_failure_detail(getattr(e,'failure_detail',None))
                            or getattr(e,'job_failure',None) or failure_detail(e,None))
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
