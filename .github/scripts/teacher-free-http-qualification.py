#!/usr/bin/env python3
"""Offline HTTP + renderer resource qualification; not a Render deployment.

Four cases run sequentially. Server entrypoint and child path are unchanged.
Only readonly CI mounts substitute the external queue/model, never a production
environment flag. Docker network-none and synthetic values exclude live I/O.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import time

CASES = ('grade3-division', 'grade7-positive', 'grade7-signed', 'chromium-fallback')
MEMORY = 512 * 1024 * 1024
BUDGET = 1050  # Includes <=110s preflight and the adapter's <=780s worker bound.
CGROUP_FILES = ('memory.current', 'memory.peak', 'memory.max', 'memory.swap.max', 'memory.events', 'cpu.max', 'cpu.stat')
SYNTHETIC = 'offline-synthetic-invalid-key'
ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = Path(__file__).resolve().parent


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def metrics(root):
    result = {}
    for name in CGROUP_FILES:
        try:
            value = (root / name).read_text().strip()
            if name in ('memory.events', 'cpu.stat'):
                result[name] = {key: int(number) for key, number in (line.split() for line in value.splitlines())}
            else:
                result[name] = value if name == 'cpu.max' or value == 'max' else int(value)
        except (OSError, ValueError):
            result[name] = None
    return result


def limits_match(sample):
    quota = str(sample.get('cpu.max', '')).split()
    return (sample.get('memory.max') == MEMORY and sample.get('memory.swap.max') == 0
            and len(quota) == 2 and all(v.isdigit() for v in quota)
            and int(quota[1]) > 0 and int(quota[0]) * 10 == int(quota[1]))


def successful(summary, sample, state):
    events = sample.get('memory.events') or {}
    cpu = sample.get('cpu.stat') or {}
    return (summary.get('passed') is True and summary.get('healthPassed') is True
            and 0 < summary.get('elapsedSeconds', BUDGET + 1) <= BUDGET
            and limits_match(sample) and isinstance(sample.get('memory.peak'), int)
            and 0 < sample['memory.peak'] <= MEMORY
            and all(events.get(k) == 0 for k in ('oom', 'oom_kill', 'oom_group_kill'))
            and isinstance(cpu.get('usage_usec'), int) and cpu['usage_usec'] > 0
            and state.get('OOMKilled') is False and state.get('Running') is True)


def create_arguments(image, case, config, worker):
    mounts = ((worker, '/opt/noam/app/remote_worker.real.py'),
              (SCRIPTS / 'teacher-free-http-worker.py', '/opt/noam/app/remote_worker.py'),
              (SCRIPTS / 'teacher-free-http-client.py', '/ci/client.py'),
              (config, '/ci/config.json'))
    args = ['create', '--network', 'none', '--memory', '512m', '--memory-swap', '512m',
            '--cpus', '0.1', '--shm-size', '64m', '--env', 'PORT=10000',
            '--env', 'TEACHER_FREE_WORKER_ENABLED=true', '--env', 'WORKER_WAKE_SECRET=' + 'a' * 64,
            '--env', 'QWEN_API_KEY=' + SYNTHETIC, '--env', 'TEACHER_GENERATION_SERVICE_KEY=' + SYNTHETIC,
            '--env', 'QWEN_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
            '--env', 'QWEN_MODEL=offline-fixture']
    for src, dst in mounts:
        args += ['--mount', 'type=bind,src=' + str(src.resolve()) + ',dst=' + dst + ',readonly']
    return args + [image]


def host(image, source, out):
    if not re.fullmatch(r'[a-f0-9]{40}', source): raise ValueError('EXACT_SOURCE_SHA_REQUIRED')
    out.mkdir(parents=True, exist_ok=False)
    def docker(*args, check=True):
        cp = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=40)
        if check and cp.returncode: raise RuntimeError('DOCKER_' + args[0].upper() + '_FAILED')
        return cp.stdout
    info = json.loads(docker('image', 'inspect', image))[0]
    if info['Config'].get('Labels', {}).get('org.opencontainers.image.revision') != source:
        raise RuntimeError('IMAGE_SOURCE_LABEL_MISMATCH')
    expected_entry = ['/usr/bin/tini', '-g', '--', '/usr/local/bin/python', '-B', '/opt/noam/app/cloud/render/http_supervisor.py']
    if info['Config']['Entrypoint'] != expected_entry or info['Config']['User'] != '10001:10001':
        raise RuntimeError('IMAGE_ENTRYPOINT_CHANGED')
    worker = ROOT / 'tools/teacher-generation/remote_worker.py'
    supervisor = ROOT / 'tools/teacher-generation/cloud/render/http_supervisor.py'
    # Compare the unmounted image bytes, not just its source label.
    inspect_id = docker('create', image).strip()
    try:
        for src, dest in ((worker, '/opt/noam/app/remote_worker.py'), (supervisor, '/opt/noam/app/cloud/render/http_supervisor.py')):
            target = out / ('image-' + src.name)
            docker('cp', inspect_id + ':' + dest, str(target))
            if digest(target) != digest(src): raise RuntimeError('IMAGE_RUNTIME_BYTES_CHANGED')
    finally:
        docker('rm', '-f', inspect_id, check=False)
    reports = {}
    for case in CASES:
        folder = out / case; folder.mkdir()
        config = folder / 'config.json'
        config.write_text(json.dumps({'case': case, 'workerSha256': digest(worker)}) + '\n')
        config.chmod(0o644)
        cid = docker(*create_arguments(image, case, config, worker)).strip()
        client = None; logfile = None
        started = time.monotonic(); sample = {}; samples = []
        try:
            docker('start', cid)
            inspection = json.loads(docker('inspect', cid))[0]
            if inspection['HostConfig']['NetworkMode'] != 'none' or any(m['RW'] for m in inspection['Mounts']):
                raise RuntimeError('ISOLATION_MISMATCH')
            pid = inspection['State']['Pid']
            cg = [s[3:] for s in Path('/proc/' + str(pid) + '/cgroup').read_text().splitlines() if s.startswith('0::')]
            if len(cg) != 1: raise RuntimeError('CGROUP_V2_REQUIRED')
            cgroup = Path('/sys/fs/cgroup') / cg[0].lstrip('/')
            sample = metrics(cgroup)
            if not limits_match(sample): raise RuntimeError('RESOURCE_LIMITS_NOT_ENFORCED')
            logfile = (folder / 'client.log').open('w')
            client = subprocess.Popen(['docker', 'exec', cid, '/usr/local/bin/python', '-B', '/ci/client.py'],
                                      stdin=subprocess.DEVNULL, stdout=logfile, stderr=subprocess.STDOUT)
            timed_out = False
            while client.poll() is None:
                current = metrics(cgroup)
                if current.get('memory.peak') is not None: sample = current
                samples.append({'seconds': round(time.monotonic() - started, 3), **current})
                if time.monotonic() - started > BUDGET:
                    timed_out = True; break
                time.sleep(1)
            current = metrics(cgroup)
            if current.get('memory.peak') is not None: sample = current
            status = json.loads(docker('inspect', cid))[0]['State']
            # Keep the real server alive until this final authoritative cgroup read.
            docker('cp', cid + ':/work/probe', str(folder / 'probe'), check=False)
            docker('cp', cid + ':/work/jobs', str(folder / 'jobs'), check=False)
            result_path = folder / 'probe/http-result.json'
            summary = json.loads(result_path.read_text()) if result_path.exists() else {
                'passed': False, 'failureType': 'WALL_BUDGET_EXCEEDED' if timed_out else 'CLIENT_FAILED'}
            record = {'case': case, 'summary': summary, 'cgroup': sample, 'dockerState': status,
                      'clientExitCode': client.poll(), 'wallSeconds': round(time.monotonic() - started, 3),
                      'passed': not timed_out and client.poll() == 0 and successful(summary, sample, status)}
            (folder / 'cgroup-samples.json').write_text(json.dumps(samples, indent=2) + '\n')
            reports[case] = record
        except Exception as exc:
            reports[case] = {'case': case, 'passed': False, 'failureType': type(exc).__name__,
                             'failureCode': str(exc) if isinstance(exc, RuntimeError) else 'HARNESS_FAILED', 'cgroup': sample}
        finally:
            (folder / 'server.log').write_text(docker('logs', cid, check=False))
            docker('stop', '--time', '37', cid, check=False)
            if client and client.poll() is None:
                client.terminate()
                try: client.wait(timeout=5)
                except subprocess.TimeoutExpired: client.kill(); client.wait(timeout=5)
            if logfile: logfile.close()
            docker('rm', '-f', cid, check=False)
        (folder / 'result.json').write_text(json.dumps(reports[case], indent=2) + '\n')
        print(json.dumps({'case': case, 'passed': reports[case]['passed'],
                          'memoryPeakBytes': sample.get('memory.peak')}), flush=True)
        if not reports[case]['passed']: break  # Fail fast; preserve actual evidence, no retries.
    result = {'sourceSha': source, 'imageId': info['Id'],
              'passed': len(reports) == len(CASES) and all(r['passed'] for r in reports.values()),
              'cases': reports, 'modelCalls': 0, 'liveQueueTouched': False, 'network': 'none',
              'caseExecution': 'sequential', 'budgetSecondsPerCase': BUDGET,
              'runtimeHashes': {'worker': digest(worker), 'supervisor': digest(supervisor)},
              'ciHarnessHashes': {p.name: digest(p) for p in (Path(__file__), SCRIPTS / 'teacher-free-http-worker.py', SCRIPTS / 'teacher-free-http-client.py')},
              'limitations': ['Local Docker HTTP only; no Render platform cold start, TLS, provider latency or live queue measured.',
                              'Synthetic manual fixtures, not generated by a live model. Readonly mounts replace only transport and author.',
                              'Cases run sequentially on one CI host; Docker layers and host page cache may be warm.',
                              'Chromium case includes the full native worker path and an additional conservative fallback render/gates.',
                              'Automatic output gates do not replace all-page human PDF/Word review.']}
    (out / 'qualification.json').write_text(json.dumps(result, indent=2) + '\n')
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--image', required=True); parser.add_argument('--source', required=True)
    parser.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    raise SystemExit(host(args.image, args.source, args.out))
