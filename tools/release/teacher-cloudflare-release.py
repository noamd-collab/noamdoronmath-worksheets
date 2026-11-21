#!/usr/bin/env python3
"""Guard Cloudflare teacher-worker rollout and drained upgrades; never publish Wix.

Without --apply this validates and prints a plan fingerprint only. No credentials,
provider calls, queue claims, image builds or purchases are performed in plan mode.
"""
from __future__ import annotations

import argparse
import base64
import contextlib
from datetime import datetime, timezone
import fcntl
import hashlib
import hmac
import json
import io
import zipfile
import os
from pathlib import Path
import re
import shutil
import subprocess
import sys
import tempfile
from urllib.request import Request, build_opener, HTTPSHandler, HTTPRedirectHandler

ACCOUNT = '94be626240d3c682145e18cf9d2790e7'
CANONICAL = 'headless/astro-poc-baseline'
CLOUD_DIRECTORY = Path('tools/teacher-generation/cloud/cloudflare')
PLAN_KEYS = {'version', 'target', 'phase', 'sourceSha', 'accountId', 'workerName',
             'imageRef', 'doClass', 'singletonName'}
IMAGE_PLAN_KEYS = {'buildRunId', 'archiveSha256', 'archiveBytes', 'craneSha256'}
UPGRADE_PHASES = ('upgrade-drain', 'upgrade-preflight', 'upgrade-activate')


class GuardError(RuntimeError):
    """Only fixed non-sensitive codes may leave the release controller."""


def require(value, code):
    if not value:
        raise GuardError(code)


def canonical_json(value):
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))


def digest(value):
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


def utcnow():
    return datetime.now(timezone.utc)


def stamp(value):
    try:
        parsed = datetime.fromisoformat(value.replace('Z', '+00:00'))
        require(parsed.tzinfo is not None, 'TIMESTAMP_REQUIRES_TIMEZONE')
        return parsed
    except (ValueError, TypeError, AttributeError):
        raise GuardError('INVALID_TIMESTAMP') from None


def fresh(value, seconds, now=None):
    age = ((now or utcnow()) - stamp(value)).total_seconds()
    require(0 <= age <= seconds, 'STALE_OR_FUTURE_EVIDENCE')


def validate_plan(plan, expected_sha):
    require(isinstance(plan, dict), 'INVALID_PLAN_FIELDS')
    fields = (PLAN_KEYS | IMAGE_PLAN_KEYS if plan.get('phase') == 'image-push' else
              PLAN_KEYS | {'previousRuntime'} if plan.get('phase') in UPGRADE_PHASES else PLAN_KEYS)
    require(set(plan) == fields, 'INVALID_PLAN_FIELDS')
    require(plan['version'] == 1 and plan['target'] == 'teacher-cloudflare', 'INVALID_TARGET')
    require(plan['phase'] in ('image-push', 'preflight', 'activate') + UPGRADE_PHASES, 'INVALID_PHASE')
    require(isinstance(expected_sha, str) and re.fullmatch(r'[a-f0-9]{40}', expected_sha), 'INVALID_SOURCE_SHA')
    require(plan['sourceSha'] == expected_sha, 'PLAN_SOURCE_MISMATCH')
    require(plan['accountId'] == ACCOUNT, 'WRONG_CLOUDFLARE_ACCOUNT')
    name = plan['workerName']
    require(name == 'noam-teacher-generation', 'INVALID_WORKER_NAME')
    require(isinstance(plan['imageRef'], str) and re.fullmatch(
        r'registry\.cloudflare\.com/' + ACCOUNT + r'/[a-z0-9][a-z0-9._/-]{0,100}@sha256:[a-f0-9]{64}', plan['imageRef']), 'IMAGE_MUST_BE_ACCOUNT_DIGEST_PINNED')
    require('..' not in plan['imageRef'] and '//' not in plan['imageRef'], 'INVALID_IMAGE_REPOSITORY')
    require(plan['doClass'] == 'TeacherGenerationContainer', 'INVALID_DO_CLASS')
    require(plan['singletonName'] == 'primary', 'INVALID_SINGLETON_NAME')
    if plan['phase'] in UPGRADE_PHASES:
        prior = plan['previousRuntime']
        require(isinstance(prior, dict) and set(prior) == {'sourceSha', 'imageRef', 'versionId', 'doId'},
                'INVALID_PREVIOUS_RUNTIME')
        prior_plan = {**{k: plan[k] for k in PLAN_KEYS}, 'phase': 'preflight',
                      'sourceSha': prior['sourceSha'], 'imageRef': prior['imageRef']}
        validate_plan(prior_plan, prior['sourceSha'])
        require(isinstance(prior['versionId'], str) and re.fullmatch(r'[a-f0-9-]{36}', prior['versionId'])
                and isinstance(prior['doId'], str) and re.fullmatch(r'[a-f0-9]{64}', prior['doId']),
                'INVALID_PREVIOUS_RUNTIME')
        require(prior['sourceSha'] != plan['sourceSha'] and prior['imageRef'] != plan['imageRef'],
                'UPGRADE_REQUIRES_NEW_SOURCE_AND_IMAGE')
    if plan['phase'] == 'image-push':
        require(type(plan['buildRunId']) is int and plan['buildRunId'] > 0, 'INVALID_BUILD_RUN')
        require(type(plan['archiveBytes']) is int and 0 < plan['archiveBytes'] <= 4*1024**3, 'INVALID_ARCHIVE_SIZE')
        for key in ('archiveSha256', 'craneSha256'):
            require(isinstance(plan[key], str) and re.fullmatch(r'[a-f0-9]{64}', plan[key]), 'INVALID_ARTIFACT_HASH')
    return digest(plan)


