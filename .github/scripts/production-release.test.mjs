import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readApprovedSha,
  publicationRequested,
  assertReleaseHistory,
  readLiveDeployment,
  beginRelease,
  finishRelease,
  githubApi,
  initializeConfirmedProduction,
} from './production-release.mjs';

const LIVE = '0b59201995aa7359c21b8cd8ccd320d7952a2ba4';
const NEXT = '1111111111111111111111111111111111111111';
const MAIN_REF = 'refs/heads/main';
const CANONICAL_REF = 'refs/remotes/origin/headless/astro-poc-baseline';
const legacyWorkflow = (sha) => `jobs:\n  publish:\n    run: |\n      bash tools/release/release.sh "${sha}"\n`;
const guardedWorkflow = (sha) => `env:\n  RELEASE_SHA: ${sha}\n`;

test('approved SHA is read from the legacy command or the new explicit pin', () => {
  assert.equal(readApprovedSha(legacyWorkflow(LIVE)), LIVE);
  assert.equal(readApprovedSha(guardedWorkflow(LIVE)), LIVE);
  assert.equal(readApprovedSha(`# A previous release used ${NEXT}\n${guardedWorkflow(LIVE)}`), LIVE);
});

test('missing, malformed or ambiguous release pins cannot authorize publication', () => {
  for (const workflow of [
    '',
    'env:\n  RELEASE_SHA: 0b59201\n',
    `env:\n  RELEASE_SHA: ${'z'.repeat(40)}\n`,
    guardedWorkflow(LIVE) + guardedWorkflow(NEXT),
    legacyWorkflow(LIVE) + legacyWorkflow(NEXT),
    guardedWorkflow(LIVE) + legacyWorkflow(LIVE),
  ]) {
    assert.throws(() => readApprovedSha(workflow));
  }
});

test('merging the guard itself does not publish the unchanged approved site', () => {
  assert.equal(publicationRequested({
    eventName: 'push', ref: MAIN_REF,
    beforeWorkflow: legacyWorkflow(LIVE), approvedSha: LIVE,
  }), false);
  assert.equal(publicationRequested({
    eventName: 'push', ref: MAIN_REF,
    beforeWorkflow: guardedWorkflow(LIVE), approvedSha: LIVE,
  }), false);
});

test('a main push changing the approved pin requests publication', () => {
  assert.equal(publicationRequested({
    eventName: 'push', ref: MAIN_REF,
    beforeWorkflow: guardedWorkflow(LIVE), approvedSha: NEXT,
  }), true);
});

test('manual publication requires the main ref and an affirmative publish input', () => {
  for (const publish of [true, 'true']) {
    assert.equal(publicationRequested({
      eventName: 'workflow_dispatch', ref: MAIN_REF, publish, approvedSha: LIVE,
    }), true);
  }
  for (const publish of [false, 'false', undefined, 'yes']) {
    assert.equal(publicationRequested({
      eventName: 'workflow_dispatch', ref: MAIN_REF, publish, approvedSha: LIVE,
    }), false);
  }
});

test('unexpected workflow sources, refs and unavailable previous pins fail closed', () => {
  for (const request of [
    { eventName: 'pull_request', ref: MAIN_REF, approvedSha: LIVE },
    { eventName: 'workflow_dispatch', ref: 'refs/heads/release/old', publish: true, approvedSha: LIVE },
    { eventName: 'push', ref: 'refs/heads/headless/astro-poc-baseline', beforeWorkflow: guardedWorkflow(LIVE), approvedSha: NEXT },
    { eventName: 'push', ref: MAIN_REF, beforeWorkflow: '', approvedSha: NEXT },
    { eventName: 'push', ref: MAIN_REF, approvedSha: NEXT },
  ]) {
    assert.throws(() => publicationRequested(request));
  }
});

