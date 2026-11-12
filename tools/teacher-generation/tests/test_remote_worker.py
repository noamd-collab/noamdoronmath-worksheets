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

    def call(self, path, method='GET', value=None, **kwargs):
        self.calls.append((path, method, copy.deepcopy(value), kwargs))
        if '/rpc/claim_' in path:
            return self.claims
        if method == 'PATCH':
            return [] if self.fail_updates else [{'id': JOB_ID}]
        if '/storage/' in path and self.fail_upload:
            raise RuntimeError('private upstream response details')
        return None

    def uploads(self):
        return [call for call in self.calls if '/storage/' in call[0]]


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
        self.assertIn('noam_teacher_generation_workers', self.remote.calls[0][0])
        self.assertIn('/rpc/claim_teacher_generation_job', self.remote.calls[1][0])
        self.assertEqual(self.root.stat().st_mode & 0o777, 0o700)
        advertised = self.remote.calls[0][2]['capabilities']['topics']
        enabled = {cap['topicId']: cap for cap in advertised if cap.get('enabled')}
        self.assertEqual(set(enabled), {'ג10', 'g7:equations'})
        for topic, count in [('ג10', 12), ('g7:equations', 20)]:
            self.assertIs(enabled[topic]['e2eVerified'], True)
            self.assertEqual(enabled[topic]['levels'], ['b'])
            self.assertEqual(enabled[topic]['questionCounts'], [count])

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
        def author(_):
            self.remote.fail_updates = True; return {'synthetic': True}
        with patch.object(worker, 'author_lesson', side_effect=author) as paid, patch.object(worker, 'render_job') as renderer:
            with self.assertRaisesRegex(RuntimeError, 'JOB_LEASE_LOST'):
                worker.process_job(self.remote, self.job, self.root)
        paid.assert_called_once(); renderer.assert_not_called(); self.assertEqual(self.remote.uploads(), [])

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