def identity(plan):
    return {k: plan[k] for k in PLAN_KEYS - {'phase'}}


def validate_context(context, plan, plan_sha, now=None):
    require(isinstance(context, dict), 'OPERATOR_CONTEXT_REQUIRED')
    require(context.get('planSha256') == plan_sha, 'OPERATOR_GO_PLAN_MISMATCH')
    require(context.get('approved') is True and isinstance(context.get('approvalReference'), str)
            and 0 < len(context['approvalReference']) <= 300, 'EXPLICIT_OPERATOR_GO_REQUIRED')
    require(context.get('accountId') == ACCOUNT, 'WRONG_OPERATOR_ACCOUNT')
    require(context.get('workersPaidConfirmed') is True and context.get('spendingApproved') is True,
            'PAID_PLAN_AND_SPENDING_APPROVAL_REQUIRED')
    fresh(context.get('checkedAt'), 300, now)
    if plan['phase'] == 'image-push':
        require(context.get('temporaryRegistryCredentialsApproved') is True, 'REGISTRY_CREDENTIAL_GRANT_NOT_APPROVED')
    if plan['phase'] == 'activate':
        fresh(context.get('queueCheckedAt'), 90, now)
        require(type(context.get('activeJobs')) is int and context['activeJobs'] == 0, 'QUEUE_NOT_EMPTY')
        require(context.get('oldWorkerStopped') is True, 'OLD_WORKER_MUST_BE_STOPPED')
        fresh(context.get('oldWorkerStoppedCheckedAt'), 90, now)
    if plan['phase'] in ('upgrade-preflight', 'upgrade-activate'):
        fresh(context.get('queueCheckedAt'), 90, now)
        require(type(context.get('activeJobs')) is int and context['activeJobs'] == 0, 'LEASES_NOT_DRAINED')
        for field in ('jobsSnapshotSha256', 'ownerQuotaSnapshotSha256'):
            require(isinstance(context.get(field), str) and re.fullmatch(r'[a-f0-9]{64}', context[field]),
                    'QUEUE_AND_OWNER_QUOTA_SNAPSHOT_REQUIRED')
    return True


def validate_proof(status, plan, active_version, *, max_age=90, now=None):
    require(isinstance(status, dict) and status.get('schemaVersion') == 1, 'MISSING_RUNTIME_PROOF')
    require(isinstance(active_version, str) and re.fullmatch(r'[a-f0-9-]{36}', active_version), 'INVALID_ACTIVE_VERSION')
    for key in ('sourceSha', 'imageRef'):
        require(status.get(key) == plan[key], 'RUNTIME_IDENTITY_MISMATCH')
    require(status.get('versionId') == active_version, 'DEPLOYED_VERSION_MISMATCH')
    require(isinstance(status.get('doId'), str) and re.fullmatch(r'[a-f0-9]{64}', status['doId']), 'MISSING_DO_ID')
    require(status.get('mode') == 'disabled' and status.get('running') is False, 'PREFLIGHT_NOT_DISABLED_AND_STOPPED')
    proof = status.get('preflight')
    require(isinstance(proof, dict), 'MISSING_PREFLIGHT_RESULT')
    require(proof.get('status') == 'PASS' and proof.get('claimVerified') is False
            and proof.get('providerCalled') is False and proof.get('heartbeatWritten') is False,
            'PREFLIGHT_MUST_NOT_CLAIM_OR_CALL_MODEL')
    require(proof.get('sourceSha') == plan['sourceSha'] and proof.get('imageRef') == plan['imageRef']
            and proof.get('observedImage') == plan['imageRef'], 'PREFLIGHT_IMAGE_OR_SOURCE_MISMATCH')
    require(proof.get('versionId') == active_version, 'PREFLIGHT_VERSION_MISMATCH')
    fresh(proof.get('checkedAt'), max_age, now)
    # Persist only the known bounded fields, never arbitrary provider output.
    return {'sourceSha': plan['sourceSha'], 'imageRef': plan['imageRef'], 'versionId': active_version,
            'doId': status['doId'], 'checkedAt': proof['checkedAt'], 'status': 'PASS',
            'observedImage': proof['observedImage'], 'claimVerified': False,
            'providerCalled': False, 'heartbeatWritten': False}


def check_source(repo, expected_sha, *, require_canonical):
    def git(*args):
        result = subprocess.run(['git', *args], cwd=repo, capture_output=True, text=True)
        require(result.returncode == 0, 'GIT_PREFLIGHT_FAILED')
        return result.stdout.strip()
    require(git('rev-parse', 'HEAD') == expected_sha, 'SOURCE_SHA_CHANGED')
    require(not git('status', '--porcelain'), 'SOURCE_NOT_CLEAN')
    if require_canonical:
        local = git('rev-parse', 'origin/' + CANONICAL)
        remote = git('ls-remote', '--heads', 'origin', 'refs/heads/' + CANONICAL).split()
        require(len(remote) == 2 and remote[0] == local, 'REFRESH_CANONICAL_BEFORE_RELEASE')
        result = subprocess.run(['git', 'merge-base', '--is-ancestor', expected_sha, local], cwd=repo)
        require(result.returncode == 0, 'SOURCE_NOT_ON_CANONICAL')


def atomic_json(path, value):
    require(not path.is_symlink(), 'STATE_PATH_SYMLINK')
    fd, temporary = tempfile.mkstemp(prefix='.teacher-cloudflare-', dir=path.parent)
    try:
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as stream:
            stream.write(canonical_json(value) + '\n'); stream.flush(); os.fsync(stream.fileno())
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try: os.fsync(directory)
        finally: os.close(directory)
    finally:
        if os.path.exists(temporary): os.unlink(temporary)


