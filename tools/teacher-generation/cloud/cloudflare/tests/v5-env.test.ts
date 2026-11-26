// Stage 4b: the two worksheet-wire/5 operator switches reach the container only in their exact form.
import assert from 'node:assert/strict';
import test from 'node:test';
import { Supervisor, type ContainerPort, type Identity, type RuntimeEnv, type StateStore } from '../src/controller.ts';

const IMAGE = `registry.cloudflare.com/test/worker@sha256:${'a'.repeat(64)}`;
const PASS = JSON.stringify({ event: 'worker_preflight_pass', claimVerified: false,
  providerCalled: false, heartbeatWritten: false });
const BASE_KEYS = ['ELEMENTARY_SKILL_PATH', 'MIDDLE_SKILL_PATH', 'QWEN_API_KEY', 'QWEN_BASE_URL', 'QWEN_MODEL',
  'TEACHER_GENERATION_SERVICE_KEY'];

class MemoryStore implements StateStore {
  values = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> { return structuredClone(this.values.get(key)) as T | undefined; }
  async put<T>(key: string, value: T) { this.values.set(key, structuredClone(value)); }
}
class FakeContainer implements ContainerPort {
  running = false;
  images = { worker: IMAGE };
  starts: Parameters<ContainerPort['start']>[0][] = [];
  execs: { command: string[]; options: Parameters<ContainerPort['exec']>[1] }[] = [];
  current: { image: string; labels: Record<string, string> } | null = null;
  start(options: Parameters<ContainerPort['start']>[0]) {
    this.starts.push(structuredClone(options));
    assert.equal(this.running, false);
    this.running = true;
    this.current = { image: options.image, labels: structuredClone(options.labels) };
  }
  async inspect() { return structuredClone(this.current); }
  async setInactivityTimeout() { /* not under test */ }
  monitor() { return new Promise<void>(() => undefined); }
  async destroy() { this.running = false; this.current = null; }
  async exec(command: string[], options: Parameters<ContainerPort['exec']>[1]) {
    this.execs.push(structuredClone({ command, options }));
    const bytes = new TextEncoder().encode(PASS);
    return { stdout: new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes); c.close(); } }),
      exitCode: Promise.resolve(0), kill: () => undefined };
  }
}
function fixture(switches: Partial<Pick<RuntimeEnv, 'TEACHER_V5_TOPICS' | 'TEACHER_V5_SITE_READY'>> = {}) {
  const container = new FakeContainer();
  const env: RuntimeEnv = { SOURCE_SHA: 'c'.repeat(40), CF_VERSION_METADATA: { id: 'test-version-1' },
    TEACHER_GENERATION_SERVICE_KEY: 'PRIVATE_SERVICE_SECRET', QWEN_API_KEY: 'PRIVATE_PROVIDER_SECRET',
    QWEN_BASE_URL: 'https://fixed.example.invalid/v1', QWEN_MODEL: 'fixed-model', ...switches };
  let sequence = 0;
  const supervisor = new Supervisor(container, new MemoryStore(), env, 'fixed-do-id', () => undefined,
    () => Date.UTC(2026, 10, 25, 12, 0, 0), () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, '0')}`);
  const identity = (): Identity => ({ sourceSha: env.SOURCE_SHA, imageRef: IMAGE, versionId: env.CF_VERSION_METADATA.id });
  return { container, env, supervisor, identity };
}
const fails = (promise: Promise<unknown>) => assert.rejects(promise, /^Error: CLOUD_OPERATION_FAILED$/);
/** The env of the read-only preflight command and of the job cycle that follows activation. */
async function forwarded(switches: Parameters<typeof fixture>[0]) {
  const f = fixture(switches);
  await f.supervisor.preflight();
  await f.supervisor.activate(f.identity());
  await f.supervisor.tick();
  assert.equal(f.container.starts.length, 2);
  assert.deepEqual(f.container.starts[0].env, {}); // the preflight container itself gets no credentials
  return { check: f.container.execs[0].options.env, cycle: f.container.starts[1].env, f };
}

test('unset or empty switches forward nothing: the container sees exactly the six base variables', async () => {
  for (const switches of [{}, { TEACHER_V5_TOPICS: '' }, { TEACHER_V5_SITE_READY: '' },
    { TEACHER_V5_TOPICS: '', TEACHER_V5_SITE_READY: '' }]) {
    const { check, cycle } = await forwarded(switches);
    assert.deepEqual(Object.keys(check).sort(), BASE_KEYS);
    assert.deepEqual(Object.keys(cycle).sort(), BASE_KEYS);
  }
});

test('exact switches are forwarded verbatim to the preflight check and to the job cycle', async () => {
  const topics = 'g7:algebraic_expressions,ד10,g9r:probability';
  const both = await forwarded({ TEACHER_V5_TOPICS: topics, TEACHER_V5_SITE_READY: '1' });
  for (const env of [both.check, both.cycle]) {
    assert.deepEqual(Object.keys(env).sort(), [...BASE_KEYS, 'TEACHER_V5_SITE_READY', 'TEACHER_V5_TOPICS'].sort());
    assert.equal(env.TEACHER_V5_TOPICS, topics);
    assert.equal(env.TEACHER_V5_SITE_READY, '1');
  }
  assert.equal(JSON.stringify(await both.f.supervisor.status()).includes('TEACHER_V5'), false);
  const listed = await forwarded({ TEACHER_V5_TOPICS: 'g7:algebraic_expressions' });
  assert.equal(listed.cycle.TEACHER_V5_TOPICS, 'g7:algebraic_expressions');
  assert.equal('TEACHER_V5_SITE_READY' in listed.cycle, false);
  const ready = await forwarded({ TEACHER_V5_SITE_READY: '1' });
  assert.equal(ready.cycle.TEACHER_V5_SITE_READY, '1');
  assert.equal('TEACHER_V5_TOPICS' in ready.cycle, false);
});

test('a malformed switch fails closed: preflight refuses and no container starts', async () => {
  const bad: Parameters<typeof fixture>[0][] = [
    ...['0', 'true', ' 1', '1 ', '01', '1\n', 'yes'].map(value => ({ TEACHER_V5_SITE_READY: value })),
    ...['g7:Algebra', 'g7:a, g7:b', ',g7:a', 'g7:a,', 'g7:a,,g7:b', 'g7', 'ז10', 'g6:a', 'g7:a\0', 'g7:a\n', '*',
      Array.from({ length: 41 }, (_, i) => `g7:t${i}`).join(',')].map(value => ({ TEACHER_V5_TOPICS: value })),
    { TEACHER_V5_TOPICS: 'g7:algebraic_expressions', TEACHER_V5_SITE_READY: 'on' },
    { TEACHER_V5_TOPICS: 7 as unknown as string }, { TEACHER_V5_SITE_READY: 1 as unknown as string },
  ];
  for (const switches of bad) {
    const f = fixture(switches);
    await fails(f.supervisor.preflight());
    assert.equal(f.container.starts.length, 0, JSON.stringify(switches));
    assert.equal(f.container.execs.length, 0);
    await fails(f.supervisor.activate(f.identity()));
  }
});

test('a switch that turns malformed after activation starts no job cycle', async () => {
  const f = fixture({ TEACHER_V5_TOPICS: 'g7:algebraic_expressions', TEACHER_V5_SITE_READY: '1' });
  await f.supervisor.preflight();
  await f.supervisor.activate(f.identity());
  f.env.TEACHER_V5_SITE_READY = 'true';
  await fails(f.supervisor.tick());
  assert.equal(f.container.starts.length, 1); // the preflight only
  assert.equal(f.container.running, false);
});

test('the list limits are exact: 40 ids and 2000 characters pass, one more of either is refused', async () => {
  const forty = Array.from({ length: 40 }, (_, i) => `g7:t${i}`).join(',');
  assert.equal((await forwarded({ TEACHER_V5_TOPICS: forty })).cycle.TEACHER_V5_TOPICS, forty);
  const long = (count: number, tail: number) => [...Array.from({ length: count - 1 }, () => 'g8:' + 'a'.repeat(81)),
    'g8:' + 'a'.repeat(tail)].join(',');
  // 23 ids of 84 characters, 23 commas, and a last id sized to land exactly on the limit.
  const exact = long(24, 2000 - (23 * 84 + 23) - 3);
  assert.equal(exact.length, 2000);
  assert.equal((await forwarded({ TEACHER_V5_TOPICS: exact })).cycle.TEACHER_V5_TOPICS, exact);
  const over = long(24, 2001 - (23 * 84 + 23) - 3);
  assert.equal(over.length, 2001);
  for (const value of [over, Array.from({ length: 41 }, (_, i) => `g7:t${i}`).join(',')]) {
    const f = fixture({ TEACHER_V5_TOPICS: value });
    await fails(f.supervisor.preflight());
    assert.equal(f.container.starts.length, 0);
  }
});

test('a value that is not a string is refused even when its text form would pass', async () => {
  for (const switches of [{ TEACHER_V5_TOPICS: ['g7:a', 'g7:b'] as unknown as string },
    { TEACHER_V5_SITE_READY: ['1'] as unknown as string }, { TEACHER_V5_TOPICS: { toString: () => 'g7:a' } as unknown as string }]) {
    const f = fixture(switches);
    await fails(f.supervisor.preflight());
    assert.equal(f.container.starts.length, 0, JSON.stringify(switches));
  }
});

test('a tick refused for a malformed switch is recorded as a failed cycle with a one-minute pause', async () => {
  const f = fixture({ TEACHER_V5_TOPICS: 'g7:algebraic_expressions', TEACHER_V5_SITE_READY: '1' });
  await f.supervisor.preflight();
  await f.supervisor.activate(f.identity());
  f.env.TEACHER_V5_TOPICS = 'g7:a, g7:b';
  await fails(f.supervisor.tick());
  const status = await f.supervisor.status();
  assert.equal(status.lastCycle?.status, 'failed');
  assert.equal(status.nextAttemptAt, Date.UTC(2026, 10, 25, 12, 0, 0) + 60000);
  assert.equal(status.running, false);
  assert.equal(f.container.starts.length, 1);
});

test('a switch that turns malformed after a fresh PASS cannot be activated', async () => {
  const f = fixture({ TEACHER_V5_TOPICS: 'g7:algebraic_expressions', TEACHER_V5_SITE_READY: '1' });
  assert.equal((await f.supervisor.preflight()).preflight?.status, 'PASS');
  f.env.TEACHER_V5_SITE_READY = 'yes';
  await fails(f.supervisor.activate(f.identity()));
  assert.equal((await f.supervisor.status()).mode, 'disabled');
  f.env.TEACHER_V5_SITE_READY = '1';
  assert.equal((await f.supervisor.activate(f.identity())).mode, 'active');
});
