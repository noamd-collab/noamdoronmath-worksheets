"""Worker boundaries with local fakes only: never Auth, Storage, CAPTCHA or paid AI."""
from __future__ import annotations
import copy
import hashlib
import io
import json
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import Mock, patch
from urllib.error import HTTPError

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import remote_worker as worker
from validation import GenerationError

JOB_ID = '22222222-2222-4222-8222-222222222222'
LEASE = '44444444-4444-4444-8444-444444444444'


class FakeRemote:
    def __init__(self):
        self.calls = []
        self.claims = []
        self.fail_updates = False
        self.fail_upload = False
        self.fail_claim = False
        self.bucket = {'id': worker.BUCKET, 'public': False, 'file_size_limit': worker.ARTIFACT_LIMIT,
                       'allowed_mime_types': sorted(worker.ARTIFACT_MIMES)}

    def call(self, path, method='GET', value=None, **kwargs):
        self.calls.append((path, method, copy.deepcopy(value), kwargs))
        if '/rpc/claim_' in path:
            if self.fail_claim: raise RuntimeError('private SQL details')
            return self.claims
        if path == '/storage/v1/bucket/' + worker.BUCKET:
            return self.bucket
        if method == 'GET' and 'limit=0' in path:
            return []
        if method == 'PATCH':
            return [] if self.fail_updates else [{'id': JOB_ID}]
        if '/storage/' in path and self.fail_upload:
            raise RuntimeError('private upstream response details')
        return None

    def uploads(self):
        return [call for call in self.calls if '/storage/v1/object/' in call[0] and call[1] == 'POST']


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.lesson = json.loads((HERE / 'examples/elementary-lesson.json').read_text())
        self.job = {'id': JOB_ID, 'owner_id': worker.OWNER, 'lease_token': LEASE, 'status': 'running',
                    'lease_until': (datetime.now(timezone.utc) + timedelta(minutes=20)).isoformat(), 'lesson': self.lesson}
        self.remote = FakeRemote()

    def rendered(self, lesson, payload, target):
        target.mkdir(parents=True, exist_ok=True)
        artifacts = []
        for kind in ('pdf', 'docx'):
            blob = ('synthetic ' + kind).encode()
            (target / ('sheet.' + kind)).write_bytes(blob)
            artifacts.append({'kind': kind, 'path': 'sheet.' + kind,
                              'sha256': hashlib.sha256(blob).hexdigest(), 'bytes': len(blob)})
        return {'status': 'needs_review', 'automatedChecksPassed': True,
                'skill': {'name': 'elementary', 'version': '1.0.5-noam', 'sha256': 'a' * 64},
                'steps': [{'name': 'fixture-check', 'status': 'PASS', 'log': '/private/sensitive-log.txt'}],
                'artifacts': artifacts, 'debug': 'private model source and local path'}

    def test_startup_readiness_failure_never_constructs_remote_or_advertises(self):
        with patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]), \
             patch.object(worker, 'check_readiness', return_value={'ready': False}) as readiness, \
             patch.object(worker, 'Remote') as remote, redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit) as caught:
                worker.main()
        self.assertEqual(caught.exception.code, 1)
        readiness.assert_called_once_with(require_provider=True)
        remote.assert_not_called()
        self.assertEqual(json.loads(output.getvalue()), {'event': 'worker_not_ready'})

    def test_startup_readiness_precedes_remote_heartbeat_and_claim(self):
        order = []
        def ready(**kwargs):
            order.append('readiness'); return {'ready': True}
        def remote(key):
            order.append('remote'); self.assertEqual(key, 'unit-service-secret'); return self.remote
        with patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]), \
             patch.dict(os.environ, {'TEACHER_GENERATION_SERVICE_KEY': 'unit-service-secret'}), \
             patch.object(worker, 'check_readiness', side_effect=ready), patch.object(worker, 'Remote', side_effect=remote):
            worker.main()
        self.assertEqual(order, ['readiness', 'remote'])
        self.assertIn('/storage/v1/bucket/', self.remote.calls[0][0])
        self.assertIn('noam_teacher_generation_jobs?', self.remote.calls[1][0])
        self.assertIn('/rpc/claim_teacher_generation_job', self.remote.calls[2][0])
        self.assertIn('noam_teacher_generation_workers', self.remote.calls[3][0])
        self.assertEqual(self.root.stat().st_mode & 0o777, 0o700)
        advertised = self.remote.calls[3][2]['capabilities']['topics']
        enabled = {cap['topicId']: cap for cap in advertised if cap.get('enabled')}
        self.assertEqual(set(enabled), {'ג10', 'g7:equations'})
        for topic, count in [('ג10', 12), ('g7:equations', 20)]:
            self.assertIs(enabled[topic]['e2eVerified'], True)
            self.assertEqual(enabled[topic]['levels'], ['b'])
            self.assertEqual(enabled[topic]['questionCounts'], [count])

    def test_check_only_reads_transport_without_claim_heartbeat_model_or_work_directory(self):
        work = self.root / 'must-not-exist'
        with patch.object(sys, 'argv', ['worker', '--check-only', '--work-dir', str(work)]), \
             patch.object(worker, 'check_readiness', return_value={'ready': True}), \
             patch.object(worker, 'Remote', return_value=self.remote), \
             patch.object(worker, 'author_lesson') as author, redirect_stdout(io.StringIO()) as output:
            worker.main()
        author.assert_not_called(); self.assertFalse(work.exists())
        self.assertEqual([c[1] for c in self.remote.calls], ['GET', 'GET'])
        self.assertEqual(json.loads(output.getvalue()), {'event': 'worker_preflight_pass', 'claimVerified': False,
                                                       'providerCalled': False, 'heartbeatWritten': False})

    def test_missing_or_public_or_misconfigured_bucket_never_advertises_or_claims(self):
        for bucket in (None, {}, dict(self.remote.bucket, public=True),
                       dict(self.remote.bucket, file_size_limit=1),
                       dict(self.remote.bucket, allowed_mime_types=['application/pdf'])):
            with self.subTest(bucket=bucket), \
                 patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]), \
                 patch.object(worker, 'check_readiness', return_value={'ready': True}), \
                 patch.object(worker, 'Remote', return_value=self.remote), \
                 patch.object(worker, 'author_lesson') as author, redirect_stdout(io.StringIO()) as output:
                self.remote.calls.clear(); self.remote.bucket = bucket
                with self.assertRaises(SystemExit): worker.main()
                self.assertEqual(json.loads(output.getvalue()), {'event': 'worker_unavailable'})
                self.assertTrue(all(c[1] == 'GET' for c in self.remote.calls)); author.assert_not_called()

    def test_failed_claim_never_refreshes_online_heartbeat_or_calls_model(self):
        self.remote.fail_claim = True
        with patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]), \
             patch.object(worker, 'check_readiness', return_value={'ready': True}), \
             patch.object(worker, 'Remote', return_value=self.remote), \
             patch.object(worker, 'author_lesson') as author, redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(SystemExit): worker.main()
        self.assertEqual(json.loads(output.getvalue()), {'event': 'worker_unavailable'})
        self.assertFalse(any('noam_teacher_generation_workers' in c[0] for c in self.remote.calls))
        author.assert_not_called()

    def test_bucket_becoming_public_during_render_blocks_upload(self):
        def render(lesson, payload, target):
            manifest = self.rendered(lesson, payload, target)
            self.remote.bucket['public'] = True
            return manifest
        with patch.object(worker, 'author_lesson', return_value={}) as paid, \
             patch.object(worker, 'render_job', side_effect=render):
            with self.assertRaisesRegex(RuntimeError, 'PRIVATE_BUCKET_NOT_READY'):
                worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once(); self.assertEqual(self.remote.uploads(), [])

    def test_invalid_owner_topic_or_lease_is_denied_before_paid_authoring(self):
        changes = [{'owner_id': '33333333-3333-4333-8333-333333333333'}, {'id': '../escape'},
                   {'lease_token': None}, {'status': 'queued'},
                   {'lease_until': 'not-a-time'}, {'lease_until': '2099-01-01T00:00:00'},
                   {'lease_until': (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()},
                   {'lesson': dict(self.lesson, topicId='ג99')}]
        for change in changes:
            with self.subTest(change=change), patch.object(worker, 'author_lesson') as author, \
                 patch.object(worker, 'render_job') as renderer:
                with self.assertRaises((RuntimeError, GenerationError)):
                    worker.process_job(self.remote, {**self.job, **change}, self.root)
                author.assert_not_called(); renderer.assert_not_called()

    def test_lease_loss_before_authoring_never_spends_or_renders(self):
        self.remote.fail_updates = True
        with patch.object(worker, 'author_lesson') as author, patch.object(worker, 'render_job') as renderer:
            with self.assertRaisesRegex(RuntimeError, 'JOB_LEASE_LOST'):
                worker.process_job(self.remote, self.job, self.root)
        author.assert_not_called(); renderer.assert_not_called()

    def test_same_root_job_directory_symlink_is_rejected_before_authoring(self):
        other = self.root / 'another-job'; other.mkdir()
        (self.root / JOB_ID).symlink_to(other, target_is_directory=True)
        with patch.object(worker, 'author_lesson') as author:
            with self.assertRaisesRegex(RuntimeError, 'JOB_PATH_DENIED'):
                worker.process_job(self.remote, self.job, self.root)
        author.assert_not_called()

    def test_existing_job_directory_cannot_start_a_second_paid_attempt(self):
        (self.root / JOB_ID).mkdir()
        with patch.object(worker, 'author_lesson') as author:
            with self.assertRaisesRegex(RuntimeError, 'JOB_PATH_DENIED'):
                worker.process_job(self.remote, self.job, self.root)
        author.assert_not_called()

    def test_failed_paid_call_is_attempted_once_and_logs_no_context_or_secret(self):
        self.job['lesson'] = {**self.lesson, 'lastLesson': 'PRIVATE_LESSON_CONTEXT'}
        self.remote.claims = [self.job]
        with patch.object(sys, 'argv', ['worker', '--once', '--work-dir', str(self.root)]), \
             patch.object(worker, 'check_readiness', return_value={'ready': True}), \
             patch.object(worker, 'Remote', return_value=self.remote), \
             patch.object(worker, 'author_lesson', side_effect=GenerationError('PROVIDER_UNAVAILABLE', 'PRIVATE_RESPONSE_SECRET')) as author, \
             patch.object(worker, 'render_job') as renderer, redirect_stdout(io.StringIO()) as output:
            worker.main()
        author.assert_called_once(); renderer.assert_not_called()
        self.assertNotIn('PRIVATE_', output.getvalue())
        event = json.loads(output.getvalue())
        self.assertEqual(event, {'event': 'generation_failed', 'jobId': JOB_ID, 'code': 'PROVIDER_UNAVAILABLE'})
        failures = [call for call in self.remote.calls if call[1] == 'PATCH' and call[2].get('status') == 'failed']
        self.assertEqual(len(failures), 1)
        self.assertEqual(self.remote.uploads(), [])

    def test_lease_loss_after_model_call_does_not_retry_or_render(self):
        def author(_, **kwargs):
            self.remote.fail_updates = True; return {'synthetic': True}
        with patch.object(worker, 'author_lesson', side_effect=author) as paid, patch.object(worker, 'render_job') as renderer:
            with self.assertRaisesRegex(RuntimeError, 'JOB_LEASE_LOST'):
                worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once(); renderer.assert_not_called(); self.assertEqual(self.remote.uploads(), [])

    def test_failed_author_keeps_safe_detail_and_usage_privately_without_retry(self):
        detail = 'author question 4 item 2 derived c: integer outside allowed range'
        def author(lesson, *, metadata):
            metadata.update({'responseReceived': True, 'validated': False, 'requestedModel': 'unit-model',
                             'elapsedSeconds': 3.25, 'authorContract': 'worksheet-parameters/2',
                             'usage': {'prompt_tokens': 100, 'completion_tokens': 150, 'raw': 'PRIVATE_SECRET'},
                             'derivation': {'performed': False, 'raw': 'PRIVATE_SECRET'},
                             'validationError': {'code': 'INVALID_MODEL_OUTPUT', 'detail': detail},
                             'headers': {'Authorization': 'PRIVATE_SECRET'}, 'response': 'PRIVATE_SECRET'})
            raise GenerationError('INVALID_MODEL_OUTPUT', detail)
        with patch.object(worker, 'author_lesson', side_effect=author) as paid, patch.object(worker, 'render_job') as renderer:
            with self.assertRaisesRegex(GenerationError, 'derived c'):
                worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once(); renderer.assert_not_called()
        path = self.root / 'author-diagnostics' / (JOB_ID + '.json')
        record = json.loads(path.read_text())
        self.assertEqual(record['validationDetail'], detail)
        self.assertEqual(record['usage'], {'prompt_tokens': 100, 'completion_tokens': 150})
        self.assertFalse(record['derivationPerformed'])
        self.assertEqual(record['outcome'], 'failed')
        self.assertNotIn('PRIVATE_', path.read_text())
        self.assertNotIn('lesson', record)
        self.assertEqual(path.stat().st_mode & 0o777, 0o600)
        self.assertEqual(path.parent.stat().st_mode & 0o777, 0o700)
        self.assertFalse((self.root / JOB_ID).exists())
        self.assertEqual(self.remote.uploads(), [])
        self.assertFalse(any('validationDetail' in json.dumps(c) for c in self.remote.calls))

    def test_diagnostics_keep_only_known_author_contract_versions(self):
        for index, contract in enumerate(('worksheet-parameters/2', 'worksheet-parameters/3',
                                          'worksheet-parameters/4', 'PRIVATE_SECRET', None, {'raw': 'PRIVATE_SECRET'})):
            with self.subTest(contract=contract):
                job_id = '33333333-3333-4333-8333-%012d' % index
                self.assertTrue(worker.save_author_diagnostics(self.root, job_id, {'authorContract': contract}))
                path = self.root / 'author-diagnostics' / (job_id + '.json')
                record = json.loads(path.read_text())
                if index < 2:
                    self.assertEqual(record['authorContract'], contract)
                else:
                    self.assertNotIn('authorContract', record)
                self.assertNotIn('PRIVATE_SECRET', path.read_text())

    def test_safe_validation_details_include_exact_v3_rules_only(self):
        for detail in ('Expected author parameter contract version 3',
                       'author question 20 item 6: expected fields a,solution'):
            with self.subTest(detail=detail):
                self.assertEqual(worker.safe_validation_detail(detail), detail)
        for detail in ('Expected author parameter contract version 4',
                       'author question 20 item 6: expected fields a,solution,PRIVATE_SECRET',
                       'author question 20 item 6: expected fields a,solution\nPRIVATE_SECRET'):
            with self.subTest(detail=detail):
                self.assertIsNone(worker.safe_validation_detail(detail))

    def test_diagnostics_omit_arbitrary_exception_content_and_keep_parse_rule(self):
        metadata = {'validationError': {'code': 'INVALID_MODEL_OUTPUT', 'detail': 'PRIVATE_SECRET'},
                    'usage': {'total_tokens': -1}, 'responseModel': 'PRIVATE/SECRET', 'elapsedSeconds': float('inf')}
        self.assertTrue(worker.save_author_diagnostics(self.root, JOB_ID, metadata,
                        GenerationError('INVALID_MODEL_OUTPUT', 'Duplicate model JSON key')))
        record = (self.root / 'author-diagnostics' / (JOB_ID + '.json')).read_text()
        self.assertNotIn('PRIVATE_', record)
        self.assertIn('Duplicate model JSON key', record)
        other_id = '33333333-3333-4333-8333-333333333333'
        self.assertTrue(worker.save_author_diagnostics(self.root, other_id, metadata,
                        GenerationError('INVALID_MODEL_OUTPUT', 'PRIVATE_SECRET')))
        second = (self.root / 'author-diagnostics' / (other_id + '.json')).read_text()
        self.assertNotIn('PRIVATE_', second)
        self.assertNotIn('validationDetail', second)

    def test_diagnostics_refuse_symlinks_and_preserve_existing_attempt_evidence(self):
        other = self.root / 'other'; other.mkdir()
        folder = self.root / 'author-diagnostics'
        folder.symlink_to(other, target_is_directory=True)
        self.assertFalse(worker.save_author_diagnostics(self.root, JOB_ID, {}))
        self.assertEqual(list(other.iterdir()), [])
        folder.unlink(); folder.mkdir()
        evidence = folder / (JOB_ID + '.json'); evidence.write_text('earlier attempt')
        self.assertFalse(worker.save_author_diagnostics(self.root, JOB_ID, {}))
        self.assertEqual(evidence.read_text(), 'earlier attempt')

    def test_diagnostic_io_failure_preserves_original_failure_and_no_retry(self):
        with patch.object(worker, 'author_lesson', side_effect=GenerationError('INVALID_MODEL_OUTPUT', 'PRIVATE_SECRET')) as paid, \
             patch.object(worker, 'save_author_diagnostics', return_value=False), \
             patch.object(worker, 'render_job') as renderer, redirect_stdout(io.StringIO()) as output:
            with self.assertRaises(GenerationError) as caught:
                worker.process_job(self.remote, self.job, self.root)
        self.assertEqual(caught.exception.code, 'INVALID_MODEL_OUTPUT')
        paid.assert_called_once(); renderer.assert_not_called()
        self.assertNotIn('PRIVATE_', output.getvalue())

    def test_success_uploads_only_hash_verified_two_artifacts_and_bounded_public_provenance(self):
        with patch.object(worker, 'author_lesson', return_value={'synthetic': True}) as paid, \
             patch.object(worker, 'render_job', side_effect=self.rendered):
            worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once()
        self.assertEqual(len(self.remote.uploads()), 2)
        for call in self.remote.uploads():
            self.assertTrue(call[0].startswith('/storage/v1/object/teacher-generation-private/' + worker.OWNER + '/' + JOB_ID + '/sheet.'))
        patches = [call for call in self.remote.calls if call[1] == 'PATCH']
        self.assertTrue(all('lease_token=eq.' + LEASE in call[0] and 'status=eq.running' in call[0]
                            and 'lease_until=gt.' in call[0] for call in patches))
        completion = patches[-1][2]
        self.assertEqual(completion['status'], 'needs_review')
        self.assertIsNone(completion['lease_token']); self.assertIsNone(completion['lease_until'])
        result = completion['result']
        self.assertEqual(set(result), {'version', 'automatedChecksPassed', 'humanReviewRequired', 'skill', 'artifacts', 'checks'})
        self.assertIs(result['humanReviewRequired'], True)
        self.assertNotIn('private', json.dumps(result)); self.assertNotIn('lesson', result)
        self.assertTrue(all(set(a) == {'kind', 'sha256', 'bytes'} for a in result['artifacts']))

    def test_failed_gate_or_artifact_escape_never_uploads_or_completes(self):
        for failure in ('gate', 'string_true', 'hash', 'escape'):
            with self.subTest(failure=failure):
                remote = FakeRemote()
                case_root = self.root / failure; case_root.mkdir()
                def render(lesson, payload, target):
                    manifest = self.rendered(lesson, payload, target)
                    if failure == 'gate': manifest['steps'][0]['status'] = 'FAIL'
                    if failure == 'string_true': manifest['automatedChecksPassed'] = 'true'
                    if failure == 'hash': manifest['artifacts'][0]['sha256'] = '0' * 64
                    if failure == 'escape': manifest['artifacts'][0]['path'] = '../../outside.pdf'
                    return manifest
                with patch.object(worker, 'author_lesson', return_value={}) as paid, patch.object(worker, 'render_job', side_effect=render):
                    with self.assertRaises((RuntimeError, GenerationError)):
                        worker.process_job(remote, self.job, case_root)
                paid.assert_called_once(); self.assertEqual(remote.uploads(), [])
                self.assertFalse(any(call[2].get('status') == 'needs_review' for call in remote.calls if call[1] == 'PATCH'))

    def test_upload_failure_never_sets_review_status_or_repeats_paid_call(self):
        self.remote.fail_upload = True
        with patch.object(worker, 'author_lesson', return_value={}) as paid, patch.object(worker, 'render_job', side_effect=self.rendered):
            with self.assertRaises(RuntimeError): worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once()
        self.assertFalse(any(call[2].get('status') == 'needs_review' for call in self.remote.calls if call[1] == 'PATCH'))

    def test_remote_denies_redirects_limits_responses_and_omits_http_error_body(self):
        remote = worker.Remote('unit-service-secret')
        with self.assertRaisesRegex(RuntimeError, 'REMOTE_PATH_DENIED'): remote.call('https://attacker.example/')
        with self.assertRaisesRegex(RuntimeError, 'REMOTE_REDIRECT_DENIED'):
            worker.NoRedirect().redirect_request(None, None, 302, 'Found', {}, 'https://attacker.example/')
        response = Mock(); response.read.return_value = b'x' * 256001
        response.__enter__ = Mock(return_value=response); response.__exit__ = Mock(return_value=False)
        remote._opener = Mock(); remote._opener.open.return_value = response
        with self.assertRaisesRegex(RuntimeError, 'REMOTE_RESPONSE_TOO_LARGE'): remote.call('/rest/v1/test')
        response.read.assert_called_once_with(256001)
        remote._opener.open.side_effect = HTTPError('https://fixed.invalid', 500, 'PRIVATE_RESPONSE_SECRET', {}, io.BytesIO(b'PRIVATE_BODY'))
        with self.assertRaisesRegex(RuntimeError, '^REMOTE_HTTP_500$'): remote.call('/rest/v1/test')

    def test_env_file_is_literal_allowlist_and_includes_dashscope_alias(self):
        env = self.root / 'worker.env'
        env.write_text('DASHSCOPE_API_KEY="unit-dash-key"\nQWEN_MODEL=unit-model\nPYTHONPATH=/untrusted\nHOME=/untrusted\nUNSUPPORTED_SECRET=no\n')
        with patch.dict(os.environ, {}, clear=True):
            worker.load_env(env)
            self.assertEqual(dict(os.environ), {'DASHSCOPE_API_KEY': 'unit-dash-key', 'QWEN_MODEL': 'unit-model'})


if __name__ == '__main__': unittest.main()