@contextlib.contextmanager
def ledger_lock(state_dir):
    require(state_dir.is_absolute() and not state_dir.is_symlink(), 'INVALID_STATE_DIRECTORY')
    state_dir.mkdir(mode=0o700, parents=True, exist_ok=True)
    require(state_dir.stat().st_uid == os.getuid() and state_dir.stat().st_mode & 0o077 == 0, 'STATE_DIRECTORY_NOT_PRIVATE')
    fd = os.open(state_dir / 'teacher-cloudflare.lock', os.O_RDWR | os.O_CREAT | os.O_NOFOLLOW, 0o600)
    try:
        try: fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError: raise GuardError('CLOUDFLARE_RELEASE_ALREADY_RUNNING') from None
        yield state_dir / 'teacher-cloudflare-ledger.json'
    finally:
        os.close(fd)


def validate_previous(previous, plan):
    if not previous:
        require(plan['phase'] == 'preflight', 'PREFLIGHT_REQUIRED_BEFORE_ACTIVATION')
        return
    require(previous.get('target') == 'teacher-cloudflare', 'WRONG_LEDGER_TARGET')
    require(previous.get('state') == 'preflight_verified', 'UNFINISHED_OR_ACTIVE_RELEASE_REQUIRES_OPERATOR_REVIEW')
    require(plan['phase'] == 'activate', 'PREFLIGHT_ALREADY_RECORDED')
    require(previous.get('identity') == identity(plan), 'ACTIVATION_CHANGED_REVIEWED_IDENTITY')


def private_ledger(path):
    require(not path.is_symlink() and path.is_file(), 'PRIVATE_LEDGER_REQUIRED')
    info = path.stat()
    require(info.st_uid == os.getuid() and info.st_mode & 0o077 == 0, 'LEDGER_NOT_PRIVATE')
    value = json.loads(path.read_text())
    require(isinstance(value, dict) and value.get('target') == 'teacher-cloudflare', 'WRONG_LEDGER_TARGET')
    return value


def runtime_matches(status, expected, *, mode, stopped=False):
    require(isinstance(status, dict) and status.get('schemaVersion') == 1, 'MISSING_RUNTIME_PROOF')
    require(all(status.get(key) == expected[key] for key in ('sourceSha', 'imageRef', 'versionId', 'doId')),
            'RUNTIME_IDENTITY_MISMATCH')
    require(status.get('mode') == mode and type(status.get('running')) is bool, 'RUNTIME_MODE_MISMATCH')
    if stopped:
        require(status['running'] is False, 'OLD_CLOUD_STILL_DRAINING')
    if status['running']:
        require(status.get('observedImage') == expected['imageRef'], 'OBSERVED_IMAGE_MISMATCH')
    if mode == 'active':
        approved = status.get('approved') or {}
        require(all(approved.get(key) == expected[key] for key in ('sourceSha', 'imageRef', 'versionId')),
                'ACTIVATION_APPROVAL_IDENTITY_MISMATCH')
    else:
        require(status.get('approved') is None, 'DISABLED_RUNTIME_STILL_APPROVED')


def execute_upgrade(plan, context, adapter, ledger_path, *, now=None):
    """Drain an active cloud singleton; never reset DB jobs, quota or leases.

    Each separately approved phase retains its complete predecessor. Failed
    provider actions stay uncertain. Drain does not kill or requeue any work.
    A stopped container is not enough: cutover also needs fresh zero DB leases.
    """
    plan_sha = validate_plan(plan, plan['sourceSha'])
    validate_context(context, plan, plan_sha, now)
    previous = private_ledger(ledger_path)
    phase = plan['phase']
    prior = plan['previousRuntime']
    expected_state = {'upgrade-drain': 'active', 'upgrade-preflight': 'upgrade_draining',
                      'upgrade-activate': 'upgrade_preflight_verified'}[phase]
    require(previous.get('state') == expected_state, 'UPGRADE_SEQUENCE_OR_RECOVERY_REQUIRED')
    if phase == 'upgrade-drain':
        require(all((previous.get('identity') or {}).get(k) == prior[k] for k in ('sourceSha', 'imageRef'))
                and all((previous.get('proof') or {}).get(k) == prior[k] for k in ('versionId', 'doId')),
                'PREVIOUS_LEDGER_IDENTITY_MISMATCH')
    else:
        require(previous.get('identity') == identity(plan) and previous.get('previousRuntime') == prior,
                'UPGRADE_IDENTITY_CHANGED')
    origin = previous['workerOrigin']
    adapter.use_origin(origin, plan)
    version = adapter.active_version(plan)
    observed = adapter.status(plan)
    if phase in ('upgrade-drain', 'upgrade-preflight'):
        require(version == prior['versionId'], 'OLD_VERSION_CHANGED')
        runtime_matches(observed, prior, mode='active' if phase == 'upgrade-drain' else 'disabled',
                        stopped=phase == 'upgrade-preflight')
    else:
        proof = validate_proof(observed, plan, version, max_age=900, now=now)
        require(proof['doId'] == prior['doId'] and proof['versionId'] == previous['proof']['versionId'],
                'DEPLOYMENT_OR_DURABLE_OBJECT_CHANGED')
    fresh_context = adapter.fresh_context(context)
    validate_context(fresh_context, plan, plan_sha, now)
    snapshots = {key: fresh_context[key] for key in ('jobsSnapshotSha256', 'ownerQuotaSnapshotSha256')
                 if key in fresh_context}
    if phase == 'upgrade-activate':
        require(snapshots == previous.get('preservedData'), 'JOBS_OR_OWNER_QUOTA_CHANGED')
    record = {'target': 'teacher-cloudflare', 'state': 'in_progress', 'phase': phase,
              'identity': identity(plan), 'previousRuntime': prior, 'planSha256': plan_sha,
              'workerOrigin': origin, 'startedAt': utcnow().isoformat(),
              'predecessor': previous, 'predecessorSha256': digest(previous)}
    atomic_json(ledger_path, record)
    try:
        if phase == 'upgrade-drain':
            drained = adapter.deactivate(plan)
            runtime_matches(drained, prior, mode='disabled')
            require(adapter.active_version(plan) == prior['versionId'], 'VERSION_CHANGED_DURING_DRAIN')
            record.update(state='upgrade_draining', containerRunningAtDrain=drained['running'])
        elif phase == 'upgrade-preflight':
            require(adapter.deploy_disabled(plan) == origin, 'UPGRADE_WORKER_ORIGIN_CHANGED')
            version = adapter.active_version(plan)
            require(version != prior['versionId'], 'UPGRADE_VERSION_NOT_CHANGED')
            proof = validate_proof(adapter.preflight(plan), plan, version, now=now)
            require(proof['doId'] == prior['doId'], 'UPGRADE_DURABLE_OBJECT_CHANGED')
            require(adapter.active_version(plan) == version, 'VERSION_CHANGED_DURING_PREFLIGHT')
            record.update(state='upgrade_preflight_verified', proof=proof, preservedData=snapshots)
        else:
            active = adapter.activate(plan, version)
            runtime_matches(active, {**proof}, mode='active')
            require(adapter.active_version(plan) == version, 'VERSION_CHANGED_DURING_ACTIVATION')
            record.update(state='active', proof=proof, preservedData=snapshots,
                          activatedAt=active['approved'].get('activatedAt'))
        record['completedAt'] = utcnow().isoformat()
        atomic_json(ledger_path, record)
        return record
    except Exception:
        record.update(state='uncertain', failedAt=utcnow().isoformat())
        atomic_json(ledger_path, record)
        raise


