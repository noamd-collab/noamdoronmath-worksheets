import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { handleCompanionTurn } from '../../../noam-ai/site-companion/companion.js';
import {
  acceptDevBypass,
  recaptchaBypassFromEnv,
} from '../../../noam-ai/site-companion/bot-guard.js';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { advanceExerciseIntake } from '../../../noam-ai/site-companion/exercise-intake.js';
import { TEACHERS_TEXT, resolveDeterministicTurn } from '../../../noam-ai/site-companion/guide-flow.js';
import { wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
const guide = JSON.parse(readFileSync(new URL('../src/data/site-guide.v1.json', import.meta.url), 'utf8'));
const teacherIndex = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const client = readFileSync(new URL('../public/noam-site-companion.js', import.meta.url), 'utf8');
const teacherPage = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const route = readFileSync(new URL('../src/pages/api/noamSiteCompanion.ts', import.meta.url), 'utf8');

const TOKEN = 'dev-bypass-token-not-for-production';
const PREVIEW = 'https://jrxwre-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';

function labelsOf(result: { chips?: { label: string }[]; options?: { label: string }[] }) {
  return (result.chips || result.options || []).map((chip) => chip.label);
}

function unique(labels: string[]) {
  assert.equal(new Set(labels).size, labels.length);
  assert.equal(labels.includes('רמה ג׳'), false);
  assert.equal(labels.includes('רמה ג'), false);
}

describe('Noam AI production spec', () => {
  it('explains the teachers page and offers the page, not only a link', () => {
    const result = resolveDeterministicTurn(
      { message: 'מה יש בעמוד המורים?', page: { kind: 'home', path: '/', title: 'בית' } },
      { catalog, guide, teacherIndex }
    );
    assert.equal(result && result.source, 'site-guide');
    assert.equal(result && result.answer, TEACHERS_TEXT);
    assert.match(result.answer, /אשף/);
    assert.match(result.answer, /כיתה ונושא/);
    assert.match(result.answer, /סעיפים/);
    assert.equal(result.primary.href, '/teachers');
    assert.ok(result.answer.length > result.primary.label.length);
  });

  it('keeps a single conversation window', () => {
    assert.equal((client.match(/panel\.id = "noam-site-companion-panel"/g) || []).length, 1);
    assert.ok(client.includes('if (window.__noamSiteCompanion) return'));
    assert.equal(client.includes('window.open'), false);
    assert.ok(client.includes('noam-ai-one-window'));
    assert.ok(client.includes('id="noam-site-companion-log"'));
    assert.ok(client.includes('location.assign(wizard.href)'));
  });

  it('asks count, level, lesson length, grade, and topic, then picks that many existing questions', () => {
    const asked = advanceExerciseIntake(
      'תבחר 2 תרגילים בדלתון לכיתה ט׳ רמה א׳ לשיעור של 30 דקות',
      null,
      teacherIndex,
      { path: '/grade-3', title: 'כיתה ג׳' }
    );
    assert.equal(asked.exerciseIds.length, 0);
    assert.equal(asked.intake.topicId, '');
    assert.match(asked.answer, /נושא/);
    const turn = advanceExerciseIntake('דלתון', asked.intake, teacherIndex, { path: '/grade-3' });
    assert.equal(turn.source, 'exercise-intake');
    assert.equal(turn.exerciseIds.length, 2);
    assert.equal(turn.wizard && turn.wizard.count, 2);
    assert.equal(turn.answer.includes('רמה ג'), false);
    assert.match(turn.answer, /רמה א׳/);
    assert.match(turn.answer, /30 דקות/);
    assert.match(turn.answer, /אשף/);
    const sheet = teacherIndex.find((row: { grade: number; topic: string; level: string; questions: string[] }) => {
      return row.grade === 9 && row.topic === 'דלתון' && row.level === 'a';
    });
    const allowed = new Set(sheet.questions.map((label: string) => 'ex:' + sheet.pdfId + ':' + label));
    assert.ok(turn.exerciseIds.every((id: string) => allowed.has(id)));
    const parsed = wizardPrefillFromSearch(String(turn.wizard.href).slice(turn.wizard.href.indexOf('?')));
    assert.deepEqual(parsed && parsed.exerciseIds, turn.exerciseIds);
    assert.equal(parsed && parsed.grade, '9');
    assert.equal(parsed && parsed.topic, '46');
    assert.equal(parsed && parsed.level, 'a');
    assert.equal(parsed && parsed.minutes, 30);
    assert.match(teacherPage, /applyWizardPrefill/);
    assert.match(teacherPage, /wizardPrefillFromSearch\(location\.search\)/);
  });

  it('asks the missing slots in order and never offers רמה ג׳', () => {
    let turn = advanceExerciseIntake('להרכיב שיעור', null, teacherIndex);
    assert.match(turn.answer, /כמה סעיפים/);
    unique(labelsOf(turn));
    turn = advanceExerciseIntake('רמה ג׳', turn.intake, teacherIndex);
    assert.equal(turn.answer.includes('רמה ג'), false);
    assert.deepEqual(labelsOf(turn), ['רמה א׳', 'רמה ב׳', 'מצוינות']);
    turn = advanceExerciseIntake('4', { ...turn.intake, waiting: 'count', level: null }, teacherIndex);
    assert.match(turn.answer, /איזו רמה/);
    unique(labelsOf(turn));
  });

  it('asks a different clarifying question instead of repeating לא מצאתי', () => {
    const tiny = [{
      pdfId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      grade: 9,
      gradeLabel: 'כיתה ט׳',
      topicId: '46',
      topic: 'דלתון',
      level: 'a',
      levelLabel: 'רמה א׳',
      questions: ['1א'],
    }];
    const asked = advanceExerciseIntake('תבחר 4 תרגילים בדלתון לכיתה ט׳ רמה א׳ לשיעור של 30 דקות', null, tiny);
    assert.match(asked.answer, /נושא/);
    const first = advanceExerciseIntake('דלתון', asked.intake, tiny);
    assert.equal(first.exerciseIds.length, 0);
    assert.equal(first.answer.includes('לא מצאתי'), false);
    assert.match(first.answer, /1/);
    const second = advanceExerciseIntake('4', first.intake, tiny);
    assert.equal(second.exerciseIds.length, 0);
    assert.equal(second.answer.includes('לא מצאתי'), false);
    assert.notEqual(first.answer, second.answer);
    unique(labelsOf(first));
    unique(labelsOf(second));
  });

  it('links kite to grade 9 quadrilaterals and not to grade 3', async () => {
    let called = 0;
    const result = await handleCompanionTurn(
      { message: 'עפיפון לכיתה ג׳', page: { kind: 'topic', path: '/grade-3', title: 'כיתה ג׳' } },
      { catalog, guide, apiKey: 'server-side', fetch: async () => { called += 1; throw new Error('model'); } }
    );
    assert.equal(called, 0);
    assert.equal(result.source, 'topic-order');
    assert.match(result.answer, /כיתה ט׳/);
    assert.equal(result.answer.includes('כיתה ג'), false);
    assert.deepEqual(result.chips.map((chip: { href: string }) => chip.href), ['/kite-grade-9']);
    assert.equal(result.chips.some((chip: { href: string }) => /grade-3|כיתה ג/.test(chip.href + chip.label)), false);
  });

  it('does not repeat option buttons', () => {
    const turn = advanceExerciseIntake('להרכיב שיעור', null, teacherIndex);
    unique(labelsOf(turn));
    assert.equal(client.includes('teacherGoalChips().forEach'), false);
    assert.ok(client.includes('list.concat(teacherGoalChips())'));
    assert.ok(client.includes('seen["label:" + label]'));
  });

  it('shows חושב… with a running seconds counter and clears the input after send', () => {
    assert.ok(client.includes('function thinkingLabel(seconds)'));
    assert.ok(client.includes('return "חושב…";'));
    assert.ok(client.includes('return "חושב… 1 שנייה";'));
    assert.ok(client.includes('return "חושב… " + seconds + " שניות";'));
    assert.ok(client.includes('setInterval'));
    assert.ok(client.includes('showThinking();'));
    const submit = client.slice(client.indexOf('form.addEventListener("submit"'));
    const clearAt = submit.indexOf('input.value = ""');
    const focusAt = submit.indexOf('input.focus()');
    const postAt = submit.indexOf('client.postJson(API');
    assert.ok(clearAt > 0 && focusAt > clearAt && clearAt < postAt);
  });

  it('uses a mobile bottom sheet that leaves the lesson on screen', () => {
    assert.ok(client.includes('panel.dataset.sheet = window.innerWidth < 768 ? "bottom" : "rail"'));
    assert.ok(client.includes('grid-template-rows:minmax(0,1fr) minmax(168px,42dvh)'));
    assert.ok(client.includes('html.noam-ai-engaged #noam-site-companion-panel{grid-column:1;grid-row:2'));
    assert.ok(client.includes('revealLessonCard'));
    assert.ok(client.includes('.exact-topic-demo, .concept-loop__card, .ka-film'));
    assert.equal(client.includes('bottom:calc(40dvh + 8px)'), false);
  });

  it('does not let reCAPTCHA block a guide answer, and keeps the dev bypass off in production', async () => {
    let called = 0;
    const guided = await handleNoamSiteCompanion(
      { method: 'POST' },
      {
        origin: 'https://www.noamdoronmath.co.il',
        clientIp: '203.0.113.60',
        qwenKey: 'qwen-test-key-xyz',
        recaptchaSecret: 'recaptcha-test-secret-xyz',
        catalog,
        guide,
        teacherIndex,
        fetch: async () => {
          called += 1;
          throw new Error('recaptcha down');
        },
        payload: {
          message: 'מה יש בעמוד המורים?',
          page: { kind: 'home', path: '/', title: 'בית' },
        },
      }
    );
    assert.equal(called, 0);
    assert.equal(guided.status, 200);
    assert.match((guided.body as { answer: string }).answer, /אשף/);

    assert.equal(recaptchaBypassFromEnv({
      NODE_ENV: 'production',
      NOAM_RECAPTCHA_BYPASS: '1',
      NOAM_RECAPTCHA_BYPASS_TOKEN: TOKEN,
    }, PREVIEW).enabled, false);
    assert.equal(acceptDevBypass(
      { provider: 'dev-bypass', token: TOKEN },
      { enabled: true, token: TOKEN, nodeEnv: 'production' },
      PREVIEW
    ), false);
    assert.equal(acceptDevBypass(
      { provider: 'dev-bypass', token: TOKEN },
      { enabled: true, token: TOKEN, nodeEnv: 'test' },
      'https://www.noamdoronmath.co.il'
    ), false);
    assert.equal(client.includes('dev-bypass'), false);
    assert.ok(client.includes('html.noam-companion-open .grecaptcha-badge{visibility:hidden!important}'));
    assert.ok(client.includes('מוגן באמצעות reCAPTCHA'));
    assert.match(route, /recaptchaBypassFromEnv\(process\.env, requestHost\)/);
    assert.match(route, /new URL\(request\.url\)\.hostname/);
    assert.equal(/recaptchaBypassFromEnv\(process\.env,\s*context\.request\.headers/.test(route), false);

    const enabled = recaptchaBypassFromEnv({
      NODE_ENV: 'test',
      NOAM_RECAPTCHA_BYPASS: '1',
      NOAM_RECAPTCHA_BYPASS_TOKEN: TOKEN,
    }, PREVIEW);
    assert.equal(enabled.enabled, true);
    let sawVerify = false;
    const answered = await handleNoamSiteCompanion(
      { method: 'POST', url: PREVIEW + '/api/noamSiteCompanion' },
      {
        origin: PREVIEW,
        clientIp: '203.0.113.61',
        qwenKey: 'qwen-test-key-xyz',
        recaptchaSecret: 'recaptcha-test-secret-xyz',
        catalog: { grades: [] },
        teacherIndex: [{
          pdfId: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          grade: 9,
          gradeLabel: 'כיתה ט׳',
          topicId: '2',
          topic: 'פירוק לגורמים',
          level: 'a',
          levelLabel: 'רמה א׳',
          questions: ['1א', '1ב'],
        }],
        store: new Map(),
        now: 8_000,
        recaptchaBypass: enabled,
        fetch: async (url: string) => {
          if (String(url).includes('siteverify')) {
            sawVerify = true;
            throw new Error('verify');
          }
          return {
            ok: true,
            json: async () => ({
              choices: [{ message: { content: JSON.stringify({ grade: 9, topicQuery: 'פירוק', level: 'a', exerciseLabels: ['1א'], wantsSheet: false }) } }],
            }),
          };
        },
        payload: {
          message: 'צריך 1א בפירוק לגורמים',
          page: { kind: 'teachers', path: '/teachers', title: 'למורים' },
          teacher: { grade: '9', topic: '2', level: 'a', note: '' },
          botVerification: { provider: 'dev-bypass', token: TOKEN },
        },
      }
    );
    assert.equal(sawVerify, false);
    assert.equal(answered.status, 200);
    const body = answered.body as { exerciseIds: string[]; answer: string };
    assert.deepEqual(body.exerciseIds, ['ex:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:1א']);
    assert.equal(body.answer.includes('1א'), true);
  });

  it('does not treat a lesson length as topic 30-60-90, and asks grade then topic', () => {
    const page = { kind: 'topic', path: '/grade-3', title: 'כיתה ג׳' };
    assert.ok(teacherIndex.some((row: { topic: string }) => String(row.topic).includes('30-60-90')));
    let turn = resolveDeterministicTurn(
      { message: 'להרכיב שיעור', page },
      { teacherIndex }
    );
    turn = resolveDeterministicTurn(
      { message: '4', page, intake: turn.intake },
      { teacherIndex }
    );
    turn = resolveDeterministicTurn(
      { message: 'רמה א׳', page, intake: turn.intake },
      { teacherIndex }
    );
    turn = resolveDeterministicTurn(
      { message: '30 דקות', page, intake: turn.intake },
      { teacherIndex }
    );
    assert.equal(turn.intake.minutes, 30);
    assert.equal(turn.intake.grade, null);
    assert.equal(turn.intake.topicId, '');
    assert.equal(turn.wizard, null);
    assert.equal(String(turn.answer).includes('30-60-90'), false);
    assert.match(turn.answer, /לאיזו כיתה/);
    assert.match(turn.answer, /ברירת המחדל היא כיתה ג׳/);
    const grade3 = teacherIndex.find((row: { grade: number; gradeLabel: string }) => row.grade === 3);
    assert.equal(labelsOf(turn)[0], grade3.gradeLabel);
    turn = resolveDeterministicTurn(
      { message: grade3.gradeLabel, page, intake: turn.intake },
      { teacherIndex }
    );
    assert.equal(turn.intake.grade, 3);
    assert.equal(turn.intake.topicId, '');
    assert.match(turn.answer, /נושא/);
    assert.equal(String(turn.answer).includes('30-60-90'), false);
  });

  it('parses typed chip labels the same way as taps', () => {
    const page = { path: '/grade-9', title: 'כיתה ט׳' };
    let turn = advanceExerciseIntake('להרכיב שיעור', null, teacherIndex, page);
    turn = advanceExerciseIntake('4 סעיפים', turn.intake, teacherIndex, page);
    assert.equal(turn.intake.count, 4);
    assert.match(turn.answer, /איזו רמה/);
    turn = advanceExerciseIntake('6 סעיפים', { ...turn.intake, waiting: 'count', count: null }, teacherIndex, page);
    assert.equal(turn.intake.count, 6);
    turn = advanceExerciseIntake('30 דקות', { ...turn.intake, waiting: 'minutes', minutes: null, level: 'a' }, teacherIndex, page);
    assert.equal(turn.intake.minutes, 30);
    assert.equal(turn.intake.topicId, '');
    assert.equal(String(turn.answer).includes('30-60-90'), false);
  });

  it('enables the recaptcha bypass only on the request host, with a constant-time compare', () => {
    const guardSrc = readFileSync(new URL('../../../noam-ai/site-companion/bot-guard.js', import.meta.url), 'utf8');
    const previewHost = 'jrxwre-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
    const env = {
      NOAM_RECAPTCHA_BYPASS: '1',
      NOAM_RECAPTCHA_BYPASS_TOKEN: TOKEN,
    };
    assert.equal(recaptchaBypassFromEnv(env, previewHost).enabled, true);
    assert.equal(recaptchaBypassFromEnv(env, 'www.noamdoronmath.co.il').enabled, false);
    assert.equal(recaptchaBypassFromEnv(env, 'noamdoronmath.co.il').enabled, false);
    assert.equal(recaptchaBypassFromEnv(env, 'https://www.noamdoronmath.co.il').enabled, false);
    assert.equal(recaptchaBypassFromEnv({ ...env, NODE_ENV: 'production' }, previewHost).enabled, false);
    const enabled = recaptchaBypassFromEnv(env, previewHost);
    const wrong = TOKEN.slice(0, -1) + (TOKEN.endsWith('n') ? 'm' : 'n');
    assert.equal(wrong.length, TOKEN.length);
    assert.equal(acceptDevBypass({ provider: 'dev-bypass', token: TOKEN }, enabled, previewHost), true);
    assert.equal(acceptDevBypass({ provider: 'dev-bypass', token: wrong }, enabled, previewHost), false);
    assert.equal(acceptDevBypass({ provider: 'dev-bypass', token: TOKEN }, enabled, 'www.noamdoronmath.co.il'), false);
    assert.equal(acceptDevBypass({ provider: 'dev-bypass', token: TOKEN }, enabled, 'https://evil.example'), false);
    assert.match(guardSrc, /timingSafeEqual/);
    assert.equal(guardSrc.includes('provided === expected'), false);
  });

  it('rate limits a fixed guide answer', async () => {
    const store = new Map();
    const deps = {
      origin: 'https://www.noamdoronmath.co.il',
      clientIp: '203.0.113.70',
      qwenKey: 'qwen-test-key-xyz',
      recaptchaSecret: 'recaptcha-test-secret-xyz',
      catalog,
      guide,
      teacherIndex,
      store,
      now: 9_000,
      fetch: async () => {
        throw new Error('model');
      },
      payload: {
        message: 'מה יש בעמוד המורים?',
        page: { kind: 'home', path: '/', title: 'בית' },
      },
    };
    for (let i = 0; i < 12; i += 1) {
      const result = await handleNoamSiteCompanion({ method: 'POST' }, deps);
      assert.equal(result.status, 200, 'guide ' + i);
    }
    const blocked = await handleNoamSiteCompanion({ method: 'POST' }, deps);
    assert.equal(blocked.status, 429);
  });

  it('keeps the compact chat readable and off the teachers wizard', () => {
    assert.ok(client.includes('noam-log-user'));
    assert.ok(client.includes('noam-log-bot'));
    assert.equal(client.includes('return "https://www.noamdoronmath.co.il" + path'), false);
    assert.match(client, /function siteHref\(path\) \{\s*return path;\s*\}/);
    assert.ok(client.includes('function placeOffWizard()'));
    assert.ok(client.includes('document.querySelector(".scenario-list")'));
    assert.ok(client.includes('if (mode === "compact") placeOffWizard();'));
    assert.equal(client.includes('#noam-site-companion-panel.is-compact #noam-site-companion-log{display:none!important}'), false);
    assert.ok(client.includes('#noam-site-companion-panel.is-compact #noam-site-companion-log{display:flex'));
    assert.match(teacherPage, /#questions input:checked/);
    assert.match(teacherPage, /scrollIntoView/);
    const teachersHtml = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');
    assert.match(teachersHtml, /html\.noam-companion-open \.toast,html\.noam-ai-engaged \.toast\{bottom:auto;top:16px\}/);
  });
});
