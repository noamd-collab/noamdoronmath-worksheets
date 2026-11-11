import test from 'node:test';
import assert from 'node:assert/strict';
import type { AstroCookies } from 'astro';
import { createTeacherSession, clearTeacherSession, sameOriginTeacherMutation, TEACHER_RETURN_COOKIE } from '../src/lib/teacherSession';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';
import { TEACHER_SESSION_COOKIE } from '../src/lib/teacherAccess';
import { isTeacherToolRequest } from '../src/lib/teacherRequest';
import { GET as manifest } from '../src/pages/api/teacherQuestionManifest';
import { POST as word } from '../src/pages/api/teacherWordQuestions';

const origin = 'https://www.noamdoronmath.co.il';
function request(body: unknown, headers: Record<string, string> = {}, url = origin + '/api/teacherSession') {
  return new Request(url, { method: 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });
}
function cookieJar(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  const changes: Array<{ name: string; value?: string; options: Record<string, any>; deleted?: boolean }> = [];
  const cookies = {
    get: (name: string) => values.has(name) ? { value: values.get(name)! } : undefined,
    has: (name: string) => values.has(name),
    set: (name: string, value: string, options: Record<string, any>) => { values.set(name, value); changes.push({ name, value, options }); },
    delete: (name: string, options: Record<string, any>) => { values.delete(name); changes.push({ name, options, deleted: true }); },
  } as unknown as AstroCookies;
  return { cookies, changes, values };
}

test('session mutations reject cross-origin, missing-origin and hostile forwarded URLs', async () => {
  for (const headers of [{ origin: 'https://attacker.test' }, { origin: 'null' }, { 'sec-fetch-site': 'cross-site' }]) {
    const jar = cookieJar();
    const result = await createTeacherSession(request({ action: 'start' }, headers), jar.cookies);
    assert.equal(result.status, 403);
    assert.equal(jar.changes.length, 0);
  }
  const absent = request({}); absent.headers.delete('origin');
  assert.equal(sameOriginTeacherMutation(absent), false);
  assert.equal(sameOriginTeacherMutation(request({}, { origin: 'https://attacker.test', 'x-wix-forwarded-url': 'https://attacker.test/path' }, 'http://internal.invalid/api')), false);
  assert.equal(sameOriginTeacherMutation(request({}, { origin: 'https://www.noamdoronmath.co.il.evil.test' })), false);
});

test('Wix TLS termination uses only the validated public origin for CSRF and callback', async () => {
  const preview = 'https://abcdef-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
  const jar = cookieJar();
  const result = await createTeacherSession(request({ action: 'start', returnTo: '/teachers/app?grade=3&pick=1%2C2' }, {
    origin: preview, 'x-wix-forwarded-url': preview + '/api/teacherSession', 'x-forwarded-proto': 'http',
  }, 'http://internal.invalid/api/teacherSession'), jar.cookies);
  assert.equal(result.status, 200);
  assert.deepEqual(await result.json(), { redirectTo: preview + '/learning.html' });
  const pending = jar.changes.find(x => x.name === TEACHER_RETURN_COOKIE && !x.deleted)!;
  assert.equal(pending.value, '/teachers/app?grade=3&pick=1%2C2');
  assert.deepEqual(pending.options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 });
  assert.equal(result.headers.get('cache-control'), 'private, no-store');
});

test('OAuth start cannot plant an external destination or retain an earlier owner cookie', async () => {
  const jar = cookieJar({ [TEACHER_SESSION_COOKIE]: 'old-session' });
  const result = await createTeacherSession(request({ action: 'start', returnTo: '//attacker.test' }), jar.cookies);
  assert.equal(result.status, 200);
  assert.equal(jar.values.has(TEACHER_SESSION_COOKIE), false);
  assert.equal(jar.values.get(TEACHER_RETURN_COOKIE), '/teachers/start');
});

