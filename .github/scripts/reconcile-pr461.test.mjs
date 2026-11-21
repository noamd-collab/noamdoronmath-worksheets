import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { EVIDENCE, EVIDENCE_SHA256, TARGET, LIVE, OLD, REPOSITORY, STEP,
  reconcilePr461, executionContext, assertAncestry } from './reconcile-pr461.mjs';
import { readLiveDeployment, assertReleaseHistory, readApprovedSha } from './production-release.mjs';

const copy = value => structuredClone(value);
const CONTROLLER = 'ab'.repeat(20), RUN = '50000000000';
const OLD_CONTROLLER = '7e3884472144aa10509f9886fca425ee96eafd0c';
const INCIDENT_WORKFLOW = new URL('./fixtures/publish-baseline-feb8029.yml', import.meta.url);
const INCIDENT_WORKFLOW_SHA256 = 'e6fdfcfd2bdc3434a68e25ac255870bcbd9a62eceb20029c840e6bff81d9ed76';
const url = run => `https://github.com/${REPOSITORY}/actions/runs/${run}`;
function fixture() {
  const old = copy(EVIDENCE.expectedDeployment);
  const context = { approvedSha: TARGET, controllerSha: CONTROLLER, runId: RUN, runAttempt: 1, eventName: 'push', gitDir: '/mock/site' };
  const state = { records: [old], statuses: new Map([[old.id, copy(EVIDENCE.expectedStatuses)]]), calls: [], reads: 0,
    beforeGet: null, beforePost: null, afterPost: null, histories: [], runs: new Map(), jobs: new Map(), otherPublishers: [], reconcilerRuns: [], contents: new Map() };
  const addRun = (runId, status = 'in_progress') => {
    state.runs.set(runId, { id: Number(runId), head_sha: CONTROLLER, head_branch: 'main', path: '.github/workflows/publish-baseline.yml',
      repository: { full_name: REPOSITORY }, event: 'push', status, conclusion: status === 'completed' ? 'success' : null, run_attempt: 1 });
    state.jobs.set(runId, [{ id: Number(runId) + 1, name: 'publish', status, run_attempt: 1, steps: [] }]);
  };
  addRun(RUN);
  state.contents.set(`.github/workflows/publish-baseline.yml@${CONTROLLER}`, readFileSync(INCIDENT_WORKFLOW));
  const queued = ({ workflow = 'publish-baseline.yml', controller = OLD_CONTROLLER, jobStatus = 'queued', runStatus = 'in_progress' } = {}) => {
    const runId = '70000000000', publish = workflow === 'publish-baseline.yml';
    const run = { id: Number(runId), head_sha: controller, head_branch: 'main', path: `.github/workflows/${workflow}`,
      repository: { full_name: REPOSITORY }, event: publish ? 'push' : 'workflow_dispatch', status: runStatus, conclusion: null, run_attempt: 2 };
    state.runs.set(runId, run);
    state.jobs.set(runId, [{ id: Number(runId) + 1, name: publish ? 'publish' : 'reconcile', status: jobStatus, run_attempt: 2, run_id: Number(runId), steps: [] }]);
    const source = readFileSync(publish
      ? (controller === OLD_CONTROLLER ? new URL('./fixtures/publish-baseline-7e388.yml', import.meta.url) : INCIDENT_WORKFLOW)
      : new URL(`../workflows/${workflow}`, import.meta.url));
    state.contents.set(`${run.path}@${controller}`, source);
    return { run, job: state.jobs.get(runId)[0], sourceKey: `${run.path}@${controller}` };
  };
  const finishRun = () => {
    state.runs.get(context.runId).status = 'completed'; state.runs.get(context.runId).conclusion = 'success';
    state.jobs.get(context.runId)[0].status = 'completed';
    state.jobs.get(context.runId)[0].steps = [STEP, 'Publish the approved baseline'].map(name => ({ name, status: 'completed', conclusion: 'success' }));
    context.runId = String(Number(context.runId) + 100); addRun(context.runId);
  };
  const api = async (path, { method = 'GET', body } = {}) => {
    state.calls.push({ path, method, body: copy(body) });
    if (method === 'GET') await state.beforeGet?.(path); else await state.beforePost?.(path, body);
    const p = new URL(path, 'https://api.github.invalid'), page = Number(p.searchParams.get('page') || 1);
    const paged = rows => copy(rows.slice((page - 1) * 100, page * 100));
    let result;
    if (p.pathname === '/deployments') {
      if (method === 'GET') { state.reads++; return paged([...state.records].sort((a, b) => b.id - a.id)); }
      assert.equal(method, 'POST');
      result = { ...copy(body), id: Math.max(...state.records.map(r => r.id)) + 1, sha: body.ref, original_environment: body.environment,
        creator: { login: 'github-actions[bot]', id: 41898282, type: 'Bot' }, created_at: '2026-11-14T20:00:00Z', updated_at: '2026-11-14T20:00:00Z' };
      state.records.push(result); state.statuses.set(result.id, []);
    } else if (/^\/deployments\/\d+\/statuses$/.test(p.pathname)) {
      const deploymentId = Number(p.pathname.split('/')[2]), rows = state.statuses.get(deploymentId); assert.ok(rows);
      if (method === 'GET') return paged([...rows].sort((a, b) => b.id - a.id));
      assert.equal(method, 'POST');
      result = { ...copy(body), id: 22157544034, environment: 'wix-production' }; rows.unshift(result);
    } else {
      assert.equal(method, 'GET', 'No unexpected write endpoint');
      if (p.pathname.startsWith('/contents/')) {
        const relative = p.pathname.slice('/contents/'.length), key = `${relative}@${p.searchParams.get('ref')}`;
        const bytes = state.contents.get(key) || readFileSync(new URL(`../../${relative}`, import.meta.url));
        return { encoding: 'base64', content: Buffer.from(bytes).toString('base64') };
      }
      const runMatch = p.pathname.match(/^\/actions\/runs\/(\d+)(\/jobs)?$/);
      if (runMatch) return runMatch[2] ? { jobs: paged(state.jobs.get(runMatch[1]) || []) } : copy(state.runs.get(runMatch[1]));
      if (p.pathname === '/actions/workflows/publish-baseline.yml/runs') return { workflow_runs: paged([...state.runs.values()].filter(r => r.path === '.github/workflows/publish-baseline.yml').concat(state.otherPublishers)) };
      if (p.pathname === '/actions/workflows/reconcile-production.yml/runs') return { workflow_runs: paged([...state.runs.values()].filter(r => r.path === '.github/workflows/reconcile-production.yml').concat(state.reconcilerRuns)) };
      assert.fail(`Unexpected API path ${path}`);
    }
    await state.afterPost?.(path, body, result);
    return copy(result);
  };
  const run = (changes = {}) => reconcilePr461({ api, context, verifyHistory: dir => { state.histories.push(dir); }, ...changes });
  const writes = () => state.calls.filter(c => c.method !== 'GET');
  const addRelease = (previousSha = LIVE) => {
    const record = { ...copy(state.records.at(-1)), id: state.records.at(-1).id + 1, ref: TARGET, sha: TARGET,
      payload: { releaseGuardVersion: 1, runId: context.runId, controllerSha: CONTROLLER, previousLiveSha: previousSha },
      description: 'Approved site release; unfinished state blocks subsequent publication' };
    state.records.push(record); state.statuses.set(record.id, [{ id: 22157544035, state: 'success', environment: 'wix-production', log_url: url(context.runId), environment_url: 'https://www.noamdoronmath.co.il/' }]);
    finishRun(); return record;
  };
  return { state, context, run, writes, finishRun, addRelease, queued, api };
}

