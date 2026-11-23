"""Offline replay harness: recorded replies through the real pipeline, never a model or the network.

The author stage is always exercised. The skill render is slow and needs the
local render stack, so the full-render case runs only with
BENCH_RENDER_TESTS=1.
"""
from __future__ import annotations

import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine, isolate, replay, report  # noqa: E402
from validation import GenerationError  # noqa: E402

CORPUS = HERE / 'bench/corpus'
MARKUP = '<script>'


def write_corpus(folder, case_id, lesson, first, corrections=()):
    """A one-case corpus in the layout replay.py reads."""
    folder = Path(folder)
    (folder / 'lessons').mkdir(parents=True)
    (folder / 'replies').mkdir()
    (folder / 'lessons/lesson.json').write_text(json.dumps(lesson, ensure_ascii=False), encoding='utf-8')
    (folder / 'replies/first.json').write_text(json.dumps(first, ensure_ascii=False), encoding='utf-8')
    names = []
    for index, correction in enumerate(corrections, 1):
        names.append(f'replies/correction-{index}.json')
        (folder / names[-1]).write_text(json.dumps(correction, ensure_ascii=False), encoding='utf-8')
    index = {'version': 1, 'cases': [{'id': case_id, 'lesson': 'lessons/lesson.json',
                                      'firstReply': 'replies/first.json', 'corrections': names}]}
    (folder / 'index.json').write_text(json.dumps(index), encoding='utf-8')
    return folder


class CorpusTests(unittest.TestCase):
    def test_corpus_holds_the_recorded_replies_and_nothing_private(self):
        index = json.loads((CORPUS / 'index.json').read_text(encoding='utf-8'))
        cases = index['cases']
        self.assertEqual(len(cases), 19)
        self.assertEqual(len({case['id'] for case in cases}), 19)
        self.assertEqual([sum(case['provider'] == name for case in cases) for name in ('qwen', 'gemini')], [14, 5])
        listed = ({case['firstReply'] for case in cases} | {case['lesson'] for case in cases}
                  | {case['repairedReply'] for case in cases if 'repairedReply' in case})
        on_disk = {str(p.relative_to(CORPUS)) for p in CORPUS.rglob('*')
                   if p.is_file() and p.parent.name in ('lessons', 'replies')}
        self.assertEqual(listed, on_disk)
        for case in cases:
            lesson = json.loads((CORPUS / case['lesson']).read_text(encoding='utf-8'))
            recorded = (CORPUS / case['firstReply']).read_bytes()
            self.assertEqual(hashlib.sha256(recorded).hexdigest(), case['firstReplySha256'])
            # A substituted goal is declared as a pair, never applied silently.
            self.assertEqual(case['lessonGoal']['recordedAs'], lesson['lessonGoal'])
            self.assertIn(case['lessonGoal']['replayedAs'], ('practice', 'review'))
            self.assertFalse(lesson.get('classLabel'))
            if case.get('firstReplyFormat') == 'text':
                # Kept as the model's text because it is not JSON; its hand repair is declared and pinned.
                with self.assertRaises(ValueError):
                    json.loads(recorded.decode('utf-8'))
                repaired = (CORPUS / case['repairedReply']).read_bytes()
                self.assertEqual(hashlib.sha256(repaired).hexdigest(), case['repairedReplySha256'])
                reply = json.loads(repaired.decode('utf-8'))
            else:
                reply = json.loads(recorded.decode('utf-8'))
            self.assertEqual(set(reply), {'title', 'rule', 'practice', 'challenges'})
        blob = ''.join(p.read_text(encoding='utf-8') for p in CORPUS.rglob('*')
                       if p.is_file() and p.parent.name in ('lessons', 'replies'))
        for forbidden in ('@', 'http', 'Bearer', 'sk-', 'api_key', 'apiKey', 'eyJ', 'token', 'secret'):
            self.assertNotIn(forbidden, blob)