test('session bridge accepts only the server-verified owner and caps cookie lifetime to token expiry', async (t) => {
  const expiry = Math.floor(Date.now() / 1000) + 120;
  const claims = { sub: TEACHER_ACCESS_CONFIG.ownerUserId, iss: TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1', aud: 'authenticated', exp: expiry };
  const token = 'header.' + Buffer.from(JSON.stringify(claims)).toString('base64url') + '.signature';
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async (url: string, options: RequestInit) => {
    calls++;
    assert.equal(url, TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1/user');
    assert.equal((options.headers as Record<string, string>).Authorization, 'Bearer ' + token);
    return Response.json({ id: claims.sub, email: 'owner@example.test', email_confirmed_at: '2026-01-01T00:00:00Z', app_metadata: { provider: 'google' }, identities: [{ user_id: claims.sub, provider: 'google' }] });
  });
  const jar = cookieJar({ [TEACHER_RETURN_COOKIE]: '/teachers/app?grade=3&topic=10&pick=1%2C2' });
  const response = await createTeacherSession(request({ accessToken: token, user: { role: 'admin' }, returnTo: 'https://attacker.test' }), jar.cookies);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { ok: true, returnTo: '/teachers/app?grade=3&topic=10&pick=1%2C2' });
  assert.equal(calls, 1);
  const session = jar.changes.find(x => x.name === TEACHER_SESSION_COOKIE && !x.deleted)!;
  assert.equal(session.value, token);
  assert.equal(session.options.httpOnly, true);
  assert.equal(session.options.secure, true);
  assert.equal(session.options.sameSite, 'lax');
  assert.equal(session.options.path, '/');
  assert.equal(session.options.expires.getTime(), expiry * 1000);
  assert.ok(session.options.maxAge > 0 && session.options.maxAge <= 120);
  assert.equal(jar.values.has(TEACHER_RETURN_COOKIE), false);
});

test('rejected token never sets a session and removes pending browser state', async (t) => {
  t.mock.method(globalThis, 'fetch', async () => new Response(null, { status: 401 }));
  const jar = cookieJar({ [TEACHER_SESSION_COOKIE]: 'old', [TEACHER_RETURN_COOKIE]: '/teachers/app' });
  const response = await createTeacherSession(request({ accessToken: 'forged.claims.signature', userId: TEACHER_ACCESS_CONFIG.ownerUserId }), jar.cookies);
  assert.equal(response.status, 401);
  assert.equal(jar.values.size, 0);
  assert.equal(jar.changes.some(x => !x.deleted), false);
});

test('logout removes both server cookies with secure root-path scope', () => {
  const jar = cookieJar({ [TEACHER_SESSION_COOKIE]: 'old', [TEACHER_RETURN_COOKIE]: '/teachers/app' });
  clearTeacherSession(jar.cookies);
  assert.equal(jar.values.size, 0);
  assert.equal(jar.changes.length, 2);
  for (const item of jar.changes) assert.deepEqual(item.options, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
});

test('teacher operation detection covers intake disguised as another page and ordinary navigation stays public', () => {
  for (const payload of [
    { page: { kind: 'teachers' } }, { page: { kind: 'home' }, teacher: { count: 5 } },
    { page: { kind: 'other' }, intake: { active: true } },
    { page: { kind: 'home' }, message: 'תכין לי שיעור' },
  ]) assert.equal(isTeacherToolRequest(payload), true, JSON.stringify(payload));
  for (const payload of [null, {}, { message: 'שלום' }, { page: { kind: 'home' }, message: 'איפה עמוד אודות' }]) assert.equal(isTeacherToolRequest(payload), false);
});

test('direct question and Word APIs deny anonymous requests before content lookup', async () => {
  const url = new URL(origin + '/api/teacherQuestionManifest?pdfId=aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa');
  const preview = await manifest({ request: new Request(url), url } as Parameters<typeof manifest>[0]);
  const exported = await word({ request: request({ selection: [] }, {}, origin + '/api/teacherWordQuestions') } as Parameters<typeof word>[0]);
  for (const response of [preview, exported]) {
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('cache-control'), 'private, no-store');
    assert.equal(response.headers.get('x-robots-tag'), 'noindex, nofollow');
    assert.equal((await response.json()).error, 'TEACHER_SIGN_IN_REQUIRED');
  }
});
