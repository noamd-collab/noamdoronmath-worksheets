"""The seams between the lesson tracks: the reply read as written, the per-question
predicate, teacher notes for unverified answers, the author prompt and the
provider switch. No network, no model call, no real skill.
"""
import contextlib
import copy
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(HERE), str(Path(__file__).resolve().parent)]
import gate_policy as policy
import preflight
import provider
import remote_worker as worker
import runner
from general_source import GeneralSourceError
from runtime_catalog import CURRICULUM_SHA256, catalog, question_floor, scope_for_lesson
from skill_authoring import (KERNEL_CODES, KERNEL_INSTRUCTION, QUESTION_INSTRUCTION, question_refusal,
                             source_findings)
from validation import GenerationError

CONFIG = {'api_key': 'synthetic-fixture-key', 'base_url': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
          'model': 'fixture-model'}
PROVIDER_NAMES = ('TEACHER_AUTHOR_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'QWEN_API_KEY', 'DASHSCOPE_API_KEY',
                  'QWEN_BASE_URL', 'QWEN_MODEL')


def intake(topic_id, count=None):
    topic = next(t for t in catalog().topics if t['topicId'] == topic_id)
    return {'version': 3, 'gradeNumber': topic['gradeNumber'], 'topicId': topic['topicId'],
            'level': topic['levels'][0], 'lessonGoal': 'practice',
            'questionCount': count or question_floor(topic['gradeNumber']), 'minutes': 40,
            'lastLesson': 'למדנו את המושג הראשון בנושא ותרגלנו בכיתה', 'alreadyLearned': [],
            'explicitShortSheet': False,
            'lessonBoundary': {'version': 1, 'kind': 'curriculum_scope', 'curriculumSha256': CURRICULUM_SHA256,
                               'conceptIds': [topic['concepts'][0]['id']]}}


def evaluate(expression):
    return {'kind': 'computed', 'unit': '', 'task': {'kind': 'evaluate', 'expression': expression}}


def flat_reply(lesson, make):
    rows = [make(i) for i in range(lesson['questionCount'])]
    return {'title': 'תרגול', 'rule': 'קראו ופתרו את התרגילים.', 'practice': rows[:-3], 'challenges': rows[-3:]}


def plain_question(i):
    return {'intro': 'חשבו את ערך הביטוי.',
            'items': [{'prompt': 'חשבו.', 'answer': evaluate(str(i * 3 + j + 1))} for j in range(3)]}


@contextlib.contextmanager
def environment(values):
    with patch.dict(os.environ, values):
        for name in PROVIDER_NAMES:
            if name not in values:
                os.environ.pop(name, None)
        yield


class ReplyAsWrittenTests(unittest.TestCase):
    def setUp(self):
        self.lesson = intake('g8:percentages')

    def test_the_correction_request_carries_each_refused_question_as_the_model_wrote_it(self):
        content = flat_reply(self.lesson, plain_question)
        # Unmarked mathematics beside notation with no reading: the reply is never rewritten, so both are refused.
        content['practice'][3]['intro'] = 'חשבו [[4 @ 2]] כאשר $x=5$.'
        content['practice'][1]['intro'] = 'חשבו כי 4+6 < 12.'
        before = copy.deepcopy(content)
        revision, measured = {}, {}
        with patch('provider.build_authoring_context', return_value={}), \
                patch('provider.request_author_json',
                      side_effect=[content, {'q2': plain_question(1), 'q4': plain_question(3)}]) as network:
            with self.assertRaises(GenerationError) as first:
                provider.author_lesson(self.lesson, revision=revision, metadata=measured, **CONFIG)
            self.assertEqual(first.exception.code, 'SOURCE_NOTATION')
            self.assertEqual([row['question'] for row in revision['sourceFindings']], [2, 4])
            revision['revise'](revision['sourceFindings'])
        self.assertEqual(content, before)  # the recorded reply itself is never mutated
        sent = json.loads(network.call_args.args[2]['messages'][1]['content'])
        self.assertEqual([row['original']['intro'] for row in sent['questionsToCorrect']],
                         ['חשבו כי 4+6 < 12.', 'חשבו [[4 @ 2]] כאשר $x=5$.'])
        self.assertNotIn('sourceRewrites', measured)
        self.assertTrue(measured['validated'])
        self.assertNotIn('x=5', json.dumps(measured, ensure_ascii=False))


