/** Fixed singleton supervisor. It never accepts lesson data or arbitrary commands. */
export interface RuntimeEnv {
  SOURCE_SHA: string;
  CF_VERSION_METADATA: { id: string };
  TEACHER_GENERATION_SERVICE_KEY: string;
  QWEN_API_KEY: string;
  QWEN_BASE_URL: string;
  QWEN_MODEL: string;
  // Author switch (qwen when unset) and the Gemini author's own credential and
  // model. Optional: the worker's preflight fails closed on an unknown or
  // unconfigured provider.
  TEACHER_AUTHOR_PROVIDER?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  /** Operator switches of the worksheet-wire/5 route (V5-DESIGN §14). Plain Worker vars, unset or empty by default. */
  TEACHER_V5_TOPICS?: string;
  TEACHER_V5_SITE_READY?: string;
}
// The worker's own topic-id grammar (teacherGenerationContract.ts), as a comma list without spaces.
const V5_TOPIC = '(?:[א-ו]\\d{2}|g(?:7|8|9r|9m):[a-z][a-z0-9_]{0,80})';
const V5_TOPIC_LIST = new RegExp(`^${V5_TOPIC}(?:,${V5_TOPIC}){0,39}$`, 'u');
export interface ContainerPort {
  running: boolean;
  images: Record<string, string>;
  start(options: { image: string; instance: 'standard-1'; enableInternet: boolean;
    env: Record<string, string>; labels: Record<string, string>; entrypoint?: string[] }): void;
  inspect(): Promise<{ image: string; labels: Record<string, string> } | null>;
  setInactivityTimeout(ms: number): Promise<void>;
  monitor(): Promise<void>;
  destroy(reason: string): Promise<void>;
  exec(command: string[], options: { env: Record<string, string>; stdout: 'pipe'; stderr: 'ignore' }): Promise<{
    stdout: ReadableStream<Uint8Array> | null | undefined;
    exitCode: Promise<number>;
    kill(signal: number): void;
  }>;
}
export interface StateStore {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<unknown>;
}
export interface Identity { sourceSha: string; imageRef: string; versionId: string }
export interface PreflightProof extends Identity {
  status: 'PASS'; observedImage: string; checkedAt: string;
  claimVerified: false; providerCalled: false; heartbeatWritten: false;
}
interface Cycle extends Identity {
  runId: string; startedAt: string; completedAt?: string;
  status: 'running' | 'exited' | 'failed' | 'unknown';
}
interface SavedState {
  mode: 'disabled' | 'active';
  preflight: PreflightProof | null;
  approved: (Identity & { activatedAt: string }) | null;
  lastCycle: Cycle | null;
  failures: number;
  nextAttemptAt: number;
  lastStartMinute: number;
}
const EMPTY = (): SavedState => ({ mode: 'disabled', preflight: null, approved: null,
  lastCycle: null, failures: 0, nextAttemptAt: 0, lastStartMinute: -1 });
export const INACTIVITY_MS = 30 * 60 * 1000;
/** Longest wait for one container-API call. On 2026-11-25 one such call stayed pending for 5 h 36 min;
 *  through the serial queue it took status, deactivate and every cron tick down with it. */
export const PLATFORM_CALL_MS = 20 * 1000;
const PROOF_AGE_MS = 15 * 60 * 1000;

function same(a: Identity | null, b: Identity): boolean {
  return !!a && a.sourceSha === b.sourceSha && a.imageRef === b.imageRef && a.versionId === b.versionId;
}
function failure(): Error { return new Error('CLOUD_OPERATION_FAILED'); }

/** Settles within `ms`. A late answer from the platform is dropped, never acted on. */
export function within<T>(call: Promise<T>, ms: number, onLate?: () => void): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const late = new Promise<never>((_, reject) => { timer = setTimeout(() => { onLate?.(); reject(failure()); }, ms); });
  return Promise.race([call, late]).finally(() => clearTimeout(timer));
}
/** After a rebuild the platform has forgotten the inactivity setting of a container that is still running.
 *  Not under blockConcurrencyWhile: an unanswered call there would reset the object every 30 seconds.
 *  One attempt; a busy tick of an active release repeats it every minute. */
export function rearm(container: ContainerPort, waitUntil: (promise: Promise<unknown>) => void, ms = PLATFORM_CALL_MS,
  log: (line: string) => void = console.error) {
  if (container.running) waitUntil(within(container.setInactivityTimeout(INACTIVITY_MS), ms)
    .catch(() => log(JSON.stringify({ event: 'teacher_cloud_rearm_unconfirmed' }))));
}
/** The two worksheet-wire/5 switches in the only form that is forwarded; anything else throws.
 *  A test runs the values committed in wrangler.jsonc through it, so a bad one fails before a release. */
