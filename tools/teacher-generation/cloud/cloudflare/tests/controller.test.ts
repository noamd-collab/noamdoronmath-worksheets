import assert from 'node:assert/strict';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import { INACTIVITY_MS, Supervisor, type ContainerPort, type Identity,
  type RuntimeEnv, type StateStore } from '../src/controller.ts';

const IMAGE = `registry.cloudflare.com/test/worker@sha256:${'a'.repeat(64)}`;
const OTHER_IMAGE = `registry.cloudflare.com/test/worker@sha256:${'b'.repeat(64)}`;
const START_TIME = Date.UTC(2026, 10, 14, 12, 0, 0);
const PASS = { event: 'worker_preflight_pass', claimVerified: false,
  providerCalled: false, heartbeatWritten: false };

class MemoryStore implements StateStore {
  values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return structuredClone(this.values.get(key)) as T | undefined;
  }
  async put<T>(key: string, value: T) {
    this.values.set(key, structuredClone(value));
  }
}

class Deferred {
  resolve!: () => void;
  reject!: (reason: unknown) => void;
  promise = new Promise<void>((resolve, reject) => { this.resolve = resolve; this.reject = reject; });
  constructor() { void this.promise.catch(() => undefined); }
}

class FakeContainer implements ContainerPort {
  running = false;
  images = { worker: IMAGE };
  starts: Parameters<ContainerPort['start']>[0][] = [];
  execs: { command: string[]; options: Parameters<ContainerPort['exec']>[1] }[] = [];
  timeouts: number[] = [];
  destroys: string[] = [];
  kills: number[] = [];
  monitors: Deferred[] = [];
  current: { image: string; labels: Record<string, string> } | null = null;
  output: string | null = JSON.stringify(PASS);
  exitCode = 0;
  exitPromise?: Promise<number>;
  startFailure = false;
  execFailure = false;
  afterExec?: () => void;

  start(options: Parameters<ContainerPort['start']>[0]) {
    this.starts.push(structuredClone(options));
    if (this.startFailure) throw new Error('PRIVATE_PLATFORM_ERROR');
    assert.equal(this.running, false, 'Never start a second process while busy');
    this.running = true;
    this.current = { image: options.image, labels: structuredClone(options.labels) };
    this.monitors.push(new Deferred());
  }
  async inspect() { return structuredClone(this.current); }
  async setInactivityTimeout(ms: number) { this.timeouts.push(ms); }
  monitor() { return this.monitors.at(-1)!.promise; }
  async destroy(reason: string) {
    this.destroys.push(reason);
    this.running = false; this.current = null;
    this.monitors.at(-1)?.reject(new Error('mock destroy'));
  }
  stop(ok = true, settle = true) {
    this.running = false; this.current = null;
    if (settle) {
      if (ok) this.monitors.at(-1)!.resolve();
      else this.monitors.at(-1)!.reject(new Error('PRIVATE_PLATFORM_ERROR'));
    }
  }
  async exec(command: string[], options: Parameters<ContainerPort['exec']>[1]) {
    this.execs.push(structuredClone({ command, options }));
    if (this.execFailure) throw new Error('PRIVATE_EXEC_ERROR');
    this.afterExec?.();
    const bytes = this.output === null ? null : new TextEncoder().encode(this.output);
    return {
      stdout: bytes === null ? null : new ReadableStream<Uint8Array>({ start(controller) {
        // Split output to exercise cumulative size enforcement across chunks.
        for (let offset = 0; offset < bytes.length; offset += 512) controller.enqueue(bytes.slice(offset, offset + 512));
        controller.close();
      } }),
      exitCode: this.exitPromise ?? Promise.resolve(this.exitCode),
      kill: (sig: number) => { this.kills.push(sig); },
    };
  }
}

