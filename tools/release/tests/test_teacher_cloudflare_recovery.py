"""Offline regressions for the single uncertain-preflight recovery boundary."""
import copy
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from test_teacher_cloudflare_release import guard, plan, context, proof, SHA, VERSION, NOW

CONTROLLER = '9' * 40
ORIGIN = 'https://noam-teacher-generation.example.workers.dev'


def private(path, value):
    path.write_bytes(value if isinstance(value, bytes) else (json.dumps(value, indent=2) + '\n').encode())
    path.chmod(0o600)


class RecoveryFixture:
    def __init__(self, directory):
        self.root = Path(directory).resolve()
        self.ledger = self.root / 'teacher-cloudflare-ledger.json'
        self.image = self.root / 'teacher-cloudflare-image-ledger.json'
        original = plan()
        self.previous = {'target': 'teacher-cloudflare', 'state': 'uncertain', 'phase': 'preflight',
                         'identity': guard.identity(original), 'planSha256': guard.digest(original),
                         'workerOrigin': ORIGIN, 'failedAt': NOW.isoformat()}
        private(self.ledger, self.previous)
        self.raw = self.ledger.read_bytes()
        self.p = {**plan('recover-preflight'), 'controllerSha': CONTROLLER,
                  'priorLedgerSha256': hashlib.sha256(self.raw).hexdigest(), 'workerOrigin': ORIGIN,
                  'expectedVersionId': VERSION, 'expectedDoId': '3' * 64}
        self.c = {**context(self.p), 'recoveryApproved': True,
                  'controllerApproved': True, 'controllerSha': CONTROLLER}
        self.image_record = {'target': 'teacher-cloudflare-image', 'state': 'image_verified',
                             'identity': guard.identity(self.p), 'remoteDigest': self.p['imageRef'].split('@')[1]}
        private(self.image, self.image_record)
        self.archive = self.root / ('teacher-cloudflare-preflight-failed-' + self.p['priorLedgerSha256'] + '.json')
        self.before = {**proof(self.p), 'preflight': None, 'approved': None, 'lastCycle': None,
                       'observedImage': None, 'nextAttemptAt': 0}
        self.after = {**self.before, 'preflight': proof(self.p)['preflight']}
        self.calls = []
        self.status_value = self.before
        self.version_values = []
        self.failure = None
        self.fresh_count = 0
        self.revoke_at = None

    def use_origin(self, origin, p):
        self.calls.append('origin')
        assert origin == ORIGIN

    def active_version(self, p):
        self.calls.append('version')
        return self.version_values.pop(0) if self.version_values else VERSION

    def status(self, p):
        self.calls.append('status')
        return copy.deepcopy(self.status_value)

    def fresh_context(self, c):
        self.calls.append('context')
        self.fresh_count += 1
        return {**c, 'approved': False} if self.fresh_count == self.revoke_at else c

    def preflight(self, p):
        self.calls.append('preflight')
        pending = json.loads(self.ledger.read_text())
        assert pending['state'] == 'in_progress' and pending['phase'] == 'recover-preflight'
        assert self.archive.read_bytes() == self.raw
        assert self.archive.stat().st_mode & 0o777 == 0o400
        if self.failure: raise self.failure
        self.status_value = self.after
        return copy.deepcopy(self.after)

    def activate(self, p, version):
        self.calls.append('activate')
        return {**self.after, 'mode': 'active', 'approved': {
            'sourceSha': p['sourceSha'], 'imageRef': p['imageRef'], 'activatedAt': NOW.isoformat()}}

    def run(self):
        with guard.ledger_lock(self.root):
            return guard.execute_recovery(self.p, self.c, self, self.ledger, self.image, now=NOW)


