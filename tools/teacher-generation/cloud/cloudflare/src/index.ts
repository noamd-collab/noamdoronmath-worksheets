import { DurableObject } from 'cloudflare:workers';
import { Supervisor, rearm, type ContainerPort, type Identity, type RuntimeEnv } from './controller.ts';
import { cron, route } from './router.ts';

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
    rearm(bridge, promise => ctx.waitUntil(promise));
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
  scheduled(_controller: ScheduledController, env: Env) { return cron(env); },
} satisfies ExportedHandler<Env>;
