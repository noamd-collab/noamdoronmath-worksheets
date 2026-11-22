"""Local mocked tests; no Docker, cloud, provider, or database calls."""
import importlib.util
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import patch
from datetime import datetime, timedelta, timezone

SCRIPTS = Path(__file__).resolve().parents[1]


def load(name, file):
    spec = importlib.util.spec_from_file_location(name, SCRIPTS / file)
    module = importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
    return module


probe = load('http_probe', 'teacher-free-http-qualification.py')
worker = load('http_fake_worker', 'teacher-free-http-worker.py')


class Resources(unittest.TestCase):
    def sample(self):
        return {'memory.max': probe.MEMORY, 'memory.swap.max': 0, 'cpu.max': '10000 100000',
                'memory.peak': 350 * 1024 * 1024,
                'memory.events': {'oom': 0, 'oom_kill': 0, 'oom_group_kill': 0},
                'cpu.stat': {'usage_usec': 1000000}}

    def test_pass_requires_actual_resources_health_and_alive_server(self):
        summary = {'passed': True, 'healthPassed': True, 'elapsedSeconds': 160}
        state = {'OOMKilled': False, 'Running': True}
        self.assertTrue(probe.successful(summary, self.sample(), state))
        for change in ({'healthPassed': False}, {'elapsedSeconds': 1051}, {'passed': False}):
            self.assertFalse(probe.successful({**summary, **change}, self.sample(), state))
        for change in ({'Running': False}, {'OOMKilled': True}):
            self.assertFalse(probe.successful(summary, self.sample(), {**state, **change}))
        for change in ({'memory.peak': None}, {'memory.peak': probe.MEMORY + 1}, {'memory.swap.max': 1},
                       {'cpu.max': 'max 100000'}, {'cpu.max': '20000 100000'}, {'memory.events': None},
                       {'memory.events': {'oom': 1, 'oom_kill': 0, 'oom_group_kill': 0}}, {'cpu.stat': None}):
            self.assertFalse(probe.successful(summary, {**self.sample(), **change}, state))

    def test_mounts_readonly_and_actual_entrypoint_preserved(self):
        args = probe.create_arguments('fixture-image', 'grade3-division', Path('/tmp/fixture.json'), Path('/tmp/real.py'))
        self.assertNotIn('--entrypoint', args)
        self.assertEqual(args[args.index('--network') + 1], 'none')
        self.assertEqual(args[args.index('--memory-swap') + 1], '512m')
        mounts = [args[i + 1] for i, a in enumerate(args) if a == '--mount']
        self.assertEqual(len(mounts), 4)
        self.assertTrue(all(m.endswith(',readonly') for m in mounts))
        self.assertTrue(any('dst=/opt/noam/app/remote_worker.real.py' in m for m in mounts))
        self.assertTrue(any('dst=/opt/noam/app/remote_worker.py' in m for m in mounts))
        self.assertFalse(any('PYTHONPATH' in a for a in args))
        self.assertIn('QWEN_API_KEY=' + worker.SYNTHETIC, args)
        self.assertIn('TEACHER_GENERATION_SERVICE_KEY=' + worker.SYNTHETIC, args)

    def test_cgroup_missing_metrics_fail_closed(self):
        with tempfile.TemporaryDirectory() as tmp:
            self.assertFalse(probe.limits_match(probe.metrics(Path(tmp))))


