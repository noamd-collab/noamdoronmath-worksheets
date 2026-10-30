import assert from 'node:assert/strict';
import { test } from 'node:test';
import { botConfigBody, handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { STEP_UP_TTL_MS } from '../../../noam-ai/site-companion/teacher-step-up.js';
import { RECAPTCHA_TIMEOUT_MS } from '../../../noam-ai/site-companion/bot-guard.js';

const now = Date.UTC(2026, 9, 30, 12);
const origin = 'https://www.noamdoronmath.co.il';
const host = 'www.noamdoronmath.co.il';
const siteKey = 'synthetic-public-v2-site-key';
const secret = 'synthetic-private-v2-secret-key';
const pdfId = 'a'.repeat(32);
const row = {
  pdfId, grade: 3, gradeLabel: 'כיתה ג׳', topicId: '11', topic: 'שברים', band: 'elementary',
  level: 'a', levelLabel: 'רמה א׳', mode: 'exercise', title: 'שברים',
  pdfUrl: `https://static.wixstatic.com/ugd/d8e7ad_${pdfId}.pdf`,
  questions: Array.from({ length: 20 }, (_, index) => String(index + 1)),
};
const labels = (count: number) => row.questions.slice(-count).map(label => `a:${label}`);
function payload(): any {
  return {
    message: 'בחר 5 שאלות שלמות עם AI',
    page: { kind: 'teachers', path: '/teachers?grade=3&topic=11&level=a', title: 'למורים' },
    teacher: { grade: '3', topic: '11', level: 'a', count: 5, planCounts: [5, 10, 15], goal: 'first', style: 'scaffold', note: '',
      candidates: row.questions.map(label => ({ id: `a:${label}`, label, text: `שאלה ${label}` })) },
    botVerification: { provider: 'recaptcha-v3', token: 'synthetic-v3-proof' },
  };
}
function fixture() {
  const calls: string[] = [];
  const used = new Set<string>();
  const settings: any = {
    origin, requestHost: host, clientIp: '203.0.113.42', now,
    qwenKey: 'synthetic-model-key', recaptchaSecret: 'synthetic-private-v3-key',
    recaptchaV2SiteKey: siteKey, recaptchaV2Secret: secret,
    teacherIndex: [row], catalog: { grades: [] }, store: new Map(),
    rateBackend: { async take() { calls.push('rate'); return true; } },
    captchaUses: { async consume(nonce: string) {
      calls.push('consume');
      if (used.has(nonce)) return false;
      used.add(nonce); return true;
    } },
  };
  let v3: any = { success: true, score: 0.1, action: 'noam_site_companion', hostname: host };
  let v2: any = { success: true, hostname: host, challenge_ts: new Date(now).toISOString() };
  settings.fetch = async (url: string, init: { body: string }) => {
    if (url === 'https://www.google.com/recaptcha/api/siteverify') {
      const form = new URLSearchParams(init.body);
      const isV2 = form.get('secret') === secret;
      assert.equal(form.get('secret'), isV2 ? secret : settings.recaptchaSecret);
      calls.push(isV2 ? 'v2' : 'v3');
      return { ok: true, json: async () => isV2 ? v2 : v3 };
    }
    assert.match(url, /\/chat\/completions$/);
    calls.push('model');
    assert.ok(used.size > 0 || v3.score >= 0.5, 'The model must follow nonce consumption or the original v3 success');
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({
      grade: 3, level: 'a', exerciseLabels: labels(5),
      exerciseLabelsByCount: { '5': labels(5), '10': labels(10), '15': labels(15) },
    }) } }] }) };
  };
  async function run(input = payload(), overrides = {}, cookie = ''): Promise<{ status: number; headers: Record<string, string>; body: any }> {
    return handleNoamSiteCompanion({ method: 'POST', url: origin + '/api/noamSiteCompanion', headers: new Headers(cookie ? { cookie } : {}) }, { ...settings, ...overrides, payload: input });
  }
  async function challenge(input = payload(), overrides = {}) {
    const first = await run(input, overrides);
    assert.equal(first.status, 403);
    assert.equal(first.body.code, 'BOT_STEP_UP_REQUIRED');
    assert.equal(first.headers['Cache-Control'], 'no-store');
    assert.deepEqual(Object.keys(first.body.challenge).sort(), ['expiresAt', 'provider', 'requestToken', 'siteKey']);
    assert.equal(first.body.challenge.expiresAt, now + STEP_UP_TTL_MS);
    assert.deepEqual(first.body.exerciseIds, []);
    assert.equal(first.body.teacherPlans, undefined);
    const resumed = structuredClone(input);
    resumed.botVerification = { provider: 'recaptcha-v2', token: 'synthetic-human-v2-proof', requestToken: first.body.challenge.requestToken };
    return { first, resumed };
  }
  return { settings, calls, used, run, challenge, v3: (next: any) => { v3 = next; }, v2: (next: any) => { v2 = next; } };
}

