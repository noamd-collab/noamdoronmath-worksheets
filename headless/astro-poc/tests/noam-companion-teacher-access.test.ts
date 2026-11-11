import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const clients = [
  ['served', new URL('../public/noam-site-companion.js', import.meta.url)],
  ['legacy', new URL('../../../noam-site-companion.js', import.meta.url)],
] as const;
const botSource = readFileSync(new URL('../public/noam-bot-client.js', import.meta.url), 'utf8');

function definition(source: string, name: string) {
  const start = source.indexOf(`  function ${name}(`);
  const end = source.indexOf('\n  function ', start + 1);
  assert.ok(start >= 0 && end > start, `Exercise the shipped ${name} function`);
  return source.slice(start, end);
}

// Use the shipped SDK's response decoder so tests cover today's string error
// contract as well as a structured error code, without any network request.
const responseError = new Function(`
  ${definition(botSource, 'makeError')}
  ${definition(botSource, 'validatedChallenge')}
  ${definition(botSource, 'responseError')}
  return responseError;
`)() as (response: { status: number }, data: unknown) => Error;

type Result = { answer: string; details?: string; primary?: { href: string; label: string }; chips?: unknown[] };
type Reply = { error: unknown } | { result: Result };

function widget(source: string, teacher: boolean) {
  const { document, window } = parseHTML(`<html><head><title>אזור המורים</title></head>
    <body ${teacher ? 'data-noam-companion="teacher"' : ''}>
      <p id="answer"></p><a id="primary" hidden></a><button id="ramzi" hidden></button>
      <div id="chips"></div><button id="more" hidden></button><p id="details"></p>
      <form id="request"><input id="message"><button type="submit">שליחה</button></form>
    </body></html>`);
  const replies: Reply[] = [];
  const requests: unknown[] = [];
  let pending: (() => void) | undefined;
  const submitAt = source.indexOf('  form.addEventListener("submit"');
  const submitEnd = source.indexOf('  document.addEventListener("keydown"', submitAt);
  assert.ok(submitAt >= 0 && submitEnd > submitAt);
  const bind = new Function('document', 'replies', 'requests', 'rendered', `
    const location = { pathname: ${JSON.stringify(teacher ? '/teachers/app' : '/teachers')}, search: '' };
    const panel = document.body, form = document.getElementById('request'), input = document.getElementById('message');
    const answerEl = document.getElementById('answer'), primaryEl = document.getElementById('primary');
    const ramziEl = document.getElementById('ramzi'), chipsEl = document.getElementById('chips');
    const moreEl = document.getElementById('more'), detailsEl = document.getElementById('details');
    const API = '/api/noamSiteCompanion', FALLBACK = 'לא זמין כרגע', EXPORT_NOTE = 'existing export note';
    let streaming = false, hasAnswer = false, mode = 'engaged';
    const isLocalSolve = () => false, teacherContext = () => null, forceSiteFont = () => {};
    const showThinking = () => {}, stopThinking = () => {}, fitCompact = () => {};
    // A preview must not inherit siteHref's production-origin fallback for login.
    const siteHref = path => 'https://www.noamdoronmath.co.il' + path;
    const ensureBotClient = async () => ({ postJson: async (url, payload) => {
      requests.push({url, payload});
      const reply = replies.shift();
      if ('error' in reply) throw reply.error;
      return reply.result;
    }});
    ${['pageKind', 'teacherGoalChips', 'appendChip', 'setChips', 'showResult'].map(name => definition(source, name)).join('\n')}
    const originalShowResult = showResult;
    showResult = result => { originalShowResult(result); rendered(); };
    ${source.slice(submitAt, submitEnd)}
  `);
  bind(document, replies, requests, () => { pending?.(); });
  return {
    document,
    requests,
    async submit(reply: Reply) {
      replies.push(reply);
      const finished = new Promise<void>(resolve => { pending = resolve; });
      (document.getElementById('message') as HTMLInputElement).value = 'בנה לי שיעור';
      document.getElementById('request')!.dispatchEvent(new window.Event('submit', { cancelable: true }));
      await finished;
    },
  };
}