class RecoveryTests(unittest.TestCase):
    def test_one_preflight_post_preserves_exact_original_before_pending_and_allows_original_activation(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp)
            original_activation = plan('activate')
            original_plan_hash = guard.digest(original_activation)
            result = f.run()
            self.assertEqual(result['state'], 'preflight_verified')
            self.assertEqual(result['proof']['doId'], f.p['expectedDoId'])
            self.assertEqual(f.calls, ['origin', 'version', 'status', 'context', 'context', 'preflight', 'version'])
            self.assertEqual(f.archive.read_bytes(), f.raw)
            self.assertEqual(hashlib.sha256(f.archive.read_bytes()).hexdigest(), f.p['priorLedgerSha256'])
            self.assertEqual(guard.identity(f.p), guard.identity(original_activation))
            self.assertEqual(guard.digest(original_activation), original_plan_hash)
            f.calls = []
            active = guard.execute(original_activation, context(original_activation), f, f.ledger, now=NOW)
            self.assertEqual(active['state'], 'active')
            self.assertEqual(f.calls, ['origin', 'version', 'status', 'context', 'activate', 'version'])
            self.assertEqual(f.archive.read_bytes(), f.raw)

    def test_original_activation_retains_empty_queue_and_old_worker_stop_gates_after_recovery(self):
        for key, value in [('activeJobs', 1), ('oldWorkerStopped', False)]:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.run(); f.calls = []
                p = plan('activate'); c = context(p); c[key] = value
                with self.assertRaises(guard.GuardError): guard.execute(p, c, f, f.ledger, now=NOW)
                self.assertEqual(f.calls, [])

    def test_missing_or_changed_approval_blocks_before_provider_reads_and_post(self):
        for key, value in [('approved', False), ('recoveryApproved', False), ('controllerApproved', False),
                           ('controllerSha', '8' * 40), ('planSha256', '8' * 64)]:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.c[key] = value
                with self.assertRaises(guard.GuardError): f.run()
                self.assertEqual(f.calls, [])
                self.assertEqual(f.ledger.read_bytes(), f.raw)

    def test_raw_bytes_not_equivalent_json_bind_prior_ledger(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp)
            private(f.ledger, f.raw + b'\n')
            with self.assertRaisesRegex(guard.GuardError, 'PRIOR_LEDGER_HASH_MISMATCH'): f.run()
            self.assertEqual(f.calls, [])

    def test_only_original_uncertain_preflight_same_identity_origin_plan_is_recoverable(self):
        cases = [('state', 'active'), ('state', 'preflight_verified'), ('phase', 'recover-preflight'),
                 ('phase', 'activate'), ('target', 'wix-production'), ('identity', {}),
                 ('workerOrigin', 'https://noam-teacher-generation.other.workers.dev'), ('planSha256', '8' * 64)]
        for key, value in cases:
            with self.subTest(key=key, value=value), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.previous[key] = value; private(f.ledger, f.previous)
                f.p['priorLedgerSha256'] = hashlib.sha256(f.ledger.read_bytes()).hexdigest()
                f.c['planSha256'] = guard.digest(f.p)
                with self.assertRaisesRegex(guard.GuardError, 'ORIGINAL_UNCERTAIN_PREFLIGHT_REQUIRED'): f.run()
                self.assertEqual(f.calls, [])

    def test_image_ledger_must_be_private_verified_and_match_exact_identity_and_remote_digest(self):
        for key, value in [('state', 'uncertain'), ('target', 'wix-production'),
                           ('identity', {}), ('remoteDigest', 'sha256:' + '8' * 64)]:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.image_record[key] = value; private(f.image, f.image_record)
                with self.assertRaises(guard.GuardError): f.run()
                self.assertEqual(f.calls, [])
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp); f.image.chmod(0o644)
            with self.assertRaises(guard.GuardError): f.run()
            self.assertEqual(f.calls, [])

    def test_changed_runtime_or_any_previous_execution_blocks_before_post(self):
        changes = [('sourceSha', '8' * 40), ('imageRef', 'wrong'), ('versionId', 'wrong'), ('doId', '4' * 64),
                   ('mode', 'active'), ('running', True), ('approved', {}), ('lastCycle', {}),
                   ('observedImage', 'wrong'), ('preflight', {}), ('nextAttemptAt', 1)]
        for key, value in changes:
            with self.subTest(key=key), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.before[key] = value
                with self.assertRaises(guard.GuardError): f.run()
                self.assertNotIn('preflight', f.calls)
                self.assertEqual(f.ledger.read_bytes(), f.raw)
                self.assertFalse(f.archive.exists())
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp); f.version_values = ['wrong']
            with self.assertRaises(guard.GuardError): f.run()
            self.assertEqual(f.calls, ['origin', 'version'])

    def test_approval_is_reread_before_preservation_and_immediately_before_post(self):
        for at in (1, 2):
            with self.subTest(at=at), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp); f.revoke_at = at
                with self.assertRaises(guard.GuardError): f.run()
                self.assertNotIn('preflight', f.calls)
                if at == 1:
                    self.assertEqual(f.ledger.read_bytes(), f.raw)
                    self.assertFalse(f.archive.exists())
                else:
                    self.assertEqual(json.loads(f.ledger.read_text())['state'], 'uncertain')
                    self.assertEqual(f.archive.read_bytes(), f.raw)

    def test_existing_archive_cannot_be_overwritten(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp); private(f.archive, b'earlier evidence')
            with self.assertRaises(FileExistsError): f.run()
            self.assertEqual(f.archive.read_bytes(), b'earlier evidence')
            self.assertEqual(f.ledger.read_bytes(), f.raw)
            self.assertNotIn('preflight', f.calls)

    def test_archive_file_or_directory_fsync_failure_leaves_original_and_makes_no_post(self):
        for target in ('file', 'directory'):
            with self.subTest(target=target), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp)
                mocked = patch.object(guard.os, 'fsync', side_effect=OSError('fixture disk failure')) if target == 'file' else \
                    patch.object(guard, 'fsync_directory', side_effect=OSError('fixture directory failure'))
                with mocked, self.assertRaises(OSError): f.run()
                self.assertEqual(f.ledger.read_bytes(), f.raw)
                self.assertNotIn('preflight', f.calls)
                self.assertEqual(f.archive.read_bytes(), f.raw)

    def test_ledger_changed_during_read_checks_blocks_before_preservation(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp)
            original_status = f.status
            def changing_status(p):
                private(f.ledger, f.raw + b'\n')
                return original_status(p)
            f.status = changing_status
            with self.assertRaisesRegex(guard.GuardError, 'PRIOR_LEDGER_CHANGED'): f.run()
            self.assertNotIn('preflight', f.calls)

    def test_any_failure_after_one_post_preserves_uncertainty_and_original_and_blocks_replay(self):
        for failure in ('transport', 'proof', 'version', 'do'):
            with self.subTest(failure=failure), tempfile.TemporaryDirectory() as tmp:
                f = RecoveryFixture(tmp)
                if failure == 'transport': f.failure = TimeoutError('fixture timeout')
                if failure == 'proof': f.after['preflight']['claimVerified'] = True
                if failure == 'version': f.version_values = [VERSION, '87654321-1234-1234-1234-123456789abc']
                if failure == 'do': f.after['doId'] = '4' * 64
                with self.assertRaises((guard.GuardError, TimeoutError)): f.run()
                failed = json.loads(f.ledger.read_text())
                self.assertEqual((failed['state'], failed['phase']), ('uncertain', 'recover-preflight'))
                self.assertEqual(f.calls.count('preflight'), 1)
                self.assertEqual(f.archive.read_bytes(), f.raw)
                f.p['priorLedgerSha256'] = hashlib.sha256(f.ledger.read_bytes()).hexdigest()
                f.c['planSha256'] = guard.digest(f.p); f.calls = []
                with self.assertRaises(guard.GuardError): f.run()
                self.assertEqual(f.calls, [])

    def test_recovery_never_routes_through_initial_deploy_or_activate_executor(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp)
            with self.assertRaisesRegex(guard.GuardError, 'RUNTIME_PHASE_REQUIRED'):
                guard.execute(f.p, f.c, f, f.ledger, now=NOW)
            self.assertEqual(f.calls, [])

    def test_recovery_plan_controller_version_do_and_origin_are_strict(self):
        with tempfile.TemporaryDirectory() as tmp:
            f = RecoveryFixture(tmp)
            guard.validate_plan(f.p, SHA, CONTROLLER)
            with self.assertRaisesRegex(guard.GuardError, 'RECOVERY_CONTROLLER_MISMATCH'):
                guard.validate_plan(f.p, SHA, '8' * 40)
            for key, value in [('controllerSha', 'x'), ('priorLedgerSha256', 'x'), ('expectedVersionId', '-' * 36),
                               ('expectedDoId', ''), ('workerOrigin', ORIGIN + '/path')]:
                p = {**f.p, key: value}
                with self.subTest(key=key), self.assertRaises(guard.GuardError): guard.validate_plan(p, SHA)


