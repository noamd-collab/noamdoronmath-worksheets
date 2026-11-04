import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseHTML } from 'linkedom';
import { groupWholeQuestions } from '../public/teachers/teacher-question-pick.js';
import {
  SECTION_KINDS,
  TEST_TOTAL_POINTS,
  needsSectionHeadings,
  pointsLabel,
  scoreLabel,
  sectionKind,
  sectionTitle,
  testPoints,
} from '../public/teachers/teacher-page-sections.js';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const html = read('../public/teachers/index.html');
const printer = read('../public/teachers/teacher-factoring-print.js');
const sections = read('../public/teachers/teacher-page-sections.js');

const q = (n: number) => n;
const sum = (list: number[]) => list.reduce((a, b) => a + b, 0);

function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, `Missing shipped function ${name}`);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

function pageBuilder(searchEnabled: boolean) {
  const { document } = parseHTML(html);
  const order = printer.match(/const WIZARD_ORDER = (\[[^;]+\]);/);
  assert.ok(order);
  const calls = { invalidations: 0, focus: [] as string[], announcements: [] as string[] };
  for (const id of ['teacher-workspace', 'wizard-bar']) document.getElementById(id)!.hidden = false;
  for (const id of ['wizard-label', 'topic']) document.getElementById(id)!.focus = () => { calls.focus.push(id); };
  return new Function('document', 'calls', 'searchEnabled', 'SECTION_KINDS', 'sectionKind', 'groupWholeQuestions', `
    const $ = id => document.getElementById(id);
    const state = { grade: '9', topic: '2', wizard: 'pick', sectionKind: 'review', selected: [], blocks: [], pickNote: '' };
    let history = [];
    const WIZARD_ORDER = ${order[1]};
    const topicSearch = searchEnabled ? { close() {}, focus() { calls.focus.push('topic-search'); } } : null;
    const currentTopic = () => ({ title: 'פירוק לגורמים' });
    const source = { pdfId: 'source' };
    const library = new Map([
      ['ex:source:1', { id: '1', q: 1, source }],
      ['ex:source:2א', { id: '2א', q: 2, part: 'א', source }],
      ['ex:source:2ב', { id: '2ב', q: 2, part: 'ב', source }],
    ]);
    const clearPreparedPrint = () => { calls.invalidations += 1; };
    const announce = message => calls.announcements.push(message);
    const render = () => { paintPageBuilder(); applyWizard(); };
    ${['escapeHTML', 'blockQuestionCount', 'sectionToggleHTML', 'questionCountText', 'carriedKeys',
      'paintPageBuilder', 'addAnotherTopic', 'applyWizard', 'bind'].map(definition).join('\n')}
    bind();
    render();
    return { document, state, calls, render };
  `)(document, calls, searchEnabled, SECTION_KINDS, sectionKind, groupWholeQuestions);
}

