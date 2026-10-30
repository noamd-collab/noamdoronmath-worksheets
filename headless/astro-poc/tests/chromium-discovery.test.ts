import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chromiumCandidates } from './helpers/chromium.ts';

test('an explicit browser path is respected without silently using another installation', () => {
  assert.deepEqual(chromiumCandidates('darwin', '/example', { CHROME_PATH: '/custom/chrome' }), ['/custom/chrome']);
});

test('browser discovery includes user-installed macOS browsers and Linux Chromium', () => {
  assert.equal(chromiumCandidates('darwin', '/example', {})[0], '/example/Applications/Google Chrome.app/Contents/MacOS/Google Chrome');
  assert.ok(chromiumCandidates('linux', '/example', {}).includes('/usr/bin/chromium'));
});
