import type { Identity } from './controller.ts';

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
export async function route(request: Request, env: RouterEnv): Promise<Response> {
  const url = new URL(request.url);
  const paths = new Set(['/operator/status', '/operator/preflight', '/operator/activate', '/operator/deactivate', '/operator/tick']);
  if (!paths.has(url.pathname) || url.search || !await authorized(request, env.TEACHER_CLOUD_OPERATOR_KEY)) {
    return response({ error: 'NOT_FOUND' }, 404);
  }
  if (url.pathname === '/operator/status') {
    if (request.method !== 'GET') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try { return response(await env.GENERATOR.getByName('primary').status()); }
    catch { return response({ error: 'CLOUD_OPERATION_FAILED' }, 503); }
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
  try {
    if (url.pathname === '/operator/preflight') return response(await stub.preflight());
    if (url.pathname === '/operator/activate') return response(await stub.activate(body as unknown as Identity));
    if (url.pathname === '/operator/deactivate') return response(await stub.deactivate());
    return response(await stub.tick());
  } catch { return response({ error: 'CLOUD_OPERATION_FAILED' }, 503); }
}
