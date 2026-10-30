import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import vm from 'node:vm';
import { test } from 'node:test';

const root = join(import.meta.dirname, '..');
const html = readFileSync(join(root, 'public/worksheet-viewer-noam.html'), 'utf8');
const manifest = JSON.parse(readFileSync(join(root, 'public/noam-ai/manifests/9448157f4ecb463489417696230f0e57.json'), 'utf8'));
const partC = manifest.exercises.find((e: any) => e.id === 'G8-T39-A-Q01ג');
const ctx = vm.createContext({
  window: {},
  noamRecentThreadText: () => '',
  noamGeometryContext: () => true,
  noamSignedNumberContext: () => false,
  noamMixedSignAddExpression: () => false,
});
vm.runInContext(
  html.slice(html.indexOf('var SOLVER_MESSAGE_MAX ='), html.indexOf('var GRADE_NAME =')) +
  html.slice(html.indexOf('function noamManifestOcrUnreliable('), html.indexOf('function noamScopedExerciseSemantic(')) +
  html.slice(html.indexOf('function noamSelectedPartDirective('), html.indexOf('function noamResponseVisual(')), ctx);

const broadAnalysis = {
  readable: true,
  transcription: 'א. מצאו צלע משותפת. ב. הוכיחו חפיפה. ג. ציינו את שוויונות הזוויות.',
  problem_statement: 'הוכיחו שהמשולשים חופפים באמצעות הצלע המשותפת.',
};

test('G8-T39 part ג keeps its angle task ahead of generic proof guidance despite a shared-crop transcript', () => {
  const analysisBefore = JSON.stringify(broadAnalysis);
  const message = ctx.noamSolverMessage('', { history: [] }, 'חפיפת משולשים', '', broadAnalysis, partC);
  assert.match(message, /^המטרה כעת — שאלה 1 סעיף ג:/);
  assert.ok(message.includes(partC.text));
  assert.match(message, /אל תחזור להוכחה שהסעיף מניח שכבר הושלמה/);
  assert.equal(JSON.stringify(broadAnalysis), analysisBefore, 'source/vision data is not rewritten');
});

test('each sibling uses its own task, without a hardcoded package override', () => {
  for (const exercise of manifest.exercises.filter((e: any) => e.q === 1)) {
    const message = ctx.noamSolverMessage('', { history: [] }, 'חפיפה', '', broadAnalysis, exercise);
    assert.ok(message.startsWith(`המטרה כעת — שאלה 1 סעיף ${exercise.part}:`));
    assert.ok(message.includes(exercise.text));
  }
});

test('long free questions retain selected scope, student text and the complete math instruction within 700 chars', () => {
  const user = 'אני לא מבין את התאמת הקודקודים. '.repeat(30);
  const message = ctx.noamSolverMessage(user, { history: [] }, 'חפיפה', '', broadAnalysis, partC);
  assert.ok(message.length <= 700);
  assert.ok(message.includes(partC.text));
  assert.ok(message.includes('הודעת התלמיד עכשיו: אני לא מבין'));
  assert.ok(message.endsWith(ctx.MATH_OUTPUT_INSTRUCTION));
});

test('unreliable OCR and rebuilt signed expressions keep the established expression-specific path', () => {
  assert.equal(ctx.noamSelectedPartDirective(partC, { selected_part_expression: '-3+7' }), '');
  assert.equal(ctx.noamSelectedPartDirective({ part: 'א', text: 'ב . תרגיל ג .' }, {}), '');
  assert.equal(ctx.noamSelectedPartDirective({ text: 'single question' }, {}), '');
});

test('long task text and a verified guide remain bounded without deleting the student message', () => {
  const long = { ...partC, text: partC.text.repeat(20) };
  const message = ctx.noamSolverMessage('מה השלב הבא?', { history: [] }, 'חפיפה', 'הדרכה מאומתת '.repeat(90), broadAnalysis, long);
  assert.ok(message.length <= 700);
  assert.match(message, /^המטרה כעת — שאלה 1 סעיף ג:/);
  assert.ok(message.includes('הודעת התלמיד עכשיו: מה השלב הבא?'));
  assert.ok(message.endsWith(ctx.MATH_OUTPUT_INSTRUCTION));
});

test('unscoped legacy callers retain their previous guard and rendering contract', () => {
  const message = ctx.noamSolverMessage('רמז', { history: [] }, 'חפיפה', '', broadAnalysis);
  assert.match(message, /^בדיקת דיוק בגאומטריה/);
  assert.ok(message.length <= 700);
  assert.ok(message.endsWith(ctx.MATH_OUTPUT_INSTRUCTION));
});

test('the actual ask path binds scope to the requested part even if selection changes during analysis', async () => {
  let finishAnalysis: (value: any) => void = () => {};
  let sent: any;
  Object.assign(ctx, {
    selectedExercise: partC, busy: false, setTimeout: () => 0, clearTimeout() {},
    document: { activeElement: null }, panelBody: { contains: () => false },
    exerciseThread: () => ({ hintIndex: 0, messages: [], history: [] }),
    saveNoamState() {}, setNoamBusy() {}, renderNoamChat() {}, restoreNoamChatFocus() {}, announceNoam() {},
    exerciseLabel: () => 'שאלה 1 סעיף ג',
    noamDidacticGuide: () => null, noamDidacticPrompt: () => '', noamDidacticResponse: () => null,
    getExerciseAnalysis: () => new Promise(resolve => { finishAnalysis = resolve; }),
    noamEnrichSourceAnalysis: async (exercise: any, analysis: any) => {
      assert.equal(exercise.id, partC.id, 'source enrichment remains bound to the requested part');
      return analysis;
    },
    postJson: (_url: string, payload: any) => { sent = payload; return new Promise(() => {}); },
    ttl: 'חפיפת משולשים', g: 8, lv: 'a', LEVEL: { a: 'רמה א׳' }, API: '/test',
  });
  vm.runInContext(html.slice(html.indexOf('function askNoam('), html.indexOf('function noamRetryActionLabel(')), ctx);
  ctx.askNoam('hint', '');
  ctx.selectedExercise = manifest.exercises[0];
  await Promise.resolve(); // The source-only probe gate precedes the ordinary reader.
  finishAnalysis(broadAnalysis);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(sent.exerciseId, partC.id);
  assert.ok(sent.studentMessage.includes(partC.text));
  assert.strictEqual(sent.imageAnalysis, broadAnalysis);
});