class OfflineTransport(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.patch = patch.object(worker, 'ROOT', Path(self.temp.name)); self.patch.start()
        self.addCleanup(self.patch.stop)
        app = SCRIPTS.parents[1] / 'tools/teacher-generation'
        with patch.object(sys, 'path', [str(app), *sys.path]):
            self.real = load('http_qualification_real_worker', app / 'remote_worker.py')
        worker.bind(self.real, {'lesson': 'synthetic'}, {'raw': 'synthetic'}, {'canonical': True})
        self.remote = self.real.Remote(worker.SYNTHETIC)
        self.claim = '/rest/v1/rpc/claim_teacher_generation_job'
        self.heartbeat = '/rest/v1/noam_teacher_generation_workers?on_conflict=id'
        self.patch_url = ('/rest/v1/noam_teacher_generation_jobs?select=id,owner_id&id=eq.' + worker.JOB
                          + '&owner_id=eq.' + worker.ACTOR + '&lease_token=eq.' + worker.LEASE
                          + '&status=eq.running&lease_until=gt.' + datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z'))

    def test_refuses_any_real_key_and_unknown_remote_operation(self):
        with self.assertRaisesRegex(RuntimeError, 'SYNTHETIC'):
            self.real.Remote('possibly-real-key')
        with self.assertRaisesRegex(RuntimeError, 'UNEXPECTED_REMOTE'):
            self.remote.call('/rest/v1/other_private_table')

    def test_one_claim_and_heartbeat_only_after_claim(self):
        with self.assertRaisesRegex(RuntimeError, 'HEARTBEAT_BEFORE_CLAIM'):
            self.remote.call(self.heartbeat, 'POST', {'id': 'primary'})
        [job] = self.remote.call(self.claim, 'POST', {})
        self.assertEqual(job['owner_id'], worker.ACTOR)
        self.real.update_job(self.remote, job, {'phase': 'authoring'})
        with self.assertRaisesRegex(RuntimeError, 'JOB_LEASE_LOST'):
            self.real.update_job(self.remote, {**job, 'owner_id': worker.JOB}, {'phase': 'rendering'})
        self.assertEqual(self.remote.call(self.claim, 'POST', {}), [])
        self.remote.call(self.heartbeat, 'POST', {'id': 'primary'})
        with worker.state() as s:
            self.assertEqual((s['claimedJobs'], s['claims'], s['heartbeats']), (1, 2, 1))

    def test_cas_wrong_lease_expiry_and_terminal_update_fail(self):
        self.remote.call(self.claim, 'POST', {})
        self.assertEqual(self.remote.call(self.patch_url.replace(worker.LEASE, worker.JOB), 'PATCH', {'phase': 'authoring'}), [])
        with worker.state() as s:
            s['job']['lease_until'] = (datetime.now(timezone.utc) - timedelta(seconds=1)).isoformat()
        self.assertEqual(self.remote.call(self.patch_url, 'PATCH', {'phase': 'authoring'}), [])

    def test_completion_requires_both_exact_verified_uploads(self):
        self.remote.call(self.claim, 'POST', {})
        with self.assertRaisesRegex(RuntimeError, 'INVALID_COMPLETION'):
            self.remote.call(self.patch_url, 'PATCH', {'status': 'needs_review', 'result': {'automatedChecksPassed': False}})
        prefix = '/storage/v1/object/' + self.real.BUCKET + '/' + worker.ACTOR + '/' + worker.JOB + '/sheet.'
        for kind, blob, mime in [('pdf', b'%PDF-fixture', 'application/pdf'),
                                 ('docx', b'PKfixture', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')]:
            self.remote.call(prefix + kind, 'POST', raw=blob, mime=mime)
            self.assertEqual((worker.ROOT / ('uploads/sheet.' + kind)).read_bytes(), blob)
        with worker.state() as s:
            artifacts = list(s['uploads'].values())
        result = {'automatedChecksPassed': True, 'humanReviewRequired': True, 'artifacts': artifacts,
                  'checks': [{'name': 'real-pipeline-check', 'status': 'PASS'}]}
        self.assertEqual(self.remote.call(self.patch_url, 'PATCH', {'status': 'needs_review', 'result': result}),
                         [{'id': worker.JOB, 'owner_id': worker.ACTOR}])
        with worker.state() as saved:
            self.assertEqual(saved['job']['status'], 'needs_review')
        self.assertEqual(self.remote.call(self.patch_url, 'PATCH', {'phase': 'rendering'}), [])

    def test_upload_mime_duplicate_and_wrong_prefix_rejected(self):
        prefix = '/storage/v1/object/' + self.real.BUCKET + '/' + worker.ACTOR + '/' + worker.JOB + '/sheet.pdf'
        with self.assertRaisesRegex(RuntimeError, 'UNEXPECTED_UPLOAD'):
            self.remote.call(prefix, 'POST', raw=b'%PDF-test', mime='text/plain')
        self.remote.call(prefix, 'POST', raw=b'%PDF-test', mime='application/pdf')
        with self.assertRaisesRegex(RuntimeError, 'UNEXPECTED_UPLOAD'):
            self.remote.call(prefix, 'POST', raw=b'%PDF-test', mime='application/pdf')
        with self.assertRaisesRegex(RuntimeError, 'UNEXPECTED_REMOTE'):
            self.remote.call(prefix.replace(worker.ACTOR, 'another-owner'), 'POST', raw=b'%PDF-test', mime='application/pdf')

    def test_author_checks_canonical_and_cannot_retry(self):
        fake_provider = SimpleNamespace(derive_author_parameters=lambda *args: {'canonical': True})
        fake_validation = SimpleNamespace(validate_lesson=lambda *args, **kwargs: {}, validate_model=lambda *args: None)
        fake_quality = SimpleNamespace(prepare_didactics=lambda *args: None)
        with patch.dict(sys.modules, {'provider': fake_provider, 'validation': fake_validation, 'author_quality': fake_quality}):
            self.assertEqual(self.real.author_lesson({'lesson': 'synthetic'}), {'canonical': True})
            with self.assertRaisesRegex(RuntimeError, 'AUTHOR_RETRY_DENIED'):
                self.real.author_lesson({'lesson': 'synthetic'})
            fake_provider.derive_author_parameters = lambda *args: {'changed': True}
            with self.assertRaisesRegex(RuntimeError, 'CANONICAL_FIXTURE_CHANGED'):
                self.real.author_lesson({'lesson': 'synthetic'})


if __name__ == '__main__':
    unittest.main()
