import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = JSON.parse(readFileSync(new URL('../../../demos/factoring-grade-9-a-source.json', import.meta.url), 'utf8'));
const manifest = JSON.parse(readFileSync(new URL('../../../noam-ai/manifests/6a37fe7160324a17ad107b3dbe43c1db.json', import.meta.url), 'utf8'));
const page = readFileSync(new URL('../../../demos/teacher-practice-picker-site-style.html', import.meta.url), 'utf8');
const printer = readFileSync(new URL('../../../demos/teacher-factoring-print.js', import.meta.url), 'utf8');

describe('grade 9 factoring marked source', () => {
  it('lists only exercises that already exist on the level A worksheet', () => {
    const ids = manifest.exercises.map((exercise: { q: number; part: string }) => String(exercise.q) + (exercise.part || ''));
    assert.equal(source.pdfId, '6a37fe7160324a17ad107b3dbe43c1db');
    assert.equal(source.questions.length, ids.length);
    assert.deepEqual(source.questions.map((question: { id: string }) => question.id), ids);
    for (const question of source.questions) {
      assert.ok(question.page >= 1 && question.page <= manifest.pageCount);
      assert.ok(question.box.w > 0 && question.box.h > 0);
      assert.ok(question.box.x >= 0 && question.box.y >= 0);
      assert.ok(question.box.x + question.box.w <= 1.001);
      assert.ok(question.box.y + question.box.h <= 1.001);
    }
  });

  it('prints marks on the original page and does not offer a link plan as the print', () => {
    assert.match(page, /6a37fe7160324a17ad107b3dbe43c1db\.pdf/);
    assert.match(page, /הצגת הדף המסומן/);
    assert.match(page, /הדפסת הדף המסומן/);
    assert.equal(page.includes('תוכנית בחירה'), false);
    assert.equal(page.includes('mishbetzet'), false);
    assert.match(printer, /source-mark/);
    assert.match(printer, /SOURCE\.pdfUrl/);
    assert.equal(printer.includes('plan-list'), false);
  });
});
