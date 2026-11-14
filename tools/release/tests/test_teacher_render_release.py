"""Offline tests for the free-only operator path. No provider/model/network calls."""
from __future__ import annotations

import copy
from datetime import datetime, timezone, timedelta
import importlib.util
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

SPEC = importlib.util.spec_from_file_location('render_release', Path(__file__).parents[1] / 'teacher-render-release.py')
G = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(G)
NOW = datetime(2026, 11, 14, 16, 0, tzinfo=timezone.utc)
SID, DEP = 'srv-abcdefghijklm', 'dep-abcdefghijklm'
PLAN = dict(target=G.TARGET, sourceSha='a' * 40, ownerId='tea-abcdefghijklm',
            serviceName='noam-teacher-generation', branch='codex/teacher-generation-free-render-20261114',
            plan='free', region='frankfurt', autoDeployTrigger='off')
VALUES = {key: 'fixture-' + key for key in G.SECRET_NAMES}
VALUES['WORKER_WAKE_SECRET'] = 'b' * 64


def service():
    return {**G.create_body(PLAN), 'id': SID,
            'serviceDetails': {**G.create_body(PLAN)['serviceDetails'],
                               'url': 'https://noam-teacher-generation.onrender.com'}}


def receipt(state='preflight_ready'):
    return dict(target=G.TARGET, planSha256=G.digest(PLAN), state=state, serviceId=SID,
                initialDeployId=DEP, requestedDeployId=DEP, runtimeSha256=G.digest(VALUES),
                preflightDeployId=DEP, preflightAt=NOW.isoformat())


def context():
    return dict(approved=True, planSha256=G.digest(PLAN), approvalReference='human-confirmation-fixture',
                paymentMethodAbsent=True, workspacePlan='hobby', billingOwnerId=PLAN['ownerId'],
                billingCheckedAt=NOW.isoformat(), qualificationSourceSha=PLAN['sourceSha'], qualificationPassed=True,
                runtimeSecretsToRenderApproved=True, activeJobs=0, queueCheckedAt=NOW.isoformat(),
                macWorkerStopped=True, macWorkerCheckedAt=NOW.isoformat())


class Provider:
    def __init__(self):
        self.calls = []
        self.service = service()
        self.deploy = {'id': DEP, 'status': 'live', 'commit': {'id': PLAN['sourceSha']}}
        self.env = {**VALUES, G.FLAG: 'false'}

    def request(self, path, method='GET', body=None, **kw):
        self.calls.append((path, method, body, kw))
        if path == '/v1/services' and method == 'POST':
            return {'service': self.service, 'deployId': DEP}
        if path.endswith('/env-vars?limit=7'):
            return [{'envVar': {'key': k, 'value': v}} for k, v in self.env.items()]
        if path.endswith('/deploys?limit=1'): return [{'deploy': self.deploy}]
        if path == '/v1/services/' + SID: return self.service
        if path == '/preflight': return {'ok': True, 'state': 'ready'}
        if path.endswith('/env-vars') and method == 'PUT': return {}
        if path.endswith('/deploys') and method == 'POST': return {'id': 'dep-nopqrstuvwxyz'}
        raise AssertionError('Unexpected provider path')


