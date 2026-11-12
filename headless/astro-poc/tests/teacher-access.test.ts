import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import {
  authorizeTeacherRequest, sanitizeTeacherReturnTo, teacherAccessFailure, verifyTeacherToken,
  requireGoogleTeacher, requireOwnerTeacher, verifyGoogleTeacherToken,
  TEACHER_PRIVATE_HEADERS, TEACHER_SESSION_COOKIE, TEACHER_SESSION_COOKIE_OPTIONS,
} from '../src/lib/teacherAccess';
import { TEACHER_ACCESS_CONFIG, type TeacherAccessConfig } from '../src/lib/teacherAccessConfig';

const config: TeacherAccessConfig = {
  supabaseUrl: 'https://testproject.supabase.co',
  supabaseAnonKey: 'synthetic-public-key-for-offline-tests',
  ownerUserId: '11111111-2222-4333-8444-555555555555',
};
const now = 1_800_000_000_000;
const expiry = now / 1000 + 300;
const owner = () => ({
  id: config.ownerUserId, email: 'owner@example.test', email_confirmed_at: '2026-01-01T00:00:00Z',
  is_anonymous: false, app_metadata: { provider: 'google', providers: ['google'] },
  identities: [{ provider: 'google', user_id: config.ownerUserId }],
});
function token(extra: Record<string, unknown> = {}) {
  return Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url') + '.' +
    Buffer.from(JSON.stringify({ sub: config.ownerUserId, iss: config.supabaseUrl + '/auth/v1',
      aud: 'authenticated', exp: expiry, ...extra })).toString('base64url') + '.synthetic-signature';
}
const options = (user: unknown = owner()) => ({ config, now: () => now,
  fetch: (async () => Response.json(user)) as typeof fetch });
const required = { ok: false, status: 401, code: 'TEACHER_SIGN_IN_REQUIRED' };
const denied = { ok: false, status: 403, code: 'TEACHER_ACCESS_DENIED' };
const unavailable = { ok: false, status: 503, code: 'TEACHER_AUTH_UNAVAILABLE' };
const teacher = () => ({ ...owner(), id: '99999999-2222-4333-8444-555555555555',
  identities: [{ provider: 'google', user_id: '99999999-2222-4333-8444-555555555555' }] });

test('every verified Google teacher can use existing tools, while new generation remains owner-only', async () => {
  for (const user of [owner(), teacher()]) {
    const credential = token({ sub: user.id });
    const request = new Request('https://www.noamdoronmath.co.il/teachers/app', {
      headers: { cookie: `${TEACHER_SESSION_COOKIE}=${credential}` },
    });
    const accepted = { ok: true, userId: user.id, expiresAt: expiry };
    assert.deepEqual(await verifyGoogleTeacherToken(credential, options(user)), accepted);
    assert.deepEqual(await requireGoogleTeacher(request, options(user)), accepted);
    assert.deepEqual(await requireOwnerTeacher(request, options(user)), user.id === config.ownerUserId ? accepted : denied);
    assert.deepEqual(await authorizeTeacherRequest(request, options(user)), user.id === config.ownerUserId ? accepted : denied,
      'The former authorizer retains its stricter owner policy for unconverted callers');
  }
});

test('client metadata and an owner-looking email never upgrade another Google teacher to owner', async () => {
  const user = { ...teacher(), user_metadata: { id: config.ownerUserId, ownerUserId: config.ownerUserId,
    role: 'owner', teacherAccess: 'owner', email: 'owner@example.test' } };
  const credential = token({ sub: user.id, role: 'owner', ownerUserId: config.ownerUserId });
  assert.deepEqual(await verifyGoogleTeacherToken(credential, options(user)), { ok: true, userId: user.id, expiresAt: expiry });
  assert.deepEqual(await verifyTeacherToken(credential, options(user)), denied);
});

test('Google tool access does not depend on owner configuration; owner generation fails closed when it is invalid', async () => {
  const user = teacher(), credential = token({ sub: user.id });
  for (const ownerUserId of ['', 'owner@example.test']) {
    const configured = { ...options(user), config: { ...config, ownerUserId } };
    assert.deepEqual(await verifyGoogleTeacherToken(credential, configured), { ok: true, userId: user.id, expiresAt: expiry });
    assert.deepEqual(await verifyTeacherToken(credential, { ...configured, fetch: async () => {
      assert.fail('Invalid owner configuration must not request upstream identity');
    } }), unavailable);
  }
});

