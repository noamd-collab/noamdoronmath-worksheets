import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { parseHTML } from 'linkedom';
import { createTeacherDocx } from '../public/teachers/teacher-word-export.js';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
function definition(name: string) {
  const start = printer.search(new RegExp(`(?:^|\\n)(?:async )?function ${name}\\(`));
  assert.notEqual(start, -1, name);
  const tail = printer.slice(start + (printer[start] === '\n' ? 1 : 0));
  const end = tail.search(/\n(?:async )?function /);
  return end < 0 ? tail : tail.slice(0, end);
}

function documentXml(bytes: Uint8Array) {
  const zip = Buffer.from(bytes);
  let offset = 0;
  while (zip.readUInt32LE(offset) === 0x04034b50) {
    const size = zip.readUInt32LE(offset + 18);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const name = zip.subarray(offset + 30, offset + 30 + nameLength).toString();
    const start = offset + 30 + nameLength + extraLength;
    if (name === 'word/document.xml') return zip.subarray(start, start + size).toString();
    offset = start + size;
  }
  throw new Error('Missing Word document');
}

const question = {
  id: 'a'.repeat(32) + ':1', topic: 'פירוק לגורמים', levelLabel: 'רמה א׳',
  text: 'פרקו לגורמים $6x+9$.', items: [{ label: 'א', text: 'הוציאו גורם משותף.', answer: '$3(2x+3)$' }],
};
const noImage = () => { throw new Error('Unexpected image'); };

test('Word independently hides the level and excludes answer content and answer page breaks', async () => {
  for (const showLevel of [false, true]) {
    for (const includeAnswers of [false, true]) {
      const xml = documentXml(await createTeacherDocx({ questions: [question], showLevel, includeAnswers }, noImage));
      assert.equal(xml.includes('רמה א׳'), showLevel);
      assert.equal(xml.includes('תשובות סופיות'), includeAnswers);
      assert.equal(xml.includes('<w:pageBreakBefore/>'), includeAnswers);
      assert.equal(xml.includes('3(2x+3)'), includeAnswers);
      assert.ok(xml.includes('6x+9'), 'Student math remains editable in the document');
      assert.ok(xml.includes('<m:oMath>'));
      assert.ok(xml.includes('שם התלמיד או התלמידה'));
    }
  }
});

test('Word only requires answers when the teacher requests the answer appendix', async () => {
  const unanswered = { ...question, items: [{ ...question.items[0], answer: '' }] };
  const xml = documentXml(await createTeacherDocx({ questions: [unanswered], includeAnswers: false }, noImage));
  assert.ok(xml.includes('הוציאו גורם משותף'));
  assert.ok(!xml.includes('תשובות סופיות'));
  await assert.rejects(createTeacherDocx({ questions: [unanswered], includeAnswers: true }, noImage), /INCOMPLETE_ANSWERS/);
});

test('student printing skips answer lookup when answers are disabled, and remains strict when enabled', async () => {
  const answerMeasured = new Function(`
    const measureSlices = async slices => slices;
    const selectedAnswerCrops = () => { throw Object.assign(new Error('missing'), { code: 'MISSING_ANSWERS' }); };
    ${definition('answerMeasured')}
    return answerMeasured;
  `)();
  const groups = [{ source: { pdfId: 'source' }, questions: [{ q: 1 }] }];
  assert.deepEqual(await answerMeasured(groups, { includeAnswers: false }), []);
  await assert.rejects(answerMeasured(groups, { includeAnswers: true }), { code: 'MISSING_ANSWERS' });
});

