"""One explicit authoring attempt plus offline rendering. Default: no network call."""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from decimal import Decimal
import hashlib
import json
from pathlib import Path
import re
import time

from preflight import check
from provider import author_lesson, safe_usage
from runner import render_job
from validation import GenerationError, read_json, validate_lesson

PRICE_SOURCE = 'https://www.alibabacloud.com/help/en/model-studio/model-pricing'
PRICE_AS_OF = '2026-11-12'
RATES = {'Frankfurt Global': ('0.113', '0.382'), 'Frankfurt EU': ('0.15', '0.47')}


def write_new(path, value):
    """Never replace an earlier attempt/report, even after a crash."""
    with Path(path).open('x', encoding='utf-8') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2, allow_nan=False)
        stream.write('\n')


def api_cost(metadata):
    """Scenario estimates only; absent usage/model mismatch must not look free."""
    usage = safe_usage(metadata.get('usage'))
    prompt = usage.get('prompt_tokens', usage.get('input_tokens'))
    completion = usage.get('completion_tokens', usage.get('output_tokens'))
    result = {
        'currency': 'USD', 'scope': 'estimated author API only',
        'model': 'qwen3.8-flash', 'source': PRICE_SOURCE, 'asOf': PRICE_AS_OF,
        'ratesPerMillionTokens': {name: {'input': a, 'output': b} for name, (a, b) in RATES.items()},
        'estimatedRangeUsd': None, 'scenarios': {},
        'assumptions': 'Frankfurt Global/EU standard list prices; deployment scope is not inferred. No cache/promotion/tax adjustment. Excludes rendering, hosting, storage and human review.',
    }
    if metadata.get('requestedModel') != 'qwen3.8-flash' or metadata.get('responseModel', 'qwen3.8-flash') != 'qwen3.8-flash':
        result['unavailableReason'] = 'MODEL_PRICE_NOT_VERIFIED'
    elif prompt is None or completion is None:
        result['unavailableReason'] = 'TOKEN_USAGE_NOT_RECEIVED'
    elif prompt > 1_000_000:
        result['unavailableReason'] = 'INPUT_OUTSIDE_VERIFIED_PRICE_TIER'
    else:
        costs = []
        for name, (a, b) in RATES.items():
            cost = (Decimal(prompt) * Decimal(a) + Decimal(completion) * Decimal(b)) / 1_000_000
            costs.append(cost)
            result['scenarios'][name] = format(cost, '.9f')
        result['estimatedRangeUsd'] = {'low': format(min(costs), '.9f'), 'high': format(max(costs), '.9f')}
    return result


