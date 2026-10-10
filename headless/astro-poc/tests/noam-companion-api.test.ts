import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  NOAM_RECAPTCHA_SECRET_NAME,
  NOT_ACTIVE_TEXT,
  PUBLIC_RECAPTCHA_SITE_KEY,
  QWEN_SECRET_NAME,
  botConfigBody,
  handleNoamSiteCompanion,
  isHeadlessPreviewOrigin,
  secretsReady,
  visitorIpFrom,
} from '../../../noam-ai/site-companion/endpoint.js';
import { FALLBACK_TEXT, QWEN_MODEL, QWEN_TIMEOUT_MS } from '../../../noam-ai/site-companion/companion.js';
import { RECAPTCHA_TIMEOUT_MS } from '../../../noam-ai/site-companion/bot-guard.js';
import { parseClassifier, selectTeacherPicks } from '../../../noam-ai/site-companion/teacher-pick.js';

const QWEN = 'qwen-test-key-xyz';
const RECAPTCHA = 'recaptcha-test-secret-xyz';

const middleSheet = {
  pdfId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
  grade: 9,
  gradeLabel: 'כיתה ט׳',
  band: 'middle',
  topicId: '2',
  topic: 'פירוק לגורמים',
  level: 'a',
  levelLabel: 'רמה א׳',
  title: 'פירוק לגורמים · רמה א׳',
  mode: 'exercise',
  pdfUrl: 'https://static.wixstatic.com/ugd/d8e7ad_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.pdf',
  questions: ['1א', '1ב', '1ג', '1ד', '2א'],
};

const elementarySheet = {
  pdfId: 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  grade: 3,
  gradeLabel: 'כיתה ג׳',
  band: 'elementary',
  topicId: '4',
  topic: 'שברים',
  level: 'b',
  levelLabel: 'רמה ב׳',
  title: 'שברים · רמה ב׳',
  mode: 'sheet',
  pdfUrl: 'https://static.wixstatic.com/ugd/d8e7ad_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb.pdf',
  questions: ['1א'],
};

const index = [middleSheet, elementarySheet];
const catalog = { grades: [] };

function qwenJson(payload: unknown) {
  return {
    ok: true,
    json: async () => ({
      choices: [{ message: { content: JSON.stringify(payload) } }],
    }),
  };
}

function mockFetch(classifier: unknown, calls: { url: string; body: string }[]) {
  return async (url: string, init?: { body?: string }) => {
    calls.push({ url: String(url), body: String(init && init.body || '') });
    if (String(url).includes('siteverify')) {
      return {
        ok: true,
        json: async () => ({
          success: true,
          score: 0.9,
          action: 'noam_site_companion',
          hostname: 'www.noamdoronmath.co.il',
        }),
      };
    }
    return qwenJson(classifier);
  };
}

function post(extra: Record<string, unknown>) {
  return handleNoamSiteCompanion(
    { method: 'POST' },
    {
      origin: 'https://www.noamdoronmath.co.il',
      clientIp: '203.0.113.20',
      qwenKey: QWEN,
      recaptchaSecret: RECAPTCHA,
      catalog,
      teacherIndex: index,
      store: new Map(),
      now: 5_000,
      payload: {
        message: 'צריך 1א בפירוק לגורמים',
        page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
        teacher: { grade: '9', topic: '2', level: 'a', note: '' },
        botVerification: { provider: 'recaptcha-v3', token: 'token' },
      },
      ...extra,
    }
  );
}

