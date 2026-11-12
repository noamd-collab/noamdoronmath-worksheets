import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { expandToWholeQuestionKeys } from '../public/teachers/teacher-question-pick.js';
import { replaceWizardScopeUrl, wizardPrefillFromSearch } from '../public/teachers/wizard-prefill.js';

const moduleUrl = new URL('../public/teachers/teacher-factoring-print.js', import.meta.url);
const printer = readFileSync(moduleUrl, 'utf8');
const page = readFileSync(new URL('../src/teacher-pages/wizard.html', import.meta.url), 'utf8');
const pdfs = { first: 'a'.repeat(32), second: 'b'.repeat(32), otherGrade: 'c'.repeat(32) };
const meta = (pdfId: string) => ({ pdfId, level: 'a', levelLabel: 'רמה א׳', title: 'מקור בדיקה' });
const catalog = { grades: [
  { grade: 9, label: 'כיתה ט׳', band: 'middle', topics: [
    { id: 2, title: 'נושא ראשון', sheets: [meta(pdfs.first)] },
    { id: 3, title: 'נושא שני', sheets: [meta(pdfs.second)] },
  ] },
  { grade: 8, label: 'כיתה ח׳', band: 'middle', topics: [
    { id: 43, title: 'נושא בכיתה ח׳', sheets: [meta(pdfs.otherGrade)] },
  ] },
] };
const source = (pdfId: string) => ({ pdfId, level: 'a', questions: [
  { id: '1א', q: 1, part: 'א', page: 1 },
  { id: '1ב', q: 1, part: 'ב', page: 1 },
  { id: '2', q: 2, part: '', page: 1 },
] });
const key = (pdfId: string, id = '2') => `ex:${pdfId}:${id}`;

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing shipped function ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  // Only module syntax is substituted. Catalog/sheet loading uses the actual
  // shipped functions, while all I/O is intercepted by the local fixtures.
  return (end < 0 ? tail : tail.slice(0, end)).split('\nstart().catch')[0]
    .replaceAll('import.meta.url', 'moduleUrl');
}

type Options = { href?: string; catalogFailures?: number; sheetFailures?: Record<string, number>; confirm?: boolean };

