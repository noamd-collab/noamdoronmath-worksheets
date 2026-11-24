"""Expected author latency, one call against parallel parts, from recorded replies. No model call, no network.

Each case's recorded first reply is replayed through the worker's author
stage twice: written in one call (TEACHER_AUTHOR_SLICES=1) and in parallel
parts (the setting given, default auto). The transport answers each part
with the matching rows of the recorded reply (engine.cut_reply), and every
call takes the duration that the measured gemini-3.8-flash rate gives its
request and reply (engine.LATENCY) on a virtual clock. Nothing is rendered.

    python3 tools/teacher-generation/bench/latency.py --out /path/outside/the/repo
    python3 tools/teacher-generation/bench/latency.py --case L2-p1 --case L2-g7 --parts 3 --goal practice
    python3 tools/teacher-generation/bench/latency.py --sizes      # characters of each part of the request

``--goal practice`` replays an opening lesson as practice, so the parts ask
for the same questions the recorded reply holds (an opening sheet is planned
shorter, and the recorded questions beyond its plan would all go to the last part).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import statistics
import sys
import tempfile

ENGINE = Path(__file__).resolve().parents[1]
sys.path[:] = [p for p in sys.path if Path(p or '.').resolve() != Path(__file__).resolve().parent]
sys.path.insert(0, str(ENGINE))

from bench import engine, replay  # noqa: E402

CORPUS = Path(__file__).resolve().parent / 'corpus'


def author_stage(lesson, case, corpus, skills, work, slices):
    """One author stage of the worker on the recorded first reply: its modelled calls and outcome."""
    recorded, text, _, _ = replay.load_reply(corpus, case)
    clock = engine.VirtualClock()
    transport = engine.Timed(engine.RecordedReplies(recorded, [], first_text=text), clock)
    with engine.engine_environment(skills, slices=slices), engine.network_guard() as refused:
        route = 'general' if engine.native_contract(lesson) else 'worker'
        outcome = engine.run_job(lesson, transport, Path(work), seed=f'latency/{case["id"]}/{slices}',
                                 render=False, clock=clock, route=route)
    if refused:
        raise engine.BenchError('A replay tried to reach the network')
    first = [call for call in transport.calls if call['start'] == 0.0]
    parts = (outcome.get('diagnostics') or {}).get('authorSlices') or {}
    return {'status': outcome['status'], 'code': outcome['code'], 'seconds': round(max(c['seconds'] for c in first), 1),
            'calls': len(first), 'outputTokens': sum(c['outputTokens'] for c in first),
            'inputTokens': sum(c['inputTokens'] for c in first),
            'partSeconds': [c['seconds'] for c in sorted(first, key=lambda c: c['part'] or 0)],
            'duplicates': parts.get('duplicates')}


class Captured(Exception):
    pass


def request_sizes(lesson, skills):
    """request_parts of the request the engine sends for a lesson (one call), captured before any network use."""
    import author_request
    import general_provider
    import provider
    from unittest.mock import patch
    bodies = []

    def capture(target, key, body, metadata, timeout):
        bodies.append(provider.author_body(target, body))
        raise Captured()

    with engine.engine_environment(skills, slices=1), patch.object(provider, 'request_author_json', capture):
        try:
            general_provider.author_general_lesson(lesson, metadata={}, timeout=1,
                                                   skill_paths={k: str(v) for k, v in skills.items()})
        except Captured:
            pass
    return author_request.request_parts(bodies[0]) if bodies else {}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--case', action='append', default=[])
    parser.add_argument('--parts', default='auto', help='TEACHER_AUTHOR_SLICES for the parallel run: 2-4 or auto')
    parser.add_argument('--goal', choices=('recorded', 'practice'), default='recorded')
    parser.add_argument('--provider', default='gemini', help='only cases recorded from this provider ("any" for all)')
    parser.add_argument('--sizes', action='store_true', help='print the characters of each request part instead')
    parser.add_argument('--out')
    args = parser.parse_args(argv)
    cases = [case for case in replay.load_cases(CORPUS, args.case)
             if args.case or args.provider == 'any' or case.get('provider') == args.provider]
    work = Path(tempfile.mkdtemp(prefix='latency-'))
    skills = engine.skill_roots(work / 'cache')
    rows = []
    for case in cases:
        lesson, _ = replay.load_lesson(CORPUS, case)
        if args.goal == 'practice':
            lesson = {**lesson, 'lessonGoal': 'practice'}
        if args.sizes:
            rows.append({'id': case['id'], 'sizes': request_sizes(lesson, skills)})
            print(json.dumps(rows[-1], ensure_ascii=False))
            continue
        single = author_stage(lesson, case, CORPUS, skills, work / (case['id'] + '-1'), 1)
        parts = author_stage(lesson, case, CORPUS, skills, work / (case['id'] + '-n'), args.parts)
        rows.append({'id': case['id'], 'topic': lesson['topicId'], 'questions': lesson['questionCount'],
                     'single': single, 'parts': parts})
        print(f"{case['id']:<14} {lesson['topicId']:<28} one call {single['seconds']:>5.1f} s ({single['status']}"
              f"{', ' + single['code'] if single['code'] else ''})   {parts['calls']} parts {parts['seconds']:>5.1f} s "
              f"{parts['partSeconds']} ({parts['status']}{', ' + parts['code'] if parts['code'] else ''}); "
              f"input tokens {single['inputTokens']} -> {parts['inputTokens']}; duplicates {parts['duplicates']}")
    if rows and not args.sizes:
        for key in ('single', 'parts'):
            values = [row[key]['seconds'] for row in rows]
            print(f'{key}: median {statistics.median(values):.1f} s, max {max(values):.1f} s over {len(values)} cases')
    if args.out:
        Path(args.out).mkdir(parents=True, exist_ok=True)
        (Path(args.out) / 'latency.json').write_text(json.dumps(rows, ensure_ascii=False, indent=1) + '\n',
                                                    encoding='utf-8')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