test('pins the exact incident, both old statuses and truthful proof provenance', () => {
  assert.equal(TARGET, '12e6995241cad679260fee8ad34e3fcf76224745');
  assert.equal(EVIDENCE.expectedDeployment.id, 7776754145); assert.equal(EVIDENCE.expectedDeployment.sha, OLD);
  assert.equal(EVIDENCE.expectedStatuses[0].id, 22157544033); assert.equal(EVIDENCE.expectedStatuses[0].state, 'success');
  assert.equal(EVIDENCE.confirmedLiveSha, LIVE); assert.equal(EVIDENCE.approvedTargetSha, TARGET);
  assert.equal(EVIDENCE.originalPublicationRunId, null);
  assert.equal(EVIDENCE.proofSha256.apiPreimage, 'ffc9fe1cb6b17f679f10c690dd0e0d414683a65ca6b220a262cdf9d8a9eadd54');
  assert.equal(EVIDENCE_SHA256, createHash('sha256').update(readFileSync(new URL('../release-evidence/pr461-local-publication.json', import.meta.url))).digest('hex'));
  assert.doesNotMatch(JSON.stringify(EVIDENCE), /\/Users\/|hint[123]|\.codex/);
});
test('dry-run validates exact old state, publisher and ancestry without writes', async () => {
  const f = fixture(); assert.deepEqual(await f.run(), { action: 'would-reconcile', state: 'old', wrote: false });
  assert.deepEqual(f.state.histories, ['/mock/site']); assert.equal(f.writes().length, 0);
});
test('happy path writes exactly one cfe metadata record and success; leaves old history untouched', async () => {
  const f = fixture(), old = copy(f.state.records[0]), statuses = copy(f.state.statuses.get(old.id));
  const result = await f.run({ write: true });
  assert.equal(result.confirmedLiveSha, LIVE); assert.equal(result.wrote, true); assert.equal(f.writes().length, 2);
  assert.deepEqual(f.state.records[0], old); assert.deepEqual(f.state.statuses.get(old.id), statuses);
  const [create, complete] = f.writes(); assert.equal(create.path, '/deployments'); assert.equal(create.body.ref, LIVE);
  assert.equal(create.body.auto_merge, false); assert.deepEqual(create.body.required_contexts, []);
  assert.equal(create.body.payload.runId, undefined); assert.equal(create.body.payload.originalPublicationRunId, null);
  assert.equal(create.body.payload.reconciliationRunId, RUN); assert.equal(create.body.payload.republicationPerformed, false);
  assert.equal(complete.body.auto_inactive, false); assert.equal(complete.body.log_url, url(RUN));
});
test('an old publisher queued behind the same lock permits cfe reconciliation; its unchanged guard then rejects rollback', async t => {
  const f = fixture(), q = f.queued();
  assert.equal(createHash('sha256').update(f.state.contents.get(q.sourceKey)).digest('hex'), 'da7689feaa7915c65e9979a8703250113ea3a5668be7b9c5508e7c153f5dbed9');
  await f.run({ write: true }); assert.equal(f.writes().length, 2); assert.equal(q.job.status, 'queued');
  const { lastLiveSha } = await readLiveDeployment(f.api); assert.equal(lastLiveSha, LIVE);
  // Exercise the actual unchanged rollback guard on the equivalent two-commit
  // ancestry. Git cannot manufacture the production SHA objects in a CI fixture.
  const dir = mkdtempSync(join(tmpdir(), 'pr461-queued-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); git('commit', '--allow-empty', '-qm', 'old live'); const oldCommit = git('rev-parse', 'HEAD');
  git('commit', '--allow-empty', '-qm', 'PR461 live'); const liveCommit = git('rev-parse', 'HEAD');
  const fixtureSha = { [OLD]: oldCommit, [LIVE]: liveCommit };
  assert.throws(() => assertReleaseHistory({ gitDir: dir, approvedSha: fixtureSha[OLD], lastLiveSha: fixtureSha[lastLiveSha], branchRef: 'HEAD' }), /Rollback blocked/);
});
for (const options of [
  { controller: CONTROLLER, jobStatus: 'waiting', runStatus: 'waiting' },
  { workflow: 'reconcile-production.yml', jobStatus: 'queued', runStatus: 'queued' },
]) test(`allows the exact known ${options.workflow || 'current publisher'} waiting contract`, async () => {
  const f = fixture(); f.queued(options); await f.run({ write: true }); assert.equal(f.writes().length, 2);
});
for (const status of ['queued', 'waiting', 'pending']) test(`allows a verified old workflow ${status} before jobs exist; records cfe first`, async () => {
  const f = fixture(), q = f.queued({ runStatus: status }); f.state.jobs.set(String(q.run.id), []);
  await f.run({ write: true }); assert.equal(f.writes().length, 2);
  assert.equal((await readLiveDeployment(f.api)).lastLiveSha, LIVE);
});
test('allows the verified old read-only intent job before the publish job exists', async () => {
  const f = fixture(), q = f.queued(); q.job.name = 'release-request'; q.job.status = 'in_progress';
  q.job.steps = [{ name: 'Check whether an approved publication was requested', status: 'in_progress' }];
  await f.run({ write: true }); assert.equal(f.writes().length, 2);
  assert.equal((await readLiveDeployment(f.api)).lastLiveSha, LIVE);
});
test('a read-only intent job with the wrong attempt still blocks before writes', async () => {
  const f = fixture(), q = f.queued(); q.job.name = 'release-request'; q.job.status = 'in_progress'; q.job.run_attempt++;
  await assert.rejects(f.run({ write: true }), /exact current attempt/); assert.equal(f.writes().length, 0);
});
for (const [label, mutate] of [
  ['active writer', (f, q) => { q.job.status = 'in_progress'; }],
  ['wrong job attempt', (f, q) => { q.job.run_attempt = 1; }],
  ['wrong job run', (f, q) => { q.job.run_id++; }],
  ['unknown writer job', (f, q) => { q.job.name = 'other-writer'; }],
  ['missing waiting job', (f, q) => { f.state.jobs.set(String(q.run.id), []); }],
  ['already executed writer step', (f, q) => { q.job.steps.push({ status: 'completed' }); }],
  ['unprotected workflow', (f, q) => { f.state.contents.set(q.sourceKey, Buffer.from(f.state.contents.get(q.sourceKey).toString().replace('group: wix-production', 'group: unrelated'))); }],
  ['cancelling concurrency', (f, q) => { f.state.contents.set(q.sourceKey, Buffer.from(f.state.contents.get(q.sourceKey).toString().replace('cancel-in-progress: false', 'cancel-in-progress: true'))); }],
  ['modified rollback guard', (f, q) => { f.state.contents.set(`.github/scripts/production-release.mjs@${q.run.head_sha}`, Buffer.from('export const unchecked = true;')); }],
]) test(`queued-run verification rejects ${label} before writes`, async () => {
  const f = fixture(), q = f.queued(); mutate(f, q);
  await assert.rejects(f.run({ write: true })); assert.equal(f.writes().length, 0);
});
test('a queued publisher attempt changing during inspection blocks all writes', async () => {
  const f = fixture(), q = f.queued(); let reads = 0;
  f.state.beforeGet = path => { if (path === `/actions/runs/${q.run.id}` && ++reads === 2) q.run.run_attempt++; };
  await assert.rejects(f.run({ write: true }), /changed while verifying/); assert.equal(f.writes().length, 0);
});
for (const [label, mutate] of [
  ['different ID', f => { f.state.records[0].id++; }],
  ['different SHA', f => { f.state.records[0].sha = LIVE; }],
  ['different ref', f => { f.state.records[0].ref = 'main'; }],
  ['different task', f => { f.state.records[0].task = 'deploy'; }],
  ['different creator', f => { f.state.records[0].creator.id++; }],
  ['payload extension', f => { f.state.records[0].payload.unreviewed = true; }],
  ['different old run', f => { f.state.records[0].payload.runId = RUN; }],
  ['status ID', f => { f.state.statuses.get(7776754145)[0].id++; }],
  ['old error', f => { f.state.statuses.get(7776754145)[0].state = 'error'; }],
  ['old success appended', f => { f.state.statuses.get(7776754145).unshift({ ...f.state.statuses.get(7776754145)[0], id: 22157544034 }); }],
  ['status URL', f => { f.state.statuses.get(7776754145)[0].log_url = url(RUN); }],
  ['missing status', f => { f.state.statuses.set(7776754145, []); }],
  ['current run not main', f => { f.state.runs.get(RUN).head_branch = 'other'; }],
  ['current run wrong SHA', f => { f.state.runs.get(RUN).head_sha = OLD; }],
  ['current job not active', f => { f.state.jobs.get(RUN)[0].status = 'queued'; }],
  ['current attempt stale', f => { f.state.runs.get(RUN).run_attempt++; }],
  ['other publisher active', f => { f.state.otherPublishers.push({ id: 60000000000, status: 'in_progress' }); }],
  ['other reconciler queued', f => { f.state.reconcilerRuns.push({ id: 60000000001, status: 'queued' }); }],
]) test(`rejects ${label} before any write`, async () => {
  const f = fixture(); mutate(f); await assert.rejects(f.run({ write: true })); assert.equal(f.writes().length, 0);
});
test('rejects an arbitrary release target and failed Git ancestry before API access', async () => {
  const f = fixture(); f.context.approvedSha = LIVE;
  await assert.rejects(f.run({ write: true }), /exact approved/); assert.equal(f.state.calls.length, 0);
  f.context.approvedSha = TARGET;
  await assert.rejects(f.run({ write: true, verifyHistory: () => { throw new Error('wrong ancestry'); } }), /wrong ancestry/);
  assert.equal(f.state.calls.length, 0);
});
test('re-reads old identity immediately before creation', async () => {
  const f = fixture(); f.state.beforeGet = path => {
    if (path.startsWith('/deployments?') && f.state.reads === 1) f.state.records[0].updated_at = 'changed';
  };
  await assert.rejects(f.run({ write: true }), /old deployment/); assert.equal(f.writes().length, 0);
});
test('a record racing after creation remains unfinished', async () => {
  const f = fixture(); f.state.afterPost = (path, body, created) => {
    if (path === '/deployments') { const other = { ...copy(created), id: created.id + 1 }; f.state.records.push(other); f.state.statuses.set(other.id, []); }
  };
  await assert.rejects(f.run({ write: true }), /superseded/); assert.equal(f.writes().length, 1);
});
test('an old status race after creation leaves the new record unfinished', async () => {
  const f = fixture(); f.state.afterPost = path => { if (path === '/deployments') f.state.statuses.get(7776754145)[0].state = 'error'; };
  await assert.rejects(f.run({ write: true }), /old success/); assert.equal(f.writes().length, 1);
});
test('a pre-existing new status is never overwritten', async () => {
  const f = fixture(); f.state.afterPost = (path, body, created) => {
    if (path === '/deployments') f.state.statuses.set(created.id, [{ id: 22157544035, state: 'pending' }]);
  };
  await assert.rejects(f.run({ write: true }), /already has a status/); assert.equal(f.writes().length, 1);
});
test('a status-write failure leaves a blocking partial record, including retry', async () => {
  const f = fixture(); f.state.beforePost = path => { if (path.includes('/statuses')) throw new Error('network ambiguity'); };
  await assert.rejects(f.run({ write: true }), /network ambiguity/);
  f.state.beforePost = null; const count = f.writes().length;
  await assert.rejects(f.run({ write: true }), /unfinished or uncertain/); assert.equal(f.writes().length, count);
});
test('an ambiguous creation response cannot cause a duplicate on retry', async () => {
  const f = fixture(); f.state.afterPost = path => { if (path === '/deployments') throw new Error('response lost'); };
  await assert.rejects(f.run({ write: true }), /response lost/);
  f.state.afterPost = null; const count = f.writes().length;
  await assert.rejects(f.run({ write: true }), /unfinished or uncertain/); assert.equal(f.writes().length, count);
});
test('a successful exact reconciliation permits a read-only retry, with actual job proof', async () => {
  const f = fixture(); await f.run({ write: true }); f.finishRun(); f.state.calls = [];
  assert.deepEqual(await f.run({ write: true }), { action: 'no-op', state: 'reconciled', wrote: false }); assert.equal(f.writes().length, 0);
  f.state.jobs.get(RUN)[0].steps = [];
  await assert.rejects(f.run({ write: true }), /publisher job history/); assert.equal(f.writes().length, 0);
});
test('retry rejects changed proof provenance even on a successful cfe record', async () => {
  const f = fixture(); await f.run({ write: true }); f.finishRun(); f.state.calls = [];
  f.state.records.at(-1).payload.proofSha256.releaseLog = '0'.repeat(64);
  await assert.rejects(f.run({ write: true }), /proof pins/); assert.equal(f.writes().length, 0);
});
test('retry recognizes successful protected target descendants through the exact reconciliation', async () => {
  const f = fixture(); await f.run({ write: true }); f.addRelease(); f.addRelease(TARGET); f.state.calls = [];
  assert.deepEqual(await f.run({ write: true }), { action: 'no-op', state: 'released', wrote: false }); assert.equal(f.writes().length, 0);
  f.state.records.at(-1).payload.previousLiveSha = OLD;
  await assert.rejects(f.run({ write: true }), /not descended/); assert.equal(f.writes().length, 0);
});
test('failed target publication and target without reconciliation both block retry', async () => {
  const f = fixture(); await f.run({ write: true }); const release = f.addRelease(); f.state.calls = [];
  f.state.statuses.get(release.id)[0].state = 'error';
  await assert.rejects(f.run({ write: true }), /unfinished or uncertain/); assert.equal(f.writes().length, 0);
  f.state.statuses.get(release.id)[0].state = 'success'; f.state.records.splice(1, 1);
  await assert.rejects(f.run({ write: true })); assert.equal(f.writes().length, 0);
});
test('latest target metadata without a successful actual publish step is insufficient', async () => {
  const f = fixture(); await f.run({ write: true }); f.addRelease(); f.state.calls = [];
  f.state.jobs.get(RUN)[0].steps = [{ name: STEP, status: 'completed', conclusion: 'success' }];
  await assert.rejects(f.run({ write: true }), /publisher job history/); assert.equal(f.writes().length, 0);
});
test('post-success readback detects an intervening record rather than reporting success', async () => {
  const f = fixture(); f.state.afterPost = (path, body) => {
    if (path.includes('/statuses') && body.state === 'success') {
      const other = { ...copy(f.state.records.at(-1)), id: f.state.records.at(-1).id + 1, sha: OLD, ref: OLD };
      f.state.records.push(other); f.state.statuses.set(other.id, []);
    }
  };
  await assert.rejects(f.run({ write: true })); assert.equal(f.writes().length, 2);
});
test('real Git ancestry rejects rollback, divergence and a target outside canonical', t => {
  const dir = mkdtempSync(join(tmpdir(), 'pr461-git-')); t.after(() => rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', ['-C', dir, '-c', 'user.name=test', '-c', 'user.email=test@example.invalid', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  git('init', '-q'); const commits = [];
  for (let i = 0; i < 4; i++) { git('commit', '--allow-empty', '-qm', `commit${i}`); commits.push(git('rev-parse', 'HEAD')); }
  assert.doesNotThrow(() => assertAncestry(dir, commits));
  assert.throws(() => assertAncestry(dir, [commits[1], commits[0], commits[2], commits[3]]), /ancestry/);
  assert.throws(() => assertAncestry(dir, [commits[0], commits[1], commits[3], commits[2]]), /ancestry/);
  git('checkout', '-q', '--detach', commits[0]); git('commit', '--allow-empty', '-qm', 'diverged');
  assert.throws(() => assertAncestry(dir, [commits[0], git('rev-parse', 'HEAD'), commits[2], commits[3]]), /ancestry/);
});
test('CLI defaults to no-network inspection and rejects local writes', () => {
  const path = new URL('./reconcile-pr461.mjs', import.meta.url).pathname;
  const inspect = spawnSync(process.execPath, [path], { encoding: 'utf8', env: {} });
  assert.equal(inspect.status, 0); assert.equal(JSON.parse(inspect.stdout).write, false);
  const write = spawnSync(process.execPath, [path, '--write'], { encoding: 'utf8', env: {} });
  assert.equal(write.status, 1); assert.match(write.stderr, /protected main publish job/);
});
test('execution context requires the exact Actions/main/repository/job/target/run identity', () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REF: 'refs/heads/main', GITHUB_JOB: 'publish',
    GITHUB_WORKFLOW_REF: `${REPOSITORY}/.github/workflows/publish-baseline.yml@refs/heads/main`, GITHUB_SERVER_URL: 'https://github.com',
    GITHUB_API_URL: 'https://api.github.com', GITHUB_EVENT_NAME: 'push', RELEASE_SHA: TARGET, GITHUB_SHA: CONTROLLER,
    GITHUB_RUN_ID: RUN, GITHUB_RUN_ATTEMPT: '1', SITE_DIR: '/site' };
  assert.equal(executionContext(env).approvedSha, TARGET);
  for (const key of Object.keys(env)) assert.throws(() => executionContext({ ...env, [key]: '' }), key);
  assert.throws(() => executionContext({ ...env, RELEASE_SHA: LIVE }));
  assert.throws(() => executionContext({ ...env, RELEASE_SHA: 'ccadcb0cbfe241ad500962e5f83d0cacdcbc37f1' }));
});
test('historical incident workflow used the SAME publish lock, before unchanged begin, with read-only Actions permission', () => {
  const workflow = readFileSync(INCIDENT_WORKFLOW, 'utf8');
  assert.equal(createHash('sha256').update(workflow).digest('hex'), INCIDENT_WORKFLOW_SHA256);
  assert.equal((workflow.match(/group: wix-production/g) || []).length, 1);
  assert.match(workflow, /cancel-in-progress: false/); assert.match(workflow, /contents: read\n      actions: read\n      deployments: write/);
  const helper = workflow.indexOf('reconcile-pr461.mjs --write'), begin = workflow.indexOf('production-release.mjs begin');
  assert.ok(helper > workflow.indexOf('  publish:') && helper < begin);
  assert.ok(begin < workflow.indexOf('bash tools/release/release.sh "$RELEASE_SHA"'));
  assert.match(workflow, /production-release\.mjs finish/); assert.doesNotMatch(workflow, /production-release\.mjs initialize/);
  const ci = readFileSync(new URL('../workflows/release-guard-pr.yml', import.meta.url), 'utf8');
  assert.match(ci, /branches: \[main\]/); assert.doesNotMatch(ci, /\bpaths(?:-ignore)?:/);
  assert.match(ci, /node --test .*production-release\.test\.mjs .*reconcile-production\.test\.mjs .*reconcile-pr461\.test\.mjs/);
});

const ACTIVE_RELEASE_TARGET = 'd091178a33d0904e57de4a4fe3409b47d2c7370a';
const COMPLETED_INCIDENT_COMMENTS = "# Merge only after PR #463 and Noam's approval of this pin and its one-time\n# PR #461 metadata reconciliation. The reconciliation runs under the publish lock.\n";
const COMPLETED_INCIDENT_HOOK = "      - name: Reconcile the verified PR461 local publication under the release lock\n        # PR461 / target PR463 only. Remove this step in the separately approved\n        # controller PR for a future target after reconciliation; keep the guard/lock.\n        env:\n          GITHUB_TOKEN: ${{ github.token }}\n          SITE_DIR: ${{ github.workspace }}/site\n        run: node controller/.github/scripts/reconcile-pr461.mjs --write\n\n";

test('current publisher removes only completed reconciliation and its Actions permission; guards and lock remain exact', () => {
  const historical = readFileSync(INCIDENT_WORKFLOW, 'utf8');
  const current = readFileSync(new URL('../workflows/publish-baseline.yml', import.meta.url), 'utf8');
  assert.equal(readApprovedSha(current), ACTIVE_RELEASE_TARGET);
  const expected = historical.replace(COMPLETED_INCIDENT_COMMENTS, '').replace(COMPLETED_INCIDENT_HOOK, '').replace('      actions: read\n', '')
    .replace(`  RELEASE_SHA: ${TARGET}\n`, `  RELEASE_SHA: ${ACTIVE_RELEASE_TARGET}\n`);
  assert.equal(current, expected);
  assert.doesNotMatch(current, /reconcile-pr461|production-release\.mjs initialize/);
});

test('closed incident cannot authorize the new cleanup controller as a queued publisher', async () => {
  const f = fixture(), q = f.queued({ controller: CONTROLLER });
  f.state.contents.set(q.sourceKey, readFileSync(new URL('../workflows/publish-baseline.yml', import.meta.url)));
  await assert.rejects(f.run({ write: true }), /one allowed target|exact reviewed/);
  assert.equal(f.writes().length, 0);
});