function harness(options: Options = {}) {
  const { document } = parseHTML(page);
  let focused: unknown = null;
  for (const element of document.querySelectorAll<HTMLElement>('[id]')) {
    element.focus = () => { focused = element; };
  }
  // Linkedom does not implement writable select.value or browser focus.
  for (const id of ['grade', 'topic']) {
    Object.defineProperty(document.getElementById(id), 'value', { value: '', writable: true });
  }
  const retryHandlers: (() => Promise<void>)[] = [];
  const retry = document.getElementById('teacher-load-retry')!;
  retry.addEventListener = ((_type: string, handler: () => Promise<void>) => {
    retryHandlers.push(handler);
  }) as typeof retry.addEventListener;
  const calls = { catalog: 0, sheets: [] as string[], bind: 0, install: 0, render: 0,
    invalidations: 0, confirmations: [] as string[], urls: [] as string[], announcements: [] as string[] };
  const decisions = { accept: options.confirm ?? true };
  const browser = {
    location: { href: options.href || 'https://fixture.invalid/teachers?keep=yes#questions' },
    history: { state: { retained: true }, replaceState(_state: unknown, _title: string, href: string) {
      calls.urls.push(href); browser.location.href = href;
    } },
    confirm(message: string) { calls.confirmations.push(message); return decisions.accept; },
  };
  let catalogFailures = options.catalogFailures || 0;
  const failures = { ...options.sheetFailures };
  const fetchLocal = async (url: string | URL) => {
    if (String(url) === 'fixture:catalog') {
      calls.catalog += 1;
      if (catalogFailures-- > 0) return { ok: false, json: async () => null };
      return { ok: true, json: async () => structuredClone(catalog) };
    }
    const pdfId = new URL(String(url)).pathname.match(/\/sheets\/([a-f0-9]{32})\.json$/)?.[1];
    assert.ok(pdfId, `Unexpected resource: ${url}`);
    calls.sheets.push(pdfId);
    if ((failures[pdfId] || 0) > 0) {
      failures[pdfId] -= 1;
      return { ok: false, json: async () => null };
    }
    return { ok: true, json: async () => source(pdfId) };
  };
  const initial = printer.match(/let state = (\{[\s\S]*?\n\});/);
  assert.ok(initial);
  const functions = ['setTeacherAppState', 'reloadTeacherTopic', 'confirmTeacherReplacement', 'changeTeacherScope',
    'exKey', 'gradeRecord', 'currentTopic', 'topicLevelChoices', 'resolveTopicLevel', 'topicSheets',
    'syncLevels', 'syncWizardUrl', 'visibleSelectionKeys', 'currentExercises', 'carriedKeys',
    'fillGrades', 'fillTopics', 'loadExerciseSheet', 'indexCatalog', 'loadCurrentTopic', 'applyWizardPrefill', 'start'];
  const app = new Function('document', 'window', 'fetch', 'moduleUrl', 'calls',
    'expandToWholeQuestionKeys', 'replaceWizardScopeUrl', 'wizardPrefillFromSearch', `
    let state = ${initial[1]}, history = [], CATALOG = null, SOURCE = null;
    let appState = 'loading', appBound = false, startupComplete = false, retryTeacherLoad = null, appLoadId = 0;
    let loadToken = 0, topicLoadPromise = null;
    const byPdf = new Map(), sheets = new Map(), library = new Map();
    const topicSearch = null;
    const $ = id => document.getElementById(id), CATALOG_URL = 'fixture:catalog', FACTORING_PDF = 'unused';
    const location = { get search(){ return new URL(window.location.href).search; } };
    const SCENARIOS = {}, escapeHTML = value => String(value);
    const loadQuestionPreviewManifest = async () => null;
    const bind = () => { calls.bind += 1; };
    const installSuggest = () => { calls.install += 1; };
    const ensureTeacherBotClient = async () => ({ prepare: async () => {} });
    const clearPreparedPrint = () => { calls.invalidations += 1; };
    const render = () => { calls.render += 1; syncLevels(); syncWizardUrl(); };
    const applyScenario = () => render(), applyWizard = () => {};
    const announce = message => calls.announcements.push(message);
    ${functions.map(definition).join('\n')}
    return { state, start, reloadTeacherTopic, changeTeacherScope, confirmTeacherReplacement, setTeacherAppState, applyWizardPrefill,
      status: () => appState, started: () => startupComplete };
  `)(document, browser, fetchLocal, moduleUrl.href, calls,
    expandToWholeQuestionKeys, replaceWizardScopeUrl, wizardPrefillFromSearch);
  return { ...app, document, calls, browser, decisions, focused: () => focused,
    retryBindings: () => retryHandlers.length,
    async retry() { assert.equal(retryHandlers.length, 1); await retryHandlers[0](); },
    element(id: string) { return document.getElementById(id)! as HTMLElement & { inert: boolean; disabled: boolean; value: string }; },
  };
}

test('catalog failure exposes an actionable error; retry activates the wizard without duplicate binding', async () => {
  const app = harness({ catalogFailures: 1 });
  await app.start();
  assert.equal(app.status(), 'error');
  assert.equal(app.started(), false);
  for (const id of ['teacher-workspace', 'wizard-bar', 'wizard-actions']) {
    assert.equal(app.element(id).inert, true, `${id} is inactive while startup has failed`);
    assert.equal(app.element(id).hidden, true, `${id} stays hidden until the catalog is ready`);
  }
  assert.equal(app.element('teacher-load-error').getAttribute('role'), 'alert');
  assert.match(app.element('teacher-load-error').textContent!, /ניסיון נוסף/);
  assert.equal(app.element('teacher-load-retry').disabled, false);
  assert.equal(app.focused(), app.element('teacher-load-retry'));
  await app.retry();
  assert.equal(app.status(), 'ready');
  assert.equal(app.started(), true);
  for (const id of ['teacher-workspace', 'wizard-bar', 'wizard-actions']) {
    assert.equal(app.element(id).inert, false, `${id} becomes interactive after retry`);
    assert.equal(app.element(id).hidden, false);
    assert.equal(app.element(id).getAttribute('aria-busy'), 'false');
  }
  assert.equal(app.element('teacher-load-state').hidden, true);
  assert.equal(app.element('teacher-load-error').textContent, '');
  assert.equal(app.focused(), app.element('wizard-label'));
  assert.equal(app.calls.catalog, 2);
  assert.equal(app.calls.bind, 1);
  assert.equal(app.calls.install, 1);
  assert.equal(app.retryBindings(), 1);
});