export function v5Switches(topics: unknown, ready: unknown): Record<string, string> {
  if (typeof topics !== 'string' || typeof ready !== 'string') throw failure();
  const values: Record<string, string> = {};
  if (topics !== '') {
    if (topics.length > 2000 || !V5_TOPIC_LIST.test(topics)) throw failure();
    values.TEACHER_V5_TOPICS = topics;
  }
  if (ready !== '') {
    if (ready !== '1') throw failure();
    values.TEACHER_V5_SITE_READY = ready;
  }
  return values;
}

async function boundedText(stream: ReadableStream<Uint8Array> | null | undefined): Promise<string> {
  if (!stream) throw failure();
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 4096) throw failure();
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const joined = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder().decode(joined);
}

export class Supervisor {
  private serial: Promise<unknown> = Promise.resolve();
  private monitoredRun: string | null = null;
  constructor(private readonly container: ContainerPort, private readonly store: StateStore,
    private readonly env: RuntimeEnv, private readonly doId: string,
    private readonly waitUntil: (promise: Promise<unknown>) => void,
    private readonly now = () => Date.now(), private readonly randomId = () => crypto.randomUUID(),
    private readonly callMs = PLATFORM_CALL_MS) {}

  // Every awaited container call goes through here, so the serial queue always moves on.
  // The log line names the call that went unanswered and nothing else.
  private bounded<T>(call: string, answer: Promise<T>, ms = this.callMs, onLate?: () => void) {
    return within(answer, ms, () => {
      console.error(JSON.stringify({ event: 'teacher_cloud_platform_timeout', call }));
      onLate?.();
    });
  }
  private inspect() { return this.bounded('inspect', this.container.inspect()); }
  private keepAlive(ms: number) { return this.bounded('setInactivityTimeout', this.container.setInactivityTimeout(ms)); }
  // The answer can be dropped, the call cannot be withdrawn: a destroy carried out late would stop
  // whatever container runs then. Until it settles this instance starts no preflight container.
  private unsettledDestroys = 0;
  private destroy(reason: string) {
    const answer = this.container.destroy(reason);
    return this.bounded('destroy', answer, this.callMs, () => {
      this.unsettledDestroys++;
      void answer.catch(() => undefined).then(() => { this.unsettledDestroys--; });
    });
  }

