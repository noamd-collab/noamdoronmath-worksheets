#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { ENVIRONMENT, TASK, assertReleaseHistory, githubApi } from './production-release.mjs';

// Deliberately one incident, not a general escape hatch from the release guard.
export const INCIDENT = Object.freeze({
  failedDeploymentId: 7706338816,
  failedStatusId: 21934891324,
  failedRunId: 42994193052,
  failedJobId: 130434249934,
  failedSha: '457971e7da5d2f7e819f99860126685e154b311f',
  failedControllerSha: 'da058cbc18320ba2237f4adc819a34ee960c4486',
  previousDeploymentId: 7669709987,
  previousLiveSha: '7f5f679781ec152850ee4e9e2f112b384b19950b',
});
export const EVIDENCE_PATH = '.github/release-evidence/landing-release-413.json';
const INDEX_PATH = 'headless/astro-poc/src/data/search-index.v1.json';
const PUBLIC_INDEX = 'https://www.noamdoronmath.co.il/search-index.v1.json';
const REPOSITORY = 'noamd-collab/noamdoronmath-worksheets';
const sha = value => /^[0-9a-f]{40}$/.test(value || '');
const digest = value => createHash('sha256').update(value).digest('hex');
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
function requireValue(condition, message) { if (!condition) throw new Error(message); }
const clone = value => JSON.parse(JSON.stringify(value));
export const writeConfirmation = incident => `NOAM APPROVED RECONCILIATION OF ${incident.failedDeploymentId} TO LIVE ${incident.previousLiveSha}`;

