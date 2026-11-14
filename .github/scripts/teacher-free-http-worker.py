#!/usr/bin/env python3
"""CI-only readonly replacement at the fixed worker path. Never in a runtime image.

Loads the exact real module beside this mount, replacing ONLY its queue/storage
transport and model author with reviewed fixtures. The real main, readiness,
lease renewal, process_job, renderer, artifact verification and completion run.
Network isolation is enforced by Docker, not this Python mock.
"""
import fcntl
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from urllib.parse import parse_qs, urlsplit

APP = Path('/opt/noam/app')
ROOT = Path('/work/probe')
CONFIG = Path('/ci/config.json')
JOB = '11111111-1111-4111-8111-111111111111'
LEASE = '22222222-2222-4222-8222-222222222222'
SYNTHETIC = 'offline-synthetic-invalid-key'


def sha(data):
    return hashlib.sha256(data).hexdigest()


@contextmanager
def state():
    ROOT.mkdir(parents=True, exist_ok=True)
    with (ROOT / 'state.lock').open('a') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        path = ROOT / 'state.json'
        data = json.loads(path.read_text()) if path.exists() else {
            'claims': 0, 'claimedJobs': 0, 'heartbeats': 0, 'authorCalls': 0,
            'uploads': {}, 'cyclesStarted': 0, 'cyclesFinished': 0, 'checks': 0,
        }
        yield data
        temp = path.with_suffix('.tmp')
        temp.write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n')
        temp.replace(path)


def load_fixture(config):
    base = APP / 'cloud/container/fixtures'
    pins = json.loads((base / 'manifest.json').read_text())
    for name, entry in pins['files'].items():
        data = (base / name).read_bytes()
        if len(data) != entry['bytes'] or sha(data) != entry['sha256']:
            raise RuntimeError('FIXTURE_HASH_MISMATCH')
    folder = base / ('grade3-division' if config['case'] == 'chromium-fallback' else config['case'])
    return tuple(json.loads((folder / name).read_text()) for name in
                 ('lesson.json', 'author-parameters.json', 'canonical.json'))