function historyFixture(t) {
  const gitDir = mkdtempSync(join(tmpdir(), 'noam-release-history-'));
  t.after(() => rmSync(gitDir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', [
    '-C', gitDir, '-c', 'user.name=Release guard test',
    '-c', 'user.email=release-guard@example.invalid',
    '-c', 'commit.gpgsign=false', ...args,
  ], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '--initial-branch=trunk');
  const commit = (message) => {
    git('commit', '--allow-empty', '-qm', message);
    return git('rev-parse', 'HEAD');
  };
  const old = commit('old version');
  const live = commit('currently published version');
  const candidate = commit('reviewed candidate');
  const head = commit('later canonical work');
  git('update-ref', CANONICAL_REF, head);
  git('checkout', '-q', '--detach', old);
  const divergent = commit('separate release branch omitting live changes');
  git('checkout', '-q', '--detach', candidate);
  const unmerged = commit('unmerged feature containing live');
  return { gitDir, old, live, candidate, head, divergent, unmerged };
}

test('same-SHA retry and a descendant already merged to canonical are allowed', (t) => {
  const h = historyFixture(t);
  for (const approvedSha of [h.live, h.candidate, h.head]) {
    assert.doesNotThrow(() => assertReleaseHistory({
      gitDir: h.gitDir, lastLiveSha: h.live, approvedSha,
    }));
  }
});

test('an old canonical ancestor cannot replace the current live site', (t) => {
  const h = historyFixture(t);
  assert.throws(() => assertReleaseHistory({
    gitDir: h.gitDir, lastLiveSha: h.live, approvedSha: h.old,
  }));
});

test('a divergent release and an unmerged descendant both fail ancestry checks', (t) => {
  const h = historyFixture(t);
  for (const approvedSha of [h.divergent, h.unmerged]) {
    assert.throws(() => assertReleaseHistory({
      gitDir: h.gitDir, lastLiveSha: h.live, approvedSha,
    }));
  }
});

test('missing git history or non-full SHAs never fall back to an unguarded release', (t) => {
  const h = historyFixture(t);
  for (const change of [
    { approvedSha: h.candidate.slice(0, 7) },
    { lastLiveSha: h.live.slice(0, 7) },
    { approvedSha: NEXT },
    { lastLiveSha: NEXT },
    { branchRef: 'refs/remotes/origin/missing' },
  ]) {
    assert.throws(() => assertReleaseHistory({
      gitDir: h.gitDir, lastLiveSha: h.live, approvedSha: h.candidate, ...change,
    }));
  }
});

function deployment(id, sha = LIVE, overrides = {}) {
  return {
    id, sha, ref: sha, task: 'wix-publish', environment: 'wix-production',
    production_environment: true, transient_environment: false,
    payload: { releaseGuardVersion: 1 },
    statuses_url: `/deployments/${id}/statuses`,
    ...overrides,
  };
}

function fakeApi(deployments, statusById) {
  const calls = [];
  const api = async (path, options = {}) => {
    calls.push({ path, options });
    assert.ok(!options.method || options.method === 'GET', 'state inspection must not mutate deployment records');
    const url = new URL(path, 'https://api.github.com');
    if (url.pathname === '/deployments') {
      assert.equal(url.searchParams.get('environment'), 'wix-production');
      assert.equal(url.searchParams.get('per_page'), '100');
      return Number(url.searchParams.get('page') || 1) === 1 ? deployments : [];
    }
    const match = url.pathname.match(/^\/deployments\/(\d+)\/statuses$/);
    assert.ok(match, `unexpected API path: ${path}`);
    assert.ok(Object.hasOwn(statusById, match[1]), `unexpected status lookup: ${match[1]}`);
    return statusById[match[1]];
  };
  return { api, calls };
}

test('the actual Wix SHA comes from its successful dedicated deployment', async () => {
  const latest = deployment(42);
  const { api } = fakeApi([latest], { 42: [{ id: 420, state: 'success' }] });
  const result = await readLiveDeployment(api);
  assert.equal(result.lastLiveSha, LIVE);
  assert.equal(result.deployment.id, 42);
  assert.notEqual(result.lastLiveSha, '7810033c6f9e804e1484998e1073940a39c0161c');
});

test('missing or malformed production state blocks publication', async () => {
  const invalid = [
    [],
    [deployment(42, LIVE.slice(0, 7))],
    [deployment(42, LIVE, { task: 'deploy' })],
    [deployment(42, LIVE, { environment: 'github-pages' })],
    [deployment(42, LIVE, { payload: {} })],
    [deployment(42, LIVE, { payload: { releaseGuardVersion: 2 } })],
  ];
  for (const records of invalid) {
    const { api } = fakeApi(records, { 42: [{ id: 420, state: 'success' }] });
    await assert.rejects(readLiveDeployment(api));
  }
});