def observe_runtime(plan, adapter, ledger_path):
    """Read-only provider calls; never advance the ledger or invoke a cycle."""
    previous = private_ledger(ledger_path)
    adapter.use_origin(previous['workerOrigin'], plan)
    version = adapter.active_version(plan)
    status = adapter.status(plan)
    require(isinstance(status, dict) and status.get('schemaVersion') == 1, 'MISSING_RUNTIME_PROOF')
    require(status.get('versionId') == version, 'DEPLOYED_VERSION_MISMATCH')
    require(status.get('mode') in ('active', 'disabled') and type(status.get('running')) is bool,
            'RUNTIME_MODE_MISMATCH')
    for key, pattern in (('sourceSha', r'[a-f0-9]{40}'), ('versionId', r'[a-f0-9-]{36}'),
                         ('doId', r'[a-f0-9]{64}'),
                         ('imageRef', r'[A-Za-z0-9._:/-]+@sha256:[a-f0-9]{64}')):
        require(isinstance(status.get(key), str) and re.fullmatch(pattern, status[key]), 'INVALID_STATUS_IDENTITY')
    return {key: status[key] for key in ('schemaVersion', 'sourceSha', 'imageRef', 'versionId', 'doId', 'mode', 'running')}


def image_ledger_path(state_dir, plan):
    candidate = state_dir / ('teacher-cloudflare-image-' + digest(identity(plan)) + '.json')
    legacy = state_dir / 'teacher-cloudflare-image-ledger.json'
    require(not candidate.is_symlink() and not legacy.is_symlink(), 'IMAGE_LEDGER_SYMLINK_DENIED')
    if legacy.exists():
        info = legacy.stat()
        require(legacy.is_file() and info.st_uid == os.getuid() and info.st_mode & 0o077 == 0,
                'IMAGE_LEDGER_NOT_PRIVATE')
        old = json.loads(legacy.read_text())
        # Do not circumvent an old uncertain receipt by changing its filename.
        if old.get('identity') == identity(plan):
            require(not candidate.exists(), 'DUPLICATE_IMAGE_LEDGERS_REQUIRE_REVIEW')
            return legacy
    return candidate


