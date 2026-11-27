import { within, type Identity } from './controller.ts';

export interface OperatorRpc {
  status(): Promise<unknown>;
  preflight(): Promise<unknown>;
  activate(identity: Identity): Promise<unknown>;
  deactivate(): Promise<unknown>;
  tick(): Promise<unknown>;
}
export interface RouterEnv {
  TEACHER_CLOUD_OPERATOR_KEY: string;
  GENERATOR: { getByName(name: string): OperatorRpc };
}
/** Longest wait for the Durable Object, per operation. Without it a request waits for as long as its caller
 *  stays connected, and on 2026-11-25 that was the only thing an operator could see: no answer at all.
 *  Each limit is above the object's own worst case: status 20 s, a tick 40 s, a preflight 270 s behind a tick. */
export const ROUTE_MS = { status: 30 * 1000, preflight: 330 * 1000, other: 90 * 1000 };
/** A cron tick gives up before the next minute so that an unanswering object is not also kept busy by its own callers. */
export const CRON_MS = 45 * 1000;
function response(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'Cache-Control': 'private, no-store',
    'X-Content-Type-Options': 'nosniff', 'X-Robots-Tag': 'noindex, nofollow' } });
}
async function authorized(request: Request, expected: string): Promise<boolean> {
  // An administrative server-to-server API, never a browser session or public wake endpoint.
  if (request.headers.has('Origin') || typeof expected !== 'string' || !/^[a-f0-9]{64}$/.test(expected)) return false;
  const value = request.headers.get('Authorization') ?? '';
  if (!/^Bearer [a-f0-9]{64}$/.test(value)) return false;
  const hash = (text: string) => crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  const [a, b] = await Promise.all([hash(value.slice(7)), hash(expected)]);
  const aa = new Uint8Array(a), bb = new Uint8Array(b);
  let difference = 0;
  for (let i = 0; i < aa.length; i++) difference |= aa[i] ^ bb[i];
  return difference === 0;
}
async function readObject(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get('Content-Type')?.split(';')[0].trim() !== 'application/json') throw new Error('BAD_REQUEST');
  const reader = request.body?.getReader();
  if (!reader) throw new Error('BAD_REQUEST');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.byteLength;
      if (size > 512) { await reader.cancel(); throw new Error('BAD_REQUEST'); }
      chunks.push(part.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.length; }
  const parsed = JSON.parse(new TextDecoder().decode(data));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('BAD_REQUEST');
  return parsed;
}
export async function route(request: Request, env: RouterEnv, limits = ROUTE_MS): Promise<Response> {
  const url = new URL(request.url);
  const paths = new Set(['/operator/status', '/operator/preflight', '/operator/activate', '/operator/deactivate', '/operator/tick']);
  if (!paths.has(url.pathname) || url.search || !await authorized(request, env.TEACHER_CLOUD_OPERATOR_KEY)) {
    return response({ error: 'NOT_FOUND' }, 404);
  }
  let late = false;
  const answer = async (operation: () => Promise<unknown>, ms: number) => {
    try { return response(await within(operation(), ms, () => { late = true; })); }
    catch { return late ? response({ error: 'CLOUD_OPERATION_TIMEOUT' }, 504) : response({ error: 'CLOUD_OPERATION_FAILED' }, 503); }
  };
  if (url.pathname === '/operator/status') {
    if (request.method !== 'GET') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    return answer(() => env.GENERATOR.getByName('primary').status(), limits.status);
  }
  if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
  let body: Record<string, unknown>;
  try {
    body = await readObject(request);
    if (url.pathname === '/operator/activate') {
      if (Object.keys(body).sort().join(',') !== 'imageRef,sourceSha,versionId' ||
          !Object.values(body).every(value => typeof value === 'string')) throw new Error('BAD_REQUEST');
    } else if (Object.keys(body).length) throw new Error('BAD_REQUEST');
  } catch { return response({ error: 'BAD_REQUEST' }, 400); }
  const stub = env.GENERATOR.getByName('primary');
  if (url.pathname === '/operator/preflight') return answer(() => stub.preflight(), limits.preflight);
  if (url.pathname === '/operator/activate') return answer(() => stub.activate(body as unknown as Identity), limits.other);
  if (url.pathname === '/operator/deactivate') return answer(() => stub.deactivate(), limits.other);
  return answer(() => stub.tick(), limits.other);
}
/** One cron tick. Never throws; one log line when the object refused or did not answer in time. */
export async function cron(env: Pick<RouterEnv, 'GENERATOR'>, ms = CRON_MS, log: (line: string) => void = console.error) {
  let late = false;
  try { await within(env.GENERATOR.getByName('primary').tick(), ms, () => { late = true; }); }
  catch { log(JSON.stringify({ event: late ? 'teacher_cloud_cycle_timeout' : 'teacher_cloud_cycle_unavailable' })); }
}
