import { TEACHER_ACCESS_CONFIG, type TeacherAccessConfig } from './teacherAccessConfig';

export const TEACHER_SESSION_COOKIE = '__Host-noam_teacher_session';
export const TEACHER_SESSION_COOKIE_OPTIONS = Object.freeze({
  httpOnly: true, secure: true, sameSite: 'lax' as const, path: '/',
});
export const TEACHER_PRIVATE_HEADERS = Object.freeze({
  'Cache-Control': 'private, no-store',
  Pragma: 'no-cache',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  Vary: 'Cookie',
});

export type TeacherAccessFailure = {
  ok: false;
  status: 401 | 403 | 503;
  code: 'TEACHER_SIGN_IN_REQUIRED' | 'TEACHER_ACCESS_DENIED' | 'TEACHER_AUTH_UNAVAILABLE';
};
export type TeacherAccessResult =
  | { ok: true; userId: string; /** Unix epoch seconds, matching the validated JWT exp. */ expiresAt: number }
  | TeacherAccessFailure;

export interface TeacherAccessOptions {
  fetch?: typeof fetch;
  config?: Readonly<TeacherAccessConfig>;
  /** Milliseconds since Unix epoch; injectable for deterministic tests. */
  now?: () => number;
  /** May shorten, but never extend, the production timeout. */
  timeoutMs?: number;
}

const AUTH_TIMEOUT_MS = 5000;
const MAX_TOKEN_CHARS = 8192;
const MAX_USER_BYTES = 64 * 1024;
const required = (): TeacherAccessFailure => ({ ok: false, status: 401, code: 'TEACHER_SIGN_IN_REQUIRED' });
const denied = (): TeacherAccessFailure => ({ ok: false, status: 403, code: 'TEACHER_ACCESS_DENIED' });
const unavailable = (): TeacherAccessFailure => ({ ok: false, status: 503, code: 'TEACHER_AUTH_UNAVAILABLE' });
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function validAuthConfig(config: Readonly<TeacherAccessConfig>): boolean {
  return /^https:\/\/[a-z0-9]+\.supabase\.co$/.test(config.supabaseUrl) &&
    /^[A-Za-z0-9._-]{20,4096}$/.test(config.supabaseAnonKey);
}

