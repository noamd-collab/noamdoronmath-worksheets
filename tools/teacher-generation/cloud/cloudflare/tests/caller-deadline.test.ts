// The Worker itself stops waiting for a Durable Object that does not answer. On 2026-11-25 an operator
// request waited 400 seconds without any reply, and every cron tick stayed open against the object.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { CRON_MS, ROUTE_MS, cron, route, type OperatorRpc, type RouterEnv } from '../src/router.ts';

const key = 'a'.repeat(64);
const LIMITS = { status: 40, preflight: 40, other: 40 };
const GUARD = { timeout: 3000 };
const ACTIONS = ['status', 'preflight', 'activate', 'deactivate', 'tick'] as const;
const IDENTITY = { sourceSha: 'c'.repeat(40), imageRef: 'registry.example/worker@sha256:' + 'a'.repeat(64), versionId: 'v1' };
function env(behave: (action: string) => Promise<unknown>) {
  const calls: string[] = [];
  const stub = Object.fromEntries(ACTIONS.map(action => [action, () => { calls.push(action); return behave(action); }])) as unknown as OperatorRpc;
  const value: RouterEnv = { TEACHER_CLOUD_OPERATOR_KEY: key, GENERATOR: { getByName: () => stub } };
  return { value, calls };
}
const request = (action: string) => new Request('https://operator.example/operator/' + action, action === 'status'
  ? { headers: { Authorization: 'Bearer ' + key } }
  : { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify(action === 'activate' ? IDENTITY : {}) });
const never = () => new Promise<unknown>(() => undefined);

test('the limits are 30 s for status, 330 s for preflight, 90 s for the rest, and 45 s for a cron tick', () => {
  assert.deepEqual(ROUTE_MS, { status: 30000, preflight: 330000, other: 90000 });
  assert.equal(CRON_MS, 45000);
});

test('without explicit limits each route waits exactly its own, and a cron tick its own', GUARD, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const limits = { status: 30000, preflight: 330000, activate: 90000, deactivate: 90000, tick: 90000 };
  for (const action of ACTIONS) {
    const e = env(never);
    const got: { response?: Response } = {};
    void route(request(action), e.value).then(answer => { got.response = answer; });
    while (!e.calls.length) await setImmediate(); // authenticated, and the object was asked
    t.mock.timers.tick(limits[action] - 1);
    await setImmediate(); await setImmediate();
    assert.equal('response' in got, false, action);
    t.mock.timers.tick(1);
    while (!got.response) await setImmediate();
    assert.equal(got.response.status, 504, action);
  }
  const lines: string[] = [];
  const e = env(never);
  const tick = cron(e.value, undefined, line => { lines.push(line); });
  while (!e.calls.length) await setImmediate();
  t.mock.timers.tick(44999);
  await setImmediate(); await setImmediate();
  assert.deepEqual(lines, []);
  t.mock.timers.tick(1);
  await tick;
  assert.deepEqual(lines, ['{"event":"teacher_cloud_cycle_timeout"}']);
});

test('the Worker entry uses the bounded cron tick and the non-blocking re-arm', () => {
  // Comments are removed first, so a commented-out call does not count as wiring.
  const source = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(source.includes('scheduled(_controller: ScheduledController, env: Env) { return cron(env); },'));
  assert.ok(source.includes('rearm(bridge, promise => ctx.waitUntil(promise));'));
  assert.equal(source.includes('blockConcurrencyWhile'), false);
  assert.equal(source.includes(".getByName('primary')"), false); // only the router reaches the object
});

test('an object that never answers gives 504 within the limit on every operator route', GUARD, async () => {
  for (const action of ACTIONS) {
    const e = env(never);
    const started = Date.now();
    const response = await route(request(action), e.value, LIMITS);
    assert.ok(Date.now() - started < 1000, action);
    assert.equal(response.status, 504, action);
    assert.deepEqual(await response.json(), { error: 'CLOUD_OPERATION_TIMEOUT' });
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
    assert.deepEqual(e.calls, [action]); // asked once, never retried
  }
});

test('a refusal stays 503 and an answer stays 200: only silence is a timeout', GUARD, async () => {
  for (const action of ACTIONS) {
    const refused = await route(request(action), env(async () => { throw new Error('secret=' + key); }).value, LIMITS);
    assert.equal(refused.status, 503, action);
    assert.deepEqual(await refused.json(), { error: 'CLOUD_OPERATION_FAILED' });
    const thrown = await route(request(action), env(() => { throw new Error('secret=' + key); }).value, LIMITS);
    assert.equal(thrown.status, 503, action);
    const fine = await route(request(action), env(async () => ({ mode: 'disabled' })).value, LIMITS);
    assert.equal(fine.status, 200, action);
    assert.deepEqual(await fine.json(), { mode: 'disabled' });
  }
});

test('a request without the key gets 404 at once and never waits for the object', GUARD, async () => {
  const e = env(never);
  const response = await route(new Request('https://operator.example/operator/status'), e.value, LIMITS);
  assert.equal(response.status, 404);
  assert.deepEqual(e.calls, []);
});

test('a cron tick against a silent object ends within the limit with one timeout line', GUARD, async () => {
  const lines: string[] = [];
  const e = env(never);
  const started = Date.now();
  await cron(e.value, 40, line => { lines.push(line); });
  assert.ok(Date.now() - started < 1000);
  assert.deepEqual(lines, ['{"event":"teacher_cloud_cycle_timeout"}']);
  assert.deepEqual(e.calls, ['tick']);
});

test('a cron tick never throws: a refusal is one line, a healthy tick is silent', GUARD, async () => {
  const lines: string[] = [];
  const log = (line: string) => { lines.push(line); };
  await cron(env(async () => { throw new Error('secret=' + key); }).value, 40, log);
  await cron(env(() => { throw new Error('secret=' + key); }).value, 40, log);
  await cron({ GENERATOR: { getByName: () => { throw new Error('secret=' + key); } } }, 40, log);
  assert.deepEqual(lines, Array(3).fill('{"event":"teacher_cloud_cycle_unavailable"}'));
  lines.length = 0;
  const healthy = env(async () => ({ mode: 'active' }));
  await cron(healthy.value, 40, log);
  assert.deepEqual(lines, []);
  assert.deepEqual(healthy.calls, ['tick']);
});
