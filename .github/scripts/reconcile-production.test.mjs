import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { INCIDENT, EVIDENCE_PATH, reconcileProduction, validateEvidence, writeConfirmation } from './reconcile-production.mjs';
import { readLiveDeployment, publicationRequested } from './production-release.mjs';

const NOW = Date.parse('2026-11-11T10:00:00Z');
const hash = value => createHash('sha256').update(value).digest('hex');
const copy = value => JSON.parse(JSON.stringify(value));
const CANONICAL = 'refs/remotes/origin/headless/astro-poc-baseline';
function fixture(t) {
  const gitDir = mkdtempSync(join(tmpdir(), 'noam-reconcile-'));
  t.after(() => rmSync(gitDir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', gitDir, '-c', 'user.name=Reconciliation test',
    '-c', 'user.email=reconcile@example.invalid', '-c', 'commit.gpgsign=false', ...args],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q', '--initial-branch=main');
  const index = { version: 1, docs: [{ key: 'existing', href: '/existing-grade-8' }] };
  mkdirSync(join(gitDir, 'headless/astro-poc/src/data'), { recursive: true });
  writeFileSync(join(gitDir, 'headless/astro-poc/src/data/search-index.v1.json'), JSON.stringify(index) + '\n');
  git('add', '.'); git('commit', '-qm', 'confirmed previous live'); const live = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-qm', 'failed candidate'); const candidate = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-qm', 'canonical head'); const head = git('rev-parse', 'HEAD');
  git('update-ref', CANONICAL, head);
  const incident = { ...INCIDENT, failedSha: candidate, previousLiveSha: live };
  const failed = { id: incident.failedDeploymentId, sha: candidate, task: 'wix-publish', environment: 'wix-production',
    payload: { releaseGuardVersion: 1, runId: String(incident.failedRunId), controllerSha: incident.failedControllerSha, previousLiveSha: live } };
  const previous = { id: incident.previousDeploymentId, sha: live, task: 'wix-publish', environment: 'wix-production', payload: { releaseGuardVersion: 1 } };
  const failedRun = { id: incident.failedRunId, status: 'completed', conclusion: 'cancelled', run_attempt: 1,
    head_branch: 'main', head_sha: incident.failedControllerSha, path: '.github/workflows/publish-baseline.yml', updated_at: '2026-11-11T09:48:04Z' };
  const jobs = [{ id: incident.failedJobId, name: 'publish', status: 'completed', conclusion: 'cancelled',
    steps: [{ name: 'Publish the approved baseline', status: 'completed', conclusion: 'cancelled' }] }];
  const state = { records: [failed, previous], statuses: new Map([
    [failed.id, [{ id: incident.failedStatusId, state: 'error' }]], [previous.id, [{ id: 123, state: 'success' }]],
  ]), failedRun, jobs, runs: [copy(failedRun)], calls: [], indexRequests: [], reads: 0, onRead: null, onWrite: null };
  const api = async (url, { method = 'GET', body } = {}) => {
    state.calls.push({ url, method, body: copy(body ?? null) });
    if (method === 'GET') await state.onRead?.(url);
    else await state.onWrite?.(url, body);
    const parsed = new URL(url, 'https://api.github.com');
    const paginated = rows => rows.slice((Number(parsed.searchParams.get('page') || 1) - 1) * 100, Number(parsed.searchParams.get('page') || 1) * 100);
    if (parsed.pathname === '/deployments') {
      if (method === 'GET') { state.reads++; return copy(paginated(state.records)); }
      assert.equal(method, 'POST');
      const record = { ...copy(body), id: incident.failedDeploymentId + 1, sha: body.ref };
      state.records.push(record); state.statuses.set(record.id, []);
      return copy(record);
    }
    const status = parsed.pathname.match(/^\/deployments\/(\d+)\/statuses$/);
    if (status) {
      const rows = state.statuses.get(Number(status[1])); assert.ok(rows);
      if (method === 'GET') return copy(paginated(rows));
      assert.equal(method, 'POST'); const added = { ...body, id: incident.failedStatusId + 1 }; rows.push(added); return copy(added);
    }
    assert.equal(method, 'GET', 'only deployment creation/status may write');
    if (parsed.pathname === `/actions/runs/${incident.failedRunId}`) return copy(state.failedRun);
    if (parsed.pathname === `/actions/runs/${incident.failedRunId}/jobs`) return { jobs: copy(paginated(state.jobs)) };
    if (parsed.pathname === '/actions/workflows/publish-baseline.yml/runs') return { workflow_runs: copy(paginated(state.runs)) };
    assert.fail(`Unexpected API call: ${method} ${url}`);
  };
  const evidence = { schemaVersion: 1, failedDeploymentId: incident.failedDeploymentId, failedRunId: incident.failedRunId,
    failedSha: candidate, previousDeploymentId: incident.previousDeploymentId, confirmedLiveSha: live,
    observedAt: '2026-11-11T09:55:00Z', prePromotionFailureVerified: true, fullSourceShaProven: false,
    observationConclusion: 'consistent-with-previous-confirmed-live',
    evidenceSummary: 'HTTP 413 at completion plus audited promotion ordering and matching public fingerprints support the previous confirmed live release; complete source SHA is not proven.',
    evidenceUrl: 'https://github.com/noamd-collab/noam-agent-hub/issues/1#issuecomment-1',
    publicIndexSha256: hash(JSON.stringify(index)) };
  const rawEvidence = JSON.stringify(evidence);
  const fetchImpl = async (url, options) => {
    state.indexRequests.push({ url, method: options.method, redirect: options.redirect });
    assert.equal(url, 'https://www.noamdoronmath.co.il/search-index.v1.json'); assert.equal(options.method, 'GET'); assert.equal(options.redirect, 'error');
    return new Response(JSON.stringify(index) + '\n', { status: 200, headers: { 'content-type': 'application/json; charset=utf-8' } });
  };
  const context = { api, gitDir, rawEvidence, evidenceSha256: hash(rawEvidence), confirmedLiveSha: live,
    failedDeploymentId: incident.failedDeploymentId, failedRunId: incident.failedRunId, controllerSha: head,
    runId: '987654321', incident, fetchImpl, now: NOW };
  const run = changes => reconcileProduction({ ...context, ...changes });
  const approved = async () => {
    const dry = await run(); state.calls.length = 0; state.indexRequests.length = 0; state.reads = 0;
    return { write: true, confirmation: writeConfirmation(incident), approvedPlanSha256: dry.planSha256 };
  };
  return { state, context, incident, evidence, git, index, run, approved };
}
const noWrites = state => assert.ok(state.calls.every(call => call.method === 'GET'));

