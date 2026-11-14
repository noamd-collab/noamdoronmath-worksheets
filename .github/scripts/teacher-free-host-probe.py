#!/usr/bin/env python3
"""Offline resource qualification, never a provider deployment or paid job."""
import argparse
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import traceback

BASE_SOURCE = 'bc10e1cafca7eac106fec173db4b2b0c05dc1216'
CASES = ('grade3-division', 'grade7-positive', 'grade7-signed', 'chromium-fallback')
BUDGET = 1200
MEMORY = 512 * 1024 * 1024
CGROUP_FILES = ('memory.current', 'memory.peak', 'memory.max', 'memory.swap.max', 'memory.events', 'cpu.max', 'cpu.stat')


def metrics(root):
    result = {}
    for name in CGROUP_FILES:
        try:
            text = (root / name).read_text().strip()
            if name in ('memory.events', 'cpu.stat'):
                result[name] = {key: int(value) for key, value in (line.split() for line in text.splitlines())}
            else:
                result[name] = text if name == 'cpu.max' or text == 'max' else int(text)
        except (OSError, ValueError):
            result[name] = None
    return result


def limits_match(sample):
    quota = str(sample.get('cpu.max', '')).split()
    return (sample.get('memory.max') == MEMORY and sample.get('memory.swap.max') == 0
            and len(quota) == 2 and quota[0].isdigit() and quota[1].isdigit()
            and int(quota[1]) > 0 and int(quota[0]) * 10 == int(quota[1]))


def successful(summary, sample, state):
    events = sample.get('memory.events') or {}
    return (summary.get('ok') is True and 0 < summary.get('elapsedSeconds', BUDGET + 1) <= BUDGET
            and limits_match(sample) and sample.get('memory.peak') is not None
            and sample['memory.peak'] <= MEMORY and events.get('oom_kill', 0) == 0
            and state.get('OOMKilled') is False and state.get('Running') is True)


