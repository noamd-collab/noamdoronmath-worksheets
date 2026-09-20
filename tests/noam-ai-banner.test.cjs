const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const discovery = fs.readFileSync(path.join(root, 'noam-discovery.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'noam-discovery.css'), 'utf8');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

test('the Noam AI catalog explanation is permanently visible without a disclosure arrow', () => {
  assert.match(discovery, /\.toolbar'\)\.after\(aiBanner\)/);
  assert.doesNotMatch(discovery, /createElement\('details'\).*ai-details/);
  assert.doesNotMatch(discovery, /על העזרה של נועם AI/);
  assert.doesNotMatch(css, /\.ai-details/);
});

test('the shared banner keeps grade-aware text for every catalog grade', () => {
  assert.match(index, /MIDDLE\.indexOf\(state\.grade\) !== -1/);
  assert.match(index, /בכל דף עבודה של/);
  assert.match(index, /נועם AI בדרך גם ליסודי/);
});