describe('teacher page sections', () => {
  it('keeps the add-topic action visible and saves fresh questions only after an explicit click', () => {
    for (const searchEnabled of [true, false]) {
      const app = pageBuilder(searchEnabled);
      const { document } = app;
      const button = document.getElementById('add-topic');
      assert.ok(button);
      assert.equal(button.textContent, '+ הוספת נושא לדף');
      assert.equal(button.closest('.wiz-off, [hidden]'), null, 'The action stays visible in step 3 even before selection');
      assert.equal(button.disabled, true);
      assert.equal(button.getAttribute('aria-describedby'), 'add-topic-help');
      assert.equal(document.getElementById('add-topic-help').textContent,
        'השאלות שכבר בחרתם יישמרו בדף. אפשר להוסיף נושא נוסף באותה כיתה.');
      assert.equal(document.querySelector('#more-topic, #more-topic-yes, #more-topic-no'), null);
      const saved = { grade: '9', topic: '1', title: 'נושא קודם', kind: 'test', keys: ['ex:source:1'] };
      app.state.blocks = [structuredClone(saved)];
      app.state.selected = ['ex:source:1'];
      app.render();
      assert.equal(button.disabled, true, 'Previously saved questions cannot create a duplicate section');
      assert.equal(button.closest('.wiz-off, [hidden]'), null);
      app.state.selected = ['ex:source:1', 'ex:source:2א', 'ex:source:2ב'];
      app.render();
      assert.equal(button.disabled, false);
      assert.equal(app.state.wizard, 'pick', 'Selection alone does not move to another step');
      assert.deepEqual(app.state.blocks, [saved], 'Selection alone does not save a section');
      button.dispatchEvent(new document.defaultView.Event('click', { bubbles: true }));
      assert.deepEqual(app.state.blocks, [saved, { grade: '9', topic: '2', title: 'פירוק לגורמים',
        kind: 'review', keys: ['ex:source:2א', 'ex:source:2ב'] }]);
      assert.deepEqual(app.state.selected, []);
      assert.equal(app.state.grade, '9');
      assert.equal(app.state.wizard, 'setup');
      assert.equal(button.disabled, true, 'Saving consumes the fresh selection');
      assert.equal(app.calls.invalidations, 1);
      assert.equal(app.calls.focus.at(-1), searchEnabled ? 'topic-search' : 'topic');
      assert.match(app.calls.announcements.at(-1), /השאלות נשמרו בדף/);
    }
  });

  it('names the two section types as Noam asked and never as a test without points', () => {
    assert.equal(SECTION_KINDS.test.label, 'קטע ממבחן');
    assert.equal(SECTION_KINDS.review.label, 'דף חזרה');
    assert.match(html, /id="section-kind-test"[^>]*data-section-kind="test"[^>]*>קטע ממבחן<\/button>/);
    assert.match(html, /id="section-kind-review"[^>]*data-section-kind="review"[^>]*>דף חזרה<\/button>/);
    for (const text of [html, printer, sections]) assert.equal(text.includes('מבחן בלי ניקוד'), false);
    assert.equal(sectionKind('test'), 'test');
    assert.equal(sectionKind('review'), 'review');
    assert.equal(sectionKind(undefined), 'review');
  });

  it('spreads 100 points over every test question on a mixed page and none over review questions', () => {
    const blocks = [
      { kind: 'test', questions: q(2) },
      { kind: 'review', questions: q(2) },
      { kind: 'test', questions: q(5) },
      { kind: 'review', questions: q(10) },
    ];
    const points = testPoints(blocks);
    assert.equal(points.length, 4);
    assert.deepEqual(points[1], []);
    assert.deepEqual(points[3], []);
    assert.equal(points[0].length, 2);
    assert.equal(points[2].length, 5);
    assert.equal(sum([...points[0], ...points[2]]), TEST_TOTAL_POINTS);
    assert.deepEqual([...points[0], ...points[2]], [15, 15, 14, 14, 14, 14, 14]);
    assert.equal(sum(testPoints([{ kind: 'test', questions: q(17) }])[0]), 100);
    assert.equal(sum(testPoints([{ kind: 'test', questions: q(3) }])[0]), 100);
  });

  it('adds section headings when the page has a test section or more than one topic', () => {
    assert.equal(needsSectionHeadings([{ kind: 'review', questions: q(4) }]), false);
    assert.equal(needsSectionHeadings([{ kind: 'test', questions: q(4) }]), true);
    assert.equal(needsSectionHeadings([{ kind: 'review', questions: q(1) }, { kind: 'review', questions: q(1) }]), true);
    assert.equal(sectionTitle('test', 'פירוק לגורמים'), 'מבחן · פירוק לגורמים');
    assert.equal(sectionTitle('review', 'חוק הפילוג המורחב'), 'חזרה על חומר · חוק הפילוג המורחב');
    assert.equal(pointsLabel(2, 33), 'שאלה 2 · 33 נק׳');
    assert.equal(scoreLabel(100), 'ציון: ______ מתוך 100');
  });

  it('prints a test section with date, class, score and points, and a review section with questions only', () => {
    assert.match(printer, /function paintSectionHeading\(ctx, slice, x0, drawW, y, fit\)/);
    assert.match(printer, /'תאריך:'/);
    assert.match(printer, /'כיתה:'/);
    assert.match(printer, /scoreLabel\(/);
    assert.match(printer, /pointsLabel\(/);
    assert.match(printer, /testPoints\(/);
    assert.match(printer, /'שם:'/);
  });

  it('keeps earlier topics on the same page and lets each one be a test or review section', () => {
    assert.match(printer, /function addAnotherTopic\(\)/);
    assert.match(printer, /state\.blocks\.push\(/);
    assert.match(printer, /state\.wizard = 'setup'/);
    assert.match(printer, /data-block-kind/);
    assert.match(html, /id="page-blocks"/);
    assert.match(printer, /data-block-remove/);
    assert.match(printer, /function carriedKeys\(\)/);
    assert.match(printer, /השאלה כבר בדף, בנושא שנשמר קודם\./);
    assert.match(printer, /const saved = carriedKeys\(\);\s*state\.selected = state\.selected\.filter\(\(key\) => !saved\.has\(key\)\);/);
    assert.match(printer, /\.filter\(\(key\) => !saved\.has\(key\)\);\s*state\.pickNote = '';/);
  });

  it('keeps the new page-builder styles out of <head>', () => {
    const [head, body] = html.split('</head>');
    for (const rule of ['.section-kind-group{', '.add-topic-action{', '.page-block{', '.q-preview{']) {
      assert.equal(head.includes(rule), false, rule);
      assert.ok(body.includes(rule), rule);
    }
  });

  it('keeps the demo copy of the sections module in step with the site', () => {
    assert.equal(read('../../../demos/teacher-page-sections.js'), sections);
  });
});