def run_benchmark(lesson_file, output_dir, *, call=False, allow_legacy=False):
    """No queue, DB, heartbeat, upload, review model, auto retry or publication."""
    output = Path(output_dir).absolute()
    try:
        output.mkdir(mode=0o700, parents=True, exist_ok=False)
    except FileExistsError:
        raise GenerationError('OUTPUT_EXISTS', 'Benchmark requires a new output directory')
    started = time.monotonic()
    metadata = {}
    phase = 'input'
    report = {
        'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
        'mode': 'author_once_then_render' if call else 'dry_run', 'status': 'failed',
        'authorAttempts': 0, 'automaticRetries': 0, 'author': metadata,
        'automatedChecksPassed': False, 'gates': [], 'artifacts': [],
        'humanReview': {'status': 'pending', 'acceptedWorksheetCount': 0,
                        'note': 'PDF pages, actual Word rendering, pedagogy and progress alignment require independent review.'},
        'publication': 'not performed', 'legacyIntakeOfflineAllowed': bool(allow_legacy),
    }
    try:
        lesson = read_json(lesson_file)
        cap = validate_lesson(lesson, allow_legacy=allow_legacy)
        report['lesson'] = {key: lesson[key] for key in ('gradeNumber', 'topicId', 'level', 'lessonGoal', 'questionCount', 'minutes')}
        report['lessonSha256'] = hashlib.sha256(json.dumps(lesson, sort_keys=True, ensure_ascii=False).encode()).hexdigest()
        report['capability'] = {'skill': cap['skill'], 'family': cap['family']}
        phase = 'preflight'
        report['preflight'] = check(require_provider=call)
        if not report['preflight']['ready']:
            raise GenerationError('PREFLIGHT_FAILED', 'Locked runtime/skills/provider readiness failed')
        if not call:
            report['status'] = 'dry_run_ready'
            return report
        # A durable marker is written BEFORE the sole possible paid attempt.
        # Reusing this directory is forbidden, including after interruption.
        write_new(output / 'attempt.json', {'version': 1, 'purpose': 'authoring',
                  'attemptLimit': 1, 'lessonSha256': report['lessonSha256'],
                  'createdAt': datetime.now(timezone.utc).isoformat()})
        phase = 'authoring'
        report['authorAttempts'] = 1
        payload = author_lesson(lesson, metadata=metadata, **({'allow_legacy': True} if allow_legacy else {}))
        phase = 'rendering'
        render_started = time.monotonic()
        try:
            manifest = render_job(lesson, payload, output / 'render', **({'allow_legacy': True} if allow_legacy else {}))
        finally:
            report['renderElapsedSeconds'] = round(time.monotonic() - render_started, 3)
        report['gates'] = [{key: step[key] for key in ('name', 'status', 'exitCode', 'reason') if key in step} for step in manifest['steps']]
        passed = (manifest.get('automatedChecksPassed') is True
                  and len(manifest.get('artifacts', [])) == 2
                  and {a.get('kind') for a in manifest['artifacts']} == {'pdf', 'docx'}
                  and bool(report['gates'])
                  and all(s['status'] == 'PASS' for s in report['gates']))
        report['automatedChecksPassed'] = passed
        report['status'] = 'needs_review' if passed else 'failed'
        report['renderManifest'] = 'render/manifest.json'
        if passed:
            report['artifacts'] = manifest['artifacts']
            report['artifactBase'] = 'render'
        else:
            report['error'] = {'phase': 'rendering', 'code': 'RENDER_GATES_FAILED'}
        return report
    except GenerationError as exc:
        report['error'] = {'phase': phase, 'code': exc.code if re.fullmatch('[A-Z0-9_]{1,80}', exc.code) else 'GENERATION_FAILED'}
        return report
    except KeyboardInterrupt:
        report['error'] = {'phase': phase, 'code': 'INTERRUPTED_NO_RETRY'}
        return report
    except Exception:
        # Arbitrary exception text may contain provider bodies, paths or secrets.
        report['error'] = {'phase': phase, 'code': 'BENCHMARK_FAILED'}
        return report
    finally:
        report['totalElapsedSeconds'] = round(time.monotonic() - started, 3)
        report['cost'] = api_cost(metadata)
        passed = report['automatedChecksPassed']
        report['comparison'] = {
            'automaticallyPassedWorksheetCount': int(passed),
            'apiCostPerAutomaticallyPassedWorksheetUsd': report['cost']['estimatedRangeUsd'] if passed else None,
            'apiCostPerHumanAcceptedWorksheetUsd': None,
            'note': 'One worksheet includes its PDF and DOCX. Across attempts, sum costs INCLUDING failures and divide by independently accepted worksheets; zero accepted means undefined, never free.',
        }
        write_new(output / 'benchmark-report.json', report)


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--lesson', required=True)
    parser.add_argument('--out', required=True, help='New private directory; existing directories are always rejected')
    parser.add_argument('--call', action='store_true', help='Explicitly perform exactly one billed authoring attempt and offline rendering')
    parser.add_argument('--allow-legacy-intake', action='store_true', help='Explicit offline v1 reproduction; not available to queued jobs')
    args = parser.parse_args(argv)
    try:
        result = run_benchmark(args.lesson, args.out, call=args.call, allow_legacy=args.allow_legacy_intake)
    except GenerationError as exc:
        print(json.dumps({'status': 'failed', 'error': exc.code}))
        return 2
    print(json.dumps({'status': result['status'], 'authorAttempts': result['authorAttempts'],
                      'automatedChecksPassed': result['automatedChecksPassed'],
                      'report': str(Path(args.out).absolute() / 'benchmark-report.json')}))
    return 0 if result['status'] in ('dry_run_ready', 'needs_review') else 1


if __name__ == '__main__':
    raise SystemExit(main())
