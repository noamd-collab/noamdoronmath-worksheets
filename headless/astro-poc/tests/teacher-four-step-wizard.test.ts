import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../public/teachers/index.html', import.meta.url), 'utf8');

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing shipped function ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

function navigation() {
  const { document } = parseHTML(html);
  const initial = printer.match(/let state = (\{[\s\S]*?\n\});/);
  const order = printer.match(/const WIZARD_ORDER = (\[[^;]+\]);/);
  assert.ok(initial);
  assert.ok(order);
  const events = new Map<string, () => Promise<void>>();
  for (const id of ['wizard-next', 'wizard-back']) {
    const element = document.getElementById(id)!;
    element.addEventListener = ((_event: string, handler: () => Promise<void>) => {
      events.set(id, handler);
    }) as typeof element.addEventListener;
  }
  const focused: string[] = [];
  document.getElementById('wizard-label')!.focus = () => { focused.push('wizard-label'); };
  // Startup/loading is covered separately. Exercise the actual HTML and
  // shipped step/navigation handlers in their interactive ready state.
  for (const id of ['teacher-workspace', 'wizard-bar']) document.getElementById(id)!.hidden = false;
  const app = new Function('document', `
    let state = ${initial[1]};
    const WIZARD_ORDER = ${order[1]};
    const topicSearch = null;
    const $ = id => document.getElementById(id);
    const topicLoadPromise = null;
    let resultPreparations = 0;
    const showWizardResult = async () => { resultPreparations += 1; };
    const render = () => applyWizard();
    const applyScenario = () => render();
    ${definition('applyWizard')}
    ${definition('bind')}
    bind();
    return { state, apply: applyWizard, order: WIZARD_ORDER, resultPreparations: () => resultPreparations };
  `)(document);
  return { ...app, document, focused, async next() { await events.get('wizard-next')!(); },
    async back() { await events.get('wizard-back')!(); } };
}

test('four grouped steps navigate forward and back without losing questions, sections or field values', async () => {
  const app = navigation();
  assert.deepEqual(app.order, ['setup', 'purpose', 'pick', 'result']);
  assert.equal(app.state.wizard, 'setup');
  app.state.selected = ['ex:current:2א', 'ex:current:2ב'];
  app.state.blocks = [{ grade: '9', topic: '2', kind: 'review', keys: ['ex:saved:1'] }];
  app.state.scenario = 'practice';
  app.state.style = 'blended';
  const selection = JSON.stringify({ selected: app.state.selected, blocks: app.state.blocks });
  const document = app.document;
  const byId = (id: string) => document.getElementById(id)!;
  const levelControl = byId('teacher-level-choice');
  const levelInputs = [...levelControl.querySelectorAll('input[name=level]')];
  const levelB = levelInputs.find(input => input.getAttribute('value') === 'b')! as HTMLInputElement;
  levelB.checked = true;
  (byId('teacher-note') as HTMLTextAreaElement).value = 'הוראות קיימות שנשמרות';

  const visible = (selector: string) => {
    const node = document.querySelector(selector);
    assert.ok(node, `Missing ${selector}`);
    return node.closest('.wiz-off') === null;
  };
  const verify = (step: string, index: number, title: string) => {
    assert.equal(app.state.wizard, step);
    assert.equal(document.body.dataset.wizard, step);
    assert.equal(byId('wizard-label').textContent, title);
    assert.equal(byId('wizard-progress').textContent, `שלב ${index} מתוך 4`);
    assert.equal(byId('wizard-label').tagName, 'H2');
    assert.equal(byId('wizard-label').getAttribute('aria-describedby'), 'wizard-progress');
    assert.ok(byId('wizard-label').closest('[aria-current="step"]'));
    assert.equal(byId('wizard-back').hidden, index === 1);
    assert.equal(byId('wizard-next').hidden, index === 4);
    for (const selector of ['#grade', '#topic']) assert.equal(visible(selector), step === 'setup', selector);
    for (const selector of ['[name=scenario]', '[name=style]', '#teacher-note']) assert.equal(visible(selector), step === 'purpose', selector);
    assert.equal(visible('#questions'), step === 'pick');
    assert.equal(visible('#wizard-result'), step === 'result');
    assert.equal(visible('#teacher-level-choice'), step === 'setup' || step === 'pick');
    assert.equal(document.querySelectorAll('#teacher-level-choice').length, 1);
    assert.equal(byId('teacher-level-choice'), levelControl);
    assert.equal(levelB.checked, true);
    assert.equal((byId('teacher-note') as HTMLTextAreaElement).value, 'הוראות קיימות שנשמרות');
    assert.equal(app.state.scenario, 'practice');
    assert.equal(app.state.style, 'blended');
    assert.equal(JSON.stringify({ selected: app.state.selected, blocks: app.state.blocks }), selection);
  };

  app.apply();
  verify('setup', 1, 'הגדרות התרגול');
  await app.next();
  verify('purpose', 2, 'מטרת התרגול');
  await app.next();
  verify('pick', 3, 'בחירת שאלות');
  assert.equal(levelControl.parentElement?.id, 'pick-level-home');
  const focusBeforeRerender = app.focused.length;
  app.apply();
  assert.equal(app.focused.length, focusBeforeRerender, 'An unchanged step must not steal focus from a question');
  await app.next();
  verify('result', 4, 'תצוגה והדפסה');
  assert.equal(app.resultPreparations(), 1);
  await app.back();
  verify('pick', 3, 'בחירת שאלות');
  await app.back();
  verify('purpose', 2, 'מטרת התרגול');
  await app.back();
  verify('setup', 1, 'הגדרות התרגול');
  assert.equal(levelControl.parentElement?.id, 'wizard-level-home');
  assert.equal(app.focused.length, 6, 'Each of the six actual transitions announces its destination through heading focus');
});
