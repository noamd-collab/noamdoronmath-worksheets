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
from urllib.parse import parse_qs, urlsplit

HERE = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import remote_worker as worker
from validation import GenerationError

JOB_ID = '22222222-2222-4222-8222-222222222222'
LEASE = '44444444-4444-4444-8444-444444444444'
TEACHER_A = '11111111-1111-4111-8111-111111111111'
TEACHER_B = '33333333-3333-4333-8333-333333333333'


class FakeRemote:
    def __init__(self):
        self.calls = []
        self.claims = []
        self.fail_updates = False
        self.job_owners = {JOB_ID:TEACHER_A}
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
            params = parse_qs(urlsplit(path).query)
            ident = params['id'][0].removeprefix('eq.')
            actor = self.job_owners.get(ident)
            if self.fail_updates or params.get('owner_id') != ['eq.' + str(actor)]: return []
            return [{'id':ident,'owner_id':actor}]
        if '/storage/' in path and self.fail_upload:
            raise RuntimeError('private upstream response details')
        return None

    def uploads(self):
        return [call for call in self.calls if '/storage/v1/object/' in call[0] and call[1] == 'POST']


class FakeDraft:
    """Stands in for general_provider.Draft: the methods the worker's ladder drives, and a count of each use."""

    def __init__(self, lesson, *, missing=(), reserves=0, code='SOURCE_ANSWER', can_shorten=False, fix=True):
        self.requested = self.lesson = lesson
        self._missing, self.reserves, self.code, self.can_shorten, self.fix = list(missing), reserves, code, can_shorten, fix
        self.corrections = self.sourced = 0
        self.replaced, self.swapped, self.dropped = [], 0, 0
        self.on_correct = None

    def missing(self):
        return list(self._missing)

    def needs_model(self):
        return bool(self._missing)

    def first_refusal(self):
        from general_source import GeneralSourceError
        return GeneralSourceError(self.code, 'A planned question was refused and nothing replaced it')

    def correct(self):
        self.corrections += 1
        if self.on_correct is not None:
            self.on_correct()
        if self.fix:
            self.swapped += len(self._missing)
            self._missing = []

    def shorten(self):
        if not (self._missing and self.can_shorten):
            return False
        self.dropped += len(self._missing)
        self.lesson = {**self.requested, 'questionCount': self.requested['questionCount'] - self.dropped}
        self._missing = []
        return True

    def source(self):
        if self._missing:
            raise self.first_refusal()
        self.sourced += 1
        return 'sheet-%d' % (self.sourced - 1)

    def replace(self, named, stage='gate'):
        self.replaced.append({question: list(codes) for question, codes in named.items()})
        for question in named:
            if self.reserves:
                self.reserves -= 1
                self.swapped += 1
            else:
                self._missing.append(question)
        return len(named)

    def report(self):
        codes = {}
        for named in self.replaced:
            for found in named.values():
                for code in found[:1]:
                    codes[code] = codes.get(code, 0) + 1
        return {'planned': self.requested['questionCount'], 'printed': self.lesson['questionCount'],
                'replaced': self.swapped, 'byReserve': 0, 'byCorrection': 0, 'dropped': self.dropped, 'missing': 0,
                'reservesOffered': 0, 'reservesRefused': 0, 'codes': codes, 'replacedCodes': codes,
                'droppedCodes': {self.code: self.dropped} if self.dropped else {}, 'corrections': self.corrections}


class WorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.lesson = json.loads((HERE / 'examples/elementary-lesson.json').read_text())
        self.lesson.update(version=2, lessonBoundary={'version':1,'kind':'division_facts','allowedDivisors':list(range(1,11)),'maxDividend':100})
        self.job = {'id': JOB_ID, 'owner_id': TEACHER_A, 'lease_token': LEASE, 'status': 'running',
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

    def test_queued_legacy_intake_is_rejected_before_any_paid_call(self):
        self.lesson['version'] = 1
        del self.lesson['lessonBoundary']
        with patch.object(worker, 'author_lesson') as author, patch.object(worker, 'render_job') as renderer:
            with self.assertRaises(GenerationError) as caught:
                worker.process_job(self.remote, self.job, self.root)
            self.assertEqual(caught.exception.code, 'LESSON_VERSION_REQUIRES_NEW_DRAFT')
            author.assert_not_called(); renderer.assert_not_called()
            self.assertEqual(self.remote.calls, [])

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
        advertised_caps = self.remote.calls[3][2]['capabilities']
        self.assertEqual(advertised_caps['acceptedIntakeVersions'], [2, 3])
        self.assertEqual(advertised_caps['trialActorIsolation'], 1)
        self.assertLessEqual(len(json.dumps(advertised_caps, ensure_ascii=False).encode()), 65536)
        advertised = self.remote.calls[3][2]['capabilities']['topics']
        enabled = {cap['topicId']: cap for cap in advertised if cap.get('enabled')}
        self.assertEqual(len(enabled), 232)
        self.assertFalse(any(t.get('e2eVerified') for t in advertised))
        self.assertTrue(all(t['readiness']=='private_draft' for t in advertised))
        for topic, count in [('ג10', 12), ('g7:equations', 20)]:
            self.assertIs(enabled[topic]['legacy']['e2eVerified'], True)
            self.assertEqual(enabled[topic]['legacy']['levels'], ['b'])
            self.assertEqual(enabled[topic]['legacy']['questionCounts'], [count])

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
        changes = [{'owner_id': None}, {'owner_id': '../invalid'}, {'id': '../escape'},
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

    def test_each_admitted_account_uploads_only_to_the_claimed_owner_and_job(self):
        other_job = '55555555-5555-4555-8555-555555555555'
        self.remote.job_owners[other_job] = TEACHER_B
        for job_id, actor in self.remote.job_owners.items():
            with patch.object(worker,'author_lesson',return_value={}), patch.object(worker,'render_job',side_effect=self.rendered):
                worker.process_job(self.remote,{**self.job,'id':job_id,'owner_id':actor},self.root)
        expected = {'/storage/v1/object/' + worker.BUCKET + '/' + actor + '/' + job + '/sheet.' + kind
                    for job,actor in self.remote.job_owners.items() for kind in ('pdf','docx')}
        self.assertEqual({row[0] for row in self.remote.uploads()},expected)
        for url, method, _, _ in self.remote.calls:
            if method == 'PATCH':
                params = parse_qs(urlsplit(url).query)
                self.assertEqual(params['select'],['id,owner_id'])
                self.assertEqual(params['owner_id'],['eq.' + self.remote.job_owners[params['id'][0][3:]]])

    def test_mismatched_durable_owner_cannot_start_authoring_or_publish_artifacts(self):
        with patch.object(worker,'author_lesson') as paid, patch.object(worker,'render_job') as render:
            with self.assertRaisesRegex(RuntimeError,'JOB_LEASE_LOST'):
                worker.process_job(self.remote,{**self.job,'owner_id':TEACHER_B},self.root)
        paid.assert_not_called()
        render.assert_not_called()
        self.assertFalse(self.remote.uploads())

    def test_lost_owner_or_lease_during_render_prevents_both_uploads(self):
        def render(*args):
            result=self.rendered(*args)
            self.remote.fail_updates=True
            return result
        with patch.object(worker,'author_lesson',return_value={}), patch.object(worker,'render_job',side_effect=render):
            with self.assertRaisesRegex(RuntimeError,'JOB_LEASE_LOST'):
                worker.process_job(self.remote,self.job,self.root)
        self.assertFalse(self.remote.uploads())

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
        # One sanitised line: the code, and where the job failed.
        self.assertEqual(event, {'event': 'generation_failed', 'jobId': JOB_ID, 'code': 'PROVIDER_UNAVAILABLE',
                                 'stage': 'author', 'question': None, 'gate': None})
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

    def test_plain_math_failure_reports_one_bounded_correction_receipt(self):
        self.use_general_lesson()
        for attempted in (True, False):
            with self.subTest(attempted=attempted):
                root = self.root / str(attempted)
                root.mkdir()
                def author(_, *, revision, metadata, **kw):
                    metadata.update(initialPlainMath=True, validated=False, data="PRIVATE_RESPONSE")
                    if attempted:
                        draft = FakeDraft(self.job['lesson'], missing=[4], code="SOURCE_PLAIN_MATH")
                        def correct():
                            metadata["correctionRequested"] = True
                            raise GenerationError("SOURCE_PLAIN_MATH","PRIVATE_SECOND_RESPONSE")
                        draft.on_correct = correct
                        revision["draft"] = draft
                    raise GenerationError("SOURCE_PLAIN_MATH","PRIVATE_INITIAL_RESPONSE")
                with patch.object(worker,"author_lesson",side_effect=author), redirect_stdout(io.StringIO()) as captured:
                    with self.assertRaises(GenerationError):
                        worker.process_job(self.remote,self.job,root,enable_skill_revision=True)
                self.assertEqual(json.loads(captured.getvalue()),
                                 {"event":"source_notation_recovery","jobId":JOB_ID,
                                  "correctionRequested":attempted,"sourceValidated":False})
        self.assertFalse(self.remote.uploads())

    def test_diagnostics_keep_only_known_author_contract_versions(self):
        known = ('worksheet-parameters/2', 'worksheet-parameters/3', 'no-carry-addition/1',
                 'square-introduction/1', 'intro-algebra/1', 'intro-arithmetic/1')
        for index, contract in enumerate((*known, 'worksheet-parameters/4', 'PRIVATE_SECRET', None, {'raw': 'PRIVATE_SECRET'})):
            with self.subTest(contract=contract):
                job_id = '33333333-3333-4333-8333-%012d' % index
                self.assertTrue(worker.save_author_diagnostics(self.root, job_id, {'authorContract': contract}))
                path = self.root / 'author-diagnostics' / (job_id + '.json')
                record = json.loads(path.read_text())
                if contract in known:
                    self.assertEqual(record['authorContract'], contract)
                else:
                    self.assertNotIn('authorContract', record)
                self.assertNotIn('PRIVATE_SECRET', path.read_text())

    def test_safe_validation_details_include_exact_v3_rules_only(self):
        for detail in ('Expected author parameter contract version 3',
                       'author question 20 item 6: expected fields a,solution',
                       'Unsupported text span at q2.table.row.12.6'):
            with self.subTest(detail=detail):
                self.assertEqual(worker.safe_validation_detail(detail), detail)
        for detail in ('Expected author parameter contract version 4', 'Unsupported text span at q2.table.PRIVATE_SECRET',
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
            self.assertTrue(call[0].startswith('/storage/v1/object/teacher-generation-private/' + TEACHER_A + '/' + JOB_ID + '/sheet.'))
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

    def use_general_lesson(self):
        self.job['lesson'] = json.loads((HERE / 'cloud/container/fixtures/general/grade4-fractions/lesson.json').read_text())

    def failed_gate(self, lesson, payload, target, gate='content-truth', question=2, **kwargs):
        # Exercise the actual skill-report parser. Its private prose must not escape.
        target.mkdir(parents=True, exist_ok=True)
        (target / 'logs').mkdir()
        (target / 'logs/content-truth.txt').write_text(
            'CONTENT-TRUTH GATES: FAIL\n ✗ G32  [content.json.questions#%d]  טענה כוללת/שלילת קיום PRIVATE_TEXT\n'
            '1 blocking content defect(s). Do not deliver.\n' % question)
        # As the runner records a failed step and its delivery decision (gate_policy.decide).
        named = gate == 'content-truth'
        manifest = {'status': 'failed', 'skill': {'name': 'elementary'},
                    'steps': [{'name': 'trusted-adapter', 'status': 'PASS'},
                              {'name': gate, 'status': 'FAIL', 'exitCode': 1, 'log': 'logs/' + gate + '.txt'}], 'artifacts': [],
                    'gate': {'version': 1, 'action': 'replace' if named else 'fail', 'complete': True,
                             'blocking': [{'code': 'G32', 'class': 'truth', 'step': gate, 'question': question}] if named
                             else [{'code': 'PDF_BUILD', 'class': 'truth', 'step': gate}],
                             'questions': [question] if named else [], 'review': []}}
        (target / 'manifest.json').write_text(json.dumps(manifest))
        (target / 'sheet.pdf').write_bytes(b'first failed private draft')
        return manifest

    def rendered_general(self, lesson, payload, target, **kwargs):
        # As render_job reports a version 3 sheet: REVIEW steps are allowed, the profile is named.
        manifest = self.rendered(lesson, payload, target)
        manifest.update(authoringProfile='general-skill-source/v1', renderingChecksPassed=True,
                        reviewFindings=[], unverifiedAnswers=[{'question': 2, 'item': 1, 'kind': 'open'},
                                                              {'question': 5, 'item': 3, 'kind': 'open'}])
        return manifest

    def clean_precheck(self, lesson, payload, target, **kwargs):
        return {'version': 1, 'status': 'clean', 'steps': [], 'gate': {'action': 'deliver', 'blocking': [], 'questions': []}}

    def general_author(self, drafts, *, received=True, fail=None):
        """An author that hands the worker one prepared draft per call, as the general provider does."""
        calls = []
        def author(_, *, metadata, revision, timeout):
            self.assertEqual(timeout, 300)
            calls.append(revision)
            revision['requested'] = True
            failure = fail[len(calls) - 1] if fail and len(calls) <= len(fail) else None
            if failure is not None and not received:
                raise failure
            revision['replyReceived'] = True
            draft = drafts[len(calls) - 1] if len(calls) <= len(drafts) else None
            if draft is not None:
                revision['draft'] = draft
            if failure is not None:
                raise failure
            return draft.source() if draft is not None else 'first'
        author.calls = calls
        return author

    def run_general(self, author, render, *, root=None, remote=None, precheck=None):
        with patch.object(worker, 'author_lesson', side_effect=author) as initial, \
             patch.object(worker, 'render_job', side_effect=render) as renderer, \
             patch.object(worker, 'precheck_job', side_effect=precheck or self.clean_precheck) as checker:
            worker.process_job(remote or self.remote, self.job, root or self.root, enable_skill_revision=True)
        return initial, renderer, checker

    def final_result(self, remote=None):
        return next(c[2]['result'] for c in (remote or self.remote).calls if c[1] == 'PATCH' and c[2].get('result'))

    def test_production_enables_the_repair_ladder_with_its_hard_limits(self):
        self.assertIs(worker.ENABLE_SKILL_REVISION, True)
        self.assertIs(worker.process_job.__kwdefaults__["enable_skill_revision"], True)
        self.assertEqual((worker.AUTHOR_CALLS, worker.CORRECTION_CALLS, worker.MODEL_CALL_WINDOW), (2, 2, 150))
        self.assertEqual((worker.PRECHECK_PASSES, worker.FULL_RENDERS), (2, 2))

    def test_ladder_does_not_reach_legacy_or_disabled_v3(self):
        for mode in ('legacy-enabled', 'general-disabled'):
            with self.subTest(mode=mode), patch.object(worker, 'author_lesson', return_value={}) as author, \
                 patch.object(worker, 'render_job', side_effect=self.rendered) as renderer, \
                 patch.object(worker, 'precheck_job') as precheck:
                case = self.root / mode
                case.mkdir()
                if mode == 'general-disabled':
                    self.use_general_lesson()
                    worker.process_job(self.remote, self.job, case, enable_skill_revision=False)
                else:
                    worker.process_job(self.remote, self.job, case, enable_skill_revision=True)
                self.assertNotIn('revision', author.call_args.kwargs)
                precheck.assert_not_called()
                # One render, straight into the job folder.
                self.assertEqual(renderer.call_args.args[2], case / JOB_ID)

    def test_a_gate_named_question_is_swapped_and_only_the_final_pair_is_uploaded(self):
        self.use_general_lesson()
        draft = FakeDraft(self.job['lesson'], reserves=1)
        folders = []
        def render(lesson, payload, target, **kwargs):
            folders.append(target)
            self.assertFalse(target.exists())   # every render gets a folder nothing has used
            if len(folders) == 1:
                return self.failed_gate(lesson, payload, target)
            return self.rendered_general(lesson, payload, target)
        initial, renderer, checker = self.run_general(self.general_author([draft]), render)
        initial.assert_called_once()
        self.assertEqual(draft.replaced, [{2: ['G32']}])      # the gate's own question and code
        self.assertEqual(draft.corrections, 0)                 # a reserve filled it: no model call
        self.assertEqual(renderer.call_count, 2)
        self.assertEqual(len(set(folders)), 2)
        self.assertTrue(all(folder.parent == self.root / JOB_ID for folder in folders))
        self.assertEqual([c[3]['raw'] for c in self.remote.uploads()], [b'synthetic pdf', b'synthetic docx'])
        phases = [c[2]['phase'] for c in self.remote.calls if c[1] == 'PATCH' and 'phase' in c[2]]
        self.assertEqual(phases, ['authoring', 'rendering', 'rendering', 'checking', 'needs_review'])
        self.assertNotIn('PRIVATE_TEXT', json.dumps(self.final_result(), ensure_ascii=False))

    def test_reserves_exhausted_spends_one_correction_then_rechecks_the_lease(self):
        self.use_general_lesson()
        draft = FakeDraft(self.job['lesson'])
        def render(lesson, payload, target, **kwargs):
            return self.failed_gate(lesson, payload, target) if payload == 'sheet-0' else self.rendered_general(lesson, payload, target)
        def correct():
            phases = [c[2]['phase'] for c in self.remote.calls if c[1] == 'PATCH']
            self.assertEqual(phases, ['authoring', 'rendering', 'authoring'])   # the lease is confirmed before the call
        draft.on_correct = correct
        self.run_general(self.general_author([draft]), render)
        self.assertEqual(draft.corrections, 1)
        result = self.final_result()
        self.assertEqual(result['salvage'], {'attempts': 1, 'corrections': 1, 'requestedQuestions': 12, 'printedQuestions': 12,
                                             'replaced': {'count': 1, 'codes': {'G32': 1}},
                                             'dropped': {'count': 0, 'codes': {}}, 'gate': 'deliver'})
        record = json.loads((self.root / 'author-diagnostics' / (JOB_ID + '.json')).read_text())
        self.assertEqual((record['authorCalls'], record['correctionCalls']), (1, 1))
        # The operator's record also says whether the reserves arrived: counts only, checked again.
        for reserves, kept in (({'offered': 4, 'dropped': 1}, {'offered': 4, 'dropped': 1}),
                               ({'offered': 'PRIVATE', 'dropped': 0}, None), ({'offered': 4}, None)):
            target = self.root / ('diag-%s' % len(str(reserves)))
            target.mkdir()
            self.assertTrue(worker.save_author_diagnostics(target, JOB_ID, {'reserves': reserves}))
            self.assertEqual(json.loads((target / 'author-diagnostics' / (JOB_ID + '.json')).read_text()).get('reserves'), kept)

    def test_a_job_spends_at_most_two_corrections_and_two_author_calls(self):
        self.use_general_lesson()
        # Each draft: missing at the source, then again after the gate names a question.
        drafts = [FakeDraft(self.job['lesson'], missing=[3], code='SOURCE_ANSWER', fix=True) for _ in range(3)]
        def render(lesson, payload, target, **kwargs):
            return self.failed_gate(lesson, payload, target)
        fail = [GenerationError('SOURCE_ANSWER', 'private source')] * 3
        with self.assertRaises(GenerationError) as caught:
            self.run_general(self.general_author(drafts, fail=fail), render)
        # First attempt: one correction for the source, one for the gate's question, and the
        # gate fails again. Second attempt: no correction is left for its missing question.
        self.assertEqual(caught.exception.code, 'SOURCE_ANSWER')
        self.assertEqual([draft.corrections for draft in drafts], [2, 0, 0])
        self.assertEqual([draft.sourced for draft in drafts], [2, 0, 0])
        self.assertEqual(caught.exception.job_failure, {'stage': 'source', 'question': None, 'gate': None, 'attempts': 2,
                                                        'corrections': 2, 'firstCode': 'QUALITY_GATE_FAILED'})
        self.assertFalse(self.remote.uploads())

    def test_no_model_call_starts_after_the_window(self):
        self.use_general_lesson()
        for late in ('correction', 'second-attempt'):
            with self.subTest(late=late), patch.object(worker, 'MODEL_CALL_WINDOW', 0):
                root = self.root / late
                root.mkdir()
                draft = FakeDraft(self.job['lesson'], missing=[3] if late == 'correction' else [], code='SOURCE_ANSWER')
                fail = [GenerationError('SOURCE_ANSWER', 'x')] if late == 'correction' else [GenerationError('SOURCE_SHAPE', 'x')]
                author = self.general_author([draft if late == 'correction' else None], fail=fail)
                with self.assertRaises(GenerationError) as caught:
                    self.run_general(author, self.rendered, root=root)
                self.assertEqual(len(author.calls), 1)
                self.assertEqual(draft.corrections, 0)
                self.assertEqual(caught.exception.code, 'SOURCE_ANSWER' if late == 'correction' else 'SOURCE_SHAPE')

    def test_a_reply_unusable_as_a_whole_gets_exactly_one_second_attempt(self):
        self.use_general_lesson()
        for code, received in (('PROVIDER_INVALID_RESPONSE', False), ('SOURCE_SHAPE', True), ('AUTHOR_PLAN_MISMATCH', True)):
            with self.subTest(code=code):
                root = self.root / code
                root.mkdir()
                remote = FakeRemote()
                second = FakeDraft(self.job['lesson'])
                calls = []
                def author(_, *, metadata, revision, timeout):
                    calls.append(revision)
                    revision['requested'] = True
                    if len(calls) == 1:
                        if received:
                            revision['replyReceived'] = True
                        raise GenerationError(code, 'PRIVATE_FIRST_REPLY')
                    revision.update(replyReceived=True, draft=second)
                    return second.source()
                initial, renderer, _ = self.run_general(author, self.rendered_general, root=root, remote=remote)
                self.assertEqual(initial.call_count, 2)
                renderer.assert_called_once()
                self.assertEqual(renderer.call_args.args[2].parent, root / JOB_ID)
                self.assertEqual(self.final_result(remote)['salvage']['attempts'], 2)
                self.assertEqual(len(remote.uploads()), 2)
        # A second unusable reply ends the job: there is no third call.
        root = self.root / 'twice'
        root.mkdir()
        author = self.general_author([None, None], fail=[GenerationError('SOURCE_SHAPE', 'x')] * 2)
        with self.assertRaises(GenerationError):
            self.run_general(author, self.rendered, root=root)
        self.assertEqual(len(author.calls), 2)

    def test_a_provider_that_did_not_answer_is_not_called_again(self):
        self.use_general_lesson()
        for code in ('PROVIDER_UNAVAILABLE', 'PROVIDER_HTTP_ERROR', 'PROVIDER_TLS_ERROR', 'PROVIDER_NOT_CONFIGURED'):
            with self.subTest(code=code):
                root = self.root / code
                root.mkdir()
                author = self.general_author([], received=False, fail=[GenerationError(code, 'private')])
                with self.assertRaises(GenerationError) as caught:
                    self.run_general(author, self.rendered, root=root)
                self.assertEqual((len(author.calls), caught.exception.code), (1, code))
        # A correction that gets no answer closes the job to a second attempt as well.
        root = self.root / 'correction'
        root.mkdir()
        draft = FakeDraft(self.job['lesson'], missing=[3], code='SOURCE_ANSWER')
        draft.on_correct = Mock(side_effect=GenerationError('PROVIDER_UNAVAILABLE', 'PRIVATE_CALLBACK_RESPONSE'))
        author = self.general_author([draft], fail=[GenerationError('SOURCE_ANSWER', 'PRIVATE_ORIGINAL_RESPONSE')])
        with self.assertRaises(GenerationError) as caught:
            self.run_general(author, self.rendered, root=root)
        self.assertEqual((len(author.calls), draft.corrections, caught.exception.code), (1, 1, 'SOURCE_ANSWER'))
        record = json.loads((root / 'author-diagnostics' / (JOB_ID + '.json')).read_text())
        self.assertEqual(record['outcome'], 'failed')
        self.assertNotIn('PRIVATE_', str(record))

    def test_a_shorter_sheet_is_delivered_with_its_note_and_the_requested_count(self):
        self.use_general_lesson()
        draft = FakeDraft(self.job['lesson'], missing=[3, 7], code='SOURCE_ANSWER', can_shorten=True)
        draft.on_correct = Mock(side_effect=GenerationError('INVALID_MODEL_OUTPUT', 'private'))
        seen = {}
        def render(lesson, payload, target, **kwargs):
            seen.update(count=lesson['questionCount'], kwargs=kwargs)
            return self.rendered_general(lesson, payload, target)
        def precheck(lesson, payload, target, **kwargs):
            seen['precheck'] = (lesson['questionCount'], kwargs)
            return self.clean_precheck(lesson, payload, target)
        author = self.general_author([draft], fail=[GenerationError('SOURCE_ANSWER', 'private')])
        self.run_general(author, render, precheck=precheck)
        # The sheet's own lesson carries the rewritten count; the request travels beside it.
        self.assertEqual((seen['count'], seen['kwargs']), (10, {'salvaged_from': 12}))
        self.assertEqual(seen['precheck'], (10, {'salvaged_from': 12}))
        self.assertEqual(self.job['lesson']['questionCount'], 12)
        result = self.final_result()
        self.assertEqual(result['salvage']['dropped'], {'count': 2, 'codes': {'SOURCE_ANSWER': 2}})
        self.assertEqual((result['salvage']['requestedQuestions'], result['salvage']['printedQuestions']), (12, 10))
        note = [row for row in result['reviewFindings'] if row['code'] == 'SHORTER_SHEET']
        self.assertEqual(len(note), 1)
        self.assertEqual(note[0]['count'], 2)
        self.assertIn('פחות שאלות', note[0]['note'])
        # An item without a key is no answer kind: the list is untrusted, so no count and no note go out.
        self.assertEqual(result['unverifiedAnswers'], {})
        self.assertEqual(result['teacherNotes'], [])
        self.assertLess(len(json.dumps(result, ensure_ascii=False).encode()), 32000)

    def test_the_pre_pass_replaces_named_questions_twice_before_any_render(self):
        self.use_general_lesson()
        draft = FakeDraft(self.job['lesson'], reserves=3)
        rounds = []
        def precheck(lesson, payload, target, **kwargs):
            rounds.append(target)
            self.assertFalse(target.exists())
            if len(rounds) <= 2:
                target.mkdir(parents=True)
                return {'version': 1, 'status': 'replace', 'steps': [{'name': 'trusted-adapter', 'status': 'PASS'}],
                        'gate': {'action': 'replace', 'questions': [len(rounds)],
                                 'blocking': [{'code': 'G66', 'class': 'policy', 'step': 'house-gates', 'question': len(rounds)}]}}
            return self.clean_precheck(lesson, payload, target)
        initial, renderer, checker = self.run_general(self.general_author([draft]), self.rendered, precheck=precheck)
        self.assertEqual(draft.replaced, [{1: ['G66']}, {2: ['G66']}])
        self.assertEqual(checker.call_count, 2)       # at most two passes, then the render decides
        renderer.assert_called_once()
        self.assertEqual(renderer.call_args.args[1], 'sheet-2')
        self.assertEqual(draft.corrections, 0)

    def test_an_adapter_refusal_before_any_build_is_a_pre_pass_round_and_names_its_code(self):
        self.use_general_lesson()
        draft = FakeDraft(self.job['lesson'], reserves=3)
        renders = []
        def refused(target, question):
            # As the runner leaves a render that stopped at the trusted adapter (skill_feedback.adapter_refusal).
            target.mkdir(parents=True)
            (target / 'logs').mkdir()
            (target / 'logs/trusted-adapter.txt').write_text('general_source.GeneralSourceError: PRIVATE_TEXT\n')
            (target / 'adapter-failure.json').write_text(json.dumps(
                {'version': 1, 'step': 'trusted-adapter', 'code': 'PRINTED_TASK_MISMATCH', 'question': question, 'item': 2}))
            return {'status': 'failed', 'skill': {'name': 'middle'}, 'artifacts': [],
                    'steps': [{'name': 'trusted-adapter', 'status': 'FAIL', 'exitCode': 1, 'log': 'logs/trusted-adapter.txt'}],
                    'gate': {'version': 1, 'action': 'replace', 'complete': True, 'questions': [question], 'review': [],
                             'blocking': [{'code': 'TRUSTED_ADAPTER', 'class': 'truth', 'step': 'trusted-adapter',
                                           'question': question, 'item': 2}]}}
        def render(lesson, payload, target, **kwargs):
            renders.append(target)
            if len(renders) <= 2:
                return refused(target, 4 if len(renders) == 1 else 7)
            if len(renders) == 3:
                return self.failed_gate(lesson, payload, target)        # a full render: the build ran
            return self.rendered_general(lesson, payload, target)
        not_applicable = lambda lesson, payload, target, **kwargs: {'version': 1, 'status': 'not_applicable', 'steps': [], 'gate': None}
        initial, renderer, checker = self.run_general(self.general_author([draft]), render, precheck=not_applicable)
        # Two adapter rounds, then the one re-render after a full render named a question.
        self.assertEqual(renderer.call_count, 4)
        self.assertEqual(draft.replaced, [{4: ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH']},
                                          {7: ['TRUSTED_ADAPTER', 'PRINTED_TASK_MISMATCH']}, {2: ['G32']}])
        checker.assert_called_once()                                      # the pre-pass does not apply; it is not asked again
        self.assertEqual(len(set(renders)), 4)
        self.assertEqual(len(self.remote.uploads()), 2)
        # A third adapter refusal has no round left: the attempt ends, and with the window closed so does the job.
        root = self.root / 'third'
        root.mkdir()
        self.remote = FakeRemote()
        draft = FakeDraft(self.job['lesson'], reserves=5)
        count = []
        def always(lesson, payload, target, **kwargs):
            count.append(target)
            return refused(target, len(count))
        with patch.object(worker, 'MODEL_CALL_WINDOW', 0), self.assertRaises(GenerationError) as caught:
            self.run_general(self.general_author([draft]), always, root=root, precheck=not_applicable)
        self.assertEqual((caught.exception.code, len(count), len(draft.replaced)), ('QUALITY_GATE_FAILED', 3, 2))
        self.assertEqual(caught.exception.job_failure, {'stage': 'render', 'question': 3, 'gate': 'TRUSTED_ADAPTER',
                                                        'attempts': 1, 'corrections': 0})

    def test_a_job_folder_that_already_holds_the_next_folder_is_refused(self):
        self.use_general_lesson()
        for symlink in (True, False):
            with self.subTest(symlink=symlink):
                root = self.root / str(symlink)
                root.mkdir()
                draft = FakeDraft(self.job['lesson'], reserves=1)
                def render(lesson, payload, target, **kwargs):
                    manifest = self.failed_gate(lesson, payload, target)
                    for name in ('check-1-2', 'render-1-3'):
                        path = target.parent / name
                        if symlink:
                            path.symlink_to(self.root, target_is_directory=True)
                        else:
                            path.mkdir()
                    return manifest
                with self.assertRaisesRegex(RuntimeError, 'JOB_PATH_DENIED'):
                    self.run_general(self.general_author([draft]), render, root=root)
                self.assertFalse(self.remote.uploads())

    def test_no_repair_on_an_unnamed_gate_a_render_fault_or_a_failure_without_a_draft(self):
        self.use_general_lesson()
        for failure in ('unknown-gate', 'renderer', 'provider', 'success'):
            with self.subTest(failure=failure):
                root = self.root / failure
                root.mkdir()
                draft = FakeDraft(self.job['lesson'], reserves=2)
                def author(_, *, revision, **kwargs):
                    revision['requested'] = True
                    if failure == 'provider':
                        raise GenerationError('PROVIDER_UNAVAILABLE', 'private context')
                    revision['draft'] = draft        # no replyReceived: this author is not the general provider
                    return 'first'
                def render(lesson, payload, target, **kwargs):
                    if failure == 'renderer':
                        raise OSError('unavailable renderer')
                    if failure == 'success':
                        manifest = self.rendered(lesson, payload, target)
                        manifest.update(authoringProfile='general-skill-source/v1', automatedChecksPassed=False,
                                        renderingChecksPassed=True)
                        manifest['steps'][0]['status'] = 'REVIEW'
                        return manifest
                    return self.failed_gate(lesson, payload, target, gate='pdf')
                remote = FakeRemote()
                if failure == 'success':
                    self.run_general(author, render, root=root, remote=remote)
                    self.assertEqual(len(remote.uploads()), 2)
                else:
                    with self.assertRaises((OSError, GenerationError)) as caught:
                        self.run_general(author, render, root=root, remote=remote)
                    self.assertFalse(remote.uploads())
                    if failure == 'unknown-gate':
                        self.assertEqual(caught.exception.job_failure, {'stage': 'render', 'question': None, 'gate': 'PDF_BUILD',
                                                                        'attempts': 1, 'corrections': 0})
                self.assertEqual((draft.replaced, draft.corrections), ([], 0))

    def test_lease_loss_blocks_a_correction_and_a_second_attempt(self):
        self.use_general_lesson()
        for failure in ('source', 'render', 'second-attempt'):
            with self.subTest(failure=failure):
                root = self.root / failure
                root.mkdir()
                remote = FakeRemote()
                draft = FakeDraft(self.job['lesson'], missing=[3] if failure == 'source' else [], code='SOURCE_ANSWER')
                calls = []
                def author(_, *, revision, **kwargs):
                    calls.append(1)
                    revision.update(requested=True, replyReceived=True)
                    if failure == 'second-attempt':
                        remote.fail_updates = True
                        raise GenerationError('SOURCE_SHAPE', 'private source')
                    revision['draft'] = draft
                    if failure == 'source':
                        remote.fail_updates = True
                        raise GenerationError('SOURCE_ANSWER', 'private source')
                    return 'first'
                def render(lesson, payload, target, **kwargs):
                    remote.fail_updates = True
                    return self.failed_gate(lesson, payload, target)
                with self.assertRaisesRegex(RuntimeError, 'JOB_LEASE_LOST'):
                    self.run_general(author, render, root=root, remote=remote)
                self.assertEqual((len(calls), draft.corrections), (1, 0))
                self.assertFalse(remote.uploads())

    def test_failure_line_is_fixed_labels_codes_and_small_numbers_only(self):
        detail = worker.failure_detail(GenerationError('X', 'PRIVATE'), {
            'stage': 'PRIVATE stage', 'question': 'PRIVATE', 'gateCode': 'G32 PRIVATE', 'attempts': 9,
            'corrections': 1, 'firstCode': 'private-code', 'text': 'PRIVATE'})
        self.assertEqual(detail, {'stage': 'author', 'question': None, 'gate': None, 'corrections': 1})
        self.assertEqual(worker.failure_detail(None, {'stage': 'precheck', 'question': 7, 'gateCode': 'G66', 'attempts': 2,
                                                      'corrections': 0, 'firstCode': 'SOURCE_SHAPE'}, None),
                         {'stage': 'precheck', 'question': 7, 'gate': 'G66', 'attempts': 2, 'corrections': 0,
                          'firstCode': 'SOURCE_SHAPE'})
        self.assertEqual(worker.failure_detail(None, {'stage': 'render'}, 'upload')['stage'], 'upload')

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
