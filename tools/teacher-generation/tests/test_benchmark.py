import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import benchmark
from validation import GenerationError


class BenchmarkTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.out = Path(self.tmp.name) / 'new-attempt'
        self.lesson = Path(self.tmp.name) / 'lesson-v2.json'
        lesson = json.loads((HERE / 'examples/elementary-lesson.json').read_text())
        lesson.update(version=2, lessonBoundary={'version':1,'kind':'division_facts','allowedDivisors':list(range(1,11)),'maxDividend':100})
        self.lesson.write_text(json.dumps(lesson))
        self.metadata = {'requestedModel': 'qwen3.8-flash', 'responseModel': 'qwen3.8-flash',
                         'usage': {'prompt_tokens': 1000, 'completion_tokens': 2000}, 'elapsedSeconds': 1.2}

    def author(self, lesson, *, metadata):
        metadata.update(self.metadata)
        return {'fixture': True}

    def manifest(self, passed=True):
        return {'automatedChecksPassed': passed, 'steps': [{'name': 'fixture-gate', 'status': 'PASS' if passed else 'FAIL'}],
                'artifacts': [{'kind': 'pdf', 'path': 'sheet.pdf'}, {'kind': 'docx', 'path': 'sheet.docx'}] if passed else []}

    def test_legacy_benchmark_requires_explicit_offline_opt_in(self):
        legacy = HERE / 'examples/elementary-lesson.json'
        with patch('benchmark.check', return_value={'ready': True}), patch('benchmark.author_lesson') as author:
            denied = benchmark.run_benchmark(legacy, self.out)
            self.assertEqual(denied['status'], 'failed')
            self.assertEqual(denied['error']['code'], 'LESSON_VERSION_REQUIRES_NEW_DRAFT')
            allowed = benchmark.run_benchmark(legacy, self.out.parent / 'legacy-explicit', allow_legacy=True)
            self.assertEqual(allowed['status'], 'dry_run_ready')
            author.assert_not_called()

    def test_default_dry_run_never_authors_or_renders(self):
        with patch('benchmark.check', return_value={'ready': True}) as check, patch('benchmark.author_lesson') as author, patch('benchmark.render_job') as render:
            result = benchmark.run_benchmark(self.lesson, self.out)
        check.assert_called_once_with(require_provider=False)
        author.assert_not_called();render.assert_not_called()
        self.assertEqual(result['status'], 'dry_run_ready')
        self.assertEqual(result['authorAttempts'], 0)
        self.assertFalse((self.out / 'attempt.json').exists())
        self.assertEqual(json.loads((self.out / 'benchmark-report.json').read_text()), result)

    def test_explicit_call_is_once_after_locked_preflight_then_render(self):
        with patch('benchmark.check', return_value={'ready': True}) as check, patch('benchmark.author_lesson', side_effect=self.author) as author, patch('benchmark.render_job', return_value=self.manifest()) as render:
            result = benchmark.run_benchmark(self.lesson, self.out, call=True)
        check.assert_called_once_with(require_provider=True)
        author.assert_called_once();render.assert_called_once()
        self.assertEqual(result['status'], 'needs_review')
        self.assertTrue((self.out / 'attempt.json').exists())
        self.assertEqual(result['comparison']['automaticallyPassedWorksheetCount'], 1)
        self.assertEqual(result['humanReview']['acceptedWorksheetCount'], 0)
        self.assertIsNone(result['comparison']['apiCostPerHumanAcceptedWorksheetUsd'])

    def test_existing_empty_or_used_output_is_not_overwritten_or_retried(self):
        self.out.mkdir()
        for existing_content in (False, True):
            if existing_content:(self.out / 'prior.json').write_text('retained')
            with patch('benchmark.author_lesson') as author, self.assertRaises(GenerationError) as caught:
                benchmark.run_benchmark(self.lesson, self.out, call=True)
            self.assertEqual(caught.exception.code, 'OUTPUT_EXISTS');author.assert_not_called()
        self.assertEqual((self.out / 'prior.json').read_text(), 'retained')

    def test_failed_preflight_never_calls_and_preserves_report(self):
        with patch('benchmark.check', return_value={'ready': False}) as check, patch('benchmark.author_lesson') as author:
            result = benchmark.run_benchmark(self.lesson, self.out, call=True)
        check.assert_called_once_with(require_provider=True);author.assert_not_called()
        self.assertEqual(result['error'], {'phase': 'preflight', 'code': 'PREFLIGHT_FAILED'})
        self.assertTrue((self.out / 'benchmark-report.json').is_file())

    def test_invalid_lesson_never_calls_or_runs_preflight(self):
        bad = Path(self.tmp.name) / 'bad.json';bad.write_text('{"version":1,"gradeNumber":9,"topicId":"not-supported"}')
        with patch('benchmark.check') as check, patch('benchmark.author_lesson') as author:
            result = benchmark.run_benchmark(bad, self.out, call=True)
        check.assert_not_called();author.assert_not_called()
        self.assertEqual(result['error']['code'], 'UNSUPPORTED_TOPIC')

    def test_failed_author_keeps_cost_safe_validation_reason_and_never_retries(self):
        def fail(lesson, *, metadata):
            self.author(lesson, metadata=metadata)
            metadata['validationError'] = {'code': 'WRONG_ANSWER', 'detail': 'Arithmetic answer does not match independently computed result'}
            raise GenerationError('WRONG_ANSWER', 'DO-NOT-PRINT-RAW-BODY-OR-SECRET')
        with patch('benchmark.check', return_value={'ready': True}), patch('benchmark.author_lesson', side_effect=fail) as author, patch('benchmark.render_job') as render:
            result = benchmark.run_benchmark(self.lesson, self.out, call=True)
        author.assert_called_once();render.assert_not_called()
        self.assertEqual(result['author']['usage']['completion_tokens'], 2000)
        self.assertEqual(result['cost']['estimatedRangeUsd'], {'low': '0.000877000', 'high': '0.001090000'})
        self.assertIsNone(result['comparison']['apiCostPerAutomaticallyPassedWorksheetUsd'])
        self.assertNotIn('DO-NOT-PRINT', (self.out / 'benchmark-report.json').read_text())

    def test_failed_gate_cannot_appear_as_accepted_output(self):
        with patch('benchmark.check', return_value={'ready': True}), patch('benchmark.author_lesson', side_effect=self.author), patch('benchmark.render_job', return_value=self.manifest(False)):
            result = benchmark.run_benchmark(self.lesson, self.out, call=True)
        self.assertFalse(result['automatedChecksPassed'])
        self.assertEqual(result['artifacts'], [])
        self.assertEqual(result['gates'][0]['status'], 'FAIL')
        self.assertEqual(result['error']['code'], 'RENDER_GATES_FAILED')

    def test_missing_tokens_unknown_model_and_tier_do_not_claim_zero_cost(self):
        for metadata in ({'requestedModel': 'qwen3.8-flash'}, {**self.metadata, 'responseModel': 'different-model'}, {**self.metadata, 'usage': {'prompt_tokens': 1_000_001, 'completion_tokens': 1}}):
            self.assertIsNone(benchmark.api_cost(metadata)['estimatedRangeUsd'])

    def test_cli_defaults_to_dry_run_and_only_flag_enables_call(self):
        with patch('benchmark.run_benchmark', return_value={'status': 'dry_run_ready', 'authorAttempts': 0, 'automatedChecksPassed': False}) as run, patch('builtins.print'):
            self.assertEqual(benchmark.main(['--lesson', str(self.lesson), '--out', str(self.out)]), 0)
        self.assertFalse(run.call_args.kwargs['call'])


if __name__ == '__main__':
    unittest.main()
