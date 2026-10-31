import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as endpoint from '../../../noam-ai/site-companion/endpoint.js';
import * as guard from '../../../noam-ai/site-companion/bot-guard.js';
import { logTeacherSelection } from '../../../noam-ai/site-companion/teacher-pick.js';

const source = readFileSync(new URL('../src/pages/api/noamSiteCompanion.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const copy = (value: unknown) => JSON.parse(JSON.stringify(value));

function route(options: { realEndpoint?: boolean; monitoringFailure?: 'lookup' | 'capture' } = {}) {
  const captures: any[] = [], consoleEntries: any[] = [], calls: string[] = [];
  let callback: (entry: unknown) => void;
  const keys = {
    QWEN_API_KEY: 'PRIVATE_SYNTHETIC_MODEL_KEY',
    QWEN_MODEL: 'qwen3.8-flash',
    QWEN_BASE_URL: 'https://token-plan.maas.qwencloudapi.com/compatible-mode/v1',
    NOAM_RECAPTCHA_SECRET_KEY: 'PRIVATE_SYNTHETIC_CAPTCHA_KEY',
  };
  const result = { status: 200, headers: { 'Content-Type': 'application/json' }, body: { ok: false, code: 'SENTINEL' } };
  const imports: Record<string, unknown> = {
    '@wix/essentials': { monitoring: { getMonitoringClient() {
      if (options.monitoringFailure === 'lookup') throw new Error('PRIVATE_MONITOR_LOOKUP');
      return { captureMessage(message: string, context: unknown) {
        if (options.monitoringFailure === 'capture') throw new Error('PRIVATE_MONITOR_CAPTURE');
        captures.push(copy({ message, context }));
      } };
    } } },
    'astro:env/server': keys,
    '../../data/catalog.v1.json': { grades: [] },
    '../../data/site-guide.v1.json': {},
    '../../data/teacher-pick-index.json': [],
    '../../../../../noam-ai/site-companion/endpoint.js': {
      ...endpoint,
      handleNoamSiteCompanion: async (request: Request, settings: any) => {
        callback = settings.log;
        return options.realEndpoint ? endpoint.handleNoamSiteCompanion(request, settings) : result;
      },
    },
    '../../../../../noam-ai/site-companion/bot-guard.js': guard,
    '../../../../../noam-ai/site-companion/teacher-pick.js': { logTeacherSelection },
    '../../lib/noamSecrets': { secretFromEnv: (_name: string, value: unknown) => value || '' },
    '../../lib/runtimeEnv': { runtimeProcessEnv: () => ({}) },
    '../../lib/noamRateStore': { createWixRateBackend: () => ({ async take() { calls.push('rate'); return true; } }) },
    '../../lib/noamCaptchaUses': { createWixCaptchaUseStore: () => ({ async consume() { return true; } }) },
  };
  const exported: any = {};
  runInNewContext(compiled, {
    exports: exported,
    require(name: string) { assert.ok(Object.hasOwn(imports, name), `Unexpected import: ${name}`); return imports[name]; },
    Request, Response, Headers, URL,
    console: { error: (entry: unknown) => consoleEntries.push(copy(entry)) },
    fetch: async (url: string) => {
      if (url === 'https://www.google.com/recaptcha/api/siteverify') {
        calls.push('verify');
        return { ok: true, json: async () => ({ success: true, score: 0.9, hostname: 'www.noamdoronmath.co.il', action: 'noam_site_companion' }) };
      }
      assert.match(url, /\/chat\/completions$/); calls.push('model');
      return { ok: true, status: 200, json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"PRIVATE_MODEL_OUTPUT"' } }], usage: { completion_tokens: 1200 } }) };
    },
  });
  async function post() {
    const request = new Request('https://www.noamdoronmath.co.il/api/noamSiteCompanion', {
      method: 'POST',
      headers: { Origin: 'https://www.noamdoronmath.co.il', 'Content-Type': 'application/json', 'true-client-ip': '203.0.113.49' },
      body: JSON.stringify({ message: 'בחר 5 שאלות', page: { kind: 'teachers', path: '/teachers' },
        teacher: { grade: '1', topic: '21', level: 'all', count: 5, planCounts: [5, 10, 15], note: 'PRIVATE_TEACHER_NOTE' },
        botVerification: { provider: 'recaptcha-v3', token: 'PRIVATE_SYNTHETIC_TOKEN' } }),
    });
    return exported.POST({ request });
  }
  return { post, captures, consoleEntries, calls, log: (entry: unknown) => callback(entry) };
}

test('the real route forwards only sanitized teacher enums and bounded counts to Wix monitoring', async () => {
  const run = route(); await run.post();
  run.log({ event: 'noam-teacher-selection', code: 'MODEL_SELECTION_REJECTED', reason: 'level-coverage',
    requestedCount: 500, primaryCount: 5, planCount: 999, completionTokens: 900000, finishReason: 'length',
    token: 'PRIVATE_TOKEN', note: 'PRIVATE_NOTE', rawOutput: 'PRIVATE_OUTPUT', apiKey: 'PRIVATE_KEY' });
  assert.deepEqual(run.captures, [{ message: 'noam-teacher-selection', context: {
    level: 'warning', tags: { event: 'noam-teacher-selection', code: 'MODEL_SELECTION_REJECTED', reason: 'level-coverage' },
    contexts: { selection: { event: 'noam-teacher-selection', code: 'MODEL_SELECTION_REJECTED', reason: 'level-coverage',
      requestedCount: 60, primaryCount: 5, planCount: 3, completionTokens: 100000, finishReason: 'length' } },
  } }]);
  assert.doesNotMatch(JSON.stringify([...run.captures, ...run.consoleEntries]), /PRIVATE_/);
  assert.deepEqual(run.calls, []);
});

test('unknown events, invalid enums, invalid counts and arbitrary finish reasons cannot enter Wix Logs', async () => {
  const run = route(); await run.post();
  for (const entry of [null, [], 'PRIVATE_RAW', { event: 'PRIVATE_EVENT' },
    { event: 'noam-teacher-selection', code: 'PRIVATE_CODE', reason: 'invalid-json' },
    { event: 'noam-teacher-selection', code: 'MODEL_RESPONSE_INVALID', reason: 'PRIVATE_REASON' }]) run.log(entry);
  assert.equal(run.captures.length, 0);
  run.log({ event: 'noam-teacher-selection', code: 'MODEL_RESPONSE_INVALID', reason: 'invalid-json',
    requestedCount: -1, primaryCount: 1.5, planCount: '3', completionTokens: Infinity, finishReason: 'PRIVATE_FINISH' });
  assert.deepEqual(run.captures[0].context.contexts.selection,
    { event: 'noam-teacher-selection', code: 'MODEL_RESPONSE_INVALID', reason: 'invalid-json' });
  assert.doesNotMatch(JSON.stringify([...run.captures, ...run.consoleEntries]), /PRIVATE_/);
});

test('a recovered selection is informational, while provider diagnostics retain their existing console destination', async () => {
  const run = route(); await run.post();
  run.log({ event: 'noam-teacher-selection', code: 'MODEL_SELECTION_RECOVERED', reason: 'requested-plan', requestedCount: 10 });
  assert.equal(run.captures[0].context.level, 'info');
  const provider = { event: 'noam-ai-model', code: 'MODEL_HTTP', status: 503, reason: 'provider-error', model: 'synthetic-model' };
  run.log(provider);
  assert.equal(run.captures.length, 1);
  assert.deepEqual(run.consoleEntries.at(-1), provider);
});

test('a real guarded endpoint parser failure reaches monitoring without exposing request or model content', async () => {
  const run = route({ realEndpoint: true }); const response = await run.post();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.code, 'MODEL_RESPONSE_FAILED');
  assert.equal(body.selectionError, undefined);
  assert.equal(body.model, null);
  assert.deepEqual(run.calls, ['rate', 'verify', 'model']);
  assert.equal(run.captures.length, 1);
  assert.deepEqual(run.captures[0].context.contexts.selection, { event: 'noam-teacher-selection',
    code: 'MODEL_RESPONSE_TRUNCATED', reason: 'length-limit', requestedCount: 5, completionTokens: 1200, finishReason: 'length' });
  assert.doesNotMatch(JSON.stringify([...run.captures, ...run.consoleEntries]), /PRIVATE_/);
});

for (const monitoringFailure of ['lookup', 'capture'] as const) {
  test(`monitoring ${monitoringFailure} failure does not change the endpoint response or retry any external operation`, async () => {
    const baseline = route({ realEndpoint: true }); const expected = await (await baseline.post()).json();
    const run = route({ realEndpoint: true, monitoringFailure }); const response = await run.post();
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), expected);
    assert.deepEqual(run.calls, ['rate', 'verify', 'model']);
    assert.equal(run.captures.length, 0);
    assert.doesNotMatch(JSON.stringify(run.consoleEntries), /PRIVATE_/);
  });
}