async function readBoundedUser(response: Response, signal: AbortSignal): Promise<unknown> {
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_USER_BYTES)) throw new Error('AUTH_RESPONSE_SIZE');
  if (!response.body) throw new Error('AUTH_RESPONSE_EMPTY');
  const reader = response.body.getReader();
  const abort = () => { void reader.cancel().catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  const decoder = new TextDecoder('utf-8', { fatal: true });
  let text = '', bytes = 0;
  try {
    for (;;) {
      if (signal.aborted) throw new Error('AUTH_ABORTED');
      const { value, done } = await reader.read();
      if (signal.aborted) throw new Error('AUTH_ABORTED');
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_USER_BYTES) throw new Error('AUTH_RESPONSE_SIZE');
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally {
    signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}

/** The token is opaque until the fixed project's Auth server accepts it.
 * No client profile, unverified JWT claim or user_metadata authorizes access.
 * No successful authorization is cached across requests.
 */
export async function verifyGoogleTeacherToken(token: unknown, options: TeacherAccessOptions = {}): Promise<TeacherAccessResult> {
  if (typeof token !== 'string' || token.length > MAX_TOKEN_CHARS ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) return required();
  const config = options.config ?? TEACHER_ACCESS_CONFIG;
  if (!validAuthConfig(config)) return unavailable();
  const controller = new AbortController();
  const timeout = Number.isFinite(options.timeoutMs)
    ? Math.max(1, Math.min(AUTH_TIMEOUT_MS, options.timeoutMs!)) : AUTH_TIMEOUT_MS;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const operation = (async (): Promise<TeacherAccessResult> => {
      const response = await (options.fetch ?? globalThis.fetch)(config.supabaseUrl + '/auth/v1/user', {
        method: 'GET',
        headers: { apikey: config.supabaseAnonKey, Authorization: 'Bearer ' + token, Accept: 'application/json' },
        redirect: 'error', credentials: 'omit', cache: 'no-store', signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) return required();
      if (!response.ok) return unavailable();
      const user = await readBoundedUser(response, controller.signal);
      if (!record(user) || typeof user.id !== 'string') return unavailable();
      const metadata = user.app_metadata;
      if (user.is_anonymous === true || !record(metadata) || metadata.provider !== 'google' ||
        !Array.isArray(user.identities) || !user.identities.some(identity =>
          record(identity) && identity.provider === 'google' && identity.user_id === user.id) ||
        typeof user.email !== 'string' || !user.email.includes('@') ||
        typeof user.email_confirmed_at !== 'string' || !Number.isFinite(Date.parse(user.email_confirmed_at))) return denied();

      // Auth has validated the token. Decode only to bind subject/project and
      // cap the cookie lifetime; decoding is never signature verification.
      let claims: unknown;
      try {
        const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        const padded = payload + '='.repeat((4 - payload.length % 4) % 4);
        const bytes = Uint8Array.from(atob(padded), c => c.charCodeAt(0));
        claims = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
      } catch { return required(); }
      const now = (options.now ?? Date.now)();
      if (!record(claims) || claims.sub !== user.id || claims.iss !== config.supabaseUrl + '/auth/v1' ||
        claims.aud !== 'authenticated' || !Number.isSafeInteger(claims.exp) ||
        !Number.isFinite(now) || (claims.exp as number) * 1000 <= now ||
        (claims.nbf !== undefined && (!Number.isSafeInteger(claims.nbf) || (claims.nbf as number) * 1000 > now))) return required();
      return { ok: true, userId: user.id, expiresAt: claims.exp as number };
    })();
    return await Promise.race([
      operation,
      new Promise<TeacherAccessFailure>(resolve => {
        timer = setTimeout(() => { controller.abort(); resolve(unavailable()); }, timeout);
      }),
    ]);
  } catch {
    return unavailable();
  } finally {
    if (timer !== undefined) clearTimeout(timer);
    controller.abort();
  }
}

/** Owner entitlement is separate from Google sign-in and never comes from a client profile. */
export async function verifyTeacherToken(token: unknown, options: TeacherAccessOptions = {}): Promise<TeacherAccessResult> {
  const config = options.config ?? TEACHER_ACCESS_CONFIG;
  if (!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(config.ownerUserId)) return unavailable();
  const access = await verifyGoogleTeacherToken(token, options);
  if (!access.ok) return access;
  return access.userId === config.ownerUserId ? access : denied();
}

function sessionToken(request: Request): string | null {
  const header = request.headers.get('cookie') ?? '';
  if (header.length > 16384) return null;
  const matches = header.split(';').map(part => part.trim()).filter(part => part.startsWith(TEACHER_SESSION_COOKIE + '='));
  return matches.length === 1 ? matches[0].slice(TEACHER_SESSION_COOKIE.length + 1) : null;
}

/** Existing worksheet selection, printing and Word tools require a verified Google account. */
export async function requireGoogleTeacher(request: Request, options: TeacherAccessOptions = {}): Promise<TeacherAccessResult> {
  return verifyGoogleTeacherToken(sessionToken(request), options);
}

/** New worksheet generation must call this gate unconditionally before any model or job cost. */
export async function requireOwnerTeacher(request: Request, options: TeacherAccessOptions = {}): Promise<TeacherAccessResult> {
  return verifyTeacherToken(sessionToken(request), options);
}

/** Keep the former entry point owner-only so an unconverted caller cannot silently gain access. */
export const authorizeTeacherRequest = requireOwnerTeacher;

export function teacherAccessFailure(result: TeacherAccessFailure): Response {
  return new Response(JSON.stringify({ ok: false, error: result.code }), {
    status: result.status,
    headers: { ...TEACHER_PRIVATE_HEADERS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

/** Return only to a teacher entry. Never accept external URLs, fragments,
 * encoded path tricks or authentication credentials in a return query.
 */
export function sanitizeTeacherReturnTo(value: unknown): string {
  const fallback = '/teachers/start';
  if (typeof value !== 'string' || value.length > 4096 || /[\\#\u0000-\u0020\u007f]/.test(value)) return fallback;
  if (!/^\/teachers\/(?:start|app|generate)(?:\?|$)/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://teacher-return.invalid');
    if (!['/teachers/start', '/teachers/app', '/teachers/generate'].includes(url.pathname) || url.hash) return fallback;
    for (const [key, val] of url.searchParams) {
      if (/(?:access|refresh|id)[_-]?token|authorization|^code$|^state$/i.test(key) ||
        /[\\\u0000-\u001f\u007f]/.test(key + val)) return fallback;
    }
    return url.pathname + url.search;
  } catch { return fallback; }
}
