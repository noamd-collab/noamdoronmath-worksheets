// A container-API call that never settles must cost one failed operation, never the whole supervisor.
// On 2026-11-25 one such call held the serial queue for 5 h 36 min: no cycle, no status, no deactivate.
import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { INACTIVITY_MS, PLATFORM_CALL_MS, Supervisor, rearm, within, type ContainerPort, type Identity,
  type RuntimeEnv, type StateStore } from '../src/controller.ts';

const IMAGE = `registry.cloudflare.com/test/worker@sha256:${'a'.repeat(64)}`;
const PASS = JSON.stringify({ event: 'worker_preflight_pass', claimVerified: false,
  providerCalled: false, heartbeatWritten: false });
const START_TIME = Date.UTC(2026, 10, 25, 5, 19, 52);
const LIMIT = 40; // ms; the production limit is PLATFORM_CALL_MS
const GUARD = { timeout: 3000 }; // a test that waits on a stuck call fails here instead of hanging

class MemoryStore implements StateStore {
  values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.values.get(key)) as T | undefined; }
  async put<T>(key: string, value: T) { this.values.set(key, structuredClone(value)); }
}
type Call = 'inspect' | 'keepAlive' | 'destroy' | 'exec';
class StuckContainer implements ContainerPort {
  running = false;
  images = { worker: IMAGE };
  stuck = new Set<Call>();
  /** Calls that do answer, after this many milliseconds. */
  slow = new Map<Call, number>();
  /** Releases the calls that were left pending, as a platform that answers hours late would. */
  late: (() => void)[] = [];
  /** The same calls, refused late instead of answered. */
  refuse: (() => void)[] = [];
  destroyCalls = 0;
  starts: Parameters<ContainerPort['start']>[0][] = [];
  timeouts: number[] = [];
  destroys: string[] = [];
  kills: number[] = [];
  monitors = 0;
  inspects = 0;
  /** Made when exec answers, so a failed exit has no handler but the supervisor's own. */
  execExit: () => Promise<number> = () => Promise.resolve(0);
  current: { image: string; labels: Record<string, string> } | null = null;
  exit?: { resolve(): void; reject(reason: unknown): void };
  private pending<T>(call: Call, answer: () => T): Promise<T> {
    const delay = this.slow.get(call);
    if (delay !== undefined) return new Promise<T>(resolve => { setTimeout(() => resolve(answer()), delay); });
    if (!this.stuck.has(call)) return Promise.resolve().then(answer);
    return new Promise<T>((resolve, reject) => {
      this.late.push(() => resolve(answer()));
      this.refuse.push(() => reject(new Error('PRIVATE_PLATFORM_ERROR')));
    });
  }
  start(options: Parameters<ContainerPort['start']>[0]) {
    this.starts.push(structuredClone(options));
    assert.equal(this.running, false, 'Never start a second process while busy');
    this.running = true;
    this.current = { image: options.image, labels: structuredClone(options.labels) };
  }
  inspect() { this.inspects++; return this.pending('inspect', () => structuredClone(this.current)); }
  setInactivityTimeout(ms: number) { return this.pending('keepAlive', () => { this.timeouts.push(ms); }); }
  monitor() {
    this.monitors++;
    const done = new Promise<void>((resolve, reject) => { this.exit = { resolve, reject }; });
    void done.catch(() => undefined);
    return done;
  }
  destroy(reason: string) {
    this.destroyCalls++;
    return this.pending('destroy', () => { this.destroys.push(reason); this.running = false; this.current = null; });
  }
  exec() {
    const bytes = new TextEncoder().encode(PASS);
    return this.pending('exec', () => ({
      stdout: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } }),
      exitCode: this.execExit(), kill: (signal: number) => { this.kills.push(signal); } }));
  }
  stop(ok = true) {
    this.running = false; this.current = null;
    if (ok) this.exit?.resolve(); else this.exit?.reject(new Error('PRIVATE_PLATFORM_ERROR'));
  }
}
function fixture() {
  const container = new StuckContainer();
  const store = new MemoryStore();
  const env: RuntimeEnv = { SOURCE_SHA: 'c'.repeat(40), CF_VERSION_METADATA: { id: 'test-version-1' },
    TEACHER_GENERATION_SERVICE_KEY: 'PRIVATE_SERVICE_SECRET', QWEN_API_KEY: 'PRIVATE_PROVIDER_SECRET',
    QWEN_BASE_URL: 'https://fixed.example.invalid/v1', QWEN_MODEL: 'fixed-model' };
  let now = START_TIME, sequence = 0;
  const waits: Promise<unknown>[] = [];
  // A new instance over the same storage and container, as after the platform rebuilt the object.
  const create = (limit?: number) => new Supervisor(container, store, env, 'fixed-do-id', promise => { waits.push(promise); },
    () => now, () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`, limit);
  const supervisor = create(LIMIT);
  const identity = (): Identity => ({ sourceSha: env.SOURCE_SHA, imageRef: IMAGE, versionId: env.CF_VERSION_METADATA.id });
  const saved = () => structuredClone(store.values.get('state')) as Record<string, any>;
  return { container, store, supervisor, create, waits, saved, now: () => now, advance(ms: number) { now += ms; },
    async active() { await supervisor.preflight(); await supervisor.activate(identity()); } };
}
const fails = (promise: Promise<unknown>) => assert.rejects(promise, /^Error: CLOUD_OPERATION_FAILED$/);
async function flush() { await setImmediate(); await setImmediate(); }

test('the production limit is 20 seconds and a call inside it is untouched', GUARD, async () => {
  assert.equal(PLATFORM_CALL_MS, 20000);
  assert.equal(await within(Promise.resolve('answer'), LIMIT), 'answer');
  await assert.rejects(within(Promise.reject(new Error('PRIVATE_PLATFORM_ERROR')), LIMIT), /PRIVATE_PLATFORM_ERROR/);
  const started = Date.now();
  await fails(within(new Promise(() => undefined), LIMIT));
  assert.ok(Date.now() - started < 1000);
});

test('a cycle whose keep-alive call never settles fails once, and status and deactivate still answer', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  assert.equal(f.container.starts.length, 2); // the preflight and this one cycle
  assert.equal(f.saved().lastCycle.status, 'failed');
  assert.equal(f.saved().failures, 1);
  assert.equal(f.saved().nextAttemptAt, f.now() + 60000);
  // The run is watched all the same: monitor() is what reports its end and keeps the object with it.
  assert.equal(f.waits.length, 1);
  assert.equal(f.container.monitors, 1);
  const status = await f.supervisor.status();
  assert.equal(status.mode, 'active');
  assert.equal(status.running, true);
  assert.equal(status.observedImage, IMAGE);
  assert.equal(status.lastCycle?.status, 'failed');
  assert.equal(JSON.stringify(status).includes('PRIVATE_'), false);
  assert.equal((await f.supervisor.deactivate()).mode, 'disabled');
});

test('an answer that arrives after the limit changes nothing', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  const before = f.saved();
  f.container.stuck.clear();
  for (const release of f.container.late.splice(0)) release();
  await flush();
  assert.deepEqual(f.saved(), before);
  assert.equal(f.waits.length, 1);
  assert.equal(f.container.starts.length, 2);
});

test('once the platform answers again the next tick adopts the same cycle and never starts a second one', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  const run = f.saved().lastCycle.runId;
  f.container.stuck.clear();
  f.advance(60000);
  const report = await f.supervisor.tick();
  assert.equal(report.running, true);
  assert.equal(f.container.starts.length, 2);
  assert.equal(f.container.timeouts.at(-1), 30 * 60 * 1000);
  assert.equal(f.waits.length, 1);
  f.container.stop();
  await Promise.all(f.waits);
  assert.equal(f.saved().lastCycle.runId, run);
  assert.equal(f.saved().lastCycle.status, 'exited');
  assert.equal(f.saved().failures, 0);
  assert.equal(f.saved().nextAttemptAt, 0);
});

test('a running container that cannot be inspected: ticks fail closed and change nothing, status says so', GUARD, async () => {
  const f = fixture();
  await f.active();
  await f.supervisor.tick();
  const before = f.saved();
  f.container.stuck.add('inspect');
  await fails(f.supervisor.tick());
  await fails(f.supervisor.tick());
  assert.deepEqual(f.saved(), before);
  assert.equal(f.container.starts.length, 2);
  const status = await f.supervisor.status();
  assert.equal(status.running, true);
  assert.equal(status.observedImage, null); // release tooling reads running without the exact image as a mismatch
  assert.equal(status.lastCycle?.status, 'running');
  const stopped = await f.supervisor.deactivate();
  assert.equal(stopped.mode, 'disabled');
  assert.equal(stopped.observedImage, null);
  assert.equal(f.saved().mode, 'disabled');
  assert.equal(f.saved().approved, null);
  // Activation and preflight stay closed while a container is running.
  await fails(f.supervisor.preflight());
  assert.equal(f.container.starts.length, 2);
});

test('only status and deactivate tolerate an uninspectable container: the tick that started a cycle still fails closed', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('inspect');
  await fails(f.supervisor.tick());
  assert.equal(f.saved().lastCycle.status, 'running'); // the cycle did start, and it is watched
  assert.equal(f.waits.length, 1);
  assert.equal(f.container.starts.length, 2);
  assert.equal((await f.supervisor.status()).observedImage, null);
});

for (const call of ['keepAlive', 'exec', 'inspect', 'destroy'] as const) {
  test(`preflight with a stuck ${call} call is never a PASS and never blocks the next operation`, GUARD, async () => {
    const f = fixture();
    f.container.stuck.add(call);
    await fails(f.supervisor.preflight());
    assert.equal(f.saved().preflight, null);
    assert.equal(f.saved().mode, 'disabled');
    const status = await f.supervisor.status();
    assert.equal(status.preflight, null);
    await fails(f.supervisor.activate({ sourceSha: 'c'.repeat(40), imageRef: IMAGE, versionId: 'test-version-1' }));
    // inspect or destroy stuck: the supervisor could not confirm and remove its own check container.
    assert.deepEqual(f.container.destroys, call === 'keepAlive' || call === 'exec' ? ['PREFLIGHT_FAILED'] : []);
  });
}

test('after a stuck preflight was cleaned up, a later preflight passes and can be activated', GUARD, async () => {
  const f = fixture();
  f.container.stuck.add('exec');
  await fails(f.supervisor.preflight());
  assert.equal(f.container.running, false);
  f.container.stuck.clear();
  await f.active();
  assert.equal((await f.supervisor.status()).mode, 'active');
});

test('each unanswered call is named in one log line that carries nothing else', GUARD, async t => {
  const lines: string[] = [];
  t.mock.method(console, 'error', (line: string) => { lines.push(line); });
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  f.container.stuck.clear();
  f.container.stuck.add('inspect');
  await fails(f.supervisor.tick());
  assert.deepEqual(lines, ['{"event":"teacher_cloud_platform_timeout","call":"setInactivityTimeout"}',
    '{"event":"teacher_cloud_platform_timeout","call":"inspect"}']);
  for (const call of ['exec', 'destroy'] as const) {
    lines.length = 0;
    const g = fixture();
    g.container.stuck.add(call);
    await fails(g.supervisor.preflight());
    assert.equal(lines[0], `{"event":"teacher_cloud_platform_timeout","call":"${call}"}`);
  }
});

test('exec may take up to three times the limit, because it waits for a container that is still starting', GUARD, async () => {
  const slow = fixture();
  slow.container.slow.set('exec', 2 * LIMIT);
  assert.equal((await slow.supervisor.preflight()).preflight?.status, 'PASS');
  const slower = fixture();
  slower.container.slow.set('exec', 4 * LIMIT);
  await fails(slower.supervisor.preflight());
  const other = fixture();
  other.container.slow.set('keepAlive', 2 * LIMIT);
  await fails(other.supervisor.preflight());
});

test('re-arming after a rebuild never blocks: one call when a container runs, none otherwise, settled within the limit', GUARD, async () => {
  const idle = new StuckContainer();
  const waits: Promise<unknown>[] = [];
  rearm(idle, promise => { waits.push(promise); }, LIMIT);
  assert.equal(waits.length, 0);
  assert.deepEqual(idle.timeouts, []);
  const busy = new StuckContainer();
  busy.running = true;
  rearm(busy, promise => { waits.push(promise); }, LIMIT);
  await Promise.all(waits);
  assert.deepEqual(busy.timeouts, [INACTIVITY_MS]);
  const silent = new StuckContainer();
  silent.running = true;
  silent.stuck.add('keepAlive');
  const lines: string[] = [];
  rearm(silent, promise => { waits.push(promise); }, LIMIT, line => { lines.push(line); });
  assert.equal(waits.length, 2);
  assert.equal(await waits[1], undefined); // resolves: an unanswered call must not reset the object
  assert.deepEqual(lines, ['{"event":"teacher_cloud_rearm_unconfirmed"}']);
  assert.deepEqual(silent.timeouts, []);
});

test('without an explicit limit the re-arm gives up after 20 s', GUARD, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const silent = new StuckContainer();
  silent.running = true;
  silent.stuck.add('keepAlive');
  const waits: Promise<unknown>[] = [];
  const lines: string[] = [];
  rearm(silent, promise => { waits.push(promise); }, undefined, line => { lines.push(line); });
  t.mock.timers.tick(19999);
  await flush();
  assert.deepEqual(lines, []);
  t.mock.timers.tick(1);
  await waits[0];
  assert.deepEqual(lines, ['{"event":"teacher_cloud_rearm_unconfirmed"}']);
});

test('while the keep-alive call stays unanswered, cycles still run every minute and each one is watched', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  for (let minute = 1; minute <= 4; minute++) {
    await fails(f.supervisor.tick());
    assert.equal(f.container.starts.length, 1 + minute);
    assert.equal(f.container.monitors, minute);
    assert.equal(f.saved().failures, 1);
    f.container.stop();
    await Promise.all(f.waits);
    // A clean exit clears the failure and the pause, so the next minute starts the next cycle.
    assert.equal(f.saved().lastCycle.status, 'exited');
    assert.equal(f.saved().failures, 0);
    assert.equal(f.saved().nextAttemptAt, 0);
    f.advance(60000);
  }
});

test('a run whose keep-alive went unanswered and which then fails is one failure, not two', GUARD, async () => {
  const f = fixture();
  await f.active();
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  const pause = f.saved().nextAttemptAt;
  f.advance(5000);
  f.container.stop(false);
  await Promise.all(f.waits);
  assert.equal(f.saved().lastCycle.status, 'failed');
  assert.equal(f.saved().failures, 1);
  assert.equal(f.saved().nextAttemptAt, f.now() + 60000); // counted once, paused from the failure
  assert.ok(f.saved().nextAttemptAt > pause);
  assert.equal(f.saved().lastCycle.completedAt, new Date(f.now()).toISOString());
  // The same when the run fails long after the pause set at its start has passed: no start at that instant.
  const late = fixture();
  await late.active();
  late.container.stuck.add('keepAlive');
  await fails(late.supervisor.tick());
  late.container.stuck.clear();
  late.advance(600000);
  late.container.stop(false);
  await Promise.all(late.waits);
  assert.equal(late.saved().failures, 1);
  assert.equal(late.saved().nextAttemptAt, late.now() + 60000);
  await late.supervisor.tick();
  assert.equal(late.container.starts.length, 2);
  // A run that started cleanly and then fails is still counted, once.
  const g = fixture();
  await g.active();
  await g.supervisor.tick();
  g.container.stop(false);
  await Promise.all(g.waits);
  assert.equal(g.saved().failures, 1);
  assert.equal(g.saved().nextAttemptAt, g.now() + 60000);
});

test('a busy tick whose keep-alive goes unanswered fails within the limit, changes nothing and still watches the run', GUARD, async () => {
  const f = fixture();
  await f.active();
  await f.supervisor.tick();
  const before = f.saved();
  const inspected = f.container.inspects;
  await f.supervisor.tick();
  assert.equal(f.container.inspects, inspected + 1); // a busy tick inspects once; two would double its worst case
  f.container.stuck.add('keepAlive');
  await fails(f.supervisor.tick());
  assert.deepEqual(f.saved(), before);
  assert.equal(f.container.starts.length, 2);
  assert.equal((await f.supervisor.status()).observedImage, IMAGE);
  // After a rebuild nothing in memory says the run is watched; the busy tick watches it before the keep-alive.
  const rebuilt = f.create(LIMIT);
  await fails(rebuilt.tick());
  assert.equal(f.container.monitors, 2);
  assert.deepEqual(f.saved(), before);
  f.container.stuck.clear();
  assert.equal((await rebuilt.tick()).running, true);
  assert.equal(f.container.starts.length, 2);
  // A container that is not this release's run is never watched: its exit must not be written onto lastCycle.
  for (const foreign of [{ image: IMAGE, labels: { run: 'someone-else' } },
    { image: IMAGE.replace(/a{64}$/, 'b'.repeat(64)), labels: { ...f.container.current!.labels } }]) {
    const own = f.container.current;
    f.container.current = foreign;
    const again = f.create(LIMIT);
    await fails(again.tick());
    assert.equal(f.container.monitors, 2);
    assert.deepEqual(f.saved(), before);
    f.container.current = own;
  }
  assert.equal((await rebuilt.deactivate()).mode, 'disabled');
});

test('status is not queued: it answers while a preflight holds the queue', GUARD, async () => {
  const f = fixture();
  const supervisor = f.create(60000);
  f.container.stuck.add('exec');
  const check = supervisor.preflight();
  await flush();
  const during = await supervisor.status();
  assert.equal(during.running, true);
  assert.equal(during.preflight, null);
  assert.equal(during.mode, 'disabled');
  for (const release of f.container.late.splice(0)) release();
  assert.equal((await check).preflight?.status, 'PASS');
});

test('after an unanswered destroy no new check container starts until that destroy settles', GUARD, async () => {
  const f = fixture();
  f.container.stuck.add('destroy');
  await fails(f.supervisor.preflight());
  assert.equal(f.container.starts.length, 1);
  f.container.stuck.clear();
  f.container.stop(false); // the check container ended on its own; the destroy is still outstanding
  await fails(f.supervisor.preflight());
  assert.equal(f.container.starts.length, 1);
  assert.equal(f.container.destroyCalls, 1); // no second destroy is sent after one went unanswered
  for (const release of f.container.late.splice(0)) release();
  await flush();
  assert.equal((await f.supervisor.preflight()).preflight?.status, 'PASS');
  assert.equal(f.container.starts.length, 2);
  // A destroy refused late re-opens the check just the same.
  const g = fixture();
  g.container.stuck.add('destroy');
  await fails(g.supervisor.preflight());
  g.container.stuck.clear();
  g.container.stop(false);
  await fails(g.supervisor.preflight());
  for (const refuse of g.container.refuse.splice(0)) refuse();
  await flush();
  assert.equal((await g.supervisor.preflight()).preflight?.status, 'PASS');
});

test('a check that starts after its limit is stopped, and its failed exit is nobody\'s error', GUARD, async () => {
  const f = fixture();
  f.container.stuck.add('exec');
  f.container.execExit = () => Promise.reject(new Error('PRIVATE_PLATFORM_ERROR'));
  const unhandled: unknown[] = [];
  const listener = (reason: unknown) => { unhandled.push(reason); };
  process.on('unhandledRejection', listener);
  try {
    await fails(f.supervisor.preflight());
    assert.deepEqual(f.container.kills, []);
    for (const release of f.container.late.splice(0)) release();
    await flush();
    assert.deepEqual(f.container.kills, [15]);
    assert.deepEqual(unhandled, []);
  } finally { process.off('unhandledRejection', listener); }
});

test('without an explicit limit the supervisor waits 20 s for a call and 60 s for exec', GUARD, async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  for (const [call, ms] of [['keepAlive', 20000], ['exec', 60000]] as const) {
    const f = fixture();
    f.container.stuck.add(call);
    let settled = false;
    const check = f.create().preflight().then(() => { settled = true; }, () => { settled = true; });
    await flush();
    t.mock.timers.tick(ms - 1);
    await flush();
    assert.equal(settled, false, call);
    t.mock.timers.tick(1);
    await check;
  }
});
