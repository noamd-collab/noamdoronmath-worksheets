"""Offline active-cloud upgrade state machine; no provider/model/DB calls."""
import copy
import json
from pathlib import Path
import tempfile
import unittest

from test_teacher_cloudflare_release import guard, plan, context, proof, NOW, VERSION

NEW_VERSION = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
ORIGIN = 'https://noam-teacher-generation.example.workers.dev'


def upgrade(phase='upgrade-drain'):
    old = plan()
    p = {**old, 'phase': phase, 'sourceSha': '8' * 40,
         'imageRef': old['imageRef'].split('@')[0] + '@sha256:' + '9' * 64,
         'previousRuntime': {'sourceSha': old['sourceSha'], 'imageRef': old['imageRef'],
                             'versionId': VERSION, 'doId': '3' * 64}}
    return p


def approval(p):
    return {**context(p), 'jobsSnapshotSha256': '4' * 64, 'ownerQuotaSnapshotSha256': '5' * 64}


class Adapter:
    def __init__(self, ledger):
        self.ledger = ledger
        self.calls = []
        self.status_value = proof(plan())
        self.status_value.update(mode='active', approved={**upgrade()['previousRuntime'],
                                                        'activatedAt': NOW.isoformat()})
        self.version = VERSION
        self.failure = None
        self.fresh_change = {}

    def mutation(self, name):
        pending = json.loads(self.ledger.read_text())
        assert pending['state'] == 'in_progress'
        assert pending['predecessorSha256'] == guard.digest(pending['predecessor'])
        self.calls.append(name)
        if self.failure == name:
            raise RuntimeError('simulated uncertain transport')

    def use_origin(self, origin, p):
        assert origin == ORIGIN

    def active_version(self, p):
        self.calls.append('version')
        return self.version

    def status(self, p):
        self.calls.append('status')
        return copy.deepcopy(self.status_value)

    def fresh_context(self, c):
        return {**c, **self.fresh_change}

    def deactivate(self, p):
        self.mutation('deactivate')
        self.status_value.update(mode='disabled', approved=None)
        return self.status(p)

    def deploy_disabled(self, p):
        self.mutation('deploy')
        self.version = NEW_VERSION
        self.status_value = proof(p)
        self.status_value.update(versionId=NEW_VERSION, approved=None)
        self.status_value['preflight']['versionId'] = NEW_VERSION
        return ORIGIN

    def preflight(self, p):
        self.mutation('preflight')
        return self.status(p)

    def activate(self, p, version):
        self.mutation('activate')
        self.status_value.update(mode='active', approved={'sourceSha': p['sourceSha'],
            'imageRef': p['imageRef'], 'versionId': version, 'activatedAt': NOW.isoformat()})
        return self.status(p)


class UpgradeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.ledger = Path(self.temp.name) / 'ledger.json'
        self.original = {'target': 'teacher-cloudflare', 'state': 'active', 'identity': guard.identity(plan()),
                         'workerOrigin': ORIGIN, 'proof': {'versionId': VERSION, 'doId': '3' * 64}}
        guard.atomic_json(self.ledger, self.original)
        self.adapter = Adapter(self.ledger)

    def run_phase(self, phase, **changes):
        p = upgrade(phase)
        return guard.execute_upgrade(p, {**approval(p), **changes}, self.adapter, self.ledger, now=NOW)

    def test_three_phase_upgrade_preserves_prior_receipts_and_never_touches_database_or_tick(self):
        drain = self.run_phase('upgrade-drain')
        self.assertEqual(drain['state'], 'upgrade_draining')
        self.assertEqual(drain['predecessor'], self.original)
        preflight = self.run_phase('upgrade-preflight')
        self.assertEqual(preflight['state'], 'upgrade_preflight_verified')
        self.assertEqual(preflight['predecessor'], drain)
        active = self.run_phase('upgrade-activate')
        self.assertEqual(active['state'], 'active')
        self.assertEqual(active['predecessor'], preflight)
        self.assertEqual(active['proof']['doId'], '3' * 64)
        self.assertEqual(active['preservedData'], {'jobsSnapshotSha256': '4' * 64,
                                                 'ownerQuotaSnapshotSha256': '5' * 64})
        self.assertEqual([x for x in self.adapter.calls if x not in ('status', 'version')],
                         ['deactivate', 'deploy', 'preflight', 'activate'])
        with self.assertRaises(guard.GuardError):
            self.run_phase('upgrade-activate')

    def test_busy_drain_never_kills_and_preflight_waits_without_mutation(self):
        self.adapter.status_value.update(running=True, observedImage=plan()['imageRef'])
        drain = self.run_phase('upgrade-drain')
        self.assertTrue(drain['containerRunningAtDrain'])
        original = self.ledger.read_bytes()
        with self.assertRaisesRegex(guard.GuardError, 'OLD_CLOUD_STILL_DRAINING'):
            self.run_phase('upgrade-preflight')
        self.assertEqual(self.ledger.read_bytes(), original)
        self.assertNotIn('deploy', self.adapter.calls)
        self.adapter.status_value['running'] = False
        self.run_phase('upgrade-preflight')

    def test_no_cutover_with_live_or_unobserved_leases_or_stale_evidence(self):
        self.run_phase('upgrade-drain')
        original = self.ledger.read_bytes()
        for changes in ({'activeJobs': 1}, {'activeJobs': False}, {'queueCheckedAt': '2026-11-14T11:00:00Z'},
                        {'jobsSnapshotSha256': ''}, {'ownerQuotaSnapshotSha256': ''}):
            with self.subTest(changes=changes), self.assertRaises(guard.GuardError):
                self.run_phase('upgrade-preflight', **changes)
            self.assertEqual(self.ledger.read_bytes(), original)

    def test_approval_and_old_identity_must_match_before_any_mutation(self):
        for key in ('approved', 'planSha256'):
            self.adapter.calls.clear()
            with self.assertRaises(guard.GuardError):
                self.run_phase('upgrade-drain', **{key: False})
            self.assertEqual(self.adapter.calls, [])
        self.adapter.status_value['sourceSha'] = 'a' * 40
        with self.assertRaisesRegex(guard.GuardError, 'RUNTIME_IDENTITY_MISMATCH'):
            self.run_phase('upgrade-drain')
        self.assertNotIn('deactivate', self.adapter.calls)

    def test_snapshot_drift_or_fresh_lease_blocks_activation_without_rewriting_ledger(self):
        self.run_phase('upgrade-drain'); self.run_phase('upgrade-preflight')
        original = self.ledger.read_bytes()
        for changed in ({'jobsSnapshotSha256': 'a' * 64}, {'ownerQuotaSnapshotSha256': 'a' * 64}, {'activeJobs': 1}):
            self.adapter.fresh_change = changed
            with self.subTest(changed=changed), self.assertRaises(guard.GuardError):
                self.run_phase('upgrade-activate')
            self.assertEqual(self.ledger.read_bytes(), original)
        self.assertNotIn('activate', self.adapter.calls)

    def test_any_uncertain_mutation_retains_pending_and_predecessor_and_cannot_retry(self):
        for failure, phase in [('deactivate', 'upgrade-drain'), ('deploy', 'upgrade-preflight'),
                               ('preflight', 'upgrade-preflight'), ('activate', 'upgrade-activate')]:
            with self.subTest(failure=failure):
                guard.atomic_json(self.ledger, self.original); self.adapter = Adapter(self.ledger)
                if phase != 'upgrade-drain': self.run_phase('upgrade-drain')
                if phase == 'upgrade-activate': self.run_phase('upgrade-preflight')
                previous = json.loads(self.ledger.read_text())
                self.adapter.failure = failure
                with self.assertRaises(RuntimeError): self.run_phase(phase)
                failed = json.loads(self.ledger.read_text())
                self.assertEqual(failed['state'], 'uncertain')
                self.assertEqual(failed['predecessor'], previous)
                with self.assertRaises(guard.GuardError): self.run_phase(phase)

    def test_observation_does_not_change_ledger_or_invoke_a_mutation(self):
        original = self.ledger.read_bytes()
        result = guard.observe_runtime(upgrade(), self.adapter, self.ledger)
        self.assertEqual(result['mode'], 'active')
        self.assertEqual(self.adapter.calls, ['version', 'status'])
        self.assertEqual(self.ledger.read_bytes(), original)
        self.assertNotIn('approved', result)

    def test_observer_transport_only_accepts_status_reads(self):
        observer = object.__new__(guard.WranglerAdapter)
        observer.plan = {**upgrade(), 'phase': 'observe'}
        observer.origin = ORIGIN
        for cli_command in [('deploy',), ('whoami',), ('containers', 'registries', 'credentials')]:
            with self.subTest(cli_command=cli_command), self.assertRaises(guard.GuardError):
                observer.command(*cli_command)
        for path, body in [('/operator/status', {}), ('/operator/preflight', {}),
                           ('/operator/deactivate', {}), ('/operator/activate', {})]:
            with self.subTest(path=path), self.assertRaises(guard.GuardError):
                observer.request(path, body)

    def test_upgrade_preserves_controller_context_validation(self):
        actual = object.__new__(guard.WranglerAdapter)
        actual.controller_sha = 'c' * 40
        actual.context_path = self.ledger.parent / 'cutover-context.json'
        p = upgrade('upgrade-drain')
        self.adapter.fresh_context = actual.fresh_context
        context = {**approval(p), 'controllerApproved': True, 'controllerSha': actual.controller_sha}
        before = self.ledger.read_bytes()
        for bad in [{'controllerSha': 'f' * 40}, {'controllerApproved': False}]:
            guard.atomic_json(actual.context_path, {**context, **bad})
            with self.subTest(bad=bad), self.assertRaisesRegex(guard.GuardError, 'EXACT_CONTROLLER_APPROVAL_REQUIRED'):
                guard.execute_upgrade(p, context, self.adapter, self.ledger, now=NOW)
            self.assertEqual(self.ledger.read_bytes(), before)
            self.assertNotIn('deactivate', self.adapter.calls)
        guard.atomic_json(actual.context_path, context)
        record = guard.execute_upgrade(p, context, self.adapter, self.ledger, now=NOW)
        self.assertEqual(record['controllerSha'], actual.controller_sha)

    def test_changed_do_or_preflight_version_cannot_activate(self):
        self.run_phase('upgrade-drain'); self.run_phase('upgrade-preflight')
        self.adapter.status_value['doId'] = 'a' * 64
        with self.assertRaisesRegex(guard.GuardError, 'DEPLOYMENT_OR_DURABLE_OBJECT_CHANGED'):
            self.run_phase('upgrade-activate')
        self.assertNotIn('activate', self.adapter.calls)

    def test_replacement_do_or_claiming_preflight_after_deploy_is_uncertain(self):
        for field in ('doId', 'providerCalled', 'claimVerified', 'heartbeatWritten'):
            with self.subTest(field=field):
                guard.atomic_json(self.ledger, self.original); self.adapter = Adapter(self.ledger)
                self.run_phase('upgrade-drain')
                original_preflight = self.adapter.preflight
                def corrupt(p):
                    result = original_preflight(p)
                    if field == 'doId': result['doId'] = 'f' * 64
                    else: result['preflight'][field] = True
                    return result
                self.adapter.preflight = corrupt
                with self.assertRaises(guard.GuardError): self.run_phase('upgrade-preflight')
                self.assertEqual(json.loads(self.ledger.read_text())['state'], 'uncertain')
                self.assertNotIn('activate', self.adapter.calls)

    def test_upgrade_plan_cannot_substitute_old_worker_or_omit_previous_identity(self):
        for mutate in (lambda p: p.pop('previousRuntime'),
                       lambda p: p['previousRuntime'].update(sourceSha='not-a-sha'),
                       lambda p: p['previousRuntime'].update(doId=''),
                       lambda p: p.update(sourceSha=p['previousRuntime']['sourceSha'])):
            p = upgrade(); mutate(p)
            with self.assertRaises(guard.GuardError): guard.validate_plan(p, p['sourceSha'])

    def test_new_image_receipts_preserve_legacy_success_and_uncertain_records(self):
        directory = self.ledger.parent
        legacy = directory / 'teacher-cloudflare-image-ledger.json'
        for state in ('image_verified', 'uncertain'):
            guard.atomic_json(legacy, {'identity': guard.identity(plan()), 'state': state})
            before = legacy.read_bytes()
            self.assertEqual(guard.image_ledger_path(directory, plan()), legacy)
            new_path = guard.image_ledger_path(directory, upgrade())
            self.assertNotEqual(new_path, legacy)
            self.assertFalse(new_path.exists())
            self.assertEqual(legacy.read_bytes(), before)


if __name__ == '__main__':
    unittest.main()