test('valid low-score v3 issues a bounded request ticket; a fresh v2 success consumes it before one model call and returns all exact plans', async () => {
  const f = fixture();
  const { first, resumed } = await f.challenge();
  assert.deepEqual(f.calls, ['rate', 'v3']);
  assert.equal(first.body.challenge.siteKey, siteKey);
  assert.equal(first.body.siteverify, undefined);
  assert.equal(first.headers['Set-Cookie'], undefined, 'Trusted IP binds without a cookie');
  assert.ok(!JSON.stringify(first).includes(secret));
  const result = await f.run(resumed);
  assert.equal(result.status, 200);
  assert.equal(result.body.source, 'classifier');
  assert.equal(result.body.model, 'qwen3.8-flash');
  assert.deepEqual(f.calls, ['rate', 'v3', 'rate', 'v2', 'consume', 'model']);
  for (const count of [5, 10, 15]) {
    const plan = result.body.teacherPlans[count];
    assert.equal(plan.source, 'classifier');
    assert.deepEqual(plan.exerciseIds, labels(count).map(label => `ex:${pdfId}:${label.slice(2)}`));
    assert.deepEqual(plan.modelExerciseIds, plan.exerciseIds);
  }
});

test('public configuration exposes only the optional v2 site key, and only when both v2 values are configured', () => {
  const base = botConfigBody('model-key', 'v3-key');
  assert.ok('provider' in base && 'mode' in base);
  assert.equal(base.provider, 'recaptcha-v3');
  assert.equal(base.mode, 'enforce');
  for (const settings of [{}, { recaptchaV2SiteKey: siteKey }, { recaptchaV2Secret: secret }, { recaptchaV2SiteKey: 'invalid', recaptchaV2Secret: secret }]) {
    assert.deepEqual(botConfigBody('model-key', 'v3-key', settings), base);
  }
  const configured = botConfigBody('model-key', 'v3-key', { recaptchaV2SiteKey: siteKey, recaptchaV2Secret: secret });
  assert.ok('stepUp' in configured);
  assert.deepEqual(configured.stepUp, { provider: 'recaptcha-v2', siteKey });
  assert.ok(!JSON.stringify(configured).includes(secret));
  assert.equal('stepUp' in botConfigBody('', 'v3-key', { recaptchaV2SiteKey: siteKey, recaptchaV2Secret: secret }), false);
});

test('the original v3 threshold remains 0.5; zero and positive scores below it alone may step up', async () => {
  for (const score of [0, 0.1, 0.49, 0.5, 0.9]) {
    const f = fixture(); f.v3({ success: true, score, action: 'noam_site_companion', hostname: host });
    const result = await f.run();
    assert.equal(result.status, score < 0.5 ? 403 : 200);
    if (score < 0.5) assert.equal(result.body.code, 'BOT_STEP_UP_REQUIRED');
    else assert.deepEqual(f.calls, ['rate', 'v3', 'model']);
  }
});