test('composed student pages omit level headings while keeping question crops and requested answers', async () => {
  const render = new Function(`
    let SOURCE;
    const orderPrintQuestions = questions => questions;
    const needsSectionHeadings = () => false;
    const batchesOf = questions => questions.map(question => ({ questions: [question] }));
    const shortSlices = questions => [{ kind: 'row', page: 1, block: 'q' + questions[0].q, box: { x: .1, y: .2, w: .8, h: .1 } }];
    const testPoints = sections => sections.map(() => []);
    const sectionKind = kind => kind;
    const measureSlices = async slices => slices;
    const worksheetTitle = () => 'פירוק לגורמים';
    const answerMeasured = async (groups, options) => options.includeAnswers === false ? [] : [{ kind: 'answer', q: groups[0].questions[0].q }];
    const paintPacked = async (root, exercises, answers) => { root.exercises = exercises; root.answers = answers; };
    ${definition('levelPrintName')}
    ${definition('paintAllShort')}
    return paintAllShort;
  `)();
  const chosen = [{ q: 1, source: { pdfId: 'source', level: 'a', levelLabel: 'רמה א׳' } }];
  const without: any = {};
  await render(without, chosen, null, { showLevel: false, includeAnswers: false });
  assert.equal(without.exercises.length, 1);
  assert.equal(without.exercises[0].kind, 'row');
  assert.deepEqual(without.answers, []);
  const withLabels: any = {};
  await render(withLabels, chosen, null, { showLevel: true, includeAnswers: true });
  assert.equal(withLabels.exercises[0].label, 'רמה א׳');
  assert.deepEqual(withLabels.exercises[1], without.exercises[0]);
  assert.equal(withLabels.answers.length, 1);
});

test('rapid option changes commit only the latest captured choices, even when an older render fails', async () => {
  for (const olderFails of [false, true]) {
    const { document } = parseHTML(`<html><body>
      <input id="print-show-level"><input id="print-include-answers">
      <textarea id="teacher-note"></textarea><button id="wizard-print"></button>
      <div id="wizard-review"></div><div id="wizard-page-count"></div>
      <div id="dialog-plan"></div><div id="print-area"></div><div id="wizard-preview"></div>
    </body></html>`);
    const pending: { options: any; resolve: () => void; reject: (error: Error) => void }[] = [];
    const app = new Function('document', 'pending', `
      const $ = id => document.getElementById(id);
      let printGeneration = 0, printMode = 'short';
      const state = { blocks: [], sectionKind: 'review', scenario: 'first', style: 'scaffold', wizard: 'result' };
      const SCENARIOS = { first: { label: 'מפגש ראשון' } }, STYLES = { scaffold: { label: 'מדורגת' } };
      const PRINT_UNPREPARED = '<p class="print-unprepared">מכינים</p>';
      const renderTeacherPageCount = () => {}, available = () => true, pageBlocks = () => [];
      const resolveChosen = async () => [{ q: 1, source: { pdfId: 'source' } }];
      const exKey = (pdfId, id) => pdfId + ':' + id;
      const paintTeacherReview = () => {};
      const updateShortPrint = async (plan, area, chosen, note, cfg, blocks, options) => {
        await new Promise((resolve, reject) => pending.push({ options, resolve, reject }));
        area.innerHTML = '<figure data-level="' + options.showLevel + '" data-answers="' + options.includeAnswers + '"></figure>';
        plan.innerHTML = area.innerHTML;
      };
      ${definition('clearPreparedPrint')}
      ${definition('updatePrint')}
      return { render: updatePrint, invalidate: clearPreparedPrint };
    `)(document, pending);
    const levelControl = document.getElementById('print-show-level') as unknown as HTMLInputElement;
    const answerControl = document.getElementById('print-include-answers') as unknown as HTMLInputElement;
    levelControl.checked = true;
    answerControl.checked = true;
    const oldRender = app.render();
    await Promise.resolve();
    levelControl.checked = false;
    answerControl.checked = false;
    app.invalidate();
    const currentRender = app.render();
    await Promise.resolve();
    assert.equal(pending.length, 2);
    assert.deepEqual(pending.map(entry => entry.options), [
      { showLevel: true, includeAnswers: true }, { showLevel: false, includeAnswers: false },
    ]);
    pending[1].resolve();
    assert.equal(await currentRender, true);
    if (olderFails) pending[0].reject(new Error('Old answer fetch failed'));
    else pending[0].resolve();
    assert.equal(await oldRender, false);
    for (const id of ['print-area', 'dialog-plan']) {
      const figure = document.getElementById(id)?.querySelector('figure');
      assert.ok(figure);
      assert.equal(figure.dataset.level, 'false');
      assert.equal(figure.dataset.answers, 'false');
    }
    assert.equal((document.getElementById('wizard-print') as unknown as HTMLButtonElement).disabled, false);
  }
});
