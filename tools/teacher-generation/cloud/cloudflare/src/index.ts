import { DurableObject } from 'cloudflare:workers';
import { Supervisor, INACTIVITY_MS, type ContainerPort, type Identity, type RuntimeEnv } from './controller.ts';
import { route } from './router.ts';

interface Env extends RuntimeEnv {
  TEACHER_CLOUD_OPERATOR_KEY: string;
  GENERATOR: DurableObjectNamespace<TeacherGenerationContainer>;
}
export class TeacherGenerationContainer extends DurableObject<Env> {
  private readonly supervisor: Supervisor;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const container = ctx.container;
    if (!container) throw new Error('CONTAINER_NOT_CONFIGURED');
    const bridge: ContainerPort = {
      get running() { return container.running; },
      get images() { return container.images; },
      start: options => container.start(options),
      inspect: () => container.inspect(),
      setInactivityTimeout: ms => container.setInactivityTimeout(ms),
      monitor: () => container.monitor(),
      destroy: reason => container.destroy(reason),
      exec: (command, options) => container.exec(command, options),
    };
    // Cloudflare resets this setting when a Durable Object is recreated.
    if (container.running) void ctx.blockConcurrencyWhile(() => container.setInactivityTimeout(INACTIVITY_MS));
    this.supervisor = new Supervisor(bridge, ctx.storage, env, ctx.id.toString(), promise => ctx.waitUntil(promise));
  }
  status() { return this.supervisor.status(); }
  preflight() { return this.supervisor.preflight(); }
  activate(identity: Identity) { return this.supervisor.activate(identity); }
  deactivate() { return this.supervisor.deactivate(); }
  tick() { return this.supervisor.tick(); }
}
export default {
  fetch(request: Request, env: Env) { return route(request, env); },
  async scheduled(_controller: ScheduledController, env: Env) {
    try { await env.GENERATOR.getByName('primary').tick(); }
    catch { console.error(JSON.stringify({ event: 'teacher_cloud_cycle_unavailable' })); }
  },
} satisfies ExportedHandler<Env>;