describe('Noam AI headless endpoint', () => {
  it('stays inactive and does not call Qwen when a secret is missing', async () => {
    assert.equal(secretsReady('', RECAPTCHA), false);
    assert.equal(secretsReady(QWEN, ''), false);
    let called = 0;
    const result = await handleNoamSiteCompanion(
      { method: 'POST' },
      {
        origin: 'https://gplknx-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com',
        qwenKey: '',
        recaptchaSecret: '',
        fetch: async () => {
          called += 1;
          return { ok: false, json: async () => ({}) };
        },
        payload: { message: 'שלום', page: { kind: 'teachers' } },
      }
    );
    assert.equal(called, 0);
    assert.equal(result.status, 200);
    const body = result.body as { active: boolean; code: string; answer: string; exerciseIds: string[] };
    assert.equal(body.active, false);
    assert.equal(body.code, 'NOT_ACTIVE');
    assert.equal(body.answer, NOT_ACTIVE_TEXT);
    assert.deepEqual(body.exerciseIds, []);
    const config = botConfigBody('', '');
    assert.equal(config.active, false);
    assert.equal('siteKey' in config, false);
  });

  it('rejects a failed reCAPTCHA before any Qwen call', async () => {
    let qwen = 0;
    const result = await post({
      fetch: async (url: string) => {
        if (String(url).includes('chat/completions')) qwen += 1;
        return { ok: true, json: async () => ({ success: false, score: 0.1, action: 'noam_site_companion' }) };
      },
    });
    assert.equal(qwen, 0);
    assert.equal(result.status, 403);
    assert.equal((result.body as { code: string }).code, 'BOT_VERIFICATION_FAILED');
  });

  it('classifies with Qwen Flash and returns only an existing middle-school exercise', async () => {
    const calls: { url: string; body: string }[] = [];
    const result = await post({
      fetch: mockFetch(
        { grade: 9, topicQuery: 'פירוק', level: 'a', exerciseLabels: ['1א', '99ת', '2ב'], wantsSheet: false },
        calls
      ),
    });
    assert.equal(result.status, 200);
    const body = result.body as {
      ok: boolean;
      model: string;
      exerciseIds: string[];
      sheetIds: string[];
      links: { href: string }[];
      answer: string;
    };
    assert.equal(body.ok, true);
    assert.equal(body.model, QWEN_MODEL);
    assert.equal(body.model, 'qwen3.8-flash');
    assert.deepEqual(body.exerciseIds, ['ex:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1א']);
    assert.deepEqual(body.sheetIds, []);
    assert.equal(body.answer.includes('99ת'), false);
    assert.equal(body.answer.includes('2ב'), false);
    assert.ok(body.links.every((link) => link.href.startsWith('https://static.wixstatic.com/ugd/')));
    assert.equal(JSON.stringify(body).includes(QWEN), false);
    assert.equal(JSON.stringify(body).includes(RECAPTCHA), false);
    const qwenCall = calls.find((call) => call.url.includes('chat/completions'));
    assert.ok(qwenCall);
    const sent = JSON.parse(qwenCall.body);
    assert.equal(sent.model, 'qwen3.8-flash');
    assert.equal(sent.enable_thinking, false);
  });

  it('picks an elementary sheet by topic and level, not a single exercise', async () => {
    const calls: { url: string; body: string }[] = [];
    const result = await post({
      fetch: mockFetch(
        { grade: 3, topicQuery: 'שברים', level: 'b', exerciseLabels: ['1א'], wantsSheet: false },
        calls
      ),
      payload: {
        message: 'דף שברים לכיתה ג כולל 1א',
        page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
        teacher: { grade: '3', topic: '4', level: 'b', note: '' },
        botVerification: { provider: 'recaptcha-v3', token: 'token' },
      },
    });
    const body = result.body as { exerciseIds: string[]; sheetIds: string[]; answer: string };
    assert.deepEqual(body.exerciseIds, []);
    assert.deepEqual(body.sheetIds, ['sheet:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb']);
    assert.match(body.answer, /שברים/);
    assert.equal(body.answer.includes('1א'), false);
  });

  it('does not invent an exercise the catalog does not have', () => {
    const pick = selectTeacherPicks(index, {
      message: 'רק 9ת',
      teacher: { grade: '9', topic: '2', level: 'a' },
    }, parseClassifier('{"exerciseLabels":["9ת","1א"]}'));
    assert.deepEqual(pick.exerciseIds, []);
    assert.deepEqual(pick.sheetIds, []);
  });

  it('indexes elementary sheets and middle-school exercises from the catalog', () => {
    const rows = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
    const elementary = rows.filter((row: { band: string }) => row.band === 'elementary');
    const middle = rows.filter((row: { band: string; questions: string[] }) => row.band === 'middle' && row.questions.length > 0);
    assert.ok(elementary.length > 100);
    assert.ok(middle.length > 100);
    assert.equal(elementary.some((row: { questions: string[] }) => row.questions.length > 0), false);
    assert.ok(middle.some((row: { topic: string; questions: string[] }) => row.topic.includes('פירוק') && row.questions.includes('1א')));
  });

  it('points the browser at this site and explains a missing secret', () => {
    const client = readFileSync(new URL('../public/noam-site-companion.js', import.meta.url), 'utf8');
    const bot = readFileSync(new URL('../public/noam-bot-client.js', import.meta.url), 'utf8');
    const config = readFileSync(new URL('../astro.config.mjs', import.meta.url), 'utf8');
    assert.match(client, /var API_BASE = "\/api"/);
    assert.equal(client.includes('my-site-2'), false);
    assert.match(bot, /NOT_ACTIVE/);
    assert.match(config, /QWEN_API_KEY: envField.string\(\{ context: 'server', access: 'secret', optional: true \}\)/);
    assert.match(config, /NOAM_RECAPTCHA_SECRET_KEY: envField.string\(\{ context: 'server', access: 'secret', optional: true \}\)/);
    assert.equal(QWEN_SECRET_NAME, 'QWEN_API_KEY');
    assert.equal(NOAM_RECAPTCHA_SECRET_NAME, 'NOAM_RECAPTCHA_SECRET_KEY');
    const ready = botConfigBody(QWEN, RECAPTCHA) as { siteKey: string; ok: boolean };
    assert.equal(ready.ok, true);
    assert.equal(ready.siteKey, PUBLIC_RECAPTCHA_SITE_KEY);
    assert.equal(JSON.stringify(ready).includes(RECAPTCHA), false);
  });

  it('rejects a reCAPTCHA token minted for another host', async () => {
    let qwen = 0;
    const result = await post({
      fetch: async (url: string) => {
        if (String(url).includes('chat/completions')) qwen += 1;
        return { ok: true, json: async () => ({ success: true, score: 0.9, action: 'noam_site_companion', hostname: 'evil.example' }) };
      },
    });
    assert.equal(qwen, 0);
    assert.equal(result.status, 403);
    assert.equal((result.body as { code: string }).code, 'BOT_VERIFICATION_FAILED');
  });

  it('accepts the pinned headless preview host and no broader wix host', async () => {
    const preview = 'https://jrxwre-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
    assert.equal(isHeadlessPreviewOrigin(preview), true);
    assert.equal(isHeadlessPreviewOrigin('https://preview.wix-site-host.com'), false);
    assert.equal(isHeadlessPreviewOrigin('https://noamdoronmath.example.wix-site-host.com'), false);
    assert.equal(isHeadlessPreviewOrigin('http://jrxwre-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com'), false);
    const result = await post({
      origin: preview,
      fetch: async (url: string) => {
        if (String(url).includes('siteverify')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              score: 0.9,
              action: 'noam_site_companion',
              hostname: 'jrxwre-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com',
            }),
          };
        }
        return qwenJson({ grade: 9, topicQuery: 'פירוק', level: 'a', exerciseLabels: ['1א'], wantsSheet: false });
      },
    });
    assert.equal(result.status, 200);
    assert.equal((result.body as { ok: boolean }).ok, true);
  });

  it('returns the calm unavailable text when reCAPTCHA or Qwen times out', async () => {
    assert.equal(RECAPTCHA_TIMEOUT_MS, 5_000);
    assert.equal(QWEN_TIMEOUT_MS, 12_000);
    const hang = (_url: string, init?: { signal?: AbortSignal }) => new Promise(() => {
      // Stays pending. The timeout aborts the signal and wins the race.
      void init;
    });
    const recaptcha = await post({
      fetch: hang,
      recaptchaTimeoutMs: 20,
    });
    assert.equal(recaptcha.status, 200);
    const recaptchaBody = recaptcha.body as { code: string; answer: string; ok: boolean };
    assert.equal(recaptchaBody.ok, false);
    assert.equal(recaptchaBody.code, 'UNAVAILABLE');
    assert.equal(recaptchaBody.answer, FALLBACK_TEXT);
    const qwen = await post({
      qwenTimeoutMs: 20,
      fetch: async (url: string, init?: { signal?: AbortSignal }) => {
        if (String(url).includes('siteverify')) {
          return {
            ok: true,
            json: async () => ({
              success: true,
              score: 0.9,
              action: 'noam_site_companion',
              hostname: 'www.noamdoronmath.co.il',
            }),
          };
        }
        return hang(url, init);
      },
    });
    assert.equal(qwen.status, 200);
    const qwenBody = qwen.body as { code: string; answer: string; exerciseIds: string[] };
    assert.equal(qwenBody.code, 'UNAVAILABLE');
    assert.equal(qwenBody.answer, FALLBACK_TEXT);
    assert.deepEqual(qwenBody.exerciseIds, []);
  });

  it('rates by true-client-ip and ignores a spoofed cf-connecting-ip', () => {
    const route = readFileSync(new URL('../src/pages/api/noamSiteCompanion.ts', import.meta.url), 'utf8');
    assert.equal(route.includes('clientAddress'), false);
    const spoofed = new Headers({
      'cf-connecting-ip': '198.51.100.9',
      'x-real-ip': '198.51.100.8',
      'x-forwarded-for': '198.51.100.7',
      'true-client-ip': '203.0.113.50',
    });
    assert.equal(visitorIpFrom(spoofed), '203.0.113.50');
    assert.equal(visitorIpFrom(new Headers({ 'cf-connecting-ip': '198.51.100.9' })), '');
    assert.equal(visitorIpFrom(new Headers({ 'x-real-ip': '198.51.100.8' })), '');
    assert.equal(visitorIpFrom(new Headers({ 'x-forwarded-for': '203.0.113.1, 198.51.100.2' })), '');
    assert.equal(visitorIpFrom(new Headers({ 'true-client-ip': '203.0.113.1, 198.51.100.2' })), '');
  });

  it('does not put visitors without an IP into one 12-per-minute bucket', async () => {
    assert.equal(visitorIpFrom(new Headers()), '');
    const store = new Map();
    const fetch = async () => ({
      ok: true,
      json: async () => ({ success: true, score: 0.9, action: 'noam_site_companion', hostname: 'www.noamdoronmath.co.il' }),
    });
    for (let i = 0; i < 12; i += 1) {
      const result = await post({
        clientIp: '',
        store,
        fetch,
        payload: {
          message: 'שלום',
          page: { kind: 'home', path: '/', title: 'בית' },
          botVerification: { provider: 'recaptcha-v3', token: 'same-token' },
        },
      });
      assert.equal(result.status, 200, 'token bucket ' + i);
    }
    const blocked = await post({
      clientIp: '',
      store,
      fetch,
      payload: {
        message: 'שלום',
        page: { kind: 'home', path: '/', title: 'בית' },
        botVerification: { provider: 'recaptcha-v3', token: 'same-token' },
      },
    });
    assert.equal(blocked.status, 429);
    const other = await post({
      clientIp: '',
      store,
      fetch,
      payload: {
        message: 'שלום',
        page: { kind: 'home', path: '/', title: 'בית' },
        botVerification: { provider: 'recaptcha-v3', token: 'other-token' },
      },
    });
    assert.equal(other.status, 200);
    const tight = new Map();
    for (let i = 0; i < 3; i += 1) {
      const result = await post({
        clientIp: '',
        store: tight,
        fetch,
        noIpGlobalMax: 3,
        payload: {
          message: 'שלום',
          page: { kind: 'home', path: '/', title: 'בית' },
          botVerification: { provider: 'recaptcha-v3', token: 'global-' + i },
        },
      });
      assert.equal(result.status, 200);
    }
    const capped = await post({
      clientIp: '',
      store: tight,
      fetch,
      noIpGlobalMax: 3,
      payload: {
        message: 'שלום',
        page: { kind: 'home', path: '/', title: 'בית' },
        botVerification: { provider: 'recaptcha-v3', token: 'global-next' },
      },
    });
    assert.equal(capped.status, 429);
  });
});
