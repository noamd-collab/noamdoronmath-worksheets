"""Live sweep driver, tested without the network: plan, refusal, budget, records and secrecy.

The model transport is always a local fake here. No test passes --live to a
real provider.
"""
from __future__ import annotations

import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from bench import engine, lessons, sweep  # noqa: E402
import provider  # noqa: E402
from validation import GenerationError, validate_lesson  # noqa: E402

FAKE_KEY = 'fake-key-for-tests-0123456789abcdef'
FAKE_ENV = {'QWEN_API_KEY': FAKE_KEY, 'QWEN_MODEL': 'qwen3.8-flash',
            'QWEN_BASE_URL': 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1'}
NO_PROVIDER = {name: '' for name in ('QWEN_API_KEY', 'DASHSCOPE_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL',
                                     'TEACHER_AUTHOR_PROVIDER', 'GEMINI_API_KEY', 'GEMINI_MODEL')}


def run_main(argv):
    out, err = io.StringIO(), io.StringIO()
    with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
        try:
            code = sweep.main(argv)
        except SystemExit as exc:
            code = exc.code
    return code, out.getvalue(), err.getvalue()


def arguments(*argv):
    return sweep.build_parser().parse_args(list(argv))


class PlanTests(unittest.TestCase):
    def test_refuses_to_run_without_live(self):
        with patch.object(sweep, 'live', side_effect=AssertionError('must not start')):
            code, out, err = run_main([])
            self.assertEqual(code, 2)
            self.assertIn('Refusing to run', err)
            self.assertEqual(out, '')
            code, _, err = run_main(['--grades', '3', '--max-calls', '5', '--max-output-tokens', '1000'])
            self.assertEqual(code, 2)
            # Asking for both is a mistake, never a silent live run.
            self.assertEqual(run_main(['--live', '--dry-run'])[0], 2)

    def test_the_sweep_calls_the_provider_the_engine_is_configured_for(self):
        with patch.dict(os.environ, {**NO_PROVIDER, **FAKE_ENV}):
            self.assertEqual(sweep.author_settings(), ('qwen', 'dashscope-intl.aliyuncs.com', 'qwen3.8-flash'))
        gemini = {**NO_PROVIDER, 'TEACHER_AUTHOR_PROVIDER': 'gemini', 'GEMINI_API_KEY': FAKE_KEY}
        with patch.dict(os.environ, gemini):
            self.assertEqual(sweep.author_settings(), ('gemini', 'generativelanguage.googleapis.com', provider.GEMINI_MODELS[0]))
            # The second provider's key is scrubbed from stored logs like the first.
            self.assertNotIn(FAKE_KEY, sweep.scrub('Authorization: Bearer ' + FAKE_KEY))
        # A switch without its own credential, or an unknown switch, is a refusal code, never a value.
        with patch.dict(os.environ, {**NO_PROVIDER, **FAKE_ENV, 'TEACHER_AUTHOR_PROVIDER': 'gemini'}):
            self.assertEqual(sweep.author_settings(), 'PROVIDER_NOT_CONFIGURED')
        with patch.dict(os.environ, {**NO_PROVIDER, **FAKE_ENV, 'TEACHER_AUTHOR_PROVIDER': FAKE_KEY}):
            self.assertEqual(sweep.author_settings(), 'PROVIDER_CONFIG_INVALID')

    def test_live_needs_provider_settings_and_an_explicit_budget(self):
        with patch.object(sweep, 'run_case', side_effect=AssertionError('must not start')):
            with patch.dict(os.environ, NO_PROVIDER):
                code, _, _ = run_main(['--live', '--max-calls', '1', '--max-output-tokens', '1000', '--topics', 'ג01'])
                self.assertIn('QWEN_API_KEY', str(code))
                self.assertNotIn('=', str(code))
            with patch.dict(os.environ, FAKE_ENV):
                code, _, _ = run_main(['--live', '--topics', 'ג01'])
                self.assertIn('--max-calls', str(code))
                code, _, _ = run_main(['--live', '--max-calls', '1', '--max-output-tokens', '1000', '--topics', 'ג01',
                                       '--out', str(HERE / 'bench' / 'sweep-output')])
                self.assertIn('outside the repository', str(code))
                self.assertNotIn(FAKE_KEY, str(code))
        self.assertFalse((HERE / 'bench' / 'sweep-output').exists())

    def test_dry_run_plans_the_selection_and_calls_nothing(self):
        with patch.object(provider, 'request_author_json', side_effect=AssertionError('no model call')), \
                patch.dict(os.environ, NO_PROVIDER):
            code, out, _ = run_main(['--dry-run', '--grades', '3', '--one-level-per-topic'])
            self.assertEqual(code, 0)
            self.assertIn('Plan: 25 cases (grade 3: 25).', out)
            self.assertIn('Dry run: no model call was made.', out)
            code, out, _ = run_main(['--dry-run', '--topics', 'ג01,g7:equations', '--list'])
            self.assertIn('Plan: 6 cases (grade 3: 3, grade 7: 3).', out)
            self.assertIn('at most 24 (4 per case)', out)   # two author calls and two corrections per job
            for name in ('g3-01-b-q12-m30', 'g3-01-a-q12-m30', 'g3-01-e-q12-m30', 'g7-equations-e-q20-m30'):
                self.assertIn(name, out)

    def test_catalog_selection_counts(self):
        self.assertEqual(len(sweep.plan(arguments('--dry-run'))), 634)
        every_topic = sweep.plan(arguments('--dry-run', '--one-level-per-topic'))
        self.assertEqual(len(every_topic), 232)
        self.assertEqual(len({case['id'] for case in every_topic}), 232)
        self.assertEqual(len({case['topic'] for case in every_topic}), 232)
        self.assertEqual(len(sweep.plan(arguments('--dry-run', '--grades', '9', '--levels', 'b'))), 20)
        self.assertEqual(len(sweep.plan(arguments('--dry-run', '--levels', 'e', '--limit', '7'))), 7)
        with self.assertRaises(SystemExit):
            sweep.plan(arguments('--dry-run', '--topics', 'ג99'))

    def test_default_lesson_is_the_request_the_site_stores_and_the_engine_accepts(self):
        cases = sweep.plan(arguments('--dry-run'))
        first = next(case for case in cases if case['id'] == 'g3-01-b-q12-m30')['lesson']
        self.assertEqual(list(first), ['version', 'lessonBoundary', 'gradeNumber', 'topicId', 'level', 'lessonGoal',
                                       'lastLesson', 'alreadyLearned', 'minutes', 'questionCount', 'explicitShortSheet'])
        self.assertEqual(first['lastLesson'], 'סיימנו ללמוד את הנושא ערך מקום ותרגלנו את המושגים שסומנו.')
        self.assertEqual((first['version'], first['lessonGoal'], first['minutes'], first['questionCount'],
                          first['alreadyLearned'], first['explicitShortSheet']), (3, 'practice', 30, 12, [], False))
        self.assertEqual(first['lessonBoundary']['conceptIds'], ['ג01#0', 'ג01#1', 'ג01#2'])
        floors = {1: 8, 2: 8, 3: 12, 4: 12, 5: 14, 6: 14, 7: 20, 8: 20, 9: 20}
        for case in cases:
            self.assertEqual(case['lesson']['questionCount'], floors[case['grade']])
            validate_lesson(case['lesson'], allow_legacy=False)
        custom = sweep.plan(arguments('--dry-run', '--topics', 'ג01', '--levels', 'b', '--minutes', '45',
                                      '--question-count', '14', '--last-lesson', 'עצרנו בנושא {title}.'))[0]
        self.assertEqual((custom['id'], custom['lesson']['lastLesson']), ('g3-01-b-q14-m45', 'עצרנו בנושא ערך מקום.'))

    def test_only_failed_selects_what_an_earlier_run_did_not_deliver(self):
        with tempfile.TemporaryDirectory() as tmp:
            for name, delivered in (('g3-01-b-q12-m30', True), ('g3-02-b-q12-m30', False)):
                folder = Path(tmp) / 'cases' / name
                folder.mkdir(parents=True)
                (folder / 'result.json').write_text(json.dumps({'id': name, 'delivered': delivered}), encoding='utf-8')
            cases = sweep.plan(arguments('--dry-run', '--grades', '3', '--only-failed', tmp))
            self.assertEqual([case['id'] for case in cases], ['g3-02-b-q12-m30'])


class BudgetTests(unittest.TestCase):
    def test_reservations_keep_both_limits_hard(self):
        budget = sweep.Budget(3, 60_000, 2, 50_000)
        first = budget.reserve()
        self.assertEqual(first, (2, 50_000))
        self.assertIsNone(budget.reserve())      # one call and 10,000 tokens are not a whole reservation
        budget.settle(first, 1, 5_000)           # one call used, the rest comes back
        second = budget.reserve()
        self.assertEqual(second, (2, 50_000))
        self.assertIsNone(budget.reserve())
        budget.settle(second, 2, 9_000)
        self.assertEqual((budget.used_calls, budget.used_tokens), (3, 14_000))
        self.assertIsNone(budget.reserve())      # every call is spent
        small = sweep.Budget(1, 45_000, 2, 50_000)   # a budget below one reservation goes to one case as it is
        self.assertEqual(small.reserve(), (1, 45_000))
        self.assertIsNone(small.reserve())

    def test_live_calls_refuse_before_the_network_and_never_keep_the_key(self):
        seen = []

        def real(target, key, body, metadata, timeout):
            seen.append(key)
            metadata.update(usage={'prompt_tokens': 900, 'completion_tokens': 400, 'secret': 'x'}, responseModel='m')
            return {'title': 'כותרת'}

        body = {'max_tokens': 1000, 'temperature': 0.25,
                'response_format': {'json_schema': {'name': 'n', 'schema': {'required': ['title']}}}}
        with tempfile.TemporaryDirectory() as tmp:
            calls = engine.LiveCalls(real, Path(tmp) / 'replies', max_calls=2, max_output_tokens=1500)
            self.assertEqual(calls('https://host/x', FAKE_KEY, body, {}, 300), {'title': 'כותרת'})
            self.assertEqual(calls.tokens_left, 1100)
            with self.assertRaises(GenerationError) as too_large:   # ceiling 1200 > 1100 left
                calls('https://host/x', FAKE_KEY, {**body, 'max_tokens': 1200}, {}, 300)
            self.assertEqual(too_large.exception.code, 'SWEEP_BUDGET_EXHAUSTED')
            calls('https://host/x', FAKE_KEY, body, {}, 300)
            with self.assertRaises(GenerationError):                # no call left
                calls('https://host/x', FAKE_KEY, {**body, 'max_tokens': 1}, {}, 300)
            self.assertEqual(len(seen), 2)
            self.assertEqual([c.get('refused') for c in calls.calls],
                             [None, 'SWEEP_BUDGET_EXHAUSTED', None, 'SWEEP_BUDGET_EXHAUSTED'])
            self.assertEqual(calls.calls[0]['usage'], {'prompt_tokens': 900, 'completion_tokens': 400})
            written = sorted(p.name for p in (Path(tmp) / 'replies').iterdir())
            self.assertEqual(written, ['reply-1.json', 'reply-2.json'])
            stored = json.dumps(calls.calls) + ''.join(p.read_text(encoding='utf-8')
                                                        for p in (Path(tmp) / 'replies').iterdir())
            self.assertNotIn(FAKE_KEY, stored)
            self.assertNotIn('host/x', stored)

    def test_a_call_without_a_token_count_is_charged_its_ceiling(self):
        def real(target, key, body, metadata, timeout):
            raise GenerationError('PROVIDER_UNAVAILABLE', 'timed out')

        body = {'max_tokens': 1000, 'response_format': {'json_schema': {'name': 'n', 'schema': {}}}}
        with tempfile.TemporaryDirectory() as tmp:
            calls = engine.LiveCalls(real, tmp, max_calls=3, max_output_tokens=1500)
            with self.assertRaises(GenerationError):
                calls('u', FAKE_KEY, body, {}, 300)
            self.assertEqual((calls.tokens_left, calls.calls[0]['error'], calls.calls[0]['outputTokensAssumed']),
                             (500, 'PROVIDER_UNAVAILABLE', True))

    def test_scrub_removes_credential_values(self):
        with patch.dict(os.environ, {**FAKE_ENV, 'TEACHER_GENERATION_SERVICE_KEY': 'queue-secret-value'}):
            text = sweep.scrub(f'Bearer {FAKE_KEY} and queue-secret-value in a traceback')
        self.assertEqual(text, 'Bearer [redacted] and [redacted] in a traceback')


class RunTests(unittest.TestCase):
    """A whole simulated run: fake transport, stub render, the real job function."""

    def setUp(self):
        self.scratch = Path(tempfile.mkdtemp(prefix='bench-sweep-test-'))
        self.addCleanup(shutil.rmtree, self.scratch, ignore_errors=True)
        self.prompts = []
        reply = json.loads((HERE / 'bench/corpus/replies/S-g4calc.json').read_text(encoding='utf-8'))

        def transport(target, key, body, metadata, timeout):
            self.prompts.append(body['response_format']['json_schema']['name'])
            if len(self.prompts) > self.answers:
                metadata.update(usage={'prompt_tokens': 50, 'completion_tokens': 0})
                raise GenerationError('PROVIDER_UNAVAILABLE', 'simulated outage')
            metadata.update(responseReceived=True, usage={'prompt_tokens': 1000, 'completion_tokens': 700},
                            responseModel='qwen3.8-flash')
            return json.loads(json.dumps(reply))

        def stub_render(lesson, payload, target, *args, **kwargs):
            return {'version': 1, 'status': 'failed', 'steps': [{'name': 'stub', 'status': 'FAIL', 'reason': 'TEST_STUB'}],
                    'artifacts': [], 'skill': {'name': 'elementary'}}

        import remote_worker
        self.answers = 99
        for patcher in (patch.object(provider, 'request_author_json', transport),
                        patch.object(remote_worker, 'render_job', stub_render),
                        patch.dict(os.environ, FAKE_ENV)):
            patcher.start()
            self.addCleanup(patcher.stop)

    def launch(self, attempt, timeout):
        return f'log line that echoes {FAKE_KEY}', sweep.case_worker(attempt)

    def live(self, *argv):
        args = arguments('--live', '--concurrency', '1', '--out', str(self.scratch / 'sweep'), *argv)
        ready = {'ready': True, 'dependencies': {}}
        out = io.StringIO()
        with patch('preflight.check', return_value=ready), contextlib.redirect_stdout(out):
            code = sweep.live(args, sweep.plan(args), launch=self.launch)
        return code, out.getvalue()

    def test_budget_stops_cleanly_and_a_rerun_resumes(self):
        selection = ('--topics', 'ד07,ד08,ד09', '--levels', 'b')
        code, text = self.live('--max-calls', '2', '--max-output-tokens', '200000', *selection)
        self.assertEqual(code, 0)
        root = self.scratch / 'sweep'
        summary = json.loads((root / 'summary.json').read_text(encoding='utf-8'))
        # A case spends its draft call and a correction (in the first case the pre-pass names question 9, whose typed
        # task the trusted adapter refuses to print beside its table), then a second draft and a correction; two
        # calls is the hard cap, so the first case is cut short. A case the budget cut short is not a result: no case
        # is done and the rerun runs it again.
        self.assertEqual(summary['thisRun']['calls'], 2)
        self.assertEqual(self.prompts, ['skill_worksheet_content', 'revise_skill_questions'])
        self.assertEqual(summary['thisRun']['notRun'], ['g4-07-b-q12-m30', 'g4-08-b-q12-m30', 'g4-09-b-q12-m30'])
        self.assertIn('not run', text)
        done_first = {p.parent.name for p in root.glob('cases/*/result.json')}
        self.assertEqual(done_first, set())
        # Four calls finish the first case; the budget then runs out between cases and the other two are not started.
        before = len(self.prompts)
        code, text = self.live('--max-calls', '4', '--max-output-tokens', '200000', *selection)
        self.assertEqual(code, 0)
        self.assertIn('3 cases selected, 0 already done, 3 to run', text)
        summary = json.loads((root / 'summary.json').read_text(encoding='utf-8'))
        self.assertEqual((summary['thisRun']['ran'], summary['thisRun']['calls']), (1, 4))
        self.assertEqual(summary['thisRun']['notRun'], ['g4-08-b-q12-m30', 'g4-09-b-q12-m30'])
        self.assertEqual(self.prompts[before:], ['skill_worksheet_content', 'revise_skill_questions'] * 2)
        self.assertIn('not run', text)
        done_second = {p.parent.name for p in root.glob('cases/*/result.json')}
        self.assertEqual(done_second, {'g4-07-b-q12-m30'})
        finished = (root / 'cases/g4-07-b-q12-m30/result.json').read_bytes()
        self.assertFalse(json.loads(finished)['cutByBudget'])
        # The rerun keeps the finished case as it is and resumes the two that were not run.
        before = len(self.prompts)
        code, text = self.live('--max-calls', '20', '--max-output-tokens', '900000', *selection)
        self.assertIn('3 cases selected, 1 already done, 2 to run', text)
        self.assertEqual((root / 'cases/g4-07-b-q12-m30/result.json').read_bytes(), finished)
        summary = json.loads((root / 'summary.json').read_text(encoding='utf-8'))
        self.assertEqual(summary['cases'], 3)
        self.assertEqual(summary['thisRun']['notRun'], [])
        self.assertEqual(set(summary['byGrade']), {'4'})
        self.assertEqual(sum(summary['failureClasses'].values()), 3)
        self.assertEqual(len(self.prompts) - before, 8)
        self.assertEqual(summary['usage']['calls'], len(self.prompts))
        self.assertTrue(summary['costUsd']['scenarios'])
        for attempts in root.glob('cases/*/attempt-*'):
            self.assertTrue((attempts / 'lesson.json').is_file())
            self.assertTrue((attempts / 'outcome.json').is_file())
        # A rerun with the same folder skips every finished case and calls nothing.
        after = len(self.prompts)
        code, text = self.live('--max-calls', '20', '--max-output-tokens', '900000', *selection)
        self.assertIn('3 cases selected, 3 already done, 0 to run', text)
        self.assertEqual((code, len(self.prompts)), (0, after))

    def test_a_stopped_case_is_a_result_and_broken_case_processes_stop_the_run(self):
        root = self.scratch / 'sweep'
        self.launch = lambda attempt, timeout: ('', 'timeout')
        self.live('--max-calls', '10', '--max-output-tokens', '900000', '--topics', 'ד07', '--levels', 'b')
        result = json.loads((root / 'cases/g4-07-b-q12-m30/result.json').read_text(encoding='utf-8'))
        self.assertEqual((result['delivered'], result['failureClass']), (False, 'WORKER:WORKER_INTERRUPTED'))
        summary = json.loads((root / 'summary.json').read_text(encoding='utf-8'))
        # Nothing is known about the stopped process, so its whole reservation is charged.
        self.assertEqual((summary['thisRun']['calls'], summary['thisRun']['outputTokensCharged']), (4, 104_000))
        self.launch = lambda attempt, timeout: ('Traceback: the case process broke', 1)
        _, text = self.live('--max-calls', '40', '--max-output-tokens', '900000', '--topics',
                            'ד08,ד09,ד10,ד11,ד12', '--levels', 'b')
        self.assertIn('Two case processes exited without an outcome', text)
        summary = json.loads((root / 'summary.json').read_text(encoding='utf-8'))
        self.assertEqual(len(summary['thisRun']['notRun']), 5)
        self.assertEqual(summary['thisRun']['ran'], 0)
        self.assertEqual(len(list(root.glob('cases/*/result.json'))), 1)
        self.assertEqual(self.prompts, [])

    def test_a_case_saves_the_lesson_every_reply_usage_and_no_secret(self):
        self.answers = 1
        code, text = self.live('--max-calls', '4', '--max-output-tokens', '200000', '--topics', 'ד07', '--levels', 'b')
        root = self.scratch / 'sweep'
        result = json.loads((root / 'cases/g4-07-b-q12-m30/result.json').read_text(encoding='utf-8'))
        attempt = root / 'cases/g4-07-b-q12-m30' / result['attempt']
        self.assertFalse(result['delivered'])
        self.assertEqual(result['outboundConnectionsRefused'], 0)
        self.assertEqual(result['usage']['calls'], len(self.prompts))
        self.assertEqual(result['calls'][0]['usage'], {'prompt_tokens': 1000, 'completion_tokens': 700})
        self.assertEqual(result['author']['timeoutSeconds'], 300)
        self.assertTrue(result['failureClass'])
        self.assertEqual(json.loads((attempt / 'lesson.json').read_text(encoding='utf-8'))['topicId'], 'ד07')
        self.assertTrue((attempt / 'replies/reply-1.json').is_file())
        self.assertIn('[redacted]', (attempt / 'worker.log').read_text(encoding='utf-8'))
        everything = text + ''.join(p.read_text(encoding='utf-8', errors='replace')
                                    for p in root.rglob('*') if p.is_file() and 'skills' not in p.parts)
        self.assertNotIn(FAKE_KEY, everything)
        self.assertNotIn('Authorization', everything)
        self.assertNotIn('dashscope', everything)


if __name__ == '__main__':
    unittest.main()