function fixture() {
  const container = new FakeContainer();
  const store = new MemoryStore();
  const env: RuntimeEnv = { SOURCE_SHA: 'c'.repeat(40), CF_VERSION_METADATA: { id: 'test-version-1' },
    TEACHER_GENERATION_SERVICE_KEY: 'PRIVATE_SERVICE_SECRET', QWEN_API_KEY: 'PRIVATE_PROVIDER_SECRET',
    QWEN_BASE_URL: 'https://fixed.example.invalid/v1', QWEN_MODEL: 'fixed-model' };
  let now = START_TIME;
  let sequence = 0;
  const waits: Promise<unknown>[] = [];
  const create = () => new Supervisor(container, store, env, 'fixed-do-id',
    promise => { waits.push(promise); }, () => now,
    () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
  const supervisor = create();
  const identity = (): Identity => ({ sourceSha: env.SOURCE_SHA,
    imageRef: container.images.worker, versionId: env.CF_VERSION_METADATA.id });
  const active = async () => { await supervisor.preflight(); await supervisor.activate(identity()); };
  return { container, store, env, waits, supervisor, create, identity, active,
    advance(ms: number) { now += ms; }, now: () => now };
}
async function flush() { await setImmediate(); await setImmediate(); }
const fails = (promise: Promise<unknown>) => assert.rejects(promise, /^Error: CLOUD_OPERATION_FAILED$/);

test('disabled cron and status never start work or expose runtime credentials', async () => {
  const f = fixture();
  const report = await f.supervisor.tick();
  assert.equal(report.mode, 'disabled');
  assert.equal(report.running, false);
  assert.equal(f.container.starts.length, 0);
  assert.equal(f.container.execs.length, 0);
  assert.equal(JSON.stringify(await f.supervisor.status()).includes('PRIVATE_'), false);
  await fails(f.supervisor.activate(f.identity()));
});

test('preflight overrides normal entrypoint and invokes only exact read-only command', async () => {
  const f = fixture();
  const report = await f.supervisor.preflight();
  assert.deepEqual(f.container.execs[0].command,
    ['/usr/local/bin/python', '-B', '/opt/noam/app/remote_worker.py', '--check-only']);
  assert.deepEqual(f.container.starts[0].entrypoint,
    ['/usr/bin/tini', '--', '/usr/local/bin/python', '-c', 'import time; time.sleep(180)']);
  assert.deepEqual(f.container.starts[0].env, {});
  assert.equal(f.container.execs[0].options.env.TEACHER_GENERATION_SERVICE_KEY, 'PRIVATE_SERVICE_SECRET');
  assert.equal(f.container.execs[0].options.stderr, 'ignore');
  assert.deepEqual(f.container.destroys, ['PREFLIGHT_COMPLETE']);
  assert.deepEqual(report.preflight, { ...f.identity(), status: 'PASS', observedImage: IMAGE,
    checkedAt: new Date(f.now()).toISOString(), claimVerified: false,
    providerCalled: false, heartbeatWritten: false });
  assert.equal(report.mode, 'disabled');
  assert.equal(JSON.stringify(report).includes('PRIVATE_'), false);
});

test('preflight refuses claiming, paid, heartbeat, malformed and oversized output', async t => {
  const cases: (string | null)[] = [
    JSON.stringify({ ...PASS, claimVerified: true }), JSON.stringify({ ...PASS, providerCalled: true }),
    JSON.stringify({ ...PASS, heartbeatWritten: true }), JSON.stringify({ ...PASS, providerCalled: 'false' }),
    JSON.stringify({ ...PASS, extra: 'PRIVATE_RESPONSE' }), JSON.stringify({ event: PASS.event }),
    'PRIVATE_ERROR', JSON.stringify([PASS]), null, ' '.repeat(4097) + JSON.stringify(PASS),
  ];
  for (const [index, output] of cases.entries()) await t.test(`invalid output ${index}`, async () => {
    const f = fixture();
    await f.supervisor.preflight(); // A failed recheck must invalidate this older proof.
    f.container.output = output;
    await fails(f.supervisor.preflight());
    assert.equal((await f.supervisor.status()).preflight, null);
    assert.equal(f.container.running, false);
    assert.equal(f.container.destroys.at(-1), 'PREFLIGHT_FAILED');
    await fails(f.supervisor.activate(f.identity()));
  });
});

test('nonzero/throwing preflight cannot persist PASS or expose platform text', async t => {
  for (const kind of ['exit', 'throw', 'start'] as const) await t.test(kind, async () => {
    const f = fixture();
    if (kind === 'exit') f.container.exitCode = 1;
    if (kind === 'throw') f.container.execFailure = true;
    if (kind === 'start') f.container.startFailure = true;
    await fails(f.supervisor.preflight());
    assert.equal((await f.supervisor.status()).preflight, null);
    assert.equal(f.container.running, false);
  });
});

test('preflight timeout terminates only the fixed check and never persists PASS', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const f = fixture();
  f.container.exitPromise = new Promise<number>(() => undefined);
  const rejected = fails(f.supervisor.preflight());
  await flush();
  t.mock.timers.tick(150000);
  await rejected;
  assert.deepEqual(f.container.kills, [15]);
  assert.deepEqual(f.container.destroys, ['PREFLIGHT_FAILED']);
  assert.equal((await f.supervisor.status()).preflight, null);
  assert.equal(f.container.execs.length, 1);
  assert.equal(f.container.running, false);
});