test('invalid v3 proof, action, hostname, score or provider errors cannot mint a challenge', async () => {
  for (const assessment of [
    { success: false }, { action: 'wrong' }, { hostname: 'attacker.example' }, { hostname: 'noamdoronmath.co.il' },
    { score: undefined }, { score: '0.1' }, { score: -0.1 }, { score: NaN },
    { 'error-codes': ['timeout-or-duplicate'] }, { 'error-codes': 'invalid' },
  ]) {
    const f = fixture(); f.v3({ success: true, score: 0.1, action: 'noam_site_companion', hostname: host, ...assessment });
    const result = await f.run();
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'BOT_VERIFICATION_FAILED');
    assert.equal(result.body.challenge, undefined);
    assert.deepEqual(f.calls, ['rate', 'v3']);
  }
  const f = fixture(); const input = payload(); input.botVerification.token = '';
  assert.equal((await f.run(input)).body.challenge, undefined);
  assert.deepEqual(f.calls, ['rate']);
});

test('missing v2 config or persistent store preserves the refusal, with no model call', async () => {
  for (const overrides of [{ recaptchaV2Secret: '' }, { recaptchaV2SiteKey: '' }, { captchaUses: undefined }, { requestHost: 'attacker.example' }]) {
    const f = fixture(); const result = await f.run(payload(), overrides);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'BOT_VERIFICATION_FAILED');
    assert.equal(result.body.challenge, undefined);
    assert.deepEqual(f.calls, ['rate', 'v3']);
  }
});

test('tickets are exact-payload bound, not reusable across question lists, counts, notes, topics or pages', async () => {
  const mutations: Array<(input: any) => void> = [
    p => { p.message += '!'; }, p => { p.teacher.count = 10; }, p => { p.teacher.topic = '12'; },
    p => { p.teacher.grade = '4'; }, p => { p.teacher.level = 'b'; }, p => { p.teacher.note = 'changed'; },
    p => { p.teacher.goal = 'review'; }, p => { p.teacher.style = 'challenge'; },
    p => { p.teacher.planCounts = [5]; }, p => { p.teacher.candidates[0].text += 'changed'; },
    p => { p.teacher.candidates.reverse(); }, p => { p.teacher.candidates.pop(); },
    p => { p.page.path = '/teachers?grade=4'; }, p => { p.page.kind = 'worksheet'; },
    p => { p.extraField = true; }, p => { p.teacher.count = 0; }, p => { p.rateProbe = true; },
  ];
  for (const mutate of mutations) {
    const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0; mutate(resumed);
    const result = await f.run(resumed);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'BOT_VERIFICATION_FAILED');
    assert.deepEqual(f.calls, ['rate']);
    assert.equal(result.body.challenge, undefined);
  }
});

test('canonical object key order is stable while the payload remains exact', async () => {
  const f = fixture(); const { resumed } = await f.challenge();
  const reordered = Object.fromEntries(Object.entries(resumed).reverse());
  reordered.teacher = Object.fromEntries(Object.entries(resumed.teacher).reverse());
  assert.equal((await f.run(reordered)).body.source, 'classifier');
});

test('tampered, missing, expired or future tickets fail before Google and the model', async () => {
  for (const kind of ['tampered', 'missing', 'expired', 'future', 'different-key', 'missing-config', 'missing-store']) {
    const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
    const overrides: any = {};
    if (kind === 'tampered') resumed.botVerification.requestToken = 'A' + resumed.botVerification.requestToken.slice(1);
    if (kind === 'missing') delete resumed.botVerification.requestToken;
    if (kind === 'expired') overrides.now = now + STEP_UP_TTL_MS;
    if (kind === 'future') overrides.now = now - 1;
    if (kind === 'different-key') overrides.recaptchaV2Secret = 'another-synthetic-private-key';
    if (kind === 'missing-config') overrides.recaptchaV2Secret = '';
    if (kind === 'missing-store') overrides.captchaUses = undefined;
    assert.equal((await f.run(resumed, overrides)).status, 403);
    assert.deepEqual(f.calls, ['rate'], kind);
  }
});

test('cross-origin, host and client identity changes reject a request ticket', async () => {
  for (const overrides of [
    { origin: 'https://attacker.example' }, { origin: 'https://noamdoronmath.co.il', requestHost: 'noamdoronmath.co.il' },
    { requestHost: 'noamdoronmath.co.il' }, { clientIp: '203.0.113.99' }, { clientIp: '' },
  ]) {
    const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
    assert.equal((await f.run(resumed, overrides)).status, 403);
    assert.ok(!f.calls.some(call => ['v2', 'consume', 'model'].includes(call)));
  }
});

