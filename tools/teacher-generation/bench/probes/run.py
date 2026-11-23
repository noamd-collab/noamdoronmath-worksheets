"""Run the notation probes through the engine and report changes against the recorded outcome.

A probe is one natural way of writing a question for a catalog topic. Each is
sent, as a whole small worksheet, through the general author's compile path
and then through the trusted adapter that prints the pupil text and the answer
key. Nothing is rendered and no model is called.

    python3 tools/teacher-generation/bench/probes/run.py            # compare with the recorded outcomes
    python3 tools/teacher-generation/bench/probes/run.py --family fractions --show
    python3 tools/teacher-generation/bench/probes/run.py --update   # record the current outcomes

Exit status 1 when a probe that passed is now rejected, or when a probe starts
to print a wrong key, an answer beside its question or an exercise twice.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import subprocess
import sys
import tempfile

HERE = Path(__file__).resolve().parent
ENGINE = HERE.parents[1]
sys.path[:] = [p for p in sys.path if Path(p or '.').resolve() != HERE]
sys.path.insert(0, str(ENGINE))

from bench import engine, isolate, lessons, report  # noqa: E402
from bench.probes import verdict  # noqa: E402

CORPUS = HERE / 'corpus'


def load(corpus=CORPUS, families=()):
    """[(path, document)] for each family file, in name order."""
    files = sorted(Path(corpus).glob('*.json'))
    documents = [(path, json.loads(path.read_text(encoding='utf-8'))) for path in files]
    known = {doc['family'] for _, doc in documents}
    missing = [name for name in families if name not in known]
    if missing:
        raise SystemExit('Unknown family: ' + ', '.join(missing))
    return [(path, doc) for path, doc in documents if not families or doc['family'] in families]


def probe_question(probe, minimum):
    """The wire question for one probe: its item repeated, or its own list of items."""
    if 'items' in probe:
        items = [{'prompt': prompt, 'answer': answer} for prompt, answer in probe['items']]
    else:
        items = [{'prompt': probe['prompt'], 'answer': probe['answer']} for _ in range(minimum)]
    question = {'intro': probe['intro'], 'items': json.loads(json.dumps(items))}
    for key in ('table', 'figure', 'drawingFromWords'):
        if key in probe:
            question[key] = json.loads(json.dumps(probe[key]))
    return question


def evaluate(probe, topic, skills, work, contexts):
    """Engine outcome for one probe, before any judgement about its print."""
    from runtime_catalog import scope_for_lesson
    from skill_authoring import question_plan
    # Four questions is the smallest sheet the source contract accepts.
    lesson = {**lessons.default_lesson(topic, topic['levels'][0]), 'questionCount': 4}
    if topic['topicId'] not in contexts:
        contexts[topic['topicId']] = engine.authoring_context(lesson, skills)
    minimum = question_plan(lesson, scope_for_lesson(lesson))[0]['minimumItems']
    frame = isolate.neutral(topic['gradeNumber'])
    transport = engine.ReplyFromSchema(probe_question(probe, minimum), frame['title'], frame['rule'])
    compiled = engine.compile_reply(lesson, transport, skills, context=contexts[topic['topicId']])
    if not compiled['ok']:
        return {'stage': 'source', 'code': compiled['code'], 'detail': compiled['detail'][:200]}
    printed = engine.printed_questions(lesson, compiled['payload'], skills, Path(work) / probe['id'])
    if not printed['ok']:
        return {'stage': 'adapter', 'code': printed['code'], 'detail': printed['detail'][:200]}
    items = printed['questions'][0]['items']
    wanted = items if 'items' in probe else items[:1]
    return {'stage': 'printed', 'items': [{'printed': row['text'], 'key': row['answer'],
                                           'unverified': str(row.get('verification', '')).startswith('unverified')}
                                          for row in wanted]}


def worker():
    """One process per skill, as the engine itself isolates its adapter."""
    job = json.loads(sys.stdin.read())
    skills = {kind: Path(path) for kind, path in job['skills'].items()}
    topics = {topic['topicId']: topic for topic in lessons.topics()}
    contexts, results = {}, {}
    with engine.engine_environment(skills), engine.network_guard() as refused:
        for probe in job['probes']:
            try:
                results[probe['id']] = evaluate(probe, topics[probe['topic']], skills, job['work'], contexts)
            except Exception as exc:  # an engine crash on a probe is itself an outcome
                results[probe['id']] = {'stage': 'crash', 'code': 'ENGINE_EXCEPTION:' + type(exc).__name__,
                                        'detail': str(exc)[:200]}
    json.dump({'results': results, 'refused': refused}, sys.stdout, ensure_ascii=False)


def run_probes(probes, work=None):
    """{probe id: current outcome} for the given probes."""
    work = Path(work) if work else Path(tempfile.mkdtemp(prefix='teacher-probes-'))
    work.mkdir(parents=True, exist_ok=True)
    skills = engine.skill_roots(work)
    kinds = {topic['topicId']: topic['skill'] for topic in lessons.topics()}
    unknown = sorted({probe['topic'] for probe in probes if probe['topic'] not in kinds})
    if unknown:
        raise SystemExit('Probe topic not in the catalog: ' + ', '.join(unknown))
    outcomes = {}
    for kind in ('elementary', 'middle'):
        group = [probe for probe in probes if kinds[probe['topic']] == kind]
        if not group:
            continue
        job = {'skills': {k: str(v) for k, v in skills.items()}, 'work': str(work / kind), 'probes': group}
        done = subprocess.run([sys.executable, '-B', str(Path(__file__).resolve()), '--worker'],
                              input=json.dumps(job, ensure_ascii=False), capture_output=True, text=True)
        if done.returncode != 0:
            raise SystemExit(f'Probe worker for {kind} failed:\n{done.stderr[-2000:]}')
        answer = json.loads(done.stdout)
        if answer['refused']:
            raise SystemExit('A probe run tried to open a network connection')
        for probe in group:
            outcomes[probe['id']] = verdict.judge(probe, answer['results'][probe['id']])
    return outcomes


def changes(documents, outcomes):
    """Compare current outcomes with the recorded ones. Returns {kind: [lines]}."""
    found = {name: [] for name in ('new_wrong_print', 'newly_rejected', 'unlocked', 'fixed_print',
                                   'code_changed', 'print_changed', 'unrecorded')}
    for _, document in documents:
        for probe in document['probes']:
            now, before = outcomes[probe['id']], probe.get('recorded')
            label = f"{probe['id']} [{probe['topic']}] {probe.get('prompt') or probe['items'][0][0]}"
            if before is None:
                found['unrecorded'].append(f"{label} -> {verdict.short(now)}")
            elif now['outcome'] == 'wrong_print' and (before['outcome'] != 'wrong_print'
                                                    or set(now['flags']) - set(before.get('flags', []))):
                found['new_wrong_print'].append(f"{label}: {verdict.short(before)} -> {verdict.short(now)}")
            elif now['outcome'] == 'rejected' and before['outcome'] != 'rejected':
                found['newly_rejected'].append(f"{label}: {verdict.short(before)} -> {verdict.short(now)}")
            elif now['outcome'] == 'pass' and before['outcome'] == 'rejected':
                found['unlocked'].append(f"{label}: {before['code']} -> {verdict.short(now)}")
            elif now['outcome'] == 'pass' and before['outcome'] == 'wrong_print':
                found['fixed_print'].append(f"{label}: {verdict.short(before)} -> {verdict.short(now)}")
            elif now['outcome'] == 'rejected' and now.get('code') != before.get('code'):
                found['code_changed'].append(f"{label}: {before.get('code')} -> {now.get('code')}")
            elif now != before:
                found['print_changed'].append(f"{label}: {verdict.short(before)} -> {verdict.short(now)}")
    return found


TITLES = {
    'new_wrong_print': 'NEW WRONG PRINT (a wrong key, an answer beside the question or a doubled exercise)',
    'newly_rejected': 'Now rejected (passed before)',
    'unlocked': 'Unlocked (rejected before, prints cleanly now)',
    'fixed_print': 'Print repaired',
    'code_changed': 'Rejected with a different code',
    'print_changed': 'Printed text, key or flags changed',
    'unrecorded': 'No recorded outcome yet',
}


def family_table(documents, outcomes):
    rows, totals = [], [0, 0, 0, 0]
    for _, document in documents:
        counts = [0, 0, 0]
        for probe in document['probes']:
            counts[('pass', 'rejected', 'wrong_print').index(outcomes[probe['id']]['outcome'])] += 1
        rows.append([document['family'], len(document['probes']), *counts])
        totals = [totals[0] + len(document['probes'])] + [a + b for a, b in zip(totals[1:], counts)]
    rows.append(['**all**', *totals])
    return report.table(['Family', 'Probes', 'Pass', 'Rejected', 'Wrong print'], rows)


def main(argv=None):
    parser = argparse.ArgumentParser(description='Notation probes against the recorded outcome (no model call).')
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--corpus', default=str(CORPUS))
    parser.add_argument('--family', action='append', default=[], help='Family name; repeat to select several')
    parser.add_argument('--work', help='Scratch folder for compiled probes and the skill cache')
    parser.add_argument('--show', action='store_true', help='Print every probe with its current outcome')
    parser.add_argument('--update', action='store_true', help='Record the current outcomes in the corpus files')
    parser.add_argument('--accept-new-wrong-prints', action='store_true',
                        help='With --update: also record probes that newly print wrongly')
    parser.add_argument('--json', help='Write the current outcomes to this file')
    args = parser.parse_args(argv)
    if args.worker:
        worker()
        return 0
    documents = load(args.corpus, args.family)
    probes = [probe for _, document in documents for probe in document['probes']]
    outcomes = run_probes(probes, args.work)
    found = changes(documents, outcomes)
    print(family_table(documents, outcomes))
    if args.show:
        for _, document in documents:
            print(f"\n## {document['family']}")
            for probe in document['probes']:
                now = outcomes[probe['id']]
                print(f"- {probe['id']} [{probe['topic']}] {probe.get('prompt') or probe['items'][0][0]}\n"
                      f"    {verdict.long(now)}")
    for name, lines in found.items():
        if lines:
            print(f"\n## {TITLES[name]}: {len(lines)}")
            print('\n'.join('- ' + line for line in lines))
    if not any(found.values()):
        print('\nNo change against the recorded outcomes.')
    if args.json:
        report.write_json(args.json, outcomes)
    blocking = bool(found['new_wrong_print'] or found['newly_rejected'])
    if args.update:
        if found['new_wrong_print'] and not args.accept_new_wrong_prints:
            print('\nNot recorded: a probe newly prints wrongly. Fix it, or pass --accept-new-wrong-prints '
                  'to record that state on purpose.')
            return 1
        for path, document in documents:
            for probe in document['probes']:
                probe['recorded'] = outcomes[probe['id']]
            path.write_text(json.dumps(document, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
        print(f'\nRecorded {len(probes)} outcomes in {args.corpus}')
        return 0
    return 1 if blocking else 0


if __name__ == '__main__':
    raise SystemExit(main())