test('preflight verifies exact observed image and never destroys a foreign run', async t => {
  await t.test('wrong image', async () => {
    const f = fixture();
    f.container.afterExec = () => { f.container.current!.image = OTHER_IMAGE; };
    await fails(f.supervisor.preflight());
    assert.equal(f.container.destroys.at(-1), 'PREFLIGHT_FAILED');
    assert.equal((await f.supervisor.status()).preflight, null);
  });
  await t.test('foreign run', async () => {
    const f = fixture();
    f.container.afterExec = () => { f.container.current!.labels.run = 'foreign-run'; };
    await fails(f.supervisor.preflight());
    assert.deepEqual(f.container.destroys, []);
    assert.equal(f.container.running, true);
    assert.equal((await f.supervisor.status()).preflight, null);
  });
});

test('expired or future proof blocks activation; exact 15-minute boundary is allowed', async t => {
  for (const age of [-1, 900001]) await t.test(`age ${age}`, async () => {
    const f = fixture(); await f.supervisor.preflight(); f.advance(age);
    await fails(f.supervisor.activate(f.identity()));
    await f.supervisor.tick();
    assert.equal(f.container.starts.length, 1);
  });
  const f = fixture(); await f.supervisor.preflight(); f.advance(900000);
  assert.equal((await f.supervisor.activate(f.identity())).mode, 'active');
});

test('source, image and Worker-version changes invalidate proof and active cron', async t => {
  const changes = {
    source: (f: ReturnType<typeof fixture>) => { f.env.SOURCE_SHA = 'd'.repeat(40); },
    image: (f: ReturnType<typeof fixture>) => { f.container.images.worker = OTHER_IMAGE; },
    version: (f: ReturnType<typeof fixture>) => { f.env.CF_VERSION_METADATA.id = 'test-version-2'; },
  };
  for (const [kind, change] of Object.entries(changes)) await t.test(kind, async () => {
    const f = fixture(); await f.supervisor.preflight(); change(f);
    await fails(f.supervisor.activate(f.identity()));
    await f.supervisor.tick(); assert.equal(f.container.starts.length, 1);
    const active = fixture(); await active.active(); change(active);
    await active.supervisor.tick(); assert.equal(active.container.starts.length, 1);
  });
});

test('approval cannot substitute any requested identity field', async () => {
  const f = fixture(); await f.supervisor.preflight();
  for (const value of [{ sourceSha: 'd'.repeat(40) }, { imageRef: OTHER_IMAGE }, { versionId: 'other' }]) {
    await fails(f.supervisor.activate({ ...f.identity(), ...value }));
  }
  assert.equal((await f.supervisor.status()).mode, 'disabled');
});

test('concurrent ticks start one process and busy ticks only refresh timeout', async () => {
  const f = fixture(); await f.active();
  await Promise.all(Array.from({ length: 12 }, () => f.supervisor.tick()));
  assert.equal(f.container.starts.length, 2); // one preflight, one job cycle
  assert.equal(f.container.execs.length, 1); // preflight only; no per-job exec or author retry
  assert.equal(f.waits.length, 1);
  assert.equal(f.container.timeouts.at(-1), INACTIVITY_MS);
  assert.equal(f.container.starts[1].entrypoint, undefined);
  assert.equal(f.container.starts[1].env.QWEN_API_KEY, 'PRIVATE_PROVIDER_SECRET');
  assert.equal(JSON.stringify(await f.supervisor.status()).includes('PRIVATE_'), false);
  f.container.stop(); await flush();
});

