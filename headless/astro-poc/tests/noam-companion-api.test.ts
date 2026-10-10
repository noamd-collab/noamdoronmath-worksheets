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
  secretsReady,
} from '../../../noam-ai/site-companion/endpoint.js';
import { QWEN_MODEL } from '../../../noam-ai/site-companion/companion.js';
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
      return { ok: true, json: async () => ({ success: true, score: 0.9, action: 'noam_site_companion' }) };
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
});