class QuestionPredicateTests(unittest.TestCase):
    def setUp(self):
        self.lesson = intake('g8:percentages')
        self.scope = scope_for_lesson(self.lesson)

    def findings(self, content, code):
        return source_findings(content, self.lesson, self.scope, GeneralSourceError(code, 'refused'))

    def test_a_kernel_code_reached_from_the_wire_is_one_bad_question(self):
        for expression, code in (('2^13', 'UNSUPPORTED_POWER'), ('11^12', 'RESOURCE_LIMIT'), ('sqrt(-4)', 'UNSUPPORTED_ROOT')):
            with self.subTest(expression=expression):
                content = flat_reply(self.lesson, plain_question)
                content['practice'][5]['items'][1]['answer'] = evaluate(expression)
                refusal = question_refusal(content['practice'][5], 6, self.lesson, self.scope, challenge=False)
                self.assertEqual(refusal.code, code)
                self.assertIn(code, KERNEL_CODES)
                rows = self.findings(content, code)
                self.assertEqual([(row['question'], row['codes']) for row in rows], [(6, [code])])
                self.assertIn(KERNEL_INSTRUCTION, rows[0]['feedback'][0])
                self.assertNotIn(expression, json.dumps(rows))
        self.assertIsNone(question_refusal(plain_question(0), 1, self.lesson, self.scope, challenge=False))

    def test_every_kernel_code_in_the_kernel_source_is_listed(self):
        import re
        text = (HERE / 'math_tasks.py').read_text(encoding='utf-8')
        raised = set(re.findall(r'(?:fail|MathTaskError)\(\s*"([A-Z_]+)"', text))
        self.assertEqual(raised - KERNEL_CODES, set())

    def test_a_code_without_an_instruction_still_names_its_question(self):
        content = flat_reply(self.lesson, plain_question)
        content['practice'][2]['items'] = content['practice'][2]['items'][:2]   # too few items: SOURCE_ITEMS
        rows = self.findings(content, 'SOURCE_ITEMS')
        self.assertEqual([(row['question'], row['codes']) for row in rows], [(3, ['SOURCE_ITEMS'])])
        self.assertEqual(rows[0]['feedback'], [QUESTION_INSTRUCTION])
        # Other bad questions are named with it, each with its own instruction.
        content['challenges'][0]['intro'] = 'חשבו [[4 @ 2]].'
        rows = self.findings(content, 'SOURCE_ITEMS')
        self.assertEqual([(row['question'], row['codes']) for row in rows],
                         [(3, ['SOURCE_ITEMS']), (self.lesson['questionCount'] - 2, ['SOURCE_NOTATION'])])

    def test_a_sheet_level_code_that_no_question_reproduces_stays_a_sheet_failure(self):
        content = flat_reply(self.lesson, plain_question)
        self.assertEqual(self.findings(content, 'AUTHOR_PLAN_MISMATCH'), [])
        self.assertEqual(self.findings(content, 'RESOURCE_LIMIT'), [])
        content['practice'][0]['intro'] = 'חשבו [[4 @ 2]].'
        self.assertEqual(self.findings(content, 'SOURCE_COVERAGE'), [])
        # More bad questions than one correction may carry is a sheet failure too.
        for row in content['practice'][:9]:
            row['intro'] = 'חשבו [[4 @ 2]].'
        self.assertEqual(self.findings(content, 'SOURCE_NOTATION'), [])