  private locked<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.serial.then(operation);
    this.serial = result.catch(() => undefined);
    return result;
  }
  private async state(): Promise<SavedState> { return await this.store.get<SavedState>('state') ?? EMPTY(); }
  private identity(): Identity {
    const result = { sourceSha: this.env.SOURCE_SHA, versionId: this.env.CF_VERSION_METADATA?.id,
      imageRef: this.container.images.worker };
    if (!/^[a-f0-9]{40}$/.test(result.sourceSha ?? '') ||
        !/^[A-Za-z0-9-]{1,80}$/.test(result.versionId ?? '') ||
        !/^[A-Za-z0-9._:/-]+@sha256:[a-f0-9]{64}$/.test(result.imageRef ?? '')) throw failure();
    return result;
  }
  private runtimeEnv(): Record<string, string> {
    const values: Record<string, string> = {
      TEACHER_GENERATION_SERVICE_KEY: this.env.TEACHER_GENERATION_SERVICE_KEY,
      QWEN_API_KEY: this.env.QWEN_API_KEY,
      QWEN_BASE_URL: this.env.QWEN_BASE_URL,
      QWEN_MODEL: this.env.QWEN_MODEL,
      ELEMENTARY_SKILL_PATH: '/opt/noam/skills/elementary',
      MIDDLE_SKILL_PATH: '/opt/noam/skills/middle',
    };
    if (Object.values(values).some(value => typeof value !== 'string' || !value || value.includes('\0'))) throw failure();
    const optional: Record<string, string | undefined> = {
      TEACHER_AUTHOR_PROVIDER: this.env.TEACHER_AUTHOR_PROVIDER,
      GEMINI_API_KEY: this.env.GEMINI_API_KEY,
      GEMINI_MODEL: this.env.GEMINI_MODEL,
    };
    const selected: Record<string, string> = {};
    for (const [name, value] of Object.entries(optional)) {
      // Unset or empty stays unset: the worker then keeps its default author.
      if (value === undefined || value === null || value === '') continue;
      if (typeof value !== 'string' || value.includes('\0')) throw failure();
      selected[name] = value;
    }
    // Each v5 switch is forwarded only in its exact form; unset or empty forwards nothing (the old path runs).
    // A malformed value fails closed here, so a preflight refuses the release instead of running half-switched.
    return { ...values, ...selected, ...v5Switches(this.env.TEACHER_V5_TOPICS ?? '', this.env.TEACHER_V5_SITE_READY ?? '') };
  }
  private async report(lenient = false, seen?: Awaited<ReturnType<ContainerPort['inspect']>>) {
    const state = await this.state();
    // Status still answers from stored state when the container cannot be inspected: running
    // with observedImage null. Every other caller keeps failing closed.
    const info = !this.container.running ? null : seen !== undefined ? seen
      : lenient ? await this.inspect().catch(() => null) : await this.inspect();
    return { schemaVersion: 1, ...this.identity(), doId: this.doId, mode: state.mode,
      running: this.container.running, observedImage: info?.image || null,
      preflight: state.preflight, approved: state.approved, lastCycle: state.lastCycle,
      nextAttemptAt: state.nextAttemptAt };
  }
  // Read-only, so not queued: it answers while a preflight or a slow tick holds the queue.
  async status() { return this.report(true); }

  preflight() {
    return this.locked(async () => {
      const state = await this.state();
      if (state.mode !== 'disabled' || this.container.running || this.unsettledDestroys) throw failure();
      const identity = this.identity();
      const runtimeEnv = this.runtimeEnv();
      const runId = this.randomId();
      // Invalidate an older PASS before beginning another check.
      state.preflight = null;
      await this.store.put('state', state);
      let owned = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let exited = false;
      try {
        // No queue consumer is started: the image's normal entrypoint is overridden.
        this.container.start({ image: identity.imageRef, instance: 'standard-1', enableInternet: true,
          env: {}, labels: { run: runId, source: identity.sourceSha, mode: 'preflight' },
          entrypoint: ['/usr/bin/tini', '--', '/usr/local/bin/python', '-c', 'import time; time.sleep(180)'] });
        owned = true;
        await this.keepAlive(180000);
        // exec also waits for a container that is still starting, so it gets three times the limit.
        const started = this.container.exec(['/usr/local/bin/python', '-B',
          '/opt/noam/app/remote_worker.py', '--check-only'], { env: runtimeEnv, stdout: 'pipe', stderr: 'ignore' });
        // A check that starts after nobody waits for it is stopped, and its exit is nobody's error.
        const process = await this.bounded('exec', started, 3 * this.callMs, () => void started.then(late => {
          void late.exitCode.catch(() => undefined);
          try { late.kill(15); } catch { /* never expose platform errors */ }
        }, () => undefined));
        const exit = process.exitCode.then(code => { exited = true; return code; });
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            if (!exited) { try { process.kill(15); } catch { /* never expose platform errors */ } }
            reject(failure());
          }, 150000);
        });
        const [output, exitCode] = await Promise.race([Promise.all([boundedText(process.stdout), exit]), timeout]);
        const result = JSON.parse(output.trim());
        const expected = ['claimVerified', 'event', 'heartbeatWritten', 'providerCalled'];
        if (exitCode !== 0 || !result || Object.keys(result).sort().join(',') !== expected.join(',') ||
            result.event !== 'worker_preflight_pass' || result.claimVerified !== false ||
            result.providerCalled !== false || result.heartbeatWritten !== false) throw failure();
        const info = await this.inspect();
        if (info?.image !== identity.imageRef || info.labels.run !== runId) throw failure();
        // An explicit reason makes monitor reject, never masquerade as a successful worker cycle.
        await this.destroy('PREFLIGHT_COMPLETE');
        owned = false;
        state.preflight = { ...identity, status: 'PASS', observedImage: info.image,
          checkedAt: new Date(this.now()).toISOString(), claimVerified: false,
          providerCalled: false, heartbeatWritten: false };
        await this.store.put('state', state);
        return this.report();
      } catch {
        // With a destroy already on its way a second one is not sent: neither can be withdrawn.
        if (owned && !this.unsettledDestroys) {
          const info = await this.inspect().catch(() => null);
          if (info?.labels.run === runId) await this.destroy('PREFLIGHT_FAILED').catch(() => undefined);
        }
        throw failure();
      } finally { if (timer) clearTimeout(timer); }
    });
  }

  activate(requested: Identity) {
    return this.locked(async () => {
      const state = await this.state();
      const identity = this.identity();
      this.runtimeEnv();
      const age = this.now() - Date.parse(state.preflight?.checkedAt ?? '');
      if (!same(requested, identity) || !same(state.preflight, identity) ||
          state.preflight?.status !== 'PASS' || state.preflight.observedImage !== identity.imageRef ||
          !Number.isFinite(age) || age < 0 || age > PROOF_AGE_MS || this.container.running) throw failure();
      state.mode = 'active';
      state.approved = { ...identity, activatedAt: new Date(this.now()).toISOString() };
      state.failures = 0; state.nextAttemptAt = 0;
      await this.store.put('state', state);
      return this.report();
    });
  }
  deactivate() {
    return this.locked(async () => {
      const state = await this.state();
      state.mode = 'disabled'; state.approved = null;
      await this.store.put('state', state);
      // Do not interrupt an author request or a render already in progress.
      return this.report(true);
    });
  }

  private watch(cycle: Cycle) {
    if (this.monitoredRun === cycle.runId) return;
    this.monitoredRun = cycle.runId;
    const finish = (ok: boolean) => this.locked(async () => {
      const state = await this.state();
      if (state.lastCycle?.runId !== cycle.runId) return;
      // A run recorded as failed when its start-up call went unanswered is one failure, not two.
      // Its pause still runs from the moment it failed.
      const counted = state.lastCycle.status === 'failed';
      state.lastCycle = { ...cycle, status: ok ? 'exited' : 'failed', completedAt: new Date(this.now()).toISOString() };
      state.failures = ok ? 0 : counted ? state.failures : Math.min(state.failures + 1, 5);
      state.nextAttemptAt = ok ? 0
        : Math.max(state.nextAttemptAt, this.now() + Math.min(15, 2 ** (state.failures - 1)) * 60000);
      await this.store.put('state', state);
    });
    // A successful cycle is not a successful worksheet: only the existing DB result says that.
    this.waitUntil(this.container.monitor().then(() => finish(true), () => finish(false)).catch(() => undefined));
  }
  tick() {
    return this.locked(async () => {
      const state = await this.state();
      const identity = this.identity();
      if (state.mode !== 'active' || !same(state.approved, identity)) return this.report();
      if (this.container.running) {
        const info = await this.inspect();
        if (info?.image && info.image !== identity.imageRef) throw failure();
        if (!state.lastCycle || info?.labels.run !== state.lastCycle.runId) throw failure();
        // Watch first: monitor() reports the run's end and keeps the object with its container,
        // also when the keep-alive below goes unanswered.
        this.watch(state.lastCycle);
        await this.keepAlive(INACTIVITY_MS);
        return this.report(false, info);
      }
      if (state.lastCycle?.status === 'running') {
        // Lost observation is not proof of a clean exit. Pause; the DB lease decides job fate.
        state.lastCycle = { ...state.lastCycle, status: 'unknown', completedAt: new Date(this.now()).toISOString() };
        state.nextAttemptAt = this.now() + 60000;
        await this.store.put('state', state);
        return this.report();
      }
      if (this.now() < state.nextAttemptAt) return this.report();
      // Deduplicate a Cron redelivery or operator tick even if an idle cycle already exited.
      const startMinute = Math.floor(this.now() / 60000);
      if (state.lastStartMinute === startMinute) return this.report();
      const cycle: Cycle = { ...identity, runId: this.randomId(), status: 'running', startedAt: new Date(this.now()).toISOString() };
      state.lastCycle = cycle;
      state.lastStartMinute = startMinute;
      await this.store.put('state', state);
      try {
        this.container.start({ image: identity.imageRef, instance: 'standard-1', enableInternet: true,
          env: this.runtimeEnv(), labels: { run: cycle.runId, source: identity.sourceSha, mode: 'cycle' } });
        this.watch(cycle);
        await this.keepAlive(INACTIVITY_MS);
      } catch {
        // Never start another process here. A subsequent minute uses backoff/DB lease rules.
        state.lastCycle = { ...cycle, status: 'failed', completedAt: new Date(this.now()).toISOString() };
        state.failures = Math.min(state.failures + 1, 5);
        state.nextAttemptAt = this.now() + Math.min(15, 2 ** (state.failures - 1)) * 60000;
        await this.store.put('state', state);
        throw failure();
      }
      return this.report();
    });
  }
}
