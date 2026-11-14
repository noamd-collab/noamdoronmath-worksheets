#!/usr/bin/env python3
"""CI-only loopback HTTP exercise. Runs inside network-none resource cgroup."""
import json
from pathlib import Path
import sys
import threading
import time
from urllib.error import HTTPError
from urllib.request import Request, urlopen

ROOT = Path('/work/probe')
KEY = 'a' * 64  # Deliberately public synthetic CI value; never a service key.
BUDGET = 1000


def request(path, *, authenticated=False):
    headers = {'Authorization': 'Bearer ' + KEY} if authenticated else {}
    req = Request('http://127.0.0.1:10000' + path,
                  data=b'' if path != '/healthz' else None, headers=headers)
    started = time.monotonic()
    try:
        response = urlopen(req, timeout=5)
    except HTTPError as e:
        response = e
    with response:
        data = response.read(4097)
        if len(data) > 4096: raise RuntimeError('HTTP_RESPONSE_TOO_LARGE')
        return response.status, json.loads(data), time.monotonic() - started


def main():
    ROOT.mkdir(exist_ok=True)
    started = time.monotonic()
    report = {'passed': False, 'modelCalls': 0, 'liveQueueTouched': False,
              'health': [], 'stages': {}, 'coldPlatformStartMeasured': False}
    stop = threading.Event(); sampler = None
    def sample():
        while not stop.is_set():
            try:
                status, body, elapsed = request('/healthz')
                phase = 'startup'
                if (ROOT / 'state.json').exists():
                    phase = json.loads((ROOT / 'state.json').read_text()).get('job', {}).get('phase', 'preflight')
                report['health'].append({'status': status, 'ok': body == {'ok': True},
                                         'seconds': round(elapsed, 4), 'phase': phase})
            except Exception as e:
                report['health'].append({'status': 0, 'errorType': type(e).__name__})
            stop.wait(1)
    try:
        # Startup is measured separately; never invoke preflight/wake to make health pass.
        deadline = started + 90
        while True:
            try:
                if request('/healthz')[0] == 200: break
            except Exception: pass
            if time.monotonic() >= deadline: raise RuntimeError('HTTP_STARTUP_TIMEOUT')
            time.sleep(.2)
        report['stages']['healthReadySeconds'] = round(time.monotonic() - started, 3)
        if (ROOT / 'state.json').exists(): raise RuntimeError('HEALTH_STARTED_WORK')
        if request('/wake')[0] != 401: raise RuntimeError('UNAUTHORIZED_WAKE_ACCEPTED')
        if (ROOT / 'state.json').exists(): raise RuntimeError('UNAUTHORIZED_WAKE_STARTED_WORK')
        sampler = threading.Thread(target=sample, daemon=True); sampler.start()
        before = time.monotonic()
        code, body, _ = request('/preflight', authenticated=True)
        if code != 202: raise RuntimeError('PREFLIGHT_NOT_ASYNC')
        while True:
            time.sleep(1)
            code, body, _ = request('/preflight', authenticated=True)
            if code == 200 and body == {'ok': True, 'state': 'ready'}: break
            if code != 202 or time.monotonic() - before > 115: raise RuntimeError('PREFLIGHT_FAILED')
        report['stages']['preflightSeconds'] = round(time.monotonic() - before, 3)
        s = json.loads((ROOT / 'state.json').read_text())
        if any(s[k] for k in ('claims', 'heartbeats', 'authorCalls', 'cyclesStarted')):
            raise RuntimeError('PREFLIGHT_STARTED_JOB')
        before = time.monotonic()
        code, body, _ = request('/wake', authenticated=True)
        if code != 202: raise RuntimeError('WAKE_NOT_ACCEPTED')
        while True:
            time.sleep(1)
            s = json.loads((ROOT / 'state.json').read_text())
            if s.get('job', {}).get('status') == 'failed': raise RuntimeError('WORKER_JOB_FAILED')
            if s.get('cyclePassed') is False: raise RuntimeError('WORKER_CYCLE_FAILED')
            if (time.monotonic() - before >= 65 and s['cyclesStarted'] >= 1
                    and s['cyclesStarted'] == s['cyclesFinished']): break
            if time.monotonic() - started > BUDGET: raise RuntimeError('WORKER_TIMEOUT')
        report['stages']['wakeToSettledSeconds'] = round(time.monotonic() - before, 3)
        if (s['claimedJobs'] != 1 or s['authorCalls'] != 1 or s['heartbeats'] < 1
                or s.get('job', {}).get('status') != 'needs_review' or set(s['uploads']) != {'pdf', 'docx'}):
            raise RuntimeError('WORKER_EVIDENCE_INCOMPLETE')
        config = json.loads(Path('/ci/config.json').read_text())
        if config['case'] == 'chromium-fallback' and not s.get('chromium', {}).get('passed'):
            raise RuntimeError('CHROMIUM_NOT_QUALIFIED')
        report['state'] = s
        report['passed'] = True
    except Exception as e:
        report['failureType'] = type(e).__name__
        report['failureCode'] = str(e) if isinstance(e, RuntimeError) else 'HTTP_QUALIFICATION_FAILED'
    finally:
        stop.set()
        if sampler: sampler.join(timeout=6)
        report['elapsedSeconds'] = round(time.monotonic() - started, 3)
        report['healthPassed'] = bool(report['health']) and all(s.get('status') == 200 and s.get('ok') is True
                                                    and s.get('seconds', 6) < 5 for s in report['health'])
        report['renderingHealthSamples'] = sum(s.get('phase') == 'rendering' for s in report['health'])
        report['passed'] = report['passed'] and report['healthPassed'] and report['renderingHealthSamples'] > 0
        (ROOT / 'http-result.json').write_text(json.dumps(report, indent=2) + '\n')
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    sys.exit(main())