test('a newer incomplete or failed attempt cannot be hidden by an older success', async () => {
  for (const state of [undefined, 'pending', 'queued', 'in_progress', 'failure', 'error', 'inactive']) {
    const { api, calls } = fakeApi([deployment(43, NEXT), deployment(42)], {
      43: state ? [{ id: 430, state }] : [],
      42: [{ id: 420, state: 'success' }],
    });
    await assert.rejects(readLiveDeployment(api));
    assert.ok(!calls.some(({ path }) => path.includes('/42/statuses')), 'must not search backwards for a convenient success');
  }
});

test('the latest status controls a record even if it succeeded earlier', async () => {
  const { api } = fakeApi([deployment(42)], {
    42: [{ id: 421, state: 'error' }, { id: 420, state: 'success' }],
  });
  await assert.rejects(readLiveDeployment(api));
});

test('deployment-list and deployment-status API failures are not treated as missing history', async () => {
  const unavailable = new Error('GitHub API unavailable');
  await assert.rejects(readLiveDeployment(async () => { throw unavailable; }), /GitHub API unavailable/);
  await assert.rejects(readLiveDeployment(async (path) => {
    if (new URL(path, 'https://api.github.com').pathname === '/deployments') return [deployment(42)];
    throw unavailable;
  }), /GitHub API unavailable/);
});

test('newest record is selected across every deployment page', async () => {
  const firstPage = Array.from({ length: 100 }, (_, index) => deployment(index + 1));
  const calls = [];
  const api = async (path) => {
    calls.push(path);
    const url = new URL(path, 'https://api.github.com');
    if (url.pathname === '/deployments') {
      return url.searchParams.get('page') === '2' ? [deployment(101, NEXT)] : firstPage;
    }
    assert.equal(url.pathname, '/deployments/101/statuses');
    return [{ id: 1010, state: 'success' }];
  };
  const result = await readLiveDeployment(api);
  assert.equal(result.lastLiveSha, NEXT);
  assert.ok(calls.some((path) => path.includes('page=2')));
});

function mutableApi(initialSha, failures = {}) {
  const records = [deployment(42, initialSha)];
  const statuses = new Map([[42, [{ id: 420, state: 'success' }]]]);
  const calls = [];
  let statusId = 420;
  const api = async (path, options = {}) => {
    const { method = 'GET', body } = options;
    calls.push({ path, method, body });
    const url = new URL(path, 'https://api.github.com');
    if (url.pathname === '/deployments' && method === 'GET') return [...records];
    if (url.pathname === '/deployments' && method === 'POST') {
      if (failures.create) throw new Error('Deployment creation unavailable');
      const record = deployment(43, body.ref, { ...body, id: 43 });
      records.push(record);
      statuses.set(43, []);
      return { ...record, ...(failures.wrongCreatedSha ? { sha: NEXT } : {}) };
    }
    const match = url.pathname.match(/^\/deployments\/(\d+)\/statuses$/);
    assert.ok(match, `unexpected API path: ${path}`);
    const id = Number(match[1]);
    assert.ok(statuses.has(id), `unknown deployment: ${id}`);
    if (method === 'GET') return [...statuses.get(id)];
    assert.equal(method, 'POST');
    if (failures.inProgress && body.state === 'in_progress') throw new Error('In-progress status unavailable');
    if (failures.success && body.state === 'success') throw new Error('Success status unavailable');
    const status = { ...body, id: ++statusId };
    statuses.get(id).push(status);
    return status;
  };
  return { api, records, statuses, calls };
}

const releaseContext = (h, api) => ({
  api, gitDir: h.gitDir, approvedSha: h.candidate,
  runId: '1234', controllerSha: h.head,
  logUrl: 'https://github.com/example/site/actions/runs/1234',
});

test('history rejection does not create or update any deployment', async (t) => {
  const h = historyFixture(t);
  for (const approvedSha of [h.old, h.divergent, h.unmerged]) {
    const state = mutableApi(h.live);
    await assert.rejects(beginRelease({ ...releaseContext(h, state.api), approvedSha }));
    assert.ok(state.calls.every(({ method }) => method === 'GET'));
    assert.equal((await readLiveDeployment(state.api)).lastLiveSha, h.live);
  }
});

