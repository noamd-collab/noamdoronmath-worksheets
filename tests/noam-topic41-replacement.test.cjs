'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const viewer = fs.readFileSync(path.join(root, 'worksheet-viewer-noam.html'), 'utf8');

// Grade 8 topic 41, the isosceles-proof sheets, after they were moved into the
// Wix media library like every other worksheet.
const ids = {
  a: '51c4ed1e225c4325825970d9aca00a05',
  b: '6007b826b92a4d97a56c4ab5f8df8318',
  c: '18ec1bc8c0374b8aa8c8f059a3da665b'
};

function fn(src, name) {
  const start = src.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' not found');
  return src.slice(start, src.indexOf('\n}', start) + 2);
}

const ctx = { BASE: 'https://www.noamdoronmath.co.il/_files/ugd/d8e7ad_' };
vm.createContext(ctx);
vm.runInContext(fn(index, 'url') + '\n' + fn(viewer, 'noamWorksheetPdfUrl'), ctx);

test('every worksheet, topic 41 included, resolves to the Wix media prefix', () => {
  for (const id of Object.values(ids)) {
    assert.equal(ctx.url(id), ctx.BASE + id + '.pdf');
    assert.equal(ctx.noamWorksheetPdfUrl(id), ctx.BASE + id + '.pdf');
  }
  const other = '7b7e8140483b4b45bb06aaaf8acbc698';
  assert.equal(ctx.url(other), ctx.BASE + other + '.pdf');
  assert.equal(ctx.url(''), '');
  assert.equal(ctx.url('https://example.org/test.pdf'), 'https://example.org/test.pdf');
});

test('no worksheet PDF is served from this repository', () => {
  assert.ok(!fs.existsSync(path.join(root, 'worksheets')), 'PDFs belong in the Wix media library');
  assert.ok(!/worksheets\/grade8/.test(index));
  assert.ok(!/worksheets\/grade8/.test(viewer));
});

test('the topic 41 maps cover all 20 questions, both real subparts, and exclude answer pages', () => {
  for (const [level, id] of Object.entries(ids)) {
    const m = JSON.parse(fs.readFileSync(path.join(root, 'noam-ai/manifests', id + '.json')));
    assert.equal(m.pdfHash, id);
    assert.equal(m.level, level);
    assert.equal(m.grade, 8);
    assert.equal(m.topicId, 41);
    assert.equal(m.exercises.length, 22);
    assert.equal(new Set(m.exercises.map(e => e.id)).size, 22);
    assert.deepEqual([...new Set(m.exercises.map(e => e.q))], Array.from({ length: 20 }, (_, i) => i + 1));
    for (const e of m.exercises) {
      assert.equal(e.requiresVision, true);
      assert.equal(e.pin.page, e.crop.page);
      assert.ok(e.pin.page <= m.pageCount - 2);
      assert.ok(e.crop.y <= e.pin.y && e.pin.y < e.crop.y + e.crop.h);
      assert.ok(e.crop.x >= 0 && e.crop.x + e.crop.w <= 1);
      assert.ok(e.crop.y >= 0 && e.crop.y + e.crop.h <= 1);
      assert.equal(e.part !== '', e.q === 8 || e.q === 16);
    }
  }
});

test('all inline viewer scripts remain syntactically valid', () => {
  for (const m of viewer.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)) {
    if (m[1].trim()) new vm.Script(m[1]);
  }
});