def bind(real, lesson, raw, canonical):
    class FakeRemote:
        def __init__(self, key):
            if key != SYNTHETIC:
                raise RuntimeError('CI_SYNTHETIC_KEY_REQUIRED')

        def call(self, path, method='GET', value=None, raw=None, mime=None, prefer=None):
            with state() as s:
                if method == 'GET' and path == '/storage/v1/bucket/' + real.BUCKET:
                    return {'id': real.BUCKET, 'public': False, 'file_size_limit': real.ARTIFACT_LIMIT,
                            'allowed_mime_types': sorted(real.ARTIFACT_MIMES)}
                if method == 'GET' and path == '/rest/v1/noam_teacher_generation_jobs?select=id,owner_id,lesson,status,phase,result,error_code,lease_token,lease_until,updated_at&limit=0':
                    return []
                if method == 'POST' and path == '/rest/v1/rpc/claim_teacher_generation_job':
                    s['claims'] += 1
                    if s['claimedJobs']:
                        return []
                    s['claimedJobs'] = 1
                    s['job'] = {'id': JOB, 'owner_id': real.OWNER, 'lesson': lesson,
                                'status': 'running', 'phase': 'claimed', 'lease_token': LEASE,
                                'lease_until': (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat()}
                    return [dict(s['job'])]
                if method == 'POST' and path == '/rest/v1/noam_teacher_generation_workers?on_conflict=id':
                    if not s['claims'] or value['id'] != 'primary':
                        raise RuntimeError('HEARTBEAT_BEFORE_CLAIM')
                    s['heartbeats'] += 1
                    return None
                if method == 'PATCH' and path.startswith('/rest/v1/noam_teacher_generation_jobs?'):
                    q = parse_qs(urlsplit(path).query)
                    job = s.get('job', {})
                    if (q.get('id') != ['eq.' + JOB] or q.get('lease_token') != ['eq.' + LEASE]
                            or q.get('status') != ['eq.running'] or job.get('status') != 'running'
                            or job.get('lease_token') != LEASE or len(q.get('lease_until', [])) != 1
                            or not q['lease_until'][0].startswith('gt.')):
                        return []
                    cutoff = datetime.fromisoformat(q['lease_until'][0][3:].replace('Z', '+00:00'))
                    if datetime.fromisoformat(job['lease_until']) <= cutoff:
                        return []
                    if value.get('status') == 'needs_review':
                        result = value['result']
                        expected = sorted(s['uploads'].values(), key=lambda v: v['kind'])
                        if (result.get('automatedChecksPassed') is not True
                                or result.get('humanReviewRequired') is not True
                                or sorted(result['artifacts'], key=lambda v: v['kind']) != expected
                                or {v['kind'] for v in expected} != {'pdf', 'docx'}
                                or not result['checks'] or any(v['status'] != 'PASS' for v in result['checks'])):
                            raise RuntimeError('INVALID_COMPLETION')
                    job.update(value)
                    return [dict(job)]
                prefix = '/storage/v1/object/' + real.BUCKET + '/' + real.OWNER + '/' + JOB + '/sheet.'
                if method == 'POST' and path.startswith(prefix):
                    kind = path[len(prefix):]
                    expected_mime = {'pdf': 'application/pdf', 'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'}
                    if kind not in expected_mime or mime != expected_mime[kind] or kind in s['uploads']:
                        raise RuntimeError('UNEXPECTED_UPLOAD')
                    if not raw or not raw.startswith(b'%PDF-' if kind == 'pdf' else b'PK'):
                        raise RuntimeError('INVALID_UPLOAD')
                    folder = ROOT / 'uploads'; folder.mkdir(exist_ok=True)
                    (folder / ('sheet.' + kind)).write_bytes(raw)
                    s['uploads'][kind] = {'kind': kind, 'sha256': sha(raw), 'bytes': len(raw)}
                    return None
                raise RuntimeError('UNEXPECTED_REMOTE_OPERATION')

    def fixture_author(request, metadata=None):
        from provider import derive_author_parameters
        from validation import validate_lesson, validate_model
        from author_quality import prepare_didactics
        if request != lesson:
            raise RuntimeError('LESSON_CHANGED')
        derived = derive_author_parameters(request, validate_lesson(request, allow_legacy=False), raw)
        if derived != canonical:
            raise RuntimeError('CANONICAL_FIXTURE_CHANGED')
        validate_model(request, derived)
        prepare_didactics(request, derived, validate_lesson(request))
        with state() as s:
            s['authorCalls'] += 1
            if s['authorCalls'] != 1:
                raise RuntimeError('AUTHOR_RETRY_DENIED')
        if metadata is not None:
            metadata.update({'validated': True, 'responseReceived': True})
        return derived

    real.Remote = FakeRemote
    real.author_lesson = fixture_author


def chromium(real):
    """Extra conservative fallback stage after the complete real worker path."""
    skill = Path(os.environ['ELEMENTARY_SKILL_PATH'])
    out = ROOT / 'chromium'
    shutil.copytree(Path('/work/jobs') / JOB, out)
    (out / 'manifest.json').unlink()
    pdf = out / 'sheet.pdf'; pdf.unlink()
    spec = importlib.util.spec_from_file_location('locked_pdf_builder', skill / 'scripts/build_pdf.py')
    builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
    if not builder.build_with_chromium(out / 'sheet.html', pdf):
        raise RuntimeError('CHROMIUM_RENDER_FAILED')
    commands = [
        [skill / 'scripts/check_worksheet.py', pdf, out / 'preview-chromium', '--band', 'elementary'],
        [APP / 'output_gates.py', '--skill', skill, '--pdf', pdf, '--band', 'elementary'],
        [skill / 'scripts/lib/house_gates.py', '--html', out / 'sheet.html', '--pdf', pdf,
         '--gen', APP / 'adapters.py', '--content', out / 'content.json', '--figdir', out / 'figures',
         '--grade', 'ג', '--level', 'ב', '--docx', out / 'sheet.docx'],
    ]
    for index, command in enumerate(commands):
        cp = subprocess.run([sys.executable, '-B', *map(str, command)], cwd=out,
                            capture_output=True, text=True, timeout=240)
        (out / ('gate-' + str(index) + '.txt')).write_text(cp.stdout + '\n' + cp.stderr)
        if cp.returncode:
            raise RuntimeError('CHROMIUM_GATE_FAILED')
    return {'passed': True, 'sha256': sha(pdf.read_bytes()), 'bytes': pdf.stat().st_size}


def main():
    started = time.monotonic()
    config = json.loads(CONFIG.read_text())
    source = APP / 'remote_worker.real.py'
    if sha(source.read_bytes()) != config['workerSha256']:
        raise RuntimeError('REAL_WORKER_SOURCE_CHANGED')
    if (os.environ.get('QWEN_API_KEY') != SYNTHETIC
            or os.environ.get('TEACHER_GENERATION_SERVICE_KEY') != SYNTHETIC
            or os.environ.get('DASHSCOPE_API_KEY') or os.environ.get('WORKER_WAKE_SECRET')):
        raise RuntimeError('CI_CREDENTIAL_BOUNDARY_FAILED')
    sys.path.insert(0, str(APP))
    spec = importlib.util.spec_from_file_location('real_remote_worker', source)
    real = importlib.util.module_from_spec(spec); spec.loader.exec_module(real)
    bind(real, *load_fixture(config))
    check = sys.argv[1:] == ['--check-only']
    if not check and sys.argv[1:] != ['--once', '--work-dir', '/work/jobs']:
        raise RuntimeError('UNEXPECTED_FIXED_CHILD_ARGUMENTS')
    with state() as s:
        s['checks' if check else 'cyclesStarted'] += 1
    ok = False; fallback = None
    try:
        real.main()
        with state() as s:
            status = s.get('job', {}).get('status')
        if not check and status != 'needs_review':
            raise RuntimeError('WORKER_DID_NOT_COMPLETE')
        if not check and config['case'] == 'chromium-fallback' and not (ROOT / 'chromium').exists():
            fallback = chromium(real)
        ok = True
    finally:
        if not check:
            with state() as s:
                s['cyclesFinished'] += 1
                s['cyclePassed'] = ok
                elapsed = round(time.monotonic() - started, 3)
                s['lastCycleSeconds'] = elapsed
                s.setdefault('firstJobWorkerSeconds', elapsed)
                durations = s.setdefault('cycleDurations', [])
                if len(durations) < 13: durations.append(elapsed)
                if fallback: s['chromium'] = fallback


if __name__ == '__main__':
    main()