test('begin creates an exact-SHA durable record and in-progress status before returning', async (t) => {
  const h = historyFixture(t);
  const state = mutableApi(h.live);
  const id = await beginRelease(releaseContext(h, state.api));
  assert.equal(id, 43);
  const writes = state.calls.filter(({ method }) => method === 'POST');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, '/deployments');
  assert.equal(writes[0].body.ref, h.candidate);
  assert.equal(writes[0].body.auto_merge, false, 'GitHub must not merge another commit into the approved SHA');
  assert.equal(writes[0].body.production_environment, true);
  assert.equal(writes[0].body.transient_environment, false);
  assert.equal(writes[0].body.environment, 'wix-production');
  assert.equal(writes[0].body.payload.previousLiveSha, h.live);
  assert.equal(writes[0].body.payload.runId, '1234');
  assert.equal(writes[1].path, '/deployments/43/statuses');
  assert.equal(writes[1].body.state, 'in_progress');
  assert.equal(writes[1].body.auto_inactive, false);
  await assert.rejects(readLiveDeployment(state.api), 'an unfinished release must block the next publication');
});

test('a confirmed successful publication advances the durable live SHA', async (t) => {
  const h = historyFixture(t);
  const state = mutableApi(h.live);
  const context = releaseContext(h, state.api);
  const deploymentId = await beginRelease(context);
  await finishRelease({ ...context, deploymentId, succeeded: true });
  assert.equal((await readLiveDeployment(state.api)).lastLiveSha, h.candidate);
  assert.equal(state.statuses.get(42).at(-1).state, 'success');
  const finalStatus = state.statuses.get(43).at(-1);
  assert.equal(finalStatus.state, 'success');
  assert.equal(finalStatus.auto_inactive, false);
});

test('failed publication leaves an uncertain marker that blocks another attempt', async (t) => {
  const h = historyFixture(t);
  const state = mutableApi(h.live);
  const context = releaseContext(h, state.api);
  const deploymentId = await beginRelease(context);
  await finishRelease({ ...context, deploymentId, succeeded: false });
  assert.equal(state.statuses.get(43).at(-1).state, 'error');
  const writesBeforeRetry = state.calls.filter(({ method }) => method === 'POST').length;
  await assert.rejects(beginRelease(context));
  assert.equal(state.calls.filter(({ method }) => method === 'POST').length, writesBeforeRetry);
});

test('failure to save success after publishing never falls back to the earlier live version', async (t) => {
  const h = historyFixture(t);
  const state = mutableApi(h.live, { success: true });
  const context = releaseContext(h, state.api);
  const deploymentId = await beginRelease(context);
  await assert.rejects(finishRelease({ ...context, deploymentId, succeeded: true }), /Success status unavailable/);
  assert.equal(state.statuses.get(43).at(-1).state, 'in_progress');
  await assert.rejects(readLiveDeployment(state.api));
  await assert.rejects(beginRelease(context));
});

test('creation and in-progress API failures stop begin rather than authorize publication', async (t) => {
  const h = historyFixture(t);
  for (const failures of [{ create: true }, { inProgress: true }, { wrongCreatedSha: true }]) {
    const state = mutableApi(h.live, failures);
    await assert.rejects(beginRelease(releaseContext(h, state.api)));
    assert.ok(!state.calls.some(({ body }) => body?.state === 'success'));
    if (!failures.create) await assert.rejects(readLiveDeployment(state.api));
  }
});

test('finish cannot mark another run, SHA or superseding deployment successful', async (t) => {
  const h = historyFixture(t);
  for (const mismatch of [
    { runId: '5678' },
    { approvedSha: h.old },
    { deploymentId: 42 },
    { superseded: true },
  ]) {
    const state = mutableApi(h.live);
    const context = releaseContext(h, state.api);
    const deploymentId = await beginRelease(context);
    if (mismatch.superseded) state.records.push(deployment(44, h.head));
    const before = state.calls.filter(({ method }) => method === 'POST').length;
    await assert.rejects(finishRelease({ ...context, deploymentId, succeeded: true, ...mismatch }));
    assert.equal(state.calls.filter(({ method }) => method === 'POST').length, before);
  }
});