test('Google access still rejects stale/forged identities and duplicate cookies before downstream work', async () => {
  const user = teacher(), credential = token({ sub: user.id });
  for (const altered of [
    { ...user, email_confirmed_at: null }, { ...user, is_anonymous: true },
    { ...user, app_metadata: { provider: 'email' }, user_metadata: { provider: 'google' } },
    { ...user, identities: [{ provider: 'google', user_id: config.ownerUserId }] },
  ]) assert.deepEqual(await verifyGoogleTeacherToken(credential, options(altered)), denied);
  assert.deepEqual(await verifyGoogleTeacherToken(token({ sub: user.id, exp: now / 1000 }), options(user)), required);
  assert.deepEqual(await verifyGoogleTeacherToken(token({ sub: config.ownerUserId }), options(user)), required);
  for (const headers of [
    { authorization: 'Bearer ' + credential },
    { cookie: `${TEACHER_SESSION_COOKIE}=${credential}; ${TEACHER_SESSION_COOKIE}=${credential}` },
  ]) for (const gate of [requireGoogleTeacher, requireOwnerTeacher]) {
    assert.deepEqual(await gate(new Request('https://www.noamdoronmath.co.il/teachers/app', { headers }), {
      ...options(user), fetch: async () => { assert.fail('Untrusted request credentials must not reach Auth'); },
    }), required);
  }
});

test('teacher config matches existing public Supabase project and uses only a publishable or anon key', () => {
  const context = { window: {} as { NOAM_LEARNING_CONFIG?: { url: string; key: string } } };
  vm.runInNewContext(readFileSync(new URL('../public/noam-learning-config.js', import.meta.url), 'utf8'), context);
  assert.ok(TEACHER_ACCESS_CONFIG.supabaseUrl === context.window.NOAM_LEARNING_CONFIG?.url, 'Public auth project parity');
  assert.ok(TEACHER_ACCESS_CONFIG.supabaseAnonKey === context.window.NOAM_LEARNING_CONFIG?.key, 'Public auth key parity');
  if (!TEACHER_ACCESS_CONFIG.supabaseAnonKey.startsWith('sb_publishable_')) {
    const publicKeyClaims = JSON.parse(Buffer.from(TEACHER_ACCESS_CONFIG.supabaseAnonKey.split('.')[1], 'base64url').toString());
    assert.equal(publicKeyClaims.role, 'anon');
  }
  assert.equal(TEACHER_ACCESS_CONFIG.ownerUserId, '80da2957-9492-4a9d-babb-28ba70dedd12');
  assert.ok(Object.isFrozen(TEACHER_ACCESS_CONFIG));
  assert.deepEqual(Object.keys(TEACHER_ACCESS_CONFIG).sort(), ['ownerUserId', 'supabaseAnonKey', 'supabaseUrl']);
});

test('valid owner is verified against fixed Auth origin with no redirects, cookies or shared auth cache', async () => {
  const accessToken = token();
  let calls = 0;
  const fetcher: typeof fetch = async (url, init) => {
    calls++;
    assert.equal(url, config.supabaseUrl + '/auth/v1/user');
    assert.equal(init?.method, 'GET');
    assert.equal(init?.redirect, 'error');
    assert.equal(init?.credentials, 'omit');
    assert.equal(init?.cache, 'no-store');
    assert.ok(init?.signal instanceof AbortSignal);
    const headers = new Headers(init?.headers);
    assert.equal(headers.get('apikey'), config.supabaseAnonKey);
    assert.equal(headers.get('authorization'), 'Bearer ' + accessToken);
    assert.equal(headers.get('cookie'), null);
    return Response.json(owner());
  };
  for (let n = 0; n < 2; n++) assert.deepEqual(await verifyTeacherToken(accessToken, { ...options(), fetch: fetcher }), {
    ok: true, userId: config.ownerUserId, expiresAt: expiry,
  });
  assert.equal(calls, 2, 'Every request rechecks Auth; permanent entitlement is not a cached session');
});

test('missing and malformed credentials fail before any network request', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json(owner()); };
  for (const value of [null, undefined, {}, '', 'Bearer ' + token(), token() + '\n', 'x.y', 'a.b.c.d', 'x'.repeat(8193)]) {
    assert.deepEqual(await verifyTeacherToken(value, { ...options(), fetch: fetcher }), required);
  }
  assert.equal(calls, 0);
});

