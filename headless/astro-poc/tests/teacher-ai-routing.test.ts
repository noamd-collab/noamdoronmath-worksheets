import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { handleNoamSiteCompanion } from '../../../noam-ai/site-companion/endpoint.js';
import { resolveDeterministicTurn, TEACHERS_TEXT } from '../../../noam-ai/site-companion/guide-flow.js';

const catalog = JSON.parse(readFileSync(new URL('../src/data/catalog.v1.json', import.meta.url), 'utf8'));
const guide = JSON.parse(readFileSync(new URL('../src/data/site-guide.v1.json', import.meta.url), 'utf8'));
const teacherIndex = JSON.parse(readFileSync(new URL('../src/data/teacher-pick-index.json', import.meta.url), 'utf8'));
const picker = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const messageTemplate = picker.match(/message:\s*(`[^`]+`),\s*\n\s*page:/)?.[1];
assert.ok(messageTemplate, 'Test the real button prompt, including words that can also match navigation intents');
const pickerMessage = new Function('count', `return ${messageTemplate};`) as (count: number) => string;
const sheet = teacherIndex.find((item: { grade: number; topicId: string; level: string }) => item.grade === 9 && item.topicId === '2' && item.level === 'a');
assert.ok(sheet);
const candidates = (sheet.questions as string[]).filter((label) => /^\d+א$/.test(label)).map((label) => ({
  id: `a:${label}`,
  label,
  text: `ביסוס · רמה א׳ · שאלה ${parseInt(label, 10)} · 4 סעיפים`,
}));
const paths = ['/teachers', '/teachers?grade=9&topic=2&level=a'];
const dependencies = { catalog, guide, teacherIndex };

function payload(count: number, path: string) {
  return {
    message: pickerMessage(count),
    page: { kind: 'teachers', path, title: 'בוחרים מה לתרגל | מרחב למורה' },
    teacher: {
      grade: '9', gradeLabel: 'כיתה ט׳', topic: '2', topicLabel: 'פירוק לגורמים', level: 'a',
      goal: 'first', goalLabel: 'מפגש ראשון', style: 'scaffold', styleLabel: 'מדורגת', note: '', count, candidates,
    },
    botVerification: { provider: 'recaptcha-v3', token: `synthetic-picker-token-${count}` },
  };
}

async function request(count: number, path: string, captchaValid: boolean) {
  const calls: { kind: string; body: string }[] = [];
  const modelLabels = candidates.slice(-count).map((candidate) => candidate.id);
  const result = await handleNoamSiteCompanion(
    { method: 'POST', url: 'https://www.noamdoronmath.co.il/api/noamSiteCompanion' },
    {
      ...dependencies,
      origin: 'https://www.noamdoronmath.co.il',
      clientIp: '203.0.113.56',
      qwenKey: 'synthetic-qwen-test-key',
      recaptchaSecret: 'synthetic-recaptcha-test-secret',
      store: new Map(),
      now: 5_000,
      payload: payload(count, path),
      fetch: async (url: string, init?: { body?: string }) => {
        if (String(url).includes('siteverify')) {
          calls.push({ kind: 'captcha', body: String(init?.body || '') });
          return { ok: true, json: async () => ({ success: captchaValid, score: captchaValid ? 0.9 : 0.1, action: 'noam_site_companion', hostname: 'www.noamdoronmath.co.il' }) };
        }
        assert.match(String(url), /\/chat\/completions$/);
        calls.push({ kind: 'qwen', body: String(init?.body || '') });
        return {
          ok: true,
          json: async () => ({ choices: [{ message: { content: JSON.stringify({ grade: 9, topicQuery: 'פירוק לגורמים', level: 'a', exerciseLabels: modelLabels, wantsSheet: false }) } }] }),
        };
      },
    }
  );
  return { result, calls, modelLabels };
}

for (const path of paths) {
  for (const count of [5, 10, 15]) {
    test(`the real ${count}-question picker request reaches Qwen once after CAPTCHA on ${path}`, async () => {
      const input = payload(count, path);
      assert.match(input.message, /חזרה באמצע/);
      assert.equal(resolveDeterministicTurn(input, dependencies), null, 'The structured selection must not become a topic-order answer');

      const { result, calls, modelLabels } = await request(count, path, true);
      assert.equal(result.status, 200);
      assert.deepEqual(calls.map((call) => call.kind), ['captcha', 'qwen'], 'Verify the bot check before exactly one model call');
      const body = result.body as { source: string; model: string; exerciseIds: string[] };
      assert.equal(body.source, 'classifier');
      assert.equal(body.model, 'qwen3.8-flash');
      assert.deepEqual(body.exerciseIds, modelLabels.map((label) => `ex:${sheet.pdfId}:${label.slice(2)}`));
      assert.equal(body.exerciseIds.length, count);
      const sent = JSON.parse(calls[1].body);
      assert.equal(sent.model, 'qwen3.8-flash');
      assert.match(sent.messages[1].content, new RegExp(`כמות מבוקשת לבחירה: ${count}`));
    });
  }

  test(`an invalid CAPTCHA still blocks the structured picker before Qwen on ${path}`, async () => {
    const { result, calls } = await request(10, path, false);
    assert.equal(result.status, 403);
    assert.deepEqual(calls.map((call) => call.kind), ['captcha']);
    const body = result.body as { code: string; exerciseIds: string[] };
    assert.equal(body.code, 'BOT_VERIFICATION_FAILED');
    assert.deepEqual(body.exerciseIds, []);
  });
}

test('ordinary topic-order navigation and teacher-page explanations remain deterministic without selection candidates', () => {
  const input = payload(5, paths[1]);
  input.teacher.candidates = [];
  const navigation = resolveDeterministicTurn({ ...input, message: 'חזרה בכיתה ט׳' }, dependencies);
  assert.equal(navigation.source, 'topic-order');
  assert.equal(navigation.model, null);
  assert.match(navigation.answer, /חזרה/);
  const explanation = resolveDeterministicTurn({ ...input, message: 'מה יש בעמוד המורים?' }, dependencies);
  assert.equal(explanation.source, 'site-guide');
  assert.equal(explanation.answer, TEACHERS_TEXT);
  assert.equal(explanation.primary.href, '/teachers');
});