class AuthorPromptTests(unittest.TestCase):
    def system(self, topic_id):
        lesson, sent = intake(topic_id), []

        def capture(target, key, body, measured, timeout):
            sent.append(body)
            raise GenerationError('PROVIDER_UNAVAILABLE', 'offline')

        with patch('provider.build_authoring_context', return_value={}), \
                patch('provider.request_author_json', side_effect=capture), self.assertRaises(GenerationError):
            provider.author_lesson(lesson, **CONFIG)
        body = sent[0]
        return body['messages'][0]['content'], json.loads(body['messages'][1]['content'])

    def test_the_prompt_states_the_merged_contract(self):
        for topic in ('ד07', 'g8:percentages'):
            with self.subTest(topic=topic):
                system, user = self.system(topic)
                # Grammar track: implicit products and pi are accepted in middle school.
                self.assertNotIn('No implicit multiplication', system)
                self.assertIn('3(x+2), (x+2)(x-3), 2ab, 2pi', system)
                self.assertIn('Elementary school writes every product with its sign', system)
                # Keys track: when the typed task is printed, and the answer kinds.
                self.assertNotIn('prints its task along with the pupil prompt', system)
                self.assertIn('printed after the prompt only when the prompt shows no number at all', system)
                self.assertIn('"kind":"decide"', system)
                self.assertEqual('"kind":"open"' in system, topic == 'ד07')
                # Provider track: the reply example is not to be echoed.
                self.assertIn('replyExample', system)
                self.assertIn('must not become the standard opening of your prompts', system)
                # Gates track: what a challenge is.
                reminder = user['finalContractReminder']
                self.assertNotIn('progressively harder', reminder)
                self.assertIn('a challenge changes the reasoning, not the number of operations, digits or bracket depth', reminder)
                # Gates track: the elementary truth and house gates read these words and forms.
                for sentence in ('at most three subitems may share one bare form',
                                 'Never write לכל, not even for an amount per person or container or after התאימו, כתבו or חשבו',
                                 'Never write תמיד, לעולם, אי אפשר, לכל מספר or כל משולש', 'For a hypothetical write אם'):
                    self.assertEqual(sentence in system, topic == 'ד07', sentence)
                # The locked G32 refuses every "לכל", so no sentence may allow one.
                self.assertNotIn('Use לכל', system)

    def test_the_request_examples_stay_inside_the_grammar(self):
        from compact_authoring import expression
        for written in ('3(x+2)', '(x+2)(x-3)', '2ab', '2pi', 'x^12'):
            expression(written, 8)
        for written in ('3(2+4)', '2pi'):
            with self.assertRaises(GeneralSourceError):
                expression(written, 6)


