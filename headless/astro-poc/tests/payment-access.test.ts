/**
 * Checkout stays closed while the generator is in testing.
 * The only opener is the confirmed Auth email amiramnoam@gmail.com.
 */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test, type TestContext } from 'node:test';
import { fileURLToPath } from 'node:url';
import { GET, POST } from '../src/pages/api/checkout.ts';
import { allowPaymentTesting, isPaymentTestOwnerEmail } from '../src/lib/paymentAccess';
import { TEACHER_ACCESS_CONFIG } from '../src/lib/teacherAccessConfig';
import { TEACHER_SESSION_COOKIE } from '../src/lib/teacherAccess';
import { listMainPagePaths, renderPagesSitemapXml } from '../src/lib/siteSitemaps';

const OWNER = 'amiramnoam@gmail.com';
const USER_ID = '80da2957-9492-4a9d-babb-28ba70dedd12';

function token(userId = USER_ID) {
  const exp = Math.floor(Date.now() / 1000) + 600;
  const iss = TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1';
  return Buffer.from('{"alg":"RS256","typ":"JWT"}').toString('base64url') + '.' +
    Buffer.from(JSON.stringify({ sub: userId, iss, aud: 'authenticated', exp })).toString('base64url') + '.sig';
}

function identity(email: string, id = USER_ID) {
  return {
    id,
    email,
    email_confirmed_at: '2026-01-01T00:00:00Z',
    is_anonymous: false,
    app_metadata: { provider: 'google', providers: ['google'] },
    identities: [{ provider: 'google', user_id: id }],
  };
}

function mockAuth(t: TestContext, email: string, id = USER_ID) {
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    assert.equal(url, TEACHER_ACCESS_CONFIG.supabaseUrl + '/auth/v1/user');
    return Response.json(identity(email, id));
  });
}

function authed(path: string, userId = USER_ID, emailHint?: string) {
  const url = new URL(path, 'https://www.noamdoronmath.co.il');
  if (emailHint) url.searchParams.set('email', emailHint);
  return new Request(url, { headers: { cookie: `${TEACHER_SESSION_COOKIE}=${token(userId)}` } });
}

test('only the confirmed owner address opens payment testing', () => {
  assert.equal(isPaymentTestOwnerEmail(OWNER), true);
  assert.equal(isPaymentTestOwnerEmail('AmiramNoam@Gmail.com'), true);
  assert.equal(isPaymentTestOwnerEmail(' amiramnoam@gmail.com '), true);
  assert.equal(isPaymentTestOwnerEmail('other@gmail.com'), false);
  assert.equal(isPaymentTestOwnerEmail('amiramnoam@gmail.com.evil.test'), false);
  assert.equal(isPaymentTestOwnerEmail(undefined), false);
});

test('a query param or a different confirmed Google account does not open checkout', async (t) => {
  const anonymous = new Request('https://www.noamdoronmath.co.il/payment?email=' + OWNER);
  assert.equal(await allowPaymentTesting(anonymous, {
    fetch: async () => { throw new Error('anonymous requests must not call Auth'); },
  }), false);

  const otherId = '99999999-2222-4333-8444-555555555555';
  mockAuth(t, 'teacher@example.test', otherId);
  assert.equal(await allowPaymentTesting(authed('/payment', otherId, OWNER)), false);
});

test('the signed-in owner is recognized from the Auth email, including case differences', async (t) => {
  mockAuth(t, 'AmiramNoam@Gmail.com');
  assert.equal(await allowPaymentTesting(authed('/api/checkout')), true);
});

test('checkout rejects everyone except that session before it builds a Grow link', async (t) => {
  const body = JSON.stringify({
    plan: 'yearly',
    firstName: 'נועם',
    lastName: 'דורון',
    phone: '507746289',
    country: 'ישראל',
    email: OWNER,
    terms: true,
  });
  const closed = await POST({ request: new Request('https://www.noamdoronmath.co.il/api/checkout?email=' + OWNER, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body,
  }) } as Parameters<typeof POST>[0]);
  assert.equal(closed.status, 403);
  const closedBody = await closed.json();
  assert.equal(closedBody.code, 'PAYMENT_CLOSED');
  assert.equal(closedBody.redirectUrl, undefined);
  assert.equal(JSON.stringify(closedBody).includes('grow'), false);

  const listing = await GET({ request: new Request('https://www.noamdoronmath.co.il/api/checkout') } as Parameters<typeof GET>[0]);
  assert.equal(listing.status, 403);
  assert.equal((await listing.json()).configured, undefined);

  mockAuth(t, 'teacher@example.test', '99999999-2222-4333-8444-555555555555');
  const other = await POST({ request: new Request('https://www.noamdoronmath.co.il/api/checkout', {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `${TEACHER_SESSION_COOKIE}=${token('99999999-2222-4333-8444-555555555555')}` },
    body,
  }) } as Parameters<typeof POST>[0]);
  assert.equal(other.status, 403);

  t.mock.restoreAll();
  mockAuth(t, OWNER);
  const previous = process.env.GROW_PAYMENT_URL_YEARLY;
  process.env.GROW_PAYMENT_URL_YEARLY = 'https://pay.grow.business/example';
  try {
    const open = await POST({ request: new Request('https://www.noamdoronmath.co.il/api/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie: `${TEACHER_SESSION_COOKIE}=${token()}` },
      body,
    }) } as Parameters<typeof POST>[0]);
    assert.equal(open.status, 200);
    const openBody = await open.json();
    assert.equal(openBody.ok, true);
    assert.match(openBody.redirectUrl, /^https:\/\/pay\.grow\.business\/example\?/);
  } finally {
    if (previous === undefined) delete process.env.GROW_PAYMENT_URL_YEARLY;
    else process.env.GROW_PAYMENT_URL_YEARLY = previous;
  }
});

test('the closed payment page and the public landing do not offer a pay link', () => {
  const closed = readFileSync(new URL('../src/components/PaymentClosed.astro', import.meta.url), 'utf8');
  assert.match(closed, /בקרוב/);
  assert.match(closed, /noindex/);
  for (const needle of ['iframe', 'pay.grow', '/api/checkout', 'GROW_PAYMENT', 'לבחירת מסלול', '18', '180']) {
    assert.equal(closed.includes(needle), false, needle);
  }

  const landing = readFileSync(new URL('../src/components/TeacherComingSoon.astro', import.meta.url), 'utf8');
  assert.match(landing, /paymentOpen = false/);
  assert.match(landing, /\{paymentOpen && <section[^>]*id="teacher-plans"/);
  const plansAt = landing.indexOf('id="teacher-plans"');
  const plansEnd = landing.indexOf('</section>}', plansAt);
  assert.ok(plansAt > 0 && plansEnd > plansAt);
  assert.match(landing.slice(plansAt, plansEnd), /href="\/payment"/);

  for (const slug of ['purchase-terms', 'cancellation', 'delivery']) {
    const raw = readFileSync(new URL(`../src/data/site-pages/${slug}.json`, import.meta.url), 'utf8');
    assert.equal(raw.includes('/payment'), false, slug);
    assert.equal(raw.includes('pay.grow'), false, slug);
  }
});

test('sitemap-pages leaves /payment out', () => {
  const keys = readdirSync(fileURLToPath(new URL('../src/pages', import.meta.url)))
    .filter((name) => name.endsWith('.astro'))
    .map((name) => `./${name}`);
  assert.equal(keys.includes('./payment.astro'), true);
  const paths = listMainPagePaths(keys);
  assert.equal(paths.includes('/payment'), false);
  assert.equal(renderPagesSitemapXml(keys).includes('/payment'), false);
});