test('incident policy is pinned to the actual failed deployment/run/status and previous live record', () => {
  assert.equal(INCIDENT.failedDeploymentId, 7706338816); assert.equal(INCIDENT.failedRunId, 42994193052);
  assert.equal(INCIDENT.failedStatusId, 21934891324); assert.equal(INCIDENT.previousDeploymentId, 7669709987);
  assert.notEqual(INCIDENT.failedSha, INCIDENT.previousLiveSha); assert.ok(Object.isFrozen(INCIDENT));
});

test('dry-run inspects Git, terminal history and public evidence without mutation', async t => {
  const f = fixture(t); const result = await f.run();
  assert.equal(result.reconciled, false); assert.match(result.planSha256, /^[0-9a-f]{64}$/);
  assert.equal(result.plan.confirmedLiveSha, f.incident.previousLiveSha); assert.equal(result.plan.evidencePath, EVIDENCE_PATH);
  assert.equal(f.state.indexRequests.length, 1); noWrites(f.state); assert.equal(f.state.records.length, 2);
  await assert.rejects(readLiveDeployment(f.context.api), /uncertain/);
});

test('explicit approved write appends confirmed existing live provenance and preserves failed history', async t => {
  const f = fixture(t), approved = await f.approved(), oldRecords = copy(f.state.records), oldError = copy(f.state.statuses.get(f.incident.failedDeploymentId));
  const result = await f.run(approved); assert.equal(result.reconciled, true);
  const writes = f.state.calls.filter(call => call.method !== 'GET'); assert.equal(writes.length, 2);
  assert.equal(writes[0].url, '/deployments'); assert.equal(writes[0].body.ref, f.incident.previousLiveSha);
  assert.equal(writes[0].body.auto_merge, false); assert.equal(writes[0].body.payload.source, 'reconciled-failed-before-promotion');
  assert.equal(writes[0].body.payload.evidenceSha256, f.context.evidenceSha256); assert.equal(writes[0].body.payload.planSha256, approved.approvedPlanSha256);
  assert.equal(writes[1].body.state, 'success'); assert.equal(writes[1].body.auto_inactive, false);
  assert.deepEqual(f.state.records.slice(0, 2), oldRecords); assert.deepEqual(f.state.statuses.get(f.incident.failedDeploymentId), oldError);
  assert.equal(f.state.indexRequests.length, 2); assert.equal((await readLiveDeployment(f.context.api)).lastLiveSha, f.incident.previousLiveSha);
});