test('only the exact project preview origin and host can step up after Google validates that hostname', async () => {
  const previewHost = 'synthetic-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
  const f = fixture();
  const overrides = { origin: 'https://' + previewHost, requestHost: previewHost };
  f.v3({ success: true, score: 0.1, action: 'noam_site_companion', hostname: previewHost });
  f.v2({ success: true, hostname: previewHost, challenge_ts: new Date(now).toISOString() });
  const { resumed } = await f.challenge(payload(), overrides);
  assert.equal((await f.run(resumed, overrides)).body.source, 'classifier');
  for (const otherOrigin of ['https://unrelated.wix-site-host.com', 'http://' + previewHost, 'https://' + previewHost + ':8443']) {
    const blocked = await f.run(payload(), { ...overrides, origin: otherOrigin });
    assert.equal(blocked.status, 403); assert.equal(blocked.body.challenge, undefined);
  }
});

test('v2 requires a successful fresh same-host assessment; failures never consume a nonce or call the model', async () => {
  for (const assessment of [
    { success: false }, { hostname: 'attacker.example' }, { hostname: 'noamdoronmath.co.il' },
    { score: 0.1 }, { action: 'noam_site_companion' }, { score: 0.9, action: 'noam_site_companion' },
    { challenge_ts: undefined }, { challenge_ts: 'invalid' }, { challenge_ts: new Date(now + 1000).toISOString() },
    { challenge_ts: new Date(now - STEP_UP_TTL_MS - 1).toISOString() }, { challenge_ts: new Date(now - 2000).toISOString() },
    { 'error-codes': ['timeout-or-duplicate'] }, { 'error-codes': 'invalid' },
  ]) {
    const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
    f.v2({ success: true, hostname: host, challenge_ts: new Date(now).toISOString(), ...assessment });
    assert.equal((await f.run(resumed)).status, 403);
    assert.deepEqual(f.calls, ['rate', 'v2']);
  }
});

test('replay and simultaneous retries permit exactly one persistent consume and model call', async () => {
  const f = fixture(); const { resumed } = await f.challenge();
  const results = await Promise.all([f.run(resumed), f.run({ ...resumed, botVerification: { ...resumed.botVerification, token: 'another-valid-human-token' } })]);
  assert.deepEqual(results.map(result => result.status).sort(), [200, 403]);
  assert.equal(f.calls.filter(call => call === 'model').length, 1);
  assert.equal(f.used.size, 1);
  assert.equal((await f.run(resumed)).status, 403);
  assert.equal(f.calls.filter(call => call === 'model').length, 1);
});

test('failed persistent consume and provider transport fail closed without model work', async () => {
  for (const failure of ['store-false', 'store-throw', 'provider-throw', 'provider-status', 'provider-json']) {
    const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
    const overrides: any = {};
    if (failure === 'store-false') overrides.captchaUses = { consume: async () => false };
    if (failure === 'store-throw') overrides.captchaUses = { consume: async () => { throw new Error('synthetic storage failure'); } };
    if (failure === 'provider-throw') overrides.fetch = async () => { throw new Error('synthetic transport failure'); };
    if (failure === 'provider-status') overrides.fetch = async () => ({ ok: false });
    if (failure === 'provider-json') overrides.fetch = async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } });
    const result = await f.run(resumed, overrides);
    assert.equal(result.status, 403);
    assert.equal(result.body.code, 'BOT_VERIFICATION_FAILED');
    assert.ok(!f.calls.includes('model'));
    assert.equal(f.used.size, 0);
  }
});