class GuardTests(unittest.TestCase):
    def test_network_guard_refuses_and_records_every_attempt(self):
        real = socket.create_connection
        with engine.network_guard() as refused:
            with self.assertRaises(engine.NetworkBlocked):
                socket.create_connection(('provider.invalid', 443), timeout=1)
            probe = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            try:
                with self.assertRaises(engine.NetworkBlocked):
                    probe.connect(('192.0.2.1', 443))
            finally:
                probe.close()
        self.assertEqual(refused, ['provider.invalid', '192.0.2.1'])
        self.assertIs(socket.create_connection, real)

    def test_network_guard_lets_only_the_named_host_through(self):
        server = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self.addCleanup(server.close)
        server.bind(('127.0.0.1', 0))
        server.listen(1)
        port = server.getsockname()[1]
        with engine.network_guard(['127.0.0.1']) as refused:
            socket.create_connection(('127.0.0.1', port), timeout=2).close()
            with self.assertRaises(engine.NetworkBlocked):
                socket.create_connection(('localhost', port), timeout=2)
            direct = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.addCleanup(direct.close)
            with self.assertRaises(engine.NetworkBlocked):   # only through the checked entry point
                direct.connect(('127.0.0.1', port))
        self.assertEqual(refused, ['localhost', '127.0.0.1'])

    def test_offline_environment_hides_real_credentials_and_restores_them(self):
        real = {'QWEN_API_KEY': 'real-looking-value', 'DASHSCOPE_API_KEY': 'another',
                'TEACHER_GENERATION_SERVICE_KEY': 'queue-key', 'QWEN_MODEL': 'configured-model'}
        with patch.dict(os.environ, real):
            with engine.engine_environment({'elementary': Path('/e'), 'middle': Path('/m')}):
                self.assertEqual(os.environ['QWEN_API_KEY'], engine.OFFLINE_PROVIDER['QWEN_API_KEY'])
                self.assertNotIn('DASHSCOPE_API_KEY', os.environ)
                self.assertNotIn('TEACHER_GENERATION_SERVICE_KEY', os.environ)
                self.assertEqual(os.environ['ELEMENTARY_SKILL_PATH'], '/e')
            self.assertEqual({name: os.environ[name] for name in real}, real)

    def test_recorded_replies_never_invent_a_correction(self):
        transport = engine.RecordedReplies({'title': 't'}, [{'q3': {'intro': 'x'}}])
        body = lambda name, required: {'response_format': {'json_schema': {
            'name': name, 'schema': {'required': required}}}, 'max_tokens': 10}
        self.assertEqual(transport('url', 'KEY', body('first', ['title']), {}, 1), {'title': 't'})
        self.assertEqual(transport('url', 'KEY', body('revise', ['q3']), {}, 1), {'q3': {'intro': 'x'}})
        with self.assertRaises(GenerationError) as raised:
            transport('url', 'KEY', body('revise', ['q3', 'q4']), {}, 1)
        self.assertEqual(raised.exception.code, 'REPLAY_REPLY_NOT_RECORDED')
        self.assertEqual([call['answered'] for call in transport.calls], [True, True, False])
        self.assertNotIn('KEY', json.dumps(transport.calls))

    def test_reply_from_schema_fills_every_required_group_including_new_ones(self):
        question = {'intro': 'i', 'items': []}
        schema = {'type': 'object', '$defs': {'question': {'type': 'object'}}, 'required': ['title', 'rule', 'practice', 'challenges', 'reserve'],
                  'properties': {'title': {'type': 'string'}, 'rule': {'type': 'string'},
                                 'practice': {'type': 'array', 'minItems': 5, 'items': {'$ref': '#/$defs/question'}},
                                 'challenges': {'type': 'array', 'minItems': 3, 'items': {'$ref': '#/$defs/question'}},
                                 'reserve': {'type': 'array', 'minItems': 2, 'items': {'$ref': '#/$defs/question'}}}}
        transport = engine.ReplyFromSchema(question, 'T', 'R')
        reply = transport('url', 'KEY', {'response_format': {'json_schema': {'name': 'n', 'schema': schema}}}, {}, 1)
        self.assertEqual({k: len(v) if isinstance(v, list) else v for k, v in reply.items()},
                         {'title': 'T', 'rule': 'R', 'practice': 5, 'challenges': 3, 'reserve': 2})