def execute(plan, context, adapter, ledger_path, *, now=None):
    """Initial rollout only: deploy disabled, verify, then separately activate.

    A failure after any provider action remains uncertain. The controller never
    falls back to an older success, kills containers or restarts the Mac worker.
    """
    plan_sha = validate_plan(plan, plan['sourceSha'])
    validate_context(context, plan, plan_sha, now)
    require(not ledger_path.is_symlink(), 'LEDGER_SYMLINK_DENIED')
    if ledger_path.exists():
        require(ledger_path.is_file() and ledger_path.stat().st_uid == os.getuid()
                and ledger_path.stat().st_mode & 0o077 == 0, 'LEDGER_NOT_PRIVATE')
    previous = json.loads(ledger_path.read_text()) if ledger_path.exists() else None
    validate_previous(previous, plan)
    if plan['phase'] == 'preflight':
        require(context.get('newWorkerConfirmed') is True, 'INITIAL_WORKER_ABSENCE_NOT_CONFIRMED')
    record = {'target': 'teacher-cloudflare', 'state': 'in_progress', 'phase': plan['phase'],
              'identity': identity(plan), 'planSha256': plan_sha, 'startedAt': utcnow().isoformat()}
    atomic_json(ledger_path, record)  # durable record BEFORE the first provider mutation
    try:
        if plan['phase'] == 'preflight':
            origin = adapter.deploy_disabled(plan)
            record['workerOrigin'] = origin; atomic_json(ledger_path, record)
            version = adapter.active_version(plan)
            proof = validate_proof(adapter.preflight(plan), plan, version, now=now)
            require(adapter.active_version(plan) == version, 'VERSION_CHANGED_DURING_PREFLIGHT')
            record.update(state='preflight_verified', proof=proof)
        else:
            origin = previous['workerOrigin']; adapter.use_origin(origin, plan)
            record['workerOrigin'] = origin; atomic_json(ledger_path, record)
            version = adapter.active_version(plan)
            proof = validate_proof(adapter.status(plan), plan, version, max_age=900, now=now)
            require(previous['proof']['versionId'] == version and previous['proof']['doId'] == proof['doId'],
                    'DEPLOYMENT_OR_DURABLE_OBJECT_CHANGED')
            # Context is an operator attestation from fresh independent queue/host
            # reads, not an authorization inferred from elapsed time or a peer.
            validate_context(adapter.fresh_context(context), plan, plan_sha, now)
            active = adapter.activate(plan, version)
            require(active.get('mode') == 'active' and active.get('running') is False
                    and active.get('sourceSha') == plan['sourceSha'] and active.get('versionId') == version
                    and active.get('doId') == proof['doId'] and active.get('imageRef') == plan['imageRef'],
                    'ACTIVATION_NOT_VERIFIED')
            approved = active.get('approved') or {}
            require(approved.get('sourceSha') == plan['sourceSha'] and approved.get('imageRef') == plan['imageRef'],
                    'ACTIVATION_APPROVAL_IDENTITY_MISMATCH')
            require(adapter.active_version(plan) == version, 'VERSION_CHANGED_DURING_ACTIVATION')
            record.update(state='active', proof=proof, activatedAt=approved.get('activatedAt'))
        record['completedAt'] = utcnow().isoformat(); atomic_json(ledger_path, record)
        return record
    except Exception:
        record['state'] = 'uncertain'; record['failedAt'] = utcnow().isoformat()
        atomic_json(ledger_path, record)
        raise




RUNTIME_SECRET_KEYS = {'TEACHER_CLOUD_OPERATOR_KEY', 'TEACHER_GENERATION_SERVICE_KEY',
                       'QWEN_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL'}


def runtime_secrets(path, repo, operator_key):
    require(path is not None and path.is_absolute() and path.suffix == '.json'
            and path.is_file() and not path.is_symlink(), 'PRIVATE_RUNTIME_JSON_REQUIRED')
    require(not path.resolve().is_relative_to(repo.resolve()), 'RUNTIME_SECRETS_MUST_BE_OUTSIDE_CHECKOUT')
    require(path.stat().st_uid == os.getuid() and path.stat().st_mode & 0o777 == 0o600
            and path.stat().st_size <= 40000, 'RUNTIME_SECRETS_PERMISSIONS_OR_SIZE')
    def unique(pairs):
        result = {}
        for key, value in pairs:
            require(key not in result, 'DUPLICATE_RUNTIME_SECRET')
            result[key] = value
        return result
    values = json.loads(path.read_text(), object_pairs_hook=unique)
    require(isinstance(values, dict) and set(values) == RUNTIME_SECRET_KEYS, 'RUNTIME_SECRET_NAMES_MISMATCH')
    require(all(isinstance(v, str) and 0 < len(v) <= 8192 and not any(ord(c) < 32 for c in v)
                for v in values.values()), 'RUNTIME_SECRET_VALUE_INVALID')
    require(re.fullmatch(r'[a-f0-9]{64}', values['TEACHER_CLOUD_OPERATOR_KEY'])
            and hmac.compare_digest(values['TEACHER_CLOUD_OPERATOR_KEY'], operator_key), 'OPERATOR_SECRET_MISMATCH')
    return values

def wrangler_environment(source):
    # Shell settings must not redirect credentials/deployment or persist raw
    # credential responses in Wrangler's global debug log.
    blocked = {'CLOUDFLARE_ENV', 'CLOUDFLARE_API_BASE_URL', 'CF_API_BASE_URL',
               'CLOUDFLARE_CONTAINER_REGISTRY'}
    return {**{k: v for k, v in source.items() if k not in blocked},
            'CLOUDFLARE_ACCOUNT_ID': ACCOUNT, 'WRANGLER_SEND_METRICS': 'false',
            'WRANGLER_WRITE_LOGS': 'false', 'WRANGLER_LOG_SANITIZE': 'true', 'CI': 'true'}


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise GuardError('OPERATOR_REDIRECT_DENIED')