test('HTTP failures propagate without exposing credentials or accepting an error body as state', async () => {
  const token = 'test-only-secret';
  const api = githubApi({ token, repository: 'example/site', fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.github.com/repos/example/site/deployments');
    assert.equal(options.headers.Authorization, `Bearer ${token}`);
    return { ok: false, status: 403, json: async () => { throw new Error('must not read error body'); } };
  } });
  await assert.rejects(api('/deployments'), (error) => {
    assert.match(error.message, /HTTP 403/);
    assert.ok(!error.message.includes(token));
    return true;
  });
});

const EVIDENCE_RUN = 42004009862;
const CONTROLLER_SHA = '7810033c6f9e804e1484998e1073940a39c0161c';

function initializationApi(options = {}) {
  const records = options.existing ? [deployment(42)] : [];
  const statuses = new Map([[42, [{ id: 420, state: 'success' }]]]);
  const calls = [];
  let evidenceReads = 0;
  const evidenceRun = {
    id: EVIDENCE_RUN, status: 'completed', conclusion: 'success',
    head_branch: 'main', head_sha: CONTROLLER_SHA,
    run_attempt: 1, updated_at: '2026-11-05T09:40:13Z',
    html_url: `https://github.com/example/site/actions/runs/${EVIDENCE_RUN}`,
    ...options.run,
  };
  const api = async (path, { method = 'GET', body } = {}) => {
    calls.push({ path, method, body });
    if (options.fail?.({ path, method, body })) throw new Error('Initialization API unavailable');
    const url = new URL(path, 'https://api.github.com');
    if (url.pathname === '/deployments' && method === 'GET') return [...records];
    if (url.pathname === '/actions/workflows/publish-baseline.yml/runs') {
      evidenceReads += 1;
      const currentRun = evidenceReads > 1 ? { ...evidenceRun, ...options.raceRun } : { ...evidenceRun };
      return { workflow_runs: options.noRun ? [] : [currentRun] };
    }
    if (url.pathname === `/actions/runs/${EVIDENCE_RUN}/jobs`) {
      return { jobs: options.jobs || [{
        id: 7, name: 'publish', status: 'completed', conclusion: 'success',
        steps: [{ name: 'Publish baseline', status: 'completed', conclusion: 'success' }],
      }] };
    }
    if (url.pathname === '/contents/.github/workflows/publish-baseline.yml') {
      assert.equal(url.searchParams.get('ref'), evidenceRun.head_sha);
      return { encoding: 'base64', content: Buffer.from(options.workflow || legacyWorkflow(LIVE)).toString('base64') };
    }
    if (url.pathname === '/deployments' && method === 'POST') {
      const record = deployment(43, body.ref, { ...body, id: 43 });
      records.push(record);
      statuses.set(43, []);
      return record;
    }
    const match = url.pathname.match(/^\/deployments\/(\d+)\/statuses$/);
    assert.ok(match, `unexpected initialization API path: ${path}`);
    const id = Number(match[1]);
    assert.ok(statuses.has(id));
    if (method === 'GET') return [...statuses.get(id)];
    assert.equal(method, 'POST');
    const status = { ...body, id: 431 };
    statuses.get(id).push(status);
    return status;
  };
  return { api, calls, records, statuses };
}

const initialize = (api, overrides = {}) => initializeConfirmedProduction({
  api, confirmedSha: LIVE, evidenceRunId: EVIDENCE_RUN, ...overrides,
});

test('initialization defaults to a read-only dry run', async () => {
  const state = initializationApi();
  const result = await initialize(state.api);
  assert.equal(result.initialized, false);
  assert.equal(result.confirmedSha, LIVE);
  assert.equal(result.evidenceRunId, EVIDENCE_RUN);
  assert.ok(state.calls.every(({ method }) => method === 'GET'));
  assert.equal(state.records.length, 0);
});

