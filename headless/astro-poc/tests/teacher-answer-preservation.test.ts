import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const printer = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const source = JSON.parse(readFileSync(new URL('../public/teachers/sheets/4ea57bfe05164789a2bc235e8c9cf10e.json', import.meta.url), 'utf8'));

function answerApi() {
  const start = printer.indexOf('function isAnswerHeading');
  const end = printer.indexOf('function worksheetTitle');
  return new Function(`${printer.slice(start, end)}
    return { answerSpecsForGroup, answerCropsFromLines };
  `)();
}

const line = (page: number, text: string, y: number, y2: number, x = 0.9, x2 = 0.93) => ({ page, text, y, y2, x, x2 });

// The live G7-T8 excellence answer has two stacked fractions in part 5ג.
// These source coordinates are normalized from its answer page (page 15).
// Keeping the answer as one source rectangle preserves the two fraction bars
// and all numerator/denominator positions without reconstructing their text.
const fractionLine = [
  line(15, 'ג.', 0.73514, 0.74690, 0.86999, 0.88153),
  line(15, 'המלבן 6×6 = 36', 0.73514, 0.74690, 0.76244, 0.86998),
  line(15, 'מחסרים 6·', 0.73514, 0.74690, 0.63545, 0.76242),
  line(15, '2', 0.72901, 0.74006, 0.65520, 0.66300),
  line(15, '2', 0.74184, 0.75289, 0.65520, 0.66300),
  line(15, '4', 0.72901, 0.74006, 0.57407, 0.58187),
  line(15, '2', 0.74184, 0.75289, 0.57407, 0.58187),
];

const answerLines = [
  // A worksheet question mentioning answers is not the answer section.
  line(5, 'התשובות לשאלות הבאות', 0.08, 0.10, 0.4, 0.8),
  line(5, '(5)', 0.2, 0.22),
  line(15, 'תשובות סופיות', 0.06392, 0.07758, 0.79421, 0.91190),
  line(15, '(5)', 0.71298, 0.72534, 0.90699, 0.92857),
  line(15, 'א. הבסיס באורך 6 והגובה 6', 0.71339, 0.72515, 0.45570, 0.88154),
  ...fractionLine,
  line(15, '(6)', 0.84240, 0.85476, 0.90701, 0.92856),
  // Page 16 continues the answers without repeating their heading.
  line(16, '(13)', 0.73330, 0.74566, 0.89817, 0.92857),
  line(16, 'א. המרחק אינו תלוי בגובה', 0.73370, 0.74540, 0.5, 0.88),
  line(16, '(14)', 0.77750, 0.78985, 0.89819, 0.92857),
  line(16, 'א. לפי האיור', 0.77790, 0.78960, 0.7, 0.88),
  line(16, '(15)', 0.82169, 0.83404, 0.89817, 0.92857),
  line(16, 'א. מסלול לפי הנקודות', 0.82210, 0.83380, 0.6, 0.88),
];

const chosen = (numbers: number[]) => source.questions
  .filter((question: { q: number }) => numbers.includes(Number(question.q)))
  .map((question: object) => ({ ...question, source }));

describe('teacher answer preservation', () => {
  it('preserves a complete selected answer and its fractions as one source crop', () => {
    const api = answerApi();
    const specs = api.answerSpecsForGroup({ source, questions: chosen([5]) });
    assert.deepEqual(specs, [{ q: '5', part: '' }]);
    const crops = api.answerCropsFromLines(answerLines, specs);
    assert.equal(crops.length, 1);
    const crop = crops[0];
    assert.equal(crop.page, 15);
    assert.equal(crop.q, 5);
    assert.equal(crop.pieces, undefined, 'Whole answers must not rearrange individual numerator or denominator crops');
    for (const glyph of fractionLine) {
      assert.ok(crop.box.x <= glyph.x && crop.box.x + crop.box.w >= glyph.x2);
      assert.ok(crop.box.y <= glyph.y && crop.box.y + crop.box.h >= glyph.y2);
    }
    assert.ok(crop.box.y + crop.box.h < 0.84240, 'The following answer must not enter the crop');
  });

  it('retains all four selected answers across the unheaded continuation page', () => {
    const api = answerApi();
    const specs = api.answerSpecsForGroup({ source, questions: chosen([5, 13, 14, 15]) });
    assert.deepEqual(specs, [5, 13, 14, 15].map((q) => ({ q: String(q), part: '' })));
    // Input order must not make a continuation page disappear.
    const crops = api.answerCropsFromLines([...answerLines].reverse(), specs);
    assert.deepEqual(crops.map((crop: { page: number; q: number }) => [crop.page, crop.q]), [[15, 5], [16, 13], [16, 14], [16, 15]]);
    assert.ok(crops.every((crop: { pieces?: unknown }) => crop.pieces === undefined));
    assert.ok(crops.every((crop: { page: number }) => crop.page >= 15));
  });

  it('keeps a genuinely partial legacy selection partial even when ids repeat', () => {
    const api = answerApi();
    const partial = chosen([5]).filter((question: { part: string }) => question.part !== 'ו');
    const specs = api.answerSpecsForGroup({ source, questions: [...partial, partial[0], partial[0]] });
    assert.deepEqual(specs.map((spec: { part: string }) => spec.part).sort(), ['א', 'ב', 'ג', 'ד', 'ה']);
    assert.ok(specs.every((spec: { q: string }) => spec.q === '5'));
  });

  it('deduplicates a complete selection and measures completeness per source', () => {
    const api = answerApi();
    const complete = chosen([5]);
    assert.deepEqual(api.answerSpecsForGroup({ source, questions: [...complete, complete[0]] }), [{ q: '5', part: '' }]);
    const otherSource = { pdfId: 'another-level', questions: [{ id: '5א', q: 5, part: 'א' }, { id: '5ב', q: 5, part: 'ב' }] };
    const otherSelection = [{ ...otherSource.questions[0], source: otherSource }];
    assert.deepEqual(api.answerSpecsForGroup({ source: otherSource, questions: otherSelection }), [{ q: '5', part: 'א' }]);
    assert.deepEqual(api.answerSpecsForGroup({ source, questions: complete }), [{ q: '5', part: '' }]);
  });

  it('uses complete-answer specifications in the actual print pipeline', async () => {
    const pure = printer.slice(printer.indexOf('function isAnswerHeading'), printer.indexOf('function worksheetTitle'));
    const measured = printer.slice(printer.indexOf('async function answerMeasured'), printer.indexOf('async function paintAllShort'));
    const run = new Function('lines', `${pure}
      const sheetTextLines = async () => lines;
      const answerFallbackSlices = () => { throw new Error('Unexpected fallback for readable answer text'); };
      const levelPrintName = () => 'מצוינות';
      const measureSlices = async (slices) => slices;
      ${measured}
      return answerMeasured;
    `)(answerLines);
    const slices = await run([{ source, questions: chosen([5, 13, 14, 15]) }]);
    const answers = slices.filter((slice: { block: string }) => slice.block.startsWith('answer:'));
    assert.equal(answers.length, 4);
    assert.ok(answers.every((slice: { pieces?: unknown }) => slice.pieces === undefined));
    assert.deepEqual(answers.map((slice: { page: number }) => slice.page), [15, 16, 16, 16]);
  });
});