async function paged(api, pathname, field) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const response = await api(`${pathname}${pathname.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = field ? response?.[field] : response;
    requireValue(Array.isArray(batch) && batch.every(row => Number.isSafeInteger(row.id)), 'Malformed or unavailable reconciliation history');
    rows.push(...batch);
    if (batch.length < 100) {
      requireValue(new Set(rows.map(row => row.id)).size === rows.length, 'Duplicate history entries');
      return rows.sort((a, b) => b.id - a.id);
    }
  }
  throw new Error('Reconciliation history exceeds the inspection limit');
}
async function latestStatus(api, id) {
  const rows = await paged(api, `/deployments/${id}/statuses`);
  requireValue(rows.length > 0, 'Deployment has no reliable status');
  return rows[0];
}
function guardedRecord(record) {
  return record?.task === TASK && record.environment === ENVIRONMENT && record.payload?.releaseGuardVersion === 1 && sha(record.sha);
}

async function snapshot(api, incident) {
  const records = await paged(api, `/deployments?environment=${ENVIRONMENT}`);
  const failed = records[0];
  requireValue(guardedRecord(failed) && failed.id === incident.failedDeploymentId && failed.sha === incident.failedSha &&
    String(failed.payload.runId) === String(incident.failedRunId) && failed.payload.controllerSha === incident.failedControllerSha &&
    failed.payload.previousLiveSha === incident.previousLiveSha,
  'Newest production record is not the exact failed incident; never overwrite newer state');
  const failedStatus = await latestStatus(api, failed.id);
  requireValue(failedStatus.id === incident.failedStatusId && failedStatus.state === 'error', 'Exact terminal error marker is required');
  const previous = records.find(record => record.id === incident.previousDeploymentId);
  requireValue(guardedRecord(previous) && previous.sha === incident.previousLiveSha && previous.id < failed.id,
    'The independently confirmed previous production record does not match');
  const previousStatus = await latestStatus(api, previous.id);
  requireValue(previousStatus.state === 'success', 'Previous production record is not confirmed successful');

  const run = await api(`/actions/runs/${incident.failedRunId}`);
  requireValue(run?.id === incident.failedRunId && run.status === 'completed' && ['failure', 'cancelled', 'timed_out'].includes(run.conclusion) &&
    run.run_attempt === 1 && run.head_branch === 'main' && run.head_sha === incident.failedControllerSha &&
    run.path === '.github/workflows/publish-baseline.yml', 'Failed publisher is not the exact terminal first attempt');
  const jobs = await paged(api, `/actions/runs/${incident.failedRunId}/jobs`, 'jobs');
  const job = jobs.find(row => row.id === incident.failedJobId && row.name === 'publish');
  const step = job?.steps?.find(row => row.name === 'Publish the approved baseline');
  requireValue(job?.status === 'completed' && ['failure', 'cancelled', 'timed_out'].includes(job.conclusion) &&
    step?.status === 'completed' && ['failure', 'cancelled', 'timed_out'].includes(step.conclusion), 'Publication step has not conclusively failed');
  const runs = await paged(api, '/actions/workflows/publish-baseline.yml/runs', 'workflow_runs');
  requireValue(runs.some(row => row.id === incident.failedRunId), 'Failed run is missing from workflow history');
  requireValue(runs.every(row => row.status === 'completed'), 'Another publisher is active or queued');
  // Preserve all relevant server fields for a strict pre-write race comparison.
  return clone({ failed, failedStatus, previous, previousStatus, run, jobs, runs });
}

export function validateEvidence({ rawEvidence, evidenceSha256, confirmedLiveSha, incident = INCIDENT, now = Date.now() }) {
  requireValue(/^[0-9a-f]{64}$/.test(evidenceSha256 || '') && digest(rawEvidence) === evidenceSha256, 'Reviewed evidence digest mismatch');
  const evidence = JSON.parse(rawEvidence);
  requireValue(confirmedLiveSha === incident.previousLiveSha && evidence.confirmedLiveSha === confirmedLiveSha,
    'Only the explicitly confirmed previous live SHA can be reconciled');
  requireValue(evidence.schemaVersion === 1 && evidence.failedDeploymentId === incident.failedDeploymentId &&
    evidence.failedRunId === incident.failedRunId && evidence.failedSha === incident.failedSha &&
    evidence.previousDeploymentId === incident.previousDeploymentId, 'Evidence identifies a different incident');
  const observed = Date.parse(evidence.observedAt);
  requireValue(Number.isFinite(observed) && observed <= now + 60_000 && now - observed <= 24 * 60 * 60_000,
    'Live-state evidence must be recent and not from the future');
  requireValue(evidence.prePromotionFailureVerified === true && evidence.fullSourceShaProven === false &&
    evidence.observationConclusion === 'consistent-with-previous-confirmed-live' && typeof evidence.evidenceSummary === 'string' &&
    evidence.evidenceSummary.trim().length >= 30 && evidence.evidenceSummary.length <= 2000,
  'Reviewed evidence must state the pre-promotion failure and scoped proof limits');
  const source = new URL(evidence.evidenceUrl);
  requireValue(source.protocol === 'https:' && !source.username && !source.password && !source.search &&
    ['github.com', 'manage.wix.com', 'www.wix.com'].includes(source.hostname), 'Evidence needs a stable HTTPS reference without credentials');
  requireValue(/^[0-9a-f]{64}$/.test(evidence.publicIndexSha256 || ''), 'Expected live index digest is missing');
  return evidence;
}

async function verifyPublicIndex({ fetchImpl, expected }) {
  const response = await fetchImpl(PUBLIC_INDEX, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(25_000) });
  requireValue(response.ok && response.status === 200 && /application\/json/i.test(response.headers.get('content-type') || ''), 'Live public index is unavailable');
  const body = await response.text();
  requireValue(Buffer.byteLength(body) < 5_000_000, 'Unexpected public-index response size');
  const actual = digest(JSON.stringify(JSON.parse(body)));
  requireValue(actual === expected, 'Public index no longer matches the confirmed previous live commit');
  return actual;
}

export async function reconcileProduction({ api, gitDir, rawEvidence, evidenceSha256, confirmedLiveSha,
  failedDeploymentId, failedRunId, controllerSha, runId, write = false, confirmation,
  approvedPlanSha256, incident = INCIDENT, fetchImpl = fetch, now = Date.now() }) {
  requireValue(String(failedDeploymentId) === String(incident.failedDeploymentId) && String(failedRunId) === String(incident.failedRunId), 'Explicit incident IDs do not match');
  requireValue(sha(controllerSha) && /^\d+$/.test(String(runId || '')), 'Reconciliation controller/run identity is required');
  requireValue(typeof write === 'boolean', 'Write mode must be explicit');
  if (write) requireValue(confirmation === writeConfirmation(incident), 'Explicit Noam reconciliation approval is required');
  const evidence = validateEvidence({ rawEvidence, evidenceSha256, confirmedLiveSha, incident, now });
  assertReleaseHistory({ gitDir, approvedSha: incident.failedSha, lastLiveSha: confirmedLiveSha });
  const committedIndex = execFileSync('git', ['-C', gitDir, 'show', `${confirmedLiveSha}:${INDEX_PATH}`], { encoding: 'utf8', maxBuffer: 5_000_000 });
  const expectedIndex = digest(JSON.stringify(JSON.parse(committedIndex)));
  requireValue(evidence.publicIndexSha256 === expectedIndex, 'Evidence index digest differs from the confirmed Git commit');
  const before = await snapshot(api, incident);
  await verifyPublicIndex({ fetchImpl, expected: expectedIndex });
  const plan = { incident, confirmedLiveSha, controllerSha, evidencePath: EVIDENCE_PATH, evidenceSha256,
    expectedIndex, stateSha256: digest(stable(before)), action: 'Record operator-confirmed previous live SHA from scoped evidence; preserve failure; do not publish' };
  const planSha256 = digest(stable(plan));
  if (!write) return { reconciled: false, planSha256, plan };
  requireValue(approvedPlanSha256 === planSha256, 'Write requires the exact reviewed dry-run plan digest');

  // Same lock as publishing, plus a fresh read immediately before the first write.
  await verifyPublicIndex({ fetchImpl, expected: expectedIndex });
  const after = await snapshot(api, incident);
  requireValue(stable(after) === stable(before), 'Production or publisher state changed during reconciliation');
  const logUrl = `https://github.com/${REPOSITORY}/actions/runs/${runId}`;
  const payload = { releaseGuardVersion: 1, source: 'reconciled-failed-before-promotion', runId: String(runId), controllerSha,
    previousLiveSha: confirmedLiveSha, failedDeploymentId: incident.failedDeploymentId, failedRunId: incident.failedRunId,
    failedSha: incident.failedSha, previousDeploymentId: incident.previousDeploymentId,
    evidencePath: EVIDENCE_PATH, evidenceSha256, planSha256, observedAt: evidence.observedAt,
    evidenceUrl: evidence.evidenceUrl, publicIndexSha256: expectedIndex,
    evidenceBasis: 'pre-promotion-failure-and-scoped-public-fingerprints', fullSourceShaProven: false };
  const created = await api('/deployments', { method: 'POST', body: {
    ref: confirmedLiveSha, task: TASK, environment: ENVIRONMENT, auto_merge: false,
    required_contexts: [], production_environment: true, transient_environment: false,
    description: 'Operator-reconciled prior live SHA from scoped pre-promotion evidence; no publication', payload,
  } });
  requireValue(guardedRecord(created) && created.sha === confirmedLiveSha && Number.isSafeInteger(created.id) &&
    created.id > incident.failedDeploymentId && stable(created.payload) === stable(payload), 'Invalid reconciliation record; leave state blocked');
  const newest = (await paged(api, `/deployments?environment=${ENVIRONMENT}`))[0];
  requireValue(newest?.id === created.id && newest.sha === confirmedLiveSha && stable(newest.payload) === stable(payload),
    'Reconciliation was superseded; leave the new record unfinished');
  await api(`/deployments/${created.id}/statuses`, { method: 'POST', body: {
    state: 'success', auto_inactive: false, log_url: logUrl, environment_url: 'https://www.noamdoronmath.co.il/',
    description: 'Prior live SHA accepted from reviewed failure/fingerprint evidence; no new publication',
  } });
  return { reconciled: true, deploymentId: created.id, planSha256, plan };
}