class TransportTests(unittest.TestCase):
    def adapter(self, phase='recover-preflight'):
        a = object.__new__(guard.WranglerAdapter)
        a.plan = plan(phase); a.origin = ORIGIN; a._token = 'a' * 64
        return a

    def test_truthful_user_agent_on_get_and_post_and_one_attempt_even_after_timeout(self):
        a = self.adapter(); requests = []
        class Response(io.BytesIO):
            status = 200
        class Opener:
            def open(self, request, timeout):
                requests.append(request)
                return Response(b'{}')
        a._http = Opener()
        a.status(a.plan); a.preflight(a.plan)
        self.assertEqual([r.get_method() for r in requests], ['GET', 'POST'])
        for request in requests:
            self.assertEqual(request.get_header('User-agent'), guard.USER_AGENT)
            self.assertEqual(request.get_header('Authorization'), 'Bearer ' + 'a' * 64)
        with self.assertRaisesRegex(guard.GuardError, 'RECOVERY_POST_ALREADY_ATTEMPTED'): a.preflight(a.plan)
        self.assertEqual(len(requests), 2)
        b = self.adapter()
        class TimeoutOpener:
            def open(self, *args, **kwargs): raise TimeoutError()
        b._http = TimeoutOpener()
        with self.assertRaises(TimeoutError): b.preflight(b.plan)
        with self.assertRaisesRegex(guard.GuardError, 'RECOVERY_POST_ALREADY_ATTEMPTED'): b.preflight(b.plan)

    def test_recovery_adapter_prohibits_deploy_registry_secret_activate_tick_and_redirect(self):
        a = self.adapter()
        with patch.object(guard.subprocess, 'run') as run:
            for args in [('deploy',), ('secret', 'put', 'key'),
                         ('containers', 'registries', 'credentials', 'registry.cloudflare.com')]:
                with self.subTest(args=args), self.assertRaises(guard.GuardError): a.command(*args)
            run.assert_not_called()
        for path, body in [('/operator/activate', {}), ('/operator/tick', {}),
                           ('/operator/preflight', None), ('/operator/status', {})]:
            with self.subTest(path=path), self.assertRaises(guard.GuardError): a.request(path, body)
        with self.assertRaises(guard.GuardError): a.deploy_disabled(a.plan)
        with self.assertRaisesRegex(guard.GuardError, 'OPERATOR_REDIRECT_DENIED'):
            guard.NoRedirect().redirect_request(None, None, 302, None, None, 'https://other.invalid')

    def test_all_phases_reread_private_exact_controller_approval(self):
        for phase in ('recover-preflight', 'activate', 'image-push'):
            with self.subTest(phase=phase), tempfile.TemporaryDirectory() as tmp:
                a = self.adapter(phase); a.controller_sha = CONTROLLER
                a.context_path = Path(tmp).resolve() / 'context.json'
                c = {'controllerApproved': True, 'controllerSha': CONTROLLER}
                private(a.context_path, c)
                self.assertEqual(a.fresh_context(c), c)
                for key, value in [('controllerApproved', False), ('controllerSha', '8' * 40)]:
                    private(a.context_path, {**c, key: value})
                    with self.assertRaisesRegex(guard.GuardError, 'EXACT_CONTROLLER_APPROVAL_REQUIRED'):
                        a.fresh_context(c)
                private(a.context_path, c); a.context_path.chmod(0o644)
                with self.assertRaises(guard.GuardError): a.fresh_context(c)