test('forged owner-looking JWT is rejected when Auth rejects it; decode never substitutes for verification', async () => {
  for (const status of [401, 403]) {
    assert.deepEqual(await verifyTeacherToken(token(), { ...options(), fetch: async () => new Response(null, { status }) }), required);
  }
});

test('authenticated non-owner cannot grant themselves access using profile metadata', async () => {
  const user = { ...owner(), id: '99999999-2222-4333-8444-555555555555',
    user_metadata: { id: config.ownerUserId, role: 'owner', email: 'owner@example.test' } };
  assert.deepEqual(await verifyTeacherToken(token({ sub: user.id }), options(user)), denied);
});

test('owner requires confirmed email, trusted Google provider/identity and a non-anonymous account', async () => {
  const users = [
    { ...owner(), email_confirmed_at: null },
    { ...owner(), email_confirmed_at: 'invalid' },
    { ...owner(), email: null },
    { ...owner(), is_anonymous: true },
    { ...owner(), app_metadata: { provider: 'email', providers: ['google'] } },
    { ...owner(), app_metadata: null, user_metadata: { provider: 'google' } },
    { ...owner(), identities: [{ provider: 'email', user_id: config.ownerUserId }] },
    { ...owner(), identities: [{ provider: 'google', user_id: 'another-user' }] },
    { ...owner(), identities: [] },
  ];
  for (const user of users) assert.deepEqual(await verifyTeacherToken(token(), options(user)), denied);
});

test('validated Auth user must match token subject, issuer, audience and live expiry', async () => {
  for (const claims of [
    { sub: 'another-user' }, { iss: 'https://different.supabase.co/auth/v1' }, { aud: 'anon' },
    { exp: now / 1000 }, { exp: now / 1000 - 1 }, { exp: '9999999999' }, { exp: null },
    { exp: 1.5 }, { nbf: now / 1000 + 1 }, { nbf: 'invalid' },
  ]) assert.deepEqual(await verifyTeacherToken(token(claims), options()), required);
  assert.deepEqual(await verifyTeacherToken('a.not-json.c', options()), required);
  assert.deepEqual(await verifyTeacherToken(token(), { ...options(), now: () => NaN }), required);
  assert.equal((await verifyTeacherToken(token({ nbf: now / 1000 }), options())).ok, true);
});

test('permanent owner entitlement continues with a newly valid session rather than an expired cookie', async () => {
  assert.deepEqual(await verifyTeacherToken(token(), { ...options(), now: () => (expiry + 1) * 1000 }), required);
  const later = now + 365 * 24 * 60 * 60 * 1000;
  const laterExpiry = later / 1000 + 300;
  assert.deepEqual(await verifyTeacherToken(token({ exp: laterExpiry }), { ...options(), now: () => later }), {
    ok: true, userId: config.ownerUserId, expiresAt: laterExpiry,
  });
});

test('Auth errors, malformed responses and oversized bodies fail closed without exposing upstream detail', async () => {
  const cases: (typeof fetch)[] = [
    async () => { throw new Error('must-not-be-returned'); },
    async () => new Response('must-not-be-returned', { status: 429 }),
    async () => new Response(null, { status: 500 }),
    async () => new Response(null, { status: 302, headers: { location: 'https://other.invalid/' } }),
    async () => new Response('not-json'),
    async () => Response.json({}),
    async () => Response.json(null),
    async () => Response.json(owner(), { headers: { 'content-length': '65537' } }),
    async () => Response.json({ ...owner(), padding: 'x'.repeat(65536) }),
  ];
  for (const fetcher of cases) assert.deepEqual(await verifyTeacherToken(token(), { ...options(), fetch: fetcher }), unavailable);
});

test('authentication timeout bounds both fetch and body-read phases', async () => {
  let signal: AbortSignal | null | undefined;
  const hungFetch: typeof fetch = async (_url, init) => {
    signal = init?.signal;
    return new Promise<Response>(() => {});
  };
  const start = performance.now();
  assert.deepEqual(await verifyTeacherToken(token(), { ...options(), fetch: hungFetch, timeoutMs: 10 }), unavailable);
  assert.ok(performance.now() - start < 1000);
  assert.equal(signal?.aborted, true);
  let cancelled = false;
  const stream = new ReadableStream<Uint8Array>({ cancel() { cancelled = true; } });
  assert.deepEqual(await verifyTeacherToken(token(), { ...options(), timeoutMs: 10,
    fetch: async () => new Response(stream) }), unavailable);
  assert.equal(cancelled, true, 'Timed-out body reads release their upstream stream');
});

