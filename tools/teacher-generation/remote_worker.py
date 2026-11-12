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
from provider import author_lesson
from runner import render_job
from validation import GenerationError, capabilities, validate_lesson
from preflight import check as check_readiness

ORIGIN = 'https://ouzquolkeuceektfihss.supabase.co'
OWNER = '80da2957-9492-4a9d-babb-28ba70dedd12'
BUCKET = 'teacher-generation-private'
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
def heartbeat(remote):
    remote.call('/rest/v1/noam_teacher_generation_workers?on_conflict=id','POST',
                {'id':'primary','updated_at':utc().isoformat(),'capabilities':capabilities()},prefer='resolution=merge-duplicates')

def update_job(remote, job, values):
    for key in ('id','lease_token'):
        if not UUID.fullmatch(str(job.get(key,''))): raise RuntimeError('INVALID_JOB_ID')
    values={**values,'updated_at':utc().isoformat()}
    rows=remote.call('/rest/v1/noam_teacher_generation_jobs?id=eq.'+job['id']+'&lease_token=eq.'+job['lease_token']+'&status=eq.running&lease_until=gt.'+utc().isoformat().replace('+00:00','Z'),
                     'PATCH',values,prefer='return=representation')
    if not isinstance(rows,list) or len(rows)!=1: raise RuntimeError('JOB_LEASE_LOST')

def process_job(remote, job, root):
    if job.get('owner_id')!=OWNER or not UUID.fullmatch(str(job.get('id',''))): raise RuntimeError('JOB_OWNER_DENIED')
    if job.get('status')!='running' or not UUID.fullmatch(str(job.get('lease_token',''))): raise RuntimeError('JOB_LEASE_LOST')
    try: expires=datetime.fromisoformat(job.get('lease_until','').replace('Z','+00:00'))
    except (ValueError,TypeError,AttributeError): raise RuntimeError('JOB_LEASE_LOST') from None
    if expires.tzinfo is None or expires<=utc(): raise RuntimeError('JOB_LEASE_LOST')
    lesson=job.get('lesson');validate_lesson(lesson)
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
                heartbeat(remote)
                update_job(remote,job,{'lease_until':(utc()+timedelta(minutes=20)).isoformat()})
            except Exception:
                lost.set();return
    thread=threading.Thread(target=renew,daemon=True);thread.start()
    try:
        # One model invocation per claimed job. Failures require a new owner request.
        payload=author_lesson(lesson)
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        update_job(remote,job,{'phase':'rendering'})
        manifest=render_job(lesson,payload,target)
        if lost.is_set(): raise RuntimeError('JOB_LEASE_LOST')
        artifacts=manifest.get('artifacts',[])
        passed=manifest.get('status')=='needs_review' and manifest.get('automatedChecksPassed') is True
        passed=passed and bool(manifest.get('steps')) and all(s.get('status')=='PASS' for s in manifest['steps'])
        if not passed or {a.get('kind') for a in artifacts}!={'pdf','docx'} or len(artifacts)!=2:
            raise GenerationError('QUALITY_GATE_FAILED','A required output gate failed')
        published=[]
        for item in artifacts:
            if (target/item['path']).is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            path=(target/item['path']).resolve()
            if not path.is_relative_to(target) or path.is_symlink(): raise RuntimeError('ARTIFACT_PATH_DENIED')
            blob=path.read_bytes()
            if not 0<len(blob)<=15728640 or hashlib.sha256(blob).hexdigest()!=item['sha256']: raise RuntimeError('ARTIFACT_HASH_MISMATCH')
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
    p=argparse.ArgumentParser();p.add_argument('--env-file',action='append',default=[]);p.add_argument('--work-dir',required=True);p.add_argument('--once',action='store_true')
    args=p.parse_args()
    for path in args.env_file:load_env(path)
    if not check_readiness(require_provider=True)['ready']:
        print(json.dumps({'event':'worker_not_ready'}),flush=True)
        raise SystemExit(1)
    root=Path(args.work_dir).resolve();root.mkdir(parents=True,exist_ok=True);root.chmod(0o700)
    remote=Remote(os.environ.get('TEACHER_GENERATION_SERVICE_KEY'))
    while True:
        try:
            heartbeat(remote)
            rows=remote.call('/rest/v1/rpc/claim_teacher_generation_job','POST',{})
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