class ReportTests(unittest.TestCase):
    def test_gate_findings_name_gate_and_question_from_the_skill_logs(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / 'logs').mkdir()
            (root / 'logs/content-truth.txt').write_text(
                "CONTENT-TRUTH GATES: FAIL\n ✗ G32  [content.json.questions#4]  טענה כוללת\n", encoding='utf-8')
            (root / 'logs/house-gates.txt').write_text(
                'PASS — G50-★: ok\nFAIL — G61-level: פער קושי 5 > 4 (Q23=3 מול Q101=8)\nHOUSE GATES: FAIL (1)\n',
                encoding='utf-8')
            (root / 'logs/trusted-adapter.txt').write_text(
                'Traceback (most recent call last):\n  File "general_adapters.py", line 340, in compile_source\n'
                '    raise GeneralSourceError("UNVERIFIED_ANSWERS", "no deliverable")\n'
                'general_source.GeneralSourceError: no deliverable\n', encoding='utf-8')
            manifest = {'status': 'failed', 'steps': [
                {'name': 'trusted-adapter', 'status': 'FAIL', 'log': 'logs/trusted-adapter.txt'},
                {'name': 'content-truth', 'status': 'FAIL', 'log': 'logs/content-truth.txt'},
                {'name': 'pdf', 'status': 'PASS', 'log': 'logs/pdf.txt'},
                {'name': 'house-gates', 'status': 'FAIL', 'log': 'logs/house-gates.txt'},
                {'name': 'word', 'status': 'FAIL', 'reason': 'RENDER_TIMEOUT'}]}
            found = report.gate_findings(root, manifest)
        self.assertEqual([(row['step'], row['gate'], row['questions']) for row in found], [
            ('trusted-adapter', 'UNVERIFIED_ANSWERS', []), ('content-truth', 'G32', [4]),
            ('house-gates', 'G61', [2, 10]), ('word', 'RENDER_TIMEOUT', [])])

    def test_failure_class_names_the_stage_and_root_code(self):
        author = lambda first: {'author': {'firstPass': first}}
        self.assertEqual(report.failure_class({'delivered': True}, []), 'DELIVERED')
        self.assertEqual(report.failure_class({'code': 'UNSUPPORTED_GOAL', **author(None)}, []), 'LESSON:UNSUPPORTED_GOAL')
        self.assertEqual(report.failure_class(author({'ok': False, 'code': 'SOURCE_NOTATION'}), []), 'SOURCE:SOURCE_NOTATION')
        self.assertEqual(report.failure_class(author({'ok': False, 'code': 'PROVIDER_HTTP_ERROR'}), []),
                         'PROVIDER:PROVIDER_HTTP_ERROR')
        gates = [{'gateFindings': [{'gate': 'G61', 'step': 'house-gates'}, {'gate': 'G32', 'step': 'content-truth'}]}]
        self.assertEqual(report.failure_class({'code': 'QUALITY_GATE_FAILED', **author({'ok': True})}, gates),
                         'GATES:G32+G61')