class RunnerEvidenceTests(unittest.TestCase):
    """render_job with a stand-in adapter that leaves the evidence file."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.work = Path(self.tmp.name) / 'job'
        self.skill = Path(self.tmp.name) / 'skill'
        self.skill.mkdir()
        self.lesson = {'version': 3, 'gradeNumber': 4, 'topicId': 'ד07', 'level': 'b', 'questionCount': 12}
        self.calls = []

    def render(self, evidence):
        def run(args, **kwargs):
            name = Path(args[2]).name
            self.calls.append(name)
            if name == 'general_adapters.py':
                (self.work / 'content.json').write_text(json.dumps({'questions': [
                    {'n': str(n), 'items': ['a', 'b', 'c'], 'answer': ''} for n in range(1, 13)]}))
                if evidence is not None:
                    (self.work / 'general-evidence.json').write_text(
                        evidence if isinstance(evidence, str) else json.dumps(evidence), encoding='utf-8')
            if name in ('build_pdf.py', 'build_docx.py'):
                (self.work / ('sheet.pdf' if name == 'build_pdf.py' else 'sheet.docx')).write_bytes(name.encode())
            return SimpleNamespace(stdout='', stderr='', returncode=0)

        with patch.object(runner, 'validate_model', return_value={'skill': 'elementary'}), \
                patch.object(runner, 'verify_skill', return_value=(self.skill, {'version': 'pinned', 'sha256': 'a' * 64})), \
                patch('runtime_catalog.scope_for_lesson', return_value={}), \
                patch.object(runner.subprocess, 'run', side_effect=run):
            return runner.render_job(self.lesson, {}, self.work, skill_paths={'elementary': self.skill})

    def test_unverified_answers_reach_the_manifest_as_positions_and_kinds(self):
        rows = [{'itemId': 'q3-i2', 'question': 3, 'item': 2, 'kind': 'open', 'reason': 'PRIVATE WORDS'},
                {'itemId': 'q2-i1', 'question': 2, 'item': 1, 'kind': 'label', 'reason': 'PRIVATE WORDS'},
                {'itemId': 'q9-i3', 'question': 9, 'item': 3, 'kind': 'decision', 'reason': 'PRIVATE WORDS'},
                {'itemId': 'q3-i1', 'question': 3, 'item': 1, 'kind': 'open', 'reason': 'PRIVATE WORDS'}]
        manifest = self.render({'version': 1, 'computations': [], 'unverifiedAnswers': rows})
        self.assertEqual(manifest['status'], 'needs_review')
        self.assertEqual(manifest['unverifiedAnswers'],
                         [{'question': 3, 'item': 2, 'kind': 'open'}, {'question': 2, 'item': 1, 'kind': 'label'},
                          {'question': 9, 'item': 3, 'kind': 'decision'}, {'question': 3, 'item': 1, 'kind': 'open'}])
        self.assertNotIn('PRIVATE', json.dumps(manifest))
        notes = policy.public_teacher_notes(manifest['unverifiedAnswers'])
        self.assertEqual([(note['kind'], note['count'], note['items']) for note in notes], [
            ('open', 2, [{'question': 3, 'item': 1}, {'question': 3, 'item': 2}]),
            ('label', 1, [{'question': 2, 'item': 1}]), ('decision', 1, [{'question': 9, 'item': 3}])])
        self.assertTrue(all(note['code'] == 'UNVERIFIED_ANSWER' and note['note'] == policy.UNVERIFIED_NOTES[note['kind']]
                            for note in notes))

    def test_no_list_is_no_note_and_an_untrusted_list_delivers_nothing(self):
        for name, evidence in (('absent', None), ('native', {'version': 1, 'computations': []}),
                               ('empty', {'version': 1, 'unverifiedAnswers': []})):
            with self.subTest(name=name):
                self.work = Path(self.tmp.name) / name
                manifest = self.render(evidence)
                self.assertEqual((manifest['status'], manifest['unverifiedAnswers']), ('needs_review', []))
        bad = {'not json': '{', 'not a list': {'unverifiedAnswers': 'q1'}, 'no position': {'unverifiedAnswers': [{'kind': 'open'}]},
               'unknown kind': {'unverifiedAnswers': [{'question': 1, 'item': 1, 'kind': 'verified'}]},
               'out of range': {'unverifiedAnswers': [{'question': 1, 'item': 12, 'kind': 'open'}]},
               'not an object': ['q1']}
        for name, evidence in bad.items():
            with self.subTest(name=name):
                self.work = Path(self.tmp.name) / name.replace(' ', '-')
                self.calls.clear()
                manifest = self.render(evidence)
                self.assertEqual((manifest['status'], manifest['artifacts'], manifest['unverifiedAnswers']), ('failed', [], []))
                self.assertEqual(self.calls, ['general_adapters.py'])   # nothing was rendered
                self.assertEqual(manifest['steps'][-1], {'name': 'unverified-answers', 'status': 'FAIL', 'reason': 'EVIDENCE_UNREADABLE'})
                self.assertEqual(manifest['gate']['action'], 'fail')

    def test_only_fixed_notes_and_positions_reach_the_job_result(self):
        forged = [{'question': 2, 'item': 1, 'kind': 'label', 'note': 'FORGED', 'text': 'FORGED'},
                  {'question': 2, 'item': 1, 'kind': 'label'}, {'question': 5, 'item': 2, 'kind': 'review'}]
        notes = policy.public_teacher_notes(forged)
        self.assertEqual(notes, [
            {'code': 'UNVERIFIED_ANSWER', 'kind': 'label', 'count': 1, 'note': policy.UNVERIFIED_NOTES['label'],
             'items': [{'question': 2, 'item': 1}]},
            {'code': 'UNVERIFIED_ANSWER', 'kind': 'review', 'count': 1, 'note': policy.UNVERIFIED_NOTES['review'],
             'items': [{'question': 5, 'item': 2}]}])
        for untrusted in ('text', None, [{'question': 1, 'item': 1, 'kind': 'x'}], [None],
                          [{'question': 1, 'item': 1, 'kind': 'open'}] * (policy.MAX_UNVERIFIED_ITEMS + 1)):
            self.assertEqual(policy.public_teacher_notes(untrusted), [])
        self.assertEqual(set(policy.UNVERIFIED_NOTES), {'open', 'label', 'decision', 'review'})
        for note in policy.UNVERIFIED_NOTES.values():
            self.assertRegex(note, r'^[א-ת /.]+$')

    def test_the_worker_result_carries_the_teacher_notes(self):
        job_id, owner, lease = ('11111111-1111-4111-8111-111111111111', '22222222-2222-4222-8222-222222222222',
                                '33333333-3333-4333-8333-333333333333')
        lesson = json.loads((HERE / 'cloud/container/fixtures/general/grade4-skill-calculation/lesson.json').read_text())
        job = {'id': job_id, 'owner_id': owner, 'lease_token': lease, 'status': 'running',
               'lease_until': (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(), 'lesson': lesson}
        updates = []

        def rendered(_, payload, target):
            target.mkdir(parents=True, exist_ok=True)
            artifacts = []
            for kind in ('pdf', 'docx'):
                blob = ('synthetic ' + kind).encode()
                (target / ('sheet.' + kind)).write_bytes(blob)
                artifacts.append({'kind': kind, 'path': 'sheet.' + kind, 'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob)})
            return {'status': 'needs_review', 'automatedChecksPassed': True, 'renderingChecksPassed': True,
                    'authoringProfile': 'general-skill-source/v1', 'skill': {'name': 'elementary'}, 'artifacts': artifacts,
                    'steps': [{'name': 'trusted-adapter', 'status': 'PASS'}], 'reviewFindings': [],
                    'unverifiedAnswers': [{'question': 7, 'item': 2, 'kind': 'open', 'text': 'PRIVATE MODEL TEXT'},
                                          {'question': 1, 'item': 3, 'kind': 'label'}]}

        remote = SimpleNamespace(call=lambda *args, **kwargs: None)
        with tempfile.TemporaryDirectory() as root, patch.object(worker, 'author_lesson', return_value={}), \
                patch.object(worker, 'render_job', side_effect=rendered), patch.object(worker, 'check_transport'), \
                patch.object(worker, 'heartbeat'), \
                patch.object(worker, 'update_job', side_effect=lambda remote, job, values: updates.append(values)):
            worker.process_job(remote, job, Path(root).resolve(), enable_skill_revision=False)
        result = updates[-1]['result']
        self.assertEqual(result['teacherNotes'], [
            {'code': 'UNVERIFIED_ANSWER', 'kind': 'open', 'count': 1, 'note': policy.UNVERIFIED_NOTES['open'],
             'items': [{'question': 7, 'item': 2}]},
            {'code': 'UNVERIFIED_ANSWER', 'kind': 'label', 'count': 1, 'note': policy.UNVERIFIED_NOTES['label'],
             'items': [{'question': 1, 'item': 3}]}])
        self.assertNotIn('PRIVATE', json.dumps(result, ensure_ascii=False))
        self.assertLess(len(json.dumps(result, ensure_ascii=False).encode()), 32000)


class ProviderWiringTests(unittest.TestCase):
    def test_the_env_file_passes_the_author_switch_and_nothing_unlisted(self):
        with tempfile.TemporaryDirectory() as tmp, environment({}):
            path = Path(tmp) / 'worker.env'
            path.write_text('TEACHER_AUTHOR_PROVIDER=gemini\nGEMINI_API_KEY="fixture-not-a-key"\nGEMINI_MODEL=gemini-3.8-flash\n'
                            'GEMINI_BASE_URL=https://example.invalid\nGOOGLE_API_KEY=other\nQWEN_MODEL=fixture-model\n')
            for name in ('GEMINI_BASE_URL', 'GOOGLE_API_KEY'):
                os.environ.pop(name, None)
            worker.load_env(path)
            self.assertEqual({name: os.environ.get(name) for name in
                              ('TEACHER_AUTHOR_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL', 'QWEN_MODEL', 'GEMINI_BASE_URL', 'GOOGLE_API_KEY')},
                             {'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'fixture-not-a-key',
                              'GEMINI_MODEL': 'gemini-3.8-flash', 'QWEN_MODEL': 'fixture-model',
                              'GEMINI_BASE_URL': None, 'GOOGLE_API_KEY': None})

    def test_preflight_reads_the_selected_provider_through_author_config(self):
        qwen = {'QWEN_API_KEY': 'fixture-not-a-key', 'QWEN_BASE_URL': CONFIG['base_url'], 'QWEN_MODEL': 'fixture-model'}
        cases = [
            (qwen, {'configured': True, 'called': False, 'name': 'qwen'}),
            ({}, {'configured': False, 'called': False, 'name': 'qwen', 'reason': 'PROVIDER_NOT_CONFIGURED'}),
            ({**qwen, 'QWEN_BASE_URL': 'https://example.invalid/v1'},
             {'configured': False, 'called': False, 'name': 'qwen', 'reason': 'PROVIDER_CONFIG_INVALID'}),
            ({'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'fixture-not-a-key'},
             {'configured': True, 'called': False, 'name': 'gemini'}),
            # The Qwen settings do not configure the Gemini author, and the reverse.
            ({**qwen, 'TEACHER_AUTHOR_PROVIDER': 'gemini'},
             {'configured': False, 'called': False, 'name': 'gemini', 'reason': 'PROVIDER_NOT_CONFIGURED'}),
            ({'GEMINI_API_KEY': 'fixture-not-a-key'},
             {'configured': False, 'called': False, 'name': 'qwen', 'reason': 'PROVIDER_NOT_CONFIGURED'}),
            ({'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': 'fixture-not-a-key', 'GEMINI_MODEL': 'other-model'},
             {'configured': False, 'called': False, 'name': 'gemini', 'reason': 'PROVIDER_CONFIG_INVALID'}),
            ({**qwen, 'TEACHER_AUTHOR_PROVIDER': 'fixture-not-a-key'},
             {'configured': False, 'called': False, 'reason': 'PROVIDER_CONFIG_INVALID'}),
        ]
        for values, expected in cases:
            with self.subTest(values=sorted(values)), environment(values):
                report = preflight.check(require_provider=True)
                self.assertEqual(report['provider'], expected)
                self.assertEqual(report['ready'] and expected['configured'], report['ready'])
                self.assertNotIn('fixture-not-a-key', json.dumps(report))

    def test_diagnostics_keep_the_transport_measurements_by_vocabulary_only(self):
        job = '44444444-4444-4444-8444-444444444444'
        measured = {'provider': 'gemini', 'attempts': 2, 'httpStatus': 503, 'providerError': 'unavailable',
                    'timeoutPhase': 'reply', 'finishReason': 'stop', 'replyDefect': 'content_not_json',
                    'httpDiagnostic': {'body': 'parsed', 'statuses': ['UNAVAILABLE', 'PRIVATE_SECRET'],
                                       'fields': ['response_format', 'PRIVATE_SECRET'], 'categories': ['quota', 'PRIVATE_SECRET'],
                                       'message': 'PRIVATE_SECRET'},
                    'sourceRewrites': 7, 'correctionRequested': True}
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(worker.save_author_diagnostics(Path(tmp), job, measured))
            text = (Path(tmp) / 'author-diagnostics' / (job + '.json')).read_text()
        record = json.loads(text)
        self.assertNotIn('PRIVATE_', text)
        self.assertEqual({key: record[key] for key in ('provider', 'attempts', 'httpStatus', 'providerError', 'timeoutPhase',
                                                      'finishReason', 'replyDefect', 'correctionRequested')},
                         {'provider': 'gemini', 'attempts': 2, 'httpStatus': 503, 'providerError': 'unavailable',
                          'timeoutPhase': 'reply', 'finishReason': 'stop', 'replyDefect': 'content_not_json',
                          'correctionRequested': True})
        # Nothing rewrites the reply any more, so a rewrite count is not a measurement the worker keeps.
        self.assertNotIn('sourceRewrites', record)
        self.assertEqual(record['httpDiagnostic'], {'body': 'parsed', 'statuses': ['UNAVAILABLE'],
                                                    'fields': ['response_format'], 'categories': ['quota']})
        forged = {'provider': 'PRIVATE_SECRET', 'attempts': 99, 'httpStatus': 'PRIVATE_SECRET', 'providerError': 'PRIVATE_SECRET',
                  'timeoutPhase': 'PRIVATE_SECRET', 'finishReason': 'PRIVATE_SECRET', 'replyDefect': 'PRIVATE_SECRET',
                  'httpDiagnostic': {'body': 'PRIVATE_SECRET'}, 'sourceRewrites': 'PRIVATE_SECRET', 'correctionRequested': 'PRIVATE_SECRET'}
        self.assertEqual(provider.safe_transport_measurements(forged), {})
        self.assertEqual(provider.safe_transport_measurements('PRIVATE_SECRET'), {})
        other = '55555555-5555-4555-8555-555555555555'
        with tempfile.TemporaryDirectory() as tmp:
            self.assertTrue(worker.save_author_diagnostics(Path(tmp), other, forged))
            self.assertNotIn('PRIVATE_', (Path(tmp) / 'author-diagnostics' / (other + '.json')).read_text())

    def test_every_label_the_transport_records_is_in_its_vocabulary(self):
        for status in (400, 401, 403, 404, 429, 500, 503, 418):
            for categories in ([], ['schema_complexity'], ['unsupported_field'], ['invalid_schema']):
                self.assertIn(provider.provider_error_class(status, {'categories': categories}), provider.PROVIDER_ERRORS)


if __name__ == '__main__':
    unittest.main()