async function main() {
  requireValue(process.env.GITHUB_EVENT_NAME === 'workflow_dispatch' && process.env.GITHUB_REF === 'refs/heads/main' &&
    process.env.GITHUB_REPOSITORY === REPOSITORY, 'Reconciliation runs only from the reviewed main workflow');
  requireValue(['dry-run', 'write'].includes(process.env.RECONCILE_MODE), 'Choose dry-run or write explicitly');
  const gitDir = process.env.SITE_DIR || process.cwd();
  // Read committed evidence, never an unreviewed working-tree replacement.
  const rawEvidence = execFileSync('git', ['-C', gitDir, 'show', `${process.env.GITHUB_SHA}:${EVIDENCE_PATH}`], { encoding: 'utf8', maxBuffer: 20_000 });
  const result = await reconcileProduction({
    api: githubApi({ token: process.env.GITHUB_TOKEN, repository: REPOSITORY }), gitDir, rawEvidence,
    evidenceSha256: process.env.EVIDENCE_SHA256, confirmedLiveSha: process.env.CONFIRMED_LIVE_SHA,
    failedDeploymentId: process.env.FAILED_DEPLOYMENT_ID, failedRunId: process.env.FAILED_RUN_ID,
    controllerSha: process.env.GITHUB_SHA, runId: process.env.GITHUB_RUN_ID,
    write: process.env.RECONCILE_MODE === 'write', confirmation: process.env.RECONCILE_CONFIRMATION,
    approvedPlanSha256: process.env.APPROVED_PLAN_SHA256,
  });
  console.log(JSON.stringify(result, null, 2));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