class WranglerAdapter:
    """Only deploy/status CLI and fixed authenticated supervisor paths.

    Authentication stays in environment/HTTPS headers; the five validated runtime
    secrets accompany the same deployment via a private temporary JSON file. No
    shell, raw CLI logs, body echo, token provisioning or separate secret upload.
    """
    def __init__(self, repo, plan, context_path, state_dir, runtime_secrets_file=None):
        self.repo = repo.resolve(); self.cloud = self.repo / CLOUD_DIRECTORY
        self.plan = plan; self.context_path = context_path; self.origin = None
        token = os.environ.get('TEACHER_CLOUD_OPERATOR_KEY', '')
        if plan['phase'] != 'image-push':
            require(re.fullmatch(r'[a-f0-9]{64}', token), 'OPERATOR_KEY_MUST_BE_LOWER_HEX_64')
        self._token = token
        self._runtime_secrets = runtime_secrets(runtime_secrets_file, self.repo, token) if plan['phase'] in ('preflight', 'upgrade-preflight') else None
        self._http = build_opener(HTTPSHandler(), NoRedirect())
        package = json.loads((self.cloud / 'package.json').read_text())
        pinned = package.get('devDependencies', {}).get('wrangler')
        installed = json.loads((self.cloud / 'node_modules/wrangler/package.json').read_text()).get('version')
        require(isinstance(pinned, str) and re.fullmatch(r'\d+\.\d+\.\d+', pinned)
                and pinned == installed, 'LOCKED_WRANGLER_NOT_INSTALLED')
        self.cli = self.cloud / 'node_modules/wrangler/bin/wrangler.js'
        self.node = str(Path(os.environ['NODE_BIN']) / 'node') if os.environ.get('NODE_BIN') else shutil.which('node')
        require(self.node is not None and self.cli.is_file(), 'WRANGLER_RUNTIME_MISSING')
        config = json.loads((self.cloud / 'wrangler.jsonc').read_text())
        require(config.get('name') == plan['workerName'] and config.get('account_id') == ACCOUNT,
                'CONFIG_TARGET_MISMATCH')
        bindings = (config.get('durable_objects') or {}).get('bindings')
        require(bindings == [{'name': 'GENERATOR', 'class_name': plan['doClass']}], 'CONFIG_DO_TARGET_MISMATCH')
        require(config.get('version_metadata') == {'binding': 'CF_VERSION_METADATA'}, 'VERSION_METADATA_REQUIRED')
        containers = config.get('containers')
        require(isinstance(containers, list) and len(containers) == 1
                and containers[0].get('class_name') == plan['doClass']
                and containers[0].get('scheduling_policy') == 'durable_object', 'CONFIG_CONTAINER_MISMATCH')
        require(set(containers[0].get('images', {})) == {'worker'}, 'SINGLE_REVIEWED_IMAGE_REQUIRED')
        require(config.get('workers_dev') is True and not config.get('routes'), 'WORKERS_DEV_ONLY')
        require(config.get('triggers') == {'crons': ['* * * * *']}, 'UNEXPECTED_CRON')
        # Cron invokes a disabled DO until explicit /activate. No claim/cycle can
        # run merely because deploy succeeded or a version changed.
        config['containers'][0]['images']['worker'] = {'image': plan['imageRef']}
        config.setdefault('vars', {})['SOURCE_SHA'] = plan['sourceSha']
        entry = (self.cloud / config['main']).resolve()
        require(entry.is_relative_to(self.cloud) and entry.is_file(), 'INVALID_SUPERVISOR_ENTRY')
        config['main'] = str(entry)
        self.config = state_dir / ('wrangler-' + digest(plan) + '.json')
        atomic_json(self.config, config)
        self.env = wrangler_environment(os.environ)

    def command(self, *args):
        result = subprocess.run([self.node, str(self.cli), *args, '--config', str(self.config)],
                                cwd=self.cloud, env=self.env, capture_output=True, text=True, timeout=600)
        require(result.returncode == 0, 'WRANGLER_COMMAND_FAILED')
        require(len(result.stdout) < 2_000_000, 'WRANGLER_OUTPUT_LIMIT')
        return result.stdout

    def use_origin(self, origin, plan):
        require(isinstance(origin, str) and re.fullmatch(
            r'https://' + re.escape(plan['workerName']) + r'\.[a-z0-9-]+\.workers\.dev', origin),
            'INVALID_VERIFIED_WORKER_ORIGIN')
        self.origin = origin

    def deploy_disabled(self, plan):
        # Account is also fixed in config; whoami is a read-only authorization
        # check, not a request to create/grant a new API token.
        require(ACCOUNT in self.command('whoami'), 'AUTHENTICATED_ACCOUNT_NOT_CONFIRMED')
        require(self._runtime_secrets is not None, 'RUNTIME_SECRETS_REQUIRED')
        # JSON avoids Wrangler dotenv environment expansion. Only the validated
        # five keys are sent with this exact Worker version; no separate upload.
        fd, private_path = tempfile.mkstemp(prefix='.runtime-secrets-', suffix='.json', dir=self.config.parent)
        try:
            os.fchmod(fd, 0o600)
            with os.fdopen(fd, 'w') as stream:
                stream.write(canonical_json(self._runtime_secrets)); stream.flush(); os.fsync(stream.fileno())
            output = self.command('deploy', '--secrets-file', private_path)
        finally:
            if os.path.exists(private_path): os.unlink(private_path)
        origins = set(re.findall(r'https://' + re.escape(plan['workerName'])
                                 + r'\.[a-z0-9-]+\.workers\.dev', output))
        require(len(origins) == 1, 'DEPLOYED_WORKER_ORIGIN_NOT_CONFIRMED')
        self.use_origin(origins.pop(), plan)
        return self.origin

    def active_version(self, plan):
        value = json.loads(self.command('deployments', 'status', '--json'))
        versions = value.get('versions')
        require(isinstance(versions, list) and len(versions) == 1
                and versions[0].get('percentage') == 100, 'SINGLE_ACTIVE_VERSION_REQUIRED')
        return versions[0].get('version_id')

    def request(self, path, body=None):
        require(path in ('/operator/status', '/operator/preflight', '/operator/activate', '/operator/deactivate'), 'OPERATOR_PATH_DENIED')
        require(self.origin is not None, 'VERIFIED_ORIGIN_REQUIRED')
        data = canonical_json(body).encode() if body is not None else None
        headers = {'Authorization': 'Bearer ' + self._token, 'Cache-Control': 'no-cache'}
        if data is not None: headers['Content-Type'] = 'application/json'
        request = Request(self.origin + path, data=data, headers=headers,
                          method='POST' if data is not None else 'GET')
        with self._http.open(request, timeout=180) as response:
            require(response.status == 200, 'OPERATOR_RESPONSE_FAILED')
            raw = response.read(65537)
        require(len(raw) <= 65536, 'OPERATOR_RESPONSE_LIMIT')
        return json.loads(raw)

    def preflight(self, plan):
        return self.request('/operator/preflight', {})

    def status(self, plan):
        return self.request('/operator/status')

    def deactivate(self, plan):
        return self.request('/operator/deactivate', {})

    def activate(self, plan, version):
        result = self.request('/operator/activate', {'sourceSha': plan['sourceSha'],
                              'imageRef': plan['imageRef'], 'versionId': version})
        # Do not call /tick: production cron is the only automatic cycle starter.
        return result

    def fresh_context(self, context):
        return json.loads(self.context_path.read_text())


