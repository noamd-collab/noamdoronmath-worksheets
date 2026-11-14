/** Fixed singleton supervisor. It never accepts lesson data or arbitrary commands. */
export interface RuntimeEnv {
  SOURCE_SHA: string;
  CF_VERSION_METADATA: { id: string };
  TEACHER_GENERATION_SERVICE_KEY: string;
  QWEN_API_KEY: string;
  QWEN_BASE_URL: string;
  QWEN_MODEL: string;
}
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
const PROOF_AGE_MS = 15 * 60 * 1000;

function same(a: Identity | null, b: Identity): boolean {
  return !!a && a.sourceSha === b.sourceSha && a.imageRef === b.imageRef && a.versionId === b.versionId;
}
function failure(): Error { return new Error('CLOUD_OPERATION_FAILED'); }

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
    private readonly now = () => Date.now(), private readonly randomId = () => crypto.randomUUID()) {}

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
    const values = {
      TEACHER_GENERATION_SERVICE_KEY: this.env.TEACHER_GENERATION_SERVICE_KEY,
      QWEN_API_KEY: this.env.QWEN_API_KEY,
      QWEN_BASE_URL: this.env.QWEN_BASE_URL,
      QWEN_MODEL: this.env.QWEN_MODEL,
      ELEMENTARY_SKILL_PATH: '/opt/noam/skills/elementary',
      MIDDLE_SKILL_PATH: '/opt/noam/skills/middle',
    };
    if (Object.values(values).some(value => typeof value !== 'string' || !value || value.includes('\0'))) throw failure();
    return values;
  }
  private async report() {
    const state = await this.state();
    const info = this.container.running ? await this.container.inspect() : null;
    return { schemaVersion: 1, ...this.identity(), doId: this.doId, mode: state.mode,
      running: this.container.running, observedImage: info?.image || null,
      preflight: state.preflight, approved: state.approved, lastCycle: state.lastCycle,
      nextAttemptAt: state.nextAttemptAt };
  }
  status() { return this.locked(() => this.report()); }

  preflight() {
    return this.locked(async () => {
      const state = await this.state();
      if (state.mode !== 'disabled' || this.container.running) throw failure();
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
        await this.container.setInactivityTimeout(180000);
        const process = await this.container.exec(['/usr/local/bin/python', '-B',
          '/opt/noam/app/remote_worker.py', '--check-only'], { env: runtimeEnv, stdout: 'pipe', stderr: 'ignore' });
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
        const info = await this.container.inspect();
        if (info?.image !== identity.imageRef || info.labels.run !== runId) throw failure();
        // An explicit reason makes monitor reject, never masquerade as a successful worker cycle.
        await this.container.destroy('PREFLIGHT_COMPLETE');
        owned = false;
        state.preflight = { ...identity, status: 'PASS', observedImage: info.image,
          checkedAt: new Date(this.now()).toISOString(), claimVerified: false,
          providerCalled: false, heartbeatWritten: false };
        await this.store.put('state', state);
        return this.report();
      } catch {
        if (owned) {
          const info = await this.container.inspect().catch(() => null);
          if (info?.labels.run === runId) await this.container.destroy('PREFLIGHT_FAILED').catch(() => undefined);
        }
        throw failure();
      } finally { if (timer) clearTimeout(timer); }
    });
  }

  activate(requested: Identity) {
    return this.locked(async () => {
      const state = await this.state();
      const identity = this.identity();
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
      return this.report();
    });
  }

  private watch(cycle: Cycle) {
    if (this.monitoredRun === cycle.runId) return;
    this.monitoredRun = cycle.runId;
    const finish = (ok: boolean) => this.locked(async () => {
      const state = await this.state();
      if (state.lastCycle?.runId !== cycle.runId) return;
      state.lastCycle = { ...cycle, status: ok ? 'exited' : 'failed', completedAt: new Date(this.now()).toISOString() };
      state.failures = ok ? 0 : Math.min(state.failures + 1, 5);
      state.nextAttemptAt = ok ? 0 : this.now() + Math.min(15, 2 ** (state.failures - 1)) * 60000;
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
        const info = await this.container.inspect();
        if (info?.image && info.image !== identity.imageRef) throw failure();
        if (!state.lastCycle || info?.labels.run !== state.lastCycle.runId) throw failure();
        await this.container.setInactivityTimeout(INACTIVITY_MS);
        this.watch(state.lastCycle);
        return this.report();
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
        await this.container.setInactivityTimeout(INACTIVITY_MS);
        this.watch(cycle);
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