test('unconfigured or invalid server identity/project cannot issue access or select an arbitrary URL', async () => {
  let calls = 0;
  const fetcher: typeof fetch = async () => { calls++; return Response.json(owner()); };
  for (const override of [
    { ownerUserId: '' }, { ownerUserId: 'owner@example.test' }, { supabaseAnonKey: '' },
    { supabaseUrl: 'http://testproject.supabase.co' }, { supabaseUrl: 'https://testproject.supabase.co@evil.test' },
    { supabaseUrl: 'https://testproject.supabase.co/other' }, { supabaseUrl: 'https://testproject.supabase.co?next=1' },
  ]) assert.deepEqual(await verifyTeacherToken(token(), { ...options(), config: { ...config, ...override }, fetch: fetcher }), unavailable);
  assert.equal(calls, 0);
});

test('request authorizer accepts exactly one host cookie and ignores client Authorization/profile claims', async () => {
  const url = 'https://www.noamdoronmath.co.il/teachers/app';
  const authOnly = new Request(url, { headers: { Authorization: 'Bearer ' + token(), 'x-user-id': config.ownerUserId } });
  assert.deepEqual(await authorizeTeacherRequest(authOnly, options()), required);
  for (const cookie of ['', `other=${token()}`, `${TEACHER_SESSION_COOKIE}=${token()}; ${TEACHER_SESSION_COOKIE}=${token()}`,
    `${TEACHER_SESSION_COOKIE}=${encodeURIComponent('Bearer ' + token())}`, 'a=' + 'x'.repeat(16384)]) {
    assert.deepEqual(await authorizeTeacherRequest(new Request(url, { headers: { cookie } }), options()), required);
  }
  const request = new Request(url, { headers: { cookie: `other=a; ${TEACHER_SESSION_COOKIE}=${token()}; unrelated=z` } });
  assert.deepEqual(await authorizeTeacherRequest(request, options()), { ok: true, userId: config.ownerUserId, expiresAt: expiry });
});

test('owner cookies and all failure responses remain private and non-indexable', async () => {
  assert.equal(TEACHER_SESSION_COOKIE, '__Host-noam_teacher_session');
  assert.deepEqual(TEACHER_SESSION_COOKIE_OPTIONS, { httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
  for (const [status, code] of [[401, 'TEACHER_SIGN_IN_REQUIRED'], [403, 'TEACHER_ACCESS_DENIED'], [503, 'TEACHER_AUTH_UNAVAILABLE']] as const) {
    const response = teacherAccessFailure({ ok: false, status, code });
    assert.equal(response.status, status);
    for (const [name, value] of Object.entries(TEACHER_PRIVATE_HEADERS)) assert.equal(response.headers.get(name), value);
    assert.deepEqual(await response.json(), { ok: false, error: code });
    assert.equal(response.headers.get('set-cookie'), null);
  }
});

test('return path preserves teacher scope encoding and rejects other routes, tokens and URL tricks', () => {
  for (const path of ['/teachers/app', '/teachers/start',
    '/teachers/app?grade=3&topic=10&level=a&edition=elementary-20261108-r1&minutes=20&pick=1%2C2',
    '/teachers/start?note=%D7%A9%D7%9C%D7%95%D7%9D']) assert.equal(sanitizeTeacherReturnTo(path), path);
  for (const attack of [
    null, undefined, '', '/learning.html', '/teachers', '/teachers/app/else', '/teachers/app/../start',
    'https://evil.test/teachers/app', '//evil.test/teachers/app', ' /teachers/app', '/teachers/app ',
    '/teachers\\app', '/teachers/app#access_token=secret', '/teachers/app#section', '/teachers/%61pp',
    '/teachers/app?access_token=secret', '/teachers/app?refresh_token=secret', '/teachers/app?id_token=secret',
    '/teachers/app?%61ccess_token=secret', '/teachers/app?Authorization=Bearer', '/teachers/app?code=secret',
    '/teachers/app?state=secret', '/teachers/app?pick=%0d%0aLocation%3aevil', '/teachers/app?pick=%5cevil',
    '/teachers/app?' + 'x'.repeat(4096),
  ]) assert.equal(sanitizeTeacherReturnTo(attack), '/teachers/start');
});