test('wrong IDs, SHA, confirmation or missing reviewed plan never write', async t => {
  const f = fixture(t); const valid = await f.approved();
  for (const changes of [
    { failedDeploymentId: 1 }, { failedRunId: 1 }, { confirmedLiveSha: f.incident.failedSha },
    { confirmation: '' }, { approvedPlanSha256: undefined }, { approvedPlanSha256: '0'.repeat(64) },
    { controllerSha: 'short' }, { runId: '' }, { write: 'true' },
  ]) { f.state.calls.length = 0; await assert.rejects(f.run({ ...valid, ...changes })); noWrites(f.state); }
});

test('evidence digest, incident, freshness and verified failure-phase evidence are mandatory', t => {
  const f = fixture(t);
  for (const change of [
    { schemaVersion: 2 }, { failedDeploymentId: 1 }, { failedRunId: 1 }, { failedSha: f.incident.previousLiveSha },
    { previousDeploymentId: 1 }, { confirmedLiveSha: f.incident.failedSha }, { observedAt: 'invalid' },
    { observedAt: '2026-11-09T09:00:00Z' }, { observedAt: '2026-11-12T09:00:00Z' },
    { prePromotionFailureVerified: false }, { fullSourceShaProven: true }, { observationConclusion: 'full-proof' }, { evidenceSummary: 'unknown' }, { publicIndexSha256: '' },
    { evidenceUrl: 'http://github.com/example' }, { evidenceUrl: 'https://user:pass@github.com/example' },
    { evidenceUrl: 'https://github.com/example?token=secret' }, { evidenceUrl: 'https://unknown.example/evidence' },
  ]) {
    const rawEvidence = JSON.stringify({ ...f.evidence, ...change });
    assert.throws(() => validateEvidence({ ...f.context, rawEvidence, evidenceSha256: hash(rawEvidence) }));
  }
  assert.throws(() => validateEvidence({ ...f.context, evidenceSha256: '0'.repeat(64) }));
});

test('real Git ancestry rejects divergent, absent and unmerged candidates', async t => {
  const f = fixture(t);
  f.git('checkout', '-q', '--orphan', 'divergent'); f.git('commit', '--allow-empty', '-qm', 'unrelated');
  const other = f.git('rev-parse', 'HEAD');
  for (const incident of [{ ...f.incident, failedSha: other }, { ...f.incident, failedSha: '1'.repeat(40) }]) {
    const rawEvidence = JSON.stringify({ ...f.evidence, failedSha: incident.failedSha });
    await assert.rejects(f.run({ incident, rawEvidence, evidenceSha256: hash(rawEvidence) })); noWrites(f.state);
  }
  f.git('update-ref', CANONICAL, f.incident.previousLiveSha);
  await assert.rejects(f.run(), /outside the canonical branch/); noWrites(f.state);
});