def verify_ci_image(plan):
    repository = 'repos/noamd-collab/noamdoronmath-worksheets/'
    def api(path):
        result = subprocess.run(['gh', 'api', repository + path], capture_output=True)
        require(result.returncode == 0, 'IMAGE_CI_READ_FAILED')
        return result.stdout
    run = json.loads(api('actions/runs/' + str(plan['buildRunId'])))
    require(run.get('head_sha') == plan['sourceSha'] and run.get('conclusion') == 'success'
            and run.get('status') == 'completed'
            and run.get('path') == '.github/workflows/teacher-generation-cloud.yml', 'IMAGE_CI_IDENTITY_OR_RESULT_MISMATCH')
    artifacts = json.loads(api('actions/runs/' + str(plan['buildRunId']) + '/artifacts'))
    name = 'teacher-cloud-qualification-' + plan['sourceSha']
    matches = [a for a in artifacts.get('artifacts', []) if a.get('name') == name]
    require(len(matches) == 1 and matches[0].get('expired') is False
            and matches[0].get('size_in_bytes', 100_000_000) <= 64*1024*1024, 'IMAGE_CI_EVIDENCE_UNAVAILABLE')
    raw = api('actions/artifacts/' + str(matches[0]['id']) + '/zip')
    require(len(raw) <= 64*1024*1024, 'IMAGE_CI_EVIDENCE_TOO_LARGE')
    with zipfile.ZipFile(io.BytesIO(raw)) as archive:
        entries = [e for e in archive.infolist() if Path(e.filename).name == 'image-metadata.json']
        require(len(entries) == 1 and entries[0].file_size <= 10000, 'IMAGE_CI_METADATA_MISSING')
        metadata = json.loads(archive.read(entries[0]))
    expected = {'sourceSha': plan['sourceSha'], 'archiveSha256': plan['archiveSha256'],
                'archiveBytes': plan['archiveBytes'], 'imageDigest': plan['imageRef'].split('@')[1]}
    require(all(metadata.get(k) == v for k, v in expected.items()), 'IMAGE_CI_METADATA_MISMATCH')
    return {'runId': plan['buildRunId'], 'evidenceArtifactId': matches[0]['id'], **expected}


