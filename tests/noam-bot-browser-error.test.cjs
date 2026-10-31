'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const response = (status, data) => ({ ok: status >= 200 && status < 300, status, json: async () => data });
const browserError = () => ({ ok: false, code: 'BOT_VERIFICATION_FAILED', siteverify: { errorCodes: ['browser-error'], score: null, hostname: '', action: '' } });
const flush = () => new Promise(resolve => setImmediate(resolve));
const files = ['noam-bot-client.js', 'headless/astro-poc/public/noam-bot-client.js'];
function harness(file, server, options = {}) {
  const module = { exports: {} }, actions = [], posts = [], warnings = [];
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), { module, setTimeout, clearTimeout });
  const client = module.exports.create({
    api: '/api', enabled: options.enabled !== false, networkRetryDelayMs: options.delay || 0,
    verificationTimeoutMs: 200, modelTimeoutMs: options.modelTimeout || 200,
    window: { console: { warn(...args) { warnings.push(args); } } },
    loadRecaptcha: async () => ({ ready(fn) { fn(); }, async execute(_key, action) {
      actions.push(action.action); const token = 'synthetic-browser-token-' + actions.length;
      if (options.execute) await options.execute(actions.length);
      return token;
    } }),
    fetch: async (url, init) => {
      if (url === '/api/noamBotConfig') return response(200, { ok: true, provider: 'recaptcha-v3', mode: 'enforce', siteKey: 'synthetic-public-v3-key' });
      assert.equal(url, '/api/noamSiteCompanion');
      const body = JSON.parse(init.body); posts.push(body); return server(body, posts.length);
    },
  });
  return { client, actions, posts, warnings };
}

for (const file of files) {
  test(`${file}: exact browser-error receives one fresh token and retains the original request`, async () => {
    const h = harness(file, (_body, n) => n === 1 ? response(403, browserError()) : response(200, { ok: true, source: 'classifier' }));
    let challenges = 0;
    const payload = { teacher: { count: 5, candidates: ['a:1'] } };
    const result = await h.client.postJson('/api/noamSiteCompanion', payload, { isCurrent: () => true, onChallenge() { challenges += 1; } });
    assert.equal(result.source, 'classifier'); assert.equal(challenges, 0);
    assert.deepEqual(h.actions, ['noam_site_companion', 'noam_site_companion']);
    assert.deepEqual(h.posts.map(p => p.botVerification.token), ['synthetic-browser-token-1', 'synthetic-browser-token-2']);
    assert.deepEqual(h.posts.map(p => p.teacher), [payload.teacher, payload.teacher]);
    assert.doesNotMatch(JSON.stringify(h.warnings), /synthetic-browser-token/);
  });

  test(`${file}: a repeated browser-error stays denied after two attempts with an accurate message`, async () => {
    const h = harness(file, () => response(403, browserError()));
    await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}), e => e.code === 'BOT_VERIFICATION_FAILED' && e.status === 403 && e.recaptchaBrowserError === true && /Google.*תקלה בתקשורת/.test(e.message));
    assert.equal(h.posts.length, 2); assert.equal(h.actions.length, 2);
  });

  test(`${file}: all non-exact, mixed, malformed or non-403 assessments stay blocked without retry`, async () => {
    const cases = [
      { status: 401 }, { status: 429 }, { status: 500 }, { code: 'ANOTHER_ERROR' }, { ok: undefined },
      { siteverify: undefined }, { siteverify: { errorCodes: ['browser-error'] } },
      ...[[], ['timeout-or-duplicate'], ['browser-error', 'timeout-or-duplicate'], ['browser-error', 'browser-error'], [['browser-error']], 'browser-error'].map(errorCodes => ({ siteverify: { ...browserError().siteverify, errorCodes } })),
      ...[{ score: 0.1 }, { score: undefined }, { hostname: 'www.noamdoronmath.co.il' }, { action: 'noam_site_companion' }].map(fields => ({ siteverify: { ...browserError().siteverify, ...fields } })),
    ];
    for (const fields of cases) {
      const { status = 403, ...override } = fields;
      const h = harness(file, () => response(status, { ...browserError(), ...override }));
      let challenges = 0;
      await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}, { onChallenge() { challenges += 1; } }));
      assert.equal(h.posts.length, 1, JSON.stringify(fields)); assert.equal(h.actions.length, 1); assert.equal(challenges, 0);
    }
  });

  test(`${file}: unreadable and stalled 403 bodies cannot qualify`, async () => {
    for (const json of [async () => { throw new Error('invalid JSON'); }, () => new Promise(() => {})]) {
      const h = harness(file, () => ({ ok: false, status: 403, json }), { modelTimeout: 20 });
      await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}));
      assert.equal(h.posts.length, 1); assert.equal(h.actions.length, 1);
    }
  });

  test(`${file}: disabled clients and differently tagged thrown errors cannot retry a security denial`, async () => {
    const disabled = harness(file, () => response(403, browserError()), { enabled: false });
    await assert.rejects(disabled.client.postJson('/api/noamSiteCompanion', {}));
    assert.equal(disabled.posts.length, 1); assert.equal(disabled.actions.length, 0);
    for (const extra of [{ status: 500, code: 'BOT_VERIFICATION_FAILED' }, { status: 403, code: 'BOT_OTHER_ERROR' }]) {
      const h = harness(file, () => { throw Object.assign(new Error('tagged'), { recaptchaBrowserError: true, ...extra }); });
      await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {})); assert.equal(h.posts.length, 1);
    }
  });

  test(`${file}: browser and transport recovery share one budget in either order`, async () => {
    for (const browserFirst of [true, false]) {
      const h = harness(file, (_body, n) => {
        if ((n === 1) === browserFirst) return response(403, browserError());
        throw new TypeError('Failed to fetch');
      });
      await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}));
      assert.equal(h.posts.length, 2); assert.equal(h.actions.length, 2);
    }
  });

  test(`${file}: a changed or throwing context never starts the recovery execute`, async () => {
    for (const throws of [false, true]) {
      let current = true;
      const h = harness(file, () => { current = false; return response(403, browserError()); });
      await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}, { isCurrent() {
        if (!current && throws) throw new TypeError('stale context'); return current;
      } }), { code: 'BOT_REQUEST_CONTEXT_CHANGED' });
      assert.equal(h.actions.length, 1); assert.equal(h.posts.length, 1);
    }
  });

  test(`${file}: abort during recovery delay prevents another token or POST`, async () => {
    const controller = new AbortController();
    const h = harness(file, () => { setTimeout(() => controller.abort(), 5); return response(403, browserError()); }, { delay: 20 });
    await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}, { signal: controller.signal }), { code: 'BOT_REQUEST_CANCELLED' });
    assert.equal(h.actions.length, 1); assert.equal(h.posts.length, 1);
  });

  test(`${file}: edits or abort while the fresh token is pending prevent its POST`, async () => {
    for (const abort of [false, true]) {
      const controller = new AbortController(); let current = true, finish;
      const h = harness(file, () => response(403, browserError()), { execute: n => n === 2 ? new Promise(resolve => { finish = resolve; }) : undefined });
      const pending = h.client.postJson('/api/noamSiteCompanion', {}, { isCurrent: () => current, signal: controller.signal });
      while (!finish) await flush();
      if (abort) controller.abort(); else current = false;
      finish();
      await assert.rejects(pending, { code: abort ? 'BOT_REQUEST_CANCELLED' : 'BOT_REQUEST_CONTEXT_CHANGED' });
      assert.equal(h.actions.length, 2); assert.equal(h.posts.length, 1);
    }
  });

  test(`${file}: v2 redemption never triggers browser-error recovery`, async () => {
    const challenge = { provider: 'recaptcha-v2', siteKey: 'synthetic-public-v2-key', requestToken: 'synthetic-valid-signed-ticket', expiresAt: Date.now() + 10000 };
    const h = harness(file, (_body, n) => n === 1 ? response(403, { code: 'BOT_STEP_UP_REQUIRED', challenge }) : response(403, browserError()));
    await assert.rejects(h.client.postJson('/api/noamSiteCompanion', {}, { onChallenge: async () => 'synthetic-human-proof' }));
    assert.equal(h.posts.length, 2); assert.equal(h.actions.length, 1);
    assert.equal(h.posts[1].botVerification.provider, 'recaptcha-v2');
  });
}