test('Git/public index mismatch or unavailable public evidence cannot create a marker', async t => {
  const f = fixture(t);
  const rawEvidence = JSON.stringify({ ...f.evidence, publicIndexSha256: '0'.repeat(64) });
  await assert.rejects(f.run({ rawEvidence, evidenceSha256: hash(rawEvidence) }), /differs from the confirmed Git commit/);
  for (const response of [
    new Response('{}', { status: 503 }), new Response('{}', { status: 200 }),
    new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } }),
    new Response('invalid', { status: 200, headers: { 'content-type': 'application/json' } }),
  ]) await assert.rejects(f.run({ fetchImpl: async () => response }));
  await assert.rejects(f.run({ fetchImpl: async () => { throw new Error('offline'); } })); noWrites(f.state);
});

test('active publishers, changed attempts and successful or unfinished failures are rejected', async t => {
  const f = fixture(t), initial = copy(f.state.failedRun);
  for (const change of [
    { status: 'in_progress' }, { conclusion: 'success' }, { run_attempt: 2 }, { head_branch: 'other' },
    { head_sha: f.context.controllerSha }, { path: '.github/workflows/other.yml' },
  ]) { Object.assign(f.state.failedRun, initial, change); await assert.rejects(f.run()); noWrites(f.state); }
  Object.assign(f.state.failedRun, initial);
  for (const status of ['in_progress', 'queued', 'waiting', 'pending', 'requested']) {
    f.state.runs.push({ id: 99999999999, status }); await assert.rejects(f.run(), /active or queued/); f.state.runs.pop(); noWrites(f.state);
  }
  f.state.jobs[0].steps[0].conclusion = 'success'; await assert.rejects(f.run(), /conclusively failed/); noWrites(f.state);
});

test('newer records, modified failed status and unconfirmed previous production reject reconciliation', async t => {
  const f = fixture(t), initial = copy(f.state.records);
  f.state.records.push({ ...copy(initial[0]), id: INCIDENT.failedDeploymentId + 2 });
  await assert.rejects(f.run(), /Newest production record/); f.state.records = copy(initial);
  const failedStatuses = f.state.statuses.get(INCIDENT.failedDeploymentId);
  failedStatuses.push({ id: INCIDENT.failedStatusId + 1, state: 'error' });
  await assert.rejects(f.run(), /Exact terminal error/); failedStatuses.pop();
  failedStatuses[0].state = 'in_progress'; await assert.rejects(f.run(), /Exact terminal error/); failedStatuses[0].state = 'error';
  f.state.statuses.get(INCIDENT.previousDeploymentId)[0].state = 'inactive';
  await assert.rejects(f.run(), /not confirmed successful/); noWrites(f.state);
});

test('a newer record hidden on a later API page still blocks reconciliation', async t => {
  const f = fixture(t);
  for (let id = 1; id < 100; id++) f.state.records.push({ id });
  f.state.records.push({ ...copy(f.state.records[0]), id: INCIDENT.failedDeploymentId + 2 });
  await assert.rejects(f.run(), /Newest production record/); noWrites(f.state);
  assert.ok(f.state.calls.some(call => call.url.includes('page=2')));
});

test('state changing between initial inspection and first write fails closed', async t => {
  const f = fixture(t), approved = await f.approved();
  f.state.onRead = url => { if (url.startsWith('/deployments?') && f.state.reads === 1) f.state.records[0].updated_at = 'changed'; };
  await assert.rejects(f.run(approved), /changed during reconciliation/); noWrites(f.state);
});

test('a newly queued publisher during final inspection blocks all writes', async t => {
  const f = fixture(t), approved = await f.approved();
  f.state.onRead = url => { if (url.startsWith('/deployments?') && f.state.reads === 1) f.state.runs.push({ id: 99999999999, status: 'queued' }); };
  await assert.rejects(f.run(approved), /active or queued/); noWrites(f.state);
});