class ReplayTests(unittest.TestCase):
    """Runs the engine's own author path; skills come from the bundled pinned archives."""

    @classmethod
    def setUpClass(cls):
        cls.scratch = tempfile.mkdtemp(prefix='bench-replay-test-')
        cls.skills = engine.skill_roots(cls.scratch)

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.scratch, ignore_errors=True)

    def work(self):
        return Path(tempfile.mkdtemp(prefix='work-', dir=self.scratch))

    def replay(self, corpus=CORPUS, **options):
        return replay.run(corpus, work=self.work(), skills=self.skills, **options)

    def test_two_corpus_cases_replay_with_no_model_call_and_identical_output(self):
        first = self.replay(only=('A-division', 'S-g7eq'), render=False)
        second = self.replay(only=('A-division', 'S-g7eq'), render=False)
        self.assertEqual(json.dumps(first, sort_keys=True, ensure_ascii=False),
                         json.dumps(second, sort_keys=True, ensure_ascii=False))
        summary = first['summary']
        self.assertEqual((summary['cases'], summary['modelCalls'], summary['outboundConnectionsRefused']), (2, 0, 0))
        division, equations = first['cases']
        self.assertEqual(division['lessonGoal'], {'recordedAs': 'introduce', 'replayedAs': 'practice'})
        self.assertEqual(equations['lessonGoal'], {'recordedAs': 'practice', 'replayedAs': 'practice'})
        for case in first['cases']:
            self.assertIn(case['finalStatus'], ('authored', 'failed', 'needs_unrecorded_reply'))
            self.assertEqual(case['questions']['total'], 20)
            self.assertEqual(case['route'], 'worker')
            self.assertGreaterEqual(case['author']['requests'], 1)
            self.assertEqual(case['author']['timeoutSeconds'], 300)
            self.assertEqual(case['questions']['failingAlone'], len(case['questionFailures']))
            for row in case['questionFailures']:
                self.assertTrue({'question', 'group', 'code', 'field', 'substring'} <= set(row))
            # Nothing that varies between runs belongs in the stable record.
            self.assertNotIn(str(self.scratch), json.dumps(case, ensure_ascii=False))

    def test_a_reply_that_is_not_json_is_rejected_as_live_and_examined_from_its_declared_repair(self):
        results = self.replay(only=('G-equations', 'G-division'), render=False)
        cases = {case['id']: case for case in results['cases']}
        text, parsed = cases['G-equations'], cases['G-division']
        self.assertEqual((text['provider'], text['reply']), ('gemini', {'format': 'text', 'questionsFrom': 'repairedReply'}))
        # The engine's own reply reader refuses the recorded text; nothing is repaired on the way in.
        self.assertEqual((text['finalStatus'], text['finalCode']), ('failed', 'PROVIDER_INVALID_RESPONSE'))
        self.assertEqual((text['author']['requests'], text['author']['answeredFromRecording']), (1, 1))
        self.assertFalse(text['author']['correction']['requested'])
        self.assertEqual(text['questions']['total'], 20)
        self.assertEqual(parsed['reply'], {'format': 'json', 'questionsFrom': 'firstReply'})
        self.assertEqual(results['summary']['byProvider']['gemini']['cases'], 2)
        self.assertEqual(results['summary']['byProvider']['gemini']['questions'], 40)

    def test_results_files_are_written_and_compared(self):
        out = Path(tempfile.mkdtemp(prefix='out-', dir=self.scratch))
        results = self.replay(only=('S-g7eq',), out=out, render=False)
        self.assertEqual(json.loads((out / 'results.json').read_text(encoding='utf-8')), results)
        self.assertIn('| S-g7eq |', (out / 'summary.md').read_text(encoding='utf-8'))
        run = json.loads((out / 'run.json').read_text(encoding='utf-8'))
        self.assertEqual([case['id'] for case in run['cases']], ['S-g7eq'])
        changed = copy.deepcopy(results)
        changed['cases'][0]['finalStatus'] = 'delivered'
        changed['summary']['delivered'] = 1
        head, lines = replay.compare(results, changed)
        self.assertEqual(lines, [f"S-g7eq: final {results['cases'][0]['finalStatus']} -> delivered"])
        self.assertIn('-> 1 of 1', head)

    def test_a_planted_fault_is_found_at_its_question_field_and_substring(self):
        lesson = json.loads((CORPUS / 'lessons/g7-equations-practice.json').read_text(encoding='utf-8'))
        reply = json.loads((CORPUS / 'replies/S-g7eq.json').read_text(encoding='utf-8'))
        with engine.engine_environment(self.skills), engine.network_guard() as refused:
            isolator = isolate.Isolator(lesson, self.skills)
            failing = {row['question'] for row in isolator.failures(reply)}
            clean = next(n for n in range(1, 18) if n not in failing)
            # Markup is refused by the source contract in every grade; plant it in one prompt.
            reply['practice'][clean - 1]['items'][1]['prompt'] += ' ' + MARKUP
            found = [row for row in isolator.failures(reply) if row['question'] == clean]
        self.assertEqual(refused, [])
        self.assertEqual(len(found), 1)
        self.assertEqual((found[0]['group'], found[0]['field']), ('practice', 'item.2.prompt'))
        self.assertIn(MARKUP, found[0]['substring'])
        self.assertTrue(found[0]['code'].startswith('SOURCE_'))

    def test_a_recorded_correction_is_replayed_and_an_unrecorded_one_stops_the_case(self):
        lesson = json.loads((CORPUS / 'lessons/g7-equations-practice.json').read_text(encoding='utf-8'))
        good = json.loads((CORPUS / 'replies/S-g7eq.json').read_text(encoding='utf-8'))
        base = self.replay(write_corpus(Path(self.scratch) / 'c-base', 'base', lesson, good), render=False)['cases'][0]
        if base['finalStatus'] != 'authored':
            self.skipTest('The recorded reply no longer passes the author stage on this engine')
        broken = copy.deepcopy(good)
        broken['practice'][2]['items'][0]['prompt'] = 'פתרו [[)(]].'
        alone = self.replay(write_corpus(Path(self.scratch) / 'c-alone', 'alone', lesson, broken), render=False)['cases'][0]
        self.assertNotEqual(alone['finalStatus'], 'delivered')
        self.assertIn(3, [row['question'] for row in alone['questionFailures']])
        if alone['finalStatus'] != 'needs_unrecorded_reply':
            # A later engine may repair or replace the question locally instead of asking the model.
            self.assertIn(alone['finalStatus'], ('authored', 'failed'))
            return
        self.assertEqual(alone['finalCode'], 'REPLAY_REPLY_NOT_RECORDED')
        self.assertEqual(alone['author']['correction']['questions'], [3])
        self.assertEqual(alone['author']['answeredFromRecording'], 1)
        keys = alone['author']['correction']['requiredKeys']
        correction = {key: good['practice'][2] for key in keys}
        fixed = self.replay(write_corpus(Path(self.scratch) / 'c-fixed', 'fixed', lesson, broken, [correction]),
                            render=False)['cases'][0]
        self.assertEqual(fixed['finalStatus'], 'authored')
        self.assertEqual((fixed['author']['requests'], fixed['author']['answeredFromRecording']), (2, 2))
        self.assertTrue(fixed['author']['correction']['answered'])

    def test_a_goal_the_engine_rejects_is_reported_not_rewritten(self):
        lesson = json.loads((CORPUS / 'lessons/g3-division.json').read_text(encoding='utf-8'))
        reply = json.loads((CORPUS / 'replies/A-division.json').read_text(encoding='utf-8'))
        self.assertEqual(lesson['lessonGoal'], 'introduce')
        folder = write_corpus(Path(self.scratch) / 'c-goal', 'goal', lesson, reply)
        case = self.replay(folder, render=False)['cases'][0]
        self.assertEqual(case['lessonGoal'], {'recordedAs': 'introduce', 'replayedAs': 'introduce'})
        if case['finalStatus'] == 'failed' and case['author']['firstPass'] is None:
            self.assertEqual(case['failureClass'], 'LESSON:' + case['finalCode'])
            self.assertEqual(case['author']['requests'], 0)

    @unittest.skipUnless(os.environ.get('BENCH_RENDER_TESTS') == '1', 'Set BENCH_RENDER_TESTS=1 to run the skill render')
    def test_full_pipeline_through_the_skill_render_and_gates(self):
        case = self.replay(only=('S-g4calc',))['cases'][0]
        self.assertTrue(case['renders'])
        self.assertTrue(all(step['status'] in ('PASS', 'FAIL', 'REVIEW') for step in case['renders'][0]['steps']))
        self.assertIn(case['finalStatus'], ('delivered', 'failed', 'needs_unrecorded_reply'))
        if not case['delivered'] and case['renders'][0]['status'] == 'failed':
            self.assertTrue(case['renders'][0]['gateFindings'])


if __name__ == '__main__':
    unittest.main()