test('successful idle exit cannot restart in same UTC minute, including DO reconstruction', async () => {
  const f = fixture(); await f.active(); await f.supervisor.tick();
  f.container.stop(); await flush();
  assert.equal((await f.supervisor.status()).lastCycle?.status, 'exited');
  const recreated = f.create();
  f.advance(59999); await recreated.tick();
  assert.equal(f.container.starts.length, 2);
  f.advance(1); await recreated.tick();
  assert.equal(f.container.starts.length, 3);
  f.container.stop(); await flush();
});

test('deactivation drains busy instance and prevents subsequent starts', async () => {
  const f = fixture(); await f.active(); await f.supervisor.tick();
  const destroysBefore = f.container.destroys.length;
  const report = await f.supervisor.deactivate();
  assert.equal(report.mode, 'disabled'); assert.equal(report.approved, null);
  assert.equal(report.running, true);
  f.advance(60000); await f.supervisor.tick();
  assert.equal(f.container.starts.length, 2);
  assert.equal(f.container.destroys.length, destroysBefore);
  f.container.stop(); await flush();
  f.advance(60000); await f.supervisor.tick();
  assert.equal(f.container.starts.length, 2);
});

test('active or busy supervisor refuses another preflight', async () => {
  const f = fixture(); await f.active();
  await fails(f.supervisor.preflight());
  await f.supervisor.tick(); await f.supervisor.deactivate();
  await fails(f.supervisor.preflight());
  assert.equal(f.container.execs.length, 1);
  f.container.stop(); await flush();
});

test('monitor failures back off without immediate process or paid-call retry', async () => {
  const f = fixture(); await f.active(); await f.supervisor.tick();
  f.container.stop(false); await flush();
  const first = await f.supervisor.status();
  assert.equal(first.lastCycle?.status, 'failed');
  assert.equal(first.nextAttemptAt, f.now() + 60000);
  await f.supervisor.tick(); assert.equal(f.container.starts.length, 2);
  f.advance(59999); await f.supervisor.tick(); assert.equal(f.container.starts.length, 2);
  f.advance(1); await f.supervisor.tick(); assert.equal(f.container.starts.length, 3);
  f.container.stop(false); await flush();
  assert.equal((await f.supervisor.status()).nextAttemptAt, f.now() + 120000);
  assert.equal(f.container.execs.length, 1);
});

test('start failure does not retry inline and respects persisted backoff', async () => {
  const f = fixture(); await f.active(); f.container.startFailure = true;
  await fails(f.supervisor.tick());
  await f.supervisor.tick();
  assert.equal(f.container.starts.length, 2);
  assert.equal((await f.supervisor.status()).lastCycle?.status, 'failed');
  const recreated = f.create(); await recreated.tick();
  assert.equal(f.container.starts.length, 2);
});

test('lost exit observation pauses before another cycle, and stale completion cannot clobber new run', async () => {
  const f = fixture(); await f.active(); await f.supervisor.tick();
  const oldMonitor = f.container.monitors.at(-1)!;
  const oldRun = (await f.supervisor.status()).lastCycle!.runId;
  f.container.stop(true, false); f.advance(60000);
  const lost = await f.supervisor.tick();
  assert.equal(lost.lastCycle?.status, 'unknown');
  assert.equal(f.container.starts.length, 2);
  f.advance(60000); await f.supervisor.tick();
  const beforeLateCompletion = await f.supervisor.status();
  const newRun = beforeLateCompletion.lastCycle!.runId;
  assert.notEqual(newRun, oldRun);
  oldMonitor.reject(new Error('PRIVATE_LATE_ERROR')); await flush();
  const report = await f.supervisor.status();
  assert.equal(report.lastCycle?.runId, newRun);
  assert.equal(report.lastCycle?.status, 'running');
  assert.equal(report.nextAttemptAt, beforeLateCompletion.nextAttemptAt);
  f.container.stop(); await flush();
});

test('busy foreign run or image is never stopped or replaced', async t => {
  for (const kind of ['image', 'run'] as const) await t.test(kind, async () => {
    const f = fixture(); await f.active(); await f.supervisor.tick();
    const destroysBefore = f.container.destroys.length;
    if (kind === 'image') f.container.current!.image = OTHER_IMAGE;
    else f.container.current!.labels.run = 'foreign-run';
    await fails(f.supervisor.tick());
    assert.equal(f.container.starts.length, 2);
    assert.equal(f.container.destroys.length, destroysBefore);
    f.container.stop(); await flush();
  });
});
