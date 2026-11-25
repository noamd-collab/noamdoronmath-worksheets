"""Live coverage sweep: one default lesson request per catalog topic and level.

This is the only bench tool that can spend money. It refuses to start unless
`--live` is given together with an explicit budget, and `--dry-run` prints the
plan without any call.

    python3 tools/teacher-generation/bench/sweep.py --dry-run --one-level-per-topic
    python3 tools/teacher-generation/bench/sweep.py --live --max-calls 60 --max-output-tokens 600000 \
        --grades 3,4 --one-level-per-topic

Each case is the request of a teacher who changes nothing on the teachers'
page (see lessons.py) and runs in its own process through the queue worker's
own job function, exactly as in production but with no queue and no storage.
The provider settings are read from the process environment only, through the
engine's own provider.author_config: QWEN_API_KEY or DASHSCOPE_API_KEY,
QWEN_BASE_URL and QWEN_MODEL, or TEACHER_AUTHOR_PROVIDER=gemini with
GEMINI_API_KEY (and optionally GEMINI_MODEL). The key is never written to
disk, printed, or passed on a command line.

Everything is saved under --out, outside the repository:

    run.json                     selection, budget, engine commit, model id
    cases/<id>/result.json       the outcome of a case that really ran
    cases/<id>/attempt-N/        lesson.json, replies/reply-K.json (raw model
                                 replies), outcome.json (calls with token
                                 counts, sanitised diagnostics, gate findings,
                                 timings, delivered file paths), work/, worker.log
    summary.json, summary.md     delivered rate overall, by grade, by domain and
                                 by failure class, and the cost from token counts

Rerunning with the same --out skips the cases that already have a result.
"""
from __future__ import annotations

import argparse
from concurrent.futures import FIRST_COMPLETED, ThreadPoolExecutor, wait
from datetime import datetime, timezone
from decimal import Decimal
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import threading
import time
from urllib.parse import urlparse

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parent
REPO = ENGINE.parents[1]
sys.path[:] = [p for p in sys.path if Path(p or '.').resolve() != HERE]
sys.path.insert(0, str(ENGINE))

from bench import engine, lessons, report  # noqa: E402

