"""Replay recorded model replies through the real pipeline. No model call, no network.

For each case (a lesson request, the raw first reply, optional recorded
correction replies) the queue worker's own job function runs with the model
transport answered from the recording, the remote queue and storage replaced
by in-memory stand-ins and outbound sockets refused. The pipeline runs up to
and including the pinned skill's render and gates.

    python3 tools/teacher-generation/bench/replay.py --out /path/outside/the/repo
    python3 tools/teacher-generation/bench/replay.py --case A-division --case S-g7eq
    python3 tools/teacher-generation/bench/replay.py --compare tools/teacher-generation/bench/corpus/baseline/results.json

Files written to --out: results.json and summary.md (stable for equal engine
behaviour: no timings, paths or file hashes) and run.json (timings, work
folders, delivered files).
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
import tempfile

ENGINE = Path(__file__).resolve().parents[1]
sys.path[:] = [p for p in sys.path if Path(p or '.').resolve() != Path(__file__).resolve().parent]
sys.path.insert(0, str(ENGINE))

from bench import engine, isolate, report  # noqa: E402

CORPUS = Path(__file__).resolve().parent / 'corpus'


def load_cases(corpus, only=()):
    index = json.loads((Path(corpus) / 'index.json').read_text(encoding='utf-8'))
    cases = index['cases']
    known = {case['id'] for case in cases}
    missing = [name for name in only if name not in known]
    if missing:
        raise SystemExit('Unknown case: ' + ', '.join(missing))
    return [case for case in cases if not only or case['id'] in only]


def load_lesson(corpus, case):
    """The lesson as recorded, with the declared goal substitution applied in the open."""
    lesson = json.loads((Path(corpus) / case['lesson']).read_text(encoding='utf-8'))
    goal = case.get('lessonGoal') or {'recordedAs': lesson.get('lessonGoal'), 'replayedAs': lesson.get('lessonGoal')}
    if lesson.get('lessonGoal') != goal['recordedAs']:
        raise SystemExit(f"{case['id']}: the lesson file does not carry the recorded goal {goal['recordedAs']!r}")
    return {**lesson, 'lessonGoal': goal['replayedAs']}, goal


def lesson_facts(lesson):
    from curriculum_scope import CurriculumScopeError
    from runtime_catalog import scope_for_lesson
    facts = {key: lesson.get(key) for key in ('topicId', 'gradeNumber', 'level', 'questionCount', 'minutes')}
    try:
        topic = scope_for_lesson(lesson)['topic']
        facts.update(domain=topic['domain'], skill=topic['skillId'], title=topic['title'])
    except CurriculumScopeError as exc:
        facts['scopeError'] = exc.code
    return facts


def load_reply(corpus, case):
    """The recorded first reply: (reply for the transport, text or None, reply to examine, its source).

    A case with `firstReplyFormat: "text"` keeps the model's content text
    because it is not JSON. The transport replays that text and the engine's
    own reply reader decides what it can read, as it did live. Its questions
    are examined through a declared `repairedReply`, a hand repair that is
    never replayed, or else as the engine's salvage reads them (a question
    it cannot decode is listed as not an object).
    """
    corpus = Path(corpus)
    text = (corpus / case['firstReply']).read_text(encoding='utf-8')
    if case.get('firstReplyFormat') != 'text':
        first = json.loads(text)
        return first, None, first, 'firstReply'
    if case.get('repairedReply'):
        return None, text, json.loads((corpus / case['repairedReply']).read_text(encoding='utf-8')), 'repairedReply'
    from reply_salvage import salvage
    salvaged = salvage(text)
    if salvaged is not None:
        return None, text, salvaged[0], 'salvage'
    return None, text, None, None


def correction_path(entry):
    return entry['reply'] if isinstance(entry, dict) else entry


def load_correction(corpus, entry):
    """A recorded correction reply: parsed JSON, or, for `format: "text"`, the text and the keys it answered.

    A text correction is not JSON as recorded. It answers only a request for
    exactly its recorded keys, and the engine's own reply reader decides what
    can be read from it, as it did live.
    """
    text = (Path(corpus) / correction_path(entry)).read_text(encoding='utf-8')
    if isinstance(entry, dict) and entry.get('format') == 'text':
        return engine.TextReply(text, entry['required'])
    return json.loads(text)


def replay_case(case, corpus, skills, work, *, render=True, corrections_mode='exact'):
    """Returns (stable record, run record)."""
    corpus = Path(corpus)
    lesson, goal = load_lesson(corpus, case)
    recorded, recorded_text, first, examined = load_reply(corpus, case)
    corrections = [load_correction(corpus, entry) for entry in case.get('corrections', [])]
    local = engine.native_contract(lesson)
    route = 'general' if local else 'worker'
    transport = engine.RecordedReplies(recorded, corrections if corrections_mode != 'none' else (),
                                       first_text=recorded_text, subsets=corrections_mode == 'subset')
    outcome = engine.run_job(lesson, transport, Path(work) / case['id'], seed='replay/' + case['id'],
                             route=route, render=render)
    renders = [report.render_record(entry, attempt) for attempt, entry in enumerate(outcome['renders'], 1)]
    author = outcome['author']
    answered = sum(1 for call in author['calls'] if call.get('answered'))
    # A request for a second full draft is not a correction: it asks for the whole sheet again.
    drafts = ('skill_worksheet_content', 'worksheet_authoring_choice')
    unanswered = [call for call in author['calls'] if call.get('answered') is False and call.get('schema') not in drafts]
    corrections = [call for call in author['calls'][1:] if call.get('schema') not in drafts]
    asked = sorted(f['question'] for f in author['sourceFindings'] if f.get('question'))
    if outcome['delivered']:
        final = 'delivered'
    elif outcome['status'] == 'authored':
        final = 'authored'
    elif outcome['code'] == 'REPLAY_REPLY_NOT_RECORDED':
        # The engine's ladder ended without a sheet and it asked for a second
        # full author reply, which was never recorded. Offline the job stops
        # here; with a model it could still go either way. An unrecorded
        # correction does not stop a job: the ladder goes on to a shorter sheet.
        final = 'needs_unrecorded_reply'
    else:
        final = 'failed'

    questions, frame, note, compiles = [], None, None, 0
    try:
        isolator = isolate.Isolator(lesson, skills)
        questions = isolator.failures(first)
        rows = isolate.reply_questions(first)
        sample = next((q for _, _, _, q in rows if isinstance(q, dict) and isinstance(q.get('items'), list) and q['items']), None)
        if sample is not None:
            frame = isolator.frame_failure(first, len(sample['items']))
        compiles = isolator.compiles
    except Exception as exc:  # the lesson itself may be unusable; say so instead of guessing
        note = f'{type(exc).__name__}: {str(exc)[:160]}'

    total = len(isolate.reply_questions(first))
    record = {
        'id': case['id'], 'origin': case.get('origin'), 'provider': case.get('provider'),
        'model': case.get('model'), 'recorded': case.get('recorded'),
        'reply': {'format': 'text' if recorded_text is not None else 'json', 'questionsFrom': examined},
        'lesson': lesson_facts(lesson), 'lessonGoal': goal,
        'route': route, 'localAuthor': local,
        'delivered': outcome['delivered'], 'finalStatus': final, 'finalCode': outcome['code'],
        'failureClass': report.failure_class(outcome, renders),
        'author': {
            'contract': author['contract'], 'firstPass': author['firstPass'],
            'requests': len(author['calls']), 'answeredFromRecording': answered,
            'correction': {'requested': bool(corrections), 'questions': asked,
                           'requiredKeys': unanswered[0]['required'] if unanswered else None,
                           'answered': not unanswered if corrections else None},
            'timeoutSeconds': author['timeoutSeconds'],
        },
        'replyShape': isolate.reply_shape(first),
        'questions': {'total': total, 'failingAlone': len(questions)},
        'questionFailures': questions, 'frameFailure': frame,
        # The worker's repair ladder: attempts, corrections, replaced and dropped questions.
        'ladder': outcome['ladder'], 'prechecks': outcome['prechecks'],
        'renders': renders,
        'delivery': ({'checks': outcome['result'].get('checks'),
                      'automatedChecksPassed': outcome['result'].get('automatedChecksPassed'),
                      'reviewFindings': outcome['result'].get('reviewFindings', []),
                      'salvage': outcome['result'].get('salvage'),
                      'unverifiedAnswers': outcome['result'].get('unverifiedAnswers')}
                     if outcome.get('result') else None),
    }
    if note:
        record['isolationNote'] = note
    run = {'id': case['id'], 'seconds': outcome['seconds'], 'isolationCompiles': compiles,
           'jobDir': str(outcome['jobDir']),
           'artifacts': [{'path': str(entry['dir'] / a['path']), 'sha256': a['sha256'], 'bytes': a['bytes']}
                         for entry in outcome['renders'][-1:] for a in (entry['manifest'] or {}).get('artifacts', [])],
           'diagnostics': outcome['diagnostics']}
    return record, run


def summarise(records, refused):
    cases = len(records)
    delivered = sum(r['delivered'] for r in records)
    classes, codes, gates = {}, {}, {}
    questions = failing = 0
    for record in records:
        classes[record['failureClass']] = classes.get(record['failureClass'], 0) + 1
        questions += record['questions']['total']
        failing += record['questions']['failingAlone']
        for row in record['questionFailures']:
            codes[row['code']] = codes.get(row['code'], 0) + 1
        for finding in (record['renders'][0]['gateFindings'] if record['renders'] else []):
            name = finding['gate'] or finding['step']
            gates[name] = gates.get(name, 0) + 1
    providers = {}
    for record in records:
        row = providers.setdefault(record.get('provider') or 'unknown',
                                   {'cases': 0, 'delivered': 0, 'questions': 0, 'failingAlone': 0})
        row['cases'] += 1
        row['delivered'] += int(record['delivered'])
        row['questions'] += record['questions']['total']
        row['failingAlone'] += record['questions']['failingAlone']
    shorter = sum(1 for r in records if r['delivered'] and (r['ladder'].get('dropped') or 0) > 0)
    return {'cases': cases, 'delivered': delivered, 'deliveredShorter': shorter,
            'deliveredRate': round(delivered / cases, 4) if cases else None,
            'correctionsNotRecorded': sum(1 for r in records if r['ladder'].get('correctionFailed')),
            'secondAttemptsNotRecorded': sum(1 for r in records if r['finalStatus'] == 'needs_unrecorded_reply'),
            'byProvider': dict(sorted(providers.items())),
            'finalStatus': {name: sum(r['finalStatus'] == name for r in records)
                            for name in sorted({r['finalStatus'] for r in records})},
            'failureClasses': dict(sorted(classes.items())),
            'questions': {'total': questions, 'failingAlone': failing,
                          'failingShare': round(failing / questions, 4) if questions else None,
                          'byCode': dict(sorted(codes.items(), key=lambda row: (-row[1], row[0])))},
            'firstRenderGateFindings': dict(sorted(gates.items())),
            'modelCalls': 0, 'outboundConnectionsRefused': len(refused)}


def markdown(summary, records, env):
    lines = ['# Replay of recorded model replies', '',
             f"Delivered with no further model call: **{report.percent(summary['delivered'], summary['cases'])}**. "
             f"Questions rejected when standing alone: {report.percent(summary['questions']['failingAlone'], summary['questions']['total'])}. "
             f"Model calls: {summary['modelCalls']}; outbound connections attempted: {summary['outboundConnectionsRefused']}.", '']
    rows = []
    for r in records:
        first = r['author']['firstPass']
        render = '—'
        if r['renders']:
            root = r['renders'][0]
            failed = [s['name'] for s in root['steps'] if s['status'] == 'FAIL']
            render = 'pass' if root['status'] == 'needs_review' else 'fail: ' + ', '.join(failed or [root.get('error', '?')])
        correction = '—'
        if r['author']['correction']['requested']:
            keys = r['author']['correction']['requiredKeys'] or r['author']['correction']['questions']
            correction = f"{len(keys)} q" + ('' if r['author']['correction']['answered'] else ' (not recorded)')
        ladder = r['ladder']
        salvage = []
        if ladder.get('replaced'):
            salvage.append(f"replaced {ladder['replaced']}")
        if ladder.get('dropped'):
            salvage.append(f"dropped {ladder['dropped']}, prints {ladder.get('printed')}")
        if ladder.get('firstCode'):
            salvage.append(f"2nd attempt after {ladder['firstCode']}")
        rows.append([r['id'], r.get('provider') or '—', r['lesson']['topicId'], r['lesson']['questionCount'], r['route'],
                     'pass' if first and first['ok'] else (first or {}).get('code', r['finalCode']),
                     f"{r['questions']['failingAlone']} of {r['questions']['total']}", correction,
                     '; '.join(salvage) or '—', render, r['finalStatus']])
    lines += [report.table(['Case', 'Provider', 'Topic', 'Q', 'Route', 'First pass', 'Fail alone', 'Correction asked',
                            'Ladder', 'First render', 'Final'], rows), '']
    lines += [f"Delivered with fewer questions than requested: {summary['deliveredShorter']}. "
              f"Corrections the engine asked for that were never recorded: {summary['correctionsNotRecorded']}. "
              f"Second author replies it asked for that were never recorded: {summary['secondAttemptsNotRecorded']}.", '']
    if len(summary['byProvider']) > 1:
        lines += ['## By provider', '',
                  report.table(['Provider', 'Cases', 'Delivered', 'Questions', 'Fail alone'],
                               [[name, row['cases'], row['delivered'], row['questions'], row['failingAlone']]
                                for name, row in summary['byProvider'].items()]), '']
    repaired = [r['id'] for r in records if r['reply']['questionsFrom'] == 'repairedReply']
    if repaired:
        lines += [f"Recorded as text that is not JSON: {', '.join(repaired)}. The replay sends the text as recorded; "
                  'the question counts of such a case come from its declared hand repair.', '']
    lines += ['## Failure classes', '', report.table(['Class', 'Cases'], list(summary['failureClasses'].items())), '']
    if summary['questions']['byCode']:
        lines += ['## Questions rejected alone, by code', '',
                  report.table(['Code', 'Questions'], list(summary['questions']['byCode'].items())), '']
    if summary['firstRenderGateFindings']:
        lines += ['## Gate findings in the first render', '',
                  report.table(['Gate', 'Findings'], list(summary['firstRenderGateFindings'].items())), '']
    missing = sorted(name for name, present in env['tools'].items() if not present)
    if missing:
        lines += [f"Not installed on this machine: {', '.join(missing)}. {env['note']}", '']
    lines += ['`needs_unrecorded_reply` means the repair ladder ended without a sheet and the engine asked for a second '
              'full author reply that was never recorded; the replay stops there instead of inventing one. A correction '
              'that was never recorded does not stop a job: it counts as a failed correction and the ladder goes on to '
              'a shorter sheet.', '']
    return '\n'.join(lines)


def compare(before, after):
    """Per-case changes against an earlier results.json."""
    old = {r['id']: r for r in before.get('cases', [])}
    lines = []
    for record in after['cases']:
        prior = old.get(record['id'])
        if prior is None:
            lines.append(f"{record['id']}: new case, {record['finalStatus']}")
            continue
        changes = []
        for label, a, b in (('final', prior['finalStatus'], record['finalStatus']),
                            ('class', prior['failureClass'], record['failureClass']),
                            ('failing alone', prior['questions']['failingAlone'], record['questions']['failingAlone'])):
            if a != b:
                changes.append(f'{label} {a} -> {b}')
        if changes:
            lines.append(f"{record['id']}: " + '; '.join(changes))
    gone = sorted(set(old) - {r['id'] for r in after['cases']})
    lines += [f'{name}: no longer in the run' for name in gone]
    head = (f"Delivered {before['summary']['delivered']} of {before['summary']['cases']} -> "
            f"{after['summary']['delivered']} of {after['summary']['cases']}")
    return head, lines


def run(corpus=CORPUS, only=(), out=None, work=None, render=True, skills=None, corrections='exact'):
    """Replay the selected cases. Returns the results document; writes files when `out` is given.

    `skills` may name already installed skill folders; otherwise the bundled
    archives are unpacked under the work folder.
    """
    cases = load_cases(corpus, only)
    out = Path(out) if out else None
    work = Path(work) if work else (out / 'work' if out else Path(tempfile.mkdtemp(prefix='teacher-replay-')))
    if work.exists() and any(p.name != 'skills' for p in work.iterdir()):
        raise SystemExit(f'The work folder must be new or empty apart from skills/: {work}')
    work.mkdir(parents=True, exist_ok=True)
    skills = skills or engine.skill_roots(work)
    records, runs = [], []
    with engine.engine_environment(skills), engine.network_guard() as refused:
        for case in cases:
            record, timing = replay_case(case, corpus, skills, work, render=render, corrections_mode=corrections)
            records.append(record)
            runs.append(timing)
    env = report.environment()
    results = {'version': 1, 'rendered': render, 'corrections': corrections,
               'summary': summarise(records, refused), 'cases': records}
    if out:
        out.mkdir(parents=True, exist_ok=True)
        report.write_json(out / 'results.json', results)
        (out / 'summary.md').write_text(markdown(results['summary'], records, env), encoding='utf-8')
        report.write_json(out / 'run.json', {'environment': env, 'work': str(work), 'cases': runs})
    return results


def main(argv=None):
    parser = argparse.ArgumentParser(description='Offline replay of recorded model replies (zero model calls).')
    parser.add_argument('--corpus', default=str(CORPUS))
    parser.add_argument('--case', action='append', default=[], help='Case id; repeat to select several')
    parser.add_argument('--out', help='New folder for results.json, summary.md and run.json (default: a temp folder)')
    parser.add_argument('--work', help='Folder for render output and the skill cache (default: <out>/work)')
    parser.add_argument('--no-render', action='store_true', help='Stop after the author stage')
    parser.add_argument('--corrections', choices=('exact', 'subset', 'none'), default='exact',
                        help='exact: a recorded correction answers only a request for exactly its keys (default); '
                             'subset: it also answers a request for some of its keys, with those questions '
                             '(a what-if: the live request would have differed); none: no correction is answered, '
                             'so only reserves and a shorter sheet can save a case')
    parser.add_argument('--compare', help='An earlier results.json to report changes against')
    args = parser.parse_args(argv)
    out = Path(args.out) if args.out else Path(tempfile.mkdtemp(prefix='teacher-replay-'))
    if (out / 'results.json').exists():
        parser.error(f'{out} already holds results; choose a new folder')
    results = run(args.corpus, args.case, out, args.work, render=not args.no_render, corrections=args.corrections)
    print((out / 'summary.md').read_text(encoding='utf-8'))
    if args.compare:
        head, lines = compare(json.loads(Path(args.compare).read_text(encoding='utf-8')), results)
        print('## Changes against ' + args.compare + '\n\n' + head)
        print('\n'.join('- ' + line for line in lines) if lines else '- no per-case change')
    print(f'\nFiles: {out}')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
