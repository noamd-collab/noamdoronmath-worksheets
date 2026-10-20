import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { test } from 'node:test';

const js = readFileSync(new URL('../public/teachers/teacher-factoring-print.js', import.meta.url), 'utf8');
const markBox = new Function(js.slice(js.indexOf('function selectionMarkBox'), js.indexOf('function sheetHTML')) + ';return selectionMarkBox;')();
const sheetDir = new URL('../public/teachers/sheets/', import.meta.url);
const problem = JSON.parse(readFileSync(new URL('0d2c19b340234a8db8c0bc9d080b50d1.json', sheetDir), 'utf8'));

test('the reported similarity sheet gets separate marks beside, not over, each chosen sentence', () => {
  const questions = problem.questions.filter(q => q.q <= 2);
  const marks = questions.map(q => ({ q, box: markBox(q) }));
  for (let i = 0; i < marks.length; i++) {
    const { q, box } = marks[i];
    assert.ok(box.x > q.box.x + q.box.w, q.id);
    assert.ok(Math.abs(box.y + box.h / 2 - (q.labelLine.y + q.labelLine.h / 2)) < 0.00001, q.id);
    if (i) assert.ok(marks[i - 1].box.y + marks[i - 1].box.h < box.y, q.id);
  }
});

test('every catalog mark stays outside its source text rectangle and within the page', () => {
  let count = 0;
  for (const name of readdirSync(sheetDir).filter(name => name.endsWith('.json'))) {
    const source = JSON.parse(readFileSync(new URL(name, sheetDir), 'utf8'));
    for (const q of source.questions.filter(q => q.box)) {
      const mark = markBox(q);
      assert.ok(mark, `${name} ${q.id}`);
      assert.ok(mark.x >= q.box.x + q.box.w + 0.005, `${name} ${q.id}`);
      assert.ok(mark.x + mark.w <= 1 && mark.y >= 0 && mark.y + mark.h <= 1, `${name} ${q.id}`);
      count++;
    }
  }
  assert.ok(count > 30000);
});

test('printing draws only the check path, in the same bounds as the preview', () => {
  const mark = markBox(problem.questions[0]);
  const points: number[][] = [];
  let strokes = 0;
  const ctx = {
    save() {}, restore() {}, beginPath() {},
    moveTo(x, y) { points.push([x, y]); },
    lineTo(x, y) { points.push([x, y]); },
    stroke() { strokes++; },
    fillRect() { assert.fail('must not cover source text'); },
    strokeRect() { assert.fail('must not frame source text'); },
  };
  const bake = new Function(js.slice(js.indexOf('function bakeMarks'), js.indexOf('async function paintSheets')) + ';return bakeMarks;')();
  bake({ width: 1100, height: 1555, getContext: () => ctx }, {
    querySelectorAll: () => [{ style: { left: `${mark.x * 100}%`, top: `${mark.y * 100}%`, width: `${mark.w * 100}%`, height: `${mark.h * 100}%` } }],
  });
  assert.equal(strokes, 1);
  assert.equal(points.length, 3);
  for (const [x, y] of points) {
    assert.ok(x > mark.x * 1100 && x < (mark.x + mark.w) * 1100);
    assert.ok(y > mark.y * 1555 && y < (mark.y + mark.h) * 1555);
  }
  for (const f of ['../public/teachers/index.html', '../../../demos/teacher-practice-picker-site-style.html']) {
    const html = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(html, /\.print-area \.source-mark\{display:none/);
    assert.doesNotMatch(html, /\.source-mark\{[^}]*outline:3px/);
  }
});

test('invalid boxes are omitted rather than covering the page', () => {
  for (const box of [null, { x: NaN, y: 0, w: 0.1, h: 0.1 }, { x: 0.99, y: 0.1, w: 0.01, h: 0.02 }]) {
    assert.equal(markBox({ box }), null);
  }
});
