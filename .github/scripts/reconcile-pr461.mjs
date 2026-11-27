#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ENVIRONMENT, TASK, githubApi, readApprovedSha } from './production-release.mjs';

// One approved incident and one subsequent target. This is not an initializer,
// general reconciliation command, or Wix publisher. The enclosing publish job
// owns the existing wix-production lock for this step AND normal begin/finish.
export const EVIDENCE_PATH = '.github/release-evidence/pr461-local-publication.json';
const rawEvidence = readFileSync(new URL('../release-evidence/pr461-local-publication.json', import.meta.url));
export const EVIDENCE_SHA256 = 'aae716c72727a0ab0e8bdb93183c33af7421f0fbf1d1f440624779ca89817704';
if (createHash('sha256').update(rawEvidence).digest('hex') !== EVIDENCE_SHA256) throw new Error('Pinned PR461 evidence changed');
export const EVIDENCE = JSON.parse(rawEvidence);
export const TARGET = '12e6995241cad679260fee8ad34e3fcf76224745';
export const LIVE = 'cfe85a520af1e1a0a06526438dbd33c134cc21b1';
export const OLD = '8cab25576e7bbcd73bb990dfdd483615d7751780';
export const REPOSITORY = 'noamd-collab/noamdoronmath-worksheets';
export const STEP = 'Reconcile the verified PR461 local publication under the release lock';
const WORKFLOW = '.github/workflows/publish-baseline.yml';
const CANONICAL = 'refs/remotes/origin/headless/astro-poc-baseline';
const SOURCE = 'approved-local-release-reconciliation';
const DESCRIPTION = 'Record verified PR461 local publication; metadata only, no new publication';
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
// Exact reviewed lock contracts, not a text search for a concurrency label.
// The old 7e388 controller may already have a retry waiting for this job's lock.
const OLD_PUBLISH_WORKFLOW = 'da7689feaa7915c65e9979a8703250113ea3a5668be7b9c5508e7c153f5dbed9';
// The completed incident keeps its exact historical controller contract.
const CURRENT_PUBLISH_WORKFLOW = 'e6fdfcfd2bdc3434a68e25ac255870bcbd9a62eceb20029c840e6bff81d9ed76';
const RECONCILE_WORKFLOW = '7ee0a03038c861c20f33266fc9993338507cf26475ab5fc351fad79b154ed6f2';
const GUARD_CODE = 'd632a389dae17449365fbf4d94c6c072716a9f11cc303358bab4fc6be1805e80';
const RECONCILE_CODE = '29ce4cde4e234676d1cec5f5a254e3c88e93232035d3d787171aafed66119dbb';
const sha = value => /^[0-9a-f]{40}$/.test(value || '');
const id = value => /^[1-9]\d*$/.test(String(value || '')) && Number.isSafeInteger(Number(value));
const same = (a, b) => stable(a) === stable(b);
const check = (condition, message) => { if (!condition) throw new Error(message); };
const stable = value => JSON.stringify(value, (_, item) => item && !Array.isArray(item) && typeof item === 'object'
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const runUrl = runId => `https://github.com/${REPOSITORY}/actions/runs/${runId}`;

// Presentation-only creator fields (avatars, profile links) are not identity.
// Every recorded deployment/status identity field and the ENTIRE payload are.
function identity(record, expected) {
  return Object.fromEntries(Object.keys(expected).map(key => [key, key === 'creator'
    ? Object.fromEntries(Object.keys(expected.creator).map(k => [k, record?.creator?.[k]])) : record?.[key]]));
}
export function assertAncestry(gitDir, chain = [OLD, LIVE, TARGET, CANONICAL]) {
  check(gitDir && chain.length === 4, 'An exact site checkout and four ancestry points are required');
  for (const revision of chain) execFileSync('git', ['-C', gitDir, 'cat-file', '-e', `${revision}^{commit}`], { stdio: 'pipe' });
  for (let i = 1; i < chain.length; i++) {
    check(spawnSync('git', ['-C', gitDir, 'merge-base', '--is-ancestor', chain[i - 1], chain[i]]).status === 0,
      'Required ancestry old deployment -> PR461 -> approved target -> canonical failed');
  }
}
export function executionContext(env) {
  check(env.GITHUB_ACTIONS === 'true' && env.GITHUB_REPOSITORY === REPOSITORY && env.GITHUB_REF === 'refs/heads/main' &&
    env.GITHUB_JOB === 'publish' && env.GITHUB_WORKFLOW_REF === `${REPOSITORY}/${WORKFLOW}@refs/heads/main` &&
    env.GITHUB_SERVER_URL === 'https://github.com' && env.GITHUB_API_URL === 'https://api.github.com' &&
    ['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME), 'Write is restricted to the protected main publish job');
  check(env.RELEASE_SHA === TARGET && sha(env.GITHUB_SHA) && id(env.GITHUB_RUN_ID) && id(env.GITHUB_RUN_ATTEMPT) && env.SITE_DIR,
    'Exact approved target, controller, run/attempt and site checkout are required');
  return { approvedSha: TARGET, controllerSha: env.GITHUB_SHA, runId: String(env.GITHUB_RUN_ID),
    runAttempt: Number(env.GITHUB_RUN_ATTEMPT), eventName: env.GITHUB_EVENT_NAME, gitDir: env.SITE_DIR };
}
async function paged(api, path, field) {
  const rows = [];
  for (let page = 1; page <= 100; page++) {
    const result = await api(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const batch = field ? result?.[field] : result;
    check(Array.isArray(batch) && batch.every(r => Number.isSafeInteger(r.id) && r.id > 0), 'Malformed reconciliation history');
    rows.push(...batch);
    if (batch.length < 100) {
      check(new Set(rows.map(r => r.id)).size === rows.length, 'Duplicate history entries');
      return rows.sort((a, b) => b.id - a.id);
    }
  }
  throw new Error('Reconciliation history exceeds inspection limit');
}
async function statuses(api, record) { return paged(api, `/deployments/${record.id}/statuses`); }
function guarded(record, expectedSha) {
  check(record && Number.isSafeInteger(record.id) && record.sha === expectedSha && record.ref === expectedSha &&
    record.task === TASK && record.environment === ENVIRONMENT && record.original_environment === ENVIRONMENT &&
    record.production_environment === true && record.transient_environment === false &&
    record.creator?.login === 'github-actions[bot]' && record.creator?.id === 41898282,
  'Deployment identity does not match the protected production contract');
}
async function verifiedRun(api, runId, controllerSha) {
  check(id(runId) && sha(controllerSha), 'Invalid recorded controller/run identity');
  const run = await api(`/actions/runs/${runId}`);
  check(String(run?.id) === String(runId) && run.head_sha === controllerSha && run.head_branch === 'main' &&
    run.path === WORKFLOW && run.repository?.full_name === REPOSITORY &&
    ['push', 'workflow_dispatch'].includes(run.event), 'Recorded run is not the exact main publisher');
  const workflow = await api(`/contents/${WORKFLOW}?ref=${controllerSha}`);
  check(workflow?.encoding === 'base64' && readApprovedSha(Buffer.from(workflow.content, 'base64').toString('utf8')) === TARGET,
    'Recorded controller does not pin the one allowed target');
  return run;
}
async function verifyOtherPublisherBeforeWriting(api, listed, workflow) {
  check(id(listed?.id) && sha(listed.head_sha) && id(listed.run_attempt), 'Other run identity/attempt is unavailable');
  const run = await api(`/actions/runs/${listed.id}`);
  const runIdentity = r => ({ id: r?.id, head_sha: r?.head_sha, head_branch: r?.head_branch,
    path: r?.path, status: r?.status, run_attempt: r?.run_attempt });
  check(same(runIdentity(run), runIdentity(listed)) && run.head_branch === 'main' &&
    run.path === `.github/workflows/${workflow}` && run.repository?.full_name === REPOSITORY &&
    ['push', 'workflow_dispatch'].includes(run.event) && ['queued', 'waiting', 'pending', 'in_progress'].includes(run.status) && run.conclusion === null,
  'Other publisher run changed or is not the exact main workflow');
  const source = await api(`/contents/${run.path}?ref=${run.head_sha}`);
  check(source?.encoding === 'base64', 'Other publisher workflow is unavailable');
  const hash = digest(Buffer.from(source.content, 'base64'));
  const publish = workflow === 'publish-baseline.yml';
  check(publish ? [OLD_PUBLISH_WORKFLOW, CURRENT_PUBLISH_WORKFLOW].includes(hash) : hash === RECONCILE_WORKFLOW,
    'Queued publisher does not use the exact reviewed non-cancelling wix-production lock contract');
  // The legacy queued publisher must actually execute the unchanged rollback
  // guard after acquiring the lock; merely naming the same concurrency group
  // cannot establish that it will reject OLD after we record LIVE.
  for (const [path, expected] of [['production-release.mjs', GUARD_CODE], ...(!publish ? [['reconcile-production.mjs', RECONCILE_CODE]] : [])]) {
    const code = await api(`/contents/.github/scripts/${path}?ref=${run.head_sha}`);
    check(code?.encoding === 'base64' && digest(Buffer.from(code.content, 'base64')) === expected,
      'Queued publisher/reconciler code is not the reviewed guard');
  }
  const jobs = await paged(api, `/actions/runs/${run.id}/jobs`, 'jobs');
  const writer = publish ? 'publish' : 'reconcile', allowed = publish ? ['release-request', 'publish'] : ['reconcile'];
  check(jobs.every(j => j.run_id === run.id && j.run_attempt === run.run_attempt && allowed.includes(j.name)),
    'Other publisher jobs do not identify the exact current attempt');
  const writers = jobs.filter(j => j.name === writer);
  if (writers.length === 0) {
    // A run before job creation, or its read-only intent job, need not already
    // hold/wait on the lock. The exact workflow above proves its FUTURE writer
    // must acquire our lock and run the unchanged guard before any publication.
    check(['queued', 'waiting', 'pending'].includes(run.status) || (publish && jobs.length === 1 &&
      jobs[0].name === 'release-request' && ['queued', 'waiting', 'in_progress', 'completed'].includes(jobs[0].status)),
    'Other run has no writer and is not a verified pre-publication state');
  } else {
    check(writers.length === 1 && ['queued', 'waiting'].includes(writers[0].status) &&
      (writers[0].steps || []).every(s => !['in_progress', 'completed'].includes(s.status)),
    'Another publication/reconciliation job is active or not proven to be waiting');
  }
  check(same(runIdentity(await api(`/actions/runs/${run.id}`)), runIdentity(run)), 'Other run/attempt changed while verifying its lock');
}
async function publishers(api, context) {
  const run = await verifiedRun(api, context.runId, context.controllerSha);
  check(run.status === 'in_progress' && run.run_attempt === context.runAttempt && run.event === context.eventName,
    'Current publisher run/attempt is not active');
  const jobs = await paged(api, `/actions/runs/${context.runId}/jobs`, 'jobs');
  check(jobs.some(j => j.name === 'publish' && j.status === 'in_progress' && j.run_attempt === context.runAttempt),
    'The current protected publish job is not active');
  for (const workflow of ['publish-baseline.yml', 'reconcile-production.yml']) {
    const runs = await paged(api, `/actions/workflows/${workflow}/runs`, 'workflow_runs');
    check(workflow !== 'publish-baseline.yml' || runs.some(r => String(r.id) === context.runId), 'Current publisher is missing from history');
    for (const other of runs) {
      if (other.status === 'completed') continue;
      if (workflow === 'publish-baseline.yml' && String(other.id) === context.runId) {
        check(other.status === 'in_progress' && other.head_sha === context.controllerSha && other.run_attempt === context.runAttempt,
          'Current publisher changed in workflow history');
        continue;
      }
      await verifyOtherPublisherBeforeWriting(api, other, workflow);
    }
  }
}
function reconciliationPayload(context) {
  return { releaseGuardVersion: 1, source: SOURCE, confirmedLiveSha: LIVE, previousDeploymentId: 7776754145,
    previousLiveSha: OLD, previousDeploymentRunId: '43509763952', approvedPublishedPr: 461,
    localPublishObservedAt: EVIDENCE.localPublishObservedAt, originalPublicationRunId: null, republicationPerformed: false,
    evidencePath: EVIDENCE_PATH, evidenceSha256: EVIDENCE_SHA256, proofSha256: EVIDENCE.proofSha256,
    reconciliationRunId: context.runId, reconciliationRunAttempt: context.runAttempt,
    reconciliationControllerSha: context.controllerSha };
}
function validateReconciliation(record) {
  guarded(record, LIVE);
  const p = record.payload;
  check(id(p?.reconciliationRunId) && id(p?.reconciliationRunAttempt) && sha(p?.reconciliationControllerSha) &&
    same(p, reconciliationPayload({ runId: p.reconciliationRunId, runAttempt: p.reconciliationRunAttempt,
      controllerSha: p.reconciliationControllerSha })) && record.description === DESCRIPTION,
  'Reconciliation payload/proof pins differ from the exact reviewed incident');
}
async function completedStep(api, runId, controllerSha, attempt, stepName) {
  await verifiedRun(api, runId, controllerSha);
  const jobs = await paged(api, `/actions/runs/${runId}/jobs?filter=all`, 'jobs');
  check(jobs.some(j => j.name === 'publish' && (attempt === undefined || j.run_attempt === attempt) &&
    j.steps?.some(s => s.name === stepName && s.status === 'completed' && s.conclusion === 'success')),
  'Recorded successful action is not supported by the publisher job history');
}
async function successfulStatus(api, record, logUrl) {
  const all = await statuses(api, record), status = all[0];
  check(status?.state === 'success' && status.environment === ENVIRONMENT && status.log_url === logUrl &&
    status.environment_url === 'https://www.noamdoronmath.co.il/', 'Production record is unfinished or uncertain');
  return all;
}
async function state(api, { justCreated = null, excludeCreated = null } = {}) {
  const records = (await paged(api, `/deployments?environment=${ENVIRONMENT}`)).filter(r => r.id !== excludeCreated);
  check(records.length && records.every(r => r.environment === ENVIRONMENT), 'Invalid production deployment history');
  const oldIndex = records.findIndex(r => r.id === 7776754145), old = records[oldIndex];
  check(oldIndex >= 0 && same(identity(old, EVIDENCE.expectedDeployment), EVIDENCE.expectedDeployment), 'Exact old deployment identity/payload changed or is missing');
  const oldStatuses = await statuses(api, old);
  check(same(oldStatuses.map(s => identity(s, EVIDENCE.expectedStatuses[0])), EVIDENCE.expectedStatuses),
    'Exact old success/status history changed');
  const tail = records.slice(0, oldIndex).reverse(), inspected = [{ record: old, statuses: oldStatuses }];
  let previousSha = OLD;
  for (const [index, record] of tail.entries()) {
    if (index === 0) {
      validateReconciliation(record);
      const p = record.payload;
      const all = await successfulStatus(api, record, runUrl(p.reconciliationRunId));
      if (record.id !== justCreated) await completedStep(api, p.reconciliationRunId, p.reconciliationControllerSha, p.reconciliationRunAttempt, STEP);
      inspected.push({ record, statuses: all });
    } else {
      guarded(record, TARGET);
      const p = record.payload;
      check(id(p?.runId) && sha(p?.controllerSha) && same(p, { releaseGuardVersion: 1, runId: p.runId,
        controllerSha: p.controllerSha, previousLiveSha: previousSha }), 'Protected target release is not descended from this reconciliation');
      const all = await successfulStatus(api, record, runUrl(p.runId));
      await completedStep(api, p.runId, p.controllerSha, undefined, STEP);
      await completedStep(api, p.runId, p.controllerSha, undefined, 'Publish the approved baseline');
      inspected.push({ record, statuses: all });
    }
    previousSha = record.sha;
  }
  return { kind: tail.length ? (tail.length === 1 ? 'reconciled' : 'released') : 'old', inspected };
}

// All API I/O is injectable. The CLI additionally enforces Actions environment
// and exact committed checkouts. Default invocation performs no network/write.
export async function reconcilePr461({ api, context, write = false, verifyHistory = assertAncestry }) {
  check(context?.approvedSha === TARGET && sha(context.controllerSha) && id(context.runId) && id(context.runAttempt), 'Only the exact approved target/run is allowed');
  check(typeof write === 'boolean', 'Explicit write mode required');
  verifyHistory(context.gitDir);
  await publishers(api, context);
  const before = await state(api);
  if (before.kind !== 'old' || !write) return { action: before.kind === 'old' ? 'would-reconcile' : 'no-op', state: before.kind, wrote: false };
  await publishers(api, context);
  const fresh = await state(api);
  check(same(before, fresh), 'Production history changed before reconciliation; stop');
  const payload = reconciliationPayload(context);
  const created = await api('/deployments', { method: 'POST', body: {
    ref: LIVE, task: TASK, environment: ENVIRONMENT, auto_merge: false, required_contexts: [],
    production_environment: true, transient_environment: false, description: DESCRIPTION, payload,
  } });
  validateReconciliation(created);
  check(created.id > 7776754145 && same(created.payload, payload), 'Unexpected created reconciliation record; leave it unfinished');
  // Never finish a partial record on retry. Only THIS invocation can complete
  // its returned new record, after re-reading the unchanged predecessor chain.
  const records = await paged(api, `/deployments?environment=${ENVIRONMENT}`);
  check(records[0]?.id === created.id && same(records[0], created), 'Reconciliation was superseded or changed; leave it unfinished');
  check(same(await state(api, { excludeCreated: created.id }), before), 'Predecessor history changed after creation; leave reconciliation unfinished');
  check((await statuses(api, created)).length === 0, 'New reconciliation already has a status; stop without completing it');
  await publishers(api, context);
  const newest = (await paged(api, `/deployments?environment=${ENVIRONMENT}`))[0];
  check(newest?.id === created.id && same(newest, created), 'Newest record changed before success; leave reconciliation unfinished');
  await api(`/deployments/${created.id}/statuses`, { method: 'POST', body: {
    state: 'success', auto_inactive: false, log_url: runUrl(context.runId), environment_url: 'https://www.noamdoronmath.co.il/',
    description: 'Reviewed PR461 local release recorded; reconciliation run did not publish',
  } });
  const final = await state(api, { justCreated: created.id });
  check(final.kind === 'reconciled' && final.inspected.at(-1).record.id === created.id, 'Reconciliation readback is uncertain');
  return { action: 'reconciled', wrote: true, deploymentId: created.id, confirmedLiveSha: LIVE, reconciliationRunId: context.runId };
}

async function main() {
  if (process.argv.length === 2) {
    console.log(JSON.stringify({ write: false, target: TARGET, confirmedLiveSha: LIVE, evidenceSha256: EVIDENCE_SHA256,
      note: 'No API calls. Writes require --write in the protected main publish job after approval.' }));
    return;
  }
  check(process.argv.length === 3 && process.argv[2] === '--write', 'Only no-argument inspection or protected --write is supported');
  const context = executionContext(process.env);
  const controller = fileURLToPath(new URL('../../', import.meta.url));
  const git = (dir, args) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  check(git(controller, ['rev-parse', 'HEAD']) === context.controllerSha && git(context.gitDir, ['rev-parse', 'HEAD']) === TARGET,
    'Controller/site HEAD does not match the exact running controller and target');
  execFileSync('git', ['-C', context.gitDir, 'diff', '--exit-code', 'HEAD', '--'], { stdio: 'pipe' });
  for (const path of [WORKFLOW, EVIDENCE_PATH, '.github/scripts/reconcile-pr461.mjs', '.github/scripts/production-release.mjs']) {
    check(git(controller, ['show', `${context.controllerSha}:${path}`]) === readFileSync(`${controller}/${path}`, 'utf8').trim(),
      'Controller workflow/helper/evidence has an uncommitted change');
  }
  check(readApprovedSha(readFileSync(`${controller}/${WORKFLOW}`, 'utf8')) === TARGET, 'Controller target mismatch');
  console.log(JSON.stringify(await reconcilePr461({ api: githubApi({ token: process.env.GITHUB_TOKEN, repository: REPOSITORY }), context, write: true })));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
