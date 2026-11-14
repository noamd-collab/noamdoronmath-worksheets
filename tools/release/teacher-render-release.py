#!/usr/bin/env python3
"""Explicit, free-only Render pilot release. Default is an offline plan.

No model call, wake, quota edit, billing action or automatic retry is exposed.
Create is secretless; configure deploys disabled; activate needs fresh preflight
and a stopped previous worker. All deployment phases use the same reviewed SHA.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import ssl
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import HTTPSHandler, HTTPRedirectHandler, ProxyHandler, Request, build_opener

REPO = 'https://github.com/noamd-collab/noamdoronmath-worksheets'
TARGET = 'teacher-render-free'
DOCKERFILE = 'tools/teacher-generation/cloud/render/Dockerfile'
SECRET_NAMES = {'WORKER_WAKE_SECRET', 'TEACHER_GENERATION_SERVICE_KEY', 'QWEN_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL'}
FLAG = 'TEACHER_FREE_WORKER_ENABLED'
PHASES = ('create', 'configure', 'inspect', 'preflight', 'activate')


class GuardError(Exception):
    pass


def require(value, code):
    if not value:
        raise GuardError(code)


def canonical(value):
    return json.dumps(value, sort_keys=True, separators=(',', ':')).encode()


def digest(value):
    return hashlib.sha256(canonical(value)).hexdigest()


def utc():
    return datetime.now(timezone.utc)


def fresh(value, seconds, now=None):
    try:
        dt = datetime.fromisoformat(value.replace('Z', '+00:00'))
        return dt.tzinfo is not None and 0 <= ((now or utc()) - dt).total_seconds() <= seconds
    except (TypeError, ValueError, AttributeError):
        return False


def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, 'DUPLICATE_JSON_KEY')
        result[key] = value
    return result


def read_json(path):
    require(path.stat().st_size <= 65536, 'INPUT_TOO_LARGE')
    return json.loads(path.read_text(), object_pairs_hook=unique)


def private_json(path, repo):
    require(path and path.is_absolute() and path.is_file() and not path.is_symlink(), 'PRIVATE_FILE_REQUIRED')
    require(not path.resolve().is_relative_to(repo.resolve()), 'PRIVATE_FILE_OUTSIDE_CHECKOUT_REQUIRED')
    info = path.stat()
    require(info.st_uid == os.getuid() and info.st_mode & 0o777 == 0o600, 'PRIVATE_FILE_PERMISSIONS')
    return read_json(path)


def validate_plan(plan):
    keys = {'target', 'sourceSha', 'ownerId', 'serviceName', 'branch', 'plan', 'region', 'autoDeployTrigger'}
    require(isinstance(plan, dict) and set(plan) == keys, 'PLAN_FIELDS')
    require(plan['target'] == TARGET and plan['plan'] == 'free' and plan['autoDeployTrigger'] == 'off', 'FREE_ONLY')
    require(plan['region'] == 'frankfurt', 'REGION_MISMATCH')
    require(isinstance(plan['sourceSha'], str) and re.fullmatch('[a-f0-9]{40}', plan['sourceSha']), 'SOURCE_SHA')
    require(isinstance(plan['ownerId'], str) and re.fullmatch(r'(?:tea|own)-[a-z0-9]{10,32}', plan['ownerId']), 'OWNER_ID')
    require(isinstance(plan['serviceName'], str) and re.fullmatch(r'noam-teacher-generation(?:-[a-z0-9]{1,16})?', plan['serviceName']), 'SERVICE_NAME')
    require(plan['branch'] == 'codex/teacher-generation-free-render-20261114', 'BRANCH_MISMATCH')
    return digest(plan)


def validate_context(ctx, plan, phase, now=None):
    require(ctx.get('approved') is True and ctx.get('planSha256') == digest(plan), 'EXACT_PLAN_APPROVAL_REQUIRED')
    require(isinstance(ctx.get('approvalReference'), str) and 8 <= len(ctx['approvalReference']) <= 2000, 'APPROVAL_REFERENCE_REQUIRED')
    # Render does not expose payment-method state in its public API. This is an
    # explicit recent dashboard observation, not an inferred API guarantee.
    require(ctx.get('paymentMethodAbsent') is True and ctx.get('workspacePlan') == 'hobby', 'ZERO_PAYMENT_EVIDENCE_REQUIRED')
    require(ctx.get('billingOwnerId') == plan['ownerId'] and fresh(ctx.get('billingCheckedAt'), 3600, now), 'BILLING_EVIDENCE_STALE')
    require(ctx.get('qualificationSourceSha') == plan['sourceSha'] and ctx.get('qualificationPassed') is True, 'QUALIFICATION_REQUIRED')
    if phase in ('configure', 'activate'):
        require(ctx.get('runtimeSecretsToRenderApproved') is True, 'RUNTIME_DESTINATION_APPROVAL_REQUIRED')
    if phase == 'activate':
        require(type(ctx.get('activeJobs')) is int and ctx['activeJobs'] == 0 and fresh(ctx.get('queueCheckedAt'), 90, now), 'FRESH_EMPTY_QUEUE_REQUIRED')
        require(ctx.get('macWorkerStopped') is True and fresh(ctx.get('macWorkerCheckedAt'), 90, now), 'PREVIOUS_WORKER_STOP_REQUIRED')


def create_body(plan):
    validate_plan(plan)
    return {'type': 'web_service', 'name': plan['serviceName'], 'ownerId': plan['ownerId'], 'repo': REPO,
            'branch': plan['branch'], 'autoDeployTrigger': 'off', 'rootDir': '',
            'envVars': [{'key': FLAG, 'value': 'false'}],
            'serviceDetails': {'runtime': 'docker', 'plan': 'free', 'region': plan['region'], 'numInstances': 1,
                'healthCheckPath': '/healthz', 'previews': {'generation': 'off'}, 'maxShutdownDelaySeconds': 40,
                'envSpecificDetails': {'dockerfilePath': DOCKERFILE, 'dockerContext': '.', 'dockerCommand': ''}}}


def service_identity(service, plan):
    details = service.get('serviceDetails') or {}
    env = details.get('envSpecificDetails') or {}
    require(service.get('type') == 'web_service' and service.get('name') == plan['serviceName']
            and service.get('ownerId') == plan['ownerId'] and isinstance(service.get('repo'), str) and service['repo'].removesuffix('.git') == REPO
            and service.get('branch') == plan['branch'] and service.get('rootDir', '') == '', 'SERVICE_IDENTITY_MISMATCH')
    require(service.get('autoDeployTrigger', 'off' if service.get('autoDeploy') == 'no' else None) == 'off'
            and details.get('plan') == 'free' and details.get('region') == plan['region']
            and details.get('numInstances', 1) == 1 and not details.get('disk') and not details.get('autoscaling'), 'SERVICE_NOT_FREE_FIXED_SINGLETON')
    require(details.get('runtime', details.get('env')) == 'docker' and env.get('dockerfilePath') == DOCKERFILE
            and env.get('dockerContext') == '.' and not env.get('dockerCommand') and not details.get('preDeployCommand')
            and details.get('healthCheckPath') == '/healthz'
            and details.get('previews', {}).get('generation') == 'off', 'SERVICE_RUNTIME_MISMATCH')
    url = details.get('url', '')
    require(isinstance(url, str) and re.fullmatch(r'https://noam-teacher-generation(?:-[a-z0-9]{1,30})?\.onrender\.com', url), 'SERVICE_URL_MISMATCH')
    return url


def runtime_values(path, repo):
    values = private_json(path, repo)
    require(isinstance(values, dict) and set(values) == SECRET_NAMES, 'RUNTIME_SECRET_NAMES')
    require(all(isinstance(v, str) and 0 < len(v) <= 8192 and not any(ord(c) < 32 for c in v) for v in values.values()), 'RUNTIME_SECRET_VALUES')
    require(re.fullmatch('[a-f0-9]{64}', values['WORKER_WAKE_SECRET']), 'WAKE_SECRET_FORMAT')
    return values


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        raise GuardError('REDIRECT_DENIED')


def tls_context():
    context = ssl.create_default_context()
    if context.cert_store_stats().get('x509_ca', 0) == 0:
        # Some macOS Python installs have no default CA file. Use the same
        # pinned CA bundle as the worker; never fall back to unverified TLS.
        try:
            import certifi
            require(tuple(int(x) for x in certifi.__version__.split('.')) == (2026, 1, 4), 'PINNED_CA_BUNDLE_REQUIRED')
            context = ssl.create_default_context(cafile=certifi.where())
        except ImportError:
            raise GuardError('VALID_TLS_TRUST_STORE_REQUIRED') from None
    require(context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
            and context.cert_store_stats().get('x509_ca', 0) > 0, 'VALID_TLS_TRUST_STORE_REQUIRED')
    return context


class Http:
    def __init__(self, token):
        require(isinstance(token, str) and 16 <= len(token) <= 8192 and not any(ord(c) < 33 for c in token), 'RENDER_API_KEY_REQUIRED')
        self.token = token
        self.opener = build_opener(ProxyHandler({}), NoRedirect(), HTTPSHandler(context=tls_context()))

    def request(self, path, method='GET', body=None, *, operator_url=None, operator_key=None):
        if operator_url is None:
            require(re.fullmatch(r'/v1/(?:owners/[a-z0-9-]+|services(?:/[a-z0-9-]+(?:/(?:env-vars|deploys)(?:/[a-z0-9-]+)?)?)?)(?:\?limit=[17])?', path), 'API_PATH_DENIED')
            url, token = 'https://api.render.com' + path, self.token
        else:
            require(path == '/preflight' and re.fullmatch(r'https://noam-teacher-generation(?:-[a-z0-9]{1,30})?\.onrender\.com', operator_url), 'OPERATOR_PATH_DENIED')
            url, token = operator_url + path, operator_key
        data = b'' if method == 'POST' and body is None else canonical(body) if body is not None else None
        request = Request(url, data=data, method=method, headers={'Authorization': 'Bearer ' + token,
                          'Accept': 'application/json', 'Content-Type': 'application/json'})
        try:
            with self.opener.open(request, timeout=30) as response:
                raw = response.read(262145)
                require(len(raw) <= 262144, 'API_RESPONSE_TOO_LARGE')
                return json.loads(raw) if raw else {}
        except HTTPError as exc:
            raise GuardError('PROVIDER_HTTP_' + str(exc.code)) from None


def git(repo, *args):
    cp = subprocess.run(['git', '-C', str(repo), *args], capture_output=True, text=True, timeout=30)
    require(cp.returncode == 0, 'GIT_VERIFICATION_FAILED')
    return cp.stdout.strip()


def verify_source(repo, plan):
    require(git(repo, 'rev-parse', 'HEAD') == plan['sourceSha'] and not git(repo, 'status', '--porcelain'), 'CLEAN_EXACT_CHECKOUT_REQUIRED')
    git(repo, 'fetch', 'origin', 'headless/astro-poc-baseline', plan['branch'])
    git(repo, 'merge-base', '--is-ancestor', plan['sourceSha'], 'origin/headless/astro-poc-baseline')
    require(git(repo, 'rev-parse', 'origin/' + plan['branch']) == plan['sourceSha'], 'SOURCE_BRANCH_MOVED')


def save(path, value):
    temporary = path.with_suffix('.tmp')
    with open(temporary, 'x', opener=lambda p, flags: os.open(p, flags, 0o600)) as stream:
        json.dump(value, stream, indent=2); stream.write('\n'); stream.flush(); os.fsync(stream.fileno())
    temporary.replace(path)


def perform(phase, plan, http, state, values=None, now=None, before_write=None):
    """Return a receipt containing only public IDs/state, never provider bodies."""
    if phase == 'create':
        require(state is None, 'SERVICE_ALREADY_RECORDED')
        if before_write: before_write()
        created = http.request('/v1/services', 'POST', create_body(plan))
        service = created.get('service') or {}
        url = service_identity(service, plan)
        require(re.fullmatch('srv-[a-z0-9]{10,32}', service.get('id', '')), 'INVALID_SERVICE_ID')
        require(isinstance(created.get('deployId'), str) and re.fullmatch('dep-[a-z0-9]{10,32}', created['deployId']), 'INITIAL_DEPLOY_RECEIPT_REQUIRED')
        return {'target': TARGET, 'planSha256': digest(plan), 'state': 'created_disabled',
                'serviceId': service['id'], 'url': url, 'initialDeployId': created.get('deployId')}
    require(isinstance(state, dict) and state.get('target') == TARGET and state.get('planSha256') == digest(plan), 'MATCHING_LEDGER_REQUIRED')
    sid = state.get('serviceId', '')
    require(re.fullmatch('srv-[a-z0-9]{10,32}', sid), 'INVALID_SERVICE_ID')
    root = '/v1/services/' + sid
    service = http.request(root)
    url = service_identity(service, plan)
    deploys = http.request(root + '/deploys?limit=1')
    require(isinstance(deploys, list) and len(deploys) == 1, 'DEPLOY_PROOF_REQUIRED')
    deployed = deploys[0].get('deploy') or deploys[0]
    require(deployed.get('status') == 'live' and deployed.get('commit', {}).get('id') == plan['sourceSha'], 'EXACT_LIVE_DEPLOY_REQUIRED')
    expected_deploy = state.get('requestedDeployId') or state.get('initialDeployId')
    require(expected_deploy and deployed.get('id') == expected_deploy, 'DEPLOY_ID_MISMATCH')
    result = {**state, 'url': url, 'liveDeployId': deployed.get('id'), 'observedAt': (now or utc()).isoformat()}
    if phase == 'inspect':
        if state['state'] == 'disabled_deploying': result['state'] = 'disabled_live'
        elif state['state'] == 'activating': result['state'] = 'active'
        return result
    if phase == 'preflight':
        require(state['state'] in ('disabled_live', 'preflight_ready', 'preflight_checking') and values, 'DISABLED_LIVE_REQUIRED')
        require(state.get('runtimeSha256') == digest(values), 'RUNTIME_CHANGED_AFTER_DEPLOY')
        preflight = http.request('/preflight', 'POST', operator_url=url, operator_key=values['WORKER_WAKE_SECRET'])
        require((preflight.get('state') == 'checking' and preflight.get('ok') is False)
                or (preflight.get('state') == 'ready' and preflight.get('ok') is True), 'PREFLIGHT_FAILED')
        result.update(state='preflight_' + preflight['state'], preflightDeployId=deployed['id'], preflightAt=(now or utc()).isoformat())
        return result
    require(phase in ('configure', 'activate') and values, 'RUNTIME_VALUES_REQUIRED')
    if phase == 'configure':
        require(state['state'] == 'created_disabled', 'CREATE_BEFORE_CONFIGURE')
    else:
        require(state['state'] == 'preflight_ready' and state.get('preflightDeployId') == deployed['id']
                and fresh(state.get('preflightAt'), 90, now), 'FRESH_PREFLIGHT_REQUIRED')
        require(state.get('runtimeSha256') == digest(values), 'RUNTIME_CHANGED_AFTER_PREFLIGHT')
    # This service belongs to this ledger. Reject unexpected operator-added env
    # rather than wiping another configuration with Render's replace-all API.
    existing = http.request(root + '/env-vars?limit=7')
    # We own exactly six names. Seven results means unexpected configuration,
    # even if the provider has more pages; never silently truncate pagination.
    require(isinstance(existing, list) and len(existing) < 7, 'ENVIRONMENT_READBACK_FAILED')
    current = [entry.get('envVar', entry) for entry in existing]
    env = {entry.get('key'): entry.get('value') for entry in current}
    expected_names = {FLAG} if phase == 'configure' else SECRET_NAMES | {FLAG}
    require(set(env) == expected_names and len(env) == len(current) and env.get(FLAG) == 'false', 'UNEXPECTED_EXISTING_ENVIRONMENT')
    if phase == 'activate':
        require({key: env[key] for key in SECRET_NAMES} == values, 'RUNTIME_PROVIDER_DRIFT')
    desired = {**values, FLAG: 'true' if phase == 'activate' else 'false'}
    def revalidate():
        if before_write: before_write()
        if phase == 'activate':
            require(fresh(state.get('preflightAt'), 90, now), 'FRESH_PREFLIGHT_REQUIRED')
    revalidate()
    http.request(root + '/env-vars', 'PUT', [{'key': key, 'value': desired[key]} for key in sorted(desired)])
    revalidate()
    deploy = http.request(root + '/deploys', 'POST', {'commitId': plan['sourceSha'], 'clearCache': 'do_not_clear'})
    require(isinstance(deploy, dict) and isinstance(deploy.get('id'), str), 'DEPLOY_RECEIPT_REQUIRED')
    require(re.fullmatch('dep-[a-z0-9]{10,32}', deploy['id']), 'INVALID_DEPLOY_ID')
    result.update(state='activating' if phase == 'activate' else 'disabled_deploying', requestedDeployId=deploy['id'], runtimeSha256=digest(values))
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('phase', choices=PHASES)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--repo', type=Path, default=Path(__file__).resolve().parents[2])
    parser.add_argument('--context', type=Path)
    parser.add_argument('--state-dir', type=Path)
    parser.add_argument('--runtime-secrets-file', type=Path)
    parser.add_argument('--apply', action='store_true')
    args = parser.parse_args()
    try:
        plan = read_json(args.plan); validate_plan(plan)
        if not args.apply:
            print(json.dumps({'dryRun': True, 'phase': args.phase, 'planSha256': digest(plan), 'plan': plan,
                              'createBody': create_body(plan), 'modelCalled': False})); return 0
        ctx = private_json(args.context, args.repo); validate_context(ctx, plan, args.phase)
        verify_source(args.repo, plan)
        directory = args.state_dir
        require(directory and directory.is_absolute() and not directory.resolve().is_relative_to(args.repo.resolve()), 'EXTERNAL_STATE_DIR_REQUIRED')
        directory.mkdir(mode=0o700, parents=True, exist_ok=True)
        require(not directory.is_symlink() and directory.stat().st_mode & 0o777 == 0o700, 'PRIVATE_STATE_DIR_REQUIRED')
        lock = directory / 'release.lock'
        fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600); os.close(fd)
        path = directory / 'current.json'
        try:
            require(not path.is_symlink(), 'STATE_SYMLINK_DENIED')
            previous = private_json(path, args.repo) if path.exists() else None
            require(previous is None or previous.get('state') != 'uncertain', 'UNCERTAIN_RELEASE_STOP')
            values = runtime_values(args.runtime_secrets_file, args.repo) if args.phase in ('configure', 'preflight', 'activate') else None
            http = Http(os.environ.get('RENDER_API_KEY'))
            owner = http.request('/v1/owners/' + plan['ownerId'])
            require(owner.get('id') == plan['ownerId'], 'ACCOUNT_IDENTITY_MISMATCH')
            if args.phase not in ('inspect', 'preflight'):
                save(path, {**(previous or {}), 'target': TARGET, 'state': 'uncertain', 'planSha256': digest(plan), 'phase': args.phase})
            def recheck():
                validate_context(private_json(args.context, args.repo), plan, args.phase)
            result = perform(args.phase, plan, http, previous, values, before_write=recheck)
            save(path, result)
            print(json.dumps(result))
        finally:
            lock.unlink(missing_ok=True)
        return 0
    except (GuardError, OSError, ValueError, TypeError, KeyError, AttributeError, subprocess.SubprocessError) as exc:
        # Never echo request bodies, provider replies, paths containing secrets,
        # environment, or generic exception messages.
        print(json.dumps({'ok': False, 'error': str(exc) if isinstance(exc, GuardError) else type(exc).__name__}), file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