test('a stalled v2 JSON body is aborted within the original verification deadline and never reaches storage or model', async (t) => {
  const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let signal: AbortSignal | undefined, bodyStarted = false;
  const pending = f.run(resumed, { fetch: async (_url: string, init: { signal: AbortSignal }) => {
    signal = init.signal;
    await new Promise(resolve => setTimeout(resolve, 2000));
    return { ok: true, json: () => { bodyStarted = true; return new Promise(() => {}); } };
  } });
  while (!signal) await new Promise(resolve => setImmediate(resolve));
  t.mock.timers.tick(2000);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(bodyStarted, true);
  assert.equal(signal.aborted, false);
  t.mock.timers.tick(RECAPTCHA_TIMEOUT_MS - 2000);
  const result = await pending;
  assert.equal(result.status, 403);
  assert.equal(result.body.code, 'BOT_VERIFICATION_FAILED');
  assert.equal(signal.aborted, true);
  assert.deepEqual(f.calls, ['rate']);
  assert.equal(f.used.size, 0);
});

test('rate limiting applies again to the human-verified retry, before any provider call', async () => {
  const f = fixture(); const { resumed } = await f.challenge(); f.calls.length = 0;
  const result = await f.run(resumed, { rateBackend: { async take() { f.calls.push('rate'); return false; } } });
  assert.equal(result.status, 429); assert.equal(result.body.code, 'RATE_LIMIT');
  assert.deepEqual(f.calls, ['rate']);
});

test('missing trusted IP uses a signed HttpOnly session cookie and retains both no-IP rate buckets', async () => {
  const f = fixture(); const overrides = { clientIp: '' };
  const { first, resumed } = await f.challenge(payload(), overrides);
  assert.deepEqual(f.calls, ['rate', 'rate', 'v3']);
  const setCookie = first.headers['Set-Cookie'];
  assert.match(setCookie, /^__Secure-noam-teacher-captcha=/);
  for (const attribute of ['HttpOnly', 'Secure', 'SameSite=Strict', 'Max-Age=120', 'Path=/api/noamSiteCompanion']) assert.ok(setCookie.includes(attribute));
  assert.ok(!setCookie.includes('Domain='));
  assert.ok(!setCookie.includes(secret));
  assert.ok(!JSON.stringify(first.body).includes('__Secure-noam-teacher-captcha'));
  const cookie = setCookie.split(';')[0];
  const result = await f.run(resumed, overrides, cookie);
  assert.equal(result.body.source, 'classifier');
  assert.deepEqual(f.calls.slice(3), ['rate', 'rate', 'v2', 'consume', 'model']);
});

test('missing, forged, duplicate or another session cookie cannot redeem a no-IP ticket', async () => {
  for (const kind of ['missing', 'forged', 'duplicate', 'other']) {
    const f = fixture(); const { first, resumed } = await f.challenge(payload(), { clientIp: '' });
    let cookie = first.headers['Set-Cookie'].split(';')[0];
    if (kind === 'missing') cookie = '';
    if (kind === 'forged') cookie = cookie.replace('=', '=A');
    if (kind === 'duplicate') cookie += '; ' + cookie;
    if (kind === 'other') cookie = (await fixture().challenge(payload(), { clientIp: '' })).first.headers['Set-Cookie'].split(';')[0];
    f.calls.length = 0;
    assert.equal((await f.run(resumed, { clientIp: '' }, cookie)).status, 403);
    assert.deepEqual(f.calls, ['rate', 'rate']);
  }
});

test('step-up is teacher-only: direct v2 requests for guide, worksheet and Ramzi never call the model', async () => {
  for (const kind of ['home', 'worksheet', 'ramzi']) {
    const f = fixture(); const input = payload(); input.page.kind = kind;
    input.botVerification = { provider: 'recaptcha-v2', token: 'synthetic-human-v2-proof', requestToken: 'missing' };
    const result = await f.run(input);
    assert.equal(result.status, 403);
    assert.deepEqual(f.calls, ['rate']);
  }
});

test('non-picker teacher messages and oversized exact payloads cannot create a step-up ticket', async () => {
  for (const alter of [(p: any) => { p.teacher.candidates = []; }, (p: any) => { p.message = 'x'.repeat(701); },
    (p: any) => { p.teacher.note = 'x'.repeat(256 * 1024); }]) {
    const f = fixture(); const input = payload(); alter(input);
    const result = await f.run(input);
    assert.equal(result.body.challenge, undefined);
    assert.ok(!f.calls.includes('model'));
  }
});