test('a changed live fingerprint between inspections blocks all writes', async t => {
  const f = fixture(t), approved = await f.approved(); let reads = 0;
  const fetchImpl = async (...args) => ++reads === 1 ? f.context.fetchImpl(...args) : new Response('{}', { headers: { 'content-type': 'application/json' } });
  await assert.rejects(f.run({ ...approved, fetchImpl }), /no longer matches/); noWrites(f.state);
});

test('API inspection failures do not fall back to convenient previous state', async t => {
  const f = fixture(t);
  for (const target of ['/deployments?', `/deployments/${INCIDENT.failedDeploymentId}/statuses`, `/actions/runs/${INCIDENT.failedRunId}`, '/actions/workflows/']) {
    f.state.onRead = url => { if (url.startsWith(target)) throw new Error('API unavailable'); };
    await assert.rejects(f.run(), /API unavailable/); noWrites(f.state);
  }
});

test('creation or success-status failure leaves no falsely authorized retry', async t => {
  const f = fixture(t), approved = await f.approved();
  f.state.onWrite = url => { if (url === '/deployments') throw new Error('create unavailable'); };
  await assert.rejects(f.run(approved), /create unavailable/); assert.equal(f.state.records.length, 2);
  f.state.onWrite = url => { if (url.endsWith('/statuses')) throw new Error('status unavailable'); };
  await assert.rejects(f.run(approved), /status unavailable/); assert.equal(f.state.records.length, 3);
  await assert.rejects(readLiveDeployment(f.context.api), /no reliable status/);
  const writes = f.state.calls.filter(call => call.method === 'POST').length;
  await assert.rejects(f.run(approved), /Newest production record/);
  assert.equal(f.state.calls.filter(call => call.method === 'POST').length, writes);
});

test('a record superseding creation prevents marking the reconciliation successful', async t => {
  const f = fixture(t), approved = await f.approved();
  f.state.onRead = url => { if (url.startsWith('/deployments?') && f.state.records.length === 3) f.state.records.push({ ...copy(f.state.records[0]), id: INCIDENT.failedDeploymentId + 3 }); };
  await assert.rejects(f.run(approved), /superseded/);
  assert.ok(!f.state.calls.some(call => call.body?.state === 'success'));
});

test('completed reconciliation is not replayable using the old incident plan', async t => {
  const f = fixture(t), approved = await f.approved(); await f.run(approved);
  const count = f.state.calls.filter(call => call.method === 'POST').length;
  await assert.rejects(f.run(approved), /Newest production record/);
  assert.equal(f.state.calls.filter(call => call.method === 'POST').length, count);
});

test('workflow defaults to locked dry-run and bounds publication without changing the approved pin', () => {
  const recovery = readFileSync(new URL('../workflows/reconcile-production.yml', import.meta.url), 'utf8');
  const publish = readFileSync(new URL('../workflows/publish-baseline.yml', import.meta.url), 'utf8');
  assert.match(recovery, /workflow_dispatch:/); assert.doesNotMatch(recovery, /^\s*(push|schedule):/m);
  assert.match(recovery, /default: dry-run/); assert.match(recovery, /group: wix-production\s+cancel-in-progress: false/);
  assert.match(recovery, /github.ref == 'refs\/heads\/main'/); assert.match(recovery, /persist-credentials: false/);
  assert.doesNotMatch(recovery, /run:.*(?:wix release|release\.sh|initialize)/);
  assert.match(publish, /id: release\s+#.*\s+timeout-minutes: 25/);
  assert.match(publish, /timeout-minutes: 90/); assert.match(publish, /if: always\(\) && steps.guard.outputs.deployment_id/);
  assert.equal(publicationRequested({ eventName: 'push', ref: 'refs/heads/main', beforeWorkflow: publish, approvedSha: INCIDENT.failedSha }), false);
});

test('CLI refuses execution outside a manual main workflow before touching APIs', () => {
  const script = new URL('./reconcile-production.mjs', import.meta.url);
  const result = spawnSync(process.execPath, [script.pathname], { env: { PATH: process.env.PATH }, encoding: 'utf8' });
  assert.equal(result.status, 1); assert.match(result.stderr, /only from the reviewed main workflow/);
});