test('a URL handoff survives failed catalog startup and restores the complete selected question on retry', async () => {
  const url = new URL('https://fixture.invalid/teachers?grade=8&topic=43&level=all&minutes=15&keep=yes#questions');
  url.searchParams.set('pick', key(pdfs.otherGrade, '1א'));
  const app = harness({ href: url.href, catalogFailures: 1 });
  await app.start();
  assert.equal(app.browser.location.href, url.href);
  assert.deepEqual(app.state.selected, []);
  await app.retry();
  assert.equal(app.status(), 'ready');
  assert.equal(app.state.grade, '8');
  assert.equal(app.state.topic, '43');
  assert.equal(app.state.level, 'all');
  assert.equal(app.state.wizard, 'pick');
  assert.deepEqual(app.state.selected, [key(pdfs.otherGrade, '1א'), key(pdfs.otherGrade, '1ב')]);
  assert.equal(app.element('teacher-ai-note').value, 'אורך שיעור: 15 דקות');
  assert.equal(app.element('teacher-note').value, '', 'A lesson-length handoff must not become printed student instructions');
  assert.equal(app.browser.location.href, url.href);
  assert.equal(app.calls.bind, 1);
});

test('lesson-length handoffs fill only empty AI guidance and preserve existing instructions in both fields', async () => {
  for (const existingGuidance of ['', 'AI_ONLY_EXISTING_GUIDANCE']) {
    const app = harness();
    await app.start();
    const instructions = 'STUDENT_ONLY_EXISTING_INSTRUCTIONS';
    app.element('teacher-ai-note').value = existingGuidance;
    app.element('teacher-note').value = instructions;
    await app.applyWizardPrefill({ grade: '8', topic: '43', level: 'a', minutes: 20, exerciseIds: [] });
    assert.equal(app.element('teacher-ai-note').value, existingGuidance || 'אורך שיעור: 20 דקות');
    assert.equal(app.element('teacher-note').value, instructions);
    await app.applyWizardPrefill({ grade: '9', topic: '2', level: 'a', minutes: 45, exerciseIds: [] });
    assert.equal(app.element('teacher-ai-note').value, existingGuidance || 'אורך שיעור: 20 דקות', 'A later handoff does not overwrite an existing guidance value');
    assert.equal(app.element('teacher-note').value, instructions);
  }
});

test('failed topic-sheet load retries only that topic and retains the confirmed scope and saved sections', async () => {
  const app = harness({ sheetFailures: { [pdfs.second]: 1 } });
  await app.start();
  const saved = [{ grade: '9', topic: '2', kind: 'review', title: 'נושא שמור', keys: [key(pdfs.first)] }];
  app.state.blocks = structuredClone(saved);
  app.state.selected = [key(pdfs.first, '1א'), key(pdfs.first, '1ב')];
  await app.changeTeacherScope('9', '3');
  assert.equal(app.status(), 'error');
  assert.equal(app.state.topic, '3');
  assert.deepEqual(app.state.blocks, saved);
  assert.deepEqual(app.state.selected, []);
  for (const id of ['teacher-workspace', 'wizard-bar', 'wizard-actions']) {
    assert.equal(app.element(id).hidden, false, `${id} retains the visible context after a topic error`);
    assert.equal(app.element(id).inert, true, `${id} cannot advance while source loading has failed`);
  }
  const urlAtFailure = app.browser.location.href;
  await app.retry();
  assert.equal(app.status(), 'ready');
  assert.equal(app.element('wizard-actions').inert, false);
  assert.equal(app.element('wizard-actions').hidden, false);
  assert.equal(app.browser.location.href, urlAtFailure);
  assert.deepEqual(app.state.blocks, saved);
  assert.equal(app.calls.catalog, 1, 'Topic retry must not replay URL prefill');
  assert.equal(app.calls.sheets.filter((id: string) => id === pdfs.second).length, 2);
  assert.equal(app.calls.bind, 1);
});