def execute_image(plan, context, adapter, ledger, archive, crane, ci_proof):
    from teacher_cloudflare_image import inspect_archive, hash_file
    validate_context(context, plan, digest(plan))
    require(not ledger.exists() and not ledger.is_symlink(), 'IMAGE_LEDGER_EXISTS_OPERATOR_REVIEW')
    require(crane.is_file() and not crane.is_symlink() and hash_file(crane) == plan['craneSha256'], 'CRANE_BINARY_HASH_MISMATCH')
    expected_digest = plan['imageRef'].split('@')[1]
    record = {'target': 'teacher-cloudflare-image', 'state': 'in_progress', 'identity': identity(plan),
              'planSha256': digest(plan), 'ciProof': ci_proof, 'startedAt': utcnow().isoformat()}
    with tempfile.TemporaryDirectory(prefix='image-push-', dir=ledger.parent) as temporary:
        private = Path(temporary);private.chmod(0o700)
        proof = inspect_archive(archive, archive_sha=plan['archiveSha256'], archive_bytes=plan['archiveBytes'],
                                image_digest=expected_digest, source_sha=plan['sourceSha'], extract_to=private/'oci')
        # No provider mutation until all local bytes/tool identity and CI pass.
        validate_context(adapter.fresh_context(context), plan, digest(plan))
        require(ACCOUNT in adapter.command('whoami'), 'AUTHENTICATED_ACCOUNT_NOT_CONFIRMED')
        env = {k: os.environ[k] for k in ('PATH','HOME','TMPDIR','SSL_CERT_FILE','SSL_CERT_DIR') if k in os.environ}
        env['DOCKER_CONFIG'] = str(private / 'auth');Path(env['DOCKER_CONFIG']).mkdir(mode=0o700)
        def command(*args):
            r = subprocess.run([str(crane), *args], env=env, capture_output=True, timeout=900)
            require(r.returncode == 0, 'REGISTRY_COMMAND_FAILED')
            require(len(r.stdout) < 2_000_000, 'REGISTRY_OUTPUT_LIMIT')
            return r.stdout
        require(command('version').decode().strip().lstrip('v') == '0.22.1', 'CRANE_VERSION_MISMATCH')
        atomic_json(ledger, record)
        try:
            # A temporary account-scoped registry grant, not a permanent API key.
            # Capture JSON only; never echo it or include it in any receipt.
            credentials = json.loads(adapter.command('containers', 'registries', 'credentials',
                'registry.cloudflare.com', '--push', '--pull', '--expiration-minutes', '15', '--json'))
            username, password = credentials.get('username'), credentials.get('password')
            require(isinstance(username, str) and 0 < len(username) <= 512 and isinstance(password, str)
                    and 0 < len(password) <= 10000, 'REGISTRY_CREDENTIAL_RESPONSE_INVALID')
            auth = base64.b64encode((username + ':' + password).encode()).decode()
            atomic_json(Path(env['DOCKER_CONFIG'])/'config.json', {'auths': {'registry.cloudflare.com': {'auth': auth}}})
            del credentials, username, password, auth
            pushed = command('push', str(private/'oci'), plan['imageRef']).decode().strip()
            require(pushed == plan['imageRef'], 'PUSHED_IMAGE_IDENTITY_MISMATCH')
            remote_digest = command('digest', plan['imageRef']).decode().strip()
            require(remote_digest == expected_digest, 'REMOTE_IMAGE_DIGEST_MISMATCH')
            remote_manifest = command('manifest', plan['imageRef'])
            require('sha256:' + hashlib.sha256(remote_manifest).hexdigest() == expected_digest, 'REMOTE_MANIFEST_HASH_MISMATCH')
            record.update(state='image_verified', archiveProof=proof, remoteDigest=remote_digest,
                          completedAt=utcnow().isoformat())
            atomic_json(ledger, record)
        except Exception:
            record.update(state='uncertain', failedAt=utcnow().isoformat());atomic_json(ledger, record)
            raise
    return record

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source_sha'); parser.add_argument('repo', type=Path)
    parser.add_argument('--plan', type=Path, required=True)
    parser.add_argument('--context', type=Path)
    parser.add_argument('--state-dir', type=Path)
    parser.add_argument('--oci-archive', type=Path)
    parser.add_argument('--crane', type=Path)
    parser.add_argument('--runtime-secrets-file', type=Path)
    parser.add_argument('--apply', action='store_true')
    parser.add_argument('--observe', action='store_true', help='Read exact cloud status without any provider mutation')
    args = parser.parse_args()
    plan = json.loads(args.plan.read_text()); plan_sha = validate_plan(plan, args.source_sha)
    require(not (args.apply and args.observe), 'OBSERVE_CANNOT_APPLY')
    require(not args.observe or plan['phase'] != 'image-push', 'IMAGE_PLAN_HAS_NO_RUNTIME_OBSERVATION')
    check_source(args.repo, args.source_sha, require_canonical=args.apply)
    if plan['phase'] == 'image-push':
        require(args.oci_archive is not None, 'OCI_ARCHIVE_REQUIRED')
        from teacher_cloudflare_image import inspect_archive
        inspect_archive(args.oci_archive, archive_sha=plan['archiveSha256'], archive_bytes=plan['archiveBytes'],
                        image_digest=plan['imageRef'].split('@')[1], source_sha=plan['sourceSha'])
    if args.observe:
        require(args.state_dir is not None and not args.state_dir.is_symlink(), 'PRIVATE_LEDGER_REQUIRED')
        state_dir = args.state_dir.resolve()
        require(not state_dir.is_relative_to(args.repo.resolve()), 'LEDGER_MUST_BE_OUTSIDE_CHECKOUT')
        # Observation never provisions runtime secrets, including for a preflight plan.
        observation_plan = {**plan, 'phase': 'upgrade-drain' if plan['phase'] in UPGRADE_PHASES else 'activate'}
        with ledger_lock(state_dir) as ledger:
            adapter = WranglerAdapter(args.repo, observation_plan, None, state_dir)
            status = observe_runtime(plan, adapter, ledger)
        print(canonical_json({'target': 'teacher-cloudflare', 'observed': status,
                              'providerMutation': False, 'ledgerChanged': False}))
        return
    if not args.apply:
        print(canonical_json({'target': 'teacher-cloudflare', 'phase': plan['phase'], 'planSha256': plan_sha,
                              'sourceSha': args.source_sha, 'providerCalled': False, 'applyAuthorized': False}))
        return
    require(args.context is not None and args.state_dir is not None, 'CONTEXT_AND_PRIVATE_LEDGER_REQUIRED')
    context = json.loads(args.context.read_text())
    validate_context(context, plan, plan_sha)
    require(not args.state_dir.is_symlink(), 'STATE_DIRECTORY_SYMLINK')
    state_dir = args.state_dir.resolve()
    require(not state_dir.is_relative_to(args.repo.resolve()), 'LEDGER_MUST_BE_OUTSIDE_CHECKOUT')
    with ledger_lock(state_dir) as ledger:
        adapter = WranglerAdapter(args.repo, plan, args.context, state_dir, args.runtime_secrets_file)
        # Keep every immutable image receipt. Never overwrite an older successful
        # or uncertain push just to make room for the next cloud image.
        image_ledger = image_ledger_path(state_dir, plan)
        if plan['phase'] == 'image-push':
            require(args.crane is not None, 'REVIEWED_CRANE_REQUIRED')
            proof = verify_ci_image(plan)
            record = execute_image(plan, context, adapter, image_ledger, args.oci_archive, args.crane.resolve(), proof)
            ledger = image_ledger
        else:
            require(image_ledger.is_file() and not image_ledger.is_symlink(), 'VERIFIED_IMAGE_LEDGER_REQUIRED')
            image_state = json.loads(image_ledger.read_text())
            require(image_state.get('target') == 'teacher-cloudflare-image'
                    and image_state.get('state') == 'image_verified' and image_state.get('identity') == identity(plan),
                    'IMAGE_NOT_VERIFIED_FOR_THIS_RELEASE')
            record = (execute_upgrade if plan['phase'] in UPGRADE_PHASES else execute)(
                plan, context, adapter, ledger)
    print(canonical_json({'target': 'teacher-cloudflare', 'state': record['state'],
                          'sourceSha': args.source_sha, 'ledger': str(ledger),
                          'modelCalledByReleaseController': False}))


if __name__ == '__main__':
    try: main()
    except GuardError as error:
        print(canonical_json({'status': 'BLOCKED', 'code': str(error)})); sys.exit(1)
    except Exception:
        print(canonical_json({'status': 'BLOCKED', 'code': 'RELEASE_FAILED'})); sys.exit(1)
