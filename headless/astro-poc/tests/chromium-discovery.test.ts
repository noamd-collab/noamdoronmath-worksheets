import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveTestBrowser } from './helpers/chromium';

test('Mac fixtures can use an installed Brave browser without CHROME_PATH', () => {
  const installed = '/Applications/Brave Origin.app/Contents/MacOS/Brave Origin';
  assert.equal(resolveTestBrowser({ platform: 'darwin', env: {}, canExecute: (path) => path === installed }), installed);
});

test('an explicit invalid CHROME_PATH fails instead of silently testing with a different browser', () => {
  assert.throws(() => resolveTestBrowser({ platform: 'linux', env: { CHROME_PATH: '/missing/chrome' }, canExecute: () => false }), /CHROME_PATH/);
  assert.equal(resolveTestBrowser({ env: { CHROME_PATH: '/custom/chrome' }, canExecute: (path) => path === '/custom/chrome' }), '/custom/chrome');
});

test('Linux Chromium and a custom PATH are supported, and missing browsers still fail', () => {
  assert.equal(resolveTestBrowser({ platform: 'linux', env: {}, canExecute: (path) => path === '/usr/bin/chromium' }), '/usr/bin/chromium');
  assert.equal(resolveTestBrowser({ platform: 'linux', env: { PATH: '/custom/bin' }, canExecute: (path) => path === '/custom/bin/chromium' }), '/custom/bin/chromium');
  assert.throws(() => resolveTestBrowser({ platform: 'darwin', env: {}, canExecute: () => false }), /No Chromium browser found/);
});


test('Windows program paths and Linux Brave binaries can be resolved without shell lookup', () => {
  const windowsBrowser = String.raw`C:\Program Files\Microsoft\Edge\Application\msedge.exe`;
  assert.equal(resolveTestBrowser({ platform: 'win32', env: { PROGRAMFILES: String.raw`C:\Program Files` }, canExecute: (path) => path === windowsBrowser }), windowsBrowser);
  assert.equal(resolveTestBrowser({ platform: 'linux', env: {}, canExecute: (path) => path === '/usr/bin/brave-browser' }), '/usr/bin/brave-browser');
});