class GuardTests(unittest.TestCase):
    def rejects(self, fn, code):
        with self.assertRaisesRegex(G.GuardError, '^' + code + '$'): fn()

    def test_plan_rejects_paid_auto_deploy_unknown_fields_and_branch(self):
        for key, value, code in [('plan', 'starter', 'FREE_ONLY'), ('autoDeployTrigger', 'commit', 'FREE_ONLY'),
                                 ('extra', True, 'PLAN_FIELDS'), ('branch', 'main', 'BRANCH_MISMATCH')]:
            self.rejects(lambda: G.validate_plan({**PLAN, key: value}), code)

    def test_create_has_no_secrets_disk_autoscaling_or_paid_plan(self):
        body = G.create_body(PLAN)
        self.assertEqual(body['envVars'], [{'key': G.FLAG, 'value': 'false'}])
        self.assertEqual(body['serviceDetails']['plan'], 'free')
        self.assertNotIn('disk', body['serviceDetails'])
        self.assertNotIn('autoscaling', body['serviceDetails'])
        self.assertEqual(body['serviceDetails']['previews'], {'generation': 'off'})

    def test_missing_approval_no_card_or_exact_qualification_blocks(self):
        cases = [('approved', False, 'EXACT_PLAN_APPROVAL_REQUIRED'),
                 ('paymentMethodAbsent', False, 'ZERO_PAYMENT_EVIDENCE_REQUIRED'),
                 ('workspacePlan', 'pro', 'ZERO_PAYMENT_EVIDENCE_REQUIRED'),
                 ('billingOwnerId', 'tea-otherworkspace', 'BILLING_EVIDENCE_STALE'),
                 ('billingCheckedAt', (NOW - timedelta(hours=2)).isoformat(), 'BILLING_EVIDENCE_STALE'),
                 ('qualificationSourceSha', 'c' * 40, 'QUALIFICATION_REQUIRED'),
                 ('runtimeSecretsToRenderApproved', False, 'RUNTIME_DESTINATION_APPROVAL_REQUIRED')]
        for key, value, code in cases:
            self.rejects(lambda: G.validate_context({**context(), key: value}, PLAN, 'configure', NOW), code)

    def test_activation_requires_fresh_empty_queue_and_previous_worker_stopped(self):
        for key, value, code in [('activeJobs', 1, 'FRESH_EMPTY_QUEUE_REQUIRED'),
                                 ('activeJobs', False, 'FRESH_EMPTY_QUEUE_REQUIRED'),
                                 ('queueCheckedAt', (NOW - timedelta(seconds=91)).isoformat(), 'FRESH_EMPTY_QUEUE_REQUIRED'),
                                 ('macWorkerStopped', False, 'PREVIOUS_WORKER_STOP_REQUIRED')]:
            self.rejects(lambda: G.validate_context({**context(), key: value}, PLAN, 'activate', NOW), code)
        G.validate_context(context(), PLAN, 'activate', NOW)

    def test_future_or_naive_timestamps_fail(self):
        self.assertFalse(G.fresh((NOW + timedelta(seconds=1)).isoformat(), 90, NOW))
        self.assertFalse(G.fresh(NOW.replace(tzinfo=None).isoformat(), 90, NOW))

    def test_service_identity_rejects_drift_before_any_writes(self):
        mutations = [('plan', 'starter'), ('region', 'oregon'), ('numInstances', 2),
                     ('disk', {'sizeGB': 1}), ('autoscaling', {'enabled': True}),
                     ('url', 'https://noam-teacher-generation.onrender.com.evil.test'),
                     ('url', 'https://noam-teacher-generation.onrender.com/path'),
                     ('previews', {'generation': 'automatic'})]
        for key, value in mutations:
            api = Provider(); api.service['serviceDetails'][key] = value
            with self.assertRaises(G.GuardError): G.perform('activate', PLAN, api, receipt(), VALUES, NOW)
            self.assertTrue(all(call[1] == 'GET' for call in api.calls))

    def test_create_is_secretless_and_records_deployment(self):
        api = Provider(); result = G.perform('create', PLAN, api, None)
        self.assertEqual(result['state'], 'created_disabled')
        self.assertEqual(result['initialDeployId'], DEP)
        self.assertEqual(len(api.calls), 1)
        for value in VALUES.values(): self.assertNotIn(value, json.dumps(api.calls))

    def test_configure_stays_disabled_and_pins_commit(self):
        api = Provider(); api.env = {G.FLAG: 'false'}
        result = G.perform('configure', PLAN, api, receipt('created_disabled'), VALUES, NOW)
        self.assertEqual(result['state'], 'disabled_deploying')
        env = next(c[2] for c in api.calls if c[1] == 'PUT')
        self.assertIn({'key': G.FLAG, 'value': 'false'}, env)
        self.assertEqual(api.calls[-1][2]['commitId'], PLAN['sourceSha'])
        for value in VALUES.values(): self.assertNotIn(value, json.dumps(result))

    def test_inspect_requires_requested_deploy_not_an_old_same_source(self):
        api = Provider(); state = receipt('activating'); state['requestedDeployId'] = 'dep-otherabcdefgh'
        self.rejects(lambda: G.perform('inspect', PLAN, api, state), 'DEPLOY_ID_MISMATCH')
        self.assertEqual(G.perform('inspect', PLAN, api, receipt('activating'))['state'], 'active')

    def test_inspect_rejects_building_and_wrong_source(self):
        for field, value in [('status', 'build_in_progress'), ('commit', {'id': 'd' * 40})]:
            api = Provider(); api.deploy[field] = value
            self.rejects(lambda: G.perform('inspect', PLAN, api, receipt('disabled_deploying')), 'EXACT_LIVE_DEPLOY_REQUIRED')

    def test_preflight_only_invokes_check_not_wake(self):
        api = Provider()
        result = G.perform('preflight', PLAN, api, receipt('disabled_live'), VALUES, NOW)
        self.assertEqual(result['state'], 'preflight_ready')
        self.assertEqual(api.calls[-1][0:3], ('/preflight', 'POST', None))
        self.assertFalse(any('/wake' in call[0] for call in api.calls))

    def test_preflight_requires_same_deployed_runtime_values(self):
        self.rejects(lambda: G.perform('preflight', PLAN, Provider(), receipt('disabled_live'),
                                      {**VALUES, 'QWEN_MODEL': 'changed'}, NOW), 'RUNTIME_CHANGED_AFTER_DEPLOY')

    def test_preflight_checking_is_pending_and_cannot_activate(self):
        api = Provider(); original = api.request
        def request(path, *args, **kwargs):
            if path == '/preflight': return {'ok': False, 'state': 'checking'}
            return original(path, *args, **kwargs)
        api.request = request
        result = G.perform('preflight', PLAN, api, receipt('disabled_live'), VALUES, NOW)
        self.assertEqual(result['state'], 'preflight_checking')
        self.rejects(lambda: G.perform('activate', PLAN, api, result, VALUES, NOW), 'FRESH_PREFLIGHT_REQUIRED')

    def test_activation_rereads_context_immediately_before_mutation(self):
        api = Provider()
        def stale(): raise G.GuardError('FRESH_EMPTY_QUEUE_REQUIRED')
        self.rejects(lambda: G.perform('activate', PLAN, api, receipt(), VALUES, NOW, before_write=stale), 'FRESH_EMPTY_QUEUE_REQUIRED')
        self.assertTrue(all(c[1] == 'GET' for c in api.calls))

    def test_preflight_expiring_during_provider_read_blocks_write(self):
        api = Provider(); original = api.request
        clock = [NOW]
        def request(path, *args, **kwargs):
            result = original(path, *args, **kwargs)
            if '/env-vars?' in path: clock[0] = NOW + timedelta(seconds=91)
            return result
        api.request = request
        with patch.object(G, 'utc', side_effect=lambda: clock[0]):
            self.rejects(lambda: G.perform('activate', PLAN, api, receipt(), VALUES), 'FRESH_PREFLIGHT_REQUIRED')
        self.assertTrue(all(c[1] == 'GET' for c in api.calls))

    def test_actual_tls_context_verifies_hostnames_and_has_roots(self):
        context = G.tls_context()
        self.assertEqual(context.verify_mode, G.ssl.CERT_REQUIRED)
        self.assertTrue(context.check_hostname)
        self.assertGreater(context.cert_store_stats()['x509_ca'], 0)

    def test_activate_rejects_stale_preflight_or_different_deployment(self):
        for key, value in [('preflightAt', (NOW - timedelta(seconds=91)).isoformat()),
                           ('preflightDeployId', 'dep-otherabcdefgh'), ('state', 'disabled_live')]:
            self.rejects(lambda: G.perform('activate', PLAN, Provider(), {**receipt(), key: value}, VALUES, NOW), 'FRESH_PREFLIGHT_REQUIRED')

    def test_activate_rejects_changed_secret_and_provider_drift(self):
        self.rejects(lambda: G.perform('activate', PLAN, Provider(), receipt(),
                                      {**VALUES, 'QWEN_MODEL': 'changed'}, NOW), 'RUNTIME_CHANGED_AFTER_PREFLIGHT')
        api = Provider(); api.env['QWEN_MODEL'] = 'unexpected'
        self.rejects(lambda: G.perform('activate', PLAN, api, receipt(), VALUES, NOW), 'RUNTIME_PROVIDER_DRIFT')

    def test_unknown_or_extra_environment_not_overwritten(self):
        api = Provider(); api.env['UNKNOWN'] = 'keep'
        self.rejects(lambda: G.perform('activate', PLAN, api, receipt(), VALUES, NOW), 'ENVIRONMENT_READBACK_FAILED')
        self.assertTrue(all(c[1] == 'GET' for c in api.calls))

    def test_activate_only_enables_same_values_and_source_without_wake(self):
        api = Provider(); result = G.perform('activate', PLAN, api, receipt(), VALUES, NOW)
        self.assertEqual(result['state'], 'activating')
        env = next(c[2] for c in api.calls if c[1] == 'PUT')
        self.assertIn({'key': G.FLAG, 'value': 'true'}, env)
        self.assertFalse(any('/wake' in c[0] for c in api.calls))

    def test_redirects_and_unlisted_operator_routes_never_send(self):
        self.rejects(lambda: G.NoRedirect().redirect_request(), 'REDIRECT_DENIED')
        client = G.Http('fixture-token-not-a-real-key')
        with patch.object(client.opener, 'open', side_effect=AssertionError('network forbidden')):
            for path in ['/wake', '/preflight?x=1']:
                self.rejects(lambda: client.request(path, 'POST', operator_url=service()['serviceDetails']['url'], operator_key='x'), 'OPERATOR_PATH_DENIED')
            self.rejects(lambda: client.request('/v1/billing'), 'API_PATH_DENIED')

    def test_private_files_reject_symlink_permissions_and_duplicate_keys(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); repo = base / 'repo'; repo.mkdir()
            path = base / 'secrets.json'; path.write_text(json.dumps(VALUES)); path.chmod(0o600)
            self.assertEqual(G.runtime_values(path, repo), VALUES)
            path.chmod(0o644)
            self.rejects(lambda: G.runtime_values(path, repo), 'PRIVATE_FILE_PERMISSIONS')
            path.chmod(0o600); link = base / 'link.json'; link.symlink_to(path)
            self.rejects(lambda: G.runtime_values(link, repo), 'PRIVATE_FILE_REQUIRED')
            path.write_text('{"a":1,"a":2}')
            self.rejects(lambda: G.private_json(path, repo), 'DUPLICATE_JSON_KEY')

    def test_lost_create_response_is_durable_and_does_not_retry_or_leak(self):
        with tempfile.TemporaryDirectory() as tmp:
            base = Path(tmp); repo = base / 'repo'; repo.mkdir()
            plan = base / 'plan.json'; plan.write_text(json.dumps(PLAN))
            ctx = base / 'context.json'; ctx.write_text(json.dumps(context())); ctx.chmod(0o600)
            state = base / 'state'
            calls = []
            class FailingProvider:
                def request(self, path, *args, **kwargs):
                    calls.append(path)
                    if path.startswith('/v1/owners/'): return {'id': PLAN['ownerId']}
                    self_ledger = json.loads((state / 'current.json').read_text())
                    self.assertEqual(self_ledger['state'], 'uncertain')
                    raise OSError('sensitive-fixture-provider-response')
            argv = ['guard', 'create', '--apply', '--plan', str(plan), '--repo', str(repo),
                    '--context', str(ctx), '--state-dir', str(state)]
            stderr = io.StringIO()
            with patch.object(G.sys, 'argv', argv), patch.object(G, 'utc', return_value=NOW), \
                 patch.object(G, 'verify_source'), patch.object(G, 'Http', return_value=FailingProvider()), \
                 patch.object(G.sys, 'stderr', stderr):
                self.assertEqual(G.main(), 1)
                first = len(calls)
                self.assertEqual(G.main(), 1)
                self.assertEqual(len(calls), first)
            self.assertEqual(json.loads((state / 'current.json').read_text())['state'], 'uncertain')
            self.assertFalse((state / 'release.lock').exists())
            self.assertNotIn('sensitive-fixture-provider-response', stderr.getvalue())
            self.assertIn('UNCERTAIN_RELEASE_STOP', stderr.getvalue())

    def test_release_dispatch_precedes_wix_credentials(self):
        script = (Path(__file__).parents[1] / 'release.sh').read_text()
        self.assertLess(script.index('teacher-render-free)'), script.index('/../.env'))
        self.assertIn('exec python3 "$(dirname "$0")/teacher-render-release.py" "$@"', script)


if __name__ == '__main__': unittest.main()