KEY_NAMES = ('QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'GEMINI_API_KEY')
SECRET_NAMES = KEY_NAMES + ('TEACHER_GENERATION_SERVICE_KEY',)


def author_settings():
    """(provider name, host, model id) of the configured author, or the engine's refusal code.

    Read through the engine's own configuration check, so the sweep calls
    exactly the provider a worker with this environment would call. The key
    is checked there and never returned here.
    """
    import provider
    from validation import GenerationError
    try:
        _key, target, model = provider.author_config()
        return provider.author_provider(), urlparse(target).hostname, model
    except GenerationError as exc:
        return exc.code
CALLS_PER_CASE = 4          # the engine's ladder: at most two author calls and two corrections per job
TOKENS_PER_CASE = 104_000   # reserve per running case: two drafts (40,000 each) and two corrections (12,000 each)
CASE_SECONDS = 1200         # the bounded worker's wall limit for one job


# --------------------------------------------------------------------------- plan

def case_id(topic, level, count, minutes):
    """Stable ASCII name: g3-01-b-q12-m30, g7-equations-b-q20-m30."""
    name = topic['topicId']
    slug = name.split(':', 1)[1].replace('_', '-') if ':' in name else name[1:]
    track = name.split(':', 1)[0] if ':' in name else f"g{topic['gradeNumber']}"
    return f'{track}-{slug}-{level}-q{count}-m{minutes}'


def plan(args):
    """The selected cases in catalog order."""
    grades = {int(g) for g in args.grades.split(',')} if args.grades else None
    wanted_topics = set(args.topics.split(',')) if args.topics else None
    levels = set(args.levels.split(',')) if args.levels else None
    catalog = lessons.topics()
    unknown = sorted((wanted_topics or set()) - {t['topicId'] for t in catalog})
    if unknown:
        raise SystemExit('Unknown topic id: ' + ', '.join(unknown))
    template = args.last_lesson or lessons.LAST_LESSON
    cases = []
    for topic in catalog:
        if grades and topic['gradeNumber'] not in grades:
            continue
        if wanted_topics and topic['topicId'] not in wanted_topics:
            continue
        offered = [level for level in topic['levels'] if not levels or level in levels]
        for level in offered[:1] if args.one_level_per_topic else offered:
            count = args.question_count or min(topic['questionCounts'])
            lesson = lessons.default_lesson(topic, level, question_count=count, minutes=args.minutes,
                                            last_lesson=template)
            cases.append({'id': case_id(topic, level, count, args.minutes), 'topic': topic['topicId'],
                          'grade': topic['gradeNumber'], 'level': level, 'domain': topic['domain'],
                          'skill': topic['skill'], 'title': topic['title'], 'lesson': lesson})
    if args.only_failed:
        failed = previous_failures(Path(args.only_failed))
        cases = [case for case in cases if case['id'] in failed]
    return cases[:args.limit] if args.limit else cases


def previous_failures(folder):
    """Ids of the cases an earlier run did not deliver."""
    if not (folder / 'cases').is_dir():
        raise SystemExit(f'No earlier sweep found in {folder}')
    failed = set()
    for path in sorted((folder / 'cases').glob('*/result.json')):
        result = json.loads(path.read_text(encoding='utf-8'))
        if not result.get('delivered'):
            failed.add(result['id'])
    return failed


def local_authors(cases):
    """{case id: contract} for cases the engine writes itself, without a model call."""
    found = {}
    with tempfile.TemporaryDirectory(prefix='teacher-sweep-plan-') as scratch:
        skills = engine.skill_roots(scratch)
        with engine.engine_environment(skills), engine.network_guard():
            for case in cases:
                contract = engine.native_contract(case['lesson'])
                if contract:
                    found[case['id']] = contract
    return found


def print_plan(cases, args, native):
    by_grade = {}
    for case in cases:
        by_grade[case['grade']] = by_grade.get(case['grade'], 0) + 1
    model_cases = len(cases) - len(native)
    print(f'Plan: {len(cases)} cases '
          f'({", ".join(f"grade {g}: {n}" for g, n in sorted(by_grade.items())) or "none"}).')
    print(f'Written by a local author with no model call: {len(native)}.')
    print(f'Model calls: at least {model_cases}, at most {model_cases * args.calls_per_case} '
          f'({args.calls_per_case} per case).')
    print(f'Each request: {args.minutes} minutes, {"the smallest offered" if not args.question_count else args.question_count} '
          f'question count, all concepts ticked, stopping point "{(args.last_lesson or lessons.LAST_LESSON)}".')
    shown = cases if args.list else cases[:12]
    for case in shown:
        tag = f"  local author {native[case['id']]}" if case['id'] in native else ''
        print(f"  {case['id']}  {case['topic']}  {case['title']}{tag}")
    if len(shown) < len(cases):
        print(f'  ... {len(cases) - len(shown)} more (--list shows all)')


# --------------------------------------------------------------------------- one case (child process)

def case_worker(folder):
    """Run one case. The provider settings come from this process's environment."""
    import provider
    from benchmark import api_cost
    folder = Path(folder)
    job = json.loads((folder / 'case.json').read_text(encoding='utf-8'))
    case, lesson = job['case'], job['case']['lesson']
    skills = {kind: Path(path) for kind, path in job['skills'].items()}
    settings = author_settings()
    if isinstance(settings, str):
        raise SystemExit('The author provider is not configured: ' + settings)
    _provider_name, provider_host, model = settings
    hosts = [h for h in [provider_host, *job.get('allowHosts', [])] if h]
    transport = engine.LiveCalls(provider.request_author_json, folder / 'replies',
                                 max_calls=job['callAllowance'], max_output_tokens=job['tokenAllowance'])
    started = time.monotonic()
    with engine.engine_environment(skills, live=True), engine.network_guard(hosts) as refused:
        outcome = engine.run_job(lesson, transport, folder / 'work', seed=f"sweep/{job['run']}/{case['id']}")
    renders = [report.render_record(entry, attempt) for attempt, entry in enumerate(outcome['renders'], 1)]
    calls = outcome['author']['calls']
    made = [call for call in calls if 'refused' not in call]
    refused_by_budget = [call for call in calls if call.get('refused')]
    usage = {'calls': len(made),
             'promptTokens': sum(c.get('usage', {}).get('prompt_tokens', c.get('usage', {}).get('input_tokens', 0)) for c in made),
             'completionTokens': sum(c.get('usage', {}).get('completion_tokens', c.get('usage', {}).get('output_tokens', 0)) for c in made)}
    charged = job['tokenAllowance'] - transport.tokens_left
    # Prices are verified for one Qwen model only; any other model reports no estimate.
    costs = [api_cost({'usage': call.get('usage'), 'requestedModel': model,
                       'responseModel': call.get('responseModel', model)}) for call in made]
    scenarios = {}
    for cost in costs:
        for name, value in cost['scenarios'].items():
            scenarios[name] = str(Decimal(scenarios.get(name, '0')) + Decimal(value))
    artifacts = [str(entry['dir'] / item['path']) for entry in outcome['renders'][-1:]
                 for item in (entry['manifest'] or {}).get('artifacts', [])] if outcome['delivered'] else []
    result = {
        'id': case['id'], 'topic': case['topic'], 'grade': case['grade'], 'level': case['level'],
        'domain': case['domain'], 'skill': case['skill'], 'title': case['title'],
        'questionCount': lesson['questionCount'], 'minutes': lesson['minutes'],
        'delivered': outcome['delivered'], 'status': outcome['status'], 'code': outcome['code'],
        'failureClass': report.failure_class(outcome, renders),
        # A case the budget cut short says nothing about the engine and is run again on resume.
        'cutByBudget': bool(refused_by_budget),
        'author': {key: outcome['author'][key] for key in
                   ('route', 'contract', 'firstPass', 'modelCalls', 'correctionRequested', 'sourceValidated',
                    'timeoutSeconds', 'sourceFindings')},
        'calls': calls, 'usage': usage, 'chargedOutputTokens': charged,
        'costUsd': {'scenarios': scenarios,
                    'unavailable': sorted({c['unavailableReason'] for c in costs if 'unavailableReason' in c})},
        'renders': renders, 'ladder': outcome['ladder'], 'prechecks': outcome['prechecks'],
        'delivery': outcome.get('result'), 'diagnostics': outcome['diagnostics'],
        'artifacts': artifacts, 'jobDir': str(outcome['jobDir']), 'attempt': folder.name,
        'seconds': {**outcome['seconds'], 'wall': round(time.monotonic() - started, 3)},
        'outboundConnectionsRefused': len(refused),
    }
    report.write_json(folder / 'outcome.json', result)
    return 0


# --------------------------------------------------------------------------- the run (parent process)

class Budget:
    """Calls and output tokens for this invocation. Reservations make both limits hard.

    A case starts only when a whole per-case reservation is free, so no case is
    started with too little to finish and a call is never spent on a case that
    the budget would then cut. A budget smaller than one reservation is given
    to a single case as it is.
    """

    def __init__(self, calls, tokens, per_case_calls, per_case_tokens):
        self.calls, self.tokens = calls, tokens
        self.per_case_calls, self.per_case_tokens = min(per_case_calls, calls), min(per_case_tokens, tokens)
        self.used_calls = self.used_tokens = 0
        self.lock = threading.Lock()

    def reserve(self):
        with self.lock:
            if (self.per_case_calls < 1 or self.per_case_tokens < 1
                    or self.calls < self.per_case_calls or self.tokens < self.per_case_tokens):
                return None
            self.calls -= self.per_case_calls
            self.tokens -= self.per_case_tokens
            return self.per_case_calls, self.per_case_tokens

    def settle(self, reserved, used_calls, used_tokens):
        with self.lock:
            self.calls += reserved[0] - used_calls
            self.tokens += reserved[1] - used_tokens
            self.used_calls += used_calls
            self.used_tokens += used_tokens


def scrub(text):
    """Remove any credential value from text before it is stored or shown."""
    for name in SECRET_NAMES:
        value = os.environ.get(name)
        if value:
            text = text.replace(value, '[redacted]')
    return text


def launch_process(attempt, timeout):
    """Run the case in a child process, as production runs one job per process."""
    command = [sys.executable, '-B', str(Path(__file__).resolve()), '--case-worker', str(attempt)]
    try:
        done = subprocess.run(command, capture_output=True, text=True, timeout=timeout)
        return done.stdout + '\n' + done.stderr, done.returncode
    except subprocess.TimeoutExpired as exc:
        partial = exc.stdout.decode('utf-8', 'replace') if isinstance(exc.stdout, bytes) else (exc.stdout or '')
        return partial, 'timeout'


def run_case(case, out, skills, run_name, allowance, timeout, launch=launch_process, allow_hosts=()):
    """Run one case and return its outcome, or a note that it did not run."""
    home = out / 'cases' / case['id']
    home.mkdir(parents=True, exist_ok=True)
    attempt = home / f"attempt-{len(list(home.glob('attempt-*'))) + 1}"
    attempt.mkdir()
    report.write_json(attempt / 'lesson.json', case['lesson'])
    report.write_json(attempt / 'case.json', {'case': case, 'run': run_name, 'callAllowance': allowance[0],
                                             'tokenAllowance': allowance[1], 'allowHosts': list(allow_hosts),
                                             'skills': {kind: str(path) for kind, path in skills.items()}})
    log, code = launch(attempt, timeout)
    (attempt / 'worker.log').write_text(scrub(log)[-200_000:], encoding='utf-8')
    path = attempt / 'outcome.json'
    if not path.is_file():
        # The child died or was stopped. Its calls are unknown, so the whole reservation is charged.
        result = {**{key: case[key] for key in ('id', 'topic', 'grade', 'level', 'domain', 'skill', 'title')},
                  'delivered': False, 'attempt': attempt.name, 'cutByBudget': False, 'usageUnknown': True,
                  'usage': {'calls': allowance[0], 'promptTokens': 0, 'completionTokens': 0},
                  'chargedOutputTokens': allowance[1], 'seconds': {'wall': None}}
        if code == 'timeout':
            # Production stops a job at this wall limit and marks it interrupted: a real outcome.
            result.update(ran=True, status='failed', code='WORKER_INTERRUPTED', failureClass='WORKER:WORKER_INTERRUPTED')
            report.write_json(home / 'result.json', result)
        else:
            # The case process itself broke. That is a fault of the run, not a result about the engine.
            result.update(ran=False, failureClass='SWEEP:WORKER_EXIT')
        return result
    result = json.loads(path.read_text(encoding='utf-8'))
    result['ran'] = not result['cutByBudget']
    if result['ran']:
        report.write_json(home / 'result.json', result)
    return result


def progress(done, total, result, tally, budget, limits):
    state = 'DELIVERED' if result.get('delivered') else result.get('failureClass', 'FAILED')
    if not result.get('ran'):
        state = 'NOT RUN (' + state + ')'
    wall = result.get('seconds', {}).get('wall')
    rate = f"{100 * tally['delivered'] / tally['ran']:.0f}%" if tally['ran'] else '-'
    print(f"[{done}/{total}] {result['id']} {state} {wall if wall is not None else '?'}s "
          f"calls={result['usage']['calls']} out={result['usage']['completionTokens']:,} | "
          f"delivered {tally['delivered']}/{tally['ran']} {rate} | calls {budget.used_calls}/{limits[0]} | "
          f"out tokens {budget.used_tokens:,}/{limits[1]:,}", flush=True)


def summarise(out):
    """Aggregate every case result under `out` (this run and earlier ones)."""
    results = [json.loads(path.read_text(encoding='utf-8')) for path in sorted((out / 'cases').glob('*/result.json'))]
    attempts = [json.loads(path.read_text(encoding='utf-8'))
                for path in sorted((out / 'cases').glob('*/attempt-*/outcome.json'))]

    def group(key):
        rows = {}
        for result in results:
            row = rows.setdefault(str(result[key]), [0, 0])
            row[0] += 1
            row[1] += bool(result['delivered'])
        return {name: {'cases': n, 'delivered': d, 'rate': round(d / n, 4)} for name, (n, d) in sorted(rows.items())}

    classes = {}
    for result in results:
        classes[result['failureClass']] = classes.get(result['failureClass'], 0) + 1
    scenarios, unavailable = {}, set()
    for attempt in attempts:
        for name, value in attempt['costUsd']['scenarios'].items():
            scenarios[name] = str(Decimal(scenarios.get(name, '0')) + Decimal(value))
        unavailable.update(attempt['costUsd']['unavailable'])
    delivered = sum(bool(r['delivered']) for r in results)
    return {
        'cases': len(results), 'delivered': delivered,
        'deliveredRate': round(delivered / len(results), 4) if results else None,
        'byGrade': group('grade'), 'byDomain': group('domain'), 'bySkill': group('skill'),
        'failureClasses': dict(sorted(classes.items(), key=lambda row: (-row[1], row[0]))),
        'usage': {'calls': sum(a['usage']['calls'] for a in attempts),
                  'promptTokens': sum(a['usage']['promptTokens'] for a in attempts),
                  'completionTokens': sum(a['usage']['completionTokens'] for a in attempts),
                  'attempts': len(attempts)},
        'costUsd': {'scenarios': scenarios, 'unavailable': sorted(unavailable),
                    'note': 'List prices from benchmark.py; all attempts in this folder, including failed ones.'},
        'notDelivered': [{'id': r['id'], 'class': r['failureClass']} for r in results if not r['delivered']],
    }


def markdown(summary, not_run):
    lines = ['# Live coverage sweep', '',
             f"Delivered: **{report.percent(summary['delivered'], summary['cases'])}**. "
             f"Model calls: {summary['usage']['calls']}; input tokens {summary['usage']['promptTokens']:,}; "
             f"output tokens {summary['usage']['completionTokens']:,}.", '']
    cost = summary['costUsd']
    if cost['scenarios']:
        lines += ['Cost from token counts: ' + '; '.join(f'{name} ${Decimal(value):.4f}'
                                                         for name, value in sorted(cost['scenarios'].items())) + '.', '']
    if cost['unavailable']:
        lines += ['Cost not available for some calls: ' + ', '.join(cost['unavailable']) + '.', '']
    for title, key in (('By grade', 'byGrade'), ('By domain', 'byDomain')):
        lines += [f'## {title}', '', report.table([title[3:].capitalize(), 'Cases', 'Delivered', 'Rate'], [
            [name, row['cases'], row['delivered'], f"{100 * row['rate']:.0f}%"] for name, row in summary[key].items()]), '']
    lines += ['## By failure class', '', report.table(['Class', 'Cases'], list(summary['failureClasses'].items())), '']
    if not_run:
        lines += [f'Not run in this invocation (budget or stop): {len(not_run)} cases. '
                  'Rerun with the same --out to continue.', '']
    return '\n'.join(lines)


def live(args, cases, launch=launch_process):
    settings = author_settings()
    if isinstance(settings, str):
        raise SystemExit('The provider is not configured in the environment (' + settings + '). Set QWEN_API_KEY, '
                         'QWEN_BASE_URL and QWEN_MODEL, or TEACHER_AUTHOR_PROVIDER with GEMINI_API_KEY')
    provider_name, _host, model = settings
    if args.max_calls is None or args.max_output_tokens is None:
        raise SystemExit('--live needs an explicit budget: --max-calls and --max-output-tokens')
    out = (Path(args.out).expanduser() if args.out else
           Path.home() / 'teacher-sweeps' / datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')).resolve()
    if out == REPO or REPO in out.parents:
        raise SystemExit('--out must be outside the repository')
    out.mkdir(parents=True, exist_ok=True)
    out.chmod(0o700)
    skills = engine.skill_roots(out)
    if sys.platform == 'darwin':
        # The renderer sets the same default for its child steps on a Mac.
        os.environ.setdefault('DYLD_FALLBACK_LIBRARY_PATH', '/opt/homebrew/lib')
    with engine.engine_environment(skills, live=True):
        from preflight import check
        ready = check(require_provider=True)
    if not ready['ready']:
        failing = [name for name, row in ready['dependencies'].items() if row['status'] != 'PASS']
        raise SystemExit('The local runtime is not ready: ' + (', '.join(failing) or json.dumps(
            {k: ready[k] for k in ('skills', 'provider', 'authoring') if k in ready})))
    pending = [case for case in cases if not (out / 'cases' / case['id'] / 'result.json').is_file()]
    run_name = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    commit = subprocess.run(['git', '-C', str(ENGINE), 'rev-parse', 'HEAD'], capture_output=True, text=True,
                            env={**os.environ, 'GIT_NO_LAZY_FETCH': '1'}).stdout.strip() or None
    report.write_json(out / f'run-{run_name}.json', {
        'started': run_name, 'engineCommit': commit, 'provider': provider_name, 'model': model,
        'budget': {'maxCalls': args.max_calls, 'maxOutputTokens': args.max_output_tokens,
                   'callsPerCase': args.calls_per_case, 'tokensPerCase': TOKENS_PER_CASE},
        'selection': {key: getattr(args, key) for key in ('grades', 'topics', 'levels', 'limit', 'one_level_per_topic',
                                                           'only_failed', 'question_count', 'minutes', 'last_lesson')},
        'cases': [case['id'] for case in cases], 'alreadyDone': len(cases) - len(pending),
        'concurrency': args.concurrency, 'environment': report.environment()})
    print(f'Sweep folder: {out}')
    print(f'{len(cases)} cases selected, {len(cases) - len(pending)} already done, {len(pending)} to run; '
          f'{provider_name} model {model}; budget {args.max_calls} calls, {args.max_output_tokens:,} output tokens.',
          flush=True)
    budget = Budget(args.max_calls, args.max_output_tokens, args.calls_per_case, TOKENS_PER_CASE)
    tally, done, not_run, stopped, broken = {'ran': 0, 'delivered': 0}, 0, [], False, 0
    queue = list(pending)
    try:
        with ThreadPoolExecutor(max_workers=args.concurrency) as pool:
            running = {}
            while queue or running:
                while queue and not stopped and len(running) < args.concurrency:
                    reserved = budget.reserve()
                    if reserved is None:
                        break
                    case = queue.pop(0)
                    future = pool.submit(run_case, case, out, skills, run_name, reserved, args.case_timeout, launch,
                                         args.allow_host)
                    running[future] = (case, reserved)
                if not running:
                    break  # nothing in flight and the budget allows no further case
                finished, _ = wait(running, return_when=FIRST_COMPLETED)
                for future in finished:
                    case, reserved = running.pop(future)
                    result = future.result()
                    budget.settle(reserved, result['usage']['calls'], result['chargedOutputTokens'])
                    done += 1
                    if result['ran']:
                        tally['ran'] += 1
                        tally['delivered'] += bool(result['delivered'])
                    else:
                        not_run.append(case['id'])
                        stopped = stopped or bool(result.get('cutByBudget'))
                        if result.get('failureClass') == 'SWEEP:WORKER_EXIT':
                            broken += 1
                            if broken >= 2 and not stopped:
                                stopped = True
                                print('Two case processes exited without an outcome; stopping before more is spent. '
                                      f"See {out / 'cases' / case['id'] / result['attempt'] / 'worker.log'}", flush=True)
                    progress(done, len(pending), result, tally, budget, (args.max_calls, args.max_output_tokens))
    except KeyboardInterrupt:
        print('Interrupted; cases in flight were stopped. Rerun with the same --out to continue.', flush=True)
    not_run += [case['id'] for case in queue]
    summary = summarise(out)
    summary['thisRun'] = {'ran': tally['ran'], 'delivered': tally['delivered'], 'notRun': not_run,
                          'calls': budget.used_calls, 'outputTokensCharged': budget.used_tokens}
    report.write_json(out / 'summary.json', summary)
    text = markdown(summary, not_run)
    (out / 'summary.md').write_text(text, encoding='utf-8')
    print('\n' + text)
    if not_run:
        print(f'Stopped with {len(not_run)} cases not run: the budget was reached or the run was interrupted.')
    print(f'Files: {out}')
    return 0


def build_parser():
    parser = argparse.ArgumentParser(description='Live coverage sweep of the teacher generator. Spends money only with --live.')
    parser.add_argument('--case-worker', help=argparse.SUPPRESS)
    parser.add_argument('--live', action='store_true', help='Really call the model. Needs --max-calls and --max-output-tokens.')
    parser.add_argument('--dry-run', action='store_true', help='Print the plan and the call count; call nothing.')
    parser.add_argument('--list', action='store_true', help='With --dry-run: list every case')
    parser.add_argument('--grades', help='Comma-separated grade numbers, for example 1,2,3')
    parser.add_argument('--topics', help='Comma-separated catalog topic ids, for example ג01,g7:equations')
    parser.add_argument('--levels', help='Comma-separated levels among b,a,e')
    parser.add_argument('--limit', type=int, help='Keep only the first N selected cases')
    parser.add_argument('--one-level-per-topic', action='store_true', help='Only the first level each topic offers')
    parser.add_argument('--only-failed', metavar='SWEEP_FOLDER', help='Only cases an earlier sweep did not deliver')
    parser.add_argument('--question-count', type=int, help='Override the default (the smallest count the topic offers)')
    parser.add_argument('--minutes', type=int, default=lessons.MINUTES)
    parser.add_argument('--last-lesson', help='Template for the stopping point; {title} is the topic title')
    parser.add_argument('--max-calls', type=int, help='Hard limit on model calls in this invocation')
    parser.add_argument('--max-output-tokens', type=int, help='Hard limit on output tokens in this invocation')
    parser.add_argument('--calls-per-case', type=int, default=CALLS_PER_CASE, help='Call allowance of one case')
    parser.add_argument('--concurrency', type=int, default=4)
    parser.add_argument('--case-timeout', type=int, default=CASE_SECONDS, help='Wall seconds before a case is stopped')
    parser.add_argument('--allow-host', action='append', default=[],
                        help='Extra host a case may connect to, for example an HTTPS proxy (the provider host is always allowed)')
    parser.add_argument('--out', help='Sweep folder outside the repository (default ~/teacher-sweeps/<timestamp>/)')
    return parser


def main(argv=None):
    parser = build_parser()
    args = parser.parse_args(argv)
    if args.case_worker:
        return case_worker(args.case_worker)
    if args.live and args.dry_run:
        parser.error('choose --live or --dry-run')
    if not args.live and not args.dry_run:
        print('Refusing to run: this tool calls a paid model. Pass --dry-run to see the plan, '
              'or --live with --max-calls and --max-output-tokens to run it.', file=sys.stderr)
        return 2
    if args.concurrency < 1 or args.calls_per_case < 1:
        parser.error('--concurrency and --calls-per-case must be at least 1')
    cases = plan(args)
    if args.dry_run:
        print_plan(cases, args, local_authors(cases))
        print('Dry run: no model call was made.')
        return 0
    if not cases:
        raise SystemExit('The selection is empty')
    return live(args, cases)


if __name__ == '__main__':
    raise SystemExit(main())
