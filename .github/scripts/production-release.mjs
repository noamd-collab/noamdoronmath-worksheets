#!/usr/bin/env node
import { appendFileSync, readFileSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

export const ENVIRONMENT = 'wix-production';
export const TASK = 'wix-publish';
const SHA = /^[0-9a-f]{40}$/;
const workflowPath = '.github/workflows/publish-baseline.yml';

function requireSha(value, label) {
  if (!SHA.test(value || '')) throw new Error(`${label} must be a full commit SHA`);
  return value;
}

export function readApprovedSha(source) {
  // Recognize the pre-guard workflow too, so installing the guard never releases.
  const matches = [...source.matchAll(/^\s*RELEASE_SHA:\s*([0-9a-f]{40})\s*$/gm),
    ...source.matchAll(/bash tools\/release\/release\.sh "([0-9a-f]{40})"/g)];
  if (matches.length !== 1) throw new Error('Expected exactly one approved site SHA in the workflow');
  return matches[0][1];
}

export function publicationRequested({ eventName, ref, publish, beforeWorkflow, approvedSha }) {
  if (ref !== 'refs/heads/main') throw new Error('Publication is allowed only from the main controller');
  requireSha(approvedSha, 'Approved SHA');
  if (eventName === 'workflow_dispatch') return publish === true || publish === 'true';
  if (eventName !== 'push') throw new Error('Unsupported publication event');
  if (typeof beforeWorkflow !== 'string') throw new Error('Cannot establish the previous approved SHA');
  return readApprovedSha(beforeWorkflow) !== approvedSha;
}

export function assertReleaseHistory({ gitDir, approvedSha, lastLiveSha,
  branchRef = 'refs/remotes/origin/headless/astro-poc-baseline' }) {
  requireSha(approvedSha, 'Approved SHA');
  requireSha(lastLiveSha, 'Last live SHA');
  for (const revision of [approvedSha, lastLiveSha, branchRef]) {
    execFileSync('git', ['-C', gitDir, 'cat-file', '-e', `${revision}^{commit}`], { stdio: 'pipe' });
  }
  for (const [ancestor, descendant, message] of [
    [approvedSha, branchRef, 'Approved commit is outside the canonical branch'],
    [lastLiveSha, approvedSha, 'Rollback blocked: approved commit does not include the last live commit'],
  ]) {
    const result = spawnSync('git', ['-C', gitDir, 'merge-base', '--is-ancestor', ancestor, descendant], { encoding: 'utf8' });
    if (result.status !== 0) throw new Error(message);
  }
}

async function latestDeployment(api) {
  const records = [];
  for (let page = 1; page <= 100; page++) {
    const batch = await api(`/deployments?environment=${ENVIRONMENT}&per_page=100${page === 1 ? '' : `&page=${page}`}`);
    if (!Array.isArray(batch)) throw new Error('Invalid production deployment response');
    records.push(...batch);
    if (batch.length < 100) {
      if (!records.length) throw new Error('No confirmed production record; initialize it from verified live evidence');
      for (const record of records) {
        if (!Number.isSafeInteger(record.id) || record.environment !== ENVIRONMENT) {
          throw new Error('Invalid production deployment record');
        }
      }
      return records.sort((a, b) => b.id - a.id)[0];
    }
  }
  throw new Error('Production history exceeds the inspection limit');
}

export async function readLiveDeployment(api) {
  const deployment = await latestDeployment(api);
  if (deployment.task !== TASK || deployment.payload?.releaseGuardVersion !== 1) {
    throw new Error('Newest production record is not a verified release-guard record');
  }
  requireSha(deployment.sha, 'Recorded live SHA');
  const statuses = await api(`/deployments/${deployment.id}/statuses?per_page=100`);
  if (!Array.isArray(statuses) || !statuses.length || statuses.some(s => !Number.isSafeInteger(s.id))) {
    throw new Error('Newest production record has no reliable status');
  }
  if (statuses.sort((a, b) => b.id - a.id)[0].state !== 'success') {
    throw new Error('Production state is unfinished or uncertain; reconcile it before another release');
  }
  return { deployment, lastLiveSha: deployment.sha };
}

export function githubApi({ token, repository, fetchImpl = fetch }) {
  if (!token) throw new Error('GITHUB_TOKEN is required');
  if (!/^[\w.-]+\/[\w.-]+$/.test(repository || '')) throw new Error('Invalid repository');
  return async (path, { method = 'GET', body } = {}) => {
    const response = await fetchImpl(`https://api.github.com/repos/${repository}${path}`, {
      method,
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(`GitHub ${method} ${path} failed with HTTP ${response.status}`);
    return response.json();
  };
}

export async function beginRelease({ api, gitDir, approvedSha, runId, controllerSha, logUrl }) {
  const { lastLiveSha } = await readLiveDeployment(api);
  assertReleaseHistory({ gitDir, approvedSha, lastLiveSha });
  const deployment = await api('/deployments', { method: 'POST', body: {
    ref: approvedSha, task: TASK, environment: ENVIRONMENT, auto_merge: false,
    required_contexts: [], production_environment: true, transient_environment: false,
    description: 'Approved site release; unfinished state blocks subsequent publication',
    payload: { releaseGuardVersion: 1, runId, controllerSha, previousLiveSha: lastLiveSha },
  } });
  if (!Number.isSafeInteger(deployment.id) || deployment.sha !== approvedSha) {
    throw new Error('GitHub did not create a deployment for the exact approved SHA');
  }
  await api(`/deployments/${deployment.id}/statuses`, { method: 'POST', body: {
    state: 'in_progress', auto_inactive: false, log_url: logUrl,
    description: 'History verified; publication in progress',
  } });
  return deployment.id;
}

export async function finishRelease({ api, deploymentId, approvedSha, runId, succeeded, logUrl }) {
  const deployment = await latestDeployment(api);
  if (String(deployment.id) !== String(deploymentId) || deployment.sha !== approvedSha ||
      deployment.task !== TASK || deployment.payload?.releaseGuardVersion !== 1 ||
      String(deployment.payload.runId) !== String(runId)) {
    throw new Error('Cannot complete a different or superseded production deployment');
  }
  await api(`/deployments/${deployment.id}/statuses`, { method: 'POST', body: {
    state: succeeded ? 'success' : 'error', auto_inactive: false, log_url: logUrl,
    environment_url: 'https://www.noamdoronmath.co.il/',
    description: succeeded ? 'Wix confirmed publication of the approved SHA' :
      'Release failed or was interrupted; reconcile live state before retrying',
  } });
}

// One-time operator step, never called by the publication workflow. This only
// records an already verified deployment; it does not invoke Wix or change Git.
export async function initializeConfirmedProduction({ api, confirmedSha, evidenceRunId, write = false }) {
  requireSha(confirmedSha, 'Confirmed live SHA');
  if (!/^\d+$/.test(String(evidenceRunId || ''))) throw new Error('A confirmed publication run ID is required');
  const existing = await api(`/deployments?environment=${ENVIRONMENT}&per_page=1`);
  if (!Array.isArray(existing) || existing.length) throw new Error('Production state already exists or cannot be established; do not overwrite it');
  const runs = await api('/actions/workflows/publish-baseline.yml/runs?per_page=1');
  const run = runs.workflow_runs?.[0];
  if (!run || String(run.id) !== String(evidenceRunId) || run.status !== 'completed' ||
      run.conclusion !== 'success' || run.head_branch !== 'main') {
    throw new Error('Evidence must be the latest completed successful publication run on main');
  }
  requireSha(run.head_sha, 'Evidence controller SHA');
  const workflow = await api(`/contents/${workflowPath}?ref=${run.head_sha}`);
  if (workflow.encoding !== 'base64' || readApprovedSha(Buffer.from(workflow.content, 'base64').toString('utf8')) !== confirmedSha) {
    throw new Error('Evidence workflow does not pin the confirmed live SHA');
  }
  const jobs = await api(`/actions/runs/${evidenceRunId}/jobs?per_page=100`);
  if (!jobs.jobs?.some(job => job.name === 'publish' && job.conclusion === 'success' &&
      job.steps?.some(step => ['Publish baseline', 'Publish the approved baseline'].includes(step.name) && step.conclusion === 'success'))) {
    throw new Error('Evidence run did not successfully execute the actual publication step');
  }
  if (!write) return { initialized: false, confirmedSha, evidenceRunId };
  const latest = (await api('/actions/workflows/publish-baseline.yml/runs?per_page=1')).workflow_runs?.[0];
  if (latest?.id !== run.id || latest.status !== 'completed' || latest.conclusion !== 'success' ||
      latest.run_attempt !== run.run_attempt || latest.updated_at !== run.updated_at) {
    throw new Error('Publication evidence changed during initialization; stop and verify live state again');
  }
  const record = await api('/deployments', { method: 'POST', body: {
    ref: confirmedSha, task: TASK, environment: ENVIRONMENT, auto_merge: false,
    required_contexts: [], production_environment: true, transient_environment: false,
    description: 'One-time record of the independently confirmed existing Wix publication',
    payload: { releaseGuardVersion: 1, runId: String(evidenceRunId), controllerSha: run.head_sha,
      source: 'confirmed-existing-publication' },
  } });
  if (!Number.isSafeInteger(record.id) || record.sha !== confirmedSha) throw new Error('Invalid initial deployment record');
  await api(`/deployments/${record.id}/statuses`, { method: 'POST', body: {
    state: 'success', auto_inactive: false,
    log_url: run.html_url, environment_url: 'https://www.noamdoronmath.co.il/',
    description: 'Existing live SHA independently confirmed against the successful run',
  } });
  return { initialized: true, deploymentId: record.id, confirmedSha, evidenceRunId };
}

async function main() {
  const command = process.argv[2];
  const approvedSha = requireSha(process.env.RELEASE_SHA, 'RELEASE_SHA');
  const output = (name, value) => {
    console.log(`${name}=${value}`);
    if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  };
  if (command === 'intent') {
    // Read the pinned SHA from the checked-out controller, not from the site tree.
    if (readApprovedSha(readFileSync(workflowPath, 'utf8')) !== approvedSha) throw new Error('Controller SHA pin mismatch');
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'));
    let beforeWorkflow;
    if (process.env.GITHUB_EVENT_NAME === 'push') {
      const before = requireSha(event.before, 'Push before SHA');
      beforeWorkflow = execFileSync('git', ['show', `${before}:${workflowPath}`], { encoding: 'utf8' });
    }
    output('publish', publicationRequested({ eventName: process.env.GITHUB_EVENT_NAME,
      ref: process.env.GITHUB_REF, publish: process.env.INPUT_PUBLISH, beforeWorkflow, approvedSha }));
    return;
  }
  if (!['begin', 'finish', 'check', 'initialize'].includes(command)) throw new Error('Use intent, check, begin, finish or initialize');
  const api = githubApi({ token: process.env.GITHUB_TOKEN, repository: process.env.GITHUB_REPOSITORY });
  if (command === 'initialize') {
    if (process.env.CONFIRMED_LIVE_SHA !== approvedSha) throw new Error('Explicit confirmed live SHA must match RELEASE_SHA');
    console.log(JSON.stringify(await initializeConfirmedProduction({ api, confirmedSha: approvedSha,
      evidenceRunId: process.env.CONFIRMED_RUN_ID, write: process.argv.includes('--write') })));
    return;
  }
  const common = { api, approvedSha, gitDir: process.env.SITE_DIR,
    runId: process.env.GITHUB_RUN_ID, controllerSha: process.env.GITHUB_SHA,
    logUrl: `https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` };
  if (command === 'check') {
    const { lastLiveSha } = await readLiveDeployment(api);
    assertReleaseHistory({ ...common, lastLiveSha });
    output('last_live_sha', lastLiveSha);
  } else if (command === 'begin') {
    output('deployment_id', await beginRelease(common));
  } else {
    await finishRelease({ ...common, deploymentId: process.env.DEPLOYMENT_ID,
      succeeded: process.env.RELEASE_OUTCOME === 'success' });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
