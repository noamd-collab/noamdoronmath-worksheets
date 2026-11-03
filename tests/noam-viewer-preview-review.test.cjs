'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

for (const file of ['worksheet-viewer-noam.html', 'headless/astro-poc/public/worksheet-viewer-noam.html']) {
  const html = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  const script = html.match(/<script id="noam-preview-viewer-redirect">([\s\S]*?)<\/script>/)[1];
  const preview = 'https://abc123-noam-math-astro-poc-amiramnoam-130a.wix-site-host.com';
  function redirect(url) {
    const location = new URL(url);
    const calls = [];
    location.replace = value => calls.push(value);
    vm.runInNewContext(script, { window: { location }, URLSearchParams });
    return calls;
  }
  test(`${file}: explicit review link stays on the preview`, () => {
    assert.deepEqual(redirect(preview + '/worksheet-viewer-noam.html?pdf=fixture&review=1#question'), []);
  });
  test(`${file}: ordinary preview retains production redirect and full worksheet URL`, () => {
    for (const query of ['?pdf=fixture', '?pdf=fixture&review=0', '?pdf=fixture&review=true']) {
      assert.deepEqual(redirect(preview + '/worksheet-viewer-noam.html' + query + '#question'),
        ['https://www.noamdoronmath.co.il/worksheet-viewer-noam.html' + query + '#question']);
    }
  });
  test(`${file}: the review option does not broaden host or pathname matching`, () => {
    for (const url of [
      'https://www.noamdoronmath.co.il/worksheet-viewer-noam.html',
      'http://127.0.0.1/worksheet-viewer-noam.html',
      'https://unrelated.wix-site-host.com/worksheet-viewer-noam.html',
      preview + '/worksheets',
    ]) assert.deepEqual(redirect(url), []);
  });
}
