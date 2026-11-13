"""Owner-only private job worker. No inbound listener; no automatic paid retries.

Run only from a reviewed checkout with pinned skills and operator-supplied
environment. Secrets are not accepted in job JSON, forwarded to child renders,
logged, or copied to job artifacts. A process exit does not install a daemon.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import os
import re
import ssl
import certifi
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, build_opener, HTTPRedirectHandler, HTTPSHandler
from urllib.error import HTTPError
from provider import author_lesson, safe_usage
from runner import render_job
from validation import GenerationError, capabilities, validate_lesson
from preflight import check as check_readiness

ORIGIN = 'https://ouzquolkeuceektfihss.supabase.co'
OWNER = '80da2957-9492-4a9d-babb-28ba70dedd12'
BUCKET = 'teacher-generation-private'
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
                {'id':'primary','updated_at':utc().isoformat(),'capabilities':{**capabilities(), 'acceptedIntakeVersions':[2]}},prefer='resolution=merge-duplicates')

def update_job(remote, job, values):
    for key in ('id','lease_token'):
        if not UUID.fullmatch(str(job.get(key,''))): raise RuntimeError('INVALID_JOB_ID')
    values={**values,'updated_at':utc().isoformat()}
    rows=remote.call('/rest/v1/noam_teacher_generation_jobs?id=eq.'+job['id']+'&lease_token=eq.'+job['lease_token']+'&status=eq.running&lease_until=gt.'+utc().isoformat().replace('+00:00','Z'),
                     'PATCH',values,prefer='return=representation')
    if not isinstance(rows,list) or len(rows)!=1: raise RuntimeError('JOB_LEASE_LOST')

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
        for key in ('responseReceived', 'validated'):
            if type(metadata.get(key)) is bool: record[key] = metadata[key]
        for key in ('requestedModel', 'responseModel'):
            value = metadata.get(key)
            if isinstance(value, str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,127}', value): record[key] = value
        elapsed = metadata.get('elapsedSeconds')
        if type(elapsed) in (int, float) and 0 <= elapsed <= 86400: record['elapsedSeconds'] = round(elapsed, 3)
        record['usage'] = safe_usage(metadata.get('usage'))
        if metadata.get('authorContract') in ('worksheet-parameters/2', 'worksheet-parameters/3'):
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


def process_job(remote, job, root):
    if job.get('owner_id')!=OWNER or not UUID.fullmatch(str(job.get('id',''))): raise RuntimeError('JOB_OWNER_DENIED')
    if job.get('status')!='running' or not UUID.fullmatch(str(job.get('lease_token',''))): raise RuntimeError('JOB_LEASE_LOST')
    try: expires=datetime.fromisoformat(job.get('lease_until','').replace('Z','+00:00'))
    except (ValueError,TypeError,AttributeError): raise RuntimeError('JOB_LEASE_LOST') from None
    if expires.tzinfo is None or expires<=utc(): raise RuntimeError('JOB_LEASE_LOST')
    lesson=job.get('lesson');validate_lesson(lesson, allow_legacy=False)
    raw_target=root/job['id']
    if raw_target.is_symlink(): raise RuntimeError('JOB_PATH_DENIED')
    target=raw_target.resolve()
    if target.parent!=root or target.exists(): raise RuntimeError('JOB_PATH_DENIED')
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
        # One model invocation per claimed job. Failures require a new owner request.
        metadata = {}; author_failure = None
        try:
            payload=author_lesson(lesson, metadata=metadata)
        except Exception as exc:
            author_failure = exc
            raise
        finally:
            if not save_author_diagnostics(root, job['id'], metadata, author_failure):
                print(json.dumps({'event':'author_diagnostics_unavailable','jobId':job['id']}),flush=True)
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        update_job(remote,job,{'phase':'rendering'})
        manifest=render_job(lesson,payload,target)
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        artifacts=manifest.get('artifacts',[])
        passed=manifest.get('status')=='needs_review' and manifest.get('automatedChecksPassed') is True
        passed=passed and bool(manifest.get('steps')) and all(s.get('status')=='PASS' for s in manifest['steps'])
        if not passed or {a.get('kind') for a in artifacts}!={'pdf','docx'} or len(artifacts)!=2:
            raise GenerationError('QUALITY_GATE_FAILED','A required output gate failed')
        check_transport(remote)
        published=[]
        for item in artifacts:
            if (target/item['path']).is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            path=(target/item['path']).resolve()
            if not path.is_relative_to(target) or path.is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            blob=path.read_bytes()
            if not 0<len(blob)<=ARTIFACT_LIMIT or hashlib.sha256(blob).hexdigest()!=item['sha256']: raise RuntimeError('ARTIFACT_HASH_MISMATCH')
            mime='application/pdf' if item['kind']=='pdf' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
            remote.call('/storage/v1/object/'+BUCKET+'/'+OWNER+'/'+job['id']+'/sheet.'+item['kind'],'POST',raw=blob,mime=mime)
            published.append({'kind':item['kind'],'sha256':item['sha256'],'bytes':len(blob)})
        # Paths/logs/model source stay on the private worker; browser gets only
        # bounded provenance and the exact two artifacts, never public URLs.
        result={'version':1,'automatedChecksPassed':True,'humanReviewRequired':True,'skill':manifest['skill'],
                'artifacts':published,'checks':[{'name':s['name'],'status':s['status']} for s in manifest['steps']]}
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        stop.set();thread.join(timeout=3)
        update_job(remote,job,{'status':'needs_review','phase':'needs_review','result':result,'lease_token':None,'lease_until':None})
    finally: stop.set();thread.join(timeout=3)

def load_env(path):
    allowed={'QWEN_API_KEY','DASHSCOPE_API_KEY','QWEN_BASE_URL','QWEN_MODEL','TEACHER_GENERATION_SERVICE_KEY','ELEMENTARY_SKILL_PATH','MIDDLE_SKILL_PATH'}
    for line in Path(path).read_text().splitlines():
        if not line.strip() or line.lstrip().startswith('#') or '=' not in line:continue
        key,value=line.split('=',1);key=key.strip()
        if key not in allowed:continue
        value=value.strip()
        if len(value)>1 and value[0]==value[-1] and value[0] in ('"',"'"):value=value[1:-1]
        os.environ[key]=value

def main():
    p=argparse.ArgumentParser();p.add_argument('--env-file',action='append',default=[]);p.add_argument('--work-dir');p.add_argument('--once',action='store_true')
    p.add_argument('--check-only',action='store_true',help='Check local runtime and remote schema/private bucket without claim, heartbeat, uploads or model calls')
    args=p.parse_args()
    if not args.check_only and not args.work_dir:p.error('--work-dir is required unless --check-only')
    for path in args.env_file:load_env(path)
    if not check_readiness(require_provider=True)['ready']:
        print(json.dumps({'event':'worker_not_ready'}),flush=True)
        raise SystemExit(1)
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
    while True:
        try:
            check_transport(remote)
            rows=remote.call('/rest/v1/rpc/claim_teacher_generation_job','POST',{})
            if not isinstance(rows,list) or len(rows)>1 or (rows and not isinstance(rows[0],dict)):
                raise RuntimeError('QUEUE_NOT_READY')
            # A recurring claim failure must never keep the UI "online".
            # Existing heartbeats expire after 90 seconds on the website.
            heartbeat(remote)
            if rows:
                job=rows[0]
                try:process_job(remote,job,root)
                except Exception as e:
                    code=e.code if isinstance(e,GenerationError) else 'WORKER_FAILED'
                    if not re.fullmatch('[A-Z_]{1,60}',code):code='WORKER_FAILED'
                    try:update_job(remote,job,{'status':'failed','phase':'failed','error_code':code,'lease_token':None,'lease_until':None})
                    except Exception:pass
                    print(json.dumps({'event':'generation_failed','jobId':job.get('id'),'code':code}),flush=True)
                else:print(json.dumps({'event':'generation_needs_review','jobId':job['id']}),flush=True)
            if args.once:return
        except Exception:
            print(json.dumps({'event':'worker_unavailable'}),flush=True)
            if args.once:raise SystemExit(1)
        time.sleep(5)

if __name__=='__main__':main()