def inside(case):
    """Same locked fixture pipeline, with no model authoring and no new retries."""
    started = time.monotonic()
    out = Path('/work/probe'); out.mkdir()
    report = {'case': case, 'ok': False, 'modelCalls': 0, 'queueTouched': False, 'stages': []}
    def stage(name, fn):
        before = time.monotonic()
        try: return fn()
        finally:
            report['stages'].append({'name': name, 'elapsedSeconds': round(time.monotonic() - before, 3),
                                     'cgroup': metrics(Path('/sys/fs/cgroup'))})
    try:
        if any(os.environ.get(k) for k in ('QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'TEACHER_GENERATION_SERVICE_KEY')):
            raise RuntimeError('OFFLINE_CREDENTIALS_DENIED')
        sys.path.insert(0, '/opt/noam/app')
        sys.path.insert(0, '/opt/noam/app/cloud/container')
        import offline_smoke as frozen
        stage('native-preflight', frozen.native_preflight)
        pins = json.loads((frozen.HERE / 'fixtures/manifest.json').read_text())
        for name, entry in pins['files'].items():
            data = (frozen.HERE / 'fixtures' / name).read_bytes()
            if len(data) != entry['bytes'] or hashlib.sha256(data).hexdigest() != entry['sha256']:
                raise RuntimeError('FIXTURE_HASH_MISMATCH')
        chosen = 'grade3-division' if case == 'chromium-fallback' else case
        fixture = frozen.HERE / 'fixtures' / chosen
        lesson = json.loads((fixture / 'lesson.json').read_text())
        raw = json.loads((fixture / 'author-parameters.json').read_text())
        canonical = json.loads((fixture / 'canonical.json').read_text())
        cap = frozen.validate_lesson(lesson)
        assert frozen.derive_author_parameters(lesson, cap, raw) == canonical
        frozen.validate_model(lesson, canonical); frozen.prepare_didactics(lesson, canonical, cap)
        with frozen.patch('provider.author_lesson', side_effect=AssertionError('OFFLINE_MODEL_DENIED')):
            result = stage('full-native-pipeline', lambda: frozen.render_job(lesson, canonical, out / 'sheet'))
        assert result['automatedChecksPassed'] is True and result['status'] == 'needs_review'
        assert all(s['status'] == 'PASS' for s in result['steps'])
        assert {a['kind'] for a in result['artifacts']} == {'pdf', 'docx'}
        if case == 'chromium-fallback':
            skill = Path(os.environ['ELEMENTARY_SKILL_PATH'])
            spec = importlib.util.spec_from_file_location('locked_pdf_builder', skill / 'scripts/build_pdf.py')
            builder = importlib.util.module_from_spec(spec); spec.loader.exec_module(builder)
            sheet = out / 'sheet'; pdf = sheet / 'sheet.pdf'
            (sheet / 'manifest.json').unlink(); pdf.unlink()
            assert stage('chromium-render', lambda: builder.build_with_chromium(sheet / 'sheet.html', pdf))
            assert pdf.read_bytes()[:5] == b'%PDF-'
            commands = [
                [skill / 'scripts/check_worksheet.py', pdf, sheet / 'preview-chromium', '--band', 'elementary'],
                [frozen.APP / 'output_gates.py', '--skill', skill, '--pdf', pdf, '--band', 'elementary'],
                [skill / 'scripts/lib/house_gates.py', '--html', sheet / 'sheet.html', '--pdf', pdf,
                 '--gen', frozen.APP / 'adapters.py', '--content', sheet / 'content.json', '--figdir', sheet / 'figures',
                 '--grade', 'ג', '--level', 'ב', '--docx', sheet / 'sheet.docx'],
            ]
            for number, command in enumerate(commands):
                def check(command=command, number=number):
                    cp = subprocess.run([sys.executable, '-B', *map(str, command)], cwd=sheet,
                                        capture_output=True, text=True, timeout=240)
                    (out / ('chromium-gate-' + str(number) + '.txt')).write_text(cp.stdout + '\n' + cp.stderr)
                    assert cp.returncode == 0, 'CHROMIUM_GATE_FAILED'
                stage('chromium-gate-' + str(number), check)
        report['ok'] = True
    except BaseException as exc:
        report['failureType'] = type(exc).__name__
        (out / 'failure.txt').write_text(traceback.format_exc())
    report['elapsedSeconds'] = round(time.monotonic() - started, 3)
    report['cgroup'] = metrics(Path('/sys/fs/cgroup'))
    (out / 'probe-result.json').write_text(json.dumps(report, indent=2) + '\n')
    print(json.dumps({'probe': 'finished', **report}), flush=True)
    # Preserve the live cgroup for the host's authoritative final peak/events read.
    # This wait is excluded from measured job runtime and performs no network I/O.
    time.sleep(120)
    return 0 if report['ok'] else 1


def host(image, out):
    out.mkdir(parents=True, exist_ok=False)
    script = Path(__file__).resolve()
    def docker(*args, check=True):
        cp = subprocess.run(['docker', *args], capture_output=True, text=True, timeout=30)
        if check and cp.returncode: raise RuntimeError('DOCKER_' + args[0].upper() + '_FAILED')
        return cp.stdout
    image_info = json.loads(docker('image', 'inspect', image))[0]
    assert image_info['Config']['Labels']['org.opencontainers.image.revision'] == BASE_SOURCE
    states = {}; all_reports = {}
    try:
        for case in CASES:
            name = 'noam-free-probe-' + case + '-' + str(os.getpid())
            cid = docker('create', '--name', name, '--network', 'none', '--memory', '512m',
                         '--memory-swap', '512m', '--cpus', '0.1', '--shm-size', '64m',
                         '--mount', 'type=bind,src=' + str(script) + ',dst=/probe.py,readonly',
                         '--entrypoint', '/usr/bin/tini', image, '-g', '--', '/usr/local/bin/python',
                         '-B', '/probe.py', 'inside', '--case', case).strip()
            states[case] = {'id': cid, 'started': time.monotonic(), 'sample': {}}
            docker('start', cid)
            inspection = json.loads(docker('inspect', cid))[0]
            assert inspection['HostConfig']['NetworkMode'] == 'none'
            pid = inspection['State']['Pid']
            cg = [line[3:] for line in Path('/proc/' + str(pid) + '/cgroup').read_text().splitlines() if line.startswith('0::')]
            assert len(cg) == 1
            cgroup = Path('/sys/fs/cgroup') / cg[0].lstrip('/')
            states[case]['cgroup'] = cgroup
            states[case]['sample'] = metrics(cgroup)
            assert limits_match(states[case]['sample']), 'CONTAINER_LIMITS_NOT_ENFORCED'
        pending = set(states)
        while pending:
            for case in list(pending):
                s = states[case]; cid = s['id']; sample = metrics(s['cgroup'])
                if sample['memory.peak'] is not None: s['sample'] = sample
                logs = docker('logs', cid, check=False)
                completed = [line for line in logs.splitlines() if line.startswith('{"probe": "finished",')]
                status = json.loads(docker('inspect', cid))[0]['State']
                timed_out = time.monotonic() - s['started'] > BUDGET
                if not completed and status['Running'] and not timed_out: continue
                summary = json.loads(completed[-1]) if completed else {'case': case, 'ok': False,
                    'failureType': 'WALL_BUDGET_EXCEEDED' if timed_out else 'CONTAINER_EXITED',
                    'elapsedSeconds': round(time.monotonic() - s['started'], 3)}
                record = {'case': case, 'summary': summary, 'cgroup': s['sample'], 'dockerState': status,
                          'passed': successful(summary, s['sample'], status), 'network': 'none'}
                # Capture before stopping/removing, including OOM and timeout failures.
                (out / (case + '.json')).write_text(json.dumps(record, indent=2) + '\n')
                (out / (case + '.log')).write_text(logs)
                docker('cp', cid + ':/work/probe', str(out / case), check=False)
                docker('stop', '--time', '3', cid, check=False)
                pending.remove(case); all_reports[case] = record
                print(json.dumps({'case': case, 'passed': record['passed'], 'elapsedSeconds': summary['elapsedSeconds'],
                                  'memoryPeakBytes': s['sample'].get('memory.peak')}), flush=True)
            if pending: time.sleep(1)
    finally:
        for state in states.values(): docker('rm', '-f', state['id'], check=False)
    result = {'sourceSha': BASE_SOURCE, 'imageId': image_info['Id'], 'passed': len(all_reports) == len(CASES)
              and all(r['passed'] for r in all_reports.values()), 'cases': all_reports,
              'modelCalls': 0, 'queueTouched': False, 'network': 'none', 'budgetSecondsPerCase': BUDGET,
              'limitations': ['Offline render only: no provider latency, HTTP adapter or Render cold start measured.',
                              'Chromium case conservatively includes the complete native elementary pipeline before fallback.']}
    (out / 'qualification.json').write_text(json.dumps(result, indent=2) + '\n')
    return 0 if result['passed'] else 1


if __name__ == '__main__':
    parser = argparse.ArgumentParser(); sub = parser.add_subparsers(dest='mode', required=True)
    child = sub.add_parser('inside'); child.add_argument('--case', choices=CASES, required=True)
    parent = sub.add_parser('host'); parent.add_argument('--image', required=True); parent.add_argument('--out', type=Path, required=True)
    args = parser.parse_args()
    sys.exit(inside(args.case) if args.mode == 'inside' else host(args.image, args.out))