for (const [name, path] of clients) {
  const source = readFileSync(path, 'utf8');
  test(`${name}: owner-gate errors render Hebrew guidance and one same-origin login link`, { timeout: 3000 }, async () => {
    for (const teacher of [false, true]) {
      for (const [status, code, expected] of [
        [401, 'TEACHER_SIGN_IN_REQUIRED', 'כדי לבנות שיעור, יש להתחבר לחשבון Google המורשה.'],
        [403, 'TEACHER_ACCESS_DENIED', 'החשבון הזה אינו מורשה לאזור המורים.'],
      ] as const) {
        const h = widget(source, teacher);
        await h.submit({ error: responseError({ status }, { ok: false, error: code }) });
        const primary = h.document.getElementById('primary')!;
        assert.equal(h.document.getElementById('answer')!.textContent, expected);
        assert.match(h.document.getElementById('details')!.textContent!, /בבדיקות פרטיות/);
        assert.doesNotMatch(h.document.body.textContent!, /TEACHER_|existing export note/);
        assert.equal(primary.hidden, false);
        assert.equal(primary.getAttribute('href'), '/teachers/login');
        assert.equal(h.document.querySelectorAll('a[href="/teachers/login"]').length, 1);
        assert.equal(h.document.getElementById('ramzi')!.hidden, true);
        assert.equal(h.requests.length, 1, 'The presentation path never retries or bypasses authorization');
      }
    }
  });

  test(`${name}: structured owner-gate codes use the same localized presentation`, { timeout: 3000 }, async () => {
    const h = widget(source, false);
    await h.submit({ error: responseError({ status: 401 }, { error: { code: 'TEACHER_SIGN_IN_REQUIRED', message: 'Sign in' } }) });
    assert.equal(h.document.getElementById('primary')!.getAttribute('href'), '/teachers/login');
    assert.match(h.document.getElementById('answer')!.textContent!, /להתחבר לחשבון Google/);
  });

  test(`${name}: CAPTCHA, availability, and nonmatching errors retain their original behavior`, { timeout: 3000 }, async () => {
    for (const teacher of [false, true]) {
      for (const [status, code, message] of [
        [403, 'BOT_VERIFICATION_FAILED', 'בדיקת האבטחה נכשלה'],
        [403, 'BOT_STEP_UP_REQUIRED', 'נדרשת בדיקת אבטחה'],
        [401, 'BOT_SESSION_REQUIRED', 'נדרש אימות אבטחה'],
        [401, 'BOT_VERIFICATION_FAILED', 'TEACHER_SIGN_IN_REQUIRED'],
        [503, 'HTTP_ERROR', 'TEACHER_AUTH_UNAVAILABLE'],
        [500, 'HTTP_ERROR', 'TEACHER_SIGN_IN_REQUIRED'],
        [401, 'HTTP_ERROR', 'TEACHER_SIGN_IN_REQUIRED_extra'],
        [403, 'HTTP_ERROR', 'TEACHER_SIGN_IN_REQUIRED'],
      ] as const) {
        const h = widget(source, teacher);
        await h.submit({ error: responseError({ status }, { code, error: message }) });
        assert.equal(h.document.getElementById('answer')!.textContent, message);
        assert.equal(h.document.getElementById('details')!.textContent, teacher ? message + '\nexisting export note' : message);
        assert.equal(h.document.querySelector('a[href="/teachers/login"]'), null);
        const primary = h.document.getElementById('primary')!;
        assert.equal(primary.hidden, !teacher);
        if (teacher) assert.equal(primary.getAttribute('href'), 'https://www.noamdoronmath.co.il/factoring-grade-9');
        assert.equal(h.requests.length, 1);
      }
    }
  });

  test(`${name}: a later normal response clears the login guidance and keeps navigation usable`, { timeout: 3000 }, async () => {
    const h = widget(source, false);
    await h.submit({ error: responseError({ status: 401 }, { error: 'TEACHER_SIGN_IN_REQUIRED' }) });
    await h.submit({ result: { answer: 'הנה דפי העבודה', primary: { href: '/worksheets', label: 'דפי עבודה' }, chips: [] } });
    assert.equal(h.requests.length, 2, 'The failed request releases the existing streaming lock');
    assert.equal(h.document.getElementById('answer')!.textContent, 'הנה דפי העבודה');
    assert.equal(h.document.getElementById('details')!.textContent, 'הנה דפי העבודה');
    assert.equal(h.document.getElementById('primary')!.getAttribute('href'), '/worksheets');
    assert.equal(h.document.querySelector('a[href="/teachers/login"]'), null);
  });
}