class ControllerIdentityTests(unittest.TestCase):
    def test_controller_and_runtime_require_distinct_exact_clean_fresh_branch_ancestry(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp); remote = root / 'remote'; repo = root / 'controller'; source = root / 'source'
            def git(*args, cwd=None):
                return subprocess.check_output(['git', *args], cwd=cwd, stderr=subprocess.DEVNULL, text=True).strip()
            git('init', '--bare', str(remote)); git('init', '-b', 'main', str(repo))
            git('config', 'user.email', 'fixture@example.invalid', cwd=repo)
            git('config', 'user.name', 'Fixture', cwd=repo)
            (repo / 'source.txt').write_text('runtime')
            git('add', '.', cwd=repo); git('commit', '-m', 'runtime', cwd=repo)
            runtime_sha = git('rev-parse', 'HEAD', cwd=repo)
            git('remote', 'add', 'origin', str(remote), cwd=repo)
            git('push', 'origin', 'HEAD:refs/heads/headless/astro-poc-baseline', cwd=repo)
            git('worktree', 'add', '--detach', str(source), runtime_sha, cwd=repo)
            (repo / 'controller.txt').write_text('controller')
            git('add', '.', cwd=repo); git('commit', '-m', 'controller', cwd=repo)
            controller_sha = git('rev-parse', 'HEAD', cwd=repo)
            git('push', 'origin', 'main', cwd=repo)
            guard.check_controller(repo, controller_sha, require_main=True)
            guard.check_source(source, runtime_sha, require_canonical=True)
            with self.assertRaises(guard.GuardError): guard.check_controller(repo, runtime_sha, require_main=True)
            with self.assertRaises(guard.GuardError): guard.check_source(source, controller_sha, require_canonical=True)
            (repo / 'unreviewed').write_text('dirty')
            with self.assertRaisesRegex(guard.GuardError, 'CONTROLLER_NOT_CLEAN'):
                guard.check_controller(repo, controller_sha, require_main=True)
            (repo / 'unreviewed').unlink()
            git('update-ref', 'refs/remotes/origin/main', runtime_sha, cwd=repo)
            with self.assertRaisesRegex(guard.GuardError, 'REFRESH_MAIN_BEFORE_RELEASE'):
                guard.check_controller(repo, controller_sha, require_main=True)
            git('fetch', 'origin', 'main', cwd=repo)
            git('update-ref', 'refs/heads/headless/astro-poc-baseline', controller_sha, cwd=remote)
            with self.assertRaisesRegex(guard.GuardError, 'REFRESH_CANONICAL_BEFORE_RELEASE'):
                guard.check_source(source, runtime_sha, require_canonical=True)


if __name__ == '__main__': unittest.main()