test('initialization requires explicit confirmation of a full SHA and the current successful main run', async () => {
  for (const options of [
    { noRun: true },
    { run: { id: EVIDENCE_RUN + 1 } },
    { run: { status: 'in_progress', conclusion: null } },
    { run: { conclusion: 'failure' } },
    { run: { head_branch: 'release/old' } },
    { run: { head_sha: CONTROLLER_SHA.slice(0, 7) } },
    { workflow: legacyWorkflow(NEXT) },
    { workflow: guardedWorkflow(LIVE) + guardedWorkflow(NEXT) },
  ]) {
    const state = initializationApi(options);
    await assert.rejects(initialize(state.api, { write: true }));
    assert.ok(state.calls.every(({ method }) => method === 'GET'));
  }
  const state = initializationApi();
  await assert.rejects(initialize(state.api, { confirmedSha: LIVE.slice(0, 7), write: true }));
  await assert.rejects(initialize(state.api, { evidenceRunId: 'not-a-run', write: true }));
  assert.equal(state.calls.length, 0);
});

test('initialization cannot overwrite any existing production record', async () => {
  const state = initializationApi({ existing: true });
  await assert.rejects(initialize(state.api, { write: true }));
  assert.equal(state.calls.length, 1);
  assert.equal(state.calls[0].method, 'GET');
  assert.equal(state.records.length, 1);
});

test('explicit initialization records the exact already-published SHA without invoking publication', async () => {
  const state = initializationApi();
  const result = await initialize(state.api, { write: true });
  assert.equal(result.initialized, true);
  assert.equal(result.deploymentId, 43);
  const writes = state.calls.filter(({ method }) => method === 'POST');
  assert.equal(writes.length, 2);
  assert.equal(writes[0].path, '/deployments');
  assert.equal(writes[0].body.ref, LIVE);
  assert.equal(writes[0].body.environment, 'wix-production');
  assert.equal(writes[0].body.task, 'wix-publish');
  assert.equal(writes[0].body.auto_merge, false);
  assert.equal(writes[0].body.production_environment, true);
  assert.equal(writes[0].body.payload.source, 'confirmed-existing-publication');
  assert.equal(writes[0].body.payload.controllerSha, CONTROLLER_SHA);
  assert.equal(writes[1].path, '/deployments/43/statuses');
  assert.equal(writes[1].body.state, 'success');
  assert.equal(writes[1].body.auto_inactive, false);
  assert.equal((await readLiveDeployment(state.api)).lastLiveSha, LIVE);
});

test('initialization API failures never create a falsely successful marker', async () => {
  for (const fail of [
    ({ method }) => method === 'GET',
    ({ method, path }) => method === 'POST' && path === '/deployments',
    ({ method, path }) => method === 'POST' && path.endsWith('/statuses'),
  ]) {
    const state = initializationApi({ fail });
    await assert.rejects(initialize(state.api, { write: true }), /Initialization API unavailable/);
    assert.ok(!state.statuses.get(43)?.some((status) => status.state === 'success'));
    if (state.records.length) await assert.rejects(readLiveDeployment(state.api));
  }
});

test('a successful workflow with a skipped publication job is not deployment evidence', async () => {
  for (const job of [
    { id: 7, name: 'publish', status: 'completed', conclusion: 'skipped', steps: [] },
    { id: 7, name: 'publish', status: 'completed', conclusion: 'success', steps: [] },
    { id: 7, name: 'publish', status: 'completed', conclusion: 'success', steps: [
      { name: 'Publish baseline', status: 'completed', conclusion: 'skipped' },
    ] },
    { id: 7, name: 'publish', status: 'completed', conclusion: 'success', steps: [
      { name: 'Set up Node', status: 'completed', conclusion: 'success' },
    ] },
  ]) {
    const state = initializationApi({ jobs: [job] });
    await assert.rejects(initialize(state.api, { write: true }));
    assert.ok(state.calls.every(({ method }) => method === 'GET'));
  }
});

test('publication starting or changing during initialization prevents every POST', async () => {
  for (const raceRun of [
    { id: EVIDENCE_RUN + 1 },
    { status: 'in_progress' },
    { conclusion: 'failure' },
    { run_attempt: 2 },
    { updated_at: '2026-11-05T10:40:13Z' },
  ]) {
    const state = initializationApi({ raceRun });
    await assert.rejects(initialize(state.api, { write: true }));
    assert.equal(state.calls.filter(({ path }) => path.startsWith('/actions/workflows/')).length, 2);
    assert.ok(state.calls.every(({ method }) => method === 'GET'));
    assert.equal(state.records.length, 0);
  }
});