test('real client and real server guard verify both tokens; model work occurs only after the fresh proof passes', async () => {
  const { handleNoamSiteCompanion } = await import('../noam-ai/site-companion/endpoint.js');
  const pdf = 'a'.repeat(32), calls = [], verified = [];
  const row = { pdfId: pdf, grade: 3, gradeLabel: 'כיתה ג׳', topicId: '11', topic: 'שברים', band: 'elementary', level: 'a', levelLabel: 'רמה א׳', mode: 'exercise', title: 'שברים', pdfUrl: `https://static.wixstatic.com/ugd/d8e7ad_${pdf}.pdf`, questions: Array.from({ length: 20 }, (_, i) => String(i + 1)) };
  const h = harness(files[0], async body => {
    const result = await handleNoamSiteCompanion({ method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' }, {
      payload: body, origin: 'https://www.noamdoronmath.co.il', requestHost: 'www.noamdoronmath.co.il', clientIp: '203.0.113.40',
      qwenKey: 'synthetic-model-key', recaptchaSecret: 'synthetic-v3-secret', teacherIndex: [row], catalog: { grades: [] },
      rateBackend: { async take() { calls.push('rate'); return true; } },
      fetch: async (url, init) => {
        if (url === 'https://www.google.com/recaptcha/api/siteverify') {
          calls.push('verify'); verified.push(new URLSearchParams(init.body).get('response'));
          return response(200, verified.length === 1 ? { success: false, 'error-codes': ['browser-error'] } : { success: true, score: 0.9, hostname: 'www.noamdoronmath.co.il', action: 'noam_site_companion' });
        }
        assert.match(url, /\/chat\/completions$/); calls.push('model');
        return response(200, { choices: [{ message: { content: JSON.stringify({ grade: 3, level: 'a', exerciseLabels: ['a:1','a:2','a:3','a:4','a:5'] }) } }] });
      },
    });
    return response(result.status, result.body);
  });
  const result = await h.client.postJson('/api/noamSiteCompanion', { message: 'בחר 5 שאלות', page: { kind: 'teachers', path: '/teachers', title: 'למורים' }, teacher: { grade: '3', topic: '11', level: 'a', count: 5, candidates: row.questions.map(label => ({ id: 'a:' + label, label, text: 'שאלה ' + label })) } });
  assert.equal(result.source, 'classifier'); assert.equal(result.exerciseIds.length, 5);
  assert.deepEqual(calls, ['rate', 'verify', 'rate', 'verify', 'model']);
  assert.deepEqual(verified, ['synthetic-browser-token-1', 'synthetic-browser-token-2']);
});
