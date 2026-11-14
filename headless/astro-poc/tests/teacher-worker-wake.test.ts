import assert from 'node:assert/strict';
import test from 'node:test';
import { createTeacherWorkerWake } from '../src/lib/teacherWorkerWake';

// In-process transport only; this is deliberately not a deployment credential.
const secret = '1'.repeat(64);
const config = { url: 'https://teacher-worker-test.onrender.com', secret };

test('unset cloud configuration preserves the local worker; partial or invalid configuration never fetches', async () => {
  assert.equal(createTeacherWorkerWake({}), undefined);
  assert.equal(createTeacherWorkerWake({ url: '', secret: '' }), undefined);
  let calls = 0;
  const fetcher = async () => { calls++; throw Error('must not fetch'); };
  for (const candidate of [{ url: config.url }, { secret }, { ...config, secret: 'bad' },
    { ...config, secret: 'A'.repeat(64) }, { ...config, secret: secret + '\n' }]) {
    assert.equal(await createTeacherWorkerWake(candidate, fetcher)!(), 'unavailable');
  }
  assert.equal(calls, 0);
});

test('only a fixed HTTPS Render origin is accepted, without paths, credentials, query, ports or redirect destinations', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response(null, { status: 202 }); };
  for (const url of ['http://worker.onrender.com', 'https://127.0.0.1', 'https://localhost',
    'https://onrender.com', 'https://a.b.onrender.com', 'https://a.onrender.com.evil.test',
    'https://user:pass@a.onrender.com', 'https://a.onrender.com:443', 'https://a.onrender.com:8080',
    'https://a.onrender.com/wake', 'https://a.onrender.com/?x=1', 'https://a.onrender.com/#x',
    'https://a.onrender.com/%2f', 'https://a.onrender.com\\@evil.test', ' https://a.onrender.com',
    'https://-bad.onrender.com', 'https://bad-.onrender.com', 'https://' + 'a'.repeat(64) + '.onrender.com']) {
    assert.equal(await createTeacherWorkerWake({ url, secret }, fetcher)!(), 'unavailable', url);
  }
  assert.equal(calls, 0);
});

test('wake sends only the shared bearer credential and an empty body; redirects and client credential forwarding are prohibited', async () => {
  let calls = 0;
  const wake = createTeacherWorkerWake({ ...config, url: config.url + '/' }, async (url, init) => {
    calls++;
    assert.equal(String(url), config.url + '/wake');
    assert.equal(init!.method, 'POST');
    assert.ok(init!.body instanceof Uint8Array);
    assert.equal((init!.body as Uint8Array).byteLength, 0);
    assert.equal(new Request(String(url), init).headers.has('content-type'), false);
    assert.deepEqual([...new Headers(init!.headers)], [['authorization', 'Bearer ' + secret]]);
    assert.equal(init!.redirect, 'error');
    assert.equal(init!.credentials, 'omit');
    assert.equal(init!.cache, 'no-store');
    assert.equal(init!.referrerPolicy, 'no-referrer');
    assert.equal(init!.signal!.aborted, false);
    return Response.json({ ok: true, state: 'starting' }, { status: 202 });
  })!;
  assert.equal(await wake(), 'accepted');
  assert.equal(calls, 1);
});

test('wake acknowledgements never claim online, and non-202 responses or transport errors fail closed', async () => {
  for (const status of [200, 301, 302, 307, 401, 403, 503]) {
    let calls = 0;
    const wake = createTeacherWorkerWake(config, async () => {
      calls++; return new Response(null, { status, headers: { location: 'https://evil.test' } });
    })!;
    assert.equal(await wake(), 'unavailable');
    assert.equal(calls, 1, 'no follow-up request to a redirect target');
  }
  const wake = createTeacherWorkerWake(config, async () => { throw Error('private transport detail'); })!;
  assert.equal(await wake(), 'unavailable');
});

test('cold-start timeout is bounded even when a transport ignores abort; it permits health polling only', async () => {
  let signal: AbortSignal | undefined;
  const wake = createTeacherWorkerWake(config, async (_url, init) => {
    signal = init!.signal!;
    return new Promise<Response>(() => {});
  }, 10)!;
  const started = Date.now();
  assert.equal(await wake(), 'pending');
  assert.ok(Date.now() - started < 1000);
  assert.equal(signal!.aborted, true);
});