test('a topic reload keeps the bottom navigation visible but inactive until the source is ready', async () => {
  const app = harness();
  await app.start();
  app.setTeacherAppState('loading', 'טוענים את שאלות הנושא…');
  for (const id of ['teacher-workspace', 'wizard-bar', 'wizard-actions']) {
    assert.equal(app.element(id).hidden, false);
    assert.equal(app.element(id).inert, true);
    assert.equal(app.element(id).getAttribute('aria-busy'), 'true');
  }
  app.setTeacherAppState('ready');
  assert.equal(app.element('wizard-actions').inert, false);
  assert.equal(app.element('wizard-actions').getAttribute('aria-busy'), 'false');
});

for (const [label, grade, topic] of [['grade', '8', ''], ['topic', '9', '3']]) {
  test(`cancelling a ${label} change retains selection, saved sections, URL and original controls`, async () => {
    const app = harness({ confirm: false });
    await app.start();
    app.state.selected = [key(pdfs.first)];
    app.state.blocks = [{ grade: '9', topic: '2', kind: 'review', keys: [key(pdfs.first, '1א')] }];
    const before = JSON.stringify(app.state), beforeUrl = app.browser.location.href;
    const beforeRequests = app.calls.sheets.length, beforeInvalidations = app.calls.invalidations;
    app.element(label === 'grade' ? 'grade' : 'topic').value = label === 'grade' ? grade : topic;
    await app.changeTeacherScope(grade, topic);
    assert.equal(JSON.stringify(app.state), before);
    assert.equal(app.browser.location.href, beforeUrl);
    assert.equal(app.element('grade').value, '9');
    assert.equal(app.element('topic').value, '2');
    assert.equal(app.calls.sheets.length, beforeRequests);
    assert.equal(app.calls.invalidations, beforeInvalidations);
    assert.equal(app.calls.confirmations.length, 1);
  });
}

test('grade change confirms when only saved blocks exist, and explicit acceptance clears them', async () => {
  const app = harness({ confirm: false });
  await app.start();
  app.state.blocks = [{ grade: '9', topic: '2', kind: 'review', keys: [key(pdfs.first)] }];
  await app.changeTeacherScope('8', '');
  assert.equal(app.state.grade, '9');
  assert.equal(app.state.blocks.length, 1);
  app.decisions.accept = true;
  await app.changeTeacherScope('8', '');
  assert.equal(app.state.grade, '8');
  assert.equal(app.state.topic, '43');
  assert.deepEqual(app.state.blocks, []);
  assert.deepEqual(app.state.selected, []);
  assert.equal(app.status(), 'ready');
  assert.equal(app.calls.confirmations.length, 2);
  assert.equal(new URL(app.browser.location.href).searchParams.get('grade'), '8');
});

test('topic changes with only saved sections preserve them without a discard prompt', async () => {
  const app = harness({ confirm: false });
  await app.start();
  const saved = [{ grade: '9', topic: '2', kind: 'test', keys: [key(pdfs.first)] }];
  app.state.blocks = structuredClone(saved);
  await app.changeTeacherScope('9', '3');
  assert.equal(app.state.topic, '3');
  assert.deepEqual(app.state.blocks, saved);
  assert.equal(app.calls.confirmations.length, 0);
  assert.equal(app.status(), 'ready');
});

test('replacement guard prompts only for state that the operation would discard', () => {
  const app = harness({ confirm: false });
  assert.equal(app.confirmTeacherReplacement('replace'), true);
  app.state.blocks = [{ keys: [key(pdfs.first)] }];
  assert.equal(app.confirmTeacherReplacement('current topic only'), true);
  assert.equal(app.confirmTeacherReplacement('entire page', true), false);
  app.state.selected = [key(pdfs.second)];
  assert.equal(app.confirmTeacherReplacement('current topic'), false);
  assert.deepEqual(app.calls.confirmations, ['entire page', 'current topic']);
});
